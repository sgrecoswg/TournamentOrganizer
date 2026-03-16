namespace TournamentOrganizer.Api.Models;

public class StoreSettings
{
    public int Id { get; set; }
    public int StoreId { get; set; }
    public decimal AllowableTradeDifferential { get; set; } = 10m;
    public DateTime CreatedOn { get; set; } = DateTime.UtcNow;
    public string CreatedBy { get; set; } = "system";
    public DateTime UpdatedOn { get; set; } = DateTime.UtcNow;
    public string UpdatedBy { get; set; } = "system";

    public int? ThemeId { get; set; }

    public Store Store { get; set; } = null!;
    public Theme? Theme { get; set; }
}
