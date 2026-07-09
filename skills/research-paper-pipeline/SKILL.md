---
name: research-paper-pipeline
description: >-
  Write, format, and verify a publication-ready research or management paper in Sai's professional
  writing voice, then assemble a complete journal submission for a chosen venue. Journal-agnostic:
  California Management Review, IEEE Transactions on Engineering Management, MIT Sloan Management
  Review, HBR, Academy of Management, CACM, or any journal you add as a profile. Use whenever Sai
  wants to draft, revise, wordsmith, format, or submit a research/management paper or working
  paper; build a blind manuscript, title page, separate exhibits, cover letter, or review packet;
  enforce a no-em-dash house voice; convert author-date citations to numbered endnotes or an
  IEEE/APA reference list; or run a deterministic voice or format conformance check. Trigger even
  without a venue named, e.g. "make this read like me not an LLM," "harden my paper for
  submission," "get this ready for IEEE," or "convert my citations to endnotes."
  Professional/academic writing, not fiction.
---

# Research Paper Pipeline

A complete, gate-first workflow for taking a research or management paper from section
drafts to a verified journal submission, written in Sai's voice and conformant to a
chosen venue. It generalizes the original CMR pipeline: the voice layer is journal-
agnostic, and every venue-specific rule now lives in a swappable profile. The design
principle is unchanged. Build, then prove. Nothing is called done, in-voice, or
conformant until a gate says so.

The default voice spec is at `voice/profiles/sai.md` (Sai's, the base case; swap in your
own per `voice/README.md`); the venue rules are in `profiles/`; the build and verify
scripts are in `scripts/`. Read the Style Bible in full before writing prose in this
voice, and read `references/Publishing_Playbook.md` for the end-to-end method (it folds
in techniques surveyed from other AI academic-writing tools).

## When to use

Any task on Sai's professional paper pipeline: drafting or revising sections,
wordsmithing to the voice, converting citations to a venue's reference model, building
the blind manuscript / title page / exhibits / cover letter / review packet, running the
voice or format gate, targeting a new journal, or hunting and verifying evidence.

## The voice (load-bearing, journal-agnostic)

