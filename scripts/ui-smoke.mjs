import fs from "node:fs/promises";
import path from "node:path";

const endpoint =
  process.env.CHRONODRAFT_DEBUG_URL ||
  process.env.DRAFTORY_DEBUG_URL ||
  "http://127.0.0.1:9222/json/list";
const outputDirectory = path.resolve(process.env.CHRONODRAFT_SCREENSHOT_DIR || "docs");

async function getTarget() {
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error(`无法读取 Electron 调试端口：${response.status}`);
  const targets = await response.json();
  const target = targets.find((item) => item.type === "page" && item.title.includes("ChronoDraft"));
  if (!target) throw new Error("没有找到 ChronoDraft 页面，请先启动 npm run dev -- --remote-debugging-port=9222");
  return target;
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const pending = new Map();
    let nextId = 1;

    socket.addEventListener("error", () => reject(new Error("无法连接 Electron 调试页面")));
    socket.addEventListener("open", () => {
      const send = (method, params = {}) =>
        new Promise((resolveCommand, rejectCommand) => {
          const id = nextId++;
          pending.set(id, { resolve: resolveCommand, reject: rejectCommand });
          socket.send(JSON.stringify({ id, method, params }));
        });

      socket.addEventListener("message", (event) => {
        const message = JSON.parse(event.data);
        if (!message.id || !pending.has(message.id)) return;
        const task = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) task.reject(new Error(message.error.message));
        else task.resolve(message.result);
      });

      resolve({ socket, send });
    });
  });
}

async function evaluate(send, expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || "页面脚本执行失败");
  }
  return result.result.value;
}

async function capture(send, filename) {
  const result = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  const output = path.join(outputDirectory, filename);
  await fs.writeFile(output, Buffer.from(result.data, "base64"));
  return output;
}

const target = await getTarget();
const { socket, send } = await connect(target.webSocketDebuggerUrl);
await fs.mkdir(outputDirectory, { recursive: true });
await send("Page.enable");
await send("Runtime.enable");

const welcomeState = await evaluate(
  send,
  `({
    title: document.title,
    welcomeVisible: !document.querySelector("#welcome-screen").classList.contains("hidden"),
    loadingVisible: !document.querySelector("#loading-screen").classList.contains("hidden"),
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth
  })`,
);
const welcomeScreenshot = await capture(send, "welcome-preview.png");

const liveGitHubState =
  process.env.CHRONODRAFT_CHECK_LIVE_GITHUB === "1"
    ? await evaluate(
        send,
        `(async () => {
          const authResult = await window.chronodraft.getGitHubAuthState();
          if (!authResult.ok) throw new Error(authResult.error?.message || "GitHub 登录状态读取失败");
          const auth = authResult.data;
          if (!auth.authenticated) {
            return { authenticated: false, login: "", installed: false, repositoryCount: 0 };
          }
          const repositoryResult = await window.chronodraft.listGitHubRepositories();
          if (!repositoryResult.ok) {
            throw new Error(repositoryResult.error?.message || "GitHub 仓库读取失败");
          }
          const repositories = repositoryResult.data;
          return {
            authenticated: true,
            login: auth.login,
            installed: repositories.installed,
            repositoryCount: repositories.repositories.length,
            tokenExposed: /gh[usr]_/.test(JSON.stringify({ auth, repositories }))
          };
        })()`,
      )
    : null;

const overview = {
  projectPath: "/Users/writer/Documents/毕业论文",
  projectName: "毕业论文",
  changes: [
    { code: ".M", type: "modified", path: "第三章/案例分析.md", originalPath: null },
    { code: "??", type: "added", path: "参考文献/访谈记录.md", originalPath: null },
    { code: "R.", type: "renamed", path: "附录/调查问卷（最终版）.docx", originalPath: "附录/问卷.docx" }
  ],
  ignored: [
    { path: "缓存/", kind: "directory" },
    { path: "本地导出.tmp", kind: "file" }
  ],
  history: [
    {
      hash: "1111111111111111111111111111111111111111",
      shortHash: "1111111",
      message: "补充第三章的案例分析",
      author: "林同学",
      date: new Date().toISOString(),
      milestone: true
    },
    {
      hash: "2222222222222222222222222222222222222222",
      shortHash: "2222222",
      message: "完成文献综述初稿",
      author: "林同学",
      date: new Date(Date.now() - 86400000).toISOString()
    },
    {
      hash: "3333333333333333333333333333333333333333",
      shortHash: "3333333",
      message: "建立论文目录和写作计划",
      author: "林同学",
      date: new Date(Date.now() - 172800000).toISOString()
    }
  ],
  historyTotal: 45,
  snapshots: [
    {
      hash: "4444444444444444444444444444444444444444",
      shortHash: "4444444",
      message: "自动保护：更新《案例分析.md》，新增《访谈记录.md》",
      author: "林同学",
      date: new Date(Date.now() - 600000).toISOString(),
      snapshot: true
    },
    {
      hash: "5555555555555555555555555555555555555555",
      shortHash: "5555555",
      message: "自动保护：更新《案例分析.md》",
      author: "林同学",
      date: new Date(Date.now() - 1200000).toISOString(),
      snapshot: true
    }
  ],
  remote: {
    configured: true,
    url: "https://github.com/writer/thesis.git",
    displayUrl: "https://github.com/writer/thesis"
  },
  identity: { name: "林同学", email: "writer@example.com", ready: true },
  branch: "main",
  sync: { state: "different", ahead: 2, behind: 0 }
};

