import * as XLSX from 'xlsx';

export interface ExcelColumn {
  key: string;
  header: string;
}

export interface ExcelImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export interface ExcelSheet {
  name: string;
  columns: ExcelColumn[];
  rows: Array<Record<string, unknown>>;
  importRows?: (rows: Array<Record<string, string>>) => Promise<ExcelImportResult>;
}

export interface ExcelBundle {
  filename: string;
  sheets: ExcelSheet[];
  onImported?: () => void;
}

export function emptyImport(): ExcelImportResult {
  return { created: 0, updated: 0, skipped: 0, errors: [] };
}

export function mergeImport(into: ExcelImportResult, add: ExcelImportResult): ExcelImportResult {
  return {
    created: into.created + add.created,
    updated: into.updated + add.updated,
    skipped: into.skipped + add.skipped,
    errors: [...into.errors, ...add.errors],
  };
}

export function normHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export function cell(row: Record<string, string>, ...headers: string[]): string {
  const map = new Map(Object.entries(row).map(([key, value]) => [normHeader(key), String(value ?? '').trim()]));
  for (const header of headers) {
    const found = map.get(normHeader(header));
    if (found) return found;
  }
  return '';
}

export function num(row: Record<string, string>, ...headers: string[]): number {
  const raw = cell(row, ...headers).replace(/\s/g, '').replace(',', '.');
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

export function bool(row: Record<string, string>, ...headers: string[]): boolean | undefined {
  const raw = cell(row, ...headers).toLowerCase();
  if (!raw) return undefined;
  if (['1', 'oui', 'true', 'yes', 'vrai'].includes(raw)) return true;
  if (['0', 'non', 'false', 'no', 'faux'].includes(raw)) return false;
  return undefined;
}

function sheetName(name: string): string {
  return name.replace(/[\\/?*[\]]/g, ' ').trim().slice(0, 31) || 'Feuille';
}

function rowToAoa(columns: ExcelColumn[], rows: Array<Record<string, unknown>>): unknown[][] {
  return [
    columns.map((column) => column.header),
    ...rows.map((row) => columns.map((column) => {
      const value = row[column.key];
      if (value == null) return '';
      if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
      return value;
    })),
  ];
}

export function downloadWorkbook(filename: string, sheets: ExcelSheet[], empty = false): void {
  const workbook = XLSX.utils.book_new();
  const usable = sheets.filter((sheet) => sheet.columns.length);
  if (!usable.length) return;
  usable.forEach((sheet, index) => {
    const data = rowToAoa(sheet.columns, empty ? [] : sheet.rows);
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    worksheet['!cols'] = sheet.columns.map((column) => ({ wch: Math.max(12, column.header.length + 2) }));
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName(sheet.name || `Feuille${index + 1}`));
  });
  const guide = XLSX.utils.aoa_to_sheet([
    ['Guide import / export EMMAPP'],
    ['1. Ne pas renommer les en-tetes des colonnes.'],
    ['2. Laissez la cle vide uniquement si une nouvelle ligne doit etre creee.'],
    ['3. Pour une mise a jour, conservez le code, email, plaque ou numero existant.'],
    ['4. Les onglets sans colonnes d import sont exportes en lecture seule.'],
    ['5. Devise par defaut : CDF.'],
  ]);
  XLSX.utils.book_append_sheet(workbook, guide, 'Guide');
  XLSX.writeFile(workbook, `${filename.replace(/\.xlsx$/i, '')}.xlsx`);
}

function mapImportedRow(columns: ExcelColumn[], raw: Record<string, unknown>): Record<string, string> {
  const incoming = new Map(
    Object.entries(raw).map(([key, value]) => [normHeader(String(key)), String(value ?? '').trim()]),
  );
  const out: Record<string, string> = {};
  for (const column of columns) {
    const value = incoming.get(normHeader(column.header)) ?? incoming.get(normHeader(column.key)) ?? '';
    out[column.key] = value;
    out[column.header] = value;
  }
  for (const [key, value] of incoming) {
    if (!out[key]) out[key] = value;
  }
  return out;
}

export async function readWorkbook(file: File): Promise<Array<{ name: string; rows: Array<Record<string, string>> }>> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  return workbook.SheetNames.filter((name) => name !== 'Guide').map((name) => {
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[name], { defval: '', raw: false });
    return { name, rows: raw.map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, String(v ?? '').trim()]))) };
  });
}

export function matchSheet(sheets: ExcelSheet[], name: string): ExcelSheet | undefined {
  const wanted = normHeader(name);
  return sheets.find((sheet) => normHeader(sheet.name) === wanted);
}

export async function importWorkbook(file: File, sheets: ExcelSheet[]): Promise<ExcelImportResult> {
  const parsed = await readWorkbook(file);
  const importable = sheets.filter((sheet) => sheet.importRows);
  let result = emptyImport();
  if (!importable.length) {
    result.errors.push('Aucun onglet de ce module n\'accepte l\'import.');
    return result;
  }
  for (const imported of parsed) {
    const spec = matchSheet(importable, imported.name) ?? (importable.length === 1 && parsed.length === 1 ? importable[0] : undefined);
    if (!spec?.importRows) continue;
    const mapped = imported.rows
      .map((row) => mapImportedRow(spec.columns, row))
      .filter((row) => Object.values(row).some((value) => String(value).trim()));
    if (!mapped.length) {
      result.skipped += 1;
      continue;
    }
    try {
      result = mergeImport(result, await spec.importRows(mapped));
    } catch (error) {
      result.errors.push(`${spec.name}: ${error instanceof Error ? error.message : 'import impossible'}`);
    }
  }
  if (!result.created && !result.updated && !result.errors.length) {
    result.errors.push('Aucun onglet reconnu. Utilisez le modele Excel de ce module.');
  }
  return result;
}

export async function upsertBy(
  rows: Array<Record<string, string>>,
  options: {
    keyOf: (row: Record<string, string>) => string;
    findId: (key: string) => string | undefined;
    create: (row: Record<string, string>) => Promise<unknown>;
    update: (id: string, row: Record<string, string>) => Promise<unknown>;
    required?: (row: Record<string, string>) => string | null;
  },
): Promise<ExcelImportResult> {
  const result = emptyImport();
  for (const [index, row] of rows.entries()) {
    const line = index + 2;
    const missing = options.required?.(row);
    if (missing) {
      result.errors.push(`Ligne ${line}: ${missing}`);
      result.skipped += 1;
      continue;
    }
    const key = options.keyOf(row).trim();
    const existingId = key ? options.findId(key) : undefined;
    try {
      if (existingId) {
        await options.update(existingId, row);
        result.updated += 1;
      } else {
        await options.create(row);
        result.created += 1;
      }
    } catch (error) {
      result.errors.push(`Ligne ${line}: ${error instanceof Error ? error.message : 'echec'}`);
    }
  }
  return result;
}

export function formatImportResult(result: ExcelImportResult): string {
  const parts = [
    `${result.created} cree(s)`,
    `${result.updated} mis a jour`,
    `${result.skipped} ignore(s)`,
  ];
  if (result.errors.length) parts.push(`${result.errors.length} erreur(s): ${result.errors.slice(0, 5).join(' | ')}`);
  return parts.join(' · ');
}
