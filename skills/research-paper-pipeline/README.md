# research-paper-pipeline

A gate-first, journal-agnostic pipeline for turning section drafts into a verified
journal submission written in a chosen author's voice. It generalizes the original CMR
pipeline along two axes: the venue (a swappable journal profile) and the voice (a
swappable voice profile). Two deterministic gates (voice and format) mean nothing ships
unverified. Sai's voice is the bundled base case; anyone can drop in their own.

## Layout

```
research-paper-pipeline/
  SKILL.md                     the skill entry point (read this first)
  README.md                    this file
  profiles/                    one JSON per venue (cmr, ieee-tem, mit-smr, hbr, amj, cacm, generic)
  voice/
    README.md                  how to calibrate the pipeline to any author's voice
    Voice_Gate.md              how the voice gate is enforced
    profiles/
      sai.md                   the base-case Style Bible (default voice)
      sai.redlines.json        the rules the voice gate enforces for that voice
      _TEMPLATE.md             copy to start your own voice profile
      _TEMPLATE.redlines.json
    samples/                   your writing samples (gitignored; not published)
  references/
    Publishing_Playbook.md     end-to-end method; absorbs other tools' best practices
    Journal_Profiles.md        profile catalog + schema
    Peer_Review_Sim.md         reusable peer-review simulation protocol
    Reviewer_Response_Matrix.md close-the-loop revision matrix
  scripts/                     the engine (portable; no hardcoded paths)
  examples/
    demo/                      a small, self-contained paper that runs end to end
    _TEMPLATE/                 skeleton to copy for a new paper
    who-trains-the-next-senior/  a real CMR configuration (drafts kept local)
```

## Dependencies

- **Node.js** with `docx` (`npm install docx`) for the document builders.
- **Python 3** with `matplotlib` (figures), `reportlab` and `pypdf` (review packet). The
  format gate reads `.docx` as a zip, so `python-docx` is not required.
- **LibreOffice** (`soffice`) to render `.docx` to PDF for the packet and visual checks.

```bash
npm install docx
pip install matplotlib reportlab pypdf
```

## Quickstart (the runnable demo)

```bash
cd research-paper-pipeline
PAPER_DIR="$PWD/examples/demo" scripts/build_submission.sh mit-smr
```

This converts citations to numbered endnotes, assembles the manuscript, runs the voice
gate, renders the `.docx`, and runs the format gate. It exits non-zero if either gate
fails; on success the files are in `examples/demo/build/`. The demo is synthetic and
self-contained, so it works out of the box with no private data.

## Configurable voice (with Sai as the base case)

The voice is a profile, exactly like the venue. `sai` is bundled and is the default, so
the pipeline writes in Sai's tone unless told otherwise. To calibrate it to yourself:

1. Put 4-8 of your writing samples in `voice/samples/<yourname>/` (gitignored, so they
   are not published).
2. Copy `voice/profiles/_TEMPLATE.md` to `voice/profiles/<yourname>.md` and write your
   Style Bible from those samples.
3. Copy `voice/profiles/_TEMPLATE.redlines.json` to `<yourname>.redlines.json` and add
   your hard rules and watchlist.
4. Set `"voice": "<yourname>"` in your paper config, and run the gate with
   `--voice <yourname>`.

See `voice/README.md` for detail.

## How it is portable

The original scripts pinned an absolute `/sessions/.../outputs` path from the session
they were built in, so nothing ran on reuse. Here every path resolves at runtime:
`scripts/paperkit.py` derives the working directory from `$PAPER_DIR` or the current
directory, and finds profiles relative to the skill. There is nothing to repoint.

## Add a new venue

1. Copy `profiles/generic.json` to `profiles/<venue>.json`.
2. Fill every field from the venue's official author guidelines (schema documented in
   `references/Journal_Profiles.md`). Set a check to `null` to skip it.
3. Point your paper's `paper.config.json` at `"profile": "<venue>"` and build.

## Start a new paper

Copy `examples/_TEMPLATE/` to a working directory, replace the `content/` drafts with
your sections, add each citation to `config/notes.json`, set the `profile` and `voice`,
then run `PAPER_DIR=/path/to/paper scripts/build_submission.sh`. Verify every source
against the primary document before submitting.

## The two gates

- `voice_lint.py [--voice NAME] FILE...` fails on any em-dash and flags LLM tells. Exit
  non-zero blocks the build.
- `format_check.py --profile <id> --dir <paper>` runs the venue's conformance checks
  against the BUILT `.docx` files. Exit non-zero means not conformant.

`build_submission.sh` runs the whole chain and will not report success unless both pass.
