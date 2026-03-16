# Feature: Player Avatar Upload

## Context
Players currently have no visual identity in the app. This adds an avatar image to each player's profile: the player can upload or replace their own avatar, and StoreManagers and Administrators can upload/remove avatars for any player at their store. The avatar is displayed on the player profile page, and as a small thumbnail on the leaderboard and player list.

**Pattern:** Mirrors the existing store logo upload feature exactly (`POST /api/stores/{id}/logo`, `StoresService.UpdateLogoUrlAsync`, static file serving via `/logos/`). Reuse that implementation as the reference.

> **Browser cache-busting (mandatory):** The server always overwrites the same file path (`/avatars/{id}.ext`), so the browser will serve the old image from cache if the URL stays the same. Every place the `avatarUrl` is set from an API response must append `?t=<Date.now()>` to force a re-fetch. Apply this in:
> - `onAvatarFileSelected()` success handler — after upload
> - `ngOnInit` profile-load success — on page load / navigate-back
> Any "viewer" component (leaderboard, player list) that exposes the URL via a getter should use a per-session constant `private readonly sessionTs = Date.now()` and apply `?t=${this.sessionTs}` to any URL that doesn't already contain `?t=`, so `Date.now()` is not called on every change-detection cycle.

---

## Requirements

- Allowed file types: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`
- Max file size: 2 MB
- File saved to: `{webRoot}/avatars/{playerId}{extension}` (overwrite on re-upload)
- Served at: `/avatars/{playerId}.{ext}` via static file middleware (same pattern as `/logos/`)
- **Upload / replace**: Player can upload their own; StoreManager can upload for any player at their store; Administrator can upload for any player
- **Remove**: Player can remove their own; StoreManager/Administrator same rules as above; removal sets `AvatarUrl = null` and deletes the file
- Display: rounded avatar image on player profile; fallback to a `mat-icon` person icon when null
- Small avatar thumbnail (32px) on leaderboard rows and player list rows (next to player name)
- **No database schema changes beyond the migration below**

---

## Backend (`src/TournamentOrganizer.Api/`)

### Database / EF Core

**Modify `Models/Player.cs`** — add field:
```csharp
public string? AvatarUrl { get; set; }
```

Run: `/migrate AddAvatarUrlToPlayer`
No data backfill needed — new column defaults to null.

### DTOs (`DTOs/PlayerDto.cs`)

- **`PlayerDto`** (positional record) — append `string? AvatarUrl = null` as last param
- **`PlayerProfileDto`** — append `string? AvatarUrl = null` as last param

> `UpdatePlayerDto` does **not** get `AvatarUrl` — avatar is managed via dedicated upload/remove endpoints, not the general update.

### Service (`Services/PlayerService.cs` — add two methods)

**`UpdateAvatarUrlAsync(int playerId, string? avatarUrl)`**
- Fetch player by ID; throw `KeyNotFoundException` if not found
- Set `player.AvatarUrl = avatarUrl`
- Persist via `_playerRepo.UpdateAsync(player)`
- Return updated `PlayerDto`

Also update `ToDto(Player)` helper to include `AvatarUrl`.
Also update `GetProfileAsync` mapping to include `AvatarUrl`.

### Controller (`Controllers/PlayersController.cs` — add two actions)

```csharp
[HttpPost("{id}/avatar")]
[Authorize]
public async Task<ActionResult<PlayerDto>> UploadAvatar(int id, IFormFile avatar)
{
    if (!await UserCanManagePlayerAsync(id)) return Forbid();
    if (avatar == null || avatar.Length == 0) return BadRequest("No file provided.");
    if (avatar.Length > 2097152) return BadRequest("File exceeds 2 MB limit.");

    var ext = Path.GetExtension(avatar.FileName).ToLowerInvariant();
    if (!new[] { ".png", ".jpg", ".jpeg", ".gif", ".webp" }.Contains(ext))
        return BadRequest("Invalid file type.");

    var webRoot = _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
    Directory.CreateDirectory(Path.Combine(webRoot, "avatars"));
    var fileName = $"{id}{ext}";
    var filePath = Path.Combine(webRoot, "avatars", fileName);
    using (var stream = new FileStream(filePath, FileMode.Create))
        await avatar.CopyToAsync(stream);

    var url = $"/avatars/{fileName}";
    var dto = await _playerService.UpdateAvatarUrlAsync(id, url);
    return Ok(dto);
}

