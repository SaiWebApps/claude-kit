#!/usr/bin/env python3
"""format_check.py - DETERMINISTIC, PROFILE-DRIVEN submission-format gate.

Reads the BUILT .docx files (never the markdown) and asserts the target venue's
requirements, driven entirely by a journal profile (profiles/<id>.json) plus the
paper's own config (paper.config.json). Exits non-zero on ANY failure.

This is the generalization of the original cmr_format_check.py: every value that used
to be hardcoded (100-word abstract, 5,000-9,000 words, blind author tokens, US Letter,
the Chicago 'et al.' rule) now comes from the profile's `checks` block, so the same
gate enforces CMR, IEEE TEM, AMJ, and any profile you write.

Usage:
  python3 format_check.py [--profile ID] [--dir WORKDIR]
                          [--manuscript PATH] [--title PATH] [--exhibits PATH]
The gate is the source of truth. Do not tell the author a paper is conformant from
reading the markdown; build the docx and run this.
"""
import sys, os, re, zipfile, argparse
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import paperkit

# ---------------------------------------------------------------- docx helpers
def parts(path):
    z = zipfile.ZipFile(path)
    return {n: z.read(n).decode("utf-8", "replace") for n in z.namelist() if n.endswith(".xml")}

def visible_text(xml):
    txt = "".join(re.findall(r"<w:t[^>]*>(.*?)</w:t>", xml, re.S))
    return re.sub(r"<[^>]+>", "", txt)

def all_doc_text(P):
    s = ""
    for n, x in P.items():
        if n == "word/document.xml" or re.match(r"word/(header|footer)\d*\.xml", n):
            s += "\n" + visible_text(x)
    return s

def metadata_text(P):
    s = ""
    for n in ("docProps/core.xml", "docProps/app.xml"):
        if n in P:
            s += "\n" + re.sub(r"<[^>]+>", " ", P[n])
    return s

def para_lines(doc):
    out = []
    for p in re.findall(r"<w:p\b.*?</w:p>", doc, re.S):
        t = re.sub(r"<[^>]+>", "", "".join(re.findall(r"<w:t[^>]*>(.*?)</w:t>", p, re.S)))
        out.append(t)
    return out

# ---------------------------------------------------------------- result sink
results = []
def chk(f, name, passed, detail=""):
    results.append((f, name, bool(passed), detail))

