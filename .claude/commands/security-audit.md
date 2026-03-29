---
description: Full security audit — OWASP Top 10, dependency CVEs, auth/injection/secrets scan across .NET API + Angular. Creates prioritised GitHub issues for every finding.
---

Perform a comprehensive security audit of the Tournament Organizer project (backend .NET API + Angular frontend). Find vulnerabilities, classify by severity, and create tracked GitHub issues for every finding.

---

## Persona

You are a senior application security engineer with expertise in OWASP Top 10, .NET/ASP.NET Core security hardening, and Angular secure coding practices. Be thorough but pragmatic — flag real, exploitable issues; do not flag theoretical non-issues or best-practice opinions unless they represent genuine risk.

---

## Phase 1 — Ensure labels exist

Before creating any issues, ensure the required labels exist on the repo. Create any that are missing:

```bash
# security label
gh label list --repo SensibleProgramming/TournamentOrganizer --json name --jq '.[].name' | grep -q "^security$" \
  || gh label create security --repo SensibleProgramming/TournamentOrganizer --color "e11d48" --description "Security vulnerability or hardening task"

# priority: P4 label (P1-P3 already exist)
gh label list --repo SensibleProgramming/TournamentOrganizer --json name --jq '.[].name' | grep -q "^priority: P4$" \
  || gh label create "priority: P4" --repo SensibleProgramming/TournamentOrganizer --color "6b7280" --description "Low priority"
```

---

## Phase 2 — Automated dependency scans (run in parallel)

Run both scanners simultaneously and capture all output.

**Backend — vulnerable NuGet packages:**
```bash
cd c:/Dev/AI/TournamentOrganizer
dotnet list package --vulnerable --include-transitive 2>&1
```

**Frontend — npm audit:**
```bash
cd c:/Dev/AI/TournamentOrganizer/tournament-client
npm audit --json 2>&1
```

Parse and retain:
- Every vulnerable package name, version, severity, and advisory URL.
- npm audit: `high` and `critical` advisories; include `moderate` for direct dependencies.

---

## Phase 3 — Static code analysis (run all agents in parallel)

Launch **five** parallel sub-agents using `model: sonnet`. Each agent must search the codebase, identify findings, and return a structured list. Do NOT implement fixes — analysis only.

**Use `Grep`, `Glob`, and `Read` tools** for all codebase searches — do not use `bash grep` or `bash find`.

Each finding must be returned as a JSON object, one per line:
```json
{"severity":"HIGH","title":"Short title","location":"src/Foo/Bar.cs:42","description":"What is wrong and why it matters","suggested_fix":"Concrete fix with code example","owasp":"A01:2021"}
```

Where `severity` is one of: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `INFO`.

**Do NOT report:**
- Issues caught at compile time (type errors, missing imports)
- Code style or formatting issues
- Hypothetical risks with no realistic attack vector in this application
- Issues already guarded by the framework (e.g. EF Core LINQ parameterises automatically)
- Findings in test files (`*.spec.ts`, `*.Tests/`)
- Missing documentation or comments

---

### Agent 1 — Authentication & Authorization (backend)

Scan `src/TournamentOrganizer.Api/` for:

1. **Missing [Authorize]** — Controllers or actions that mutate state (POST/PUT/DELETE/PATCH) but have no `[Authorize]` or `[AllowAnonymous]` attribute. Read every Controller file.
2. **JWT configuration weaknesses** — Check `Program.cs` and any auth setup for: missing audience/issuer validation, symmetric key length < 256 bits, missing expiry validation, `ValidateLifetime = false`.
3. **Insecure CORS** — `AllowAnyOrigin()` combined with `AllowCredentials()` is a CRITICAL misconfiguration. `AllowAnyOrigin()` alone on non-public endpoints is HIGH. Check `Program.cs`.
4. **Overly permissive role checks** — hardcoded role strings that could be confused or bypassed.
5. **Missing anti-forgery** — state-changing endpoints that accept form posts without CSRF protection.

---

### Agent 2 — Injection & Input Validation (backend)

Scan `src/TournamentOrganizer.Api/` for:

1. **SQL injection** — Raw SQL via `ExecuteSqlRaw`, `FromSqlRaw`, `ExecuteSqlInterpolated` with non-parameterised string concatenation. EF Core LINQ is safe; flag only raw SQL.
2. **Missing model validation** — Controller actions that accept complex DTOs but never check `ModelState.IsValid` or lack `[ApiController]` (which auto-validates). Check each controller.
3. **Mass assignment** — Binding EF entity models directly from request bodies (not DTOs). Flag any action parameter that is an EF `Model` type rather than a DTO.
4. **Path traversal** — Any file read/write that uses user-supplied path segments without sanitisation.
5. **Log injection** — User-controlled strings passed directly to `ILogger` without sanitisation (can corrupt structured log output).

