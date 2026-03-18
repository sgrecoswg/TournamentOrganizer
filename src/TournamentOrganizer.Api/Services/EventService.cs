using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;
using TournamentOrganizer.Api.Services.Interfaces;

namespace TournamentOrganizer.Api.Services;

public class EventService : IEventService
{
    private readonly IEventRepository _eventRepo;
    private readonly IPlayerRepository _playerRepo;
    private readonly IGameRepository _gameRepo;
    private readonly IPodService _podService;
    private readonly ITrueSkillService _trueSkillService;
    private readonly IStoreEventRepository _storeEventRepo;
    private readonly IDiscordWebhookService _discordService;
    private readonly IBadgeService _badgeService;

    public EventService(
        IEventRepository eventRepo,
        IPlayerRepository playerRepo,
        IGameRepository gameRepo,
        IPodService podService,
        ITrueSkillService trueSkillService,
        IStoreEventRepository storeEventRepo,
        IDiscordWebhookService discordService,
        IBadgeService badgeService)
    {
        _eventRepo = eventRepo;
        _playerRepo = playerRepo;
        _gameRepo = gameRepo;
        _podService = podService;
        _trueSkillService = trueSkillService;
        _storeEventRepo = storeEventRepo;
        _discordService = discordService;
        _badgeService = badgeService;
    }

    public async Task<EventDto> CreateAsync(CreateEventDto dto)
    {
        var pointSystem = Enum.TryParse<PointSystem>(dto.PointSystem, true, out var ps) ? ps : PointSystem.ScoreBased;
        var evt = new Event
        {
            Name = dto.Name,
            Date = dto.Date,
            DefaultRoundTimeMinutes = dto.DefaultRoundTimeMinutes,
            MaxPlayers = dto.MaxPlayers,
            PointSystem = pointSystem
        };
        await _eventRepo.CreateAsync(evt);
        await _storeEventRepo.AddAsync(new StoreEvent { StoreId = dto.StoreId!.Value, EventId = evt.Id });
        var (_, createdStoreName) = await _storeEventRepo.GetStoreInfoForEventAsync(evt.Id);
        return ToEventDto(evt, 0, dto.StoreId, createdStoreName);
    }

    public async Task<EventDto?> GetByIdAsync(int id)
    {
        var evt = await _eventRepo.GetByIdAsync(id);
        if (evt == null) return null;

        var players = await _eventRepo.GetRegisteredPlayersAsync(id);
        var (storeId, storeName) = await _storeEventRepo.GetStoreInfoForEventAsync(id);
        return ToEventDto(evt, players.Count, storeId, storeName);
    }

    public async Task<List<EventDto>> GetAllAsync(int? storeId = null)
    {
        var events = await _eventRepo.GetAllWithStoreAsync(storeId);
        var result = new List<EventDto>();
        foreach (var evt in events.Where(e => e.Status != EventStatus.Removed))
        {
            var players = await _eventRepo.GetRegisteredPlayersAsync(evt.Id);
            result.Add(ToEventDto(evt, players.Count, evt.StoreEvent?.StoreId, evt.StoreEvent?.Store?.StoreName));
        }
        return result;
    }

    public async Task RemoveAsync(int eventId)
    {
        var evt = await _eventRepo.GetByIdAsync(eventId)
            ?? throw new InvalidOperationException("Event not found.");

        evt.Status = EventStatus.Removed;
        await _eventRepo.UpdateAsync(evt);
    }

    public async Task RegisterPlayerAsync(int eventId, int playerId, string? decklistUrl = null, string? commanders = null)
    {
        var evt = await _eventRepo.GetByIdAsync(eventId)
            ?? throw new InvalidOperationException("Event not found.");

        if (evt.Status != EventStatus.Registration)
            throw new InvalidOperationException("Event is not in registration phase.");

        var player = await _playerRepo.GetByIdAsync(playerId)
            ?? throw new InvalidOperationException("Player not found.");

        if (await _eventRepo.IsPlayerRegisteredAsync(eventId, playerId))
            throw new InvalidOperationException("Player is already registered.");

        // Reactivate a previously dropped registration rather than creating a duplicate row.
        var existing = await _eventRepo.GetRegistrationAsync(eventId, playerId);
        if (existing != null)
        {
            existing.IsDropped = false;
            existing.IsDisqualified = false;
            existing.IsCheckedIn = false;
            existing.IsWaitlisted = false;
            existing.WaitlistPosition = null;
            existing.DecklistUrl = decklistUrl;
            existing.Commanders = commanders;
            await _eventRepo.UpdateRegistrationAsync(existing);
            return;
        }

        bool isWaitlisted = false;
        int? waitlistPosition = null;
        if (evt.MaxPlayers.HasValue)
        {
            var allRegistrations = await _eventRepo.GetRegistrationsWithPlayersAsync(eventId);
            var activeCount = allRegistrations.Count(r => !r.IsWaitlisted && !r.IsDropped && !r.IsDisqualified);
            if (activeCount >= evt.MaxPlayers.Value)
            {
                var maxPos = allRegistrations.Where(r => r.IsWaitlisted).Select(r => r.WaitlistPosition ?? 0).DefaultIfEmpty(0).Max();
                isWaitlisted = true;
                waitlistPosition = maxPos + 1;
            }
        }

        await _eventRepo.RegisterPlayerAsync(new EventRegistration
        {
            EventId = eventId,
            PlayerId = playerId,
            DecklistUrl = decklistUrl,
            Commanders = commanders,
            IsWaitlisted = isWaitlisted,
            WaitlistPosition = waitlistPosition
        });
    }

