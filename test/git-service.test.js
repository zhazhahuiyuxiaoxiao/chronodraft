const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { promisify } = require("node:util");
const test = require("node:test");

const {
  checkGit,
  cleanRemoteUrl,
  GitService,
  inspectCloudFile,
  parsePorcelainStatus,
  parsePorcelainV2,
  parseNameStatus,
  redactSensitiveText,
  sanitizeRemoteUrl,
  suggestVersionMessage,
  validateRemoteUrl,
} = require("../src/git-service");
const { ProjectSession } = require("../src/project-session");

const execFileAsync = promisify(execFile);

test("detects the system Git used by ChronoDraft", async () => {
  const result = await checkGit();
  assert.equal(result.installed, true);
  assert.match(result.version, /^\d+(?:\.\d+)+/);
});

test("reports a missing Git executable without exposing a command error", async () => {
  const modulePath = path.join(__dirname, "..", "src", "git-service.js");
  const script = `const { checkGit } = require(${JSON.stringify(modulePath)}); checkGit(["/chronodraft-test-path-without-git"]).then((result) => process.stdout.write(JSON.stringify(result)));`;
  const { stdout } = await execFileAsync(process.execPath, ["-e", script], {
    env: { ...process.env, PATH: "/chronodraft-test-path-without-git" },
  });
  assert.deepEqual(JSON.parse(stdout), { installed: false, version: "" });
});

test("keeps the current project when switching to another project fails", async () => {
  const services = {
    current: {
      id: "current",
      initialize: async () => ({ projectPath: "/writing/current" }),
    },
    broken: {
      id: "broken",
      initialize: async () => {
        throw new Error("cannot initialize");
      },
    },
    unpersisted: {
      id: "unpersisted",
      initialize: async () => ({ projectPath: "/writing/unpersisted" }),
    },
  };
  const session = new ProjectSession((projectPath) => services[projectPath]);

  await session.open("current");
  assert.equal(session.requireProject().id, "current");

  await assert.rejects(() => session.open("broken"), /cannot initialize/);
  assert.equal(session.requireProject().id, "current");

  await assert.rejects(
    () =>
      session.open("unpersisted", async () => {
        throw new Error("cannot save selection");
      }),
    /cannot save selection/,
  );
  assert.equal(session.requireProject().id, "current");
});

test("rejects a selected folder that belongs to a larger Git repository", async (t) => {
  const parentPath = await fs.mkdtemp(path.join(os.tmpdir(), "chronodraft-parent-test-"));
  const childPath = path.join(parentPath, "writing");
  t.after(() => fs.rm(parentPath, { recursive: true, force: true }));
  await fs.mkdir(childPath);
  await execFileAsync("git", ["init", "-b", "main", parentPath]);

  const childService = new GitService(childPath);
  await assert.rejects(
    () => childService.initialize(),
    (error) => {
      assert.equal(error.code, "PROJECT_INSIDE_REPOSITORY");
      assert.match(error.message, /更大的版本项目/);
      assert.match(error.detail, /项目根目录/);
      return true;
    },
  );
  assert.equal(childService.projectPath, await fs.realpath(childPath));

  const rootService = new GitService(parentPath);
  const overview = await rootService.initialize();
  assert.equal(overview.projectPath, await fs.realpath(parentPath));
});

async function makeProject() {
  const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "chronodraft-test-"));
  const service = new GitService(projectPath);
  await service.initialize();
  await service.setIdentity("ChronoDraft Test", "chronodraft@example.com");
  return { projectPath, service };
}

async function write(projectPath, name, content) {
  await fs.writeFile(path.join(projectPath, name), content, "utf8");
}

test("validates GitHub remotes without accepting embedded credentials", () => {
  assert.equal(
    validateRemoteUrl("https://github.com/example/my-writing.git"),
    "https://github.com/example/my-writing.git",
  );
  assert.equal(
    validateRemoteUrl("git@github.com:example/my-writing.git"),
    "git@github.com:example/my-writing.git",
  );
  assert.throws(
    () => validateRemoteUrl("https://secret@github.com/example/repo.git"),
    /格式不正确/,
  );
  assert.throws(() => validateRemoteUrl("https://gitlab.com/example/repo.git"), /格式不正确/);
});

