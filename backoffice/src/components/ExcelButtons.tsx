import { ChangeEvent, useRef, useState } from 'react';
import {
  ExcelBundle,
  downloadWorkbook,
  formatImportResult,
  importWorkbook,
} from '../excel/excel';

export default function ExcelButtons({ filename, sheets, onImported }: ExcelBundle) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const canImport = sheets.some((sheet) => sheet.importRows);

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await importWorkbook(file, sheets);
      setMessage(formatImportResult(result));
      if (result.created + result.updated > 0) onImported?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Fichier Excel illisible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="excel-actions">
      <button
        type="button"
        className="erp-btn erp-btn--sm erp-btn--ghost"
        disabled={!sheets.length || busy}
        onClick={() => downloadWorkbook(filename, sheets)}
        title="Exporter les rubriques de cet ecran en fichier Excel"
      >
        Excel
      </button>
      <button
        type="button"
        className="erp-btn erp-btn--sm erp-btn--ghost"
        disabled={!sheets.length || busy}
        onClick={() => downloadWorkbook(`${filename}-modele`, sheets, true)}
        title="Telecharger un modele Excel vide"
      >
        Modele
      </button>
      {canImport && (
        <>
          <button
            type="button"
            className="erp-btn erp-btn--sm erp-btn--ghost"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            title="Importer un fichier Excel dans ce module"
          >
            {busy ? 'Import...' : 'Importer'}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            hidden
            onChange={onFile}
          />
        </>
      )}
      {message && <span className="excel-result">{message}</span>}
    </span>
  );
}
