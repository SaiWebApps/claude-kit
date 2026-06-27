// forge.panel.test.mjs — P28/S13: pickPanel() must honor an explicit args.panel (validated against the
// allow-list, deduped, cap 3), fall back to the regex panel otherwise, and NEVER return empty.
//   Run:  node /Users/sairambkrishnan/.claude-work/workflows/forge.panel.test.mjs
import { readFileSync } from 'node:fs'
const src = readFileSync('/Users/sairambkrishnan/.claude-work/workflows/forge.js', 'utf8')
const grabConst = (name) => { const i = src.indexOf('const ' + name); if (i < 0) throw new Error('missing ' + name); return i }
// pickPanel closes over KNOWN_ROLES — eval both together.
const kr = grabConst('KNOWN_ROLES'), pp = grabConst('pickPanel')
const krSrc = src.slice(kr, src.indexOf('\n', kr))
const ppSrc = src.slice(pp, src.indexOf('\n}', pp) + 2)
// eslint-disable-next-line no-new-func
const pickPanel = new Function(krSrc + '\n' + ppSrc + '\nreturn pickPanel;')()

const regex = ['architect', 'reviewer', 'implementer']
let fail = 0
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const ok = (cond, msg) => { if (!cond) { console.log('FAIL  ' + msg); fail++ } }
ok(eq(pickPanel('architect,domain,tester', regex), ['architect', 'domain', 'tester']), 'explicit args.panel (string) honored exactly')
ok(eq(pickPanel(['architect', 'domain', 'tester'], regex), ['architect', 'domain', 'tester']), 'explicit args.panel (array) honored')
ok(eq(pickPanel('architect, wizard, tester', regex), ['architect', 'tester']), 'unknown role "wizard" dropped')
ok(eq(pickPanel('a,b,c,d,e', regex).length ? pickPanel('architect,reviewer,tester,ops', regex) : [], ['architect', 'reviewer', 'tester']), 'capped at 3')
ok(eq(pickPanel('', regex), regex), 'empty args.panel → regex fallback')
ok(eq(pickPanel(undefined, regex), regex), 'undefined args.panel → regex fallback')
ok(eq(pickPanel('wizard,goblin', regex), regex), 'all-invalid args.panel → regex fallback (never empty)')
ok(eq(pickPanel('architect,architect,reviewer', regex), ['architect', 'reviewer']), 'deduped')
ok(pickPanel('wizard', []).length === 3, 'even with empty regex fallback, returns the 3 hard defaults (never empty)')
if (fail) { console.log(`\n${fail} panel cases FAILED`); process.exit(1) }
console.log('panel: args.panel validated/deduped/capped, regex fallback, never empty — PASS')
