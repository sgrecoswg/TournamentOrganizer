namespace TournamentOrganizer.Api.DTOs;

public record StoreDto(int Id, string StoreName, bool IsActive, string? LogoUrl = null);
public record StoreEventSummaryDto(int EventId, string EventName, DateTime Date, string Status);
public record StoreDetailDto(int Id, string StoreName, bool IsActive, decimal AllowableTradeDifferential, List<StoreEventSummaryDto> Events, LicenseDto? License = null, int? ThemeId = null, string? ThemeCssClass = null, string? LogoUrl = null);
public record CreateStoreDto(string StoreName);
public record UpdateStoreDto(string StoreName, decimal AllowableTradeDifferential, int? ThemeId = null);
public record ThemeDto(int Id, string Name, string CssClass, bool IsActive);
