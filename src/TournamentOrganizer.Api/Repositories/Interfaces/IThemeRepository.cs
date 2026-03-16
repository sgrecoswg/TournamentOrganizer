using TournamentOrganizer.Api.Models;

namespace TournamentOrganizer.Api.Repositories.Interfaces;

public interface IThemeRepository
{
    Task<List<Theme>> GetAllAsync();
}
