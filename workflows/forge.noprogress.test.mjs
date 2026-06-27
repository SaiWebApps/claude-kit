// forge.noprogress.test.mjs — P21: trivialDelta() must detect a "no real progress" revise (identical after
// normalization, or a tiny tweak that dodges the must-fix item) so the loop stops instead of burning a full
// verify wave on a 1-char/1-word change. Extracts the NOPROGRESS block from forge.js and evals it.
//   Run:  node /Users/sairambkrishnan/.claude-work/workflows/forge.noprogress.test.mjs
import { readFileSync } from 'node:fs'
const src = readFileSync('/Users/sairambkrishnan/.claude-work/workflows/forge.js', 'utf8')
const a = src.indexOf('// >>> NOPROGRESS'), b = src.indexOf('// <<< NOPROGRESS', a + 1)
if (a < 0 || b < 0) throw new Error('NOPROGRESS markers not found (refactor moved them?)')
// eslint-disable-next-line no-new-func
const trivialDelta = new Function(src.slice(a, b) + '\nreturn trivialDelta;')()

const big = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ')          // 60-word draft
const bigPlusSpace = big + '   \n'                                              // trailing whitespace only
const oneWordSwap = big.replace('word3', 'wordX')                               // 1 of 60 tokens changed
const bigRewrite = Array.from({ length: 60 }, (_, i) => (i < 20 ? `NEW${i}` : `word${i}`)).join(' ') // ~20 changed

const cases = [
  ['identical → trivial(true)', ['hello world', 'hello world'], true],
  ['empty/empty → trivial(true)', ['', ''], true],
  ['trailing whitespace only on long draft → trivial(true)', [big, bigPlusSpace], true],
  ['case-only change → trivial(true)', ['Hello World', 'hello world'], true],
  ['one-word swap on 60-word draft → trivial(true)', [big, oneWordSwap], true],
  ['~33% rewrite → NOT trivial(false)', [big, bigRewrite], false],
  ['completely different → NOT trivial(false)', ['the cat sat on the mat', 'quantum entanglement of photons'], false],
]
let fail = 0
for (const [name, [x, y], want] of cases) {
  let got; try { got = trivialDelta(x, y) } catch (e) { console.log(`ERROR ${name}: ${e.message}`); fail++; continue }
  if (got !== want) { console.log(`FAIL  ${name}: want=${want} got=${got}`); fail++ }
}
if (fail) { console.log(`\n${fail}/${cases.length} no-progress cases FAILED`); process.exit(1) }
console.log(`no-progress: ${cases.length}/${cases.length} PASS`)
