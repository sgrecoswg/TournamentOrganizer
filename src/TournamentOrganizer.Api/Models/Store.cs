namespace TournamentOrganizer.Api.Models;

public class Store
{
    public int Id { get; set; }
    public string StoreName { get; set; } = string.Empty;
    public int? LicenseId { get; set; }   // nullable — breaks circular FK with License
    public bool IsActive { get; set; } = true;
    public DateTime CreatedOn { get; set; } = DateTime.UtcNow;
    public string CreatedBy { get; set; } = "system";
    public DateTime UpdatedOn { get; set; } = DateTime.UtcNow;
    public string UpdatedBy { get; set; } = "system";
    public string? LogoUrl { get; set; }
    public string? DiscordWebhookUrl { get; set; }

    public License? License { get; set; }
    public StoreSettings? Settings { get; set; }
    public ICollection<StoreEvent> StoreEvents { get; set; } = new List<StoreEvent>();
}
