#!/usr/bin/env bash
# hooks-smoke.sh — proves the guard hooks fire on the tool events they're registered for,
# and that harness/examples/settings.json wires each hook to the events its script handles.
# This is the regression guard for the "dead hooks" bug: prevent-laziness's Bash logic was
# unreachable (registered Write|Edit only) and workaround-spiral no-op'd (registered Bash only).
#
#   Run:  bash hooks/hooks-smoke.sh    (needs jq; same dependency as the hooks themselves)
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SETTINGS="$SCRIPT_DIR/../harness/examples/settings.json"
PL="$SCRIPT_DIR/prevent-laziness.sh"
WS="$SCRIPT_DIR/workaround-spiral-detector.sh"
pass=0; fail=0
ok(){ echo "PASS  $1"; pass=$((pass+1)); }
no(){ echo "FAIL  $1"; fail=$((fail+1)); }

command -v jq >/dev/null || { echo "SKIP  jq not installed — hooks require it at runtime too"; exit 0; }

# 0. every registered hook must be EXECUTABLE — install.sh symlinks them and settings.json invokes them
#    by BARE PATH (no `bash` prefix), so a lost exec bit silently disables the hook. Regression guard.
for hk in "$PL" "$WS" "$SCRIPT_DIR/commit-message-audit.sh" "$SCRIPT_DIR/error-diagnosis-trigger.sh" "$SCRIPT_DIR/session-retro-reminder.sh"; do
  [[ -x "$hk" ]] && ok "executable: $(basename "$hk")" || no "NOT executable: $(basename "$hk") — Claude Code runs hooks by bare path; chmod +x it"
done

# isolate the spiral counter so repeated runs are deterministic
rm -rf /tmp/claude-edit-counts /tmp/claude-bash-retries 2>/dev/null || true
WORK="$(mktemp -d)"; cd "$WORK"   # no Makefile here → Makefile-enforcement path is skipped

# 1. prevent-laziness, BASH branch is REACHED and blocks a dangerous command (the core of the fix).
#    Invoke by BARE PATH (as Claude Code + install.sh's symlink do) so a lost exec bit fails this test.
out=$(printf '{"tool_name":"Bash","tool_input":{"command":"git add -A"}}' | "$PL")
echo "$out" | grep -q '"decision":"block"' && ok "prevent-laziness blocks 'git add -A' on a Bash event" \
  || no "prevent-laziness did NOT block 'git add -A' (Bash branch unreachable?) got: $out"

# 2. prevent-laziness does NOT over-block a benign Bash command
out=$(printf '{"tool_name":"Bash","tool_input":{"command":"ls -la"}}' | bash "$PL")
[[ -z "$out" ]] && ok "prevent-laziness allows benign 'ls -la'" \
  || no "prevent-laziness wrongly blocked 'ls -la' got: $out"

# 3. prevent-laziness, EDIT branch blocks a stub implementation
out=$(printf '{"tool_name":"Edit","tool_input":{"file_path":"/tmp/x.py","new_string":"def f():\\n    raise NotImplementedError"}}' | bash "$PL")
echo "$out" | grep -q '"decision":"block"' && ok "prevent-laziness blocks a NotImplementedError stub on an Edit event" \
  || no "prevent-laziness did NOT block a stub got: $out"

# 4. workaround-spiral, EDIT branch is REACHED: 4th edit of the same Makefile blocks (the core of the fix)
mkpath="$WORK/Makefile"
for i in 1 2 3; do printf '{"tool_name":"Edit","tool_input":{"file_path":"%s"}}' "$mkpath" | bash "$WS" >/dev/null; done
out=$(printf '{"tool_name":"Edit","tool_input":{"file_path":"%s"}}' "$mkpath" | bash "$WS")
echo "$out" | grep -q '"decision":"block"' && ok "workaround-spiral blocks the 4th Makefile edit on an Edit event" \
  || no "workaround-spiral did NOT block the 4th edit (Edit branch unreachable?) got: $out"

# 5. workaround-spiral correctly IGNORES a Bash event (why it must NOT be wired to Bash alone)
out=$(printf '{"tool_name":"Bash","tool_input":{"command":"make test"}}' | bash "$WS")
[[ -z "$out" ]] && ok "workaround-spiral no-ops on a Bash event (handles only Edit/Write)" \
  || no "workaround-spiral unexpectedly acted on a Bash event got: $out"

# 6..8. settings.json wires each hook to the events its script actually handles
pl_match=$(jq -r '.hooks.PreToolUse[] | select(.hooks[].command|test("prevent-laziness")) | .matcher' "$SETTINGS")
echo "$pl_match" | grep -q 'Bash' && echo "$pl_match" | grep -q 'Write' && echo "$pl_match" | grep -q 'Edit' \
  && ok "settings.json registers prevent-laziness on Bash|Write|Edit (was: Write|Edit — Bash logic was dead)" \
  || no "settings.json prevent-laziness matcher is '$pl_match' — must include Bash, Write, Edit"

ws_match=$(jq -r '.hooks.PreToolUse[] | select(.hooks[].command|test("workaround-spiral")) | .matcher' "$SETTINGS")
[[ "$ws_match" == "Write|Edit" ]] \
  && ok "settings.json registers workaround-spiral on Write|Edit (was: Bash — it no-op'd)" \
  || no "settings.json workaround-spiral matcher is '$ws_match' — must be Write|Edit"

cm_match=$(jq -r '.hooks.PreToolUse[] | select(.hooks[].command|test("commit-message-audit")) | .matcher' "$SETTINGS")
[[ "$cm_match" == "Bash" ]] \
  && ok "settings.json registers commit-message-audit on Bash" \
  || no "settings.json commit-message-audit matcher is '$cm_match' — must be Bash"

# 9. escalation ladder R4 (bash-retry): the 5th identical 'make test' is BLOCKED by prevent-laziness
rm -rf /tmp/claude-bash-retries 2>/dev/null || true
for i in 1 2 3 4; do printf '{"tool_name":"Bash","tool_input":{"command":"make test"}}' | bash "$PL" >/dev/null; done
out=$(printf '{"tool_name":"Bash","tool_input":{"command":"make test"}}' | bash "$PL")
echo "$out" | grep -q '"decision":"block"' && ok "ladder R4: prevent-laziness blocks the 5th identical 'make test'" \
  || no "ladder R4: 5th 'make test' was NOT blocked (bash-retry threshold drifted?) got: $out"

# 10. escalation ladder R3 (edit-spiral): the 3rd same-Makefile edit WARNS before the block at 4
rm -rf /tmp/claude-edit-counts 2>/dev/null || true
mk2="$WORK/Makefile"
for i in 1 2; do printf '{"tool_name":"Edit","tool_input":{"file_path":"%s"}}' "$mk2" | bash "$WS" >/dev/null; done
out=$(printf '{"tool_name":"Edit","tool_input":{"file_path":"%s"}}' "$mk2" | bash "$WS")
echo "$out" | grep -q '"systemMessage"' && ok "ladder R3: workaround-spiral warns on the 3rd same-Makefile edit" \
  || no "ladder R3: 3rd Makefile edit did NOT warn (edit-spiral threshold drifted?) got: $out"

cd / ; rm -rf "$WORK" /tmp/claude-edit-counts /tmp/claude-bash-retries 2>/dev/null || true
echo ""
echo "hooks-smoke: $pass passed, $fail failed"
[[ $fail -eq 0 ]] || exit 1
