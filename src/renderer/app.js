const state = {
  overview: null,
  platform: "",
  gitDownloadUrl: "https://git-scm.com/downloads",
  pendingAction: null,
  restoreTarget: null,
  versionTarget: null,
  cloudReview: null,
  syncConflict: null,
  githubAuth: null,
  githubLoginSession: null,
  githubRepositories: null,
  githubRepositoriesLoading: false,
  githubRepositoryPreparedFor: "",
  messageTouched: false,
  busy: false,
  refreshing: false,
  refreshTimer: null,
  loadingHistory: false,
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
  ignoredSummary: document.querySelector("#ignored-summary"),
  ignoredCount: document.querySelector("#ignored-count"),
  ignoredList: document.querySelector("#ignored-list"),
  recentHistory: document.querySelector("#recent-history"),
  fullHistory: document.querySelector("#full-history"),
  historyLoadMore: document.querySelector("#history-load-more"),
  historyCount: document.querySelector("#history-count"),
  autoSnapshotSection: document.querySelector("#auto-snapshot-section"),
  autoSnapshotSummary: document.querySelector("#auto-snapshot-summary"),
  autoSnapshotCount: document.querySelector("#auto-snapshot-count"),
  autoSnapshots: document.querySelector("#auto-snapshots"),
  versionMessage: document.querySelector("#version-message"),
  messageCount: document.querySelector("#message-count"),
  saveButton: document.querySelector("#save-button"),
  saveButtonNote: document.querySelector("#save-button-note"),
  autoSnapshotNote: document.querySelector("#auto-snapshot-note"),
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
  githubLoginModal: document.querySelector("#github-login-modal"),
  cloudReviewModal: document.querySelector("#cloud-review-modal"),
  syncConflictModal: document.querySelector("#sync-conflict-modal"),
  versionModal: document.querySelector("#version-modal"),
  restoreModal: document.querySelector("#restore-modal"),
  identityForm: document.querySelector("#identity-form"),
  identityName: document.querySelector("#identity-name"),
  identityEmail: document.querySelector("#identity-email"),
  remoteForm: document.querySelector("#remote-form"),
  remoteUrl: document.querySelector("#remote-url"),
  removeRemote: document.querySelector("#remove-remote"),
  githubAuthCard: document.querySelector("#github-auth-card"),
  githubAuthTitle: document.querySelector("#github-auth-title"),
  githubAuthDescription: document.querySelector("#github-auth-description"),
  githubStorageNote: document.querySelector("#github-storage-note"),
  githubLogin: document.querySelector("#github-login"),
  githubInstall: document.querySelector("#github-install"),
  githubLogout: document.querySelector("#github-logout"),
  githubStepLogin: document.querySelector("#github-step-login"),
  githubStepPrepare: document.querySelector("#github-step-prepare"),
  githubStepAuthorize: document.querySelector("#github-step-authorize"),
  githubStepLoginStatus: document.querySelector("#github-step-login-status"),
  githubStepPrepareStatus: document.querySelector("#github-step-prepare-status"),
  githubStepAuthorizeStatus: document.querySelector("#github-step-authorize-status"),
  githubPreparePanel: document.querySelector("#github-prepare-panel"),
  githubAuthorizePanel: document.querySelector("#github-authorize-panel"),
  githubRepositoryName: document.querySelector("#github-repository-name"),
  githubCreateRepository: document.querySelector("#github-create-repository"),
  githubHaveRepository: document.querySelector("#github-have-repository"),
  githubRepositoryHeading: document.querySelector("#github-repository-heading"),
  githubRepositoryStatus: document.querySelector("#github-repository-status"),
  githubRepositoryRefresh: document.querySelector("#github-repository-refresh"),
  githubBackPrepare: document.querySelector("#github-back-prepare"),
  githubRepositoryList: document.querySelector("#github-repository-list"),
  githubRepositoryEmpty: document.querySelector("#github-repository-empty"),
  githubConfigureInstallation: document.querySelector("#github-configure-installation"),
  githubAdvanced: document.querySelector("#github-advanced"),
  githubGuideStep: document.querySelector("#github-guide-step"),
  githubGuideTitle: document.querySelector("#github-guide-title"),
  githubGuideDescription: document.querySelector("#github-guide-description"),
  githubGuideEnglish: document.querySelector("#github-guide-english"),
  githubGuideField: document.querySelector("#github-guide-field"),
  githubGuideButton: document.querySelector("#github-guide-button"),
  githubGuideCallout: document.querySelector("#github-guide-callout"),
  githubGuideTranslation: document.querySelector("#github-guide-translation"),
  githubDeviceCode: document.querySelector("#github-device-code"),
  githubLoginStatus: document.querySelector("#github-login-status"),
  githubReopenLogin: document.querySelector("#github-reopen-login"),
  cloudReviewTitle: document.querySelector("#cloud-review-title"),
  cloudReviewDescription: document.querySelector("#cloud-review-description"),
  cloudReviewVersions: document.querySelector("#cloud-review-versions"),
  cloudReviewFiles: document.querySelector("#cloud-review-files"),
  cloudReviewList: document.querySelector("#cloud-review-list"),
  cloudReviewConfirmRow: document.querySelector("#cloud-review-confirm-row"),
  cloudReviewCheck: document.querySelector("#cloud-review-check"),
  cloudReviewConfirm: document.querySelector("#cloud-review-confirm"),
  conflictLocalTitle: document.querySelector("#conflict-local-title"),
  conflictLocalMeta: document.querySelector("#conflict-local-meta"),
  conflictRemoteTitle: document.querySelector("#conflict-remote-title"),
  conflictRemoteMeta: document.querySelector("#conflict-remote-meta"),
  conflictFileCount: document.querySelector("#conflict-file-count"),
  conflictFiles: document.querySelector("#conflict-files"),
  conflictConfirmCheck: document.querySelector("#conflict-confirm-check"),
  conflictShowFolder: document.querySelector("#conflict-show-folder"),
  conflictResolve: document.querySelector("#conflict-resolve"),
  versionDetailTitle: document.querySelector("#version-detail-title"),
  versionDetailMeta: document.querySelector("#version-detail-meta"),
  versionFileCount: document.querySelector("#version-file-count"),
  versionFiles: document.querySelector("#version-files"),
  versionDiffTitle: document.querySelector("#version-diff-title"),
  versionDiff: document.querySelector("#version-diff"),
  versionRestore: document.querySelector("#version-restore"),
  versionMilestone: document.querySelector("#version-milestone"),
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
    copied: "复制",
    conflict: "待确认",
  }[type] || "变化";
}

