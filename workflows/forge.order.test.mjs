// forge.order.test.mjs — P2/P8/S8/S9: structural invariants of the breadth-FIRST restructure + the
// non-droppable cheap guards. Pure text scan of forge.js (zero agents).
//   Run:  node /Users/sairambkrishnan/.claude-work/workflows/forge.order.test.mjs
import { readFileSync } from 'node:fs'
const src = readFileSync('/Users/sairambkrishnan/.claude-work/workflows/forge.js', 'utf8')
let fail = 0
const ok = (cond, msg) => { if (!cond) { console.log('FAIL  ' + msg); fail++ } }

const iPrime = src.indexOf("phase('Prime')")
const iGen   = src.indexOf("phase('Generate')")
const iBreadth = src.indexOf("label: 'breadth'")
const iGenCall = src.indexOf('label: `gen:${role}`')

ok(!src.includes("phase('Scope')"), 'the standalone SCOPE phase must be GONE (folded into breadth-first PRIME)')
ok(iPrime > 0 && iGen > iPrime, "phase('Prime') must exist and precede phase('Generate')")
ok(iBreadth > iPrime && iBreadth < iGen, 'the BREADTH agent must be dispatched in PRIME (before GENERATE) so its file list DIRECTS the panel')
ok(iGenCall > iBreadth, 'panel generators must be dispatched AFTER breadth (breadth-first)')
ok(/WORK LEDGER/.test(src) && /\$\{ledger\}/.test(src), 'genPrompt must inject the breadth-derived ${ledger}')
ok(/PRIOR-LEARNINGS DIGEST/.test(src) && /\$\{digestText\}/.test(src), 'the force-loaded digestText must be injected into agents')
// P3: cheap guards (audit + coverage) must NOT be budget-gated
ok(/const runAudit\s*=\s*risk >= 2\b(?![^\n]*budgetOk)/.test(src), 'runAudit must NOT be gated by budgetOk (P3 — cheap guard non-droppable)')
ok(/const coverageOwed = [^\n]*$/m.test(src) && !/const coverageOwed = [^\n]*budgetOk/.test(src), 'coverageOwed must NOT be gated by budgetOk (P3)')
// expensive paths (revise loop) KEEP budgetOk
ok(/while \([^\n]*budgetOk\(\)/.test(src), 'the revise loop (expensive) MUST keep budgetOk()')
ok(/git diff --name-only/.test(src) && /git status --porcelain/.test(src), 'S9: breadth must mandate git status/diff for a change task')

if (fail) { console.log(`\n${fail} order/structure invariant(s) FAILED`); process.exit(1) }
console.log('order/structure: breadth-first, SCOPE removed, ledger+digest injected, cheap guards non-droppable, git grounding present — PASS')
