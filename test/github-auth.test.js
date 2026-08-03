const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { EncryptedCredentialStore } = require("../src/credential-store");
const { createGitHubAuthEnvironment } = require("../src/git-service");
const { GitHubAuthService } = require("../src/github-auth");

function response(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

function memoryStore(initial = null) {
  let value = initial;
  return {
    getAvailability: () => ({ available: true, backend: "keychain", reason: "" }),
    assertAvailable: () => true,
    load: async () => value,
    save: async (next) => {
      value = { ...next };
    },
    clear: async () => {
      value = null;
    },
    inspect: () => value,
  };
}

test("encrypts GitHub credentials at rest and refuses Linux plain-text fallback", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "chronodraft-credentials-"));
  const filePath = path.join(directory, "github-credentials.bin");
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const encryption = {
    isEncryptionAvailable: () => true,
    encryptString: (value) => Buffer.from(`encrypted:${Buffer.from(value).toString("base64")}`),
    decryptString: (value) =>
      Buffer.from(String(value).slice("encrypted:".length), "base64").toString("utf8"),
  };
  const store = new EncryptedCredentialStore({ filePath, encryption, platform: "darwin" });
  const credentials = {
    accessToken: "ghu_test_access_token",
    refreshToken: "ghr_test_refresh_token",
    accessExpiresAt: 5000,
    refreshExpiresAt: 9000,
    login: "writer",
  };

  await store.save(credentials);
  assert.deepEqual(await store.load(), credentials);
  assert.doesNotMatch(await fs.readFile(filePath, "utf8"), /ghu_test|ghr_test/);
  assert.equal((await fs.stat(filePath)).mode & 0o777, 0o600);
  await store.clear();
  assert.equal(await store.load(), null);

  const unsafeStore = new EncryptedCredentialStore({
    filePath,
    platform: "linux",
    encryption: {
      ...encryption,
      getSelectedStorageBackend: () => "basic_text",
    },
  });
  assert.equal(unsafeStore.getAvailability().available, false);
  await assert.rejects(
    () => unsafeStore.save(credentials),
    (error) => error.code === "SECURE_STORAGE_UNAVAILABLE",
  );
});

test("completes GitHub App device flow without a client secret or token exposure", async () => {
  const requests = [];
  const replies = [
    response({
      device_code: "device-code-not-returned-to-renderer",
      user_code: "ABCD-EFGH",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 5,
    }),
    response({ error: "authorization_pending" }),
    response({
      access_token: "ghu_access_from_github",
      expires_in: 28800,
      refresh_token: "ghr_refresh_from_github",
      refresh_token_expires_in: 15897600,
      token_type: "bearer",
    }),
    response({ login: "writer" }),
  ];
  const store = memoryStore();
  const auth = new GitHubAuthService({
    clientId: "Iv1.public-client-id",
    appSlug: "chronodraft-test",
    store,
    now: () => 1000,
    wait: async () => {},
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return replies.shift();
    },
  });

  const started = await auth.startDeviceFlow();
  assert.deepEqual(Object.keys(started).sort(), [
    "expiresAt",
    "sessionId",
    "userCode",
    "verificationUri",
  ]);
  assert.doesNotMatch(JSON.stringify(started), /device-code-not-returned|ghu_|ghr_/);
  const state = await auth.completeDeviceFlow(started.sessionId);
  assert.equal(state.authenticated, true);
  assert.equal(state.login, "writer");
  assert.equal(state.installUrl, "https://github.com/apps/chronodraft-test/installations/new");
  assert.doesNotMatch(JSON.stringify(state), /ghu_|ghr_/);
  assert.equal(store.inspect().accessToken, "ghu_access_from_github");
  assert.equal(requests.some((request) => String(request.options.body).includes("client_secret")), false);
  assert.equal(
    requests.filter((request) => request.url.endsWith("/login/oauth/access_token")).length,
    2,
  );
});

