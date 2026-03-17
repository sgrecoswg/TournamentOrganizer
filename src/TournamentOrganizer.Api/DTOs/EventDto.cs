namespace TournamentOrganizer.Api.DTOs;

public record CreateEventDto(
    string Name,
    DateTime Date,
    int? StoreId,
    int DefaultRoundTimeMinutes = 55,
    int? MaxPlayers = null,
    string PointSystem = "ScoreBased");

public record EventDto(
    int Id,
    string Name,
    DateTime Date,
    string Status,
    int PlayerCount,
    int DefaultRoundTimeMinutes,
    int? MaxPlayers,
    string PointSystem,
    int? StoreId,
    string? StoreName,
    int? PlannedRounds,
    string? CheckInToken = null);

public record CheckInResponseDto(int EventId, string EventName);

public record RegisterPlayerDto(int PlayerId, string? DecklistUrl = null, string? Commanders = null);

public record UpdateEventStatusDto(string Status, int? PlannedRounds = null);

public record EventPlayerDto(
    int PlayerId,
    string Name,
    double ConservativeScore,
    bool IsRanked,
    string? DecklistUrl,
    string? Commanders,
    bool IsDropped,
    bool IsDisqualified,
    bool IsCheckedIn = false,
    int? DroppedAfterRound = null,
    bool IsWaitlisted = false,
    int? WaitlistPosition = null
);

public record DropPlayerDto(bool IsDropped);

public record CheckInDto(bool IsCheckedIn);

public record DeclareCommanderDto(string? Commanders, string? DecklistUrl);

public record PodPlayerPairingsDto(int PlayerId, string Name, string? CommanderName, int SeatOrder = 0);
public record PodPairingsDto(int PodId, int PodNumber, List<PodPlayerPairingsDto> Players, string GameStatus = "Pending", int? WinnerPlayerId = null);
public record PairingsDto(int EventId, string EventName, int? CurrentRound, List<PodPairingsDto> Pods);

// ── Bulk register ────────────────────────────────────────────────────────────

public record BulkRegisterConfirmDto(List<BulkRegisterConfirmItemDto> Registrations);

public record BulkRegisterConfirmItemDto(
    int?    PlayerId,   // null when creating a new player
    string  Email,
    string? Name        // required when PlayerId is null
);

public record BulkRegisterResultDto(int Registered, int Created, List<BulkRegisterErrorDto> Errors);
public record BulkRegisterErrorDto(string Email, string Reason);
