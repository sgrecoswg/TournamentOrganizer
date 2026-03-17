# Feature: Scryfall Card Autocomplete

## Context
Card name inputs (commander declaration, wishlist, for-trade list) are free-text today, so players
regularly misspell names. Scryfall's public REST API exposes a `/cards/autocomplete` endpoint with
CORS enabled — we can call it directly from the browser with no backend changes and surface
real-time suggestions wherever a card name is entered.

---

## Requirements

- Typing 2 or more characters into any card name input shows a dropdown of matching card names
  sourced from `https://api.scryfall.com/cards/autocomplete?q={query}`.
- Requests are **debounced** (300 ms) and deduplicated (`distinctUntilChanged`) so each keystroke
  does not fire a network request.
- Selecting a suggestion fills the input with the exact card name from Scryfall.
- Queries shorter than 2 characters show no suggestions (no request is made).
- Network errors are swallowed silently — the input still works as a plain text field.
- The four integration points are:
  1. **Commander input** — registration form in `event-detail` (`commandersInput`)
  2. **Inline commander edit** — in-table edit in `event-detail` (`editCommanderValue`)
  3. **Wishlist add** — `newWishlistCard` in `player-profile`
  4. **For-Trade add** — `newTradeCard` in `player-profile`

---

## Backend (`src/TournamentOrganizer.Api/`)

**None.** Scryfall is called directly from the Angular frontend.

---

## Frontend (`tournament-client/src/app/`)

### New Service (`core/services/scryfall.service.ts`)

A thin wrapper around Angular's `HttpClient` — no state, no caching beyond what debounce gives.

```typescript
@Injectable({ providedIn: 'root' })
export class ScryfallService {
  private readonly BASE = 'https://api.scryfall.com/cards/autocomplete';

  constructor(private http: HttpClient) {}

  getSuggestions(query: string): Observable<string[]> {
    if (!query || query.length < 2) return of([]);
    return this.http.get<{ data: string[] }>(this.BASE, { params: { q: query } }).pipe(
      map(r => r.data),
      catchError(() => of([])),
    );
  }
}
```

### Modified: `event-detail.component.ts`

**Commander registration input** (line ~156 in template, `commandersInput` field)

Add a `Subject<string>` wired to `(ngModelChange)`, pipe it through `debounceTime(300) |
distinctUntilChanged() | switchMap(q => scryfallService.getSuggestions(q))`, store results in
`commanderSuggestions: string[]`. Replace the plain `<input>` with a `mat-autocomplete`-backed
input:

```html
<mat-form-field>
  <mat-label>Commander(s) (optional)</mat-label>
  <input matInput
         [(ngModel)]="commandersInput"
         [matAutocomplete]="commanderRegAuto"
         (ngModelChange)="onCommanderInputChange($event)"
         placeholder="e.g. Atraxa, Praetors' Voice">
  <mat-autocomplete #commanderRegAuto="matAutocomplete">
    @for (s of commanderSuggestions; track s) {
      <mat-option [value]="s">{{ s }}</mat-option>
    }
  </mat-autocomplete>
</mat-form-field>
```

**Inline commander edit** (`editCommanderValue`, inside the players table)

The existing `<input matInput [(ngModel)]="editCommanderValue" ...>` is inside a
`.commander-edit` div (not a `mat-form-field`). Wrap it in a `mat-form-field` or connect the
autocomplete panel directly — whichever keeps the table row compact. Use the same
`commanderSuggestions` array (shared) since only one row is in edit mode at a time.

**Imports / constructor** — add `MatAutocompleteModule` to `imports`, inject `ScryfallService`.

**New fields:**
```typescript
commanderSuggestions: string[] = [];
private commanderQuery$ = new Subject<string>();
```

**ngOnInit addition:**
```typescript
this.commanderQuery$.pipe(
  debounceTime(300),
  distinctUntilChanged(),
  switchMap(q => this.scryfallService.getSuggestions(q)),
).subscribe(suggestions => {
  this.commanderSuggestions = suggestions;
  this.cdr.detectChanges();
});
```

**New handler:** `onCommanderInputChange(q: string)` → `this.commanderQuery$.next(q)`. Also wire
the inline edit field to the same subject via `(ngModelChange)="commanderQuery$.next($event)"`.

### Modified: `player-profile.component.ts`

**Wishlist input** (`newWishlistCard`) and **Trade input** (`newTradeCard`) — two separate
`Subject<string>` pipelines so suggestions don't bleed across tabs.

Add `MatAutocompleteModule` to `imports`, inject `ScryfallService`.

