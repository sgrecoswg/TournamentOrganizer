using System.Text.RegularExpressions;
using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;
using TournamentOrganizer.Api.Services.Interfaces;

namespace TournamentOrganizer.Api.Services;

public class StoresService : IStoresService
{
    private readonly IStoreRepository _storeRepo;
    private readonly IStoreSettingsRepository _settingsRepo;

    public StoresService(IStoreRepository storeRepo, IStoreSettingsRepository settingsRepo)
    {
        _storeRepo = storeRepo;
        _settingsRepo = settingsRepo;
    }

    public async Task<List<StoreDto>> GetAllAsync()
    {
        var stores = await _storeRepo.GetAllAsync();
        return stores.Select(s => new StoreDto(s.Id, s.StoreName, s.IsActive, s.LogoUrl, s.Slug, s.Location, s.BackgroundImageUrl)).ToList();
    }

    public async Task<StoreDetailDto?> GetByIdAsync(int id)
    {
        var store = await _storeRepo.GetByIdWithEventsAsync(id);
        if (store == null) return null;
        var differential = store.Settings?.AllowableTradeDifferential ?? 10m;
        var themeId = store.Settings?.ThemeId;
        var themeCssClass = store.Settings?.Theme?.CssClass;
        var sellerPortalUrl = store.Settings?.SellerPortalUrl;
        return new StoreDetailDto(store.Id, store.StoreName, store.IsActive, differential, BuildEventSummaries(store), MapLicense(store), themeId, themeCssClass, store.LogoUrl, store.DiscordWebhookUrl != null, sellerPortalUrl, store.Slug, store.BackgroundImageUrl);
    }

    public async Task<StoreDto> CreateAsync(CreateStoreDto dto)
    {
        var slug = await EnsureUniqueSlugAsync(GenerateSlug(dto.StoreName.Trim()));
        var store = new Store { StoreName = dto.StoreName.Trim(), Slug = slug };
        await _storeRepo.AddAsync(store);
        await _settingsRepo.UpsertAsync(new StoreSettings
        {
            StoreId = store.Id,
            AllowableTradeDifferential = 10m
        });
        return new StoreDto(store.Id, store.StoreName, store.IsActive, store.LogoUrl, store.Slug, store.Location, store.BackgroundImageUrl);
    }

    public async Task<StoreDetailDto?> UpdateAsync(int id, UpdateStoreDto dto)
    {
        var store = await _storeRepo.GetByIdWithSettingsAsync(id);
        if (store == null) return null;

        store.StoreName = dto.StoreName.Trim();
        store.UpdatedOn = DateTime.UtcNow;
        // null = no change; empty string = clear the webhook URL
        if (dto.DiscordWebhookUrl != null)
            store.DiscordWebhookUrl = dto.DiscordWebhookUrl == string.Empty ? null : dto.DiscordWebhookUrl;
        // Generate slug on first update if not already set
        if (store.Slug == null)
            store.Slug = await EnsureUniqueSlugAsync(GenerateSlug(store.StoreName), store.Id);
        await _storeRepo.UpdateAsync(store);

        await _settingsRepo.UpsertAsync(new StoreSettings
        {
            StoreId = id,
            AllowableTradeDifferential = dto.AllowableTradeDifferential,
            ThemeId = dto.ThemeId,
            SellerPortalUrl = dto.SellerPortalUrl == string.Empty ? null : dto.SellerPortalUrl
        });

        var updatedStore = await _storeRepo.GetByIdWithEventsAsync(id);
        var differential = updatedStore?.Settings?.AllowableTradeDifferential ?? dto.AllowableTradeDifferential;
        var themeId = updatedStore?.Settings?.ThemeId;
        var themeCssClass = updatedStore?.Settings?.Theme?.CssClass;
        var updatedPortalUrl = updatedStore?.Settings?.SellerPortalUrl;
        return new StoreDetailDto(store.Id, store.StoreName, store.IsActive, differential, BuildEventSummaries(updatedStore), MapLicense(updatedStore), themeId, themeCssClass, store.LogoUrl, store.DiscordWebhookUrl != null, updatedPortalUrl, store.Slug, store.BackgroundImageUrl);
    }

