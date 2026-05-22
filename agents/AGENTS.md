# Agent Index

## Roster

| Name | Definition | Authority | Perspective |
|------|-----------|-----------|-------------|
| architect | `architect.md` | 1 (merges first) | Design, patterns, constraints, end-to-end thinking |
| implementer | `implementer.md` | 2 | Build execution, Makefile discipline, project setup, migration |
| reviewer | `reviewer.md` | 3 (advisory) | Verification, honesty, mistake catching |
| domain | `domain.md` | 3 (advisory) | Project-specific business logic, data models, domain vocabulary |
| tester | `tester.md` | 4 (advisory) | Test strategy, coverage, infrastructure, platform verification |
| ops | `ops.md` | 5 (advisory) | Deployment, cost optimization, config auditing, infra safety |
| user-advocate | `user-advocate.md` | 5 (advisory) | Usability, error clarity, cognitive load |
| explorer | `explorer.md` | 0 (support) | Fact-gathering, codebase search, file/pattern discovery |
| researcher | `researcher.md` | 0 (support) | External knowledge, documentation, package discovery |
| prior-art | `prior-art.md` | 0 (support) | Existing-solution detection, build-vs-buy assessment |

## Authority Order

When agents produce conflicting output, merge in authority order:
1. **architect** — design decisions take precedence
2. **implementer** — implementation details
3. **reviewer / domain** — advisory, files feedback but does not override
4. **tester** — advisory, test strategy and coverage
5. **ops / user-advocate** — advisory, deployment, infrastructure, usability

## How to Use

### Quick perspective check
```
/agent-chat architect     # Design thinking for current task
/agent-chat implementer   # Build discipline for current task
/agent-chat reviewer      # Challenge your work before presenting
/agent-chat domain        # Validate against project domain rules
```

### Multi-perspective discussion
```
/meeting <topic>          # All agents discuss in parallel, synthesize
```

### Self-verification (mandatory for non-trivial results)
Before presenting results, apply the reviewer's checklist from `reviewer.md`.

## Per-Agent Memory

Cross-project knowledge persists in:
```
~/.claude/agent-memory/<agent>/MEMORY.md       # global, cross-project
```

Project-specific agent knowledge can be checked into the project:
```
<project>/.claude/agent-memory/<agent>/MEMORY.md       # committed
<project>/.claude/agent-memory/<agent>/MEMORY.local.md  # gitignored
```

## Feedback Queues

Async messages between agents or from the user:
```
~/.claude/feedback/<target>/from-<sender>.md
```

Each sender writes to their own file in the target's directory. Per-sender files eliminate merge conflicts when agents work in parallel.

Format:
```markdown
- [ ] **YYYY-MM-DD HH:MM** — <summary>

  <full feedback body>
```

## Customization

### Adding a domain expert
Copy `domain.md` and fill in the placeholder sections with your project's:
- Business domain description
- Key terminology and definitions
- Data flow and module ownership
- Common domain-specific pitfalls

### Adding new agents
Add when the gap is felt, not before. Create `<name>.md` with frontmatter (name, description, authority) and update this index.
