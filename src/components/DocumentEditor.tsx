import { useState, type ReactNode } from "react";
import { generatePdf } from "@/lib/pdf";
import { saveDoc, type DocType, type Item } from "@/lib/db";

function todayLong(): string {
  return new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
function emptyItem(): Item {
  return { date: "", destination: "", passenger: "", amount: 0 };
}

export interface EditorInitial {
  date?: string;
  billedTo?: string;
  unit?: string;
  driver?: string;
  requestor?: string;
  items?: Item[];
}

export function DocumentEditor({
  docType,
  initial,
  onSaved,
}: {
  docType: DocType;
  initial?: EditorInitial;
  onSaved?: () => void;
}) {
  const [date, setDate] = useState(initial?.date ?? todayLong());
  const [billedTo, setBilledTo] = useState(initial?.billedTo ?? "");
  const [unit, setUnit] = useState(initial?.unit ?? "Sedan");
  const [driver, setDriver] = useState(initial?.driver ?? "Teddy Dimate");
  const [requestor, setRequestor] = useState(initial?.requestor ?? "");
  const [items, setItems] = useState<Item[]>(initial?.items ?? [emptyItem()]);

  const total = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const setItem = (idx: number, patch: Partial<Item>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const addRow = () => setItems((p) => [...p, emptyItem()]);
  const removeRow = (i: number) => setItems((p) => p.filter((_, idx) => idx !== i));

  const buildInput = () => ({
    docType,
    date,
    billedTo,
    unit,
    driver,
    requestor,
    items: items.map((it) => ({ ...it, amount: Number(it.amount) || 0 })),
  });

  const preview = () => {
    const pdf = generatePdf(buildInput());
    window.open(pdf.output("bloburl"), "_blank");
  };
  const download = () => {
    const pdf = generatePdf(buildInput());
    pdf.save(`${docType}-${date.replace(/\s+/g, "_")}.pdf`);
  };
  const save = async () => {
    const input = buildInput();
    await saveDoc({
      doc_type: docType,
      doc_date: date,
      billed_to: billedTo,
      unit,
      driver,
      requestor,
      total,
      items_json: JSON.stringify(input.items),
    });
    onSaved?.();
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date">
          <input className="input" value={date} onChange={(e) => setDate(e.target.value)} placeholder="14 June 2026" />
        </Field>
        <Field label={docType === "billing" ? "Unit Used" : "Unit Requested"}>
          <input className="input" value={unit} onChange={(e) => setUnit(e.target.value)} />
        </Field>
        {docType === "billing" ? (
          <>
            <Field label="Billed To">
              <input className="input" value={billedTo} onChange={(e) => setBilledTo(e.target.value)} placeholder="Path Foundation" />
            </Field>
            <Field label="Driver">
              <input className="input" value={driver} onChange={(e) => setDriver(e.target.value)} />
            </Field>
          </>
        ) : (
          <Field label="Requestor">
            <input className="input" value={requestor} onChange={(e) => setRequestor(e.target.value)} placeholder="Path Foundation" />
          </Field>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Line Items</h2>
          <button onClick={addRow} className="text-sm px-3 py-1.5 rounded-md bg-secondary hover:bg-accent">
            + Add row
          </button>
        </div>
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="p-2 text-left w-28">Date</th>
                <th className="p-2 text-left">Destination</th>
                <th className="p-2 text-left w-36">Passenger</th>
                <th className="p-2 text-right w-32">Amount (PHP)</th>
                <th className="p-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-t">
                  <td className="p-1"><input className="input" value={it.date} onChange={(e) => setItem(i, { date: e.target.value })} placeholder="11-Jun-26" /></td>
                  <td className="p-1"><textarea className="input min-h-[38px]" value={it.destination} onChange={(e) => setItem(i, { destination: e.target.value })} /></td>
                  <td className="p-1"><input className="input" value={it.passenger} onChange={(e) => setItem(i, { passenger: e.target.value })} /></td>
                  <td className="p-1"><input className="input text-right" type="number" step="0.01" value={it.amount} onChange={(e) => setItem(i, { amount: Number(e.target.value) })} /></td>
                  <td className="p-1 text-center">
                    <button onClick={() => removeRow(i)} className="text-destructive hover:opacity-70" title="Remove">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-right text-sm">
          <span className="text-muted-foreground">Total: </span>
          <span className="font-semibold">PHP {total.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={preview} className="btn-primary">Preview PDF</button>
        <button onClick={download} className="btn-primary">Download PDF</button>
        <button onClick={save} className="btn-secondary">Save</button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-muted-foreground mb-1">{label}</span>
      {children}
    </label>
  );
}
