---
description: Angular UI fuzzing — Playwright-driven payload injection into all forms and inputs. Checks for XSS rendering, validation bypass, UI crashes, and console errors. Auto-starts the Angular dev server, fuzzes, then kills it.
---

Perform fuzz testing of the Angular frontend by injecting crafted payloads into every form and user input in the application. Find XSS rendering gaps, client-side validation bypasses, UI crashes, and missing error states.

---

## Persona

You are a senior frontend security engineer specialising in DOM-based XSS, client-side input validation, and Angular template security. Flag real, reproducible issues — not theoretical concerns. All API calls are mocked via `page.route()` so the backend does not need to be running.

---

## Phase 1 — Start the Angular dev server

```bash
cd c:/Dev/AI/TournamentOrganizer/tournament-client
npm start > /tmp/fuzz-angular.log 2>&1 &
NG_PID=$!
echo "NG_PID=$NG_PID"
```

Poll until ready (max 120 seconds):
```bash
WAITED=0
until curl -s -o /dev/null -w "%{http_code}" http://localhost:4200 2>/dev/null | grep -q "200"; do
  sleep 3
  WAITED=$((WAITED + 3))
  if [ $WAITED -ge 120 ]; then
    echo "ERROR: Angular dev server did not start within 120s"
    kill $NG_PID 2>/dev/null
    exit 1
  fi
done
echo "Angular ready after ${WAITED}s"
```

---

## Phase 2 — Discover all forms and inputs

Read the following files to build a complete inventory of interactive inputs before writing any tests:

- `tournament-client/src/app/app.routes.ts` — all routes
- Every `*.component.ts` and `*.component.html` under `tournament-client/src/app/features/`
- `tournament-client/src/app/shared/components/`

For each route/component, identify:
1. **Text inputs** — `<input>`, `<textarea>` bound to form controls or `[(ngModel)]`
2. **Select/dropdown inputs** — `<mat-select>`, `<select>`
3. **File inputs** — `<input type="file">`
4. **Form submission buttons** — what API call they trigger (from the component `.ts`)
5. **Dynamic content rendering** — any `[innerHTML]`, `{{ }}` interpolation of API-sourced data, `*ngFor` over API data

Build this inventory table:

| Component | Route | Input fields | API call on submit | Renders API data |
|---|---|---|---|---|
| ... | ... | ... | ... | ... |

---

## Phase 3 — Write and run the fuzz spec

Create `tournament-client/e2e/fuzz/fuzz-inputs.spec.ts`.

The spec must:
- Import helpers from `e2e/helpers/auth.ts` and `e2e/helpers/api-mock.ts`
- Use `loginAs(page, 'StoreOwner')` to inject a valid JWT for authenticated routes
- Mock all API routes using `page.route()` — return minimal valid fixture data so forms render
- Use `stubUnmatchedApi(page)` registered **before** all feature-specific mocks
- Collect all `page.on('console', ...)` messages during each test (errors are findings)

### Payload battery

Apply **every payload** to **every text input** in every form:

```typescript
const FUZZ_PAYLOADS = [
  // XSS
  '<script>alert("xss")</script>',
  '<img src=x onerror="window.__xss=true">',
  '"><svg onload=alert(1)>',
  'javascript:alert(1)',
  '<iframe src="javascript:alert(1)">',
  // Injection
  "'; DROP TABLE Players--",
  "' OR '1'='1",
  '{{constructor.constructor("alert(1)")()}}',  // Angular template injection attempt
  '${7*7}',
  // Path traversal
  '../../../etc/passwd',
  '..\\..\\windows\\system32',
  // Boundary
  '',                                            // empty
  ' ',                                           // whitespace only
  'a'.repeat(10_001),                           // oversized
  '\u0000',                                      // null byte
  '\u202E' + 'reversed',                         // RTL override
  '😀'.repeat(500),                              // emoji overload
  // Structural
  '{"injected":"json"}',
  '<br><b>bold</b>',
];
```

### For each form × payload combination, the test must:

