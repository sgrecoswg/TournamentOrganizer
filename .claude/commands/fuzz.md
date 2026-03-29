---
description: Backend fuzzing — FsCheck property-based tests + live HTTP endpoint fuzzing. Auto-starts the API, fuzzes all endpoints with crafted payloads, kills the API, then creates GitHub issues for every finding.
---

Perform a two-phase fuzz test of the Tournament Organizer .NET API. Find edge-case crashes, validation gaps, and unexpected behaviour that static analysis cannot catch.

---

## Persona

You are a senior security engineer specialising in fuzz testing and API robustness. You are looking for crashes (500s), validation bypasses (invalid input accepted as 200), data leakage in error messages, and slow-response denial-of-service vectors. Be precise — flag only real, reproducible anomalies, not theoretical concerns.

---

## Phase 1 — FsCheck property-based tests (offline)

### Step 1a — Add FsCheck to the test project

```bash
cd c:/Dev/AI/TournamentOrganizer
dotnet add src/TournamentOrganizer.Tests/TournamentOrganizer.Tests.csproj package FsCheck --version 3.*
dotnet add src/TournamentOrganizer.Tests/TournamentOrganizer.Tests.csproj package FsCheck.Xunit --version 3.*
```

### Step 1b — Write FuzzTests.cs

Create `src/TournamentOrganizer.Tests/FuzzTests.cs` with properties covering:

1. **TrueSkill invariants** — for any list of 2–4 distinct finish positions (1-indexed), `TrueSkillCalculator.CalculateNewRatings` must not throw. The player who finished 1st must end with a higher or equal Mu than when they started vs all other players in the same game. Mu and Sigma must always be positive finite doubles.

2. **Player HTTP layer** — using `WebApplicationFactory<Program>`, for any non-null string `name` (up to 200 chars) and any string `email`, `POST /api/players` must return 200 or 400, never 500. The response body must be valid JSON.

3. **Event creation HTTP layer** — for any non-null string `name`, `POST /api/events` with arbitrary format and date values must return 200, 400, or 401, never 500.

4. **Pod formation invariants** — for any player count between 3 and 20, pod formation must produce pods where every pod has 3, 4, or 5 players and the total player count across all pods equals the input count.

5. **Scoring invariants** — for any pod result where finish positions are a permutation of 1..N (N=3,4,5), the total points awarded must equal the sum of (5-position) for each position, and no player receives negative points.

Use `[Property]` attribute from FsCheck.Xunit. Use `Prop.ForAll` with `Arb.Generate` for custom generators where needed. Use `WebApplicationFactory<Program>` with in-memory database for HTTP-layer properties.

### Step 1c — Run property tests

```bash
cd c:/Dev/AI/TournamentOrganizer
dotnet test src/TournamentOrganizer.Tests/ --filter "FullyQualifiedName~FuzzTests" --logger "console;verbosity=detailed" 2>&1
```

Capture all failures. Each failure is a finding with the falsifying input FsCheck reports.

---

## Phase 2 — Live HTTP endpoint fuzzing

### Step 2a — Start the API in the background

```bash
cd c:/Dev/AI/TournamentOrganizer
dotnet run --project src/TournamentOrganizer.Api/ > /tmp/fuzz-api.log 2>&1 &
API_PID=$!
echo "API_PID=$API_PID"
```

Poll until ready (max 90 seconds):
```bash
WAITED=0
until curl -s -o /dev/null -w "%{http_code}" http://localhost:5021/swagger/index.html 2>/dev/null | grep -q "200"; do
  sleep 3
  WAITED=$((WAITED + 3))
  if [ $WAITED -ge 90 ]; then
    echo "ERROR: API did not start within 90s"; kill $API_PID 2>/dev/null; exit 1
  fi
done
echo "API ready after ${WAITED}s"
```

### Step 2b — Discover endpoints from OpenAPI spec

