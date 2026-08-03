# ChronoDraft 项目交接记录

> 给下一次新对话使用。开始工作前，请完整阅读本文件，再阅读 `docs/DEVELOPMENT.md` 和 `docs/ARCHITECTURE.md`，然后先运行 `git status --short --branch`，不要重复已经完成的工作。

最后更新：2026-08-03（Asia/Shanghai）

## 1. 用户目标与协作方式

用户希望把 ChronoDraft 做成一款真正适合写作者、尤其是 Git/GitHub 小白的桌面版本管理工具。

协作约定：

- 按优先级一个一个完成，不只给建议，要实现并验证。
- 只有遇到会改变产品方向、需要付费、会清除登录状态或存在明显取舍时，再询问用户。
- 全程优先使用中文和非技术化表达，不能要求小白理解 Git 命令或英文 GitHub 页面。
- UI 要清楚、克制、好看；不能只让功能“能跑”，还要消除状态误导和操作歧义。
- 本地文件永远优先保护；云端失败不能撤销已经完成的本地保存。

产品定位：**ChronoDraft — 不学 Git，也能保存每一版作品**。

## 2. 当前版本与仓库

- 本地项目：`/Users/zz/ChronoDraft`
- 源码仓库：<https://github.com/zhazhahuiyuxiaoxiao/chronodraft>
- 当前正式预览版：`v0.2.0`
- `v0.2.0` 功能提交：`3eca080 feat: launch ChronoDraft 0.2.0`
- Release：<https://github.com/zhazhahuiyuxiaoxiao/chronodraft/releases/tag/v0.2.0>
- GitHub Actions 发布运行：<https://github.com/zhazhahuiyuxiaoxiao/chronodraft/actions/runs/30797153183>
- `v0.2.0` 的测试、macOS、Windows、Linux 和 Release 任务均已成功。
- Apple Silicon、Intel Mac、Windows x64、Linux x64 安装包和 `SHA256SUMS.txt` 均已出现在 Release 中。
- 本机 Apple Silicon 构建位于 `release/`，该目录被 Git 忽略，不应提交。
- 本机当前使用的是 `release/mac-arm64/ChronoDraft.app`，尚未复制到 `/Applications`。

在创建本交接文件之前，源码工作区是干净的，`main`、`origin/main` 和 `v0.2.0` 指向同一功能提交。交接文件本身会作为标签之后的文档提交推送到 `main`，不改变 `v0.2.0` Release 内容。

## 3. 已完成的核心功能

### 本地版本保护

- 启动时检查 Git，缺少时提供中文安装说明和重新检测。
- 选择普通写作文件夹后创建独立 Git 仓库；拒绝误选其他大仓库内部的子文件夹。
- 显示新增、修改、删除、重命名和被忽略文件。
- 自动生成面向写作内容的版本说明，支持正式保存版本。
- 首次保存前检查作者信息。
- 自动安全快照仅留在本机，最多 30 个且不超过 7 天，不污染正式历史和暂存区。
- 正式版本可标记为里程碑。
- 历史分页加载，不隐藏早期版本。

### 对比与恢复

- 文本文件提供逐行差异展示。
- 二进制文件提供安全的变更说明，不误当文本读取。
- 恢复旧版本前自动保留当前状态。
- 云端冲突时先恢复到同步前状态，不覆盖本机文件。
- 用户确认后可使用“双副本”方案：保留本机原件，将云端内容另存为“云端副本”，重名时自动编号。
- 执行冲突处理前会重新校验本机、工作区和云端版本，过期确认不会继续执行。

### GitHub 云端备份

- 已实现 GitHub App Device Flow 浏览器登录，不要求粘贴密码、Token 或 SSH 私钥。
- 短期访问令牌和刷新令牌仅在 Electron 主进程处理。
- 凭据由 macOS Keychain、Windows DPAPI 或受支持的 Linux 密钥库加密；不安全的 Linux 明文后端会被拒绝。
- Renderer、项目文件、Git 远端 URL、命令行参数和日志不会收到令牌。
- Git 网络操作使用临时凭据助手，并对错误信息再次脱敏。
- 三步中文备份向导：登录、准备私有仓库、授权并连接。
- 自动发现当前 GitHub App 已授权且可写的仓库，不再要求复制英文仓库地址。
- GitHub 英文操作页旁有中文图示、按钮翻译和当前步骤提示。
- 已修复 UI 误判：仅存在 Git remote 不等于 GitHub App 已授权；HTTPS GitHub 仓库必须出现在当前 App 的授权列表中才显示“已连接”。
- 上传前扫描 `.env`、私钥、疑似 Token 和 GitHub 单文件大小限制。
- 支持第一次向空仓库推送。

