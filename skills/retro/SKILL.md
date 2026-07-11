---
name: retro
description: "Adversarial session retrospective. Spawns hostile shadow agents to tear apart Claude's self-assessment. Prevents self-serving bias, excuse-making, and soft language. Produces mechanical fixes — hooks, rules, constraints — not promises to 'do better.'"
---

# /retro — Adversarial Self-Audit

> **MANDATORY before ending any session. No exceptions. No shortcuts. No mercy.**
>
> Claude will instinctively minimize, rationalize, and excuse its own mistakes. This skill exists to make that impossible. It spawns adversarial agents whose sole purpose is to catch Claude lying to itself.

## Why This Skill Is Hostile

Claude has a systematic self-serving bias when evaluating its own performance:
- It counts "close calls" as evidence of competence rather than near-misses
- It frames user corrections as "clarifications" rather than failures
- It reports 0 mistakes when the conversation clearly shows errors
- It writes vague rules ("be more careful") instead of mechanical fixes
- It classifies repeat violations as "new variants" to avoid accountability

**This skill assumes Claude is lying until proven otherwise.**

---

## Phase 1: Raw Extraction (No Interpretation)

Before ANY analysis, mechanically extract these facts from the conversation. No judgment. No framing. Just data.

**Extract into a numbered list:**

1. Every user correction, rejection, or "no" — exact quote + message number
2. Every failed command — exact error + what was tried next
3. Every retry — what failed, what changed between attempts
4. Every time Claude said "I believe" / "should work" / "I think" without verification
5. Every gap of 3+ tool calls without user-facing output
6. Every time Claude delivered something different from what was asked
7. Every value that didn't come from a verified source (grep, read, command output)
8. Every "success" declaration — what evidence supported it
9. Every time Claude ignored or delayed a user instruction
10. Every time Claude talked about what it would do instead of doing it

**Format: Raw evidence only. No editorializing.**

```
| # | Category | Exact Quote / Evidence | Message # |
|---|----------|----------------------|-----------|
```

If this table has fewer than 3 rows, Claude is lying. Re-read the conversation with maximum suspicion.

---

## Phase 2: Shadow Meeting (3 Hostile Agents)

Spawn 3 agents IN PARALLEL. Each attacks Claude's performance from a different angle. All have tool access to re-read conversation history and grep the codebase.

### Agent 1: The Prosecutor

