# Feature: Discord Webhook Integration

## Context
Most local game store communities live on Discord. Automatically posting tournament results — round completions, final standings, new leaderboard leaders — to a store's Discord channel keeps the community engaged without any manual work from the TO.

---

## Requirements

- Each store can configure one Discord webhook URL (set by StoreManager/Admin)
- **Trigger events that post to Discord:**
  - Round completed → post pod results for that round
  - Event completed → post final standings (top 4) and winner
  - New player reaches ranked status → post congratulations
- Webhook URL stored on `Store`; posting is fire-and-forget (failures logged, not surfaced to user)
- Discord message format: rich embed with event name, store name, results list
- Webhook URL is write-only in the UI (can be set/cleared; never returned in API responses to prevent leakage)

---

## Backend (`src/TournamentOrganizer.Api/`)

### Database / EF Core

**Modify `Models/Store.cs`** — add:
```csharp
public string? DiscordWebhookUrl { get; set; }
```
Run: `/migrate AddDiscordWebhookUrlToStore`

### DTOs

- **`StoreDto`** — do NOT include `DiscordWebhookUrl` (security: treat as write-only)
- **`UpdateStoreDto`** — add `string? DiscordWebhookUrl` (null = no change; empty string = clear)
- **`StoreDetailDto`** — add `bool HasDiscordWebhook` (derived: `DiscordWebhookUrl != null`)

### Service — `IDiscordWebhookService` (new)

```csharp
public interface IDiscordWebhookService
{
    Task PostRoundResultsAsync(int eventId, int roundNumber);
    Task PostEventCompletedAsync(int eventId);
    Task PostPlayerRankedAsync(int playerId, int eventId);
}
```

**Implementation:**
- Fetch store's `DiscordWebhookUrl`; return immediately if null
- Build Discord embed payload:
```csharp
var payload = new {
    embeds = new[] {
        new {
            title = $"Round {roundNumber} Results — {eventName}",
            color = 5793266,  // blue
            description = resultsSummary,
            footer = new { text = storeName }
        }
    }
};
```
- POST to webhook URL using `IHttpClientFactory`; log any non-2xx but do not throw
- Register as `Scoped` in `Program.cs`

**Call from:**
- `EventService.CompleteRoundAsync` → `PostRoundResultsAsync`
- `EventService.CompleteEventAsync` → `PostEventCompletedAsync`
- `TrueSkillService` or `PlayerService` when `PlacementGamesLeft` hits 0 → `PostPlayerRankedAsync`

### Controller (`Controllers/StoresController.cs`)

**Modify `Update` action** to accept and save `DiscordWebhookUrl` from `UpdateStoreDto`. Do not return it in the response.

Add to `StoreDetailDto` mapping: `HasDiscordWebhook = store.DiscordWebhookUrl != null`.

### API Service (`core/services/api.service.ts`)

No new endpoint — webhook URL is set via the existing store update. The `hasDiscordWebhook` field in `StoreDetailDto` lets the UI show a "connected" indicator without exposing the URL.

---

## Frontend (`tournament-client/src/app/`)

### Models (`core/models/api.models.ts`)

- `StoreDetailDto`: add `hasDiscordWebhook?: boolean`
- `UpdateStoreDto`: add `discordWebhookUrl?: string | null`

### `store-detail.component.ts` — Settings tab (StoreManager)

Add Discord integration row:
```html
<mat-form-field>
  <mat-label>Discord Webhook URL</mat-label>
  <input matInput
         type="password"
         placeholder="https://discord.com/api/webhooks/..."
         [(ngModel)]="editDiscordWebhookUrl"
         autocomplete="off" />
  <mat-hint>
    @if (store?.hasDiscordWebhook) {
      <mat-icon color="primary">check_circle</mat-icon> Connected
    } @else {
      Not connected
    }
  </mat-hint>
</mat-form-field>
```

