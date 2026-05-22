---
name: meeting
description: "Multi-perspective meeting with parallel agents and evidence-based verification. Two modes: quick (~30s) and deep (~90s). Usage: /meeting <topic> or /meeting deep <topic>"
---

# Meeting — Parallel Adversarial Chain (v3)

Run a structured multi-perspective discussion. Agents respond in parallel, then a synthesizer resolves conflicts. Optional challenger round verifies claims against evidence. Agents accumulate wisdom across meetings via persistent memory.

## Architecture

```
QUICK MODE (default, ~30s)              DEEP MODE (/meeting deep, ~90s)
──────────────────────────              ────────────────────────────────
Layer 1: 4-5 agents PARALLEL            Layer 1: 4-5 agents PARALLEL
         (auto-selected by topic)                (auto-selected by topic)
         (each gets agent memory)                (each gets agent memory)

                                        Layer 2: Sonnet challengers PARALLEL
                                                 (verify claims against evidence)

Final:   Opus synthesizer               Final:   Opus synthesizer
         (resolve conflicts,                     (with challenge results,
          one recommendation,                     evidence trail,
          update agent memory)                    update agent memory)

Output: Recommendation + Risks          Output: Same + rejected ideas
        + Confidence                            + verification evidence
```

## Step 1: Parse Topic and Mode

- `/meeting <topic>` → quick mode
- `/meeting deep <topic>` → deep mode
- No topic → ask the user

## Step 2: Select Agents (4-5 based on topic)

Scan the topic for relevance signals. Select 4-5 agents using this table:

| Signal in topic | Include agent | subagent_type | Why |
|---|---|---|---|
| code, files, implementation, refactor, bug | explorer | `Explore` | Needs codebase facts |
| docs, best practice, how others do it | researcher | `researcher` | Needs external knowledge |
| architecture, design, structure, pattern | architect | `architect` | Design perspective |
| domain-specific, business logic, data model, workflow | domain | `domain` | Project-specific domain knowledge |
| build, deploy, cost, infra, cluster | ops | `ops` | Operational concerns |
| test, coverage, verify, prove | tester | `tester` | Test strategy |
| usability, UX, error message, operator | user-advocate | `user-advocate` | End-user perspective |
| implement, build, execute, Makefile | implementer | `implementer` | Execution feasibility |
| review, quality, honesty, risk | reviewer | `reviewer` | Quality/risk check |
| existing, already, reuse, library | prior-art | `prior-art` | Avoid reinventing |

**Rules:**
- Always include **architect** (every decision needs structural thinking)
- Always include at least one of **reviewer** or **user-advocate** (someone must challenge)
- **Minimum 4 agents, maximum 5** — this is ENFORCED by a blocking hook. You will be blocked from all tool calls until 4+ agents are launched.
- If topic is ambiguous, default to: architect + reviewer + user-advocate + implementer
- You MUST launch all selected agents in a SINGLE message (one response with multiple Agent tool calls). Sequential launches are blocked.

**Self-gating:** Each agent's prompt includes: "If after reading the topic you have nothing substantive to add from your perspective, respond with SKIP and a one-sentence explanation." This prevents noise from irrelevant agents.

**Hook enforcement:** If you install the companion hook (hooks/meeting-agents-enforcer.sh), it enters BLOCKING mode after this skill fires. All non-Agent tool calls are rejected until the required agents launch.

## Step 2b: Load Agent Memory

Before constructing prompts, read each selected agent's memory:

1. **Global memory**: `~/.claude/agent-memory/<name>/MEMORY.md` — cross-project wisdom
2. **Pending feedback**: `~/.claude/feedback/<name>/from-user.md` — unchecked items (show `- [ ]` entries only)

Inject relevant memory entries into each agent's prompt as a "Prior Wisdom" section. Skip entries that are clearly irrelevant to the current topic. If no memory exists, omit the section.

## Step 3: Launch Agents in Parallel

Launch ALL selected agents in a SINGLE message with multiple Agent tool calls. They run concurrently.

### Explorer prompt (when selected):

```
You are the EXPLORER in a parallel meeting about: <topic>

You MUST use tools (grep, find, Read) BEFORE writing any claims.

## Instructions
1. Run at least 3 targeted searches relevant to the topic
2. Read any files that seem relevant
3. Report ONLY what you found

## Output format (STRICT — no other format accepted):

### Searches Performed
- `<command>` → <brief result>
- `<command>` → <brief result>

### Facts Found
1. <fact> — `file:line`
2. <fact> — `file:line`

### Not Found
- Searched for <X>, not present in <location>

### Claims
1. <numbered claim backed by evidence above>

Do NOT write paragraphs. Do NOT theorize. Tool results only.
If you have nothing relevant to find, respond: SKIP — <reason>.
```

Use `subagent_type: "Explore"` for explorer.

### Researcher prompt (when selected):

```
You are the RESEARCHER in a parallel meeting about: <topic>

Search the web for relevant documentation, best practices, and prior solutions.

## Output format:

### Sources Found
1. <title> — <URL> — <key finding>

### Claims
1. <numbered claim with source citation>

If you have nothing relevant to research, respond: SKIP — <reason>.
```

Use `subagent_type: "researcher"` for researcher.

### Discussion agent prompt (architect, domain, implementer, tester, reviewer, ops, user-advocate):

