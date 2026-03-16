namespace TournamentOrganizer.Api.Services.Interfaces;

public interface IDiscordWebhookService
{
    Task PostRoundResultsAsync(int eventId, int roundNumber);
    Task PostEventCompletedAsync(int eventId);
    Task PostPlayerRankedAsync(int playerId, int eventId);
    Task PostTestMessageAsync(int storeId);
}
