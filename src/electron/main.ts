import { app, BrowserWindow, dialog, ipcMain, Menu } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DocumentDatabase } from "./main/document-database.js";
import { registerIpcHandlers } from "./main/ipc.js";
import { scanChromiumProfiles } from "./main/legacy-migration.js";

const currentDir = dirname(fileURLToPath(import.meta.url));

function staticPath(name: string) {
  return app.isPackaged
    ? join(process.resourcesPath, "electron-static", name)
    : join(currentDir, "../src/electron/static", name);
}

async function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    show: false,
    webPreferences: {
      preload: join(currentDir, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  window.once("ready-to-show", () => window.show());
  if (process.env.TDA_ELECTRON_DEV_URL) {
    await window.loadURL(process.env.TDA_ELECTRON_DEV_URL);
  } else {
    await window.loadFile(staticPath("loading.html"));
  }
  return window;
}

async function createMigrationWindow(parent: BrowserWindow) {
  const window = new BrowserWindow({
    width: 680,
    height: 520,
    parent,
    webPreferences: {
      preload: join(currentDir, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  await window.loadFile(staticPath("migration.html"));
}

app.whenReady().then(async () => {
  const database = new DocumentDatabase(join(app.getPath("userData"), "tda-car-rental.sqlite"));
  registerIpcHandlers({
    database,
    dialog,
    ipcMain,
    localAppData: process.env.LOCALAPPDATA ?? app.getPath("userData"),
    scanChromiumProfiles,
  });
  const mainWindow = await createWindow();
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: "Data",
      submenu: [{ label: "Migrate legacy data…", click: () => void createMigrationWindow(mainWindow) }],
    },
  ]));
  app.once("before-quit", () => database.close());
});

app.on("window-all-closed", () => app.quit());
