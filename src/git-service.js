const { execFile, spawn } = require("node:child_process");
const { createWriteStream } = require("node:fs");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pipeline } = require("node:stream/promises");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const EMPTY_TREE_HASH = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
const MAX_TEXT_DIFF_BYTES = 1024 * 1024;
const AUTO_SNAPSHOT_REF_PREFIX = "refs/chronodraft/snapshots";
const MILESTONE_REF_PREFIX = "refs/chronodraft/milestones";
const AUTO_SNAPSHOT_MAX_COUNT = 30;
const AUTO_SNAPSHOT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const GITHUB_WARNING_FILE_BYTES = 50 * 1024 * 1024;
const GITHUB_MAX_FILE_BYTES = 100 * 1024 * 1024;
const SECRET_CONTENT_PATTERN = [
  "-----BEGIN ([A-Z0-9]+ )?PRIVATE KEY-----",
  "gh[pousr]_[A-Za-z0-9_]{20,}",
  "github_pat_[A-Za-z0-9_]{20,}",
  "AKIA[0-9A-Z]{16}",
  "xox[baprs]-[A-Za-z0-9-]{20,}",
].join("|");
const GITHUB_CREDENTIAL_HELPER =
  "!f() { if test \"$1\" = get; then printf '%s\\n' username=x-access-token \"password=$CHRONODRAFT_GITHUB_TOKEN\"; fi; }; f";
let gitExecutable = "git";

class ChronoDraftError extends Error {
  constructor(code, message, detail = "", data = null) {
    super(message);
    this.name = "ChronoDraftError";
    this.code = code;
    this.detail = detail;
    this.data = data;
  }
}

function isGitMissing(error, detail = "") {
  const message = `${error?.code || ""} ${error?.message || ""} ${detail}`;
  return (
    error?.code === "ENOENT" ||
    /spawn git ENOENT|git.*not found|git.*is not recognized/i.test(message) ||
    /xcrun: error: (?:invalid active developer path|active developer path.*does not exist)/i.test(message)
  );
}

function gitCandidates() {
  const candidates = ["git"];
  if (process.platform === "win32") {
    if (process.env.ProgramFiles) {
      candidates.push(path.join(process.env.ProgramFiles, "Git", "cmd", "git.exe"));
    }
    if (process.env.LOCALAPPDATA) {
      candidates.push(path.join(process.env.LOCALAPPDATA, "Programs", "Git", "cmd", "git.exe"));
    }
  }
  if (process.platform === "darwin") {
    candidates.push(
      "/usr/bin/git",
      "/usr/local/git/bin/git",
      "/opt/homebrew/bin/git",
      "/usr/local/bin/git",
    );
  }
  return [...new Set(candidates)];
}

async function checkGit(candidates = gitCandidates()) {
  for (const candidate of candidates) {
    try {
      const { stdout } = await execFileAsync(candidate, ["--version"], {
        encoding: "utf8",
        timeout: 15000,
        env: { ...process.env, LC_ALL: "C" },
      });
      gitExecutable = candidate;
      const version = String(stdout || "").trim().replace(/^git version\s+/i, "");
      return { installed: true, version };
    } catch (error) {
      const detail = redactSensitiveText(
        String(error.stderr || error.stdout || error.message || "").trim(),
      );
      if (isGitMissing(error, detail)) continue;
      throw new ChronoDraftError(
        "GIT_CHECK_FAILED",
        "暂时无法检查 Git，请重试。",
        detail,
      );
    }
  }
  return { installed: false, version: "" };
}

async function runGit(cwd, args, options = {}) {
  const { env: extraEnv = {}, allowedExitCodes = [], ...execOptions } = options;
  try {
    const result = await execFileAsync(gitExecutable, ["-C", cwd, ...args], {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
        LC_ALL: "C",
        ...extraEnv,
      },
      ...execOptions,
    });
    return {
      stdout: result.stdout.trim(),
      stderr: result.stderr.trim(),
    };
  } catch (error) {
    const stderr = String(error.stderr || "").trim();
    const stdout = String(error.stdout || "").trim();
    if (allowedExitCodes.includes(Number(error.code))) {
      return { stdout, stderr };
    }
    const detail = redactSensitiveText(
      stderr || stdout || String(error.message || "").trim(),
    );
    if (isGitMissing(error, detail)) {
      throw new ChronoDraftError(
        "GIT_NOT_FOUND",
        "还差一个必要组件：请先安装 Git。",
        detail,
      );
    }
    throw new ChronoDraftError(
      "GIT_COMMAND_FAILED",
      humanizeGitError(detail),
      detail,
    );
  }
}

async function runGitWithInput(cwd, args, input, options = {}) {
  const maxBuffer = options.maxBuffer || 10 * 1024 * 1024;
  const timeout = options.timeout || 30000;
  return new Promise((resolve, reject) => {
    const child = spawn(gitExecutable, ["-C", cwd, ...args], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
        LC_ALL: "C",
        ...(options.env || {}),
      },
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      child.kill();
      finish(new Error("Git command timed out"));
    }, timeout);

    const finish = (spawnError = null, exitCode = 0) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (!spawnError && exitCode === 0) {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
        return;
      }
      const detail = redactSensitiveText(
        stderr.trim() || stdout.trim() || String(spawnError?.message || "").trim(),
      );
      if (isGitMissing(spawnError, detail)) {
        reject(new ChronoDraftError("GIT_NOT_FOUND", "还差一个必要组件：请先安装 Git。", detail));
        return;
      }
      reject(new ChronoDraftError("GIT_COMMAND_FAILED", humanizeGitError(detail), detail));
    };

    const collect = (target, chunk) => {
      const next = target + chunk;
      if (Buffer.byteLength(next) > maxBuffer) {
        child.kill();
        finish(new Error("Git output exceeded the safety limit"));
      }
      return next;
    };
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout = collect(stdout, chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr = collect(stderr, chunk);
    });
    child.on("error", (error) => finish(error));
    child.on("close", (code) => finish(null, code));
    child.stdin.on("error", () => {});
    child.stdin.end(String(input || ""));
  });
}