[HttpDelete("{id}/avatar")]
[Authorize]
public async Task<ActionResult<PlayerDto>> RemoveAvatar(int id)
{
    if (!await UserCanManagePlayerAsync(id)) return Forbid();

    var player = await _playerService.GetByIdAsync(id);
    if (player == null) return NotFound();

    if (player.AvatarUrl != null)
    {
        var webRoot = _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
        var filePath = Path.Combine(webRoot, player.AvatarUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));
        if (System.IO.File.Exists(filePath)) System.IO.File.Delete(filePath);
    }

    var dto = await _playerService.UpdateAvatarUrlAsync(id, null);
    return Ok(dto);
}
```

**`UserCanManagePlayerAsync(int playerId)` helper** — add private method to controller:
```csharp
private async Task<bool> UserCanManagePlayerAsync(int playerId)
{
    if (User.HasClaim("role", "Administrator")) return true;
    if (User.HasClaim("role", "StoreManager"))
    {
        // StoreManager can manage players registered at their store
        var storeId = int.Parse(User.FindFirstValue("storeId") ?? "0");
        return await _playerService.IsPlayerAtStoreAsync(playerId, storeId);
    }
    // Player can manage their own avatar
    var playerEmail = User.FindFirstValue(ClaimTypes.Email)
                   ?? User.FindFirstValue("email");
    return await _playerService.IsPlayerEmailAsync(playerId, playerEmail);
}
```

Add to `PlayerService` / `IPlayerService`:
- `GetByIdAsync(int id)` — if not already present (check first; reuse if exists)
- `IsPlayerAtStoreAsync(int playerId, int storeId)` — returns true if player has an `EventRegistration` at an event belonging to the store, OR if `AppUser.storeId == storeId` for the linked user — use whichever join is simpler given current schema
- `IsPlayerEmailAsync(int playerId, string? email)` — returns true if `player.Email == email`

**Inject `IWebHostEnvironment`** into `PlayersController` constructor (same as `StoresController`).

### Static Files (`Program.cs`)

Add `/avatars` static file serving alongside the existing `/logos` block:
```csharp
var avatarsPath = Path.Combine(env.WebRootPath
    ?? Path.Combine(env.ContentRootPath, "wwwroot"), "avatars");
Directory.CreateDirectory(avatarsPath);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(avatarsPath),
    RequestPath  = "/avatars"
});
```

### API Service (`core/services/api.service.ts`)

```typescript
uploadPlayerAvatar(playerId: number, file: File): Observable<PlayerDto> {
  const form = new FormData();
  form.append('avatar', file);
  return this.http.post<PlayerDto>(`${this.base}/players/${playerId}/avatar`, form);
}

removePlayerAvatar(playerId: number): Observable<PlayerDto> {
  return this.http.delete<PlayerDto>(`${this.base}/players/${playerId}/avatar`);
}
```

### Proxy (`tournament-client/proxy.conf.json`)

Add `/avatars` path (same pattern as `/logos`):
```json
"/avatars": {
  "target": "http://localhost:5021",
  "secure": false,
  "changeOrigin": true
}
```

---

## Frontend (`tournament-client/src/app/`)

### Models (`core/models/api.models.ts`)

- `PlayerDto`: add `avatarUrl?: string | null`
- `PlayerProfile`: add `avatarUrl?: string | null`

### `player-profile.component.ts`

**New state:**
```typescript
uploadingAvatar = false;
```

**Visibility helpers:**
```typescript
get canManageAvatar(): boolean {
  if (this.authService.isAdmin) return true;
  if (this.authService.isStoreManager) return true;
  // Player can manage their own
  return this.authService.currentUser?.email === this.profile?.email;
}
```

**New methods:**

```typescript
onAvatarFileSelected(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file || !this.profile) return;
  this.uploadingAvatar = true;
  this.cdr.detectChanges();
  this.apiService.uploadPlayerAvatar(this.profile.id, file).subscribe({
    next: (dto) => {
      this.profile!.avatarUrl = dto.avatarUrl ?? null;
      this.uploadingAvatar = false;
      this.snackBar.open('Avatar updated.', 'Close', { duration: 3000 });
      this.cdr.detectChanges();
    },
    error: () => {
      this.uploadingAvatar = false;
      this.snackBar.open('Upload failed. Check file type and size.', 'Close', { duration: 4000 });
      this.cdr.detectChanges();
    }
  });
}

