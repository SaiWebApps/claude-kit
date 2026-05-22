---
name: prwalk
description: "Walk through one or more GitHub PRs and produce a report with recommended file reading order. Invoke with '/prwalk <PR URL> [PR URL...]'. Uses gh CLI. Read-only: never modifies PRs, leaves comments, or pushes code."
---

# PR Walkthrough Skill

Inspect one or more GitHub PRs and produce a walkthrough report with a recommended file reading order.

**Read-only: This skill only reads PR data. It never modifies PRs, leaves comments, approves, or pushes code.**

## When to Use

- User provides one or more PR URLs and wants to understand the changes
- User asks "walk me through this PR" or "explain this PR"
- User wants a recommended reading order for a complex PR
- User wants to understand cross-PR themes across related PRs
- Invoked explicitly with `/prwalk <URL> [URL...]`

## Configuration

The skill supports any GitHub host. The host is extracted from the PR URL automatically.

- Default host: `github.com`
- Custom hosts (GitHub Enterprise): extracted from the URL pattern

## Argument Parsing

Parse user input for:

| Argument | Required | Notes |
|---|---|---|
| PR URL(s) | Yes | One or more full GitHub PR URLs. Format: `https://{GH_HOST}/{org}/{repo}/pull/{number}`. Space-separated for multiple. |

Extract `org`, `repo`, `number`, and `host` from each URL using the pattern:
```
https://{host}/{org}/{repo}/pull/{number}
```

Where `{host}` can be `github.com` or any GitHub Enterprise hostname.

If a URL doesn't match this pattern, report the error and skip it.

### Examples

```
/prwalk https://github.com/acme/my-project/pull/42
/prwalk https://github.com/acme/my-project/pull/42 https://github.com/acme/shared-lib/pull/15
/prwalk https://github.example.com/team/repo/pull/7
```

## Prerequisites

The skill requires `gh` (GitHub CLI) authenticated against the target host. There is no fallback — PR inspection requires API access.

## Execution Steps

### Step 1: Verify GitHub CLI Access

Check that `gh` is installed and authenticated for the target host:

```bash
gh auth status --hostname <GH_HOST>
```

Where `<GH_HOST>` is extracted from the PR URL (defaults to `github.com`).

**If this succeeds:** Proceed to Step 2.

**If `gh` is not installed:** Go to Step 1a.

**If `gh` is installed but not authenticated:** Go to Step 1b.

### Step 1a: Install GitHub CLI

If `gh` is not found:

```bash
brew install gh
```

If `brew` is also not available, tell the user to install Homebrew first (`https://brew.sh`) or download `gh` manually from `https://cli.github.com`.

After installation, proceed to Step 1b.

### Step 1b: Authenticate GitHub CLI

Guide the user through authentication:

```bash
# For github.com:
gh auth login

# For a custom GitHub Enterprise host:
gh auth login --hostname <GH_HOST>
```

The user will be prompted to choose their preferred authentication method (browser OAuth, SSH key, or personal access token).

### Step 2: Parse PR URLs

For each URL provided:

1. Extract `host`, `org`, `repo`, and `number` from the URL
2. Validate the URL format — reject and report any malformed URLs
3. Group PRs by repository (for efficient querying and cross-PR analysis)

### Step 3: Fetch PR Data

For each PR, gather data using these commands:

**Important — hostname handling:** The `gh api` command supports `--hostname`. Most other subcommands (`pr diff`, `pr view`) do NOT. For those, set the `GH_HOST` environment variable instead.

```bash
# PR metadata (title, author, body, state, base/head branch, labels)
gh api repos/{org}/{repo}/pulls/{number} --hostname <GH_HOST> --jq '{title, state, body, user: .user.login, head: .head.ref, base: .base.ref, labels: [.labels[].name], additions, deletions, changed_files}'

# File list with stats (filename, status, additions, deletions, changes)
gh api repos/{org}/{repo}/pulls/{number}/files --hostname <GH_HOST> --paginate --jq '.[] | {filename, status, additions, deletions, changes}'

# Commit list (commit messages, authors)
gh api repos/{org}/{repo}/pulls/{number}/commits --hostname <GH_HOST> --jq '.[] | {sha: .sha[0:8], message: .commit.message, author: .commit.author.name}'

# Full diff (for understanding change relationships)
GH_HOST=<GH_HOST> gh pr diff {number} --repo {org}/{repo}
```

