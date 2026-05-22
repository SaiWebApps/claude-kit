#!/usr/bin/env bash
# claude-kit installer
# Symlinks skills, agents, hooks, and pattern examples into ~/.claude/
#
# Usage:
#   ./install.sh [--all|--skills-only|--agents-only|--hooks-only|--patterns-only]
#                [--dry-run] [--force]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_BASE="$HOME/.claude"

# Defaults
INSTALL_SKILLS=false
INSTALL_AGENTS=false
INSTALL_HOOKS=false
INSTALL_PATTERNS=false
DRY_RUN=false
FORCE=false
COMPONENT_SELECTED=false

# Parse flags
while [[ $# -gt 0 ]]; do
  case "$1" in
    --all)
      INSTALL_SKILLS=true
      INSTALL_AGENTS=true
      INSTALL_HOOKS=true
      INSTALL_PATTERNS=true
      COMPONENT_SELECTED=true
      ;;
    --skills-only)
      INSTALL_SKILLS=true
      COMPONENT_SELECTED=true
      ;;
    --agents-only)
      INSTALL_AGENTS=true
      COMPONENT_SELECTED=true
      ;;
    --hooks-only)
      INSTALL_HOOKS=true
      COMPONENT_SELECTED=true
      ;;
    --patterns-only)
      INSTALL_PATTERNS=true
      COMPONENT_SELECTED=true
      ;;
    --dry-run)
      DRY_RUN=true
      ;;
    --force)
      FORCE=true
      ;;
    -h|--help)
      echo "Usage: $0 [--all|--skills-only|--agents-only|--hooks-only|--patterns-only] [--dry-run] [--force]"
      echo ""
      echo "Flags:"
      echo "  --all            Install everything (default if no component flags given)"
      echo "  --skills-only    Only install skills"
      echo "  --agents-only    Only install agents"
      echo "  --hooks-only     Only install hooks"
      echo "  --patterns-only  Only install pattern examples"
      echo "  --dry-run        Show what would be done without doing it"
      echo "  --force          Overwrite existing files/symlinks that conflict"
      exit 0
      ;;
    *)
      echo "Unknown flag: $1"
      exit 1
      ;;
  esac
  shift
done

# If no component flag was given, install all (default behavior)
if [[ "$COMPONENT_SELECTED" == "false" ]]; then
  INSTALL_SKILLS=true
  INSTALL_AGENTS=true
  INSTALL_HOOKS=true
  INSTALL_PATTERNS=true
fi

# Counters
INSTALLED=0
SKIPPED=0
FORCED=0

# Create target directories
ensure_dir() {
  local dir="$1"
  if [[ "$DRY_RUN" == "true" ]]; then
    if [[ ! -d "$dir" ]]; then echo "[dry-run] mkdir -p $dir"; fi
  else
    mkdir -p "$dir"
  fi
}

# Create a symlink, handling conflicts
create_symlink() {
  local source="$1"
  local target="$2"

  if [[ -L "$target" ]]; then
    local existing_target
    existing_target=$(readlink "$target")
    if [[ "$existing_target" == "$source" ]]; then
      # Already correct -- no action needed
      return 0
    fi
    # Symlink exists but points elsewhere
    if [[ "$FORCE" == "true" ]]; then
      if [[ "$DRY_RUN" == "true" ]]; then
        echo "[dry-run] FORCE: rm $target && ln -s $source $target"
      else
        rm "$target"
        ln -s "$source" "$target"
        echo "  FORCED: $target -> $source"
      fi
      FORCED=$((FORCED + 1))
      return 0
    else
      echo "  CONFLICT: $target exists (points to $existing_target), skipping. Use --force to overwrite."
      SKIPPED=$((SKIPPED + 1))
      return 1
    fi
  elif [[ -e "$target" ]]; then
    # Regular file/directory exists
    if [[ "$FORCE" == "true" ]]; then
      if [[ "$DRY_RUN" == "true" ]]; then
        echo "[dry-run] FORCE: rm -rf $target && ln -s $source $target"
      else
        rm -rf "$target"
        ln -s "$source" "$target"
        echo "  FORCED: $target -> $source"
      fi
      FORCED=$((FORCED + 1))
      return 0
    else
      echo "  CONFLICT: $target exists (regular file/dir), skipping. Use --force to overwrite."
      SKIPPED=$((SKIPPED + 1))
      return 1
    fi
  fi

  # Target does not exist -- create symlink
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[dry-run] ln -s $source $target"
  else
    ln -s "$source" "$target"
    echo "  OK: $target -> $source"
  fi
  INSTALLED=$((INSTALLED + 1))
  return 0
}

