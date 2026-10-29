# 云端备份边界

## Purpose

记录上传前检查及凭据保管现状。依据：`src/git-service.js`、`src/credential-store.js`、`test/git-service.test.js`、`test/github-auth.test.js`。

## Requirements

### Requirement: 上传前检查

系统 SHALL 在网络同步前检查正式历史中的上传阻断项和警告项，并将检查结果与本地保存结果分离。

#### Scenario: 超过文件限制
- **WHEN** 预检存在文件大小阻断项
- **THEN** 同步返回 `upload-blocked`，不进入后续上传流程

#### Scenario: 警告未经确认
- **WHEN** 预检有警告且没有 `allowWarnings` 确认
- **THEN** 同步返回 `review-required`，保留已经保存的本地版本

### Requirement: 安全凭据存储

凭据存储 SHALL 要求可用的系统加密后端，不得退回明文存储。

#### Scenario: 安全后端可用
- **WHEN** 凭据完整且系统加密可用
- **THEN** 存储通过加密后临时文件与重命名保存凭据

#### Scenario: Linux 明文后端
- **WHEN** 后端为 `basic_text`
- **THEN** 保存被 `SECURE_STORAGE_UNAVAILABLE` 拒绝
