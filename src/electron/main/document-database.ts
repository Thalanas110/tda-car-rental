import { DatabaseSync } from "node:sqlite";

export type DocumentType = "billing" | "quotation";

export type DocumentInput = {
  doc_type: DocumentType;
  doc_date: string;
  billed_to: string;
  unit: string;
  driver: string;
  requestor: string;
  total: number;
  items_json: string;
};

export type StoredDocument = DocumentInput & {
  id: number;
  created_at: string;
};

const documentColumns = `
  id,
  doc_type,
  doc_date,
  billed_to,
  unit,
  driver,
  requestor,
  total,
  items_json,
  created_at
`;

export class DocumentDatabase {
  private readonly database: DatabaseSync;

  constructor(file: string) {
    this.database = new DatabaseSync(file);
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS docs (
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
      )
    `);
  }

  save(input: DocumentInput): number {
    const result = this.database.prepare(`
      INSERT INTO docs (doc_type, doc_date, billed_to, unit, driver, requestor, total, items_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.doc_type,
      input.doc_date,
      input.billed_to,
      input.unit,
      input.driver,
      input.requestor,
      input.total,
      input.items_json,
    );
    return Number(result.lastInsertRowid);
  }

  get(id: number): StoredDocument | undefined {
    return this.database.prepare(`SELECT ${documentColumns} FROM docs WHERE id = ? LIMIT 1`).get(id) as
      | StoredDocument
      | undefined;
  }

  update(id: number, input: DocumentInput): void {
    this.database.prepare(`
      UPDATE docs
      SET doc_type = ?, doc_date = ?, billed_to = ?, unit = ?, driver = ?, requestor = ?, total = ?, items_json = ?
      WHERE id = ?
    `).run(
      input.doc_type,
      input.doc_date,
      input.billed_to,
      input.unit,
      input.driver,
      input.requestor,
      input.total,
      input.items_json,
      id,
    );
  }

  list(): StoredDocument[] {
    return this.database.prepare(`SELECT ${documentColumns} FROM docs ORDER BY id DESC`).all() as StoredDocument[];
  }

  delete(id: number): void {
    this.database.prepare("DELETE FROM docs WHERE id = ?").run(id);
  }

  close(): void {
    this.database.close();
  }
}
