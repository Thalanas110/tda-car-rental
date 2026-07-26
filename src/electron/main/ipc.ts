import type { Dialog } from "electron";
import type { DocumentDatabase, DocumentInput, StoredDocument } from "./document-database.js";
import type { MigrationResult } from "./legacy-migration.js";

type IpcHandler = (event: unknown, ...args: unknown[]) => unknown;

type IpcMainPort = {
  handle(channel: string, listener: IpcHandler): void;
};

type DialogPort = Pick<Dialog, "showOpenDialog">;

type DocumentDatabasePort = Pick<DocumentDatabase, "save" | "get" | "update" | "list" | "delete" | "importLegacyFile">;

export const ipcChannels = [
  "documents:save",
  "documents:get",
  "documents:update",
  "documents:list",
  "documents:delete",
  "migration:scan",
  "migration:import-file",
] as const;

export type IpcDependencies = {
  database: DocumentDatabasePort;
  dialog: DialogPort;
  ipcMain: IpcMainPort;
  localAppData: string;
  scanChromiumProfiles(localAppData: string, database: DocumentDatabasePort): Promise<MigrationResult[]>;
};

function positiveInteger(value: unknown): number {
  if (!Number.isInteger(value) || typeof value !== "number" || value <= 0) {
    throw new Error("Document ID must be a positive integer.");
  }
  return value;
}

function documentInput(value: unknown): DocumentInput {
  if (!value || typeof value !== "object") throw new Error("Document data is required.");
  const input = value as Record<string, unknown>;
  const stringFields = ["doc_type", "doc_date", "billed_to", "unit", "driver", "requestor", "items_json"] as const;
  if (stringFields.some((field) => typeof input[field] !== "string") || typeof input.total !== "number") {
    throw new Error("Document data is invalid.");
  }
  if (input.doc_type !== "billing" && input.doc_type !== "quotation") {
    throw new Error("Document type is invalid.");
  }
  return input as unknown as DocumentInput;
}

function manualImportCancelled(): MigrationResult {
  return { source: "Manual backup", importedCount: 0, message: "No backup file was selected." };
}

export function registerIpcHandlers({ database, dialog, ipcMain, localAppData, scanChromiumProfiles }: IpcDependencies) {
  ipcMain.handle("documents:save", (_event, input) => database.save(documentInput(input)));
  ipcMain.handle("documents:get", (_event, id) => database.get(positiveInteger(id)) as StoredDocument | undefined);
  ipcMain.handle("documents:update", (_event, id, input) => database.update(positiveInteger(id), documentInput(input)));
  ipcMain.handle("documents:list", () => database.list());
  ipcMain.handle("documents:delete", (_event, id) => database.delete(positiveInteger(id)));
  ipcMain.handle("migration:scan", () => scanChromiumProfiles(localAppData, database));
  ipcMain.handle("migration:import-file", async () => {
    const selection = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [{ name: "SQLite database", extensions: ["sqlite", "db"] }],
    });
    const file = selection.filePaths[0];
    if (selection.canceled || !file) return manualImportCancelled();
    const importedCount = database.importLegacyFile(file);
    return { source: file, importedCount, message: `Imported ${importedCount} document(s).` };
  });
}
