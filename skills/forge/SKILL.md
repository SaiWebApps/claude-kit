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

## Speed vs precision — pick per question with `mode`
"Fast AND precise" is a tradeoff you steer, not a free lunch:
- `mode: "quick"` — **fast lane.** Generate → per-claim skeptic only; no 4-adversary attack, no
  byte-quote audit. Fastest; a quick PASS is labeled in DATA ABSENT as skeptic-only. Use for
  low-risk questions or a first pass.
- `mode: "auto"` (default) — **tiered.** Cheap for LOW-stakes claims; fires the full 4-adversary
  attack + audit only when a HIGH-stakes claim appears, and **keeps it sticky** for the rest of the
  run so the final draft can't dodge scrutiny by softening its wording. A fully-verified high-stakes
  answer takes minutes and ~1M tokens — that is the cost of proving it.
- `mode: "deep"` — **max rigor.** Always runs the full attack even on a low-stakes draft.

## How to run
```
Workflow({
  scriptPath: "/Users/sairambkrishnan/.claude-work/workflows/forge.js",
  args: {
    task:  "<one line: the question / decision / task>",
    draft: "<optional: an existing answer/output/plan to attack and improve>",
    files: "<optional: paths the work centers on, so SCOPE points generators at them>",
    mode:  "auto"   // "auto" (default) | "deep" (force Tier-2 adversaries) | "quick"
  }
})
```
Pass **`scriptPath` only — never both `script` and `scriptPath`** (passing both drops args and the
M8 guard will throw rather than return a false no-op PASS). `task` (or `draft`) is required.

## What it does (phases, all in `forge.js`)
1. **SCOPE** — names the claims to resolve and the whole files to read.
2. **GENERATE** — ≤3 perspective agents in parallel (real defs via `agentType`: always architect +
   reviewer/tester + one topic agent), each citing evidence and reporting files read in full.
3. **SYNTHESIZE** — merge into one draft + a flat claim list.
4. **CLASSIFY (JS)** — each claim → LOW / MEDIUM / HIGH by deterministic regex. An agent may
   escalate above the code-set floor, never below it (kills self-under-classification).
5. **VERIFY (tiered)** — per-claim skeptic on MEDIUM+HIGH (cheap, pipelined); the 4 adversaries
   (DEPTH/HONESTY/SPEED/REPEAT) fire only when a HIGH claim exists or `mode:"deep"`.
6. **AUDIT (HIGH-stakes only)** — an independent auditor re-opens the *verifiers' own* cited bytes
   and flags fabricated citations (defends against a lazy verifier giving a false PASS).
7. **GATE (JS)** — `verdict = PASS` only if the JS finds **no** REVISE reason; otherwise REVISE
   (default). The full set of REVISE triggers (all computed in code, none agent prose): a non-PROVEN
   skeptic verdict (PROVEN requires evidence>0, quote/cite/positive-control not false), any *deferred*
   or *missing* skeptic verdict, a blocking adversary finding (including the REPEAT adversary),
   an unaddressed REPEAT violation, a fabricated citation from the audit, Tier-2 owed but run with
   <3 evidenced adversaries, a high-stakes audit owed but not covering every checkable claim, any HIGH
   claim not independently re-verified, and (in quick mode) any HIGH claim/task. Enforced by two
   committed tests: `forge.classify.test.mjs` (the stakes regex) and `forge.coverage.test.mjs` (proves
   every collected verifier field is actually read by the gate — no "collect-but-don't-gate" holes).
8. **REVISE loop** — feed back only the must-fix items; re-verify; cap 2 cycles + budget guard;
   stop early on no progress. (Quick mode is single-pass — it does not revise.)

## What it returns
A structured result whose `report` field has the four mandatory headers verbatim:
`## BLOCKERS (exact error text)` · `## SKIPPED — needs user approval` ·
`## DATA ABSENT — unverified` · `## DECISIONS I made without you`, plus the JS-computed verdict
basis and a per-verifier evidence audit. The verdict line carries an **assurance label** so a weak
PASS can't masquerade as a strong one:
- `PASS — adversarially-verified` — full Tier-2 attack + high-claim byte-quote audit ran clean.
- `PASS — skeptic-only` — per-claim skeptic ran (e.g. quick mode), no adversary attack.
- `PASS — LOW-stakes, self-cited only (NOT independently verified)` — nothing was re-verified.
- `PARTIALLY-VERIFIED` — the gate could not clear a BLOCKER within the cap (reasons listed).
The machine-readable `verdict` field stays `PASS` / `PARTIALLY-VERIFIED`; the depth is in `assurance`.

## After it returns
- **PASS** — the draft survived independent re-verification. Ship it, but read the DATA ABSENT
  header: LOW-stakes claims are accepted on self-citation only, and any deferred/over-cap claims are
  listed there as not independently checked.
- **PARTIALLY-VERIFIED** — the gate could not clear every BLOCKER inside the cap. The reasons are in
  the BLOCKERS header. Address them and re-run, or consciously accept the listed residual risk.
  Do **not** report the answer as verified.

## Limits (honest)
- The verifiers are also Claude. The JS-computed verdict + the HIGH-stakes byte-quote audit +
  default-skeptical posture make a lazy/lying verifier much harder, but a verifier that quotes real
  bytes yet reasons wrongly can still slip — treated as residual risk, not eliminated.
- The stakes classifier is regex. An **unmatched** verb falls to **LOW** (the *least*-verified tier) —
  it does NOT default to HIGH. The regex is hardened to catch the common destructive wordings
  (delete/remove/replace/reset/publish/push/deploy/drop/truncate/migrate/merge/…, conjugations
  included) and is covered by a committed regression test (`forge.classify.test.mjs`, run with
  `node`). But a genuinely novel high-stakes phrasing it doesn't match will under-protect — when in
  doubt, pass `mode: "deep"` to force the full attack regardless of classification.
- A `mode: "quick"` or all-LOW PASS is **not** independently verified — the verdict line says so
  (see assurance label below); don't read it as authoritative.

## Reused primitives (independently callable; `/forge` inlines their prompt logic)
- `~/.claude-work/workflows/adversarial-trio.js` — the 4-adversary attack (`/adversary`).
- `~/.claude-work/workflows/single-skeptic.js` — one-claim re-verification with FABRICATED-CITATION
  and absence positive-control rules.
