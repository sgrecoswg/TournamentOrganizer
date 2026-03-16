using TournamentOrganizer.Api.Models;

namespace TournamentOrganizer.Api.Services.Interfaces;

public interface IAuthService
{
    Task<AppUser> FindOrCreateUserAsync(string email, string name, string googleId);
    string GenerateJwt(AppUser user);
}
