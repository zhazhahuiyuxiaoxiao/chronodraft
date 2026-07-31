const { execFile } = require("node:child_process");
const path = require("node:path");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);

class ChronoDraftError extends Error {
  constructor(code, message, detail = "") {
    super(message);
    this.name = "ChronoDraftError";
    this.code = code;
    this.detail = detail;
  }
}

async function runGit(cwd, args, options = {}) {
  try {
    const result = await execFileAsync("git", ["-C", cwd, ...args], {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
        LC_ALL: "C",
      },
      ...options,
    });
    return {
      stdout: result.stdout.trim(),
      stderr: result.stderr.trim(),
    };
  } catch (error) {
    const stderr = String(error.stderr || "").trim();
    const stdout = String(error.stdout || "").trim();
    throw new ChronoDraftError(
      "GIT_COMMAND_FAILED",
      humanizeGitError(stderr || stdout || error.message),
      stderr || stdout,
    );
  }
}

function humanizeGitError(detail) {
  if (/not found|is not recognized as an internal or external command/i.test(detail) && /git/i.test(detail)) {
    return "没有找到 Git。请先安装 Git，再重新打开 ChronoDraft。";
  }
  if (/not a git repository/i.test(detail)) {
    return "这个文件夹还没有启用版本保存。";
  }
  if (/authentication failed|could not read Username|permission denied.*publickey/i.test(detail)) {
    return "GitHub 登录已失效或没有仓库权限，请先在系统中重新登录 GitHub。";
  }
  if (/could not resolve host|failed to connect|network is unreachable|connection.*timed out/i.test(detail)) {
    return "暂时无法连接 GitHub，本地版本仍然安全。联网后可以再次同步。";
  }
  if (/non-fast-forward|fetch first|rejected/i.test(detail)) {
    return "云端有较新的内容，需要先同步后才能上传。";
  }
  if (/conflict|could not apply/i.test(detail)) {
    return "本地内容和云端内容发生冲突。ChronoDraft 没有覆盖任何文件，请手动确认后重试。";
  }
  if (/nothing to commit/i.test(detail)) {
    return "当前没有需要保存的新修改。";
  }
  if (/src refspec .* does not match any/i.test(detail)) {
    return "请先保存至少一个版本，再连接云端。";
  }
  return "Git 操作没有完成，请查看详细信息后重试。";
}

function cleanRemoteUrl(url) {
  return url.replace(/\.git$/, "").replace(/^git@github\.com:/, "https://github.com/");
}

function validateRemoteUrl(rawUrl) {
  const value = String(rawUrl || "").trim();
  if (!value) {
    throw new ChronoDraftError("INVALID_REMOTE", "请输入 GitHub 仓库地址。");
  }

  const sshPattern = /^git@github\.com:[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/;
  if (sshPattern.test(value)) return value;

  try {
    const parsed = new URL(value);
    const validPath = /^\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/.test(parsed.pathname);
    if (
      parsed.protocol !== "https:" ||
      parsed.hostname.toLowerCase() !== "github.com" ||
      parsed.username ||
      parsed.password ||
      !validPath
    ) {
      throw new Error("invalid");
    }
    return value;
  } catch {
    throw new ChronoDraftError(
      "INVALID_REMOTE",
      "仓库地址格式不正确，请粘贴类似 https://github.com/用户名/仓库名.git 的地址。",
    );
  }
}

function classifyChange(code) {
  if (code.includes("U") || code === "AA" || code === "DD") return "conflict";
  if (code.includes("R")) return "renamed";
  if (code.includes("D")) return "deleted";
  if (code.includes("A") || code === "??") return "added";
  return "modified";
}

function parsePorcelainV2(output) {
  if (!output) return [];
  const records = output.split("\0");
  const changes = [];

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record) continue;

    if (record.startsWith("? ")) {
      changes.push({ code: "??", type: "added", path: record.slice(2), originalPath: null });
      continue;
    }
    if (record.startsWith("! ")) continue;

    if (record.startsWith("1 ")) {
      const parts = record.split(" ");
      const code = parts[1];
      const filePath = parts.slice(8).join(" ");
      changes.push({ code, type: classifyChange(code), path: filePath, originalPath: null });
      continue;
    }

    if (record.startsWith("2 ")) {
      const parts = record.split(" ");
      const code = parts[1];
      const filePath = parts.slice(9).join(" ");
      const originalPath = records[index + 1] || null;
      index += 1;
      changes.push({ code, type: classifyChange(code), path: filePath, originalPath });
      continue;
    }

    if (record.startsWith("u ")) {
      const parts = record.split(" ");
      const filePath = parts.slice(10).join(" ");
      changes.push({ code: "UU", type: "conflict", path: filePath, originalPath: null });
    }
  }

  return changes;
}

