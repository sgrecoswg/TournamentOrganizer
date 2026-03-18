namespace TournamentOrganizer.Api.Models;

public class PlayerBadge
{
    public int Id { get; set; }
    public int PlayerId { get; set; }
    public Player Player { get; set; } = null!;
    public string BadgeKey { get; set; } = string.Empty;
    public DateTime AwardedAt { get; set; } = DateTime.UtcNow;
    public int? EventId { get; set; }
    public string BadgeKey { get; set; } = string.Empty;   // matches badge table
    public DateTime AwardedAt { get; set; } = DateTime.UtcNow;
    public int? EventId { get; set; }   // event that triggered the badge, if applicable
}
