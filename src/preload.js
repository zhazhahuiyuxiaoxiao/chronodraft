const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("chronodraft", {
  startup: () => ipcRenderer.invoke("app:startup"),
  checkGit: () => ipcRenderer.invoke("app:check-git"),
  getGitHubAuthState: () => ipcRenderer.invoke("github:auth-state"),
  startGitHubLogin: () => ipcRenderer.invoke("github:start-login"),
  completeGitHubLogin: (sessionId) => ipcRenderer.invoke("github:complete-login", sessionId),
  cancelGitHubLogin: () => ipcRenderer.invoke("github:cancel-login"),
  logoutGitHub: () => ipcRenderer.invoke("github:logout"),
  listGitHubRepositories: () => ipcRenderer.invoke("github:list-repositories"),
  openGitHubInstallation: () => ipcRenderer.invoke("github:open-installation"),
  chooseProject: () => ipcRenderer.invoke("project:choose"),
  refresh: () => ipcRenderer.invoke("project:refresh"),
  loadHistory: (options) => ipcRenderer.invoke("project:history", options),
  getVersionDetails: (hash) => ipcRenderer.invoke("project:version-details", hash),
  getVersionDiff: (hash, filePath) =>
    ipcRenderer.invoke("project:version-diff", { hash, path: filePath }),
  toggleMilestone: (hash) => ipcRenderer.invoke("project:toggle-milestone", hash),
  saveVersion: (message) => ipcRenderer.invoke("project:save", message),
  sync: (options = {}) => ipcRenderer.invoke("project:sync", options),
  resolveSyncConflict: (conflict) =>
    ipcRenderer.invoke("project:resolve-sync-conflict", conflict),
  setIdentity: (identity) => ipcRenderer.invoke("project:identity", identity),
  setRemote: (url) => ipcRenderer.invoke("project:set-remote", url),
  removeRemote: () => ipcRenderer.invoke("project:remove-remote"),
  restoreVersion: (hash) => ipcRenderer.invoke("project:restore", hash),
  showInFolder: () => ipcRenderer.invoke("project:show-in-folder"),
  openExternal: (url) => ipcRenderer.invoke("external:open", url),
  onAutoSnapshot: (listener) => {
    const handler = (_event, result) => listener(result);
    ipcRenderer.on("project:auto-snapshot", handler);
    return () => ipcRenderer.removeListener("project:auto-snapshot", handler);
  },
});
