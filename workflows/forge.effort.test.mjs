// forge.effort.test.mjs — P4/P8A/S18: the EFFORT table must be tiered and binary {low,high} (no xhigh/max —
// the slowness root cause), with the right per-stage assignments, AND actually threaded onto agent() calls.
//   Run:  node /Users/sairambkrishnan/.claude-work/workflows/forge.effort.test.mjs
import { readFileSync } from 'node:fs'
const src = readFileSync('/Users/sairambkrishnan/.claude-work/workflows/forge.js', 'utf8')
const a = src.indexOf('// >>> EFFORT-TABLE'), b = src.indexOf('// <<< EFFORT-TABLE', a + 1)
if (a < 0 || b < 0) throw new Error('EFFORT-TABLE markers not found')
const lit = src.slice(src.indexOf('{', a), src.indexOf('}', a) + 1).replace(/\/\/[^\n]*/g, '')
// eslint-disable-next-line no-eval
const EFFORT = (0, eval)('(' + lit + ')')
let fail = 0
const ok = (cond, msg) => { if (!cond) { console.log('FAIL  ' + msg); fail++ } }
const ALLOWED = ['low', 'high']
for (const [k, v] of Object.entries(EFFORT)) ok(ALLOWED.includes(v), `EFFORT.${k}='${v}' must be low|high (no xhigh/max — the slowness root cause)`)
for (const s of ['prime', 'generate', 'synth', 'revise', 'skeptic', 'audit', 'coverage', 'adversary']) ok(s in EFFORT, `EFFORT.${s} missing`)
// scan stages cheap; reasoning/adversary stages high
for (const s of ['prime', 'skeptic', 'audit', 'coverage']) ok(EFFORT[s] === 'low', `EFFORT.${s} should be 'low' (cheap/mechanical) — got '${EFFORT[s]}'`)
for (const s of ['generate', 'synth', 'revise', 'adversary']) ok(EFFORT[s] === 'high', `EFFORT.${s} should be 'high' (reasoning/adversarial) — got '${EFFORT[s]}'`)
// EFFORT must actually be USED on agent() calls (not declared-but-ignored)
const used = (src.match(/effort:\s*EFFORT\./g) || []).length
ok(used >= 9, `EFFORT must be threaded onto agent() calls; found ${used} usages (expected >= 9)`)
// every DEFINED stage constant must be wired to at least one agent() call (catches defined-but-unused, e.g. EFFORT.revise)
for (const k of Object.keys(EFFORT)) ok(new RegExp('effort:\\s*EFFORT\\.' + k + '\\b').test(src), `EFFORT.${k} is DEFINED but never wired to an agent() call (defined-but-unused — the EFFORT.revise bug)`)
if (fail) { console.log(`\n${fail} effort invariant(s) FAILED`); process.exit(1) }
console.log('effort-table: binary low|high (no xhigh), per-stage assignments correct, threaded onto agent() calls — PASS')
