# Feature: Store Public Page

## Context
Currently stores are only visible to logged-in users. A public-facing store page — accessible without login — lets players browse upcoming events, see the local leaderboard, and find store info. This drives organic discovery and gives stores a shareable URL.

---

## Requirements

- Route: `/stores/{slug}` — **public, no auth required**
- `Store` gains a `Slug` field (URL-safe string, unique, set on creation or by admin)
- Page sections:
  - Store header: name, logo, location (free text)
  - Upcoming events (Registration status), sorted by date
  - Recent event results (last 3 Completed events)
  - Store leaderboard (top 10 players by ConservativeScore for this store)
- "Register for Event" links navigate to the event detail page (prompts login if needed)
- No editable content on this page — read-only

---

## Backend (`src/TournamentOrganizer.Api/`)

### Database / EF Core

**Modify `Models/Store.cs`** — add:
```csharp
public string? Slug { get; set; }    // e.g. "top-deck-games"
public string? Location { get; set; } // free text address/city
```

Add unique index on `Slug` in migration.
Run: `/migrate AddSlugAndLocationToStore`

### DTOs

- **`StoreDto`** — append `string? Slug = null`, `string? Location = null`
- **New `StorePublicDto`**:
```csharp
public record StorePublicDto(
    int Id,
    string StoreName,
    string? LogoUrl,
    string? Location,
    string? Slug,
    List<EventDto> UpcomingEvents,
    List<EventDto> RecentEvents,
    List<PlayerDto> TopPlayers
);
```

### Service (`Services/StoresService.cs`)

**`GetPublicPageAsync(string slug)`**
- Fetch store by `Slug`; return null if not found
- Load events: `Status == Registration` (upcoming) + last 3 `Status == Completed` (recent)
- Load top 10 players: players with `EventRegistration` at this store, ordered by `ConservativeScore` desc
- Return `StorePublicDto`

### Controller (`Controllers/StoresController.cs`)

```csharp
[HttpGet("public/{slug}")]
[AllowAnonymous]
public async Task<ActionResult<StorePublicDto>> GetPublicPage(string slug)
{
    var result = await _storesService.GetPublicPageAsync(slug);
    if (result == null) return NotFound();
    return Ok(result);
}
```

Also: when creating/updating a store, auto-generate slug from name if not provided:
```csharp
slug = name.ToLowerInvariant().Replace(" ", "-").Replace("'", "");
```
Ensure uniqueness by appending `-2`, `-3` etc. if needed.

### API Service (`core/services/api.service.ts`)

```typescript
getStorePublicPage(slug: string): Observable<StorePublicDto> {
  return this.http.get<StorePublicDto>(`${this.base}/stores/public/${slug}`);
}
```

---

## Frontend (`tournament-client/src/app/`)

### Models (`core/models/api.models.ts`)

```typescript
export interface StorePublicDto {
  id: number; storeName: string; logoUrl?: string | null; location?: string | null; slug?: string | null;
  upcomingEvents: EventDto[]; recentEvents: EventDto[]; topPlayers: PlayerDto[];
}
```

### New component: `features/stores/store-public-page.component.ts`

- Standalone, no auth guard
- Route: `{ path: 'stores/:slug', loadComponent: ... }`
- Reads `:slug` from route params; calls `apiService.getStorePublicPage(slug)`

**Template sections:**
```html
<!-- Header -->
<div class="store-header">
  @if (store?.logoUrl) { <img [src]="store.logoUrl" class="store-logo" /> }
  <h1>{{ store?.storeName }}</h1>
  @if (store?.location) { <p>{{ store.location }}</p> }
</div>

<!-- Upcoming Events -->
<h2>Upcoming Events</h2>
@for (event of store?.upcomingEvents ?? []; track event.id) {
  <mat-card class="event-card">
    <mat-card-title>{{ event.eventName }}</mat-card-title>
    <mat-card-subtitle>{{ event.date | date }}</mat-card-subtitle>
    <a mat-button [routerLink]="['/events', event.id]">View Event</a>
  </mat-card>
}
@if (!store?.upcomingEvents?.length) { <p>No upcoming events.</p> }

<!-- Top Players -->
<h2>Top Players</h2>
<!-- leaderboard table, same pattern as leaderboard.component -->
```

### Shareable link

On `store-detail.component.ts`, show the public URL for StoreManager:
```html
<a [href]="'/stores/' + store.slug" target="_blank">Public Page</a>
```

### Post-implementation checklist
- [ ] `/check-zone store-public-page.component.ts`

---

## Backend Unit Tests

**`StorePublicPageTests`**:
- `GetPublicPageAsync_ValidSlug_ReturnsPublicDto`
- `GetPublicPageAsync_InvalidSlug_ReturnsNull`
- `GetPublicPageAsync_IncludesOnlyRegistrationAndCompletedEvents`
- `GetPublicPageAsync_TopPlayersLimitedToTen`
- `SlugGeneration_UniqueSlugCreatedFromName`

Run with: `dotnet test --filter "FullyQualifiedName~StorePublicPageTests"`

---

## Frontend Unit Tests (Jest)

**`store-public-page.component.spec.ts`** (new file):
- Store name and logo rendered
- Upcoming events listed
- "No upcoming events" shown when empty
- Top players table rendered
- Accessible without auth (no guard applied)

Run with: `npx jest --config jest.config.js --testPathPatterns=store-public-page`

---

## Playwright E2E Tests

**File: `e2e/stores/store-public-page.spec.ts`** (new file)

New helper: `mockGetStorePublicPage(page, slug, response: StorePublicDto)`

| Describe | Tests |
|---|---|
| `Store Public Page — display` | No login; navigates to `/stores/top-deck`; store name visible; events listed |
| `Store Public Page — no events` | "No upcoming events" text visible |
| `Store Public Page — top players` | Player names visible in leaderboard section |

Run with: `/e2e e2e/stores/store-public-page.spec.ts`

---

## Verification Checklist
- [ ] Failing tests red before implementation (TDD)
- [ ] `/migrate AddSlugAndLocationToStore` — applied
- [ ] `/build` — 0 errors
- [ ] Backend unit tests pass
- [ ] Frontend Jest tests pass
- [ ] `/check-zone store-public-page.component.ts` — clean
- [ ] `/e2e e2e/stores/store-public-page.spec.ts` — all pass
