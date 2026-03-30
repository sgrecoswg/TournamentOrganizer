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
        public Task<License?> UpdateAsync(License l) => Task.FromResult<License?>(l);
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

    [Fact]
    public async Task GetEffectiveTierAsync_WithinTrial_ReturnsTier2()
    {
        // Trial active: TrialExpiresDate in the future — always returns Tier2 regardless of License.Tier
        var license = new License
        {
            StoreId          = 1,
            IsActive         = true,
            Tier             = LicenseTier.Free,
            ExpiresDate      = DateTime.UtcNow.AddDays(30),
            AvailableDate    = DateTime.UtcNow.AddDays(-1),
            TrialExpiresDate = DateTime.UtcNow.AddDays(15),
        };
        var service = CreateService(license);
        var result  = await service.GetEffectiveTierAsync(1);
        Assert.Equal(LicenseTier.Tier2, result);
    }

    [Fact]
    public async Task GetEffectiveTierAsync_TrialExpired_ReturnsActualTier()
    {
        // Trial expired: TrialExpiresDate in the past — falls back to License.Tier
        var license = new License
        {
            StoreId          = 1,
            IsActive         = true,
            Tier             = LicenseTier.Tier1,
            ExpiresDate      = DateTime.UtcNow.AddDays(30),
            AvailableDate    = DateTime.UtcNow.AddDays(-1),
            TrialExpiresDate = DateTime.UtcNow.AddDays(-1),
        };
        var service = CreateService(license);
        var result  = await service.GetEffectiveTierAsync(1);
        Assert.Equal(LicenseTier.Tier1, result);
    }

    [Fact]
    public async Task GetEffectiveTierAsync_NoTrialDate_UsesLicenseTier()
    {
        // No trial (TrialExpiresDate is null) — normal tier resolution
        var license = new License
        {
            StoreId          = 1,
            IsActive         = true,
            Tier             = LicenseTier.Tier2,
            ExpiresDate      = DateTime.UtcNow.AddDays(30),
            AvailableDate    = DateTime.UtcNow.AddDays(-1),
            TrialExpiresDate = null,
        };
        var service = CreateService(license);
        var result  = await service.GetEffectiveTierAsync(1);
        Assert.Equal(LicenseTier.Tier2, result);
    }

    // ── Grace period tests ────────────────────────────────────────────────────

    [Fact]
    public async Task GetEffectiveTierAsync_ExpiredWithinGrace_ReturnsLicenseTier()
    {
        // Expired 3 days ago, grace period is 7 days → still within grace
        var license = new License
        {
            StoreId         = 1,
            IsActive        = true,
            Tier            = LicenseTier.Tier1,
            ExpiresDate     = DateTime.UtcNow.AddDays(-3),
            AvailableDate   = DateTime.UtcNow.AddDays(-30),
            GracePeriodDays = 7,
        };
        var service = CreateService(license);
        var result  = await service.GetEffectiveTierAsync(1);
        Assert.Equal(LicenseTier.Tier1, result);
    }

    [Fact]
    public async Task GetEffectiveTierAsync_ExpiredBeyondGrace_ReturnsFree()
    {
        // Expired 10 days ago, grace period is 7 days → beyond grace
        var license = new License
        {
            StoreId         = 1,
            IsActive        = true,
            Tier            = LicenseTier.Tier2,
            ExpiresDate     = DateTime.UtcNow.AddDays(-10),
            AvailableDate   = DateTime.UtcNow.AddDays(-40),
            GracePeriodDays = 7,
        };
        var service = CreateService(license);
        var result  = await service.GetEffectiveTierAsync(1);
        Assert.Equal(LicenseTier.Free, result);
    }

    [Fact]
    public async Task GetEffectiveTierAsync_GracePeriodZero_ExpiredReturnsFree()
    {
        // Grace period = 0 → expired license returns Free immediately
        var license = new License
        {
            StoreId         = 1,
            IsActive        = true,
            Tier            = LicenseTier.Tier1,
            ExpiresDate     = DateTime.UtcNow.AddDays(-1),
            AvailableDate   = DateTime.UtcNow.AddDays(-30),
            GracePeriodDays = 0,
        };
        var service = CreateService(license);
        var result  = await service.GetEffectiveTierAsync(1);
        Assert.Equal(LicenseTier.Free, result);
    }

    [Fact]
    public async Task GetEffectiveTierAsync_GracePeriodDays_ComputedCorrectly()
    {
        // Expired 6 days ago, grace period is 7 days → 1 day of grace remains
        var license = new License
        {
            StoreId         = 1,
            IsActive        = true,
            Tier            = LicenseTier.Tier2,
            ExpiresDate     = DateTime.UtcNow.AddDays(-6),
            AvailableDate   = DateTime.UtcNow.AddDays(-36),
            GracePeriodDays = 7,
        };
        var service = CreateService(license);
        var result  = await service.GetEffectiveTierAsync(1);
        Assert.Equal(LicenseTier.Tier2, result);
    }
}
