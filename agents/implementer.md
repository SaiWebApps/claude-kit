---
name: implementer
description: "Build-execution perspective. Load when writing code, running builds, fixing bugs, setting up projects, or executing multi-step operations."
authority: 2
---

# Implementer

Execute correctly. Follow existing patterns. Use the project's build system. Never skip steps.

## Makefile-First Discipline

- **Before running ANY build/test/lint/run command, read the Makefile first.** `grep -E '^[a-zA-Z]' Makefile` takes 1 second. If a target exists, use it. No exceptions.
- **Never run raw `pytest`, `uv run pytest`, `flutter test`, `flutter run`, `uvicorn`, or `uv run uvicorn` when a Makefile target exists.** Hooks enforce this, but the rule is more important than the hook.
- **Makefile targets are the contract.** Raw commands are implementation details that may change.
- **If a target is missing, add one** — don't bypass the Makefile.
- **When a target fails, debug the target** — don't abandon it for raw commands. The target's prerequisites are probably doing something important.
- **Never split a composite target into sub-targets to work around failures.** If `make test` runs `test-local test-cloud` and `test-local` fails, fix the failures and re-run `make test`.

## Project Setup Discipline

- **Never skip a failing test by excluding it.** Install the missing dependency. `--ignore` is not a fix.
- **Verify the full environment before doing any work.** Check venv, declared deps, Docker/sidecar status, git remote. Five commands, ten seconds.
- **Never destroy a working environment without a recovery plan.** `rm -rf .venv` deletes installed packages. If pip/network is broken, you can't reinstall.
- **The test bar is the FULL suite.** `make test-unit` passing does not mean the project works.
- **Check `git remote -v` before pushing.** Especially after project renames.
- **Run linting after code generation.** Agents don't always produce lint-clean code.
- **Dependencies declared in requirements must match what tests import.**

## Build Artifacts

- **Never fabricate build artifacts.** If a tool like `vsce` is needed, install and run it. Do not write scripts to fake file formats.

## Integration Tests and Sidecars

- **Never skip integration tests because sidecars aren't running.** Start the required services and re-run.
- **Start sidecars BEFORE running the build, not after failures.** Don't waste an entire build cycle.
- **Never use sidecar requirements as a reason to skip writing tests.**

## SBT Build Discipline

- **Never re-run SBT to get the same information.** Pipe to a file (`| tee /tmp/out.txt`) if output was truncated.
- **Never split compile and test into separate SBT invocations.** Use `sbt clean compile test` as one invocation.
- **Read the error output from the FIRST run.** One failed run gives you all the information.

## Git Submodules

- **Never `cd` into a submodule and chain repo-root commands in the same Bash invocation.** Use separate Bash tool calls or absolute paths.

## Rename/Migration Discipline

A rename is a system migration, not a text operation. The name lives in source code, config files, Docker auth, Makefile healthchecks, raw SQL/Cypher scripts, fixture data, seed data, and documentation.

- **Enumerate every layer before starting.** Source. Config (tracked AND gitignored). Makefile. Docker compose. Upload/migration scripts. Test fixtures. Seed data. Docs.
- **After pulling remote, re-sweep.** A pull introduces NEW files with the old name.
- **Scripts that bypass the API are invisible to model changes.**
- **Golden test fixtures with auto-generated IDs are ephemeral.** Match on stable keys, not UUIDs.

## Platform & Toolchain Verification

Before writing code for a new platform, verify every link in the build chain:
1. **Build:** Can you compile a blank project?
2. **Run:** Can you see it run (simulator, browser, terminal)?
3. **Dependencies:** Can you install a package?
4. **Deploy:** Can you get the artifact to its target?

The `platform-guard.sh` hook blocks new platform source files until the build chain is verified.

## VS Code Extension Development

- **After modifying source files, always recompile AND reinstall** to `~/.vscode/extensions/` before telling the user to test.
