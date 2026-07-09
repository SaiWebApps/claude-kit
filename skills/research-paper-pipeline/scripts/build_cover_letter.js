// Render a plain markdown cover letter to a one-page .docx.
// Usage: node build_cover_letter.js SRC.md OUT.docx
// Each non-empty line becomes a paragraph; a line that is exactly "---" adds spacing.
const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, AlignmentType } = require('docx');
const SRC = process.argv[2];
const OUT = process.argv[3] || 'Cover_Letter.docx';
function smarten(s){ return s.replace(/(\w)'(\w)/g,'$1’$2').replace(/"([^"\n]+)"/g,'“$1”'); }
function runs(text){
  const out=[];
  for(const p of text.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*)/g)){
    if(p==='') continue;
    if(/^\*\*[^*]+\*\*$/.test(p)) out.push(new TextRun({text:smarten(p.slice(2,-2)),bold:true}));
    else if(/^\*[^*]+\*$/.test(p)) out.push(new TextRun({text:smarten(p.slice(1,-1)),italics:true}));
    else out.push(new TextRun({text:smarten(p)}));
  }
  return out;
}
const lines = fs.readFileSync(SRC,'utf8').split('\n');
const body = [];
for(const raw of lines){
  const t = raw.trim();
  if(t==='---'){ body.push(new Paragraph({spacing:{after:180},children:[]})); continue; }
  const isHeading = t.startsWith('# ');
  const text = isHeading ? t.slice(2) : t;
  body.push(new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { line: 240, after: t===''?0:110 },
    children: runs(text),
  }));
}
const doc = new Document({
  styles:{ default:{ document:{ run:{ font:'Times New Roman', size:24 } } } },
  sections:[{ properties:{ page:{ size:{width:12240,height:15840}, margin:{top:1170,right:1440,bottom:1170,left:1440} } }, children: body }],
});
Packer.toBuffer(doc).then(buf=>{ fs.writeFileSync(OUT,buf); console.log('WROTE',OUT,buf.length,'bytes'); });
