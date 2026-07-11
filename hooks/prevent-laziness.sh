#!/usr/bin/env bash
# PreToolUse hook: UNIVERSAL Makefile enforcement + dangerous pattern blocking.
# Canonical rules (ENFORCES, does not redefine): CLAUDE.md § Build Discipline (make-first = rule a),
#   § Effort Standards (0 fail/0 skip = rule b), no-stubs = rule g. Ladder R3/R4 bash-retry warn@4/block@5.
#   Rule -> home map: docs/rule-map.md.
#
# Detects when Claude tries to cut corners: raw commands instead of Makefile
# targets, dangerous operations, placeholder code, and other laziness signals.
#
# Protocol:
#   exit 0 + {"decision":"block","reason":"..."} = BLOCK the tool call
#   exit 0 (no output) = allow silently

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\t/\\t/g; s/\r/\\r/g' | tr '\n' ' '
}

block() {
  local msg="$1"
  [[ -n "${2:-}" ]] && msg="$msg $2"
  msg="$msg DO NOT tell the user to run this command. Diagnose WHY you were blocked and try a different approach."
  printf '{"decision":"block","reason":"%s"}\n' "$(json_escape "$msg")"
  exit 0
}

INPUT=$(cat 2>/dev/null) || true

if [[ -z "$INPUT" ]] || ! echo "$INPUT" | jq empty 2>/dev/null; then
  exit 0
fi

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null) || true
[[ -z "$TOOL_NAME" ]] && exit 0

