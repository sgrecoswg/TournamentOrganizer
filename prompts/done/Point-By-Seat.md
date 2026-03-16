# Feature: Seat-Based Point System (SeatBased)

Introduce a new point system selectable when creating an event. Points are awarded only to the winner, and the amount depends on which seat they occupied.

- Normal 4-player pod:
  - Seat 1 wins → 7 points
  - Seat 2 wins → 8 points
  - Seat 3 wins → 9 points
  - Seat 4 wins → 10 points
- Non-winners and draws → 0 points
- 5-player pod: if **seat 5** wins → 10 points (seats 1–4 follow normal rules)
- 3-player pod: if **seat 3** wins → 10 points (seats 1–2 follow normal rules)

## Context

Later seats in a Commander pod act after more players have had turns, creating a positional disadvantage. SeatBased rewards winning from harder seats more generously (seat 1 = 7 pts up to seat 4 = 10 pts), making the point value proportional to the difficulty of winning from that position. The "last seat" in non-standard pods (3 or 5 players) is treated as equivalent to seat 4, earning the same maximum of 10 points.

---

## Requirements

- New `PointSystem` enum value `SeatBased` in `Models/Event.cs`
- Scoring formula for winner: `6 + seatOrder` (seat1=7, seat2=8, seat3=9, seat4=10)
- Special cases: seat 5 in a 5-player pod → 10 pts; seat 3 in a 3-player pod → 10 pts
- Non-winners always get 0 points; draws always give all players 0 points
- Selectable in the event creation form (Angular dropdown)
- No database migration required (enum stored as int; new value appends)
- Reuses `seatOrder` and `podSize` params added to `CalculatePoints` by FiveOneZero

---

## Backend (`src/TournamentOrganizer.Api/`)

### Models / Entities (`Models/`)
- `Event.cs` — added `SeatBased` to `PointSystem` enum

### Service (`Services/`)
- `EventService.CalculatePoints` — added `SeatBased` branch using `6 + seatOrder` formula with last-seat bonus override

*(No repository changes required — `PodPlayers` include was already added for FiveOneZero.)*

---

## Frontend (`tournament-client/src/app/`)

### Models (`core/models/api.models.ts`)
- Added `'SeatBased'` to the `PointSystem` union type
- Added `SeatBased: 'Seat-Based (Win earns seat pts: seat1=7…seat4=10)'` to `POINT_SYSTEM_LABELS`

### Components
- **`features/events/event-list.component.ts`** — added `SeatBased` option to `pointSystemOptions` array

---

## Backend Unit Tests (`src/TournamentOrganizer.Tests/`)

**Test class: `StandingsCalculationTests`**

- `SeatBased_Winner_StandardPod_PointsBySeat` (seats 1–4 → 7, 8, 9, 10)
- `SeatBased_NonWinner_Gets0Points` (positions 2, 3, 4)
- `SeatBased_Draw_Gets0Points` (positions 1–4)
- `SeatBased_Winner_Seat5_In5PlayerPod_Gets10Points`
- `SeatBased_Winner_Seats1to4_In5PlayerPod_FollowNormalRules` (seats 1–4 → 7, 8, 9, 10)
- `SeatBased_Winner_Seat3_In3PlayerPod_Gets10Points`
- `SeatBased_Winner_Seats1to2_In3PlayerPod_FollowNormalRules` (seats 1–2 → 7, 8)

Run with: `dotnet test --filter "FullyQualifiedName~StandingsCalculationTests"`

---

## Verification Checklist

- [x] `dotnet test --filter "FullyQualifiedName~StandingsCalculationTests"` — all pass
- [x] `npx jest --config jest.config.js --testPathPatterns=event-list` — all pass
- [x] No migration required
