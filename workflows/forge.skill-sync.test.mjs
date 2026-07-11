// forge.skill-sync.test.mjs — P26/P27B/P30/P33/S19: guard the load-bearing code↔doc invariants between
// forge.js and skills/forge/SKILL.md. Scoped to claims that MUST stay true (not arbitrary prose).
//   Run:  node /Users/sairambkrishnan/.claude-work/workflows/forge.skill-sync.test.mjs
import { readFileSync } from 'node:fs'
const code = readFileSync('/Users/sairambkrishnan/.claude-work/workflows/forge.js', 'utf8')
const skillPath = '/Users/sairambkrishnan/.claude-work/skills/forge/SKILL.md'
const skill = readFileSync(skillPath, 'utf8')
let fail = 0
const ok = (cond, msg) => { if (!cond) { console.log('FAIL  ' + msg); fail++ } }

// 1. the assurance TAIL the code emits must appear verbatim in the doc (the non-interpolated part)
const TAIL = 'adversaries + byte-quote audit + read-receipt/coverage'
ok(code.includes(TAIL), `forge.js must emit the assurance tail "${TAIL}"`)
ok(skill.includes(TAIL), `SKILL.md must document the exact assurance tail "${TAIL}" (code↔doc sync)`)
// 2. the per-cycle verify cap number must match between code and doc
const MAX_VERIFY = (code.match(/const MAX_VERIFY\s*=\s*(\d+)/) || [])[1]
ok(MAX_VERIFY && new RegExp('cap of \\*?\\*?' + MAX_VERIFY + '\\b').test(skill) || skill.includes(`cap of **${MAX_VERIFY}**`) || skill.includes(`cap of ${MAX_VERIFY}`), `SKILL.md must state the per-cycle cap of ${MAX_VERIFY}`)
// 3. load-bearing capabilities the doc must mention (drift catches if a fix is reverted but doc kept)
for (const s of ['PRIME', 'force-load', 'watchdog', 'TaskStop', 'background', 'budget.spent()', 'breadth-FIRST', 'NO new always-on hooks', 'wrong-approach', 'mutation']) {
  ok(skill.includes(s), `SKILL.md must mention "${s}"`)
}
// 4. banned stale over-claims must be ABSENT (P26)
ok(!skill.includes('every checkable claim citation'), `SKILL.md must NOT over-claim "every checkable claim citation" (audit gates only HIGH)`)
ok(!/^\s*1\.\s*\*\*SCOPE\*\*/m.test(skill), `SKILL.md must NOT still list SCOPE as phase 1 (it was removed)`)
// 5. forge.js itself must not have reintroduced a SCOPE phase
ok(!code.includes("phase('Scope')"), `forge.js must not reintroduce phase('Scope')`)

if (fail) { console.log(`\n${fail} skill-sync invariant(s) FAILED`); process.exit(1) }
console.log('skill-sync: assurance tail synced, cap number synced, capabilities documented, stale over-claims absent — PASS')
