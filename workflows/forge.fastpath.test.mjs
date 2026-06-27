// forge.fastpath.test.mjs — P5/S10: the LOW-risk fast path must (a) carry the full guard set in its predicate,
// (b) be disqualified by a change task / breadth / a draft / ABSENCE / HIGH stakes, and (c) still skip the
// separate SYNTHESIZE phase (the fast agent already emits draft+claims) while the DIGEST still loads.
//   Run:  node /Users/sairambkrishnan/.claude-work/workflows/forge.fastpath.test.mjs
import { readFileSync } from 'node:fs'
const src = readFileSync('/Users/sairambkrishnan/.claude-work/workflows/forge.js', 'utf8')
let fail = 0
const ok = (cond, msg) => { if (!cond) { console.log('FAIL  ' + msg); fail++ } }
const fp = (src.match(/const FAST_PATH_OK =[\s\S]*?\n\n/) || [''])[0]
ok(/!isChangeTask/.test(fp), 'FAST_PATH_OK must be disqualified by a change task')
ok(/!runBreadth/.test(fp), 'FAST_PATH_OK must be disqualified when breadth runs (code/files in play)')
ok(/!draft0/.test(fp), 'FAST_PATH_OK must be disqualified when verifying an existing draft')
ok(/classify\(task[^)]*\)\s*===\s*'LOW'/.test(fp), "FAST_PATH_OK must require classify(task)==='LOW'")
ok(/!ABSENCE_RE\.test\(task/.test(fp), 'FAST_PATH_OK must be disqualified by an ABSENCE claim')
ok(/\.length\s*<\s*\d+/.test(fp), 'FAST_PATH_OK must require a short task')
// the fast path branches around the panel + skips the separate synth phase, but the digest already loaded in PRIME
ok(/if \(FAST_PATH_OK\) \{/.test(src), 'there must be a fast-path branch')
ok(/if \(!FAST_PATH_OK\) \{\s*\n\s*phase\('Synthesize'\)/.test(src), "SYNTHESIZE must be SKIPPED on the fast path (guarded by !FAST_PATH_OK)")
ok(src.indexOf("phase('Prime')") < src.indexOf('const FAST_PATH_OK'), 'PRIME (force-load digest) runs BEFORE the fast-path decision — force-load is universal')
if (fail) { console.log(`\n${fail} fast-path invariant(s) FAILED`); process.exit(1) }
console.log('fast-path: full guard set, synth skipped, digest still force-loaded — PASS')
