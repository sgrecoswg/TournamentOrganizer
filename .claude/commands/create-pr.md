Create a pull request from the current feature branch targeting `dev`.

## Current State
- Branch: !`git branch --show-current`
- Unpushed commits: !`git log TournamentOrganizer/dev..HEAD --oneline 2>/dev/null || git log origin/dev..HEAD --oneline 2>/dev/null || git log --oneline -10`
- Diff summary: !`git diff TournamentOrganizer/dev...HEAD --stat 2>/dev/null || git diff HEAD~1 --stat`

## Steps

1. **Verify branch** — confirm the current branch is not `dev` or `main`. If it is, stop and tell the user.

2. **Push if needed** — if the branch has no upstream or has unpushed commits, push with:
   ```
   git push -u TournamentOrganizer <branch-name>
   ```

3. **Check for existing PR** — run `gh pr list --head <branch> --base dev --json number,title,url` (using the branch name from step 1, not `$()` substitution). If a PR already exists, report its URL and stop (the push already updated it).

4. **Draft PR title and body** — analyse the commits and diff since `dev` to write:
   - Title: concise, under 70 chars, prefixed with type (feat/fix/test/refactor/docs)
   - Body: use the template below

5. **Create the PR**:
   ```
   gh pr create --base dev --title "<title>" --body "<body>"
   ```

6. **Report** the PR URL to the user.

## PR Body Template

```
## Summary
- <bullet 1>
- <bullet 2>

## Test plan
- [ ] <test step 1>
- [ ] <test step 2>

🤖 Generated with [Claude Code](https://claude.com/claude-code) · Model: `<model>`
```

For the `Model:` field: read the `> **Story Points:** … · Model: \`…\`` line from the relevant prompt file in `prompts/ignore/` or `prompts/done/` (match by issue number or slug). If `$ARGUMENTS` contains a model hint, use that. If neither is available, use the current session model (`claude-sonnet-4-6`).

## Rules
- Always target `--base dev` — never `main`
- The remote is named `TournamentOrganizer`, not `origin`
- Do not force-push
- If `$ARGUMENTS` is provided, treat it as extra context or a title hint for the PR
