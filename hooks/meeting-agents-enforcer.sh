#!/usr/bin/env bash
# Meeting Agents Enforcer
#
# BLOCKING hook that ensures /meeting launches the correct number of agents.
#
# How it works:
#   PostToolUse(Skill): When meeting skill fires, create state file expecting N agents
#   PostToolUse(Agent): Increment agent count in state file
#   PreToolUse(*):      If meeting is active and count < N, BLOCK any non-Agent tool call
#
# State file: /tmp/.claude-meeting-pending
#   Line 1: expected count (read from the meeting skill's configuration)
#   Line 2: current count
#
# This hook is BRUTAL. Once /meeting starts, Claude CANNOT do ANYTHING except
# launch Agent calls until all required agents have completed. No reads. No edits. No bash. Nothing.

STATE_FILE="/tmp/.claude-meeting-pending"

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\t/\\t/g; s/\r/\\r/g' | tr '\n' ' '
}

block() {
  local msg="$1"
  printf '{"decision":"block","reason":"%s"}\n' "$(json_escape "$msg")"
  exit 0
}

INPUT=$(cat 2>/dev/null) || true
if [[ -z "$INPUT" ]] || ! echo "$INPUT" | jq empty 2>/dev/null; then
  exit 0
fi

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null) || true
HOOK_TYPE="${CLAUDE_HOOK_TYPE:-}"

# ===================================================================
# PostToolUse(Skill) -- Detect meeting start
# ===================================================================
if [[ "$HOOK_TYPE" == "PostToolUse" && "$TOOL_NAME" == "Skill" ]]; then
  SKILL_NAME=$(echo "$INPUT" | jq -r '.tool_input.skill // empty' 2>/dev/null) || true
  if [[ "$SKILL_NAME" == "meeting" ]]; then
    # Determine expected agent count from the state file if pre-written by the
    # meeting skill, otherwise default to 5
    EXPECTED=5
    if [[ -f "$STATE_FILE" ]]; then
      FIRST_LINE=$(sed -n '1p' "$STATE_FILE")
      if [[ "$FIRST_LINE" =~ ^[0-9]+$ ]]; then
        EXPECTED="$FIRST_LINE"
      fi
    fi
    # Meeting started -- lock Claude into agent-launching mode
    echo "$EXPECTED" > "$STATE_FILE"
    echo "0" >> "$STATE_FILE"
    echo "MEETING STARTED. You MUST now launch EXACTLY $EXPECTED Agent calls before doing ANYTHING else. This is mechanically enforced -- all non-Agent tool calls will be BLOCKED until $EXPECTED agents complete."
    exit 0
  fi
fi

# ===================================================================
# PostToolUse(Agent) -- Count completed agents
# ===================================================================
if [[ "$HOOK_TYPE" == "PostToolUse" && "$TOOL_NAME" == "Agent" ]]; then
  if [[ -f "$STATE_FILE" ]]; then
    EXPECTED=$(sed -n '1p' "$STATE_FILE")
    CURRENT=$(sed -n '2p' "$STATE_FILE")
    NEW_COUNT=$((CURRENT + 1))

    # Update count
    echo "$EXPECTED" > "$STATE_FILE"
    echo "$NEW_COUNT" >> "$STATE_FILE"

    if [[ "$NEW_COUNT" -ge "$EXPECTED" ]]; then
      # All agents done -- remove the lock
      rm -f "$STATE_FILE"
      echo "All $EXPECTED agents have responded. Meeting lock released. Proceed to synthesis."
    else
      REMAINING=$((EXPECTED - NEW_COUNT))
      echo "Agent $NEW_COUNT/$EXPECTED completed. $REMAINING more required. DO NOT proceed to synthesis yet."
    fi
    exit 0
  fi
fi

# ===================================================================
# PreToolUse(*) -- BLOCK non-Agent calls while meeting is pending
# ===================================================================
if [[ "$HOOK_TYPE" == "PreToolUse" ]]; then
  if [[ -f "$STATE_FILE" ]]; then
    EXPECTED=$(sed -n '1p' "$STATE_FILE")
    CURRENT=$(sed -n '2p' "$STATE_FILE")
    REMAINING=$((EXPECTED - CURRENT))

    # Allow Agent calls through
    if [[ "$TOOL_NAME" == "Agent" ]]; then
      exit 0
    fi

    # BLOCK everything else
    block "MEETING IN PROGRESS. $CURRENT/$EXPECTED agents launched. $REMAINING more REQUIRED before you can do anything else. Launch the remaining agents NOW. You are BLOCKED from using $TOOL_NAME until all $EXPECTED agents have completed."
  fi
fi

exit 0
