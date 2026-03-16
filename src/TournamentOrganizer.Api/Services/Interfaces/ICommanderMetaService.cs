using TournamentOrganizer.Api.DTOs;

namespace TournamentOrganizer.Api.Services.Interfaces;

public interface ICommanderMetaService
{
    Task<CommanderMetaReportDto> GetStoreMetaAsync(int storeId, string period);
}
