const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("klartextOnboarding", {
  read: () => ipcRenderer.invoke("onboarding-read"),
  action: (name, payload) => ipcRenderer.invoke("onboarding-action", name, payload),
  rendered: (state) => ipcRenderer.send("onboarding-rendered", state),
  onChanged: (callback) => {
    const listener = (_event, snapshot) => callback(snapshot);
    ipcRenderer.on("onboarding-changed", listener);
    return () => ipcRenderer.removeListener("onboarding-changed", listener);
  },
});
