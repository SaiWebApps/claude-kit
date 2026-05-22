---
name: rest-mutate
description: "Make REST API mutations with human-in-the-loop approval. Drafts the exact HTTP request from natural language, presents for review, executes only after approval, and verifies the result. Supports CREATE, UPDATE, and DELETE operations."
---

# REST API Mutate Skill

Safely mutate state via REST APIs using the Draft-Review-Execute-Verify flow.

## When to Use

- User wants to create, update, or delete a resource via a REST API
- User describes a change in natural language that maps to an API call
- User invokes `/rest-mutate` directly

## Prerequisites

- `curl` must be installed and on PATH
- `jq` must be installed (for JSON parsing and formatting)
- Environment variable `REST_BASE_URL` must be set (e.g., `http://localhost:3000/api`)
- Environment variable `REST_AUTH_TOKEN` must be set (Bearer token) or `REST_AUTH_HEADER` for custom auth
- Optional: `REST_SCHEMA_PATH` pointing to an OpenAPI/Swagger JSON file for validation

## Configuration

On first use, verify connectivity:

```bash
# Health check
curl -sf "${REST_BASE_URL}/health" -H "Authorization: Bearer ${REST_AUTH_TOKEN}" | jq .
```

If a schema file is available, load it to understand available endpoints:

```bash
# Parse available endpoints from OpenAPI spec
jq '.paths | keys[]' "$REST_SCHEMA_PATH"
```

## Execution Steps

### Step 1: Parse Intent and Draft Request

Translate the user natural language into a concrete HTTP request.

**Process:**
1. Identify the operation type: CREATE (POST), UPDATE (PUT/PATCH), DELETE
2. Identify the target resource and endpoint
3. Extract field values from the user description
4. If schema is available, validate fields against it
5. Build the complete request

**Ambiguity resolution -- ALWAYS ask, never guess:**
- If the user says "update the user" without specifying which one: ask for identifier
- If a field has enum values: show the valid options, ask which one
- If the entity might not exist: offer to look it up first (GET request)

**Draft format:**

```
## Mutation Draft

**Operation:** POST /users
**Purpose:** Create a new user account

**Request body:**
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "role": "editor"
}

**Equivalent curl:**
curl -X POST "${REST_BASE_URL}/users" \
  -H "Authorization: Bearer ${REST_AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"name":"Jane Smith","email":"jane@example.com","role":"editor"}'

**Rollback:** DELETE /users/{id} (ID will be in the creation response)

**Shall I execute this? (yes/no)**
```

### Step 2: Present for Review

Show the draft to the user. Wait for explicit approval.

**Approval signals (proceed):**
- "yes"
- "go ahead"
- "execute it"
- "do it"

**Non-approval signals (do NOT proceed):**
- "looks good but change X" means re-draft with the change
- "what if..." means answer the question, wait for approval
- "hmm" / silence means wait, ask again
- "no" / "cancel" means abort entirely

### Step 3: Execute

Run the exact curl command that was approved:

```bash
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${REST_BASE_URL}/users" \
  -H "Authorization: Bearer ${REST_AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"name":"Jane Smith","email":"jane@example.com","role":"editor"}')

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
```

**Report the result:**

```
## Execution Result

**Status:** 201 Created
**Response:**
{
  "id": "usr_a1b2c3",
  "name": "Jane Smith",
  "email": "jane@example.com",
  "role": "editor",
  "created_at": "2026-05-21T10:30:00Z"
}
```

**Error handling:**
- 4xx response: report the error body, do NOT retry
- 5xx response: report the error, suggest trying again (but do not auto-retry)
- Network error: report, check if the request might have partially completed
- Timeout: report, check if resource was created (GET before retrying POST)

### Step 4: Verify

Read back the resource to confirm the mutation took effect:

```bash
# Verify by fetching the created resource
curl -s "${REST_BASE_URL}/users/usr_a1b2c3" \
  -H "Authorization: Bearer ${REST_AUTH_TOKEN}" | jq .
```

**Verification report:**

```
## Verification

**GET /users/usr_a1b2c3** returned:
- name: "Jane Smith" [matches draft]
- email: "jane@example.com" [matches draft]
- role: "editor" [matches draft]
- created_at: "2026-05-21T10:30:00Z" [set by server]

**Status: VERIFIED** -- all fields match the approved draft.
```

