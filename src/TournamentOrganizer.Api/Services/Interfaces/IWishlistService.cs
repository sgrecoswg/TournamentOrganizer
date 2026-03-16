using Microsoft.AspNetCore.Http;
using TournamentOrganizer.Api.DTOs;

namespace TournamentOrganizer.Api.Services.Interfaces;

public interface IWishlistService
{
    Task<List<WishlistEntryDto>> GetByPlayerAsync(int playerId);
    Task<WishlistEntryDto> AddAsync(int playerId, CreateCardEntryDto dto);
    Task<bool> DeleteAsync(int id);
    Task<BulkUploadResultDto> BulkAddAsync(int playerId, IFormFile file);
    Task DeleteAllByPlayerAsync(int playerId);
    Task<List<WishlistCardSupplyDto>> GetWishlistSupplyAsync(int playerId);
}