    public async Task PromoteFromWaitlistAsync(int eventId)
    {
        var registrations = await _eventRepo.GetRegistrationsWithPlayersAsync(eventId);
        var waitlisted = registrations
            .Where(r => r.IsWaitlisted)
            .OrderBy(r => r.WaitlistPosition ?? int.MaxValue)
            .ToList();

        if (waitlisted.Count == 0) return;

        var toPromote = waitlisted[0];
        toPromote.IsWaitlisted = false;
        toPromote.WaitlistPosition = null;
        await _eventRepo.UpdateRegistrationAsync(toPromote);

        // Renumber remaining waitlist from 1
        var remaining = waitlisted.Skip(1).ToList();
        for (int i = 0; i < remaining.Count; i++)
        {
            remaining[i].WaitlistPosition = i + 1;
            await _eventRepo.UpdateRegistrationAsync(remaining[i]);
        }
    }

    public async Task<EventPlayerDto> ManualPromoteAsync(int eventId, int playerId)
    {
        var registrations = await _eventRepo.GetRegistrationsWithPlayersAsync(eventId);
        var registration = registrations.FirstOrDefault(r => r.PlayerId == playerId)
            ?? throw new KeyNotFoundException("Player is not registered for this event.");

        if (!registration.IsWaitlisted)
            throw new InvalidOperationException("Player is not on the waitlist.");

        registration.IsWaitlisted = false;
        registration.WaitlistPosition = null;
        await _eventRepo.UpdateRegistrationAsync(registration);

        // Renumber remaining waitlist gaplessly
        var remaining = registrations
            .Where(r => r.PlayerId != playerId && r.IsWaitlisted)
            .OrderBy(r => r.WaitlistPosition ?? int.MaxValue)
            .ToList();
        for (int i = 0; i < remaining.Count; i++)
        {
            remaining[i].WaitlistPosition = i + 1;
            await _eventRepo.UpdateRegistrationAsync(remaining[i]);
        }

        var player = registration.Player;
        return new EventPlayerDto(
            registration.PlayerId, player.Name, player.ConservativeScore,
            player.IsRanked, registration.DecklistUrl, registration.Commanders,
            registration.IsDropped, registration.IsDisqualified, registration.IsCheckedIn,
            registration.DroppedAfterRound, registration.IsWaitlisted, registration.WaitlistPosition);
    }

    public async Task<RoundDto> GenerateNextRoundAsync(int eventId)
    {
        var evt = await _eventRepo.GetByIdAsync(eventId)
            ?? throw new InvalidOperationException("Event not found.");

        var players = await _eventRepo.GetRegisteredPlayersAsync(eventId);
        if (players.Count < 4)
            throw new InvalidOperationException("Need at least 4 players to generate a round.");

        var previousRound = await _eventRepo.GetLatestRoundAsync(eventId);
        int roundNumber = (previousRound?.RoundNumber ?? 0) + 1;

        if (evt.PlannedRounds.HasValue && roundNumber > evt.PlannedRounds.Value)
            throw new InvalidOperationException($"All {evt.PlannedRounds.Value} planned rounds have been completed.");

        if (previousRound != null)
        {
            var incompleteGames = previousRound.Pods
                .Where(p => p.Game == null || p.Game.Status != GameStatus.Completed)
                .Any();
            if (incompleteGames)
                throw new InvalidOperationException("All games in the current round must be completed before generating the next round.");
        }

        // Round 1: only checked-in players; Round 2+: all non-dropped/DQ'd players
        var registrations = await _eventRepo.GetRegistrationsWithPlayersAsync(eventId);
        var activePlayers = (roundNumber == 1
            ? registrations.Where(r => !r.IsDropped && !r.IsDisqualified && r.IsCheckedIn)
            : registrations.Where(r => !r.IsDropped && !r.IsDisqualified))
            .Select(r => r.Player)
            .ToList();

        if (activePlayers.Count < 4)
            throw new InvalidOperationException(roundNumber == 1
                ? "Need at least 4 checked-in players to start the event."
                : "Need at least 4 active players to generate a round.");

        List<List<Player>> podAssignments;
        if (roundNumber == 1)
        {
            podAssignments = _podService.GenerateRound1Pods(activePlayers);
            evt.Status = EventStatus.InProgress;
            await _eventRepo.UpdateAsync(evt);
        }
        else
        {
            podAssignments = _podService.GenerateNextRoundPods(previousRound!, activePlayers);
        }

        var round = new Round
        {
            EventId = eventId,
            RoundNumber = roundNumber
        };

        for (int i = 0; i < podAssignments.Count; i++)
        {
            var pod = new Pod
            {
                PodNumber = i + 1,
                FinishGroup = roundNumber > 1 ? DetermineFinishGroup(podAssignments[i], previousRound!) : null,
                Game = new Game { Status = GameStatus.Pending },
                PodPlayers = podAssignments[i]
                    .Select((p, seat) => new PodPlayer { PlayerId = p.Id, SeatOrder = seat + 1 })
                    .OrderBy(_ => Random.Shared.Next())
                    .Select((pp, idx) => { pp.SeatOrder = idx + 1; return pp; })
                    .ToList()
            };
            round.Pods.Add(pod);
        }

        await _eventRepo.CreateRoundAsync(round);

        return new RoundDto(
            round.Id,
            round.RoundNumber,
            round.Pods.Select((pod, i) => new PodDto(
                pod.Id,
                pod.PodNumber,
                pod.FinishGroup,
                pod.Game!.Id,
                pod.PodPlayers.OrderBy(pp => pp.SeatOrder).Select(pp =>
                {
                    var player = podAssignments[i].First(p => p.Id == pp.PlayerId);
                    return new PodPlayerDto(player.Id, player.Name, player.ConservativeScore, pp.SeatOrder);
                }).ToList(),
                "Pending",
                null
            )).ToList()
        );
    }