---

### Agent 3 — Sensitive Data & Secrets (both layers)

Scan the entire repository (`src/` and `tournament-client/`) for:

1. **Hardcoded secrets** — Passwords, API keys, connection strings, JWT signing keys, OAuth client secrets committed to source. Grep for patterns: `password\s*=`, `secret\s*=`, `apikey`, `connectionstring`, `signing_key` (case-insensitive). Exclude appsettings templates where value is a placeholder like `"your-secret-here"`.
2. **Sensitive data in appsettings.json** — Real credentials in `appsettings.json` or `appsettings.Development.json` (not just placeholders).
3. **Tokens in localStorage** — Angular code that stores JWT or session tokens in `localStorage` or `sessionStorage` (susceptible to XSS theft). Should be httpOnly cookies.
4. **Sensitive fields in API responses** — DTOs or serialised entities that expose `PasswordHash`, `SecurityStamp`, internal IDs, or PII that should be redacted.
5. **Verbose error responses** — Exception middleware or catch blocks that return stack traces or internal exception messages to the client in production.

---

### Agent 4 — Frontend Security (Angular)

Scan `tournament-client/src/` for:

1. **XSS via innerHTML / DOM manipulation** — Direct `[innerHTML]` bindings, `document.write`, or `bypassSecurityTrustHtml/Script/ResourceUrl` calls without necessity. Each use must be justified.
2. **Missing route guards** — Routes in the Angular router (`app.routes.ts` or any routing module) for admin/authenticated features that lack an `AuthGuard` or `canActivate` guard.
3. **Hardcoded credentials/tokens** — API keys, bearer tokens, or base URLs with embedded credentials in `.ts` or `environment.ts` files.
4. **Insecure direct object references (IDOR)** — Components that take an ID from route params and pass it directly to an API call without verifying the user has access (the backend should enforce this, but flag if there's no indication of authorisation checking).
5. **Open redirects** — `window.location.href` or `router.navigate` driven by unvalidated user input or query parameters.
6. **Content Security Policy** — Check `index.html` for a `<meta http-equiv="Content-Security-Policy">` tag. Its absence is a MEDIUM finding.

---

### Agent 5 — Configuration & Infrastructure Hardening

Scan config files and `Program.cs` for:

1. **HTTPS enforcement** — Confirm `app.UseHttpsRedirection()` and `app.UseHsts()` are present and not conditionally disabled in production.
2. **Security headers** — Check that responses include (or middleware adds): `X-Content-Type-Options: nosniff`, `X-Frame-Options`, `Referrer-Policy`. Their absence is LOW/MEDIUM.
3. **Debug/developer middleware in production** — `app.UseDeveloperExceptionPage()` or Swagger enabled without environment gating.
4. **Dependency versions** — Check `TournamentOrganizer.Api.csproj` and `package.json` for packages with known CVEs from Phase 2. Cross-reference.
5. **Database connection string exposure** — Connection string stored in `appsettings.json` vs user-secrets or environment variables.
6. **File upload limits** — If the API accepts file uploads, verify `MaxRequestBodySize` or similar limits are configured.

---

## Phase 4 — Consolidate and classify findings

After all agents and dependency scans return:

1. **Convert dependency scan output** to the same JSON finding format:
   - For each vulnerable NuGet package: `{"severity":"HIGH","title":"Vulnerable NuGet package: <name> <version>","location":"src/TournamentOrganizer.Api/TournamentOrganizer.Api.csproj","description":"<advisory description>","suggested_fix":"Upgrade to <safe version>. Advisory: <url>","owasp":"A06:2021"}`
   - For each npm advisory (high/critical, or moderate for direct deps): `{"severity":"HIGH","title":"Vulnerable npm package: <name> <version>","location":"tournament-client/package.json","description":"<advisory title>","suggested_fix":"Run `npm audit fix` or upgrade to <safe version>. Advisory: <url>","owasp":"A06:2021"}`
2. **Merge** all JSON findings (dependency + agent findings) into a single list.
3. **Deduplicate** — if two findings reference the same file and substantially the same issue, keep the more detailed one.
4. **Classify** each finding using this severity guide:

| Severity | Criteria |
|---|---|
| CRITICAL | Directly exploitable with no authentication required; data breach or full compromise likely |
| HIGH | Exploitable but requires auth or specific conditions; significant impact |
| MEDIUM | Exploitable in combination with other issues; moderate impact |
| LOW | Hardening gap; low direct exploitability; defence-in-depth |
| INFO | Observation only; no exploitability; best practice gap |

4. **Drop INFO findings** — do not create GitHub issues for INFO. Print them in the terminal summary only.
5. Print the full tiered summary to the terminal before creating any issues.

---

## Phase 5 — Deduplicate against existing issues

Before creating anything, fetch all open security issues to avoid duplicates:

```bash
gh issue list --repo SensibleProgramming/TournamentOrganizer \
  --label security --state open --json title --jq '.[].title'
```

Remove any finding whose `[Security][SEVERITY] <title>` exactly matches an existing issue title.

---

## Phase 6 — Create issues and add to board (fully parallel)

For each remaining finding (CRITICAL, HIGH, MEDIUM, LOW), launch one dedicated sub-agent in parallel using `model: haiku`. Each agent is responsible for exactly one finding: create the issue AND add it to the project board before returning.

Pass each agent the following as its complete prompt (substitute the placeholders):

---

**Per-finding agent prompt template:**

> You are creating a single GitHub security issue and adding it to the project board. Do not do anything else.
>
> **Finding:**
> - Severity: `<SEVERITY>`
> - Title: `<finding title>`
> - File/location: `<file:line>`
> - Description: `<description>`
> - Suggested fix: `<suggested fix>`
> - OWASP reference: `<reference or "N/A">`
>
> **Step 1 — Create the GitHub issue:**
> ```bash
> gh issue create \
>   --repo SensibleProgramming/TournamentOrganizer \
>   --title "[Security][<SEVERITY>] <title>" \
>   --body "$(cat <<'BODY'
> ## Summary
> <description>
>
> ## Location
> <file:line>
>
> ## Steps to Reproduce / Exploit Scenario
> <brief exploit scenario>
>
> ## Suggested Fix
> <suggested fix>
>
> ## References
> <OWASP reference>
>
> ---
> *Found by `/security-audit` on <today's date>*
> BODY
> )" \
>   --label "security" \
>   --label "<type-label>" \
>   --label "<priority-label>"
> ```
>
> Label mapping:
> | Severity | type-label | priority-label |
> |---|---|---|
> | CRITICAL | `type: bug` | `priority: P1` |
> | HIGH | `type: bug` | `priority: P2` |
> | MEDIUM | `type: chore` | `priority: P3` |
> | LOW | `type: chore` | `priority: P4` |
>
> Capture the issue number from the output (the URL ends in `/<N>`).
>
> **Step 2 — Add to project board:**
> ```bash
> ITEM_ID=$(gh project item-add 2 --owner SensibleProgramming \
>   --url "https://github.com/SensibleProgramming/TournamentOrganizer/issues/<N>" \
>   --format json --jq '.id')
> ```
>
> **Step 3 — Set Status = Backlog:**
> ```bash
> gh project item-edit --project-id PVT_kwDOECHdcM4BSqCs \
>   --id "$ITEM_ID" \
>   --field-id PVTSSF_lADOECHdcM4BSqCszhAIG6Q \
>   --single-select-option-id f75ad846
> ```
>
> **Step 4 — Set Priority:**
> ```bash
> gh project item-edit --project-id PVT_kwDOECHdcM4BSqCs \
>   --id "$ITEM_ID" \
>   --field-id PVTSSF_lADOECHdcM4BSqCszhAIG64 \
>   --single-select-option-id <option-id>
> ```
> Priority option IDs:
> - CRITICAL → `f0632831`
> - HIGH     → `9cda3662`
> - MEDIUM   → `33db6854`
> - LOW      → `60447b02`
>
> **Return:** `#<issue-number> | <SEVERITY> | <title>`

---

Wait for all per-finding agents to complete, then collect their return values for the final report.

---

## Phase 7 — Final report

Print a summary to the terminal:

```
SECURITY AUDIT COMPLETE
========================
Date: <date>

FINDINGS SUMMARY
  Critical : N  (N issues created)
  High     : N  (N issues created)
  Medium   : N  (N issues created)
  Low      : N  (N issues created)
  Info     : N  (terminal only — no issues created)

DEPENDENCY SCAN
  NuGet vulnerable packages : N
  npm audit advisories      : N (high/critical)

ISSUES CREATED
  #NNN  [CRITICAL] <title>
  #NNN  [HIGH]     <title>
  ...

All findings have been added to the project board (Backlog) with priority set.
Review at: https://github.com/orgs/SensibleProgramming/projects/2
```

---

## Rules

- Never modify any source files — audit only.
- Never commit anything.
- Do not skip Phase 6 — every finding must reach the project board.
- If a Phase 2 automated scan fails (e.g. npm not installed), note the failure in the report and continue.
- If an issue already exists with the same `[Security]` title, skip creating a duplicate (check with `gh issue list --label security --state open --json title`).