Read `voice/profiles/sai.md` for the full spec (the bundled base-case voice; point the
gate at another author's rules with `--voice NAME`). The rules violated most:

- **No em-dashes. Ever.** Replace with a period, colon, semicolon, parentheses, or a
  restructure. `scripts/voice_lint.py` blocks the build on any em-dash. (En-dashes in
  number ranges like 9459-9474 are fine.)
- **"Yet" begins a sentence; never the "And"-prefixed form.**
- **Parenthetical asides use parentheses**, often with an editorial "let us," not dashes.
- Three registers (analytical-prescriptive, technical-documentation, reflective). Match
  the register to the section. Vary sentence length; let short sentences land.
- Voice samples for how it sounds live in `voice/samples/` (author-provided, not
  published), distilled into the Style Bible; they are references, never content to copy.

The voice is itself a swappable profile. Sai's is bundled as the default. To calibrate
the pipeline to another author, add `voice/profiles/<name>.md` plus
`voice/profiles/<name>.redlines.json` and set `"voice": "<name>"` in the paper config
(see `voice/README.md`). The base case is Sai's, so the skill writes in his tone unless
told otherwise.

Run the voice gate on any markdown before declaring it clean:

```bash
python3 scripts/voice_lint.py path/to/draft.md             # Sai's rules by default
python3 scripts/voice_lint.py --voice sai path/to/draft.md  # or any voice/profiles/<name>
```

## The profile system (what makes it journal-agnostic)

Each venue is a JSON file in `profiles/` encoding its submission rules: blind or named,
citation style and reference presentation, abstract rules, exhibits placement, length,
cover letter, AI disclosure. Bundled: `cmr`, `ieee-tem`, `mit-smr`, `hbr`, `amj`, `cacm`,
and `generic`. See `references/Journal_Profiles.md` for the catalog and schema. To target
a new venue, copy `generic.json`, rename it, and fill every field from that venue's
official guidelines. The engine and the gate are generic; the profile is the difference.

A paper carries its own facts in `paper.config.json` (title, authors, abstract, keywords,
disclosure, the section list, and which profile to use) and its citations in an external
notes file. Nothing about a specific paper is baked into the scripts.

## The pipeline

Section drafts (author-date citations) become a numbered-reference master, then the
venue's required files, then gates, then a packet.

| Script | Role |
|---|---|
| `convert_citations.py` | Drafts to master manuscript; converts `Author (Year)` citations to numbered endnotes or an `[n]` reference list per the profile, using the paper's external notes file. |
| `make_submission.py` | Master to the venue's files: blind manuscript + title page + separate exhibits (blind venues), or a single named manuscript (others). Inserts `[Insert Table/Figure/Exhibit N here]` callouts when exhibits are separate. |
| `build_docx.js` | Renders a markdown file to `.docx`. Args: `SRC OUT SPACING("double"/"single") RUNNINGHEAD`. Figures resolve from `$FIGURE_DIR` or the output directory (portable). |
| `format_check.py` | The format gate. Profile-driven conformance checks against the built `.docx` files. |
| `voice_lint.py` | The voice gate (em-dash and LLM-tell watchlist). |
| `make_reading_copy.py` | Single-spaced, named reading copy with exhibits inline (human review only). |
| `build_cover_letter.js` | Renders a markdown cover letter to a one-page `.docx`. |
| `build_packet.py` | Merges component PDFs into one navigable review packet (cover + dividers). |
| `build_submission.sh` | Runs the whole chain and refuses to report success unless both gates pass. |

End to end (portable; point `PAPER_DIR` at the paper's working directory):

```bash
PAPER_DIR=/path/to/paper  scripts/build_submission.sh [profile_id]
```

## The format gate is the source of truth

Never call a paper conformant from reading the markdown or your own inspection. Build the
`.docx` files and run:

```bash
python3 scripts/format_check.py --profile <id> --dir /path/to/paper   # exit 0 only when conformant
```

For high-stakes confidence, render to PDF with LibreOffice and look at the pages, and run
a hostile-reviewer subagent (see `references/Peer_Review_Sim.md`) that audits the built
files independently. The gate has repeatedly caught real defects (single-spaced endnotes,
sub-12pt text, missing callouts, author names hiding in document metadata) that looked
fine in the source.

## Honesty and integrity (these matter most)

- **Never invent a citation, number, or finding.** Every claim traces to a real,
  checkable source, verified against the primary document, not a search summary. Label
  non-peer-reviewed sources (vendor reports, preprints, leaderboards) as such, and caveat
  anything superseded. When a claim cannot be grounded, mark it `[MATERIAL GAP]` and ask.
- **Disclose AI use** per the venue's policy (the profile records where). The honest
  framing: the authors own the thesis, argument, and analysis; AI assisted with drafting
  in their voice, citation formatting, and figures; the authors verified everything.
- **Conflicts of interest stay out.** No employer promotion, no author's own products in
  the content; a personal-capacity note where appropriate.
- Illustrative numbers are labeled as scenario, not forecast or measured data. Keep that
  framing explicit.

## Targeting a new paper or a new venue

1. Create a working directory with a `paper.config.json` (see `examples/who-trains-the-
   next-senior/paper.config.json`), your section drafts, and an external notes file.
2. Set `"profile"` to a bundled venue or add your own under `profiles/`.
3. For each source, add a note (full + shortened form, first-author `et al.` for 3+
   authors) and its citation pattern to the notes file.
4. Run `build_submission.sh`; fix whatever the gates flag; verify every source.

## Examples

- `examples/demo/` is a small, self-contained paper (synthetic content in the house
  voice) that runs end to end against the `mit-smr` profile and passes both gates. It is
  the out-of-the-box regression test:
  `PAPER_DIR=examples/demo scripts/build_submission.sh mit-smr`.
- `examples/_TEMPLATE/` is a skeleton to copy when starting a new paper.
- `examples/who-trains-the-next-senior/` keeps the real CMR configuration
  (`paper.config.json`, `config/notes.json`) as a reference. Its section drafts are kept
  local while the paper is under blind review (see that folder's `content/README.md`);
  drop them in to rebuild the full submission.