    public async Task<List<RoundDto>> GetRoundsAsync(int eventId)
    {
        var rounds = await _eventRepo.GetRoundsForEventAsync(eventId);
        return rounds.Select(round => new RoundDto(
            round.Id,
            round.RoundNumber,
            round.Pods.OrderBy(p => p.PodNumber).Select(pod => new PodDto(
                pod.Id,
                pod.PodNumber,
                pod.FinishGroup,
                pod.Game?.Id ?? 0,
                GetPodPlayers(pod),
                pod.Game?.Status.ToString() ?? "Pending",
                pod.Game?.Results?.FirstOrDefault(r => r.FinishPosition == 1)?.PlayerId
            )).ToList()
        )).ToList();
    }

    private static List<PodPlayerDto> GetPodPlayers(Pod pod)
    {
        if (pod.PodPlayers.Count > 0)
            return pod.PodPlayers.OrderBy(pp => pp.SeatOrder).Select(pp => new PodPlayerDto(pp.Player.Id, pp.Player.Name, pp.Player.ConservativeScore, pp.SeatOrder)).ToList();

        // Fallback: use GameResults for rounds created before PodPlayer table
        if (pod.Game?.Results?.Count > 0)
            return pod.Game.Results.Select((r, i) => new PodPlayerDto(r.Player.Id, r.Player.Name, r.Player.ConservativeScore, i + 1)).ToList();

        return new List<PodPlayerDto>();
    }

    public async Task SubmitGameResultAsync(int gameId, List<GameResultSubmitDto> results)
    {
        var game = await _gameRepo.GetWithResultsAsync(gameId)
            ?? throw new InvalidOperationException("Game not found.");

        if (game.Status == GameStatus.Completed)
            throw new InvalidOperationException("Game results have already been submitted.");

        if (results.Count < 3 || results.Count > 5)
            throw new InvalidOperationException("A game must have between 3 and 5 players.");

        var positions = results.Select(r => r.FinishPosition).OrderBy(p => p).ToList();
        var allSame = positions.Distinct().Count() == 1;
        if (!allSame && positions.Distinct().Count() != positions.Count)
            throw new InvalidOperationException("Each player must have a unique finish position (or all the same for a draw).");

        var gameResults = results.Select(r => new GameResult
        {
            GameId = gameId,
            PlayerId = r.PlayerId,
            FinishPosition = r.FinishPosition,
            Eliminations = r.Eliminations,
            TurnsSurvived = r.TurnsSurvived,
            CommanderPlayed = r.CommanderPlayed,
            DeckColors = r.DeckColors,
            Conceded = r.Conceded
        }).ToList();

        await _gameRepo.AddResultsAsync(gameResults);

        game.Status = GameStatus.Completed;
        await _gameRepo.UpdateAsync(game);

        game = await _gameRepo.GetWithResultsAsync(gameId);
        var eventPointSystem = game!.Pod.Round.Event.PointSystem;
        if (eventPointSystem == PointSystem.ScoreBased)
            await _trueSkillService.UpdateRatingsAsync(game);

        // Fire Discord notification if all games in this round are now complete
        var eventId = game.Pod.Round.EventId;
        var roundNumber = game.Pod.Round.RoundNumber;
        var rounds = await _eventRepo.GetRoundsForEventAsync(eventId);
        var currentRound = rounds.FirstOrDefault(r => r.RoundNumber == roundNumber);
        if (currentRound != null && currentRound.Pods.All(p => p.Game?.Status == GameStatus.Completed))
            await _discordService.PostRoundResultsAsync(eventId, roundNumber);
    }

