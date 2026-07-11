#!/usr/bin/env python3
# voice_lint_test.py — guards the markup-skip hole + the en-dash contradiction.
# RED against the pre-fix voice_lint: bulleted/heading/table lines were skipped wholesale
# (is_meta), so LLM tells + even a HARD em-dash inside them escaped the gate; and the spaced
# EN-dash — Sai's positive fingerprint — was wrongly on the WARN list.
#   Run:  python3 voice_lint_test.py
import sys, tempfile, os, importlib.util
HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("voice_lint", os.path.join(HERE, "voice_lint.py"))
vl = importlib.util.module_from_spec(spec); spec.loader.exec_module(vl)

def lint_text(text):
    with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False, encoding="utf-8") as f:
        f.write(text); path = f.name
    try:
        return vl.lint(path)
    finally:
        os.unlink(path)

fails = 0
def check(cond, msg):
    global fails
    print(("PASS  " if cond else "FAIL  ") + msg)
    if not cond: fails += 1

# A: a BULLET line with AI tells must be caught (was skipped by is_meta)
_, _, warn = lint_text("* This will leverage synergy across the landscape.\n")
check(sum(len(v) for v in warn.values()) > 0, "bulleted line with tells is linted (not skipped)")

# B: a HEADING line with an em-dash must HARD-fail (markup content linted for HARD too)
_, hard, _ = lint_text("## A heading — with an em-dash\n")
check(len(hard.get("em_dash", [])) > 0, "heading line em-dash is caught")

# C: a TABLE cell with a tell must be caught (the '|' prefix was a skip trigger)
_, _, warn = lint_text("| col | this will delve into the tapestry |\n")
check(sum(len(v) for v in warn.values()) > 0, "table-cell tell is linted (not skipped)")

# D: spaced EN-dash (Sai's signature) is NOT a WARN rule (contradiction resolved)
check("spaced_en_dash" not in vl.WARN, "spaced en-dash removed from WARN (author fingerprint, not a tell)")

# E: no regression — clean prose passes; an em-dash in normal prose still HARD-fails
_, hard, _ = lint_text("The result was clear and the method held.\n")
check(sum(len(v) for v in hard.values()) == 0, "clean prose line has no HARD violation")
_, hard, _ = lint_text("The result — surprisingly — held.\n")
check(len(hard.get("em_dash", [])) > 0, "em-dash in normal prose still HARD-fails")

# F: pure hr / table-separator rows produce no spurious flags
_, hard, warn = lint_text("---\n|---|---|\n")
check(sum(len(v) for v in hard.values()) + sum(len(v) for v in warn.values()) == 0, "hr / table-separator rows are inert")

print(f"\nvoice_lint: {'FAIL' if fails else 'PASS'} ({fails} failed)")
sys.exit(1 if fails else 0)
