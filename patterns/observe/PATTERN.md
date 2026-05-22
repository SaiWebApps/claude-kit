# Pattern: Observe

**Archetype:** Query external systems without causing damage.

Read-only observation of production systems — databases, metrics stores, log aggregators, tracing backends — where a malformed query can cause outages (full table scans, unbounded result sets, lock contention) even without write access.

## Core Principles

### 1. Filter-First

Never issue a broad query. Every query MUST include:
- A filtering predicate (WHERE clause, time range, trace ID, namespace)
- A result limit (LIMIT, maxRows, --max-count)
- A timeout (statement_timeout, --timeout, context deadline)

A query without all three is a potential production incident.

### 2. Read-Only Enforcement

The skill must make writes structurally impossible, not just discouraged:
- Connect with a read-only user/role
- SET transaction_read_only = ON (PostgreSQL)
- Use read replicas when available
- Parse and reject mutation keywords before execution

### 3. Connection Management

- Never hold connections longer than needed
- Use connection strings from environment variables, never hardcoded
- Close connections explicitly after each query
- Respect connection pool limits of the target system

### 4. Structured Output

Raw query output is unusable for decision-making. Always:
- Format as aligned tables for small result sets
- Summarize with counts/aggregates for large result sets
- Highlight anomalies (nulls where values expected, outlier values)
- Report metadata: row count, query duration, source system

## Safety Rails

### Query Scope Limits

| Control | Purpose | Example |
|---------|---------|---------|
| Row limit | Prevent OOM on client | `LIMIT 100` |
| Time range | Prevent full scans on time-series data | `WHERE ts > NOW() - INTERVAL '1 hour'` |
| Timeout | Kill runaway queries | `SET statement_timeout = '10s'` |
| Column restriction | Reduce data transfer | Explicit column list, never `SELECT *` in production |

### Timeout Handling

Every query gets a timeout. When a timeout fires:
1. Report that the query timed out
2. Suggest a narrower filter or a different approach
3. Never retry the same query — it will time out again

### Credential Isolation

- Read credentials from environment variables only
- Never log or echo connection strings
- Support multiple named connections (prod-ro, staging-ro)
- Never connect to a system the user hasn't explicitly configured

## Decision Tree

How the agent investigates a question:

```
User asks a question about system state
         |
         v
[1] Start narrow: query for the specific entity/ID/trace mentioned
         |
    Found data? ---- No --> Report "not found" with what was searched
         |
        Yes
         |
         v
[2] Examine: display the relevant fields, flag anomalies
         |
         v
[3] Follow correlations: if data references other entities/systems,
    query those (still narrow -- by ID, not broad scan)
         |
         v
[4] Summarize: present findings as a coherent narrative
         |
    Unresolved? ---- Yes --> Escalate to user with what's known
         |                    and what couldn't be determined
        No
         |
         v
[5] Report verdict with evidence chain
```

At no point in this tree does the agent issue a broad/unfiltered query.

## Extension Points

To build a skill from this pattern, implement these:

### Connection Setup

How to connect to your backend. Inputs: credentials (from env), target instance (prod/staging), read-only enforcement mechanism.

```
# PostgreSQL: psql with read-only transaction
# Splunk: splunk search with -earliest/-latest
# Cassandra: cqlsh with CONSISTENCY LOCAL_ONE
# Prometheus: curl with time range parameters
```

### Query Syntax

How to translate user intent into the backend's query language. This is where you encode:
- Keyword-to-field mappings ("status" -> `pipeline_status` column)
- Default filters (always include time range, always limit rows)
- Banned patterns (no `SELECT *`, no cross-joins, no `ALLOW FILTERING`)

### Output Parsing

How to transform raw results into structured output:
- Column alignment for terminal display
- Null/empty highlighting
- Aggregation for large result sets
- Linking to related entities for follow-up queries

## Anti-Patterns

| Anti-Pattern | Why It's Dangerous | Correct Approach |
|---|---|---|
| `SELECT * FROM large_table` | Full table scan, potential OOM | Always filter by key + limit |
| Retrying timed-out query | Same result, wastes resources | Narrow the filter instead |
| Connecting as admin user | Accidental writes possible | Dedicated read-only role |
| Showing raw output without context | User can't interpret 50 columns | Select relevant fields, explain |
| Caching credentials in files | Security risk | Environment variables only |

## When NOT to Use This Pattern

- When you need to write/mutate data (use the **Mutate** pattern)
- When you need to verify claims across multiple sources (use the **Verify** pattern)
- When the "query" is actually triggering a job (use the **Pipelines** pattern)