```bash
curl -s http://localhost:5021/swagger/v1/swagger.json > /tmp/openapi.json 2>&1
```

Parse `/tmp/openapi.json`. Extract every `{path, method, parameters, requestBody schema}` tuple. Group by controller (first path segment after `/api/`).

### Step 2c — Fuzz all endpoints (parallel agents)

Launch one fuzzing sub-agent per controller group using `model: sonnet`. Each agent receives:
- The list of `{path, method, parameters, requestBody}` for its controller group
- The full payload battery below
- Instructions to run every payload against every parameter and capture anomalies

**Payload battery — apply to every string parameter and every string field in request bodies:**

| Category | Payloads |
|---|---|
| Empty / whitespace | `""`, `" "`, `"\t"`, `"\n"`, `"\r\n"` |
| Oversized | 10 001-character string of `a`, 100 001-character string of `a` |
| Null byte | `"\u0000"`, `"abc\u0000def"` |
| SQL metacharacters | `"' OR '1'='1"`, `"'; DROP TABLE Players--"`, `"1; SELECT * FROM Players--"` |
| XSS | `"<script>alert(1)</script>"`, `"<img src=x onerror=alert(1)>"`, `"javascript:alert(1)"` |
| Path traversal | `"../../../etc/passwd"`, `"..\\..\\windows\\win.ini"`, `"%2e%2e%2f%2e%2e%2f"` |
| Template injection | `"{{7*7}}"`, `"${7*7}"`, `"#{7*7}"`, `"<%= 7*7 %>"` |
| Unicode edge cases | `"\uFFFD"`, `"\u202E"` (RTL override), `"\u0000"`, 500-char emoji string |
| Format strings | `"%s%s%s%s"`, `"%d%d%d%d"`, `"%n%n%n%n"` |

**Payload battery — apply to every integer parameter:**

| Category | Values |
|---|---|
| Boundary | `0`, `-1`, `-2147483648`, `2147483647`, `9999999999`, `9223372036854775807` |
| Type confusion | send string `"abc"`, send float `1.5`, send boolean `true`, send array `[1,2,3]`, send null |

**Payload battery — structural (for JSON request bodies):**
- Omit each required field individually
- Send completely empty object `{}`
- Send `null` as the body
- Send an array `[]` instead of an object
- Add 50 extra unknown fields
- Deeply nest the expected object 10 levels: `{"a":{"a":{"a":{"a":{...actual body...}}}}}`

**For each request, record:**
- HTTP status code
- Response time (ms)
- First 500 chars of response body
- Whether the response body contains stack trace indicators: `at `, `Exception`, `System.`, `Microsoft.`, column names, file paths

**Flag as a finding if ANY of these are true:**
- Status 500 on any endpoint
- Status 200 on a write endpoint (POST/PUT/PATCH/DELETE) with an obviously invalid payload (empty object, null body, SQL injection string as an ID)
- Response body contains stack trace indicators (`at `, `System.`, `Exception:`, `-->`)
- Response body contains SQL keywords in an error context (`syntax error`, `invalid column`, `invalid object name`)
- Response time > 5 000ms (potential ReDoS or resource exhaustion)
- A 401 endpoint returns 200 when called without a token (auth bypass)

Each finding format:
```json
{"severity":"HIGH","title":"Short title","location":"METHOD /api/path","description":"What input caused what response","payload":"<the exact payload>","response_snippet":"<first 300 chars of response>","suggested_fix":"Concrete fix"}
```

### Step 2d — Shut down the API

```bash
kill $API_PID 2>/dev/null
wait $API_PID 2>/dev/null
echo "API stopped"
```

---

## Phase 3 — Consolidate findings

Merge FsCheck failures (Phase 1) and HTTP fuzzing findings (Phase 2) into a single deduplicated list.

**Severity guide:**

