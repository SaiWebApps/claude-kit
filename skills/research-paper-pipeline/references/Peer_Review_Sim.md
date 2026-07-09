# Peer-Review Simulation

A reusable protocol for stress-testing a manuscript before the real referees see it. Run
it after the format gate passes. The reviewers report; they do not rewrite the source.
Do not fabricate weaknesses, and do not invent citations the manuscript lacks.

## How to run it

Give an agent the built manuscript and the target profile, and have it produce the four
passes below as separate outputs. For real independence, run each reviewer as its own
agent invocation so one persona does not anchor the next.

### Pass 1: Desk-reject screen (the editor)

Would an editor bounce this before review? Judge fit to the venue's scope and audience,
whether the contribution is stated clearly in the first page, whether the format
conforms, and whether the originality bar is met (for practitioner venues: is the idea
more than something a reader could get by asking a model directly?). Output: DESK ACCEPT
or DESK REJECT, with two or three sentences of reasoning.

### Pass 2: Reviewer A (methodology and evidence)

A senior reviewer focused on rigor. For each major claim: is it supported, and by a real
and correctly represented source? Are numbers labeled as measured, estimated, or
illustrative? Are limitations stated? Return numbered major concerns, numbered minor
concerns, and a verdict: Accept / Minor revisions / Major revisions / Reject.

### Pass 3: Reviewer B (contribution and clarity)

A reviewer focused on the argument. Is the thesis novel and clearly framed? Does the
structure carry it? Is the prose in one voice, free of machine tells, jargon defined?
Does the paper earn its length? Same output shape as Reviewer A.

### Pass 4: Devil's advocate

A reviewer whose job is to resist the paper's frame. It may not concede on two
consecutive points. It looks for the strongest counterargument the paper ignores, the
result that would overturn the thesis, and any place the authors are marking their own
homework. Output: the three hardest questions the authors must be able to answer.

### Editorial summary

Synthesize the four passes into one decision and a prioritized, deduplicated list of what
to fix, hardest first. Every item feeds the reviewer-response matrix.

## Constraints

Constructive tone, no hostility. No fabricated citations. Do not over- or under-rate to
seem balanced. Cite the specific section or line for each concern so it is actionable.
