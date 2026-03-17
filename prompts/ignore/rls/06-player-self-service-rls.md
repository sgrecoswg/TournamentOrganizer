# RLS: Player Self-Service Boundary Tests

> **GitHub Issue:** [#38 test: RLS — Player Self-Service Boundary Tests](https://github.com/sgrecoswg/TournamentOrganizer/issues/38)

## What
Tests ensuring Players can only act on their own data and cannot access or modify other players' records.

## Why
Player-scoped operations (profile edits, avatar upload, event registration) rely on the `playerId` JWT claim matching the target resource. This is untested.

## Items to Test

### Backend
- `PUT /api/players/{id}` (if exists): Player A cannot update Player B's profile → 403
- `POST /api/players/{id}/avatar`: Player A cannot upload avatar for Player B → 403
- `DELETE /api/players/{id}/avatar`: Same constraint
- `GET /api/players/{id}`: Public read is fine; verify no sensitive fields leaked

### Frontend / E2E
- Avatar upload button only visible on the current user's own profile
- Edit controls absent when viewing another player's profile page
- Direct URL navigation to another player's avatar upload handled gracefully

## Notes
- Use `loginAs(page, 'Player', { playerId: 1 })` and attempt actions on `playerId: 2`
- Backend tests: craft JWT with `playerId=1`, call endpoint for player 2
