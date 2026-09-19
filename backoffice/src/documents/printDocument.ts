const COMPANY = {
  brand: 'EMMANUEL SERVICES',
  name: 'EMMANUEL SERVICES SARLU',
  logo: '/logo-emmanuel-services.png',
  tagline: 'Production et distribution d\'eau potable',
  address: 'Kinshasa, Bandalungwa, RDC',
  phone: '+243 813 170 215',
  email: 'contact@emmas.cd',
  web: 'www.emmas.cd',
  legal: 'RCCM KNG/RCCM/24-B-02180 · IMPOT A2425053J · ID NAT 01-F4300-N64238H',
  motto: 'Consommer de l\'eau de bonne qualité est essentiel pour maintenir une bonne santé.',
};

export interface DocField {
  label: string;
  value: string;
}

export interface DocTable {
  title?: string;
  headers: string[];
  rows: string[][];
}

export interface DocKpi {
  label: string;
  value: string;
  hint?: string;
  tone?: 'green' | 'blue' | 'purple' | 'orange' | 'red';
}

export interface DocBar {
  label: string;
  pct: number;
  caption?: string;
}

export type BlankTableSpec = {
  title?: string;
  headers: string[];
  rowCount: number;
  showTotal?: boolean;
  half?: boolean;
};

export interface DocSpec {
  kind: string;
  reference?: string;
  date?: string;
  subtitle?: string;
  fields?: DocField[];
  kpis?: DocKpi[];
  bars?: DocBar[];
  tables?: DocTable[];
  notes?: string;
  totals?: DocField[];
  signatures?: string[];
  logoUrl?: string;
  paper?: boolean;
  lean?: boolean;
  instructions?: string;
  handFields?: Array<{ label: string; wide?: boolean }>;
  handNotes?: Array<{ label: string; lines?: number }>;
  checks?: string[];
  blankTable?: BlankTableSpec;
  blankTables?: BlankTableSpec[];
  copiesPerPage?: 1 | 2 | 4;
}

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatMoney(value: string | number | undefined | null): string {
  const n = Number(value ?? 0);
  return `${n.toLocaleString('fr-FR')} CDF`;
}

export function formatDate(value?: string | Date | null): string {
  if (!value) return new Date().toLocaleString('fr-FR');
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('fr-FR');
}

const KPI_TONES = ['green', 'blue', 'purple', 'orange'] as const;

function fieldsHtml(fields?: DocField[]): string {
  if (!fields?.length) return '';
  return `<div class="card"><div class="meta">${fields.map((f) => `<div><span>${esc(f.label)}</span><strong>${esc(f.value)}</strong></div>`).join('')}</div></div>`;
}

function kpisHtml(kpis?: DocKpi[]): string {
  if (!kpis?.length) return '';
  return `<div class="kpis">${kpis.map((k, i) => {
    const tone = k.tone ?? KPI_TONES[i % KPI_TONES.length];
    const blank = !String(k.value ?? '').trim();
    return `<div class="kpi kpi--${tone}${blank ? ' kpi--hand' : ''}"><span>${esc(k.label)}</span><strong${blank ? ' class="hand"' : ''}>${esc(blank ? ' ' : k.value)}</strong>${k.hint ? `<em>${esc(k.hint)}</em>` : ''}</div>`;
  }).join('')}</div>`;
}

function barsHtml(bars?: DocBar[]): string {
  if (!bars?.length) return '';
  const rows = bars.map((b, i) => {
    const pct = Math.max(0, Math.min(100, Number.isFinite(b.pct) ? Math.round(b.pct) : 0));
    const tone = KPI_TONES[i % KPI_TONES.length];
    return `<div class="bar-row"><div class="bar-lab"><span>${esc(b.label)}</span><em>${esc(b.caption ?? `${pct} %`)}</em></div><div class="bar"><i class="bar--${tone}" style="width:${pct}%"></i></div></div>`;
  }).join('');
  return `<div class="card"><div class="card-h">Avancement</div><div class="bars">${rows}</div></div>`;
}

