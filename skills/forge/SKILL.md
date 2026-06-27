---
name: forge
description: "TRIGGER when: the user wants a multi-perspective decision/review, says 'have a meeting' about something, asks to verify/prove a non-trivial claim, or before declaring a non-trivial task done / before a commit or shared-state write. Fast + precise + autonomous answer engine. Force-loads prior retros/memories/settings every run, casts a breadth-FIRST net so it reads the RIGHT files, verifies every load-bearing claim with a JS gate (not agent prose), and is wall-clock bounded. Built to beat a lazy, lying, shallow-exploring, autonomous-hostile Claude. Replaces /meeting. Default posture: REVISE. /forge is a TOOL you invoke when you want it — NOT a mandatory gate."
---

# /forge — force-load → breadth-first generate → verify → gate → revise, in one bounded autonomous loop

> Where `/meeting` only generated and `/adversary` only verified, `/forge` does both in one self-terminating
> loop: it **force-loads what it has already been taught**, casts a **breadth-first** net so generators read
> the files that actually matter, drafts an answer from parallel perspectives, then hostile verifiers re-check
> every load-bearing claim **with their own tool calls**, then a **deterministic JS gate** (not an agent's
> paragraph) returns PASS or PARTIALLY-VERIFIED. It never asks you a question mid-run.

## Why this exists (the problems it fights)
1. **Claude lies / hallucinates.** Every load-bearing claim is independently re-verified by a per-claim
   skeptic that re-opens the cited `file:line` and confirms the quoted bytes; `isProven` requires the
   integrity booleans to be **affirmatively true** (an omitted field no longer passes); default verdict is
   skeptical and PASS requires positive evidence, never the mere absence of objections.
2. **Claude is lazy / explores shallowly.** A **breadth-FIRST** sweep enumerates candidate files (and, for a
   change task, the actual `git diff` files) *before* generation and DIRECTS what gets read; generators emit a
   `FILES I READ IN FULL` receipt a `wc -l` auditor checks. Laziness is mechanically detectable.
3. **Claude doesn't learn.** A dedicated PRIME **force-load** digest reads `~/.claude-work/CLAUDE.md`, the
   retro anti-pattern table, `settings.json` active hooks, and the panel-role memories **every run** and
   injects them into every agent — and the gate **blocks PASS if the digest didn't load**.
4. **Claude is slow / wrong / declares done prematurely — the top-3 friction modes (wrong-approach,
   over-analysis, premature-completion).** Per-stage **effort tiering** (no agent runs at xhigh), a LOW-risk
   fast path, fewer barriers, and a **wall-clock bound** attack the slowness; the JS gate attacks the
   wrong/premature. These structural defenses map 1:1 to the quantified friction and must not be stripped.

