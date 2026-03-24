# Feature: Display Why Image Upload Failed

> **GitHub Issue:** [#51 — Display why image failed to upload](https://github.com/SensibleProgramming/TournamentOrganizer/issues/51)

## Context

When a user uploads an image (store logo, store background, or player avatar) and it fails because the file is too large or has an unsupported extension, the frontend currently shows a generic error message ("Logo upload failed", "Upload failed. Check file type and size.", etc.). The backend already returns descriptive `BadRequest` strings for these validation cases. This feature wires those messages through to the snackbar so users understand exactly why their upload failed, while falling back to a generic message for unexpected server errors (500, network failures).

---

## Dependencies

- None

---

## Files Modified

**Created:**
- *(none)*

**Modified:**
- `tournament-client/src/app/features/stores/store-detail.component.ts`
- `tournament-client/src/app/features/stores/store-detail.component.spec.ts`
- `tournament-client/src/app/features/player-profile/player-profile.component.ts`
- `tournament-client/src/app/features/player-profile/player-profile.component.spec.ts`

---

## Requirements

- When an image upload returns HTTP 400 and the response body is a non-empty string, show that string verbatim in the snackbar.
- When an image upload returns any other error (HTTP 500, network error, `0`, etc.), show a short generic fallback message.
- Generic fallback messages (used for non-400 errors):
  - Logo: `"Logo upload failed"`
  - Background: `"Background upload failed"`
  - Avatar: `"Avatar upload failed"`
- Do **not** expose exception details, stack traces, or raw HTTP status codes to the user.
- The three upload handlers to update are:
  - `store-detail.component.ts` — `onLogoSelected` error handler
  - `store-detail.component.ts` — `onBackgroundSelected` error handler
  - `player-profile.component.ts` — `onAvatarFileSelected` error handler

---

## Backend (`src/TournamentOrganizer.Api/`)

No backend changes required. The backend already returns structured `BadRequest` responses:

| Upload | Friendly messages already returned |
|---|---|
| Logo (`POST /api/stores/{id}/logo`) | `"Invalid file type. Allowed: .png, .jpg, .jpeg, .gif"` / `"File exceeds 2 MB limit."` |
| Background (`POST /api/stores/{id}/background`) | `"Invalid file type. Allowed: .png, .jpg, .jpeg"` / `"File exceeds 5 MB limit."` |
| Avatar (`POST /api/players/{id}/avatar`) | `"Invalid file type."` / `"File exceeds 2 MB limit."` / `"No file provided."` |

---

## Frontend (`tournament-client/src/app/`)

### Helper pattern

Add a file-level function in each component file that needs it:

```typescript
import { HttpErrorResponse } from '@angular/common/http';

function getUploadErrorMessage(err: HttpErrorResponse, fallback: string): string {
  if (err.status === 400 && typeof err.error === 'string' && err.error.trim()) {
    return err.error.trim();
  }
  return fallback;
}
```

Do not create a shared utility for this — a local function per file is sufficient.

### `features/stores/store-detail.component.ts`

`onLogoSelected` — update error handler:
```typescript
error: (err: HttpErrorResponse) => {
  const msg = getUploadErrorMessage(err, 'Logo upload failed');
  this.snackBar.open(msg, 'Close', { duration: 4000 });
  this.cdr.detectChanges();
}
```

`onBackgroundSelected` — update error handler:
```typescript
error: (err: HttpErrorResponse) => {
  const msg = getUploadErrorMessage(err, 'Background upload failed');
  this.snackBar.open(msg, 'Close', { duration: 4000 });
  this.cdr.detectChanges();
}
```

Ensure `HttpErrorResponse` is imported from `@angular/common/http`.

### `features/player-profile/player-profile.component.ts`

`onAvatarFileSelected` — update error handler:
```typescript
error: (err: HttpErrorResponse) => {
  this.uploadingAvatar = false;
  const msg = getUploadErrorMessage(err, 'Avatar upload failed');
  this.snackBar.open(msg, 'Close', { duration: 4000 });
  this.cdr.detectChanges();
}
```

Ensure `HttpErrorResponse` is imported from `@angular/common/http`.

### Post-implementation checklist
- [ ] Run `/check-zone` on both modified component files

---

## Backend Unit Tests

None — no backend changes.

---

## Frontend Unit Tests (Jest)

Write these tests **before** modifying the component code (TDD). Confirm they are red first.

### `features/stores/store-detail.component.spec.ts`

Replace or extend the existing `onLogoSelected shows snackbar on upload error` test and add:

- `onLogoSelected shows backend message when API returns 400 "Invalid file type. Allowed: .png, .jpg, .jpeg, .gif"`
- `onLogoSelected shows backend message when API returns 400 "File exceeds 2 MB limit."`
- `onLogoSelected shows "Logo upload failed" when API returns 500`

Replace or extend the existing background upload error test and add:

- `onBackgroundSelected shows backend message when API returns 400 "Invalid file type. Allowed: .png, .jpg, .jpeg"`
- `onBackgroundSelected shows backend message when API returns 400 "File exceeds 5 MB limit."`
- `onBackgroundSelected shows "Background upload failed" when API returns 500`

Use `throwError(() => new HttpErrorResponse({ status: 400, error: '<message here>' }))` for 400 cases and `throwError(() => new HttpErrorResponse({ status: 500, error: 'Internal Server Error' }))` for 500 cases.

Run with: `npx jest --config jest.config.js --testPathPatterns=store-detail.component`

### `features/player-profile/player-profile.component.spec.ts`

Replace or extend the existing `onAvatarFileSelected shows error snackbar on failure` test and add:

- `onAvatarFileSelected shows backend message when API returns 400 "Invalid file type."`
- `onAvatarFileSelected shows backend message when API returns 400 "File exceeds 2 MB limit."`
- `onAvatarFileSelected shows "Avatar upload failed" when API returns 500`

Run with: `npx jest --config jest.config.js --testPathPatterns=player-profile.component`

---

## Frontend E2E Tests (Playwright)

No new E2E spec file required. This is a pure error-message refinement with no new UI components or routes. Unit tests are sufficient coverage.

---

## Verification Checklist

- [ ] `/build` — 0 errors on both .NET and Angular
- [ ] `npx jest --config jest.config.js --testPathPatterns=store-detail.component` — all pass
- [ ] `npx jest --config jest.config.js --testPathPatterns=player-profile.component` — all pass
- [ ] `/check-zone` — no missing `cdr.detectChanges()` calls in modified components
