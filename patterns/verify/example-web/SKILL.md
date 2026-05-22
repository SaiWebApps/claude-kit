---
name: fact-check-web
description: "Verify factual claims using web search and local file evidence. Decomposes claims into sub-claims, gathers evidence from multiple sources, scores confidence, and reports a structured verdict. Read-only -- never modifies data."
---

# Web Fact-Check Skill

Verify factual claims by cross-referencing web sources and local project files.

## When to Use

- User makes a factual claim and asks "is this true?"
- User asks to verify information before acting on it
- User says "fact-check this" or "verify that..."
- User invokes `/fact-check-web` directly

## Prerequisites

- `WebFetch` tool must be available (for web searches)
- For codebase claims: the relevant project must be accessible on the file system
- No authentication required for public web verification

## Execution Steps

### Step 1: Parse the Claim

Decompose the user statement into discrete, verifiable sub-claims.

**Process:**
1. Identify the subject (what entity/thing is being claimed about)
2. Extract each assertion (existence, property, relationship, quantity, timing)
3. Identify implicit claims (prerequisites that must also be true)
4. Determine claim type for each sub-claim:

| Type | Example | How to Verify |
|------|---------|---------------|
| Existence | "React has a hook called useTransition" | Search docs/source |
| Property | "Python 3.12 supports pattern matching" | Check release notes |
| Version | "The latest version of Node.js is 22" | Check official site |
| Comparison | "Rust is faster than Go for this use case" | Find benchmarks |
| Temporal | "TypeScript was released in 2012" | Check official history |
| Authorship | "Dan Abramov created Redux" | Check repo/credits |
| Codebase | "Our API uses JWT auth" | Check local source files |

**Report the decomposition to the user:**
```
I will verify this claim by checking these sub-claims:
1. [sub-claim 1]
2. [sub-claim 2]
3. [sub-claim 3]
```

### Step 2: Gather Evidence

For each sub-claim, gather evidence from appropriate sources.

#### For Web/Public Claims

Use WebFetch to search authoritative sources:

```
Search priority:
1. Official documentation (docs.X.com, X.org)
2. Official repository (github.com/org/repo)
3. Official announcements (blog posts, release notes)
4. Reputable secondary sources (MDN, Wikipedia for dates/facts)
5. Community consensus (multiple StackOverflow answers agreeing)
```

**Search strategy:**
- Start with the most specific, authoritative source
- Use targeted searches: "[project name] [specific claim] site:official-domain.com"
- For version claims: check the official releases/changelog page
- For date claims: find the original announcement or first commit
- For comparison claims: find published benchmarks with methodology

**Evidence recording format:**
```
Source: [URL or file path]
Found: [exact quote or data point]
Relevance: [how this relates to the sub-claim]
Trust level: authoritative | official | external | inference
```

#### For Codebase Claims

Read local project files to verify claims about the codebase:

```bash
# Existence claims: does this file/function/class exist?
find . -name "*.ts" | head -20
grep -r "useTransition" --include="*.ts" -l

# Property claims: does it have this characteristic?
grep -r "jwt\|JWT\|jsonwebtoken" --include="*.ts" -l

# Version claims: what version is installed?
jq '.dependencies["react"]' package.json
```

**Rules for codebase verification:**
- Read the actual file, not just grep output
- Check both source and configuration (package.json, requirements.txt, etc.)
- Verify the claim at the current HEAD, not historical state (unless temporal claim)

### Step 3: Score Each Sub-Claim

Apply confidence scoring based on evidence quality:

**CONFIRMED** (green):
- 2+ independent sources agree
- At least one authoritative source
- No contradicting evidence
- Example: "Official docs state X, and the source code confirms X"

**LIKELY** (yellow):
- 1 authoritative source confirms, no contradictions
- OR 2+ non-authoritative sources agree
- Example: "The official blog post from 2019 says this, no counter-evidence found"

**UNVERIFIABLE** (gray):
- Cannot access authoritative source
- Only circumstantial evidence available
- Sources disagree without clear winner
- Example: "Multiple blog posts mention this, but official docs do not address it"

**REFUTED** (red):
- Authoritative source directly contradicts the claim
- Multiple independent sources contradict
- Example: "Official changelog shows v2.0 was released in 2021, not 2020"

