#!/usr/bin/env python3
"""make_reading_copy.py - a single-spaced, named reading copy (NOT a submission file).

Places tables, figures, and exhibits inline where first referenced, appends the AI-use
disclosure, and shows author names. This is the version to read and judge the paper as a
finished document. Portable and config-driven.
Output: <WORKDIR>/build/Reading_Copy.md
"""
import re, sys, argparse
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import paperkit

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--profile"); ap.add_argument("--dir")
    a = ap.parse_args()
    wd = Path(a.dir).resolve() if a.dir else paperkit.workdir()
    cfg = paperkit.load_paper_config(wd)
    prof = paperkit.get_profile(a.profile, wd)
    bd = paperkit.build_dir_for(wd)
    t = (bd / "Manuscript_master.md").read_text(encoding="utf-8")

    ref_head = "## References" if prof.get("checks", {}).get("reference_model") == "reflist" else "## Notes"
    first_heading = cfg["sections"][0]["heading"]
    i_body, i_ref = t.find(first_heading), t.find(ref_head)
    i_exh, i_bio = t.find("## Exhibits"), t.find("## About the Authors")
    pre = t[:i_body].rstrip()
    body = t[i_body:i_ref].rstrip()
    notes = t[i_ref:(i_exh if i_exh != -1 else i_bio if i_bio != -1 else len(t))].rstrip()
    exhibits = t[i_exh:(i_bio if i_bio != -1 else len(t))] if i_exh != -1 else ""
    bios = t[i_bio:].rstrip() if i_bio != -1 else ""

    ex_blocks = {}
    if exhibits:
        for part in re.split(r"(?=### Exhibit )", exhibits.replace("## Exhibits", "").strip()):
            m = re.match(r"### Exhibit (\d+)", part.strip())
            if m:
                ex_blocks[int(m.group(1))] = part.strip()

    paras, out, inserted = body.split("\n\n"), [], set()
    for p in paras:
        out.append(p)
        for n in sorted(ex_blocks):
            if n not in inserted and re.search(rf"\bExhibit {n}\b", p):
                out.append(ex_blocks[n]); inserted.add(n)
    for n in sorted(ex_blocks):
        if n not in inserted:
            out.append(ex_blocks[n]); inserted.add(n)
    body_inline = "\n\n".join(out)

    disclosure = cfg.get("ai_disclosure", "")
    reading = pre + "\n\n" + body_inline + "\n\n" + notes + ("\n\n" + bios if bios else "")
    if disclosure:
        reading += "\n\n## Author Disclosure: Use of Generative AI\n\n" + disclosure
    reading += "\n"
    (bd / "Reading_Copy.md").write_text(reading, encoding="utf-8")
    print("reading copy: exhibits inlined =", sorted(inserted), "| words:", len(reading.split()))

if __name__ == "__main__":
    main()
