namespace TournamentOrganizer.Api.Models;

public class License
{
    public int Id { get; set; }
    public int StoreId { get; set; }
    public string AppKey { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime AvailableDate { get; set; }
    public DateTime ExpiresDate { get; set; }
    public DateTime CreatedOn { get; set; } = DateTime.UtcNow;
    public string CreatedBy { get; set; } = "system";
    public DateTime UpdatedOn { get; set; } = DateTime.UtcNow;
    public string UpdatedBy { get; set; } = "system";

    public LicenseTier Tier { get; set; } = LicenseTier.Tier2;
    public DateTime? TrialExpiresDate { get; set; }
    public int GracePeriodDays { get; set; } = 0;

    public Store Store { get; set; } = null!;
}
