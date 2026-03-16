# Feature: 5-1-0 Point System (FiveOneZero)

Introduce a new point system selectable when creating an event.

- Winner gets 5 points
- Losers each get 1 point
- Draw — all players get 0 points
- 5-player pod: if the player in **seat 5** wins, they receive **10 points** instead of 5
- 3-player pod: if the player in **seat 3** wins, they receive **10 points** instead of 5

## Context

The existing ScoreBased (4/3/2/1) and WinBased (5/0, draw=1) systems do not reward players for winning from a positionally disadvantaged seat. FiveOneZero adds a seat-based win bonus for the last seat in non-standard pods (3 or 5 players), giving those players a meaningful incentive to win despite their turn-order disadvantage.

---

## Requirements

- New `PointSystem` enum value `FiveOneZero` in `Models/Event.cs`
- Scoring: winner = 5 pts, each non-winner = 1 pt, draw = 0 pts
- Seat bonus: if winner's `SeatOrder` == pod player count AND that count is 3 or 5 → award 10 pts instead of 5
- Seat bonus does **not** apply to draws
- Selectable in the event creation form (Angular dropdown)
- No database migration required (enum stored as int; new value appends)

---

## Backend (`src/TournamentOrganizer.Api/`)

### Models / Entities (`Models/`)
- `Event.cs` — added `FiveOneZero` to `PointSystem` enum

### Service (`Services/`)
- `EventService.CalculatePoints` — extended signature with `seatOrder = 1` and `podSize = 4` default params; added `FiveOneZero` branch
- `EventService.GetStandingsAsync` call site — now passes `SeatOrder` from `pod.PodPlayers` and `podSize` for each game result

### Repository (`Repositories/`)
- `EventRepository.GetWithDetailsAsync` — added `.Include(... p.PodPlayers)` so seat data is available during standings calculation

---

## Frontend (`tournament-client/src/app/`)

### Models (`core/models/api.models.ts`)
- Added `'FiveOneZero'` to the `PointSystem` union type
- Added `FiveOneZero: '5-1-0 (Win=5, Loss=1, Draw=0; seat bonus +10)'` to `POINT_SYSTEM_LABELS`

### Components
- **`features/events/event-list.component.ts`** — added `FiveOneZero` option to `pointSystemOptions` array

---

## Backend Unit Tests (`src/TournamentOrganizer.Tests/`)

**Test class: `StandingsCalculationTests`**

- `FiveOneZero_Winner_StandardPod_Gets5Points`
- `FiveOneZero_NonWinner_Gets1Point` (positions 2, 3, 4)
- `FiveOneZero_Draw_Gets0Points` (positions 1–4)
- `FiveOneZero_Winner_Seat5_In5PlayerPod_Gets10Points`
- `FiveOneZero_Winner_NotSeat5_In5PlayerPod_Gets5Points` (seats 1–4)
- `FiveOneZero_Winner_Seat3_In3PlayerPod_Gets10Points`
- `FiveOneZero_Winner_NotSeat3_In3PlayerPod_Gets5Points` (seats 1–2)
- `FiveOneZero_Seat5_Wins_Draw_Gets0Points`

Run with: `dotnet test --filter "FullyQualifiedName~StandingsCalculationTests"`

---

## Verification Checklist

- [x] `dotnet test --filter "FullyQualifiedName~StandingsCalculationTests"` — all pass
- [x] `npx jest --config jest.config.js --testPathPatterns=event-list` — all pass
- [x] No migration required
