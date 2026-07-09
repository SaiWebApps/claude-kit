#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Gated, portable submission build. Runs the whole chain and REFUSES to report
# success unless BOTH gates pass (set -e aborts the instant a gate fails):
#   voice_lint.py   - no em-dashes / voice-rule violations
#   format_check.py - full profile conformance against the BUILT .docx files
# Usage:  PAPER_DIR=/path/to/paper  scripts/build_submission.sh [profile_id]
#         (or run from inside the paper dir)
# ---------------------------------------------------------------------------
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKDIR="${PAPER_DIR:-$PWD}"
cd "$WORKDIR"
mkdir -p build
PROFILE="${1:-}"
PARG=(); [ -n "$PROFILE" ] && PARG=(--profile "$PROFILE")
export FIGURE_DIR="$WORKDIR/build"

echo "[1/6] figures"
python3 - <<'PY'
import json, os, subprocess, sys
from pathlib import Path
cfg = json.load(open("paper.config.json")) if Path("paper.config.json").exists() else {}
for fig in cfg.get("figures", []):
    s = fig.get("script")
    if s and Path(s).exists():
        subprocess.run([sys.executable, s, os.path.join("build", fig["name"])], check=True)
    else:
        print("  (no figure script for", fig.get("name"), ")")
PY

echo "[2/6] convert -> master markdown"
python3 "$HERE/convert_citations.py" "${PARG[@]}" | sed 's/^/    /'

echo "[3/6] split -> submission files"
python3 "$HERE/make_submission.py" "${PARG[@]}" | sed 's/^/    /'

echo "[4/6] VOICE GATE"
MD="build/Manuscript_blind.md"; [ -f "$MD" ] || MD="build/Manuscript.md"
python3 "$HERE/voice_lint.py" "$MD" | tail -3

echo "[5/6] render .docx"
RUNHEAD=$(python3 -c "import json;print(json.load(open('paper.config.json')).get('running_head',''))")
SPACING=$(python3 -c "import json,sys;sys.path.insert(0,'$HERE');import paperkit;p=paperkit.get_profile(${PROFILE:+'$PROFILE'}${PROFILE:+,} wd=paperkit.workdir());print(p.get('checks',{}).get('spacing') or 'single')")
[ "$SPACING" = "double" ] && MS=double || MS=single
node "$HERE/build_docx.js" "$MD" "build/$(basename "${MD%.md}").docx" "$MS" "$RUNHEAD" | sed 's/^/    /'
[ -f build/Title_Page.md ]    && node "$HERE/build_docx.js" build/Title_Page.md    build/Title_Page.docx    single "" | sed 's/^/    /' || true
[ -f build/Exhibits_File.md ] && node "$HERE/build_docx.js" build/Exhibits_File.md build/Exhibits_File.docx single "" | sed 's/^/    /' || true

echo "[6/6] FORMAT GATE (build ABORTS if this fails)"
python3 "$HERE/format_check.py" "${PARG[@]}"

echo ""
echo "============================================================"
echo "BUILD COMPLETE - both gates green. Files in $WORKDIR/build/"
echo "============================================================"
