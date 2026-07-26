# Electron Windows App and Native SQLite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an NSIS Windows Electron app that uses native SQLite, migrates legacy browser data, and retries startup silently for five minutes.

**Architecture:** Electron main owns a SQLite file, IPC, legacy migration, and a bundled Nitro Node server. The existing React renderer keeps its asynchronous document functions, which delegate through a typed preload bridge; it does not store documents in `localStorage`.

**Tech Stack:** Electron, Electron Builder, TypeScript, Nitro node-server, `node:sqlite`, classic-level, Vitest.

## Global Constraints

- Build an NSIS Windows installer only.
- Store documents at `app.getPath("userData")/tda-car-rental.sqlite`; do not use renderer `localStorage` for documents.
- Bundle and load the existing TanStack Start app from a loopback-only Nitro Node server.
- Use `nodeIntegration: false`, `contextIsolation: true`, and a typed preload API.
- Retry all controlled startup failures for five minutes before showing Retry and Quit.
- Browser import is user initiated and never mutates browser files or backup files.
- Preserve current uncommitted `.gitignore`, `src/components/AppLayout.tsx`, and `src/components/DocumentEditor.tsx` changes.

---

### Task 1: Electron build and Windows packaging foundation

**Files:**

- Modify: `package.json`
- Modify: `vite.config.ts`
- Create: `tsconfig.electron.json`
- Create: `electron-builder.yml`
- Create: `src/electron/main.ts`
- Create: `src/electron/preload.ts`
- Create: `src/electron/static/loading.html`
- Create: `src/electron/static/startup-error.html`

**Interfaces:**

- Produces: `npm run build:electron`, `npm run electron:dev`, and `npm run dist:win`.
- Produces: `.output/server/index.mjs` and `dist-electron/main.js`.

- [ ] **Step 1: Install runtime and packaging dependencies**

Run:

```powershell
npm.cmd install classic-level
npm.cmd install --save-dev electron electron-builder concurrently cross-env wait-on
```

- [ ] **Step 2: Configure a Node-preset Electron build**

Change `vite.config.ts` to use `defineConfig(({ mode }) => ({ ... }))` and set
the Nitro preset with this expression:

```ts
nitro({ preset: mode === "electron" ? "node-server" : "cloudflare-module" })
```

Set `package.json` `main` to `dist-electron/main.js` and add these scripts:

```json
{
  "build:electron:renderer": "vite build --mode electron",
  "build:electron:main": "tsc --project tsconfig.electron.json",
  "build:electron": "npm run build:electron:renderer && npm run build:electron:main",
  "rebuild:native": "electron-builder install-app-deps",
  "electron:dev": "concurrently --kill-others \"vite dev --host 127.0.0.1 --port 4173\" \"tsc --project tsconfig.electron.json --watch\" \"wait-on http://127.0.0.1:4173 dist-electron/main.js && cross-env TDA_ELECTRON_DEV_URL=http://127.0.0.1:4173 electron dist-electron/main.js\"",
  "dist:win": "npm run build:electron && npm run rebuild:native && electron-builder --win nsis"
}
```

Create `tsconfig.electron.json` with `module` and `moduleResolution` set to
`NodeNext`, `target` set to `ES2022`, `outDir` set to `dist-electron`, and
`include` set to `src/electron/**/*.ts`. Configure Electron Builder to write
NSIS artifacts to `release/`, copy `.output` to `resources/app-server`, and
copy `src/electron/static` to `resources/electron-static`. Set
`asarUnpack` to `node_modules/classic-level/**` so Electron can load its
native `.node` binary after installation. `node:sqlite` ships with Electron's
embedded Node runtime and needs no packaged addon.

- [ ] **Step 3: Verify the foundation compiles**

Run: `npm.cmd run build:electron`

Expected: exit code 0 with `.output/server/index.mjs` and
`dist-electron/main.js` created.

- [ ] **Step 4: Commit the foundation**

