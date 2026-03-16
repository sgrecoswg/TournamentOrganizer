# Feature: Store Logo Upload

## Context

Store managers can upload a logo image from the store detail page. The file is saved to `wwwroot/logos/{storeId}{ext}` on the API server and served as a static file. The resulting relative URL is stored in `Store.LogoUrl`. The logo is displayed on the store detail page; if absent, show a placeholder icon.

---

## Requirements

- Only `StoreEmployee` or `Admin` who owns the store may upload a logo (existing `StoreEmployee` policy)
- Accepted formats: `.png`, `.jpg`, `.jpeg`, `.gif` — reject anything else with `400`
- Max file size: 2 MB — reject larger files with `400`
- Uploading replaces any existing logo (overwrite the file, update `Store.LogoUrl`)
- The logo URL is included in `StoreDetailDto` and `StoreDto`
- Frontend shows a live preview of the selected file before uploading
- Upload triggered by a file input, not a separate Save button
- If no logo is set, display a `<mat-icon>store</mat-icon>` placeholder

---

## Backend (`src/TournamentOrganizer.Api/`)

### Database / EF Core
- Add `public string? LogoUrl { get; set; }` to `Store` model (`Models/Store.cs`)
- Run `/migrate AddLogoUrlToStore`

### DTOs (`DTOs/StoreDto.cs`)
- `StoreDto` and `StoreDetailDto` are **positional records** — append `string? LogoUrl = null` as the last parameter in each constructor
- Current: `public record StoreDto(int Id, string StoreName, bool IsActive)`
- Updated: `public record StoreDto(int Id, string StoreName, bool IsActive, string? LogoUrl = null)`
- Same pattern for `StoreDetailDto`
- Also update all 3 DTO construction sites in `StoresService.cs` to pass `s.LogoUrl` / `store.LogoUrl`

### Controller (`Controllers/StoresController.cs`)
- Inject `IWebHostEnvironment env` via constructor (alongside `IStoresService`)
- Add `POST /api/stores/{id}/logo` — accepts `IFormFile logo`
  - `[Authorize(Policy = "StoreEmployee")]`; replicate the ownership check from the existing `[HttpPut("{id}")]` action (Admin bypasses; others check `storeId` claim)
  - Validate extension (`.png`, `.jpg`, `.jpeg`, `.gif`) and size (≤ 2 MB); return `400` with message on failure
  - Resolve the save directory with `_env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot")` — `WebRootPath` is null when `wwwroot` didn't exist at startup
  - Call `Directory.CreateDirectory(logosDir)` to ensure `wwwroot/logos/` exists before writing
  - Save file to `wwwroot/logos/{id}{ext}`; call `_service.UpdateLogoUrlAsync(id, $"/logos/{id}{ext}")`; return updated `StoreDto`

### Static files (`Program.cs`)
- `app.UseStaticFiles()` alone is **not sufficient** — it gets a `NullFileProvider` if `wwwroot` didn't exist at startup
- Use an explicit `PhysicalFileProvider` computed at runtime:

```csharp
var wwwrootPath = app.Environment.WebRootPath
    ?? Path.Combine(app.Environment.ContentRootPath, "wwwroot");
Directory.CreateDirectory(wwwrootPath);
app.UseStaticFiles(new Microsoft.AspNetCore.Builder.StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(wwwrootPath)
});
```

Place this block after `app.UseCors()` and before `app.UseAuthentication()`.

### Service (`Services/StoresService.cs` — interface `IStoresService`)
- Add `Task<StoreDto> UpdateLogoUrlAsync(int storeId, string? logoUrl)` to `IStoresService` and implement in `StoresService` — updates only `LogoUrl`, `UpdatedOn`; does **not** touch `UpdatedBy`

---

## Frontend (`tournament-client/src/app/`)

### Proxy config (`proxy.conf.json`)
- Add a `/logos` entry alongside `/api` so the Angular dev server proxies logo image requests to the API:

```json
"/logos": {
  "target": "http://localhost:5021",
  "secure": false,
  "changeOrigin": true
}
```

Without this, `<img src="/logos/1.png">` resolves against `localhost:4200` and displays as broken.

