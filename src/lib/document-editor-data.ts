import type { DocRow, Item } from "./db";

export interface EditorInitial {
  date?: string;
  billedTo?: string;
  unit?: string;
  driver?: string;
  requestor?: string;
  items?: Item[];
}

function parseItems(itemsJson: string): Item[] | null {
  try {
    const items: unknown = JSON.parse(itemsJson);
    return Array.isArray(items) ? (items as Item[]) : null;
  } catch {
    return null;
  }
}

export function toEditorInitial(doc: DocRow): EditorInitial | null {
  const items = parseItems(doc.items_json);
  if (!items) return null;

  return {
    date: doc.doc_date,
    billedTo: doc.billed_to,
    unit: doc.unit,
    driver: doc.driver,
    requestor: doc.requestor,
    items,
  };
}
