const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("klartextWake", {
  ready: () => ipcRenderer.send("wake-ready"),
  status: (state, detail) => ipcRenderer.send("wake-status", { state, detail }),
  detected: (action, details) => ipcRenderer.send("wake-detected", { action, details }),
  onConfigure: (cb) => ipcRenderer.on("wake-configure", (_event, config) => cb(config)),
  onRecordingState: (cb) => ipcRenderer.on("wake-recording-state", (_event, active) => cb(Boolean(active))),
});
