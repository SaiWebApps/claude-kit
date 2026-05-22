# Pattern: Pipelines

**Archetype:** Trigger CI jobs, poll for completion, interpret results.

Interact with CI/CD systems -- trigger workflows, monitor progress, interpret outcomes, retrieve artifacts. CI jobs cost compute resources, take time, and produce results that require interpretation. This pattern ensures jobs are triggered intentionally, monitored efficiently, and reported clearly.

## The Flow

```
[1] MAP INTENT --> [2] CONFIRM --> [3] TRIGGER --> [4] POLL --> [5] REPORT
       |                 |              |              |              |
  Translate user    Show what     Fire the       Wait with     Interpret
  request to exact  will run,     job/workflow   exponential   pass/fail,
  workflow + params cost/impact                  backoff       summarize
```

### Step 1: Map Intent

Translate natural language into a specific CI operation.

**User says:** "Run the tests" / "Deploy to staging" / "Build the release"
**Agent determines:** Which workflow? Which branch? Which parameters?

**Resolution process:**
1. List available workflows/pipelines
2. Match user intent to a specific workflow
3. Determine required parameters (branch, environment, inputs)
4. Resolve defaults (current branch, default environment)

**If ambiguous:** Ask. "I found 3 test workflows: unit-tests, integration-tests, e2e-tests. Which one?" Never trigger the wrong job because you guessed.

### Step 2: Confirm

CI jobs consume resources. Always confirm before triggering.

**Show the user:**
- Exact workflow/pipeline name
- Target branch
- Input parameters
- Expected duration (if known)
- Resource cost (if known -- runner minutes, etc.)
- What will happen on success/failure

**Format:**
```
I will trigger: [workflow name]
Branch: [branch]
Parameters: [list]
Expected duration: ~[X] minutes
Shall I proceed?
```

**Exceptions where confirmation can be skipped:**
- User explicitly said "run it now" or "trigger immediately"
- The workflow is a lightweight check (lint, type-check) under 2 minutes
- User configured the skill to skip confirmation for specific workflows

### Step 3: Trigger

Fire the CI job and record its identifier.

**Capture:**
- Run ID / Build number
- URL to the running job
- Start timestamp
- Expected completion time

**Report immediately:**
```
Triggered: [workflow name] (Run #[id])
Link: [url]
Started: [timestamp]
I will monitor and report results.
```

### Step 4: Poll

Wait for completion with exponential backoff.

**Polling strategy:**
```
Attempt 1: wait 10 seconds
Attempt 2: wait 20 seconds
Attempt 3: wait 40 seconds
Attempt 4+: wait 60 seconds (cap)
Max total wait: 15 minutes
```

**Between polls, report status if it changed:**
- "Still running... (2 min elapsed, step: building dependencies)"
- "Still running... (5 min elapsed, step: running integration tests)"

**Timeout handling:**
- After max wait: report the run is still in progress with a link
- Do NOT continue polling indefinitely
- Offer: "The run is still going. I can check back later, or you can monitor at [link]"

### Step 5: Report

Interpret and summarize the results clearly.

**For passing jobs:**
```
## Pipeline Result: PASSED

**Workflow:** [name] (Run #[id])
**Duration:** [X] minutes
**Branch:** [branch]
**Link:** [url]

All checks passed. [X] tests executed, 0 failures.
```

**For failing jobs:**
```
## Pipeline Result: FAILED

**Workflow:** [name] (Run #[id])
**Duration:** [X] minutes (failed at step: [step name])
**Branch:** [branch]
**Link:** [url]

### Failure Summary
- Step "[step name]" failed with exit code [X]
- [Key error message from logs]
- [Relevant context]

### Suggested Action
- [What to investigate or fix]
```

**For cancelled/timed-out jobs:**
```
## Pipeline Result: CANCELLED / TIMED OUT

**Workflow:** [name] (Run #[id])
**Duration:** [X] minutes before [cancellation/timeout]
**Link:** [url]

The run was [cancelled by user / timed out]. Last completed step: [step name].
```

## Safety Rails

### Always Confirm Before Triggering

CI costs money and machine time. A misdirected trigger can:
- Deploy the wrong branch to production
- Consume expensive GPU runner minutes
- Block other jobs in a shared queue
- Trigger downstream deployments

### Poll with Backoff

Aggressive polling wastes API rate limits and provides no benefit. Use exponential backoff capped at 60 seconds.

### Interpret, Do Not Dump

Raw CI logs are hundreds of lines. The agent job is to:
- Find the failure point
- Extract the relevant error message
- Suggest what to do next
- Link to full logs for context

### Never Trigger in Loops

If a job fails, report the failure. Do NOT automatically re-trigger. The user decides whether to retry, fix-then-retry, or investigate.

## Common Patterns

### Natural Language to Test Scope

Map informal descriptions to specific test suites:

| User says | Maps to |
|-----------|---------|
| "Run the tests" | Default test workflow on current branch |
| "Run unit tests" | Unit test job/step only |
| "Run integration tests" | Integration test workflow (may need services) |
| "Run tests for the auth module" | Filter by path/module |
| "Run the full suite" | All test workflows |

### Environment Resolution

Map environment names to CI targets:

| User says | Maps to |
|-----------|---------|
| "Deploy to staging" | staging/stg environment |
| "Deploy to prod" | production environment (extra confirmation!) |
| "Deploy to dev" | development/int environment |
| "Deploy" (no qualifier) | ASK -- never guess the environment |

### Artifact Retrieval

After a successful build, users often want artifacts:
- Binary/package that was built
- Test report (HTML, XML, JSON)
- Coverage report
- Docker image tag
- Deployment URL

## Extension Points

### CI Backend

The CI system being interacted with:
- GitHub Actions (via `gh` CLI)
- Jenkins (via API)
- GitLab CI (via API)
- CircleCI (via API)
- Rio / internal platforms (via custom CLI)

### Trigger Mechanism

How to start a job:
- Workflow dispatch (manual trigger with inputs)
- Push/PR event (create the condition)
- API call (POST to trigger endpoint)
- CLI command (platform-specific)

### Status Polling

How to check if the job is done:
- API endpoint returning status
- CLI command with run ID
- Webhook (for push-based updates)
- Log streaming (for real-time progress)

### Result Parsing

How to interpret the outcome:
- Exit codes (0 = pass, non-zero = fail)
- Status field in API response
- Log parsing for error messages
- Test report XML/JSON parsing
- Artifact download for detailed results

## Anti-Patterns

| Anti-Pattern | Why It's Dangerous | Correct Approach |
|---|---|---|
| Trigger without confirming | Wrong workflow, wrong branch, wasted resources | Always show what will run |
| Aggressive polling (every 1s) | Rate limit exhaustion, no benefit | Exponential backoff capped at 60s |
| Dumping full logs | User cannot parse 500 lines of CI output | Extract the failure, link to full logs |
| Auto-retry on failure | Same failure will repeat, wasted resources | Report failure, let user decide |
| Guessing the workflow | Wrong job triggered | List available workflows, ask |
| Deploy without naming environment | Could hit production accidentally | Always require explicit environment |
| Polling forever | Session hangs | Cap at 15 minutes, provide link |

## When NOT to Use This Pattern

- When you need to query system state (use the **Observe** pattern)
- When you need to mutate data directly (use the **Mutate** pattern)
- When you need to verify a claim (use the **Verify** pattern)
- When the CI job is actually a deployment mutation (consider **Mutate** for the approval flow, **Pipelines** for the execution monitoring)
