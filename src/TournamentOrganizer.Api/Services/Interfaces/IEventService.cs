using TournamentOrganizer.Api.DTOs;

namespace TournamentOrganizer.Api.Services.Interfaces;

public interface IEventService
{
    Task<EventDto> CreateAsync(CreateEventDto dto);
    Task<EventDto?> GetByIdAsync(int id);
    Task<List<EventDto>> GetAllAsync(int? storeId = null);
    Task RegisterPlayerAsync(int eventId, int playerId, string? decklistUrl = null, string? commanders = null);
    Task<RoundDto> GenerateNextRoundAsync(int eventId);
    Task<List<RoundDto>> GetRoundsAsync(int eventId);
    Task SubmitGameResultAsync(int gameId, List<GameResultSubmitDto> results);
    Task RevertGameResultAsync(int gameId);
    Task<List<StandingsEntryDto>> GetStandingsAsync(int eventId);
    Task<EventDto?> UpdateStatusAsync(int eventId, string status, int? plannedRounds = null);
    Task<List<EventPlayerDto>> GetEventPlayersAsync(int eventId);
    Task DropPlayerAsync(int eventId, int playerId);
    Task DisqualifyPlayerAsync(int eventId, int playerId);
    Task RemoveAsync(int eventId);
    Task<EventPlayerDto> SetCheckInAsync(int eventId, int playerId, bool checkedIn);
    Task<EventPlayerDto> SetDroppedAsync(int eventId, int playerId, bool dropped);
    Task PromoteFromWaitlistAsync(int eventId);
    Task<EventPlayerDto> ManualPromoteAsync(int eventId, int playerId);
    Task<PairingsDto?> GetPairingsAsync(int eventId);
    Task<CheckInResponseDto> CheckInByTokenAsync(string token, string playerEmail);
    Task<EventPlayerDto> DeclareCommanderAsync(int eventId, int playerId, DeclareCommanderDto dto);
    Task<BulkRegisterResultDto> BulkRegisterConfirmAsync(int eventId, BulkRegisterConfirmDto dto);
    Task<EventDto?> UpdateBackgroundImageUrlAsync(int eventId, string url);
}
