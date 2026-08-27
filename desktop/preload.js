const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("klartext", {
  ready: () => ipcRenderer.send("renderer-ready"),
  onPrepare: (cb) => ipcRenderer.on("prepare", (_e, settings) => cb(settings)),
  prepared: (result) => ipcRenderer.send("prepared", result),
  onStart: (cb) => ipcRenderer.on("start", (_e, settings) => cb(settings)),
  onStop: (cb) => ipcRenderer.on("stop", () => cb()),
  onCancel: (cb) => ipcRenderer.on("cancel", () => cb()),
  onProcessingStart: (cb) => ipcRenderer.on("processing-start", () => cb()),
  onRefiningStart: (cb) => ipcRenderer.on("refining-start", () => cb()),
  result: (payload) => ipcRenderer.send("result", payload),
  error: (message) => ipcRenderer.send("pill-error", message),
  saveApiKey: (key) => ipcRenderer.send("save-api-key", key),
  closeKeyWindow: () => ipcRenderer.send("close-key-window"),
});
