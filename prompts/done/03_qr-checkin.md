# Feature: QR Code Check-In

## Context
For large events, having a store employee manually check in each player creates a bottleneck. A per-event QR code lets players scan and self-check-in on their own phone — no employee interaction required. The QR code is displayed on the event detail page and can be printed.

**Dependency:** `event-check-in.md` must be implemented first (provides `IsCheckedIn` on `EventRegistration`).

---

## Requirements

- Each event has a unique check-in token (UUID, generated on event creation)
- QR code encodes a URL: `/checkin/{token}`
- Navigating to `/checkin/{token}` while logged in checks the player into that event
- If not logged in: redirect to login, then return to the check-in URL
- Check-in only succeeds when event status is `Registration`
- StoreEmployee sees the QR code displayed on the event detail page with a "Print" button
- Token is not guessable — do not expose the eventId directly in the QR URL

---

## Backend (`src/TournamentOrganizer.Api/`)

### Database / EF Core

**Modify `Models/Event.cs`** — add:
```csharp
public string CheckInToken { get; set; } = Guid.NewGuid().ToString("N");
```
Run: `/migrate AddCheckInTokenToEvent`

Backfill: in `Up()`, set existing rows to a new Guid each:
```sql
UPDATE Events SET CheckInToken = LOWER(CONVERT(NVARCHAR(32), NEWID(), 2)) WHERE CheckInToken IS NULL OR CheckInToken = '';
```

### DTOs

- **`EventDto`** — append `string? CheckInToken = null` (only populated for StoreEmployee+; hide from public)

### Service (`Services/EventService.cs`)

**`CheckInByTokenAsync(string token, string playerEmail)`**
- Find event by `CheckInToken`; 404 if not found
- Validate event status is `Registration`; return 400 if not
- Find `EventRegistration` where player email matches; 404 if not registered
- Set `IsCheckedIn = true`; persist
- Return `EventPlayerDto`

### Controller (`Controllers/EventsController.cs`)

```csharp
[HttpPost("checkin/{token}")]
[Authorize]
public async Task<ActionResult<EventPlayerDto>> CheckInByToken(string token)
{
    var email = User.FindFirstValue(ClaimTypes.Email)
              ?? User.FindFirstValue("email");
    if (string.IsNullOrEmpty(email)) return Unauthorized();
    return Ok(await _eventService.CheckInByTokenAsync(token, email));
}
```

### API Service (`core/services/api.service.ts`)

```typescript
checkInByToken(token: string): Observable<EventPlayerDto> {
  return this.http.post<EventPlayerDto>(`${this.base}/events/checkin/${token}`, {});
}
```

---

## Frontend (`tournament-client/src/app/`)

### QR Code library

```bash
npm install qrcode
npm install --save-dev @types/qrcode
```

### `event-detail.component.ts` — QR code section

Visible to StoreEmployee when event status is `Registration`:

```typescript
qrCodeDataUrl: string | null = null;

async generateQrCode(token: string): Promise<void> {
  const url = `${window.location.origin}/checkin/${token}`;
  this.qrCodeDataUrl = await QRCode.toDataURL(url, { width: 256 });
  this.cdr.detectChanges();
}
```

Call in `ngOnInit` after event loads (if `isStoreEmployee` and token present).

**Template:**
```html
@if (authService.isStoreEmployee && event?.status === 'Registration' && qrCodeDataUrl) {
  <mat-card class="qr-card">
    <mat-card-title>Player Check-In QR Code</mat-card-title>
    <img [src]="qrCodeDataUrl" alt="Check-in QR Code" class="qr-image" />
    <button mat-stroked-button (click)="printQrCode()">Print</button>
  </mat-card>
}
```

`printQrCode()`: opens a print window with just the QR image and event name.

### New component: `features/events/qr-checkin.component.ts`

Route: `{ path: 'checkin/:token', loadComponent: ... }` — no auth guard (redirect handled by the component).

**On init:**
- If not logged in: store return URL in sessionStorage; navigate to `/login`
- If logged in: call `apiService.checkInByToken(token)`
- Show success: "You're checked in for [Event Name]!" with a link to the event
- Show error: "Already checked in" / "Registration is closed" / "Not registered for this event"

**Template selectors:**
- Success message: `.checkin-success`
- Error message: `.checkin-error`

### Post-implementation checklist
- [ ] `/check-zone event-detail.component.ts`
- [ ] `/check-zone qr-checkin.component.ts`

---

## Backend Unit Tests

**`QrCheckInTests`**:
- `CheckInByTokenAsync_ValidToken_ChecksInPlayer`
- `CheckInByTokenAsync_InvalidToken_ThrowsKeyNotFoundException`
- `CheckInByTokenAsync_EventNotInRegistration_ThrowsInvalidOperationException`
- `CheckInByTokenAsync_PlayerNotRegistered_ThrowsKeyNotFoundException`
- `CheckInByTokenAsync_AlreadyCheckedIn_StillSucceeds` (idempotent)

