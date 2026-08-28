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
    return `<div class="kpi kpi--${tone}"><span>${esc(k.label)}</span><strong>${esc(k.value)}</strong>${k.hint ? `<em>${esc(k.hint)}</em>` : ''}</div>`;
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

function logoHtml(url?: string): string {
  if (!url) return '';
  return `<img class="party-logo" src="${esc(url)}" alt="Logo" />`;
}

let pendingOutput: 'print' | 'pdf' = 'print';

export function setDocumentOutput(mode: 'print' | 'pdf'): void {
  pendingOutput = mode;
}

export function buildDocumentHtml(spec: DocSpec, autoPdf = false): string {
  const issued = formatDate(spec.date);
  const signatures = spec.signatures?.length ? spec.signatures : ['Pour EMMANUEL SERVICES SARLU', 'Pour le destinataire'];
  const fileName = `${spec.kind}${spec.reference ? `-${spec.reference}` : ''}`.replace(/[^\wÀ-ÿ.-]+/g, '_');
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>${esc(spec.kind)} ${esc(spec.reference ?? '')}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    @page { margin: 10mm 10mm; }
    * { box-sizing: border-box; }
    body { font-family: Inter, "Segoe UI", Roboto, Arial, sans-serif; color: #1e293b; margin: 0; background: #f4f6f8; }
    .toolbar { position: sticky; top: 0; display: flex; gap: 8px; padding: 10px 16px; background: #1a2b3c; color: #fff; z-index: 2; }
    .toolbar button { border: 0; border-radius: 8px; padding: 8px 14px; cursor: pointer; font-weight: 600; font-family: inherit; }
    .toolbar .print { background: #3b82f6; color: #fff; }
    .toolbar .pdf { background: #16a34a; color: #fff; }
    .sheet { max-width: 920px; margin: 16px auto 28px; background: #fff; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 16px rgba(26, 43, 60, 0.08); }
    .mast { display: flex; justify-content: space-between; gap: 16px; align-items: center; background: #1a2b3c; color: #fff; padding: 18px 22px; }
    .mast-left { display: flex; gap: 14px; align-items: center; }
    .party-logo { max-height: 56px; max-width: 56px; object-fit: contain; background: #fff; border-radius: 10px; padding: 4px; }
    .brand { font-size: 18px; font-weight: 800; letter-spacing: 0.04em; }
    .name { font-size: 12px; font-weight: 500; color: #c5d0db; margin-top: 2px; }
    .doc { text-align: right; }
    .kind { font-size: 13px; font-weight: 800; color: #4ade80; text-transform: uppercase; letter-spacing: 0.08em; }
    .ref { font-size: 13px; font-weight: 700; color: #fff; margin-top: 4px; }
    .issued { font-size: 11px; color: #8093a6; margin-top: 4px; }
    .body { padding: 18px 22px 22px; }
    .company { font-size: 11px; color: #64748b; margin: 0 0 14px; line-height: 1.5; }
    .card { background: #fff; border: 1px solid #e8eef2; border-radius: 12px; padding: 14px 16px; margin: 0 0 14px; }
    .card-h { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 10px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 18px; margin: 0; }
    .meta span { display: block; font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; }
    .meta strong { display: block; font-size: 13px; font-weight: 600; margin-top: 2px; color: #1e293b; }
    table { width: 100%; border-collapse: collapse; margin: 0; font-size: 12px; }
    th, td { border: 0; border-bottom: 1px solid #f1f5f9; padding: 8px 8px; text-align: left; }
    th { background: #f8fafc; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; font-size: 10px; font-weight: 700; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 0 0 14px; }
    .kpi { background: #fff; border: 1px solid #e8eef2; border-radius: 12px; padding: 14px 16px; border-top: 3px solid #22c55e; }
    .kpi--green { border-top-color: #22c55e; }
    .kpi--blue { border-top-color: #3b82f6; }
    .kpi--purple { border-top-color: #8b5cf6; }
    .kpi--orange { border-top-color: #f59e0b; }
    .kpi--red { border-top-color: #ef4444; }
    .kpi span { display: block; font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; }
    .kpi strong { display: block; font-size: 22px; font-weight: 800; margin-top: 8px; color: #1e293b; letter-spacing: -0.02em; }
    .kpi em { display: block; font-size: 11px; color: #16a34a; font-style: normal; margin-top: 6px; font-weight: 600; }
    .bars { margin: 0; }
    .bar-row { margin: 0 0 10px; }
    .bar-lab { display: flex; justify-content: space-between; gap: 12px; font-size: 12px; margin-bottom: 5px; font-weight: 500; }
    .bar-lab em { font-style: normal; color: #64748b; white-space: nowrap; font-weight: 600; }
    .bar { height: 8px; background: #e8eef2; border-radius: 99px; overflow: hidden; }
    .bar i { display: block; height: 100%; border-radius: 99px; background: #22c55e; }
    .bar i.bar--green { background: #22c55e; }
    .bar i.bar--blue { background: #3b82f6; }
    .bar i.bar--purple { background: #8b5cf6; }
    .bar i.bar--orange { background: #f59e0b; }
    .notes { background: #fffbeb; border: 1px solid #fde68a; border-left: 3px solid #f59e0b; border-radius: 12px; padding: 12px 14px; font-size: 12.5px; white-space: pre-wrap; margin: 0 0 14px; }
    .totals { margin-left: auto; width: 280px; }
    .totals th { background: #ecfdf3; color: #15803d; }
    .sign { display: flex; justify-content: space-between; gap: 40px; margin-top: 28px; }
    .sign div { flex: 1; border-top: 2px solid #1a2b3c; padding-top: 8px; font-size: 12px; color: #64748b; }
    .foot { margin-top: 22px; border-top: 1px solid #e8eef2; padding-top: 10px; font-size: 11px; color: #64748b; }
    @media print {
      body { background: #fff; }
      .toolbar { display: none !important; }
      .sheet { margin: 0; box-shadow: none; border-radius: 0; }
    }
    @media (max-width: 720px) { .kpis { grid-template-columns: 1fr 1fr; } }
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="print" type="button" onclick="window.print()">Imprimer</button>
    <button class="pdf" type="button" onclick="downloadPdf()">Télécharger PDF</button>
  </div>
  <div class="sheet">
    <div class="mast">
      <div class="mast-left">
        ${logoHtml(spec.logoUrl ?? (typeof window !== 'undefined' ? `${window.location.origin}${COMPANY.logo}` : COMPANY.logo))}
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
    </div>
    <div class="body">
      <div class="company">${esc(COMPANY.tagline)} · ${esc(COMPANY.address)} · ${esc(COMPANY.phone)} · ${esc(COMPANY.email)}</div>
      ${fieldsHtml(spec.fields)}
      ${kpisHtml(spec.kpis)}
      ${barsHtml(spec.bars)}
      ${(spec.tables ?? []).map(tableHtml).join('')}
      ${spec.totals?.length ? `<div class="card"><table class="totals">${spec.totals.map((t) => `<tr><th>${esc(t.label)}</th><td>${esc(t.value)}</td></tr>`).join('')}</table></div>` : ''}
      ${spec.notes ? `<div class="notes">${esc(spec.notes)}</div>` : ''}
      <div class="sign">${signatures.map((s) => `<div>${esc(s)}<br/><br/><br/>Nom et signature</div>`).join('')}</div>
      <div class="foot">${esc(COMPANY.motto)}<br/>${esc(COMPANY.legal)}</div>
    </div>
  </div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.2/html2pdf.bundle.min.js"></script>
  <script>
    function downloadPdf() {
      var el = document.querySelector('.sheet');
      if (!window.html2pdf) { window.print(); return; }
      window.html2pdf().set({
        margin: 10,
        filename: ${JSON.stringify(fileName + '.pdf')},
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }).from(el).save();
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
  });
}
