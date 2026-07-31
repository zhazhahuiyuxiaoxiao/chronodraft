# ChronoDraft 发布文案

以下内容可以直接复制，也可以按照发布平台删减。不要省略“早期预览版”和“未签名”说明。

## 推荐标题

**论文“最终版2、真的最终版”太多？我做了一个不学 Git 的版本时光机**

备选：

- 不会 Git，也能给论文、小说和笔记保存每一个版本
- 我把 Git 藏起来，做了一个给写作者用的版本保存工具
- 再也不创建“最终版3”：一个本地优先的写作版本工具

## 短文案

你是不是也有这些文件？

```text
毕业论文-最终版.docx
毕业论文-最终版2.docx
毕业论文-真的最终版.docx
```

我做了一个开源桌面工具 **ChronoDraft**：不用学习 Git，选择写作文件夹后，点击“保存新版本”就能记录这次修改。

- 自动发现哪些文件变了
- 用时间线查看历史版本
- 恢复旧版本前自动备份现在的内容
- 文件默认留在本机，可选同步 GitHub
- 支持 macOS、Windows 和 Linux

项目仍是早期预览版，安装包暂未做付费开发者签名，安装前请阅读说明。

项目与下载：<https://github.com/zhazhahuiyuxiaoxiao/chronodraft>

如果你平时写论文、小说、Markdown 或 Obsidian 笔记，欢迎试用并告诉我哪里最难懂。

## GitHub / V2EX / 开发者社区版

我做了一个本地优先的 Electron 桌面工具 **ChronoDraft**，目标是让不了解 Repository、Commit、Branch、Push 的写作者也能使用版本管理。

界面只保留“保存新版本、查看历史、安全恢复、云端备份”。本地保存始终先完成；GitHub 推送失败不会撤销已经保存的本地版本。应用不需要服务器、数据库或 Docker，也不收集 Token 和 SSH 私钥。

当前是 `v0.1.2` 早期预览版，支持 Apple Silicon Mac、Intel Mac、Windows 64 位和 Linux 64 位。启动时会自动检查 Git，缺少时提供中文安装引导。欢迎真实写作者试用，也欢迎开发者查看架构和提出改进建议。

项目：<https://github.com/zhazhahuiyuxiaoxiao/chronodraft>

## 首批测试邀请

我正在找 5～10 位会写论文、小说或长期笔记的用户测试 ChronoDraft。无需懂 Git，我最想知道的是：

1. 第一次打开时哪里看不懂？
2. “保存新版本”和“恢复历史”是否符合直觉？
3. 你最担心软件弄丢或覆盖什么文件？

如果愿意测试，可以直接下载，也可以在 GitHub 提 Issue。不要上传包含个人隐私的真实论文；先用副本体验更安全。

## 发布前检查

- 链接指向 `v0.1.2` 或仓库首页
- 同时附上 `social-preview.png` 和 `demo.gif`
- 在仓库 **Settings → General → Social preview → Edit** 上传 `social-preview.png`
- 明确说明早期预览版和未签名提示
- 不承诺“绝不会丢文件”，使用“本地优先”“恢复前自动备份”等可验证描述
- 发布后优先回复安装失败和文件安全问题
