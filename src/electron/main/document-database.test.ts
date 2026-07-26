// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

type DocumentInput = {
  doc_type: "billing" | "quotation";
  doc_date: string;
  billed_to: string;
  unit: string;
  driver: string;
  requestor: string;
  total: number;
  items_json: string;
};

type DatabaseContract = {
  save(input: DocumentInput): number;
  get(id: number): { id: number; billed_to: string; items_json: string } | undefined;
  update(id: number, input: DocumentInput): void;
  list(): Array<{ id: number; billed_to: string }>;
  delete(id: number): void;
  close(): void;
};

type DatabaseModule = {
  DocumentDatabase: new (file: string) => DatabaseContract;
};

const tempDirectories: string[] = [];
const documentInput: DocumentInput = {
  doc_type: "billing",
  doc_date: "2026-07-26",
  billed_to: "Path Foundation",
  unit: "Toyota HiAce",
  driver: "Teddy Dimate",
  requestor: "",
  total: 1200,
  items_json: JSON.stringify([
    { date: "2026-07-26", unit: "Toyota HiAce", destination: "Subic", passenger: "A. Cruz", amount: 1200 },
  ]),
};

function temporaryDatabaseFile() {
  const directory = mkdtempSync(join(tmpdir(), "tda-electron-db-"));
  tempDirectories.push(directory);
  return join(directory, "tda-car-rental.sqlite");
}

async function loadDatabaseModule() {
  const modulePath = "./document-database";
  const module = await import(modulePath).catch(() => undefined);
  expect(module?.DocumentDatabase).toBeTypeOf("function");
  return module as DatabaseModule | undefined;
}

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("DocumentDatabase", () => {
  it("persists document CRUD in a native SQLite file", async () => {
    const module = await loadDatabaseModule();
    if (!module) return;

    const file = temporaryDatabaseFile();
    const database = new module.DocumentDatabase(file);
    const id = database.save(documentInput);

    expect(database.get(id)).toMatchObject({ id, billed_to: "Path Foundation", items_json: documentInput.items_json });
    database.update(id, { ...documentInput, billed_to: "Updated client" });
    expect(database.list()).toMatchObject([{ id, billed_to: "Updated client" }]);
    database.close();

    const reopened = new module.DocumentDatabase(file);
    expect(reopened.get(id)).toMatchObject({ id, billed_to: "Updated client" });
    reopened.delete(id);
    expect(reopened.list()).toEqual([]);
    reopened.close();
  });
});
