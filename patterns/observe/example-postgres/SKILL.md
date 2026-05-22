---
name: postgres-observe
description: "Query PostgreSQL databases safely via psql. Read-only, filter-first, with timeout and row limits. Connect to a configurable instance and translate natural language questions into safe SELECT queries."
---

# PostgreSQL Observe Skill

Query a PostgreSQL database to answer questions about its data. Read-only, safe, and structured.

## When to Use

- User asks about data in a PostgreSQL database
- User wants to check the state of records, counts, or relationships
- User asks to look up something by ID, name, or other criteria
- User invokes `/postgres-observe` directly

## Prerequisites

- `psql` must be installed and on PATH
- Environment variable `PGOBS_URL` must contain a PostgreSQL connection string
  - Format: `postgresql://user:password@host:port/dbname`
  - The user MUST have read-only access (ideally a role with `pg_read_all_data` or equivalent)
- Alternatively, set individual variables: `PGOBS_HOST`, `PGOBS_PORT`, `PGOBS_DB`, `PGOBS_USER`, `PGOBS_PASSWORD`

## Configuration

On first use, verify the connection:

```bash
# Test connectivity (read-only verification)
psql "$PGOBS_URL" -c "SHOW transaction_read_only;" 2>&1
```

If `transaction_read_only` is not `on`, the skill will SET it before any query.

## Execution Steps

### Step 1: Parse User Intent

Translate the natural language question into query requirements:
- **Target table(s):** What entity is being asked about?
- **Filter criteria:** What specific records? (ID, name, date range, status)
- **Desired columns:** What information is needed? (Never default to `*`)
- **Aggregation:** Does the user want counts, averages, or individual records?

If the question is ambiguous, ask for clarification before querying.

### Step 2: Validate Query Safety

Before executing, verify the query meets ALL safety criteria:

| Check | Requirement | Action if Failed |
|-------|-------------|-----------------|
| Read-only | Query starts with SELECT, EXPLAIN, or WITH...SELECT | Reject with explanation |
| Has filter | WHERE clause present (or it is a metadata/schema query) | Add filter or ask user for criteria |
| Has limit | LIMIT clause present (max 100 for display, 1000 for counts) | Append `LIMIT 100` |
| No wildcards without WHERE | `SELECT *` only allowed with WHERE + LIMIT | Replace with explicit columns |
| Timeout set | statement_timeout configured | Set to 10 seconds |

**Banned patterns -- reject immediately:**
- `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`, `CREATE`
- `SELECT * FROM <table>` without WHERE clause
- `COPY`, `pg_dump`, any export command
- Queries joining more than 3 tables without specific key conditions
- `FOR UPDATE`, `FOR SHARE` (row locks)

### Step 3: Execute Query

Run with safety wrappers:

```bash
psql "$PGOBS_URL" --no-psqlrc -v ON_ERROR_STOP=1 <<'SQL'
SET statement_timeout = '10s';
SET transaction_read_only = ON;
SET lock_timeout = '3s';

-- The actual query goes here
SELECT column1, column2, column3
FROM target_table
WHERE filter_condition = 'value'
ORDER BY relevant_column DESC
LIMIT 100;
SQL
```

**Flags explained:**
- `--no-psqlrc` -- prevent user psqlrc from changing behavior
- `-v ON_ERROR_STOP=1` -- stop on first error
- `SET statement_timeout = '10s'` -- kill query if it runs too long
- `SET transaction_read_only = ON` -- prevent any writes even if the role allows them
- `SET lock_timeout = '3s'` -- do not wait for locks

### Step 4: Handle Results

**Success (rows returned):**
- Display as an aligned table (psql default format works)
- Report row count and query duration
- If 100 rows returned (hit the limit), note that more rows exist
- Highlight nulls or unexpected values

**Success (zero rows):**
- Report "No results found"
- Suggest alternative filters or confirm the search criteria
- Do NOT treat zero results as an error

**Timeout:**
- Report: "Query timed out after 10 seconds"
- Suggest narrowing: add more specific WHERE conditions, reduce date range, use a covering index
- Do NOT retry the same query

**Error:**
- Report the exact error message
- Common fixes:
  - `relation does not exist` -- wrong table name, list available tables
  - `permission denied` -- user lacks SELECT on that table
  - `column does not exist` -- list columns for that table

### Step 5: Follow-Up Investigation

If the initial results suggest a deeper question:
1. Identify the correlation (e.g., a foreign key reference)
2. Query the related table with the specific key from results
3. Present both results together as a narrative

Never do this more than 2 levels deep. If it requires more, summarize what is known and ask the user how to proceed.

## Utility Queries

These are always safe to run without specific filters:

```sql
-- List all tables in the public schema
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- Describe a table columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = '<table>'
ORDER BY ordinal_position;

-- Table row counts (approximate, fast)
SELECT relname, reltuples::bigint AS approximate_rows
FROM pg_class
WHERE relkind = 'r' AND relnamespace = 'public'::regnamespace
ORDER BY reltuples DESC
LIMIT 20;

-- Current connections (is the DB under load?)
SELECT count(*) AS active_connections FROM pg_stat_activity WHERE state = 'active';
```

## Example Interactions

**User:** "How many orders were placed yesterday?"

```sql
SET statement_timeout = '10s';
SET transaction_read_only = ON;

SELECT COUNT(*) AS order_count
FROM orders
WHERE created_at >= CURRENT_DATE - INTERVAL '1 day'
  AND created_at < CURRENT_DATE;
```

**User:** "Show me the last 10 failed payments"

```sql
SET statement_timeout = '10s';
SET transaction_read_only = ON;

SELECT id, user_id, amount, error_message, created_at
FROM payments
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 10;
```

**User:** "What tables exist?"

```sql
SET statement_timeout = '10s';
SET transaction_read_only = ON;

SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

## Safety Rules

1. **Never execute mutations.** Parse every query for INSERT/UPDATE/DELETE/DROP/ALTER before running.
2. **Always set statement_timeout.** No exceptions. Default 10s, max 30s if user explicitly requests.
3. **Always set transaction_read_only.** Defense in depth -- even if the role is read-only.
4. **Never echo credentials.** Do not print the connection string, password, or host in output.
5. **Limit result size.** Max 100 rows for display, 1000 for aggregate queries. Always include LIMIT.
6. **One query at a time.** Never batch multiple queries in a single psql invocation beyond the SET statements.
7. **Ask before querying unfamiliar tables.** If the user question maps to a table you are not sure exists, list tables first.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `psql: command not found` | Install: `brew install libpq` or `apt install postgresql-client` |
| `PGOBS_URL` not set | Ask user to set it: `export PGOBS_URL="postgresql://..."` |
| `connection refused` | Check host/port; database may be behind VPN or firewall |
| `SSL required` | Append `?sslmode=require` to connection string |
| `permission denied for table` | User role lacks SELECT; ask DBA for `pg_read_all_data` grant |
| Results truncated at 100 | This is by design; ask user if they need more (increase LIMIT with caution) |