class GitService {
  constructor(projectPath) {
    this.projectPath = path.resolve(projectPath);
  }

  async initialize() {
    try {
      const { stdout } = await runGit(this.projectPath, ["rev-parse", "--show-toplevel"]);
      this.projectPath = path.resolve(stdout);
    } catch (error) {
      if (error.code !== "GIT_COMMAND_FAILED") throw error;
      try {
        await runGit(this.projectPath, ["init", "-b", "main"]);
      } catch {
        await runGit(this.projectPath, ["init"]);
        await runGit(this.projectPath, ["branch", "-M", "main"]).catch(() => {});
      }
    }
    return this.getOverview();
  }

  async getIdentity() {
    const getValue = async (key) => {
      try {
        return (await runGit(this.projectPath, ["config", "--get", key])).stdout;
      } catch {
        return "";
      }
    };
    const [name, email] = await Promise.all([getValue("user.name"), getValue("user.email")]);
    return { name, email, ready: Boolean(name && email) };
  }

  async setIdentity(name, email) {
    const cleanName = String(name || "").trim();
    const cleanEmail = String(email || "").trim();
    if (!cleanName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new ChronoDraftError("INVALID_IDENTITY", "请填写名字和有效的邮箱地址。");
    }
    await runGit(this.projectPath, ["config", "user.name", cleanName]);
    await runGit(this.projectPath, ["config", "user.email", cleanEmail]);
    return this.getIdentity();
  }

  async getRemote() {
    try {
      const { stdout } = await runGit(this.projectPath, ["remote", "get-url", "origin"]);
      return {
        configured: true,
        url: stdout,
        displayUrl: cleanRemoteUrl(stdout),
      };
    } catch {
      return { configured: false, url: "", displayUrl: "" };
    }
  }

  async setRemote(rawUrl) {
    const url = validateRemoteUrl(rawUrl);
    const remote = await this.getRemote();
    if (remote.configured) {
      await runGit(this.projectPath, ["remote", "set-url", "origin", url]);
    } else {
      await runGit(this.projectPath, ["remote", "add", "origin", url]);
    }
    return this.getRemote();
  }

  async removeRemote() {
    const remote = await this.getRemote();
    if (remote.configured) await runGit(this.projectPath, ["remote", "remove", "origin"]);
    return this.getRemote();
  }

  async getBranch() {
    try {
      return (await runGit(this.projectPath, ["branch", "--show-current"])).stdout || "main";
    } catch {
      return "main";
    }
  }

  async getChanges() {
    const { stdout } = await runGit(this.projectPath, [
      "status",
      "--porcelain=v2",
      "-z",
      "--untracked-files=all",
    ]);
    return parsePorcelainV2(stdout);
  }

