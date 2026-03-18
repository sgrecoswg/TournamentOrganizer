using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;
using TournamentOrganizer.Api.Services;

namespace TournamentOrganizer.Tests;

public class LicenseTierServiceTests
{
    // ── Fake ILicenseRepository ───────────────────────────────────────────────

    private sealed class FakeLicenseRepository(License? license) : ILicenseRepository
    {
        public Task<License?> GetByStoreAsync(int storeId) => Task.FromResult(license);
        public Task<List<License>> GetAllAsync() => Task.FromResult(new List<License>());
        public Task<License> CreateAsync(License l) => Task.FromResult(l);
        public Task<License?> UpdateAsync(License l) => Task.FromResult(l);
    }

    private static LicenseTierService CreateService(License? license)
        => new(new FakeLicenseRepository(license));

    // ── Tests ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetEffectiveTierAsync_NoLicense_ReturnsFree()
    {
        var service = CreateService(null);
        var result  = await service.GetEffectiveTierAsync(1);
        Assert.Equal(LicenseTier.Free, result);
    }

    [Fact]
    public async Task GetEffectiveTierAsync_ExpiredLicense_ReturnsFree()
    {
        var license = new License
        {
            StoreId       = 1,
            IsActive      = true,
            Tier          = LicenseTier.Tier2,
            ExpiresDate   = DateTime.UtcNow.AddDays(-1),   // expired yesterday
            AvailableDate = DateTime.UtcNow.AddMonths(-12),
        };
        var service = CreateService(license);
        var result  = await service.GetEffectiveTierAsync(1);
        Assert.Equal(LicenseTier.Free, result);
    }

    [Fact]
    public async Task GetEffectiveTierAsync_ActiveTier1_ReturnsTier1()
    {
        var license = new License
        {
            StoreId       = 1,
            IsActive      = true,
            Tier          = LicenseTier.Tier1,
            ExpiresDate   = DateTime.UtcNow.AddDays(30),
            AvailableDate = DateTime.UtcNow.AddDays(-1),
        };
        var service = CreateService(license);
        var result  = await service.GetEffectiveTierAsync(1);
        Assert.Equal(LicenseTier.Tier1, result);
    }

    [Fact]
    public async Task GetEffectiveTierAsync_ActiveTier2_ReturnsTier2()
    {
        var license = new License
        {
            StoreId       = 1,
            IsActive      = true,
            Tier          = LicenseTier.Tier2,
            ExpiresDate   = DateTime.UtcNow.AddDays(30),
            AvailableDate = DateTime.UtcNow.AddDays(-1),
        };
        var service = CreateService(license);
        var result  = await service.GetEffectiveTierAsync(1);
        Assert.Equal(LicenseTier.Tier2, result);
    }

    [Fact]
    public async Task GetEffectiveTierAsync_ExpiryTomorrow_ReturnsCorrectTier()
    {
        // Expires exactly tomorrow — still within valid window, so should return license tier
        var license = new License
        {
            StoreId       = 1,
            IsActive      = true,
            Tier          = LicenseTier.Tier1,
            ExpiresDate   = DateTime.UtcNow.AddDays(1),
            AvailableDate = DateTime.UtcNow.AddDays(-1),
        };
        var service = CreateService(license);
        var result  = await service.GetEffectiveTierAsync(1);
        Assert.Equal(LicenseTier.Tier1, result);
    }
}
