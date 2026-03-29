Mark a feature complete after its PR has merged to `dev`.

Usage: `/done <issue-number>`

`$ARGUMENTS` must be an issue number (e.g. `42`).

## Step 1 — Verify the PR is merged

```bash
gh pr list --base dev --state merged --json number,title,body \
  --jq '.[] | select(.body | test("#$ARGUMENTS")) | "#\(.number) \(.title) [\(.mergedAt)]"'
```

If no merged PR references the issue → stop and report: "No merged PR found for #$ARGUMENTS on `dev`. Merge the PR first."

## Step 2 — Find the project item

```bash
gh project item-list 2 --owner SensibleProgramming --format json \
  --jq '.items[] | select(.content.number == $ARGUMENTS) | .id'
```

Set `ITEM_ID` to the returned value.

## Step 3 — Mark Done on the project board

```bash
gh project item-edit --project-id PVT_kwHOBDyNN84BSBgj \
  --id "$ITEM_ID" \
  --field-id PVTSSF_lAHOBDyNN84BSBgjzg_rb-U \
  --single-select-option-id 98236657
```

## Step 4 — Delete stale plan files

List any plan files that reference the issue:
```bash
ls C:/Users/sgall/.claude/plans/
```

If any plan file is for this feature, delete it:
```bash
rm "C:/Users/sgall/.claude/plans/<filename>"
```

## Step 5 — Report

Print: "Issue #N marked Done. Plan files cleaned up." (or "No plan files found.")
