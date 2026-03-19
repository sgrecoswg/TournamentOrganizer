using TournamentOrganizer.Api.Models;

namespace TournamentOrganizer.Api.Services.Interfaces;

public interface ILicenseTierService
{
    /// <summary>
    /// Returns Free if no license, or if the license is expired.
    /// Otherwise returns the license's Tier.
    /// </summary>
    Task<LicenseTier> GetEffectiveTierAsync(int storeId);
}
