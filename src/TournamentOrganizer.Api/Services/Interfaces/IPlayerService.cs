using TournamentOrganizer.Api.DTOs;

namespace TournamentOrganizer.Api.Services.Interfaces;

public interface IPlayerService
{
    Task<PlayerDto> RegisterAsync(CreatePlayerDto dto);
    Task<PlayerDto?> UpdateAsync(int id, UpdatePlayerDto dto);
    Task<PlayerProfileDto?> GetProfileAsync(int id);
    Task<List<PlayerDto>> GetAllAsync();
    Task<List<LeaderboardEntryDto>> GetLeaderboardAsync();
    Task<List<HeadToHeadEntryDto>?> GetHeadToHeadAsync(int playerId);
}
