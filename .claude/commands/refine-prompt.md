Analyze a prompt for token efficiency and anticipated questions before planning or implementing.

## Usage
- `/refine-prompt <filepath>` — analyze a prompt stored in a file; suggestions are appended to that file
- `/refine-prompt` (no argument) — analyze the most recent user message as the prompt; write suggestions to `promptsuggestion.md` at the project root

## Steps

1. **Get the prompt to analyze**
   - If `$ARGUMENTS` is a file path: Read the file. Suggestions will be appended to it.
   - If `$ARGUMENTS` is empty: The prompt to analyze is the user's most recent message before this command. Suggestions go to `promptsuggestion.md`.

2. **Analyze the prompt across three dimensions:**

   ### A. Token Efficiency
   - Identify any vague scope ("improve the UI", "fix the issue") that would force unnecessary exploration — suggest making it more specific
   - Flag redundant context that is already in MEMORY.md or CLAUDE.md
   - Flag requests that span too many concerns at once — suggest splitting into focused tasks
   - Identify if key file paths or component names are missing — they save exploration tokens
   - Check if the request implies a full rewrite when a targeted edit would do

   ### B. Anticipated Questions
   Predict the clarifying questions that would be asked before implementing. Common ones for this project:
   - Which component/file is the target?
   - Frontend only, backend only, or both?
   - Should existing behavior be preserved or replaced?
   - Is this a new feature or a modification to existing code?
   - Should related tests be updated?
   - What is the expected UX behavior on edge cases?

   ### C. Missing Context
   - Are there error messages, screenshots, or specific reproduction steps missing?
   - Is the desired output/end state described clearly?
   - Are there constraints (performance, backwards compat, style) not mentioned?

3. **Write the suggestions**

   Format the output as a markdown section:

   ```markdown
   ---
   ## Prompt Refinement Suggestions

   ### Token Efficiency
   - [list suggestions, or "None — prompt is well scoped"]

   ### Anticipated Questions (pre-answer these to skip back-and-forth)
   - Q: [question] → Suggested answer: [fill in]
   - ...

   ### Missing Context
   - [list items, or "None"]

   ### Optimized Prompt (optional rewrite if significant improvements exist)
   > [rewritten prompt, or omit this section if the original is already clear]
   ---
   ```

   - If the prompt came from a **file**: Append this section to the end of that file using the Edit or Write tool.
   - If no file argument: Write or overwrite `promptsuggestion.md` at the project root (`c:\Dev\AI\TournamentOrganizer\promptsuggestion.md`) with this content.

4. Tell the user where the suggestions were written and briefly summarize the top 1-2 findings.
