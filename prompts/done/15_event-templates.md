# Feature: Event Templates / Recurring Events

> **GitHub Issue:** [#20 feat: Event Templates / Recurring Events](https://github.com/sgrecoswg/TournamentOrganizer/issues/20)

## Context
Stores running weekly or regular events recreate the same configuration (format, max players, round count) from scratch each time. Event templates let a StoreManager save a configuration once and create new events from it in one click.

---

## Requirements

- StoreManager/Admin can create, edit, and delete event templates scoped to their store
- Template stores: name, description, max players, number of rounds, format (free text, e.g. "Commander")
- "Create from Template" button on the event list page populates the new event form
- Templates listed in a "Templates" tab or panel on the store detail page (StoreManager only)
- Deleting a template does not affect previously created events

---

## Backend (`src/TournamentOrganizer.Api/`)

### Database / EF Core

**New `Models/EventTemplate.cs`:**
```csharp
public class EventTemplate
{
    public int Id { get; set; }
    public int StoreId { get; set; }
    public Store Store { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Format { get; set; } = "Commander";
    public int MaxPlayers { get; set; } = 16;
    public int NumberOfRounds { get; set; } = 4;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
```

Add `DbSet<EventTemplate> EventTemplates` to `AppDbContext`.
Run: `/migrate AddEventTemplates`

### DTOs

```csharp
public record EventTemplateDto(int Id, int StoreId, string Name, string? Description, string Format, int MaxPlayers, int NumberOfRounds);
public record CreateEventTemplateDto(string Name, string? Description, string Format, int MaxPlayers, int NumberOfRounds);
public record UpdateEventTemplateDto(string Name, string? Description, string Format, int MaxPlayers, int NumberOfRounds);
```

### Service — `IEventTemplateService` (new)

```csharp
Task<List<EventTemplateDto>> GetByStoreAsync(int storeId);
Task<EventTemplateDto> CreateAsync(int storeId, CreateEventTemplateDto dto);
Task<EventTemplateDto?> UpdateAsync(int id, UpdateEventTemplateDto dto);
Task<bool> DeleteAsync(int id);
```

### Controller — `EventTemplatesController` (new)

```csharp
GET    /api/stores/{storeId}/eventtemplates          [Authorize(Policy="StoreEmployee")]
POST   /api/stores/{storeId}/eventtemplates          [Authorize(Policy="StoreManager")]
PUT    /api/stores/{storeId}/eventtemplates/{id}     [Authorize(Policy="StoreManager")]
DELETE /api/stores/{storeId}/eventtemplates/{id}     [Authorize(Policy="StoreManager")]
```

### API Service (`core/services/api.service.ts`)

```typescript
getEventTemplates(storeId: number): Observable<EventTemplateDto[]>
createEventTemplate(storeId: number, dto: CreateEventTemplateDto): Observable<EventTemplateDto>
updateEventTemplate(storeId: number, id: number, dto: UpdateEventTemplateDto): Observable<EventTemplateDto>
deleteEventTemplate(storeId: number, id: number): Observable<void>
```

---

## Frontend (`tournament-client/src/app/`)

### Models (`core/models/api.models.ts`)

```typescript
export interface EventTemplateDto { id: number; storeId: number; name: string; description?: string | null; format: string; maxPlayers: number; numberOfRounds: number; }
export interface CreateEventTemplateDto { name: string; description?: string | null; format: string; maxPlayers: number; numberOfRounds: number; }
```

### `store-detail.component.ts` — Templates tab

New "Templates" tab (visible to StoreManager+):
- List of template cards with name, format, max players, rounds
- "New Template" button → inline form or dialog
- Edit / Delete per template
- All mutations call `cdr.detectChanges()`

### `event-list.component.ts`

For StoreEmployee: show "Use Template" dropdown/button alongside "Create New Event". Selecting a template pre-fills the create form fields. No new API call — template data already loaded.

### Post-implementation checklist
- [ ] `/check-zone store-detail.component.ts`
- [ ] `/check-zone event-list.component.ts`

---

## Backend Unit Tests

**`EventTemplateServiceTests`**:
- `GetByStoreAsync_ReturnsTemplatesForStore`
- `GetByStoreAsync_DoesNotReturnOtherStoreTemplates`
- `CreateAsync_CreatesAndReturnsDto`
- `UpdateAsync_TemplateNotFound_ReturnsNull`
- `DeleteAsync_RemovesTemplate_ReturnsTrue`
- `DeleteAsync_NotFound_ReturnsFalse`

Run with: `dotnet test --filter "FullyQualifiedName~EventTemplateServiceTests"`

---

## Frontend Unit Tests (Jest)

**`store-detail.component.spec.ts`** — add `'Event Templates'` describe:
- Templates tab visible for StoreManager
- Template list rendered
- New template form appears on button click
- Delete calls `apiService.deleteEventTemplate`

Run with: `npx jest --config jest.config.js --testPathPatterns=store-detail`

---

## Playwright E2E Tests

**File: `e2e/stores/store-detail.spec.ts`** — add describe blocks
**File: `e2e/events/event-list.spec.ts`** — add describe block

New helpers in `e2e/helpers/api-mock.ts`:
```typescript
mockGetEventTemplates(page, storeId, response: EventTemplateDto[])
mockCreateEventTemplate(page, storeId, response: EventTemplateDto)
mockDeleteEventTemplate(page, storeId, id)
makeEventTemplateDto(overrides?)  // fixture builder
```

| Describe | beforeEach | Tests |
|---|---|---|
| `Store Detail — Event Templates: list` | `loginAs('StoreManager', { storeId: 1 })`, `mockGetEventTemplates([template1])` | Templates tab visible; template name, format, max players shown |
| `Store Detail — Event Templates: create` | same + `mockCreateEventTemplate` | clicking "New Template" shows form; filling and saving calls `POST .../eventtemplates`; new template appears in list |
| `Store Detail — Event Templates: delete` | same + `mockDeleteEventTemplate` | Delete button calls `DELETE`; template removed from list |
| `Store Detail — Event Templates: hidden for Player` | `loginAs('Player')` | Templates tab NOT visible |
| `Event List — Use Template` | `loginAs('StoreEmployee', { storeId: 1 })`, `mockGetEventTemplates([template1])` | "Use Template" button/dropdown visible; selecting template pre-fills create form fields |

Run with:
- `/e2e e2e/stores/store-detail.spec.ts`
- `/e2e e2e/events/event-list.spec.ts`

---

## Verification Checklist
- [ ] Failing tests red before implementation (TDD)
- [ ] `/migrate AddEventTemplates` — applied
- [ ] `/build` — 0 errors
- [ ] `dotnet test --filter "FullyQualifiedName~EventTemplateServiceTests"` — all pass
- [ ] Frontend Jest tests pass
- [ ] `/check-zone store-detail.component.ts` — clean
- [ ] `/check-zone event-list.component.ts` — clean
- [ ] `/e2e e2e/stores/store-detail.spec.ts` — all pass
- [ ] `/e2e e2e/events/event-list.spec.ts` — all pass
