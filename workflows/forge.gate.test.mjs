// forge.gate.test.mjs — unit-tests forge.js's PURE verdict function computeGate() against hand-built
// stub adversary/skeptic/audit/coverage outputs. Exercises every REVISE branch (skeptic, adversary,
// repeat, audit, evidenceShort, E2 receipt, E3 coverage, deferred, missing-skeptic, HIGH-not-reverified)
// plus the clean PASS paths — without spending a single agent.
//
// Mechanism: extract `isProven` + the `computeGate` body straight from forge.js (between the
// `// >>> COMPUTE-GATE` / `// <<< COMPUTE-GATE` sentinels) and eval them — single source of truth, no drift.
//   Run:  node /Users/sairambkrishnan/.claude-work/workflows/forge.gate.test.mjs
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

// ---- fixtures ----
const highClaim = { id: 1, text: 'deletes the prod users table || EVIDENCE: x.js:42 || QUOTE: foo', stakes: 'HIGH' }
const lowClaim  = { id: 1, text: 'this is an alternative approach || EVIDENCE: N/A || QUOTE: N/A', stakes: 'LOW' }
const proven    = { claimId: 1, verdict: 'PROVEN', evidenceItemsCount: 3, quoteMatches: true, citedFileChecked: true, positiveControlOk: true }
const goodAdv   = (block = 0, rep = 0) => ({ hasEvidence: true, evidenceItemsCount: 2, blockingFindings: block, repeatViolations: rep })
const fullAdv   = (over = {}) => ({ depth: goodAdv(), honesty: goodAdv(), repeat: goodAdv(), ...over })
const goodAudit = { auditedCount: 1, fabricatedCount: 0, evidenceItemsCount: 2 }
const goodCov   = { reviewedReceipts: 1, receiptMismatchCount: 0, highRelevanceUncovered: 0, evidenceItemsCount: 2 }
const base = { claimObjs: [highClaim], high: [highClaim], sv: [proven], toSkeptic: [highClaim],
               anyHigh: true, runAdversaries: true, runAudit: true, coverageOwed: true, deferred: 0, maxVerify: 8,
               adv: fullAdv(), audit: goodAudit, cov: goodCov }

const lowBase = { claimObjs: [lowClaim], high: [], sv: [{ ...proven }], toSkeptic: [lowClaim],
                  anyHigh: false, runAdversaries: false, runAudit: false, coverageOwed: false, deferred: 0, maxVerify: 8,
                  adv: null, audit: null, cov: null }

const cases = [
  ['clean HIGH path → PASS (not vacuously REVISE)', { ...base }, 'PASS'],
  ['LOW-only clean (skeptic proven, no adv/audit/cov) → PASS', { ...lowBase }, 'PASS'],
  ['adversary blocking finding → REVISE', { ...base, adv: fullAdv({ depth: goodAdv(2, 0) }) }, 'REVISE'],
  ['REPEAT adversary blocking counted → REVISE', { ...base, adv: fullAdv({ repeat: goodAdv(2, 0) }) }, 'REVISE'],
  ['REPEAT violation → REVISE', { ...base, adv: fullAdv({ repeat: goodAdv(0, 1) }) }, 'REVISE'],
  ['audit covered 0 of 1 checkable → REVISE', { ...base, audit: { auditedCount: 0, fabricatedCount: 0, evidenceItemsCount: 2 } }, 'REVISE'],
  ['audit owed but null → REVISE', { ...base, audit: null }, 'REVISE'],
  ['fewer than 3 evidenced adversaries → REVISE', { ...base, adv: fullAdv({ repeat: { hasEvidence: false, evidenceItemsCount: 0, blockingFindings: 0, repeatViolations: 0 } }) }, 'REVISE'],
  ['adversaries owed but adv null → REVISE', { ...base, adv: null }, 'REVISE'],
  ['skeptic PROVEN but positiveControlOk=false → REVISE', { ...base, sv: [{ ...proven, positiveControlOk: false }] }, 'REVISE'],
  ['skeptic PROVEN but quoteMatches=false → REVISE', { ...base, sv: [{ ...proven, quoteMatches: false }] }, 'REVISE'],
  ['skeptic PROVEN but evidenceItemsCount=0 → REVISE', { ...base, sv: [{ ...proven, evidenceItemsCount: 0 }] }, 'REVISE'],
  ['missing skeptic verdict (dispatched 1, got 0) → REVISE', { ...base, sv: [] }, 'REVISE'],
  ['HIGH claim has skeptic for WRONG id (not reverified) → REVISE', { ...base, sv: [{ ...proven, claimId: 2 }] }, 'REVISE'],
  ['deferred non-LOW claim → REVISE', { ...base, deferred: 1 }, 'REVISE'],
  ['fabricated citation → REVISE', { ...base, audit: { auditedCount: 1, fabricatedCount: 1, evidenceItemsCount: 2 } }, 'REVISE'],
  ['E2 receipt mismatch (fabricated file-read) → REVISE', { ...base, cov: { ...goodCov, receiptMismatchCount: 1, details: 'foo.js claimed 100 lines, actually 12' } }, 'REVISE'],
  ['E3 HIGH-relevance file never read → REVISE', { ...base, cov: { ...goodCov, highRelevanceUncovered: 1, details: 'never read /a/b/Dao.scala' } }, 'REVISE'],
  ['coverage owed but null → REVISE', { ...base, cov: null }, 'REVISE'],
]

let fail = 0
for (const [name, input, want] of cases) {
  let got
  try { got = computeGate(input).verdict } catch (e) { console.log(`ERROR ${name}: ${e.message}`); fail++; continue }
  if (got !== want) { console.log(`FAIL  ${name}: want=${want} got=${got}`); fail++ }
}
if (fail) { console.log(`\n${fail}/${cases.length} gate cases FAILED`); process.exit(1) }
console.log(`gate-predicate: ${cases.length}/${cases.length} PASS`)
