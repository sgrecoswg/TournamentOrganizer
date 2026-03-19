using TournamentOrganizer.Api.Models;

namespace TournamentOrganizer.Api.DTOs;

public record LicenseDto(
    int Id,
    int StoreId,
    string AppKey,
    bool IsActive,
    DateTime AvailableDate,
    DateTime ExpiresDate,
    LicenseTier Tier = LicenseTier.Tier2
);

public record CreateLicenseDto(string AppKey, DateTime AvailableDate, DateTime ExpiresDate, LicenseTier Tier = LicenseTier.Tier1);

public record UpdateLicenseDto(string AppKey, bool IsActive, DateTime AvailableDate, DateTime ExpiresDate, LicenseTier Tier = LicenseTier.Tier2);

public record StoreTierDto(int StoreId, LicenseTier Tier, bool IsActive, DateTime? ExpiresDate);