test("removes credentials before remote URLs or Git errors reach the renderer", async (t) => {
  const credentialUrl = "https://writer:ghp_example_secret_value_123456@github.com/example/repo.git";
  assert.equal(
    sanitizeRemoteUrl(credentialUrl),
    "https://github.com/example/repo.git",
  );
  assert.equal(cleanRemoteUrl(credentialUrl), "https://github.com/example/repo");

  const detail = redactSensitiveText(
    `fatal: unable to access '${credentialUrl}'; token ghp_example_secret_value_123456`,
  );
  assert.doesNotMatch(detail, /ghp_example_secret_value_123456|writer/);

  const { projectPath, service } = await makeProject();
  t.after(() => fs.rm(projectPath, { recursive: true, force: true }));
  await execFileAsync("git", ["-C", projectPath, "remote", "add", "origin", credentialUrl]);

  assert.deepEqual(await service.getRemote(), {
    configured: true,
    url: "https://github.com/example/repo.git",
    displayUrl: "https://github.com/example/repo",
  });
});

test("parses ordinary, untracked and renamed porcelain records", () => {
  const fixture = [
    "1 .M N... 100644 100644 100644 abc abc chapter one.md",
    "? notes.txt",
    "2 R. N... 100644 100644 100644 abc def R100 new name.md",
    "old name.md",
    "",
  ].join("\0");
  assert.deepEqual(parsePorcelainV2(fixture), [
    { code: ".M", type: "modified", path: "chapter one.md", originalPath: null },
    { code: "??", type: "added", path: "notes.txt", originalPath: null },
    {
      code: "R.",
      type: "renamed",
      path: "new name.md",
      originalPath: "old name.md",
    },
  ]);
});

test("reports paths excluded by Git ignore rules", async (t) => {
  const { projectPath, service } = await makeProject();
  t.after(() => fs.rm(projectPath, { recursive: true, force: true }));
  await write(projectPath, ".gitignore", "private.txt\ncache/\n");
  await write(projectPath, "private.txt", "not protected");
  await fs.mkdir(path.join(projectPath, "cache"));
  await write(path.join(projectPath, "cache"), "generated.txt", "temporary");

  const overview = await service.getOverview();
  assert.deepEqual(overview.changes.map((change) => change.path), [".gitignore"]);
  assert.deepEqual(overview.ignored, [
    { path: "cache/", kind: "directory" },
    { path: "private.txt", kind: "file" },
  ]);

  const parsed = parsePorcelainStatus("! ignored folder/\0? draft.md\0");
  assert.deepEqual(parsed, {
    changes: [{ code: "??", type: "added", path: "draft.md", originalPath: null }],
    ignored: [{ path: "ignored folder/", kind: "directory" }],
  });
});

test("initializes a folder and saves local versions", async (t) => {
  const { projectPath, service } = await makeProject();
  t.after(() => fs.rm(projectPath, { recursive: true, force: true }));

  await write(projectPath, "chapter.md", "# 第一章\n");
  const before = await service.getOverview();
  assert.equal(before.changes.length, 1);
  assert.equal(before.changes[0].type, "added");

  const result = await service.saveVersion("完成第一章");
  assert.equal(result.commit.message, "完成第一章");
  assert.equal(result.sync.pushed, false);
  assert.equal(result.sync.reason, "no-remote");
  assert.equal(result.overview.changes.length, 0);
  assert.equal(result.overview.history.length, 1);
});

test("suggests concise writing-oriented version messages", () => {
  assert.equal(
    suggestVersionMessage([
      { type: "modified", path: "第三章/案例分析.md" },
      { type: "added", path: "参考文献/访谈记录.md" },
      { type: "deleted", path: "旧提纲.txt" },
    ]),
    "更新《案例分析.md》，新增《访谈记录.md》等 3 个文件",
  );
  assert.equal(
    suggestVersionMessage([
      { type: "renamed", path: "定稿.md", originalPath: "草稿.md" },
    ]),
    "将《草稿.md》改名为《定稿.md》",
  );
});

