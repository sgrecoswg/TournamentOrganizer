using TournamentOrganizer.Api.Models;

namespace TournamentOrganizer.Api.Repositories.Interfaces;

public interface IWishlistRepository
{
    Task<List<WishlistEntry>> GetAllAsync();
    Task<List<WishlistEntry>> GetByPlayerAsync(int playerId);
    Task<WishlistEntry?> GetByIdAsync(int id);
    Task<WishlistEntry> AddAsync(WishlistEntry entry);
    Task<bool> DeleteAsync(int id);
    Task DeleteAllByPlayerAsync(int playerId);
}
