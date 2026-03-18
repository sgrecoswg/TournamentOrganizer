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

        // Expired license → downgrade to Free (data preserved, features locked)
        if (license.ExpiresDate < DateTime.UtcNow)
            return LicenseTier.Free;

        return license.Tier;
    }
}