## The enforcement principle
The model is the adversary, so **every decision lives in code, not prose**: stakes classification, which
verification tier fires, whether evidence exists, the PASS/REVISE verdict, per-claim coverage, and the loop
bounds are all JS over **flat structured output**. Agents gather and explain; `forge.js` decides. **forge adds
NO new always-on hooks** — all enforcement is in-script JS gates + committed `node` tests (the report showed
false-positive hooks waste the user's time; durable prevention that IS wanted already lives in `guard.sh` et al.).

## ONE mode — depth auto-modulates on RISK (no `quick`/`auto`/`deep` flag)
"Fast AND precise" is not a flag you pick; it is a function of how likely the answer is **wrong**.
`forge` computes `RISK = max(stakesScore, uncertaintyScore)` ∈ {1,2,3} in JS and scales verification to it:
- **Every run** first does **PRIME**: force-load digest ‖ breadth-first sweep (low effort, one wave).
- **RISK 1 (LOW)** — per-claim skeptic on every load-bearing claim. A trivial LOW prose question takes a
  **fast path** (one combined agent, panel/breadth/synth skipped) — but the digest still force-loads and the
  gate still runs. (No PASS without ≥1 independent re-verification — the floor that kills "fast but wrong".)
- **RISK 2 (MED)** — skeptics **+ independent byte-quote audit** of every checkable HIGH-claim citation.
- **RISK 3 (HIGH)** — skeptics + audit **+ the 3 adversaries** (DEPTH / HONESTY / REPEAT). Sticky: once any
  cycle hits HIGH the rest of the run stays HIGH. Adversaries fire at cycle 0 **or** when a later cycle's risk
  genuinely RISES (re-attacking a regression a revise introduced) — not redundantly on every flat-risk revise.
- Per-claim id-coverage applies to **ALL stakes** (MED/LOW too), so a verifier can't satisfy coverage with
  duplicate or mismatched verdicts. Every run also fires the **read-receipt + breadth-coverage auditor** (E2/E3).

## How to run — launch in the background + arm the ≤15-min watchdog
forge is bounded to **≤15 min** by TWO mechanisms: (1) **structural** caps in `forge.js` — per-stage effort
tiering (no agent at xhigh), ≤~6 sequential barriers, a `budget.spent()` token ceiling — the primary,
deterministic, unit-tested guarantee; and (2) an **external wall-clock watchdog** you arm at launch. A workflow
script has **no clock** (`Date.now()` throws by design), so the only *true* wall-clock kill is external.

1. Launch in the background and capture the task id (the Workflow tool ALWAYS runs in the background and
   returns a task id immediately — there is no `run_in_background` flag to pass):
```
Workflow({
  scriptPath: "/Users/sairambkrishnan/.claude-work/workflows/forge.js",
  args: {
    task:  "<one line: the question / decision / task>",
    draft: "<optional: an existing answer/output/plan to attack and improve>",
    files: "<optional: paths the work centers on — unioned into the breadth-derived mandatory read set>",
    panel: "<optional: e.g. ['architect','domain','tester'] — validated allow-list, cap 3>",
    base:  "<optional: a git base ref → marks this a change task and forces git grounding>"
    // there is no `mode`. Depth is automatic (RISK). A legacy `mode` key is accepted and IGNORED.
  }
})
```
2. Immediately arm a one-shot, session-only watchdog ≈15 min out:
```
CronCreate({ recurring:false, durable:false, cron:"<now+15min: minute hour dom month *>",
  prompt: "WATCHDOG forge: run TaskList; if the forge workflow task <ID> is STILL running, TaskStop it and
           tell the user forge hit the 15-min wall-clock cap (treat as PARTIALLY-VERIFIED); else do nothing." })
```
3. On the completion notification (normally well under 15 min), use the report; the one-shot cron then no-ops
   or is removed with `CronDelete`.

Pass **`scriptPath` only — never both `script` and `scriptPath`** (the M8 guard throws rather than return a
false no-op PASS). `task` (or `draft`) is required. **Honest watchdog limit:** the cron fires only while the
REPL is idle and only within THIS session (`durable:false`); for an interactive run where you're waiting it
works; a fully-abandoned headless run is best-effort. The structural caps are the primary bound; the watchdog
is the backstop for a pathological hang.

## What it does (phases, all in `forge.js`)
1. **PRIME (force-load ‖ breadth-FIRST, one low-effort wave)** — a DIGEST agent force-loads CLAUDE.md + retro
   anti-patterns + settings.json + the panel-role memories (gate BLOCKS PASS if it didn't load); a BREADTH
   agent casts a wide net and, for a change task, runs `git status/diff`. `mandatoryReads = union(files,
   git-changed, breadth-HIGH)` DIRECTS the panel. (The old standalone SCOPE phase was removed.)
2. **GENERATE** — a LOW fast path (one combined agent) OR ≤3 perspective agents (real defs via `agentType`),
   each handed the breadth ledger + the digest, each emitting a `FILES I READ IN FULL` receipt.
3. **SYNTHESIZE** — merge into one draft + a flat claim list (split bundled multi-fact claims) + conflicts count.
4. **CLASSIFY + RISK (JS)** — each claim → LOW/MED/HIGH by regex (de-brittled: benign collocations demote,
   numeric/absence values escalate); `RISK = max(stakes, uncertainty)`. No human picks a mode.
5. **VERIFY — ONE concurrent wave** — per-claim skeptic on every claim; **+ 3 adversaries** at RISK 3; **+
   byte-quote AUDIT** at RISK ≥ 2; **+ read-receipt/coverage auditor**; per-stage effort-tiered; wave width is
   bounded + logged (over the concurrency cap it runs in sub-waves).
6. **GATE (JS)** — `verdict = PASS` only if `computeGate` finds **no** REVISE reason. Triggers (all in code):
   digest-not-loaded, change-task-without-git-grounding, bundled multi-fact claim, deferred claim, non-PROVEN/
   missing/duplicate skeptic, any claim (ANY stakes) not re-verified by a matching-id skeptic, blocking
   adversary finding, unaddressed REPEAT, fabricated citation, audit/coverage owed-but-short, E2/E3 violation.
   Enforced by committed `node` tests: `forge.classify` (64), `forge.gate` (32 + 6 adversary-trigger),
   `forge.coverage`, `forge.budget`, `forge.noprogress`, `forge.order`, `forge.wave`, `forge.receipts`,
   `forge.panel`, `forge.effort`, `forge.fastpath`, `forge.report-bound`, `forge.memory` — all run by `run-tests.sh`.
7. **REVISE loop** — feed back only the must-fix items; re-verify; per-cycle verify cap of **8** claims; cap
   **2** cycles + a `budget.spent()` token ceiling; a normalized no-progress check stops a 1-char dodge.

## What it returns
A structured result whose `report` field has the four mandatory headers verbatim:
`## BLOCKERS (exact error text)` · `## SKIPPED — needs user approval` · `## DATA ABSENT — unverified` ·
`## DECISIONS I made without you`, plus a force-load line, the JS-computed verdict basis, and a per-verifier
evidence audit. The scalar `verdict`/`assurance`/`draft` are **always** returned in full (the human report
truncates only the answer body, declared, to stay under the output cap). The verdict line carries an
**assurance label** so a weak PASS can't masquerade as a strong one:
- `PASS — RISK 3/3: adversaries + byte-quote audit + read-receipt/coverage` — the full attack ran clean.
- `PASS — RISK 2/3: byte-quote audit + skeptic (no adversaries)` — medium risk; claims re-verified + audited.
- `PASS — RISK 1/3: per-claim skeptic only` — low risk; every claim still independently re-verified.
- `PARTIALLY-VERIFIED` — the gate could not clear a BLOCKER within the cap (reasons listed).

## After it returns
- **PASS** — the draft survived independent re-verification AND the force-load digest loaded. Read DATA ABSENT
  for depth (adversaries only at RISK 3) and any deferred/over-cap claims.
- **PARTIALLY-VERIFIED** — the gate could not clear every BLOCKER inside the cap. Address the BLOCKERS and
  re-run, or consciously accept the listed residual risk. Do **not** report the answer as verified.

## Limits (honest)
- **The verifiers are also Claude and SELF-REPORT their evidence counts.** The JS verdict + byte-quote audit +
  read-receipt auditor make a lazy/lying verifier much harder, but forge cannot read another agent's tool-call
  transcript in-script — a verifier that fabricates counts is a residual, not a closed, risk (stated in DATA ABSENT).
- **No in-script clock.** The ≤15-min bound is structural + the external watchdog; a script cannot stopwatch itself.
- The stakes classifier is regex (de-brittled, but not perfect). The **read-receipt check is existence +
  line-count only** — it catches fabricated/absent reads, not a genuine partial read with the right line count.
- If the **force-load digest fails to load**, the gate blocks PASS and DATA ABSENT says so — forge will not
  certify an answer it couldn't vet against prior incidents.

## Reused primitives (independently callable; `/forge` inlines their prompt logic)
- `~/.claude-work/workflows/adversarial-trio.js` — the standalone adversary attack (`/adversary`). `/forge`
  inlines only **3** of its roles (DEPTH / HONESTY / REPEAT); it dropped SPEED (spurious blocking findings).
- `~/.claude-work/workflows/single-skeptic.js` — one-claim re-verification with FABRICATED-CITATION and
  absence positive-control rules.