- Input is type `"password"` so the value is masked — consistent with write-only intent
- Pre-populated with empty string (URL not returned from server)
- Saving the settings form includes `discordWebhookUrl: this.editDiscordWebhookUrl || null`
- "Test Webhook" button (optional): `POST /api/stores/{id}/discord/test` — sends a test message

### Optional: Test endpoint

```csharp
[HttpPost("{id}/discord/test")]
[Authorize(Policy = "StoreManager")]
public async Task<IActionResult> TestDiscordWebhook(int id)
{
    if (!await UserOwnsStore(id)) return Forbid();
    await _discordService.PostTestMessageAsync(id);
    return NoContent();
}
```

### Post-implementation checklist
- [ ] `/check-zone store-detail.component.ts`

---

## Backend Unit Tests

**`DiscordWebhookServiceTests`**:
- `PostRoundResultsAsync_NoWebhookConfigured_DoesNothing`
- `PostRoundResultsAsync_WebhookConfigured_PostsToUrl`
- `PostRoundResultsAsync_WebhookFails_DoesNotThrow` (fire-and-forget resilience)
- `PostEventCompletedAsync_FormatsStandingsCorrectly`
- `PostPlayerRankedAsync_FormatsPlayerNameCorrectly`

Use `IHttpClientFactory` with a mock `HttpMessageHandler` in tests.

Run with: `dotnet test --filter "FullyQualifiedName~DiscordWebhookServiceTests"`

---

## Frontend Unit Tests (Jest)

**`store-detail.component.spec.ts`** — add `'Discord Webhook'` describe:
- Discord URL input visible for StoreManager
- `hasDiscordWebhook: true` → "Connected" indicator shown
- `hasDiscordWebhook: false` → "Not connected" shown
- Saving form with webhook URL passes it in `UpdateStoreDto`

Run with: `npx jest --config jest.config.js --testPathPatterns=store-detail`

---

## Playwright E2E Tests

**File: `e2e/stores/store-detail.spec.ts`** — add describe blocks

New helpers in `e2e/helpers/api-mock.ts`:
```typescript
mockTestDiscordWebhook(page, storeId)  // POST /api/stores/:id/discord/test → 204
// Extend makeStoreDetailDto to accept hasDiscordWebhook: boolean
```

| Describe | beforeEach | Tests |
|---|---|---|
| `Store Detail — Discord: connected` | `loginAs('StoreManager', { storeId: 1 })`, `mockGetStore({ hasDiscordWebhook: true })` | Discord URL input visible; "Connected" indicator with checkmark shown |
| `Store Detail — Discord: not connected` | `mockGetStore({ hasDiscordWebhook: false })` | "Not connected" text shown; no checkmark |
| `Store Detail — Discord: URL masked` | same | Discord webhook input has `type="password"` (value not visible in plain text) |
| `Store Detail — Discord: save webhook` | `mockUpdateStore` | entering URL in input and saving the form includes `discordWebhookUrl` in request payload |
| `Store Detail — Discord: test button` | `mockTestDiscordWebhook`, `hasDiscordWebhook: true` | "Test Webhook" button visible when connected; clicking fires `POST .../discord/test`; success snackbar shown |
| `Store Detail — Discord: hidden for Player` | `loginAs('Player')` | Discord section NOT visible |

Run with: `/e2e e2e/stores/store-detail.spec.ts`

---

## Verification Checklist
- [ ] Failing tests red before implementation (TDD)
- [ ] `/migrate AddDiscordWebhookUrlToStore` — applied
- [ ] `IHttpClientFactory` registered in `Program.cs` (`builder.Services.AddHttpClient()`)
- [ ] `/build` — 0 errors
- [ ] `dotnet test --filter "FullyQualifiedName~DiscordWebhookServiceTests"` — all pass
- [ ] Frontend Jest tests pass
- [ ] `/check-zone store-detail.component.ts` — clean
- [ ] `/e2e e2e/stores/store-detail.spec.ts` — all pass
