const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { GitService, ChronoDraftError, checkGit } = require("./git-service");

let mainWindow;
let service = null;

function settingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

async function readSettings() {
  try {
    return JSON.parse(await fs.readFile(settingsPath(), "utf8"));
  } catch {
    return {};
  }
}

async function writeSettings(settings) {
  await fs.mkdir(path.dirname(settingsPath()), { recursive: true });
  await fs.writeFile(settingsPath(), JSON.stringify(settings, null, 2), "utf8");
}

function serializeError(error) {
  if (error instanceof ChronoDraftError) {
    return { code: error.code, message: error.message, detail: error.detail || "" };
  }
  return {
    code: "UNEXPECTED_ERROR",
    message: "遇到了意外问题，请重试。",
    detail: error?.message || String(error),
  };
}

function handle(channel, callback) {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      return { ok: true, data: await callback(...args) };
    } catch (error) {
      return { ok: false, error: serializeError(error) };
    }
  });
}

async function openProject(projectPath) {
  const stat = await fs.stat(projectPath);
  if (!stat.isDirectory()) throw new ChronoDraftError("NOT_DIRECTORY", "请选择一个文件夹。");
  service = new GitService(projectPath);
  const overview = await service.initialize();
  await writeSettings({ lastProjectPath: overview.projectPath });
  return overview;
}

function requireProject() {
  if (!service) throw new ChronoDraftError("NO_PROJECT", "请先选择一个写作文件夹。");
  return service;
}

function registerIpc() {
  handle("app:startup", async () => {
    const git = await checkGit();
    const platform = process.platform;
    if (!git.installed) return { git, platform, project: null };
    const settings = await readSettings();
    if (!settings.lastProjectPath) return { git, platform, project: null };
    try {
      return { git, platform, project: await openProject(settings.lastProjectPath) };
    } catch {
      await writeSettings({});
      return { git, platform, project: null };
    }
  });
  handle("app:check-git", async () => ({ git: await checkGit(), platform: process.platform }));

  handle("project:choose", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "选择你的写作文件夹",
      properties: ["openDirectory", "createDirectory"],
      buttonLabel: "用 ChronoDraft 打开",
    });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    return { canceled: false, project: await openProject(result.filePaths[0]) };
  });

  handle("project:refresh", () => requireProject().getOverview());
  handle("project:save", (message) => requireProject().saveVersion(message));
  handle("project:sync", () => requireProject().syncExisting());
  handle("project:identity", ({ name, email }) => requireProject().setIdentity(name, email));
  handle("project:set-remote", (url) => requireProject().setRemote(url));
  handle("project:remove-remote", () => requireProject().removeRemote());
  handle("project:restore", (hash) => requireProject().restoreVersion(hash));
  handle("project:show-in-folder", async () => {
    const error = await shell.openPath(requireProject().projectPath);
    if (error) throw new ChronoDraftError("OPEN_FOLDER_FAILED", "无法打开这个文件夹。", error);
    return true;
  });
  handle("external:open", (url) => {
    const parsed = new URL(url);
    const allowedHosts = ["github.com", "docs.github.com", "git-scm.com"];
    if (parsed.protocol !== "https:" || !allowedHosts.includes(parsed.hostname)) {
      throw new ChronoDraftError("INVALID_LINK", "只能打开经过确认的官方网站。");
    }
    return shell.openExternal(parsed.href);
  });
}

function createWindow() {
  app.setName("ChronoDraft");
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 940,
    minHeight: 640,
    backgroundColor: "#f4f1ea",
    ...(process.platform === "darwin"
      ? {
          titleBarStyle: "hiddenInset",
          trafficLightPosition: { x: 18, y: 18 },
        }
      : {}),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event) => event.preventDefault());
  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
}

app.whenReady().then(() => {
  registerIpc();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
