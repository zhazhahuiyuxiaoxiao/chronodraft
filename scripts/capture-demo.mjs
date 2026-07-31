import fs from "node:fs/promises";
import path from "node:path";

const endpoint = process.env.CHRONODRAFT_DEBUG_URL || "http://127.0.0.1:9226/json/list";
const outputDirectory = path.resolve("docs/marketing/demo-frames");

async function targetPage() {
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error(`无法读取 Electron 调试端口：${response.status}`);
  const targets = await response.json();
  const target = targets.find((item) => item.type === "page" && item.title.includes("ChronoDraft"));
  if (!target) throw new Error("没有找到 ChronoDraft 页面");
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
  const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || "页面脚本执行失败");
  return result.result.value;
}

async function capture(send, filename) {
  const result = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  await fs.writeFile(path.join(outputDirectory, filename), Buffer.from(result.data, "base64"));
}

const history = [
  { hash: "1111111111111111111111111111111111111111", shortHash: "1111111", message: "补充第三章的案例分析", author: "林同学", date: new Date().toISOString() },
  { hash: "2222222222222222222222222222222222222222", shortHash: "2222222", message: "完成文献综述初稿", author: "林同学", date: new Date(Date.now() - 86400000).toISOString() },
  { hash: "3333333333333333333333333333333333333333", shortHash: "3333333", message: "建立论文目录和写作计划", author: "林同学", date: new Date(Date.now() - 172800000).toISOString() },
];

const overview = {
  projectPath: "/Users/writer/Documents/毕业论文",
  projectName: "毕业论文",
  changes: [
    { code: ".M", type: "modified", path: "第三章/案例分析.md", originalPath: null },
    { code: "??", type: "added", path: "参考文献/访谈记录.md", originalPath: null },
    { code: "R.", type: "renamed", path: "附录/调查问卷（最终版）.docx", originalPath: "附录/问卷.docx" },
  ],
  history,
  remote: { configured: false, url: "", displayUrl: "" },
  identity: { name: "林同学", email: "writer@example.com", ready: true },
  branch: "main",
  sync: { state: "local-only", ahead: 0, behind: 0 },
};

const savedOverview = {
  ...overview,
  changes: [],
  history: [
    { hash: "4444444444444444444444444444444444444444", shortHash: "4444444", message: "补充第三章的案例分析", author: "林同学", date: new Date().toISOString() },
    ...history,
  ],
};

const target = await targetPage();
const { socket, send } = await connect(target.webSocketDebuggerUrl);
await fs.mkdir(outputDirectory, { recursive: true });
await send("Page.enable");
await send("Runtime.enable");

async function setCaption(text) {
  const layout = await evaluate(send, `(() => {
    let el = document.querySelector("#demo-caption");
    if (!el) {
      el = document.createElement("div");
      el.id = "demo-caption";
      el.className = "demo-caption";
      document.body.appendChild(el);
    }
    el.textContent = ${JSON.stringify(text)};
    const rect = el.getBoundingClientRect();
    return { width: rect.width, height: rect.height, left: rect.left, top: rect.top, display: getComputedStyle(el).display };
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 120));
  if (layout.display !== "block" || layout.width === 0 || layout.height === 0) {
    throw new Error(`演示字幕没有正确显示：${JSON.stringify(layout)}`);
  }
}

await evaluate(send, `showScreen("welcome")`);
await setCaption("① 选择论文、小说或笔记文件夹");
await capture(send, "01-choose-folder.png");

await evaluate(send, `state.messageTouched = false; render(${JSON.stringify(overview)}); showScreen("app"); switchView("today")`);
await setCaption("② 软件自动发现新增、修改和重命名");
await capture(send, "02-find-changes.png");

await evaluate(send, `render(${JSON.stringify(savedOverview)}); showScreen("app"); switchView("today"); showToast("版本已保存", "内容已经安全保存在本机。", "success", 30000)`);
await setCaption("③ 点击一次，保存一个清楚的新版本");
await capture(send, "03-save-version.png");

await evaluate(send, `render(${JSON.stringify(savedOverview)}); showScreen("app"); switchView("history")`);
await setCaption("④ 随时查看历史，恢复前会先备份现在的内容");
await capture(send, "04-view-history.png");

socket.close();
console.log(`已生成演示帧：${outputDirectory}`);
