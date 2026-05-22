---
name: agent-status
description: "Show agent feedback queues, memory sizes, and active worktrees. Usage: /agent-status"
---

# Agent Status

Show the current state of all agents — feedback queues, memory, and worktrees.

## Execution

Run the following status checks inline (no external script dependency):

### 1. List Agents

```bash
echo "=== Agents ==="
for f in ~/.claude/agents/*.md; do
  [ -f "$f" ] && basename "$f" .md
done
```

### 2. Feedback Queue Counts

```bash
echo ""
echo "=== Feedback Queues ==="
for dir in ~/.claude/feedback/*/; do
  [ -d "$dir" ] || continue
  agent=$(basename "$dir")
  pending=$(grep -r '^\- \[ \]' "$dir" 2>/dev/null | wc -l | tr -d ' ')
  done_count=$(grep -r '^\- \[x\]' "$dir" 2>/dev/null | wc -l | tr -d ' ')
  echo "  $agent: $pending pending, $done_count done"
done
```

### 3. Memory File Counts

```bash
echo ""
echo "=== Agent Memory ==="
for dir in ~/.claude/agent-memory/*/; do
  [ -d "$dir" ] || continue
  agent=$(basename "$dir")
  count=$(find "$dir" -type f -name "*.md" | wc -l | tr -d ' ')
  echo "  $agent: $count memory files"
done
```

Display the combined output as-is.

## Detailed View

If the user asks about a specific agent, also read and summarize:

1. **Definition**: `~/.claude/agents/<name>.md` — the agent's perspective and rules
2. **Memory**: `~/.claude/agent-memory/<name>/MEMORY.md` — what the agent remembers across projects
3. **Feedback**: All `~/.claude/feedback/<name>/from-*.md` files — pending items with full text

Present pending feedback items as a numbered list so the user can triage them.

## Queue Management

If the user asks to clear, mark done, or reassign feedback items:

- **Mark done**: Change `- [ ]` to `- [x]` in the relevant `from-*.md` file
- **Reassign**: Copy the item to a different agent's `from-user.md`, mark the original as `- [x] (reassigned to <agent>)`
- **Clear all**: Mark all items as `- [x]` in the specified agent's feedback directory
