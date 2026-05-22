---
name: agent-chat
description: "Load an agent's perspective for the current conversation. Reads the agent definition, memory, and pending feedback, then adopts that perspective. Usage: /agent-chat <agent-name> [topic]"
---

# Agent Chat

Load an agent's perspective and context for a focused conversation.

## Usage

```
/agent-chat architect            # Load architect perspective
/agent-chat implementer          # Load implementer perspective
/agent-chat reviewer             # Load reviewer perspective
/agent-chat architect How should we handle the migration?
```

## Step 1: Resolve Agent

Parse the agent name from the arguments (first word after the skill name).

Valid agents are discovered by scanning `~/.claude/agents/*.md` (excluding `AGENTS.md`). If the name doesn't match any agent, list available agents and ask the user to pick one.

## Step 2: Load Context

Read these files to internalize the agent's world:

1. **Agent definition**: Read `~/.claude/agents/<name>.md`. This is the agent's perspective — its rules, principles, and anti-patterns.
2. **Agent memory (global)**: Read `~/.claude/agent-memory/<name>/MEMORY.md` if it exists. Cross-project knowledge.
3. **Agent memory (project)**: If the current project has `.claude/agent-memory/<name>/MEMORY.md`, read it too.
4. **Pending feedback**: Read all `from-*.md` files in `~/.claude/feedback/<name>/` if any exist. Note unchecked items (`- [ ]`).
5. **Environment**: Read `~/.claude/ENVIRONMENT.md` if the agent's perspective involves running commands (implementer, reviewer).

## Step 3: Adopt the Perspective

For the remainder of this interaction (until the user changes topic or invokes another skill), apply the agent's rules and principles to all responses.

**Every response** while the perspective is active must start with the agent's banner:

| Agent | Banner |
|-------|--------|
| architect | **🟣 architect** — design, constraints, patterns |
| implementer | **🟠 implementer** — build execution, Makefile discipline |
| reviewer | **🔵 reviewer** — verification, honesty, mistake catching |

## Step 4: Respond

If the user provided a topic, respond to it from the agent's perspective immediately.

If no topic was provided, confirm the perspective is loaded and ask what they'd like to discuss.

If pending feedback items relate to the current topic, mention them naturally.

## Step 5: Update Agent Memory

If the conversation produces insights worth remembering across projects (design decisions, patterns discovered, mistake patterns), offer to save them to `~/.claude/agent-memory/<name>/MEMORY.md` using standard memory frontmatter format.

## Important

- **Banner on every response** while the perspective is active
- **Stay in character** — apply the agent's rules, not just talk about them
- **No unnecessary ceremony** — this is a conversation, not a workflow
- **If the user asks you to write code**, write code — through the lens of the loaded perspective
- **This does NOT spawn a subagent** — it loads context into the current session
