Implement all unblocked Ready items in parallel, each in its own git worktree.

## Step 1 — Fetch all Ready items

```bash
gh project item-list 2 --owner SensibleProgramming --format json \
  --jq '[.items[] | select(.status == "Ready") | {number: .content.number, title: .content.title, body: .content.body, itemId: .id}]'
```

If no Ready items exist → report "Nothing Ready" and stop.

## Step 2 — Load prompt files for all Ready items

For each item, check its body for a `## Prompt file` line with a path like `` `prompts/ignore/NN_<name>.md` ``.

- If found → read the file at that path.
- If missing → skip this item and note it needs a prompt file generated first (run `/implement-next <N>` to generate it).

## Step 3 — Dependency check

For each item with a prompt file, read its `## Dependencies` section.

For each listed issue number `#N`, check if a merged PR referencing it exists on `dev`:
```bash
gh pr list --base dev --state merged --json number,title,body \
  --jq '.[] | select(.body | test("#N")) | "#\(.number) \(.title)"'
```

Classify each item:
- **Unblocked** — no dependencies, or all dependencies merged to `dev`
- **Blocked** — one or more dependencies not yet merged

## Step 4 — File conflict analysis

For each **unblocked** item, read its `## Files Modified` section and build a map of:
```
file path → [list of issue numbers that touch it]
```

Flag any file touched by 2+ items as a **conflict**. Categorise conflicts by risk:
- **Low risk** (additive-only files): `AppDbContext.cs`, `Program.cs`, `api.service.ts`, `api.models.ts`, `api-mock.ts`, `app.routes.ts`, `app.html` — these are typically append-only; conflicts are easy to resolve at merge time.
- **High risk** (structural changes): any existing service, controller, or component being *modified* (not created).

## Step 5 — Report and confirm

Print a summary table:

```
READY ITEMS — PARALLEL DISPATCH PLAN
======================================

UNBLOCKED (will run in parallel):
  #N  feature-name          [files: X created, Y modified]

BLOCKED (skipped):
  #N  feature-name          Blocked by: #M (not yet merged)

FILE CONFLICTS (unblocked items only):
  AppDbContext.cs           touched by: #N, #M  [LOW RISK]
  SomeService.cs            touched by: #N, #P  [HIGH RISK — recommend serializing]
```

Ask the user:
- For any **HIGH RISK** conflicts: "Serialize these or proceed anyway?"
- For items needing prompt files: "Generate prompt files first? (y/n)"

Wait for confirmation before proceeding.

## Step 6 — Launch agents in parallel

For each confirmed unblocked item, determine the Claude model before spawning:

**Model selection** — check if story points are already set on the project board for the item (present in the `gh project item-list` JSON from Step 1). If not set, estimate from the prompt file using the same signals as `/scope-task`:
- Single file, no tests → 1–2 pts
- Backend-only or frontend-only with tests → 3 pts
- Full-stack, moderate tests → 5 pts
- Full-stack, 20–50 files, multiple services + E2E → 8 pts
- Architectural / very large → 13 pts

Map to model:
- 1–2 pts → `haiku`
- 3–5 pts → `sonnet`
- 8–13 pts → `opus`

Spawn a background agent with `isolation: worktree` and `model: <selected>`:

> You are implementing GitHub issue #N — `ISSUE_TITLE`.
> Read the prompt file at `PROMPT_PATH` and follow it exactly.
> Follow all steps in `/implement-next` starting from Step 3 (branch already determined: `feature/SHORT_NAME`).
> The remote is `TournamentOrganizer`. Target branch for PRs is `dev`.
> The model selected for this task is `MODEL_NAME` (e.g. `claude-haiku-4-5-20251001`, `claude-sonnet-4-6`, `claude-opus-4-6`). Include this in the PR body as: `🤖 Generated with [Claude Code](https://claude.com/claude-code) · Model: \`MODEL_NAME\``
> Do not return until the PR URL is confirmed.

Launch all agents simultaneously (one message, multiple Agent tool calls). Include the selected model for each.

## Step 7 — Monitor and report

After launching all agents, record each agent's `output_file` path from the launch response.

**Do not wait passively.** Poll output files every ~30 seconds:
```bash
tail -20 "<output_file_path>"
```

As soon as an output file contains a PR URL or clear completion signal, report it to the user immediately — do not wait for the task notification, which may arrive late.

Continue polling all remaining agents until all are done or have failed.

When all agents are done, print a final summary:
```
PARALLEL DISPATCH COMPLETE
  #N  feature-name   → PR #X  https://github.com/...
  #M  feature-name   → PR #Y  https://github.com/...
  #P  feature-name   → FAILED: <reason>
```

Remind the user to merge PRs in dependency order if any file conflicts were flagged.