const appState = await evaluate(
  send,
  `(() => {
    state.messageTouched = false;
    render(${JSON.stringify(overview)});
    showScreen("app");
    return {
      appVisible: !document.querySelector("#app-screen").classList.contains("hidden"),
      changeItems: document.querySelectorAll(".change-item").length,
      ignoredNoticeVisible: !document.querySelector("#ignored-summary").classList.contains("hidden"),
      ignoredItems: document.querySelectorAll("#ignored-list li").length,
      syncRetryEnabled: !document.querySelector("#sync-badge").disabled,
      syncLabel: document.querySelector("#sync-badge span").textContent,
      timelineItems: document.querySelectorAll("#recent-history .timeline-item").length,
      milestoneBadges: document.querySelectorAll("#recent-history .milestone-badge").length,
      snapshotCount: document.querySelectorAll("#auto-snapshots .timeline-item").length,
      snapshotNote: document.querySelector("#auto-snapshot-note").textContent,
      suggestedMessage: document.querySelector("#version-message").value,
      loadMoreHistoryVisible: !document.querySelector("#history-load-more").classList.contains("hidden"),
      saveEnabled: !document.querySelector("#save-button").disabled,
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth
    };
  })()`,
);
const appScreenshot = await capture(send, "app-preview.png");

const snapshotHistoryState = await evaluate(
  send,
  `(() => {
    switchView("history");
    elements.autoSnapshotSection.open = true;
    return {
      historyVisible: !elements.historyView.classList.contains("hidden"),
      sectionOpen: elements.autoSnapshotSection.open,
      snapshotItems: elements.autoSnapshots.querySelectorAll(".timeline-item").length,
      snapshotRestoreButtons: [...elements.autoSnapshots.querySelectorAll("button")]
        .filter((button) => button.textContent === "恢复此快照").length,
      milestoneButtons: document.querySelectorAll("#full-history .milestone-button.is-active").length,
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth
    };
  })()`,
);
const snapshotScreenshot =
  process.env.CHRONODRAFT_CAPTURE_SNAPSHOTS === "1"
    ? await capture(send, "snapshots-preview.png")
    : null;

const versionDetails = {
  version: overview.history[0],
  files: [
    { status: "M", type: "modified", path: "第三章/案例分析.md", originalPath: null },
    { status: "A", type: "added", path: "参考文献/访谈记录.md", originalPath: null },
    { status: "R100", type: "renamed", path: "附录/调查问卷（最终版）.docx", originalPath: "附录/问卷.docx" }
  ]
};
const versionState = await evaluate(
  send,
  `(() => {
    const details = ${JSON.stringify(versionDetails)};
    state.versionTarget = details.version;
    elements.versionDetailTitle.textContent = details.version.message;
    elements.versionDetailMeta.textContent = "今天 10:30 · 林同学";
    updateVersionMilestoneButton(details.version);
    renderVersionFiles(details, { loadFirst: false });
    renderTextPatch("diff --git a/file b/file\\n--- a/file\\n+++ b/file\\n@@ -1,2 +1,3 @@\\n 原有段落\\n-旧的案例说明\\n+新的案例说明\\n+补充访谈结论");
    elements.versionDiffTitle.textContent = "案例分析.md";
    openModal(elements.versionModal);
    return {
      visible: !elements.versionModal.classList.contains("hidden"),
      fileButtons: elements.versionFiles.querySelectorAll("button").length,
      addedLines: elements.versionDiff.querySelectorAll(".diff-line.added").length,
      deletedLines: elements.versionDiff.querySelectorAll(".diff-line.deleted").length,
      milestoneLabel: elements.versionMilestone.textContent,
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth
    };
  })()`,
);
const versionScreenshot =
  process.env.CHRONODRAFT_CAPTURE_VERSION === "1"
    ? await capture(send, "version-preview.png")
    : null;

