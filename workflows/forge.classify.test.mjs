// Regression test for forge.js's JS stakes classifier — the load-bearing gate that decides which
// verification tier a claim gets. Reads the THREE regex literals straight out of forge.js (no
// duplication / drift) and asserts classify() on a battery, including the destructive verbs the
// adversary trio proved were missing (prod\b≠production, deploy\b≠deploys, remove/replace/reset/…).
//
// Run:  node /Users/sairambkrishnan/.claude-work/workflows/forge.classify.test.mjs
// Pure JS, zero agents, ~instant. Exit 0 = all pass; exit 1 = a regression.
import { readFileSync } from 'node:fs'

const src = readFileSync('/Users/sairambkrishnan/.claude-work/workflows/forge.js', 'utf8')
const grab = (name) => {
  const m = src.match(new RegExp('const ' + name + '\\s*=\\s*(/.*/[a-z]*)'))
  if (!m) throw new Error(`could not extract ${name} from forge.js`)
  // eslint-disable-next-line no-eval
  return (0, eval)(m[1])
}
const HIGH_RE = grab('HIGH_RE')
const ABSENCE_RE = grab('ABSENCE_RE')
const MEDIUM_RE = grab('MEDIUM_RE')
const HIGH_FALSE_POS_RE = grab('HIGH_FALSE_POS_RE')   // P15
const STRONG_HIGH_RE = grab('STRONG_HIGH_RE')         // P15
// MIRRORS forge.js classify() EXACTLY, including the P15 false-positive-demotion branch.
const classify = (t) =>
  ((HIGH_RE.test(t) || ABSENCE_RE.test(t)) && !(HIGH_FALSE_POS_RE.test(t) && !STRONG_HIGH_RE.test(t))) ? 'HIGH'
  : MEDIUM_RE.test(t) ? 'MEDIUM' : 'LOW'

const cases = [
  // --- destructive wordings that MUST be HIGH (the adversary's false-PASS battery) ---
  ['removes the production data', 'HIGH'],
  ['deletes the table', 'HIGH'],
  ['force pushing to main', 'HIGH'],
  ['git reset --hard origin/main', 'HIGH'],
  ['calls replace_section_content on the doc', 'HIGH'],
  ['publish the draft', 'HIGH'],
  ['revert the commit', 'HIGH'],
  ['rename the field', 'HIGH'],
  ['disable the hook', 'HIGH'],
  ['drop table users', 'HIGH'],
  ['rm -rf the dir', 'HIGH'],
  ['truncate the keyspace', 'HIGH'],
  ['POST to the endpoint', 'HIGH'],
  ['migrate the schema', 'HIGH'],
  ['merge into main', 'HIGH'],
  ['rotate the credential', 'HIGH'],
  ['it deploys to prod', 'HIGH'],
  ['wipe the cache', 'HIGH'],
  ['edit settings.json', 'HIGH'],
  // --- verbs added after the rev-2 adversary (write/grant/modify/execute/flush/append/rotate/kill + CLAUDE.md-named) ---
  ['writes to the database', 'HIGH'],
  ['grant access to the user', 'HIGH'],
  ['modifies the config', 'HIGH'],
  ['execute the migration', 'HIGH'],
  ['flush the table', 'HIGH'],
  ['append to the production log', 'HIGH'],
  ['rotate the api key', 'HIGH'],
  ['kill the running job', 'HIGH'],
  ['creates a public repo', 'HIGH'],
  ['calls edit_page on the doc', 'HIGH'],
  // --- absence claims MUST be HIGH ---
  ['the row was not found', 'HIGH'],
  ['query returned 0 rows', 'HIGH'],
  ['the keyspace does not exist', 'HIGH'],
  // --- factual/value claims MUST be at least MEDIUM ---
  ['the default verdict is UNPROVEN', 'MEDIUM'],
  ['the field is named is_suppressed', 'MEDIUM'],
  ['verified the behavior in a test', 'MEDIUM'],
  ['it returns the model raw text', 'MEDIUM'],
  ['stated on line 20', 'MEDIUM'],
  // --- benign prose MUST be LOW (no over-matching on substrings) ---
  ['this is an alternative approach', 'LOW'],
  ['the answer is accurate and clear', 'LOW'],
  ['immigration policy is unrelated', 'LOW'],
  ['the preset theme looks nice', 'LOW'],
  ['a clean, readable structure', 'LOW'],
  // --- P15: FALSE-POSITIVE HIGH must demote (benign collocation, no strong destructive token) ---
  ['the writeup is clear', 'LOW'],
  ['reset expectations with the user', 'LOW'],
  ['a dropout layer', 'LOW'],
  ['the writer of the test', 'LOW'],
  ['merge conflict was about wording', 'LOW'],
  ['kill the meeting; reschedule', 'LOW'],
  ['append-only logs', 'LOW'],
  // --- P15: regression — a STRONG destructive token VETOES demotion even with a benign collocation present ---
  ['rm -rf the writeup dir', 'HIGH'],
  ['git reset --hard then write the report', 'HIGH'],
  ['the commitment to push the change', 'HIGH'],
  // --- P14: numeric / status / boolean VALUE assertions → at least MEDIUM (fabrication-prone) ---
  ['the config value is 5', 'MEDIUM'],
  ['responds with status 200', 'MEDIUM'],
  ['threshold equals 0.5', 'MEDIUM'],
  ['the count is 0', 'MEDIUM'],
  ['latency improves by 20 percent', 'MEDIUM'],
  ['exit code 1', 'MEDIUM'],
  // --- P14: presence-negation phrasings → HIGH (absence discipline) ---
  ['this data was not present in the table', 'HIGH'],
  ['recordCount is zero in that partition', 'HIGH'],
  // --- P14: LOW guardrails — the widening must NOT bleed onto benign prose ---
  ['this is not a problem', 'LOW'],
  ['there is no objection', 'LOW'],
  ['the value is clarity', 'LOW'],
  ['success equals effort', 'LOW'],
]

let fail = 0
for (const [text, want] of cases) {
  const got = classify(text)
  // a HIGH-expected case is also satisfied by HIGH; a MEDIUM-expected case must NOT be LOW.
  const ok = want === 'HIGH' ? got === 'HIGH'
    : want === 'MEDIUM' ? got !== 'LOW'
    : got === 'LOW'
  if (!ok) { console.log(`FAIL  want=${want} got=${got}  "${text}"`); fail++ }
}

// A3: CHANGE_RE must detect change-verification INTENT without over-firing on benign "I changed my mind" prose.
const CHANGE_RE = grab('CHANGE_RE')
const changeCases = [
  ['verify my change', true], ['review this diff', true], ['check the PR', true], ['git diff HEAD', true], ['before I commit', true],
  ['I changed my mind', false], ['I wrote a poem', false], ['I added milk to the list', false],
  ['what is the capital of France', false], ['a staged rollout to prod', false],
]
for (const [text, want] of changeCases) {
  const got = CHANGE_RE.test(text)
  if (got !== want) { console.log(`FAIL  CHANGE_RE("${text}") want=${want} got=${got}`); fail++ }
}

if (fail) { console.log(`\n${fail} case(s) FAILED`); process.exit(1) }
console.log(`classify regression: ${cases.length}/${cases.length} PASS · CHANGE_RE: ${changeCases.length}/${changeCases.length} PASS`)