# ---------------------------------------------------------------- checks
def check_manuscript(path, C, cfg, blind_tokens):
    f = "MANUSCRIPT"
    if not path or not os.path.exists(path):
        chk(f, "file exists", False, str(path)); return
    P = parts(path)
    chk(f, "valid .docx (has word/document.xml)", "word/document.xml" in P)
    doc = P.get("word/document.xml", "")
    vis = all_doc_text(P)
    meta = metadata_text(P)
    vlines = [l for l in para_lines(doc) if l.strip()]
    low_all = (vis + " " + meta).lower()

    # ---- blind anonymity
    if C.get("require_blind"):
        hits = [t for t in blind_tokens if t and t in low_all]
        chk(f, "no author-identifying tokens (text/header/footer/metadata)", not hits,
            ("FOUND: " + ", ".join(hits)) if hits else "clean")
        if C.get("blind_check_metadata"):
            crt = re.search(r"<dc:creator>(.*?)</dc:creator>", P.get("docProps/core.xml", ""))
            lmb = re.search(r"<cp:lastModifiedBy>(.*?)</cp:lastModifiedBy>", P.get("docProps/core.xml", ""))
            cval = (crt.group(1) if crt else "") + "|" + (lmb.group(1) if lmb else "")
            bad = any(t in cval.lower() for t in blind_tokens)
            chk(f, "metadata creator/lastModifiedBy carries no author name", not bad, "creator/lmb=" + cval)

    # ---- voice: em-dash
    if C.get("no_em_dash"):
        chk(f, "no em-dash (U+2014) anywhere", "—" not in vis,
            "found em-dash" if "—" in vis else "clean")

    # ---- spacing
    if C.get("spacing") == "double":
        minline = C.get("min_line_twips", 480)
        paras = re.findall(r"<w:p\b.*?</w:p>", doc, re.S)
        offenders, longparas = [], 0
        for p in paras:
            if 'w:jc w:val="center"' in p:
                continue
            t = re.sub(r"<[^>]+>", "", "".join(re.findall(r"<w:t[^>]*>(.*?)</w:t>", p, re.S)))
            if len(t.split()) > 12:
                longparas += 1
                m = re.search(r'w:line="(\d+)"', p)
                line = int(m.group(1)) if m else 0
                if line < minline:
                    offenders.append((line, t[:55]))
        chk(f, f"double-spaced: prose paragraphs (>12 words) at line>={minline}",
            not offenders, f"{longparas} long paras; offenders={offenders[:4]}")

    # ---- font size
    if C.get("font_min_halfpt"):
        fm = C["font_min_halfpt"]
        sizes = sorted(set(int(s) for s in re.findall(r'<w:sz w:val="(\d+)"', doc)))
        chk(f, f"no text below {fm//2}pt (every explicit size >= {fm} half-pt)",
            all(s >= fm for s in sizes), f"explicit sizes={sizes or 'default'}; below={[s for s in sizes if s<fm]}")
    if C.get("default_font_halfpt"):
        dfp = str(C["default_font_halfpt"])
        sty = P.get("word/styles.xml", "")
        dft = re.search(r"<w:docDefaults>.*?<w:sz w:val=\"(\d+)\"", sty, re.S)
        chk(f, f"default font {int(dfp)//2}pt (docDefault sz=={dfp})", dft and dft.group(1) == dfp,
            f"docDefault sz={dft.group(1) if dft else '?'}")

    # ---- page + margins
    sec = re.search(r"<w:sectPr\b.*?</w:sectPr>", doc, re.S)
    sx = sec.group(0) if sec else ""
    if C.get("page_size") == "us_letter":
        pg = re.search(r'w:w="(\d+)" w:h="(\d+)"', sx)
        chk(f, "US Letter page (12240 x 15840)", pg and pg.groups() == ("12240", "15840"),
            f"page={pg.groups() if pg else '?'}")
    if C.get("margins_twips"):
        mt = str(C["margins_twips"])
        mg = re.search(r'w:top="(\d+)" w:right="(\d+)" w:bottom="(\d+)" w:left="(\d+)"', sx)
        chk(f, f"{int(mt)/1440:.0f}-inch margins ({mt} twips all sides)",
            mg and set(mg.groups()) == {mt}, f"margins={mg.groups() if mg else '?'}")

    # ---- heading hierarchy
    hlv = C.get("heading_levels_min")
    if hlv:
        h1 = doc.count('w:val="Heading1"'); h2 = doc.count('w:val="Heading2"'); h3 = doc.count('w:val="Heading3"')
        ok = h1 >= hlv.get("h1", 0) and h2 >= hlv.get("h2", 0) and h3 >= hlv.get("h3", 0)
        chk(f, f"heading levels present (H1>={hlv.get('h1',0)}, H2>={hlv.get('h2',0)}, H3>={hlv.get('h3',0)})",
            ok, f"H1={h1} H2={h2} H3={h3}")

    # ---- abstract
    if C.get("abstract_required"):
        aw = None
        for i, l in enumerate(vlines):
            if re.sub(r"[^a-z]", "", l.lower()) == "abstract" and i + 1 < len(vlines):
                aw = len(vlines[i + 1].split()); break
        lo, hi = C.get("abstract_word_min"), C.get("abstract_word_max")
        if aw is None:
            chk(f, "abstract present", False, "no 'Abstract' heading + paragraph found")
        elif lo is not None and hi is not None and lo == hi:
            chk(f, f"abstract is exactly {lo} words", aw == lo, f"abstract words={aw}")
        else:
            ok = (lo is None or aw >= lo) and (hi is None or aw <= hi)
            chk(f, f"abstract within {lo or 0}-{hi or 'inf'} words", ok, f"abstract words={aw}")

    # ---- extra front matter (e.g., IEEE Managerial Relevance Statement)
    for phrase in C.get("extra_front_matter_required", []) or []:
        chk(f, f"required front matter present: '{phrase}'", phrase.lower() in vis.lower())

    # ---- keywords
    if C.get("keywords_min"):
        kwline = next((l for l in vlines if l.lower().startswith("keywords")), "")
        nkw = len([k for k in re.split(r"[;,]", kwline.split(":", 1)[-1]) if k.strip()]) if kwline else 0
        chk(f, f"at least {C['keywords_min']} keywords", nkw >= C["keywords_min"], f"keywords={nkw}")

    # ---- references / endnotes
    model = C.get("reference_model")
    if model == "endnotes" and C.get("endnotes_contiguous"):
        notes_seen, notes_lines, in_notes = [], [], False
        for l in vlines:
            if l.strip().lower() in ("notes", "endnotes"):
                in_notes = True; continue
            if in_notes:
                mm = re.match(r"\s*(\d+)\.\s", l)
                if mm:
                    notes_seen.append(int(mm.group(1))); notes_lines.append(l)
        contiguous = notes_seen == list(range(1, len(notes_seen) + 1)) and len(notes_seen) > 0
        markers = set(int(x) for x in re.findall(
            r'<w:vertAlign w:val="superscript"/></w:rPr><w:t[^>]*>(\d+)</w:t>', doc))
        orphan = [m for m in markers if not (1 <= m <= len(notes_seen))]
        chk(f, "endnotes numbered contiguously 1..N", contiguous, f"N={len(notes_seen)} ok={contiguous}")
        chk(f, "every in-text note marker resolves to a note", not orphan,
            f"markers={sorted(markers)[:8]} orphans={orphan}")
        if C.get("etal_first_author"):
            need = []
            for l in notes_lines:
                am = re.match(r'\s*\d+\.\s+(.*?)[“"]', l)
                if am and re.search(r', [^,]+, and [A-Z]', am.group(1)):
                    need.append(am.group(1)[:48])
            chk(f, "citations with 3+ authors use 'first-author et al.'", not need,
                f"full author lists found: {need}")
    if C.get("endnotes_no_reflist"):
        has_reflist = any(re.sub(r"[^a-z]", "", l.lower()) in ("references", "bibliography", "worksited")
                          for l in vlines)
        chk(f, "no separate reference list (refs live in notes)", not has_reflist,
            "found a References/Bibliography heading" if has_reflist else "clean")
    if model == "reflist" and C.get("reference_list_required"):
        idx = next((i for i, l in enumerate(vlines)
                    if re.sub(r"[^a-z]", "", l.lower()) in ("references", "bibliography")), None)
        if idx is None:
            chk(f, "separate References section present", False, "no References/Bibliography heading")
        else:
            entries = vlines[idx + 1:]
            if C.get("references_numbered"):
                nums = [int(m.group(1)) for l in entries
                        for m in [re.match(r"\s*\[?(\d+)\]?[.\s]", l)] if m]
                chk(f, "references present and numbered", len(nums) >= 3, f"numbered entries={len(nums)}")
            else:
                chk(f, "references present", len([l for l in entries if l.strip()]) >= 3,
                    f"entries~={len([l for l in entries if l.strip()])}")

    # ---- exhibits placement
    placement = C.get("exhibits_placement")
    if placement == "separate_file":
        if C.get("no_inline_tables"):
            chk(f, "no inline tables in manuscript", "<w:tbl>" not in doc,
                "found <w:tbl>" if "<w:tbl>" in doc else "none")
        if C.get("no_inline_images"):
            chk(f, "no inline images in manuscript",
                "<w:drawing>" not in doc and "<pic:pic" not in doc)
        if C.get("require_callouts"):
            callouts = re.findall(r"\[Insert (Table|Figure|Exhibit)[^\]]*\]", vis)
            chk(f, "insertion callouts present for separated exhibits", len(callouts) >= 1,
                f"callouts found={len(callouts)}")
    elif placement == "end_of_manuscript":
        if C.get("require_callouts"):
            callouts = re.findall(r"[Ii]nsert (Table|Figure|Exhibit)", vis)
            chk(f, "insertion callouts present", len(callouts) >= 1, f"callouts={len(callouts)}")

    # ---- length
    if C.get("length_unit") == "words":
        wc = len(vis.split())
        lo, hi = C.get("length_min"), C.get("length_max")
        ok = (lo is None or wc >= lo) and (hi is None or wc <= hi)
        chk(f, f"word count within {lo}-{hi}", ok, f"words(incl notes)={wc}")
    elif C.get("length_unit") == "pages":
        wc = len(vis.split())
        chk(f, "length is page-limited (manual check; printed pages not measurable from docx)",
            True, f"body words={wc} (see profile length note)")

    # ---- markdown leakage
    if C.get("no_markdown_leak"):
        leaks = [m for m in ["{{NOTE", "[[FIGURE", "[[PAGEBREAK", "](http", "](#", "|---", "**", "## ", "### "]
                 if m in vis]
        chk(f, "no raw markdown/build markers leaked into text", not leaks, f"leaks={leaks}")


