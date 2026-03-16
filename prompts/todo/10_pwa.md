# Feature: Progressive Web App (PWA)

## Context
Players use the app at tables during events — usually on a phone with unreliable WiFi. The offline-first architecture (LocalStorageContext) is already in place. Adding a PWA manifest and service worker makes the app installable on Android/iOS and ensures the shell loads instantly even without a connection.

---

## Requirements

- App is installable from browser (Android home screen, iOS "Add to Safari")
- App shell (HTML/CSS/JS bundles) loads from cache when offline
- Service worker uses a **cache-first** strategy for static assets, **network-first** for API calls
- API calls that fail offline fall back gracefully (existing offline handling is not changed)
- `manifest.json` with app name, icons, theme color, display mode `standalone`
- Splash screen and theme color match Angular Material theme
- No changes to business logic — purely a deployment/caching layer

---

## Implementation

### 1. Add Angular PWA support

```bash
cd tournament-client
ng add @angular/pwa
```

This generates:
- `src/manifest.webmanifest`
- `ngsw-config.json` (service worker config)
- Registers `ServiceWorkerModule` in `app.config.ts`

### 2. Configure `manifest.webmanifest`

```json
{
  "name": "Tournament Organizer",
  "short_name": "TourneyOrg",
  "description": "Commander tournament management for game stores",
  "theme_color": "#1976d2",
  "background_color": "#fafafa",
  "display": "standalone",
  "start_url": "/",
  "icons": [
    { "src": "icons/icon-72x72.png",   "sizes": "72x72",   "type": "image/png" },
    { "src": "icons/icon-96x96.png",   "sizes": "96x96",   "type": "image/png" },
    { "src": "icons/icon-128x128.png", "sizes": "128x128", "type": "image/png" },
    { "src": "icons/icon-144x144.png", "sizes": "144x144", "type": "image/png" },
    { "src": "icons/icon-152x152.png", "sizes": "152x152", "type": "image/png" },
    { "src": "icons/icon-192x192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
    { "src": "icons/icon-384x384.png", "sizes": "384x384", "type": "image/png" },
    { "src": "icons/icon-512x512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Create placeholder icons (can be replaced with real artwork later). Use any 512×512 base image and resize.

### 3. Configure `ngsw-config.json`

```json
{
  "index": "/index.html",
  "assetGroups": [
    {
      "name": "app-shell",
      "installMode": "prefetch",
      "updateMode": "prefetch",
      "resources": {
        "files": ["/favicon.ico", "/index.html", "/*.css", "/*.js"]
      }
    },
    {
      "name": "assets",
      "installMode": "lazy",
      "updateMode": "prefetch",
      "resources": {
        "files": ["/assets/**", "/logos/**", "/avatars/**"]
      }
    }
  ],
  "dataGroups": [
    {
      "name": "api-network-first",
      "urls": ["/api/**"],
      "cacheConfig": {
        "strategy": "freshness",
        "maxSize": 100,
        "maxAge": "1h",
        "timeout": "5s"
      }
    }
  ]
}
```

### 4. Add install prompt component (`shared/components/pwa-install-prompt.component.ts`)

```typescript
// Captures the beforeinstallprompt event; shows a "Install App" banner
@HostListener('window:beforeinstallprompt', ['$event'])
onBeforeInstallPrompt(event: Event): void {
  event.preventDefault();
  this.deferredPrompt = event;
  this.showBanner = true;
  this.cdr.detectChanges();
}

install(): void {
  (this.deferredPrompt as any).prompt();
  this.showBanner = false;
}
dismiss(): void {
  this.showBanner = false;
  this.cdr.detectChanges();
}
```

**Template:**
```html
@if (showBanner) {
  <div class="pwa-banner">
    <mat-icon>get_app</mat-icon>
    <span>Install Tournament Organizer for offline use</span>
    <button mat-button (click)="install()">Install</button>
    <button mat-icon-button (click)="dismiss()"><mat-icon>close</mat-icon></button>
  </div>
}
```

Add to `app.html` above the router outlet.

### 5. Service worker update notification

Show a snackbar when a new version is available:
```typescript
// In AppComponent or a dedicated service:
this.swUpdate.versionUpdates.pipe(
  filter(evt => evt.type === 'VERSION_READY')
).subscribe(() => {
  this.snackBar.open('New version available.', 'Reload', { duration: 10000 })
    .onAction().subscribe(() => document.location.reload());
});
```

### 6. Build and test

PWA features only work in a **production build** served over HTTPS (or localhost):
```bash
npm run build
npx http-server dist/tournament-client/browser -p 8080 --ssl
```

Use Chrome DevTools → Application → Service Workers to verify registration.

### Post-implementation checklist
- [ ] `/check-zone pwa-install-prompt.component.ts`

---

## Frontend Unit Tests (Jest)

**`pwa-install-prompt.component.spec.ts`** (new file):
- Banner hidden by default
- Banner shown after `beforeinstallprompt` event fires
- `install()` calls `deferredPrompt.prompt()` and hides banner
- `dismiss()` hides banner

Run with: `npx jest --config jest.config.js --testPathPatterns=pwa-install-prompt`

---

## Playwright E2E Tests

PWA install flow requires browser-level APIs not easily mocked in Playwright. Skip E2E for the install banner. Instead verify:
- Service worker registration: `await page.evaluate(() => navigator.serviceWorker.getRegistration('/'))` returns non-null (in production build test only)
- `manifest.webmanifest` served with correct Content-Type

---

## Verification Checklist
- [ ] `ng add @angular/pwa` completed
- [ ] Icons generated and placed in `src/icons/`
- [ ] `/build` — 0 errors
- [ ] Lighthouse PWA audit in Chrome DevTools — passes installability checks
- [ ] Service worker registers in production build
- [ ] Offline: reload after disconnecting network — app shell loads
- [ ] `/check-zone pwa-install-prompt.component.ts` — clean
