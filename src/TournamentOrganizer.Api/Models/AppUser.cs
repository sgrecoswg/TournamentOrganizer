namespace TournamentOrganizer.Api.Models;

public enum AppUserRole
{
    Player = 0,
    StoreEmployee = 1,
    StoreManager = 2,
    Administrator = 3
}

public class AppUser
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? GoogleId { get; set; }
    public AppUserRole Role { get; set; } = AppUserRole.Player;
    public int? PlayerId { get; set; }
    public int? StoreId { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Player? Player { get; set; }
    public Store? Store { get; set; }
}
