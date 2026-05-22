---
name: agent-feedback
description: "Route feedback to a specific agent's queue. Appends a timestamped checklist item. Usage: /agent-feedback <agent-name> <message>"
---

# Agent Feedback

Route a task or message to a specific agent's feedback queue.

## Usage

```
/agent-feedback architect Review the database schema changes
/agent-feedback reviewer Check the security implications of the auth flow
/agent-feedback implementer The Makefile is missing a test-cloud target
```

## Step 1: Parse Arguments

The first word after the skill name is the agent name. Everything else is the feedback message.

Validate the agent name against files in `~/.claude/agents/` (excluding `AGENTS.md`). If no match, list available agents and ask the user to pick one.

If no message was provided, ask the user what feedback they want to send.

## Step 2: Write Feedback

The target file is `~/.claude/feedback/<agent>/from-user.md`.

If the file doesn't exist, create it with:
```markdown
# Feedback for <agent> from user
```

Append a new checklist item at the end of the file:

```markdown
- [ ] **YYYY-MM-DD HH:MM** — <first sentence as summary>

  <full feedback message, preserving the user's exact words>
```

Use the current date and time (not relative). The summary is the first sentence or a short summary of the user's message.

## Step 3: Confirm and Show Status

Tell the user what was added and where, then run the status dashboard:

```bash
bash ~/.claude/scripts/agent-status.sh
```

Display the dashboard output so the user can see all agent queue states.

## Important

- **Preserve the user's words verbatim** — do not summarize, rephrase, or editorialize
- **Always use checklist format** (`- [ ]`) so agents can check items off when processed
- **Each sender has their own file** — `from-user.md` for human feedback, `from-<agent>.md` for bot-to-bot messages
- **Feedback directories are in `~/.claude/feedback/`** — one subdirectory per agent
