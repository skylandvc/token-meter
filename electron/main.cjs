const { app, BrowserWindow, shell } = require("electron");

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
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    title: "Token Meter",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
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