```powershell
git add -- package.json package-lock.json vite.config.ts tsconfig.electron.json electron-builder.yml src/electron/main.ts src/electron/preload.ts src/electron/static
git commit -m "feat: add Electron Windows packaging foundation"
```

### Task 2: Native SQLite document service

**Files:**

- Create: `src/electron/main/document-database.ts`
- Create: `src/electron/main/document-database.test.ts`
- Modify: `src/lib/db.ts`
- Create: `src/lib/electron-api.d.ts`

**Interfaces:**

- Produces: `DocumentDatabase(file)` with `save`, `get`, `update`, `list`, `delete`, `close`, and `importLegacyFile`.
- Produces: the existing async renderer exports `saveDoc`, `getDoc`, `updateDoc`, `listDocs`, and `deleteDoc` backed by `window.tda.documents`.

- [ ] **Step 1: Write a failing native SQLite CRUD test**

Create a Node-environment test against a temporary file:

```ts
// @vitest-environment node
it("persists document CRUD in a native SQLite file", () => {
  const database = new DocumentDatabase(join(tempDir, "tda.sqlite"));
  const id = database.save(documentInput);
  expect(database.get(id)).toMatchObject({ id, doc_type: "billing", items_json: documentInput.items_json });
  database.update(id, { ...documentInput, billed_to: "Updated client" });
  expect(database.list()[0]?.billed_to).toBe("Updated client");
  database.delete(id);
  expect(database.list()).toEqual([]);
});
```

- [ ] **Step 2: Run it red**

Run: `npm.cmd run test -- src/electron/main/document-database.test.ts`

Expected: FAIL because `DocumentDatabase` is not implemented.

- [ ] **Step 3: Implement database and bridge types**

Use `DatabaseSync` from `node:sqlite` in main process only. Create the current
`docs` table with all fields from `DocRow` and use prepared statements for CRUD. Create
`src/lib/electron-api.d.ts` with this contract:

```ts
export interface TdaElectronApi {
  documents: {
    save(input: DocumentInput): Promise<number>;
    get(id: number): Promise<DocRow | undefined>;
    update(id: number, input: DocumentInput): Promise<void>;
    list(): Promise<DocRow[]>;
    delete(id: number): Promise<void>;
  };
  migration: {
    scanChromium(): Promise<MigrationResult[]>;
    importFile(): Promise<MigrationResult>;
  };
}
declare global { interface Window { tda: TdaElectronApi; } }
```

Replace SQL.js/localStorage in `src/lib/db.ts` with delegation to
`window.tda.documents`, retaining `DocRow`, `DocType`, and `Item` exports.

- [ ] **Step 4: Run it green**

Run: `npm.cmd run test -- src/electron/main/document-database.test.ts`

Expected: PASS, including reopening the same SQLite file in a second test.

- [ ] **Step 5: Commit**

```powershell
git add -- src/electron/main/document-database.ts src/electron/main/document-database.test.ts src/lib/db.ts src/lib/electron-api.d.ts
git commit -m "feat: store Electron documents in native SQLite"
```

### Task 3: Legacy browser data import

**Files:**

- Create: `src/electron/main/legacy-migration.ts`
- Create: `src/electron/main/legacy-migration.test.ts`
- Modify: `src/electron/main/document-database.ts`
- Create: `src/electron/static/migration.html`

**Interfaces:**

- Produces: `scanChromiumProfiles(localAppData)` and `importLegacyDatabase(file)` results shaped as `{ source, importedCount, message }`.

- [ ] **Step 1: Write failing transaction tests**

Create a compatible temporary legacy database and an invalid file. Write these
tests before the importer:

