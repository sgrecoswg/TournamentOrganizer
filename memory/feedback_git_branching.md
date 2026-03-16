---
name: Git branching — bug fixes on existing PR
description: Do not create a new branch for a bug that belongs to a task already in progress
type: feedback
---

Do not create a new feature branch if one already exists for the task. Bug fixes discovered while working on a feature should be additional commits on the same feature branch (and therefore on the same PR), not a new branch + new PR.

**Why:** The user had to manually merge extra PRs because we created a separate branch for what was clearly part of the same task.

**How to apply:** Before creating a new branch for a bug fix, check `git branch` — if a related feature branch already exists and hasn't been merged, commit the fix there instead.
