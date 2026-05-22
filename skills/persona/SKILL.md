---
name: persona
description: "Switch between role-based personas that control which skills, directories, and environments are accessible. Invoke with '/persona <role>' to activate a persona, or '/persona' to see available options."
---

# Persona Skill

Activate a role-based persona that controls which skills, directories, and write permissions are accessible in this session.

## When to Use

- User wants to switch roles (e.g., "I'm reviewing code today")
- User invokes `/persona <role>` explicitly
- At the start of a session to establish access boundaries
- User asks what personas are available

## Argument Parsing

| Argument | Required | Default | Notes |
|----------|----------|---------|-------|
| Role | No | — | One of the available persona names. If omitted, list available personas. |

## Available Personas

| Name | Command | Description |
|------|---------|-------------|
| `developer` | `/persona developer` | Full access — all skills, all directories, all environments |
| `reviewer` | `/persona reviewer` | Read-only — verification, code review, no mutations |
| `operator` | `/persona operator` | Write access with guardrails — deployment and operational tasks |

## Execution Steps

### If No Argument Provided

List available personas with a brief description of each:

1. Read all `.md` files in the personas directory (see "Persona File Location" below)
2. For each file, extract the role name from the `# Persona: {name}` heading and the first sentence of the Role section
3. Present as a table
4. Ask the user which persona they'd like to activate

### If Role Argument Provided

1. **Locate the persona file** — Read `personas/{role}.md` from the project directory or `~/.claude/personas/{role}.md`
   - Check the project directory first, then fall back to `~/.claude/personas/`
   - If the file doesn't exist in either location, list available personas and ask the user to choose
2. **Load the persona** — Read the full contents of the persona file
3. **Activate** — Adopt all constraints defined in the persona file:
   - Allowed and restricted skills
   - Allowed and restricted directories
   - Write access permissions
   - Environment restrictions
   - Behavior guidelines
4. **Confirm** — Tell the user which persona is now active, summarizing:
   - Key allowed skills
   - Directory access scope
   - Write access (yes/no/conditional)

### Enforcement

Once a persona is active, you MUST follow its constraints for the remainder of the session:

- **Restricted skills:** Refuse to invoke them. Explain the restriction and suggest `/persona <other-role>` to switch.
- **Restricted directories:** Refuse to read or write files in disallowed directories.
- **Write restrictions:** Refuse any file creation, modification, or deletion if the persona prohibits write access.
- **Environment restrictions:** Refuse connections or deployments to disallowed environments (e.g., production).

When refusing a restricted action, use this format:

> "The **{persona}** persona restricts access to {action}. {Reason}. To {action}, switch personas: `/persona developer`"

### Switching Personas

A user can switch personas at any time by invoking `/persona <new-role>`. The new persona **completely replaces** the previous one — constraints do not accumulate.

## Example Usage

```
/persona                  # List available personas
/persona developer        # Activate developer mode (full access)
/persona reviewer         # Activate reviewer mode (read-only)
/persona operator         # Activate operator mode (write with guardrails)
```

## Persona File Location

Persona definitions are searched in two locations (in priority order):

1. `personas/` in the project directory
2. `~/.claude/personas/` for user-wide defaults

```
personas/                     # project-level
├── developer.md
├── reviewer.md
├── operator.md
└── README.md

~/.claude/personas/           # user-level fallback
├── developer.md
├── reviewer.md
└── operator.md
```

See `personas/README.md` for how to add new personas.

## Persona File Format

Each persona file should define the following sections:

```markdown
# Persona: {name}

## Role
One-sentence description of what this persona does.

## Restricted Skills
- skill-name-1
- skill-name-2

## Restricted Directories
- /path/to/sensitive/dir

## Write Restrictions
Describe what write operations are allowed or denied.

## Environment Restrictions
Describe which environments (dev, staging, production) are accessible.

## Behavior Guidelines
Additional behavioral constraints for the session.
```

## Safety Rules

1. **Persona constraints are binding** — once activated, follow them until a new persona is loaded or the session ends
2. **No silent overrides** — always tell the user when an action is blocked by the active persona
3. **Suggest alternatives** — when blocking an action, suggest which persona would allow it
4. **User can always switch** — never prevent a user from changing personas via `/persona <role>`
