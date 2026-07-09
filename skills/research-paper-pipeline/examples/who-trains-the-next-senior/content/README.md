# Content for this example is kept local

This paper ("Who Trains the Next Senior?") is under blind peer review, so its section
drafts, exhibits, and ledgers are intentionally NOT committed to this public repository.
`paper.config.json` and `config/notes.json` are kept as a real-world configuration
reference (how a paper is wired up for the CMR profile).

To rebuild this paper locally, place the section drafts named in `paper.config.json`
(`Draft_Opening_v2.md`, `Draft_TechPrimer_v1.md`, ...) plus `Exhibits.md` into this
folder, then run `PAPER_DIR=$PWD scripts/build_submission.sh cmr` from the skill root.
For a runnable, self-contained example, see `examples/demo/` instead.
