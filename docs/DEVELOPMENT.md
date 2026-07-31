# ChronoDraft 开发交接

更新时间：2026-07-31

## 当前状态

MVP 已实现并通过测试，项目目录为 `/Users/zz/ChronoDraft`。

已完成：

- Electron 38 桌面应用，无前端框架和运行时服务器。
- 选择写作文件夹；非 Git 文件夹会自动初始化为 `main` 分支。
- 解析新增、修改、删除、重命名和冲突文件。
- 自动生成中文版本说明，也允许用户修改。
- 一键执行本地保存；远端不可用时，本地版本仍然成功。
- 连接 GitHub 仓库地址，支持首次推送到空仓库。
- 拉取远端变化后再推送；冲突时中止 rebase，不覆盖文件。
- 历史时间线和安全恢复；恢复前自动提交未保存内容。
- 项目级作者名字和邮箱设置。
- CSP、context isolation、sandbox、禁用页面跳转和新窗口。
- 中文欢迎页、主界面、历史页和设置弹窗。
- 启动时自动检查系统 Git；缺少时显示按平台区分的官方安装引导和重新检测按钮。

## 验证命令

```bash
npm run check
npm test
```

当前测试共 7 项，使用系统临时目录创建真实 Git 仓库，不访问互联网。

界面测试：

```bash
npm run dev -- --remote-debugging-port=9222
npm run ui:smoke
```

生成：

- `docs/welcome-preview.png`
- `docs/app-preview.png`

## 架构

完整的技术分析、进程边界、数据流和端口说明见 [ARCHITECTURE.md](ARCHITECTURE.md)。

- `src/main.js`：Electron 主进程、窗口安全和 IPC。
- `src/preload.js`：最小化的安全 API 桥。
- `src/git-service.js`：Git 命令、状态、历史、同步和恢复。
- `src/renderer/`：纯 HTML/CSS/JavaScript 界面。
- `test/git-service.test.js`：核心 Git 流程测试。
- `scripts/ui-smoke.mjs`：通过 Electron CDP 验证和截图。

## 安全与已知事项

用户要求暂时固定 Electron 38，以避免影响已有 38 版项目。当前实际版本为 38.8.6。2026-07-31 的 `npm audit` 报告 Electron <=39.8.4 有高危上游公告，涉及离屏窗口绘制、剪贴板图片和命名窗口等功能；ChronoDraft 当前没有调用这些 API，但公开稳定版前仍应升级并重新测试。

不要运行 `npm audit fix --force`。计划升级时，应显式修改 `package.json`，安装目标版本，然后逐项验证 macOS、Windows、文件选择、IPC、保存、恢复和打包。

## 下一阶段

1. 添加 GitHub OAuth Device Flow 或 GitHub App 登录，代替依赖用户已有的系统 Git 凭据。
2. 用系统 Keychain / Credential Manager 保存短期令牌。
3. 增加 `.docx` 文本提取，仅用于对比展示，仓库仍保存原文件。
4. 增加敏感文件扫描（`.env`、私钥、Token）和大文件提醒。
5. 为冲突设计“保留本地 / 保留云端 / 两份都保留”的非技术界面。
6. 为 macOS 和 Windows 制作签名安装包；未签名预览包需明确提示。

## 产品定位

中文标题：**ChronoDraft — 不学 Git，也能保存每一版作品**

英文传播句：**Version control for writers — without learning Git.**

核心受众：Markdown / Obsidian 写作者、LaTeX 用户、课程资料维护者、纯文本小说作者。Word 用户可以保存版本，但当前预览版尚不能逐段比较 `.docx`。

第一版不需要 Docker、数据库或服务器。文件、Git 历史和凭据都留在用户电脑上，GitHub 仅作为可选的远端备份。
