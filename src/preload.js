const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("chronodraft", {
  startup: () => ipcRenderer.invoke("app:startup"),
  checkGit: () => ipcRenderer.invoke("app:check-git"),
  chooseProject: () => ipcRenderer.invoke("project:choose"),
  refresh: () => ipcRenderer.invoke("project:refresh"),
  saveVersion: (message) => ipcRenderer.invoke("project:save", message),
  sync: () => ipcRenderer.invoke("project:sync"),
  setIdentity: (identity) => ipcRenderer.invoke("project:identity", identity),
  setRemote: (url) => ipcRenderer.invoke("project:set-remote", url),
  removeRemote: () => ipcRenderer.invoke("project:remove-remote"),
  restoreVersion: (hash) => ipcRenderer.invoke("project:restore", hash),
  showInFolder: () => ipcRenderer.invoke("project:show-in-folder"),
  openExternal: (url) => ipcRenderer.invoke("external:open", url),
});