If verification shows discrepancies:
```
**Status: DISCREPANCY** -- "role" is "viewer" (expected "editor").
The API may have applied a default or the value was rejected silently.
Would you like me to PATCH the role to "editor"?
```

## Operation Templates

### CREATE (POST)

```bash
curl -s -w "\n%{http_code}" -X POST "${REST_BASE_URL}/${resource}" \
  -H "Authorization: Bearer ${REST_AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "${json_body}"
```

Rollback: `DELETE ${REST_BASE_URL}/${resource}/${id}`

### UPDATE (PATCH)

Before updating, GET the current state to record previous values:

```bash
# Capture current state for rollback reference
BEFORE=$(curl -s "${REST_BASE_URL}/${resource}/${id}" \
  -H "Authorization: Bearer ${REST_AUTH_TOKEN}")

# Apply update
curl -s -w "\n%{http_code}" -X PATCH "${REST_BASE_URL}/${resource}/${id}" \
  -H "Authorization: Bearer ${REST_AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "${json_body}"
```

Rollback: PATCH with the previous values (shown in draft)

### DELETE

Before deleting, GET and display the full resource so the user sees what will be lost:

```bash
# Show what will be deleted
curl -s "${REST_BASE_URL}/${resource}/${id}" \
  -H "Authorization: Bearer ${REST_AUTH_TOKEN}" | jq .

# After approval:
curl -s -w "\n%{http_code}" -X DELETE "${REST_BASE_URL}/${resource}/${id}" \
  -H "Authorization: Bearer ${REST_AUTH_TOKEN}"
```

Rollback: NOT POSSIBLE (state this clearly in the draft)

## Example Interactions

**User:** "Create a project called alpha with description New initiative"

Draft:
```
POST /projects
Body: {"name": "alpha", "description": "New initiative"}
Rollback: DELETE /projects/{id}
```

**User:** "Change user john role to admin"

Before drafting:
```bash
# Look up user by name to get ID
curl -s "${REST_BASE_URL}/users?name=john" -H "Authorization: Bearer ${REST_AUTH_TOKEN}" | jq .
```

Draft:
```
PATCH /users/usr_xyz789
Body: {"role": "admin"}
Previous value: {"role": "member"}
Rollback: PATCH /users/usr_xyz789 with {"role": "member"}
```

**User:** "Delete the test project"

Before drafting:
```bash
# Look up project, show full details
curl -s "${REST_BASE_URL}/projects?name=test" -H "Authorization: Bearer ${REST_AUTH_TOKEN}" | jq .
```

Draft:
```
DELETE /projects/proj_abc123
WARNING: This will permanently delete project "test" (3 members, 12 tasks).
Rollback: NOT POSSIBLE -- deletion is irreversible.
```

## Safety Rules

1. **Never execute without explicit "yes."** Present the draft. Wait. No assumptions.
2. **Never modify the payload after approval.** If anything needs to change, re-draft from Step 1.
3. **Always verify after execution.** GET the resource and compare against the draft.
4. **Never auto-retry POST requests.** They are not idempotent -- retrying may create duplicates.
5. **Never guess entity IDs.** Always look up by name/query first if the user provides a name, not an ID.
6. **Never batch mutations.** One operation per approval cycle. Multiple changes = multiple cycles.
7. **Always show rollback information.** Even if rollback is "not possible" -- the user needs to know.
8. **Never echo the auth token.** Show `${REST_AUTH_TOKEN}` in curl examples, never the actual value.
9. **Read before update/delete.** Always GET the current state before proposing a PATCH or DELETE.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `curl: command not found` | Install: `brew install curl` or `apt install curl` |
| `jq: command not found` | Install: `brew install jq` or `apt install jq` |
| `REST_BASE_URL` not set | Ask user: `export REST_BASE_URL="http://..."` |
| `REST_AUTH_TOKEN` not set | Ask user for their API token |
| 401 Unauthorized | Token expired or invalid; ask user to refresh |
| 403 Forbidden | User role lacks permission for this operation |
| 404 Not Found | Resource does not exist; verify the ID/path |
| 409 Conflict | Resource already exists (for creates); ask user what to do |
| 422 Unprocessable | Validation error; show the error body, fix the payload, re-draft |
