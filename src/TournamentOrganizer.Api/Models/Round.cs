namespace TournamentOrganizer.Api.Models;

public class Round
{
    public int Id { get; set; }
    public int EventId { get; set; }
    public int RoundNumber { get; set; }

    public Event Event { get; set; } = null!;
    public ICollection<Pod> Pods { get; set; } = new List<Pod>();
}
