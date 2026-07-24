// SQLite (sql.js) with localStorage persistence.
// Works in browser preview and Electron alike.
import initSqlJs, { type Database } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";

const STORAGE_KEY = "tda_quotation_db_v1";
let dbPromise: Promise<Database> | null = null;

export type DocType = "billing" | "quotation";

export interface DocRow {
  id: number;
  doc_type: DocType;
  doc_date: string;
  billed_to: string;
  unit: string;
  driver: string;
  requestor: string;
  total: number;
  items_json: string;
  created_at: string;
}

export interface Item {
  date: string;
  destination: string;
  passenger: string;
  amount: number;
}

async function loadDb(): Promise<Database> {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const saved = localStorage.getItem(STORAGE_KEY);
  const db = saved
    ? new SQL.Database(Uint8Array.from(atob(saved), (c) => c.charCodeAt(0)))
    : new SQL.Database();
  db.run(`CREATE TABLE IF NOT EXISTS docs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    doc_type TEXT NOT NULL,
    doc_date TEXT NOT NULL,
    billed_to TEXT,
    unit TEXT,
    driver TEXT,
    requestor TEXT,
    total REAL,
    items_json TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  return db;
}

export function getDb(): Promise<Database> {
  if (!dbPromise) dbPromise = loadDb();
  return dbPromise;
}

export async function persist() {
  const db = await getDb();
  const bytes = db.export();
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  localStorage.setItem(STORAGE_KEY, btoa(bin));
}

export async function saveDoc(d: Omit<DocRow, "id" | "created_at">): Promise<number> {
  const db = await getDb();
  db.run(
    `INSERT INTO docs (doc_type, doc_date, billed_to, unit, driver, requestor, total, items_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [d.doc_type, d.doc_date, d.billed_to, d.unit, d.driver, d.requestor, d.total, d.items_json],
  );
  const res = db.exec("SELECT last_insert_rowid() AS id");
  const id = Number(res[0].values[0][0]);
  await persist();
  return id;
}

export async function getDoc(id: number): Promise<DocRow | undefined> {
  const db = await getDb();
  const res = db.exec("SELECT * FROM docs WHERE id = ? LIMIT 1", [id]);
  if (!res.length || !res[0].values.length) return undefined;

  const [values] = res[0].values;
  const doc: Record<string, unknown> = {};
  res[0].columns.forEach((column, index) => (doc[column] = values[index]));
  return doc as unknown as DocRow;
}

export async function updateDoc(id: number, d: Omit<DocRow, "id" | "created_at">): Promise<void> {
  const db = await getDb();
  db.run(
    `UPDATE docs
     SET doc_type = ?, doc_date = ?, billed_to = ?, unit = ?, driver = ?, requestor = ?, total = ?, items_json = ?
     WHERE id = ?`,
    [d.doc_type, d.doc_date, d.billed_to, d.unit, d.driver, d.requestor, d.total, d.items_json, id],
  );
  await persist();
}

export async function listDocs(): Promise<DocRow[]> {
  const db = await getDb();
  const res = db.exec("SELECT * FROM docs ORDER BY id DESC");
  if (!res.length) return [];
  const cols = res[0].columns;
  return res[0].values.map((row) => {
    const o: Record<string, unknown> = {};
    cols.forEach((c, i) => (o[c] = row[i]));
    return o as unknown as DocRow;
  });
}

export async function deleteDoc(id: number) {
  const db = await getDb();
  db.run("DELETE FROM docs WHERE id = ?", [id]);
  await persist();
}
