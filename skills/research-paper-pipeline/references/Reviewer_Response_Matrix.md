# Reviewer-Response Traceability Matrix

Close the loop after a review (simulated or real). For every reviewer point, this matrix
forces an explicit, independently checkable resolution. The failure mode it prevents is
acknowledging a concern in the response letter without actually changing the paper.

## The table

Keep one row per reviewer point:

| ID | Reviewer point (verbatim) | Response | Change made (section + what) | Verified |
|----|---------------------------|----------|------------------------------|----------|
| R1-1 | ... | ... | Section 4, para 3: ... | [ ] |
| R1-2 | ... | ... | No change; rationale: ... | [ ] |

- **ID**: reviewer number and point number (R1-1, R1-2, R2-1, ...).
- **Reviewer point**: quote it, do not paraphrase it away.
- **Response**: what you are telling the reviewer.
- **Change made**: the concrete edit, located by section and paragraph. If you decline
  the change, say so and give the reason. "Declined with reason" is a valid outcome; a
  vague promise is not.
- **Verified**: check only after re-reading the changed section and confirming the edit
  is actually there and actually addresses the point.

## Rule

The response letter is generated FROM this matrix, not the other way around. A point is
not "addressed" until its Verified box is checked against the built document. Run an
independent pass (a fresh agent, or a diff of before and after) to confirm each checked
row corresponds to a real change in the manuscript.
