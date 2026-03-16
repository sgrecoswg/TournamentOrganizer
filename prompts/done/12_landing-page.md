# Feature: Landing Page

## Context
Users currently land on the leaderboard (`/leaderboard`) by default. This adds a proper public-facing landing page at `/` (the leaderboard remains accessible via the sidenav). The landing page is visible without login and shows upcoming events + a leaderboard preview so visitors can discover what's happening at a glance.

---

## Requirements

- `/` route renders `LandingComponent` (remove the current `redirectTo: '/leaderboard'`)
- Publicly accessible — no auth guard
- Hero section with app name and "Browse Events" CTA (`routerLink="/events"`)
- "Host a Tournament" button visible only to `StoreEmployee`/`StoreManager`/`Administrator` (links to `/events`, which shows the create form for those roles)
- **Featured Events** section: all events with `status === 'Registration'`, sorted by date ascending
- Event cards are **image-ready**: top image slot currently shows a styled placeholder div; when `EventDto.imageUrl` is added in the future the template can swap in an `<img>` with minimal changes
- **Leaderboard Preview** section: top 5 entries from `GET /api/leaderboard`; "View Full Leaderboard" link → `/leaderboard`
- Empty state text `No upcoming events` when featured list is empty
- Add "Home" nav link (first item) to the sidenav in `app.html`

---

## Backend

No changes — use existing:
- `GET /api/events` → `EventDto[]`
- `GET /api/leaderboard` → `LeaderboardEntry[]`

---

## Frontend (`tournament-client/src/app/`)

### Routing (`app.routes.ts`)
- Replace `{ path: '', redirectTo: '/leaderboard', pathMatch: 'full' }` with:
  ```typescript
  { path: '', loadComponent: () => import('./features/landing/landing.component').then(m => m.LandingComponent) }
  ```

### Navigation (`app.html`)
- Add as first `<a mat-list-item>` in the sidenav:
  ```html
  <a mat-list-item routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}">
    <mat-icon matListItemIcon>home</mat-icon>
    <span matListItemTitle>Home</span>
  </a>
  ```

### New Component (`features/landing/landing.component.ts`)
Standalone component. Uses `ApiService` directly (no feature service needed — read-only).

**Template selectors (must match tests exactly):**
- Hero heading: `<h1>Commander Tournament Organizer</h1>`
- "Browse Events" button: `routerLink="/events"`, text `Browse Events`
- "Host a Tournament" button: hidden with `@if (authService.isStoreEmployee)`, text `Host a Tournament`
- Section heading: `<h2>Find Events</h2>`
- Featured subsection heading: `<h3>Featured Events</h3>`
- Event cards: `mat-card.event-card` with `[routerLink]="['/events', evt.id]"`
- Image slot: `<div class="event-card-image">` (contains `<mat-icon>event</mat-icon>` placeholder)
- Event name: `<h4 class="event-name">`
- Empty state: `<p class="empty-state">No upcoming events</p>`
- Leaderboard section heading: `<h2>Top Players</h2>`
- Leaderboard rows: `<tr class="leaderboard-row">` — rank, name, conservativeScore
- "View Full Leaderboard" link: `routerLink="/leaderboard"`, text `View Full Leaderboard`

**Component class:**
```typescript
export class LandingComponent implements OnInit {
  events:      EventDto[]         = [];
  leaderboard: LeaderboardEntry[] = [];

  get featuredEvents(): EventDto[] {
    return this.events
      .filter(e => e.status === 'Registration')
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}
```

`ngOnInit` subscribes to both calls in parallel (use `forkJoin` or two separate subscribes). Calls `cdr.detectChanges()` in each `next:` callback.

