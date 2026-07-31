import fs from "node:fs/promises";
import path from "node:path";

const endpoint = process.env.DRAFTORY_DEBUG_URL || "http://127.0.0.1:9222/json/list";
const outputDirectory = path.resolve("docs");

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

const overview = {
  projectPath: "/Users/writer/Documents/毕业论文",
  projectName: "毕业论文",
  changes: [
    { code: ".M", type: "modified", path: "第三章/案例分析.md", originalPath: null },
    { code: "??", type: "added", path: "参考文献/访谈记录.md", originalPath: null },
    { code: "R.", type: "renamed", path: "附录/调查问卷（最终版）.docx", originalPath: "附录/问卷.docx" }
  ],
  history: [
    {
      hash: "1111111111111111111111111111111111111111",
      shortHash: "1111111",
      message: "补充第三章的案例分析",
      author: "林同学",
      date: new Date().toISOString()
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
  remote: { configured: false, url: "", displayUrl: "" },
  identity: { name: "林同学", email: "writer@example.com", ready: true },
  branch: "main",
  sync: { state: "local-only", ahead: 0, behind: 0 }
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
      timelineItems: document.querySelectorAll("#recent-history .timeline-item").length,
      saveEnabled: !document.querySelector("#save-button").disabled,
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth
    };
  })()`,
);
const appScreenshot = await capture(send, "app-preview.png");

socket.close();
console.log(
  JSON.stringify(
    {
      welcome: welcomeState,
      app: appState,
      screenshots: [welcomeScreenshot, appScreenshot],
    },
    null,
    2,
  ),
);
