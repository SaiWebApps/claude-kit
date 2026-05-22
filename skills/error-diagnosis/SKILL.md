# Error Diagnosis Skill

**This skill is loaded automatically by a PostToolUse hook when a Bash command fails.**

You are here because a Bash command just returned a non-zero exit code. You MUST complete the checklist below IN YOUR VISIBLE OUTPUT before making any further tool calls. Skipping any step is a protocol violation.

## MANDATORY CHECKLIST — Complete in order, in your output

### Step 1: COPY the error (not paraphrase)

Write the exact error message. Not a summary. Not "it failed with 502." The actual text.

### Step 2: LIST three possible causes

For each cause, write what EVIDENCE would confirm or rule it out. Not "it might be X" — "X would be confirmed by [specific check]."

| # | Hypothesis | Evidence needed | How to get it (< 10 seconds) |
|---|-----------|-----------------|-------------------------------|
| 1 | | | |
| 2 | | | |
| 3 | | | |

### Step 3: EXECUTE the cheapest evidence-gathering check

Run ONE diagnostic command. Not a retry. Not the same command with `-v`. A DIFFERENT command that tests a specific hypothesis.

### Step 4: STATE the root cause with evidence

"The root cause is X because [evidence from Step 3]."

If you cannot state this, go back to Step 3 with a different hypothesis.

### Step 5: ONLY NOW may you act

With root cause identified, choose your action:
- Fix the root cause, then re-run
- Report to the user that the issue is outside your control
- Try a genuinely different approach (not the same command with cosmetic changes)

## ANTI-BYPASS RULES

- **"Expected error" is not a diagnosis.** Even if a playbook says "502 = cold-start," you must still complete Steps 1-4. The playbook is a hypothesis, not evidence.
- **Adding `-v` to the same command is not diagnosis.** It's retrying with more output. A diagnostic command tests a DIFFERENT thing.
- **"Let me retry after a delay" requires completing this checklist first.** Sleep-then-retry is only valid AFTER you've identified the root cause AND determined that the fix is "wait for an async process."
- **If you catch yourself wanting to skip this:** say "I'm about to skip diagnosis" in your output. The user will see it.
