namespace TournamentOrganizer.Api.Models;

public class EventRegistration
{
    public int Id { get; set; }
    public int EventId { get; set; }
    public int PlayerId { get; set; }
    public string? DecklistUrl { get; set; }
    public string? Commanders { get; set; }
    public bool IsDropped { get; set; }
    public int? DroppedAfterRound { get; set; }
    public bool IsDisqualified { get; set; }
    public bool IsWaitlisted { get; set; } = false;
    public int? WaitlistPosition { get; set; }
    public bool IsCheckedIn { get; set; } = false;
    public DateTime RegisteredAt { get; set; } = DateTime.UtcNow;

    public Event Event { get; set; } = null!;
    public Player Player { get; set; } = null!;
}
