const crypto = require("node:crypto");

const GITHUB_DEVICE_CODE_URL = "https://github.com/login/device/code";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_USER_URL = "https://api.github.com/user";
const GITHUB_INSTALLATIONS_URL = "https://api.github.com/user/installations?per_page=100";
const GITHUB_DEVICE_URL = "https://github.com/login/device";
const GITHUB_API_VERSION = "2026-03-10";
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;

class GitHubAuthError extends Error {
  constructor(code, message, detail = "") {
    super(message);
    this.name = "GitHubAuthError";
    this.code = code;
    this.detail = detail;
  }
}

function abortableWait(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason || new Error("aborted"));
      return;
    }
    const timer = setTimeout(resolve, milliseconds);
    timer.unref?.();
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason || new Error("aborted"));
      },
      { once: true },
    );
  });
}

function safeAuthDetail(status, payload = {}) {
  const error = String(payload.error || "").replace(/[^a-z0-9_-]/gi, "");
  return `${Number(status) || 0}${error ? ` ${error}` : ""}`;
}

class GitHubAuthService {
  constructor({
    clientId = "",
    appSlug = "",
    store,
    fetchImpl = globalThis.fetch,
    now = () => Date.now(),
    wait = abortableWait,
  }) {
    this.clientId = String(clientId || "").trim();
    this.appSlug = String(appSlug || "").trim();
    this.store = store;
    this.fetchImpl = fetchImpl;
    this.now = now;
    this.wait = wait;
    this.pending = null;
    this.refreshPromise = null;
  }

  getConfiguration() {
    const configured = /^[A-Za-z0-9._-]{8,128}$/.test(this.clientId);
    const validSlug = /^[A-Za-z0-9-]{1,100}$/.test(this.appSlug);
    return {
      configured,
      appSlug: validSlug ? this.appSlug : "",
      installUrl: validSlug
        ? `https://github.com/apps/${this.appSlug}/installations/new`
        : "",
    };
  }

  assertConfigured() {
    if (!this.getConfiguration().configured) {
      throw new GitHubAuthError(
        "GITHUB_APP_NOT_CONFIGURED",
        "ChronoDraft 的 GitHub App 还没有完成注册，暂时不能开始浏览器登录。",
      );
    }
  }