1. Navigate to the form's route
2. Fill every visible text input with the payload
3. Submit the form (click the primary action button)
4. **Check for XSS execution:**
   ```typescript
   const xssExecuted = await page.evaluate(() => (window as any).__xss === true);
   if (xssExecuted) record finding: CRITICAL XSS
   ```
5. **Check for unescaped HTML in rendered output:**
   - After submission (or after API mock returns the payload as data), look for the payload appearing as raw HTML in the DOM
   - Use: `page.locator('body').innerHTML()` and check if `<script>` or `onerror=` appears verbatim
   - If found: record HIGH XSS rendering finding
6. **Check for console errors:**
   - Any `console.error` during the interaction is a LOW finding
   - Any uncaught Angular error (`ERROR Error:`) is a MEDIUM finding
7. **Check for broken UI state:**
   - If the page URL does not change and no success/error message appears within 3s of submit: MEDIUM (missing error state)
   - If Angular throws `ExpressionChangedAfterItHasBeenCheckedError`: LOW
8. **Check for validation bypass:**
   - If the empty string payload causes a successful API call (mock records the request): MEDIUM (missing required field validation)
   - If the 10 001-char payload causes a successful API call: MEDIUM (missing length validation)

### For file inputs specifically:

Create a minimal test file with a `.js` extension renamed to `.jpg` and attempt upload. If the Angular component accepts it without client-side validation: LOW finding (missing MIME type check — defence-in-depth even though backend should validate).

### For dynamic content rendering (API-sourced data):

For each component that renders API-sourced strings (event names, player names, store names) in the DOM, mock the API to return XSS payloads as field values:

```typescript
// Mock API to return XSS payload as event name
await mockGetEvents(page, [makeEventDto({ name: '<script>alert("xss")</script>' })]);
await page.goto('/events');
// Check if payload executed or rendered unescaped
const xssExecuted = await page.evaluate(() => (window as any).__xss === true);
const innerHTML = await page.locator('body').innerHTML();
const unescaped = innerHTML.includes('<script>alert') || innerHTML.includes('onerror=');
```

Do this for: event names, player names, store names, notification messages, commander names, any field that comes from the API and is displayed to the user.

---

## Phase 4 — Run the fuzz spec

```bash
cd c:/Dev/AI/TournamentOrganizer/tournament-client
npx playwright test e2e/fuzz/fuzz-inputs.spec.ts --reporter=list 2>&1
```

Capture all test failures and all findings collected during the run.

---

## Phase 5 — Shut down the Angular dev server

```bash
kill $NG_PID 2>/dev/null
wait $NG_PID 2>/dev/null
echo "Angular dev server stopped"
```

---

## Phase 6 — Consolidate findings

Merge all findings into a single deduplicated list. Each finding must have:

```json
{"severity":"HIGH","title":"Short title","location":"ComponentName / route","description":"What payload caused what behaviour","payload":"<exact payload>","suggested_fix":"Concrete fix","owasp":"A03:2021"}
```

**Severity guide:**

| Severity | Criteria |
|---|---|
| CRITICAL | XSS payload executed (window.__xss = true) |
| HIGH | Payload rendered unescaped in DOM (`<script>` or `onerror=` in innerHTML) |
| MEDIUM | Angular error thrown; validation bypass (empty/oversized input submits successfully); missing error state on bad input |
| LOW | Console errors; missing client-side MIME check on file upload; Angular ExpressionChanged error |

Drop INFO.

Print tiered summary to terminal before creating issues.

---

## Phase 7 — Deduplicate against existing issues

```bash
gh issue list --repo SensibleProgramming/TournamentOrganizer \
  --label security --state open --json title --jq '.[].title'
```

Skip any finding whose `[FuzzUI][SEVERITY] <title>` matches an existing open issue.

---

## Phase 8 — Create GitHub issues and add to board (parallel)

For each remaining finding, launch one `model: haiku` sub-agent in parallel. Each agent creates the issue AND adds it to the project board.

