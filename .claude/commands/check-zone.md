Audit Angular component files for missing `cdr.detectChanges()` calls in a zoneless (Zone.js-free) Angular app.

## Usage
- `/check-zone <file-or-glob>` — audit one or more specific component files
- `/check-zone` (no argument) — audit all `*.component.ts` files under `tournament-client/src/app/features/`

## Background
This project uses Angular 21 with **zoneless change detection** (no Zone.js). Without Zone.js, Angular never automatically triggers change detection. Every method that mutates component state must explicitly call `this.cdr.detectChanges()` after the mutation, or the template will not update.

## Steps

1. **Resolve files to audit**
   - If `$ARGUMENTS` is provided: treat it as a file path or glob and read those files.
   - If `$ARGUMENTS` is empty: glob `tournament-client/src/app/features/**/*.component.ts` and read all matches.

2. **For each file, scan for state mutations without `cdr.detectChanges()`**

   A **state mutation** is any line that:
   - Assigns to a component property: `this.foo = ...`, `this.foo = [...this.foo, x]`, etc.
   - Modifies a property in place: `this.foo.push(...)`, `this.foo.splice(...)`, etc.
   - Flips a boolean flag: `this.isEditing = true/false`, `this.loading = ...`

   Check that each method containing a state mutation also calls `this.cdr.detectChanges()` **after** the mutation.

   Pay special attention to these high-risk contexts — they are the most common sources of missed calls:
   - **`subscribe()` callbacks** — both `next:` and `error:` blocks (error blocks often mutate flags like `this.loading = false`)
   - **Synchronous event-handler methods** bound in the template via `(click)`, `(change)`, `(submit)`, etc.
   - **`async` methods** using `await`
   - **`ngOnInit` / lifecycle hooks**

3. **Also check for `ChangeDetectorRef` injection**
   - Verify `ChangeDetectorRef` is imported from `@angular/core`
   - Verify `private cdr: ChangeDetectorRef` (or equivalent) is present in the constructor

4. **Report findings**

   For each file, output one of:
   - ✅ `filename` — all state mutations covered
   - ⚠️ `filename` — list each method/callback that mutates state without `detectChanges()`, with the line number and the missing call location

   End with a summary count of files checked, files clean, and issues found.

5. **Offer to fix**
   Ask the user if they want you to apply the fixes. If yes, add `this.cdr.detectChanges()` at the end of each flagged mutation block (before any closing brace of that block). Do not add duplicate calls if one already exists later in the same block.
