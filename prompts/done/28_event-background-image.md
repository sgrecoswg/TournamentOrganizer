# Feature: Per-Event Background Image

> **GitHub Issue:** [#50 feat: Add Store background image to event pages](https://github.com/SensibleProgramming/TournamentOrganizer/issues/50)
> **Story Points:** 8 · Model: `opus`

## Context
Events currently have no background image. The store public page already supports a background banner (stored at `/backgrounds/{storeId}.ext`, applied via `[style.backgroundImage]`). This feature adds the same capability to events: each event can have its own background, falling back to the store's background if none is set. The background is visible on the event-facing pages and an upload control is added to the event-detail settings area.

## Dependencies
- None

---

## Requirements

- `Event` entity gets a nullable `BackgroundImageUrl` column
- New endpoint: `POST /api/events/{id}/background` — StoreEmployee / Admin only
- File stored at `wwwroot/backgrounds/event_{id}{ext}` (prefix avoids collision with store IDs)
- `EventDto` includes both `BackgroundImageUrl` (event-specific) and `StoreBackgroundImageUrl` (store fallback)
- `PairingsDto` includes resolved effective background URL
- Background displayed as header banner on: event-detail, pairings-display, event-list
- Upload control in event-detail settings section (same UI pattern as store-detail)
- Frontend fallback: `event.backgroundImageUrl ?? event.storeBackgroundImageUrl`
- Cache-bust on upload: `?t=${Date.now()}`; session cache-bust on initial load: `?t=${sessionTs}`

---

## Backend (`src/TournamentOrganizer.Api/`)

### Models — `Models/Event.cs`
Add:
```csharp
public string? BackgroundImageUrl { get; set; }
```

### DTOs — `DTOs/EventDto.cs`
Add to `EventDto` record:
```csharp
string? BackgroundImageUrl = null,
string? StoreBackgroundImageUrl = null
```

Add to `PairingsDto` record:
```csharp
string? BackgroundImageUrl = null
```
(Resolved value — event's own or store's, set by service.)

### Service — `Services/EventService.cs`

**`ToEventDto` mapper** — add parameters:
```csharp
private static EventDto ToEventDto(Event evt, int playerCount,
    int? storeId = null, string? storeName = null,
    string? storeBackgroundImageUrl = null) =>
    new(evt.Id, evt.Name, evt.Date, evt.Status.ToString(), playerCount,
        evt.DefaultRoundTimeMinutes, evt.MaxPlayers, evt.PointSystem.ToString(),
        storeId, storeName, evt.PlannedRounds, evt.CheckInToken,
        evt.BackgroundImageUrl, storeBackgroundImageUrl);
```

**`GetAllAsync`** — already includes `.ThenInclude(se => se!.Store)`; pass `evt.StoreEvent?.Store?.BackgroundImageUrl` to mapper.

**`GetByIdAsync`** — after `GetStoreInfoForEventAsync`, also fetch store's background and pass to mapper. Look up the store via `_storeEventRepo` or a store repo call.

**Pairings builder** (wherever `PairingsDto` is constructed) — resolve:
```csharp
var effectiveBg = evt.BackgroundImageUrl ?? store?.BackgroundImageUrl;
new PairingsDto(evt.Id, evt.Name, currentRound, pods, effectiveBg);
```

**New method** in `IEventService` and `EventService`:
```csharp
Task<EventDto?> UpdateBackgroundImageUrlAsync(int eventId, string url);
```
Implementation: fetch event by id, set `BackgroundImageUrl`, save, return updated `ToEventDto(...)`.

### Controller — `Controllers/EventsController.cs`
New endpoint mirroring `StoresController.UploadBackground`:
```csharp
private static readonly HashSet<string> _allowedBgExtensions = [".png", ".jpg", ".jpeg"];
private const long MaxBgFileSizeBytes = 5 * 1024 * 1024;

[HttpPost("{id}/background")]
[Authorize(Policy = "StoreEmployee")]
public async Task<ActionResult<EventDto>> UploadBackground(int id, IFormFile background)
{
    // Ownership: Admin can update any; StoreEmployee/Manager only their own store's events
    if (!User.HasClaim("role", "Administrator"))
    {
        var jwtStoreId = int.TryParse(User.FindFirstValue("storeId"), out var s) ? s : 0;
        var (storeId, _) = await _storeEventRepo.GetStoreInfoForEventAsync(id);
        if (storeId != jwtStoreId) return Forbid();
    }

    var ext = Path.GetExtension(background.FileName).ToLowerInvariant();
    if (!_allowedBgExtensions.Contains(ext))
        return BadRequest("Invalid file type. Allowed: .png, .jpg, .jpeg");

    if (background.Length > MaxBgFileSizeBytes)
        return BadRequest("File exceeds 5 MB limit.");

    var webRoot = _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
    var bgDir = Path.Combine(webRoot, "backgrounds");
    Directory.CreateDirectory(bgDir);

    var filePath = Path.Combine(bgDir, $"event_{id}{ext}");
    await using var stream = new FileStream(filePath, FileMode.Create);
    await background.CopyToAsync(stream);

    var url = $"/backgrounds/event_{id}{ext}";
    var updated = await _eventService.UpdateBackgroundImageUrlAsync(id, url);
    return updated == null ? NotFound() : Ok(updated);
}
```

### Migration
Run: `/migrate AddEventBackgroundImageUrl`

---

## Frontend (`tournament-client/src/app/`)

### Models — `core/models/api.models.ts`
Add to `EventDto` interface:
```typescript
backgroundImageUrl?: string | null;
storeBackgroundImageUrl?: string | null;
```
Add to `PairingsDto` interface:
```typescript
backgroundImageUrl?: string | null;
```

### API Service — `core/services/api.service.ts`
```typescript
uploadEventBackground(eventId: number, file: File): Observable<EventDto> {
  const fd = new FormData();
  fd.append('background', file);
  return this.http.post<EventDto>(`${this.base}/events/${eventId}/background`, fd);
}
```

### Event Detail — `features/events/event-detail.component.ts`

**Header** — wrap existing header content in a div with background binding:
```html
<div class="event-header"
     [style.backgroundImage]="backgroundUrl ? 'url(' + backgroundUrl + ')' : null"
     [class.has-background]="!!backgroundUrl">
  <!-- existing header content -->
</div>
```

**Settings section** — add background upload (only visible to StoreEmployee/Manager/Admin):
```html
<div class="background-section">
  @if (backgroundUrl) {
    <img class="background-preview" [src]="backgroundUrl" alt="Event background">
  }
  <button mat-stroked-button (click)="bgInput.click()">
    <mat-icon>wallpaper</mat-icon>
    {{ event?.backgroundImageUrl ? 'Change Background' : 'Upload Background' }}
  </button>
  <input #bgInput type="file" accept=".png,.jpg,.jpeg"
         style="display:none" (change)="onBackgroundSelected($event)">
</div>
```

**Component class additions:**
```typescript
private readonly sessionTs = Date.now();

get backgroundUrl(): string | null {
  const url = this.event?.backgroundImageUrl ?? this.event?.storeBackgroundImageUrl;
  if (!url) return null;
  return url.includes('?t=') ? url : `${url}?t=${this.sessionTs}`;
}

onBackgroundSelected(e: Event): void {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file || !this.event) return;
  // Preview immediately
  this.event = { ...this.event, backgroundImageUrl: URL.createObjectURL(file) };
  this.cdr.detectChanges();
  // Upload
  this.apiService.uploadEventBackground(this.eventId, file).subscribe({
    next: dto => {
      const url = dto.backgroundImageUrl ? `${dto.backgroundImageUrl}?t=${Date.now()}` : null;
      if (this.event) this.event = { ...this.event, backgroundImageUrl: url };
      this.cdr.detectChanges();
    },
    error: (err: HttpErrorResponse) => {
      const msg = getUploadErrorMessage(err, 'Background upload failed');
      this.snackBar.open(msg, 'Close', { duration: 4000 });
      this.cdr.detectChanges();
    }
  });
}
```

### Pairings Display — `features/events/pairings-display.component.ts`

Apply background to page header:
```html
<div class="pairings-header"
     [style.backgroundImage]="backgroundUrl ? 'url(' + backgroundUrl + ')' : null">
  <h2>{{ pairings?.eventName }} — Round {{ pairings?.currentRound }}</h2>
</div>
```

Component class:
```typescript
private readonly sessionTs = Date.now();

get backgroundUrl(): string | null {
  const url = this.pairings?.backgroundImageUrl;
  if (!url) return null;
  return url.includes('?t=') ? url : `${url}?t=${this.sessionTs}`;
}
```

### Event List — `features/events/event-list.component.ts`

Add page header banner using the store background from the first loaded event:
```html
<div class="events-header"
     [style.backgroundImage]="storeBackgroundUrl ? 'url(' + storeBackgroundUrl + ')' : null">
  <h1>Events</h1>
</div>
```

Component class:
```typescript
private readonly sessionTs = Date.now();

get storeBackgroundUrl(): string | null {
  const url = this.events[0]?.storeBackgroundImageUrl ?? null;
  if (!url) return null;
  return url.includes('?t=') ? url : `${url}?t=${this.sessionTs}`;
}
```

### Post-implementation checklist
- [ ] `/check-zone event-detail.component.ts`
- [ ] `/check-zone pairings-display.component.ts`
- [ ] `/check-zone event-list.component.ts`

---

## Backend Unit Tests (`src/TournamentOrganizer.Tests/`)

**`EventBackgroundTests`**:
- `UpdateBackgroundImageUrlAsync_SetsUrl_ReturnsUpdatedDto`
- `GetById_ReturnsEventBackgroundImageUrl`
- `GetAll_ReturnsStoreBackgroundImageUrl_WhenEventHasNone`
- `GetPairings_IncludesEffectiveBackgroundUrl_EventOwn`
- `GetPairings_FallsBackToStoreBackground_WhenEventHasNone`

Run with: `dotnet test --filter "FullyQualifiedName~EventBackgroundTests"`

---

## Frontend Unit Tests (Jest)

**`event-detail.component.spec.ts`** — add describe block `'Background upload'`:
- Background upload button visible for StoreEmployee
- `onBackgroundSelected` calls `apiService.uploadEventBackground`
- Upload success applies cache-busted URL to `event.backgroundImageUrl`
- Upload error opens snackBar

Run with: `npx jest --config jest.config.js --testPathPatterns=event-detail`

---

## Playwright E2E Tests

**`e2e/events/event-detail.spec.ts`** — add describe blocks

New helper in `e2e/helpers/api-mock.ts`:
```typescript
mockUploadEventBackground(page, eventId: number, response: EventDto)
// intercepts POST /api/events/{eventId}/background
```

| Describe | beforeEach | Tests |
|---|---|---|
| `Event Detail — background display` | `loginAs('StoreEmployee')`, `mockGetEvent` with `backgroundImageUrl` set | Header div has `backgroundImage` style |
| `Event Detail — background fallback` | event has no background, `storeBackgroundImageUrl` set | Header uses store background |
| `Event Detail — background upload` | `loginAs('StoreEmployee')`, `mockUploadEventBackground` | Upload button visible; after mock upload, preview image appears |
| `Pairings — background display` | `mockGetEventPairings` with `backgroundImageUrl` | Pairings header has background style |

Run with: `/e2e e2e/events/event-detail.spec.ts`

---

## Verification Checklist
- [ ] Failing tests red before implementation (TDD)
- [ ] `/migrate AddEventBackgroundImageUrl` — applied
- [ ] `/build` — 0 errors
- [ ] `dotnet test --filter "FullyQualifiedName~EventBackgroundTests"` — all pass
- [ ] `npx jest --config jest.config.js --testPathPatterns=event-detail` — all pass
- [ ] `/check-zone event-detail.component.ts` — clean
- [ ] `/check-zone pairings-display.component.ts` — clean
- [ ] `/check-zone event-list.component.ts` — clean
- [ ] `/e2e e2e/events/event-detail.spec.ts` — all pass