removeAvatar(): void {
  if (!this.profile) return;
  this.apiService.removePlayerAvatar(this.profile.id).subscribe({
    next: (dto) => {
      this.profile!.avatarUrl = dto.avatarUrl ?? null;
      this.snackBar.open('Avatar removed.', 'Close', { duration: 3000 });
      this.cdr.detectChanges();
    },
    error: () => {
      this.snackBar.open('Failed to remove avatar.', 'Close', { duration: 4000 });
      this.cdr.detectChanges();
    }
  });
}
```

**Template — avatar section** (add at top of profile card, above the player name):
```html
<div class="avatar-section">
  @if (profile?.avatarUrl) {
    <img [src]="profile.avatarUrl" alt="Avatar" class="player-avatar" />
  } @else {
    <div class="player-avatar player-avatar-placeholder">
      <mat-icon>person</mat-icon>
    </div>
  }

  @if (canManageAvatar) {
    <div class="avatar-actions">
      <button mat-icon-button
              matTooltip="Upload avatar"
              (click)="avatarInput.click()"
              [disabled]="uploadingAvatar">
        <mat-icon>upload</mat-icon>
      </button>
      <input #avatarInput
             type="file"
             accept=".png,.jpg,.jpeg,.gif,.webp"
             style="display:none"
             (change)="onAvatarFileSelected($event)" />
      @if (profile?.avatarUrl) {
        <button mat-icon-button
                matTooltip="Remove avatar"
                color="warn"
                (click)="removeAvatar()">
          <mat-icon>delete</mat-icon>
        </button>
      }
    </div>
  }
