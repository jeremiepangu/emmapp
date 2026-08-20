import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';

const COMPANY = {
  name: 'EMMANUEL SERVICES SARLU',
  tagline: 'Production et distribution d\'eau potable',
  address: 'Kinshasa, Bandalungwa, RDC',
  phone: '+243 813 170 215',
  email: 'contact@emmas.cd',
  legal: 'RCCM KNG/RCCM/24-B-02180 · IMPOT A2425053J · ID NAT 01-F4300-N64238H',
};

export const CONTRACT_PLACEHOLDERS: Array<{ key: string; label: string }> = [
  { key: 'reference', label: 'Référence contrat' },
  { key: 'title', label: 'Intitulé' },
  { key: 'kind', label: 'Type de contrat' },
  { key: 'status', label: 'Statut' },
  { key: 'partyKind', label: 'Nature de la partie' },
  { key: 'partyName', label: 'Nom de la partie' },
  { key: 'partyCode', label: 'Code / matricule' },
  { key: 'partyPhone', label: 'Téléphone' },
  { key: 'partyEmail', label: 'E-mail' },
  { key: 'startDate', label: 'Date de début' },
  { key: 'endDate', label: 'Date de fin' },
  { key: 'noticeDays', label: 'Préavis (jours)' },
  { key: 'autoRenew', label: 'Reconduction tacite' },
  { key: 'amount', label: 'Montant' },
  { key: 'currency', label: 'Devise' },
  { key: 'paymentTerms', label: 'Conditions de paiement' },
  { key: 'billingCycle', label: 'Cycle de facturation' },
  { key: 'volume', label: 'Engagement volume' },
  { key: 'territory', label: 'Territoire' },
  { key: 'exclusivity', label: 'Exclusivité' },
  { key: 'clauses', label: 'Clauses' },
  { key: 'notes', label: 'Notes' },
  { key: 'signedByParty', label: 'Signataire partie' },
  { key: 'signedByCompany', label: 'Signataire société' },
  { key: 'companyName', label: 'Raison sociale' },
  { key: 'companyAddress', label: 'Adresse société' },
  { key: 'companyLegal', label: 'Mentions légales' },
  { key: 'today', label: 'Date du jour' },
  { key: 'jobTitle', label: 'Poste (agent)' },
  { key: 'department', label: 'Service (agent)' },
];

export function fillPlaceholders(source: string, vars: Record<string, string>): string {
  return source.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => vars[key] ?? '');
}

function para(text: string, opts?: { bold?: boolean; size?: number; center?: boolean }) {
  return new Paragraph({
    alignment: opts?.center ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
    spacing: { after: 120 },
    children: [
      new TextRun({
        text,
        bold: opts?.bold,
        size: opts?.size ?? 22,
        font: 'Calibri',
      }),
    ],
  });
}

function cell(text: string, width: number, header = false) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: header, size: 20, font: 'Calibri' })],
      }),
    ],
  });
}

export async function buildContractDocx(input: {
  title: string;
  reference: string;
  body: string;
  clauses?: string;
  footer?: string;
  fields: Array<{ label: string; value: string }>;
  signedByParty: string;
  signedByCompany: string;
}): Promise<Buffer> {
  const bodyParas = input.body
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .flatMap((block) =>
      block.split('\n').map((line, i) =>
        para(line, { bold: i === 0 && block.split('\n').length > 1 && line.length < 80 }),
      ),
    );

  const clauseParas = (input.clauses ?? '')
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => para(b));

  const rows = input.fields.map(
    (f) =>
      new TableRow({
        children: [cell(f.label, 3200, true), cell(f.value || '—', 6200)],
      }),
  );

  const doc = new Document({
    creator: COMPANY.name,
    title: `${input.reference} — ${input.title}`,
    description: 'Contrat généré pour signature',
    sections: [
      {
        properties: {
          page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: COMPANY.name, bold: true, size: 28, font: 'Calibri' })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: COMPANY.tagline, italics: true, size: 18, font: 'Calibri', color: '555555' })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: '1F4E79', space: 4 } },
                children: [new TextRun({ text: `${COMPANY.address} · ${COMPANY.phone}`, size: 16, font: 'Calibri', color: '666666' })],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: COMPANY.legal, size: 14, font: 'Calibri', color: '666666' }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: input.footer || 'Document généré pour signature — conserver l\'original signé dans l\'archive.', size: 14, font: 'Calibri', color: '666666' }),
                  new TextRun({ text: '  ·  p. ', size: 14, font: 'Calibri', color: '666666' }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 14, font: 'Calibri' }),
                ],
              }),
            ],
          }),
        },
        children: [
          para('CONTRAT', { center: true, bold: true, size: 36 }),
          para(input.title, { center: true, bold: true, size: 28 }),
          para(`Référence ${input.reference}`, { center: true, size: 20 }),
          new Paragraph({ spacing: { after: 200 }, children: [] }),
          new Table({
            width: { size: 9400, type: WidthType.DXA },
            rows,
          }),
          new Paragraph({ spacing: { after: 280 }, children: [] }),
          para('Article premier — Objet et stipulations', { bold: true, size: 24 }),
          ...bodyParas,
          ...(clauseParas.length
            ? [para('Clauses particulières', { bold: true, size: 24 }), ...clauseParas]
            : []),
          para('Signatures', { bold: true, size: 24 }),
          para('Fait à Kinshasa, en deux exemplaires originaux, destinés chacun à une partie.'),
          new Paragraph({ spacing: { after: 400 }, children: [] }),
          new Table({
            width: { size: 9400, type: WidthType.DXA },
            rows: [
              new TableRow({
                children: [
                  cell(`Pour ${input.signedByCompany}`, 4700, true),
                  cell(`Pour ${input.signedByParty}`, 4700, true),
                ],
              }),
              new TableRow({
                children: [
                  cell('Nom, qualité, signature et cachet\n\n\n\n', 4700),
                  cell('Nom, qualité et signature\n\n\n\n', 4700),
                ],
              }),
            ],
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
