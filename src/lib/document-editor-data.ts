import type { DocRow, Item } from "./db";

export interface EditorInitial {
  date?: string;
  billedTo?: string;
  unit?: string;
  driver?: string;
  requestor?: string;
  items?: Item[];
}

function isItem(value: unknown): value is Item {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const item = value as Record<string, unknown>;
  return (
    typeof item.date === "string" &&
    typeof item.destination === "string" &&
    typeof item.passenger === "string" &&
    (item.unit === undefined || typeof item.unit === "string") &&
    typeof item.amount === "number" &&
    Number.isFinite(item.amount)
  );
}

function parseItems(itemsJson: string): Item[] | null {
  try {
    const items: unknown = JSON.parse(itemsJson);
    return Array.isArray(items) && items.every(isItem) ? items : null;
  } catch {
    return null;
  }
}

export function toEditorInitial(doc: DocRow): EditorInitial | null {
  const items = parseItems(doc.items_json);
  if (!items) return null;
  const normalizedItems = items.map((item) => ({ ...item, unit: item.unit ?? doc.unit }));

  return {
    date: doc.doc_date,
    billedTo: doc.billed_to,
    unit: doc.unit,
    driver: doc.driver,
    requestor: doc.requestor,
    items: normalizedItems,
  };
}
