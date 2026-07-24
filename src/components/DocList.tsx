import { useEffect, useState } from "react";
import { Plus, X, Eye, Download, Trash2 } from "lucide-react";
import { listDocs, deleteDoc, type DocRow, type DocType, type Item } from "@/lib/db";
import { generatePdf } from "@/lib/pdf";
import { DocumentEditor, type EditorInitial } from "./DocumentEditor";

export function DocList({ docType }: { docType: DocType }) {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [open, setOpen] = useState(false);
  const [initial, setInitial] = useState<EditorInitial | undefined>();

  const refresh = () => listDocs().then((all) => setDocs(all.filter((d) => d.doc_type === docType)));
  useEffect(() => { refresh(); }, [docType]);

  const openCreate = () => { setInitial(undefined); setOpen(true); };
  const openEdit = (d: DocRow) => {
    let items: Item[] = [];
    try { items = JSON.parse(d.items_json); } catch { /* ignore */ }
    setInitial({
      date: d.doc_date,
      billedTo: d.billed_to,
      unit: d.unit,
      driver: d.driver,
      requestor: d.requestor,
      items,
    });
    setOpen(true);
  };
  const remove = async (id: number) => { await deleteDoc(id); await refresh(); };
  const downloadDoc = (d: DocRow) => {
    let items: Item[] = [];
    try { items = JSON.parse(d.items_json); } catch { /* ignore */ }
    const pdf = generatePdf({
      docType: d.doc_type,
      date: d.doc_date,
      billedTo: d.billed_to,
      unit: d.unit,
      driver: d.driver,
      requestor: d.requestor,
      items,
    });
    pdf.save(`${d.doc_type}-${d.doc_date.replace(/\s+/g, "_")}.pdf`);
  };
  const previewDoc = (d: DocRow) => {
    let items: Item[] = [];
    try { items = JSON.parse(d.items_json); } catch { /* ignore */ }
    const pdf = generatePdf({
      docType: d.doc_type,
      date: d.doc_date,
      billedTo: d.billed_to,
      unit: d.unit,
      driver: d.driver,
      requestor: d.requestor,
      items,
    });
    window.open(pdf.output("bloburl"), "_blank");
  };

  const label = docType === "billing" ? "Billing" : "Quotation";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {docs.length} {label.toLowerCase()}{docs.length === 1 ? "" : "s"} saved
        </p>
        <button onClick={openCreate} className="btn-primary gap-1.5">
          <Plus className="h-4 w-4" /> Create {label}
        </button>
      </div>

      <div className="rounded-md border bg-card overflow-hidden">
        {docs.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No {label.toLowerCase()}s yet. Click “Create {label}” to add one.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr className="text-left">
                <th className="p-3">Date</th>
                <th className="p-3">{docType === "billing" ? "Billed To" : "Requestor"}</th>
                <th className="p-3">Unit</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3 w-32 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} className="border-t hover:bg-muted/40 cursor-pointer" onClick={() => openEdit(d)}>
                  <td className="p-3">{d.doc_date}</td>
                  <td className="p-3">{docType === "billing" ? d.billed_to : d.requestor}</td>
                  <td className="p-3">{d.unit}</td>
                  <td className="p-3 text-right">PHP {Number(d.total).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td>
                  <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex gap-1">
                      <button onClick={() => previewDoc(d)} className="p-1.5 rounded hover:bg-accent" title="Preview"><Eye className="h-4 w-4" /></button>
                      <button onClick={() => downloadDoc(d)} className="p-1.5 rounded hover:bg-accent" title="Download"><Download className="h-4 w-4" /></button>
                      <button onClick={() => remove(d.id)} className="p-1.5 rounded hover:bg-accent text-destructive" title="Delete"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center overflow-auto p-4" onClick={() => setOpen(false)}>
          <div className="bg-card rounded-lg shadow-xl w-full max-w-4xl my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="font-semibold">{initial ? `Edit ${label}` : `Create ${label}`}</h2>
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-accent"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-6">
              <DocumentEditor
                docType={docType}
                initial={initial}
                onSaved={() => { refresh(); setOpen(false); }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
