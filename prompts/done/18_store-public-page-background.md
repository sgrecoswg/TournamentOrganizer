# Feature: Store Public Page Background Image

> **GitHub Issue:** [#44 feat: store public page background image](https://github.com/sgrecoswg/TournamentOrganizer/issues/44)

## Context
Store managers can already upload a logo for their store. This feature lets them also upload a background image that appears as a hero banner at the top of their public page (`/stores/public/:slug`), giving the page a branded, personalised look when shared with players.

---

## Requirements

- Only `StoreManager` may upload a background image (Settings tab in store detail)
- Accepted formats: `.png`, `.jpg`, `.jpeg` — reject anything else with `400`
- Max file size: 5 MB — reject larger files with `400`
- Uploading replaces any existing background (overwrite the file, update `Store.BackgroundImageUrl`)
- The background is displayed as a CSS hero banner on the store public page header
- If no background is set the header renders normally (no fallback image)
- The upload button label changes to "Change Background" when one is already set

---

## Backend (`src/TournamentOrganizer.Api/`)

### Database / EF Core

**Modify `Models/Store.cs`** — add after `LogoUrl`:
```csharp
public string? BackgroundImageUrl { get; set; }
```

Run: `/migrate AddBackgroundImageUrlToStore`

No unique index needed — nullable, no constraints beyond max length.

### Static files (`Program.cs`)

Add `backgrounds` subdirectory — copy the avatars pattern:
```csharp
var backgroundsPath = Path.Combine(wwwrootPath, "backgrounds");
Directory.CreateDirectory(backgroundsPath);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(backgroundsPath),
    RequestPath = "/backgrounds"
});
```

### DTOs (`DTOs/StoreDto.cs`)

Append `string? BackgroundImageUrl = null` as last optional parameter to:
- `StoreDto`
- `StoreDetailDto`
- `StorePublicDto`

Update all DTO construction sites in `StoresService.cs` to pass `store.BackgroundImageUrl`.

### Service (`Services/StoresService.cs` — interface `IStoresService`)

Add (copy `UpdateLogoUrlAsync`, substitute field name):
```csharp
Task<StoreDto> UpdateBackgroundImageUrlAsync(int storeId, string? backgroundImageUrl);
```

### Controller (`Controllers/StoresController.cs`)

Add (copy logo endpoint, adjust names and size limit):
```csharp
[HttpPost("{id}/background")]
[Authorize(Policy = "StoreEmployee")]
public async Task<ActionResult<StoreDto>> UploadBackground(int id, IFormFile background)
{
    // ownership check (same as logo)
    // allowed extensions: .png, .jpg, .jpeg
    // max size: 5 MB
    // save to wwwroot/backgrounds/{id}{ext}
    // call _service.UpdateBackgroundImageUrlAsync(id, $"/backgrounds/{id}{ext}")
    // return StoreDto
}
```

---

## Frontend (`tournament-client/src/app/`)

### Proxy config (`proxy.conf.json`)

Add entry (copy `/avatars` pattern):
```json
"/backgrounds": {
  "target": "http://localhost:5021",
  "secure": false,
  "changeOrigin": true
}
```

### Models (`core/models/api.models.ts`)

Add `backgroundImageUrl?: string | null` to `StoreDetailDto` and `StorePublicDto`.

### API Service (`core/services/api.service.ts`)

```typescript
uploadStoreBackground(storeId: number, file: File): Observable<StoreDto> {
  const fd = new FormData();
  fd.append('background', file);
  return this.http.post<StoreDto>(`${this.base}/stores/${storeId}/background`, fd);
}
```

### Store Detail — upload control (`features/stores/store-detail.component.ts`)

Add inside the `@if (authService.isStoreManager)` block in the Settings tab, below the existing fields:

```html
<div class="background-section">
  @if (store.backgroundImageUrl) {
    <img class="background-preview" [src]="store.backgroundImageUrl" alt="Page background">
  }
  <button mat-stroked-button (click)="bgInput.click()">
    <mat-icon>wallpaper</mat-icon>
    {{ store.backgroundImageUrl ? 'Change Background' : 'Upload Background' }}
  </button>
  <input #bgInput type="file" accept=".png,.jpg,.jpeg"
         style="display:none"
         (change)="onBackgroundSelected($event)">
</div>
```

Add handler `onBackgroundSelected(event: Event)` — copy `onLogoSelected` pattern:
- Optimistic preview via `URL.createObjectURL(file)`
- On success: `const bgUrl = dto.backgroundImageUrl ? \`${dto.backgroundImageUrl}?t=${Date.now()}\` : null` — update `this.store`
- On error: `this.snackBar.open('Background upload failed', 'Close', { duration: 3000 })`
- `this.cdr.detectChanges()` after every state mutation
- No store-context update needed (background not used in toolbar/store list)

Add CSS:
```css
.background-section { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
.background-preview { width: 100%; max-width: 480px; height: 120px; object-fit: cover; border-radius: 8px; }
```

### Store Public Page — display (`features/stores/store-public-page.component.ts`)

Add getter (same `sessionTs` cache-bust pattern as `logoUrl`):
```typescript
get backgroundUrl(): string | null {
  const url = this.page?.backgroundImageUrl;
  if (!url) return null;
  return url.includes('?t=') ? url : `${url}?t=${this.sessionTs}`;
}
```

Apply on store-header div:
```html
<div class="store-header"
     [style.backgroundImage]="backgroundUrl ? 'url(' + backgroundUrl + ')' : null">
```

Update `.store-header` CSS:
```css
.store-header {
  background-size: cover;
  background-position: center;
  border-radius: 8px;
  min-height: 160px;
  padding: 24px;
}
```

### Post-implementation checklist
- [ ] `/check-zone store-detail.component.ts`
- [ ] `/check-zone store-public-page.component.ts`

---

## Backend Unit Tests (`src/TournamentOrganizer.Tests/`)

**No Moq** — hand-roll fakes. Copy `StoreLogoTests.cs` structure.

**New test class: `StoreBackgroundTests`**
- `UploadBackground_ValidFile_SavesUrlAndReturnsDto`
- `UploadBackground_InvalidExtension_Returns400`
- `UploadBackground_FileTooLarge_Returns400`
- `UploadBackground_ReplacesExistingBackground`

**Update `StoreLogoTests.cs`** — add `throw new NotImplementedException()` stub for `UpdateBackgroundImageUrlAsync` in its `FakeStoresService`.

Run with: `dotnet test --filter "FullyQualifiedName~StoreBackgroundTests"`

---

## Frontend Unit Tests (Jest)

**`store-detail.component.spec.ts`** — add describe block:
- "Upload Background" button visible for StoreManager
- "Upload Background" button not visible for Player role
- `onBackgroundSelected` calls `apiService.uploadStoreBackground`
- On success, `store.backgroundImageUrl` is updated
- On error, snackbar shows `'Background upload failed'`

**`store-public-page.component.spec.ts`** — add cases:
- `store-header` has `background-image` style when `backgroundImageUrl` is set
- No `background-image` style when `backgroundImageUrl` is null

Run with: `npx jest --config jest.config.js --testPathPatterns=store-detail.component|store-public-page.component`

---

## Playwright E2E Tests

**Modify `e2e/helpers/api-mock.ts`**:
- Add `mockUploadStoreBackground(page, storeId, response: StoreDto)`
- Update `makeStorePublicDto` to accept `backgroundImageUrl?: string | null`

**Modify `e2e/stores/store-public-page.spec.ts`** — add describe block:
- `background-image` style applied to store-header when `backgroundImageUrl` is set
- No `background-image` style when `backgroundImageUrl` is null

**Modify `e2e/stores/store-detail.spec.ts`** — add describe block:
- "Upload Background" button visible for StoreManager
- "Upload Background" button NOT visible for Player role

Run with: `/e2e e2e/stores/`

---

## Verification Checklist
- [ ] Failing tests confirmed red before implementation (TDD)
- [ ] `/migrate AddBackgroundImageUrlToStore` — applied
- [ ] `dotnet test --filter "FullyQualifiedName~StoreBackgroundTests"` — all pass
- [ ] `dotnet test` — all pass
- [ ] `/build` — 0 errors
- [ ] `npx jest --config jest.config.js --testPathPatterns=store-detail.component|store-public-page.component` — all pass
- [ ] `/check-zone store-detail.component.ts` — clean
- [ ] `/check-zone store-public-page.component.ts` — clean
- [ ] `/e2e e2e/stores/` — all pass
