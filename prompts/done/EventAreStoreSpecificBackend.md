**Task:** Add a `StoreEvent` join entity so each `Event` belongs to a `Store` (one-to-many).
>
> **Database / EF Core**
> - New entity `StoreEvent`: `Id` (PK), `StoreId` (FK → Stores), `EventId` (FK → Events, unique), `IsActive` (bool)
> - index constraints on `StoreEvent` (e.g., unique `(StoreId, EventId)` to prevent duplicates)
> - Configure in `AppDbContext` with Fluent API. Add unique index on `EventId`.
> - Migration name: `<timestamp>_AddingStoreToEventMapping`. Seed existing events to `StoreId = 1`.
>
> **Backend (`src/TournamentOrganizer.Api/`)**
> - Add `StoreId` to `EventDto` and `CreateEventDto`.
> - Edit `GET /api/events` gains optional `?storeId=` filter (no breaking change).
> - Edit `POST /api/events` requires `storeId`; creates `StoreEvent` row alongside `Event`.

> - Edit `GET /api/stores/{id}` response includes a list of associated event summaries.

>   - Cascade delete or soft-delete via `IsActive` when a store the event is in is deleted or deactivated.

> - Tests: xUNit TDD — write failing test first, then implement. Backend tests live in `src/TournamentOrganizer.Tests/`

> **Sequence:** DB entity → migration → backend service/repo/controller + tests 





