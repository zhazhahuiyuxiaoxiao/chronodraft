# 为 ChronoDraft 做贡献

感谢你愿意帮助“不懂 Git 的人”更安心地保存作品。

## 本地开发

需要 Node.js 20+、npm 和 Git：

```bash
npm install
npm test
npm run dev
```

提交代码前请运行：

```bash
npm run verify
```

## 产品原则

- 面向写作者、学生和研究者，不假设用户理解 Git。
- 界面优先使用“保存版本、同步、恢复”等自然语言。
- 任何失败都不能让用户丢失本地内容。
- 不采集私钥、密码或 Token，不把凭据写入项目。
- 恢复或覆盖内容前，必须提供可回退的安全版本。

## Issue 与 Pull Request

请描述使用场景、预期行为和实际行为。界面改动请附截图；Git 操作改动请补充自动化测试。
