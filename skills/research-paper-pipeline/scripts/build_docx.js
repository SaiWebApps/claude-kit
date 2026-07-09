const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, Header, Footer,
        AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType, PageNumber, ImageRun, PageBreak } = require('docx');

// Portable: figures resolve from $FIGURE_DIR or the output file's directory (build/),
// not a hardcoded session path.
const SRC = process.argv[2];
const OUT = process.argv[3];
const SPACING = process.argv[4] || 'single';
const RUNHEAD = process.argv[5] || '';
const FIGDIR = process.env.FIGURE_DIR || path.dirname(path.resolve(OUT));
const bodyLine = SPACING === 'double' ? 480 : 264;

const lines = fs.readFileSync(SRC, 'utf8').split('\n');

function smarten(s) { return s.replace(/(\w)'(\w)/g, '$1’$2').replace(/"([^"\n]+)"/g, '“$1”'); }
function styleRuns(text, base) {
  const out = [];
  for (const p of text.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*)/g)) {
    if (p === '') continue;
    if (/^\*\*[^*]+\*\*$/.test(p)) out.push(new TextRun({ text: smarten(p.slice(2, -2)), bold: true, ...base }));
    else if (/^\*[^*]+\*$/.test(p)) out.push(new TextRun({ text: smarten(p.slice(1, -1)), italics: true, ...base }));
    else out.push(new TextRun({ text: smarten(p), ...base }));
  }
  return out;
}
function runs(text, base = {}) {
  const out = [];
  for (const tok of text.split(/(\{\{NOTE:\d+\}\})/g)) {
    if (tok === '') continue;
    const m = tok.match(/^\{\{NOTE:(\d+)\}\}$/);
    if (m) out.push(new TextRun({ text: m[1], superScript: true, ...base }));
    else out.push(...styleRuns(tok, base));
  }
  return out;
}

const border = { style: BorderStyle.SINGLE, size: 1, color: 'BBBBBB' };
const cb = { top: border, bottom: border, left: border, right: border };
function buildTable(rowsRaw) {
  const rows = rowsRaw.map(r => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim()))
    .filter(cells => !cells.every(c => /^[-: ]*$/.test(c)));
  const ncol = rows.length ? rows[0].length : 2;
  const TOTAL = 9360;
  const first = ncol >= 3 ? Math.round(TOTAL * 0.34) : Math.round(TOTAL / ncol);
  const rest = Math.floor((TOTAL - first) / (ncol - 1));
  const COLW = [first, ...Array(ncol - 1).fill(rest)];
  COLW[0] += TOTAL - COLW.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: TOTAL, type: WidthType.DXA }, columnWidths: COLW,
    rows: rows.map((cells, ri) => new TableRow({
      tableHeader: ri === 0,
      children: cells.map((c, ci) => new TableCell({
        borders: cb, width: { size: COLW[ci] || rest, type: WidthType.DXA },
        margins: { top: 60, bottom: 60, left: 110, right: 110 },
        shading: ri === 0 ? { fill: 'EFEFEF', type: ShadingType.CLEAR } : undefined,
        children: [new Paragraph({ alignment: ci === 0 ? AlignmentType.LEFT : AlignmentType.CENTER,
          spacing: { line: 240, after: 0 }, children: runs(c, { size: 19, bold: ri === 0 }) })],
      })),
    })),
  });
}

const children = [];
let mode = 'body';
let titleDone = false;
let tableBuf = [];
function flushTable() {
  if (!tableBuf.length) return;
  children.push(buildTable(tableBuf));
  children.push(new Paragraph({ spacing: { after: 160 }, children: [] }));
  tableBuf = [];
}

for (const lineRaw of lines) {
  const line = lineRaw.trimEnd();
  if (/^\|/.test(line.trim())) { tableBuf.push(line.trim()); continue; }
  flushTable();
  const t = line.trim();
  if (t === '' || t === '---') continue;

  if (t === '[[PAGEBREAK]]') { children.push(new Paragraph({ children: [new PageBreak()] })); continue; }

  if (t.startsWith('# ') && !titleDone) {
    titleDone = true;
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 200 },
      children: runs(t.slice(2), { size: 34, bold: true }) }));
    continue;
  }
  if (t.startsWith('#### ')) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 80 }, children: runs(t.slice(5), { bold: true, color: '000000', size: 24 }) }));
    continue;
  }
  if (t.startsWith('### ')) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 100 }, children: runs(t.slice(4), { bold: true, italics: true, color: '000000', size: 26 }) }));
    continue;
  }
  if (t.startsWith('## ')) {
    const text = t.slice(3);
    mode = /^Notes/.test(text) ? 'notes' : (/^References/.test(text) ? 'notes' : (/^About the Authors/.test(text) ? 'bios' : (/^Exhibits/.test(text) ? 'exhibits' : 'body')));
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 160 }, children: runs(text, { bold: true, color: '000000', size: 28 }) }));
    continue;
  }
  const figm = t.match(/^\[\[FIGURE:(.+?)\]\]$/);
  if (figm) {
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 120 },
      children: [ new ImageRun({ type: 'png', data: fs.readFileSync(path.join(FIGDIR, figm[1])),
        transformation: { width: 560, height: 292 }, altText: { title: 'Figure', description: 'Figure', name: 'figure' } }) ] }));
    continue;
  }
  if (t.startsWith('[Insert ')) {
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 160, after: 160 },
      children: [new TextRun({ text: smarten(t), italics: true, color: '555555' })] }));
    continue;
  }
  if (t.startsWith('**Table ') || t.startsWith('**Figure') || t.startsWith('*Caption:*')) {
    children.push(new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 120, after: 80 }, children: runs(t, { size: 20 }) }));
    continue;
  }
  if ((mode === 'notes' || mode === 'exhibits') && /^\[?\d+\]?[.\s]/.test(t)) {
    const isNotes = mode === 'notes';
    children.push(new Paragraph({ indent: { left: 360, hanging: 360 },
      spacing: { line: isNotes ? bodyLine : 248, lineRule: 'auto', after: isNotes ? 120 : 100 },
      alignment: AlignmentType.LEFT, children: runs(t, { size: isNotes ? 24 : 22 }) }));
    continue;
  }
  if (mode === 'bios') {
    children.push(new Paragraph({ spacing: { line: 252, after: 120 }, alignment: AlignmentType.LEFT, children: runs(t, { size: 22 }) }));
    continue;
  }
  children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { line: bodyLine, lineRule: 'auto', after: 140 }, children: runs(t) }));
}
flushTable();

const doc = new Document({
  styles: { default: { document: { run: { font: 'Times New Roman', size: 24 } } } },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: RUNHEAD, size: 18, color: '888888', italics: true })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ size: 18, color: '888888', children: [PageNumber.CURRENT] })] })] }) },
    children,
  }],
});
Packer.toBuffer(doc).then(buf => { fs.writeFileSync(OUT, buf); console.log('WROTE', OUT, buf.length, 'bytes'); });
