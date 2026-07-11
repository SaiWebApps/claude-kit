---
name: dev
description: "TRIGGER when the user wants a feature built, a bug fixed, or a change made in an existing project and wants to TRUST the result without reading every line. Drives one bounded lifecycle — explore → product-owner (testable criteria) → plan → code (red-first) → unit/integration/functional test → E2E (real browser, screenshots) → skeptic (undo/mutation test) → gate → acceptance — where every phase transition is gated by execution evidence, not prose. Language-agnostic: it learns the project's test/lint/build/E2E commands once and remembers them. Built so you can delegate and trust: nothing is 'done' until an independent skeptic tried to break it and a mutation test proved the tests aren't fake."
---

# /dev — a trustworthy software-development lifecycle

> The point of this skill is **delegation you can trust**. It does not ask you to read the diff to believe
> it works; it forces the machine to *prove* it works and hands you the proof. The load-bearing idea, from
> the whole kit: **the model is the adversary — put the verdict in evidence, not in the model's own say-so.**

## The five things this skill forces (never negotiable)

1. **Acceptance criteria first, in EARS, RED before GREEN.** The `product-owner` agent writes testable criteria
   ("WHEN <trigger>, the system SHALL <observable>") *before* code. Each becomes a test written to FAIL first;
   you see it red, then the code turns it green. A criterion with no failing-first test is not proven.
