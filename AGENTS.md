# chronodraft 项目约定

## 文档与变更约定（2026-10-29）

- 保持 Renderer → Preload → Main → GitService 的边界，不向页面暴露任意文件或命令权限。
- 本地保存与云端同步分别报告结果；恢复、冲突处理与快照不得静默丢弃用户内容。
- GitHub Token 只留在主进程和系统加密存储；不得降级明文、输出到日志或传给 Renderer。
- 代码验证入口：`npm run verify`（语法检查与 Node 测试）；UI 冒烟按 `docs/DEVELOPMENT.md` 在隔离样例目录执行，避免真实作品与登录状态。

- 先读 README、[工程基线](docs/engineering-baseline.md)及相关源码/测试；当前规范位于 `openspec/specs/`。
- 先明确可验证验收目标；涉及权限、持久化格式、外部传输、删除或失败语义的业务变化，先说明旧/新行为并确认范围。
- 当前文档基线不授权部署、迁移、提交、推送或读取真实凭据/用户数据。示例使用占位符，保留来源与许可。
- 非简单行为变更先按 [OpenSpec 流程](openspec/README.md)建立 change；仅文档修正保持最小范围，不伪造功能提案。
- 文档检查：`OPENSPEC_TELEMETRY=0 openspec validate --all --strict --no-interactive`、`git diff --check`，并核对相对链接及命令来源；格式检查不等于业务验收。
