using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Repositories.Interfaces;
using TournamentOrganizer.Api.Services.Interfaces;

namespace TournamentOrganizer.Api.Services;

public class ThemeService : IThemeService
{
    private readonly IThemeRepository _repo;

    public ThemeService(IThemeRepository repo) => _repo = repo;

    public async Task<List<ThemeDto>> GetAllAsync()
    {
        var themes = await _repo.GetAllAsync();
        return themes.Select(t => new ThemeDto(t.Id, t.Name, t.CssClass, t.IsActive)).ToList();
    }
}
