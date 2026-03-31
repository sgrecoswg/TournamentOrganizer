Pick a "Ready" item from the GitHub project board and implement it end-to-end.

## Step 1 — Pick the issue

If `$ARGUMENTS` contains a GitHub issue number (e.g. `22`), use that issue.

Otherwise, fetch the Ready items from the project board:
```bash
gh project item-list 2 --owner SensibleProgramming --format json \
  | jq -r '.items[] | select(.status == "Ready") | "#" + (.content.number | tostring) + " | " + .title'
```

- If there is exactly one Ready item, use it automatically and tell the user.
- If there are multiple, print the list, ask the user which issue number to work on, then stop and wait.

## Step 2 — Load the issue

Fetch full issue details:
```
gh project item-list 2 --owner SensibleProgramming --format json
```
Find the item whose `content.number` matches the chosen issue number. Extract:
- `ITEM_ID` — the project item `.id`
- `ISSUE_TITLE` — the issue `.title`
- `ISSUE_NUMBER` — the issue `.content.number`
- `ISSUE_BODY` — the full `content.body`

Check whether the issue body contains a `## Prompt file` line with a path like `` `prompts/ignore/NN_<name>.md` ``.

**If the line exists** → set `PROMPT_PATH` to that path and skip to Step 2b.

**If the line is missing** → evaluate whether a prompt file is needed (see criteria below).

### Step 2a — Decide whether to generate a prompt file

**Skip prompt file generation** (go straight to Step 3) when ALL of the following are true:
1. The issue body is already actionable — clear location, clear fix, no ambiguous requirements or design decisions
2. Estimated story points ≤ 2
3. The task is a fix/chore with no new components, DTOs, or test classes to design (e.g. dependency bumps, config changes, typo fixes)

If skipping: derive `SHORT_NAME` as a kebab-case slug of the issue title (strip "feat:", "fix:", "[Security]", etc.) and proceed to Step 3. Treat the issue body as the spec.

**Otherwise → generate the prompt file:**

### Step 2a (continued) — Generate the prompt file (no existing file)

The issue body is a brief spec. Expand it into a full, implementation-ready prompt file using
the project's feature template (`prompts/template/feature-template.md`) as the structure guide.

The generated file must include every section from the template that applies:
- `# Feature: <name>` heading and `> **GitHub Issue:** [#N ...]` link
- Context paragraph
- Requirements bullet list
- Backend section: Models, DTOs, Repository, Service, Controller (with exact method signatures, DTO field names, HTTP verbs, and route paths)
- Frontend section: Models, API service methods, component(s) with selector names and template text used by tests, routing changes
- Backend unit tests: class name + individual test method names (TDD — written before implementation)
- Frontend Jest tests: spec file name + individual `it(...)` descriptions
- Playwright E2E tests: spec file path, helper names, describe-block table
- Verification checklist

Determine the next available prompt file number by listing `prompts/ignore/` and taking
`max(existing NN prefixes) + 1`. Name the file `prompts/ignore/NN_<slug>.md` where `<slug>` is
kebab-case derived from the issue title (strip "feat:", "fix:", etc.).

Write the file, then run `/refine-prompt PROMPT_PATH` and apply any clear improvements before showing it to the user.

**Show the full contents to the user and ask for approval before continuing.**
Wait for explicit confirmation ("looks good", "approved", "go ahead", etc.) or requested edits
before proceeding. If edits are requested, apply them and show again.

Once approved:
- Set `PROMPT_PATH` to the new file path.
- Update the GitHub issue body to append the prompt file reference:
  ```
  gh issue edit ISSUE_NUMBER --repo SensibleProgramming/TournamentOrganizer \
    --body "<original body>

  ## Prompt file
  \`PROMPT_PATH\`"
  ```

### Step 2b — Read the prompt file

Read the file at `PROMPT_PATH` in full. This is the authoritative spec for all implementation work.

Derive `SHORT_NAME` from the prompt file name (strip the leading `NN_` and `.md`, e.g. `store-public-page`).

### Step 2c — Check dependencies

Read the `## Dependencies` section of the prompt file.