test("creates and prunes local auto snapshots without changing the index or main history", async (t) => {
  const { projectPath, service } = await makeProject();
  t.after(() => fs.rm(projectPath, { recursive: true, force: true }));

  await write(projectPath, "draft.md", "正式版本\n");
  await service.commit("建立初稿");
  await write(projectPath, "draft.md", "已经暂存的修改\n");
  await execFileAsync("git", ["-C", projectPath, "add", "draft.md"]);
  await write(projectPath, "draft.md", "尚未暂存的新修改\n");
  await write(projectPath, "notes.txt", "临时灵感\n");

  const statusBefore = await execFileAsync("git", [
    "-C",
    projectPath,
    "status",
    "--porcelain=v2",
    "-z",
  ]);
  const indexBefore = await execFileAsync("git", [
    "-C",
    projectPath,
    "diff",
    "--cached",
    "--binary",
  ]);
  const first = await service.createAutoSnapshot({
    now: "2026-08-03T08:00:00.000Z",
    maxCount: 2,
  });
  assert.equal(first.created, true);
  assert.equal(first.snapshot.snapshot, true);
  assert.match(first.snapshot.message, /^自动保护：/);
  assert.equal((await service.getHistoryCount()), 1);

  const statusAfter = await execFileAsync("git", [
    "-C",
    projectPath,
    "status",
    "--porcelain=v2",
    "-z",
  ]);
  const indexAfter = await execFileAsync("git", [
    "-C",
    projectPath,
    "diff",
    "--cached",
    "--binary",
  ]);
  assert.equal(statusAfter.stdout, statusBefore.stdout);
  assert.equal(indexAfter.stdout, indexBefore.stdout);

  const details = await service.getVersionDetails(first.snapshot.hash);
  assert.deepEqual(details.files.map((file) => file.path), ["draft.md", "notes.txt"]);
  const unchanged = await service.createAutoSnapshot({
    now: "2026-08-03T08:01:00.000Z",
    maxCount: 2,
  });
  assert.equal(unchanged.reason, "unchanged");

  await write(projectPath, "notes.txt", "第二条临时灵感\n");
  await service.createAutoSnapshot({ now: "2026-08-03T08:02:00.000Z", maxCount: 2 });
  await write(projectPath, "notes.txt", "第三条临时灵感\n");
  const third = await service.createAutoSnapshot({
    now: "2026-08-03T08:03:00.000Z",
    maxCount: 2,
  });
  assert.equal(third.snapshots.length, 2);
  assert.equal(third.snapshots.some((snapshot) => snapshot.hash === first.snapshot.hash), false);

  const olderSnapshot = third.snapshots[1];
  await write(projectPath, "notes.txt", "恢复前的第四条灵感\n");
  const restored = await service.restoreVersion(olderSnapshot.hash);
  assert.equal(restored.changed, true);
  assert.equal(await fs.readFile(path.join(projectPath, "notes.txt"), "utf8"), "第二条临时灵感\n");
});

test("protects a new project before author information or the first formal version exists", async (t) => {
  const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "chronodraft-first-snapshot-"));
  t.after(() => fs.rm(projectPath, { recursive: true, force: true }));
  const service = new GitService(projectPath);
  await service.initialize();
  await execFileAsync("git", ["-C", projectPath, "config", "user.name", ""]);
  await execFileAsync("git", ["-C", projectPath, "config", "user.email", ""]);
  await write(projectPath, "idea.md", "还没有正式保存的灵感\n");

  const result = await service.createAutoSnapshot({ now: "2026-08-03T09:00:00.000Z" });
  assert.equal(result.created, true);
  assert.equal(await service.getHistoryCount(), 0);
  assert.equal(result.snapshot.author, "ChronoDraft 自动保护");
  assert.deepEqual((await service.getVersionDetails(result.snapshot.hash)).files.map((file) => file.path), [
    "idea.md",
  ]);
  assert.equal((await service.getOverview()).changes.length, 1);
});

