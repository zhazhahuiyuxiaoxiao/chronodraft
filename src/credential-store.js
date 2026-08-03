const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

class CredentialStoreError extends Error {
  constructor(code, message, detail = "") {
    super(message);
    this.name = "CredentialStoreError";
    this.code = code;
    this.detail = detail;
  }
}

class EncryptedCredentialStore {
  constructor({ filePath, encryption, platform = process.platform }) {
    this.filePath = path.resolve(filePath);
    this.encryption = encryption;
    this.platform = platform;
  }

  getAvailability() {
    const encryptionAvailable = Boolean(this.encryption?.isEncryptionAvailable?.());
    const backend = this.platform === "linux"
      ? this.encryption?.getSelectedStorageBackend?.() || "unknown"
      : this.platform === "darwin"
        ? "keychain"
        : this.platform === "win32"
          ? "dpapi"
          : "unknown";
    const secure = encryptionAvailable && backend !== "basic_text" && backend !== "unknown";
    return {
      available: secure,
      backend,
      reason: secure
        ? ""
        : backend === "basic_text"
          ? "系统没有可用的安全密钥库，ChronoDraft 不会把 GitHub 凭据降级为明文保存。"
          : "系统安全密钥库当前不可用，暂时不能保存 GitHub 登录。",
    };
  }

  assertAvailable() {
    const availability = this.getAvailability();
    if (!availability.available) {
      throw new CredentialStoreError(
        "SECURE_STORAGE_UNAVAILABLE",
        availability.reason,
        availability.backend,
      );
    }
    return availability;
  }

  async load() {
    this.assertAvailable();
    let encrypted;
    try {
      encrypted = await fs.readFile(this.filePath);
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw new CredentialStoreError(
        "CREDENTIAL_READ_FAILED",
        "无法读取本机保存的 GitHub 登录，请重新登录。",
        error.message,
      );
    }

    try {
      const parsed = JSON.parse(this.encryption.decryptString(encrypted));
      if (
        !parsed ||
        typeof parsed.accessToken !== "string" ||
        typeof parsed.refreshToken !== "string" ||
        !Number.isFinite(parsed.accessExpiresAt) ||
        !Number.isFinite(parsed.refreshExpiresAt)
      ) {
        throw new Error("credential payload is incomplete");
      }
      return {
        accessToken: parsed.accessToken,
        refreshToken: parsed.refreshToken,
        accessExpiresAt: parsed.accessExpiresAt,
        refreshExpiresAt: parsed.refreshExpiresAt,
        login: typeof parsed.login === "string" ? parsed.login : "",
      };
    } catch (error) {
      throw new CredentialStoreError(
        "CREDENTIAL_DECRYPT_FAILED",
        "本机 GitHub 登录已经无法解密，请清除后重新登录。",
        error.message,
      );
    }
  }

  async save(credentials) {
    this.assertAvailable();
    const payload = {
      accessToken: String(credentials.accessToken || ""),
      refreshToken: String(credentials.refreshToken || ""),
      accessExpiresAt: Number(credentials.accessExpiresAt),
      refreshExpiresAt: Number(credentials.refreshExpiresAt),
      login: String(credentials.login || ""),
    };
    if (
      !payload.accessToken ||
      !payload.refreshToken ||
      !Number.isFinite(payload.accessExpiresAt) ||
      !Number.isFinite(payload.refreshExpiresAt)
    ) {
      throw new CredentialStoreError(
        "INVALID_CREDENTIALS",
        "GitHub 返回的登录凭据不完整，ChronoDraft 没有保存。",
      );
    }

    const encrypted = this.encryption.encryptString(JSON.stringify(payload));
    const directory = path.dirname(this.filePath);
    const temporaryPath = `${this.filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    try {
      await fs.writeFile(temporaryPath, encrypted, { flag: "wx", mode: 0o600 });
      await fs.chmod(temporaryPath, 0o600);
      await fs.rename(temporaryPath, this.filePath);
      await fs.chmod(this.filePath, 0o600);
    } catch (error) {
      await fs.unlink(temporaryPath).catch(() => {});
      throw new CredentialStoreError(
        "CREDENTIAL_WRITE_FAILED",
        "无法把 GitHub 登录安全保存到本机。",
        error.message,
      );
    }
  }

  async clear() {
    try {
      await fs.unlink(this.filePath);
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw new CredentialStoreError(
          "CREDENTIAL_CLEAR_FAILED",
          "无法清除本机保存的 GitHub 登录。",
          error.message,
        );
      }
    }
  }
}

module.exports = {
  CredentialStoreError,
  EncryptedCredentialStore,
};
