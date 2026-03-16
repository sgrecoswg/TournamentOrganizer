namespace TournamentOrganizer.Api.Models;

public class Theme
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string CssClass { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedOn { get; set; } = DateTime.UtcNow;
    public string CreatedBy { get; set; } = "system";
    public DateTime UpdatedOn { get; set; } = DateTime.UtcNow;
    public string UpdatedBy { get; set; } = "system";
}
