# claude-kit

A curated toolkit of Claude Code skills, agent perspectives, and behavioral hooks.

## Quick Start

```bash
git clone <this-repo> ~/git/claude-kit
cd ~/git/claude-kit
./install.sh
```

After installation, start a Claude Code session and try:
```
/forge "Should I use a monorepo or polyrepo for my new project?"
```

## What's Inside

| Directory | Contents | Purpose |
|-----------|----------|---------|
| `skills/` | 10 skill definitions | Slash commands that extend Claude Code |
| `agents/` | 10 agent perspectives | Specialized viewpoints for multi-perspective reasoning |
| `patterns/` | 4 pattern guides with examples | Reusable templates for building your own skills |
| `hooks/` | Behavioral enforcement scripts | Pre/post tool-use guardrails |
| `harness/` | CLAUDE.md template + settings | Project-level behavioral configuration |
| `personas/` | Role-based persona definitions | Context switching between roles |
| `examples/` | Agent memory directory | Reference for setting up cross-session memory |

### Skills

| Skill | Description |
|-------|-------------|
| `forge` | Multi-perspective answer + hostile evidence-gated verification behind a JS gate |
| `ship` | Atomic commit-and-push; asks where to ship on first use, remembers per-repo, creates the repo if missing |
| `retro` | Session retrospective — catalog mistakes, extract learnings |
| `build-fix` | Iterative build-fix cycles for JVM projects |
| `error-diagnosis` | Structured error analysis before retrying |
| `prwalk` | Walk GitHub PRs and produce a file reading order |
| `agent-chat` | Load a single agent's perspective |
| `agent-feedback` | Route async feedback to an agent's queue |
| `agent-status` | Show agent feedback queues and memory sizes |
| `persona` | Switch between role-based contexts |

## Patterns

Patterns are guides for building your own skills. Each includes a `PATTERN.md` explaining the approach and an example skill demonstrating it.

| Pattern | When to Use |
|---------|-------------|
| `observe` | Read-only queries against external systems (databases, APIs, logs) |
| `mutate` | Write operations that change state (API calls, database writes) |
| `verify` | Validation and testing workflows (end-to-end checks, assertions) |
| `pipelines` | CI/CD interaction (trigger builds, check status, read logs) |

## Agent System

Agents are specialized perspectives that Claude adopts during reasoning. They are not separate processes — they are prompts that focus attention on a specific concern.

The `/forge` skill launches parallel agent perspectives on a topic, then runs hostile, evidence-gated verification behind a deterministic JS gate before returning a recommendation. Agents can accumulate wisdom across runs via persistent memory files.

### Built-in Agents

- **architect** — design, constraints, patterns, end-to-end thinking
- **implementer** — build execution, Makefile discipline, project setup
- **reviewer** — verification, honesty, catching mistakes
- **tester** — test strategy, coverage, infrastructure
- **ops** — deployment, cost optimization, config auditing
- **domain** — project-specific business logic and data models
- **user-advocate** — usability, error clarity, cognitive load
- **explorer** — fact-gathering, codebase search, file discovery
- **researcher** — external knowledge, documentation, package discovery
- **prior-art** — existing-solution detection, build-vs-buy assessment

### Customization

Copy `agents/domain.md` and fill in your project's terminology, data models, and common pitfalls. Add new agents when the gap is felt — not before.

## Hooks

Hooks are shell scripts that run before or after Claude uses a tool. They enforce behavioral rules that CLAUDE.md alone cannot guarantee.

- **PreToolUse hooks** can block a tool call (return `{"decision":"block","reason":"..."}`)
- **PostToolUse hooks** provide advisory feedback after an action completes

Register hooks in `.claude/settings.json` — see `harness/examples/settings.json` for the format.

## Harness

The harness is a CLAUDE.md template that configures Claude Code's behavior for your project. It covers:

- Effort standards (prove it works, full test suite, check downstream)
- Communication rules (report before acting, never go silent)
- Honesty contract (distinguish verified from believed)
- Diagnosis protocol (read error, identify root cause, fix, document)
- Build discipline (use Makefile targets, zero lint errors)

Copy `harness/CLAUDE.md` to your project root and customize it.

## Customization

### Adding a skill

1. Create `skills/<name>/SKILL.md` with frontmatter (name, description) and instructions
2. Read the pattern guide that matches your skill type (observe, mutate, verify, pipelines)
3. Follow the example in that pattern's directory

### Creating an agent

1. Create `agents/<name>.md` with the agent's perspective, authority level, and focus areas
2. Update `agents/AGENTS.md` to add it to the roster
3. The `/forge` skill will automatically consider it for relevant topics

### Writing a hook

1. Write a shell script that reads tool input/output from stdin or arguments
2. For blocking hooks: output JSON with `{"decision":"block","reason":"..."}`
3. For advisory hooks: output a message string (or nothing if no issue)
4. Register in `.claude/settings.json` under the appropriate matcher

## Philosophy

- **Zero-config skills work immediately.** Copy the skill file, use the slash command. No setup, no dependencies, no configuration.
- **Patterns teach, not template.** Each pattern explains the underlying approach so you can build skills for your own systems, not just use the examples.
- **Agents accumulate wisdom.** Memory persists across sessions. Each run makes agents smarter for the next one. Domain knowledge compounds.
- **Hooks enforce what rules cannot.** CLAUDE.md rules are suggestions that Claude may forget. Hooks are mechanically enforced — they block the tool call before it executes.
