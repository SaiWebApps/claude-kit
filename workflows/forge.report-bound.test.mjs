// forge.report-bound.test.mjs — P31/P32/S16: boundReport() must keep the human report under the cap by
// truncating ONLY the draft body (head-preserving + declared), and leave short drafts untouched.
//   Run:  node /Users/sairambkrishnan/.claude-work/workflows/forge.report-bound.test.mjs
import { readFileSync } from 'node:fs'
const src = readFileSync('/Users/sairambkrishnan/.claude-work/workflows/forge.js', 'utf8')
const a = src.indexOf('// >>> REPORT-BOUND'), b = src.indexOf('// <<< REPORT-BOUND', a + 1)
if (a < 0 || b < 0) throw new Error('REPORT-BOUND markers not found')
// eslint-disable-next-line no-new-func
const boundReport = new Function(src.slice(a, b) + '\nreturn boundReport;')()
const MAX = Number((src.match(/const MAX_REPORT_CHARS\s*=\s*(\d[\d_]*)/) || [])[1].replace(/_/g, ''))
let fail = 0
const ok = (cond, msg) => { if (!cond) { console.log('FAIL  ' + msg); fail++ } }
ok(Number.isFinite(MAX) && MAX > 1000, `MAX_REPORT_CHARS must be a sane number — got ${MAX}`)
const huge = 'x'.repeat(200_000)
const r1 = boundReport(huge, MAX)
ok(r1.truncated === true, '200k draft → truncated')
ok(r1.body.length <= MAX + 200, `truncated body must be ~<= MAX (got ${r1.body.length}, MAX ${MAX})`)
ok(/TRUNCATED/.test(r1.body) && /structured `draft` field/.test(r1.body), 'truncation must be DECLARED + point to the full draft')
ok(r1.body.startsWith('xxxx'), 'head-preserving (keeps the start of the answer)')
const small = 'a short answer'
const r2 = boundReport(small, MAX)
ok(r2.truncated === false && r2.body === small, 'short draft unchanged')
ok(boundReport(null, MAX).body === '' && boundReport(undefined, MAX).truncated === false, 'null/undefined → empty, never throws')
if (fail) { console.log(`\n${fail} report-bound cases FAILED`); process.exit(1) }
console.log('report-bound: head-preserving truncation, declared, short-passthrough, null-safe — PASS')