</div>
```

**Template selectors (must match tests exactly):**
- Avatar image: `img.player-avatar`
- Avatar placeholder: `div.player-avatar-placeholder`
- Upload button tooltip: `Upload avatar`
- Hidden file input: `input[type="file"][accept=".png,.jpg,.jpeg,.gif,.webp"]`
- Remove button tooltip: `Remove avatar`

**Styles (add to `player-profile.component.scss`):**
```scss
.avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}
.player-avatar {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--mat-sys-outline-variant);
}
.player-avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--mat-sys-surface-variant);
  mat-icon { font-size: 48px; width: 48px; height: 48px; }
}
.avatar-actions {
  display: flex;
  gap: 4px;
}
```

### Leaderboard and Player List — avatar thumbnails

In **`leaderboard.component.ts`** template, add a 32px thumbnail next to each player name:
```html
@if (player.avatarUrl) {
  <img [src]="player.avatarUrl" class="avatar-thumb" [alt]="player.name" />
} @else {
  <mat-icon class="avatar-thumb-icon">person</mat-icon>
}
<span>{{ player.name }}</span>
```

In **`players.component.ts`** template (player list/table), same pattern.

Add to shared styles or component `scss`:
```scss
.avatar-thumb      { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; vertical-align: middle; margin-right: 8px; }
.avatar-thumb-icon { font-size: 32px; width: 32px; height: 32px; vertical-align: middle; margin-right: 8px; }
```

### Post-implementation checklist
- [ ] `/check-zone player-profile.component.ts`
- [ ] `/check-zone leaderboard.component.ts`
- [ ] `/check-zone players.component.ts`

---

## Backend Unit Tests (`src/TournamentOrganizer.Tests/`)

**`PlayerAvatarTests`** — write before implementation:

- `UpdateAvatarUrlAsync_SetsUrl_ReturnsUpdatedDto`
- `UpdateAvatarUrlAsync_SetNull_ClearsUrl`
- `UpdateAvatarUrlAsync_PlayerNotFound_ThrowsKeyNotFoundException`
- `IsPlayerEmailAsync_MatchingEmail_ReturnsTrue`
- `IsPlayerEmailAsync_WrongEmail_ReturnsFalse`
- `IsPlayerAtStoreAsync_PlayerRegisteredAtStore_ReturnsTrue`
- `IsPlayerAtStoreAsync_PlayerNotAtStore_ReturnsFalse`

Run with: `dotnet test --filter "FullyQualifiedName~PlayerAvatarTests"`

---

## Frontend Unit Tests (Jest)

**`player-profile.component.spec.ts`** — add describe block `'Avatar'`:

- Avatar `img` rendered when `profile.avatarUrl` is set
- Placeholder `div.player-avatar-placeholder` rendered when `avatarUrl` is null
- Upload button visible when `canManageAvatar` is true (own player, StoreManager, Admin)
- Upload button NOT visible for a different player viewed by a Player role
- Remove button visible when `avatarUrl` is set and `canManageAvatar` is true
- Remove button absent when `avatarUrl` is null
- `onAvatarFileSelected` calls `apiService.uploadPlayerAvatar` and updates `profile.avatarUrl` on success
- `onAvatarFileSelected` shows error snackbar on failure
- `removeAvatar` calls `apiService.removePlayerAvatar` and clears `profile.avatarUrl` on success

Run with: `npx jest --config jest.config.js --testPathPatterns=player-profile`

---

## Playwright E2E Tests

**File: `e2e/players/player-profile.spec.ts`** — add describe blocks (create file if it doesn't exist; may already exist from `store-licensing-tiers.md` work)

New helpers needed in `e2e/helpers/api-mock.ts`:
```typescript
mockGetPlayerProfile(page, player: PlayerProfile)    // GET /api/players/:id/profile
mockUploadPlayerAvatar(page, playerId, response: PlayerDto)  // POST /api/players/:id/avatar
mockRemovePlayerAvatar(page, playerId, response: PlayerDto)  // DELETE /api/players/:id/avatar
makePlayerProfileDto(overrides?)      // fixture builder — include avatarUrl field
```

`loginAs` as `'Player'`, `'StoreManager'`, or `'Administrator'` as needed per describe block.

| Describe | beforeEach | Tests |
|---|---|---|
| `Player Profile — avatar: display` | `loginAs('Player')`, `mockGetPlayerProfile({ avatarUrl: '/avatars/1.png' })` | `img.player-avatar` visible with correct `src`; placeholder absent |
| `Player Profile — avatar: placeholder` | `mockGetPlayerProfile({ avatarUrl: null })` | `div.player-avatar-placeholder` visible; `img.player-avatar` absent |
| `Player Profile — avatar: upload (own player)` | `loginAs('Player', { email: 'alice@shop.com' })`, profile email matches | upload button visible; file input present; setting file triggers `POST /api/players/1/avatar`; updated avatar `src` shown after response |
| `Player Profile — avatar: upload (StoreManager)` | `loginAs('StoreManager', { storeId: 1 })`, `mockUploadPlayerAvatar` | upload button visible; confirm API called |
| `Player Profile — avatar: upload (Admin)` | `loginAs('Administrator')` | upload button visible |
| `Player Profile — avatar: role gate` | `loginAs('Player', { email: 'other@shop.com' })`, profile belongs to different player | upload button NOT visible; remove button NOT visible |
| `Player Profile — avatar: remove` | `loginAs('StoreManager')`, `mockGetPlayerProfile({ avatarUrl: '/avatars/1.png' })`, `mockRemovePlayerAvatar` | remove button visible; clicking it fires `DELETE /api/players/1/avatar`; placeholder shown after response |

Run with: `/e2e e2e/players/player-profile.spec.ts`

---

## Verification Checklist

- [ ] Failing tests confirmed red before implementation (TDD)
- [ ] `/migrate AddAvatarUrlToPlayer` — applied
- [ ] `/build` — 0 errors
- [ ] `dotnet test --filter "FullyQualifiedName~PlayerAvatarTests"` — all pass
- [ ] `npx jest --config jest.config.js --testPathPatterns=player-profile` — all pass
- [ ] `npx jest --config jest.config.js` — full suite green
- [ ] `/check-zone player-profile.component.ts` — clean
- [ ] `/check-zone leaderboard.component.ts` — clean
- [ ] `/check-zone players.component.ts` — clean
- [ ] `/e2e e2e/players/player-profile.spec.ts` — all pass
