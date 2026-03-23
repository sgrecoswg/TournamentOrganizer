using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;
using TournamentOrganizer.Api.Services.Interfaces;

namespace TournamentOrganizer.Api.Services;

public class LicenseTierService : ILicenseTierService
{
    private readonly ILicenseRepository _licenseRepo;

    public LicenseTierService(ILicenseRepository licenseRepo)
    {
        _licenseRepo = licenseRepo;
    }

    public async Task<LicenseTier> GetEffectiveTierAsync(int storeId)
    {
        var license = await _licenseRepo.GetByStoreAsync(storeId);

        if (license == null)
            return LicenseTier.Free;

        // Active trial → always Tier2 regardless of License.Tier
        if (license.TrialExpiresDate != null && license.TrialExpiresDate > DateTime.UtcNow)
            return LicenseTier.Tier2;

        // Expired license → downgrade to Free (data preserved, features locked)
        if (license.ExpiresDate < DateTime.UtcNow)
            return LicenseTier.Free;

        return license.Tier;
    }

    public async Task<(bool IsInTrial, DateTime? TrialExpiresDate)> GetTrialStatusAsync(int storeId)
    {
        var license = await _licenseRepo.GetByStoreAsync(storeId);
        if (license?.TrialExpiresDate == null)
            return (false, null);
        var isActive = license.TrialExpiresDate > DateTime.UtcNow;
        return (isActive, license.TrialExpiresDate);
    }
}
