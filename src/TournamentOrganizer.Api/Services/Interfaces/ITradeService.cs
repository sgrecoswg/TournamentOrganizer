using Microsoft.AspNetCore.Http;
using TournamentOrganizer.Api.DTOs;

namespace TournamentOrganizer.Api.Services.Interfaces;

public interface ITradeService
{
    Task<List<TradeEntryDto>> GetByPlayerAsync(int playerId);
    Task<TradeEntryDto> AddAsync(int playerId, CreateCardEntryDto dto);
    Task<bool> DeleteAsync(int id);
    Task<BulkUploadResultDto> BulkAddAsync(int playerId, IFormFile file);
    Task DeleteAllByPlayerAsync(int playerId);
}
