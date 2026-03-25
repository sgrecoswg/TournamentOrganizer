namespace TournamentOrganizer.Api.Models;

public class StoreGroup
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? LogoUrl { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<Store> Stores { get; set; } = new List<Store>();
}
