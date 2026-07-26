# Electron Windows App and Native SQLite Design

## Goal

Ship TDA Car Rental as a Windows NSIS installer that runs the existing app in
Electron, stores documents in a native SQLite database, and only shows a
startup failure screen after five continuous minutes of retrying.

## Scope

- Produce a packaged Windows installer with Electron Builder.
- Keep the TanStack Start application and render it through a bundled local
  Nitro Node server.
- Replace renderer `localStorage` persistence with native SQLite owned by the
  Electron main process.
- Provide first-launch migration from the current browser-backed database by
  automatic Chromium-profile discovery and manual legacy database import.
- Do not delete, alter, or depend on existing browser data after import.

## Electron Packaging and Runtime

### Build outputs

- `vite build --mode electron` builds Nitro with the `node-server` preset and
  leaves the server output in `.output/`.
- A TypeScript Electron main process and preload script compile separately to
  an Electron distribution directory.
- Electron Builder packages the compiled main process, production runtime
  dependencies, and the `.output/` server as an application resource.
- `npm run dist:win` builds all of the above and creates an NSIS installer.

### Application server

On each launch, Electron starts the packaged Nitro entrypoint as a child
process with Electron's embedded Node runtime. The server listens only on
`127.0.0.1` at one fixed, application-specific port. A fixed origin preserves
the renderer's Chromium profile across launches; document data itself lives in
SQLite rather than in browser storage.

The Electron main process stops the server when the app exits. It does not
connect to a hosted application server and does not expose the bundled server
outside the local machine.

## Startup Experience

1. The main window opens a local loading page immediately.
2. The main process starts or restarts the bundled server and polls the local
   URL on a short retry interval.
3. Once the server responds and the application navigation finishes, the
   normal renderer replaces the loading page.
4. Network/server/navigation failures return to the loading page and retry;
   they do not display an error page before the deadline.
5. After five minutes without a completed application navigation, the loading
   page changes to an error page with **Retry** and **Quit** actions.
6. Retry terminates any stale child process, resets the five-minute deadline,
   and begins the same sequence again. Quit closes Electron and its child
   process.

The timeout applies to the controlled startup sequence. A fatal Electron main
process crash cannot be represented by a running app window.

## Native SQLite Boundary

- The main process stores a SQLite file at
  `app.getPath("userData")/tda-car-rental.sqlite`.
- Node's built-in `node:sqlite` `DatabaseSync` creates and migrates the `docs`
  table with the existing document fields, line-item JSON, creation timestamp,
  and document IDs. This avoids a separately compiled native SQLite addon.
- Renderer access is limited to a typed context-bridge API for document CRUD,
  backup import, and migration actions.
- `nodeIntegration` is disabled, `contextIsolation` is enabled, and only the
  narrow preload API is exposed to renderer code.
- `src/lib/db.ts` becomes an asynchronous client for this bridge, retaining
  its existing document-facing function signatures so editor/list components
  do not directly know about Electron or SQLite.
- Chromium discovery uses `classic-level`'s bundled Windows x64 N-API binary.
  Electron Builder unpacks that binary without rebuilding it, avoiding a local
  C++/Python build-tool requirement for the installer.

## First-Launch Migration

Migration is optional and user initiated from the installed app. It never runs
silently and never deletes browser data.

### Automatic discovery

- The user can ask the app to inspect Chrome, Edge, and Brave Chromium
  profiles on Windows.
- The app copies a selected profile's local-storage LevelDB directory to a
  temporary location, then searches for the legacy `tda_quotation_db_v1`
  value.
- A discovered SQL.js database payload is decoded and copied into native
  SQLite using a transaction. Validation checks the legacy SQLite header and
  expected `docs` table before import.
- Locked, encrypted, missing, unsupported, or unreadable profiles report a
  non-destructive migration result and offer the manual path.

### Manual fallback

- The user can choose a legacy SQLite backup file through the native file
  picker.
- The app accepts only files with a SQLite header and a compatible `docs`
  table.
- Import is transactional: a validation or insertion failure leaves the
  native database unchanged.
- A successful import reports its document count and leaves the backup file in
  place.

## Testing and Verification

- Unit-test startup retry/deadline state transitions with fake child-process
  and navigation adapters.
- Unit-test native SQLite CRUD and transaction rollback for invalid imports.
- Unit-test pure legacy payload/profile parsing with fixture data; no real
  browser profile is read during tests.
- Smoke-test Electron's packaged server startup using a local build output.
- Run the existing renderer suite, the Electron-specific suite, TypeScript
  compilation, and the Windows packaging command before release.

## Out of Scope

- macOS/Linux installers.
- Synchronization, cloud backup, or a network-accessible database API.
- Deleting browser profiles or modifying their local-storage databases.
- Importing unknown database schemas beyond the documented legacy `docs`
  schema.
