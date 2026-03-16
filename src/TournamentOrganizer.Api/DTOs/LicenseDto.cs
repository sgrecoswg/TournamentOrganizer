namespace TournamentOrganizer.Api.DTOs;

public record LicenseDto(
    int Id,
    int StoreId,
    string AppKey,
    bool IsActive,
    DateTime AvailableDate,
    DateTime ExpiresDate
);

public record CreateLicenseDto(string AppKey, DateTime AvailableDate, DateTime ExpiresDate);

public record UpdateLicenseDto(string AppKey, bool IsActive, DateTime AvailableDate, DateTime ExpiresDate);
