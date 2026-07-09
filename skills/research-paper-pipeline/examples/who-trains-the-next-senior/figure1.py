#!/usr/bin/env python3
"""Regenerate Figure 1 (the order-of-fall chart). Output path is argv[1] or build/."""
import sys, matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Patch

OUT = sys.argv[1] if len(sys.argv) > 1 else "build/figure1_order_of_fall.png"
acts = [
 ("Boilerplate & implementation", 1.0, "junior"),
 ("Unit & integration tests", 1.3, "junior"),
 ("Documentation & runbooks", 1.7, "junior"),
 ("First-pass debugging & triage", 2.7, "junior"),
 ("Routine code review", 3.3, "junior"),
 ("Deployment & release orchestration", 5.0, "senior"),
 ("Architecture (pattern-instantiation)", 6.3, "senior"),
 ("Incident command (technical core)", 7.0, "senior"),
 ("Consequential code review", 7.6, "senior"),
 ("Production sign-off", 9.3, "acct"),
 ("Stakeholder coordination", 9.7, "acct"),
]
col = {"junior": "#2F6DA3", "senior": "#CC8A33", "acct": "#777777"}
acts = sorted(acts, key=lambda a: a[1])
ys = list(range(len(acts)))[::-1]
fig, ax = plt.subplots(figsize=(9.2, 4.8))
for (name, pos, owner), y in zip(acts, ys):
    ax.hlines(y, 0, pos, color=col[owner], lw=2, alpha=0.45)
    ax.plot(pos, y, "o", color=col[owner], ms=9)
    ax.text(pos + 0.2, y, name, va="center", ha="left", fontsize=9.5)
ax.set_xlim(0, 15); ax.set_ylim(-1.2, len(acts))
ax.set_yticks([]); ax.set_xticks([1, 9.5])
ax.set_xticklabels(["Falls first (today)", "Resists automation"], fontsize=10)
for s in ["top", "right", "left"]:
    ax.spines[s].set_visible(False)
ax.tick_params(axis="x", length=0)
leg = [Patch(color=col["junior"], label="Today: the junior's work"),
       Patch(color=col["senior"], label="Today: the senior's work"),
       Patch(color=col["acct"], label="Accountability & coordination")]
ax.legend(handles=leg, loc="upper right", fontsize=9, frameon=False, bbox_to_anchor=(1.0, 1.02))
plt.tight_layout()
import os; os.makedirs(os.path.dirname(OUT) or ".", exist_ok=True)
plt.savefig(OUT, dpi=150, bbox_inches="tight")
print("figure written:", OUT)