    public async Task RevertGameResultAsync(int gameId)
    {
        var game = await _gameRepo.GetWithResultsAsync(gameId)
            ?? throw new InvalidOperationException("Game not found.");

        if (game.Status != GameStatus.Completed)
            throw new InvalidOperationException("Game has not been submitted yet.");

        var eventId = game.Pod.Round.EventId;
        var pointSystem = game.Pod.Round.Event.PointSystem;

        await _gameRepo.DeleteResultsAsync(gameId);
        game.Status = GameStatus.Pending;
        await _gameRepo.UpdateAsync(game);

        if (pointSystem == PointSystem.ScoreBased)
            await RecalculateEventRatingsAsync(eventId);
    }

    private async Task RecalculateEventRatingsAsync(int eventId)
    {
        var evt = await _eventRepo.GetWithDetailsAsync(eventId)
            ?? throw new InvalidOperationException("Event not found.");

        var playerIds = evt.Registrations.Select(r => r.PlayerId).ToList();
        var players = await _playerRepo.GetByIdsAsync(playerIds);

        const double defaultMu = 25.0;
        const double defaultSigma = 25.0 / 3.0;
        const int defaultPlacementLeft = 5;

        var ratingsMap = players.ToDictionary(
            p => p.Id,
            _ => (Mu: defaultMu, Sigma: defaultSigma, PlacementLeft: defaultPlacementLeft));

        var completedGames = evt.Rounds
            .OrderBy(r => r.RoundNumber)
            .SelectMany(r => r.Pods.OrderBy(p => p.PodNumber).Select(p => p.Game))
            .Where(g => g?.Status == GameStatus.Completed)
            .Cast<Game>()
            .ToList();

        foreach (var completedGame in completedGames)
        {
            var results = completedGame.Results.OrderBy(r => r.FinishPosition).ToList();
            if (results.Count < 2) continue;

            var playerRatings = results
                .Select(r => ratingsMap.TryGetValue(r.PlayerId, out var rating)
                    ? (rating.Mu, rating.Sigma)
                    : (defaultMu, defaultSigma))
                .ToList();

            var finishPositions = results.Select(r => r.FinishPosition).ToArray();
            var newRatings = TrueSkillCalculator.CalculateNewRatings(playerRatings, finishPositions);

            for (int i = 0; i < results.Count; i++)
            {
                var pid = results[i].PlayerId;
                if (ratingsMap.TryGetValue(pid, out var current))
                {
                    ratingsMap[pid] = (
                        newRatings[i].NewMu,
                        newRatings[i].NewSigma,
                        Math.Max(0, current.PlacementLeft - 1));
                }
            }
        }

        foreach (var player in players)
        {
            if (ratingsMap.TryGetValue(player.Id, out var rating))
            {
                player.Mu = rating.Mu;
                player.Sigma = rating.Sigma;
                player.PlacementGamesLeft = rating.PlacementLeft;
            }
        }

        await _playerRepo.UpdateRangeAsync(players);
    }

