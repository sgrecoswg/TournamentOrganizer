# Baseline Prompt: Offline-First localStorage System

## Context

This is an Angular 21 + .NET 9 Tournament Organizer app. Auth already exists and exposes the current user's role (employee / manager / admin). The goal is to make the frontend **offline-first**: all writes go to `localStorage` first, and authorised users explicitly sync to the backend API from the store detail page.

---

## Design Decisions (pre-answered — do not ask about these)

| Decision | Choice |
|---|---|
| Primary data source | `localStorage` (offline-first) |
| Backend role | Sync target only — no automatic writes |
| Entities in scope | Players, Stores, Events + Rounds + Pods, Game Results |
| Offline ID strategy | Negative integers (`-1`, `-2`, …) for new local records; backend assigns real positive IDs on sync |
| localStorage scope | Per-store namespace: keys prefixed `to_store_{storeId}_` |
| Conflict resolution | Show a diff UI and let the user choose per-conflict |
| Export / import format | JSON |
| Auth / roles | Comes from existing auth system — read-only here |

---

## Feature Overview

### ~~1. `LocalStorageContext` service~~ ✅ DONE

Create `tournament-client/src/app/core/services/local-storage-context.service.ts`.

Model it after Entity Framework's `DbContext` pattern — a single injectable service that exposes typed "table" accessors. Each accessor is a `LocalTable<T>` with a consistent CRUD interface and change-tracking.

```
LocalStorageContext
  .players        → LocalTable<PlayerDto>
  .stores         → LocalTable<StoreDto>
  .events         → LocalTable<EventDto>
  .rounds         → LocalTable<RoundDto>
  .pods           → LocalTable<PodDto>
  .gameResults    → LocalTable<GameResultDto>
```

**`LocalTable<T>` API (minimum):**

```typescript
getAll(): T[]
getById(id: number): T | undefined
add(entity: Omit<T, 'id'>): T          // assigns next negative ID, marks as 'added'
update(entity: T): void                // marks as 'modified'
remove(id: number): void               // marks as 'deleted'
saveChanges(): void                    // persists current state to localStorage
discardChanges(): void                 // reverts to last saved state
getPending(): ChangeSet<T>             // { added, modified, deleted }
```

**localStorage key scheme:**
```
to_store_{storeId}_{tableName}         // e.g. to_store_3_players
to_store_{storeId}_{tableName}_meta    // tracks change states (added/modified/deleted)
```

All `LocalTable` instances are scoped to a single active `storeId`. The context exposes `setActiveStore(storeId: number)` to switch scope. Data from a different store is never visible.

---

### ~~2. Update existing services to use `LocalStorageContext`~~ ✅ DONE

All existing feature services (`PlayerService`, `EventService`, etc.) currently call the backend API directly. Refactor them so that:

- **Reads** come from `LocalStorageContext` (with an optional `refresh from API` action)
- **Writes** go to `LocalStorageContext` only (no HTTP call at write time)
- The existing `ApiService` HTTP methods are preserved but only called during explicit sync

The `BehaviorSubject`-based state pattern stays the same — services emit from `LocalStorageContext` instead of from HTTP responses.

---

### ~~3. Sync system~~ ✅ DONE

#### `SyncService`

Create `tournament-client/src/app/core/services/sync.service.ts`.

Responsibilities:
1. **Push**: For each entity in `getPending()`, call the corresponding backend API endpoint.
   - `added` → `POST`
   - `modified` → `PUT`
   - `deleted` → `DELETE`
2. **ID remapping**: When the backend responds with a real positive ID for a previously-negative-ID record, update all references in `LocalStorageContext` to use the new ID.
3. **Conflict detection**: Before pushing a `modified` record, fetch the current backend version (`GET /api/{entity}/{id}`). If the backend version differs from the local base snapshot (the version that was loaded before edits began), surface a conflict.
4. **Conflict resolution UI**: Show a side-by-side diff dialog (`SyncConflictDialogComponent`) listing each conflicting field. The user selects "Keep local" or "Use server" per record. After resolution, push the chosen version.
5. **Pull / refresh**: A separate "Pull from server" action fetches all entities for the active store and overwrites `LocalStorageContext` (after warning the user if there are pending changes).

#### Sync result summary

After sync completes, show a snackbar or dialog summarising: `N records pushed, M conflicts resolved, K errors`.

---

### ~~4. Store detail page additions~~ ✅ DONE

Add a **"Data Management" panel** to `store-detail.component.ts` (visible only to roles: employee, manager, admin).

Controls:
- **Sync to Server** button — triggers `SyncService.push()` for the active store's pending changes. Shows a badge with the count of pending changes (e.g. `Sync (12)`).
- **Pull from Server** button — triggers `SyncService.pull()`, warns if pending local changes exist.
- **Download (Export)** button — serialises the active store's entire `LocalStorageContext` to a JSON file and triggers a browser download (`to_store_{storeId}_{date}.json`).
- **Upload (Import)** button — opens a file picker, reads the JSON, validates the shape, and loads it into `LocalStorageContext`. Warns if existing data will be overwritten.

---

### ~~5. Export / Import format~~ ✅ DONE

```json
{
  "storeId": 3,
  "exportedAt": "2026-03-04T20:00:00Z",
  "players":     [...],
  "stores":      [...],
  "events":      [...],
  "rounds":      [...],
  "pods":        [...],
  "gameResults": [...]
}
```

Import validates that `storeId` matches the active store before loading. Mismatches prompt the user to confirm or cancel.

---

## Files to Create / Modify (expected scope)

| File | Action |
|---|---|
| `core/services/local-storage-context.service.ts` | ✅ **DONE** — `LocalStorageContext` + `LocalTable<T>` |
| `core/services/sync.service.ts` | ✅ **DONE** — push, pull, conflict detection |
| `core/services/player.service.ts` | ✅ **DONE** — reads/writes via context |
| `core/services/event.service.ts` | ✅ **DONE** — reads/writes via context |
| `features/stores/store-detail.component.ts` | ✅ **DONE** — Data Management tab added |
| `features/stores/dialogs/sync-conflict-dialog.component.ts` | ✅ **DONE** — side-by-side diff + resolve UI |
| `core/models/api.models.ts` | ✅ **DONE** — added `ChangeSet<T>`, `SyncResult`, `LocalGameResultDto`, `ChangeState` |

---

## Constraints

- Angular 21 zoneless — every state mutation must call `this.cdr.detectChanges()`; run `/check-zone` on all modified components before closing out
- Angular Material only for UI — no additional UI libraries
- `LocalTable<T>` must be generic and reusable — not entity-specific
- `LocalStorageContext` must be testable (injectable, no direct `window.localStorage` calls — wrap in an injectable `StorageAdapter` to allow mocking)
- Do **not** auto-sync on every keystroke — sync is always explicit and user-initiated
- Preserve the existing backend API and all existing API service methods — they become the sync transport layer, not the primary data layer
