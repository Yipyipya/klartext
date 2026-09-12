const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("klartextSettings", {
  read: () => ipcRenderer.invoke("settings-read"),
  update: (patch) => ipcRenderer.invoke("settings-update", patch),
  action: (name) => ipcRenderer.invoke("settings-action", name),
  onChanged: (callback) => {
    const listener = (_event, snapshot) => callback(snapshot);
    ipcRenderer.on("settings-changed", listener);
    return () => ipcRenderer.removeListener("settings-changed", listener);
  },
});