```ts
it("imports a compatible legacy SQLite database transactionally", () => {
  const result = target.importLegacyFile(legacyFile);
  expect(result.importedCount).toBe(2);
  expect(target.list()).toHaveLength(2);
});

it("rolls back when the legacy file has no compatible docs table", () => {
  expect(() => target.importLegacyFile(invalidFile)).toThrow(/SQLite|docs table/i);
  expect(target.list()).toEqual([]);
});

it("extracts only the legacy key's base64 SQLite payload from LevelDB entries", () => {
  expect(extractLegacyPayload([["other-key", "ignored"], ["tda_quotation_db_v1", encodedDatabase]])).toBe(encodedDatabase);
});
```

- [ ] **Step 2: Run them red**

Run: `npm.cmd run test -- src/electron/main/legacy-migration.test.ts`

Expected: FAIL because header/schema validation and import are absent.

- [ ] **Step 3: Implement both import paths**

`importLegacyFile` must verify `SQLite format 3\0`, attach the source
read-only, check compatible `docs` columns, and copy rows in one transaction.
Scan only after a user action. For each profile in these roots, copy its
`Local Storage/leveldb` directory to an application temp directory, read it
with `classic-level`, find `tda_quotation_db_v1`, decode its base64 payload to
a temporary SQLite file, then call `importLegacyFile`:

```ts
[
  join(localAppData, "Google", "Chrome", "User Data"),
  join(localAppData, "Microsoft", "Edge", "User Data"),
  join(localAppData, "BraveSoftware", "Brave-Browser", "User Data"),
]
```

Return non-destructive results for unreadable, locked, missing, and
unsupported profiles. Build `migration.html` with **Search browser data**,
**Import backup file**, and **Close** buttons; it calls preload only.

- [ ] **Step 4: Run them green**

Run: `npm.cmd run test -- src/electron/main/legacy-migration.test.ts`

Expected: PASS for import count and invalid-file rollback.

- [ ] **Step 5: Commit**

```powershell
git add -- src/electron/main/legacy-migration.ts src/electron/main/legacy-migration.test.ts src/electron/main/document-database.ts src/electron/static/migration.html
git commit -m "feat: add legacy browser data migration"
```

### Task 4: Secure IPC and migration window

**Files:**

- Create: `src/electron/main/ipc.ts`
- Create: `src/electron/main/ipc.test.ts`
- Modify: `src/electron/main.ts`
- Modify: `src/electron/preload.ts`

**Interfaces:**

- Produces: the exact `window.tda` API declared by `src/lib/electron-api.d.ts`.

- [ ] **Step 1: Write a failing IPC registration test**

Use a fake `ipcMain.handle` recorder and assert the registered channels are
exactly:

```ts
[
  "documents:save", "documents:get", "documents:update", "documents:list", "documents:delete",
  "migration:scan", "migration:import-file",
]
```

- [ ] **Step 2: Run it red**

Run: `npm.cmd run test -- src/electron/main/ipc.test.ts`

Expected: FAIL because IPC handlers are not registered.

- [ ] **Step 3: Implement a minimal bridge**

Register document and migration handlers in main. `migration:import-file` uses
`dialog.showOpenDialog` with `openFile` and `sqlite`/`db` extensions, so the
renderer never supplies an arbitrary path. Preload exposes only:

```ts
contextBridge.exposeInMainWorld("tda", {
  documents: {
    save: (input) => ipcRenderer.invoke("documents:save", input),
    get: (id) => ipcRenderer.invoke("documents:get", id),
    update: (id, input) => ipcRenderer.invoke("documents:update", id, input),
    list: () => ipcRenderer.invoke("documents:list"),
    delete: (id) => ipcRenderer.invoke("documents:delete", id),
  },
  migration: {
    scanChromium: () => ipcRenderer.invoke("migration:scan"),
    importFile: () => ipcRenderer.invoke("migration:import-file"),
  },
});
```

Create windows with `nodeIntegration: false`, `contextIsolation: true`, and
`sandbox: true`. Add **Data → Migrate legacy data…** to Electron's native menu
to open `migration.html`, without changing `AppLayout`.

