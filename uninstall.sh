#!/usr/bin/env bash
# claude-kit uninstaller
# Removes symlinks in ~/.claude/ that point into this repository.
# Only removes symlinks -- never deletes regular files.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_BASE="$HOME/.claude"

REMOVED=0

echo "claude-kit uninstaller"
echo "======================"
echo "Repo: $SCRIPT_DIR"
echo "Scanning: $TARGET_BASE"
echo ""

remove_repo_symlinks() {
  local search_dir="$1"
  local label="$2"

  [[ ! -d "$search_dir" ]] && return

  local found=false
  while IFS= read -r -d '' symlink; do
    local target
    target=$(readlink "$symlink")
    # Check if symlink points into this repo (absolute or relative)
    local resolved
    resolved=$(cd "$(dirname "$symlink")" && realpath "$target" 2>/dev/null || echo "$target")
    if [[ "$resolved" == "$SCRIPT_DIR"* ]]; then
      echo "  Removing: $symlink -> $target"
      rm "$symlink"
      REMOVED=$((REMOVED + 1))
      found=true
    fi
  done < <(find "$search_dir" -maxdepth 1 -type l -print0 2>/dev/null)

  if [[ "$found" == "false" ]]; then
    echo "  (none found)"
  fi
}

echo "Skills:"
remove_repo_symlinks "$TARGET_BASE/skills" "skills"
echo ""

echo "Agents:"
remove_repo_symlinks "$TARGET_BASE/agents" "agents"
echo ""

echo "Hooks:"
remove_repo_symlinks "$TARGET_BASE/hooks" "hooks"
echo ""

echo "======================"
echo "Removed: $REMOVED symlinks"
if [[ $REMOVED -eq 0 ]]; then
  echo "Nothing to remove -- no symlinks point to this repo."
fi