**Card structure (image-ready):**
```html
<mat-card class="event-card" [routerLink]="['/events', evt.id]">
  <div class="event-card-image">       <!-- swap for <img> when imageUrl added -->
    <mat-icon>event</mat-icon>
  </div>
  <mat-card-content>
    <h4 class="event-name">{{ evt.name }}</h4>
    <mat-chip-set>
      <mat-chip>{{ pointLabel(evt.pointSystem) }}</mat-chip>
    </mat-chip-set>
    <div class="event-meta">
      <mat-icon>calendar_today</mat-icon> {{ evt.date | date:'mediumDate' }}
    </div>
    @if (evt.storeName) {
      <div class="event-meta"><mat-icon>location_on</mat-icon> {{ evt.storeName }}</div>
    }
    <div class="event-meta">
      <mat-icon>person</mat-icon> {{ evt.playerCount }} registered
    </div>
  </mat-card-content>
</mat-card>
```

**Leaderboard preview table:**
```html
<table>
  <tbody>
    @for (entry of leaderboard.slice(0, 5); track entry.playerId) {
      <tr class="leaderboard-row">
        <td>{{ entry.rank }}</td>
        <td><a [routerLink]="['/players', entry.playerId]">{{ entry.name }}</a></td>
        <td>{{ entry.conservativeScore | number:'1.1-1' }}</td>
      </tr>
    }
  </tbody>
</table>
<a routerLink="/leaderboard">View Full Leaderboard</a>
```

### Post-implementation checklist
- [ ] `/check-zone landing.component.ts`

---

## Frontend Unit Tests (Jest)

**File: `features/landing/landing.component.spec.ts`**

Mock both `ApiService.getAllEvents` and `ApiService.getLeaderboard`.

```typescript
const mockApi = {
  getAllEvents:  jest.fn().mockReturnValue(of([])),
  getLeaderboard: jest.fn().mockReturnValue(of([])),
};
// Provide AuthService: { isStoreEmployee: boolean }
```

Tests:
- `Find Events` heading is visible
- `Featured Events` subheading is visible
- renders a card for each Registration-status event
- InProgress events are NOT rendered in the featured list
- event card shows the event name
- event card links to `/events/:id`
- shows `No upcoming events` when featured list is empty
- `Top Players` heading is visible
- renders up to 5 leaderboard rows
- `View Full Leaderboard` link is present
- `Host a Tournament` button is visible when `isStoreEmployee = true`
- `Host a Tournament` button is NOT visible when `isStoreEmployee = false`

Run with: `npx jest --config jest.config.js --testPathPatterns=landing.component`

---

## Playwright E2E Tests

**File: `e2e/landing/landing.spec.ts`**

Helpers already in `e2e/helpers/api-mock.ts`: `mockGetEvents`, `mockGetLeaderboard`, `makeEventDto`, `makeLeaderboardEntry`, `stubUnmatchedApi`.

Auth: use `loginAs(page, 'Player')` for most tests; separate describe for `StoreEmployee` CTA visibility. Landing is public but `loginAs` injects a JWT so the toolbar renders correctly.

Describe blocks:

| Describe | Tests |
|---|---|
| `Landing — hero` | heading visible; Browse Events button visible |
| `Landing — featured events (empty)` | shows `No upcoming events` |
| `Landing — featured events (populated)` | cards render; InProgress event absent; card click → `/events/:id` |
| `Landing — leaderboard preview` | Top Players heading; 5 rows shown; View Full Leaderboard link |
| `Landing — role UI` | Host a Tournament visible for StoreEmployee; NOT visible for Player |

Run with: `/e2e e2e/landing/landing.spec.ts`

---

## Verification Checklist

- [ ] Failing Jest tests confirmed red before implementation (TDD)
- [ ] `/build` — 0 errors
- [ ] `npx jest --config jest.config.js --testPathPatterns=landing.component` — all pass
- [ ] `npx jest --config jest.config.js` — full suite green
- [ ] `/check-zone tournament-client/src/app/features/landing/landing.component.ts` — clean
- [ ] `/e2e e2e/landing/landing.spec.ts` — all pass
