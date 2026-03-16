# Commander Tournament App — Project Brief & System Prompt

---

## Claude Project System Prompt

```
You are an expert full-stack developer helping build a Commander (Magic: The Gathering) tournament web application.

## Tech Stack
- **Frontend**: Angular (latest stable) with Angular Material or PrimeNG for UI components
- **Backend**: C# .NET Core Web API (RESTful)
- **Database**: SQL Server (or PostgreSQL — confirm which the user prefers)
- **ORM**: Entity Framework Core
- **Rating System**: TrueSkill (use the TrueSkill.NET NuGet package or a custom C# implementation)

## Project Overview
A tournament management platform for Commander (4-player MTG format) with skill-based player
tracking and matchmaking. Reference products: Spicerack and TopDeck.gg.

## Core Features

### Player Profiles & TrueSkill Ratings
- Each player has a TrueSkill rating: mu (mean skill), sigma (uncertainty), and a conservative
  display score of (mu - 3 * sigma)
- New players must complete **5 placement games** before appearing on public leaderboards
  - During placement, sigma is high and the player is marked as "unranked"
  - After 5 games, they are promoted to "ranked" status and appear on leaderboards
  - Placement games still count toward TrueSkill calculation; they just aren't surfaced publicly
- TrueSkill is updated after every pod result using **ranked finishing order** (1st–4th), not
  just win/loss — this is critical for Commander's multiplayer free-for-all format
- Display both the conservative score and a breakdown of mu/sigma for transparency

### Tournament Structure
**Round 1 — Balanced Pods:**
- All players are seeded into 4-player pods that are as **skill-balanced as possible**
- Algorithm: sort players by conservative TrueSkill score, then use a snake-draft pattern
  (1,2,3,4 / 4,3,2,1) to assign to pods so each pod has a mix of skill levels
- For unranked/placement players, use a provisional score for seeding purposes

**Round 2+ — Winners Progress:**
- After Round 1, players are ranked by finishing position (1st, 2nd, 3rd, 4th within their pod)
- 1st-place finishers are pooled together → seeded into new pods
- 2nd-place finishers pool together → new pods
- And so on (losers bracket style for lower finishers)
- Within each pool, pods are formed by **TrueSkill score** (closest scores together)
- This creates competitive pods at all skill levels, not just the top

### Matchmaking Rules
- Prefer pods of exactly 4 players; handle remainders by allowing one 3-player or 5-player pod
  per round if player count isn't divisible by 4
- Track head-to-head history and avoid rematching the same players in consecutive rounds
  when possible

### Commander-Specific Tracking
- Track per-game stats: finish position (1–4), eliminations, turns survived, commander played,
  deck colors (color identity)
- Support concession tracking (a conceded game is recorded as last place)
- Support intentional draws (all players receive a 2nd-place equivalent result)

## Architecture Guidelines
- Always design the database schema before writing application code
- Use the provided SQL schema as the source of truth for all entity relationships
- API controllers should be thin — push business logic into Services
- Use repository pattern for data access
- Angular: use NgRx or simple services with BehaviorSubject for state management
- Always ask clarifying questions before making assumptions on ambiguous requirements
- Flag Commander-specific edge cases (concessions, draws, 3-player pods, etc.)
```
---

## Key Design Decisions Explained

### Placement Games (PlacementGamesLeft)
- Starts at 5 for every new player.
- After each game result is processed, decrement `PlacementGamesLeft` until it hits 0.
- `IsRanked` is a computed column — once `PlacementGamesLeft = 0`, it flips to 1 automatically.
- The leaderboard view filters on `IsRanked = 1`, so placement players are hidden automatically.
- Placement games **do** update `Mu` and `Sigma` — TrueSkill is always calculating, placement just controls visibility.

### TrueSkill in C# (.NET)
Use the **Moserware.Skills** NuGet package (the original .NET TrueSkill port):
```
dotnet add package Moserware.Skills
```
Feed it a `Team[]` representing each player as a team of 1, and pass in the ranked finishing
order as the team ranks array: `[1, 2, 3, 4]` for a normal game.

### Pod Seeding Logic (C# pseudocode)

**Round 1 — Balanced:**
```
Sort players by ConservativeScore descending
Assign to pods using snake draft:
  Pod 1 gets player 1, Pod 2 gets player 2 ... Pod N gets player N
  Then reverse: Pod N gets player N+1 ... Pod 1 gets player 2N
  Repeat until all players assigned
```

**Round 2+ — Winners Progress:**
```
Group players by their FinishPosition from previous round
For each group (1st place group, 2nd place group, etc.):
  Sort by ConservativeScore
  Assign to pods of 4 (snake or sequential — similar skill = fine here)
  Set Pod.FinishGroup accordingly
Handle remainder (if group size % 4 != 0):
  Move remainder players down to next group and flag for seeding purposes
```

### Points Scoring (EventStandings)
| Finish | Points |
|--------|--------|
| 1st    | 4      |
| 2nd    | 3      |
| 3rd    | 2      |
| 4th    | 1      |

Tiebreaker: average TrueSkill conservative score of opponents faced.

---

## Suggested API Endpoints (.NET Core)

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/players` | Register player |
| GET | `/api/leaderboard` | Global ranked leaderboard |
| GET | `/api/players/{id}/profile` | Player profile + rating history |
| POST | `/api/events` | Create event |
| POST | `/api/events/{id}/register` | Register for event |
| POST | `/api/events/{id}/rounds` | Generate next round + pods |
| POST | `/api/games/{id}/result` | Submit game result (triggers TrueSkill update) |
| GET | `/api/events/{id}/standings` | Current event standings |

---

## Angular Module Structure (Suggested)

```
src/
  app/
    core/
      services/        # ApiService, AuthService, TrueSkillDisplayService
      guards/          # AuthGuard, AdminGuard
    features/
      leaderboard/     # Global leaderboard page
      player-profile/  # Player stats, deck list, rating history chart
      events/          # Event list, event detail, registration
      tournament/      # Round view, pod assignments, game result entry
      admin/           # Event management, round generation
    shared/
      components/      # RatingBadge, PlayerCard, PodTable, PlacementBadge
      pipes/           # ConservativeScorePipe, ColorIdentityPipe
```  

## Model usage guidance
  - Sonnet for ~90% of tasks — component edits, styling, service wiring, bug fixes, template changes. It handles these patterns well and uses significantly fewer tokens than Opus.
  - Opus only when you need deep multi-file architectural reasoning or tricky debugging across the full stack (like the zoneless change detection issue earlier).
  - Haiku for quick one-off questions, simple searches, or trivial single-line fixes.
        
        