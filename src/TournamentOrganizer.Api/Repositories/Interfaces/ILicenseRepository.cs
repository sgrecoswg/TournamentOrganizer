using TournamentOrganizer.Api.Models;

namespace TournamentOrganizer.Api.Repositories.Interfaces;

public interface ILicenseRepository
{
    Task<License?> GetByStoreAsync(int storeId);
    Task<List<License>> GetAllAsync();
    Task<License> CreateAsync(License license);
    Task<License?> UpdateAsync(License license);
}