  async requestJson(url, options = {}) {
    const timeoutController = new AbortController();
    const timeout = setTimeout(() => timeoutController.abort(), 15000);
    timeout.unref?.();
    const signals = [timeoutController.signal, options.signal].filter(Boolean);
    try {
      const response = await this.fetchImpl(url, {
        ...options,
        signal: signals.length > 1 ? AbortSignal.any(signals) : signals[0],
        headers: {
          Accept: "application/json",
          "User-Agent": "ChronoDraft",
          ...(options.headers || {}),
        },
      });
      let payload = {};
      try {
        payload = await response.json();
      } catch {
        payload = {};
      }
      if (!response.ok) {
        throw new GitHubAuthError(
          "GITHUB_AUTH_HTTP_FAILED",
          "暂时无法完成 GitHub 登录，请检查网络后重试。",
          safeAuthDetail(response.status, payload),
        );
      }
      return payload;
    } catch (error) {
      if (error instanceof GitHubAuthError) throw error;
      if (options.signal?.aborted) {
        throw new GitHubAuthError("GITHUB_LOGIN_CANCELLED", "GitHub 登录已取消。");
      }
      throw new GitHubAuthError(
        "GITHUB_AUTH_NETWORK_FAILED",
        "暂时无法连接 GitHub，请检查网络后重试。",
        error.name || "network error",
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  requestForm(url, fields, signal = null) {
    return this.requestJson(url, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields).toString(),
    });
  }

  async getState() {
    const configuration = this.getConfiguration();
    const storage = this.store.getAvailability();
    if (!configuration.configured || !storage.available) {
      return {
        ...configuration,
        storage,
        authenticated: false,
        login: "",
        expiresAt: 0,
      };
    }
    const credentials = await this.store.load();
    const authenticated = Boolean(
      credentials?.refreshToken && credentials.refreshExpiresAt > this.now(),
    );
    return {
      ...configuration,
      storage,
      authenticated,
      login: authenticated ? credentials.login : "",
      expiresAt: authenticated ? credentials.accessExpiresAt : 0,
    };
  }

  async startDeviceFlow() {
    this.assertConfigured();
    this.store.assertAvailable();
    this.cancelDeviceFlow();
    const payload = await this.requestForm(GITHUB_DEVICE_CODE_URL, {
      client_id: this.clientId,
    });
    const expiresIn = Number(payload.expires_in);
    const interval = Math.max(Number(payload.interval) || 5, 5);
    if (
      typeof payload.device_code !== "string" ||
      !/^[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(String(payload.user_code || "")) ||
      payload.verification_uri !== GITHUB_DEVICE_URL ||
      !Number.isFinite(expiresIn) ||
      expiresIn <= 0
    ) {
      throw new GitHubAuthError(
        "GITHUB_DEVICE_RESPONSE_INVALID",
        "GitHub 返回了无法识别的登录信息，ChronoDraft 没有继续。",
      );
    }
    const controller = new AbortController();
    const sessionId = crypto.randomUUID();
    this.pending = {
      sessionId,
      controller,
      deviceCode: payload.device_code,
      userCode: String(payload.user_code).toUpperCase(),
      verificationUri: payload.verification_uri,
      expiresAt: this.now() + expiresIn * 1000,
      intervalMs: interval * 1000,
    };
    return {
      sessionId,
      userCode: this.pending.userCode,
      verificationUri: this.pending.verificationUri,
      expiresAt: this.pending.expiresAt,
    };
  }

  cancelDeviceFlow() {
    if (!this.pending) return false;
    this.pending.controller.abort();
    this.pending = null;
    return true;
  }

  async completeDeviceFlow(sessionId) {
    const pending = this.pending;
    if (!pending || pending.sessionId !== String(sessionId || "")) {
      throw new GitHubAuthError(
        "GITHUB_LOGIN_STALE",
        "这次 GitHub 登录已经过期，请重新开始。",
      );
    }
    let intervalMs = pending.intervalMs;
    try {
      while (this.now() < pending.expiresAt) {
        await this.wait(intervalMs, pending.controller.signal);
        const payload = await this.requestForm(
          GITHUB_TOKEN_URL,
          {
            client_id: this.clientId,
            device_code: pending.deviceCode,
            grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          },
          pending.controller.signal,
        );
        if (payload.error === "authorization_pending") continue;
        if (payload.error === "slow_down") {
          intervalMs += 5000;
          continue;
        }
        if (payload.error === "access_denied") {
          throw new GitHubAuthError("GITHUB_LOGIN_DENIED", "你在 GitHub 中取消了这次登录。");
        }
        if (payload.error === "expired_token") break;
        if (payload.error) {
          throw new GitHubAuthError(
            "GITHUB_LOGIN_FAILED",
            "GitHub 没有完成这次登录，请重新尝试。",
            safeAuthDetail(200, payload),
          );
        }

        const credentials = await this.credentialsFromTokenResponse(payload);
        await this.store.save(credentials);
        this.pending = null;
        return this.getState();
      }
      throw new GitHubAuthError(
        "GITHUB_LOGIN_EXPIRED",
        "验证码已经过期，请重新开始 GitHub 登录。",
      );
    } catch (error) {
      if (this.pending === pending) this.pending = null;
      if (error instanceof GitHubAuthError) throw error;
      throw new GitHubAuthError("GITHUB_LOGIN_CANCELLED", "GitHub 登录已取消。");
    }
  }

  async credentialsFromTokenResponse(payload, existingLogin = "") {
    const accessToken = String(payload.access_token || "");
    const refreshToken = String(payload.refresh_token || "");
    const expiresIn = Number(payload.expires_in);
    const refreshExpiresIn = Number(payload.refresh_token_expires_in);
    if (
      !accessToken.startsWith("ghu_") ||
      !refreshToken.startsWith("ghr_") ||
      !Number.isFinite(expiresIn) ||
      expiresIn <= 0 ||
      !Number.isFinite(refreshExpiresIn) ||
      refreshExpiresIn <= 0
    ) {
      throw new GitHubAuthError(
        "GITHUB_EXPIRING_TOKEN_REQUIRED",
        "GitHub App 必须启用短期用户令牌。ChronoDraft 没有保存这次长期凭据。",
      );
    }
    let login = existingLogin;
    if (!login) {
      const profile = await this.requestJson(GITHUB_USER_URL, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-GitHub-Api-Version": GITHUB_API_VERSION,
        },
      });
      login = typeof profile.login === "string" ? profile.login : "";
    }
    const createdAt = this.now();
    return {
      accessToken,
      refreshToken,
      accessExpiresAt: createdAt + expiresIn * 1000,
      refreshExpiresAt: createdAt + refreshExpiresIn * 1000,
      login,
    };
  }

