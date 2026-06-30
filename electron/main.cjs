const path = require("path");
const { app, BrowserWindow, ipcMain, shell } = require("electron");

const DEFAULT_APP_URL = "https://token-meterz.vercel.app/?guest=1";

function getAppUrl() {
  return process.env.TOKEN_METER_APP_URL || DEFAULT_APP_URL;
}

function getAppOrigin() {
  return new URL(getAppUrl()).origin;
}

function isExternalHttpUrl(url) {
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return false;
  }

  try {
    return new URL(url).origin !== getAppOrigin();
  } catch {
    return true;
  }
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 420,
    height: 840,
    minWidth: 280,
    minHeight: 420,
    title: "Token Meter",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
      sandbox: true,
    },
  });

  mainWindow.loadURL(getAppUrl());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalHttpUrl(url)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isExternalHttpUrl(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

app.setName("Token Meter");

ipcMain.handle("window:get-always-on-top", (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  return Boolean(window?.isAlwaysOnTop());
});

ipcMain.handle("window:set-always-on-top", (event, enabled) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) return false;
  window.setAlwaysOnTop(Boolean(enabled), "floating");
  return window.isAlwaysOnTop();
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
