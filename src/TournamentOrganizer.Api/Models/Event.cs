namespace TournamentOrganizer.Api.Models;

public enum EventStatus
{
    Registration,
    InProgress,
    Paused,
    Completed,
    Removed
}

public enum PointSystem
{
    ScoreBased,     // 1st=4, 2nd=3, 3rd=2, 4th+=1
    WinBased,       // 1st=5, others=0, draw=1
    VictoryPoints,  // stub — not yet implemented
    PointWager,     // stub — not yet implemented
    SocialVoting,   // stub — not yet implemented
    FiveOneZero,    // Win=5(+seat bonus), Loss=1, Draw=0
    SeatBased       // Winner earns 6+seat pts (seat1=7..seat4=10), non-winners=0
}

public class Event
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTime Date { get; set; }
    public EventStatus Status { get; set; } = EventStatus.Registration;
    public int DefaultRoundTimeMinutes { get; set; } = 55;
    public int? MaxPlayers { get; set; }
    public PointSystem PointSystem { get; set; } = PointSystem.ScoreBased;
    public int? PlannedRounds { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string CheckInToken { get; set; } = Guid.NewGuid().ToString("N");
    public string? BackgroundImageUrl { get; set; }

    public ICollection<EventRegistration> Registrations { get; set; } = new List<EventRegistration>();
    public ICollection<Round> Rounds { get; set; } = new List<Round>();
    public StoreEvent? StoreEvent { get; set; }
}