    public async Task<StoreDto> UpdateLogoUrlAsync(int storeId, string? logoUrl)
    {
        var store = await _storeRepo.GetByIdWithSettingsAsync(storeId);
        if (store == null) throw new InvalidOperationException($"Store {storeId} not found");
        store.LogoUrl = logoUrl;
        store.UpdatedOn = DateTime.UtcNow;
        await _storeRepo.UpdateAsync(store);
        return new StoreDto(store.Id, store.StoreName, store.IsActive, store.LogoUrl, store.Slug, store.Location, store.BackgroundImageUrl);
    }

    public async Task<StoreDto> UpdateBackgroundImageUrlAsync(int storeId, string? backgroundImageUrl)
    {
        var store = await _storeRepo.GetByIdWithSettingsAsync(storeId);
        if (store == null) throw new InvalidOperationException($"Store {storeId} not found");
        store.BackgroundImageUrl = backgroundImageUrl;
        store.UpdatedOn = DateTime.UtcNow;
        await _storeRepo.UpdateAsync(store);
        return new StoreDto(store.Id, store.StoreName, store.IsActive, store.LogoUrl, store.Slug, store.Location, store.BackgroundImageUrl);
    }

    public async Task<StorePublicDto?> GetPublicPageAsync(string slug)
    {
        var store = await _storeRepo.GetBySlugAsync(slug);
        if (store == null) return null;

        var activeEvents = store.StoreEvents
            .Where(se => se.IsActive && se.Event.Status != EventStatus.Removed)
            .Select(se => se.Event)
            .ToList();

        var upcoming = activeEvents
            .Where(e => e.Status == EventStatus.Registration)
            .Select(e => new StoreEventSummaryDto(e.Id, e.Name, e.Date, e.Status.ToString()))
            .OrderBy(e => e.Date)
            .ToList();

        var recent = activeEvents
            .Where(e => e.Status == EventStatus.Completed)
            .Select(e => new StoreEventSummaryDto(e.Id, e.Name, e.Date, e.Status.ToString()))
            .OrderByDescending(e => e.Date)
            .Take(3)
            .ToList();

        var topPlayers = store.StoreEvents
            .Where(se => se.IsActive && se.Event.Status != EventStatus.Removed)
            .SelectMany(se => se.Event.Registrations)
            .Select(er => er.Player)
            .DistinctBy(p => p.Id)
            .Where(p => p.IsRanked)
            .OrderByDescending(p => p.ConservativeScore)
            .Take(10)
            .Select(p => new StorePublicTopPlayerDto(p.Id, p.Name, p.ConservativeScore, p.AvatarUrl))
            .ToList();

        return new StorePublicDto(store.Id, store.StoreName, store.Slug, store.Location,
            store.LogoUrl, upcoming, recent, topPlayers, store.BackgroundImageUrl);
    }

    private static string GenerateSlug(string name)
    {
        // Strip apostrophes/quotes first so "Bob's" → "bobs" not "bob-s"
        var clean = Regex.Replace(name.ToLowerInvariant(), @"['\u2019]", "");
        return Regex.Replace(clean, @"[^a-z0-9]+", "-").Trim('-');
    }

    private async Task<string> EnsureUniqueSlugAsync(string baseSlug, int? excludeId = null)
    {
        var candidate = baseSlug;
        for (var i = 2; await _storeRepo.SlugExistsAsync(candidate, excludeId); i++)
            candidate = $"{baseSlug}-{i}";
        return candidate;
    }

    private static List<StoreEventSummaryDto> BuildEventSummaries(Store? store) =>
        store?.StoreEvents
            .Where(se => se.IsActive && se.Event.Status != EventStatus.Removed)
            .Select(se => new StoreEventSummaryDto(se.EventId, se.Event.Name, se.Event.Date, se.Event.Status.ToString()))
            .OrderByDescending(e => e.Date)
            .ToList() ?? [];

    private static LicenseDto? MapLicense(Store? store) =>
        store?.License is { } l
            ? new LicenseDto(l.Id, l.StoreId, l.AppKey, l.IsActive, l.AvailableDate, l.ExpiresDate)
            : null;
}
