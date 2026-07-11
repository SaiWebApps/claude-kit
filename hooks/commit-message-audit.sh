#!/usr/bin/env bash
# PreToolUse hook: Audits git commit messages against staged file paths.
# Canonical rule (ENFORCES): CLAUDE.md § Session Hygiene — "every claim in a commit message comes from
#   the diff" (rule h). See docs/rule-map.md.
#
# Problem: Claude writes commit messages from conversation context (what the
# user asked for) rather than from the actual diff.
#
# Configuration:
#   - Set env var COMMIT_AUDIT_TERMS (comma-separated) to define entity terms
#   - Or create .claude-kit/commit-terms.txt (one term per line)
#   - If neither is set, skip entity check (just verify staged files exist)
#
# Protocol:
#   exit 0 + {"decision":"block","reason":"..."} = BLOCK
#   exit 0 = allow

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\t/\\t/g; s/\r/\\r/g' | tr '\n' ' '
}

block() {
  printf '{"decision":"block","reason":"%s"}\n' "$(json_escape "$1")"
  exit 0
}

INPUT=$(cat 2>/dev/null) || true
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null) || true

# Only check git commit commands
if ! echo "$COMMAND" | grep -qE 'git commit'; then
  exit 0
fi

# Extract the commit message from -m flag
MSG=$(echo "$COMMAND" | sed -n "s/.*-m ['\"]\\(.*\\)['\"].*/\\1/p" 2>/dev/null)
# Also try heredoc style
if [[ -z "$MSG" ]]; then
  MSG=$(echo "$COMMAND" | sed -n 's/.*<<.*EOF[[:space:]]*//p; /EOF/q' 2>/dev/null)
fi
[[ -z "$MSG" ]] && exit 0

# Normalize message to lowercase
MSG_LOWER=$(echo "$MSG" | tr '[:upper:]' '[:lower:]')

# Get staged file names
STAGED_FILES=$(git diff --cached --name-only 2>/dev/null)
if [[ -z "$STAGED_FILES" ]]; then
  # Maybe amending -- check HEAD diff
  STAGED_FILES=$(git diff HEAD~1 --name-only 2>/dev/null)
fi
[[ -z "$STAGED_FILES" ]] && exit 0

STAGED_LOWER=$(echo "$STAGED_FILES" | tr '[:upper:]' '[:lower:]')

# Load entity terms from configuration
TERMS=""

# Priority 1: Environment variable (comma-separated)
if [[ -n "${COMMIT_AUDIT_TERMS:-}" ]]; then
  TERMS=$(echo "$COMMIT_AUDIT_TERMS" | tr ',' '\n')
fi

# Priority 2: Project-local config file
if [[ -z "$TERMS" && -f ".claude-kit/commit-terms.txt" ]]; then
  TERMS=$(grep -v '^#' ".claude-kit/commit-terms.txt" | grep -v '^[[:space:]]*$')
fi

# If no terms configured, skip entity check
[[ -z "$TERMS" ]] && exit 0

# Check: if message mentions an entity type, at least one staged file should
# reference it (in filename or path)
ENTITY_MISMATCH=""

while IFS= read -r ENTITY; do
  [[ -z "$ENTITY" ]] && continue
  ENTITY=$(echo "$ENTITY" | xargs)  # trim whitespace
  if echo "$MSG_LOWER" | grep -qiE "\b${ENTITY}\b|${ENTITY}"; then
    # Check if any staged file references this entity
    PATTERN=$(echo "$ENTITY" | sed 's/\./.*/g')
    if ! echo "$STAGED_LOWER" | grep -qiE "$PATTERN"; then
      ENTITY_MISMATCH="${ENTITY_MISMATCH} '${ENTITY}'"
    fi
  fi
done <<< "$TERMS"

if [[ -n "$ENTITY_MISMATCH" ]]; then
  block "BLOCKED: commit message mentions${ENTITY_MISMATCH} but NO staged file references these terms. Your message may describe what you INTENDED to do rather than what you ACTUALLY changed. Run 'git diff --cached --stat' and rewrite the message to match the actual diff. Staged files: $(echo "$STAGED_FILES" | head -10 | tr '\n' ', ')"
fi

exit 0
