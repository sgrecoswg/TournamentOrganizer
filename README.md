# Tournament Organizer

A full-stack web application for managing **Magic: The Gathering Commander** tournaments with skill-based matchmaking, TrueSkill ratings, and multi-store support.

---

## Features

### Tournament Management
- Create and configure events (name, date, max players, point system, planned rounds)
- Event lifecycle: **Registration → InProgress → Completed** (or Removed)
- Register players with optional deck list URL and commander declarations
- Drop or disqualify players mid-tournament
- Waitlist with automatic promotion

### Matchmaking & Rounds
- **Round 1**: Snake-draft pod seeding by TrueSkill conservative score (balanced skill distribution)
- **Round 2+**: Winners bracket — players grouped by finish position, sorted by skill within group
- Supports pod sizes of 3–5 players when count isn't divisible by 4

### Check-In
- QR code check-in with a unique per-event token
- Players scan QR or use a link; staff can check everyone in at once

### Scoring
Multiple point systems supported per event:
| System | 1st | 2nd | 3rd | 4th |
|---|---|---|---|---|
| ScoreBased (default) | 4 | 3 | 2 | 1 |
| WinBased | 5 | 0 | 0 | 0 |
| FiveOneZero | 5 | 1 | 1 | 1 |
| SeatBased | 6 + seat bonus | — | — | — |

Tiebreaker: average opponent conservative score.

### TrueSkill Rating System
- **Mu** (skill estimate) and **Sigma** (uncertainty) per player
- **Conservative Score** = Mu − 3×Sigma (shown on leaderboard)
- New players play 5 placement games before appearing on the ranked leaderboard
- Ratings update after each game; reversible if a result is corrected

### Player Profiles & Leaderboard
- Per-player stats: game history, finish positions, commanders played, head-to-head records
- Global leaderboard sorted by conservative score (ranked players only)

### Store Management (Multi-tenant)
- Multiple stores, each with their own events, branding (logo, theme), and staff roles
- Roles: **Player**, **StoreEmployee**, **StoreManager**, **Administrator**

### Card Trading & Wishlists
- Players maintain a wish list (cards wanted) and supply list (cards available)
- Suggested trade engine recommends matches between players
- Moxfield deck list integration for automatic card import
- Card prices via the Scryfall API (1-hour cache)

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | .NET 9, ASP.NET Core Web API, Entity Framework Core 9 |
| **Database** | SQL Server (LocalDB for dev) |
| **Authentication** | Google OAuth 2.0 + JWT Bearer tokens |
| **Frontend** | Angular 21, Angular Material 21 |
| **State Management** | RxJS BehaviorSubject (no NgRx) |
| **Unit Tests (backend)** | xUnit |
| **Unit Tests (frontend)** | Jest + jest-preset-angular |
| **E2E Tests** | Playwright |

---

## Getting Started

### Prerequisites
- [.NET 9 SDK](https://dotnet.microsoft.com/download)
- [SQL Server LocalDB](https://docs.microsoft.com/en-us/sql/database-engine/configure-windows/sql-server-express-localdb) (ships with Visual Studio)
- [Node.js 20+](https://nodejs.org/) and npm

### 1. Configure Secrets

The repository stores only placeholder values in `appsettings.json`. Set real values using .NET User Secrets:

```bash
cd src/TournamentOrganizer.Api

dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Server=(localdb)\mssqllocaldb;Database=TournamentOrganizer;Trusted_Connection=True;TrustServerCertificate=True"
dotnet user-secrets set "Jwt:Key" "<your-jwt-secret-min-32-chars>"
dotnet user-secrets set "Google:ClientId" "<your-google-oauth-client-id>"
dotnet user-secrets set "Google:ClientSecret" "<your-google-oauth-secret>"
```

User secrets are stored locally on your machine and never committed to source control.

### 2. Apply Database Migrations

```bash
dotnet ef database update --project src/TournamentOrganizer.Api/
```

### 3. Run the API

```bash
dotnet run --project src/TournamentOrganizer.Api/
```

- API: **http://localhost:5021**
- Swagger: **http://localhost:5021/swagger**

### 4. Run the Frontend

```bash
cd tournament-client
npm install
npm start
```

- App: **http://localhost:4200**
- The dev server proxies `/api/*` requests to `http://localhost:5021` automatically.

---

## Running Tests

### Backend (xUnit)

```bash
# All tests
dotnet test

# Single test class
dotnet test --filter "FullyQualifiedName~CommanderDeclarationTests"
```

### Frontend Unit Tests (Jest)

```bash
cd tournament-client

# All tests
npm test

# Single file
npm test -- --testPathPattern=event-detail
```

### Frontend E2E Tests (Playwright)

The backend does **not** need to be running — all API calls are intercepted by mocks.

```bash
cd tournament-client

# All E2E tests
npm run e2e

# Single spec
npx playwright test e2e/events/event-detail.spec.ts --reporter=list
```

---

## Project Structure

```
TournamentOrganizer/
├── src/
│   ├── TournamentOrganizer.Api/        # .NET 9 backend
│   │   ├── Controllers/                # HTTP routing only — no business logic
│   │   ├── Services/                   # Business logic (EventService, PodService, etc.)
│   │   ├── Repositories/              # Data access via EF Core
│   │   ├── Models/                    # EF Core entities
│   │   ├── DTOs/                      # Request/response shapes
│   │   ├── Data/AppDbContext.cs        # EF Core DbContext
│   │   └── Migrations/                # EF Core migration history
│   │
│   └── TournamentOrganizer.Tests/      # xUnit test suite
│
└── tournament-client/                  # Angular 21 frontend
    ├── src/app/
    │   ├── core/services/             # ApiService, EventService, AuthService, etc.
    │   ├── core/models/api.models.ts  # TypeScript DTOs mirroring backend
    │   ├── features/                  # events, players, leaderboard, stores, tournament
    │   └── shared/components/         # RatingBadge, PlacementBadge, PodTimer
    └── e2e/                           # Playwright E2E tests
        └── helpers/                   # api-mock.ts, auth.ts, fixture builders
```

---

## Architecture Notes

- **Controllers are thin** — HTTP shape only, always return DTOs, never domain models.
- **All business logic lives in Services** — registered as `Scoped` in DI.
- **Zoneless Angular** — no Zone.js. Every method that mutates component state must call `this.cdr.detectChanges()`.
- **TrueSkill** — custom static implementation (`TrueSkillCalculator.cs`). The Moserware.Skills NuGet is incompatible with .NET 9.
- **Image cache-busting** — API overwrites the same file path on upload; `?t=<timestamp>` is appended to image URLs in the frontend to force browser refresh.
- **E2E tests are mandatory** for any UI feature before it is considered done.

---

## Google OAuth Setup

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the **Google+ API** / **OAuth consent screen**
3. Create OAuth 2.0 credentials (Web application type)
4. Add `http://localhost:5021/api/auth/callback` as an authorized redirect URI
5. Copy the Client ID and Secret into user secrets (see step 1 of Getting Started)
