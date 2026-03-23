using TournamentOrganizer.Api.Models;

namespace TournamentOrganizer.Api.Services.Interfaces;

public interface ILicenseTierService
{
    /// <summary>
    /// Returns Free if no license, or if the license is expired.
    /// Trial active → always Tier2 regardless of License.Tier.
    /// </summary>
    Task<LicenseTier> GetEffectiveTierAsync(int storeId);

    /// <summary>
    /// Returns whether a store is currently in its trial period and when the trial ends.
    /// </summary>
    Task<(bool IsInTrial, DateTime? TrialExpiresDate)> GetTrialStatusAsync(int storeId);
}