    public async Task<List<StandingsEntryDto>> GetStandingsAsync(int eventId)
    {
        var evt = await _eventRepo.GetWithDetailsAsync(eventId)
            ?? throw new InvalidOperationException("Event not found.");

        // ── PointWager: stateful score tracking (1000 pts start, 10% wager) ──
        if (evt.PointSystem == PointSystem.PointWager)
        {
            const int startingScore = 1000;
            const double wagerRate = 0.10;

            var wagerScores = evt.Registrations
                .ToDictionary(r => r.PlayerId, _ => (double)startingScore);
            var wagerOpponentScores = new Dictionary<int, List<double>>();
            var wagerGameResults    = new Dictionary<int, List<string>>();
            var wagerPlayerNames    = new Dictionary<int, string>();

            foreach (var round in evt.Rounds.OrderBy(r => r.RoundNumber))
            {
                foreach (var pod in round.Pods)
                {
                    if (pod.Game?.Status != GameStatus.Completed) continue;
                    var results    = pod.Game.Results.ToList();
                    var podPlayers = results.Select(r => r.Player).ToList();
                    bool isDraw    = results.Select(r => r.FinishPosition).Distinct().Count() == 1;

                    foreach (var result in results)
                    {
                        wagerPlayerNames[result.PlayerId] = result.Player.Name;
                        wagerOpponentScores.TryAdd(result.PlayerId, new List<double>());
                        wagerOpponentScores[result.PlayerId].AddRange(
                            podPlayers.Where(p => p.Id != result.PlayerId).Select(p => p.ConservativeScore));
                        wagerGameResults.TryAdd(result.PlayerId, new List<string>());
                        wagerGameResults[result.PlayerId].Add(isDraw ? "D" : result.FinishPosition == 1 ? "W" : "L");
                    }

                    if (!isDraw)
                    {
                        var winner = results.First(r => r.FinishPosition == 1);
                        var wagers = results.ToDictionary(
                            r => r.PlayerId,
                            r => wagerScores.GetValueOrDefault(r.PlayerId, startingScore) * wagerRate);

                        wagerScores[winner.PlayerId] +=
                            wagers.Where(kv => kv.Key != winner.PlayerId).Sum(kv => kv.Value);
                        foreach (var loser in results.Where(r => r.PlayerId != winner.PlayerId))
                            wagerScores[loser.PlayerId] -= wagers[loser.PlayerId];
                    }
                }
            }

            var wagerStandings = wagerScores
                .Where(kvp => wagerPlayerNames.ContainsKey(kvp.Key))
                .Select(kvp =>
                {
                    var avgOpp  = wagerOpponentScores.GetValueOrDefault(kvp.Key)?.DefaultIfEmpty(0).Average() ?? 0;
                    var gameRes = wagerGameResults.GetValueOrDefault(kvp.Key) ?? new List<string>();
                    return new StandingsEntryDto(0, kvp.Key, wagerPlayerNames[kvp.Key],
                        (int)Math.Round(kvp.Value), Math.Round(avgOpp, 2), new List<int>(), gameRes);
                })
                .OrderByDescending(s => s.TotalPoints)
                .ThenByDescending(s => s.Tiebreaker)
                .ToList();

            return wagerStandings.Select((s, i) => s with { Rank = i + 1 }).ToList();
        }

        // ── Standard point systems (ScoreBased, WinBased) ────────────────────
        var playerPoints = new Dictionary<int, (string Name, int Points, List<int> Positions)>();
        var playerOpponentScores = new Dictionary<int, List<double>>();
        var playerGameResults = new Dictionary<int, List<string>>();

        foreach (var round in evt.Rounds.OrderBy(r => r.RoundNumber))
        {
            foreach (var pod in round.Pods)
            {
                if (pod.Game?.Status != GameStatus.Completed) continue;

                var podPlayers = pod.Game.Results.Select(r => r.Player).ToList();
                bool isDraw = pod.Game.Results.Select(r => r.FinishPosition).Distinct().Count() == 1;

                int podSize = pod.PodPlayers.Count > 0 ? pod.PodPlayers.Count : pod.Game.Results.Count;

                foreach (var result in pod.Game.Results)
                {
                    int seatOrder = pod.PodPlayers.FirstOrDefault(pp => pp.PlayerId == result.PlayerId)?.SeatOrder ?? 1;
                    int points = CalculatePoints(evt.PointSystem, result.FinishPosition, isDraw, seatOrder, podSize);

                    if (!playerPoints.ContainsKey(result.PlayerId))
                        playerPoints[result.PlayerId] = (result.Player.Name, 0, new List<int>());

                    var entry = playerPoints[result.PlayerId];
                    playerPoints[result.PlayerId] = (entry.Name, entry.Points + points, entry.Positions);
                    entry.Positions.Add(result.FinishPosition);

                    if (!playerOpponentScores.ContainsKey(result.PlayerId))
                        playerOpponentScores[result.PlayerId] = new List<double>();

                    var opponentScores = podPlayers
                        .Where(p => p.Id != result.PlayerId)
                        .Select(p => p.ConservativeScore);
                    playerOpponentScores[result.PlayerId].AddRange(opponentScores);

                    if (!playerGameResults.ContainsKey(result.PlayerId))
                        playerGameResults[result.PlayerId] = new List<string>();

                    playerGameResults[result.PlayerId].Add(
                        isDraw ? "D" : result.FinishPosition == 1 ? "W" : "L");
                }
            }
        }

        var standings = playerPoints
            .Select(kvp =>
            {
                var avgOpponentScore = playerOpponentScores.GetValueOrDefault(kvp.Key)?.DefaultIfEmpty(0).Average() ?? 0;
                var gameResults = playerGameResults.GetValueOrDefault(kvp.Key) ?? new List<string>();
                return new StandingsEntryDto(0, kvp.Key, kvp.Value.Name, kvp.Value.Points, Math.Round(avgOpponentScore, 2), kvp.Value.Positions, gameResults);
            })
            .OrderByDescending(s => s.TotalPoints)
            .ThenByDescending(s => s.Tiebreaker)
            .ToList();

        return standings.Select((s, i) => s with { Rank = i + 1 }).ToList();
    }

