namespace TournamentOrganizer.Api.Models;

public class EventTemplate
{
    public int Id { get; set; }
    public int StoreId { get; set; }
    public Store Store { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Format { get; set; } = "Commander";
    public int MaxPlayers { get; set; } = 16;
    public int NumberOfRounds { get; set; } = 4;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