  async getHistory(limit = 30) {
    try {
      const separator = "%x1f";
      const record = "%x1e";
      const { stdout } = await runGit(this.projectPath, [
        "log",
        `--max-count=${Math.min(Math.max(Number(limit) || 30, 1), 100)}`,
        `--pretty=format:%H${separator}%h${separator}%s${separator}%an${separator}%aI${record}`,
      ]);
      return stdout
        .split("\x1e")
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => {
          const [hash, shortHash, message, author, date] = entry.split("\x1f");
          return { hash, shortHash, message, author, date };
        });
    } catch {
      return [];
    }
  }

  async getSyncState() {
    const remote = await this.getRemote();
    if (!remote.configured) {
      return { state: "local-only", ahead: 0, behind: 0 };
    }

    try {
      const { stdout } = await runGit(this.projectPath, [
        "rev-list",
        "--left-right",
        "--count",
        "HEAD...@{upstream}",
      ]);
      const [ahead, behind] = stdout.split(/\s+/).map(Number);
      return {
        state: ahead === 0 && behind === 0 ? "synced" : "different",
        ahead: ahead || 0,
        behind: behind || 0,
      };
    } catch {
      return { state: "not-pushed", ahead: 0, behind: 0 };
    }
  }

  async getOverview() {
    const [changes, history, remote, identity, branch, sync] = await Promise.all([
      this.getChanges(),
      this.getHistory(),
      this.getRemote(),
      this.getIdentity(),
      this.getBranch(),
      this.getSyncState(),
    ]);
    return {
      projectPath: this.projectPath,
      projectName: path.basename(this.projectPath),
      changes,
      history,
      remote,
      identity,
      branch,
      sync,
    };
  }

  async commit(message) {
    const cleanMessage = String(message || "").trim();
    if (!cleanMessage) {
      throw new ChronoDraftError("EMPTY_MESSAGE", "请用一句话描述这个版本。");
    }
    if (cleanMessage.length > 120) {
      throw new ChronoDraftError("LONG_MESSAGE", "版本说明请控制在 120 个字以内。");
    }

    const identity = await this.getIdentity();
    if (!identity.ready) {
      throw new ChronoDraftError("IDENTITY_REQUIRED", "第一次保存前，请填写作者名字和邮箱。");
    }

    const changes = await this.getChanges();
    if (changes.length === 0) {
      throw new ChronoDraftError("NO_CHANGES", "当前没有需要保存的新修改。");
    }

    await runGit(this.projectPath, ["add", "-A"]);
    try {
      await runGit(this.projectPath, ["commit", "-m", cleanMessage]);
    } catch (error) {
      await runGit(this.projectPath, ["reset"]).catch(() => {});
      throw error;
    }

    const history = await this.getHistory(1);
    return history[0] || null;
  }

  async sync() {
    const remote = await this.getRemote();
    if (!remote.configured) {
      return {
        pushed: false,
        reason: "no-remote",
        message: "版本已安全保存在本机。连接 GitHub 后即可同步到云端。",
      };
    }

    const branch = await this.getBranch();
    try {
      const { stdout: remoteBranch } = await runGit(this.projectPath, [
        "ls-remote",
        "--heads",
        "origin",
        `refs/heads/${branch}`,
      ]);

      if (!remoteBranch) {
        await runGit(this.projectPath, ["push", "-u", "origin", branch]);
        return { pushed: true, reason: "synced", message: "已保存，并安全同步到 GitHub。" };
      }

      await runGit(this.projectPath, ["fetch", "origin", branch]);
      let behind = 0;
      try {
        const { stdout } = await runGit(this.projectPath, [
          "rev-list",
          "--count",
          `HEAD..origin/${branch}`,
        ]);
        behind = Number(stdout) || 0;
      } catch {
        behind = 0;
      }

      if (behind > 0) {
        try {
          await runGit(this.projectPath, ["rebase", `origin/${branch}`]);
        } catch (error) {
          await runGit(this.projectPath, ["rebase", "--abort"]).catch(() => {});
          throw new ChronoDraftError(
            "SYNC_CONFLICT",
            "本地版本已经保存，但与云端内容有冲突。ChronoDraft 没有覆盖文件，请确认后重试。",
            error.detail,
          );
        }
      }

      await runGit(this.projectPath, ["push", "-u", "origin", branch]);
      return { pushed: true, reason: "synced", message: "已保存，并安全同步到 GitHub。" };
    } catch (error) {
      return {
        pushed: false,
        reason: error.code || "push-failed",
        message: `版本已安全保存在本机；${error.message}`,
        detail: error.detail || "",
      };
    }
  }

  async saveVersion(message) {
    const commit = await this.commit(message);
    const sync = await this.sync();
    return { commit, sync, overview: await this.getOverview() };
  }

  async syncExisting() {
    const history = await this.getHistory(1);
    if (history.length === 0) {
      throw new ChronoDraftError("NO_VERSIONS", "请先保存一个本地版本，再同步到 GitHub。");
    }
    const sync = await this.sync();
    return { sync, overview: await this.getOverview() };
  }

  async restoreVersion(hash) {
    const validHash = String(hash || "");
    if (!/^[0-9a-f]{40}$/i.test(validHash)) {
      throw new ChronoDraftError("INVALID_VERSION", "没有找到要恢复的版本。");
    }

    try {
      await runGit(this.projectPath, ["cat-file", "-e", `${validHash}^{commit}`]);
    } catch {
      throw new ChronoDraftError("INVALID_VERSION", "这个历史版本已不存在。");
    }

    const identity = await this.getIdentity();
    if (!identity.ready) {
      throw new ChronoDraftError("IDENTITY_REQUIRED", "恢复版本前，请填写作者名字和邮箱。");
    }

    const changes = await this.getChanges();
    if (changes.length > 0) {
      await this.commit("恢复前自动备份");
    }

    await runGit(this.projectPath, ["restore", "--source", validHash, "--staged", "--worktree", "."]);
    const restoredChanges = await this.getChanges();
    if (restoredChanges.length === 0) {
      return {
        changed: false,
        message: "当前内容已经和这个版本相同。",
        overview: await this.getOverview(),
      };
    }

    await runGit(this.projectPath, ["commit", "-m", `恢复到版本 ${validHash.slice(0, 7)}`]);
    const sync = await this.sync();
    return {
      changed: true,
      message: sync.message,
      overview: await this.getOverview(),
    };
  }
}

module.exports = {
  ChronoDraftError,
  GitService,
  cleanRemoteUrl,
  parsePorcelainV2,
  validateRemoteUrl,
};
