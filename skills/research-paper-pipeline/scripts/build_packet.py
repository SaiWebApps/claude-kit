#!/usr/bin/env python3
"""build_packet.py - merge submission-component PDFs into one navigable review packet.

Portable and config-driven. Reads a component list from paper.config.json ("packet": a
list of {pdf, title, desc}); if none is given, auto-discovers *.pdf in build/. Builds a
cover page and section dividers, then merges. Originals are never modified.
Output: <WORKDIR>/build/Review_Packet.pdf
Requires: reportlab, pypdf, and component PDFs already rendered (e.g. via LibreOffice).
"""
import sys, os, glob, argparse
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import paperkit
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib import colors
from pypdf import PdfReader, PdfWriter

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir")
    a = ap.parse_args()
    wd = Path(a.dir).resolve() if a.dir else paperkit.workdir()
    cfg = paperkit.load_paper_config(wd)
    bd = paperkit.build_dir_for(wd)
    OUT = str(bd / "Review_Packet.pdf")

    components = cfg.get("packet")
    if not components:
        components = [{"pdf": os.path.basename(p), "title": os.path.basename(p)[:-4], "desc": ""}
                     for p in sorted(glob.glob(str(bd / "*.pdf"))) if "Review_Packet" not in p]
    if not components:
        print("No component PDFs found in", bd, "- render .docx to .pdf first (e.g. LibreOffice).")
        sys.exit(1)

    st = getSampleStyleSheet()
    H = ParagraphStyle('H', parent=st['Title'], fontName='Times-Bold', fontSize=22, leading=27, alignment=TA_CENTER)
    SUB = ParagraphStyle('SUB', parent=st['Normal'], fontName='Times-Roman', fontSize=12.5, leading=17, alignment=TA_CENTER, textColor=colors.HexColor('#444444'))
    ITEM = ParagraphStyle('ITEM', parent=st['Normal'], fontName='Times-Roman', fontSize=12, leading=16, alignment=TA_LEFT)
    NOTE = ParagraphStyle('NOTE', parent=st['Normal'], fontName='Times-Italic', fontSize=10.5, leading=15, alignment=TA_LEFT, textColor=colors.HexColor('#555555'))
    DIVN = ParagraphStyle('DIVN', parent=st['Normal'], fontName='Times-Bold', fontSize=13, leading=17, alignment=TA_CENTER, textColor=colors.HexColor('#999999'))
    DIVT = ParagraphStyle('DIVT', parent=st['Title'], fontName='Times-Bold', fontSize=23, leading=28, alignment=TA_CENTER)
    DIVD = ParagraphStyle('DIVD', parent=st['Normal'], fontName='Times-Italic', fontSize=12, leading=17, alignment=TA_CENTER, textColor=colors.HexColor('#555555'))

    tmp = bd / "_packet_tmp"; tmp.mkdir(exist_ok=True)
    def cover(path):
        doc = SimpleDocTemplate(path, pagesize=letter, topMargin=1.25*inch, bottomMargin=1*inch, leftMargin=1.1*inch, rightMargin=1.1*inch)
        s = [Paragraph(cfg.get("title", "Submission Packet"), H), Spacer(1, 18),
             Paragraph(f"{cfg.get('running_head','')}: Submission Packet", SUB), Spacer(1, 24),
             Paragraph("Contents", ParagraphStyle('c', parent=ITEM, fontName='Times-Bold', fontSize=13)), Spacer(1, 8)]
        for i, c in enumerate(components, 1):
            s += [Paragraph(f"<b>{i}.&nbsp;&nbsp;{c['title']}</b>", ITEM)]
            if c.get("desc"):
                s += [Paragraph(f"&nbsp;&nbsp;&nbsp;&nbsp;{c['desc']}", NOTE)]
            s += [Spacer(1, 5)]
        doc.build(s)
    def divider(path, num, title, desc):
        doc = SimpleDocTemplate(path, pagesize=letter, topMargin=3.3*inch)
        s = [Paragraph(f"SECTION {num}", DIVN), Spacer(1, 14), Paragraph(title, DIVT)]
        if desc:
            s += [Spacer(1, 14), Paragraph(desc, DIVD)]
        doc.build(s)

    cover(str(tmp / "00_cover.pdf"))
    order = [str(tmp / "00_cover.pdf")]
    missing = []
    for i, c in enumerate(components, 1):
        divider(str(tmp / f"div_{i}.pdf"), i, c["title"], c.get("desc", ""))
        order.append(str(tmp / f"div_{i}.pdf"))
        pdfp = c["pdf"] if os.path.isabs(c["pdf"]) else str(bd / c["pdf"])
        (order.append(pdfp) if os.path.exists(pdfp) else missing.append(pdfp))
    if missing:
        print("MISSING component PDFs:", missing); sys.exit(1)

    writer = PdfWriter()
    for f in order:
        for pg in PdfReader(f).pages:
            writer.add_page(pg)
    writer.add_metadata({"/Title": cfg.get("title", "Submission Packet"), "/Author": "Anonymous"})
    with open(OUT, "wb") as fh:
        writer.write(fh)
    for f in glob.glob(str(tmp / "*.pdf")):
        os.remove(f)
    tmp.rmdir()
    print("merged pages:", len(writer.pages), "->", OUT)

if __name__ == "__main__":
    main()
