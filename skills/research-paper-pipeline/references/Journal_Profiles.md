# Journal Profiles

A journal profile is a JSON file in `profiles/` that encodes one venue's submission
rules. The engine and the format gate are generic; the profile is what makes the same
pipeline enforce California Management Review one day and IEEE Transactions on
Engineering Management the next. To target a new venue, copy `generic.json`, rename it,
and fill in every field from that venue's official author guidelines.

Each profile was built from the venue's official guidelines page (URL and verification
date are recorded in the profile). Where a venue's guidelines did not state a value, the
field is left null or "not specified" rather than guessed. Always confirm against the
live guidelines before submitting; journals revise these.

## Bundled profiles

| Venue | Model | Review | Citations | Abstract | Exhibits | Length |
|---|---|---|---|---|---|---|
| California Management Review | manuscript | double_blind | endnotes_in_notes_no_reflist | 100 | separate_file | 5000-9000 words |
| IEEE Transactions on Engineering Management | manuscript | double_blind | numbered_reflist | 200-250 w | separate_file | ?-? pages |
| MIT Sloan Management Review | manuscript | not_blind | superscript_endnotes | - | inline | 800-4000 words |
| Harvard Business Review | pitch | not_blind | not_specified | - | inline | ?-? none |
| Academy of Management Journal | manuscript | double_blind | alpha_reflist_unnumbered | 0-200 w | end_of_manuscript | ?-? pages |
| Communications of the ACM | manuscript | not_specified | alpha_numbered_reflist | 0-inf w | inline | ?-? pages |
| Generic Journal (edit me) | manuscript | double_blind | numbered_reflist | 150-250 w | separate_file | 4000-10000 words |

## The schema

Human-readable fields (for the author and the SKILL):

- `id`, `name`, `publisher`, `guidelines_url`, `guidelines_verified`
- `submission_model`: `manuscript` (a formatted file is submitted) or `pitch` (an editor
  pitch or proposal; most format fields do not apply)
- `review_type`: `double_blind` / `single_blind` / `not_blind` / `not_specified`
- `anonymized_manuscript_required`, `title_page_separate`
- `file_types`, `template`
- `length`: `{unit: words|pages|none, min, max, basis, inclusions, note}`
- `abstract`: `{required, min_words, max_words, structured, note}`
- `extra_front_matter`: venue-specific front matter (for example IEEE TEM's Managerial
  Relevance Statement)
- `keywords`: `{required, min, note}`
- `citation_style`, `reference_presentation`, `reference_order`, `references_numbered`
- `etal_rule`: the venue's rule for 3+ author citations
- `formatting`: `{spacing, font_pt, font_family, page_size, margins_in, note}`
- `figures_tables`: `{placement: separate_file|end_of_manuscript|inline, callouts, note}`
- `headings`, `cover_letter`, `ai_disclosure`, `distinctive_rules`

Machine-readable block that drives `format_check.py` (`checks`): the same information in
switch form. Set any check to `null` to skip it. Key toggles:

- `require_blind`, `blind_check_metadata`, `blind_check_filenames`
- `abstract_required`, `abstract_word_min`, `abstract_word_max` (equal min and max means
  an exact count, as with CMR's 100 words)
- `keywords_min`
- `reference_model`: `endnotes` / `reflist` / `none`; plus `endnotes_contiguous`,
  `endnotes_no_reflist`, `reference_list_required`, `references_numbered`,
  `reference_order`, `etal_first_author`
- `exhibits_placement`, `require_callouts`, `no_inline_tables`, `no_inline_images`
- `spacing`, `min_line_twips`, `font_min_halfpt`, `default_font_halfpt`
- `page_size`, `margins_twips`, `heading_levels_min`
- `length_unit`, `length_min`, `length_max` (page-limited venues skip the word gate,
  since printed pages are not measurable from a .docx)
- `extra_front_matter_required`, `no_em_dash`, `no_markdown_leak`

## Design axes (why the schema looks like this)

The venues differ along a small set of axes, and the schema has one field per axis:

1. Submission model: formatted manuscript versus editor pitch. A `pitch` profile makes
   most format fields not applicable.
2. Blind versus named, and whether the title page rides inside or outside the reviewed
   file.
3. Citation style and reference presentation, which do not co-vary. CMR uses Chicago
   numbered endnotes with no separate list; IEEE uses numbered brackets with a list
   ordered by citation; AMJ uses author-date with an alphabetical, un-numbered list;
   CACM numbers a list that is nonetheless alphabetical.
4. Abstract rules: required or not, word cap, structured or plain.
5. Exhibits inline, at the end of the manuscript, or in a separate file.
6. Length in words, in pages, or unspecified, and what counts toward it.
7. Cover letter and AI disclosure: required or not, and where the disclosure belongs.

## A note on IEEE's two formats

IEEE journals have two distinct layouts. The society guidelines describe the double-
spaced, single-column, 12-point, 1-inch-margin format for the initial review submission,
and that is what `ieee-tem.json` encodes. The camera-ready two-column template is a
different animal (smaller fonts, tight margins, an "Abstract-" run-in header) and is not
the review format. Build to the review format first. IEEE's structural run-in headers
use em-dashes as house scaffolding; that is a template artifact, separate from the
author's no-em-dash rule for body prose.
