// forge.memory.test.mjs — P24/S15: every panel-selectable role must have a non-empty agent-memory MEMORY.md
// so the PRIME digest can actually load it (no silent ABSENT for a selectable role). Pure fs check.
//   Run:  node /Users/sairambkrishnan/.claude-work/workflows/forge.memory.test.mjs
import { readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
const src = readFileSync('/Users/sairambkrishnan/.claude-work/workflows/forge.js', 'utf8')
// the roles forge can route to (KNOWN_ROLES literal in forge.js)
const m = src.match(/const KNOWN_ROLES = \[([^\]]*)\]/)
if (!m) throw new Error('KNOWN_ROLES not found in forge.js')
const roles = m[1].split(',').map((s) => s.trim().replace(/['"]/g, '')).filter(Boolean)
const base = homedir() + '/.claude-work/agent-memory'
let fail = 0
for (const r of roles) {
  const p = `${base}/${r}/MEMORY.md`
  try {
    const sz = statSync(p).size
    if (sz < 40) { console.log(`FAIL  ${r}: MEMORY.md too small (${sz}B) — a selectable role needs real content`); fail++ }
  } catch { console.log(`FAIL  ${r}: MEMORY.md MISSING (${p}) — the digest would silently get ABSENT`); fail++ }
}
if (fail) { console.log(`\n${fail}/${roles.length} role memories MISSING/empty`); process.exit(1) }
console.log(`role-memory: all ${roles.length} panel-selectable roles have a non-empty MEMORY.md — PASS`)
