---
name: gh-actions
description: "Trigger GitHub Actions workflows, poll for completion, and report results. Supports workflow dispatch, run monitoring, result interpretation, and artifact download. Uses the gh CLI exclusively."
---

# GitHub Actions Skill

Trigger, monitor, and report on GitHub Actions workflows using the `gh` CLI.

## When to Use

- User wants to run a CI workflow ("run the tests", "trigger the build")
- User wants to check the status of a running workflow
- User wants to see why a workflow failed
- User wants to download build artifacts
- User invokes `/gh-actions` directly

## Prerequisites

- `gh` CLI must be installed and authenticated (`gh auth status`)
- Current directory must be a git repository with a GitHub remote
- User must have write access to the repository (for triggering workflows)

## Configuration

On first use, verify setup:

```bash
# Verify gh is authenticated
gh auth status

# Verify we are in a git repo with GitHub remote
git remote -v
gh repo view --json nameWithOwner -q '.nameWithOwner'
```

## Execution Steps

### Step 1: Map Intent to Workflow

Determine which workflow the user wants to interact with.

**If user specifies a workflow:**
- Match by name or filename
- Confirm the match before proceeding

**If user is vague ("run the tests", "trigger CI"):**
- List available workflows and let the user choose:

```bash
# List all workflows with their states
gh workflow list
```

**Display format:**
```
Available workflows:
1. CI Tests (ci.yml) -- active
2. Deploy (deploy.yml) -- active
3. Release (release.yml) -- active
Which workflow would you like to trigger?
```

### Step 2: Determine Parameters

Resolve the inputs needed to trigger the workflow.

**Branch resolution:**
```bash
# Default to current branch
BRANCH=$(git branch --show-current)
```

If user specifies a branch, use that. If the workflow is "deploy," ask which environment.

**Workflow inputs:**
```bash
# Check if the workflow accepts inputs (inspect the YAML)
gh workflow view <workflow-name> --yaml | head -30
```

If the workflow has `workflow_dispatch` inputs, present them:
```
This workflow accepts inputs:
- environment (required): staging | production
- dry_run (optional, default: false): true | false
What values should I use?
```

### Step 3: Confirm and Trigger

Present the trigger plan and wait for approval:

```
I will trigger:
  Workflow: CI Tests (ci.yml)
  Branch: feature/auth-update
  Inputs: none

This typically takes ~5 minutes. Shall I proceed?
```

After approval:

```bash
# Trigger the workflow
gh workflow run ci.yml --ref feature/auth-update

# If the workflow has inputs:
gh workflow run deploy.yml --ref main -f environment=staging -f dry_run=false
```

**Capture the run ID immediately after triggering:**

```bash
# Wait a moment for the run to register, then get its ID
sleep 3
RUN_ID=$(gh run list --workflow=ci.yml --branch=feature/auth-update --limit=1 --json databaseId -q '.[0].databaseId')
echo "Run ID: $RUN_ID"
```

Report:
```
Triggered: CI Tests (Run #12345)
Link: https://github.com/org/repo/actions/runs/12345
Monitoring for completion...
```

### Step 4: Poll for Completion

Monitor the run with exponential backoff:

```bash
# Check run status
gh run view $RUN_ID --json status,conclusion -q '{status: .status, conclusion: .conclusion}'
```

**Polling schedule:**
- First check: 10 seconds after trigger
- Second check: 20 seconds later
- Third check: 40 seconds later
- Subsequent checks: every 60 seconds
- Maximum: 15 minutes total

**Status reporting between polls:**
```bash
# Get current step for progress reporting
gh run view $RUN_ID --json jobs -q '.jobs[] | select(.status == "in_progress") | .name'
```

Report progress:
```
Still running... (3 min elapsed)
Current step: "Run integration tests"
```

**Completion detection:**
- `status: "completed"` means done
- `conclusion` is one of: `success`, `failure`, `cancelled`, `timed_out`, `skipped`

### Step 5: Report Results

#### On Success

```bash
# Get summary
gh run view $RUN_ID --json conclusion,jobs,createdAt,updatedAt
```

Report:
```
## Workflow Result: PASSED

**Workflow:** CI Tests (Run #12345)
**Duration:** 4 minutes 32 seconds
**Branch:** feature/auth-update
**Link:** https://github.com/org/repo/actions/runs/12345

All jobs passed:
- build (52s)
- test-unit (1m 20s)
- test-integration (2m 45s)
- lint (38s)
```

#### On Failure

```bash
# Get failed jobs and steps
gh run view $RUN_ID --json jobs -q '.jobs[] | select(.conclusion == "failure") | .name'

# Get logs for the failed job
gh run view $RUN_ID --log-failed 2>&1 | tail -50
```

