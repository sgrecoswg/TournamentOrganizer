using TournamentOrganizer.Api.Models;

namespace TournamentOrganizer.Api.DTOs;

public record LicenseDto(
    int Id,
    int StoreId,
    string AppKey,
    bool IsActive,
    DateTime AvailableDate,
    DateTime ExpiresDate,
    LicenseTier Tier = LicenseTier.Tier2,
    bool IsInTrial = false,
    DateTime? TrialExpiresDate = null
);

public record CreateLicenseDto(string AppKey, DateTime AvailableDate, DateTime ExpiresDate, LicenseTier Tier = LicenseTier.Tier1, DateTime? TrialExpiresDate = null);

public record UpdateLicenseDto(string AppKey, bool IsActive, DateTime AvailableDate, DateTime ExpiresDate, LicenseTier Tier = LicenseTier.Tier2, DateTime? TrialExpiresDate = null);

public record StoreTierDto(int StoreId, LicenseTier Tier, bool IsActive, DateTime? ExpiresDate, bool IsInTrial = false, DateTime? TrialExpiresDate = null);
