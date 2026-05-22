---
name: build-fix
description: Run a JVM project build (SBT or Gradle), parse compilation errors and test failures, fix them iteratively, and report progress. Auto-detects the build tool from project files. Invoke when asked to build, compile, test, or fix a Scala/Java/Kotlin project. Operates in fix cycles (max 5) — reads only broken files, applies minimal fixes, re-runs the build.
---

# Build-Fix Skill

Iteratively build a JVM project (SBT or Gradle), diagnose failures, apply minimal fixes, and re-run until green or the cycle limit is reached.

## When to Use

- User asks to build, compile, or test an SBT or Gradle project
- User asks to fix compilation errors or test failures in a Scala/Java/Kotlin codebase
- User invokes `/build-fix` directly

## Prerequisites

- The build tool must be installed and on PATH (`sbt` for SBT projects, or `./gradlew` wrapper for Gradle projects)
- Working directory (or a user-specified directory) must contain `build.sbt` (SBT) or `build.gradle` / `build.gradle.kts` (Gradle)

## Execution Steps

### Step 0: Detect Build Tool

Look for project marker files in the working directory (or user-specified directory):

| Marker File | Build Tool | Command Prefix |
|-------------|-----------|----------------|
| `build.sbt` | SBT | `sbt --no-colors` |
| `build.gradle.kts` | Gradle (Kotlin DSL) | `./gradlew --console=plain` |
| `build.gradle` | Gradle (Groovy DSL) | `./gradlew --console=plain` |
| `gradlew` | Gradle (wrapper) | `./gradlew --console=plain` |

**Priority:** If both `build.sbt` and `build.gradle*` exist, ask the user which to use.

For Gradle projects, always prefer the wrapper (`./gradlew`) over a global `gradle` install.
Use `--console=plain` (Gradle) or `--no-colors` (SBT) so ANSI codes don't pollute parsing.

### Step 0.5: Detect and Start Sidecars

Before running the build, check if the project requires sidecar services (databases, message brokers, caches, etc.):

1. **Look for sidecar indicators** in the project directory:
   - `docker-compose.yml` / `docker-compose.yaml` / `compose.yml`
   - `docker-compose.test.yml` or similar test-specific compose files
   - Scripts like `start-sidecars.sh`, `start-deps.sh`, `start-local.sh` in `scripts/`, `bin/`, or project root
   - README or CONTRIBUTING docs mentioning required services
   - Test configuration files referencing `localhost` ports for external services (Cassandra, Kafka, Redis, PostgreSQL, etc.)
   - SBT/Gradle config with `IntegrationTest` scope or `it` source sets

2. **If sidecars are found**, start them before running the build:
   ```bash
   # Docker Compose (most common)
   docker compose up -d 2>&1
   # Or project-specific script
   ./scripts/start-sidecars.sh
   ```
   Wait for services to become healthy (check `docker compose ps` or poll the relevant ports) before proceeding to Step 1.

3. **If no sidecars are found**, proceed directly to Step 1.

**CRITICAL: Never skip integration tests because sidecars aren't running.** If tests abort during initialization (e.g., connection refused, timeout connecting to localhost:9042), that means sidecars need to be started — not that the tests should be skipped or reported as "infrastructure issues." Find and start the required services, then re-run.

### Step 1: Run the Build

Run the full build command and **capture all output to a temp file**. This is the single source of truth for diagnosing failures — never re-run the build just to see what went wrong.

**SBT:**
```bash
sbt --no-colors clean compile test 2>&1 | tee /tmp/build-fix-output.log
```

**Gradle:**
```bash
./gradlew --console=plain clean compileScala compileTestScala test 2>&1 | tee /tmp/build-fix-output.log
```

If the Gradle project uses Java/Kotlin instead of Scala, use `compileJava compileTestJava` or `compileKotlin compileTestKotlin` as appropriate — or just `build` to let Gradle figure it out:
```bash
./gradlew --console=plain clean build 2>&1 | tee /tmp/build-fix-output.log
```

**Timeout:** Allow up to 10 minutes. Multi-module projects can be slow.

**IMPORTANT — Build output efficiency:** The temp file (`/tmp/build-fix-output.log`) is your single source of truth. After the build completes:
- Use `Read` on the temp file to inspect errors, stack traces, or test output.
- **NEVER re-run the build command** just to see what failed. The output is already captured.
- If the Bash tool output was truncated, read the temp file with offset/limit to find the relevant section.
- Use `Grep` on the temp file to find specific error patterns (e.g., `grep -n "FAILED\|error:" /tmp/build-fix-output.log`).

### Step 2: Parse Failures

Scan the **captured build output** (read from `/tmp/build-fix-output.log`) for two categories:

#### Compilation Errors

