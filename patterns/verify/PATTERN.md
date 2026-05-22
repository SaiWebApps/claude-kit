# Pattern: Verify

**Archetype:** Verify factual claims by cross-referencing sources.

Given a claim ("X is true"), gather evidence from multiple independent sources, assess agreement or contradiction, and report a confidence-scored verdict. This pattern prevents AI hallucination from propagating as fact -- every assertion must be backed by cited evidence.

## The Flow

```
[1] PARSE CLAIM --> [2] GATHER EVIDENCE --> [3] SCORE --> [4] REPORT
       |                    |                    |              |
  Decompose into      Query internal +      Assess          Present verdict
  verifiable          external sources      agreement       with evidence
  sub-claims          independently         across          trail
                                            sources
```

### Step 1: Parse Claim

Break the input into discrete, independently verifiable sub-claims.

**Example:** "The users table has 10 million rows and was created in 2019"

Sub-claims:
1. A table named "users" exists
2. It has approximately 10 million rows
3. It was created in 2019

Each sub-claim gets its own evidence gathering and scoring.

**Claim types:**
- **Existence claims:** "X exists" -- verify by looking it up
- **Property claims:** "X has property Y" -- verify by inspecting X
- **Relationship claims:** "X is related to Y" -- verify both sides
- **Temporal claims:** "X happened at time T" -- verify against logs/history
- **Quantitative claims:** "X has N of Y" -- verify by counting

### Step 2: Gather Evidence

For each sub-claim, gather evidence from the appropriate sources. Use at least two independent sources when possible.

**Source types (in priority order):**

1. **Authoritative data** -- direct query of the system of record
   - Database queries, API responses, file system reads
   - Highest trust: this IS the truth, not a report about the truth

2. **Official documentation** -- published specs, schemas, READMEs
   - High trust, but may be stale
   - Cross-reference against actual system state

3. **Web research** -- public documentation, forums, official announcements
   - Medium trust: multiple independent sources increase confidence
   - Watch for circular sources (all citing the same original)

4. **Inference** -- logical deduction from other verified facts
   - Lowest trust: state it as inference, not fact
   - Only use when direct evidence is unavailable

**Evidence collection rules:**
- Never use a single source for a CONFIRMED verdict
- Record the source for every piece of evidence
- Note when sources disagree
- Record absence of evidence (searched X, found nothing)

### Step 3: Score Confidence

Apply a confidence score based on evidence quality and agreement:

| Verdict | Criteria | Example |
|---------|----------|---------|
| **CONFIRMED** | 2+ independent authoritative sources agree | Database query shows 10M rows AND monitoring dashboard confirms |
| **LIKELY** | 1 authoritative source confirms, no contradictions | Database query shows the table exists, no counter-evidence |
| **UNVERIFIABLE** | No authoritative source available, evidence is circumstantial | Web search mentions it but cannot directly query the system |
| **REFUTED** | Authoritative source directly contradicts the claim | Database query shows 500K rows, not 10M |

**Scoring rules:**
- CONFIRMED requires evidence, not absence of counter-evidence
- LIKELY is the ceiling when only one source is available
- UNVERIFIABLE is honest -- it means "I cannot check," not "it is wrong"
- REFUTED requires positive counter-evidence, not just failure to confirm

### Step 4: Report Verdict

Present findings in a structured format:

```
## Verification Report

**Claim:** "The users table has 10 million rows and was created in 2019"

### Sub-claim 1: A table named "users" exists
**Verdict: CONFIRMED**
- Evidence: `SELECT tablename FROM pg_tables WHERE tablename = 'users'` returned 1 row
- Source: Direct database query (authoritative)

### Sub-claim 2: It has approximately 10 million rows
**Verdict: REFUTED**
- Evidence: `SELECT reltuples FROM pg_class WHERE relname = 'users'` returned 2,847,291
- Actual count is ~2.8 million, not 10 million
- Source: Direct database query (authoritative)

### Sub-claim 3: It was created in 2019
**Verdict: LIKELY**
- Evidence: Git blame on migration file `001_create_users.sql` shows commit date 2019-03-15
- Source: Version control history (one authoritative source, no contradictions)

### Overall Verdict: PARTIALLY CONFIRMED
- The table exists (confirmed)
- Row count is significantly different from claimed (refuted)
- Creation date is consistent with evidence (likely)
```

## Source Hierarchy

```
AUTHORITATIVE (highest weight)
  |-- Direct system query (database, API, file read)
  |-- System-generated audit logs
  |-- Version control history (git log, blame)

OFFICIAL
  |-- Published API documentation / OpenAPI specs
  |-- Project README / architecture docs
  |-- Official announcements / changelogs

EXTERNAL
  |-- Multiple independent web sources agreeing
  |-- Community documentation (StackOverflow, forums)
  |-- Single web source (lowest weight before inference)

INFERENCE (lowest weight)
  |-- Logical deduction from verified facts
  |-- Pattern-based reasoning
  |-- NOTE: Always label as inference in the report
```

## Extension Points

### Internal Data Source

The primary system of record for verification:
- Database (query tables directly)
- API (fetch resource state)
- File system (read configs, schemas, migrations)
- Version control (git log, blame, diff)

### External Search Method

How to find corroborating evidence outside the primary system:
- Web search (via WebFetch or browser)
- Documentation sites
- Package registries (npm, PyPI, Maven Central)
- Public APIs (GitHub, DNS, WHOIS)

### Claim Parsing

How to decompose complex claims into verifiable sub-claims:
- Entity extraction (what thing is being claimed about?)
- Property extraction (what is being asserted?)
- Qualifier extraction (when, how many, where?)
- Implicit claims (what must also be true for the claim to hold?)

## Anti-Patterns

| Anti-Pattern | Why It's Dangerous | Correct Approach |
|---|---|---|
| Confirming from memory | LLM training data may be outdated/wrong | Always query the actual system |
| Single source = CONFIRMED | One source can be wrong | Require 2+ for CONFIRMED |
| Treating inference as evidence | Deduction can have flawed premises | Label inference explicitly |
| Ignoring contradicting evidence | Confirmation bias | Report ALL evidence, including contradictions |
| UNVERIFIABLE as a cop-out | Lazy when you could query directly | Exhaust available sources before UNVERIFIABLE |
| Circular sources | Wikipedia citing a blog citing Wikipedia | Trace each source to its origin |

## When NOT to Use This Pattern

- When you need to change state (use the **Mutate** pattern)
- When you need to explore system state interactively (use the **Observe** pattern)
- When the "verification" is checking if a CI job passed (use the **Pipelines** pattern)
