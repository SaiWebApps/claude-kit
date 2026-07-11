// forge.mutation.test.mjs — the MUTATION GATE: forge must require an execution-grounded undo test
// for a change task that owes one. "Revert the fix → the guarding test MUST go RED"; a test that stays
// GREEN with the fix reverted is FAKE (a check that cannot fail is not a check) → cannot PASS.
//
// Gated behind an explicit `mutationOwed` flag (the caller sets it = change task + a behavior claim +
// a guarding test exists), following forge's existing coverageOwed/runAudit pattern, so non-change /
// no-test runs are unaffected. Extracts computeGate + isProven from forge.js via the sentinels (single
// source of truth, no drift) — same mechanism as forge.gate.test.mjs.
//   Run:  node /Users/sairambkrishnan/.claude-work/workflows/forge.mutation.test.mjs
import { readFileSync } from 'node:fs'
const src = readFileSync('/Users/sairambkrishnan/.claude-work/workflows/forge.js', 'utf8')
const slice = (from, to) => {
  const a = src.indexOf(from), b = src.indexOf(to, a + 1)
  if (a < 0 || b < 0) throw new Error(`marker not found: ${from} .. ${to} (refactor moved computeGate?)`)
  return src.slice(a, b)
}
const isProvenSrc = slice('const isProven', '\n\n')
const gateSrc     = slice('// >>> COMPUTE-GATE', '// <<< COMPUTE-GATE')
// eslint-disable-next-line no-new-func
const computeGate = new Function(isProvenSrc + '\n' + gateSrc + '\nreturn computeGate;')()

// A base that is otherwise a clean PASS (LOW-only: no adversaries/audit/coverage owed), so the ONLY
// variable under test is the mutation gate. isChangeTask=true + git-grounded (a real change task).
const provenLow = { claimId: 1, verdict: 'PROVEN', evidenceItemsCount: 2, quoteMatches: true, positiveControlOk: true, citedFileChecked: false }
const lowClaim  = { id: 1, text: 'the fix is correct || EVIDENCE: N/A || QUOTE: N/A', stakes: 'LOW' }
const clean = { claimObjs: [lowClaim], high: [], sv: [{ ...provenLow }], toSkeptic: [lowClaim], anyHigh: false,
                runAdversaries: false, runAudit: false, coverageOwed: false, deferred: 0, maxVerify: 8,
                adv: null, audit: null, cov: null, digestOk: true, isChangeTask: true, gitGroundingOk: true }

// The gate DERIVES mutationVerdict from the per-claim skeptics (sv[].mutationVerdict) — so drive it there.
const skep = (mv) => [{ ...provenLow, ...(mv ? { mutationVerdict: mv } : {}) }]
const cases = [
  // owed + the fix is PROVEN by mutation (test went red without it, green with it) → PASS
  ['mutation owed, RED_THEN_GREEN → PASS', { ...clean, mutationOwed: true, sv: skep('RED_THEN_GREEN') }, 'PASS'],
  // owed + the test still passes with the fix reverted → FAKE test → REVISE (gaming)
  ['mutation owed, STILL_GREEN (fake test) → REVISE', { ...clean, mutationOwed: true, sv: skep('STILL_GREEN') }, 'REVISE'],
  // owed + the undo test was never run → execution-unproven → REVISE
  ['mutation owed, NOT_RUN → REVISE', { ...clean, mutationOwed: true, sv: skep('NOT_RUN') }, 'REVISE'],
  // owed + no skeptic reported a verdict → aggregates to NOT_RUN → REVISE (can't self-omit past the gate)
  ['mutation owed, verdict OMITTED → REVISE', { ...clean, mutationOwed: true, sv: skep(null) }, 'REVISE'],
  // NOT owed → the gate does not care what mutationVerdict says → PASS
  ['mutation NOT owed, STILL_GREEN present → PASS', { ...clean, mutationOwed: false, sv: skep('STILL_GREEN') }, 'PASS'],
  // no mutation fields at all (a normal non-change forge run) → unaffected → PASS
  ['no mutation fields (normal run) → PASS', { ...clean }, 'PASS'],
]

let fail = 0
for (const [name, input, want] of cases) {
  let got
  try { got = computeGate(input).verdict } catch (e) { console.log(`ERROR ${name}: ${e.message}`); fail++; continue }
  if (got !== want) { console.log(`FAIL  ${name}: want=${want} got=${got}`); fail++ }
}
// the STILL_GREEN reason must name the fake-test semantics (so the message can't be softened to a generic miss)
const g = computeGate({ ...clean, mutationOwed: true, sv: skep('STILL_GREEN') })
if (!/fake|cannot fail/i.test(g.reasons.join(' '))) { console.log(`FAIL  STILL_GREEN reason must name "fake"/"cannot fail"; got: ${g.reasons.join(' ')}`); fail++ }

if (fail) { console.log(`\n${fail}/${cases.length + 1} mutation-gate checks FAILED`); process.exit(1) }
console.log(`mutation-gate: ${cases.length}/${cases.length} verdicts + fake-test-reason — PASS`)