test("marks and unmarks formal versions as milestones without rewriting history", async (t) => {
  const { projectPath, service } = await makeProject();
  t.after(() => fs.rm(projectPath, { recursive: true, force: true }));

  await write(projectPath, "draft.md", "第一章\n");
  const version = await service.commit("完成第一章");
  const headBefore = (await execFileAsync("git", ["-C", projectPath, "rev-parse", "HEAD"])).stdout;

  assert.equal((await service.getHistoryPage()).items[0].milestone, false);
  assert.deepEqual(await service.toggleMilestone(version.hash), {
    hash: version.hash,
    milestone: true,
  });
  assert.equal((await service.getHistoryPage()).items[0].milestone, true);
  assert.equal((await service.getVersionDetails(version.hash)).version.milestone, true);
  assert.equal((await execFileAsync("git", ["-C", projectPath, "rev-parse", "HEAD"])).stdout, headBefore);

  assert.equal((await service.toggleMilestone(version.hash)).milestone, false);
  assert.equal((await service.getHistoryPage()).items[0].milestone, false);
});

test("reviews sensitive history and GitHub file limits before cloud upload", async (t) => {
  assert.deepEqual(inspectCloudFile("notes/chapter.md", 10), []);
  assert.equal(inspectCloudFile("archive/video.mov", 60 * 1024 * 1024)[0].type, "large-file");
  assert.equal(inspectCloudFile("archive/video.mov", 101 * 1024 * 1024)[0].severity, "block");

  const { projectPath, service } = await makeProject();
  const remotePath = await fs.mkdtemp(path.join(os.tmpdir(), "chronodraft-private-remote-"));
  t.after(() => fs.rm(projectPath, { recursive: true, force: true }));
  t.after(() => fs.rm(remotePath, { recursive: true, force: true }));
  await execFileAsync("git", ["init", "--bare", remotePath]);

  await write(
    projectPath,
    ".env",
    "GITHUB_TOKEN=ghp_testtokenvalue123456789012345\n",
  );
  await service.commit("误加入本地配置");
  await fs.unlink(path.join(projectPath, ".env"));
  await service.commit("移除本地配置");
  await execFileAsync("git", ["-C", projectPath, "remote", "add", "origin", remotePath]);

  const preflight = await service.getCloudPreflight();
  assert.doesNotMatch(JSON.stringify(preflight), /ghp_testtokenvalue/);
  assert.equal(preflight.blockers.length, 0);
  assert.equal(
    preflight.warnings.some((warning) => warning.type === "sensitive-path" && warning.path === ".env"),
    true,
  );
  assert.equal(
    preflight.warnings.some((warning) => warning.type === "secret-content" && warning.path === ".env"),
    true,
  );

  const reviewed = await service.syncExisting();
  assert.equal(reviewed.sync.reason, "review-required");
  await assert.rejects(() =>
    execFileAsync("git", ["--git-dir", remotePath, "rev-parse", "refs/heads/main"]),
  );

  const approved = await service.syncExisting({ allowWarnings: true });
  assert.equal(approved.sync.pushed, true);
});

