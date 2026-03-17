using TournamentOrganizer.Api.Models;

namespace TournamentOrganizer.Api.Repositories.Interfaces;

public interface IEventTemplateRepository
{
    Task<List<EventTemplate>> GetByStoreAsync(int storeId);
    Task<EventTemplate> CreateAsync(EventTemplate template);
    Task<EventTemplate?> GetByIdAsync(int id);
    Task UpdateAsync(EventTemplate template);
    Task DeleteAsync(EventTemplate template);
}