    public async Task<EventDto?> UpdateStatusAsync(int eventId, string status, int? plannedRounds = null)
    {
        var evt = await _eventRepo.GetByIdAsync(eventId)
            ?? throw new InvalidOperationException("Event not found.");

        if (!Enum.TryParse<EventStatus>(status, true, out var newStatus))
            throw new InvalidOperationException($"Invalid status: {status}. Valid values: Registration, InProgress, Paused, Completed.");

        if (plannedRounds.HasValue)
            evt.PlannedRounds = plannedRounds.Value;

        evt.Status = newStatus;
        await _eventRepo.UpdateAsync(evt);

        if (newStatus == EventStatus.Completed && evt.PointSystem != PointSystem.ScoreBased)
        {
            var standings = await GetStandingsAsync(eventId);
            var evtWithDetails = await _eventRepo.GetWithDetailsAsync(eventId)!;
            var gameCountPerPlayer = ComputePlayerGameCounts(evtWithDetails!);
            var rankings = standings
                .Select(s => (s.PlayerId, s.Rank, gameCountPerPlayer.GetValueOrDefault(s.PlayerId, 1)))
                .ToList();
            await _trueSkillService.UpdateRatingsFromEventStandingsAsync(rankings);
        }

        if (newStatus == EventStatus.Completed)
        {
            await _discordService.PostEventCompletedAsync(eventId);

            // Award event-completion badges for all registered players
            var registeredPlayers = await _eventRepo.GetRegisteredPlayersAsync(eventId);
            foreach (var player in registeredPlayers)
                await _badgeService.CheckAndAwardAsync(player.Id, BadgeTrigger.EventCompleted, eventId);
            var registrations = await _eventRepo.GetRegistrationsWithPlayersAsync(eventId);
            var activePlayers = registrations
                .Where(r => !r.IsDropped && !r.IsDisqualified)
                .ToList();

            // Get standings to find the tournament winner
            var completedStandings = await GetStandingsAsync(eventId);
            var winnerId = completedStandings.OrderBy(s => s.Rank).FirstOrDefault()?.PlayerId;

            foreach (var reg in activePlayers)
            {
                // Check undefeated_swiss and veteran for every participant
                await _badgeService.CheckAndAwardAsync(reg.PlayerId, BadgeTrigger.EventCompleted, eventId);
            }

            // Award tournament_winner only to rank 1 player
            if (winnerId.HasValue)
                await _badgeService.CheckAndAwardAsync(winnerId.Value, BadgeTrigger.TournamentWinner, eventId);
        }

        var players = await _eventRepo.GetRegisteredPlayersAsync(eventId);
        var (storeId, storeName) = await _storeEventRepo.GetStoreInfoForEventAsync(eventId);
        return ToEventDto(evt, players.Count, storeId, storeName);
    }

    public async Task<List<EventPlayerDto>> GetEventPlayersAsync(int eventId)
    {
        var registrations = await _eventRepo.GetRegistrationsWithPlayersAsync(eventId);
        return registrations.Select(r => new EventPlayerDto(
            r.PlayerId,
            r.Player.Name,
            r.Player.ConservativeScore,
            r.Player.IsRanked,
            r.DecklistUrl,
            r.Commanders,
            r.IsDropped,
            r.IsDisqualified,
            r.IsCheckedIn,
            r.DroppedAfterRound,
            r.IsWaitlisted,
            r.WaitlistPosition
        )).ToList();
    }

    public async Task DropPlayerAsync(int eventId, int playerId)
    {
        var registration = await _eventRepo.GetRegistrationAsync(eventId, playerId)
            ?? throw new InvalidOperationException("Player is not registered for this event.");

        await _eventRepo.RemoveRegistrationAsync(registration);
    }

    public async Task DisqualifyPlayerAsync(int eventId, int playerId)
    {
        var registration = await _eventRepo.GetRegistrationAsync(eventId, playerId)
            ?? throw new InvalidOperationException("Player is not registered for this event.");

        registration.IsDisqualified = true;
        await _eventRepo.UpdateRegistrationAsync(registration);
    }

    public async Task<EventPlayerDto> SetCheckInAsync(int eventId, int playerId, bool checkedIn)
    {
        var evt = await _eventRepo.GetByIdAsync(eventId)
            ?? throw new KeyNotFoundException("Event not found.");
        if (evt.Status != EventStatus.Registration)
            throw new InvalidOperationException("Check-in is only allowed during Registration.");

        var registration = await _eventRepo.GetRegistrationAsync(eventId, playerId)
            ?? throw new KeyNotFoundException("Player is not registered for this event.");

        registration.IsCheckedIn = checkedIn;
        await _eventRepo.UpdateRegistrationAsync(registration);

        var player = await _playerRepo.GetByIdAsync(playerId)
            ?? throw new KeyNotFoundException("Player not found.");
        return new EventPlayerDto(
            registration.PlayerId, player.Name, player.ConservativeScore,
            player.IsRanked, registration.DecklistUrl, registration.Commanders,
            registration.IsDropped, registration.IsDisqualified, registration.IsCheckedIn,
            registration.DroppedAfterRound, registration.IsWaitlisted, registration.WaitlistPosition);
    }