### Model (`core/models/api.models.ts`)
- Add `logoUrl?: string | null` to `StoreDetailDto` interface (check `StoreDto` too — it may already have it)

### API Service (`core/services/api.service.ts`)
- Add `uploadStoreLogo(storeId: number, file: File): Observable<StoreDto>` — sends `FormData` with field name `logo` to `POST /api/stores/{id}/logo`

### Component (`features/stores/store-detail.component.ts`)
- In the store header area, add:
  - `<img class="store-logo">` showing `store.logoUrl` if set, otherwise `<mat-icon class="store-logo-placeholder">store</mat-icon>` placeholder
  - Hidden `<input type="file" accept=".png,.jpg,.jpeg,.gif">` triggered by a `Change Logo` button (visible to `StoreEmployee`/`Admin` only; use `@if (authService.isStoreEmployee)`)
  - On file selected: show local preview immediately via `URL.createObjectURL()` (wrap in try/catch — JSDOM doesn't support it); call `uploadStoreLogo()`; on success update `store.logoUrl` and call `cdr.detectChanges()`; on error show snackbar `'Logo upload failed'` and call `cdr.detectChanges()`

### Post-implementation checklist
- [ ] Run `/check-zone` on `store-detail.component.ts`

---

## Backend Unit Tests (`src/TournamentOrganizer.Tests/`)

**No Moq** — hand-roll fakes. Use `FormFile` directly for `IFormFile`.

**Test class: `StoreLogoTests`** — test the controller action directly

```csharp
private static StoresController BuildController(
    IStoresService service, IWebHostEnvironment env,
    bool isAdmin = false, int jwtStoreId = 1)
```

Tests:
- `UploadLogo_ValidFile_SavesUrlAndReturnsDto`
- `UploadLogo_InvalidExtension_Returns400`
- `UploadLogo_FileTooLarge_Returns400`
- `UploadLogo_ReplacesExistingLogo`

Run with: `dotnet test --filter "FullyQualifiedName~StoreLogoTests"`

---

## Frontend Unit Tests (Jest)

**`features/stores/store-detail.component.spec.ts`** — add to existing spec; read the file first to match its mock setup pattern before adding cases

- logo `<img class="store-logo">` is rendered when `store.logoUrl` is set
- `<mat-icon class="store-logo-placeholder">` is shown when `store.logoUrl` is null/undefined
- file input `change` event calls `apiService.uploadStoreLogo` with the selected file
- on upload success, `store.logoUrl` is updated and `cdr.detectChanges()` is called
- on upload error, snackbar shows `'Logo upload failed'`

Run with: `npx jest --config jest.config.js --testPathPatterns=store-detail.component`

---

## Playwright E2E Tests (`e2e/stores/store-detail.spec.ts`)

Add helpers to `e2e/helpers/api-mock.ts`:
- `mockUploadStoreLogo(page, storeId, response)` — intercepts `POST /api/stores/{id}/logo`

Add describe blocks to `e2e/stores/store-detail.spec.ts`:

```
describe('logo: placeholder shown when no logo')
  - shows mat-icon.store-logo-placeholder when logoUrl is null
  - Change Logo button is visible for StoreEmployee

describe('logo: image shown when logoUrl is set')
  - shows img.store-logo when logoUrl is set
  - placeholder is NOT shown when logoUrl is set

describe('logo: upload updates the image')
  - uploading a file calls POST /api/stores/{id}/logo
    → use page.waitForRequest(...) NOT a boolean flag (HTTP request is async; flag check after setInputFiles is always false)
  - Change Logo button is NOT visible for Player role
```

Run with: `/e2e e2e/stores/store-detail.spec.ts`

---

## Verification Checklist

- [ ] Failing tests confirmed red before implementation (TDD)
- [ ] `/build` — 0 errors
- [ ] `dotnet test --filter "FullyQualifiedName~StoreLogoTests"` — all pass
- [ ] `npx jest --config jest.config.js --testPathPatterns=store-detail.component` — all pass
- [ ] `/check-zone store-detail.component.ts` — clean
- [ ] `/e2e e2e/stores/store-detail.spec.ts` — all pass