2. **The mutation / undo test on every behavior change.** Revert the fix → the guarding test MUST go RED. A test
   that stays green with the fix reverted is FAKE and is rejected. A check that cannot fail is not a check.
   (This is exactly what `forge`'s mutation gate enforces mechanically.)
3. **An independent hostile skeptic on every "done."** The `skeptic` agent runs in a FRESH context, never grades
   its own work, and its report FAILS unless it names a concrete defect with evidence OR lists the specific
   attacks it ran and found none. "Looks good" is an automatic fail.
4. **Execution evidence, not prose.** Every claim is backed by pasted command output produced THIS run — and for
   any user-facing behavior, a real E2E run WITH screenshots. "This should work" is never accepted.
5. **The mechanical hooks stay on.** `prevent-laziness` / `workaround-spiral-detector` / `commit-message-audit` block
   stubs, skipped tests, raw commands, and unfounded commits at the tool level — see `harness/examples/settings.json`.

## First run in a repo — learn how to build/test here (once, then remembered)

This skill is language-agnostic. On the first invocation in a repo it establishes an **adapter** and saves it to
`${CLAUDE_CONFIG_DIR:-$HOME/.claude}/dev-configs/<repo-slug>.json` (like `/ship` remembers where to push):

```json
{
  "repo_slug": "myapp",
  "baseline":  "make test",          // the FULL green bar (e.g. make test · npm test · cargo test · pytest · go test ./...)
  "lint":      "make lint",          // or "npm run lint" · "ruff check" · "cargo clippy" · "none"
  "build":     "make build",         // or "npm run build" · "cargo build" · "go build ./..." · "none"
  "unit":      "make test-unit",     // subset for fast iteration (falls back to `baseline`)
  "e2e":       "make test-e2e",      // Playwright/Selenium/cypress; "none" if the project has no E2E yet
  "mutation":  "auto",               // "stryker" · "mutmut" · "pitest" · "auto" (revert-the-hunk fallback)
  "run":       "make dev"            // how to run the app for a live/functional check
}
```

Auto-detect from the repo, then confirm with ONE `AskUserQuestion` (interactive) or record `AUTO-DETECTED —
unconfirmed` and proceed (autonomous). If a command is missing, add a Makefile/script target for it rather than
running raw — the hooks enforce this. Every later run reads the adapter silently.

## The lifecycle (each arrow is a gate — you cannot cross it without the evidence named)

**Phase 0 — Baseline (must be green before any work).** Run `baseline` + `lint`. If anything fails or is
skipped, fix it FIRST — a task started on a red baseline can't prove anything. Paste the raw output.

**Phase 1 — Explore.** Spawn `scout` (agent) to gather facts: the files this touches (internal), any prior art
/ library that already does it (external + build-vs-buy), and what does NOT exist. Cited `file:line` / URLs
only — no theories. This keeps the orchestrator's context lean.

**Phase 2 — Product-owner: the ask, as testable criteria (front gate).** Spawn `product-owner` (agent). It
returns the real need, the SMALLEST valuable slice (+ what's out of scope), and numbered EARS acceptance
criteria — each objectively checkable by a command or a run, including the negative/failure and thin-input
cases. **These criteria are the contract every later phase is measured against.** If the ask is really N
features, it splits them; you build one slice at a time.

**Phase 3 — Plan.** Use the built-in `Plan` agent (or a scored panel of approaches). The plan gives every
file/test/criterion a stable ID (F1/T1/AC1) so downstream work references IDs, not vibes. Read the whole
relevant file before planning to change it.

**Phase 4 — Code, red-first (one developer per file; parallel via `isolation: worktree` when they'd collide).**
For each acceptance criterion: (a) write the test FIRST and RUN it — watch it FAIL for the right reason; (b)
write the minimal code; (c) RUN it GREEN. Delete code written before its test. No stubs/TODOs (the hook blocks
them). Conform to the project's lint rules from the first keystroke.

**Phase 5 — Test while coding (unit → integration → functional).** Run the adapter's `unit`, then the full
`baseline` (integration), then a functional check via `run` (start the app / hit the endpoint). The bar is the
FULL suite: 0 failed AND 0 skipped — a skip is a failure in disguise; diagnose why it skips. Start sidecars
(DBs, brokers) BEFORE running, never skip a test because a service isn't up. Paste the summary line.

**Phase 6 — E2E / automation (prove it at the macro level, visibly).** For any user-facing behavior, run the
adapter's `e2e` (Playwright preferred, Selenium if that's what the project uses) against a REAL browser and
capture **screenshots / traces**. Code reading and unit tests do NOT satisfy a "the UI now does X" claim — a
screenshot the user can SEE does. If the project has no E2E harness, scaffold the smallest one that exercises
the new flow (Playwright: `npx playwright test`), and record it in the adapter.

**Phase 7 — Skeptic: try to break it (back gate, independent).** Spawn `skeptic` (agent) in a FRESH context,
fed only the diff + the acceptance criteria — never your rationale. It MUST: (a) run the **undo/mutation test**
— revert the fix, confirm the guarding test goes RED (STILL green ⇒ the test is fake ⇒ reject), restore, confirm
GREEN, paste both; (b) re-run the bar itself; (c) attack the negative space (empty/oversized input, concurrency,
the same path via another entry point). Its verdict is DEFECT-FOUND (+ evidence) or NO-DEFECT (+ the named
attacks it ran). If it can't name attacks, it failed — re-spawn it.

**Phase 8 — Gate (mechanical).** Run `/forge` on the change (pass the git `base`) so its JS gate — not a
paragraph — returns PASS or PARTIALLY-VERIFIED. On a change task with a load-bearing claim, forge's **mutation
gate** requires the skeptic's undo-test verdict to be `RED_THEN_GREEN`; a fake or missing test blocks PASS. Also:
`lint` clean, `baseline` green, E2E screenshots attached. Revert anything not both green AND reviewed.

**Phase 9 — Acceptance (is it actually good?).** Spawn `product-owner` once more as the end-user: experience
the real artifact and rule SHIP / NEEDS-WORK / REJECT on the user's terms (day-1 clarity, actionable errors,
cognitive load) — not just "tests pass." Then hand off to `/ship` to commit + push, and `/retro` if anything
went sideways.

## Rigor tiers (right-size it so quality is never slow)

Run the SMALLEST pipeline that fits; when unsure, go up one. Speed comes from right-sizing + running independent
roles in PARALLEL (fan out scouts / developers-per-file / a skeptic panel), never from skipping a gate.

- **Tier 0** (docs / one-line mechanical): Phase 4 + Phase 8 gate.
- **Tier 1** (small bugfix): + Phase 0 baseline, Phase 7 skeptic (undo test), Phase 2 (one criterion).
- **Tier 2** (feature / user-facing): the full 0–9 lifecycle.
- **Tier 3** (milestone / infra / data / deploy): full + real-device/-browser proof + human sign-off + a
  written justification (reason + evidence) for any destructive/irreversible step, honoring whatever
  destructive-op guard the target repo itself provides.

## What "done" means here (the report you get)

A change is done only when you can SEE: the acceptance criteria (each with a test that went red-then-green), the
FULL suite green (0 skipped), the E2E screenshots, the skeptic's NO-DEFECT verdict with its attack list, and
`/forge` PASS with `mutationVerdict = RED_THEN_GREEN`. If any is missing, the honest status is PARTIALLY-VERIFIED
with the blocker named — never a bare "it works."

## Honest limits

The developer, skeptic, and product-owner are all still the model; the mechanical floor (the hooks, forge's JS
gate, the mutation gate, and *execution evidence you can re-run*) is what makes a lazy or lying step detectable —
not the model's goodwill. Use a DIFFERENT model for the skeptic when you can (cross-model diversity), and treat a
verifier that reports counts it can't show as a residual risk, stated in the final report.
