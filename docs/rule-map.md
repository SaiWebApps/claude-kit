# Rule Map — one home per behavioral rule

_The behavioral rules used to live in 3–6 places each (harness prose, the hooks, retro's table, the agents, even forge.js) and had drifted. This map fixes the source of truth: **`harness/CLAUDE.md` is the ONE canonical prose home.** `skills/retro/SKILL.md`'s 30-row table is a failure **catalog** that references rules — not a rival source. The hooks **enforce** rules; their header comment cites the canonical section. Agents will be re-pointed in Phase 3. Edit a rule in its home; everywhere else points here._

## The eight rules → their one home

| Rule | Statement | Canonical home (edit here) | Mechanical enforcement | retro catalog # |
|---|---|---|---|---|
| (a) | Use the build system: `make`/full-suite is the bar, not raw commands | `harness/CLAUDE.md` § Build Discipline + § Effort Standards ("Full suite, not subset") | `hooks/prevent-laziness.sh` (Makefile enforcement) | #1, #13 |
| (b) | 0 failures **and** 0 skipped; never skip / `--ignore` / delete a test | `harness/CLAUDE.md` § Effort Standards ("0 failures AND 0 skipped is the bar") | `hooks/prevent-laziness.sh` (`--ignore`, `-k "not"`, `-DskipTests`, `.skip`, test-file delete) | #14 |
| (c) | Distinguish verified from believed; one doubt → PARTIALLY VERIFIED | `harness/CLAUDE.md` § Honesty Contract | `forge` gate (answer-time) | Phase-1 #4/#7 |
| (d) | Diagnosis Protocol: read the error → root cause → fix → re-run | `harness/CLAUDE.md` § Diagnosis Protocol | `hooks/error-diagnosis-trigger.sh` → `skills/error-diagnosis/SKILL.md` (same 5 steps) | #7 |
| (e) | Never blame external systems without evidence | `harness/CLAUDE.md` § Diagnosis Protocol → "Evasion red flags" | — | #6 |
| (f) | No silent pivot; report before & after | `harness/CLAUDE.md` § Communication Contract | — | #10, #11 |
| (g) | No stubs / placeholders / TODOs shipped as "done" | `harness/CLAUDE.md` § Build Discipline ("Never ship a stub or placeholder") | `hooks/prevent-laziness.sh` (placeholder/stub/empty-catch/lint-suppress) | #15 |
| (h) | Commit message comes from the diff, not from context | `harness/CLAUDE.md` § Session Hygiene | `hooks/commit-message-audit.sh` | — |

## The one escalation ladder (numbers pinned, not changed)

The response to the **same failing action** escalates by attempt count. Advisory rungs fire early (cheap, self-correcting); mechanical rungs are the backstop when advice is ignored. Different rungs legitimately fire at different counts — this is **one ladder**, not five copies of one number.

| Rung | Fires at | Where | Kind |
|---|---|---|---|
| R1 Diagnose | 1st failure | `hooks/error-diagnosis-trigger.sh` + `error-diagnosis` skill + CLAUDE.md § Diagnosis Protocol | advisory |
| R2 Self-stop / ask | 2nd attempt | `harness/CLAUDE.md` § Escalation + retro #27 + `forge.js` `MAX_CYCLES=2` | advisory |
| R3 Mechanical WARN | 3rd edit / 4th bash-retry | `workaround-spiral-detector.sh` (`COUNT -ge 3`) / `prevent-laziness.sh` (`BASH_COUNT -ge 4`) | mechanical |
| R4 Mechanical BLOCK | 4th edit / 5th bash-retry | `workaround-spiral-detector.sh` (`COUNT -ge 4`) / `prevent-laziness.sh` (`BASH_COUNT -ge 5`) | mechanical |

**Why the edit-spiral (3/4) blocks sooner than the bash-retry (4/5):** each edit to a build-config file is a substantive change, so re-editing the same `Makefile` 4× is thrash; re-running an *identical* build/test command is often legitimate (run-after-fix) **and the retry counter never resets on success** (see follow-ups), so it gets one extra attempt before the hard block. The numbers are pinned by `hooks/hooks-smoke.sh` so they can't silently drift again.

## Settings & path conventions (one each)

- **Settings file:** `settings.json` only. It is what `install.sh` seeds to `$CLAUDE_CONFIG_DIR` and what `harness/examples/` ships. `settings.local.json` is Claude Code's gitignored per-project **local override** — the kit does not manage it. (`retro` was the lone outlier saying `settings.local.json`; fixed.)
- **Rules path:** `$CLAUDE_CONFIG_DIR/CLAUDE.md` (default `~/.claude/CLAUDE.md`) for the global harness, plus project-root `./CLAUDE.md` for overrides — matching what `install.sh` seeds. (`retro` said `~/CLAUDE.md`; fixed to the `$CLAUDE_CONFIG_DIR` convention.)

## Deferred follow-ups (recorded, not done here)

- **Phase 2.5 — reset-on-success.** The two PreToolUse spiral counters never reset, so a long productive session slowly accrues count. A `PostToolUse` companion that clears the counter file on a zero exit code would remove the false-positive risk and let the ladder tighten (e.g. unify both hooks to warn@3/block@4). New behavior → its own change.
- **Phase 3 — re-point the agents.** `agents/{architect,implementer,ops,tester,reviewer,…}.md` still restate rules (a)/(b)/(c)/(d) and carry stack-specific war stories. When the roster consolidates 10→4, replace restatements with pointers here and move war stories to per-agent memory.
- **Phase 4 — forge path strings.** `workflows/forge.js` + `skills/forge/SKILL.md` + all 14 forge tests hardcode `~/.claude-work/...`; the digest text says `~/.claude-work/CLAUDE.md` while `forge.js`'s `KIT_BASE` already resolves `${CLAUDE_CONFIG_DIR:-$HOME/.claude}`. Reconcile when forge is next touched (it is uncommitted).
