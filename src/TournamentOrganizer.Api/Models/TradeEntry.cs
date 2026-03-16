namespace TournamentOrganizer.Api.Models;

public class TradeEntry
{
    public int Id { get; set; }
    public int PlayerId { get; set; }
    public string CardName { get; set; } = string.Empty;
    public int Quantity { get; set; } = 1;

    public Player Player { get; set; } = null!;
}