**New fields:**
```typescript
wishlistSuggestions: string[] = [];
tradeSuggestions:    string[] = [];
private wishlistQuery$ = new Subject<string>();
private tradeQuery$    = new Subject<string>();
```

**ngOnInit additions (two pipelines):**
```typescript
this.wishlistQuery$.pipe(debounceTime(300), distinctUntilChanged(),
  switchMap(q => this.scryfallService.getSuggestions(q)),
).subscribe(s => { this.wishlistSuggestions = s; this.cdr.detectChanges(); });

this.tradeQuery$.pipe(debounceTime(300), distinctUntilChanged(),
  switchMap(q => this.scryfallService.getSuggestions(q)),
).subscribe(s => { this.tradeSuggestions = s; this.cdr.detectChanges(); });
```

**Wishlist input template change** (was plain input on line ~215):
```html
<mat-form-field>
  <mat-label>Card Name</mat-label>
  <input matInput
         [(ngModel)]="newWishlistCard"
         [matAutocomplete]="wishlistAuto"
         (ngModelChange)="wishlistQuery$.next($event)"
         (keydown.enter)="addToWishlist()"
         placeholder="e.g. Lightning Bolt">
  <mat-autocomplete #wishlistAuto="matAutocomplete">
    @for (s of wishlistSuggestions; track s) {
      <mat-option [value]="s">{{ s }}</mat-option>
    }
  </mat-autocomplete>
</mat-form-field>
```

**For-Trade input template change** (was plain input on line ~299) — same pattern with
`#tradeAuto`, `tradeSuggestions`, `tradeQuery$`.

---

## Backend Unit Tests

None required for this feature.

---

## Frontend Unit Tests (Jest)

**`core/services/scryfall.service.spec.ts`** *(new)*

- `getSuggestions('')` returns `[]` without making an HTTP request
- `getSuggestions('li')` (< 2 chars: 'l') returns `[]` without HTTP — test with exactly `'l'`
- `getSuggestions('lig')` calls `GET /cards/autocomplete?q=lig` and maps `.data` to the result
- HTTP error → returns `[]` (does not throw)

Use `HttpClientTestingModule` and `HttpTestingController`.

Run with:
```
npx jest --config jest.config.js --testPathPatterns=scryfall.service
```

**`features/events/event-detail.component.spec.ts`** *(extend existing)*

Add a `describe('Commander autocomplete')` block:
- `ScryfallService.getSuggestions` is mocked to return `of(['Atraxa, Praetors\' Voice'])`
- After `onCommanderInputChange('atr')`, `commanderSuggestions` contains the mocked result
- After `onCommanderInputChange('a')` (< 2 chars), `commanderSuggestions` is empty

**`features/player-profile/player-profile.component.spec.ts`** *(extend existing)*

Add a `describe('Card name autocomplete')` block:
- `wishlistQuery$.next('sol')` → `wishlistSuggestions` populated from mocked service
- `tradeQuery$.next('sol')` → `tradeSuggestions` populated from mocked service
- Short query → no suggestions (service mock returns `[]` for < 2 chars)

---

## Frontend E2E Tests (Playwright)

**File: `e2e/player-profile/card-autocomplete.spec.ts`** *(new)*

Helpers needed in `e2e/helpers/api-mock.ts`:
- `mockScryfallAutocomplete(page, query, suggestions)` — intercepts
  `GET https://api.scryfall.com/cards/autocomplete*` and returns
  `{ object: 'catalog', data: suggestions }`.

Describe blocks:

| Describe | Tests |
|---|---|
| `Scryfall autocomplete — wishlist` | typing "sol" shows "Sol Ring" option; selecting it fills the input; typing 1 char shows no dropdown |
| `Scryfall autocomplete — trade` | same coverage for the For-Trade input |
| `Scryfall autocomplete — Scryfall unavailable` | mock returns network error; user can still type and submit manually |

Run with: `/e2e e2e/player-profile/card-autocomplete.spec.ts`
**All tests must pass before the task is considered done.**

---

## Post-implementation checklist

- [ ] `/check-zone` on `event-detail.component.ts` and `player-profile.component.ts`
- [ ] `/build` — 0 errors on both .NET and Angular
- [ ] `npx jest --config jest.config.js --testPathPatterns=scryfall.service` — all pass
- [ ] `npx jest --config jest.config.js --testPathPatterns=event-detail.component` — all pass
- [ ] `npx jest --config jest.config.js --testPathPatterns=player-profile.component` — all pass
- [ ] `/e2e e2e/player-profile/card-autocomplete.spec.ts` — all pass
