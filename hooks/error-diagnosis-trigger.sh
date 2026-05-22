#!/usr/bin/env bash
# PostToolUse hook: Triggers the error-diagnosis skill when a Bash command fails.
#
# When a Bash command exits with a non-zero status, this hook injects a system
# message forcing Claude to complete the error-diagnosis checklist before
# proceeding.
#
# Protocol:
#   exit 0 + {"systemMessage":"..."} = inject message into conversation
#   exit 0 (no output) = allow silently

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\t/\\t/g; s/\r/\\r/g' | tr '\n' ' '
}

INPUT=$(cat 2>/dev/null) || true
if [[ -z "$INPUT" ]] || ! echo "$INPUT" | jq empty 2>/dev/null; then
  exit 0
fi

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null) || true
[[ "$TOOL_NAME" != "Bash" ]] && exit 0

EXIT_CODE=$(echo "$INPUT" | jq -r '.tool_output.exit_code // "0"' 2>/dev/null) || true

# Only trigger on non-zero exit codes
[[ "$EXIT_CODE" == "0" || "$EXIT_CODE" == "null" ]] && exit 0

# Don't trigger on common harmless failures (grep no-match, git diff with changes)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null) || true
if echo "$COMMAND" | grep -qE '^(grep|rg|ag|find|git diff|git status)'; then
  exit 0
fi

MSG="BASH COMMAND FAILED (exit code $EXIT_CODE). You MUST complete the error-diagnosis checklist before your next action:

1. COPY the exact error (not paraphrase)
2. LIST 3 possible causes with evidence needed for each
3. EXECUTE one diagnostic command (NOT a retry)
4. STATE root cause with evidence
5. ONLY THEN may you act

DO NOT retry the same command. DO NOT add -v and try again. Run a DIFFERENT diagnostic command that tests a specific hypothesis."

printf '{"systemMessage":"%s"}\n' "$(json_escape "$MSG")"
exit 0