test("refreshes an expiring GitHub App token and rotates both credentials", async () => {
  let currentTime = 10_000;
  const store = memoryStore({
    accessToken: "ghu_old_access",
    refreshToken: "ghr_old_refresh",
    accessExpiresAt: currentTime + 1000,
    refreshExpiresAt: currentTime + 1_000_000,
    login: "writer",
  });
  let refreshBody = "";
  const auth = new GitHubAuthService({
    clientId: "Iv1.public-client-id",
    store,
    now: () => currentTime,
    fetchImpl: async (_url, options) => {
      refreshBody = String(options.body);
      return response({
        access_token: "ghu_new_access",
        expires_in: 28800,
        refresh_token: "ghr_new_refresh",
        refresh_token_expires_in: 15897600,
      });
    },
  });

  assert.equal(await auth.getAccessToken(), "ghu_new_access");
  assert.match(refreshBody, /grant_type=refresh_token/);
  assert.match(refreshBody, /refresh_token=ghr_old_refresh/);
  assert.doesNotMatch(refreshBody, /client_secret/);
  assert.equal(store.inspect().refreshToken, "ghr_new_refresh");
  currentTime += 1000;
  assert.equal(await auth.getAccessToken(), "ghu_new_access");
});

test("refuses a GitHub App configuration that would issue non-expiring user tokens", async () => {
  const replies = [
    response({
      device_code: "device-code",
      user_code: "WXYZ-1234",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 5,
    }),
    response({ access_token: "ghu_long_lived_token", token_type: "bearer" }),
  ];
  const store = memoryStore();
  const auth = new GitHubAuthService({
    clientId: "Iv1.public-client-id",
    store,
    now: () => 1000,
    wait: async () => {},
    fetchImpl: async () => replies.shift(),
  });
  const login = await auth.startDeviceFlow();
  await assert.rejects(
    () => auth.completeDeviceFlow(login.sessionId),
    (error) => error.code === "GITHUB_EXPIRING_TOKEN_REQUIRED",
  );
  assert.equal(store.inspect(), null);
});

test("lists only writable repositories authorized to this GitHub App", async () => {
  const requests = [];
  const store = memoryStore({
    accessToken: "ghu_repository_lookup",
    refreshToken: "ghr_repository_lookup",
    accessExpiresAt: Date.now() + 600_000,
    refreshExpiresAt: Date.now() + 1_200_000,
    login: "writer",
  });
  const replies = [
    response({
      installations: [
        { id: 41, app_slug: "chronodraft-test", account: { login: "writer" } },
        { id: 99, app_slug: "another-app", account: { login: "writer" } },
      ],
    }),
    response({
      repositories: [
        {
          id: 7,
          name: "novel",
          full_name: "writer/novel",
          private: true,
          permissions: { push: true },
        },
        {
          id: 8,
          name: "read-only",
          full_name: "editor/read-only",
          private: false,
          permissions: { push: false },
        },
      ],
    }),
  ];
  const auth = new GitHubAuthService({
    clientId: "Iv1.public-client-id",
    appSlug: "chronodraft-test",
    store,
    fetchImpl: async (url, options) => {
      requests.push({ url, authorization: options.headers.Authorization });
      return replies.shift();
    },
  });

  const result = await auth.listRepositories();
  assert.deepEqual(result, {
    installed: true,
    configureUrl: "https://github.com/settings/installations/41",
    repositories: [
      {
        id: 7,
        name: "novel",
        fullName: "writer/novel",
        private: true,
        url: "https://github.com/writer/novel.git",
      },
    ],
  });
  assert.equal(requests.length, 2);
  assert.equal(requests.every((request) => request.authorization === "Bearer ghu_repository_lookup"), true);
  assert.doesNotMatch(JSON.stringify(result), /ghu_|ghr_/);
});

test("supplies a GitHub App token to Git only through an ephemeral credential helper", async () => {
  const token = "ghu_ephemeral_git_token";
  const environment = createGitHubAuthEnvironment(token, "/tmp/chronodraft-disabled-hooks");
  assert.equal(environment.CHRONODRAFT_GITHUB_TOKEN, token);
  assert.doesNotMatch(
    Object.entries(environment)
      .filter(([key]) => key !== "CHRONODRAFT_GITHUB_TOKEN")
      .map(([, value]) => value)
      .join("\n"),
    /ghu_ephemeral_git_token/,
  );

  const output = await new Promise((resolve, reject) => {
    const child = spawn("git", ["credential", "fill"], {
      env: { ...process.env, ...environment },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`git credential failed: ${stderr}`));
    });
    child.stdin.end("protocol=https\nhost=github.com\npath=writer/project.git\n\n");
  });
  assert.match(output, /username=x-access-token/);
  assert.match(output, /password=ghu_ephemeral_git_token/);
});
