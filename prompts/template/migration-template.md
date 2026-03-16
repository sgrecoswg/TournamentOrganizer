# Migration: [Short description — one line]

## Context
<!-- One or two sentences: why the schema is changing and what it enables.
     Example: Add a `MaxPlayers` column to `Events` so store employees can cap event registration. -->

**Migration name:** `AddFoo` *(used verbatim in `dotnet ef migrations add <Name>`)*
**Affects frontend contract:** Yes / No *(if Yes, list the DTO fields that change)*

---

## Database Changes

<!-- Use exact C# types. Mark nullable columns explicitly. -->

### New table(s)
| Column | C# Type | Constraints |
|---|---|---|
| `Id` | `int` | PK, auto-increment |
| `FooName` | `string` | required, max 200 |
| `StoreId` | `int` | FK → `Store.Id` |
| `IsActive` | `bool` | default `true` |
| `CreatedOn` | `DateTime` | required |
| `UpdatedOn` | `DateTime` | required |

### Modified table(s)
| Table | Column | Change |
|---|---|---|
| `Events` | `MaxPlayers` | Add `int?` nullable column |
| `Players` | `Email` | Increase max length 100 → 256 |

### Indexes / constraints *(if any)*
- Unique index on `(StoreId, FooName)`

---

## Backend (`src/TournamentOrganizer.Api/`)

### Models / Entities (`Models/`)
- **`Foo.cs`** — new EF Core entity:
  ```csharp
  public int Id { get; set; }
  public string FooName { get; set; } = string.Empty;
  public int StoreId { get; set; }
  public Store Store { get; set; } = null!;
  public bool IsActive { get; set; } = true;
  public DateTime CreatedOn { get; set; }
  public DateTime UpdatedOn { get; set; }
  ```

- **`Event.cs`** *(if modifying existing)* — add `public int? MaxPlayers { get; set; }`

### AppDbContext (`Data/AppDbContext.cs`)
- Add `DbSet<Foo> Foos { get; set; }`
- Add any `modelBuilder` config (max length, indexes, default values)

### DTOs (`DTOs/`) *(if the API contract changes)*
- **`FooDto`** — add `int? MaxPlayers` field
- **`CreateFooDto`** — add `int? MaxPlayers` field

### Migration
```bash
/migrate AddFoo
```
*(This runs `dotnet ef migrations add AddFoo` and `dotnet ef database update`.)*

---

## Frontend (`tournament-client/src/app/`) *(if API contract changes)*

<!-- Delete this section if no DTO fields change. -->

### Models (`core/models/api.models.ts`)
- Add `maxPlayers: number | null` to `EventDto`
- Add `maxPlayers?: number` to `CreateEventDto`

### API Service (`core/services/api.service.ts`)
<!-- Only if request/response shapes change — not needed for additive nullable columns. -->
- Update `createEvent(dto: CreateEventDto)` — no signature change needed (field is optional)

### Components *(if new fields need to be shown)*
- **`features/events/event-list.component.ts`** — render `maxPlayers` in the event card
- **`features/events/event-detail.component.ts`** — add `Max Players` input to the form

### Post-migration checklist
- [ ] Run `/check-zone` on every modified component

---

## Backend Unit Tests (`src/TournamentOrganizer.Tests/`) *(if service logic changes)*

**Test class: `FooServiceTests`** *(or existing class for modified entity)*

- `GetAllAsync_IncludesMaxPlayers` — new field appears in returned DTO
- `CreateAsync_WithMaxPlayers_PersistsValue` — nullable field round-trips correctly
- `CreateAsync_WithNullMaxPlayers_IsAllowed` — null is valid

Run with: `dotnet test --filter "FullyQualifiedName~FooServiceTests"`

---

## Frontend Unit Tests (Jest) *(if component template changes)*

**`features/events/event-list.component.spec.ts`**

- `renders maxPlayers when set` — card shows slot count
- `does not render slot count when maxPlayers is null` — no text shown

Run with: `npx jest --config jest.config.js --testPathPatterns=event-list.component`

---

## Frontend E2E Tests (Playwright) *(if new UI is added)*

**File: `e2e/events/event-list.spec.ts`** *(add to existing file)*

| Describe | Test |
|---|---|
| `Event List — slot count` | shows `N remaining` when `maxPlayers` is set and not full |
| `Event List — slot count` | shows `Full` chip when `playerCount >= maxPlayers` |
| `Event List — slot count` | shows nothing when `maxPlayers` is null |

Run with: `/e2e e2e/events/event-list.spec.ts`

---

## Verification Checklist

- [ ] `/build` — 0 errors on both .NET and Angular
- [ ] Migration applied cleanly — `dotnet ef database update` exits 0
- [ ] `dotnet test` — all pass
- [ ] `npx jest --config jest.config.js --testPathPatterns=foo` — all pass
- [ ] `/e2e e2e/foo/foo.spec.ts` — all pass *(if frontend changed)*
- [ ] `/check-zone` — no missing `cdr.detectChanges()` in modified components
