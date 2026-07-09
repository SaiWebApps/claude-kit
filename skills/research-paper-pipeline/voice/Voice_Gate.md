# The Voice Gate — how the pipeline enforces your voice

## What went wrong (owning it)

I specified a nine-role editorial pipeline, including a Voice Editor whose sole job was the de-AI pass against the style bible, and an adversarial reviewer. Then I drafted as a single generalist and never ran those checks. A draft carrying seven em-dashes reached you. That is a process failure, not a wording slip, and it is exactly the kind of thing the gate below exists to stop. This document turns the gate from something I described into something that actually runs.

## The gate (hard: nothing reaches you until all three pass)

1. **Deterministic lint — `voice_lint.py`.** Every section is scanned for your hard redlines (em-dashes, "And yet", dash-bracketed asides) and a watchlist of LLM tells. Any hard hit blocks the draft and returns line numbers. This does not depend on my vigilance; it is mechanical.
2. **Voice Editor agent audit.** A separate agent reads the style bible and the draft and judges what a linter cannot: does this actually sound like you? It returns voice-match notes and line-level fixes, and is run independently of whoever drafted the text (separation of duties).
3. **Adversarial reviewer pass ("Reviewer 2").** A final read whose job is to find anything that still reads as machine-made or off-voice.

Only a draft that clears all three is shown to you, and it arrives with its lint result attached so you can see it passed.

## The hard rules (current, version-controlled)

- **No em-dashes** (budget 0 in body prose). Period / colon / semicolon / parentheses / restructure.
- **"Yet," never "And yet."**
- **Parenthetical asides use parentheses and the editorial "let us,"** not dashes. ("One path (let us call it substitution)…")

## Watchlist (flagged for review, not auto-blocked)

"In today's…", "rapidly/ever-evolving", "it is important to note / worth noting", "In conclusion", "delve", "testament to", "underscore", sentence-opening "Moreover/Furthermore/Additionally", the "not just X but Y" construction, and the spaced en-dash used as connective tissue.

## Standing commitment

Every redline you give is added to `voice_lint.py` and the style bible **the same turn**. The watchlist graduates to a hard rule the moment you confirm it. The same mistake does not reach you twice.