async function writeGitBlobExclusive(cwd, objectHash, destination) {
  const child = spawn(gitExecutable, ["-C", cwd, "cat-file", "blob", objectHash], {
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0",
      LC_ALL: "C",
    },
  });
  const output = createWriteStream(destination, { flags: "wx", mode: 0o600 });
  let created = false;
  let stderr = "";
  output.once("open", () => {
    created = true;
  });
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    if (stderr.length < 65536) stderr += chunk;
  });

  const childFinished = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `git cat-file exited with code ${code}`));
    });
  });

  try {
    await Promise.all([pipeline(child.stdout, output), childFinished]);
  } catch (error) {
    child.kill();
    if (created) await fs.unlink(destination).catch(() => {});
    const detail = redactSensitiveText(stderr.trim() || error.message || "");
    throw new ChronoDraftError(
      "CONFLICT_COPY_FAILED",
      "无法安全写入云端副本，项目已经恢复到处理前状态。",
      detail,
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

function redactSensitiveText(rawValue) {
  return String(rawValue || "")
    .replace(/([a-z][a-z0-9+.-]*:\/\/)([^/\s@]+)@/gi, "$1[已隐藏凭据]@")
    .replace(
      /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g,
      "[已隐藏的 GitHub 凭据]",
    );
}

function sanitizeRemoteUrl(rawUrl) {
  const value = String(rawUrl || "").trim();
  try {
    const parsed = new URL(value);
    if (parsed.username || parsed.password) {
      parsed.username = "";
      parsed.password = "";
      return parsed.toString();
    }
  } catch {
    // SCP-style SSH URLs are not understood by URL and are safe to return unchanged.
  }
  return redactSensitiveText(value);
}

function createGitHubAuthEnvironment(token, hooksPath) {
  const accessToken = String(token || "");
  if (!accessToken.startsWith("ghu_")) return {};
  const entries = [
    ["credential.helper", ""],
    ["credential.https://github.com.helper", GITHUB_CREDENTIAL_HELPER],
    ["credential.interactive", "never"],
  ];
  if (hooksPath) entries.push(["core.hooksPath", path.resolve(hooksPath)]);
  const environment = {
    CHRONODRAFT_GITHUB_TOKEN: accessToken,
    GCM_INTERACTIVE: "Never",
    GIT_CONFIG_COUNT: String(entries.length),
  };
  entries.forEach(([key, value], index) => {
    environment[`GIT_CONFIG_KEY_${index}`] = key;
    environment[`GIT_CONFIG_VALUE_${index}`] = value;
  });
  return environment;
}

function cleanRemoteUrl(url) {
  return sanitizeRemoteUrl(url)
    .replace(/\.git$/, "")
    .replace(/^git@github\.com:/, "https://github.com/");
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

function parsePorcelainStatus(output) {
  if (!output) return { changes: [], ignored: [] };
  const records = output.split("\0");
  const changes = [];
  const ignored = [];

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record) continue;

    if (record.startsWith("? ")) {
      changes.push({ code: "??", type: "added", path: record.slice(2), originalPath: null });
      continue;
    }
    if (record.startsWith("! ")) {
      const ignoredPath = record.slice(2);
      ignored.push({
        path: ignoredPath,
        kind: ignoredPath.endsWith("/") ? "directory" : "file",
      });
      continue;
    }

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

  return { changes, ignored };
}

function parsePorcelainV2(output) {
  return parsePorcelainStatus(output).changes;
}

function pathsEqual(firstPath, secondPath) {
  const first = path.normalize(path.resolve(firstPath));
  const second = path.normalize(path.resolve(secondPath));
  if (process.platform === "win32") return first.toLowerCase() === second.toLowerCase();
  return first === second;
}

function literalPathspec(filePath) {
  return `:(literal)${filePath}`;
}

function truncateUtf8(value, maxBytes) {
  let result = "";
  for (const character of String(value || "")) {
    if (Buffer.byteLength(result + character, "utf8") > maxBytes) break;
    result += character;
  }
  return result;
}

function suggestRemoteCopyPath(filePath, sequence = 1) {
  const normalized = String(filePath || "").replace(/\\/g, "/");
  const directory = path.posix.dirname(normalized);
  const filename = path.posix.basename(normalized);
  let extension = path.posix.extname(filename);
  if (Buffer.byteLength(extension, "utf8") > 64) extension = "";
  const stem = extension ? filename.slice(0, -extension.length) : filename;
  const suffix = sequence === 1 ? "（云端副本）" : `（云端副本 ${sequence}）`;
  const maxStemBytes = Math.max(240 - Buffer.byteLength(`${suffix}${extension}`, "utf8"), 1);
  const safeStem = truncateUtf8(stem, maxStemBytes) || "文件";
  const copyName = `${safeStem}${suffix}${extension}`;
  return directory === "." ? copyName : `${directory}/${copyName}`;
}

function versionChangeType(status) {
  return {
    A: "added",
    C: "copied",
    D: "deleted",
    M: "modified",
    R: "renamed",
    T: "modified",
  }[status[0]] || "modified";
}

function parseNameStatus(output) {
  if (!output) return [];
  const records = output.split("\0").filter(Boolean);
  const files = [];
  for (let index = 0; index < records.length; ) {
    const status = records[index++];
    if (status.startsWith("R") || status.startsWith("C")) {
      const originalPath = records[index++] || "";
      const filePath = records[index++] || originalPath;
      files.push({ status, type: versionChangeType(status), path: filePath, originalPath });
      continue;
    }
    const filePath = records[index++] || "";
    files.push({ status, type: versionChangeType(status), path: filePath, originalPath: null });
  }
  return files;
}

function compactFileName(filePath, maxLength = 28) {
  const name = path.basename(String(filePath || "")) || "文件";
  if (name.length <= maxLength) return name;
  const extension = path.extname(name);
  const available = Math.max(maxLength - extension.length - 1, 8);
  return `${name.slice(0, available)}…${extension}`;
}

function suggestVersionMessage(changes, prefix = "") {
  const items = Array.isArray(changes) ? changes : [];
  if (items.length === 0) return `${prefix}保存当前写作进度`.trim();

  const describe = (change) => {
    const current = `《${compactFileName(change.path)}》`;
    if (change.type === "added") return `新增${current}`;
    if (change.type === "deleted") return `移除${current}`;
    if (change.type === "renamed") {
      return `将《${compactFileName(change.originalPath)}》改名为${current}`;
    }
    if (change.type === "copied") return `复制${current}`;
    return `更新${current}`;
  };

  const featured = items.slice(0, 2).map(describe).join("，");
  const remainder = items.length > 2 ? `等 ${items.length} 个文件` : "";
  return `${prefix}${featured}${remainder}`.slice(0, 120).trim();
}

function inspectCloudFile(filePath, size = 0) {
  const normalized = String(filePath || "").replace(/\\/g, "/");
  const lowerPath = normalized.toLowerCase();
  const fileName = lowerPath.split("/").pop() || lowerPath;
  const warnings = [];
  const suspiciousName =
    fileName === ".env" ||
    fileName.startsWith(".env.") ||
    ["id_rsa", "id_dsa", "id_ecdsa", "id_ed25519", "credentials.json", "service-account.json"].includes(fileName) ||
    /\.(?:pem|p12|pfx|key)$/.test(fileName) ||
    lowerPath.includes("/.ssh/") ||
    lowerPath.startsWith(".ssh/");
  if (suspiciousName) {
    warnings.push({
      type: "sensitive-path",
      severity: "review",
      path: normalized,
      message: "文件名看起来可能包含密钥、令牌或环境配置。",
    });
  }

  const bytes = Number(size) || 0;
  if (bytes > GITHUB_MAX_FILE_BYTES) {
    warnings.push({
      type: "oversized-file",
      severity: "block",
      path: normalized,
      size: bytes,
      message: "文件超过 GitHub 的 100 MB 单文件限制，必须先从版本历史中移除。",
    });
  } else if (bytes >= GITHUB_WARNING_FILE_BYTES) {
    warnings.push({
      type: "large-file",
      severity: "review",
      path: normalized,
      size: bytes,
      message: "这个文件较大，首次上传可能会很慢。",
    });
  }
  return warnings;
}

class GitService {
  constructor(projectPath, options = {}) {
    this.projectPath = path.resolve(projectPath);
    this.cloudScanCache = null;
    this.pendingSyncConflict = null;
    this.githubTokenProvider = options.githubTokenProvider || null;
    this.safeHooksPath = options.safeHooksPath || "";
  }

  async initialize() {
    this.projectPath = path.resolve(
      await fs.realpath(this.projectPath).catch(() => this.projectPath),
    );
    try {
      const { stdout } = await runGit(this.projectPath, ["rev-parse", "--show-toplevel"]);
      const repositoryRoot = path.resolve(stdout);
      if (!pathsEqual(repositoryRoot, this.projectPath)) {
        throw new ChronoDraftError(
          "PROJECT_INSIDE_REPOSITORY",
          "这个文件夹属于一个更大的版本项目。为避免保存或上传其他文件，请选择该项目的最外层文件夹，或选择一个独立文件夹。",
          `项目根目录：${repositoryRoot}`,
        );
      }
      this.projectPath = repositoryRoot;
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
      const safeUrl = sanitizeRemoteUrl(stdout);
      return {
        configured: true,
        url: safeUrl,
        displayUrl: cleanRemoteUrl(safeUrl),
      };
    } catch {
      return { configured: false, url: "", displayUrl: "" };
    }
  }

  async getNetworkGitOptions(remote = null) {
    const currentRemote = remote || (await this.getRemote());
    if (
      !this.githubTokenProvider ||
      !currentRemote.configured ||
      !/^https:\/\/github\.com\//i.test(currentRemote.url)
    ) {
      return { options: {}, authenticatedByApp: false };
    }
    const token = await this.githubTokenProvider({ optional: true });
    if (!token) return { options: {}, authenticatedByApp: false };
    return {
      options: {
        env: createGitHubAuthEnvironment(token, this.safeHooksPath),
      },
      authenticatedByApp: true,
    };
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

  async getStatus() {
    const { stdout } = await runGit(this.projectPath, [
      "status",
      "--porcelain=v2",
      "-z",
      "--untracked-files=all",
      "--ignored=matching",
    ]);
    return parsePorcelainStatus(stdout);
  }

  async getChanges() {
    return (await this.getStatus()).changes;
  }

  async getHistory(limit = 30, skip = 0) {
    try {
      const separator = "%x1f";
      const record = "%x1e";
      const pageSize = Math.min(Math.max(Number(limit) || 30, 1), 100);
      const offset = Math.max(Math.floor(Number(skip) || 0), 0);
      const { stdout } = await runGit(this.projectPath, [
        "log",
        `--max-count=${pageSize}`,
        `--skip=${offset}`,
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

  async getHistoryCount() {
    try {
      const { stdout } = await runGit(this.projectPath, ["rev-list", "--count", "HEAD"]);
      return Number(stdout) || 0;
    } catch {
      return 0;
    }
  }

  async getHistoryPage(options = {}) {
    const limit = Math.min(Math.max(Number(options.limit) || 30, 1), 100);
    const skip = Math.max(Math.floor(Number(options.skip) || 0), 0);
    const [items, total, milestoneHashes] = await Promise.all([
      this.getHistory(limit, skip),
      this.getHistoryCount(),
      this.getMilestoneHashes(),
    ]);
    const milestones = new Set(milestoneHashes);
    return {
      items: items.map((item) => ({ ...item, milestone: milestones.has(item.hash) })),
      total,
      hasMore: skip + items.length < total,
      nextSkip: skip + items.length,
    };
  }

  async getMilestoneHashes() {
    try {
      const { stdout } = await runGit(this.projectPath, [
        "for-each-ref",
        "--format=%(objectname)",
        MILESTONE_REF_PREFIX,
      ]);
      return stdout.split("\n").map((value) => value.trim()).filter(Boolean);
    } catch {
      return [];
    }
  }

  async isMilestone(hash) {
    const validHash = await this.assertVersion(hash);
    const hashes = await this.getMilestoneHashes();
    return hashes.includes(validHash);
  }

  async toggleMilestone(hash) {
    const validHash = await this.assertVersion(hash);
    const ref = `${MILESTONE_REF_PREFIX}/${validHash}`;
    let milestone = false;
    try {
      await runGit(this.projectPath, ["show-ref", "--verify", "--quiet", ref]);
      milestone = true;
    } catch {
      milestone = false;
    }

    if (milestone) {
      await runGit(this.projectPath, ["update-ref", "-d", ref]);
    } else {
      await runGit(this.projectPath, ["update-ref", ref, validHash]);
    }
    return { hash: validHash, milestone: !milestone };
  }

  async assertVersion(hash) {
    const validHash = String(hash || "");
    if (!/^[0-9a-f]{40}$/i.test(validHash)) {
      throw new ChronoDraftError("INVALID_VERSION", "没有找到这个历史版本。");
    }
    try {
      await runGit(this.projectPath, ["cat-file", "-e", `${validHash}^{commit}`]);
    } catch {
      throw new ChronoDraftError("INVALID_VERSION", "这个历史版本已不存在。");
    }
    return validHash;
  }

  async getVersionParent(hash) {
    try {
      return (await runGit(this.projectPath, ["rev-parse", `${hash}^`])).stdout;
    } catch {
      return EMPTY_TREE_HASH;
    }
  }

  async getVersionDetails(hash) {
    const validHash = await this.assertVersion(hash);
    const separator = "%x1f";
    const [metadata, changedFiles, milestone] = await Promise.all([
      runGit(this.projectPath, [
        "show",
        "-s",
        `--format=%H${separator}%h${separator}%s${separator}%an${separator}%aI`,
        validHash,
      ]),
      runGit(this.projectPath, [
        "diff-tree",
        "--root",
        "--no-commit-id",
        "--name-status",
        "-r",
        "-M",
        "-z",
        validHash,
      ]),
      this.isMilestone(validHash),
    ]);
    const [fullHash, shortHash, message, author, date] = metadata.stdout.split("\x1f");
    return {
      version: { hash: fullHash, shortHash, message, author, date, milestone },
      files: parseNameStatus(changedFiles.stdout),
    };
  }

  async getBlobSize(revision, filePath) {
    try {
      const { stdout } = await runGit(this.projectPath, [
        "cat-file",
        "-s",
        `${revision}:${filePath}`,
      ]);
      return Number(stdout) || 0;
    } catch {
      return 0;
    }
  }

  async getVersionDiff(hash, filePath) {
    const validHash = await this.assertVersion(hash);
    const details = await this.getVersionDetails(validHash);
    const file = details.files.find((entry) => entry.path === String(filePath || ""));
    if (!file) {
      throw new ChronoDraftError("INVALID_VERSION_FILE", "这个文件不属于所选版本的改动。");
    }

    const parent = await this.getVersionParent(validHash);
    const paths = [...new Set([file.originalPath, file.path].filter(Boolean))];
    const sizes = await Promise.all([
      this.getBlobSize(parent, file.originalPath || file.path),
      this.getBlobSize(validHash, file.path),
    ]);
    if (sizes[0] + sizes[1] > MAX_TEXT_DIFF_BYTES) {
      return { kind: "large", file, patch: "", size: Math.max(...sizes) };
    }

    const { stdout: patch } = await runGit(this.projectPath, [
      "diff",
      "--no-ext-diff",
      "--no-textconv",
      "--no-color",
      "--unified=3",
      parent,
      validHash,
      "--",
      ...paths,
    ]);
    if (/^Binary files |^GIT binary patch/m.test(patch)) {
      return { kind: "binary", file, patch: "", size: Math.max(...sizes) };
    }
    return {
      kind: /^@@/m.test(patch) ? "text" : "metadata",
      file,
      patch,
      size: Math.max(...sizes),
    };
  }

  async getAutoSnapshots(limit = AUTO_SNAPSHOT_MAX_COUNT) {
    const safeLimit = Math.min(Math.max(Number(limit) || AUTO_SNAPSHOT_MAX_COUNT, 1), 200);
    try {
      const { stdout } = await runGit(this.projectPath, [
        "for-each-ref",
        "--sort=-refname",
        `--count=${safeLimit}`,
        "--format=%(refname)%09%(objectname)%09%(objectname:short)%09%(subject)%09%(authorname)%09%(creatordate:iso-strict)",
        AUTO_SNAPSHOT_REF_PREFIX,
      ]);
      return stdout
        .split("\n")
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => {
          const [ref, hash, shortHash, message, author, date] = entry.split("\t");
          return {
            ref,
            hash,
            shortHash,
            message,
            author,
            date,
            snapshot: true,
          };
        });
    } catch {
      return [];
    }
  }

  async pruneAutoSnapshots(now = new Date(), options = {}) {
    const maxCount = Math.max(Number(options.maxCount) || AUTO_SNAPSHOT_MAX_COUNT, 1);
    const maxAgeMs = Math.max(Number(options.maxAgeMs) || AUTO_SNAPSHOT_MAX_AGE_MS, 1);
    const snapshots = await this.getAutoSnapshots(200);
    const cutoff = new Date(now).getTime() - maxAgeMs;
    const expired = snapshots.filter((snapshot, index) => {
      const createdAt = new Date(snapshot.date).getTime();
      return index >= maxCount || !Number.isFinite(createdAt) || createdAt < cutoff;
    });
    for (const snapshot of expired) {
      await runGit(this.projectPath, ["update-ref", "-d", snapshot.ref]);
    }
    return this.getAutoSnapshots(maxCount);
  }

  async createAutoSnapshot(options = {}) {
    const now = new Date(options.now || Date.now());
    const retainedSnapshots = await this.pruneAutoSnapshots(now, options);
    const changes = await this.getChanges();
    if (changes.length === 0) {
      return { created: false, reason: "no-changes", snapshots: retainedSnapshots };
    }
    if (changes.some((change) => change.type === "conflict")) {
      return { created: false, reason: "conflict", snapshots: retainedSnapshots };
    }

    const { stdout: originalTree } = await runGit(this.projectPath, ["write-tree"]);
    let snapshotTree = "";
    try {
      await runGit(this.projectPath, ["add", "-A"]);
      snapshotTree = (await runGit(this.projectPath, ["write-tree"])).stdout;
    } finally {
      await runGit(this.projectPath, ["read-tree", originalTree]);
    }

    const currentSnapshots = retainedSnapshots;
    if (currentSnapshots[0]) {
      const { stdout: latestTree } = await runGit(this.projectPath, [
        "rev-parse",
        `${currentSnapshots[0].hash}^{tree}`,
      ]);
      if (latestTree === snapshotTree) {
        return { created: false, reason: "unchanged", snapshots: currentSnapshots };
      }
    }

    let head = "";
    try {
      head = (await runGit(this.projectPath, ["rev-parse", "--verify", "HEAD"])).stdout;
    } catch {
      head = "";
    }
    const identity = await this.getIdentity();
    const message = suggestVersionMessage(changes, "自动保护：");
    const commitArgs = ["commit-tree", snapshotTree];
    if (head) commitArgs.push("-p", head);
    commitArgs.push("-m", message);
    const snapshotDate = now.toISOString();
    const { stdout: hash } = await runGit(this.projectPath, commitArgs, {
      env: {
        GIT_AUTHOR_NAME: identity.name || "ChronoDraft 自动保护",
        GIT_AUTHOR_EMAIL: identity.email || "autosave@chronodraft.local",
        GIT_COMMITTER_NAME: identity.name || "ChronoDraft 自动保护",
        GIT_COMMITTER_EMAIL: identity.email || "autosave@chronodraft.local",
        GIT_AUTHOR_DATE: snapshotDate,
        GIT_COMMITTER_DATE: snapshotDate,
      },
    });
    const ref = `${AUTO_SNAPSHOT_REF_PREFIX}/${now.getTime()}-${snapshotTree.slice(0, 8)}`;
    await runGit(this.projectPath, ["update-ref", ref, hash]);
    const snapshots = await this.pruneAutoSnapshots(now, options);
    return {
      created: true,
      reason: "created",
      snapshot: snapshots.find((item) => item.hash === hash) || snapshots[0],
      snapshots,
    };
  }

  async getCloudObjectInventory() {
    let objectList = "";
    try {
      objectList = (await runGit(this.projectPath, ["rev-list", "--objects", "HEAD"])).stdout;
    } catch {
      return [];
    }
    const objectPaths = new Map();
    for (const line of objectList.split("\n")) {
      const separator = line.indexOf(" ");
      const hash = separator === -1 ? line : line.slice(0, separator);
      const filePath = separator === -1 ? "" : line.slice(separator + 1);
      if (/^[0-9a-f]{40}$/i.test(hash) && !objectPaths.has(hash)) {
        objectPaths.set(hash, filePath);
      }
    }
    const hashes = [...objectPaths.keys()];
    if (hashes.length === 0) return [];

    const { stdout } = await runGitWithInput(
      this.projectPath,
      ["cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"],
      `${hashes.join("\n")}\n`,
      { maxBuffer: 25 * 1024 * 1024 },
    );
    return stdout
      .split("\n")
      .map((line) => line.trim().split(/\s+/))
      .filter(([, type]) => type === "blob")
      .map(([hash, , size]) => ({
        hash,
        path: objectPaths.get(hash) || "版本历史中的文件",
        size: Number(size) || 0,
      }));
  }

  async getHistoricalPaths() {
    try {
      const { stdout } = await runGit(this.projectPath, [
        "log",
        "--format=",
        "--name-only",
        "-z",
        "HEAD",
      ]);
      return [...new Set(stdout.split("\0").map((filePath) => filePath.trim()).filter(Boolean))];
    } catch {
      return [];
    }
  }

  async findSecretPathsInHistory() {
    let commits = [];
    try {
      const { stdout } = await runGit(this.projectPath, ["rev-list", "HEAD"]);
      commits = stdout.split("\n").filter(Boolean);
    } catch {
      return [];
    }

    const matchedPaths = new Set();
    const batchSize = 64;
    for (let index = 0; index < commits.length; index += batchSize) {
      const batch = commits.slice(index, index + batchSize);
      const { stdout } = await runGit(
        this.projectPath,
        ["grep", "-I", "-l", "-E", "-e", SECRET_CONTENT_PATTERN, ...batch, "--"],
        { allowedExitCodes: [1] },
      );
      for (const line of stdout.split("\n").filter(Boolean)) {
        const match = line.match(/^[0-9a-f]{40}:(.*)$/i);
        matchedPaths.add(match ? match[1] : line);
      }
    }
    return [...matchedPaths];
  }

  async getCloudPreflight() {
    let head = "";
    try {
      head = (await runGit(this.projectPath, ["rev-parse", "--verify", "HEAD"])).stdout;
    } catch {
      return {
        head: "",
        versions: 0,
        files: 0,
        warnings: [],
        blockers: [],
        checkedAt: new Date().toISOString(),
      };
    }
    if (this.cloudScanCache?.head === head) return this.cloudScanCache;

    const [inventory, historicalPaths, secretPaths, versions] = await Promise.all([
      this.getCloudObjectInventory(),
      this.getHistoricalPaths(),
      this.findSecretPathsInHistory(),
      this.getHistoryCount(),
    ]);
    const issues = [];
    for (const filePath of historicalPaths) issues.push(...inspectCloudFile(filePath));
    for (const file of inventory) {
      issues.push(...inspectCloudFile(file.path, file.size).filter((issue) => issue.size));
    }
    for (const filePath of secretPaths) {
      issues.push({
        type: "secret-content",
        severity: "review",
        path: filePath,
        message: "这个文件的版本历史中疑似出现过访问令牌或私钥。",
      });
    }

    const uniqueIssues = [...new Map(
      issues.map((issue) => [`${issue.type}\0${issue.path}\0${issue.size || 0}`, issue]),
    ).values()];
    const result = {
      head,
      versions,
      files: historicalPaths.length,
      warnings: uniqueIssues.filter((issue) => issue.severity === "review"),
      blockers: uniqueIssues.filter((issue) => issue.severity === "block"),
      checkedAt: new Date().toISOString(),
    };
    this.cloudScanCache = result;
    return result;
  }

  async getCommitSummary(revision) {
    const separator = "%x1f";
    const { stdout } = await runGit(this.projectPath, [
      "show",
      "-s",
      `--format=%H${separator}%h${separator}%s${separator}%an${separator}%aI`,
      revision,
    ]);
    const [hash, shortHash, message, author, date] = stdout.split("\x1f");
    return { hash, shortHash, message, author, date };
  }

  async getBlobInfo(revision, filePath) {
    try {
      const { stdout } = await runGit(this.projectPath, [
        "ls-tree",
        "-z",
        revision,
        "--",
        literalPathspec(filePath),
      ]);
      const separator = stdout.indexOf("\t");
      if (separator === -1) return { exists: false, size: 0, hash: "", mode: "", type: "" };
      const [mode, type, hash] = stdout.slice(0, separator).split(/\s+/);
      const listedPath = stdout.slice(separator + 1).replace(/\0$/, "");
      if (listedPath !== filePath) {
        return { exists: false, size: 0, hash: "", mode: "", type: "" };
      }
      return {
        exists: true,
        size: type === "blob" ? await this.getBlobSize(revision, filePath) : 0,
        hash,
        mode,
        type,
      };
    } catch {
      return { exists: false, size: 0, hash: "", mode: "", type: "" };
    }
  }

  async getUnmergedPaths() {
    try {
      const { stdout } = await runGit(this.projectPath, [
        "diff",
        "--name-only",
        "--diff-filter=U",
        "-z",
      ]);
      return [...new Set(stdout.split("\0").filter(Boolean))];
    } catch {
      return [];
    }
  }

  async describeSyncConflict(paths, localRevision, remoteRevision, counts = {}) {
    const [local, remote, files] = await Promise.all([
      this.getCommitSummary(localRevision),
      this.getCommitSummary(remoteRevision),
      Promise.all(
        paths.map(async (filePath) => {
          const [localFile, remoteFile] = await Promise.all([
            this.getBlobInfo(localRevision, filePath),
            this.getBlobInfo(remoteRevision, filePath),
          ]);
          return {
            path: filePath,
            localExists: localFile.exists,
            localSize: localFile.size,
            remoteExists: remoteFile.exists,
            remoteSize: remoteFile.size,
          };
        }),
      ),
    ]);
    return {
      files,
      local,
      remote,
      ahead: Number(counts.ahead) || 0,
      behind: Number(counts.behind) || 0,
      worktreePreserved: true,
    };
  }

  getSafeWorktreePath(filePath) {
    const normalized = String(filePath || "").replace(/\\/g, "/");
    const segments = normalized.split("/");
    if (
      !normalized ||
      path.posix.isAbsolute(normalized) ||
      segments.some((segment) => !segment || segment === "." || segment === ".." || segment.includes("\0"))
    ) {
      throw new ChronoDraftError(
        "UNSAFE_CONFLICT_PATH",
        "这个冲突文件的路径无法安全处理，请先在项目文件夹中手动整理。",
      );
    }
    const destination = path.resolve(this.projectPath, ...segments);
    const relative = path.relative(this.projectPath, destination);
    if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new ChronoDraftError(
        "UNSAFE_CONFLICT_PATH",
        "这个冲突文件的路径超出了项目范围，ChronoDraft 已停止处理。",
      );
    }
    return { normalized, segments, destination };
  }

  async ensureSafeParent(filePath) {
    const safePath = this.getSafeWorktreePath(filePath);
    const createdDirectories = [];
    let current = this.projectPath;
    for (const segment of safePath.segments.slice(0, -1)) {
      current = path.join(current, segment);
      try {
        const stat = await fs.lstat(current);
        if (stat.isSymbolicLink() || !stat.isDirectory()) {
          throw new ChronoDraftError(
            "UNSAFE_CONFLICT_PATH",
            "云端副本所在的文件夹不是普通目录，ChronoDraft 已停止处理。",
            filePath,
          );
        }
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        await fs.mkdir(current);
        createdDirectories.push(current);
      }
    }
    return { ...safePath, createdDirectories };
  }

  async isWorktreePathOccupied(filePath) {
    const { destination } = this.getSafeWorktreePath(filePath);
    try {
      await fs.lstat(destination);
      return true;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    const { stdout } = await runGit(this.projectPath, [
      "ls-files",
      "--stage",
      "-z",
      "--",
      literalPathspec(filePath),
    ]);
    return Boolean(stdout);
  }

  async findAvailableRemoteCopyPath(filePath) {
    for (let sequence = 1; sequence <= 999; sequence += 1) {
      const candidate = suggestRemoteCopyPath(filePath, sequence);
      if (!(await this.isWorktreePathOccupied(candidate))) return candidate;
    }
    throw new ChronoDraftError(
      "CONFLICT_COPY_NAME_EXHAUSTED",
      "同名的云端副本太多，ChronoDraft 没有覆盖任何文件，请先整理项目文件夹。",
    );
  }

  async rollbackConflictResolution(localRevision, createdFiles, createdDirectories, cause) {
    let recoveryDetail = "";
    try {
      await runGit(this.projectPath, ["merge", "--abort"]);
    } catch (abortError) {
      recoveryDetail = abortError.detail || "";
      await runGit(this.projectPath, ["reset", "--merge", localRevision]).catch((resetError) => {
        recoveryDetail = `${recoveryDetail}\n${resetError.detail || ""}`.trim();
      });
    }
    for (const destination of [...createdFiles].reverse()) {
      await fs.unlink(destination).catch((error) => {
        if (error.code !== "ENOENT") recoveryDetail = `${recoveryDetail}\n${error.message}`.trim();
      });
    }
    for (const directory of [...createdDirectories].reverse()) {
      await fs.rmdir(directory).catch((error) => {
        if (error.code !== "ENOENT" && error.code !== "ENOTEMPTY") {
          recoveryDetail = `${recoveryDetail}\n${error.message}`.trim();
        }
      });
    }

    let restored = false;
    try {
      const currentHead = (await runGit(this.projectPath, ["rev-parse", "HEAD"])).stdout;
      const changes = await this.getChanges();
      const mergeState = await runGit(
        this.projectPath,
        ["rev-parse", "--quiet", "--verify", "MERGE_HEAD"],
        { allowedExitCodes: [1] },
      );
      restored = currentHead === localRevision && changes.length === 0 && !mergeState.stdout;
    } catch (error) {
      recoveryDetail = `${recoveryDetail}\n${error.detail || error.message || ""}`.trim();
    }
    if (!restored) {
      throw new ChronoDraftError(
        "SYNC_RECOVERY_FAILED",
        "冲突处理已停止，但项目没有完全回到操作前状态。请不要继续修改，并打开项目文件夹检查。",
        redactSensitiveText(recoveryDetail || cause?.detail || cause?.message || ""),
      );
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
    const [status, historyPage, snapshots, remote, identity, branch, sync] = await Promise.all([
      this.getStatus(),
      this.getHistoryPage(),
      this.getAutoSnapshots(),
      this.getRemote(),
      this.getIdentity(),
      this.getBranch(),
      this.getSyncState(),
    ]);
    return {
      projectPath: this.projectPath,
      projectName: path.basename(this.projectPath),
      changes: status.changes,
      ignored: status.ignored,
      history: historyPage.items,
      historyTotal: historyPage.total,
      snapshots,
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

  async sync(options = {}) {
    this.pendingSyncConflict = null;
    const remote = await this.getRemote();
    if (!remote.configured) {
      return {
        pushed: false,
        reason: "no-remote",
        message: "版本已安全保存在本机。连接 GitHub 后即可同步到云端。",
      };
    }

    const pendingChanges = await this.getChanges();

    const preflight = await this.getCloudPreflight();
    if (preflight.blockers.length > 0) {
      return {
        pushed: false,
        reason: "upload-blocked",
        message: "本地版本已经保存，但有文件超过 GitHub 限制，暂时不能上传。",
        preflight,
      };
    }
    if (preflight.warnings.length > 0 && !options.allowWarnings) {
      return {
        pushed: false,
        reason: "review-required",
        message: "本地版本已经保存；上传前需要确认可能包含私密信息的文件。",
        preflight,
      };
    }

    const branch = await this.getBranch();
    let authenticatedByApp = false;
    try {
      const network = await this.getNetworkGitOptions(remote);
      authenticatedByApp = network.authenticatedByApp;
      const { stdout: remoteBranch } = await runGit(this.projectPath, [
        "ls-remote",
        "--heads",
        "origin",
        `refs/heads/${branch}`,
      ], network.options);

      if (!remoteBranch) {
        await runGit(
          this.projectPath,
          ["push", ...(authenticatedByApp ? ["--no-verify"] : []), "-u", "origin", branch],
          network.options,
        );
        return { pushed: true, reason: "synced", message: "已保存，并安全同步到 GitHub。" };
      }

      await runGit(this.projectPath, ["fetch", "origin", branch], network.options);
      let ahead = 0;
      let behind = 0;
      try {
        const { stdout } = await runGit(this.projectPath, [
          "rev-list",
          "--left-right",
          "--count",
          `HEAD...origin/${branch}`,
        ]);
        [ahead, behind] = stdout.split(/\s+/).map((value) => Number(value) || 0);
      } catch {
        ahead = 0;
        behind = 0;
      }

      if (behind > 0 && pendingChanges.length > 0) {
        return {
          pushed: false,
          reason: "unsaved-changes",
          message: "云端有较新的版本，而本机还有未保存修改。请先保存新版本，再继续同步。",
        };
      }

      if (behind > 0) {
        const localHead = (await runGit(this.projectPath, ["rev-parse", "HEAD"])).stdout;
        const remoteRevision = `origin/${branch}`;
        try {
          await runGit(this.projectPath, ["rebase", remoteRevision]);
        } catch (error) {
          const conflictPaths = await this.getUnmergedPaths();
          try {
            await runGit(this.projectPath, ["rebase", "--abort"]);
          } catch (abortError) {
            throw new ChronoDraftError(
              "SYNC_RECOVERY_FAILED",
              "同步已暂停，但 Git 没有自动恢复到同步前状态。请不要继续修改，并打开项目文件夹检查。",
              abortError.detail || error.detail,
            );
          }
          const restoredHead = (await runGit(this.projectPath, ["rev-parse", "HEAD"])).stdout;
          if (restoredHead !== localHead) {
            throw new ChronoDraftError(
              "SYNC_RECOVERY_FAILED",
              "同步已暂停，但项目没有回到同步前的版本。请不要继续修改，并打开项目文件夹检查。",
              error.detail,
            );
          }
          if (conflictPaths.length === 0) throw error;
          const conflict = await this.describeSyncConflict(
            conflictPaths,
            localHead,
            remoteRevision,
            { ahead, behind },
          );
          this.pendingSyncConflict = conflict;
          throw new ChronoDraftError(
            "SYNC_CONFLICT",
            "本地版本已经保存，但与云端内容有冲突。ChronoDraft 已恢复到同步前状态，没有覆盖任何文件。",
            error.detail,
            { conflict },
          );
        }
      }

      await runGit(
        this.projectPath,
        ["push", ...(authenticatedByApp ? ["--no-verify"] : []), "-u", "origin", branch],
        network.options,
      );
      return { pushed: true, reason: "synced", message: "已保存，并安全同步到 GitHub。" };
    } catch (error) {
      if (
        authenticatedByApp &&
        /(?:403|repository not found|write access.*not granted|permission.*denied)/i.test(
          `${error.detail || ""} ${error.message || ""}`,
        )
      ) {
        error = new ChronoDraftError(
          "GITHUB_APP_REPOSITORY_ACCESS_REQUIRED",
          "ChronoDraft 已登录 GitHub，但还没有获得这个仓库的写入权限。请先授权该仓库再同步。",
          error.detail || "",
        );
      }
      return {
        pushed: false,
        reason: error.code || "push-failed",
        message: `版本已安全保存在本机；${error.message}`,
        detail: error.detail || "",
        conflict: error.data?.conflict || null,
      };
    }
  }

  async resolveSyncConflict(options = {}) {
    const requestedLocal = String(options.localHash || "");
    const requestedRemote = String(options.remoteHash || "");
    const pending = this.pendingSyncConflict;
    if (
      !pending ||
      pending.local?.hash !== requestedLocal ||
      pending.remote?.hash !== requestedRemote
    ) {
      throw new ChronoDraftError(
        "SYNC_CONFLICT_STALE",
        "这条冲突信息已经过期。请重新同步并查看最新内容后再处理。",
      );
    }

    const [localRevision, remoteRevision] = await Promise.all([
      this.assertVersion(requestedLocal),
      this.assertVersion(requestedRemote),
    ]);
    const currentHead = (await runGit(this.projectPath, ["rev-parse", "HEAD"])).stdout;
    if (currentHead !== localRevision) {
      throw new ChronoDraftError(
        "SYNC_CONFLICT_STALE",
        "本机版本已经发生变化。ChronoDraft 没有处理旧冲突，请重新同步后再确认。",
      );
    }
    if ((await this.getChanges()).length > 0) {
      throw new ChronoDraftError(
        "SYNC_CONFLICT_WORKTREE_CHANGED",
        "项目中出现了新的未保存修改。请先保存一个版本，再重新同步处理冲突。",
      );
    }

    const remote = await this.getRemote();
    if (!remote.configured) {
      throw new ChronoDraftError(
        "SYNC_CONFLICT_STALE",
        "GitHub 仓库连接已经改变，ChronoDraft 没有处理旧冲突。",
      );
    }
    const branch = await this.getBranch();
    const network = await this.getNetworkGitOptions(remote);
    await runGit(this.projectPath, ["fetch", "origin", branch], network.options);
    const latestRemote = (
      await runGit(this.projectPath, ["rev-parse", `origin/${branch}`])
    ).stdout;
    if (latestRemote !== remoteRevision) {
      throw new ChronoDraftError(
        "SYNC_CONFLICT_STALE",
        "云端在你确认前又有了新版本。ChronoDraft 没有处理旧冲突，请重新同步后再查看。",
      );
    }

    const createdFiles = [];
    const createdDirectories = [];
    const resolutionFiles = [];
    try {
      let mergeError = null;
      try {
        await runGit(this.projectPath, ["merge", "--no-commit", "--no-ff", remoteRevision]);
      } catch (error) {
        mergeError = error;
      }

      const currentConflictPaths = await this.getUnmergedPaths();
      if (mergeError && currentConflictPaths.length === 0) throw mergeError;
      const pathsToPreserve = [
        ...new Set([
          ...pending.files.map((file) => file.path),
          ...currentConflictPaths,
        ]),
      ];
      if (pathsToPreserve.length === 0) {
        throw new ChronoDraftError(
          "SYNC_CONFLICT_STALE",
          "没有再次找到需要处理的冲突。项目将保持原样，请重新同步。",
        );
      }

      for (const filePath of pathsToPreserve) {
        this.getSafeWorktreePath(filePath);
        const [localFile, remoteFile] = await Promise.all([
          this.getBlobInfo(localRevision, filePath),
          this.getBlobInfo(remoteRevision, filePath),
        ]);
        if (
          (localFile.exists && localFile.type !== "blob") ||
          (remoteFile.exists && remoteFile.type !== "blob")
        ) {
          throw new ChronoDraftError(
            "UNSUPPORTED_CONFLICT_FILE",
            "这个冲突包含子模块或特殊目录，ChronoDraft 没有自动修改，请在项目文件夹中手动处理。",
            filePath,
          );
        }

        if (localFile.exists) {
          await runGit(this.projectPath, [
            "restore",
            "--source",
            localRevision,
            "--staged",
            "--worktree",
            "--",
            literalPathspec(filePath),
          ]);
        } else {
          await runGit(this.projectPath, [
            "rm",
            "-f",
            "--ignore-unmatch",
            "--",
            literalPathspec(filePath),
          ]);
        }

        let remoteCopyPath = null;
        if (remoteFile.exists) {
          remoteCopyPath = await this.findAvailableRemoteCopyPath(filePath);
          const safeCopy = await this.ensureSafeParent(remoteCopyPath);
          createdDirectories.push(...safeCopy.createdDirectories);
          await writeGitBlobExclusive(this.projectPath, remoteFile.hash, safeCopy.destination);
          createdFiles.push(safeCopy.destination);
          await fs.chmod(safeCopy.destination, remoteFile.mode === "100755" ? 0o755 : 0o644);
          await runGit(this.projectPath, ["add", "--", literalPathspec(remoteCopyPath)]);
        }
        resolutionFiles.push({
          path: filePath,
          localKept: localFile.exists,
          remoteCopyPath,
        });
      }

      const unresolved = await this.getUnmergedPaths();
      if (unresolved.length > 0) {
        throw new ChronoDraftError(
          "CONFLICT_RESOLUTION_INCOMPLETE",
          "仍有文件无法安全生成双副本，项目已经恢复到处理前状态。",
          unresolved.join("\n"),
        );
      }
      await runGit(this.projectPath, [
        "commit",
        "-m",
        "整合云端版本（冲突内容已保留为副本）",
      ]);
    } catch (error) {
      await this.rollbackConflictResolution(
        localRevision,
        createdFiles,
        [...new Set(createdDirectories)],
        error,
      );
      throw error;
    }

    this.pendingSyncConflict = null;
    const mergeRevision = (await runGit(this.projectPath, ["rev-parse", "HEAD"])).stdout;
    const mergeCommit = await this.getCommitSummary(mergeRevision);
    const sync = await this.sync();
    return {
      resolution: {
        files: resolutionFiles,
        copies: resolutionFiles
          .map((file) => file.remoteCopyPath)
          .filter(Boolean),
        mergeCommit,
      },
      sync,
      overview: await this.getOverview(),
    };
  }

  async saveVersion(message) {
    const commit = await this.commit(message);
    const sync = await this.sync();
    return { commit, sync, overview: await this.getOverview() };
  }

  async syncExisting(options = {}) {
    const history = await this.getHistory(1);
    if (history.length === 0) {
      throw new ChronoDraftError("NO_VERSIONS", "请先保存一个本地版本，再同步到 GitHub。");
    }
    const sync = await this.sync(options);
    return { sync, overview: await this.getOverview() };
  }

  async restoreVersion(hash) {
    const validHash = await this.assertVersion(hash);

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
      sync,
      overview: await this.getOverview(),
    };
  }
}

module.exports = {
  checkGit,
  ChronoDraftError,
  GitService,
  cleanRemoteUrl,
  createGitHubAuthEnvironment,
  inspectCloudFile,
  parsePorcelainStatus,
  parsePorcelainV2,
  parseNameStatus,
  redactSensitiveText,
  sanitizeRemoteUrl,
  suggestVersionMessage,
  validateRemoteUrl,
};