const githubAuthState = await evaluate(
  send,
  `(() => {
    state.overview.remote = { configured: false, url: "", displayUrl: "" };
    state.githubRepositories = { installed: false, configureUrl: "", repositories: [] };
    state.githubRepositoryPreparedFor = "";
    renderGitHubAuth({
      configured: true,
      appSlug: "chronodraft",
      installUrl: "https://github.com/apps/chronodraft/installations/new",
      storage: { available: true, backend: "keychain", reason: "" },
      authenticated: true,
      login: "writer",
      expiresAt: Date.now() + 28800000
    });
    openModal(elements.remoteModal);
    return {
      visible: !elements.remoteModal.classList.contains("hidden"),
      authenticatedTitle: elements.githubAuthTitle.textContent,
      loginHidden: elements.githubLogin.classList.contains("hidden"),
      prepareStepVisible: !elements.githubPreparePanel.classList.contains("hidden"),
      suggestedPrivateRepository: elements.githubRepositoryName.textContent,
      guideExplainsEnglish: elements.githubGuideTranslation.textContent.includes("Private"),
      advancedSettingsClosed: !elements.githubAdvanced.open,
      secureStorageVisible: elements.githubStorageNote.textContent.includes("Keychain"),
      tokenExposed: /gh[usr]_/.test(elements.remoteModal.textContent),
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth
    };
  })()`,
);
const githubAuthScreenshot =
  process.env.CHRONODRAFT_CAPTURE_GITHUB === "1"
    ? await capture(send, "github-onboarding-preview.png")
    : null;

const githubUnverifiedRemoteState = await evaluate(
  send,
  `(() => {
    state.overview.remote = {
      configured: true,
      url: "https://github.com/writer/unverified-writing.git",
      displayUrl: "https://github.com/writer/unverified-writing"
    };
    state.githubRepositoryPreparedFor = state.overview.projectPath;
    state.githubRepositories = { installed: false, configureUrl: "", repositories: [] };
    renderGitHubWizard();
    return {
      authorizeStepActive: elements.githubStepAuthorize.classList.contains("is-active"),
      authorizeStepComplete: elements.githubStepAuthorize.classList.contains("is-complete"),
      asksForAuthorization: elements.githubRepositoryHeading.textContent.includes("还差授权"),
      guideClaimsConnected: elements.githubGuideTitle.textContent.includes("已经开启")
    };
  })()`,
);
const githubUnverifiedRemoteScreenshot =
  process.env.CHRONODRAFT_CAPTURE_GITHUB === "1"
    ? await capture(send, "github-unverified-remote-preview.png")
    : null;

const githubRepositoryState = await evaluate(
  send,
  `(() => {
    state.overview.remote = { configured: false, url: "", displayUrl: "" };
    state.githubRepositoryPreparedFor = state.overview.projectPath;
    state.githubRepositories = {
      installed: true,
      configureUrl: "https://github.com/settings/installations/41",
      repositories: [
        { id: 7, name: "thesis", fullName: "writer/thesis", private: true, url: "https://github.com/writer/thesis.git" },
        { id: 8, name: "notes", fullName: "writer/notes", private: true, url: "https://github.com/writer/notes.git" }
      ]
    };
    renderGitHubWizard();
    return {
      authorizeStepVisible: !elements.githubAuthorizePanel.classList.contains("hidden"),
      repositoryCards: elements.githubRepositoryList.querySelectorAll(".github-repository-card").length,
      connectButtons: [...elements.githubRepositoryList.querySelectorAll("button")]
        .filter((button) => button.textContent === "用它备份").length,
      manualAddressRequired: elements.githubAdvanced.open,
      tokenExposed: /gh[usr]_/.test(elements.remoteModal.textContent),
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth
    };
  })()`,
);
const githubRepositoryScreenshot =
  process.env.CHRONODRAFT_CAPTURE_GITHUB === "1"
    ? await capture(send, "github-repositories-preview.png")
    : null;

const githubDeviceState = await evaluate(
  send,
  `(() => {
    elements.githubDeviceCode.textContent = "ABCD-EFGH";
    elements.githubLoginStatus.textContent = "正在等待你在浏览器中确认…";
    openModal(elements.githubLoginModal);
    return {
      visible: !elements.githubLoginModal.classList.contains("hidden"),
      codeVisible: elements.githubDeviceCode.textContent === "ABCD-EFGH",
      passwordRequested: /请输入.*密码/.test(elements.githubLoginModal.textContent),
      tokenExposed: /gh[usr]_/.test(elements.githubLoginModal.textContent),
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth
    };
  })()`,
);
const githubDeviceScreenshot =
  process.env.CHRONODRAFT_CAPTURE_GITHUB === "1"
    ? await capture(send, "github-device-preview.png")
    : null;

