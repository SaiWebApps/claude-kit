# Voice profiles (calibrate the pipeline to any author)

The voice layer is configurable, exactly like the journal profiles. A voice profile is a
Style Bible plus a redlines file that the voice gate enforces. Sai's profile (`sai`) is
the bundled base case; anyone can add their own.

```
voice/
  profiles/
    sai.md                 the base-case Style Bible (default voice)
    sai.redlines.json      the rules the gate enforces for that voice
    _TEMPLATE.md           copy this to start your own
    _TEMPLATE.redlines.json
  samples/                 your writing samples live here (not committed by default)
  Voice_Gate.md            how the gate works
```

## Use a voice

In `paper.config.json`, set `"voice": "sai"` (or your own profile name). The gate:

```bash
python3 scripts/voice_lint.py --voice sai draft.md      # or --rules voice/profiles/sai.redlines.json
```

With no `--voice`/`--rules`, the linter falls back to Sai's built-in rules, so it always
works out of the box.

## Calibrate your own voice

1. Put 4-8 of your own writing samples (the more varied the registers, the better) in
   `voice/samples/<yourname>/`. These are yours; they are gitignored by default so they
   are not published.
2. Copy `profiles/_TEMPLATE.md` to `profiles/<yourname>.md` and write your Style Bible
   from an analysis of those samples (ask Claude to read the samples and draft it against
   the structure in the template).
3. Copy `profiles/_TEMPLATE.redlines.json` to `profiles/<yourname>.redlines.json` and add
   your hard rules (phrases to ban) and watchlist (tells to flag).
4. Point your paper at it with `"voice": "<yourname>"` and run the gate.

The base case is Sai's, so the skill produces his tone by default. Swap the voice profile
to make it yours.
