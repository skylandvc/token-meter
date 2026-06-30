const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("tokenMeterDesktop", {
  getAlwaysOnTop: () => ipcRenderer.invoke("window:get-always-on-top"),
  setAlwaysOnTop: (enabled) => ipcRenderer.invoke("window:set-always-on-top", Boolean(enabled)),
});
