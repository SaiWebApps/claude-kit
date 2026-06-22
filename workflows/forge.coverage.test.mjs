// forge.coverage.test.mjs — guards the "collect-but-don't-gate" defect class that produced most of
// /forge's first-round false-PASS holes: a field declared in a verifier *_SCHEMA whose value is NEVER
// READ by the verdict logic (isProven + the GATE block of verifyAndGate). A field you collect but never
// read on cannot influence PASS/REVISE — it is dead weight that silently lets a bad verifier value through.
//
// Detection: the gate READS verifier outputs via property access (`v.quoteMatches`, `audit.auditedCount`,
// `a.blockingFindings`, …). So a field "counts as gated" iff `.<field>` appears in the LOGIC region
// (isProven + the GATE block). We deliberately EXCLUDE the schema declarations (`field: {`) and the prompt
// text (prose `field`), where every name trivially appears — scanning those gave a vacuous always-pass.
// Pure text scan of forge.js — zero agents, instant.
//   Run:  node /Users/sairambkrishnan/.claude-work/workflows/forge.coverage.test.mjs
import { readFileSync } from 'node:fs'
const SRC = '/Users/sairambkrishnan/.claude-work/workflows/forge.js'
const src = readFileSync(SRC, 'utf8')

const SCHEMAS = ['SKEPTIC_SCHEMA', 'ADV_SCHEMA', 'AUDIT_SCHEMA', 'COVERAGE_SCHEMA']  // verifier schemas; SYNTH/BREADTH are generation, not a gate input

function propsOf(name) {
  const start = src.indexOf('const ' + name)
  if (start < 0) throw new Error('schema not found: ' + name)
  const propIdx = src.indexOf('properties:', start)
  let i = src.indexOf('{', propIdx), depth = 0, end = i
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break } }
  }
  return [...src.slice(propIdx, end + 1).matchAll(/(\w+)\s*:\s*\{/g)].map((m) => m[1]).filter((f) => f !== 'properties')
}

function slice(fromMarker, toMarker, label) {
  const a = src.indexOf(fromMarker)
  const b = src.indexOf(toMarker, a + 1)
  if (a < 0 || b < 0) throw new Error(`could not locate ${label} markers (refactor moved them?)`)
  return src.slice(a, b)
}

// LOGIC = the isProven predicate + the computeGate() body (reads + reasons + mustFix + metrics).
// Both are pure decision code; neither contains schema declarations or prompt prose.
const isProvenSrc = slice('const isProven', '\n\n', 'isProven')
const gateSrc     = slice('// >>> COMPUTE-GATE', '// <<< COMPUTE-GATE', 'computeGate block')
const logic = isProvenSrc + '\n' + gateSrc

let fail = 0
for (const schema of SCHEMAS) {
  for (const field of propsOf(schema)) {
    // "read" = property access `.field` somewhere in the logic (v.field / a.field / audit.field / …)
    if (!new RegExp('\\.' + field + '\\b').test(logic)) {
      console.log(`FAIL  ${schema}.${field} is COLLECTED but never READ (no \`.${field}\`) by the gate logic — collect-but-don't-gate hole`)
      fail++
    }
  }
}
if (fail) { console.log(`\n${fail} ungated verifier field(s) — read it in isProven/the GATE block, or drop it from the schema`); process.exit(1) }
console.log('gate-coverage: every verifier schema field is READ by the gate logic — PASS')
