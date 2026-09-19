import { ReactNode } from 'react';
import { setDocumentOutput } from '../documents/printDocument';

export default function DocButton({
  label = 'Document',
  onClick,
  ghost = true,
}: {
  label?: string;
  onClick: () => void;
  ghost?: boolean;
}): ReactNode {
  const cls = `erp-btn erp-btn--sm ${ghost ? 'erp-btn--ghost' : ''}`;
  return (
    <span className="erp-doc-btns">
      <button
        type="button"
        className={cls}
        onClick={onClick}
        title="Imprimer le document à en-tête EMMANUEL SERVICES SARLU"
      >
        {label}
      </button>
      <button
        type="button"
        className={cls}
        onClick={() => {
          setDocumentOutput('pdf');
          onClick();
        }}
        title="Télécharger le PDF"
      >
        PDF
      </button>
    </span>
  );
}
