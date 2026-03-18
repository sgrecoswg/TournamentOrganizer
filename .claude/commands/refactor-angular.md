Refactor Angular components in this project: consolidate styles, extract child/shared components, and apply standard Angular best practices.

## Usage
- `/refactor-angular` — analyse and refactor the entire `tournament-client/src/app/` tree
- `/refactor-angular <path-or-glob>` — target one file, directory, or glob pattern (e.g. `features/events/event-detail.component.ts` or `features/events/`)

## Project Context

- **Framework**: Angular 21, standalone components, zoneless change detection (no Zone.js)
- **UI library**: Angular Material 21
- **State**: `BehaviorSubject` in feature services — no NgRx
- **API facade**: `core/services/api.service.ts` — all HTTP goes through here
- **Shared components**: `shared/components/` — `RatingBadgeComponent`, `PlacementBadgeComponent`, `PodTimerComponent`
- **Zoneless rule**: every method that assigns to `this.*` **must** call `this.cdr.detectChanges()` after the mutation. Do not remove or consolidate any existing `cdr.detectChanges()` calls.

## Steps

### 1 — Resolve scope

- If `$ARGUMENTS` is provided: resolve to matching file(s) or all component files under the given directory.
- If `$ARGUMENTS` is empty: glob `tournament-client/src/app/**/*.component.ts` and include all `.scss` / `.html` files associated with those components.

Read every resolved file before proposing any changes.

### 2 — Analyse — identify refactoring opportunities

For each component, look for the following and record findings by category:

#### A — Style consolidation
- Inline `styles: [...]` arrays that duplicate rules already in a `.scss` file or `styles.scss`.
- Magic values (colours, spacing, font sizes) repeated across multiple components — extract to CSS custom properties in `styles.scss`.
- Component `.scss` files with rules that belong in a shared stylesheet.
- Duplicate class definitions across components (e.g. `.full-width`, `.tab-content`, `.form-row`) — candidates for global utility classes in `styles.scss`.

#### B — Component decomposition
- Templates longer than ~150 lines — look for logically self-contained blocks (a pod card, a player row, a standings table, a dialog) that can become child components.
- `@for` blocks that render non-trivial UI per item — the item template is usually a good child component candidate.
- Repeated template fragments across multiple components — promote to a new component in `shared/components/`.
- Inline dialog components (defined with `@Component` in the same file) — move to their own file in `shared/components/` or a `dialogs/` subfolder.

#### C — Code quality
- Large `ngOnInit` bodies — split data loading into focused private methods.
- Methods longer than ~30 lines — extract helpers.
- Template logic that belongs in the component class (complex `@if` conditions, repeated method calls in template expressions).
- Getter properties that could replace repeated template expressions.
- Magic strings / numbers that should be constants.
- Duplicate subscribe-then-detect patterns that could be a small helper.
- Unused imports in the `imports: [...]` array.

#### D — Angular best practices
- Constructor logic that should be in `ngOnInit`.
- Missing `trackBy` functions on `@for` loops over arrays of objects (already uses `track` — verify it tracks by a stable id, not the whole object).
- Public properties/methods that should be `private` or `protected`.
- `any` type annotations — replace with proper interfaces from `api.models.ts`.

### 3 — Prioritise and plan

Group findings by impact:

| Priority | Criteria |
|---|---|
| High | Breaks DRY badly, causes maintainability pain, or is a correctness risk |
| Medium | Style/structural improvement with clear benefit |
| Low | Minor cleanup, cosmetic |

Present the plan to the user as a numbered list of proposed changes, grouped by component/file. Include the priority and a one-sentence rationale for each item. **Do not make any edits yet.**

Ask the user:
1. Which items to proceed with (all, or a subset by number).
2. Whether to proceed file-by-file (pause for approval after each) or all at once.

### 4 — Execute approved changes

For each approved change:

1. Re-read the target file immediately before editing (it may have changed).
2. Apply the edit using `Edit` or `Write` as appropriate.
3. If extracting a new child component:
   - Create `<name>.component.ts` in the appropriate directory.
   - Add it to the parent's `imports: [...]` array.
   - Replace the extracted template block with the new element selector.
   - Ensure `ChangeDetectorRef` is injected and `cdr.detectChanges()` is called after every state mutation in the new component.
4. If moving styles to `styles.scss`:
   - Read `tournament-client/src/styles.scss` first.
   - Append new utility/shared classes under a clearly commented section.
   - Remove the duplicated rules from the component file.
5. After each file is complete, run `/check-zone` on it to verify zoneless compliance.

### 5 — Verify

After all changes:
- Run `/build` to confirm zero errors and zero warnings.
- Report a summary: files changed, components extracted, style rules consolidated, issues fixed.

## Constraints

- **Never** remove or combine `cdr.detectChanges()` calls — missing calls cause invisible UI bugs.
- **Never** switch to `async` pipe as a replacement for manual subscriptions without explicit user approval — this project's services use `BehaviorSubject` and the pattern is intentional.
- **Never** introduce NgRx, signals, or other state management libraries.
- **Never** rename public API-facing DTOs or service method signatures.
- **Never** change routing configuration unless the user explicitly asks.
- Keep changes minimal and surgical — refactor only what is identified; do not rewrite working logic.
- Preserve all existing functionality — refactoring must be behaviour-neutral.
