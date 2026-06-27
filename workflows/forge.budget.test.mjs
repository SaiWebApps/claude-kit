// forge.budget.test.mjs — P9: budgetOk() must (a) never block when there's no budget object, (b) gate on
// RESERVE when the user set a token target, and (c) enforce DEFAULT_TOKEN_CEILING via budget.spent() when NO
// target is set, and (d) fail OPEN on any glitch. budget is a REAL Workflow runtime global (not dead code).
// Extracts the BUDGET-GATE block + the two numeric constants from forge.js and evals — single source of truth.
//   Run:  node /Users/sairambkrishnan/.claude-work/workflows/forge.budget.test.mjs
import { readFileSync } from 'node:fs'
const src = readFileSync('/Users/sairambkrishnan/.claude-work/workflows/forge.js', 'utf8')
const slice = (from, to) => { const a = src.indexOf(from), b = src.indexOf(to, a + 1); if (a < 0 || b < 0) throw new Error(`marker not found: ${from}`); return src.slice(a, b) }
const num = (name) => { const m = src.match(new RegExp('const ' + name + '\\s*=\\s*(\\d[\\d_]*)')); if (!m) throw new Error('missing ' + name); return Number(m[1].replace(/_/g, '')) }
const RESERVE = num('RESERVE'), CEIL = num('DEFAULT_TOKEN_CEILING')
const gateSrc = slice('// >>> BUDGET-GATE', '// <<< BUDGET-GATE')
// build a callable budgetOk(budget) with RESERVE/DEFAULT_TOKEN_CEILING in scope
// eslint-disable-next-line no-new-func
const run = new Function('budget', 'RESERVE', 'DEFAULT_TOKEN_CEILING', gateSrc + '\nreturn budgetOk();')
const budgetOk = (b) => run(b, RESERVE, CEIL)

const cases = [
  ['no budget object → ok (never block)', undefined, true],
  ['no target + spent=0 → ok', { total: null, spent: () => 0 }, true],
  ['no target + spent just under ceiling → ok', { total: null, spent: () => CEIL - 1 }, true],
  ['no target + spent over ceiling → NOT ok', { total: null, spent: () => CEIL + 1 }, false],
  ['target set + remaining > RESERVE → ok', { total: 500000, remaining: () => RESERVE + 1, spent: () => 0 }, true],
  ['target set + remaining < RESERVE → NOT ok', { total: 500000, remaining: () => RESERVE - 1, spent: () => 0 }, false],
  ['spent() throws → ok (fail-open)', { total: null, spent: () => { throw new Error('x') } }, true],
  ['remaining() throws → ok (fail-open)', { total: 1, remaining: () => { throw new Error('x') } }, true],
]
let fail = 0
for (const [name, b, want] of cases) {
  let got; try { got = budgetOk(b) } catch (e) { console.log(`ERROR ${name}: ${e.message}`); fail++; continue }
  if (got !== want) { console.log(`FAIL  ${name}: want=${want} got=${got}`); fail++ }
}
if (CEIL <= RESERVE) { console.log(`FAIL  DEFAULT_TOKEN_CEILING(${CEIL}) should exceed RESERVE(${RESERVE})`); fail++ }
if (fail) { console.log(`\n${fail}/${cases.length + 1} budget cases FAILED`); process.exit(1) }
console.log(`budget-gate: ${cases.length + 1}/${cases.length + 1} PASS`)
