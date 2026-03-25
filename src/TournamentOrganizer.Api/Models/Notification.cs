namespace TournamentOrganizer.Api.Models;

public class Notification
{
    public int Id { get; set; }
    public int PlayerId { get; set; }
    public Player Player { get; set; } = null!;
    public string Type { get; set; } = "TradeMatch";
    public string Message { get; set; } = string.Empty;
    public string? LinkPath { get; set; }
    public bool IsRead { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public int? RelatedEntityId { get; set; }
}