    public async Task<EventPlayerDto> SetDroppedAsync(int eventId, int playerId, bool dropped)
    {
        var evt = await _eventRepo.GetByIdAsync(eventId)
            ?? throw new KeyNotFoundException("Event not found.");

        if (evt.Status != EventStatus.InProgress)
            throw new InvalidOperationException("Players can only be dropped while the event is InProgress.");

        var registrations = await _eventRepo.GetRegistrationsWithPlayersAsync(eventId);
        var registration = registrations.FirstOrDefault(r => r.PlayerId == playerId)
            ?? throw new KeyNotFoundException("Player is not registered for this event.");

        registration.IsDropped = dropped;
        if (dropped)
        {
            var latestRound = await _eventRepo.GetLatestRoundAsync(eventId);
            registration.DroppedAfterRound = latestRound?.RoundNumber ?? 0;
        }
        else
        {
            registration.DroppedAfterRound = null;
        }

        await _eventRepo.UpdateRegistrationAsync(registration);

        if (dropped)
            await PromoteFromWaitlistAsync(eventId);

        var player = registration.Player;
        return new EventPlayerDto(
            registration.PlayerId, player.Name, player.ConservativeScore,
            player.IsRanked, registration.DecklistUrl, registration.Commanders,
            registration.IsDropped, registration.IsDisqualified, registration.IsCheckedIn,
            registration.DroppedAfterRound, registration.IsWaitlisted, registration.WaitlistPosition);
    }

    public async Task<CheckInResponseDto> CheckInByTokenAsync(string token, string playerEmail)
    {
        var evt = await _eventRepo.GetByCheckInTokenAsync(token)
            ?? throw new KeyNotFoundException("Check-in token not found.");

        if (evt.Status != EventStatus.Registration)
            throw new InvalidOperationException("Registration is closed for this event.");

        var registrations = await _eventRepo.GetRegistrationsWithPlayersAsync(evt.Id);
        var registration = registrations.FirstOrDefault(r =>
            string.Equals(r.Player.Email, playerEmail, StringComparison.OrdinalIgnoreCase))
            ?? throw new KeyNotFoundException("You are not registered for this event.");

        registration.IsCheckedIn = true;
        await _eventRepo.UpdateRegistrationAsync(registration);

        return new CheckInResponseDto(evt.Id, evt.Name);
    }

    public async Task<PairingsDto?> GetPairingsAsync(int eventId)
    {
        var evt = await _eventRepo.GetByIdAsync(eventId);
        if (evt == null) return null;

        if (evt.Status != EventStatus.InProgress)
            return new PairingsDto(evt.Id, evt.Name, null, []);

        var round = await _eventRepo.GetLatestRoundWithPairingsAsync(eventId);
        if (round == null)
            return new PairingsDto(evt.Id, evt.Name, null, []);

        var registrations = await _eventRepo.GetRegistrationsWithPlayersAsync(eventId);
        var commanderMap  = registrations.ToDictionary(r => r.PlayerId, r => r.Commanders);

        var pods = round.Pods
            .OrderBy(p => p.PodNumber)
            .Select(pod =>
            {
                var gameStatus = pod.Game?.Status.ToString() ?? "Pending";
                int? winnerId  = null;
                if (pod.Game?.Status == GameStatus.Completed && pod.Game.Results.Any())
                {
                    bool isDraw = pod.Game.Results.Select(r => r.FinishPosition).Distinct().Count() == 1;
                    if (!isDraw)
                        winnerId = pod.Game.Results.FirstOrDefault(r => r.FinishPosition == 1)?.PlayerId;
                    else
                        gameStatus = "Draw";
                }
                return new PodPairingsDto(
                    pod.Id,
                    pod.PodNumber,
                    pod.PodPlayers
                        .OrderBy(pp => pp.SeatOrder)
                        .Select(pp => new PodPlayerPairingsDto(
                            pp.PlayerId,
                            pp.Player.Name,
                            commanderMap.TryGetValue(pp.PlayerId, out var cmd) ? cmd : null,
                            pp.SeatOrder))
                        .ToList(),
                    gameStatus,
                    winnerId);
            })
            .ToList();

        return new PairingsDto(evt.Id, evt.Name, round.RoundNumber, pods);
    }

    private static EventDto ToEventDto(Event evt, int playerCount, int? storeId = null, string? storeName = null) =>
        new(evt.Id, evt.Name, evt.Date, evt.Status.ToString(), playerCount, evt.DefaultRoundTimeMinutes, evt.MaxPlayers, evt.PointSystem.ToString(), storeId, storeName, evt.PlannedRounds, evt.CheckInToken);

