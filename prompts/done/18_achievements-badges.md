# Feature: Player Achievements & Badges

> **GitHub Issue:** [#23 feat: Player Achievements & Badges](https://github.com/sgrecoswg/TournamentOrganizer/issues/23)

## Context
Players have no persistent recognition for accomplishments beyond their TrueSkill rating. Badges reward milestones (first win, tournament winner, placement games complete, etc.) and are displayed on player profiles. They are awarded automatically by the backend when the relevant event occurs.

---

## Badge Definitions

| Badge Key | Display Name | Trigger |
|---|---|---|
| `first_win` | First Win | Win a pod for the first time (1st place finish in any pod) |
| `placement_complete` | Ranked | Complete all 5 placement games (`PlacementGamesLeft` hits 0) |
| `tournament_winner` | Tournament Champion | Finish 1st overall in a completed event |
| `undefeated_swiss` | Flawless | Win every pod in a single event (all rounds, 1st place) |
| `veteran` | Veteran | Play in 10+ events |
| `centurion` | Centurion | Play 100+ games |

New badge types can be added by appending to the enum — no restructuring needed.

---

## Backend (`src/TournamentOrganizer.Api/`)

### Database / EF Core

**New `Models/PlayerBadge.cs`:**
```csharp
public class PlayerBadge
{
    public int Id { get; set; }
    public int PlayerId { get; set; }
    public Player Player { get; set; } = null!;
    public string BadgeKey { get; set; } = string.Empty;   // matches badge table above
    public DateTime AwardedAt { get; set; } = DateTime.UtcNow;
    public int? EventId { get; set; }   // event that triggered the badge, if applicable
}
```

Add `DbSet<PlayerBadge> PlayerBadges` to `AppDbContext`.
Add navigation `ICollection<PlayerBadge> Badges` to `Player`.
Run: `/migrate AddPlayerBadges`

### DTOs

**New `PlayerBadgeDto`**:
```csharp
public record PlayerBadgeDto(string BadgeKey, string DisplayName, DateTime AwardedAt, int? EventId);
```

- **`PlayerProfileDto`** — append `List<PlayerBadgeDto> Badges = []`

### Service — Badge Awarding

**New `IBadgeService` / `BadgeService`**:

```csharp
public interface IBadgeService
{
    Task CheckAndAwardAsync(int playerId, BadgeTrigger trigger, int? eventId = null);
}

public enum BadgeTrigger { GameResultRecorded, EventCompleted, PlacementComplete }
```

`BadgeService` checks existing badges (skip if already awarded) and inserts new `PlayerBadge` records.

Call `BadgeService.CheckAndAwardAsync` from:
- `TrueSkillService` / game result processing — for `first_win`, `placement_complete`, `centurion`
- `EventService.CompleteEventAsync` — for `tournament_winner`, `undefeated_swiss`, `veteran`

Register as `Scoped` in `Program.cs`.

### New endpoint

`GET /api/players/{id}/badges` — public, returns `List<PlayerBadgeDto>`

---

## Frontend (`tournament-client/src/app/`)

### Models (`core/models/api.models.ts`)

```typescript
export interface PlayerBadgeDto { badgeKey: string; displayName: string; awardedAt: string; eventId?: number | null; }
```

Add `badges?: PlayerBadgeDto[]` to `PlayerProfile`.

### Badge display helper

```typescript
// In player-profile.component.ts or a shared pipe:
badgeIcon(key: string): string {
  const icons: Record<string, string> = {
    first_win: 'emoji_events',
    placement_complete: 'military_tech',
    tournament_winner: 'workspace_premium',
    undefeated_swiss: 'stars',
    veteran: 'shield',
    centurion: '100',
  };
  return icons[key] ?? 'grade';
}
```

### `player-profile.component.ts` — Badges section

Add below the player stats:
```html
@if (profile?.badges?.length) {
  <div class="badges-section">
    <h3>Achievements</h3>
    <div class="badge-list">
      @for (badge of profile.badges; track badge.badgeKey) {
        <div class="badge-chip" [matTooltip]="badge.displayName + ' — ' + (badge.awardedAt | date)">
          <mat-icon>{{ badgeIcon(badge.badgeKey) }}</mat-icon>
          <span>{{ badge.displayName }}</span>
        </div>
      }
    </div>
  </div>
}
```

### Post-implementation checklist
- [ ] `/check-zone player-profile.component.ts`

---

## Backend Unit Tests

**`BadgeServiceTests`**:
- `CheckAndAward_FirstWin_AwardsBadge`
- `CheckAndAward_FirstWin_AlreadyHasBadge_NoDuplicate`
- `CheckAndAward_PlacementComplete_AwardsBadge`
- `CheckAndAward_TournamentWinner_AwardsBadge`
- `CheckAndAward_Veteran_10Events_AwardsBadge`
- `CheckAndAward_Veteran_9Events_DoesNotAward`
- `CheckAndAward_UndefeatedSwiss_AllPodsWon_AwardsBadge`
- `CheckAndAward_UndefeatedSwiss_OneNonWin_DoesNotAward`

Run with: `dotnet test --filter "FullyQualifiedName~BadgeServiceTests"`

---

## Frontend Unit Tests (Jest)

**`player-profile.component.spec.ts`** — add `'Badges'` describe:
- Badges section rendered when `profile.badges` is non-empty
- Badges section absent when `profile.badges` is empty or null
- Each badge chip shows display name and correct icon

Run with: `npx jest --config jest.config.js --testPathPatterns=player-profile`

---

## Playwright E2E Tests

**File: `e2e/players/player-profile.spec.ts`** — add describe blocks

New helpers in `e2e/helpers/api-mock.ts`:
```typescript
// Extend makePlayerProfileDto to accept badges: PlayerBadgeDto[]
```

| Describe | beforeEach | Tests |
|---|---|---|
| `Player Profile — Badges: display` | `loginAs('Player')`, `mockGetPlayerProfile({ badges: [{ badgeKey: 'first_win', displayName: 'First Win', awardedAt: '2026-01-01' }] })` | "Achievements" heading visible; "First Win" badge chip shown |
| `Player Profile — Badges: multiple badges` | profile with 3 badges | all 3 badge chips rendered |
| `Player Profile — Badges: no badges` | `mockGetPlayerProfile({ badges: [] })` | "Achievements" section NOT visible |
| `Player Profile — Badges: tooltip` | hover over badge chip | tooltip shows badge name and awarded date |

Run with: `/e2e e2e/players/player-profile.spec.ts`

---

## Verification Checklist
- [ ] Failing tests red before implementation (TDD)
- [ ] `/migrate AddPlayerBadges` — applied
- [ ] `/build` — 0 errors
- [ ] `dotnet test --filter "FullyQualifiedName~BadgeServiceTests"` — all pass
- [ ] Frontend Jest tests pass
- [ ] `/check-zone player-profile.component.ts` — clean
- [ ] `/e2e e2e/players/player-profile.spec.ts` — all pass