const cloudReviewState = await evaluate(
  send,
  `(() => {
    openCloudReview({
      reason: "review-required",
      preflight: {
        versions: 45,
        files: 126,
        blockers: [],
        warnings: [
          { type: "sensitive-path", severity: "review", path: ".env", message: "文件名看起来可能包含密钥、令牌或环境配置。" },
          { type: "secret-content", severity: "review", path: "资料/旧配置.txt", message: "这个文件的版本历史中疑似出现过访问令牌或私钥。" },
          { type: "large-file", severity: "review", path: "附件/访谈录像.mov", size: 62914560, message: "这个文件较大，首次上传可能会很慢。" }
        ]
      }
    });
    const disabledBeforeConfirm = elements.cloudReviewConfirm.disabled;
    elements.cloudReviewCheck.checked = true;
    elements.cloudReviewCheck.dispatchEvent(new Event("change"));
    return {
      visible: !elements.cloudReviewModal.classList.contains("hidden"),
      reviewItems: elements.cloudReviewList.querySelectorAll(".cloud-review-item").length,
      disabledBeforeConfirm,
      enabledAfterConfirm: !elements.cloudReviewConfirm.disabled,
      exposedSecretValues: /ghp_|github_pat_|BEGIN PRIVATE KEY/.test(elements.cloudReviewModal.textContent),
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth
    };
  })()`,
);
const cloudReviewScreenshot =
  process.env.CHRONODRAFT_CAPTURE_CLOUD_REVIEW === "1"
    ? await capture(send, "cloud-review-preview.png")
    : null;

const conflictState = await evaluate(
  send,
  `(() => {
    openSyncConflict({
      reason: "SYNC_CONFLICT",
      conflict: {
        worktreePreserved: true,
        ahead: 2,
        behind: 1,
        local: {
          hash: "6666666666666666666666666666666666666666",
          shortHash: "6666666",
          message: "本机补充访谈结论",
          author: "林同学",
          date: new Date().toISOString()
        },
        remote: {
          hash: "7777777777777777777777777777777777777777",
          shortHash: "7777777",
          message: "导师修改案例结构",
          author: "导师",
          date: new Date(Date.now() - 3600000).toISOString()
        },
        files: [
          { path: "第三章/案例分析.md", localExists: true, localSize: 18432, remoteExists: true, remoteSize: 19021 },
          { path: "附录/访谈提纲.md", localExists: true, localSize: 4096, remoteExists: false, remoteSize: 0 },
          { path: "导师意见/修改建议.md", localExists: false, localSize: 0, remoteExists: true, remoteSize: 2910 }
        ]
      }
    });
    const disabledBeforeConfirm = elements.conflictResolve.disabled;
    elements.conflictConfirmCheck.checked = true;
    elements.conflictConfirmCheck.dispatchEvent(new Event("change"));
    return {
      visible: !elements.syncConflictModal.classList.contains("hidden"),
      conflictItems: elements.conflictFiles.querySelectorAll("article").length,
      preservedMessageVisible: elements.syncConflictModal.textContent.includes("没有被覆盖"),
      copyPolicyVisible: elements.syncConflictModal.textContent.includes("云端副本"),
      disabledBeforeConfirm,
      enabledAfterConfirm: !elements.conflictResolve.disabled,
      resolutionChoices: [...elements.syncConflictModal.querySelectorAll("button")]
        .filter((button) => /两份都保留/.test(button.textContent)).length,
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth
    };
  })()`,
);
const conflictScreenshot =
  process.env.CHRONODRAFT_CAPTURE_CONFLICT === "1"
    ? await capture(send, "conflict-preview.png")
    : null;

socket.close();
console.log(
  JSON.stringify(
    {
      welcome: welcomeState,
      liveGitHub: liveGitHubState,
      app: appState,
      snapshots: snapshotHistoryState,
      version: versionState,
      githubAuth: githubAuthState,
      githubUnverifiedRemote: githubUnverifiedRemoteState,
      githubRepositories: githubRepositoryState,
      githubDevice: githubDeviceState,
      cloudReview: cloudReviewState,
      conflict: conflictState,
      screenshots: [
        welcomeScreenshot,
        appScreenshot,
        snapshotScreenshot,
        versionScreenshot,
        githubAuthScreenshot,
        githubUnverifiedRemoteScreenshot,
        githubRepositoryScreenshot,
        githubDeviceScreenshot,
        cloudReviewScreenshot,
        conflictScreenshot
      ].filter(Boolean),
    },
    null,
    2,
  ),
);