- [ ] **Step 4: Run it green**

Run: `npm.cmd run test -- src/electron/main/ipc.test.ts`

Expected: PASS with the exact seven handlers.

- [ ] **Step 5: Commit**

```powershell
git add -- src/electron/main/ipc.ts src/electron/main/ipc.test.ts src/electron/main.ts src/electron/preload.ts
git commit -m "feat: bridge Electron renderer to native services"
```

### Task 5: Five-minute loading and retry controller

**Files:**

- Create: `src/electron/main/startup-controller.ts`
- Create: `src/electron/main/startup-controller.test.ts`
- Modify: `src/electron/main.ts`
- Modify: `src/electron/preload.ts`
- Modify: `src/electron/static/loading.html`
- Modify: `src/electron/static/startup-error.html`

**Interfaces:**

- Produces: `StartupController.start()`, `retry()`, and `dispose()` from injected process, reachability, navigation, page, and clock adapters.

- [ ] **Step 1: Write failing fake-clock behavior tests**

```ts
it("does not show a startup failure until five full minutes elapse", async () => {
  await controller.start();
  clock.advanceBy(299_999);
  expect(showTimeout).not.toHaveBeenCalled();
  clock.advanceBy(1);
  expect(showTimeout).toHaveBeenCalledTimes(1);
});
```

Add tests that `retry()` stops the stale server, resets the deadline, and
starts again; and that successful navigation ends polling.

- [ ] **Step 2: Run them red**

Run: `npm.cmd run test -- src/electron/main/startup-controller.test.ts`

Expected: FAIL because the controller does not exist.

- [ ] **Step 3: Implement startup sequencing**

Use a two-second interval and a five-minute deadline. Start
`.output/server/index.mjs` via `process.execPath` with
`ELECTRON_RUN_AS_NODE=1`, `NITRO_HOST=127.0.0.1`, and `NITRO_PORT=43017`; use
`resources/app-server/server/index.mjs` in packaged mode. Before the deadline,
child-process, reachability, and `did-fail-load` errors return to the loading
page. At the deadline, show `startup-error.html` only. Map its **Retry** and
**Quit** buttons through preload IPC. Stop the child from `before-quit`.

- [ ] **Step 4: Run them green**

Run: `npm.cmd run test -- src/electron/main/startup-controller.test.ts`

Expected: PASS for early retries, exact deadline, retry reset, success, and cleanup.

- [ ] **Step 5: Commit**

```powershell
git add -- src/electron/main/startup-controller.ts src/electron/main/startup-controller.test.ts src/electron/main.ts src/electron/preload.ts src/electron/static/loading.html src/electron/static/startup-error.html
git commit -m "feat: retry Electron startup for five minutes"
```

### Task 6: Verify packaging and document operation

**Files:**

- Modify: `README.md`
- Create: `docs/superpowers/plans/2026-07-26-electron-native-sqlite.md`

- [ ] **Step 1: Document the supported workflows**

Add this README content:

```md
## Electron development
npm run electron:dev

## Windows installer
npm run dist:win
```

State that documents live in the Electron user-data SQLite file and migration
is available from **Data → Migrate legacy data…**.

- [ ] **Step 2: Run all automated checks**

Run:

```powershell
npm.cmd run test
npm.cmd run build:electron
npm.cmd run dist:win
```

Expected: renderer and Electron suites pass, the Node server and main process
compile, and Electron Builder writes an NSIS installer under `release/`.

- [ ] **Step 3: Smoke-test the installer**

Install the NSIS output on Windows. Confirm startup reaches the document list,
create a document, relaunch, and verify the document remains. Confirm the Data
menu opens migration without reading a browser profile until the search button
is clicked.

- [ ] **Step 4: Commit final documentation**

```powershell
git add -- README.md docs/superpowers/plans/2026-07-26-electron-native-sqlite.md
git commit -m "docs: document Electron Windows workflow"
```
