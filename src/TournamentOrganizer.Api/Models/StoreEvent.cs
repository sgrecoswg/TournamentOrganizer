namespace TournamentOrganizer.Api.Models;

public class StoreEvent
{
    public int Id { get; set; }
    public int StoreId { get; set; }
    public int EventId { get; set; }
    public bool IsActive { get; set; } = true;

    public Store Store { get; set; } = null!;
    public Event Event { get; set; } = null!;
}
