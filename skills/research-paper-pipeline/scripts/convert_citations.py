#!/usr/bin/env python3
"""convert_citations.py - assemble a master manuscript and convert author-date
citations into numbered references, driven by config (portable; no hardcoded paths).

Generalizes the original convert_cmr.py. Everything paper-specific now lives in
<WORKDIR>/paper.config.json and <WORKDIR>/<notes_file>. The reference MODEL comes from
the journal profile:
  - "endnotes"  -> superscript {{NOTE:n}} markers + a "## Notes" section (CMR, MIT SMR)
  - "reflist"   -> bracket [n] markers + a "## References" section (IEEE, CACM)

Output: <WORKDIR>/build/Manuscript_master.md
"""
import re, sys, json, argparse
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import paperkit

def body_of(path):
    lines = Path(path).read_text(encoding="utf-8").splitlines()
    try:
        idx = next(i for i, ln in enumerate(lines) if ln.strip() == "---")
    except StopIteration:
        idx = -1
    return "\n".join(lines[idx + 1:]).strip("\n")

def build_byline(cfg, sep=" · "):
    parts = []
    for a in cfg.get("authors", []):
        c = a.get("credential", "")
        parts.append(f"**{a['name']}**" + (f" ({c})" if c else ""))
    return sep.join(parts)

def build_top_matter(cfg):
    title = cfg.get("title", "Untitled")
    abstract = cfg.get("abstract", "")
    kw = "; ".join(cfg.get("keywords", []))
    out = [f"# {title}", "", build_byline(cfg), ""]
    if abstract:
        out += ["## Abstract", "", abstract, ""]
    if kw:
        out += [f"**Keywords:** {kw}", ""]
    return "\n".join(out).rstrip()

def build_bios(cfg):
    out = ["## About the Authors", ""]
    for a in cfg.get("authors", []):
        if a.get("bio"):
            out += [a["bio"], ""]
    if cfg.get("byline_note"):
        out += [cfg["byline_note"], ""]
    return "\n".join(out).rstrip()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--profile"); ap.add_argument("--dir")
    a = ap.parse_args()
    wd = Path(a.dir).resolve() if a.dir else paperkit.workdir()
    cfg = paperkit.load_paper_config(wd)
    if not cfg:
        sys.exit(f"ERROR: no paper.config.json in {wd}")
    prof = paperkit.get_profile(a.profile, wd)
    model = prof.get("checks", {}).get("reference_model", "endnotes")

    content_dir = wd / cfg.get("content_dir", "content")
    notes_path = wd / cfg.get("notes_file", "config/notes.json")
    notes_data = json.loads(notes_path.read_text(encoding="utf-8")).get("notes", {}) if notes_path.exists() else {}

    # 1. assemble body from configured sections
    body_parts = []
    for s in cfg["sections"]:
        p = content_dir / s["file"]
        body_parts.append(s["heading"] + "\n\n" + body_of(p))
    body = "\n\n".join(body_parts)

    # 2. collect citation matches across all patterns
    found = []
    for key, entry in notes_data.items():
        for mode, rx in entry.get("patterns", []):
            for m in re.finditer(rx, body):
                found.append((m.start(), m.end(), key, mode, m.group(1) if mode == "A" else None))
    found.sort(key=lambda x: x[0])

    # 3. reconstruct with sequential numbers (first hit=full note, later=short)
    marker = (lambda n: f"{{{{NOTE:{n}}}}}") if model == "endnotes" else (lambda n: f"[{n}]")
    out, cursor, refs, seen = [], 0, [], set()
    for start, end, key, mode, name in found:
        out.append(body[cursor:start])
        n = len(refs) + 1
        full, short = notes_data[key]["full"], notes_data[key]["short"]
        refs.append((n, full if key not in seen else short))
        seen.add(key)
        out.append((f"{name}{marker(n)}" if mode == "A" else marker(n)))
        cursor = end
    out.append(body[cursor:])
    converted = "".join(out)

    # 4. reference section
    if model == "endnotes":
        ref_md = "## Notes\n\n" + "\n".join(f"{n}. {t}" for n, t in refs)
    else:
        ref_md = "## References\n\n" + "\n".join(f"[{n}] {t}" for n, t in refs)

    # 5. exhibits (optional)
    exhibits_md = ""
    exf = cfg.get("exhibits_file")
    if exf and (wd / exf).exists():
        ex_raw = (wd / exf).read_text(encoding="utf-8")
        anchor = ex_raw.find("## Exhibit 1")
        if anchor != -1:
            ex_body = ex_raw[anchor:].strip().replace("## Exhibit", "### Exhibit")
            exhibits_md = "## Exhibits\n\n" + ex_body

    # 6. assemble master
    manuscript = (build_top_matter(cfg) + "\n\n" + converted + "\n\n" + ref_md +
                  (("\n\n" + exhibits_md) if exhibits_md else "") +
                  "\n\n" + build_bios(cfg) + "\n")
    out_path = paperkit.build_dir_for(wd) / "Manuscript_master.md"
    out_path.write_text(manuscript, encoding="utf-8")

    # 7. verification
    print(f"model            : {model}")
    print(f"references made  : {len(refs)}")
    print(f"unique sources   : {len(seen)} of {len(notes_data)} defined")
    uncited = set(notes_data) - seen
    print(f"defined not cited: {sorted(uncited) if uncited else 'none'}")
    residual = re.findall(r"\b[A-Z][A-Za-z]+ (?:et al\.|and [A-Z][A-Za-z]+) \((?:19|20)\d\d\)|\((?:19|20)\d\d\)", converted)
    print(f"residual author-date patterns: {residual if residual else 'NONE (clean)'}")
    print(f"words            : {len(manuscript.split())}")
    print(f"wrote            : {out_path}")

if __name__ == "__main__":
    main()
