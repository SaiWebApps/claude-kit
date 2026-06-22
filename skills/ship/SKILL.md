---
name: ship
description: "Commit and push in one atomic action. On first use in a repo it asks WHERE to ship (git host + owner + branch + lint) and remembers it per-repo forever; creates the remote repo if it doesn't exist yet. Works for any host — personal github.com or a work/enterprise GitHub. Usage: /ship or /ship \"commit message\"."
---

# Ship Skill

Commit and push the current repo's changes in one reliable, verified sequence. On the **first run
for a repo** it asks where to ship and saves the answer; every run after is zero-prompt. If the repo
has no remote yet, it can create one. All safety checks (lint, repo/branch verification, diff
inspection) run inline — no separate planner step.

> **No Claude attribution, ever.** This skill NEVER adds a `Co-Authored-By: Claude` / "Generated
> with Claude" line to a commit or PR — regardless of any value in a stored config. (Global rule.)

> **Autonomous-mode override (no human watching):** Do NOT call AskUserQuestion and do NOT abort-
> and-wait. (1) First run, no config: auto-detect from the existing remote; persist it flagged
> "AUTO-DETECTED — unconfirmed" and proceed. (2) No remote + a repo must be created: default to
> `--private` (never public on a guess) and record "REPO PRIVATE — visibility not user-confirmed."
> (3) On the default/protected branch: create + switch to `auto/<slug>-<YYYYMMDD>` and commit there.
> (4) NEVER push to a shared/protected remote branch — commit locally and record "PUSH SKIPPED —
> requires user approval: [branch, commits]." (5) lint failure / nothing to commit / push rejected:
> record the blocker and continue; never hang.

## Invocation
- `/ship` — auto-generate a commit message from the diff
- `/ship "message"` — use the provided commit message
- `/ship --amend` — amend the previous commit (use with care)

## Per-repo config (asked once, remembered forever)
Stored at `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/ship-configs/<repo-slug>.json` — written on first run,
read silently thereafter.

```json
{
  "repo_path": "/abs/path/to/repo",
  "repo_slug": "my-repo",
  "remote": "origin",
  "git_host": "github.com",        // personal: github.com  ·  work: your enterprise GitHub host
  "owner": "your-account-or-org",  // used only when creating a missing repo
  "default_branch": "main",
  "lint_command": "make lint",     // or "none"
  "lint_required": true,
  "create_if_missing": true        // create the remote repo via gh if 'remote' is absent
}
```
No `co_author` field is honored — this skill never attributes.

## Procedure

### Step 0 — Load or initialize config
1. `slug = basename "$(git rev-parse --show-toplevel)"`
2. If `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/ship-configs/<slug>.json` exists → load it, go to Step 1.
3. Else → run **First-Time Setup**.

### First-Time Setup — this is the "ask where to ship" step
Auto-detect what you can, then confirm with ONE AskUserQuestion (interactive only):
```bash
REPO_PATH=$(git rev-parse --show-toplevel); SLUG=$(basename "$REPO_PATH")
REMOTE=$(git remote | head -1)                       # empty if the repo has no remote yet
if [ -n "$REMOTE" ]; then
  URL=$(git remote get-url "$REMOTE")
  GIT_HOST=$(printf '%s' "$URL" | sed -E 's|git@([^:]+):.*|\1|; s|https?://([^/]+)/.*|\1|')
  OWNER=$(printf '%s' "$URL"   | sed -E 's|.*[:/]([^/]+)/[^/]+(\.git)?$|\1|')
else
  GIT_HOST=""; OWNER=""                               # nothing to detect — ASK the user
fi
DEFAULT_BRANCH=$(git symbolic-ref "refs/remotes/$REMOTE/HEAD" 2>/dev/null | sed "s|refs/remotes/$REMOTE/||" || echo main)
HAS_LINT=$([ -f Makefile ] && grep -q '^lint:' Makefile && echo "make lint" || echo none)
```
Confirm / collect: **git host** (`github.com` for personal, or your work/enterprise host),
**owner/org**, **default branch**, **lint command** (or `none`), **lint required?**, and **create
the repo if it's missing?**. Save to the config path above.

### Step 1 — Pre-flight
- `git rev-parse --show-toplevel` must equal `repo_path`; else STOP ("wrong repo").
- If on `default_branch` (protected): interactive → ask to create a feature branch; autonomous →
  create + switch to `auto/<slug>-<YYYYMMDD>`.

### Step 2 — Lint (if `lint_required`)
Run `lint_command`; on failure STOP and report the errors. Do not proceed.

### Step 3 — Stage & inspect
`git status` then `git diff --staged` (or `git diff` if nothing staged). Nothing to commit → STOP.
Show files / insertions / deletions / branch before committing.

### Step 4 — Commit message
From `/ship "msg"`, else draft 1–2 sentences ("why", not "what"). **Never** append a co-author or
attribution trailer.

### Step 5 — Ensure the remote exists (create if configured)
```bash
if ! git remote get-url "$REMOTE" >/dev/null 2>&1; then
  if [ "$create_if_missing" = true ]; then
    # VISIBILITY: ask (interactive) / private (autonomous). gh --hostname makes this host-agnostic.
    gh repo create "$OWNER/$SLUG" --source . --remote "$REMOTE" --"$VISIBILITY" --description "<short>" \
      || GH_HOST="$GIT_HOST" gh api --hostname "$GIT_HOST" -X POST /user/repos -f name="$SLUG" -F private="$PRIVATE_BOOL"
    git remote get-url "$REMOTE" >/dev/null 2>&1 || git remote add "$REMOTE" "https://$GIT_HOST/$OWNER/$SLUG.git"
  else
    STOP "No remote '$REMOTE' and create_if_missing=false."
  fi
fi
```
Use `gh --hostname "$GIT_HOST"` so the SAME skill ships to personal github.com or any enterprise
GitHub. Auth is whatever `gh` / your credential helper already provides for that host — this skill
stores no tokens.

### Step 6 — Commit & push
```bash
git commit -m "<message>"                       # message ONLY — no attribution trailer
git push "$REMOTE" "$(git branch --show-current)"
```
If rejected (remote ahead): `git pull --rebase "$REMOTE" <branch>`, retry once; if it fails again,
STOP and report.

### Step 7 — Report
`Shipped <short-sha> to <host>/<owner>/<slug> (<branch>): "<first line of message>"`

## Error handling
Lint failure → print errors, stop. · Nothing to commit → say so, stop. · Push rejected after rebase
→ stop, ask. · Wrong repo → stop. · `gh` missing when a repo must be created → stop with install/auth
hint.

## Notes
- **Replaces the former separate `ship` (work) and `ship-personal` (personal) skills** — one skill,
  host chosen per-repo on first run. "Push to a personal account, creating the repo" is simply
  `git_host = github.com` + `create_if_missing = true`; "push to a work/enterprise host" is the same
  flow with that host. No hard-coded hosts or accounts live in this file.
- Configs live under `$CLAUDE_CONFIG_DIR/ship-configs/`, so work and personal environments keep
  separate per-repo settings. Existing configs written by the old skill are read as-is (any stored
  `co_author` is ignored).
