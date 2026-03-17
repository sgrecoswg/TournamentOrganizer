using Microsoft.EntityFrameworkCore;
using TournamentOrganizer.Api.Data;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;

namespace TournamentOrganizer.Api.Repositories;

public class EventTemplateRepository : IEventTemplateRepository
{
    private readonly AppDbContext _db;

    public EventTemplateRepository(AppDbContext db) => _db = db;

    public async Task<List<EventTemplate>> GetByStoreAsync(int storeId) =>
        await _db.EventTemplates
            .Where(t => t.StoreId == storeId)
            .OrderBy(t => t.Name)
            .ToListAsync();

    public async Task<EventTemplate> CreateAsync(EventTemplate template)
    {
        _db.EventTemplates.Add(template);
        await _db.SaveChangesAsync();
        return template;
    }

    public async Task<EventTemplate?> GetByIdAsync(int id) =>
        await _db.EventTemplates.FindAsync(id);

    public async Task UpdateAsync(EventTemplate template)
    {
        _db.EventTemplates.Update(template);
        await _db.SaveChangesAsync();
    }

    public async Task DeleteAsync(EventTemplate template)
    {
        _db.EventTemplates.Remove(template);
        await _db.SaveChangesAsync();
    }
}
