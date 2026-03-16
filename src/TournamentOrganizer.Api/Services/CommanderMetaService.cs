using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Repositories.Interfaces;
using TournamentOrganizer.Api.Services.Interfaces;

namespace TournamentOrganizer.Api.Services;

public class CommanderMetaService : ICommanderMetaService
{
    private readonly IGameRepository _gameRepo;

    public CommanderMetaService(IGameRepository gameRepo)
    {
        _gameRepo = gameRepo;
    }

    public async Task<CommanderMetaReportDto> GetStoreMetaAsync(int storeId, string period)
    {
        DateTime? since = period switch
        {
            "30d" => DateTime.UtcNow.AddDays(-30),
            "90d" => DateTime.UtcNow.AddDays(-90),
            _     => null
        };

        var results = await _gameRepo.GetStoreGameResultsAsync(storeId, since);

        var topCommanders = results
            .Where(r => r.CommanderPlayed != null)
            .GroupBy(r => r.CommanderPlayed!)
            .Select(g =>
            {
                var timesPlayed = g.Count();
                var wins       = g.Count(r => r.FinishPosition == 1);
                var winRate    = timesPlayed > 0 ? (double)wins / timesPlayed * 100 : 0.0;
                var avgFinish  = timesPlayed > 0 ? g.Average(r => r.FinishPosition) : 0.0;
                return new CommanderMetaEntryDto(g.Key, timesPlayed, wins, winRate, avgFinish);
            })
            .OrderByDescending(e => e.TimesPlayed)
            .Take(20)
            .ToList();

        return new CommanderMetaReportDto(storeId, period, topCommanders, new Dictionary<string, int>());
    }
}
