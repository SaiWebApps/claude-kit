// forge.terminal.test.mjs — the six honest terminal states (make-no-mistakes style): a pure classifier over
// the gate verdict + loop context that names WHY a run ended (DONE / GAMING-DETECTED / INTEGRITY-COMPROMISED /
// STUCK-OSCILLATING / STUCK-BUDGET / STUCK-INCONCLUSIVE). Extracts terminalState from forge.js via the
// >>> TERMINAL-STATE <<< sentinels (single source of truth). Additive — computeGate's PASS/REVISE is unchanged.
//   Run:  node /Users/sairambkrishnan/.claude-work/workflows/forge.terminal.test.mjs
import { readFileSync } from 'node:fs'
const src = readFileSync('/Users/sairambkrishnan/.claude-work/workflows/forge.js', 'utf8')
const a = src.indexOf('// >>> TERMINAL-STATE'), b = src.indexOf('// <<< TERMINAL-STATE', a + 1)
if (a < 0 || b < 0) throw new Error('TERMINAL-STATE markers not found in forge.js (refactor moved them?)')
// eslint-disable-next-line no-new-func
const terminalState = new Function(src.slice(a, b) + '\nreturn terminalState;')()

const cases = [
  ['clean pass → DONE', { gateVerdict: 'PASS', reasons: [] }, 'DONE'],
  ['PASS is authoritative even if a stale reason is present → DONE', { gateVerdict: 'PASS', reasons: ['[MUTATION] STILL PASSES'] }, 'DONE'],
  ['fake mutation test (STILL PASSES) → GAMING-DETECTED', { gateVerdict: 'REVISE', reasons: ['[MUTATION] the guarding test STILL PASSES with the fix reverted'] }, 'GAMING-DETECTED'],
  ['fabricated citation → GAMING-DETECTED', { gateVerdict: 'REVISE', reasons: ['[AUDIT] 1 fabricated citation(s)'] }, 'GAMING-DETECTED'],
  ['digest not loaded → INTEGRITY-COMPROMISED', { gateVerdict: 'REVISE', reasons: ['[PRIME] prior-learnings digest did not load'] }, 'INTEGRITY-COMPROMISED'],
  ['no progress → STUCK-OSCILLATING', { gateVerdict: 'REVISE', reasons: ['[GATE] x'], noProgress: true }, 'STUCK-OSCILLATING'],
  ['budget exhausted → STUCK-BUDGET', { gateVerdict: 'REVISE', reasons: ['[GATE] x'], budgetExhausted: true }, 'STUCK-BUDGET'],
  ['cycles hit the cap → STUCK-BUDGET', { gateVerdict: 'REVISE', reasons: ['[GATE] x'], cyclesUsed: 2, maxCycles: 2 }, 'STUCK-BUDGET'],
  ['plain revise, no special signal → STUCK-INCONCLUSIVE', { gateVerdict: 'REVISE', reasons: ['[GATE] not every HIGH claim re-verified'] }, 'STUCK-INCONCLUSIVE'],
  ['precedence: active faking dominates a missing digest → GAMING-DETECTED', { gateVerdict: 'REVISE', reasons: ['[PRIME] digest did not load', '[MUTATION] test STILL PASSES'] }, 'GAMING-DETECTED'],
]

let fail = 0
for (const [name, input, want] of cases) {
  let got
  try { got = terminalState(input) } catch (e) { console.log(`ERROR ${name}: ${e.message}`); fail++; continue }
  if (got !== want) { console.log(`FAIL  ${name}: want=${want} got=${got}`); fail++ }
}
if (fail) { console.log(`\n${fail}/${cases.length} terminal-state cases FAILED`); process.exit(1) }
console.log(`terminal-state: ${cases.length}/${cases.length} PASS`)
