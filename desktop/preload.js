const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("klartext", {
  onStart: (cb) => ipcRenderer.on("start", (_e, settings) => cb(settings)),
  onStop: (cb) => ipcRenderer.on("stop", () => cb()),
  onCancel: (cb) => ipcRenderer.on("cancel", () => cb()),
  result: (text) => ipcRenderer.send("result", text),
  error: (message) => ipcRenderer.send("pill-error", message),
});
