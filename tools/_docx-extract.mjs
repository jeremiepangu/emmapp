import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const src = process.argv[2];
const dst = process.argv[3];

const dir = mkdtempSync(join(tmpdir(), 'docx-'));
execFileSync('powershell', [
  '-NoProfile',
  '-Command',
  `Copy-Item "${src}" "${join(dir, 'd.zip')}"; Expand-Archive "${join(dir, 'd.zip')}" -DestinationPath "${dir}" -Force`,
]);

const xml = readFileSync(join(dir, 'word', 'document.xml'), 'utf8');

const unescape = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

/** Texte d'un fragment XML : concatène les <w:t> et respecte les sauts de ligne. */
const textOf = (frag) =>
  unescape(
    frag
      .replace(/<w:br\s*\/>/g, '\n')
      .replace(/<w:tab\s*\/>/g, '\t')
      .match(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)
      ?.map((m) => m.replace(/<[^>]+>/g, ''))
      .join('') ?? '',
  ).trim();

const bodyMatch = xml.match(/<w:body>([\s\S]*)<\/w:body>/);
const body = bodyMatch ? bodyMatch[1] : xml;

// Découpe le corps en blocs de premier niveau : paragraphes et tableaux.
const blocks = [];
const re = /<w:tbl>[\s\S]*?<\/w:tbl>|<w:p\b[\s\S]*?<\/w:p>|<w:p\b[^>]*\/>/g;
let m;
while ((m = re.exec(body)) !== null) blocks.push(m[0]);

const lines = [];
let tableNo = 0;

for (const block of blocks) {
  if (block.startsWith('<w:tbl>')) {
    tableNo += 1;
    lines.push(`\n=== TABLEAU ${tableNo} ===`);
    const rows = block.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) ?? [];
    for (const row of rows) {
      const cells = row.match(/<w:tc>[\s\S]*?<\/w:tc>/g) ?? [];
      lines.push('| ' + cells.map((c) => textOf(c).replace(/\n/g, ' ')).join(' | ') + ' |');
    }
    lines.push('');
    continue;
  }
  const style = block.match(/<w:pStyle w:val="([^"]+)"\/>/)?.[1] ?? '';
  const txt = textOf(block);
  if (!txt) continue;
  lines.push(style ? `[${style}] ${txt}` : txt);
}

const out = lines.join('\n');
if (dst) writeFileSync(dst, out, 'utf8');
else process.stdout.write(out);
