# 本地版本基线

## Purpose

记录独立写作目录的版本保存与恢复现状。依据：`src/git-service.js`、`src/project-session.js`、`test/git-service.test.js`。

## Requirements

### Requirement: 项目目录边界

系统 SHALL 将选择目录作为版本范围，拒绝将已有 Git 仓库的子目录静默扩大到父目录。

#### Scenario: 新独立目录
- **WHEN** 所选目录不属于现有 Git 仓库且 Git 初始化成功
- **THEN** 系统初始化本地仓库并返回项目概览

#### Scenario: 选择父仓库中的子目录
- **WHEN** Git 返回的仓库根路径与选择目录不同
- **THEN** 系统返回 `PROJECT_INSIDE_REPOSITORY`，要求选择根目录或独立文件夹

### Requirement: 保存与安全恢复

系统 SHALL 先保存本地提交再尝试云端同步；恢复旧版本前 SHALL 在存在改动时创建安全备份。

#### Scenario: 未配置云端
- **WHEN** 本地提交成功且没有远端
- **THEN** 保存结果包含本地提交，且同步结果为 `pushed: false`、`reason: no-remote`

#### Scenario: 恢复时有未保存修改
- **WHEN** 目标版本有效、作者信息完整且工作区有改动
- **THEN** 系统先提交“恢复前自动备份”，再恢复目标内容

#### Scenario: 恢复时缺少作者信息
- **WHEN** 作者名字或邮箱未就绪
- **THEN** 系统返回 `IDENTITY_REQUIRED`，不执行内容恢复
