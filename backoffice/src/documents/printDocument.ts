const COMPANY = {
  brand: 'EMMAS',
  name: 'EMMAPURE',
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

export interface DocSpec {
  kind: string;
  reference?: string;
  date?: string;
  subtitle?: string;
  fields?: DocField[];
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

function fieldsHtml(fields?: DocField[]): string {
  if (!fields?.length) return '';
  return `<div class="meta">${fields.map((f) => `<div><span>${esc(f.label)}</span><strong>${esc(f.value)}</strong></div>`).join('')}</div>`;
}

function tableHtml(table: DocTable): string {
  const head = table.headers.map((h) => `<th>${esc(h)}</th>`).join('');
  const body = table.rows.length
    ? table.rows.map((row) => `<tr>${row.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${table.headers.length}">Aucune ligne</td></tr>`;
  return `${table.title ? `<h3>${esc(table.title)}</h3>` : ''}<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
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
  const signatures = spec.signatures?.length ? spec.signatures : ['Pour EMMAPURE', 'Pour le destinataire'];
  const fileName = `${spec.kind}${spec.reference ? `-${spec.reference}` : ''}`.replace(/[^\wÀ-ÿ.-]+/g, '_');
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>${esc(spec.kind)} ${esc(spec.reference ?? '')}</title>
  <style>
    @page { margin: 14mm 12mm; }
    * { box-sizing: border-box; }
    body { font-family: "Open Sans", "Roboto", "Segoe UI", Arial, sans-serif; color: #333333; margin: 0; background: #f4f7f9; }
    .toolbar { position: sticky; top: 0; display: flex; gap: 8px; padding: 10px 16px; background: #2c3e50; color: #fff; z-index: 2; }
    .toolbar button { border: 0; border-radius: 4px; padding: 8px 12px; cursor: pointer; font-weight: 600; }
    .toolbar .print { background: #00a3ff; color: #fff; }
    .toolbar .pdf { background: #1abc9c; color: #fff; }
    .sheet { max-width: 900px; margin: 16px auto; background: #fff; padding: 24px; }
    .head { display: flex; justify-content: space-between; gap: 16px; border-bottom: 3px solid #00a3ff; padding: 0 0 12px; }
    .brand { font-size: 28px; font-weight: 700; letter-spacing: 0.04em; color: #2c3e50; }
    .name { font-size: 16px; font-weight: 600; }
    .muted { color: #7f8c8d; font-size: 12px; line-height: 1.45; }
    .doc { text-align: right; }
    .kind { font-size: 18px; font-weight: 700; color: #00a3ff; text-transform: uppercase; letter-spacing: 0.06em; }
    .ref { font-size: 13px; font-weight: 700; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 18px; margin: 16px 0; }
    .meta span { display: block; font-size: 11px; color: #7f8c8d; text-transform: uppercase; letter-spacing: 0.06em; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0 16px; font-size: 12.5px; }
    th, td { border: 1px solid #e8eef2; padding: 7px 8px; text-align: left; }
    th { background: #f4f7f9; color: #5d6d7e; text-transform: uppercase; letter-spacing: 0.04em; font-size: 11px; }
    h3 { margin: 16px 0 6px; font-size: 12px; color: #5d6d7e; text-transform: uppercase; letter-spacing: 0.08em; }
    .notes { background: #f8f9fb; border: 1px solid #e8eef2; padding: 10px 12px; font-size: 12.5px; }
    .totals { margin-left: auto; width: 280px; }
    .sign { display: flex; justify-content: space-between; gap: 40px; margin-top: 40px; }
    .sign div { flex: 1; border-top: 1px solid #cfd8dc; padding-top: 8px; font-size: 12px; }
    .foot { margin-top: 28px; border-top: 2px solid #2c3e50; padding-top: 8px; font-size: 11px; color: #7f8c8d; }
    .party-logo { max-height: 72px; max-width: 120px; object-fit: contain; margin-bottom: 8px; }
    @media print {
      body { background: #fff; }
      .toolbar { display: none !important; }
      .sheet { margin: 0; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="print" type="button" onclick="window.print()">Imprimer</button>
    <button class="pdf" type="button" onclick="downloadPdf()">Télécharger PDF</button>
  </div>
  <div class="sheet">
    <div class="head">
      <div>
        ${logoHtml(spec.logoUrl)}
        <div class="brand">${esc(COMPANY.brand)}</div>
        <div class="name">${esc(COMPANY.name)}</div>
        <div class="muted">${esc(COMPANY.tagline)}<br/>${esc(COMPANY.address)}<br/>${esc(COMPANY.phone)} · ${esc(COMPANY.email)} · ${esc(COMPANY.web)}</div>
      </div>
      <div class="doc">
        <div class="kind">${esc(spec.kind)}</div>
        ${spec.reference ? `<div class="ref">${esc(spec.reference)}</div>` : ''}
        <div class="muted">${esc(issued)}</div>
        ${spec.subtitle ? `<div class="muted">${esc(spec.subtitle)}</div>` : ''}
      </div>
    </div>
    ${fieldsHtml(spec.fields)}
    ${(spec.tables ?? []).map(tableHtml).join('')}
    ${spec.totals?.length ? `<table class="totals">${spec.totals.map((t) => `<tr><th>${esc(t.label)}</th><td>${esc(t.value)}</td></tr>`).join('')}</table>` : ''}
    ${spec.notes ? `<div class="notes">${esc(spec.notes)}</div>` : ''}
    <div class="sign">${signatures.map((s) => `<div>${esc(s)}<br/><br/><br/>Nom et signature</div>`).join('')}</div>
    <div class="foot">${esc(COMPANY.motto)}<br/>${esc(COMPANY.legal)}</div>
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
    signatures: extra?.signatures ?? ['Pour EMMAPURE'],
  });
}
