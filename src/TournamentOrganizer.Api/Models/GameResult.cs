namespace TournamentOrganizer.Api.Models;

public class GameResult
{
    public int Id { get; set; }
    public int GameId { get; set; }
    public int PlayerId { get; set; }
    public int FinishPosition { get; set; }
    public int Eliminations { get; set; }
    public int TurnsSurvived { get; set; }
    public string? CommanderPlayed { get; set; }
    public string? DeckColors { get; set; }
    public bool Conceded { get; set; }

    public Game Game { get; set; } = null!;
    public Player Player { get; set; } = null!;
}