# --- Bash command checks ---
if [[ "$TOOL_NAME" == "Bash" ]]; then
  COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null) || true
  [[ -z "$COMMAND" ]] && exit 0

  # DANGEROUS PATTERNS

  # ANTI-EVASION: Protect hook-managed enforcement markers from tampering.
  MARKER_CMD_CHECK=""
  if echo "$COMMAND" | grep -qE "(/tmp/claude-|/tmp/\.claude-)"; then
    MARKER_CMD_CHECK="yes"
  fi
  if [[ "$MARKER_CMD_CHECK" == "yes" ]]; then
    # Allow proof-of-work markers that Claude is supposed to write
    if echo "$COMMAND" | grep -qE "(planner-checklist|research-done|build-chain-verified)"; then
      true  # allowed
    # Allow resetting edit counters (workaround-spiral-detector tells Claude to do this)
    elif echo "$COMMAND" | grep -qE "rm.*/tmp/claude-edit-counts/"; then
      true  # allowed -- spiral detector instructs this reset after diagnosis
    # Allow resetting bash retry counters
    elif echo "$COMMAND" | grep -qE "rm.*/tmp/claude-bash-retries/"; then
      true  # allowed -- retry spiral detector reset
    elif echo "$COMMAND" | grep -qE "(rm|mv|truncate|>|>>).*(/tmp/claude-|/tmp/\.claude-)"; then
      block "BLOCKED: Attempt to tamper with hook enforcement markers." "These files are managed by hooks. Complete the required action to clear them naturally."
    elif echo "$COMMAND" | grep -qE "echo.*>.*(/tmp/claude-|/tmp/\.claude-)"; then
      block "BLOCKED: Attempt to write directly to hook enforcement markers." "Complete the required action to clear them naturally."
    fi
  fi

  # Bash retry spiral detector -- block repeated test/build commands
  if echo "$COMMAND" | grep -qE '^(make\s+(test|lint|build|dev)|npm\s+(test|run\s+test))'; then
    BASH_COUNTER_DIR="/tmp/claude-bash-retries"
    mkdir -p "$BASH_COUNTER_DIR"
    CMD_KEY=$(echo "$COMMAND" | md5 -q 2>/dev/null || echo "$COMMAND" | md5sum | cut -d' ' -f1)
    BASH_COUNTER_FILE="$BASH_COUNTER_DIR/$CMD_KEY"
    BASH_COUNT=0
    [[ -f "$BASH_COUNTER_FILE" ]] && BASH_COUNT=$(cat "$BASH_COUNTER_FILE")
    BASH_COUNT=$((BASH_COUNT + 1))
    echo "$BASH_COUNT" > "$BASH_COUNTER_FILE"
    if [[ $BASH_COUNT -ge 5 ]]; then
      block "BLOCKED: RETRY SPIRAL. You have run this command $BASH_COUNT times." "STOP retrying. Diagnose the root cause. State your hypothesis. Try a DIFFERENT diagnostic command. To reset after proper diagnosis: rm $BASH_COUNTER_FILE"
    fi
    if [[ $BASH_COUNT -ge 4 ]]; then
      printf '{"systemMessage":"WARNING: You have run this command %d times. One more triggers the retry-spiral block. Diagnose the root cause NOW."}\n' "$BASH_COUNT"
      exit 0
    fi
  fi

  if echo "$COMMAND" | grep -qE 'git\s+add\s+(-A|--all|\.)(\s|$)'; then
    block "BLOCKED: git add -A / git add . stages everything blindly." "Stage specific files by name instead."
  fi

  GC_WORD="commi""t"
  if echo "$COMMAND" | grep -qE "git\s+($GC_WORD|push).*--no-verify"; then
    block "BLOCKED: --no-verify skips hooks." "Fix the underlying issue instead of bypassing."
  fi

  if echo "$COMMAND" | grep -qE 'git\s+push\s+.*(--force|-f)(\s|$)' && ! echo "$COMMAND" | grep -q 'force-with-lease'; then
    block "BLOCKED: git push --force can destroy remote history." "Use --force-with-lease."
  fi

  if echo "$COMMAND" | grep -qE 'git\s+reset\s+--hard'; then
    block "BLOCKED: git reset --hard discards work." "Stash first."
  fi

  if echo "$COMMAND" | grep -qE 'rm\s+-rf\s+(\.|/|~|\$HOME|\.git)'; then
    block "BLOCKED: rm -rf on a broad path is dangerous." "Be specific."
  fi

  # Block deletion of test files
  if echo "$COMMAND" | grep -qE '(rm|git\s+rm)\s.*\.(test|spec)\.(ts|tsx|js|jsx|mjs)'; then
    block "BLOCKED: Deleting test files is forbidden." "Tests are NEVER deleted. Ask the user for explicit approval."
  fi
  if echo "$COMMAND" | grep -qE '(rm|git\s+rm)\s.*__tests__'; then
    block "BLOCKED: Deleting test directories is forbidden." "Tests are NEVER deleted. Ask the user for explicit approval."
  fi

  if echo "$COMMAND" | grep -qE 'sleep\s+([6-9]|[1-9][0-9]+)'; then
    block "BLOCKED: Long sleep detected." "Use run_in_background or keep sleep under 5s."
  fi

  if echo "$COMMAND" | grep -qE '(-DskipTests|--skip-tests|-Dmaven\.test\.skip)'; then
    block "BLOCKED: Skipping tests." "If tests fail, fix them."
  fi

  if echo "$COMMAND" | grep -qE '(curl|wget).*\|\s*(ba)?sh'; then
    block "BLOCKED: Piping download to shell is unsafe." "Download first, inspect, then run."
  fi

  if echo "$COMMAND" | grep -qE 'pytest.*--ignore|pytest.*-k\s+"not\s'; then
    block "BLOCKED: Skipping tests." "Run the FULL suite."
  fi

  if echo "$COMMAND" | grep -qE '(for|while).*retry|until.*success'; then
    block "BLOCKED: Retry loop." "Follow diagnosis protocol."
  fi

  if echo "$COMMAND" | grep -qE 'make\s+lint\s*.*\|\s*(tail|head)\s'; then
    block "BLOCKED: Do not pipe make lint through tail/head." "See ALL errors."
  fi

  # UNIVERSAL MAKEFILE ENFORCEMENT

  # Already using make -- allow
  if echo "$COMMAND" | grep -qE '(^|\s|&&|;)make\s'; then
    exit 0
  fi

  # No Makefile = no enforcement
  [[ ! -f "Makefile" ]] && exit 0

  # Extract real command (strip wrappers)
  STRIPPED=$(echo "$COMMAND" | sed 's/^[[:space:]]*\([A-Za-z_][A-Za-z_0-9]*=[^[:space:]]* \)*//')
  REAL_CMD=""
  set -- $STRIPPED
  while [[ $# -gt 0 ]]; do
    case "$1" in
      uv)      shift; [[ "${1:-}" == "run" ]] && shift; REAL_CMD="${1:-}"; break ;;
      python3|python) shift; [[ "${1:-}" == "-m" ]] && shift; REAL_CMD="${1:-}"; break ;;
      npx)     shift; REAL_CMD="${1:-}"; break ;;
      poetry)  shift; [[ "${1:-}" == "run" ]] && shift; REAL_CMD="${1:-}"; break ;;
      bundle)  shift; [[ "${1:-}" == "exec" ]] && shift; REAL_CMD="${1:-}"; break ;;
      *)       REAL_CMD="$1"; break ;;
    esac
  done

  [[ -z "$REAL_CMD" ]] && exit 0
  REAL_CMD=$(basename "$REAL_CMD" 2>/dev/null || echo "$REAL_CMD")

  # Allowlist: introspection/filesystem commands
  case "$REAL_CMD" in
    ls|find|grep|rg|ag|ack|cat|head|tail|less|more|bat|wc|du|df) exit 0 ;;
    pwd|echo|printf|true|false|test|file|stat|which|type|command) exit 0 ;;
    printenv|date|uname|whoami|id|hostname|chmod|chown) exit 0 ;;
    mkdir|touch|cp|mv|rm|ln|diff|comm|sort|uniq|cut|tr|sed|awk) exit 0 ;;
    jq|yq|column|tee|git|make|cd|source|read|set|unset) exit 0 ;;
    kill|lsof|ps|top|htop|open|pbcopy|pbpaste|xargs) exit 0 ;;
    tar|zip|unzip|gzip|gunzip|curl|wget|ssh|scp|rsync) exit 0 ;;
    brew|port|apt|yum|dnf|snap) exit 0 ;;
    python3|python) exit 0 ;;
  esac

  # Awk: find which target's recipe contains this command as a standalone word
  TARGET=$(awk -v cmd="$REAL_CMD" '
    BEGIN {
      boundary = "[^a-zA-Z0-9_./-]"
      pattern = "(^|" boundary ")" cmd "($|" boundary ")"
    }
    /^[a-zA-Z_][a-zA-Z0-9_-]*[[:space:]]*:/ {
      gsub(/[[:space:]]*:.*/, "")
      current = $0
    }
    /^\t/ && current != "" && !/^\t.*@?echo/ && !/^\t.*@?printf/ && !/^\t[[:space:]]*#/ {
      if (match($0, pattern)) {
        print current
        exit
      }
    }
  ' Makefile)

  if [[ -n "$TARGET" ]]; then
    block "BLOCKED: Raw '$REAL_CMD' detected. Use 'make $TARGET' instead." "The Makefile wraps this command."
  fi

  # Notable commands: block even without a Makefile target
  case "$REAL_CMD" in
    pytest|ruff|mypy|black|isort|flake8|pylint|bandit) ;;
    alembic|flask|uvicorn|gunicorn|celery) ;;
    npm|yarn|pnpm|node|tsc|webpack|vite|rollup|esbuild|parcel) ;;
    jest|vitest|mocha|eslint|prettier|stylelint) ;;
    next|nuxt|gatsby|remix|astro) ;;
    docker|docker-compose|kubectl|helm|terraform|ansible|pulumi) ;;
    pip|pipx|poetry|pdm|hatch) ;;
    cargo|rustc|clippy) ;;
    go) ;;
    sbt|gradle|gradlew|mvn|ant) ;;
    flutter|dart|pod|xcodebuild|swift|swiftc) ;;
    render|vercel|netlify|fly|railway) ;;
    *) exit 0 ;;
  esac

  block "BLOCKED: No Makefile target wraps '$REAL_CMD'." "Add a target first, then use 'make <target>'."
