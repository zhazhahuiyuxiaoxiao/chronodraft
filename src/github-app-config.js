const packageMetadata = require("../package.json");

function getGitHubAppConfig(environment = process.env) {
  const metadata = packageMetadata.chronodraft?.githubApp || {};
  return {
    clientId: String(environment.CHRONODRAFT_GITHUB_CLIENT_ID || metadata.clientId || "").trim(),
    appSlug: String(environment.CHRONODRAFT_GITHUB_APP_SLUG || metadata.slug || "").trim(),
  };
}

module.exports = { getGitHubAppConfig };