    public static int GetRecommendedRounds(int playerCount) => playerCount switch
    {
        <= 4 => 2,
        <= 8 => 3,
        <= 32 => 5,
        <= 64 => 6,
        <= 128 => 7,
        <= 226 => 8,
        <= 409 => 9,
        _ => 10
    };

    public static int CalculatePoints(PointSystem system, int finishPosition, bool isDraw, int seatOrder = 1, int podSize = 4)
    {
        if (system == PointSystem.WinBased)
            return isDraw ? 1 : (finishPosition == 1 ? 5 : 0);

        if (system == PointSystem.FiveOneZero)
        {
            if (isDraw) return 0;
            if (finishPosition != 1) return 1;
            bool seatBonus = (podSize == 5 && seatOrder == 5) || (podSize == 3 && seatOrder == 3);
            return seatBonus ? 10 : 5;
        }

        if (system == PointSystem.SeatBased)
        {
            if (isDraw || finishPosition != 1) return 0;
            bool lastSeatBonus = (podSize == 5 && seatOrder == 5) || (podSize == 3 && seatOrder == 3);
            return lastSeatBonus ? 10 : 6 + seatOrder; // seat1=7, seat2=8, seat3=9, seat4=10
        }

        // Default: ScoreBased (and unimplemented stubs)
        return finishPosition switch { 1 => 4, 2 => 3, 3 => 2, _ => 1 };
    }

    private static Dictionary<int, int> ComputePlayerGameCounts(Event evt)
    {
        var counts = new Dictionary<int, int>();
        foreach (var round in evt.Rounds)
            foreach (var pod in round.Pods)
                if (pod.Game?.Status == GameStatus.Completed)
                    foreach (var result in pod.Game.Results)
                        counts[result.PlayerId] = counts.GetValueOrDefault(result.PlayerId, 0) + 1;
        return counts;
    }

    private static int? DetermineFinishGroup(List<Player> podPlayers, Round previousRound)
    {
        var results = previousRound.Pods
            .Where(p => p.Game?.Status == GameStatus.Completed)
            .SelectMany(p => p.Game!.Results)
            .Where(r => podPlayers.Any(pp => pp.Id == r.PlayerId))
            .ToList();

        if (results.Count == 0) return null;

        return (int?)results
            .GroupBy(r => r.FinishPosition)
            .OrderByDescending(g => g.Count())
            .First().Key;
    }

    public async Task<EventPlayerDto> DeclareCommanderAsync(int eventId, int playerId, DeclareCommanderDto dto)
    {
        var evt = await _eventRepo.GetByIdAsync(eventId)
            ?? throw new KeyNotFoundException("Event not found.");
        var registration = await _eventRepo.GetRegistrationAsync(eventId, playerId)
            ?? throw new KeyNotFoundException("Player not registered for this event.");
        if (evt.Status != EventStatus.Registration && evt.Status != EventStatus.InProgress)
            throw new InvalidOperationException("Commander declaration is only allowed during Registration or InProgress.");

        registration.Commanders = dto.Commanders;
        if (dto.DecklistUrl is not null)
            registration.DecklistUrl = dto.DecklistUrl;
        await _eventRepo.UpdateRegistrationAsync(registration);

        var player = registration.Player;
        return new EventPlayerDto(
            registration.PlayerId, player.Name, player.ConservativeScore,
            player.IsRanked, registration.DecklistUrl, registration.Commanders,
            registration.IsDropped, registration.IsDisqualified, registration.IsCheckedIn,
            registration.DroppedAfterRound, registration.IsWaitlisted, registration.WaitlistPosition);
    }

    public async Task<BulkRegisterResultDto> BulkRegisterConfirmAsync(int eventId, BulkRegisterConfirmDto dto)
    {
        int registered = 0;
        int created = 0;
        var errors = new List<BulkRegisterErrorDto>();

        foreach (var item in dto.Registrations)
        {
            try
            {
                int playerId;

                if (item.PlayerId == null)
                {
                    // New player — name is required
                    if (string.IsNullOrWhiteSpace(item.Name))
                    {
                        errors.Add(new BulkRegisterErrorDto(item.Email, "Name is required to create a new player."));
                        continue;
                    }

                    var newPlayer = await _playerRepo.CreateAsync(new Player
                    {
                        Name = item.Name,
                        Email = item.Email,
                        PlacementGamesLeft = 5,
                        Mu = 25.0,
                        Sigma = 8.333,
                        IsActive = true,
                    });
                    playerId = newPlayer.Id;
                    created++;
                }
                else
                {
                    playerId = item.PlayerId.Value;
                }

                await RegisterPlayerAsync(eventId, playerId);
                registered++;
            }
            catch (Exception ex)
            {
                errors.Add(new BulkRegisterErrorDto(item.Email, ex.Message));
            }
        }

        return new BulkRegisterResultDto(registered, created, errors);
    }
}
