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
        return stores.Select(s => new StoreDto(s.Id, s.StoreName, s.IsActive, s.LogoUrl)).ToList();
    }

    public async Task<StoreDetailDto?> GetByIdAsync(int id)
    {
        var store = await _storeRepo.GetByIdWithEventsAsync(id);
        if (store == null) return null;
        var differential = store.Settings?.AllowableTradeDifferential ?? 10m;
        var themeId = store.Settings?.ThemeId;
        var themeCssClass = store.Settings?.Theme?.CssClass;
        return new StoreDetailDto(store.Id, store.StoreName, store.IsActive, differential, BuildEventSummaries(store), MapLicense(store), themeId, themeCssClass, store.LogoUrl);
    }

    public async Task<StoreDto> CreateAsync(CreateStoreDto dto)
    {
        var store = new Store { StoreName = dto.StoreName.Trim() };
        await _storeRepo.AddAsync(store);
        await _settingsRepo.UpsertAsync(new StoreSettings
        {
            StoreId = store.Id,
            AllowableTradeDifferential = 10m
        });
        return new StoreDto(store.Id, store.StoreName, store.IsActive, store.LogoUrl);
    }

    public async Task<StoreDetailDto?> UpdateAsync(int id, UpdateStoreDto dto)
    {
        var store = await _storeRepo.GetByIdWithSettingsAsync(id);
        if (store == null) return null;

        store.StoreName = dto.StoreName.Trim();
        store.UpdatedOn = DateTime.UtcNow;
        await _storeRepo.UpdateAsync(store);

        await _settingsRepo.UpsertAsync(new StoreSettings
        {
            StoreId = id,
            AllowableTradeDifferential = dto.AllowableTradeDifferential,
            ThemeId = dto.ThemeId
        });

        var updatedStore = await _storeRepo.GetByIdWithEventsAsync(id);
        var differential = updatedStore?.Settings?.AllowableTradeDifferential ?? dto.AllowableTradeDifferential;
        var themeId = updatedStore?.Settings?.ThemeId;
        var themeCssClass = updatedStore?.Settings?.Theme?.CssClass;
        return new StoreDetailDto(store.Id, store.StoreName, store.IsActive, differential, BuildEventSummaries(updatedStore), MapLicense(updatedStore), themeId, themeCssClass, store.LogoUrl);
    }

    public async Task<StoreDto> UpdateLogoUrlAsync(int storeId, string? logoUrl)
    {
        var store = await _storeRepo.GetByIdWithSettingsAsync(storeId);
        if (store == null) throw new InvalidOperationException($"Store {storeId} not found");
        store.LogoUrl = logoUrl;
        store.UpdatedOn = DateTime.UtcNow;
        await _storeRepo.UpdateAsync(store);
        return new StoreDto(store.Id, store.StoreName, store.IsActive, store.LogoUrl);
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
