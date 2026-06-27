// forge.receipts.test.mjs — P29/S12: receiptsOf() must return ONLY the "FILES I READ IN FULL" receipt tails
// from concatenated generator output (so the coverage auditor gets the receipts, not full prose). Pure.
//   Run:  node /Users/sairambkrishnan/.claude-work/workflows/forge.receipts.test.mjs
import { readFileSync } from 'node:fs'
const src = readFileSync('/Users/sairambkrishnan/.claude-work/workflows/forge.js', 'utf8')
const a = src.indexOf('// >>> RECEIPTS'), b = src.indexOf('// <<< RECEIPTS', a + 1)
if (a < 0 || b < 0) throw new Error('RECEIPTS markers not found')
// eslint-disable-next-line no-new-func
const receiptsOf = new Function(src.slice(a, b) + '\nreturn receiptsOf;')()
let fail = 0
const ok = (cond, msg) => { if (!cond) { console.log('FAIL  ' + msg); fail++ } }
const gens = `### architect
Some long prose about the design that should NOT be forwarded.
FILES I READ IN FULL: [/a/b.js — 10 lines, /c/d.scala — 99 lines]
EVIDENCE I GATHERED: [b.js, d.scala]

### reviewer
More prose to strip.
FILES I READ IN FULL: [/e/f.ts — 3 lines]`
const out = receiptsOf(gens)
ok(out.includes('/a/b.js — 10 lines') && out.includes('/e/f.ts — 3 lines'), 'must keep BOTH receipt tails')
ok(!out.includes('long prose') && !out.includes('More prose'), 'must DROP the generator prose')
ok(!/EVIDENCE I GATHERED/.test(out), 'must keep only the FILES-I-READ line, not the evidence line')
ok((out.match(/FILES I READ IN FULL:/g) || []).length === 2, 'exactly the two receipt lines')
ok(receiptsOf('') === '' && receiptsOf(null) === '', 'empty/null → empty string (no throw)')
ok(receiptsOf('no receipts here at all') === '', 'no receipt → empty')
// idempotent
ok(receiptsOf(out) === out, 'idempotent on its own output')
if (fail) { console.log(`\n${fail} receipts cases FAILED`); process.exit(1) }
console.log('receipts: tails-only, prose-stripped, idempotent — PASS')