Report:
```
## Workflow Result: FAILED

**Workflow:** CI Tests (Run #12345)
**Duration:** 2 minutes 15 seconds (failed at job: test-integration)
**Branch:** feature/auth-update
**Link:** https://github.com/org/repo/actions/runs/12345

### Failure Details
**Job:** test-integration
**Step:** Run integration tests
**Exit code:** 1

**Error:**
  FAIL TestAuthFlow/login_with_invalid_credentials (0.03s)
    auth_test.go:45: expected status 401, got 500

### Suggested Action
The integration test for invalid login is returning 500 instead of 401.
Check the auth handler error response for invalid credentials.

**Full logs:** gh run view 12345 --log-failed
```

#### On Timeout (polling exhausted)

```
## Workflow Status: STILL RUNNING

**Workflow:** CI Tests (Run #12345)
**Elapsed:** 15+ minutes (my polling limit reached)
**Link:** https://github.com/org/repo/actions/runs/12345

The workflow is still running. You can:
- Check status: `gh run view 12345`
- Watch live: `gh run watch 12345`
- Cancel: `gh run cancel 12345`
```

## Additional Operations

### Check Status of Existing Run

```bash
# By run ID
gh run view $RUN_ID

# Most recent run on current branch
gh run list --branch $(git branch --show-current) --limit 5
```

### List Recent Runs

```bash
# All recent runs
gh run list --limit 10

# Filter by workflow
gh run list --workflow ci.yml --limit 5

# Filter by status
gh run list --status failure --limit 5
```

### Download Artifacts

```bash
# List artifacts from a run
gh run view $RUN_ID --json artifacts -q '.artifacts[].name'

# Download a specific artifact
gh run download $RUN_ID -n <artifact-name> --dir /tmp/artifacts/

# Download all artifacts
gh run download $RUN_ID --dir /tmp/artifacts/
```

Report:
```
Downloaded artifact "test-results" to /tmp/artifacts/test-results/
Contents:
- junit-report.xml (245 KB)
- coverage.html (1.2 MB)
```

### Cancel a Running Workflow

```bash
gh run cancel $RUN_ID
```

### Re-run a Failed Workflow

```bash
# Re-run only failed jobs
gh run rerun $RUN_ID --failed

# Re-run all jobs
gh run rerun $RUN_ID
```

**Note:** Always confirm before re-running. Ask user if they want to re-run as-is or if they have pushed a fix.

## Example Interactions

**User:** "Run the tests"

```
Available workflows:
1. CI (ci.yml) -- runs lint + unit tests + integration tests
2. E2E Tests (e2e.yml) -- runs end-to-end browser tests

Which one? Or "both"?
```

**User:** "What is the status of my last deploy?"

```bash
gh run list --workflow deploy.yml --limit 1 --json databaseId,status,conclusion,headBranch,createdAt
```

**User:** "Why did CI fail?"

```bash
# Get the most recent failed run
FAILED_RUN=$(gh run list --status failure --limit 1 --json databaseId -q '.[0].databaseId')
gh run view $FAILED_RUN --log-failed 2>&1 | tail -80
```

**User:** "Download the build artifact from run 12345"

```bash
gh run view 12345 --json artifacts -q '.artifacts[].name'
gh run download 12345 -n "build-output" --dir /tmp/artifacts/
```

## Safety Rules

1. **Always confirm before triggering.** Show workflow name, branch, and inputs. Wait for "yes."
2. **Never trigger deploy workflows without explicit environment confirmation.** "Deploy" alone is not enough -- require "deploy to staging" or "deploy to production."
3. **Production deploys get extra confirmation.** Warn explicitly: "This will deploy to PRODUCTION. Are you sure?"
4. **Never auto-retry failed runs.** Report the failure, let user decide whether to fix-then-retry or retry as-is.
5. **Cap polling at 15 minutes.** Provide the link and let the user check manually after that.
6. **Do not dump full logs.** Extract the relevant failure, link to full logs. CI logs can be thousands of lines.
7. **Never cancel a run without asking.** Even if it looks stuck.
8. **Check branch before triggering.** Confirm the branch exists on the remote.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `gh: command not found` | Install: `brew install gh` then `gh auth login` |
| `gh auth status` shows not logged in | Run `gh auth login` and follow prompts |
| "could not find any workflows" | Check `.github/workflows/` exists and has YAML files |
| "workflow does not have workflow_dispatch trigger" | That workflow can only be triggered by push/PR, not manually |
| Run ID not found after trigger | Increase the sleep before lookup; sometimes takes 5-10s to register |
| Permission denied on trigger | User needs write access to the repo; check with repo admin |
| Polling times out | The job is legitimately slow; provide link, suggest `gh run watch` |
| Rate limit hit | Wait for reset (`gh api rate_limit`); polling too aggressively |
