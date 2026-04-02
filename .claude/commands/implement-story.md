Pick the first "Ready" item from the GitHub project board and implement it. Git commits, pushes, and PR creation are handled by the user — stop after implementation passes all checks.

This command follows **all steps in `implement-next.md`** with the following two differences:

## Difference 1 — Step 1: Always pick the first Ready item

Do not prompt the user if multiple Ready items exist. Always select the first one automatically:

```bash
gh project item-list 2 --owner SensibleProgramming --format json \
  --jq '.items[] | select(.status == "Ready") | "#" + (.content.number | tostring) + " | " + .title' \
  | head -1
```

Tell the user which issue was selected and continue.

## Difference 2 — Replace Step 7 (no git commits, pushes, or PR)

After implementation passes all checks and the prompt file has been moved to `prompts/done/` (Step 6):

**Do not commit, push, or create a PR.** Instead, report to the user:

1. List every file created or modified during implementation.
2. Remind the user:
   - Review the changes
   - `git add` the files they want to commit
   - Commit and push the feature branch (`git push -u TournamentOrganizer feature/<SHORT_NAME>`)
   - Open a PR targeting `dev` with `References #ISSUE_NUMBER` in the body

**Do not update the project board to "In Review"** — that is the user's responsibility after pushing the PR.

## All other steps

Follow `implement-next.md` exactly: issue loading, prompt file generation/approval, dependency check, board "In Progress" update, branch creation, TDD implementation, build verification, zone check, E2E, and prompt file move.
