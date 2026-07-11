#!/usr/bin/env python3
"""voice_lint.py - deterministic, voice-configurable compliance gate.

Encodes an author's HARD redlines plus a watchlist of LLM tells. Nothing reaches the
author until this passes. The default rules are Sai's (the base case). Point it at any
other voice with --voice NAME (loads voice/profiles/NAME.redlines.json) or --rules PATH,
so the same gate enforces any author's style.

Usage:  python3 voice_lint.py [--voice NAME | --rules PATH] FILE [FILE ...]
Exit code 1 if any HARD violation is found in any file, else 0.
"""
import sys, re, json, argparse
from pathlib import Path

SKILL_ROOT = Path(__file__).resolve().parent.parent

# ---- built-in defaults = Sai's rules (so the gate works with no config) ----
HARD = {
    "em_dash":  (re.compile(r"—"),
                 'Em-dash banned (budget 0). Use period / colon / semicolon / parentheses / restructure.'),
    "and_yet":  (re.compile(r"\band\s+yet\b", re.I),
                 '"And yet" banned. Use "Yet".'),
    "dash_aside": (re.compile(r"—[^—]{1,40}—"),
                 'Dash-bracketed aside. Use parentheses with the editorial "let us".'),
}
WARN = {
    "in_todays":         re.compile(r"in today'?s\b", re.I),
    "evolving":          re.compile(r"(rapidly|ever)[ -]evolving|ever[ -]changing", re.I),
    "important_to_note": re.compile(r"it (?:is|'s) (?:important to note|worth noting)", re.I),
    "in_conclusion":     re.compile(r"\bin conclusion\b", re.I),
    "delve":             re.compile(r"\bdelv(?:e|es|ing)\b", re.I),
    "testament_to":      re.compile(r"\btestament to\b", re.I),
    "underscore":        re.compile(r"\bunderscor(?:e|es|ing)\b", re.I),
    "moreover_opener":   re.compile(r"^\s*(?:moreover|furthermore|additionally)\b", re.I),
    "not_just_but":      re.compile(r"\bnot just\b.{0,60}\b(?:but|it'?s)\b", re.I),
    # NOTE: the spaced EN-dash (' – ') is Sai's positive punctuation fingerprint (see voice/profiles/sai.md),
    # NOT an LLM tell — it is deliberately NOT flagged here. The em-dash ('—') remains a HARD ban above.
    "casual_attribution": re.compile(r"\band colleagues\b|\bresearchers (?:found|showed|examined|re-examined)\b|\ba (?:standard|recent) (?:study|benchmark|trial)\b", re.I),
    "ai_lexicon":        re.compile(r"\b(tapestry|multifaceted|leverage|leverages|leveraging|showcase|showcases|realm|landscape|seamless|seamlessly|robust|pivotal|crucial|myriad|plethora|nuanced|holistic|synerg\w+|treasure trove|boasts?|navigat\w+ the)\b", re.I),
    "crucial_role":      re.compile(r"plays? a (?:crucial|vital|key|pivotal|significant) role", re.I),
    "rich_tapestry":     re.compile(r"rich tapestry|intricate (?:tapestry|web|dance)", re.I),
}

def _flags(s):
    f = 0
    if "i" in (s or ""): f |= re.I
    if "m" in (s or ""): f |= re.M
    return f

def load_rules(path):
    """Replace HARD/WARN from a redlines JSON file."""
    global HARD, WARN
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    HARD = {k: (re.compile(v["pattern"], _flags(v.get("flags"))), v.get("message", k))
            for k, v in data.get("hard", {}).items()}
    WARN = {k: re.compile(v["pattern"], _flags(v.get("flags")))
            for k, v in data.get("warn", {}).items()}

def strip_markup(line):
    """Strip leading markdown structure (headings, blockquotes, list bullets) and table pipes so the
    PROSE inside bullets/headings/cells is still linted — instead of skipping the whole line, which let
    LLM tells and even a HARD em-dash escape the gate. Returns '' for a pure hr / table-separator row."""
    s = re.sub(r"^\s*(?:[>#]\s*)+", "", line)          # headings, blockquotes (possibly nested)
    s = re.sub(r"^\s*(?:[-*+]\s+|\d+\.\s+)", "", s)      # unordered / ordered list bullets
    s = s.replace("|", " ")                             # table cell dividers -> spaces (lint the cells)
    if set(s.strip()) <= set("-: "):                    # pure hr / table-separator row -> no prose
        return ""
    return s.strip()

def split_sentences(text):
    return [x for x in re.split(r"(?<=[.!?])\s+", text) if x.strip()]

def lint(path):
    raw = open(path, encoding="utf-8").read().splitlines()
    body = []
    for i, ln in enumerate(raw):
        prose = strip_markup(ln)
        if prose:
            body.append((i + 1, prose))
    hard = {k: [] for k in HARD}
    warn = {k: [] for k in WARN}
    for lineno, ln in body:
        for k, (rx, _) in HARD.items():
            if rx.search(ln):
                hard[k] += [lineno] * len(rx.findall(ln))
        for k, rx in WARN.items():
            if rx.search(ln):
                warn[k].append(lineno)
    return " ".join(ln for _, ln in body), hard, warn

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice"); ap.add_argument("--rules")
    ap.add_argument("files", nargs="+")
    a = ap.parse_args()
    rules_path = a.rules or (SKILL_ROOT / "voice" / "profiles" / f"{a.voice}.redlines.json" if a.voice else None)
    if rules_path:
        if not Path(rules_path).exists():
            print(f"rules file not found: {rules_path}"); sys.exit(2)
        load_rules(rules_path)

    any_hard = False
    for p in a.files:
        body, hard, warn = lint(p)
        sents = split_sentences(body)
        lens = [len(s.split()) for s in sents] or [0]
        mean = sum(lens) // len(lens)
        std = (sum((x - mean) ** 2 for x in lens) / len(lens)) ** 0.5
        print(f"\n=== {p}")
        print(f"    body: {len(body.split())} words, {len(sents)} sentences, sentence length "
              f"min/mean/max = {min(lens)}/{mean}/{max(lens)}, stdev = {std:.1f} "
              f"({'low - vary rhythm' if std < 6 else 'ok'})")
        failed = False
        for k, (rx, msg) in HARD.items():
            if hard[k]:
                failed = any_hard = True
                print(f"    HARD FAIL [{k}] x{len(hard[k])} -> lines {sorted(set(hard[k]))}: {msg}")
        for k in WARN:
            if warn[k]:
                print(f"    warn      [{k}] x{len(warn[k])} -> lines {sorted(set(warn[k]))}")
        if not failed:
            print("    PASS - no hard violations")
    print(f"\nRESULT: {'FAIL' if any_hard else 'PASS'}")
    sys.exit(1 if any_hard else 0)

if __name__ == "__main__":
    main()
