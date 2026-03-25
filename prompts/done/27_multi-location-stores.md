# Feature: Multi-Location Stores (Store Groups)

> **GitHub Issue:** [#32 feat: Multi-Location Stores (Store Groups)](https://github.com/sgrecoswg/TournamentOrganizer/issues/32)
> **Story Points:** 8 · Model: `opus`

## Context
Some game store chains operate multiple physical locations under one brand. Currently each store is independent with its own admin. This adds a `StoreGroup` entity that lets a chain admin manage all their locations under one account — shared license, shared admin access, per-location events and employees.

---

## Requirements

- `StoreGroup` entity: name, logo, chain-level admin
- Stores optionally belong to a `StoreGroup` via `StoreGroupId`
- An Administrator assigned to a group can manage all stores in the group (same as current Admin role but scoped to group stores)
- License can be attached at group level (all stores in group inherit it) or per-store (overrides group license)
- Store list shows group badge/grouping for admins
- Existing stores with no group are unaffected

---

## Backend (`src/TournamentOrganizer.Api/`)

### Database / EF Core

**New `Models/StoreGroup.cs`:**
```csharp
public class StoreGroup
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? LogoUrl { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<Store> Stores { get; set; } = new List<Store>();
}
```

**Modify `Models/Store.cs`** — add:
```csharp
public int? StoreGroupId { get; set; }
public StoreGroup? StoreGroup { get; set; }
```

Run: `/migrate AddStoreGroups`

### DTOs

```csharp
public record StoreGroupDto(int Id, string Name, string? LogoUrl, int StoreCount);
public record CreateStoreGroupDto(string Name);
public record UpdateStoreGroupDto(string Name, string? LogoUrl);
```

- **`StoreDto`** — append `int? StoreGroupId = null`, `string? StoreGroupName = null`

### Service — `IStoreGroupService` (new)

```csharp
Task<List<StoreGroupDto>> GetAllAsync();
Task<StoreGroupDto> CreateAsync(CreateStoreGroupDto dto);
Task<StoreGroupDto?> UpdateAsync(int id, UpdateStoreGroupDto dto);
Task<bool> DeleteAsync(int id);
Task AssignStoreAsync(int groupId, int storeId);
Task UnassignStoreAsync(int storeId);
```

### Controller — `StoreGroupsController` (new, Admin only)

```
GET    /api/storegroups               → list all groups
POST   /api/storegroups               → create group
PUT    /api/storegroups/{id}          → update group
DELETE /api/storegroups/{id}          → delete group
POST   /api/storegroups/{id}/stores/{storeId}   → assign store to group
DELETE /api/storegroups/{id}/stores/{storeId}   → unassign store
```

All routes: `[Authorize(Policy = "Administrator")]`

### API Service (`core/services/api.service.ts`)

```typescript
getStoreGroups(): Observable<StoreGroupDto[]>
createStoreGroup(dto: CreateStoreGroupDto): Observable<StoreGroupDto>
updateStoreGroup(id: number, dto: UpdateStoreGroupDto): Observable<StoreGroupDto>
deleteStoreGroup(id: number): Observable<void>
assignStoreToGroup(groupId: number, storeId: number): Observable<void>
unassignStoreFromGroup(groupId: number, storeId: number): Observable<void>
```

---

## Frontend (`tournament-client/src/app/`)

### Models (`core/models/api.models.ts`)

```typescript
export interface StoreGroupDto { id: number; name: string; logoUrl?: string | null; storeCount: number; }
```

Add to `StoreDto`: `storeGroupId?: number | null; storeGroupName?: string | null`

### `store-list.component.ts` — Admin view

Group stores by `storeGroupId` when viewing as Admin. Ungrouped stores listed separately. Each group has a collapsible section header showing the group name and logo.

### New `store-groups.component.ts`

Admin-only page at `/admin/store-groups`:
- List of store groups
- Create / rename / delete groups
- Assign/unassign stores via drag-and-drop or dropdown

Add link in admin navigation.

### `store-detail.component.ts`

Admin: show group assignment dropdown in store settings. Selecting a group assigns the store; clearing unassigns.

### Post-implementation checklist
- [ ] `/check-zone store-list.component.ts`
- [ ] `/check-zone store-detail.component.ts`
- [ ] `/check-zone store-groups.component.ts`

---

## Backend Unit Tests

**`StoreGroupServiceTests`**:
- `CreateAsync_CreatesGroupAndReturnsDto`
- `AssignStoreAsync_SetsStoreGroupId`
- `UnassignStoreAsync_ClearsStoreGroupId`
- `DeleteAsync_GroupWithStores_UnassignsStoresThenDeletes`
- `GetAllAsync_IncludesStoreCount`

Run with: `dotnet test --filter "FullyQualifiedName~StoreGroupServiceTests"`

---

## Frontend Unit Tests (Jest)

**`store-list.component.spec.ts`** — add `'Store Groups'` describe:
- Stores with same `storeGroupId` rendered under a group header
- Group name shown in section header
- Ungrouped stores listed separately
- Admin sees grouping; Player does not

**`store-groups.component.spec.ts`** (new file):
- Group list rendered
- Create group form appears on button click
- Delete calls `apiService.deleteStoreGroup`

Run with: `npx jest --config jest.config.js --testPathPatterns="store-list|store-groups"`

---

## Playwright E2E Tests

**File: `e2e/stores/store-list.spec.ts`** — add describe blocks
**File: `e2e/admin/store-groups.spec.ts`** (new file)

New helpers in `e2e/helpers/api-mock.ts`:
```typescript
mockGetStoreGroups(page, response: StoreGroupDto[])
mockCreateStoreGroup(page, response: StoreGroupDto)
mockAssignStore(page, groupId, storeId)
// Extend makeStoreDto to accept storeGroupId, storeGroupName
```

| Describe | beforeEach | Tests |
|---|---|---|
| `Store List — Groups: Admin grouped view` | `loginAs('Administrator')`, `mockGetStores` with 2 stores sharing `storeGroupId: 1, storeGroupName: 'Top Deck Chain'` | "Top Deck Chain" group header visible; both stores under it |
| `Store List — Groups: ungrouped` | store with `storeGroupId: null` | store shown in ungrouped section |
| `Store List — Groups: Player no grouping` | `loginAs('Player')` | no group headers rendered |
| `Store Groups — Admin: list` | `loginAs('Administrator')`, `mockGetStoreGroups([group1])` | group name and store count visible |
| `Store Groups — Admin: create` | same + `mockCreateStoreGroup` | "New Group" form → save → group appears in list |
| `Store Groups — Admin: assign store` | `mockGetStores`, `mockAssignStore` | selecting store in dropdown and assigning calls API |

Run with:
- `/e2e e2e/stores/store-list.spec.ts`
- `/e2e e2e/admin/store-groups.spec.ts`

---

## Verification Checklist
- [ ] Failing tests red before implementation (TDD)
- [ ] `/migrate AddStoreGroups` — applied
- [ ] `/build` — 0 errors
- [ ] `dotnet test --filter "FullyQualifiedName~StoreGroupServiceTests"` — all pass
- [ ] Frontend Jest tests pass
- [ ] `/check-zone` on all modified components — clean
- [ ] `/e2e e2e/stores/store-list.spec.ts` — all pass
- [ ] `/e2e e2e/admin/store-groups.spec.ts` — all pass
