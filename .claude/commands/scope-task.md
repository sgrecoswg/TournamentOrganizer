Analyze a GitHub issue, estimate story points, recommend the right Claude model, and optionally launch implementation.

## Step 1 — Identify the issue

If `$ARGUMENTS` contains an issue number (e.g. `30`), use it.

Otherwise fetch Ready items from the project board:
```bash
gh project item-list 2 --owner sgrecoswg --format json \
  --jq '.items[] | select(.status == "Ready") | "#" + (.content.number | tostring) + " | " + .content.title'
```

- If one Ready item → use it automatically and tell the user.
- If multiple → print the list, ask which issue number to scope, then stop and wait.

## Step 2 — Load the issue and prompt file

Fetch full project data:
```bash
gh project item-list 2 --owner sgrecoswg --format json
```

Find the item whose `content.number` matches. Extract:
- `ITEM_ID` — the project item `.id`
- `ISSUE_NUMBER` — the issue number
- `ISSUE_TITLE` — the issue title

Check whether the issue body contains a `## Prompt file` line with a path like `` `prompts/ignore/NN_<name>.md` ``.

- **Found** → read the file at that path. Proceed to Step 3.
- **Not found** → report: "No prompt file exists for #ISSUE_NUMBER. Run `/implement-next ISSUE_NUMBER` first to generate one." Stop.

## Step 3 — Analyze complexity and estimate story points

Read the prompt file and score the following signals:

| Signal | Points |
|---|---|
| Single file change, no tests | 1 |
| 2–5 files, no new test section | 2 |
| Backend-only OR frontend-only, with tests | 3 |
| Full-stack (backend + frontend), < 20 files, moderate tests, no migration | 5 |
| Full-stack, 20–50 files, multiple services + controllers + E2E | 8 |
| Architectural change, cross-cutting concern, or very large feature | 13 |

Boost toward the next tier if ANY of these are present:
- New EF Core migration required
- New service interface + implementation
- New controller
- Playwright E2E section with 3+ describe blocks
- New charting library or third-party dependency

Select the single best-fit story point value (1, 2, 3, 5, 8, or 13).

Map to model:
- 1–2 pts → `haiku`
- 3–5 pts → `sonnet`
- 8–13 pts → `opus`

## Step 4 — Update story points on the project board

```bash
gh project item-edit --project-id PVT_kwHOBDyNN84BSBgj \
  --id "$ITEM_ID" \
  --field-id PVTF_lAHOBDyNN84BSBgjzg_rcXo \
  --number <estimated-points>
```

## Step 5 — Report and offer to launch

Print:
```
TASK SCOPE ANALYSIS
  Issue:        #N — <title>
  Story points: X
  Model:        <haiku|sonnet|opus>
  Rationale:    <one sentence: key signals that drove the estimate>
```

Ask: "Launch implementation with [model] now? (y/n)"

- **y** → spawn a sub-agent using `model: <haiku|sonnet|opus>` and `isolation: worktree` with this prompt:
  > You are implementing GitHub issue #ISSUE_NUMBER — ISSUE_TITLE.
  > Follow all steps in `/implement-next ISSUE_NUMBER` from the beginning.
  > The remote is `TournamentOrganizer`. Target branch for PRs is `dev`.
  > Do not return until the PR URL is confirmed.

- **n** → report: "When ready, run `/implement-next ISSUE_NUMBER`. Recommended model: [model]."
