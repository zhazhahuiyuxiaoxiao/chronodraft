const state = {
  overview: null,
  platform: "",
  gitDownloadUrl: "https://git-scm.com/downloads",
  pendingAction: null,
  restoreTarget: null,
  messageTouched: false,
  busy: false,
};

const elements = {
  loading: document.querySelector("#loading-screen"),
  gitSetup: document.querySelector("#git-setup-screen"),
  welcome: document.querySelector("#welcome-screen"),
  app: document.querySelector("#app-screen"),
  gitDownload: document.querySelector("#git-download"),
  gitRecheck: document.querySelector("#git-recheck"),
  gitPlatformHelp: document.querySelector("#git-platform-help"),
  gitInstallTip: document.querySelector("#git-install-tip"),
  welcomeChoose: document.querySelector("#welcome-choose"),
  projectSwitcher: document.querySelector("#project-switcher"),
  projectName: document.querySelector("#project-name"),
  projectPath: document.querySelector("#project-path"),
  projectInitial: document.querySelector("#project-initial"),
  greeting: document.querySelector("#greeting"),
  changeSummary: document.querySelector("#change-summary"),
  changeCount: document.querySelector("#change-count-badge"),
  changesList: document.querySelector("#changes-list"),
  recentHistory: document.querySelector("#recent-history"),
  fullHistory: document.querySelector("#full-history"),
  historyCount: document.querySelector("#history-count"),
  versionMessage: document.querySelector("#version-message"),
  messageCount: document.querySelector("#message-count"),
  saveButton: document.querySelector("#save-button"),
  saveButtonNote: document.querySelector("#save-button-note"),
  cloudCard: document.querySelector("#cloud-card"),
  cloudTitle: document.querySelector("#cloud-title"),
  cloudDescription: document.querySelector("#cloud-description"),
  cloudAction: document.querySelector("#cloud-action"),
  syncBadge: document.querySelector("#sync-badge"),
  refreshButton: document.querySelector("#refresh-button"),
  changesRefresh: document.querySelector("#changes-refresh"),
  showFolder: document.querySelector("#show-folder"),
  settingsButton: document.querySelector("#settings-button"),
  todayView: document.querySelector("#today-view"),
  historyView: document.querySelector("#history-view"),
  backdrop: document.querySelector("#modal-backdrop"),
  setupModal: document.querySelector("#setup-modal"),
  remoteModal: document.querySelector("#remote-modal"),
  restoreModal: document.querySelector("#restore-modal"),
  identityForm: document.querySelector("#identity-form"),
  identityName: document.querySelector("#identity-name"),
  identityEmail: document.querySelector("#identity-email"),
  remoteForm: document.querySelector("#remote-form"),
  remoteUrl: document.querySelector("#remote-url"),
  removeRemote: document.querySelector("#remove-remote"),
  restoreDescription: document.querySelector("#restore-description"),
  confirmRestore: document.querySelector("#confirm-restore"),
  toastRegion: document.querySelector("#toast-region"),
};

function unwrap(result) {
  if (!result?.ok) {
    const error = new Error(result?.error?.message || "操作没有完成，请重试。");
    error.code = result?.error?.code || "UNKNOWN_ERROR";
    error.detail = result?.error?.detail || "";
    throw error;
  }
  return result.data;
}

function setBusy(isBusy, label = "") {
  state.busy = isBusy;
  document.body.classList.toggle("is-busy", isBusy);
  if (label) {
    elements.saveButton.querySelector(".button-copy strong").textContent = label;
  } else {
    elements.saveButton.querySelector(".button-copy strong").textContent = "保存新版本";
  }
  updateSaveButton();
}

function showToast(title, message = "", type = "success", duration = 5500) {
  const toast = document.createElement("article");
  toast.className = `toast ${type}`;

  const icon = document.createElement("span");
  icon.className = "toast__icon";
  icon.textContent = type === "error" ? "!" : type === "warning" ? "i" : "✓";

  const copy = document.createElement("div");
  const heading = document.createElement("strong");
  heading.textContent = title;
  const description = document.createElement("p");
  description.textContent = message;
  copy.append(heading);
  if (message) copy.append(description);

  const close = document.createElement("button");
  close.type = "button";
  close.setAttribute("aria-label", "关闭");
  close.textContent = "×";
  close.addEventListener("click", () => toast.remove());

  toast.append(icon, copy, close);
  elements.toastRegion.append(toast);
  window.setTimeout(() => toast.remove(), duration);
}