function tableHtml(table: DocTable): string {
  const head = table.headers.map((h) => `<th>${esc(h)}</th>`).join('');
  const body = table.rows.length
    ? table.rows.map((row) => `<tr>${row.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${table.headers.length}">Aucune ligne</td></tr>`;
  return `<div class="card">${table.title ? `<div class="card-h">${esc(table.title)}</div>` : ''}<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function handFieldsHtml(fields?: Array<{ label: string; wide?: boolean }>, lean = false): string {
  if (!fields?.length) return '';
  const title = lean ? '' : `<div class="card-h">Mentions à compléter à la main</div>`;
  return `<div class="card">${title}<div class="meta">${fields.map((f) => `<div${f.wide ? ' class="wide"' : ''}><span>${esc(f.label)}</span><strong class="hand">&nbsp;</strong></div>`).join('')}</div></div>`;
}

function checksHtml(items?: string[]): string {
  if (!items?.length) return '';
  return `<div class="card"><div class="card-h">Cases à cocher</div><div class="checks">${items.map((c) => `<div class="check"><i class="box"></i><span>${esc(c)}</span></div>`).join('')}</div></div>`;
}

function blankTableHtml(
  table?: BlankTableSpec,
  copiesPerPage: 1 | 2 | 4 = 1,
): string {
  if (!table?.headers.length) return '';
  const cap = copiesPerPage === 1 ? 24 : copiesPerPage === 2 ? 12 : 6;
  const count = Math.max(2, Math.min(cap, table.rowCount || 8));
  const head = table.headers.map((h) => `<th>${esc(h)}</th>`).join('');
  const rows = Array.from({ length: count }, () => `<tr>${table.headers.map(() => '<td class="blank-cell">&nbsp;</td>').join('')}</tr>`).join('');
  const total = table.showTotal
    ? `<tfoot><tr class="total-row"><th>TOTAL</th>${table.headers.slice(1).map(() => '<td class="blank-cell">&nbsp;</td>').join('')}</tr></tfoot>`
    : '';
  return `<div class="card${table.half ? ' card--half' : ''}">${table.title ? `<div class="card-h">${esc(table.title)}</div>` : ''}<table class="blank"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody>${total}</table></div>`;
}

function blankTablesHtml(tables?: BlankTableSpec[], copiesPerPage: 1 | 2 | 4 = 1): string {
  if (!tables?.length) return '';
  const chunks: string[] = [];
  let i = 0;
  while (i < tables.length) {
    const cur = tables[i];
    const next = tables[i + 1];
    if (cur.half && next?.half) {
      chunks.push(`<div class="split">${blankTableHtml(cur, copiesPerPage)}${blankTableHtml(next, copiesPerPage)}</div>`);
      i += 2;
      continue;
    }
    chunks.push(blankTableHtml(cur, copiesPerPage));
    i += 1;
  }
  return chunks.join('');
}

function handNotesHtml(notes?: Array<{ label: string; lines?: number }>): string {
  if (!notes?.length) return '';
  return notes.map((n) => {
    const lines = Array.from({ length: Math.max(1, n.lines ?? 1) }, () => '<div class="hand-line">&nbsp;</div>').join('');
    return `<div class="card"><div class="card-h">${esc(n.label)}</div>${lines}</div>`;
  }).join('');
}

function instructionsHtml(text?: string, paper?: boolean, lean = false): string {
  if (lean) return text ? `<div class="banner banner--lean">${esc(text)}</div>` : '';
  if (!text && !paper) return '';
  const banner = paper
    ? 'Formulaire papier — traitement manuel. Remplir à l\'encre, parapher chaque page, puis saisir dans EMMAPP.'
    : '';
  return `<div class="banner">${esc([banner, text].filter(Boolean).join(' — '))}</div>`;
}

function logoHtml(url?: string): string {
  if (!url) return '';
  return `<img class="party-logo" src="${esc(url)}" alt="Logo" />`;
}

let pendingOutput: 'print' | 'pdf' = 'print';

export function setDocumentOutput(mode: 'print' | 'pdf'): void {
  pendingOutput = mode;
}

function copiesOf(spec: DocSpec): 1 | 2 | 4 {
  if (spec.copiesPerPage === 2 || spec.copiesPerPage === 4) return spec.copiesPerPage;
  return 1;
}

function pieceHtml(spec: DocSpec, copyIndex: number, copiesPerPage: 1 | 2 | 4): string {
  const issued = formatDate(spec.date);
  const signatures = spec.signatures?.length ? spec.signatures : ['Pour EMMANUEL SERVICES SARLU', 'Pour le destinataire'];
  const logo = logoHtml(spec.logoUrl ?? (typeof window !== 'undefined' ? `${window.location.origin}${COMPANY.logo}` : COMPANY.logo));
  const cut = copiesPerPage > 1 ? `<div class="cut">${copyIndex + 1}/${copiesPerPage}</div>` : '';
  const lean = !!spec.lean;
  return `<article class="sheet${spec.paper ? ' sheet--paper' : ''}${lean ? ' sheet--lean' : ''}">
    ${cut}
    <header class="mast">
      <div class="mast-left">
        ${logo}
        <div>
          <div class="brand">${esc(COMPANY.brand)}</div>
          <div class="name">${esc(COMPANY.name)}</div>
        </div>
      </div>
      <div class="doc">
        <div class="kind">${esc(spec.kind)}</div>
        ${spec.reference ? `<div class="ref">${esc(spec.reference)}</div>` : ''}
        <div class="issued">${esc(issued)}${spec.subtitle ? ` · ${esc(spec.subtitle)}` : ''}</div>
      </div>
    </header>
    <div class="body">
      ${lean ? '' : `<div class="company">${esc(COMPANY.tagline)} · ${esc(COMPANY.address)} · ${esc(COMPANY.phone)} · ${esc(COMPANY.email)}</div>`}
      ${instructionsHtml(spec.instructions, spec.paper, lean)}
      ${fieldsHtml(spec.fields)}
      ${handFieldsHtml(spec.handFields, lean)}
      ${checksHtml(spec.checks)}
      ${kpisHtml(spec.kpis)}
      ${barsHtml(spec.bars)}
      ${(spec.tables ?? []).map(tableHtml).join('')}
      ${blankTablesHtml(spec.blankTables, copiesPerPage)}
      ${blankTableHtml(spec.blankTable, copiesPerPage)}
      ${handNotesHtml(spec.handNotes)}
      ${spec.totals?.length ? `<div class="card"><table class="totals">${spec.totals.map((t) => `<tr><th>${esc(t.label)}</th><td>${esc(t.value)}</td></tr>`).join('')}</table></div>` : ''}
      ${spec.notes ? `<div class="notes">${esc(spec.notes)}</div>` : ''}
      <div class="sign">${signatures.map((s) => `<div>${esc(s)}<br/>Nom et signature</div>`).join('')}</div>
      <div class="foot">${lean ? '' : `${esc(COMPANY.motto)}<br/>`}${esc(COMPANY.legal)}</div>
    </div>
  </article>`;
}

export function buildDocumentHtml(spec: DocSpec, autoPdf = false): string {
  const fileName = `${spec.kind}${spec.reference ? `-${spec.reference}` : ''}`.replace(/[^\wÀ-ÿ.-]+/g, '_');
  const copiesPerPage = copiesOf(spec);
  const copies = Array.from({ length: copiesPerPage }, (_, i) => pieceHtml(spec, i, copiesPerPage)).join('');
  const hint = copiesPerPage === 1
    ? 'Une pièce par feuille A4.'
    : `${copiesPerPage} pièces identiques par feuille A4 — découper suivant les pointillés.`;
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>${esc(spec.kind)} ${esc(spec.reference ?? '')}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Open+Sans:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    @page { size: A4 portrait; margin: 5mm; }
    * { box-sizing: border-box; }
    body {
      font-family: Inter, "Open Sans", "Segoe UI", Arial, sans-serif;
      color: #1a2b3c;
      margin: 0;
      background: #f4f6f8;
    }
    .toolbar {
      position: sticky; top: 0; z-index: 2;
      display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
      padding: 10px 16px;
      background: #f4f6f8;
      color: #1a2b3c;
      border-bottom: 1px solid #e8eef2;
    }
    .toolbar button {
      border: 0; border-radius: 8px; padding: 8px 14px; cursor: pointer;
      font-weight: 600; font-family: inherit;
    }
    .toolbar .print { background: #3b82f6; color: #fff; }
    .toolbar .pdf { background: #16a34a; color: #fff; }
    .hint { margin: 0; font-size: 12px; color: #64748b; font-family: "Open Sans", Inter, sans-serif; }
    .copies {
      display: grid;
      gap: 8px;
      max-width: 720px;
      margin: 16px auto 28px;
      aspect-ratio: 210 / 297;
      background: #fff;
      padding: 8px;
      border: 1px solid #e8eef2;
      border-radius: 12px;
      box-shadow: 0 4px 16px rgba(26, 43, 60, 0.06);
    }
    .copies-1 { grid-template-columns: 1fr; grid-template-rows: 1fr; }
    .copies-2 { grid-template-columns: 1fr; grid-template-rows: 1fr 1fr; }
    .copies-4 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
    .sheet {
      position: relative;
      background: #fff;
      border: 0.6pt dashed #94a3b8;
      border-radius: 0;
      overflow: hidden;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }
    .copies-1 .sheet { border-style: solid; }
    .cut {
      position: absolute; top: 6px; right: 8px;
      font-size: 9px; font-weight: 700; letter-spacing: 0.06em;
      color: #94a3b8; font-family: Inter, sans-serif;
    }
    .mast {
      display: flex; justify-content: space-between; gap: 12px; align-items: center;
      background: #f4f6f8;
      color: #1a2b3c;
      padding: 10px 12px;
      border-bottom: 3px solid #22c55e;
    }
    .mast-left { display: flex; gap: 10px; align-items: center; min-width: 0; }
    .party-logo {
      max-height: 40px; max-width: 40px; object-fit: contain;
      background: #fff; border: 1px solid #e8eef2; border-radius: 8px; padding: 3px;
    }
    .brand { font-size: 13px; font-weight: 800; letter-spacing: 0.04em; color: #1a2b3c; }
    .name { font-size: 10px; font-weight: 600; color: #64748b; margin-top: 1px; font-family: "Open Sans", Inter, sans-serif; }
    .doc { text-align: right; }
    .kind { font-size: 11px; font-weight: 800; color: #15803d; text-transform: uppercase; letter-spacing: 0.06em; }
    .ref { font-size: 11px; font-weight: 700; color: #1a2b3c; margin-top: 2px; }
    .issued { font-size: 9px; color: #64748b; margin-top: 2px; font-family: "Open Sans", Inter, sans-serif; }
    .body { padding: 8px 10px 10px; }
    .company { font-size: 9px; color: #64748b; margin: 0 0 8px; line-height: 1.4; font-family: "Open Sans", Inter, sans-serif; }
    .card { background: #fff; border: 1px solid #e8eef2; border-radius: 8px; padding: 8px 10px; margin: 0 0 8px; }
    .card-h { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; margin: 0 0 6px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 10px; margin: 0; }
    .meta span { display: block; font-size: 8px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; }
    .meta strong { display: block; font-size: 11px; font-weight: 600; margin-top: 1px; color: #1a2b3c; font-family: "Open Sans", Inter, sans-serif; }
    table { width: 100%; border-collapse: collapse; margin: 0; font-size: 9px; font-family: "Open Sans", Inter, sans-serif; }
    th, td { border: 0; border-bottom: 1px solid #e8eef2; padding: 4px 5px; text-align: left; }
    th { background: #f4f6f8; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; font-size: 8px; font-weight: 700; font-family: Inter, sans-serif; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    .kpis { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin: 0 0 8px; }
    .kpi { background: #fff; border: 1px solid #e8eef2; border-radius: 8px; padding: 6px 8px; border-top: 2px solid #22c55e; }
    .kpi--green { border-top-color: #22c55e; }
    .kpi--blue { border-top-color: #3b82f6; }
    .kpi--purple { border-top-color: #8b5cf6; }
    .kpi--orange { border-top-color: #f59e0b; }
    .kpi--red { border-top-color: #ef4444; }
    .kpi span { display: block; font-size: 8px; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; }
    .kpi strong { display: block; font-size: 14px; font-weight: 800; margin-top: 4px; color: #1a2b3c; }
    .kpi em { display: block; font-size: 9px; color: #16a34a; font-style: normal; margin-top: 3px; font-weight: 600; }
    .bars { margin: 0; }
    .bar-row { margin: 0 0 6px; }
    .bar-lab { display: flex; justify-content: space-between; gap: 8px; font-size: 9px; margin-bottom: 3px; font-weight: 500; }
    .bar-lab em { font-style: normal; color: #64748b; white-space: nowrap; font-weight: 600; }
    .bar { height: 5px; background: #e8eef2; border-radius: 99px; overflow: hidden; }
    .bar i { display: block; height: 100%; border-radius: 99px; background: #22c55e; }
    .bar i.bar--green { background: #22c55e; }
    .bar i.bar--blue { background: #3b82f6; }
    .bar i.bar--purple { background: #8b5cf6; }
    .bar i.bar--orange { background: #f59e0b; }
    .notes {
      background: #f8fafc; border: 1px solid #e8eef2; border-left: 3px solid #22c55e;
      border-radius: 8px; padding: 6px 8px; font-size: 9px; white-space: pre-wrap; margin: 0 0 8px;
      font-family: "Open Sans", Inter, sans-serif; color: #1a2b3c; max-height: 42mm; overflow: hidden;
    }
    .totals { margin-left: auto; width: 180px; }
    .totals th { background: #ecfdf3; color: #15803d; }
    .sign { display: flex; justify-content: space-between; gap: 12px; margin-top: 10px; }
    .sign div { flex: 1; border-top: 1.5px solid #1a2b3c; padding-top: 4px; min-height: 22px; font-size: 9px; color: #64748b; font-family: "Open Sans", Inter, sans-serif; }
    .foot { margin-top: 8px; border-top: 1px solid #e8eef2; padding-top: 4px; font-size: 8px; color: #64748b; font-family: "Open Sans", Inter, sans-serif; }
    .meta .wide { grid-column: 1 / -1; }
    .sheet--paper .hand {
      display: block; min-height: 16px; border-bottom: 1px solid #1a2b3c;
      margin-top: 3px; font-weight: 400;
    }
    .hand { display: block; min-height: 18px; border-bottom: 1px solid #1a2b3c; margin-top: 4px; font-weight: 400; }
    table.blank th, table.blank td { border: 1px solid #e8eef2; }
    table.blank th { white-space: normal; line-height: 1.2; }
    table.blank td.blank-cell { height: 16px; background: #fff; }
    table.blank tfoot .total-row th,
    table.blank tfoot .total-row td {
      background: #ecfdf3;
      color: #15803d;
      font-weight: 800;
      font-family: Inter, sans-serif;
      height: 22px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .copies-1 table { font-size: 10px; }
    .copies-1 th { font-size: 8px; }
    .copies-1 table.blank td.blank-cell { height: 18px; }
    .copies-1 .kind { font-size: 13px; }
    .copies-1 .brand { font-size: 14px; }
    .copies-1 .body { padding: 10px 12px 12px; }
    .copies-1 .kpis { grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); }
    .copies-1 .notes { max-height: none; }
    .copies-2 table.blank td.blank-cell { height: 18px; }
    .split { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin: 0 0 6px; }
    .split .card { margin: 0; }
    .hand-line {
      min-height: 14px; border-bottom: 1px solid #1a2b3c; margin: 4px 0 2px;
    }
    .sheet--lean .mast { padding: 6px 10px; }
    .sheet--lean .party-logo { max-height: 32px; max-width: 32px; }
    .sheet--lean .body { padding: 6px 8px 8px; }
    .sheet--lean .card { padding: 5px 6px; margin: 0 0 5px; border-radius: 6px; }
    .sheet--lean .card-h { margin: 0 0 4px; }
    .sheet--lean .meta { grid-template-columns: 1fr 1fr 1fr 1fr; gap: 4px 8px; }
    .sheet--lean .kpis { grid-template-columns: repeat(auto-fit, minmax(70px, 1fr)); gap: 4px; margin: 0 0 5px; }
    .sheet--lean .kpi { padding: 4px 6px; }
    .sheet--lean .kpi strong { font-size: 12px; min-height: 14px; margin-top: 2px; }
    .sheet--lean table { font-size: 8px; }
    .sheet--lean th { font-size: 7px; padding: 3px 4px; }
    .sheet--lean td { padding: 2px 4px; }
    .sheet--lean table.blank td.blank-cell { height: 13px; }
    .sheet--lean table.blank tfoot .total-row th,
    .sheet--lean table.blank tfoot .total-row td { height: 16px; }
    .sheet--lean .sign { margin-top: 6px; }
    .sheet--lean .sign div { min-height: 16px; font-size: 8px; }
    .sheet--lean .foot { margin-top: 4px; font-size: 7px; }
    .sheet--lean .hand { min-height: 13px; margin-top: 2px; }
    .sheet--lean .banner--lean { padding: 3px 6px; margin: 0 0 5px; font-size: 8px; }
    .copies-1 .sheet--lean .kind { font-size: 11px; }
    .copies-1 .sheet--lean .brand { font-size: 12px; }
    .copies-1 .sheet--lean .body { padding: 6px 8px 8px; }
    .copies-1 .sheet--lean table { font-size: 8px; }
    .copies-1 .sheet--lean table.blank td.blank-cell { height: 13px; }
    .sheet--paper .banner {
      background: #ecfdf3; border: 1px dashed #86efac; color: #15803d;
      font-family: "Open Sans", Inter, sans-serif;
    }
    .banner {
      background: #f4f6f8; border: 1px dashed #cbd5e1; border-radius: 8px;
      padding: 6px 8px; font-size: 9px; margin: 0 0 8px; color: #1a2b3c; line-height: 1.35;
      font-family: "Open Sans", Inter, sans-serif;
    }
    .checks { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 8px; }
    .check { display: flex; gap: 6px; align-items: center; font-size: 10px; font-family: "Open Sans", Inter, sans-serif; color: #1a2b3c; }
    .box { width: 11px; height: 11px; border: 1.4px solid #1a2b3c; display: inline-block; flex-shrink: 0; border-radius: 2px; background: #fff; }
    @media print {
      body { background: #fff; }
      .toolbar, .hint { display: none !important; }
      .copies {
        display: grid;
        gap: 3mm;
        max-width: none;
        margin: 0;
        width: 200mm;
        height: 287mm;
        padding: 0;
        border: 0;
        border-radius: 0;
        box-shadow: none;
        aspect-ratio: auto;
      }
      .copies-1 { grid-template-columns: 1fr; grid-template-rows: 1fr; }
      .copies-2 { grid-template-columns: 1fr; grid-template-rows: 1fr 1fr; }
      .copies-4 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
      .copies .sheet,
      .copies .sheet + .sheet {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        overflow: hidden;
        margin: 0;
        border: 0.4pt dashed #94a3b8;
        border-radius: 0;
        box-shadow: none;
      }
      .copies-1 .sheet { max-height: none; border-style: solid; }
      .copies-2 .sheet { max-height: 142mm; }
      .copies-4 .sheet { max-height: 142mm; }
      .sheet .body { flex: 1; overflow: hidden; }
    }
    @media (max-width: 720px) { .kpis { grid-template-columns: 1fr 1fr; } }
    body.pdf-export { background: #fff; }
    body.pdf-export .toolbar, body.pdf-export .hint { display: none !important; }
    body.pdf-export .copies {
      display: grid;
      gap: 3mm;
      max-width: none;
      width: 200mm;
      height: 287mm;
      margin: 0;
      padding: 0;
      border: 0;
      aspect-ratio: auto;
    }
    body.pdf-export .copies-1 { grid-template-columns: 1fr; grid-template-rows: 1fr; }
    body.pdf-export .copies-2 { grid-template-columns: 1fr; grid-template-rows: 1fr 1fr; }
    body.pdf-export .copies-4 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
    body.pdf-export .copies .sheet,
    body.pdf-export .copies .sheet + .sheet {
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border: 0.4pt dashed #94a3b8;
      border-radius: 0;
      box-shadow: none;
    }
    body.pdf-export .copies-1 .sheet { height: 287mm; }
    body.pdf-export .copies-2 .sheet { height: 142mm; }
    body.pdf-export .copies-4 .sheet { height: 142mm; }
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="print" type="button" onclick="window.print()">Imprimer (${copiesPerPage} / A4)</button>
    <button class="pdf" type="button" onclick="downloadPdf()">Télécharger PDF</button>
    <p class="hint">${esc(hint)}</p>
  </div>
  <div class="copies copies-${copiesPerPage}">${copies}</div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.2/html2pdf.bundle.min.js"></script>
  <script>
    function downloadPdf() {
      var el = document.querySelector('.copies');
      if (!window.html2pdf) { window.print(); return; }
      document.body.classList.add('pdf-export');
      requestAnimationFrame(function() {
        var job = window.html2pdf().set({
          margin: 5,
          filename: ${JSON.stringify(fileName + '.pdf')},
          image: { type: 'jpeg', quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        }).from(el).save();
        Promise.resolve(job).finally(function(){ document.body.classList.remove('pdf-export'); });
      });
    }
    ${autoPdf ? 'window.addEventListener("load", function(){ setTimeout(downloadPdf, 400); });' : ''}
  </script>
</body>
</html>`;
}

export function downloadDocumentPdf(spec: DocSpec): void {
  setDocumentOutput('pdf');
  printDocument(spec);
}

export function printDocument(spec: DocSpec): void {
  const mode = pendingOutput;
  pendingOutput = 'print';
  const html = buildDocumentHtml(spec, mode === 'pdf');
  const popup = window.open('', '_blank', 'noopener,noreferrer,width=920,height=1200');
  if (!popup) {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener');
    return;
  }
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  if (mode === 'print') {
    window.setTimeout(() => {
      try { popup.print(); } catch { /* ignore */ }
    }, 300);
  }
}

export function printList(kind: string, headers: string[], rows: string[][], extra?: Partial<DocSpec>): void {
  printDocument({
    kind,
    reference: extra?.reference ?? `LISTE-${new Date().toISOString().slice(0, 10)}`,
    tables: [{ headers, rows }],
    notes: extra?.notes,
    fields: extra?.fields,
    subtitle: extra?.subtitle,
    signatures: extra?.signatures ?? ['Pour EMMANUEL SERVICES SARLU'],
    copiesPerPage: extra?.copiesPerPage ?? 1,
    lean: extra?.lean,
    kpis: extra?.kpis,
  });
}
