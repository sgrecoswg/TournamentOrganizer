namespace TournamentOrganizer.Api.Models;

public enum GameStatus
{
    Pending,
    Completed
}

public class Game
{
    public int Id { get; set; }
    public int PodId { get; set; }
    public GameStatus Status { get; set; } = GameStatus.Pending;

    public Pod Pod { get; set; } = null!;
    public ICollection<GameResult> Results { get; set; } = new List<GameResult>();
}
