// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

type Handler = (event: unknown, ...args: unknown[]) => unknown;

const documentInput = {
  doc_type: "billing",
  doc_date: "2026-07-26",
  billed_to: "Path Foundation",
  unit: "Toyota HiAce",
  driver: "Teddy Dimate",
  requestor: "",
  total: 1200,
  items_json: "[]",
};

describe("registerIpcHandlers", () => {
  it("registers only document and migration handlers", async () => {
    const modulePath = "@/electron/main/ipc";
    const module = await import(modulePath).catch(() => undefined);

    expect(module?.registerIpcHandlers).toBeTypeOf("function");
    if (!module) return;

    const handlers = new Map<string, Handler>();
    const database = {
      save: vi.fn(() => 8),
      get: vi.fn(() => undefined),
      update: vi.fn(),
      list: vi.fn(() => []),
      delete: vi.fn(),
      importLegacyFile: vi.fn(() => 2),
    };
    const scanChromiumProfiles = vi.fn(async () => [{ source: "Chrome", importedCount: 1, message: "Imported 1 document(s)." }]);
    const dialog = { showOpenDialog: vi.fn(async () => ({ canceled: true, filePaths: [] })) };

    module.registerIpcHandlers({
      database,
      dialog,
      ipcMain: { handle: (channel: string, handler: Handler) => handlers.set(channel, handler) },
      localAppData: "C:/Users/Example/AppData/Local",
      scanChromiumProfiles,
    });

    expect([...handlers.keys()]).toEqual([
      "documents:save",
      "documents:get",
      "documents:update",
      "documents:list",
      "documents:delete",
      "migration:scan",
      "migration:import-file",
    ]);
    await handlers.get("documents:save")?.({}, documentInput);
    expect(database.save).toHaveBeenCalledWith(documentInput);
    await handlers.get("migration:scan")?.({});
    expect(scanChromiumProfiles).toHaveBeenCalledWith("C:/Users/Example/AppData/Local", database);
    await expect(handlers.get("migration:import-file")?.({})).resolves.toMatchObject({ importedCount: 0 });
    expect(database.importLegacyFile).not.toHaveBeenCalled();
  });
});
