import { useState, type ReactNode } from "react";
import { generatePdf } from "@/lib/pdf";
import { saveDoc, updateDoc, type DocType, type Item } from "@/lib/db";
import type { EditorInitial } from "@/lib/document-editor-data";

function todayLong(): string {
  return new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
function emptyItem(docType: DocType, patch: Partial<Item> = {}): Item {
  return {
    date: "",
    destination: "",
    passenger: "",
    ...(docType === "quotation" ? { unit: "" } : {}),
    amount: 0,
    ...patch,
  };
}
function rowsShare(items: Item[], field: "passenger" | "unit"): boolean {
  const first = items[0]?.[field] || "";
  return Boolean(first) && items.every((item) => item[field] === first);
}
function synchronizeRows(items: Item[], field: "passenger" | "unit"): Item[] {
  const value = items[0]?.[field] || "";
  return items.map((item) => ({ ...item, [field]: value }));
}
function quotationUnitSummary(items: Item[]): string {
  if (!items.length) return "";
  const firstUnit = items[0].unit || "";
  return firstUnit && items.every((item) => item.unit === firstUnit) ? firstUnit : "Multiple units";
}

export function DocumentEditor({
  docType,
  documentId,
  initial,
  onSaved,
}: {
  docType: DocType;
  documentId?: number;
  initial?: EditorInitial;
  onSaved?: () => void;
}) {
  const [date, setDate] = useState(initial?.date ?? todayLong());
  const [billedTo, setBilledTo] = useState(initial?.billedTo ?? "");
  const [unit, setUnit] = useState(initial?.unit ?? "Sedan");
  const [driver, setDriver] = useState(initial?.driver ?? "Teddy Dimate");
  const [requestor, setRequestor] = useState(initial?.requestor ?? "");
  const initialItems = initial?.items ?? [emptyItem(docType)];
  const [items, setItems] = useState<Item[]>(initialItems);
  const [samePassenger, setSamePassenger] = useState(
    docType === "quotation" && rowsShare(initialItems, "passenger"),
  );
  const [sameUnit, setSameUnit] = useState(docType === "quotation" && rowsShare(initialItems, "unit"));

  const total = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const setItem = (idx: number, patch: Partial<Item>) =>
    setItems((previous) => {
      let next = previous.map((item, index) => (index === idx ? { ...item, ...patch } : item));
      if (docType === "quotation" && idx === 0 && samePassenger && patch.passenger !== undefined) {
        next = synchronizeRows(next, "passenger");
      }
      if (docType === "quotation" && idx === 0 && sameUnit && patch.unit !== undefined) {
        next = synchronizeRows(next, "unit");
      }
      return next;
    });
  const setSameField = (field: "passenger" | "unit", checked: boolean) => {
    if (field === "passenger") setSamePassenger(checked);
    else setSameUnit(checked);
    if (checked) setItems((previous) => synchronizeRows(previous, field));
  };
  const addRow = () =>
    setItems((previous) => [
      ...previous,
      emptyItem(docType, {
        passenger: docType === "quotation" && samePassenger ? previous[0]?.passenger || "" : "",
        ...(docType === "quotation" ? { unit: sameUnit ? previous[0]?.unit || "" : "" } : {}),
      }),
    ]);
  const removeRow = (i: number) => setItems((p) => p.filter((_, idx) => idx !== i));

  const buildInput = () => {
    const normalizedItems = items.map((item) => ({ ...item, amount: Number(item.amount) || 0 }));
    return {
      docType,
      date,
      billedTo,
      unit: docType === "quotation" ? quotationUnitSummary(normalizedItems) : unit,
      driver,
      requestor,
      items: normalizedItems,
    };
  };

  const preview = async () => {
    const previewWindow = window.open("", "_blank");
    const pdf = await generatePdf(buildInput());
    const url = pdf.output("bloburl");
    if (previewWindow) {
      previewWindow.location.href = url;
    } else {
      window.open(url, "_blank");
    }
  };
  const download = async () => {
    const pdf = await generatePdf(buildInput());
    pdf.save(`${docType}-${date.replace(/\s+/g, "_")}.pdf`);
  };
  const save = async () => {
    const input = buildInput();
    const draft = {
      doc_type: docType,
      doc_date: date,
      billed_to: billedTo,
      unit: input.unit,
      driver,
      requestor,
      total,
      items_json: JSON.stringify(input.items),
    };
    if (documentId === undefined) {
      await saveDoc(draft);
    } else {
      await updateDoc(documentId, draft);
    }
    onSaved?.();
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date">
          <input className="input" value={date} onChange={(e) => setDate(e.target.value)} placeholder="14 June 2026" />
        </Field>
        {docType === "billing" && (
          <Field label="Unit Used">
            <input className="input" value={unit} onChange={(e) => setUnit(e.target.value)} />
          </Field>
        )}
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-4">
            <h2 className="font-semibold">Line Items</h2>
            {docType === "quotation" && (
              <div className="flex items-center gap-3 text-sm">
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={samePassenger} onChange={(e) => setSameField("passenger", e.target.checked)} />
                  Same passenger?
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={sameUnit} onChange={(e) => setSameField("unit", e.target.checked)} />
                  Same unit?
                </label>
              </div>
            )}
          </div>
          <button onClick={addRow} className="text-sm px-3 py-1.5 rounded-md bg-secondary hover:bg-accent">
            + Add row
          </button>
        </div>
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="p-2 text-left w-28">Date</th>
                {docType === "quotation" && <th className="p-2 text-left w-32">Unit</th>}
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
                  {docType === "quotation" && (
                    <td className="p-1">
                      <input
                        aria-label={`Unit ${i + 1}`}
                        className="input"
                        value={it.unit || ""}
                        disabled={sameUnit && i > 0}
                        onChange={(e) => setItem(i, { unit: e.target.value })}
                      />
                    </td>
                  )}
                  <td className="p-1"><textarea className="input min-h-[38px]" value={it.destination} onChange={(e) => setItem(i, { destination: e.target.value })} /></td>
                  <td className="p-1">
                    <input
                      aria-label={`Passenger ${i + 1}`}
                      className="input"
                      value={it.passenger}
                      disabled={docType === "quotation" && samePassenger && i > 0}
                      onChange={(e) => setItem(i, { passenger: e.target.value })}
                    />
                  </td>
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
        <button onClick={() => void preview()} className="btn-primary">Preview PDF</button>
        <button onClick={() => void download()} className="btn-primary">Download PDF</button>
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
