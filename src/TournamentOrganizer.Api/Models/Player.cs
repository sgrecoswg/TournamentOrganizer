namespace TournamentOrganizer.Api.Models;

public class Player
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public double Mu { get; set; } = 25.0;
    public double Sigma { get; set; } = 25.0 / 3.0;
    public double ConservativeScore => Mu - 3 * Sigma;
    public int PlacementGamesLeft { get; set; } = 5;
    public bool IsRanked => PlacementGamesLeft <= 0;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? AvatarUrl { get; set; }

    public ICollection<EventRegistration> EventRegistrations { get; set; } = new List<EventRegistration>();
    public ICollection<GameResult> GameResults { get; set; } = new List<GameResult>();
    public ICollection<PlayerBadge> Badges { get; set; } = new List<PlayerBadge>();
}