- If `None` or the section is absent → proceed to Step 3.
- For each listed issue number `#N`, check whether a PR referencing it has been merged to `dev`:
  ```bash
  gh pr list --base dev --state merged --json number,title,body \
    --jq '.[] | select(.body | test("#N")) | "#\(.number) \(.title)"'
  ```
  - All dependencies merged → proceed to Step 3.
  - Any dependency NOT yet merged → **stop**. Do not create a branch or mark In Progress.
    Report which issue is blocking (e.g. "Skipping #N — depends on #M which is not yet merged to dev.").
    If other Ready items exist, move to the next one and repeat from Step 2.

## Step 3 — Mark "In Progress" on the project board

Determine the current iteration from today's date:
- Iteration 1 → `449f6210`  (2026-03-17 to 2026-03-30)
- Iteration 2 → `4ce1e9d2`  (2026-03-31 to 2026-04-13)
- Iteration 3 → `17db6b27`  (2026-04-14 to 2026-04-27)

Estimate story points from the prompt file using this guide:
- 1 — single file, trivial change
- 2 — 2–5 files, no new tests
- 3 — small feature, one layer only (backend OR frontend)
- 5 — full-stack feature, < 20 files, moderate tests
- 8 — full-stack, 20–50 files, multiple services + E2E
- 13 — architectural change or very large cross-cutting feature

Update the prompt file header — add or replace the `> **Story Points:**` line immediately after the `> **GitHub Issue:**` line:
```
> **Story Points:** <estimated-points> · Model: `<haiku|sonnet|opus>`
```
(1–2 pts → haiku, 3–5 pts → sonnet, 8–13 pts → opus)

Run all three project-board updates (Status, Iteration, Story Points):
```bash
gh project item-edit --project-id PVT_kwDOECHdcM4BSqCs \
  --id "$ITEM_ID" \
  --field-id PVTSSF_lADOECHdcM4BSqCszhAIG6Q \
  --single-select-option-id 47fc9ee4

gh project item-edit --project-id PVT_kwDOECHdcM4BSqCs \
  --id "$ITEM_ID" \
  --field-id PVTIF_lADOECHdcM4BSqCszhAIG7A \
  --iteration-id <chosen-iteration-id>

gh project item-edit --project-id PVT_kwDOECHdcM4BSqCs \
  --id "$ITEM_ID" \
  --field-id PVTF_lADOECHdcM4BSqCszhAIG60 \
  --number <estimated-points>
```

## Step 4 — Create the feature branch

```bash
git checkout dev
git pull TournamentOrganizer dev
git checkout -b feature/<SHORT_NAME>
```

## Step 5 — Implement the feature (TDD)

Follow the requirements in the prompt file exactly. Mandatory order:
1. Write failing tests first (backend xUnit and/or frontend Jest + Playwright E2E)
2. Confirm tests are red
3. Write minimum implementation to make them pass
4. Confirm tests are green
5. Run `/build` — fix any errors before continuing. **After build passes, immediately continue to Step 6 — do not stop.**

After any frontend component changes:
- Run `/check-zone` on every modified component
- Run `/e2e <spec-file>` — all tests must pass before moving on. **After E2E passes, immediately continue to the next step — do not stop.**

## Step 6 — Move prompt file to done

```bash
mv prompts/ignore/<filename>.md prompts/done/<filename>.md
```

## Step 7 — Commit and create PR

Commit all changes on the feature branch, then run `/create-pr`.

The PR body must include:
- `References #ISSUE_NUMBER` so the branch appears in the issue's Development section.
- `🤖 Generated with [Claude Code](https://claude.com/claude-code) · Model: \`<model>\`` where `<model>` is read from the `> **Story Points:** … · Model: \`…\`` line in the prompt file (set in Step 3).

After the PR is created, update the project board status to "In Review":
```bash
gh project item-edit --project-id PVT_kwDOECHdcM4BSqCs \
  --id "$ITEM_ID" \
  --field-id PVTSSF_lADOECHdcM4BSqCszhAIG6Q \
  --single-select-option-id 2d25f841
```

Report the PR URL to the user.

## Rules
- Never commit directly to `dev` or `main`
- The remote is named `TournamentOrganizer` (not `origin`)
- Do not skip any step in the TDD workflow
- Do not consider the task done until `/build`, all tests, `/check-zone`, and `/e2e` all pass
- Never start implementation before the prompt file is approved (Step 2a) or read (Step 2b)
- **Do not stop after any verification step** (`/build`, `/e2e`, `/check-zone`). These are checkpoints, not endpoints — continue to the next numbered step immediately after each passes. Do not return until the PR URL has been reported to the user and the project board has been marked In Review.
