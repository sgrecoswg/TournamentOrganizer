namespace TournamentOrganizer.Api.Models;

public class RefreshToken
{
    public int Id { get; set; }

    /// <summary>64 hex chars from 32 random bytes.</summary>
    public string Token { get; set; } = string.Empty;

    public int AppUserId { get; set; }
    public AppUser AppUser { get; set; } = null!;

    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? RevokedAt { get; set; }

    public bool IsExpired => DateTime.UtcNow >= ExpiresAt;
    public bool IsRevoked => RevokedAt.HasValue;
    public bool IsActive  => !IsRevoked && !IsExpired;
}
