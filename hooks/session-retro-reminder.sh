#!/usr/bin/env bash
# PostToolUse hook: SESSION-END REMINDER
# Fires after successful commits to remind about /retro.
# Also detects session-ending signals.
#
# Protocol:
#   exit 0 + {"systemMessage":"..."} = inject reminder
#   exit 0 (no output) = allow silently

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\t/\\t/g; s/\r/\\r/g' | tr '\n' ' '
}

warn() {
  printf '{"systemMessage":"%s"}\n' "$(json_escape "$1")"
  exit 0
}

INPUT=$(cat 2>/dev/null) || true
if [[ -z "$INPUT" ]] || ! echo "$INPUT" | jq empty 2>/dev/null; then
  exit 0
fi

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null) || true
[[ -z "$TOOL_NAME" ]] && exit 0

if [[ "$TOOL_NAME" == "Bash" ]]; then
  COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null) || true
  EXIT_CODE=$(echo "$INPUT" | jq -r '.tool_output.exit_code // "0"' 2>/dev/null) || true

  # After successful git operations: remind about /retro
  GC_PATTERN="git commi""t"
  if echo "$COMMAND" | grep -qE "$GC_PATTERN" && [[ "$EXIT_CODE" == "0" ]]; then
    RETRO_MARKER="/tmp/claude-retro-reminded.txt"
    # Only remind once per session
    if [[ ! -f "$RETRO_MARKER" ]]; then
      date +%s > "$RETRO_MARKER"
      warn "SUCCESSFUL. MANDATORY: Before ending this session, run /retro to document all mistakes and update CLAUDE.md/LEARNINGS.md with new learnings. This is non-negotiable -- every session must end with a retrospective."
    fi
  fi

  # After git push: stronger reminder
  GP_PATTERN="git pus""h"
  if echo "$COMMAND" | grep -qE "$GP_PATTERN" && [[ "$EXIT_CODE" == "0" ]]; then
    warn "PUSH SUCCESSFUL. This looks like the end of a work cycle. Have you run /retro yet? If not, run it NOW before ending the session. Every mistake not documented is a mistake that WILL repeat."
  fi
fi

exit 0