### Step 4: Report Verdict

Present the full verification report:

```
## Fact-Check Report

**Original claim:** "[user original statement]"

### Sub-claim 1: [statement]
**Verdict: CONFIRMED**
Evidence:
- [Source 1]: [finding]
- [Source 2]: [finding]

### Sub-claim 2: [statement]
**Verdict: REFUTED**
Evidence:
- [Source 1]: [contradicting finding]
Correction: [what is actually true, with source]

### Sub-claim 3: [statement]
**Verdict: LIKELY**
Evidence:
- [Source 1]: [supporting finding]
Note: Only one source available; rated LIKELY rather than CONFIRMED.

---

### Overall Verdict: [CONFIRMED | MOSTLY TRUE | MIXED | MOSTLY FALSE | REFUTED]

**Summary:** [1-2 sentence plain-language summary]
**Corrections:** [If any sub-claims were refuted, state what is actually true]
```

**Overall verdict mapping:**
- All sub-claims CONFIRMED: CONFIRMED
- Majority CONFIRMED, rest LIKELY: MOSTLY TRUE
- Some CONFIRMED, some REFUTED: MIXED
- Majority REFUTED: MOSTLY FALSE
- All REFUTED: REFUTED

## Example Interactions

**User:** "Is it true that Next.js 14 introduced Server Actions as stable?"

Decomposition:
1. Next.js version 14 exists
2. Server Actions feature exists in Next.js
3. Server Actions became stable (non-experimental) in version 14 specifically

Evidence gathering:
- WebFetch: nextjs.org/blog/next-14 release announcement
- WebFetch: nextjs.org/docs/app/building-your-application/data-fetching/server-actions

Report:
```
Sub-claim 1: CONFIRMED -- Next.js 14 was released Oct 26, 2023 (nextjs.org/blog/next-14)
Sub-claim 2: CONFIRMED -- Server Actions documented as core feature (nextjs.org/docs/...)
Sub-claim 3: CONFIRMED -- Release post explicitly states "Server Actions (Stable)"

Overall: CONFIRMED
```

**User:** "Our project uses PostgreSQL 15"

Decomposition:
1. The project uses PostgreSQL (not MySQL, SQLite, etc.)
2. The version is specifically 15

Evidence gathering:
```bash
# Check docker-compose for PG version
grep -r "postgres" docker-compose.yml
# Check connection config
grep -r "postgresql\|postgres" --include="*.env*" .
# Check package dependencies
jq '.dependencies' package.json | grep pg
```

**User:** "Python GIL was removed in version 3.13"

Decomposition:
1. Python 3.13 exists
2. The GIL was removed (or made optional) in this version specifically

Evidence gathering:
- WebFetch: python.org/downloads -- check 3.13 release status
- WebFetch: PEP 703 (Making the Global Interpreter Lock Optional)
- WebFetch: Python 3.13 "What's New" page

## Safety Rules

1. **Never state a verdict without evidence.** Every CONFIRMED/REFUTED must cite at least one source.
2. **Distinguish absence from refutation.** "I could not find evidence" is UNVERIFIABLE, not REFUTED.
3. **Label inference as inference.** If you deduce something rather than finding it stated, say so explicitly.
4. **Check for circular sources.** If two sources cite each other, count them as one source.
5. **Prefer authoritative over popular.** One official doc outweighs ten blog posts.
6. **Report contradictions, do not hide them.** If sources disagree, present both sides.
7. **Date-stamp web evidence.** Web content changes -- note when the page was published/updated if visible.
8. **Never modify files during verification.** This skill is strictly read-only.
9. **Acknowledge limitations.** If you cannot access a paywalled/authenticated source, say so.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| WebFetch unavailable | Fall back to local file verification only; mark web claims as UNVERIFIABLE |
| Site blocks automated access | Note in report; try alternative authoritative source |
| Claim is about private/internal system | Can only verify from local files; mark external aspects as UNVERIFIABLE |
| Sources disagree | Report both, weight by authoritativeness, mark as LIKELY at best |
| Claim is subjective | Report that it is an opinion, not a verifiable fact; present available data |
| Too many sub-claims | Limit to 5 most important; ask user which to prioritize |
