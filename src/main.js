const { app, BrowserWindow, dialog, ipcMain, safeStorage, shell } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { GitService, ChronoDraftError, checkGit, redactSensitiveText } = require("./git-service");
const { CredentialStoreError, EncryptedCredentialStore } = require("./credential-store");
const { getGitHubAppConfig } = require("./github-app-config");
const { GitHubAuthError, GitHubAuthService } = require("./github-auth");
const { ProjectSession } = require("./project-session");

let mainWindow;
let githubAuthService = null;
let githubAuthInitializationError = null;
let safeHooksPath = "";
const projectSession = new ProjectSession(
  (projectPath) =>
    new GitService(projectPath, {
      githubTokenProvider: (options) => githubAuthService?.getAccessToken(options) || null,
      safeHooksPath,
    }),
);
const operationQueues = new WeakMap();
const AUTO_SNAPSHOT_INTERVAL_MS = 10 * 60 * 1000;
let autoSnapshotTimer = null;

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
  if (
    error instanceof ChronoDraftError ||
    error instanceof GitHubAuthError ||
    error instanceof CredentialStoreError
  ) {
    return {
      code: error.code,
      message: error.message,
      detail: redactSensitiveText(error.detail || ""),
    };
  }
  return {
    code: "UNEXPECTED_ERROR",
    message: "遇到了意外问题，请重试。",
    detail: redactSensitiveText(error?.message || String(error)),
  };
}

async function initializeGitHubAuth() {
  const config = getGitHubAppConfig();
  safeHooksPath = path.join(app.getPath("userData"), "disabled-git-hooks");
  await fs.mkdir(safeHooksPath, { recursive: true, mode: 0o700 });
  const store = new EncryptedCredentialStore({
    filePath: path.join(app.getPath("userData"), "github-credentials.bin"),
    encryption: safeStorage,
  });
  githubAuthService = new GitHubAuthService({ ...config, store });
}

function requireGitHubAuth() {
  if (!githubAuthService) {
    throw new GitHubAuthError(
      "GITHUB_AUTH_NOT_READY",
      githubAuthInitializationError
        ? "GitHub 登录组件无法安全初始化，其他本地功能仍可正常使用。"
        : "GitHub 登录组件还没有准备好，请稍后重试。",
      githubAuthInitializationError?.message || "",
    );
  }
  return githubAuthService;
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

function runServiceOperation(service, callback) {
  const previous = operationQueues.get(service) || Promise.resolve();
  const operation = previous.catch(() => {}).then(() => callback(service));
  operationQueues.set(service, operation.catch(() => {}));
  return operation;
}

function runProjectOperation(callback) {
  return runServiceOperation(requireProject(), callback);
}

async function runAutoSnapshot() {
  const service = projectSession.service;
  if (!service) return;
  try {
    const result = await runServiceOperation(service, (current) => current.createAutoSnapshot());
    if (
      result.created &&
      projectSession.service === service &&
      mainWindow &&
      !mainWindow.isDestroyed()
    ) {
      mainWindow.webContents.send("project:auto-snapshot", {
        projectPath: service.projectPath,
        snapshot: result.snapshot,
        snapshots: result.snapshots,
      });
    }
  } catch {
    // Automatic protection is best-effort; manual save remains available and must not be interrupted.
  }
}

function scheduleAutoSnapshot() {
  if (autoSnapshotTimer) clearTimeout(autoSnapshotTimer);
  autoSnapshotTimer = setTimeout(async () => {
    await runAutoSnapshot();
    scheduleAutoSnapshot();
  }, AUTO_SNAPSHOT_INTERVAL_MS);
  autoSnapshotTimer.unref?.();
}

async function openProject(projectPath) {
  const stat = await fs.stat(projectPath);
  if (!stat.isDirectory()) throw new ChronoDraftError("NOT_DIRECTORY", "请选择一个文件夹。");
  const overview = await projectSession.open(projectPath, (candidateOverview) =>
    writeSettings({ lastProjectPath: candidateOverview.projectPath }),
  );
  scheduleAutoSnapshot();
  return overview;
}

function requireProject() {
  return projectSession.requireProject();
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
  handle("github:auth-state", () => requireGitHubAuth().getState());
  handle("github:start-login", async () => {
    const auth = requireGitHubAuth();
    const login = await auth.startDeviceFlow();
    try {
      await shell.openExternal(login.verificationUri);
    } catch (error) {
      auth.cancelDeviceFlow();
      throw new GitHubAuthError(
        "GITHUB_BROWSER_OPEN_FAILED",
        "无法打开 GitHub 登录页面，请检查默认浏览器设置。",
        error.message,
      );
    }
    return login;
  });
  handle("github:complete-login", (sessionId) =>
    requireGitHubAuth().completeDeviceFlow(sessionId),
  );
  handle("github:cancel-login", () => requireGitHubAuth().cancelDeviceFlow());
  handle("github:logout", () => requireGitHubAuth().logout());
  handle("github:list-repositories", () => requireGitHubAuth().listRepositories());
  handle("github:open-installation", async () => {
    const state = await requireGitHubAuth().getState();
    if (!state.installUrl) {
      throw new GitHubAuthError(
        "GITHUB_APP_NOT_CONFIGURED",
        "GitHub App 的安装地址还没有配置。",
      );
    }
    await shell.openExternal(state.installUrl);
    return true;
  });

  handle("project:choose", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "选择你的写作文件夹",
      properties: ["openDirectory", "createDirectory"],
      buttonLabel: "用 ChronoDraft 打开",
    });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    return { canceled: false, project: await openProject(result.filePaths[0]) };
  });

  handle("project:refresh", () => runProjectOperation((service) => service.getOverview()));
  handle("project:history", (options) =>
    runProjectOperation((service) => service.getHistoryPage(options)),
  );
  handle("project:version-details", (hash) =>
    runProjectOperation((service) => service.getVersionDetails(hash)),
  );
  handle("project:version-diff", ({ hash, path: filePath }) =>
    runProjectOperation((service) => service.getVersionDiff(hash, filePath)),
  );
  handle("project:toggle-milestone", (hash) =>
    runProjectOperation((service) => service.toggleMilestone(hash)),
  );
  handle("project:save", (message) =>
    runProjectOperation((service) => service.saveVersion(message)),
  );
  handle("project:sync", (options = {}) =>
    runProjectOperation((service) =>
      service.syncExisting({ allowWarnings: Boolean(options.allowWarnings) }),
    ),
  );
  handle("project:resolve-sync-conflict", ({ localHash, remoteHash }) =>
    runProjectOperation((service) =>
      service.resolveSyncConflict({ localHash, remoteHash }),
    ),
  );
  handle("project:identity", ({ name, email }) =>
    runProjectOperation((service) => service.setIdentity(name, email)),
  );
  handle("project:set-remote", (url) =>
    runProjectOperation((service) => service.setRemote(url)),
  );
  handle("project:remove-remote", () =>
    runProjectOperation((service) => service.removeRemote()),
  );
  handle("project:restore", (hash) =>
    runProjectOperation((service) => service.restoreVersion(hash)),
  );
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

app.whenReady().then(async () => {
  try {
    await initializeGitHubAuth();
  } catch (error) {
    githubAuthInitializationError = error;
    githubAuthService = null;
  }
  registerIpc();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
