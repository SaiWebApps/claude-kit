#!/usr/bin/env bash
# Runs every workflow unit test (workflows/*.test.mjs). Drop in a new *.test.mjs and it's auto-discovered.
# Usage: bash ~/.claude-work/workflows/run-tests.sh
set -uo pipefail
dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fail=0
shopt -s nullglob
for f in "$dir"/*.test.mjs; do
  echo "== $(basename "$f")"
  node "$f" || fail=1
done
if [ "$fail" -eq 0 ]; then echo "ALL WORKFLOW TESTS PASS"; else echo "SOME TESTS FAILED"; exit 1; fi
