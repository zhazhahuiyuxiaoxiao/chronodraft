const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { promisify } = require("node:util");
const test = require("node:test");

const {
  GitService,
  parsePorcelainV2,
  validateRemoteUrl,
} = require("../src/git-service");

const execFileAsync = promisify(execFile);

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
});
