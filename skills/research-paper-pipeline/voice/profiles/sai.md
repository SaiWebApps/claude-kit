# Style Bible — v3 (Sairam's voice)

For the Voice Editor. Self-contained; supersedes v1–v2.

**Corpus analyzed:** analytical-prescriptive (China AI paper, LGST 8980, 2025); case analyses (MGMT 6130 ×7, 2024); reflective-narrative (MGMT 6100 leadership essays, 2024); **a professional/technical design doc (enterprise data-platform work)**; handwritten ideation notes (China-paper prep); co-authored technical paper (CMU, 2014 — range only).
**Still missing:** a sample of **Gajendra's** writing (the paper is co-authored).

> **v3 update:** I now have your *professional* register — how you write for colleagues, not professors — which is the closest match to a journal article. With it, I have your voice across the full range this paper needs.

---

## You have three working registers — use all three

A flat, single-register voice is itself an LLM tell. You don't have one, and the paper shouldn't either.

| Register | How it reads | Where it goes in the CMR paper |
|---|---|---|
| **Analytical-prescriptive** (China paper) | Analogy-led open, named-evidence accumulation, builds to a directive | The opening hook and the closing prescription |
| **Professional / technical-doc** (enterprise data platform) | Crisp, structured, define-then-justify, plain declaratives, tables | The core exposition — frameworks, the review-theater mechanics, the work-distribution tables |
| **Reflective-narrative** (leadership essays) | First-person, candid, named people, real stakes | A first-person beat only if the author supplies and approves one; the samples are not content |

---

## The cross-register constant — your truest signature

**Comparative scaffolding plus the reason behind the rule.** You never just state a claim; you state it, contrast it against the alternative, and explain the underlying intent. It appears in every register:

- *Technical doc (paraphrased; the register states a rule, contrasts the case where it fails, then gives the reason):* "For the simple inputs the complete value is fine. **But** for the aggregated case that value is chosen regardless of other metadata. **Similarly** for simple property types. **However**, for complex types (lists, maps, structured data) the same setting **asserts more than the author actually intended**."
- *Case analysis:* "In the US… **Meanwhile**, in China…"
- *China paper:* "the latter… involves a move-fast-and-break-things philosophy, so it's not taking the time to truly analyze…"

If the Voice Editor preserves one thing, it's this: contrast + rationale, never a bare assertion.

---

## The professional register, specifically (new in v3)

- **Structure-first:** Overview → Background → specifics; reference data in tables.
- **Explicit scope and boundaries:** he states the boundary in words (for example, "if a case is not covered by one of the sections below, it is not supported").
- **Crisp boundary calls:** "the idea of partially curating a single-valued property is meaningless."
- **Reason before rule:** he motivates the design (the mechanism "asserts more than the author actually intended") rather than just stating it.
- **Honest about limits/future work:** "More may be added to this list over time, though each will require individual attention given the complexity of their data type."
- **Texture:** plainer and more economical than the essays — no analogies, no flourish, near-uniform functional rhythm. This is the target texture for the paper's explanatory spine.
- **Speed-slips** (a doubled period, a dropped "the") show up here too — Line Editor territory, not voice.

---

## Signature moves (across registers)

- **Open on a historical/analogical hook, then map it** — Sputnik for the AI race; the mason for apprenticeship. (Reserve for the opening; the technical spine stays literal.)
- **Argue by accumulation of *named* specifics** (Zhipu, Baichuan, Minimax; or concrete field-level items), never "various things."
- **Distill, then crystallize** — "To tie this all together…", "Succinctly…", "Essentially…", and from the notes, "The trap is this:". You land the plane with one sentence.
- **Trace second- and third-order consequences** — the Ryanair "albatross" chain; the staged debt-spiral model in the notes.
- **Reason from staged models and precedent** — 1st/2nd/3rd-stage frames; Brazil, Japan, the 1930s US as analogies.

## Sentence mechanics

- **Varied rhythm in prose:** long semicolon-linked builds punctuated by a short hammer line ("Neither proved to be true."). The single biggest thing to preserve.
- **Conversational connectives** (But/And/So/Also) are fine in the essay register; the technical register is more clipped.
- **Earned emphasis:** the occasional capital, "!", or "…really?" — rare, never decorative.
- **Punctuation fingerprints:** spaced en-dash "–"; serial semicolons; deliberate, content-bearing rule-of-three.

### Lexical fingerprints
`Essentially` · `Succinctly` · `To tie this all together` · `The trap is this` · `In other words` · `Meanwhile` · `Conversely` · `However` · `Similarly` · `For instance` · `namely` · `albeit` · `clear-eyed` · editorial **we**
**Informal idioms (texture):** `from the get-go` · `hearken back` · `can-do` · `get up to speed` · vivid images like `an albatross around its neck`.

---

## The de-AI checklist — your move vs. the model's default

| LLM default | What you actually do |
|---|---|
| Generic placeholders ("various companies," "studies show") | Name the instance — the company, the number, the property |
| Hedging stacks | Commit: "Neither proved to be true." / "…is meaningless." |
| Reflexive "Moreover/Furthermore" chains | Sparing, substantive connectives; "To tie this together," "However," "Meanwhile" |
| Uniform medium sentences | Long build, then a short hammer line |
| "In today's rapidly evolving landscape…" | A concrete analogy (Sputnik, the mason) you then map |
| Flat, single register everywhere | Three registers, matched to the section |
| Bare assertions | Claim + contrast + the reason behind it |
| "It is important to note that…" | Just make the point, then distill it |

---

## Tuning for California Management Review

- **Opening & close:** analytical-prescriptive voice — an analogy hook, then a sharp prescriptive landing (channel the China paper's energy into a directive, not a rallying cry).
- **Body & frameworks:** professional/technical-doc voice — crisp, structured, contrast-and-rationale, tables where they earn their place.
- **Grounding:** a first-person beat is available only if the author supplies and approves one. The voice samples (including the personal-anecdote pieces) are off-limits as content.
- **Always:** preserve the comparative-scaffolding-plus-rationale signature; vary rhythm; name specifics; let the Line Editor catch the speed-slips.

## Author redline rules (locked — enforced by voice_lint.py)

Straight from Sairam's live redlines. These override anything above on conflict, and each is encoded as a check in the linter so it cannot slip through again.

1. **No em-dashes.** Budget is zero in body prose. Use a period, colon, semicolon, parentheses, or a restructure. (This is the rule I violated; it is now mechanically enforced.)
2. **"Yet," never "And yet."** Drop the crutch "And."
3. **Asides take parentheses with the editorial "let us."** Write "One path (let us call it substitution)," not the dash-bracketed form.
4. **Samples are voice-only, never content.** Do not import biographical or personal material from the writing samples (for example, a personal anecdote) into the manuscript unless the author explicitly approves it.
5. **Formal attribution.** Use author-date naming, "Author(s) (year)", and full proper names for studies, benchmarks, and institutions. No casual shorthand ("and colleagues," "a study found," "a standard benchmark"). Business journals read as formal, and the citations must match.

## Open question
Should the paper read primarily in your voice with Gajendra's input folded in, or do you want his voice modeled too? If the latter, one or two of his work samples (a design doc or memo) would let me build a fused two-author register.
