using TournamentOrganizer.Api.DTOs;

namespace TournamentOrganizer.Api.Services.Interfaces;

public interface IThemeService
{
    Task<List<ThemeDto>> GetAllAsync();
}
