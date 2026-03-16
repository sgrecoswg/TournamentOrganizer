# Feature: [Feature Name]

## Context
We want Stores to be able to chose a theme so they can have individuality in the site

Using CSS Variables (Custom Properties) triggered by a theme name stored in your database. This allows you to change the look of the entire site instantly without reloading or shipping massive CSS files. 

---

## Requirements
- in the Store Component's settings tab, add a drop down of available themes. 
- a way to create new themes
- when a store is selected by admin or a store is defalted by the current user's store, the themewill be in place
- theme selection will be saved to the database for the store

---

## Backend (`src/TournamentOrganizer.Api/`)

Instead of storing raw CSS, store a Theme Key (e.g., "dark", "corporate", "forest") in your store table. 

### Database / EF Core
<!-- New tables, columns, or relationship changes. Use the exact column names and types that match the C# model. -->
- New entity `Theme` (`Id int PK`, `Name string`, `StoreId int FK → Store.Id`, `CreatedOn datetime`, `UpdatedOn datetime`, `CreatedBy string`, `Updatedby string`)
- Add `DbSet<Theme>` to `AppDbContext`
- Run `/migrate AddThemes`

### Models / Entities (`Models/`)
- `Theme.cs` — new EF Core entity
- `StoreDetailDto` - Modify to add new Theme Entity

### DTOs (`DTOs/`)
- `ThemeDto` — request/response shape (list all fields)
- `CreateThemeDto` — POST body shape

### Repository (`Repositories/`)
- `IThemesRepository` / `ThemesRepository` — methods: `GetAllAsync()`, `GetByIdAsync(id)`, `AddAsync(dto)`, `UpdateAsync(dto)`, `DeleteAsync(id)`

### Service (`Services/`)
- `IThemesService` / `ThemesService` — business logic methods (describe each)
- Register `IThemesRepository`, `IThemesService` as Scoped in `Program.cs`

### Controller (`Controllers/`)
When the frontend requests store data, include the ThemeKey.
Update Endpoint: Create a simple PATCH or PUT endpoint for the tenant admin to save their selected theme key to the database. 

- `ThemesController` at `/api/themes`
  - `GET /api/themes` → returns `ThemeDto[]`
  - `GET /api/themes/{id}` → returns `ThemeDto`
  - `POST /api/themes` → creates, returns `ThemeDto`
  - `PUT /api/themes/{id}` → updates, returns `ThemeDto`
  - `DELETE /api/themes/{id}` → removes, returns `204`

---

## Frontend (`tournament-client/src/app/`)
- Styling Strategy (Angular)
Define your themes in a global SCSS file using CSS variables. This makes it easy to swap colors, fonts, and spacing dynamically. 

- Implementation (Angular)
  - Since you already use Local Storage first, use an Angular Theme Service to manage the state. 
  - create `default` theme based on our current styling
  - Initialization: On app load, check Local Storage for a savedTheme. If empty, use the ThemeKey returned from your Tenant API call.
  - default to a `default` theme if nothing comes bac from the ap or in local storage
  - Applying the Theme: Use Angular's Renderer2 or another prefered tool to add or remove the theme class (e.g., theme-dark) from the <body> element.

  - Theme Switcher: Provide a UI dropdown or gallery in the store controller. 
    - When a user selects a new theme:
      - Update the class on the <body> for an instant preview.
      - Save the key to Local Storage for immediate persistence.
      - Call your C# API to save the preference for that tenant.

<!-- List every file to create or change. -->

### Models (`core/models/api.models.ts`)
- Modify `StoreDetailDto { id: number; name: string; ... }` to add theme to the store so we can select it later

### Components
- **`tournament-client\src\app\features\stores\store-detail.component.ts`** — standalone; lists items; role-based create form; remove button
  - Add template selector contrl as a drop down

### Post-implementation checklist
- [ ] Run `/check-zone` on every new or modified component

---

## Backend Unit Tests (`src/TournamentOrganizer.Tests/`)

<!-- Describe the test class and the cases to cover BEFORE writing the service code (TDD). -->

**Test class: `ThemesServiceTests`**

- `GetAllAsync_ReturnsAllThemes`
- `CreateAsync_PersistsAndReturnsTheme`
- `UpdateAsync_ModifiesExistingTheme`
- `DeleteAsync_RemovesTheme`
- `GetByIdAsync_ThrowsWhenNotFound` *(or returns null — state which)*

Run with: `dotnet test --filter "FullyQualifiedName~ThemesServiceTests"`

---

## Frontend Unit Tests (Jest)

<!-- Describe the spec file(s) and the cases to cover BEFORE touching component code (TDD).
     Each bullet is one `it(...)` or `test(...)` block. -->

**`tournament-client\src\app\features\stores\store-detail.component.spec.ts`**

Online path:
- calls `ThemesService.loadAll()` on init
- clicking Create calls `ThemesService.create()` with the correct args
- snackbar shows "Theme created!" on success

Offline / error path:
- `ThemesService.create()` error → snackbar shows error message
- component still renders cached foos when API is down

Run with: `npx jest --config jest.config.js --testPathPatterns=store-detail.component`

---

## Frontend E2E Tests (Playwright)

<!-- Describe the spec file and every describe block. Be explicit about selectors so the spec matches the template exactly. -->

**File: `e2e/stores/store-detail.spec.ts`**

Helpers needed in `e2e/helpers/api-mock.ts`:
- `mockGetThemes(page, foos: ThemesDto[])` — intercepts `GET /api/themes`
- `makeThemeDto(overrides?)` — fixture builder

Describe blocks:

Run with: `/e2e e2e/stores/store-details.spec.ts`
**All tests must pass before the task is considered done.**

---

## Verification Checklist

- [ ] `/build` — 0 errors on both .NET and Angular
- [ ] `dotnet test --filter "FullyQualifiedName~ThemesServiceTests"` — all pass
- [ ] `npx jest --config jest.config.js --testPathPatterns=store-details` — all pass
- [ ] `/e2e e2e/stores/store-detail.spec.ts` — all pass
- [ ] `/check-zone` — no missing `cdr.detectChanges()` calls in new components