function handleError(error) {
  if (error.code === "GIT_NOT_FOUND") {
    showGitSetup(state.platform);
    return;
  }
  if (error.code === "IDENTITY_REQUIRED") {
    openIdentityModal();
    return;
  }
  const detail = error.detail && error.detail !== error.message ? error.detail : "";
  showToast(error.message || "操作没有完成", detail, "error", 8000);
}

function hourGreeting() {
  const hour = new Date().getHours();
  if (hour < 6) return "夜深了";
  if (hour < 11) return "上午好";
  if (hour < 14) return "中午好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

function basename(filePath) {
  return String(filePath).split("/").pop() || filePath;
}

function dirname(filePath) {
  const parts = String(filePath).split("/");
  parts.pop();
  return parts.join("/") || "项目根目录";
}

function typeLabel(type) {
  return {
    added: "新增",
    modified: "修改",
    deleted: "删除",
    renamed: "重命名",
    conflict: "待确认",
  }[type] || "变化";
}

function typeIcon(type) {
  return {
    added: "+",
    modified: "M",
    deleted: "−",
    renamed: "→",
    conflict: "!",
  }[type] || "•";
}

function suggestMessage(changes) {
  if (changes.length === 1) {
    const change = changes[0];
    return `${typeLabel(change.type)} ${basename(change.path)}`;
  }
  const counts = changes.reduce((result, change) => {
    result[change.type] = (result[change.type] || 0) + 1;
    return result;
  }, {});
  const parts = [];
  if (counts.added) parts.push(`新增 ${counts.added} 个`);
  if (counts.modified) parts.push(`修改 ${counts.modified} 个`);
  if (counts.deleted) parts.push(`删除 ${counts.deleted} 个`);
  if (counts.renamed) parts.push(`重命名 ${counts.renamed} 个`);
  if (counts.conflict) parts.push(`${counts.conflict} 个文件待确认`);
  return parts.length ? `${parts.join("，")}文件` : "保存今天的修改";
}

function formatDate(value, includeYear = false) {
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return `今天 ${new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date)}`;
  }
  return new Intl.DateTimeFormat("zh-CN", {
    ...(includeYear ? { year: "numeric" } : {}),
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function renderChanges(changes) {
  elements.changesList.replaceChildren();
  if (changes.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const inner = document.createElement("div");
    const icon = document.createElement("span");
    icon.textContent = "✓";
    const title = document.createElement("strong");
    title.textContent = "现在很安心";
    const note = document.createElement("p");
    note.textContent = "文件夹里暂时没有新的修改";
    inner.append(icon, title, note);
    empty.append(inner);
    elements.changesList.append(empty);
    return;
  }

  for (const change of changes) {
    const item = document.createElement("div");
    item.className = `change-item ${change.type}`;

    const icon = document.createElement("span");
    icon.className = "change-icon";
    icon.textContent = typeIcon(change.type);

    const file = document.createElement("div");
    file.className = "change-file";
    const name = document.createElement("strong");
    name.textContent = basename(change.path);
    name.title = change.path;
    const folder = document.createElement("small");
    folder.textContent = dirname(change.path);
    file.append(name, folder);

    const label = document.createElement("span");
    label.className = "change-type";
    label.textContent = typeLabel(change.type);
    item.append(icon, file, label);
    elements.changesList.append(item);
  }
}

function makeTimelineItem(version, allowRestore) {
  const item = document.createElement("article");
  item.className = "timeline-item";

  const dot = document.createElement("span");
  dot.className = "timeline-dot";

  const copy = document.createElement("div");
  copy.className = "timeline-copy";
  const title = document.createElement("strong");
  title.textContent = version.message;
  const meta = document.createElement("p");
  meta.textContent = `${formatDate(version.date, allowRestore)} · ${version.author} · ${version.shortHash}`;
  copy.append(title, meta);

  item.append(dot, copy);
  if (allowRestore) {
    const restore = document.createElement("button");
    restore.className = "restore-button";
    restore.type = "button";
    restore.textContent = "恢复此版本";
    restore.addEventListener("click", () => openRestoreModal(version));
    item.append(restore);
  }
  return item;
}

function renderHistory(history) {
  elements.recentHistory.replaceChildren();
  elements.fullHistory.replaceChildren();

  if (history.length === 0) {
    for (const target of [elements.recentHistory, elements.fullHistory]) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      const inner = document.createElement("div");
      const icon = document.createElement("span");
      icon.textContent = "✦";
      const title = document.createElement("strong");
      title.textContent = "第一段历史等你写下";
      const note = document.createElement("p");
      note.textContent = "修改文件后，保存你的第一个版本";
      inner.append(icon, title, note);
      empty.append(inner);
      target.append(empty);
    }
    return;
  }

  history.slice(0, 3).forEach((version) => {
    elements.recentHistory.append(makeTimelineItem(version, false));
  });
  history.forEach((version) => {
    elements.fullHistory.append(makeTimelineItem(version, true));
  });
}

function renderSync(overview) {
  const { remote, sync } = overview;
  elements.syncBadge.classList.remove("warning");
  elements.removeRemote.classList.toggle("hidden", !remote.configured);

  if (!remote.configured) {
    elements.cloudTitle.textContent = "仅保存在本机";
    elements.cloudDescription.textContent = "连接 GitHub，多一份云端备份";
    elements.cloudAction.textContent = "连接";
    elements.syncBadge.querySelector("span").textContent = "本地安全";
    elements.saveButtonNote.textContent = "先保存在本机，连接 GitHub 后可同步";
    return;
  }

  elements.cloudTitle.textContent = "已连接 GitHub";
  elements.cloudDescription.textContent = remote.displayUrl.replace("https://github.com/", "");
  elements.cloudAction.textContent = "设置";
  elements.remoteUrl.value = remote.url;
  elements.saveButtonNote.textContent = "保存后自动同步到 GitHub";

  if (sync.state === "synced") {
    elements.syncBadge.querySelector("span").textContent = "云端已同步";
  } else if (sync.ahead > 0) {
    elements.syncBadge.classList.add("warning");
    elements.syncBadge.querySelector("span").textContent = `${sync.ahead} 个版本待同步`;
  } else if (sync.behind > 0) {
    elements.syncBadge.classList.add("warning");
    elements.syncBadge.querySelector("span").textContent = "云端有新内容";
  } else {
    elements.syncBadge.classList.add("warning");
    elements.syncBadge.querySelector("span").textContent = "尚未同步";
  }
}

function updateSaveButton() {
  const changes = state.overview?.changes || [];
  const hasConflict = changes.some((change) => change.type === "conflict");
  const hasMessage = elements.versionMessage.value.trim().length > 0;
  elements.saveButton.disabled =
    state.busy || changes.length === 0 || hasConflict || !hasMessage;
}

function render(overview, { preserveMessage = false } = {}) {
  state.overview = overview;
  const changes = overview.changes || [];
  const history = overview.history || [];

  elements.projectName.textContent = overview.projectName;
  elements.projectPath.textContent = overview.projectPath;
  elements.projectInitial.textContent = overview.projectName.slice(0, 1).toUpperCase();
  elements.greeting.textContent = hourGreeting();
  elements.historyCount.textContent = String(history.length);
  elements.changeCount.textContent = `${changes.length} 个文件`;

  if (changes.length === 0) {
    elements.changeSummary.textContent = "所有修改都已经妥善保存。";
  } else if (changes.some((change) => change.type === "conflict")) {
    elements.changeSummary.textContent = "有文件需要先确认，ChronoDraft 不会自动覆盖它们。";
  } else {
    elements.changeSummary.textContent = `发现 ${changes.length} 个文件有变化，准备好就保存一个新版本。`;
  }

  if (!preserveMessage && !state.messageTouched) {
    elements.versionMessage.value = changes.length ? suggestMessage(changes) : "";
  }
  elements.messageCount.textContent = `${elements.versionMessage.value.length} / 120`;

  renderChanges(changes);
  renderHistory(history);
  renderSync(overview);
  updateSaveButton();
}

function showScreen(name) {
  elements.loading.classList.toggle("hidden", name !== "loading");
  elements.gitSetup.classList.toggle("hidden", name !== "git");
  elements.welcome.classList.toggle("hidden", name !== "welcome");
  elements.app.classList.toggle("hidden", name !== "app");
}

function gitSetupDetails(platform) {
  if (platform === "darwin") {
    return {
      url: "https://git-scm.com/download/mac",
      tip: "在官方页面按提示操作；也可以在“终端”运行右侧的检测命令，再按照系统弹窗安装。",
    };
  }
  if (platform === "win32") {
    return {
      url: "https://git-scm.com/download/win",
      tip: "下载 Git for Windows 安装程序，安装时保持默认选项即可。",
    };
  }
  if (platform === "linux") {
    return {
      url: "https://git-scm.com/download/linux",
      tip: "安装页面会按照 Ubuntu、Fedora 等系统给出对应命令。",
    };
  }
  return {
    url: "https://git-scm.com/downloads",
    tip: "请选择自己的电脑系统，并按照官方页面提示安装。",
  };
}

function showGitSetup(platform, message = "") {
  state.platform = platform || state.platform;
  const details = gitSetupDetails(state.platform);
  state.gitDownloadUrl = details.url;
  elements.gitInstallTip.textContent = details.tip;
  elements.gitPlatformHelp.textContent = message || "请只从 Git 官方网站下载安装。安装完成后，不需要重启电脑。";
  showScreen("git");
}

async function recheckGit() {
  elements.gitRecheck.disabled = true;
  elements.gitRecheck.textContent = "正在检测…";
  try {
    const result = unwrap(await window.chronodraft.checkGit());
    state.platform = result.platform;
    if (!result.git.installed) {
      showGitSetup(result.platform, "还没有检测到 Git。请完成安装后再点一次“重新检测”。");
      return;
    }
    elements.gitPlatformHelp.textContent = `检测成功：Git ${result.git.version} 已经可以使用。`;
    await loadInitialState();
  } catch (error) {
    handleError(error);
  } finally {
    elements.gitRecheck.disabled = false;
    elements.gitRecheck.textContent = "我已安装，重新检测";
  }
}

function switchView(name) {
  const history = name === "history";
  elements.todayView.classList.toggle("hidden", history);
  elements.historyView.classList.toggle("hidden", !history);
  document.querySelectorAll(".nav-item[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === name);
  });
}

function closeModal() {
  elements.backdrop.classList.add("hidden");
  [elements.setupModal, elements.remoteModal, elements.restoreModal].forEach((modal) => {
    modal.classList.add("hidden");
  });
  state.restoreTarget = null;
}

function openModal(modal) {
  [elements.setupModal, elements.remoteModal, elements.restoreModal].forEach((item) => {
    item.classList.toggle("hidden", item !== modal);
  });
  elements.backdrop.classList.remove("hidden");
}

function openIdentityModal(pendingAction = null) {
  state.pendingAction = pendingAction || state.pendingAction;
  elements.identityName.value = state.overview?.identity?.name || "";
  elements.identityEmail.value = state.overview?.identity?.email || "";
  openModal(elements.setupModal);
  window.setTimeout(() => elements.identityName.focus(), 80);
}

function openRemoteModal() {
  elements.remoteUrl.value = state.overview?.remote?.url || "";
  openModal(elements.remoteModal);
  window.setTimeout(() => elements.remoteUrl.focus(), 80);
}

function openRestoreModal(version) {
  state.restoreTarget = version;
  elements.restoreDescription.textContent = `将文件恢复成“${version.message}”（${formatDate(
    version.date,
    true,
  )}）时的样子。`;
  openModal(elements.restoreModal);
}

async function chooseProject() {
  try {
    const result = unwrap(await window.chronodraft.chooseProject());
    if (result.canceled) return;
    state.messageTouched = false;
    render(result.project);
    showScreen("app");
  } catch (error) {
    handleError(error);
  }
}

async function refresh({ quiet = false, preserveMessage = true } = {}) {
  if (!state.overview || state.busy) return;
  try {
    const overview = unwrap(await window.chronodraft.refresh());
    render(overview, { preserveMessage });
    if (!quiet) showToast("已经刷新", "文件变化和历史版本都是最新的。");
  } catch (error) {
    handleError(error);
  }
}

async function saveVersion() {
  if (elements.saveButton.disabled || state.busy) return;
  if (!state.overview.identity.ready) {
    openIdentityModal(saveVersion);
    return;
  }

  setBusy(true, "正在安全保存…");
  try {
    const result = unwrap(
      await window.chronodraft.saveVersion(elements.versionMessage.value.trim()),
    );
    state.messageTouched = false;
    render(result.overview);
    const type = result.sync.pushed || result.sync.reason === "no-remote" ? "success" : "warning";
    showToast(
      result.sync.pushed ? "新版本已保存并同步" : "新版本已保存在本机",
      result.sync.message,
      type,
      7000,
    );
  } catch (error) {
    handleError(error);
  } finally {
    setBusy(false);
  }
}

async function saveIdentity(event) {
  event.preventDefault();
  try {
    const identity = unwrap(
      await window.chronodraft.setIdentity({
        name: elements.identityName.value,
        email: elements.identityEmail.value,
      }),
    );
    state.overview.identity = identity;
    const pending = state.pendingAction;
    state.pendingAction = null;
    closeModal();
    showToast("作者信息已保存", "以后保存版本时会自动使用。");
    if (pending) await pending();
  } catch (error) {
    handleError(error);
  }
}

async function saveRemote(event) {
  event.preventDefault();
  try {
    const remote = unwrap(await window.chronodraft.setRemote(elements.remoteUrl.value));
    state.overview.remote = remote;
    closeModal();
    renderSync(state.overview);
    showToast("GitHub 仓库已连接", "正在尝试同步已有版本。");
    if (state.overview.history.length > 0) {
      const result = unwrap(await window.chronodraft.sync());
      render(result.overview, { preserveMessage: true });
      showToast(
        result.sync.pushed ? "云端备份完成" : "本地版本仍然安全",
        result.sync.message,
        result.sync.pushed ? "success" : "warning",
        7000,
      );
    }
  } catch (error) {
    handleError(error);
  }
}

async function removeRemote() {
  try {
    const remote = unwrap(await window.chronodraft.removeRemote());
    state.overview.remote = remote;
    closeModal();
    renderSync(state.overview);
    showToast("已断开 GitHub", "本机的文件和历史版本都没有改变。", "warning");
  } catch (error) {
    handleError(error);
  }
}

async function restoreVersion() {
  if (!state.restoreTarget || state.busy) return;
  if (!state.overview.identity.ready) {
    const target = state.restoreTarget;
    closeModal();
    openIdentityModal(() => {
      openRestoreModal(target);
    });
    return;
  }

  const target = state.restoreTarget;
  closeModal();
  setBusy(true);
  try {
    const result = unwrap(await window.chronodraft.restoreVersion(target.hash));
    state.messageTouched = false;
    render(result.overview);
    showToast(result.changed ? "已安全恢复历史版本" : "内容无需恢复", result.message);
    switchView("today");
  } catch (error) {
    handleError(error);
  } finally {
    setBusy(false);
  }
}

function wireEvents() {
  elements.gitDownload.addEventListener("click", () => {
    window.chronodraft.openExternal(state.gitDownloadUrl);
  });
  elements.gitRecheck.addEventListener("click", recheckGit);
  elements.welcomeChoose.addEventListener("click", chooseProject);
  elements.projectSwitcher.addEventListener("click", chooseProject);
  elements.saveButton.addEventListener("click", saveVersion);
  elements.refreshButton.addEventListener("click", () => refresh());
  elements.changesRefresh.addEventListener("click", () => refresh());
  elements.showFolder.addEventListener("click", () => window.chronodraft.showInFolder());
  elements.cloudAction.addEventListener("click", openRemoteModal);
  elements.settingsButton.addEventListener("click", () => {
    if (!state.overview.identity.ready) openIdentityModal();
    else openRemoteModal();
  });
  elements.identityForm.addEventListener("submit", saveIdentity);
  elements.remoteForm.addEventListener("submit", saveRemote);
  elements.removeRemote.addEventListener("click", removeRemote);
  elements.confirmRestore.addEventListener("click", restoreVersion);
  elements.versionMessage.addEventListener("input", () => {
    state.messageTouched = true;
    elements.messageCount.textContent = `${elements.versionMessage.value.length} / 120`;
    updateSaveButton();
  });

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });
  document.querySelectorAll("[data-view-target]").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.viewTarget));
  });
  document.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", closeModal);
  });
  elements.backdrop.addEventListener("click", (event) => {
    if (event.target === elements.backdrop) closeModal();
  });
  document.querySelector("#create-repository-link").addEventListener("click", () => {
    window.chronodraft.openExternal("https://github.com/new");
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.backdrop.classList.contains("hidden")) {
      closeModal();
    }
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      saveVersion();
    }
  });
}

async function loadInitialState() {
  try {
    const result = unwrap(await window.chronodraft.startup());
    state.platform = result.platform;
    if (!result.git.installed) {
      showGitSetup(result.platform);
      return;
    }
    if (result.project) {
      render(result.project);
      showScreen("app");
    } else {
      showScreen("welcome");
    }
  } catch (error) {
    showScreen("welcome");
    handleError(error);
  }
}

wireEvents();
loadInitialState();
