namespace TournamentOrganizer.Api.Models;

public class PodPlayer
{
    public int Id { get; set; }
    public int PodId { get; set; }
    public int PlayerId { get; set; }
    public int SeatOrder { get; set; }

    public Pod Pod { get; set; } = null!;
    public Player Player { get; set; } = null!;
}