  async refreshCredentials(credentials) {
    if (credentials.refreshExpiresAt <= this.now()) {
      await this.store.clear();
      throw new GitHubAuthError(
        "GITHUB_LOGIN_EXPIRED",
        "GitHub 登录已经过期，请重新登录。",
      );
    }
    const payload = await this.requestForm(GITHUB_TOKEN_URL, {
      client_id: this.clientId,
      grant_type: "refresh_token",
      refresh_token: credentials.refreshToken,
    });
    if (payload.error) {
      await this.store.clear();
      throw new GitHubAuthError(
        "GITHUB_LOGIN_EXPIRED",
        "GitHub 登录已失效，请重新登录。",
        safeAuthDetail(200, payload),
      );
    }
    const refreshed = await this.credentialsFromTokenResponse(payload, credentials.login);
    await this.store.save(refreshed);
    return refreshed;
  }

  async getAccessToken({ optional = true } = {}) {
    const configuration = this.getConfiguration();
    const storage = this.store.getAvailability();
    if (!configuration.configured || !storage.available) {
      if (optional) return null;
      this.assertConfigured();
      this.store.assertAvailable();
    }
    let credentials = await this.store.load();
    if (!credentials) {
      if (optional) return null;
      throw new GitHubAuthError("GITHUB_LOGIN_REQUIRED", "请先通过浏览器登录 GitHub。");
    }
    if (credentials.accessExpiresAt <= this.now() + TOKEN_REFRESH_MARGIN_MS) {
      if (!this.refreshPromise) {
        this.refreshPromise = this.refreshCredentials(credentials).finally(() => {
          this.refreshPromise = null;
        });
      }
      credentials = await this.refreshPromise;
    }
    return credentials.accessToken;
  }

  async listRepositories() {
    const configuration = this.getConfiguration();
    if (!configuration.appSlug) {
      throw new GitHubAuthError(
        "GITHUB_APP_NOT_CONFIGURED",
        "ChronoDraft 的 GitHub App 还没有完成注册。",
      );
    }
    const accessToken = await this.getAccessToken({ optional: false });
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      "X-GitHub-Api-Version": GITHUB_API_VERSION,
    };
    try {
      const payload = await this.requestJson(GITHUB_INSTALLATIONS_URL, { headers });
      const installations = Array.isArray(payload.installations)
        ? payload.installations.filter(
            (installation) =>
              installation &&
              installation.app_slug === configuration.appSlug &&
              Number.isSafeInteger(Number(installation.id)) &&
              Number(installation.id) > 0,
          )
        : [];
      const repositories = new Map();
      for (const installation of installations) {
        const installationId = Number(installation.id);
        const result = await this.requestJson(
          `https://api.github.com/user/installations/${installationId}/repositories?per_page=100`,
          { headers },
        );
        for (const repository of Array.isArray(result.repositories) ? result.repositories : []) {
          const fullName = String(repository?.full_name || "");
          if (
            !Number.isSafeInteger(Number(repository?.id)) ||
            Number(repository.id) <= 0 ||
            !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(fullName) ||
            repository?.permissions?.push === false
          ) {
            continue;
          }
          repositories.set(Number(repository.id), {
            id: Number(repository.id),
            name: String(repository.name || fullName.split("/").pop()),
            fullName,
            private: Boolean(repository.private),
            url: `https://github.com/${fullName}.git`,
          });
        }
      }
      const login = String((await this.store.load())?.login || "");
      const preferredInstallation =
        installations.find((installation) => installation.account?.login === login) ||
        installations[0];
      return {
        installed: installations.length > 0,
        configureUrl: preferredInstallation
          ? `https://github.com/settings/installations/${Number(preferredInstallation.id)}`
          : "",
        repositories: [...repositories.values()].sort((left, right) =>
          left.fullName.localeCompare(right.fullName, "zh-CN"),
        ),
      };
    } catch (error) {
      if (
        error instanceof GitHubAuthError &&
        ["GITHUB_LOGIN_REQUIRED", "GITHUB_LOGIN_EXPIRED"].includes(error.code)
      ) {
        throw error;
      }
      throw new GitHubAuthError(
        "GITHUB_REPOSITORIES_UNAVAILABLE",
        "暂时无法读取已授权的仓库，请检查网络后重试。",
        error instanceof GitHubAuthError ? error.detail : error?.name || "repository lookup failed",
      );
    }
  }

  async logout() {
    this.cancelDeviceFlow();
    await this.store.clear();
    return this.getState();
  }
}

module.exports = {
  GITHUB_DEVICE_URL,
  GitHubAuthError,
  GitHubAuthService,
  abortableWait,
};