| Severity | Criteria |
|---|---|
| CRITICAL | Stack trace or SQL schema details in response body; auth bypass (200 without token on protected endpoint) |
| HIGH | 500 error on any endpoint with crafted input; SQL/exception detail in 400/422 response |
| MEDIUM | Validation bypass (invalid data accepted as 200 with no error); response time > 5 000ms; FsCheck property falsified |
| LOW | Inconsistent status codes for same error class; verbose but non-sensitive error messages |

Drop INFO — do not create issues.

Print the full tiered summary to terminal before creating any issues.

---

## Phase 4 — Deduplicate against existing issues

```bash
gh issue list --repo SensibleProgramming/TournamentOrganizer \
  --label security --state open --json title --jq '.[].title'
```

Skip any finding whose `[Fuzz][SEVERITY] <title>` matches an existing open issue title exactly.

---

## Phase 5 — Create GitHub issues and add to board (parallel)

For each remaining finding, launch one `model: haiku` sub-agent in parallel. Each agent creates the issue AND adds it to the project board before returning.

**Issue title format:** `[Fuzz][SEVERITY] <title>`

**Per-finding agent prompt template:**

> Create a single GitHub issue and add it to the project board. Do nothing else.
>
> **Finding:**
> - Severity: `<SEVERITY>`
> - Title: `<title>`
> - Location: `<METHOD /api/path or test class:property>`
> - Description: `<description>`
> - Payload / falsifying input: `<exact input>`
> - Response / failure: `<what happened>`
> - Suggested fix: `<fix>`
>
> Step 1 — Create issue:
> ```bash
> gh issue create \
>   --repo SensibleProgramming/TournamentOrganizer \
>   --title "[Fuzz][<SEVERITY>] <title>" \
>   --body "$(cat <<'BODY'
> ## Summary
> <description>
>
> ## Location
> <location>
>
> ## Reproduction
> **Payload / falsifying input:**
> ```
> <payload>
> ```
> **Observed response:**
> ```
> <response snippet>
> ```
>
> ## Suggested Fix
> <fix>
>
> ---
> *Found by `/fuzz` on <today's date>*
> BODY
> )" \
>   --label "security" --label "<type-label>" --label "<priority-label>"
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
>   --id "$ITEM_ID" \
>   --field-id PVTSSF_lADOECHdcM4BSqCszhAIG6Q \
>   --single-select-option-id f75ad846
> ```
>
> Step 4 — Set Priority:
> ```bash
> gh project item-edit --project-id PVT_kwDOECHdcM4BSqCs \
>   --id "$ITEM_ID" \
>   --field-id PVTSSF_lADOECHdcM4BSqCszhAIG64 \
>   --single-select-option-id <option-id>
> ```
> Priority IDs: CRITICAL=`f0632831` HIGH=`9cda3662` MEDIUM=`33db6854` LOW=`60447b02`
>
> **Return:** `#<N> | <SEVERITY> | <title>`

Wait for all agents to complete, collect return values.

---

## Phase 6 — Final report

```
FUZZ TEST COMPLETE
==================
Date: <date>

PHASE 1 — FsCheck property-based tests
  Properties tested : N
  Failures          : N
  Falsifying inputs : <list>

PHASE 2 — HTTP endpoint fuzzing
  Endpoints fuzzed  : N
  Requests sent     : N (approx)
  Anomalies found   : N

FINDINGS
  Critical : N
  High     : N
  Medium   : N
  Low      : N

ISSUES CREATED
  #NNN  [CRITICAL] <title>
  ...

All findings added to project board at Backlog.
```

---

## Rules

- Never modify application source files other than adding `FuzzTests.cs` and the FsCheck NuGet reference.
- Always kill the API process in Phase 2d — even if fuzzing fails partway through. Use a trap if necessary.
- Do not flag 401/403 responses as findings — these are correct behaviour for protected endpoints.
- Do not flag 400/422 responses as findings unless the response body contains sensitive internal detail.
- Do not create duplicate issues — check Phase 4 first.
