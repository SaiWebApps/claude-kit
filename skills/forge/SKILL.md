---
name: forge
description: "TRIGGER when: the user wants a multi-perspective decision/review, says 'have a meeting' about something, asks to verify/prove a non-trivial claim, or before declaring a non-trivial task done / before a commit or shared-state write. Fast + precise + autonomous answer engine. Fuses /meeting (parallel perspectives → a draft) with /adversary (hostile, evidence-gated verification) into ONE bounded loop that produces an answer AND proves it before returning. A JS gate — not agent prose — decides PASS/REVISE. Built to beat a lazy, lying, autonomous-hostile Claude. Replaces /meeting. Default posture: REVISE."
---

# /forge — generate → verify → gate → revise, in one autonomous loop

> Replaces `/meeting`. Where `/meeting` only generated and `/adversary` only verified, `/forge`
> does both in one self-terminating loop: it drafts an answer from parallel perspectives, then
> hostile verifiers re-check every load-bearing claim **with their own tool calls**, then a
> **deterministic JS gate** (not an agent's paragraph) returns PASS or PARTIALLY-VERIFIED. It
> never asks you a question mid-run.

## Why this exists (the three problems it fights)
1. **Claude lies / hallucinates.** Every load-bearing claim is independently re-verified by a
   skeptic that re-opens the cited `file:line` and confirms the quoted bytes are really there;
   default verdict is skeptical (UNPROVEN / REVISE), and PASS requires positive evidence — never
   the mere absence of objections.
2. **Claude is lazy** (greps instead of reading, takes the easy route). SCOPE names the exact whole
   files that must be read; generators must emit a `FILES I READ IN FULL` receipt; `subagent_type:
   Explore` (which returns excerpts) is **not** used. Laziness becomes mechanically detectable.
3. **Claude is hostile / error-prone and must run unattended.** The loop is pure JS control flow with
   a hard 2-cycle cap and a token-budget guard; it terminates in PASS or a documented
   PARTIALLY-VERIFIED report. It **never** calls AskUserQuestion.

## The enforcement principle
The model is the adversary, so **every decision lives in code, not prose**: agent counts, stakes
classification, which verification tier fires, whether evidence actually exists, the PASS/REVISE
verdict, and the loop bounds are all JS expressions over **flat structured output**. Agents gather
and explain; `forge.js` decides. (This is the lesson of the dead `meeting-sequential-enforcer.sh`
hook — a skill that *claims* enforcement it doesn't have is a lie. `/forge`'s enforcement is real
because it is JS.)

## When to run
- Any substantive question/decision where you need a **right** answer, not a fast guess.
- Before declaring a non-trivial task done, before a commit, or before a shared-state write — feed
  the artifact as `draft` and let the gate attack it.

## ONE mode — depth auto-modulates on RISK (no `quick`/`auto`/`deep` flag)
"Fast AND precise" is not a flag you pick; it is a function of how likely the answer is **wrong**.
`forge` computes `RISK = max(stakesScore, uncertaintyScore)` ∈ {1,2,3} in JS and scales verification to it:
- **RISK 1 (LOW)** — per-claim skeptic on every load-bearing claim only. Fast. (No PASS is ever returned
  without ≥1 independent re-verification — the floor that kills "fast but wrong".)
- **RISK 2 (MED)** — skeptics **+ independent byte-quote audit** of every checkable claim citation.
- **RISK 3 (HIGH)** — skeptics + audit **+ the 3 adversaries** (DEPTH / HONESTY / REPEAT). Sticky: once any
  cycle hits HIGH the rest of the run stays HIGH, so a softened final draft can't dodge scrutiny.
- `stakesScore` = destructive-action stakes (HIGH_RE/ABSENCE_RE regex). `uncertaintyScore` rises with
  claim count, perspective disagreement, thin (no-`file:line`) evidence, absence claims, and hedge density.
  **This is why a hard, non-destructive factual question still gets attacked** — accuracy ⊥ destructiveness.
- Every run also fires a **read-receipt + breadth-coverage auditor** (when there's anything to check): it
  `wc -l`s each file a generator *claimed* to read (catches fabricated reads — E2) and flags HIGH-relevance
  files the wide BREADTH sweep found that nobody read (catches shallow exploration — E3).
- All verifiers run in **ONE concurrent wave**, not sequential tiers — the latency win over the old design.
- The `SPEED` adversary was **removed**: it reviewed a static draft's "process" that doesn't exist, padded
  quota-fabricated findings into the blocking sum, and caused spurious REVISE cycles. Its slot is now BREADTH.

## How to run
```
Workflow({
  scriptPath: "/Users/sairambkrishnan/.claude-work/workflows/forge.js",
  args: {
    task:  "<one line: the question / decision / task>",
    draft: "<optional: an existing answer/output/plan to attack and improve>",
    files: "<optional: paths the work centers on, so SCOPE + BREADTH point at them>"
    // NOTE: there is no `mode`. Depth is automatic (RISK). A legacy `mode` key is accepted and IGNORED.
  }
})
```
Pass **`scriptPath` only — never both `script` and `scriptPath`** (passing both drops args and the
M8 guard will throw rather than return a false no-op PASS). `task` (or `draft`) is required.

## What it does (phases, all in `forge.js`)
1. **SCOPE** — names the claims to resolve and the whole files to read.
2. **GENERATE + BREADTH (parallel)** — ≤3 perspective agents (real defs via `agentType`: architect +
   reviewer/tester + one topic agent), each citing evidence and emitting a `FILES I READ IN FULL` receipt;
   **concurrently**, a BREADTH agent does a wide cheap sweep enumerating every candidate file + relevance.
3. **SYNTHESIZE** — merge into one draft + a flat claim list + a `conflictsResolved` count.
4. **CLASSIFY + RISK (JS)** — each claim → LOW/MED/HIGH by regex (agents may escalate, never downgrade);
   then `RISK = max(stakes, uncertainty)` decides verification depth. No human picks a mode.
5. **VERIFY — ONE concurrent wave** — per-claim skeptic on every claim; **+ 3 adversaries**
   (DEPTH/HONESTY/REPEAT) at RISK 3; **+ byte-quote AUDIT** of claim citations at RISK ≥ 2; **+ read-receipt /
   breadth-coverage auditor** whenever there's a file to check — all fired in a single `parallel()` wave.
6. **GATE (JS)** — `verdict = PASS` only if the JS `computeGate` finds **no** REVISE reason; otherwise REVISE
   (default). Triggers (all in code): non-PROVEN/missing skeptic, deferred claim, blocking adversary finding
   (incl. REPEAT), unaddressed REPEAT violation, fabricated citation, adversaries owed but <3 evidenced,
   audit owed but not covering every checkable claim, **fabricated/wrong file-read receipt (E2)**,
   **HIGH-relevance file the breadth sweep found but nobody read (E3)**, any HIGH claim not re-verified.
   Enforced by three committed `node` tests: `forge.classify.test.mjs` (stakes regex, 42 cases),
   `forge.gate.test.mjs` (the verdict predicate, 19 cases), `forge.coverage.test.mjs` (every verifier
   schema field — incl. the new COVERAGE_SCHEMA — is actually read by the gate; no collect-but-don't-gate holes).
7. **REVISE loop** — feed back only the must-fix items; re-verify; cap 2 cycles + budget guard; stop early on
   no progress.

## What it returns
A structured result whose `report` field has the four mandatory headers verbatim:
`## BLOCKERS (exact error text)` · `## SKIPPED — needs user approval` ·
`## DATA ABSENT — unverified` · `## DECISIONS I made without you`, plus the JS-computed verdict
basis and a per-verifier evidence audit. The verdict line carries an **assurance label** so a weak
PASS can't masquerade as a strong one:
- `PASS — RISK 3/3: adversaries + byte-quote audit + read-receipt/coverage` — the full attack ran clean.
- `PASS — RISK 2/3: byte-quote audit + skeptic (no adversaries)` — medium risk; claims re-verified + audited.
- `PASS — RISK 1/3: per-claim skeptic only` — low risk; every claim still independently re-verified once.
- `PARTIALLY-VERIFIED` — the gate could not clear a BLOCKER within the cap (reasons listed).
The machine-readable `verdict` field stays `PASS` / `PARTIALLY-VERIFIED`; the depth is in `assurance`.

## After it returns
- **PASS** — the draft survived independent re-verification. Every load-bearing claim was re-checked by a
  per-claim skeptic (the floor); read the DATA ABSENT header for what depth ran (adversaries only fire at
  RISK 3) and for any deferred/over-cap claims listed as not independently checked.
- **PARTIALLY-VERIFIED** — the gate could not clear every BLOCKER inside the cap. The reasons are in
  the BLOCKERS header. Address them and re-run, or consciously accept the listed residual risk.
  Do **not** report the answer as verified.

## Limits (honest)
- The verifiers are also Claude. The JS-computed verdict + the byte-quote audit + the default-skeptical
  posture make a lazy/lying verifier much harder, but a verifier that quotes real bytes yet reasons wrongly
  can still slip — residual risk, not eliminated.
- The stakes classifier is regex. An **unmatched** destructive verb falls to **LOW** stakes — but the
  **uncertainty** half of RISK (claim count, disagreement, thin evidence, absence, hedging) can still raise
  depth, so a novel-but-uncertain claim is not automatically under-verified. A claim that is both novel-phrased
  *and* confidently/thinly stated is the residual gap — phrase sharply or split it so it earns its citations.
- The **read-receipt check is existence + line-count only**: a matching `wc -l` proves a cited file exists and
  was sized, **not** that it was read end-to-end. It catches fabricated/absent reads (the common laziness mode),
  not a genuine partial read that reports the right line count.

## Reused primitives (independently callable; `/forge` inlines their prompt logic)
- `~/.claude-work/workflows/adversarial-trio.js` — the standalone adversary attack (`/adversary`). NOTE:
  `/forge` inlines only **3** of its roles (DEPTH / HONESTY / REPEAT); it dropped SPEED, which reviewed a
  static draft's nonexistent "process" and manufactured spurious blocking findings.
- `~/.claude-work/workflows/single-skeptic.js` — one-claim re-verification with FABRICATED-CITATION
  and absence positive-control rules.
