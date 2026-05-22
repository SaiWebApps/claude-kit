---
name: ship
description: "Commit and push in one atomic action. Auto-detects repo config on first use, remembers it for later. Replaces the multi-agent planner ceremony with inline verification. Usage: /ship or /ship \"commit message\""
---

# Ship Skill

Commit and push the current changes in one reliable sequence. Performs all safety checks (lint, repo verification, diff inspection) inline — no separate Planner agent needed.

## Invocation

- `/ship` — auto-generate commit message from diff
- `/ship "message"` — use provided commit message
- `/ship --amend` — amend the previous commit (use with care)

## Config

Per-repo config is stored in `~/.config/claude-kit/ship/<repo-slug>.json`. On first run for a repo, the skill auto-detects settings and asks the user to confirm.

Config schema:
```json
{
  "repo_path": "/path/to/your/repo",
  "repo_slug": "my-project",
  "remote": "origin",
  "git_host": "github.com",
  "default_branch": "main",
  "lint_command": "make lint",
  "lint_required": true,
  "co_author": "Co-Authored-By: Claude <noreply@anthropic.com>"
}
```

The `co_author` field is configurable. Set it to any attribution line you prefer, or set it to `null` to disable the co-author trailer entirely.

## Procedure

### Step 0: Load or Initialize Config

1. Compute repo slug from `basename $(git rev-parse --show-toplevel)`
2. Check if `~/.config/claude-kit/ship/<slug>.json` exists
3. If NOT: run **First-Time Setup** (see below)
4. If YES: load config and proceed

### First-Time Setup

Auto-detect, then ask the user to confirm:

```bash
# Detect values
REPO_PATH=$(git rev-parse --show-toplevel)
REPO_SLUG=$(basename "$REPO_PATH")
REMOTE=$(git remote | head -1)
GIT_HOST=$(git remote get-url "$REMOTE" | sed -E 's|.*[@/]([^:/]+)[:/].*|\1|')
DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/$REMOTE/HEAD 2>/dev/null | sed "s|refs/remotes/$REMOTE/||" || echo "main")
HAS_LINT=$([ -f Makefile ] && grep -q "^lint:" Makefile && echo "make lint" || echo "none")
```

Present detected values to the user with AskUserQuestion:
- Git host (defaults to `github.com`)
- Default/base branch
- Lint command (or "none")
- Whether lint is required before every commit
- Co-author line (default: `Co-Authored-By: Claude <noreply@anthropic.com>`, or `null` to disable)

Save confirmed values to `~/.config/claude-kit/ship/<slug>.json`.

### Step 1: Pre-flight Checks

```bash
# Verify repo
CURRENT_REPO=$(git rev-parse --show-toplevel)
if [ "$CURRENT_REPO" != "$CONFIG_REPO_PATH" ]; then
  ABORT: "Wrong repo. Expected $CONFIG_REPO_PATH, got $CURRENT_REPO"
fi

# Verify branch is not the default/protected branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" = "$DEFAULT_BRANCH" ]; then
  ABORT: "You're on $DEFAULT_BRANCH. Create a feature branch first."
fi
```

### Step 2: Lint (if configured)

```bash
if [ "$LINT_REQUIRED" = true ]; then
  eval "$LINT_COMMAND"
  # If lint fails, STOP. Report errors. Do not proceed.
fi
```

### Step 3: Stage and Inspect

```bash
git status
git diff --staged  # or git diff if nothing staged yet
```

- If nothing to commit, ABORT with message.
- If there are unstaged changes but nothing staged, ask user what to stage.
- Show the user a summary: files changed, insertions/deletions, branch name.

### Step 4: Commit Message

- If user provided a message via `/ship "message"`, use it.
- Otherwise, draft a message from the diff (1-2 sentences, "why" not "what").
- If co_author is configured (non-null), append the co-author line.

### Step 5: Commit

```bash
# Commit (with or without co-author depending on config)
git commit -m "<message>

<co_author line if configured>"
```

### Step 6: Push

```bash
git push $REMOTE $CURRENT_BRANCH
```

- If rejected (remote ahead), run `git pull --rebase $REMOTE $CURRENT_BRANCH` then retry push once.
- If push fails again, STOP and report.

### Step 7: Report

Print a one-line summary:
```
Shipped <short-sha> to <remote>/<branch>: "<first line of commit message>"
```

## Error Handling

- Lint failure: print errors, stop, suggest fix
- Nothing to commit: say so, stop
- Push rejected after rebase: stop, ask user
- Merge conflicts during rebase: stop, ask user
- Wrong repo detected: stop immediately

## Important

- NEVER skip the verification steps. The whole point is that they run every time, atomically.
- If the config file is missing or corrupted, re-run First-Time Setup.
- The co-author line is configurable per-repo — users can set their preferred attribution or disable it entirely.
