# ChronoDraft 开发交接

更新时间：2026-08-03

## 当前状态

MVP 已实现并通过测试，项目目录为 `/Users/zz/ChronoDraft`。

已完成：

- Electron 38 桌面应用，无前端框架和运行时服务器。
- 选择写作文件夹；非 Git 文件夹会自动初始化为 `main` 分支。
- 拒绝把现有 Git 仓库的子目录当作独立项目，避免保存范围扩大到父目录。
- 解析新增、修改、删除、重命名和冲突文件。
- 显示被 Git 忽略规则排除、不会进入版本的文件或目录。
- 根据代表性文件自动生成写作化中文版本说明，也允许用户修改。
- 一键执行本地保存；远端不可用时，本地版本仍然成功。
- 连接 GitHub 仓库地址，支持首次推送到空仓库。
- 拉取远端变化后再推送；冲突时中止 rebase，不覆盖文件。
- 可分页的完整历史时间线、版本改动文件清单和纯文本逐行差异。
- 有改动时每 10 分钟创建本地自动快照；最多保留 30 个且不超过 7 天，不进入正式历史或云端推送。
- 正式版本可以设置或取消里程碑，不重写提交历史。
- 在版本差异中预览后安全恢复；恢复前自动提交未保存内容。
- 项目级作者名字和邮箱设置。
- CSP、context isolation、sandbox、禁用页面跳转和新窗口。
- 中文欢迎页、主界面、历史页和设置弹窗。
- 启动时自动检查系统 Git；缺少时显示按平台区分的官方安装引导和重新检测按钮。
- 窗口重新获得焦点时自动刷新；顶部同步状态可以直接重试同步。
- GitHub 上传前扫描完整正式历史中的敏感路径、常见 Token / 私钥特征和 50 MB 以上大文件；不把匹配到的凭据原文传给界面。
- 云端冲突后自动撤销 rebase、校验本机 `HEAD` 和工作区已恢复，并展示冲突文件及两边版本摘要。
- 经用户逐次确认后保留本机冲突状态，把云端内容安全另存为自动编号的 `（云端副本）`，生成可追溯的合并版本后再同步。
- GitHub App Device Flow、短期令牌刷新、系统安全存储、退出和真实账户登录验证。
- 三步中文云备份向导：预填私有仓库信息、图示翻译 GitHub 英文页面，并自动列出当前 App 已授权且可写的仓库；手动 HTTPS / SSH 收进高级设置。

## 验证命令

```bash
npm run verify
```

当前测试共 26 项，使用系统临时目录创建真实 Git 仓库，不访问互联网。冲突测试会建立本机、裸远端和协作者三个真实仓库，验证原件不变、副本内容、删除/修改冲突、同名自动编号、合并历史和推送结果。GitHub 登录测试使用本地模拟响应，验证加密落盘、明文后端拒绝、Device Flow、短期凭据要求、刷新轮换、授权仓库过滤和临时 Git 凭据助手。

界面测试：

```bash
npm run dev -- --remote-debugging-port=9222
npm run ui:smoke
```

生成：

- `docs/welcome-preview.png`
- `docs/app-preview.png`
- `docs/version-preview.png`（设置 `CHRONODRAFT_CAPTURE_VERSION=1` 时生成）
- `docs/snapshots-preview.png`（设置 `CHRONODRAFT_CAPTURE_SNAPSHOTS=1` 时生成）
- `docs/cloud-review-preview.png`（设置 `CHRONODRAFT_CAPTURE_CLOUD_REVIEW=1` 时生成）
- `docs/conflict-preview.png`（设置 `CHRONODRAFT_CAPTURE_CONFLICT=1` 时生成）
- `docs/github-auth-preview.png` 和 `docs/github-device-preview.png`（设置 `CHRONODRAFT_CAPTURE_GITHUB=1` 时生成）

可用 `CHRONODRAFT_SCREENSHOT_DIR` 将截图写入临时目录，避免覆盖文档图片。

## 架构

完整的技术分析、进程边界、数据流和端口说明见 [ARCHITECTURE.md](ARCHITECTURE.md)。

- `src/main.js`：Electron 主进程、窗口安全和 IPC。
- `src/preload.js`：最小化的安全 API 桥。
- `src/git-service.js`：Git 命令、状态、历史、同步和恢复。
- `src/project-session.js`：原子化项目切换，失败时保留原项目。
- `src/github-auth.js`：GitHub App Device Flow、轮询、刷新和登录状态。
- `src/credential-store.js`：基于 Electron `safeStorage` 的加密凭据文件。
- `src/github-app-config.js`：公开 Client ID 与 App slug 构建配置。
- `src/renderer/`：纯 HTML/CSS/JavaScript 界面。
- `test/git-service.test.js`：核心 Git 流程测试。
- `scripts/ui-smoke.mjs`：通过 Electron CDP 验证和截图。

## 安全与已知事项

用户要求暂时固定 Electron 38，以避免影响已有 38 版项目。依赖已精确锁定为 38.8.6，避免安装时漂移到未经验证的版本。2026-07-31 的 `npm audit` 报告 Electron <=39.8.4 有高危上游公告，涉及离屏窗口绘制、剪贴板图片和命名窗口等功能；ChronoDraft 当前没有调用这些 API，但公开稳定版前仍应升级并重新测试。

GitHub Actions 会在 `main` 分支和 Pull Request 上运行 `npm run verify`。只有版本标签或手动发布才构建三平台安装包；发布标签必须与 `package.json` 一致，并且 macOS、Windows、Linux 全部构建成功后才会创建或更新预发布版本和校验和，避免部分平台先行发布。

macOS 预览包启用 Hardened Runtime 并使用临时签名；`scripts/after-pack.cjs` 会在签名前关闭 Electron 模板中的任意网络加载和本地明文网络例外，并删除应用未使用的摄像头、麦克风、蓝牙权限说明。本机打包后应同时检查 `codesign --verify --deep --strict` 和最终 `Info.plist`。

不要运行 `npm audit fix --force`。计划升级时，应显式修改 `package.json`，安装目标版本，然后逐项验证 macOS、Windows、文件选择、IPC、保存、恢复和打包。

## 下一阶段

真实 GitHub App 登录、指定私有仓库安装和首次推送已于 2026-08-03 在 macOS 完成验证；本机 `main` 与 `origin/main` 指向同一提交。退出和令牌刷新由自动测试覆盖，真机退出验证会清除当前设备登录，应在需要重新登录时单独执行。

1. 增加 `.docx` 文本提取，仅用于对比展示，仓库仍保存原文件。
2. 为 macOS 和 Windows 制作签名安装包；未签名预览包需明确提示。

## 产品定位

中文标题：**ChronoDraft — 不学 Git，也能保存每一版作品**

英文传播句：**Version control for writers — without learning Git.**

核心受众：Markdown / Obsidian 写作者、LaTeX 用户、课程资料维护者、纯文本小说作者。Word 用户可以保存版本，但当前预览版尚不能逐段比较 `.docx`。

第一版不需要 Docker、数据库或服务器。文件、Git 历史和凭据都留在用户电脑上，GitHub 仅作为可选的远端备份。
