using Microsoft.EntityFrameworkCore;
using TournamentOrganizer.Api.Data;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;

namespace TournamentOrganizer.Api.Repositories;

public class ThemeRepository : IThemeRepository
{
    private readonly AppDbContext _db;

    public ThemeRepository(AppDbContext db) => _db = db;

    public async Task<List<Theme>> GetAllAsync()
        => await _db.Themes
            .Where(t => t.IsActive)
            .OrderBy(t => t.Id)
            .ToListAsync();
}