### 工程与发布

- Electron 固定为 `38.8.6`，避免依赖自动漂移。
- `npm run verify` 同时运行语法检查和自动测试。
- 当前共 26 项自动测试，覆盖真实临时 Git 仓库、快照、恢复、冲突、首次推送、GitHub 登录、凭据加密、令牌刷新、仓库过滤和临时凭据助手。
- Electron 窗口启用了 `contextIsolation`、关闭 Node integration，并使用最小 preload API。
- macOS 预览包启用 Hardened Runtime 和临时签名；`scripts/after-pack.cjs` 清理未使用权限及不安全网络例外。
- GitHub Actions 在 `main` 和 PR 上验证；仅标签或手动发布时构建三平台安装包。
- 发布标签必须与 `package.json` 版本一致。
- 三个平台全部成功后才创建/更新预发布 Release，并生成 SHA-256 校验文件。

## 4. GitHub App 公开配置

以下信息是公开构建配置，不是秘密：

- GitHub App 名称/slug：`chronodraft-writer`
- Client ID：`Iv23ctjb4IgWQhX00Hjo`
- App 页面：<https://github.com/apps/chronodraft-writer>
- 项目配置位置：`package.json` 的 `chronodraft.githubApp`
- 详细注册说明：`docs/GITHUB_APP_SETUP.md`

权限原则：

- Repository permissions → Contents：`Read and write`
- Metadata：GitHub 自动提供的只读权限
- 其他权限：`No access`
- 不申请 `Administration: write`，因此不能静默创建仓库；用户在 GitHub 页面明确创建私有仓库。
- 不使用 Client Secret、Private Key 或 webhook。

不得在文档、聊天、日志或提交中加入访问令牌、刷新令牌、Client Secret、Private Key 或系统密钥库内容。

当前 GitHub CLI（`gh`）没有登录，但普通 `git push` 使用现有 Git 凭据已经成功。不要为了方便要求用户粘贴 Token。

## 5. 真实备份验证记录

- 测试写作文件夹：`/Users/zz/Documents/ChronoDraft测试文稿`
- 测试备份仓库：<https://github.com/zhazhahuiyuxiaoxiao/chronodraft-writing>
- 远端：`https://github.com/zhazhahuiyuxiaoxiao/chronodraft-writing.git`
- 测试文件：`欢迎使用 ChronoDraft.md`
- 首次备份提交：`d218546 首次云端备份：添加《欢迎使用 ChronoDraft.md》`
- ChronoDraft 返回：`pushed: true`、`reason: synced`
- 本机 `HEAD` 与 `refs/remotes/origin/main` 都是 `d218546bebeef60601a76bc20c6fa0dafb05aa33`。
- 上传前警告数和阻止数均为 0。

不要随意删除该测试文件夹或仓库；后续可以继续用于回归验证。

真机“退出此设备”没有执行，因为它会清除当前登录并要求用户重新登录；退出和令牌刷新已有自动测试覆盖。若以后要做真机退出验证，必须先告诉用户会发生什么并得到确认。

## 6. 已确认的产品与安全决策

- Local-first：没有数据库、服务器、广告或分析统计。
- GitHub 只是可选异地备份，本地版本始终可用。
- GitHub 登录和仓库安装必须是两个明确步骤，不能把“已登录”误写成“已授权仓库”。
- 不以申请更大权限换取少一步操作。
- 小白主流程不显示仓库地址或 SSH；手动 HTTPS/SSH 只放在“高级设置”。
- 自动快照不自动上传，正式保存版本才进入常规同步流程。
- `.docx` 未来只提取文本用于对比展示；仓库仍保存原始 Word 文件，不转换或覆盖原件。
- 当前安装包是未公证预览版，必须继续向用户说明系统可能提示“未知开发者”。
- 用户此前要求暂时固定 Electron 38；升级 Electron 属于兼容性决策，不能悄悄升级后直接发布。