echo "claude-kit installer"
echo "===================="
echo "Source: $SCRIPT_DIR"
echo "Target: $TARGET_BASE"
[[ "$DRY_RUN" == "true" ]] && echo "MODE: dry-run (no changes will be made)"
[[ "$FORCE" == "true" ]] && echo "MODE: force (conflicts will be overwritten)"
echo ""

# --- Skills ---
if [[ "$INSTALL_SKILLS" == "true" ]]; then
  echo "Installing skills..."
  ensure_dir "$TARGET_BASE/skills"

  if [[ -d "$SCRIPT_DIR/skills" ]]; then
    for skill_dir in "$SCRIPT_DIR/skills"/*/; do
      [[ ! -d "$skill_dir" ]] && continue
      skill_name=$(basename "$skill_dir")
      create_symlink "$skill_dir" "$TARGET_BASE/skills/$skill_name" || true
    done
  fi
  echo ""
fi

# --- Agents ---
if [[ "$INSTALL_AGENTS" == "true" ]]; then
  echo "Installing agents..."
  ensure_dir "$TARGET_BASE/agents"

  if [[ -d "$SCRIPT_DIR/agents" ]]; then
    for agent_file in "$SCRIPT_DIR/agents"/*.md; do
      [[ ! -f "$agent_file" ]] && continue
      agent_name=$(basename "$agent_file")
      create_symlink "$agent_file" "$TARGET_BASE/agents/$agent_name" || true
    done
  fi
  echo ""
fi

# --- Hooks ---
if [[ "$INSTALL_HOOKS" == "true" ]]; then
  echo "Installing hooks..."
  ensure_dir "$TARGET_BASE/hooks"

  if [[ -d "$SCRIPT_DIR/hooks" ]]; then
    for hook_file in "$SCRIPT_DIR/hooks"/*.sh; do
      [[ ! -f "$hook_file" ]] && continue
      hook_name=$(basename "$hook_file")
      create_symlink "$hook_file" "$TARGET_BASE/hooks/$hook_name" || true
    done
  fi
  echo ""
fi

# --- Patterns (example skills only) ---
if [[ "$INSTALL_PATTERNS" == "true" ]]; then
  echo "Installing pattern examples..."
  ensure_dir "$TARGET_BASE/skills"

  if [[ -d "$SCRIPT_DIR/patterns" ]]; then
    for pattern_dir in "$SCRIPT_DIR/patterns"/*/; do
      [[ ! -d "$pattern_dir" ]] && continue
      for example_dir in "$pattern_dir"example-*/; do
        [[ ! -d "$example_dir" ]] && continue
        example_name=$(basename "$example_dir")
        create_symlink "$example_dir" "$TARGET_BASE/skills/$example_name" || true
      done
    done
  fi
  echo ""
fi

# --- Ensure supporting directories exist ---
ensure_dir "$TARGET_BASE/agent-memory"
ensure_dir "$TARGET_BASE/feedback"

# --- Summary ---
echo "===================="
echo "Summary:"
echo "  Installed: $INSTALLED"
echo "  Skipped (conflicts): $SKIPPED"
echo "  Forced: $FORCED"
if [[ "$DRY_RUN" == "true" ]]; then
  echo ""
  echo "This was a dry run. No changes were made."
  echo "Run without --dry-run to apply."
fi
