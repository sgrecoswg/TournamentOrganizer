Run Playwright end-to-end tests for the Angular frontend. Report pass/fail results and any actionable errors.

## Usage
- `/e2e` — run all E2E tests under `tournament-client/e2e/`
- `/e2e stores` — run only the store tests (`e2e/stores/`)
- `/e2e <path-or-pattern>` — run a specific file or folder, e.g. `/e2e e2e/stores/store-list.spec.ts`

## Prerequisites
The Angular dev server must be reachable at `http://localhost:4200`. The `webServer` block in `playwright.config.ts` will start it automatically if it is not already running — but if `npm start` is already running in another terminal, Playwright will reuse it (`reuseExistingServer: true`).

The .NET API does **not** need to be running — all API calls in E2E tests are intercepted by `page.route()` mocks.

## Steps

1. **Resolve the test target**
   - If `$ARGUMENTS` is provided: pass it as the path/pattern argument to `playwright test`.
   - If `$ARGUMENTS` is empty: run all tests (no extra argument).

2. **Run the tests** from `tournament-client/`:
   ```bash
   cd tournament-client && npx playwright test $ARGUMENTS --reporter=list
   ```
   Use `--reporter=list` for concise terminal output.

3. **Report results**
   - State the total counts: passed, failed, skipped.
   - For each **failed** test, show:
     - Test name and file path
     - The assertion that failed (Expected / Received)
     - Any relevant error message or stack hint
   - If all tests pass, confirm with the count and a one-line summary.

4. **On failure — diagnose and fix**
   - If the failure is a selector not found / timeout: check whether the component template uses the expected ARIA role, label, or text. Read the component template and adjust the selector in the spec.
   - If the failure is a network/route error: verify the `page.route()` mock covers the request URL pattern.
   - If the failure is a TypeScript compile error: fix the type issue in the spec or helper file.
   - After fixing, re-run the affected spec to confirm it passes before proceeding.

5. **Do not open the HTML report** unless the user explicitly asks for it (`npm run e2e:report`).