def check_title(path, C, cfg, blind_tokens):
    f = "TITLE_PAGE"
    if not path or not os.path.exists(path):
        chk(f, "file exists", False, str(path)); return
    P = parts(path); vis = all_doc_text(P)
    chk(f, "valid .docx", "word/document.xml" in P)
    if "word/document.xml" not in P: return
    # the title page is the ONE file that SHOULD carry author identity
    author_names = [a.get("name", "") for a in cfg.get("authors", [])]
    surnames = [n.split()[-1].lower() for n in author_names if n.split()]
    if surnames:
        present = all(s in vis.lower() for s in surnames)
        chk(f, "carries all author names (required here)", present,
            f"surnames={surnames}")
    vlines = [l for l in para_lines(P["word/document.xml"]) if l.strip()]
    if C.get("abstract_required"):
        chk(f, "includes abstract", any(re.sub(r"[^a-z]", "", l.lower()) == "abstract" for l in vlines))
    if C.get("keywords_min"):
        chk(f, "includes keywords", any(l.lower().startswith("keywords") for l in vlines))
    if C.get("no_em_dash"):
        chk(f, "no em-dash", "—" not in vis)


def check_exhibits(path, C, cfg, blind_tokens):
    f = "EXHIBITS"
    placement = C.get("exhibits_placement")
    if placement not in ("separate_file", "end_of_manuscript"):
        return  # inline: nothing separate to check
    if not path or not os.path.exists(path):
        # only fail if the profile mandates a separate exhibits file
        if placement == "separate_file":
            chk(f, "exhibits file exists", False, str(path))
        return
    P = parts(path); doc = P.get("word/document.xml", ""); vis = all_doc_text(P); meta = metadata_text(P)
    low = (vis + " " + meta).lower()
    chk(f, "valid .docx", "word/document.xml" in P)
    if not doc: return
    if C.get("require_blind"):
        hits = [t for t in blind_tokens if t and t in low]
        chk(f, "no author names (blind: text + metadata)", not hits, f"hits={hits}")
    if C.get("no_em_dash"):
        chk(f, "no em-dash", "—" not in vis)
    ntbl = doc.count("<w:tbl>")
    nimg = doc.count("<w:drawing>") + doc.count("<pic:pic")
    chk(f, "contains at least one table or figure", (ntbl + nimg) >= 1, f"tables={ntbl} images={nimg}")


