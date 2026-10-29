# chronodraft 工程基线

- 核对日期：2026-10-29。
- 基线：`main@288d65823867342cd591b1536826cd7e9e8af9e7`（文档补录前提交）。
- 来源：本仓库已提交源码、测试和现有说明；不纳入其他工作区未提交或未合并能力。
- 范围：只补文档和流程，不改变业务、依赖、数据或部署。

## 能力与证据

| 验收目标 | 源码 | 已有测试/证据 |
| --- | --- | --- |
| 打开独立文件夹并保存本地版本；拒绝父仓库子目录 | `src/git-service.js` 的 `initialize`、`saveVersion`；`src/project-session.js` | `test/git-service.test.js` 初始化、项目切换、子目录拒绝用例 |
| 恢复前备份未保存修改；相同内容不创建恢复版本 | `src/git-service.js` 的 `restoreVersion` | 同文件恢复用例；相同内容分支为源码核对 |
| GitHub 可选同步、上传预检和双副本冲突处理 | `src/git-service.js` 的 `sync`、`resolveSyncConflict` | 同文件敏感历史、冲突与本地裸仓库推送用例 |
| 加密凭据与可写仓库过滤 | `src/credential-store.js`、`src/github-auth.js` | `test/github-auth.test.js`（模拟 GitHub 响应） |

## 启动与验证

需要 Node.js >=20、系统 Git；界面启动另需 Electron 依赖。首次开发准备 `npm install`，随后 `npm run dev`；具体脚本均来自 `package.json`。本地保存不需要 GitHub 账户。可选登录配置见 [GitHub App 说明](GITHUB_APP_SETUP.md)，只使用自己的授权和占位符，不复制凭据。

`npm run verify` 执行语法检查和 `node --test`；`npm run ui:smoke` 依赖先启动带调试端口的 Electron，详见 [开发交接](DEVELOPMENT.md)。本次没有执行这些业务检查。

## 验收清单与边界

- [ ] 在临时样例目录验证打开、保存、恢复、忽略路径与自动快照。
- [ ] 核对同步失败时本地版本仍保留、上传预检结果及过期冲突确认拒绝。
- [ ] 用明确授权的测试仓库验证 GitHub 登录/刷新/退出与推送。
- [ ] 分平台验证安装包、系统密钥库及签名状态。

当前为早期预览版，README 历史安装包未签名说明继续有效；本次未下载或验证发布资产。Word 等二进制可保存，不等于支持逐段文本对比。原开发文档的 Electron 风险记录属于历史记录，本次未重新审计依赖。

## 本次验证记录

- 已执行：OpenSpec 1.14.2 全量严格格式校验、`git diff --check`、新改 Markdown 相对路径核对及命令来源静态核对，结果见本次 PR。
- 未执行：业务测试、依赖安装、服务启动、真实平台集成、收费模型调用、发布/部署。仅文档变更不将源码审阅表述为运行通过。
- 后续功能验收应运行上文对应测试，并补正常、边界和失败路径证据；外部系统与真实设备需另行授权及验证。

## 文档分工

[README](../README.md) 是用途与启动入口；[AGENTS](../AGENTS.md) 约束修改流程；[OpenSpec](../openspec/README.md) 区分当前能力与未来变更。旧文档中的已验证结论保留其原时间与上下文，不作为当前生产证据。
