import { useEffect, useRef, useState } from 'react';
import { printPaperForm, type PaperFormSpec } from '../documents/paperForms';
import { setDocumentOutput } from '../documents/printDocument';

function partitionForms(forms: PaperFormSpec[]) {
  const grouped = new Map<string, PaperFormSpec[]>();
  const rest: PaperFormSpec[] = [];
  for (const form of forms) {
    if (!form.group) {
      rest.push(form);
      continue;
    }
    const list = grouped.get(form.group) ?? [];
    list.push(form);
    grouped.set(form.group, list);
  }
  return { grouped: [...grouped.entries()], rest };
}

export default function PaperFormButton({ forms }: { forms: PaperFormSpec[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { grouped, rest } = partitionForms(forms);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (!forms.length) return null;

  const run = (form: PaperFormSpec, pdf = false) => {
    if (pdf) setDocumentOutput('pdf');
    printPaperForm(form, pdf);
    setOpen(false);
  };

  const useMenu = grouped.length > 0 || rest.length > 1;
  if (!useMenu) {
    const form = rest[0] ?? forms[0];
    return (
      <span className="erp-doc-btns">
        <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" title={form.instructions} onClick={() => run(form)}>
          Formulaire papier
        </button>
        <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" title="Télécharger le PDF vierge" onClick={() => run(form, true)}>
          PDF
        </button>
      </span>
    );
  }

  return (
    <div className="erp-paper-menu" ref={ref}>
      <button type="button" className="erp-btn erp-btn--sm" onClick={() => setOpen((v) => !v)}>
        Formulaires papier
      </button>
      {open && (
        <div className="erp-paper-menu-list" role="menu">
          {grouped.map(([group, items]) => (
            <div key={group} className="erp-paper-menu-group">
              <div className="erp-paper-menu-group-title">{group}</div>
              {items.map((form) => (
                <div key={form.id} className="erp-paper-menu-row">
                  <button type="button" onClick={() => run(form)}>{form.copiesPerPage && items.length > 1 ? `${form.copiesPerPage} / A4` : form.title}</button>
                  <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => run(form, true)}>PDF</button>
                </div>
              ))}
            </div>
          ))}
          {rest.map((form) => (
            <div key={form.id} className="erp-paper-menu-row">
              <button type="button" onClick={() => run(form)}>{form.title}</button>
              <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => run(form, true)}>PDF</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