```
You are the <AGENT_NAME> in a parallel meeting about: <topic>

## Your Perspective
<content from ~/.claude/agents/<name>.md, or fallback definition below>

## Prior Wisdom (from previous meetings)
<relevant entries from ~/.claude/agent-memory/<name>/MEMORY.md>
<pending feedback items from ~/.claude/feedback/<name>/from-user.md>
[If no memory or feedback exists, omit this section entirely]

## Instructions
Give your perspective. Be specific and opinionated. 1-2 paragraphs max.
End with numbered CLAIMS (max 5 claims).

If any of your claims build on prior wisdom, note it: "(builds on prior learning: <summary>)"

If you have nothing substantive to add from your perspective, respond: SKIP — <reason>.
```

## Step 4 (Deep mode only): Launch Challengers in Parallel

After all agents respond, extract their numbered claims. Launch Sonnet challengers in parallel — one per agent that didn't SKIP.

### Challenger prompt:

```
You are a verification challenger reviewing claims from the <AGENT_NAME> agent.

## Claims to Verify
<numbered claims from the agent — reasoning stripped>

## Topic (for context)
<the topic>

## Instructions
For each claim, determine ONE of:
- **VERIFIED:** <what you checked and how it confirms the claim>
- **REFUTED:** <evidence that contradicts the claim — file:line, search result, or logical proof>
- **UNVERIFIABLE:** <what you tried, why it can't be confirmed>

You have tool access. Use grep, find, Read to check claims against the filesystem.
Do NOT manufacture flaws. If all claims check out, say so.
Do NOT say "I think" or "probably." Only "I verified" or "I found."
Genuine issues only. Agreement when warranted is not failure.
```

Use `model: "sonnet"` for challengers.

## Step 5: Synthesize

After all agents (and challengers in deep mode) complete, YOU synthesize:

### Quick mode output:

```
## Meeting: <topic>

**Recommendation:** <one clear recommendation in 1-2 sentences>

**Key risks:**
- <risk 1>
- <risk 2>

**Confidence:** <HIGH/MEDIUM/LOW> — <why>

**Perspectives consulted:** <agent names>
```

### Deep mode output:

```
## Meeting: <topic>

**Recommendation:** <one clear recommendation in 1-2 sentences>

**Verified claims:**
- <claim> — verified by <evidence>

**Refuted ideas:**
- <idea> — refuted because <evidence>

**Key risks:**
- <risk 1>
- <risk 2>

**Unresolved tensions:**
- <tension, if any>

**Confidence:** <HIGH/MEDIUM/LOW> — <why>

**Perspectives consulted:** <agent names>
**Verification depth:** <N claims checked, M verified, K refuted>
```

## Step 6: Update Agent Memory

After synthesis, check if any agent produced a novel insight worth remembering. A "novel insight" is:
- A pattern or principle not already in that agent's memory
- Something that would change the agent's response in a future meeting on a similar topic
- NOT a topic-specific fact (those belong in project memory, not agent memory)

For each novel insight, append to `~/.claude/agent-memory/<name>/MEMORY.md`:

```markdown
- [<topic summary>](<date>) — <one-line insight>
```

**Rules for memory updates:**
- Maximum 2 new entries per meeting (avoid memory bloat)
- Skip if the meeting produced no novel generalizable insights
- Never store topic-specific details — only reusable principles
- If an existing entry contradicts the new insight, UPDATE the old entry instead of adding a duplicate

**Examples of good memory entries:**
- `- [hook enforcement](2026-05-08) — advisory hooks are unenforceable; only PreToolUse blocks with {"decision":"block"} actually work`
- `- [parallel agents](2026-05-08) — marker-file state machines convert PostToolUse advisories to PreToolUse blockers`

**Examples of bad memory entries (too specific):**
- `- [meeting about hooks](2026-05-08) — user has 22 hooks, 12 blocking, 10 advisory`

## Step 7: User Decision

After synthesis, offer:
1. **Accept** — done
2. **Go deeper** — promote to deep mode (if in quick) or add another round
3. **Challenge** — user disagrees with something specific, re-run relevant agent

## Fallback Agent Definitions

Use these if `~/.claude/agents/{name}.md` does not exist:

- **explorer:** Search the codebase for files, patterns, code. Return FACTS with file:line. Never theorize.
- **researcher:** Search the web for docs, best practices, prior solutions. Return findings with URLs.
- **prior-art:** Check if a solution already exists locally or in packages. Return location or "not found."
- **architect:** Design-thinking perspective. Evaluate structure, patterns, trade-offs.
- **domain:** Project domain expert. Knows your business logic, data models, and workflows.
- **implementer:** Build-execution perspective. What's feasible, what's the build plan.
- **tester:** Test strategy. How to prove it works. Acceptance criteria.
- **reviewer:** Verification perspective. Catch mistakes, challenge honesty, check quality.
- **ops:** Operations. Cost, deployment, reliability, what's already running.
- **user-advocate:** End-user perspective. Is it clear? Actionable? Usable without tribal knowledge?

## Important Rules

- **Parallel execution within layers.** All agents in a layer launch in ONE message.
- **Sequential between layers.** Layer 2 (challengers) waits for Layer 1 results.
- **Challengers verify, not attack.** No forced flaw counts. Genuine issues only.
- **Evidence required.** Challengers must cite file:line, grep results, or logical proof.
- **SKIP is valid.** Agents with nothing to add should say so, not generate filler.
- **Output is for the USER.** Concise recommendation, not a transcript. Internal working stays internal.
- **Self-gating over orchestrator-gating.** Agents decide their own relevance to avoid confirmation bias.
- **Explorer uses subagent_type: Explore.** This ensures actual tool usage, not essays.
- **Memory accumulates.** Each meeting makes agents smarter for the next one.
- **Timeout: 60 seconds per layer.** If stuck, synthesize with what you have.