Run with: `dotnet test --filter "FullyQualifiedName~QrCheckInTests"`

---

## Frontend Unit Tests (Jest)

**`qr-checkin.component.spec.ts`** (new file):
- Calls `apiService.checkInByToken` on init when logged in
- Success message rendered on success
- Error message rendered on 400/404 response
- Redirects to login page when not authenticated

**`event-detail.component.spec.ts`** — add:
- QR code image rendered for StoreEmployee when status is Registration
- QR code hidden when status is not Registration

Run with: `npx jest --config jest.config.js --testPathPatterns="qr-checkin|event-detail"`

---

## Playwright E2E Tests

**File: `e2e/events/qr-checkin.spec.ts`** (new file)

New helper: `mockCheckInByToken(page, token, response: EventPlayerDto | errorStatus)`

| Describe | Tests |
|---|---|
| `QR Check-In — success` | `loginAs('Player')`, mock returns success → success message visible |
| `QR Check-In — not registered` | mock returns 404 → error message visible |
| `QR Check-In — event closed` | mock returns 400 → error message visible |
| `QR Check-In — QR displayed (StoreEmployee)` | `loginAs('StoreEmployee')`, event in Registration → QR image present on event detail |

Run with: `/e2e e2e/events/qr-checkin.spec.ts`

---

## Verification Checklist
- [ ] `event-check-in.md` fully implemented
- [ ] Failing tests red before implementation (TDD)
- [ ] `/migrate AddCheckInTokenToEvent` — applied
- [ ] `npm install qrcode` — done
- [ ] `/build` — 0 errors
- [ ] `dotnet test --filter "FullyQualifiedName~QrCheckInTests"` — all pass
- [ ] Frontend Jest tests pass
- [ ] `/check-zone event-detail.component.ts` — clean
- [ ] `/check-zone qr-checkin.component.ts` — clean
- [ ] `/e2e e2e/events/qr-checkin.spec.ts` — all pass

---
## Prompt Refinement Suggestions

### Token Efficiency
- **Dependency already satisfied** — `event-check-in.md` is implemented (`IsCheckedIn` exists on `EventRegistration` and `EventDto`). Remove the dependency check from the verification checklist; no time needed there.
- **`CheckInToken` visibility is ambiguous** — the prompt says "only populated for StoreEmployee+; hide from public" but `GET /api/events/{id}` is a public endpoint with no role check. Clarify: should the service/controller conditionally omit the token (requires auth check in controller), or is it acceptable to include it in the public response since the token itself is the secret? The simpler approach is to include it always — the UUID is unguessable regardless.
- **Success message gap** — the `qr-checkin.component.ts` success message says "You're checked in for [Event Name]!" but `EventPlayerDto` (the API response) does not contain the event name. Either the API needs to return it or the component needs a second call to `GET /api/events/{id}`. Pre-decide which approach to use.
- **`printQrCode()` scope** — "opens a print window with just the QR image and event name" is vague enough to require a design decision mid-implementation. Recommend using `window.print()` with a temporary hidden `<div>` injected into `document.body`, or a `data:` URL in a new tab.

### Anticipated Questions (pre-answer these to skip back-and-forth)
- Q: Should `CheckInToken` be hidden from public `GET /api/events/{id}` responses? → **Suggested answer:** No — include it always. The UUID is the security; no role check needed server-side.
- Q: What does the success page show if `EventPlayerDto` has no event name? → **Suggested answer:** Make a second `GET /api/events/{id}` call from the check-in component using the event ID returned from a new `CheckInResponseDto` that includes `EventId` and `EventName`, OR change the API to return a richer response.
- Q: Does `printQrCode()` use `window.print()` or open a new tab? → **Suggested answer:** Use `window.print()` with a dynamically injected print-only `<div>`, removed after print.
- Q: Should the QR check-in component use `authGuard`? → **Suggested answer:** No — the prompt explicitly says no auth guard; the component handles the redirect itself (storing return URL in `sessionStorage['auth_return_url']` which the existing `OAuthCallbackComponent` already reads).
- Q: Is `CheckInByTokenAsync` idempotent (checking in an already-checked-in player should succeed)? → **Suggested answer:** Yes — `CheckInByTokenAsync_AlreadyCheckedIn_StillSucceeds` test confirms this.

### Missing Context
- The API response type for `checkInByToken` is `EventPlayerDto`, which lacks event name/id — the success message requirement ("for [Event Name]") cannot be met with this response alone. Decide on the response shape before implementing.
- `printQrCode()` implementation is unspecified — needs a concrete approach (window.print / new tab / canvas) to avoid a mid-task decision.
- No mention of whether `CheckInToken` should be regenerated when an event is reset or re-opened — safe to assume it is immutable once created.
---
