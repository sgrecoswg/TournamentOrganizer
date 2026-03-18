namespace TournamentOrganizer.Api.Services.Interfaces;

public enum BadgeTrigger { GameResultRecorded, EventCompleted, PlacementComplete, TournamentWinner }

public interface IBadgeService
{
    Task CheckAndAwardAsync(int playerId, BadgeTrigger trigger, int? eventId = null);
    Task<List<DTOs.PlayerBadgeDto>> GetBadgesAsync(int playerId);
}