fi

# --- Background checks ---
if [[ "$TOOL_NAME" == "Bash" ]]; then
  RUN_BG=$(echo "$INPUT" | jq -r '.tool_input.run_in_background // false' 2>/dev/null) || true
  COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null) || true
  if [[ "$RUN_BG" == "true" ]]; then
    if echo "$COMMAND" | grep -qE '^make\s+test(\s|$)'; then
      block "BLOCKED: Never run 'make test' in background." "Run in foreground."
    fi
  fi
fi

# --- Edit/Write checks ---
if [[ "$TOOL_NAME" == "Edit" || "$TOOL_NAME" == "Write" ]]; then
  FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null) || true

  # Block editing package.json test scripts (reduces test coverage)
  if echo "$FILE_PATH" | grep -qE "package\.json$"; then
    OLD_CONTENT=""
    if [[ "$TOOL_NAME" == "Edit" ]]; then
      OLD_CONTENT=$(echo "$INPUT" | jq -r '.tool_input.old_string // empty' 2>/dev/null) || true
    fi
    if printf '%s\n' "$OLD_CONTENT" | grep -qE '"(test|test:unit|test:e2e|jest)"'; then
      block "BLOCKED: Modifying test scripts in package.json." "Test scripts are infrastructure -- do not change what tests run. Fix the tests instead."
    fi
  fi

  NEW_CONTENT=""
  if [[ "$TOOL_NAME" == "Edit" ]]; then
    NEW_CONTENT=$(echo "$INPUT" | jq -r '.tool_input.new_string // empty' 2>/dev/null) || true
  elif [[ "$TOOL_NAME" == "Write" ]]; then
    NEW_CONTENT=$(echo "$INPUT" | jq -r '.tool_input.content // empty' 2>/dev/null) || true
  fi

  # Block silent error suppression in Makefiles
  if echo "$FILE_PATH" | grep -qE "(M|m)akefile"; then
    if printf '%s\n' "$NEW_CONTENT" | grep -qE '2>/dev/null \|\| true|\|\| true$'; then
      block "BLOCKED: Silent error suppression in Makefile." "Use '|| (echo ERROR: ...; exit 1)' so failures are visible."
    fi
  fi

  # Placeholder detection (split strings to avoid self-trigger)
  P1="TO""DO"
  P2="FIX""ME"
  P3="HA""CK"
  P4="X""XX"
  if printf '%s\n' "$NEW_CONTENT" | grep -qiE "($P1|$P2|$P3|$P4)\b"; then
    block "BLOCKED: Writing placeholder comments." "Finish the implementation now."
  fi

  if printf '%s\n' "$NEW_CONTENT" | grep -qE '(catch\s*\{?\s*\}|except.*:\s*pass)'; then
    block "BLOCKED: Empty catch/except block." "Handle the error or let it propagate."
  fi

  # Stub detection (split to avoid self-trigger)
  NI1="raise Not"
  NI2="ImplementedError"
  if printf '%s\n' "$NEW_CONTENT" | grep -qE "${NI1}${NI2}"; then
    block "BLOCKED: Stub implementation." "Implement fully."
  fi

  # Lint suppression detection (split to avoid self-trigger)
  L1="# no""qa"
  L2="// noinsp""ection"
  L3="eslint""-disable"
  L4="@Suppress""Warnings"
  if printf '%s\n' "$NEW_CONTENT" | grep -qE "($L1|$L2|$L3|$L4)"; then
    block "BLOCKED: Disabling a lint rule." "Fix the code instead."
  fi

  # Block test-skipping patterns in test files
  if echo "$FILE_PATH" | grep -qE '\.(test|spec)\.(ts|tsx|js|jsx|mjs)$'; then
    if printf '%s\n' "$NEW_CONTENT" | grep -qE '\b(describe\.skip|it\.skip|test\.skip|xdescribe|xit|xtest|pending)\b'; then
      block "BLOCKED: Adding skip/pending to test file." "Fix the failing test instead of skipping it. If truly obsolete, ask the user."
    fi
  fi
fi

exit 0