function typeIcon(type) {
  return {
    added: "+",
    modified: "M",
    deleted: "−",
    renamed: "→",
    copied: "↗",
    conflict: "!",
  }[type] || "•";
}

function suggestMessage(changes) {
  const compactName = (filePath, maxLength = 28) => {
    const name = basename(filePath) || "文件";
    if (name.length <= maxLength) return name;
    const dot = name.lastIndexOf(".");
    const extension = dot > 0 ? name.slice(dot) : "";
    const available = Math.max(maxLength - extension.length - 1, 8);
    return `${name.slice(0, available)}…${extension}`;
  };
  const describe = (change) => {
    const current = `《${compactName(change.path)}》`;
    if (change.type === "added") return `新增${current}`;
    if (change.type === "deleted") return `移除${current}`;
    if (change.type === "renamed") {
      return `将《${compactName(change.originalPath)}》改名为${current}`;
    }
    if (change.type === "copied") return `复制${current}`;
    return `更新${current}`;
  };
  if (!changes.length) return "保存当前写作进度";
  const featured = changes.slice(0, 2).map(describe).join("，");
  const remainder = changes.length > 2 ? `等 ${changes.length} 个文件` : "";
  return `${featured}${remainder}`.slice(0, 120);
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

function renderIgnored(ignored) {
  elements.ignoredSummary.classList.toggle("hidden", ignored.length === 0);
  elements.ignoredCount.textContent = `${ignored.length} 个路径未纳入版本`;
  elements.ignoredList.replaceChildren();

  ignored.slice(0, 6).forEach((entry) => {
    const item = document.createElement("li");
    item.textContent = entry.path;
    item.title = entry.path;
    elements.ignoredList.append(item);
  });
  if (ignored.length > 6) {
    const remaining = document.createElement("li");
    remaining.textContent = `另外还有 ${ignored.length - 6} 个路径`;
    elements.ignoredList.append(remaining);
  }
}

function makeTimelineItem(version, allowRestore, { snapshot = false } = {}) {
  const item = document.createElement("article");
  item.className = `timeline-item${version.milestone ? " is-milestone" : ""}${
    snapshot ? " is-snapshot" : ""
  }`;

  const dot = document.createElement("span");
  dot.className = "timeline-dot";

  const copy = document.createElement("div");
  copy.className = "timeline-copy";
  const titleRow = document.createElement("div");
  titleRow.className = "timeline-title-row";
  const title = document.createElement("strong");
  title.textContent = version.message;
  titleRow.append(title);
  if (version.milestone) {
    const badge = document.createElement("span");
    badge.className = "milestone-badge";
    badge.textContent = "★ 里程碑";
    titleRow.append(badge);
  }
  const meta = document.createElement("p");
  meta.textContent = snapshot
    ? `${formatDate(version.date, true)} · 仅保存在本机 · ${version.shortHash}`
    : `${formatDate(version.date, allowRestore)} · ${version.author} · ${version.shortHash}`;
  copy.append(titleRow, meta);

  item.append(dot, copy);
  if (allowRestore) {
    const actions = document.createElement("div");
    actions.className = "timeline-actions";
    const viewDetails = document.createElement("button");
    viewDetails.className = "restore-button";
    viewDetails.type = "button";
    viewDetails.textContent = "查看改动";
    viewDetails.addEventListener("click", () => openVersionModal(version));
    const restore = document.createElement("button");
    restore.className = "restore-button";
    restore.type = "button";
    restore.textContent = snapshot ? "恢复此快照" : "恢复此版本";
    restore.addEventListener("click", () => openRestoreModal(version));
    actions.append(viewDetails, restore);
    if (!snapshot) {
      const milestone = document.createElement("button");
      milestone.className = `restore-button milestone-button${
        version.milestone ? " is-active" : ""
      }`;
      milestone.type = "button";
      milestone.textContent = version.milestone ? "★ 里程碑" : "☆ 设为里程碑";
      milestone.title = version.milestone ? "取消里程碑" : "把这个正式版本标为里程碑";
      milestone.addEventListener("click", () => toggleMilestone(version));
      actions.prepend(milestone);
    }
    item.append(actions);
  }
  return item;
}

function renderAutoSnapshots(snapshots = []) {
  elements.autoSnapshots.replaceChildren();
  elements.autoSnapshotCount.textContent = `${snapshots.length} 个`;
  if (snapshots.length === 0) {
    elements.autoSnapshotSummary.textContent = "等待第一次自动保护";
    elements.autoSnapshotNote.textContent = "有改动时每 10 分钟在本机保护一次";
    const empty = document.createElement("p");
    empty.className = "snapshot-empty";
    empty.textContent = "继续写作即可；检测到改动后，ChronoDraft 会在后台创建快照。";
    elements.autoSnapshots.append(empty);
    return;
  }

  const latest = snapshots[0];
  const latestLabel = formatDate(latest.date, true);
  elements.autoSnapshotSummary.textContent = `最近一次：${latestLabel}`;
  elements.autoSnapshotNote.textContent = `最近自动保护：${latestLabel}，仅保存在本机`;
  snapshots.forEach((snapshot) => {
    elements.autoSnapshots.append(makeTimelineItem(snapshot, true, { snapshot: true }));
  });
}

function renderHistory(history, total = history.length) {
  elements.recentHistory.replaceChildren();
  elements.fullHistory.replaceChildren();
  elements.historyLoadMore.classList.toggle("hidden", history.length >= total);

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
  elements.syncBadge.disabled = !remote.configured || overview.history.length === 0;

  if (!remote.configured) {
    elements.cloudTitle.textContent = "仅保存在本机";
    elements.cloudDescription.textContent = "连接 GitHub，多一份云端备份";
    elements.cloudAction.textContent = "连接";
    elements.syncBadge.querySelector("span").textContent = "本地安全";
    elements.syncBadge.title = "连接 GitHub 后可以同步";
    elements.saveButtonNote.textContent = "先保存在本机，连接 GitHub 后可同步";
    return;
  }

  elements.cloudTitle.textContent = "已连接 GitHub";
  elements.cloudDescription.textContent = remote.displayUrl.replace("https://github.com/", "");
  elements.cloudAction.textContent = "设置";
  elements.remoteUrl.value = remote.url;
  elements.saveButtonNote.textContent = "保存后自动同步到 GitHub";
  elements.syncBadge.title = "立即检查并同步";

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
  const ignored = overview.ignored || [];
  const history = overview.history || [];
  const snapshots = overview.snapshots || [];
  const historyTotal = overview.historyTotal ?? history.length;

  elements.projectName.textContent = overview.projectName;
  elements.projectPath.textContent = overview.projectPath;
  elements.projectInitial.textContent = overview.projectName.slice(0, 1).toUpperCase();
  elements.greeting.textContent = hourGreeting();
  elements.historyCount.textContent = String(historyTotal);
  elements.changeCount.textContent = `${changes.length} 个文件`;

  if (changes.length === 0 && ignored.length > 0) {
    elements.changeSummary.textContent = `没有可保存的新修改；另有 ${ignored.length} 个路径未纳入版本。`;
  } else if (changes.length === 0) {
    elements.changeSummary.textContent = "所有修改都已经妥善保存。";
  } else if (changes.some((change) => change.type === "conflict")) {
    elements.changeSummary.textContent = "有文件需要先确认，ChronoDraft 不会自动覆盖它们。";
  } else {
    elements.changeSummary.textContent = `发现 ${changes.length} 个文件有变化${
      ignored.length > 0 ? `，另有 ${ignored.length} 个路径未纳入版本` : ""
    }，准备好就保存一个新版本。`;
  }

  if (!preserveMessage && !state.messageTouched) {
    elements.versionMessage.value = changes.length ? suggestMessage(changes) : "";
  }
  elements.messageCount.textContent = `${elements.versionMessage.value.length} / 120`;

  renderChanges(changes);
  renderIgnored(ignored);
  renderAutoSnapshots(snapshots);
  renderHistory(history, historyTotal);
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
  if (state.githubLoginSession) {
    state.githubLoginSession = null;
    window.chronodraft.cancelGitHubLogin();
  }
  elements.backdrop.classList.add("hidden");
  [
    elements.setupModal,
    elements.remoteModal,
    elements.githubLoginModal,
    elements.cloudReviewModal,
    elements.syncConflictModal,
    elements.versionModal,
    elements.restoreModal,
  ].forEach((modal) => {
    modal.classList.add("hidden");
  });
  state.restoreTarget = null;
  state.versionTarget = null;
  state.cloudReview = null;
  state.syncConflict = null;
}

function openModal(modal) {
  [
    elements.setupModal,
    elements.remoteModal,
    elements.githubLoginModal,
    elements.cloudReviewModal,
    elements.syncConflictModal,
    elements.versionModal,
    elements.restoreModal,
  ].forEach((item) => {
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

function normalizedRemoteUrl(url) {
  return String(url || "")
    .replace(/\.git$/i, "")
    .replace(/\/$/, "")
    .toLowerCase();
}

function suggestedGitHubRepositoryName() {
  const projectName = String(state.overview?.projectName || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const meaningfulName = projectName && projectName !== "chronodraft";
  return `${meaningfulName ? `chronodraft-${projectName}` : "chronodraft-writing"}-backup`;
}

function githubRepositoryPrepared() {
  return Boolean(
    state.overview?.projectPath &&
      state.githubRepositoryPreparedFor === state.overview.projectPath,
  );
}

function setGitHubStep(element, statusElement, { active = false, complete = false, label }) {
  element.classList.toggle("is-active", active);
  element.classList.toggle("is-complete", complete);
  statusElement.textContent = label;
}

function setGitHubGuide(stage) {
  const appName = state.githubAuth?.appSlug || "ChronoDraft";
  const guides = {
    login: {
      step: "第 1 步参考",
      title: "GitHub 页面会要求输入验证码",
      description: "不用把 GitHub 密码交给 ChronoDraft；只需输入应用显示的八位验证码。",
      english: "Device activation",
      field: "XXXX-XXXX",
      button: "Continue",
      callout: "把应用里的验证码填在这里",
      translation: "Continue = 继续",
    },
    prepare: {
      step: "第 2 步参考",
      title: "新建一个私有备份仓库",
      description: "名称与私有选项会预先填写。不要勾选 README、.gitignore 或 License。",
      english: "Create a new repository",
      field: "Repository name",
      button: "Create repository",
      callout: "确认显示 Private，再点绿色按钮",
      translation: "Private = 私有；Create repository = 创建仓库",
    },
    authorize: {
      step: "第 3 步参考",
      title: "只授权刚准备好的写作仓库",
      description: "在安装页选择自己的账号，再选择刚创建的仓库，最后确认安装。",
      english: `Install ${appName}`,
      field: "Only select repositories",
      button: "Install",
      callout: "选中写作仓库后点 Install",
      translation: "Only select repositories = 只选择指定仓库",
    },
    connected: {
      step: "设置完成",
      title: "云端备份已经开启",
      description: "以后保存正式版本时，ChronoDraft 会自动同步；本地版本始终保留。",
      english: "Private repository",
      field: "ChronoDraft backup",
      button: "Connected ✓",
      callout: "不需要再复制仓库地址",
      translation: "Connected = 已连接",
    },
  };
  const guide = guides[stage] || guides.login;
  elements.githubGuideStep.textContent = guide.step;
  elements.githubGuideTitle.textContent = guide.title;
  elements.githubGuideDescription.textContent = guide.description;
  elements.githubGuideEnglish.textContent = guide.english;
  elements.githubGuideField.textContent = guide.field;
  elements.githubGuideButton.textContent = guide.button;
  elements.githubGuideCallout.textContent = guide.callout;
  elements.githubGuideTranslation.textContent = guide.translation;
}

function renderGitHubRepositoryCards(repositories) {
  elements.githubRepositoryList.replaceChildren();
  const currentUrl = normalizedRemoteUrl(state.overview?.remote?.url);
  repositories.forEach((repository) => {
    const card = document.createElement("article");
    card.className = "github-repository-card";
    const connected = currentUrl === normalizedRemoteUrl(repository.url);
    card.classList.toggle("is-connected", connected);

    const details = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = repository.fullName;
    const meta = document.createElement("small");
    meta.textContent = repository.private ? "私有仓库 · 仅你和授权成员可见" : "公开仓库";
    details.append(title, meta);

    const button = document.createElement("button");
    button.type = "button";
    button.className = connected ? "button button--secondary" : "button button--primary";
    button.textContent = connected ? "已连接" : "用它备份";
    button.disabled = connected;
    if (!connected) button.addEventListener("click", () => connectRemote(repository.url));
    card.append(details, button);
    elements.githubRepositoryList.append(card);
  });
}

function renderGitHubWizard() {
  const authenticated = Boolean(state.githubAuth?.authenticated);
  const remoteConfigured = Boolean(state.overview?.remote?.configured);
  const remoteUrl = String(state.overview?.remote?.url || "");
  const appManagedRemote = /^https:\/\/github\.com\//i.test(remoteUrl);
  const installed = Boolean(state.githubRepositories?.installed);
  const repositories = state.githubRepositories?.repositories || [];
  const remoteAuthorized = repositories.some(
    (repository) => normalizedRemoteUrl(repository.url) === normalizedRemoteUrl(remoteUrl),
  );
  const connected = remoteConfigured && (!appManagedRemote || remoteAuthorized);
  const prepared = githubRepositoryPrepared() || installed || remoteConfigured;
  let stage = "login";
  if (authenticated) stage = prepared ? "authorize" : "prepare";
  if (connected) stage = "connected";

  setGitHubStep(elements.githubStepLogin, elements.githubStepLoginStatus, {
    active: stage === "login",
    complete: authenticated,
    label: authenticated ? "已完成" : "当前步骤",
  });
  setGitHubStep(elements.githubStepPrepare, elements.githubStepPrepareStatus, {
    active: stage === "prepare",
    complete: prepared,
    label: prepared ? "已完成" : stage === "prepare" ? "当前步骤" : "未开始",
  });
  setGitHubStep(elements.githubStepAuthorize, elements.githubStepAuthorizeStatus, {
    active: stage === "authorize",
    complete: connected,
    label: connected ? "已完成" : stage === "authorize" ? "当前步骤" : "未开始",
  });

  elements.githubPreparePanel.classList.toggle("hidden", stage !== "prepare");
  elements.githubAuthorizePanel.classList.toggle(
    "hidden",
    stage !== "authorize" && stage !== "connected",
  );
  elements.githubRepositoryName.textContent = suggestedGitHubRepositoryName();

  if (state.githubRepositoriesLoading) {
    elements.githubRepositoryHeading.textContent = "正在查找已授权仓库…";
    elements.githubRepositoryStatus.textContent = "从浏览器返回后会自动刷新，请稍候。";
  } else if (remoteConfigured && appManagedRemote && !remoteAuthorized) {
    elements.githubRepositoryHeading.textContent = "仓库地址已准备好，还差授权";
    elements.githubRepositoryStatus.textContent = installed
      ? "当前仓库不在授权范围内；请调整授权范围，或从下方改选一个仓库。"
      : "ChronoDraft 还没有获得这个仓库的访问权限，请在 GitHub 中明确授权。";
  } else if (repositories.length > 0) {
    elements.githubRepositoryHeading.textContent = connected
      ? "云端备份已连接"
      : "选择一个仓库，直接开启备份";
    elements.githubRepositoryStatus.textContent = `已找到 ${repositories.length} 个可用仓库，无需复制地址。`;
  } else if (installed) {
    elements.githubRepositoryHeading.textContent = "还差选择一个可写仓库";
    elements.githubRepositoryStatus.textContent = "ChronoDraft 已安装，但当前授权范围里没有可写仓库。";
  } else {
    elements.githubRepositoryHeading.textContent = "授权 ChronoDraft 访问备份仓库";
    elements.githubRepositoryStatus.textContent = "在 GitHub 中选择刚准备好的仓库，返回后这里会自动出现。";
  }

  elements.githubInstall.textContent = installed ? "调整授权范围 ↗" : "选择授权仓库 ↗";
  elements.githubInstall.disabled = !authenticated || !state.githubAuth?.installUrl;
  elements.githubRepositoryRefresh.disabled = !authenticated || state.githubRepositoriesLoading;
  elements.githubRepositoryRefresh.textContent = state.githubRepositoriesLoading
    ? "正在刷新…"
    : "我已完成，刷新";
  elements.githubBackPrepare.classList.toggle(
    "hidden",
    remoteConfigured || installed || repositories.length > 0,
  );
  elements.githubRepositoryEmpty.classList.toggle(
    "hidden",
    state.githubRepositoriesLoading || !installed || repositories.length > 0,
  );
  elements.githubConfigureInstallation.classList.toggle(
    "hidden",
    !state.githubRepositories?.configureUrl,
  );
  renderGitHubRepositoryCards(repositories);
  setGitHubGuide(stage);
}

function renderGitHubAuth(auth) {
  state.githubAuth = auth;
  const configured = Boolean(auth?.configured);
  const storageAvailable = Boolean(auth?.storage?.available);
  const authenticated = Boolean(auth?.authenticated);
  elements.githubAuthCard.classList.toggle("is-authenticated", authenticated);
  elements.githubLogin.classList.toggle("hidden", authenticated);
  elements.githubLogout.classList.toggle("hidden", !authenticated);

  if (authenticated) {
    elements.githubAuthTitle.textContent = `已登录 ${auth.login || "GitHub"}`;
    elements.githubAuthDescription.textContent = state.overview?.remote?.url?.startsWith("git@")
      ? "当前仓库使用 SSH；浏览器登录会在改用 HTTPS 仓库地址后生效。"
      : "现在可以连接并同步已授权给 ChronoDraft 的仓库。";
  } else if (!configured) {
    elements.githubAuthTitle.textContent = "还差 GitHub App 注册信息";
    elements.githubAuthDescription.textContent =
      "登录流程已经就绪；开发者填入公开 Client ID 和 App 名称后即可启用。";
  } else if (!storageAvailable) {
    elements.githubAuthTitle.textContent = "系统安全密钥库不可用";
    elements.githubAuthDescription.textContent = auth.storage?.reason || "ChronoDraft 不会降级为明文保存登录。";
  } else {
    elements.githubAuthTitle.textContent = "尚未登录 GitHub";
    elements.githubAuthDescription.textContent = "浏览器确认后，只能访问你明确授权给 ChronoDraft 的仓库。";
  }

  elements.githubLogin.disabled = !configured || !storageAvailable;
  elements.githubLogin.textContent = configured ? "用浏览器登录" : "等待应用注册";
  const backendLabels = {
    keychain: "macOS Keychain",
    dpapi: "Windows DPAPI",
    gnome_libsecret: "GNOME Keyring",
    kwallet: "KWallet",
    kwallet5: "KWallet 5",
    kwallet6: "KWallet 6",
  };
  const backend = backendLabels[auth?.storage?.backend] || "系统安全密钥库";
  elements.githubStorageNote.lastChild.textContent = storageAvailable
    ? ` 登录令牌由 ${backend} 加密；项目文件和界面都不会收到令牌`
    : ` ${auth?.storage?.reason || "没有可用的安全凭据存储"}`;
  if (!authenticated) state.githubRepositories = null;
  renderGitHubWizard();
}

async function refreshGitHubAuth({ quiet = false } = {}) {
  try {
    const auth = unwrap(await window.chronodraft.getGitHubAuthState());
    renderGitHubAuth(auth);
    return auth;
  } catch (error) {
    if (!quiet) handleError(error);
    return null;
  }
}

async function refreshGitHubRepositories({ quiet = false } = {}) {
  if (!state.githubAuth?.authenticated || state.githubRepositoriesLoading) return null;
  state.githubRepositoriesLoading = true;
  renderGitHubWizard();
  try {
    const repositories = unwrap(await window.chronodraft.listGitHubRepositories());
    state.githubRepositories = repositories;
    if (repositories.installed && state.overview?.projectPath) {
      state.githubRepositoryPreparedFor = state.overview.projectPath;
    }
    return repositories;
  } catch (error) {
    if (!quiet) handleError(error);
    return null;
  } finally {
    state.githubRepositoriesLoading = false;
    renderGitHubWizard();
  }
}

async function openRemoteModal() {
  elements.remoteUrl.value = state.overview?.remote?.url || "";
  elements.githubAdvanced.open = Boolean(state.overview?.remote?.url?.startsWith("git@"));
  openModal(elements.remoteModal);
  const auth = await refreshGitHubAuth();
  if (auth?.authenticated) await refreshGitHubRepositories({ quiet: true });
}

async function startGitHubLogin() {
  if (state.githubLoginSession) return;
  let sessionId = "";
  elements.githubLogin.disabled = true;
  elements.githubLogin.textContent = "正在打开浏览器…";
  try {
    const login = unwrap(await window.chronodraft.startGitHubLogin());
    sessionId = login.sessionId;
    state.githubLoginSession = login.sessionId;
    elements.githubDeviceCode.textContent = login.userCode;
    elements.githubLoginStatus.textContent = "正在等待你在浏览器中确认…";
    openModal(elements.githubLoginModal);
    const auth = unwrap(await window.chronodraft.completeGitHubLogin(login.sessionId));
    if (state.githubLoginSession !== login.sessionId) return;
    state.githubLoginSession = null;
    renderGitHubAuth(auth);
    closeModal();
    await openRemoteModal();
    showToast(
      "GitHub 登录成功",
      "继续第 2 步；ChronoDraft 会帮你填写私有仓库信息。",
      "success",
      7000,
    );
  } catch (error) {
    const cancelled =
      error.code === "GITHUB_LOGIN_CANCELLED" ||
      (sessionId && state.githubLoginSession !== sessionId);
    state.githubLoginSession = null;
    if (!cancelled) {
      if (sessionId) {
        closeModal();
        await openRemoteModal();
      }
      handleError(error);
    }
  } finally {
    elements.githubLogin.textContent = state.githubAuth?.configured
      ? "用浏览器登录"
      : "等待应用注册";
    elements.githubLogin.disabled =
      !state.githubAuth?.configured || !state.githubAuth?.storage?.available;
  }
}

async function logoutGitHub() {
  try {
    const auth = unwrap(await window.chronodraft.logoutGitHub());
    state.githubRepositories = null;
    state.githubRepositoryPreparedFor = "";
    renderGitHubAuth(auth);
    showToast(
      "已退出这台设备",
      "本机加密凭据已经清除；GitHub 上的授权可在账户设置中随时撤销。",
      "warning",
      7000,
    );
  } catch (error) {
    handleError(error);
  }
}

function openCloudReview(sync) {
  const preflight = sync?.preflight;
  if (!preflight) return false;
  const blockers = preflight.blockers || [];
  const warnings = preflight.warnings || [];
  if (blockers.length === 0 && warnings.length === 0) return false;

  const blocked = blockers.length > 0;
  state.cloudReview = { preflight, blocked };
  elements.cloudReviewTitle.textContent = blocked
    ? "有文件暂时无法上传"
    : "请先确认这些内容";
  elements.cloudReviewDescription.textContent = blocked
    ? "本地版本仍然安全。GitHub 不接收超过 100 MB 的单个文件，需要先从版本历史中移除后再同步。"
    : "本地版本已经保存。ChronoDraft 不会显示检测到的密钥内容，只列出需要你亲自检查的文件路径。";
  elements.cloudReviewVersions.textContent = String(preflight.versions || 0);
  elements.cloudReviewFiles.textContent = String(preflight.files || 0);
  elements.cloudReviewList.replaceChildren();

  [...blockers, ...warnings].slice(0, 20).forEach((issue) => {
    const item = document.createElement("article");
    item.className = `cloud-review-item${issue.severity === "block" ? " is-blocked" : ""}`;
    const icon = document.createElement("span");
    icon.textContent = issue.severity === "block" ? "!" : "◇";
    const copy = document.createElement("div");
    const file = document.createElement("strong");
    file.textContent = issue.path;
    file.title = issue.path;
    const message = document.createElement("p");
    message.textContent = `${issue.message}${issue.size ? `（${formatBytes(issue.size)}）` : ""}`;
    copy.append(file, message);
    item.append(icon, copy);
    elements.cloudReviewList.append(item);
  });
  if (blockers.length + warnings.length > 20) {
    const remaining = document.createElement("p");
    remaining.className = "cloud-review-remaining";
    remaining.textContent = `另外还有 ${blockers.length + warnings.length - 20} 项，请先整理项目内容。`;
    elements.cloudReviewList.append(remaining);
  }

  elements.cloudReviewCheck.checked = false;
  elements.cloudReviewConfirmRow.classList.toggle("hidden", blocked);
  elements.cloudReviewConfirm.disabled = true;
  elements.cloudReviewConfirm.textContent = blocked ? "处理后再上传" : "确认并上传";
  openModal(elements.cloudReviewModal);
  return true;
}

function openSyncConflict(sync) {
  const conflict = sync?.conflict;
  if (sync?.reason !== "SYNC_CONFLICT" || !conflict) return false;
  state.syncConflict = conflict;
  const local = conflict.local || {};
  const remote = conflict.remote || {};
  elements.conflictLocalTitle.textContent = local.message || "本机保存的版本";
  elements.conflictLocalMeta.textContent = `${local.author || "本机作者"} · ${
    local.date ? formatDate(local.date, true) : local.shortHash || "—"
  }`;
  elements.conflictRemoteTitle.textContent = remote.message || "云端保存的版本";
  elements.conflictRemoteMeta.textContent = `${remote.author || "云端作者"} · ${
    remote.date ? formatDate(remote.date, true) : remote.shortHash || "—"
  }`;

  const files = conflict.files || [];
  elements.conflictFileCount.textContent = `${files.length} 个`;
  elements.conflictFiles.replaceChildren();
  files.forEach((file) => {
    const item = document.createElement("article");
    const icon = document.createElement("span");
    icon.textContent = "⇄";
    const copy = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = file.path;
    name.title = file.path;
    const description = document.createElement("p");
    if (file.localExists && file.remoteExists) {
      description.textContent = `两边都有不同内容 · 本机 ${formatBytes(
        file.localSize,
      )} / 云端 ${formatBytes(file.remoteSize)}`;
    } else if (file.localExists) {
      description.textContent = "本机保留了这个文件，云端版本中已删除";
    } else {
      description.textContent = "云端保留了这个文件，本机版本中已删除";
    }
    copy.append(name, description);
    item.append(icon, copy);
    elements.conflictFiles.append(item);
  });
  elements.conflictConfirmCheck.checked = false;
  elements.conflictResolve.disabled = true;
  elements.conflictResolve.textContent = "两份都保留并继续";
  openModal(elements.syncConflictModal);
  return true;
}

function openRestoreModal(version) {
  state.restoreTarget = version;
  const kind = version.snapshot ? "自动安全快照" : "正式版本";
  elements.restoreDescription.textContent = `将文件恢复成${kind}“${version.message}”（${formatDate(
    version.date,
    true,
  )}）时的样子。`;
  openModal(elements.restoreModal);
}

function updateVersionMilestoneButton(version) {
  const isSnapshot = Boolean(version?.snapshot);
  elements.versionMilestone.classList.toggle("hidden", isSnapshot);
  elements.versionMilestone.textContent = version?.milestone ? "★ 取消里程碑" : "☆ 设为里程碑";
}

function formatBytes(value) {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function showVersionDiffMessage(message) {
  elements.versionDiff.className = "version-diff version-diff--empty";
  elements.versionDiff.textContent = message;
}

function renderTextPatch(patch) {
  elements.versionDiff.className = "version-diff";
  elements.versionDiff.replaceChildren();
  const lines = String(patch || "").split("\n");
  const visibleLines = lines.filter(
    (line) =>
      !line.startsWith("diff --git ") &&
      !line.startsWith("index ") &&
      !line.startsWith("--- ") &&
      !line.startsWith("+++ ") &&
      !line.startsWith("\\ No newline"),
  );

  visibleLines.slice(0, 1500).forEach((line) => {
    const row = document.createElement("div");
    row.className = "diff-line";
    const label = document.createElement("span");
    const content = document.createElement("code");

    if (line.startsWith("@@")) {
      row.classList.add("hunk");
      label.textContent = "段落";
      content.textContent = "附近内容";
    } else if (line.startsWith("+")) {
      row.classList.add("added");
      label.textContent = "新增";
      content.textContent = line.slice(1) || " ";
    } else if (line.startsWith("-")) {
      row.classList.add("deleted");
      label.textContent = "删除";
      content.textContent = line.slice(1) || " ";
    } else {
      label.textContent = "";
      content.textContent = line.startsWith(" ") ? line.slice(1) : line;
    }
    row.append(label, content);
    elements.versionDiff.append(row);
  });

  if (visibleLines.length > 1500) {
    const notice = document.createElement("p");
    notice.className = "diff-truncated";
    notice.textContent = `差异较多，界面已显示前 1500 行；还有 ${visibleLines.length - 1500} 行未展开。`;
    elements.versionDiff.append(notice);
  }
}

async function loadVersionDiff(version, file) {
  if (!state.versionTarget || state.versionTarget.hash !== version.hash) return;
  elements.versionFiles.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", button.dataset.path === file.path);
  });
  elements.versionDiffTitle.textContent = basename(file.path);
  showVersionDiffMessage("正在读取内容差异…");

  try {
    const result = unwrap(await window.chronodraft.getVersionDiff(version.hash, file.path));
    if (!state.versionTarget || state.versionTarget.hash !== version.hash) return;
    if (result.kind === "large") {
      showVersionDiffMessage(
        `这个文件约 ${formatBytes(result.size)}，为保持界面流畅暂不展开内容。文件本身已经完整保存在版本中。`,
      );
    } else if (result.kind === "binary") {
      showVersionDiffMessage(
        "这是图片、Word 或其他二进制文件，当前可以完整保存和恢复，但暂时不能直接显示文字差异。",
      );
    } else if (result.kind === "metadata") {
      showVersionDiffMessage(
        result.file.type === "renamed"
          ? `文件从“${result.file.originalPath}”重命名为“${result.file.path}”，内容没有改变。`
          : "这个文件的记录发生了变化，但没有可显示的文字差异。",
      );
    } else {
      renderTextPatch(result.patch);
    }
  } catch (error) {
    showVersionDiffMessage(error.message || "暂时无法读取这个文件的差异。");
  }
}

function renderVersionFiles(details, { loadFirst = true } = {}) {
  elements.versionFiles.replaceChildren();
  elements.versionFileCount.textContent = String(details.files.length);
  if (details.files.length === 0) {
    showVersionDiffMessage("这个版本没有可显示的文件变化。");
    return;
  }

  details.files.forEach((file) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.path = file.path;
    button.className = "version-file-button";
    const icon = document.createElement("span");
    icon.textContent = typeIcon(file.type);
    const copy = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = basename(file.path);
    name.title = file.path;
    const folder = document.createElement("small");
    folder.textContent = dirname(file.path);
    copy.append(name, folder);
    const label = document.createElement("em");
    label.textContent = typeLabel(file.type);
    button.append(icon, copy, label);
    button.addEventListener("click", () => loadVersionDiff(details.version, file));
    elements.versionFiles.append(button);
  });

  if (loadFirst) loadVersionDiff(details.version, details.files[0]);
}

async function openVersionModal(version) {
  state.versionTarget = version;
  elements.versionDetailTitle.textContent = version.message;
  elements.versionDetailMeta.textContent = `${formatDate(version.date, true)} · ${version.author}`;
  elements.versionFileCount.textContent = "…";
  elements.versionFiles.replaceChildren();
  elements.versionDiffTitle.textContent = "内容对比";
  updateVersionMilestoneButton(version);
  showVersionDiffMessage("正在读取版本详情…");
  openModal(elements.versionModal);

  try {
    const details = unwrap(await window.chronodraft.getVersionDetails(version.hash));
    if (!state.versionTarget || state.versionTarget.hash !== version.hash) return;
    details.version.snapshot = Boolean(version.snapshot);
    state.versionTarget = details.version;
    updateVersionMilestoneButton(state.versionTarget);
    renderVersionFiles(details);
  } catch (error) {
    showVersionDiffMessage(error.message || "暂时无法读取这个版本。");
    handleError(error);
  }
}

async function toggleMilestone(version) {
  if (!version || version.snapshot || state.busy) return;
  setBusy(true);
  try {
    const result = unwrap(await window.chronodraft.toggleMilestone(version.hash));
    state.overview.history = (state.overview.history || []).map((item) =>
      item.hash === version.hash ? { ...item, milestone: result.milestone } : item,
    );
    renderHistory(state.overview.history, state.overview.historyTotal);
    if (state.versionTarget?.hash === version.hash) {
      state.versionTarget = { ...state.versionTarget, milestone: result.milestone };
      updateVersionMilestoneButton(state.versionTarget);
    }
    showToast(
      result.milestone ? "已设为里程碑" : "已取消里程碑",
      result.milestone
        ? "这个重要版本会在时间线中醒目标出。"
        : "版本内容和历史记录都没有改变。",
    );
  } catch (error) {
    handleError(error);
  } finally {
    setBusy(false);
  }
}

async function chooseProject() {
  if (state.busy) return;
  setBusy(true);
  try {
    const result = unwrap(await window.chronodraft.chooseProject());
    if (result.canceled) return;
    state.messageTouched = false;
    render(result.project);
    showScreen("app");
  } catch (error) {
    handleError(error);
  } finally {
    setBusy(false);
  }
}

async function refresh({ quiet = false, preserveMessage = state.messageTouched } = {}) {
  if (!state.overview || state.busy || state.refreshing) return;
  state.refreshing = true;
  try {
    const overview = unwrap(await window.chronodraft.refresh());
    render(overview, { preserveMessage });
    if (!quiet) showToast("已经刷新", "文件变化和历史版本都是最新的。");
  } catch (error) {
    handleError(error);
  } finally {
    state.refreshing = false;
  }
}

function scheduleAutoRefresh() {
  if (!state.overview || state.busy || document.hidden) return;
  window.clearTimeout(state.refreshTimer);
  state.refreshTimer = window.setTimeout(() => {
    refresh({ quiet: true });
  }, 250);
}

async function retrySync() {
  if (
    state.busy ||
    !state.overview?.remote?.configured ||
    state.overview.history.length === 0
  ) {
    return;
  }

  setBusy(true);
  try {
    const result = unwrap(await window.chronodraft.sync());
    render(result.overview, { preserveMessage: true });
    if (openCloudReview(result.sync)) {
      showToast("本地版本仍然安全", result.sync.message, "warning", 7000);
      return;
    }
    if (openSyncConflict(result.sync)) {
      showToast("同步已安全暂停", result.sync.message, "warning", 7000);
      return;
    }
    showToast(
      result.sync.pushed ? "云端备份完成" : "本地版本仍然安全",
      result.sync.message,
      result.sync.pushed ? "success" : "warning",
      7000,
    );
  } catch (error) {
    handleError(error);
  } finally {
    setBusy(false);
  }
}

async function loadMoreHistory() {
  if (state.loadingHistory || !state.overview) return;
  const history = state.overview.history || [];
  const total = state.overview.historyTotal ?? history.length;
  if (history.length >= total) return;

  state.loadingHistory = true;
  elements.historyLoadMore.disabled = true;
  elements.historyLoadMore.textContent = "正在加载…";
  try {
    const page = unwrap(
      await window.chronodraft.loadHistory({ skip: history.length, limit: 30 }),
    );
    const knownHashes = new Set(history.map((version) => version.hash));
    const newItems = page.items.filter((version) => !knownHashes.has(version.hash));
    state.overview.history = [...history, ...newItems];
    state.overview.historyTotal = page.total;
    elements.historyCount.textContent = String(page.total);
    renderHistory(state.overview.history, page.total);
  } catch (error) {
    handleError(error);
  } finally {
    state.loadingHistory = false;
    elements.historyLoadMore.disabled = false;
    elements.historyLoadMore.textContent = "加载更早版本";
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
    if (openCloudReview(result.sync)) {
      showToast("新版本已保存在本机", result.sync.message, "warning", 7000);
      return;
    }
    if (openSyncConflict(result.sync)) {
      showToast("新版本已保存在本机", result.sync.message, "warning", 7000);
      return;
    }
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
  await connectRemote(elements.remoteUrl.value);
}

async function connectRemote(remoteUrl) {
  try {
    const remote = unwrap(await window.chronodraft.setRemote(remoteUrl));
    state.overview.remote = remote;
    closeModal();
    renderSync(state.overview);
    showToast("GitHub 仓库已连接", "正在尝试同步已有版本。");
    if (state.overview.history.length > 0) {
      const result = unwrap(await window.chronodraft.sync());
      render(result.overview, { preserveMessage: true });
      if (openCloudReview(result.sync)) {
        showToast("GitHub 仓库已连接", result.sync.message, "warning", 7000);
        return;
      }
      if (openSyncConflict(result.sync)) {
        showToast("GitHub 仓库已连接", result.sync.message, "warning", 7000);
        return;
      }
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

async function confirmCloudUpload() {
  if (state.busy || !state.cloudReview || state.cloudReview.blocked) return;
  closeModal();
  setBusy(true);
  try {
    const result = unwrap(await window.chronodraft.sync({ allowWarnings: true }));
    render(result.overview, { preserveMessage: true });
    if (openCloudReview(result.sync)) {
      showToast("暂时无法上传", result.sync.message, "warning", 7000);
      return;
    }
    if (openSyncConflict(result.sync)) {
      showToast("同步已安全暂停", result.sync.message, "warning", 7000);
      return;
    }
    showToast(
      result.sync.pushed ? "云端备份完成" : "本地版本仍然安全",
      result.sync.message,
      result.sync.pushed ? "success" : "warning",
      7000,
    );
  } catch (error) {
    handleError(error);
  } finally {
    setBusy(false);
  }
}

async function resolveSyncConflict() {
  const conflict = state.syncConflict;
  if (
    state.busy ||
    !conflict?.local?.hash ||
    !conflict?.remote?.hash ||
    !elements.conflictConfirmCheck.checked
  ) {
    return;
  }

  elements.conflictResolve.disabled = true;
  elements.conflictResolve.textContent = "正在安全整理…";
  setBusy(true);
  try {
    const result = unwrap(
      await window.chronodraft.resolveSyncConflict({
        localHash: conflict.local.hash,
        remoteHash: conflict.remote.hash,
      }),
    );
    closeModal();
    render(result.overview, { preserveMessage: true });
    const copyCount = result.resolution?.copies?.length || 0;
    const resolutionMessage = copyCount > 0
      ? `已生成 ${copyCount} 个带“云端副本”的新文件；${result.sync.message}`
      : `本机文件状态已经保留；${result.sync.message}`;

    if (openCloudReview(result.sync)) {
      showToast("两边内容已安全保留", resolutionMessage, "warning", 8000);
      return;
    }
    if (openSyncConflict(result.sync)) {
      showToast("旧冲突已处理，云端又有新变化", resolutionMessage, "warning", 8000);
      return;
    }
    showToast(
      result.sync.pushed ? "两边内容已保留并同步" : "两边内容已安全保留",
      resolutionMessage,
      result.sync.pushed ? "success" : "warning",
      8000,
    );
  } catch (error) {
    if (
      error.code === "SYNC_CONFLICT_STALE" ||
      error.code === "SYNC_CONFLICT_WORKTREE_CHANGED"
    ) {
      closeModal();
      await refresh({ quiet: true });
      showToast("没有处理旧冲突", error.message, "warning", 8000);
    } else {
      handleError(error);
    }
  } finally {
    setBusy(false);
    elements.conflictResolve.textContent = "两份都保留并继续";
    elements.conflictResolve.disabled = !elements.conflictConfirmCheck.checked;
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
    if (result.sync && !openCloudReview(result.sync)) openSyncConflict(result.sync);
  } catch (error) {
    handleError(error);
  } finally {
    setBusy(false);
  }
}

function receiveAutoSnapshot(result) {
  if (!state.overview || result?.projectPath !== state.overview.projectPath) return;
  state.overview.snapshots = result.snapshots || [];
  renderAutoSnapshots(state.overview.snapshots);
}

async function openSuggestedGitHubRepository() {
  if (!state.overview?.projectPath) return;
  state.githubRepositoryPreparedFor = state.overview.projectPath;
  renderGitHubWizard();
  const url = new URL("https://github.com/new");
  url.searchParams.set("name", suggestedGitHubRepositoryName());
  url.searchParams.set(
    "description",
    `ChronoDraft 云端备份：${state.overview.projectName || "写作项目"}`,
  );
  url.searchParams.set("visibility", "private");
  try {
    unwrap(await window.chronodraft.openExternal(url.href));
  } catch (error) {
    handleError(error);
  }
}

async function openGitHubRepositoryAuthorization() {
  if (state.overview?.projectPath) {
    state.githubRepositoryPreparedFor = state.overview.projectPath;
  }
  renderGitHubWizard();
  try {
    if (state.githubRepositories?.configureUrl) {
      unwrap(await window.chronodraft.openExternal(state.githubRepositories.configureUrl));
    } else {
      unwrap(await window.chronodraft.openGitHubInstallation());
    }
  } catch (error) {
    handleError(error);
  }
}

function refreshGitHubAfterBrowserReturn() {
  scheduleAutoRefresh();
  if (
    !elements.remoteModal.classList.contains("hidden") &&
    state.githubAuth?.authenticated
  ) {
    refreshGitHubRepositories({ quiet: true });
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
  elements.syncBadge.addEventListener("click", retrySync);
  elements.historyLoadMore.addEventListener("click", loadMoreHistory);
  elements.cloudAction.addEventListener("click", openRemoteModal);
  elements.settingsButton.addEventListener("click", () => {
    if (!state.overview.identity.ready) openIdentityModal();
    else openRemoteModal();
  });
  elements.identityForm.addEventListener("submit", saveIdentity);
  elements.remoteForm.addEventListener("submit", saveRemote);
  elements.removeRemote.addEventListener("click", removeRemote);
  elements.githubLogin.addEventListener("click", startGitHubLogin);
  elements.githubCreateRepository.addEventListener("click", openSuggestedGitHubRepository);
  elements.githubHaveRepository.addEventListener("click", () => {
    state.githubRepositoryPreparedFor = state.overview?.projectPath || "";
    renderGitHubWizard();
  });
  elements.githubBackPrepare.addEventListener("click", () => {
    state.githubRepositoryPreparedFor = "";
    renderGitHubWizard();
  });
  elements.githubInstall.addEventListener("click", openGitHubRepositoryAuthorization);
  elements.githubRepositoryRefresh.addEventListener("click", () =>
    refreshGitHubRepositories(),
  );
  elements.githubConfigureInstallation.addEventListener(
    "click",
    openGitHubRepositoryAuthorization,
  );
  elements.githubLogout.addEventListener("click", logoutGitHub);
  elements.githubReopenLogin.addEventListener("click", () => {
    window.chronodraft.openExternal("https://github.com/login/device");
  });
  elements.cloudReviewCheck.addEventListener("change", () => {
    elements.cloudReviewConfirm.disabled =
      !elements.cloudReviewCheck.checked || Boolean(state.cloudReview?.blocked);
  });
  elements.cloudReviewConfirm.addEventListener("click", confirmCloudUpload);
  elements.conflictConfirmCheck.addEventListener("change", () => {
    elements.conflictResolve.disabled = !elements.conflictConfirmCheck.checked;
  });
  elements.conflictShowFolder.addEventListener("click", async () => {
    try {
      unwrap(await window.chronodraft.showInFolder());
    } catch (error) {
      handleError(error);
    }
  });
  elements.conflictResolve.addEventListener("click", resolveSyncConflict);
  elements.versionRestore.addEventListener("click", () => {
    if (!state.versionTarget) return;
    const target = state.versionTarget;
    closeModal();
    openRestoreModal(target);
  });
  elements.versionMilestone.addEventListener("click", () => {
    if (state.versionTarget) toggleMilestone(state.versionTarget);
  });
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
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.backdrop.classList.contains("hidden")) {
      closeModal();
    }
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      saveVersion();
    }
  });
  window.addEventListener("focus", refreshGitHubAfterBrowserReturn);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) scheduleAutoRefresh();
  });
}

async function loadInitialState() {
  try {
    const result = unwrap(await window.chronodraft.startup());
    await refreshGitHubAuth({ quiet: true });
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
window.chronodraft.onAutoSnapshot(receiveAutoSnapshot);
loadInitialState();