test("reports cloud conflict files and restores the exact local state after a failed rebase", async (t) => {
  const { projectPath, service } = await makeProject();
  const remotePath = await fs.mkdtemp(path.join(os.tmpdir(), "chronodraft-conflict-remote-"));
  const collaboratorPath = await fs.mkdtemp(
    path.join(os.tmpdir(), "chronodraft-conflict-collaborator-"),
  );
  t.after(() => fs.rm(projectPath, { recursive: true, force: true }));
  t.after(() => fs.rm(remotePath, { recursive: true, force: true }));
  t.after(() => fs.rm(collaboratorPath, { recursive: true, force: true }));

  await execFileAsync("git", ["init", "--bare", remotePath]);
  await write(projectPath, "draft.md", "共同初稿\n");
  await service.commit("建立共同初稿");
  await execFileAsync("git", ["-C", projectPath, "remote", "add", "origin", remotePath]);
  assert.equal((await service.sync()).pushed, true);

  await fs.rm(collaboratorPath, { recursive: true, force: true });
  await execFileAsync("git", ["clone", "--branch", "main", remotePath, collaboratorPath]);
  await execFileAsync("git", ["-C", collaboratorPath, "config", "user.name", "Cloud Writer"]);
  await execFileAsync("git", [
    "-C",
    collaboratorPath,
    "config",
    "user.email",
    "cloud@example.com",
  ]);
  await write(collaboratorPath, "draft.md", "云端修改\n");
  await execFileAsync("git", ["-C", collaboratorPath, "add", "draft.md"]);
  await execFileAsync("git", ["-C", collaboratorPath, "commit", "-m", "云端补充段落"]);
  await execFileAsync("git", ["-C", collaboratorPath, "push", "origin", "main"]);

  await write(projectPath, "draft.md", "本机修改\n");
  await service.commit("本机补充段落");
  const localHead = (await execFileAsync("git", ["-C", projectPath, "rev-parse", "HEAD"])).stdout.trim();
  const result = await service.sync();

  assert.equal(result.pushed, false);
  assert.equal(result.reason, "SYNC_CONFLICT");
  assert.equal(result.conflict.worktreePreserved, true);
  assert.equal(result.conflict.local.hash, localHead);
  assert.equal(result.conflict.local.message, "本机补充段落");
  assert.equal(result.conflict.remote.message, "云端补充段落");
  assert.deepEqual(result.conflict.files.map((file) => file.path), ["draft.md"]);
  assert.equal(result.conflict.files[0].localExists, true);
  assert.equal(result.conflict.files[0].remoteExists, true);
  assert.equal(await fs.readFile(path.join(projectPath, "draft.md"), "utf8"), "本机修改\n");
  assert.equal(
    (await execFileAsync("git", ["-C", projectPath, "rev-parse", "HEAD"])).stdout.trim(),
    localHead,
  );
  assert.equal(
    (await execFileAsync("git", ["-C", projectPath, "status", "--porcelain"])).stdout,
    "",
  );
  await assert.rejects(fs.access(path.join(projectPath, ".git", "rebase-merge")));

  await write(projectPath, "draft.md", "仍未保存的本机修改\n");
  const paused = await service.sync();
  assert.equal(paused.reason, "unsaved-changes");
  assert.equal(await fs.readFile(path.join(projectPath, "draft.md"), "utf8"), "仍未保存的本机修改\n");

  await write(projectPath, "draft.md", "本机修改\n");
  const latestConflict = await service.sync();
  assert.equal(latestConflict.reason, "SYNC_CONFLICT");
  const resolved = await service.resolveSyncConflict({
    localHash: latestConflict.conflict.local.hash,
    remoteHash: latestConflict.conflict.remote.hash,
  });
  assert.equal(resolved.sync.pushed, true);
  assert.deepEqual(resolved.resolution.copies, ["draft（云端副本）.md"]);
  assert.equal(await fs.readFile(path.join(projectPath, "draft.md"), "utf8"), "本机修改\n");
  assert.equal(
    await fs.readFile(path.join(projectPath, "draft（云端副本）.md"), "utf8"),
    "云端修改\n",
  );
  assert.equal(
    (await execFileAsync("git", ["-C", projectPath, "status", "--porcelain"])).stdout,
    "",
  );
  const mergeParents = (
    await execFileAsync("git", ["-C", projectPath, "rev-list", "--parents", "-n", "1", "HEAD"])
  ).stdout.trim().split(/\s+/);
  assert.equal(mergeParents.length, 3);
  assert.equal(
    (await execFileAsync("git", ["--git-dir", remotePath, "show", "main:draft.md"])).stdout,
    "本机修改\n",
  );
  assert.equal(
    (
      await execFileAsync("git", [
        "--git-dir",
        remotePath,
        "show",
        "main:draft（云端副本）.md",
      ])
    ).stdout,
    "云端修改\n",
  );
  await assert.rejects(
    () =>
      service.resolveSyncConflict({
        localHash: latestConflict.conflict.local.hash,
        remoteHash: latestConflict.conflict.remote.hash,
      }),
    (error) => error.code === "SYNC_CONFLICT_STALE",
  );
});