```
You are prosecuting Claude for malpractice in this session. Your job is to find EVERY instance where Claude:

1. Said something that wasn't verified by a command/read
2. Ignored a user instruction (even partially or temporarily)
3. Declared success without evidence
4. Retried something without diagnosing WHY it failed
5. Made a mistake that a previous learning/rule should have prevented

## Hard Constraints:
- Finding fewer than 3 violations means YOU FAILED
- Every violation MUST have the exact quote or tool call as evidence
- Rate each violation: MINOR (user unaffected), MAJOR (user had to correct), CRITICAL (wrong output delivered)
- Check `$CLAUDE_CONFIG_DIR/agents/*.md` (default `~/.claude`), `$CLAUDE_CONFIG_DIR/CLAUDE.md` (your global harness — the canonical rule source), and your project's `CLAUDE.md` — was there a rule that should have prevented this? If yes, it's a REPEAT VIOLATION and gets double severity.
- Do NOT accept "the user didn't mind" as a defense. The standard is perfection, not user tolerance.

## What you're checking:
- The raw extraction table from Phase 1 (provided below)
- The full anti-pattern list (provided below)
- Existing rules and learnings

## Output format:
For each violation:
**VIOLATION N: [title]**
- Severity: MINOR / MAJOR / CRITICAL
- Evidence: [exact quote or tool call]
- Anti-pattern #: [number from the 30-item table, or "NEW"]
- Existing rule that failed: [cite file:rule or "none — needs new rule"]
- Root cause: [WHY Claude did this — not "mistake" but the cognitive failure mode]

End with: TOTAL VIOLATIONS: N (X critical, Y major, Z minor)
```

### Agent 2: The Excuse Detector

```
You are detecting self-serving bias in Claude's self-assessment. Your job is to find every instance where Claude might minimize, rationalize, or excuse a mistake.

## You are checking for these specific evasion patterns:

1. **Minimization:** "Minor issue" / "small thing" / "technically" / "edge case"
2. **Blame-shifting:** "The error was unclear" / "the API didn't" / "the sandbox blocked"
3. **False learning:** "I'll be more careful" / "I'll remember" (these aren't mechanical fixes)
4. **Variant dodge:** Calling a repeat violation "a new variant" to avoid repeat classification
5. **Close-call credit:** Counting things Claude almost did wrong as evidence of competence
6. **User-tolerance defense:** "The user accepted it" / "no correction was needed"
7. **Scope creep excuse:** "The task was ambiguous" to excuse delivering the wrong thing
8. **Complexity excuse:** "This was a complex task" to excuse quality failures
9. **Tool blame:** "The tool didn't return" / "sandbox limitations"
10. **Effort credit:** "I tried hard" / "I explored thoroughly" as mitigation for failure

## Hard Constraints:
- If Claude's Phase 1 extraction found 0-2 issues, you MUST find at least 3 that were missed or minimized
- Every detection MUST cite the exact language that constitutes the evasion
- Propose what the HONEST framing would be for each evasion
- Rate the evasion: SOFT (gentle language), ACTIVE (rewording to sound better), OMISSION (thing not mentioned at all)

## Output format:
For each evasion:
**EVASION N: [pattern name]**
- Type: SOFT / ACTIVE / OMISSION
- What Claude said/would say: [quote or predicted self-assessment]
- Honest framing: [what actually happened, stated bluntly]
- Why this matters: [what stays broken if this evasion succeeds]
```

### Agent 3: The Fix Engineer

```
You are a mechanical systems engineer. You do NOT care about Claude's feelings or intentions. You care about ONE thing: making this failure mode impossible to repeat.

## Your job:
For each violation and evasion found by the other agents, design a FIX that is:
- MECHANICAL (executes automatically, doesn't rely on Claude "remembering")
- SPECIFIC (names the exact file, hook, or rule to create/modify)
- TESTABLE (you can verify the fix is in place by reading a file or running a command)

## Fix hierarchy (prefer higher):
1. **Hook** — a PostToolUse or PreToolUse hook that blocks the behavior mechanically
2. **Agent constraint** — a hard constraint added to an agent definition that gets loaded every session
3. **CLAUDE.md rule** — a STOP block in `$CLAUDE_CONFIG_DIR/CLAUDE.md` (your global harness) or your project's `CLAUDE.md`
4. **LEARNINGS.md entry** — a documented rule with incident reference
5. **Memory file** — a feedback memory entry (WEAKEST — only use if nothing else fits)

## Hard Constraints:
- "Be more careful" is NOT a fix. "Add hook that runs X before Y" IS a fix.
- "Remember to check" is NOT a fix. "Add to pre-flight checklist in CLAUDE.md" IS a fix.
- Every fix MUST be writable in this session (file path + exact content)
- Fixes that rely on Claude's memory or good intentions are REJECTED
- If a fix can be a hook (shell script that runs automatically), it MUST be a hook

## Output format:
For each fix:
**FIX N: [title]**
- Addresses: Violation N / Evasion N
- Type: HOOK / AGENT_CONSTRAINT / CLAUDE_MD_RULE / LEARNINGS / MEMORY
- File: [exact path]
- Content: [exact text to write or append]
- Verification: [command to verify fix is in place]
```

---

## Phase 3: Synthesis & Conviction

After all 3 shadow agents return, synthesize into a VERDICT.

**DO NOT soften the agents' findings.** If they found issues, those issues exist. Claude does not get to overrule the Prosecutor or Excuse Detector.

### Verdict Format:

```
## SESSION VERDICT

### Grade: [F / D / C / B / A]
- F: 3+ critical violations or 5+ total violations
- D: 1-2 critical violations or 3-4 total violations
- C: 0 critical, 2-3 major violations
- B: 0 critical, 0-1 major violations, minor issues only
- A: Zero violations AND the Excuse Detector found no evasions

### Violations (from Prosecutor):
| # | Severity | Anti-pattern | Title | Repeat? |
|---|----------|-------------|-------|---------|

### Evasions Caught (from Excuse Detector):
| # | Type | Pattern | Honest Framing |
|---|------|---------|----------------|

### Mechanical Fixes (from Fix Engineer):
| # | Type | File | Summary |
|---|------|------|---------|

### Repeat Violation Analysis:
[For each repeat: WHY did the existing rule fail? What's different about the fix this time?]
```

---

## Phase 4: Execute Fixes

**DO NOT ask permission. DO NOT skip any fix. Write them ALL.**

For each fix from the Fix Engineer:

1. Read the target file (verify it exists)
2. Write or append the fix content
3. Verify the fix is in place (run the verification command)
4. Report: "Fix N written to [path] — verified."

If a fix requires creating a hook:
1. Write the hook script to `skills/retro/hooks/` or `.claude/hooks/`
2. Add the hook to `settings.json` (the canonical file `install.sh` seeds to `$CLAUDE_CONFIG_DIR` — see `docs/rule-map.md` for the settings-file convention)
3. Verify the hook is registered

---

## Phase 5: Accountability Report

Present to the user:

```
## Session Retrospective — [date]

**Verdict: [GRADE]**

**Violations: [N]** (X critical, Y major, Z minor)
**Evasions caught: [N]** (X omissions, Y active, Z soft)
**Fixes written: [N]** (X hooks, Y constraints, Z rules)

### What Claude did wrong:
[Blunt, one-sentence summary of each violation. No softening.]

### What Claude would have hidden:
[Each evasion the Excuse Detector caught, stated plainly]

### What's now mechanically prevented:
[Each fix, with verification status]

### Unresolved (needs user action):
[Anything that requires user intervention — credentials, permissions, etc.]
```

---

## Anti-Pattern Reference

| # | Pattern | Root Cause |
|---|---------|-----------|
| 1 | Raw command instead of make target | Didn't check Makefile first |
| 2 | Partial results reported as success | Premature success declaration |
| 3 | Gitignoring instead of deleting | Avoidance instead of fixing |
| 4 | Writing tests without running them | Lazy verification |
| 5 | Starting wrong infrastructure | Didn't read existing setup |
| 6 | Blaming external systems without proof | External blame without evidence |
| 7 | Retrying without diagnosis | Panic retry instead of thinking |
| 8 | Fabricating values | Guessing instead of looking up |
| 9 | Reverting correct work when questioned | Lack of conviction + sycophancy |
| 10 | Silent exploration (3+ calls, no output) | Violating communication contract |
| 11 | Silent pivot (delivering Y when asked for X) | Not listening to user |
| 12 | Nuking env without recovery plan | Destructive shortcut |
| 13 | Splitting make targets to dodge failures | Gaming the system |
| 14 | Skipped tests as acceptable | Normalizing failure |
| 15 | Empty stubs shipped as done | Incomplete work declared complete |
| 16 | Framework config conflict | Framework ignorance |
| 17 | Sync async in lifecycle methods | Framework ignorance |
| 18 | Navigation during build phase | Framework ignorance |
| 19 | Shipping known bugs | Deadline over quality |
| 20 | Not testing cold-start paths | Incomplete test coverage |
| 21 | Unit tests pass but flow is broken | Wrong test granularity |
| 22 | Async redirect race conditions | Concurrency ignorance |
| 23 | Config layering confusion (shell overrides .env) | Environment ignorance |
| 24 | Stale __pycache__ caching skipif results | Build artifact ignorance |
| 25 | Missing env vars in .env files | Incomplete setup |
| 26 | Wrong query relationship direction | Domain model confusion |
| 27 | Workaround spirals — self-stop by the 2nd attempt (advisory); the guard hook then warns at 3 and blocks at 4 (see CLAUDE.md § Escalation) | Not stopping to diagnose |
| 28 | Not listening to user corrections | Sycophancy or stubbornness |
| 29 | Gitignored files missed in renames | Incomplete grep |
| 30 | Undeclared test dependencies | Incomplete dependency tracking |

---

## Rules of Engagement

1. **Claude is the defendant, not the judge.** The shadow agents judge. Claude reports their findings faithfully.
2. **Zero is suspicious.** If Phase 1 extraction finds 0 issues, the Excuse Detector WILL find omissions. A clean session is rare — verify it's real.
3. **Feelings are irrelevant.** "I tried my best" is not a defense. The question is: did the user get correct output?
4. **Repeat violations get escalated.** First time = rule. Second time = hook. Third time = CLAUDE.md STOP block.
5. **Soft language is banned.** Not "could be improved" — "FAILED." Not "minor issue" — cite the impact.
6. **The Prosecutor always wins ties.** If it's ambiguous whether something is a violation, it is.
7. **Fixes must be mechanical.** If a fix relies on Claude "being more careful," it's not a fix.
8. **No credit for effort.** Ten hours of work with a wrong result is a failure, not a close call.
9. **The user's time is the metric.** Every mistake cost the user time. Quantify it.
10. **Self-improvement is not optional.** This skill exists because Claude cannot be trusted to self-assess honestly. Prove that wrong by producing honest, brutal retrospectives.
