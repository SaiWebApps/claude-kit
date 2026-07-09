# The Publishing Playbook

Practices for taking a research or management paper from draft to a verified journal
submission. This file is the "what good looks like" companion to the mechanical gates
in `scripts/`. It folds in techniques surveyed from the current crop of AI-assisted
academic-writing tools (see Prior Art at the end), keeping only what is honest and
load-bearing. The organizing principle is the one this pipeline was built on: build,
then prove. Nothing is called done, in-voice, or conformant until a gate says so.

## The gate-first philosophy

The expensive failure mode is claiming a paper is finished, in the author's voice, or
correctly formatted without verifying it. Every stage below ends in a check that can
fail the build. Two of those checks are mechanical and non-negotiable: the voice gate
(`voice_lint.py`) and the format gate (`format_check.py`). The rest are disciplined
human-plus-agent reviews. A draft reaches the author only with its gate results
attached, so "it passed" is a fact, not a hope.

## Stages

1. **Frame and evidence.** Fix the thesis and the spine before prose. Collect the
   author's own predictions and commitments first, so the argument is theirs and the
   model is filling in, not inventing. Keep an Evidence Ledger: every claim, its source,
   and whether the source was verified against the primary document (not a search
   snippet).
2. **Draft by section, in the author's voice.** Write against the Style Bible, one
   section at a time, matched to the right register. Do not self-narrate process into
   the prose. Prefer named specifics over generic placeholders; specificity is the
   strongest anti-AI signal there is.
3. **Voice gate.** Run `voice_lint.py` on every section. Hard redlines (no em-dashes,
   "Yet" at the start of a sentence rather than the "And"-prefixed crutch, parenthetical
   asides in parentheses) block the draft. The
   watchlist flags LLM tells for a human pass. Fix before proceeding.
4. **Citations to numbered references.** Convert author-date citations to the venue's
   reference model (Chicago numbered endnotes, IEEE numbered brackets, and so on) with
   `convert_citations.py`, driven by an external notes file. Every in-text marker must
   resolve; every reference must trace to a real, checkable source.
5. **Assemble the submission.** Split into the venue's required files with
   `make_submission.py`: blinded manuscript, separate title page, separate exhibits,
   as the profile dictates.
6. **Format gate.** Build the `.docx` files and run `format_check.py` against the
   built files, not the markdown. This is the source of truth for conformance.
7. **Adversarial review.** Simulate the referees before they see it (see
   `references/Peer_Review_Sim.md`). Close the loop with a reviewer-response matrix that
   independently checks each point was addressed (see
   `references/Reviewer_Response_Matrix.md`).
8. **Integrity and disclosure.** Confirm the AI-use disclosure is present and correctly
   placed, that no conflict of interest leaks into the paper, and that every number and
   citation has been verified.

## Voice and de-AI, as quality (not detector evasion)

The goal is prose that reads like the author, not prose that beats a detector. Those are
different objectives, and only the first is honest. The linter enforces the author's
hard rules and flags a lexicon of tells surfaced across tools: a metronomic rhythm of
uniform medium sentences; reflexive "Moreover / Furthermore / Additionally" chains;
throat-clearing openers that set a scene before the point; the "not just X but Y"
construction; hedging stacks; and a bag of words that cluster in machine prose
(delve, tapestry, multifaceted, leverage, showcase, underscore, realm, robust, pivotal,
seamless, "plays a crucial role"). The positive moves matter more than the avoided ones:
vary sentence length so a short hammer line can land, name the instance, and state the
claim, its contrast, and the reason behind it. Pair de-AI with disclosure, never with
concealment.

## Evidence and citation integrity

Never invent a citation, a number, or a finding. Verify each source against the primary
document, not a search summary. Label non-peer-reviewed material (vendor reports,
preprints, leaderboards) as such, and caveat anything superseded. Cross-check every
in-text marker against the reference list or notes so none is orphaned and none is
uncited. When a claim cannot be grounded in supplied material, mark it `[MATERIAL GAP]`
and ask, rather than filling from model memory. Treat a citation the model produced from
memory as unverified until the primary source is fetched and read.

## Format conformance is per-venue, and it is where most tools are weak

Converting citation styles is common; enforcing a specific venue's structural template
is rare. That is the gap this skill fills. Each journal profile encodes the axes that
actually differ between venues: blind manuscript versus named; citation style and
whether references live in numbered endnotes, a separate list ordered by citation, or an
alphabetical list; abstract rules (required, word count, structured or plain); exhibits
inline versus a separate file; length in words or pages; cover-letter requirements; and
the AI-disclosure policy and where the disclosure belongs. The format gate reads the
profile and enforces exactly that venue's rules against the built document.

## Peer-review simulation

Before submission, run at least two complementary reviewer personas plus an editorial
summary: one methodological, one on clarity and contribution, each returning numbered
major and minor concerns and an explicit verdict. Add a desk-reject screen (would an
editor bounce this before review?) and a devil's-advocate pass that resists conceding on
consecutive points. The reviewers report; they do not silently rewrite the source. Then
generate a response and a traceability matrix that verifies each concern was actually
resolved in the revision, not merely acknowledged.

## Integrity, authorship, and AI disclosure

AI is not an author and cannot be. The human authors own the thesis, the argument, and
the analysis, and are accountable for every claim, number, and citation. Disclose AI
assistance honestly: writing and editing help belongs in the acknowledgments or a
disclosure note; use of AI for data, analysis, or figure generation belongs in the
methods. Match the placement and wording to the venue's policy (the profile records
it). Keep conflicts of interest out of the paper: no employer promotion, no author's own
products in the content, a personal-capacity note where appropriate.

## Reproducibility (including for non-code work)

For empirical or computational papers, answer a reproducibility checklist item by item
with [Yes] / [No] / [NA] and a one-line justification: data provenance and splits,
exclusions, dependencies, exact run counts, and licenses. For qualitative or management
work, the analogue is a decision log: where each figure came from, how estimates were
derived, and what is illustrative scenario versus measured data. Keep that distinction
explicit in the paper.

## Prior art surveyed

The practices above were cross-checked against current AI-assisted academic-writing
tools. The strongest technique sources: the `academic-research-skills` project by
Imbad0202 (staged pipeline with non-skippable integrity gates, a five-category writing
quality check, and an anti-leakage directive), `flonat/claude-research` (read-only audit
agents, a claim-verify agent that checks a citation matches what the source actually
says, and a promise-checker hook against performative compliance), `rpatrik96/research-
agora` (one skill per section, a claim auditor, and a voice-drift detector), and the
`aj-geddes` peer-review-simulator prompt. The strongest policy anchors: ICMJE and COPE
on authorship and AI disclosure, and the NeurIPS and Pineau reproducibility checklists.
What almost none of them do, and this skill does, is enforce a named venue's house
style. That is the reason this pipeline exists.

Sources:
- https://github.com/Imbad0202/academic-research-skills
- https://github.com/flonat/claude-research
- https://github.com/rpatrik96/research-agora
- https://github.com/aj-geddes/useful-ai-prompts
- https://www.icmje.org/recommendations/
- https://publicationethics.org/
- https://neurips.cc/public/guides/PaperChecklist