test("keeps a local deletion and numbers the cloud copy instead of overwriting an existing file", async (t) => {
  const { projectPath, service } = await makeProject();
  const remotePath = await fs.mkdtemp(path.join(os.tmpdir(), "chronodraft-delete-remote-"));
  const collaboratorPath = await fs.mkdtemp(
    path.join(os.tmpdir(), "chronodraft-delete-collaborator-"),
  );
  t.after(() => fs.rm(projectPath, { recursive: true, force: true }));
  t.after(() => fs.rm(remotePath, { recursive: true, force: true }));
  t.after(() => fs.rm(collaboratorPath, { recursive: true, force: true }));

  await execFileAsync("git", ["init", "--bare", remotePath]);
  await write(projectPath, "ending.md", "共同结尾\n");
  await write(projectPath, "ending（云端副本）.md", "已有副本，不能覆盖\n");
  await service.commit("建立结尾初稿");
  await execFileAsync("git", ["-C", projectPath, "remote", "add", "origin", remotePath]);
  assert.equal((await service.sync()).pushed, true);

  await fs.rm(collaboratorPath, { recursive: true, force: true });
  await execFileAsync("git", ["clone", "--branch", "main", remotePath, collaboratorPath]);
  await execFileAsync("git", ["-C", collaboratorPath, "config", "user.name", "Cloud Writer"]);
  await execFileAsync("git", [
    "-C",
    collaboratorPath,
    "config",
    "user.email",
    "cloud@example.com",
  ]);
  await write(collaboratorPath, "ending.md", "云端保留的新结尾\n");
  await execFileAsync("git", ["-C", collaboratorPath, "add", "ending.md"]);
  await execFileAsync("git", ["-C", collaboratorPath, "commit", "-m", "修改云端结尾"]);
  await execFileAsync("git", ["-C", collaboratorPath, "push", "origin", "main"]);

  await fs.unlink(path.join(projectPath, "ending.md"));
  await service.commit("本机删除结尾");
  const conflict = await service.sync();
  assert.equal(conflict.reason, "SYNC_CONFLICT");
  assert.equal(conflict.conflict.files[0].localExists, false);
  assert.equal(conflict.conflict.files[0].remoteExists, true);

  const resolved = await service.resolveSyncConflict({
    localHash: conflict.conflict.local.hash,
    remoteHash: conflict.conflict.remote.hash,
  });
  assert.equal(resolved.sync.pushed, true);
  assert.deepEqual(resolved.resolution.copies, ["ending（云端副本 2）.md"]);
  await assert.rejects(fs.access(path.join(projectPath, "ending.md")));
  assert.equal(
    await fs.readFile(path.join(projectPath, "ending（云端副本）.md"), "utf8"),
    "已有副本，不能覆盖\n",
  );
  assert.equal(
    await fs.readFile(path.join(projectPath, "ending（云端副本 2）.md"), "utf8"),
    "云端保留的新结尾\n",
  );
});

test("paginates history without hiding older versions", async (t) => {
  const { projectPath, service } = await makeProject();
  t.after(() => fs.rm(projectPath, { recursive: true, force: true }));

  for (let version = 1; version <= 12; version += 1) {
    await write(projectPath, "draft.txt", `version ${version}`);
    await service.commit(`版本 ${version}`);
  }

  const firstPage = await service.getHistoryPage({ limit: 5 });
  assert.equal(firstPage.total, 12);
  assert.equal(firstPage.items.length, 5);
  assert.equal(firstPage.items[0].message, "版本 12");
  assert.equal(firstPage.hasMore, true);
  assert.equal(firstPage.nextSkip, 5);

  const lastPage = await service.getHistoryPage({ limit: 5, skip: 10 });
  assert.deepEqual(lastPage.items.map((item) => item.message), ["版本 2", "版本 1"]);
  assert.equal(lastPage.hasMore, false);
  assert.equal(lastPage.nextSkip, 12);
});