**SBT pattern:** `[error] /path/to/File.scala:LINE:COL: message`

**Gradle patterns:**
- `e: file:///path/to/File.kt:LINE:COL message` (Kotlin)
- `/path/to/File.scala:LINE: error: message` (Scala)
- `/path/to/File.java:LINE: error: message` (Java)
- `> Compilation failed; see the compiler error output for details.`

Extract:
- File path
- Line number
- Error message

#### Test Failures

**SBT patterns:**
- `[error] Test ... failed`
- `- should do X *** FAILED ***`
- `[info] *** N TESTS FAILED ***`
- ScalaTest/specs2/MUnit failure traces

**Gradle patterns:**
- `> Task :module:test FAILED`
- `FAILED` in test summary
- `> There were failing tests. See the report at: file:///path/to/index.html`
- JUnit/ScalaTest XML reports in `build/reports/tests/`

Extract:
- Test class (from the file path or fully-qualified name)
- Test name
- Failure message / assertion details
- Stack trace (first relevant frame pointing to test source)

**Gradle tip:** When Gradle reports `See the report at: file:///...index.html`, read the corresponding XML test results instead (same directory, under `../xml/`), as they are more parseable.

### Step 3: Fix

For **each** failure:

1. **Read only the directly relevant source file** — the file mentioned in the error. Do NOT explore broadly.
2. **Diagnose** the root cause from the error message + source context.
3. **Apply the minimal fix** using the Edit tool. Prefer the smallest change that resolves the error:
   - Missing import → add the import
   - Type mismatch → fix the type
   - Missing method → add or correct the method signature
   - Test assertion wrong → fix the assertion or the code under test (prefer fixing code if the test intent is clear)
   - Deprecation error → update to the non-deprecated API
4. **Do NOT refactor**, add comments, or "improve" surrounding code.

### Step 4: Re-run the Build

After applying fixes, re-run without `clean` to speed things up. **Capture output to the same temp file** so you can inspect failures without re-running again:

**SBT:**
```bash
sbt --no-colors compile test 2>&1 | tee /tmp/build-fix-output.log
```

**Gradle:**
```bash
./gradlew --console=plain build 2>&1 | tee /tmp/build-fix-output.log
```

**Same efficiency rule applies:** If this build fails, diagnose from `/tmp/build-fix-output.log`. Do NOT re-run the build a third time just to read the errors.

### Step 5: Report

After each cycle, output a status report:

```
## Cycle N/5

**Build tool:** SBT | Gradle
**Build result:** PASS | FAIL
**Compilation errors:** X remaining (was Y)
**Test results:** A passed, B failed (was C failed)
**Files changed:** list of files edited this cycle

### Errors Fixed
- File.scala:42 — missing import for FooBar
- File.kt:78 — type mismatch: expected Int, got String

### Errors Remaining
- File.scala:120 — unresolved reference to `bazQuux`
```

### Step 6: Loop or Finish

- **If all tests pass:** Report success and stop.
- **If failures remain and cycles < 5:** Go to Step 3.
- **If 5 cycles exhausted:** Report the remaining failures and stop. Do NOT continue indefinitely.

## Safety Rules

1. **Max 5 cycles.** Never exceed this. Report what's left and stop.
2. **Minimal fixes only.** Do not refactor, reorganize, or "improve" code beyond what's needed to fix the error.
3. **Read only broken files.** Do not explore the codebase broadly. Only read files directly referenced in error output.
4. **No dependency changes** without user approval. If a fix requires adding/changing a dependency in `build.sbt` or `build.gradle.kts`, present the change and ask before applying.
5. **No ignoring tests.** Never skip, comment out, or `@Ignore` a failing test to make the build pass.
6. **Preserve intent.** If a test failure suggests the test is correct and the implementation is wrong, fix the implementation. If the test is clearly wrong (e.g., outdated assertion after an intentional change), fix the test. When ambiguous, ask the user.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `sbt` not found | Ask user to install: `brew install sbt` or `cs setup` |
| `./gradlew` not found | Check if `gradlew` exists; may need `chmod +x gradlew` |
| `./gradlew` permission denied | Run `chmod +x gradlew` |
| Out of memory (SBT) | Suggest adding `-J-Xmx4g` flag |
| Out of memory (Gradle) | Suggest adding `-Dorg.gradle.jvmargs=-Xmx4g` to `gradle.properties` |
| Dependency resolution fails | SBT: check `~/.sbt` and `~/.ivy2` caches. Gradle: check `~/.gradle/caches`. May need `clean build` or `sbt update` |
| Flaky test | Note it in the report; don't count it as a real failure if it passes on re-run |
| Build hangs | Kill after timeout; report to user |
| Both `build.sbt` and `build.gradle*` exist | Ask the user which build tool to use |