**Diff size limits:** For PRs with very large diffs (1000+ changed lines total), summarize using file-level stats rather than reading the full diff. Inform the user that the diff was too large for detailed analysis and offer to inspect specific files on request.

### Step 4: Classify Files and Determine Reading Order

Categorize each changed file into tiers. Read files in this order to build understanding from foundations to specifics:

| Tier | Category | Priority | Examples |
|------|----------|----------|---------|
| 1 | Schema / API contracts | Read first | `.proto`, `*Api.java`, `*Model.java`, `types.ts`, `*Schema.*` |
| 2 | Configuration | Early | `build.gradle`, `pom.xml`, `application.yml`, `Dockerfile`, `*.properties` |
| 3 | Core / shared logic | Early-mid | Files in `shared/`, `common/`, `util/`, `lib/` directories |
| 4 | Domain / business logic | Mid | Service classes, processors, handlers — the main implementation |
| 5 | Glue / wiring | Mid-late | `*Module.java`, `*Config.java`, `*Factory.*`, DI configuration |
| 6 | Tests | Late | `*Test.java`, `*Spec.scala`, `*.test.ts`, `*_test.go` |
| 7 | Docs / other | Last | `*.md`, `CHANGELOG`, `LICENSE`, `.gitignore` |

Apply these heuristics:

- Files with only deletions and no additions: note as "removed" in the report but don't prioritize in reading order
- Files renamed/moved: group with their logical category
- Within the same tier, order by size of change (largest first — they're likely the core of the PR)
- Files that appear across multiple PRs: call these out as they're likely central to the change

### Step 5: Cross-PR Analysis (multi-PR only)

When multiple PRs are provided:

1. **Identify shared themes** — same files changed, same directories, related commit messages
2. **Detect dependencies** — does PR-B reference changes from PR-A? Are they in the same repo or different repos?
3. **Suggest a PR reading order** — foundational/infrastructure PRs first, then dependent/consuming PRs
4. **Note cross-repo relationships** — if PRs span different repos, explain how they relate

### Step 6: Generate Report

Format the output as follows:

```
## PR Walkthrough

### Overview

**PRs analyzed:** {count}

| # | PR | Repo | Title | Author | Files | +/- |
|---|-----|------|-------|--------|-------|-----|
| 1 | #{number} | {org}/{repo} | {title} | {author} | {file_count} | +{adds}/-{dels} |

**Summary:** {2-3 sentence summary of the overarching change across all PRs}

### Suggested PR Reading Order (if multiple PRs)

{ordered list with rationale}

### Recommended File Reading Order

Read files in this order to build understanding from foundations to specifics:

#### Tier 1: Schema / API Contracts
| File | PR | Status | +/- | Why read first |
|------|----|--------|-----|----------------|
| {file} | #{n} | modified | +10/-2 | {brief reason} |

#### Tier 2: Configuration
...

#### Tier 3: Core Logic
...

#### Tier 4: Domain Logic
...

#### Tier 5: Wiring
...

#### Tier 6: Tests
...

#### Tier 7: Docs
...

### Per-PR Details

#### PR #{number}: {title}
**Branch:** {head} -> {base}
**Description:** {PR body, truncated to first paragraph}

**Commits:**
- `{sha}` {message}

**Key changes:**
- {bullet summary of the most important changes in this PR}
```

## Safety Rules

1. **Read-only** — never modify PRs, leave comments, approve, request changes, or push code
2. **No secrets** — never log or display tokens, credentials, or PATs
3. **Respect access** — if the user doesn't have access to a repo, report it clearly; don't retry or escalate
4. **Rate limiting** — if API calls are rate-limited, wait and retry with backoff; inform the user
5. **URL validation** — reject URLs that don't match the expected pattern; never construct URLs from partial input without confirmation
6. **Diff size limits** — for PRs with very large diffs (1000+ changed lines), summarize file-level stats rather than reading the full diff; inform the user
