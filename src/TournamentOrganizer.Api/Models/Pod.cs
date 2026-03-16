namespace TournamentOrganizer.Api.Models;

public class Pod
{
    public int Id { get; set; }
    public int RoundId { get; set; }
    public int PodNumber { get; set; }
    public int? FinishGroup { get; set; }

    public Round Round { get; set; } = null!;
    public Game? Game { get; set; }
    public ICollection<PodPlayer> PodPlayers { get; set; } = new List<PodPlayer>();
}
