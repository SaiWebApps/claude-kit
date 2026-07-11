# Agent Index

> **Two layers.** The **primary roster** (4 agents) is the interface for the software-development
> lifecycle — start here. The **forge panel lenses** (the original 10) are retained underneath because
> `/forge` routes a subset of them as generator perspectives; they are not deleted. The consolidation
> map connects the two, and the war-story extraction is a recorded follow-up. Nothing here was removed.

## Primary roster (start here)

Consolidated from 10 → 4. Their value is **structural** (independent, adversarial, or scarce-knowledge),
not "remind the model to think about X" — which a strong model no longer needs.

| Agent | Definition | Reach for it when |
|-------|-----------|-------------------|
| **scout** | `scout.md` | You need facts: what exists in the codebase, what exists on the web, and the build-vs-buy verdict. One cited digest; keeps context lean. |
| **skeptic** | `skeptic.md` | Anything is claimed done/fixed/proven. Hostile, fresh-context verifier with a hard win condition (name a defect or certify the attacks you ran). Never grades its own work. |
| **product-owner** | `product-owner.md` | Turning a request into the smallest slice + testable EARS acceptance criteria (front), and judging whether the built thing is actually good for the user (back). |
| **domain** | `domain.md` | Validating against project business logic, data models, and vocabulary the model can't infer. A fill-in knowledge template. |

## Forge panel lenses (retained — do not delete or rename)

The original 10 remain as `/forge`'s validated panel perspectives. **9 of them are forge's `KNOWN_ROLES`**
(`workflows/forge.js`) — forge routes up to 3 as generators and loads each one's
`agent-memory/<role>/MEMORY.md`, so removing or renaming any would break `forge.memory.test` and the panel
picker. `researcher` is the 10th (folded into `scout` conceptually; its file stays).

| Name | Definition | Authority | Perspective | KNOWN_ROLE? |
|------|-----------|-----------|-------------|-------------|
| architect | `architect.md` | 1 (merges first) | Design, patterns, constraints, end-to-end thinking | yes |
| implementer | `implementer.md` | 2 | Build execution, Makefile discipline, project setup, migration | yes |
| reviewer | `reviewer.md` | 3 (advisory) | Verification, honesty, mistake catching | yes |
| domain | `domain.md` | 3 (advisory) | Project-specific business logic, data models, domain vocabulary | yes |
| tester | `tester.md` | 4 (advisory) | Test strategy, coverage, infrastructure, platform verification | yes |
| ops | `ops.md` | 5 (advisory) | Deployment, cost optimization, config auditing, infra safety | yes |
| user-advocate | `user-advocate.md` | 5 (advisory) | Usability, error clarity, cognitive load | yes |
| explorer | `explorer.md` | 0 (support) | Fact-gathering, codebase search, file/pattern discovery | yes |
| researcher | `researcher.md` | 0 (support) | External knowledge, documentation, package discovery | no |
| prior-art | `prior-art.md` | 0 (support) | Existing-solution detection, build-vs-buy assessment | yes |

When these lenses produce conflicting output inside `/forge`, merge in authority order: architect →
implementer → reviewer/domain → tester → ops/user-advocate.

## Consolidation map (old → new)

| Original lens | New primary agent |
|---|---|
| explorer | → **scout** |
| researcher | → **scout** |
| prior-art | → **scout** |
| reviewer | → **skeptic** |
| tester | → **skeptic** |
| retro Prosecutor / Excuse-Detector ethos | → **skeptic** |
| user-advocate | → **product-owner** |
| domain | → **domain** (unchanged) |
| architect | → *deferred:* durable gates → phase checklists; war stories → `agent-memory/architect` |
| implementer | → *deferred:* durable gates → phase checklists; war stories → `agent-memory/implementer` |
| ops | → *deferred:* durable gates → phase checklists; war stories → `agent-memory/ops` |

## Deferred (Phase 3.x / Phase 4 follow-ups)

architect / implementer / ops are **not** standalone primary agents. Their durable, portable gates become
explore/plan/code **phase checklists**; their stack-specific **war stories** move into per-agent memory so
the roster stays portable across stacks. The four durable gates to extract:

- **use-the-build-system** — `implementer.md` "Makefile-First Discipline"
- **platform hello-world** — `implementer.md` / `tester.md` "Platform Verification" (compile → run → install a package → deploy, before writing code)
- **topology-before-state** — `architect.md` "Check deployment topology BEFORE designing in-memory state" / `ops.md` replica-count rule
- **research-before-hand-rolling** — `architect.md` "Research Before Building" gate

Also deferred to Phase 4 (forge is uncommitted): adding scout/skeptic/product-owner to `KNOWN_ROLES` and
seeding their `agent-memory`, so `/forge` can route to the consolidated roster directly.

## How to Use

```
/agent-chat scout           # gather facts (internal + external) for the current task
/agent-chat skeptic         # hostile verification before presenting/committing
/agent-chat product-owner   # requirements + acceptance criteria, or is-it-good-for-the-user
/forge <topic>              # panel lenses discuss in parallel, synthesize behind the JS gate
```

Before presenting non-trivial results, run the **skeptic** in a fresh context (it must name a defect or
certify the attacks it ran).

## Per-Agent Memory

Cross-project knowledge persists in:
```
$CLAUDE_CONFIG_DIR/agent-memory/<agent>/MEMORY.md       # global, cross-project (default ~/.claude)
```
Project-specific agent knowledge can be checked into the project:
```
<project>/.claude/agent-memory/<agent>/MEMORY.md        # committed
<project>/.claude/agent-memory/<agent>/MEMORY.local.md  # gitignored
```

## Feedback Queues

Async messages between agents or from the user:
```
$CLAUDE_CONFIG_DIR/feedback/<target>/from-<sender>.md
```
Each sender writes to their own file in the target's directory. Per-sender files eliminate merge conflicts
when agents work in parallel. Format:
```markdown
- [ ] **YYYY-MM-DD HH:MM** — <summary>

  <full feedback body>
```

## Customization

### Adding a domain expert
Copy `domain.md` and fill in your project's business domain, key terminology, data flow / module ownership,
and common domain-specific pitfalls.

### Adding new agents
Add when the gap is felt, not before. Create `<name>.md` with frontmatter (name, description) and update
this index. Add `authority:` only if the agent is meant to join `/forge`'s authority-merge ladder.
