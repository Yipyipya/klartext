const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("klartextWorkspace", {
  read: () => ipcRenderer.invoke("workspace-read"),
  action: (name, payload) => ipcRenderer.invoke("workspace-action", name, payload),
  appendFragment: (payload) => ipcRenderer.invoke("workspace-append-recording-fragment", payload),
  finishRecording: (payload) => ipcRenderer.invoke("workspace-finish-recording", payload),
  rendered: (state) => ipcRenderer.send("workspace-rendered", state),
  onChanged: (callback) => {
    const listener = (_event, snapshot) => callback(snapshot);
    ipcRenderer.on("workspace-changed", listener);
    return () => ipcRenderer.removeListener("workspace-changed", listener);
  },
});
