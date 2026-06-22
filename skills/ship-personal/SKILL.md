---
name: ship-personal
description: "Push the current project to personal GitHub. Creates the repo if needed. Invoke with '/ship-personal' (uses directory name) or '/ship-personal <repo-name>'. Handles git init, commit, repo creation, and push."
---

# GitHub Push Skill — SaiWebApps

Push the current working directory to github.com/SaiWebApps. Creates the repo if it doesn't exist. Works for both new and existing projects.

> **Autonomous-mode override (no human watching — see the MODE CHECK in `~/.claude-work/CLAUDE.md`):** Creating a public repo is irreversible — when you cannot ask, default to `--private` (the most-conservative choice), never public, and record "REPO PRIVATE — public/private not confirmed by user." Never force-push. If a commit message or visibility genuinely cannot be determined, draft a conservative message from the diff and surface the decision in the report rather than blocking.

## Auth

- **API calls**: `GH_TOKEN=$(cat ~/.gitpat) gh api --hostname github.com ...`
- **Git push**: Handled automatically by the credential helper in `~/.gitconfig` (`~/.git-credential-personal` reads `~/.gitpat`)
- **Username**: `SaiWebApps`
- **NEVER use `$SAIWEBAPPS_TOKEN`** — that token is expired. The working PAT is in `~/.gitpat`.

## Invocation

- `/gh-push` — push current directory, repo name = directory name
- `/gh-push my-repo` — push current directory with explicit repo name
- `/gh-push --private` — create as private repo

## Procedure

### Step 1: Determine repo name

- If the user provided a name, use it.
- Otherwise, use the current directory's basename.
- Sanitize: lowercase, replace spaces with hyphens.

### Step 2: Check git state

```bash
git rev-parse --is-inside-work-tree 2>/dev/null
```

- **Not a git repo**: Run `git init`, create `.gitignore` if missing, stage all files, ask the user for a commit message (or draft one from the files).
- **Is a git repo, no commits**: Stage files and commit.
- **Is a git repo with commits**: Check for uncommitted changes. If any, ask the user if they want to commit first.

### Step 3: Check if remote exists

```bash
git remote get-url origin 2>/dev/null
```

- If `origin` already points to `github.com/SaiWebApps/<repo>`, skip to Step 5.
- If `origin` points somewhere else, use a different remote name (`personal`) or ask.
- If no `origin`, proceed to Step 4.

### Step 4: Create repo on github.com if needed

Check if the repo exists:
```bash
GH_TOKEN=$(cat ~/.gitpat) gh api --hostname github.com /repos/SaiWebApps/<repo-name> --jq '.full_name' 2>/dev/null
```

If it doesn't exist (404), create it:
```bash
GH_TOKEN=$(cat ~/.gitpat) gh api --hostname github.com -X POST /user/repos \
  -f name=<repo-name> \
  -f description="<description>" \
  -f private=<true|false> \
  --jq '.html_url'
```

**MANDATORY: Ask the user whether the repo should be public or private.** Never assume. Never default. Always ask, even if `--private` or `--public` was NOT passed as an argument. The only exception is if the user explicitly included `--private` or `--public` in the invocation — then honor that without asking. (Autonomous mode, cannot ask: do NOT create a public repo on a guess — default to `--private` per the override at the top of this file, and record "REPO PRIVATE — visibility not user-confirmed.")

Then add the remote:
```bash
git remote add origin https://github.com/SaiWebApps/<repo-name>.git
```

### Step 5: Push

```bash
git push -u origin main
```

If the branch is not `main` (e.g., `master`), push the current branch:
```bash
git push -u origin "$(git branch --show-current)"
```

### Step 6: Report

Print the repo URL: `https://github.com/SaiWebApps/<repo-name>`

## Error Handling

- If `~/.gitpat` doesn't exist or is empty, tell the user: "No PAT found at ~/.gitpat — generate one at github.com/settings/tokens"
- If repo creation fails with 422 (name taken), the repo already exists — just add the remote and push.
- If push fails with "non-fast-forward", tell the user and suggest `git pull --rebase origin main` first.
- If push fails for any other reason, show the error verbatim.

## Safety

- **NEVER assume public or private** — always ask the user when creating a new repo (unless they explicitly passed `--private` or `--public` in the invocation). Autonomous mode (cannot ask): default to `--private`, never public, and record the choice — see the override at the top of this file.
- **Never force push** unless the user explicitly asks.
- **Always show what will be pushed** (commit count, branch name) before pushing.
- **Ask before creating a public repo** if the directory contains potentially sensitive files (.env, credentials, etc.).
