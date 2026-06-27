// forge.wave.test.mjs — P6/S11: planWave() must report the exact concurrent verify-wave width so it can be
// logged + reasoned about (no hidden inner Promise.all). Extracts the WAVE-PLAN block and evals it.
//   Run:  node /Users/sairambkrishnan/.claude-work/workflows/forge.wave.test.mjs
import { readFileSync } from 'node:fs'
const src = readFileSync('/Users/sairambkrishnan/.claude-work/workflows/forge.js', 'utf8')
const a = src.indexOf('// >>> WAVE-PLAN'), b = src.indexOf('// <<< WAVE-PLAN', a + 1)
if (a < 0 || b < 0) throw new Error('WAVE-PLAN markers not found')
// eslint-disable-next-line no-new-func
const planWave = new Function(src.slice(a, b) + '\nreturn planWave;')()
let fail = 0
const ok = (cond, msg) => { if (!cond) { console.log('FAIL  ' + msg); fail++ } }
ok(planWave({ skeptics: 8, runAdversaries: true, runAudit: true, coverageOwed: true }) === 13, 'full RISK-3 wave = 8 + 3 + 1 + 1 = 13')
ok(planWave({ skeptics: 5, runAdversaries: false, runAudit: true, coverageOwed: true }) === 7, 'MED wave = 5 + 1 + 1 = 7')
ok(planWave({ skeptics: 1, runAdversaries: false, runAudit: false, coverageOwed: false }) === 1, 'LOW fast wave = 1')
ok(planWave({ skeptics: 0, runAdversaries: false, runAudit: false, coverageOwed: false }) === 0, 'empty wave = 0')
// the structural cap: the worst case stays within the absolute concurrency ceiling
const MAX_VERIFY = Number((src.match(/const MAX_VERIFY\s*=\s*(\d+)/) || [])[1])
ok(planWave({ skeptics: MAX_VERIFY, runAdversaries: true, runAudit: true, coverageOwed: true }) <= 16, `worst-case wave (MAX_VERIFY ${MAX_VERIFY} + 5) must stay <= 16 (hard concurrency cap)`)
// each skeptic is its OWN thunk (not a hidden inner Promise.all that the cap can't see)
ok(/for \(const c of toSkeptic\) \{ skepticIdx\.push/.test(src), 'skeptics must be pushed as individual thunks (cap-visible), not one Promise.all')
ok(!/Promise\.all\(toSkeptic/.test(src), 'the old inner Promise.all(toSkeptic...) wave must be gone')
if (fail) { console.log(`\n${fail} wave cases FAILED`); process.exit(1) }
console.log('wave-plan: width formula + cap bound + individual-thunk skeptics — PASS')
