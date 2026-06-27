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
// P7/P16/P17: the adversary-trigger helper lives OUTSIDE the COMPUTE-GATE sentinels — grab + eval it too.
const sraMatch = src.match(/const shouldRunAdversaries = [^\n]*/)
if (!sraMatch) throw new Error('shouldRunAdversaries not found in forge.js (refactor moved it?)')
// eslint-disable-next-line no-new-func
const shouldRunAdversaries = new Function(sraMatch[0] + '\nreturn shouldRunAdversaries;')()

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
               adv: fullAdv(), audit: goodAudit, cov: goodCov, digestOk: true, isChangeTask: false, gitGroundingOk: true }

const lowBase = { claimObjs: [lowClaim], high: [], sv: [{ ...proven }], toSkeptic: [lowClaim],
                  anyHigh: false, runAdversaries: false, runAudit: false, coverageOwed: false, deferred: 0, maxVerify: 8,
                  adv: null, audit: null, cov: null, digestOk: true, isChangeTask: false, gitGroundingOk: true }

// P11/P20: two MEDIUM claims (no file:line) for the per-claim all-stakes id-coverage cases.
const m1 = { id: 1, text: 'the field is named foo', stakes: 'MEDIUM' }
const m2 = { id: 2, text: 'the flag defaults to true', stakes: 'MEDIUM' }
const medBase = { claimObjs: [m1, m2], high: [], toSkeptic: [m1, m2], anyHigh: false,
                  runAdversaries: false, runAudit: false, coverageOwed: false, deferred: 0, maxVerify: 8,
                  adv: null, audit: null, cov: null, digestOk: true, isChangeTask: false, gitGroundingOk: true,
                  sv: [{ ...proven, claimId: 1 }] }

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
  // --- P12: integrity fields must be AFFIRMATIVELY true (omitted no longer passes) ---
  ['skeptic PROVEN but quoteMatches OMITTED → REVISE', { ...base, sv: [{ claimId: 1, verdict: 'PROVEN', evidenceItemsCount: 1, citedFileChecked: true, positiveControlOk: true }] }, 'REVISE'],
  ['skeptic PROVEN but positiveControlOk OMITTED → REVISE', { ...base, sv: [{ claimId: 1, verdict: 'PROVEN', evidenceItemsCount: 1, quoteMatches: true, citedFileChecked: true }] }, 'REVISE'],
  ['file-citing claim but citedFileChecked=false → REVISE (claim-aware)', { ...base, sv: [{ ...proven, citedFileChecked: false }] }, 'REVISE'],
  ['no-citation LOW with citedFileChecked=false but quote/positive true → PASS', { ...lowBase, sv: [{ claimId: 1, verdict: 'PROVEN', evidenceItemsCount: 1, quoteMatches: true, positiveControlOk: true, citedFileChecked: false }] }, 'PASS'],
  // --- P11/P20: per-claim id-coverage for ALL stakes (not just HIGH) ---
  ['MED claim #2 left unverified (id mismatch) → REVISE', { ...medBase }, 'REVISE'],
  ['duplicate skeptic id over 2 MED claims → REVISE', { ...medBase, sv: [{ ...proven, claimId: 1 }, { ...proven, claimId: 1 }] }, 'REVISE'],
  ['both MED claims properly verified → PASS', { ...medBase, sv: [{ ...proven, claimId: 1 }, { ...proven, claimId: 2 }] }, 'PASS'],
  // --- P22: force-load digest must have loaded (cycle-0 constant) ---
  ['PRIME digest did not load (digestOk=false) → REVISE', { ...base, digestOk: false }, 'REVISE'],
  ['LOW-only but digest failed → REVISE (force-load is mandatory even at LOW)', { ...lowBase, digestOk: false }, 'REVISE'],
  // --- P1/S9: a change task must be git-grounded ---
  ['change task but breadth never ran git (gitGroundingOk=false) → REVISE', { ...base, isChangeTask: true, gitGroundingOk: false }, 'REVISE'],
  ['change task WITH git grounding → PASS', { ...base, isChangeTask: true, gitGroundingOk: true }, 'PASS'],
]

let fail = 0
for (const [name, input, want] of cases) {
  let got
  try { got = computeGate(input).verdict } catch (e) { console.log(`ERROR ${name}: ${e.message}`); fail++; continue }
  if (got !== want) { console.log(`FAIL  ${name}: want=${want} got=${got}`); fail++ }
}
if (fail) { console.log(`\n${fail}/${cases.length} gate cases FAILED`); process.exit(1) }

// --- P7/P16/P17: shouldRunAdversaries(risk, cycle, prevAdvRisk) ---
const sraCases = [
  [[3, 0, 0], true,  'cycle 0 at HIGH → attack'],
  [[3, 1, 3], false, 'flat HIGH on revise → no re-attack'],
  [[3, 1, 2], true,  'risk ROSE on revise → re-attack'],
  [[3, 2, 0], true,  'first HIGH at cycle 2 (cycle-0 was low) → attack'],
  [[2, 0, 0], false, 'MED at cycle 0 → no adversaries'],
  [[1, 0, 0], false, 'LOW → no adversaries'],
]
let sfail = 0
for (const [[r, c, p], want, desc] of sraCases) {
  const got = shouldRunAdversaries(r, c, p)
  if (got !== want) { console.log(`FAIL  shouldRunAdversaries(${r},${c},${p}) want=${want} got=${got} — ${desc}`); sfail++ }
}
if (sfail) { console.log(`\n${sfail}/${sraCases.length} adversary-trigger cases FAILED`); process.exit(1) }
console.log(`gate-predicate: ${cases.length}/${cases.length} PASS · adversary-trigger: ${sraCases.length}/${sraCases.length} PASS`)
