#!/usr/bin/env bash
# PreToolUse hook: Detect workaround spirals -- repeated edits to the same file section
# If the same file is edited 3+ times in a session, block and require diagnosis

INPUT=$(cat 2>/dev/null) || true
[[ -z "$INPUT" ]] && exit 0

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null) || true

# Only applies to Edit and Write
[[ "$TOOL_NAME" != "Edit" && "$TOOL_NAME" != "Write" ]] && exit 0

FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null) || true
[[ -z "$FILE_PATH" ]] && exit 0

# Only track Makefile and build config edits
case "$FILE_PATH" in
  */Makefile|*/build.sbt|*/build.gradle|*/CMakeLists.txt|*/Podfile)
    ;;
  *)
    exit 0
    ;;
esac

COUNTER_DIR="/tmp/claude-edit-counts"
mkdir -p "$COUNTER_DIR"

# Use filename hash as counter key
FILE_KEY=$(echo "$FILE_PATH" | md5 -q 2>/dev/null || echo "$FILE_PATH" | md5sum | cut -d' ' -f1)
COUNTER_FILE="$COUNTER_DIR/$FILE_KEY"

# Increment counter
COUNT=0
[[ -f "$COUNTER_FILE" ]] && COUNT=$(cat "$COUNTER_FILE")
COUNT=$((COUNT + 1))
echo "$COUNT" > "$COUNTER_FILE"

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\t/\\t/g; s/\r/\\r/g' | tr '\n' ' '
}

if [[ $COUNT -ge 4 ]]; then
  REASON="BLOCKED: WORKAROUND SPIRAL DETECTED. You have edited $(basename "$FILE_PATH") $COUNT times this session. STOP editing and DIAGNOSE: [1] What is the ROOT CAUSE of the failure? [2] Run <tool> --help -- does the tool already have a flag for this? [3] Call /forge to get fresh perspectives. To reset this counter after proper diagnosis, run: rm $COUNTER_FILE"
  printf '{"decision":"block","reason":"%s"}\n' "$(json_escape "$REASON")"
  exit 0
fi

if [[ $COUNT -ge 3 ]]; then
  MSG="WARNING: You have edited $(basename "$FILE_PATH") $COUNT times. One more edit triggers the workaround-spiral block. Are you recycling the same broken approach? Consider: [1] Diagnose the root cause [2] Run --help on the tool [3] Call /forge for fresh perspectives."
  printf '{"systemMessage":"%s"}\n' "$(json_escape "$MSG")"
  exit 0
fi

exit 0
