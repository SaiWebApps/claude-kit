#!/usr/bin/env python3
"""make_submission.py - split the master manuscript into the venue's required files.

Profile-driven generalization of the original CMR splitter. Behavior depends on the
profile:
  - blind + separate title page (CMR, IEEE TEM, AMJ):
        build/Manuscript_blind.md   (no author identity; exhibits -> callouts)
        build/Title_Page.md         (the ONE file carrying author names + disclosure)
        build/Exhibits_File.md      (display items, each on its own page)
  - named, exhibits inline (MIT SMR, CACM):
        build/Manuscript.md         (single file, byline + inline exhibits + disclosure)
"""
import re, sys, argparse
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import paperkit

def build_byline(cfg):
    return "\n\n".join(
        f"**{a['name']}**" + (f" ({a['credential']})" if a.get("credential") else "")
        for a in cfg.get("authors", []))

def keywords_line(cfg):
    return "**Keywords:** " + "; ".join(cfg.get("keywords", []))

def extract_display_blocks(body):
    """Pull **Table N**/**Figure N** display blocks out of the body (for the exhibits file)."""
    blocks = []
    # figure blocks (caption + [[FIGURE:...]])
    for m in re.finditer(r"\*\*Figure (\d+)\.\*\*.*?\[\[FIGURE:[^\]]+\]\]", body, re.S):
        blocks.append(("figure", int(m.group(1)), m.group(0).strip()))
    # table blocks (caption paragraph + following pipe table)
    lines = body.split("\n"); i = 0
    while i < len(lines):
        m = re.match(r"\s*\*\*Table (\d+)\.\*\*", lines[i])
        if m:
            start = i; i += 1
            while i < len(lines) and lines[i].strip() == "": i += 1
            while i < len(lines) and lines[i].lstrip().startswith("|"): i += 1
            blocks.append(("table", int(m.group(1)), "\n".join(lines[start:i]).strip()))
            continue
        i += 1
    return blocks

def blindify(body):
    """Replace display items with [Insert ... here] callouts."""
    body = re.sub(r"\*\*Figure (\d+)\.\*\*.*?\[\[FIGURE:[^\]]+\]\]",
                  lambda m: f"[Insert Figure {m.group(1)} about here.]", body, flags=re.S)
    body = re.sub(r"\[\[FIGURE:[^\]]+\]\]", "[Insert Figure about here.]", body)
    lines = body.split("\n"); out = []; i = 0
    while i < len(lines):
        m = re.match(r"\s*\*\*Table (\d+)\.\*\*", lines[i])
        if m:
            out.append(f"[Insert Table {m.group(1)} about here.]"); i += 1
            while i < len(lines) and lines[i].strip() == "": i += 1
            while i < len(lines) and lines[i].lstrip().startswith("|"): i += 1
            continue
        out.append(lines[i]); i += 1
    return "\n".join(out)

def insert_exhibit_callouts(body, exhibit_nums):
    paras = body.split("\n\n")
    for n in exhibit_nums:
        for i, p in enumerate(paras):
            if re.search(rf"\bExhibit {n}\b", p) and not p.strip().startswith("[Insert"):
                paras.insert(i + 1, f"[Insert Exhibit {n} about here.]"); break
    return "\n\n".join(paras)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--profile"); ap.add_argument("--dir")
    a = ap.parse_args()
    wd = Path(a.dir).resolve() if a.dir else paperkit.workdir()
    cfg = paperkit.load_paper_config(wd)
    prof = paperkit.get_profile(a.profile, wd)
    C = prof.get("checks", {})
    bd = paperkit.build_dir_for(wd)
    master = (bd / "Manuscript_master.md").read_text(encoding="utf-8")

    ref_head = "## References" if C.get("reference_model") == "reflist" else "## Notes"
    first_heading = cfg["sections"][0]["heading"]
    i_body = master.find(first_heading)
    i_ref = master.find(ref_head)
    i_exh = master.find("## Exhibits")
    i_bio = master.find("## About the Authors")
    body = master[i_body:i_ref].rstrip()
    refs = master[i_ref:(i_exh if i_exh != -1 else i_bio if i_bio != -1 else len(master))].rstrip()
    exhibits = master[i_exh:(i_bio if i_bio != -1 else len(master))].rstrip() if i_exh != -1 else ""

    title = cfg.get("title", "Untitled")
    abstract = cfg.get("abstract", "")
    disclosure = cfg.get("ai_disclosure", "")
    exhibit_nums = sorted(int(m) for m in re.findall(r"### Exhibit (\d+)", exhibits))
    display_blocks = extract_display_blocks(body)

    placement = C.get("exhibits_placement")
    separate_exhibits = placement in ("separate_file", "end_of_manuscript")
    blind_separate = C.get("require_blind") and prof.get("title_page_separate")

    written = []
    if blind_separate:
        b = blindify(body) if separate_exhibits else body
        if separate_exhibits:
            b = insert_exhibit_callouts(b, exhibit_nums)
        parts = [f"# {title}", "", "## Abstract", "", abstract, "", keywords_line(cfg), "", b, "", refs, ""]
        (bd / "Manuscript_blind.md").write_text("\n".join(parts), encoding="utf-8")
        written.append("Manuscript_blind.md")

        tp = [f"# {title}", "", build_byline(cfg), "", "## Abstract", "", abstract, "", keywords_line(cfg), ""]
        if disclosure:
            tp += ["## Author Disclosure: Use of Generative AI", "", disclosure, ""]
        tp += [master[i_bio:].rstrip() if i_bio != -1 else ""]
        (bd / "Title_Page.md").write_text("\n".join(tp), encoding="utf-8")
        written.append("Title_Page.md")

        if separate_exhibits:
            items = []
            for kind, num, block in sorted(display_blocks, key=lambda x: (x[0] != "table", x[1])):
                items.append(f"## {kind.capitalize()} {num}\n\n{block}")
            ex_body = exhibits.replace("## Exhibits", "").replace("### Exhibit", "## Exhibit").strip()
            for part in re.split(r"(?=^## Exhibit )", ex_body, flags=re.M):
                if part.strip():
                    items.append(part.strip())
            head = ("# Exhibits, Tables, and Figures\n\n*(Each item is uploaded as a separate file "
                    "or placed on its own page; insertion points are marked in the manuscript.)*\n\n")
            (bd / "Exhibits_File.md").write_text(head + "\n\n[[PAGEBREAK]]\n\n".join(items), encoding="utf-8")
            written.append("Exhibits_File.md")
    else:
        # named / inline model: single manuscript file
        parts = [f"# {title}", "", build_byline(cfg), ""]
        if C.get("abstract_required") and abstract:
            parts += ["## Abstract", "", abstract, ""]
        if cfg.get("keywords"):
            parts += [keywords_line(cfg), ""]
        parts += [body, "", refs, ""]
        if exhibits and placement != "inline":
            parts += [exhibits, ""]
        if disclosure:
            parts += ["## Author Disclosure: Use of Generative AI", "", disclosure, ""]
        parts += [master[i_bio:].rstrip() if i_bio != -1 else ""]
        (bd / "Manuscript.md").write_text("\n".join(parts), encoding="utf-8")
        written.append("Manuscript.md")

    print("wrote:", ", ".join(written))
    for w in written:
        txt = (bd / w).read_text(encoding="utf-8")
        callouts = len(re.findall(r"\[Insert ", txt))
        has_tbl = "|---" in txt
        figm = txt.count("[[FIGURE")
        print(f"  {w}: {len(txt.split())} words; inline_tables={has_tbl}; figure_markers={figm}; callouts={callouts}")

if __name__ == "__main__":
    main()