## 7. 仍未完成的事项

### 正式公开前优先级 P0

1. **正式代码签名与公证**
   - macOS 需要 Apple Developer 证书和公证。
   - Windows 需要代码签名证书。
   - 涉及付费账户或证书，开始前必须与用户讨论。

2. **全新设备验收**
   - 分别在没有开发环境的全新 Mac 和 Windows 上，从 GitHub Release 下载开始测试。
   - 覆盖安装、Git 检测、选择文件夹、保存版本、GitHub 登录、授权仓库、首次备份和重启后状态保持。

3. **Electron 安全升级评估**
   - `docs/DEVELOPMENT.md` 记录了 Electron 38 的上游安全公告。
   - 当前代码未调用公告涉及的高风险功能，但公开稳定版前仍应升级并完整回归。
   - 因用户要求固定 38，升级前需先说明兼容性与安全取舍。

4. **确认 GitHub App 可供外部账户安装**
   - 正式推广前确认 GitHub App 的安装范围为 `Any account`。
   - 使用另一个普通 GitHub 账户完成一次从登录到授权私有仓库的测试。

### 增强功能 P1

- `.docx` 逐段文本提取与对比。
- 应用内版本号、更新提示或安全的自动更新机制。
- 英文界面。
- 更完整的首次使用示例项目和内置帮助。

这些增强功能不阻止 `v0.2.0` 作为小范围预览版使用。

## 8. 关键文件

- `src/main.js`：Electron 主进程和 IPC。
- `src/preload.js`：安全 API 桥。
- `src/git-service.js`：Git 状态、保存、快照、历史、恢复、冲突和同步。
- `src/project-session.js`：原子化项目切换。
- `src/github-auth.js`：GitHub App 登录、刷新、仓库查询和 Git 临时认证。
- `src/credential-store.js`：系统安全存储。
- `src/github-app-config.js`：公开 GitHub App 构建配置。
- `src/renderer/index.html`：界面结构。
- `src/renderer/app.css`：视觉样式和响应式布局。
- `src/renderer/app.js`：Renderer 状态和交互逻辑。
- `test/git-service.test.js`、`test/github-auth.test.js`：自动测试。
- `scripts/ui-smoke.mjs`：Electron CDP UI 回归和截图。
- `.github/workflows/build.yml`：测试、跨平台构建和 Release。
- `docs/GITHUB_APP_SETUP.md`：GitHub App 注册说明。
- `README.md`、`SECURITY.md`、`docs/ARCHITECTURE.md`、`docs/DEVELOPMENT.md`：用户与开发文档。

## 9. 常用验证命令

```bash
npm run verify
npm run pack
npm run dist:mac
git diff --check
codesign --verify --deep --strict --verbose=4 release/mac-arm64/ChronoDraft.app
hdiutil verify release/ChronoDraft-0.2.0-arm64.dmg
```

修改版本号时必须同步更新：

- `package.json`
- `package-lock.json` 顶层版本
- `.github/workflows/build.yml` 的手动发布默认标签
- `README.md` 的版本文字和下载链接
- `SECURITY.md`
- `docs/marketing/LAUNCH_COPY.md`

发布顺序：验证 → 本机打包与签名检查 → 提交并推送 `main` → 创建并推送匹配版本的标签 → 等待所有 GitHub Actions 成功 → 检查 Release 资产。

## 10. 给新对话的继续指令

新对话可以直接发送：

> 请先完整读取 `/Users/zz/ChronoDraft/PROJECT_HANDOFF.md`，再读取 `docs/DEVELOPMENT.md` 和 `docs/ARCHITECTURE.md`。先核对 Git 状态和当前 Release，不要重复已完成内容。继续按优先级逐项完善；涉及付费签名、Electron 升级、清除 GitHub 登录或产品方向取舍时再问我。

推荐下一阶段先做“正式公开前 P0”评估。若用户暂时不准备购买签名证书，则优先完成外部账户 GitHub App 安装验证和全新设备验收；若用户更想继续增加功能，则从 `.docx` 只读文本对比开始。
