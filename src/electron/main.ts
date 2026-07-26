import { app, BrowserWindow } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
