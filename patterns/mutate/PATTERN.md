# Pattern: Mutate

**Archetype:** Change state safely through human-in-the-loop approval.

Any operation that modifies external state — creating records, updating configurations, deploying artifacts, sending messages — where an AI hallucination in the payload would cause real damage. The two-phase pattern ensures no mutation executes without explicit human review of the exact operation.

## The 4-Step Flow

```
[1] DRAFT --> [2] REVIEW --> [3] EXECUTE --> [4] VERIFY
     |              |              |               |
  Parse intent   Present to    Run only if     Confirm the
  + build the    user with     user said       mutation took
  exact payload  full detail   "yes"           effect correctly
```

### Step 1: Draft

Transform natural language intent into a concrete, executable operation.

**Inputs:** User description of what they want to change.
**Process:**
- Load the schema/API spec for the target system
- Map intent to operation (which endpoint, which fields, which values)
- Resolve ambiguity by asking (never guess entity IDs or enum values)
- Build the complete request payload

**Output:** A structured draft showing exactly what will be sent.

**Critical rule:** The draft is a PROPOSAL. It has no side effects. It touches nothing.

### Step 2: Review

Present the draft for human approval in a format that is unambiguous and auditable.

**Requirements:**
- Show the exact payload (JSON body, SQL statement, API call)
- Show the equivalent CLI command (curl, psql, etc.) so the user could run it manually
- Highlight destructive aspects (DELETE, overwrite, irreversible changes)
- State what the rollback would be (if applicable)
- Ask for explicit "yes" / approval before proceeding

**Never proceed without explicit approval.** Silence is not consent. "Okay" is not "yes, execute this mutation." The user must confirm they want THIS EXACT operation to run.

### Step 3: Execute

Run the approved operation exactly as drafted.

**Rules:**
- Execute the EXACT payload that was approved — no modifications
- Capture the full response (status code, response body, error messages)
- If execution fails, report the error — do NOT retry automatically
- Log the operation for audit trail (timestamp, payload, response)

**Never modify the payload between approval and execution.** If something needs to change, go back to Step 1 and re-draft.

### Step 4: Verify

Confirm the mutation took effect correctly by reading back the state.

**Process:**
- Query the system to retrieve the mutated entity
- Compare actual state against expected state (from the draft)
- Report discrepancies
- If verification fails, report what happened — do NOT attempt auto-fix

**Verification is not optional.** A "200 OK" response does not mean the mutation worked correctly. Many APIs return success while silently dropping fields or applying defaults.

## Why Each Step Exists

| Step | Prevents | Real-world failure mode |
|------|----------|------------------------|
| Draft | AI hallucinating field values | LLM invents an entity ID that happens to be valid for a different entity |
| Review | Unintended mutations | User said "update" but the AI drafted a DELETE + CREATE |
| Execute | Unapproved changes | AI "helpfully" adds extra fields the user did not request |
| Verify | Silent failures | API returns 200 but validation stripped a required field |

## Safety Rails

### Never Execute Without Explicit Approval

The phrase "go ahead" after a draft presentation is approval. But:
- If the user says "looks good, but change X" — that is a re-draft, not approval
- If the user asks a question about the draft — that is not approval
- If the user is silent — that is not approval

### Always Verify After Execution

Even if the API returns a success code. Trust but verify:
- GET the resource that was created/modified
- Compare key fields against what was sent
- Report the verification result explicitly

### Rollback Strategy

Every draft should include a rollback hint:
- CREATE operations: note the DELETE endpoint/command
- UPDATE operations: note the previous values (read them before mutating)
- DELETE operations: note that this is irreversible (or capture the entity state before deletion)

### Idempotency Awareness

Know whether the operation is idempotent:
- PUT (usually idempotent) — safe to retry on network failure
- POST (usually not) — do NOT retry; check if it went through first
- DELETE (usually idempotent) — safe to retry

## Extension Points

### Schema Source

Where to get the schema/spec for the target system:
- OpenAPI/Swagger spec file
- Protobuf definitions
- Database schema (information_schema)
- Manual documentation

The skill loads the schema to validate the draft against what the system actually accepts.

### Execution Backend

How to actually send the mutation:
- `curl` for REST APIs
- `psql` for database mutations
- `grpcurl` for gRPC services
- SDK calls for cloud provider APIs
- CLI tools (aws, gcloud, kubectl)

### Verification Method

How to confirm the mutation worked:
- GET the resource by ID
- Query the database for the record
- Check the system audit log
- Poll for eventual consistency (with bounded retries)

## Anti-Patterns

| Anti-Pattern | Why It's Dangerous | Correct Approach |
|---|---|---|
| Execute without review | AI hallucinations become real mutations | Always present draft first |
| Skip verification | Silent failures go undetected | Always read back after write |
| Auto-retry on failure | Duplicate creates, race conditions | Report failure, ask user |
| Guess entity IDs | Wrong entity gets mutated | Look up IDs by name/query first |
| Modify between approval and execution | User approved something different | Re-draft if anything changes |
| Bundle multiple mutations | Partial failure is hard to recover from | One mutation per approval cycle |

## When NOT to Use This Pattern

- When you only need to read data (use the **Observe** pattern)
- When the "mutation" is a CI trigger with no direct data change (use the **Pipelines** pattern)
- When you need to verify a claim, not change state (use the **Verify** pattern)
