# ChronoDraft GitHub App 注册

ChronoDraft 使用 GitHub App Device Flow 实现浏览器登录。桌面应用只需要公开的 **Client ID** 和公开的 **App slug**，不需要 Client Secret 或私钥。

## 注册设置

打开 [GitHub App 注册页面](https://github.com/settings/apps/new)，按以下内容填写：

- **GitHub App name**：使用一个全站唯一名称，例如 `ChronoDraft Writer`。注册后 GitHub 会生成对应的 App slug。
- **Homepage URL**：`https://github.com/zhazhahuiyuxiaoxiao/chronodraft`
- **Callback URL**：留空。ChronoDraft 使用 Device Flow，不接收浏览器回调。
- **Request user authorization (OAuth) during installation**：不要启用。登录和仓库安装由界面分两步明确完成。
- **Enable Device Flow**：启用。
- **Webhook / Active**：关闭。ChronoDraft 没有服务器，也不接收 webhook。
- **Repository permissions → Contents**：`Read and write`。
- 其他仓库、组织和账户权限：保持 `No access`。GitHub 自动附加的 Metadata 只读权限除外。
- **Where can this GitHub App be installed?**：准备给其他用户使用时选择 `Any account`；仅本机开发验证时可以暂选 `Only on this account`。
- **User-to-server token expiration**：保持启用。ChronoDraft 会拒绝保存没有刷新令牌的长期凭据。

注册后只记录以下两项：

1. **Client ID**，不是 App ID。
2. **App slug**，即安装地址 `https://github.com/apps/<slug>` 中的 `<slug>`。

不要生成、复制或发送 Client Secret、Private Key、访问令牌或刷新令牌。当前桌面登录流程不需要它们。

## 写入项目配置

将公开信息写入 `package.json`：

```json
{
  "chronodraft": {
    "githubApp": {
      "clientId": "你的 Client ID",
      "slug": "你的 App slug"
    }
  }
}
```

开发时也可以临时使用环境变量 `CHRONODRAFT_GITHUB_CLIENT_ID` 和 `CHRONODRAFT_GITHUB_APP_SLUG`，但正式安装包必须写入公开构建配置。

## 验证顺序

1. 启动 ChronoDraft，打开“连接 GitHub”。
2. 点击“用浏览器登录”，确认 GitHub 页面显示正确的 App 名称并输入验证码。
3. 按中文向导创建一个空的私有仓库，或选择已有仓库。
4. 返回 ChronoDraft，点击“选择授权仓库”，只选择用于测试的仓库。
5. 应用自动列出可写仓库后，点击“用它备份”并完成首次同步，不需要复制 HTTPS 地址。
6. 退出此设备，确认本机加密凭据已删除；GitHub 侧授权可以在账户设置中单独撤销。

实现依据：GitHub 官方的 [Device Flow 与短期用户令牌文档](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app)、[Git 访问权限说明](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app)和[Webhook 关闭说明](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/using-webhooks-with-github-apps)。