**Issue title format:** `[FuzzUI][SEVERITY] <title>`

**Per-finding agent prompt template:**

> Create a single GitHub issue and add it to the project board. Do nothing else.
>
> **Finding:**
> - Severity: `<SEVERITY>`
> - Title: `<title>`
> - Component/route: `<location>`
> - Description: `<description>`
> - Payload: `<exact payload>`
> - Observed behaviour: `<what happened>`
> - Suggested fix: `<fix>`
> - OWASP: `<reference>`
>
> Step 1 — Create issue:
> ```bash
> gh issue create \
>   --repo SensibleProgramming/TournamentOrganizer \
>   --title "[FuzzUI][<SEVERITY>] <title>" \
>   --body "$(cat <<'BODY'
> ## Summary
> <description>
>
> ## Location
> <component / route>
>
> ## Reproduction
> **Payload:**
> ```
> <payload>
> ```
> **Observed behaviour:**
> <what happened — XSS executed, unescaped HTML, console error, etc.>
>
> ## Suggested Fix
> <fix>
>
> ## References
> <OWASP reference>
>
> ---
> *Found by `/fuzz-angular` on <today's date>*
> BODY
> )" \
>   --label "security" --label "<type-label>" --label "<priority-label>"
> ```
>
> Label mapping: CRITICAL→`type: bug`,`priority: P1` | HIGH→`type: bug`,`priority: P2` | MEDIUM→`type: chore`,`priority: P3` | LOW→`type: chore`,`priority: P4`
>
> Step 2 — Add to board:
> ```bash
> ITEM_ID=$(gh project item-add 2 --owner SensibleProgramming \
>   --url "https://github.com/SensibleProgramming/TournamentOrganizer/issues/<N>" \
>   --format json --jq '.id')
> ```
>
> Step 3 — Set Status = Backlog:
> ```bash
> gh project item-edit --project-id PVT_kwDOECHdcM4BSqCs \
>   --id "$ITEM_ID" --field-id PVTSSF_lADOECHdcM4BSqCszhAIG6Q \
>   --single-select-option-id f75ad846
> ```
>
> Step 4 — Set Priority:
> ```bash
> gh project item-edit --project-id PVT_kwDOECHdcM4BSqCs \
>   --id "$ITEM_ID" --field-id PVTSSF_lADOECHdcM4BSqCszhAIG64 \
>   --single-select-option-id <option-id>
> ```
> Priority IDs: CRITICAL=`f0632831` HIGH=`9cda3662` MEDIUM=`33db6854` LOW=`60447b02`
>
> **Return:** `#<N> | <SEVERITY> | <title>`

Wait for all agents to complete, collect return values.

---

## Phase 9 — Final report

```
ANGULAR FUZZ TEST COMPLETE
===========================
Date: <date>

FORMS FUZZED     : N
PAYLOADS TESTED  : N per form (N total requests)
COMPONENTS CHECKED for XSS rendering: N

FINDINGS
  Critical (XSS executed)        : N
  High (unescaped HTML in DOM)   : N
  Medium (validation bypass etc) : N
  Low (console errors etc)       : N

ISSUES CREATED
  #NNN  [CRITICAL] <title>
  ...

All findings added to project board at Backlog.
```

---

## Rules

- All API calls must be mocked via `page.route()` — never make real HTTP calls to the backend.
- Always kill the Angular dev server in Phase 5 — even if the fuzz run fails partway. Use a trap if necessary.
- The XSS detection sentinel (`window.__xss`) must be set by a payload that executes, not by Angular detecting the payload as a string.
- Do not flag Angular Material validation error messages (e.g. "This field is required") as findings — these are correct behaviour.
- Do not flag 400 API responses as findings — the mock returns them intentionally.
- Fuzz spec file lives in `e2e/fuzz/` — do not pollute `e2e/events/`, `e2e/players/` etc.
- Use `npx playwright test e2e/fuzz/fuzz-inputs.spec.ts` to run only the fuzz spec.