def check_cross(files, C, cfg, blind_tokens):
    f = "CROSS"
    if C.get("require_blind") and C.get("blind_check_filenames"):
        for path in files:
            if not path:
                continue
            base = os.path.basename(path).lower()
            surnames = [a.get("name", "").split()[-1].lower() for a in cfg.get("authors", []) if a.get("name")]
            chk(f, f"filename has no author name: {os.path.basename(path)}",
                not any(s in base for s in surnames if s))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--profile"); ap.add_argument("--dir")
    ap.add_argument("--manuscript"); ap.add_argument("--title"); ap.add_argument("--exhibits")
    a = ap.parse_args()
    wd = Path(a.dir).resolve() if a.dir else paperkit.workdir()
    cfg = paperkit.load_paper_config(wd)
    prof = paperkit.get_profile(a.profile, wd)
    C = prof.get("checks", {})
    blind_tokens = paperkit.name_tokens(cfg)
    bd = wd / "build"
    build = cfg.get("build", {})
    blindname = build.get("manuscript", "Manuscript_blind.docx" if C.get("require_blind") else "Manuscript.docx")
    manu = a.manuscript or str(bd / blindname)
    title = a.title or (str(bd / build.get("title_page", "Title_Page.docx")) if prof.get("title_page_separate") else None)
    exh = a.exhibits or (str(bd / build.get("exhibits", "Exhibits_File.docx"))
                         if C.get("exhibits_placement") in ("separate_file", "end_of_manuscript") else None)

    print(f"PROFILE : {prof.get('id')} - {prof.get('name')}")
    print(f"WORKDIR : {wd}")
    print(f"checking: manuscript={manu}\n          title={title}\n          exhibits={exh}")

    if prof.get("submission_model") == "pitch":
        print("\nNOTE: pitch-model venue - manuscript format checks are not applicable.")
        print("Running voice + AI-disclosure presence only.\n")
        if os.path.exists(manu):
            P = parts(manu); vis = all_doc_text(P)
            if C.get("no_em_dash"):
                chk("PITCH", "no em-dash", "—" not in vis)
        if prof.get("ai_disclosure", {}).get("required"):
            found = os.path.exists(manu) and re.search(r"\bAI\b|artificial intelligence|generative",
                                                        all_doc_text(parts(manu)), re.I)
            chk("PITCH", "AI-use disclosure present (venue requires it)", bool(found),
                "disclose whether/how AI was used")
    else:
        check_manuscript(manu, C, cfg, blind_tokens)
        if prof.get("title_page_separate"):
            check_title(title, C, cfg, blind_tokens)
        check_exhibits(exh, C, cfg, blind_tokens)
        check_cross([manu, title, exh], C, cfg, blind_tokens)

    # ---- report
    fails = [r for r in results if not r[2]]
    cur = None
    for fil, name, ok, detail in results:
        if fil != cur:
            print(f"\n=== {fil} ==="); cur = fil
        print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f"   ->  {detail}" if (detail and not ok) else ""))
    print("\n" + "=" * 60)
    print(f"TOTAL CHECKS: {len(results)}   PASS: {len(results)-len(fails)}   FAIL: {len(fails)}")
    print("OVERALL:", f"PASS  ({prof.get('id')}-conformant)" if not fails else f"FAIL  ({len(fails)} problem(s))")
    sys.exit(0 if not fails else 1)

if __name__ == "__main__":
    main()