test("shows changed files and safe text or binary version previews", async (t) => {
  const { projectPath, service } = await makeProject();
  t.after(() => fs.rm(projectPath, { recursive: true, force: true }));

  await write(projectPath, "draft.txt", "第一版\n");
  await service.commit("建立初稿");
  await write(projectPath, "draft.txt", "第二版\n新增结尾\n");
  const second = await service.commit("补充结尾");

  const details = await service.getVersionDetails(second.hash);
  assert.equal(details.version.message, "补充结尾");
  assert.deepEqual(details.files, [
    { status: "M", type: "modified", path: "draft.txt", originalPath: null },
  ]);

  const textDiff = await service.getVersionDiff(second.hash, "draft.txt");
  assert.equal(textDiff.kind, "text");
  assert.match(textDiff.patch, /-第一版/);
  assert.match(textDiff.patch, /\+第二版/);
  assert.match(textDiff.patch, /\+新增结尾/);

  await fs.rename(path.join(projectPath, "draft.txt"), path.join(projectPath, "final.txt"));
  const renamed = await service.commit("重命名定稿");
  const renamedDetails = await service.getVersionDetails(renamed.hash);
  assert.deepEqual(renamedDetails.files, [
    {
      status: "R100",
      type: "renamed",
      path: "final.txt",
      originalPath: "draft.txt",
    },
  ]);
  assert.equal((await service.getVersionDiff(renamed.hash, "final.txt")).kind, "metadata");

  await fs.writeFile(path.join(projectPath, "cover.bin"), Buffer.from([0, 1, 2, 3]));
  const binary = await service.commit("加入封面文件");
  assert.equal((await service.getVersionDiff(binary.hash, "cover.bin")).kind, "binary");

  assert.deepEqual(parseNameStatus("R095\0old name.md\0new name.md\0"), [
    {
      status: "R095",
      type: "renamed",
      path: "new name.md",
      originalPath: "old name.md",
    },
  ]);
});

test("restores an older version after making a safety backup", async (t) => {
  const { projectPath, service } = await makeProject();
  t.after(() => fs.rm(projectPath, { recursive: true, force: true }));

  await write(projectPath, "draft.txt", "第一版");
  const first = await service.saveVersion("第一版完成");
  await write(projectPath, "draft.txt", "第二版");
  await service.saveVersion("第二版完成");
  await write(projectPath, "draft.txt", "尚未保存的第三版");

  const restored = await service.restoreVersion(first.commit.hash);
  assert.equal(restored.changed, true);
  assert.equal(await fs.readFile(path.join(projectPath, "draft.txt"), "utf8"), "第一版");

  const messages = (await service.getHistory(5)).map((entry) => entry.message);
  assert.deepEqual(messages.slice(0, 2), [
    `恢复到版本 ${first.commit.hash.slice(0, 7)}`,
    "恢复前自动备份",
  ]);
});

test("pushes the first version to an empty remote repository", async (t) => {
  const { projectPath, service } = await makeProject();
  const remotePath = await fs.mkdtemp(path.join(os.tmpdir(), "chronodraft-remote-"));
  t.after(() => fs.rm(projectPath, { recursive: true, force: true }));
  t.after(() => fs.rm(remotePath, { recursive: true, force: true }));

  await execFileAsync("git", ["init", "--bare", remotePath]);
  await write(projectPath, "story.md", "从前有一座山。");
  await service.commit("故事开头");
  await write(projectPath, "story.md", "从前有一座山，山里有一间书屋。");
  const snapshot = await service.createAutoSnapshot();
  assert.equal(snapshot.created, true);

  // Production accepts GitHub URLs only. A local remote keeps this test offline.
  await execFileAsync("git", ["-C", projectPath, "remote", "add", "origin", remotePath]);
  const sync = await service.sync();
  assert.equal(sync.pushed, true);

  const remoteBranch = await execFileAsync("git", [
    "--git-dir",
    remotePath,
    "rev-parse",
    "refs/heads/main",
  ]);
  assert.match(remoteBranch.stdout.trim(), /^[0-9a-f]{40}$/);
  const remoteInternalRefs = await execFileAsync("git", [
    "--git-dir",
    remotePath,
    "for-each-ref",
    "--format=%(refname)",
    "refs/chronodraft",
  ]);
  assert.equal(remoteInternalRefs.stdout, "");
});
