using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Repositories.Interfaces;
using TournamentOrganizer.Api.Services.Interfaces;

namespace TournamentOrganizer.Api.Services;

public class SuggestedTradeService : ISuggestedTradeService
{
    private readonly IWishlistRepository _wishlistRepo;
    private readonly ITradeRepository _tradeRepo;
    private readonly IStoreRepository _storeRepo;
    private readonly IStoreSettingsRepository _storeSettingsRepo;
    private readonly ICardPriceService _cardPriceService;
    private readonly IPlayerRepository _playerRepo;
    private readonly INotificationService _notificationService;

    public SuggestedTradeService(
        IWishlistRepository wishlistRepo,
        ITradeRepository tradeRepo,
        IStoreRepository storeRepo,
        IStoreSettingsRepository storeSettingsRepo,
        ICardPriceService cardPriceService,
        IPlayerRepository playerRepo,
        INotificationService notificationService)
    {
        _wishlistRepo = wishlistRepo;
        _tradeRepo = tradeRepo;
        _storeRepo = storeRepo;
        _storeSettingsRepo = storeSettingsRepo;
        _cardPriceService = cardPriceService;
        _playerRepo = playerRepo;
        _notificationService = notificationService;
    }

    public async Task<List<SuggestedTradeDto>> GetSuggestionsAsync(int playerId)
    {
        // Load data
        var allWishlist = await _wishlistRepo.GetAllAsync();
        var allTrade = await _tradeRepo.GetAllAsync();
        var players = await _playerRepo.GetAllAsync();

        // Load differential from first active store; default 10%
        var stores = await _storeRepo.GetAllAsync();
        var activeStore = stores.FirstOrDefault(s => s.IsActive);
        decimal differential = 10m;
        if (activeStore != null)
        {
            var settings = await _storeSettingsRepo.GetByStoreAsync(activeStore.Id);
            if (settings != null)
                differential = settings.AllowableTradeDifferential;
        }

        var playerNames = players.ToDictionary(p => p.Id, p => p.Name);

        // Build price cache (single lookup per unique card name)
        var allCardNames = allWishlist.Select(w => w.CardName)
            .Concat(allTrade.Select(t => t.CardName))
            .Select(n => n.ToLowerInvariant())
            .Distinct()
            .ToList();

        var prices = new Dictionary<string, decimal?>();
        foreach (var name in allCardNames)
            prices[name] = await _cardPriceService.GetPriceAsync(name);

        // Build indexes
        var wishlistByPlayer = allWishlist
            .GroupBy(w => w.PlayerId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var tradeByPlayer = allTrade
            .GroupBy(t => t.PlayerId)
            .ToDictionary(g => g.Key, g => g.ToList());

        // card name (normalized) → list of playerIds who have it for trade
        var tradeIndex = allTrade
            .GroupBy(t => t.CardName.ToLowerInvariant())
            .ToDictionary(g => g.Key, g => g.Select(t => t.PlayerId).ToList());

        var results = new List<SuggestedTradeDto>();
        var seen = new HashSet<string>();

        // ── 2-player trades ───────────────────────────────────────────────────
        // For each wishlist entry: A wants card C
        foreach (var wEntry in allWishlist)
        {
            var pA = wEntry.PlayerId;
            var cardNorm = wEntry.CardName.ToLowerInvariant();

            // Find players who have that card for trade
            if (!tradeIndex.TryGetValue(cardNorm, out var providers)) continue;

            foreach (var pB in providers)
            {
                if (pB == pA) continue;

                // B gives card C to A; A needs to give something B wants
                if (!wishlistByPlayer.TryGetValue(pB, out var bWishlist)) continue;
                if (!tradeByPlayer.TryGetValue(pA, out var aTradeEntries)) continue;

                var bWantsNorm = bWishlist.Select(w => w.CardName.ToLowerInvariant()).ToHashSet();

                foreach (var aGives in aTradeEntries)
                {
                    var aGivesNorm = aGives.CardName.ToLowerInvariant();
                    if (!bWantsNorm.Contains(aGivesNorm)) continue;

                    var priceAGives = prices.GetValueOrDefault(aGivesNorm);   // A gives to B
                    var priceBGives = prices.GetValueOrDefault(cardNorm);      // B gives to A

                    if (!IsWithinDifferential(priceAGives, priceBGives, differential)) continue;

                    // Dedup: sort player IDs, sort card names
                    var cardKey = string.Join(",", new[] { cardNorm, aGivesNorm }.OrderBy(x => x));
                    var dedupKey = $"2p:{Math.Min(pA, pB)}-{Math.Max(pA, pB)}:{cardKey}";
                    if (!seen.Add(dedupKey)) continue;

                    var pAName = playerNames.GetValueOrDefault(pA, "?");
                    var pBName = playerNames.GetValueOrDefault(pB, "?");

                    results.Add(new SuggestedTradeDto(
                        "TwoPlayer",
                        [pA, pB],
                        [pAName, pBName],
                        [
                            new TradeLegDto(pA, pAName, pB, pBName, aGives.CardName, aGives.Quantity, priceAGives),
                            new TradeLegDto(pB, pBName, pA, pAName, wEntry.CardName, wEntry.Quantity, priceBGives)
                        ]
                    ));
                }
            }
        }

        // ── Cycle trades ─────────────────────────────────────────────────────
        // Build directed edges: (From, To, CardName, Qty, Price)
        // Edge A→B means A has a card B wants
        var edges = new List<(int From, int To, string CardName, int Qty, decimal? Price)>();
        foreach (var wEntry in allWishlist)
        {
            var norm = wEntry.CardName.ToLowerInvariant();
            if (!tradeIndex.TryGetValue(norm, out var providers)) continue;
            var price = prices.GetValueOrDefault(norm);

            foreach (var provider in providers)
            {
                if (provider == wEntry.PlayerId) continue;
                var tradeEntry = allTrade.FirstOrDefault(t =>
                    t.PlayerId == provider && t.CardName.ToLowerInvariant() == norm);
                edges.Add((provider, wEntry.PlayerId,
                    tradeEntry?.CardName ?? wEntry.CardName,
                    tradeEntry?.Quantity ?? 1,
                    price));
            }
        }

        var edgesFrom = edges.GroupBy(e => e.From).ToDictionary(g => g.Key, g => g.ToList());

        // 3-player cycles: A→B, B→C, C→A
        foreach (var e1 in edges)
        {
            var pA = e1.From; var pB = e1.To;
            if (!edgesFrom.TryGetValue(pB, out var bEdges)) continue;
            foreach (var e2 in bEdges)
            {
                var pC = e2.To;
                if (pC == pA || pC == pB) continue;
                if (!edgesFrom.TryGetValue(pC, out var cEdges)) continue;
                foreach (var e3 in cEdges.Where(e => e.To == pA))
                {
                    // A gives e1 (price e1.Price), receives e3 (price e3.Price)
                    // B gives e2 (price e2.Price), receives e1 (price e1.Price)
                    // C gives e3 (price e3.Price), receives e2 (price e2.Price)
                    if (!IsWithinDifferential(e1.Price, e3.Price, differential)) continue;
                    if (!IsWithinDifferential(e2.Price, e1.Price, differential)) continue;
                    if (!IsWithinDifferential(e3.Price, e2.Price, differential)) continue;

                    var participants = new[] { pA, pB, pC }.OrderBy(x => x).ToList();
                    var cardKey = string.Join(":", new[] { e1.CardName.ToLowerInvariant(), e2.CardName.ToLowerInvariant(), e3.CardName.ToLowerInvariant() }.OrderBy(x => x));
                    var dedupKey = $"3c:{string.Join("-", participants)}:{cardKey}";
                    if (!seen.Add(dedupKey)) continue;

                    var pAName = playerNames.GetValueOrDefault(pA, "?");
                    var pBName = playerNames.GetValueOrDefault(pB, "?");
                    var pCName = playerNames.GetValueOrDefault(pC, "?");

                    results.Add(new SuggestedTradeDto(
                        "Cycle",
                        [pA, pB, pC],
                        [pAName, pBName, pCName],
                        [
                            new TradeLegDto(pA, pAName, pB, pBName, e1.CardName, e1.Qty, e1.Price),
                            new TradeLegDto(pB, pBName, pC, pCName, e2.CardName, e2.Qty, e2.Price),
                            new TradeLegDto(pC, pCName, pA, pAName, e3.CardName, e3.Qty, e3.Price)
                        ]
                    ));
                }
            }
        }

        // 4-player cycles: A→B, B→C, C→D, D→A
        foreach (var e1 in edges)
        {
            var pA = e1.From; var pB = e1.To;
            if (!edgesFrom.TryGetValue(pB, out var bEdges)) continue;
            foreach (var e2 in bEdges)
            {
                var pC = e2.To;
                if (pC == pA || pC == pB) continue;
                if (!edgesFrom.TryGetValue(pC, out var cEdges)) continue;
                foreach (var e3 in cEdges)
                {
                    var pD = e3.To;
                    if (pD == pA || pD == pB || pD == pC) continue;
                    if (!edgesFrom.TryGetValue(pD, out var dEdges)) continue;
                    foreach (var e4 in dEdges.Where(e => e.To == pA))
                    {
                        // A gives e1 (price e1.Price), receives e4 (price e4.Price)
                        // B gives e2 (price e2.Price), receives e1 (price e1.Price)
                        // C gives e3 (price e3.Price), receives e2 (price e2.Price)
                        // D gives e4 (price e4.Price), receives e3 (price e3.Price)
                        if (!IsWithinDifferential(e1.Price, e4.Price, differential)) continue;
                        if (!IsWithinDifferential(e2.Price, e1.Price, differential)) continue;
                        if (!IsWithinDifferential(e3.Price, e2.Price, differential)) continue;
                        if (!IsWithinDifferential(e4.Price, e3.Price, differential)) continue;

                        var participants = new[] { pA, pB, pC, pD }.OrderBy(x => x).ToList();
                        var cardKey = string.Join(":", new[] { e1.CardName.ToLowerInvariant(), e2.CardName.ToLowerInvariant(), e3.CardName.ToLowerInvariant(), e4.CardName.ToLowerInvariant() }.OrderBy(x => x));
                        var dedupKey = $"4c:{string.Join("-", participants)}:{cardKey}";
                        if (!seen.Add(dedupKey)) continue;

                        var pAName = playerNames.GetValueOrDefault(pA, "?");
                        var pBName = playerNames.GetValueOrDefault(pB, "?");
                        var pCName = playerNames.GetValueOrDefault(pC, "?");
                        var pDName = playerNames.GetValueOrDefault(pD, "?");

                        results.Add(new SuggestedTradeDto(
                            "Cycle",
                            [pA, pB, pC, pD],
                            [pAName, pBName, pCName, pDName],
                            [
                                new TradeLegDto(pA, pAName, pB, pBName, e1.CardName, e1.Qty, e1.Price),
                                new TradeLegDto(pB, pBName, pC, pCName, e2.CardName, e2.Qty, e2.Price),
                                new TradeLegDto(pC, pCName, pD, pDName, e3.CardName, e3.Qty, e3.Price),
                                new TradeLegDto(pD, pDName, pA, pAName, e4.CardName, e4.Qty, e4.Price)
                            ]
                        ));
                    }
                }
            }
        }

        var filtered = results.Where(s => s.ParticipantIds.Contains(playerId)).ToList();

        // Notify all participants in new matches
        foreach (var match in results)
        {
            for (var i = 0; i < match.ParticipantIds.Count; i++)
            {
                var recipient = match.ParticipantIds[i];
                foreach (var other in match.ParticipantIds.Where(id => id != recipient))
                {
                    await _notificationService.CreateTradeMatchNotificationAsync(recipient, other);
                }
            }
        }

        return filtered;
    }

    public async Task<List<TradeCardDemandDto>> GetDemandAsync(int playerId)
    {
        var tradeEntries = await _tradeRepo.GetByPlayerAsync(playerId);
        var allWishlists = await _wishlistRepo.GetAllAsync();
        var allPlayers = await _playerRepo.GetAllAsync();

        var playerNames = allPlayers.ToDictionary(p => p.Id, p => p.Name);
        var totalOtherPlayers = allPlayers.Count(p => p.IsActive && p.Id != playerId);

        return tradeEntries.Select(te =>
        {
            var cardNorm = te.CardName.ToLowerInvariant();
            var interestedGroups = allWishlists
                .Where(w => w.PlayerId != playerId && w.CardName.ToLowerInvariant() == cardNorm)
                .GroupBy(w => w.PlayerId)
                .ToList();
            var wantCount = interestedGroups.Count;
            var interestedNames = interestedGroups
                .Select(g => playerNames.GetValueOrDefault(g.Key, "?"))
                .OrderBy(n => n)
                .ToList();
            var demandPercent = totalOtherPlayers > 0
                ? Math.Round((double)wantCount / totalOtherPlayers * 100, 1)
                : 0.0;
            return new TradeCardDemandDto(te.CardName, wantCount, totalOtherPlayers, demandPercent, interestedNames);
        }).ToList();
    }

    private static bool IsWithinDifferential(decimal? given, decimal? received, decimal differential)
    {
        // If either price is unknown, allow the trade — we can't determine it's unfair
        if (given == null || received == null || given == 0 || received == 0) return true;
        var max = Math.Max(given.Value, received.Value);
        return Math.Abs(given.Value - received.Value) / max <= differential / 100m;
    }
}
