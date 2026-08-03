const { ChronoDraftError, GitService } = require("./git-service");

class ProjectSession {
  constructor(createService = (projectPath) => new GitService(projectPath)) {
    this.createService = createService;
    this.service = null;
  }

  async open(projectPath, persistSelection = async () => {}) {
    const candidate = this.createService(projectPath);
    const overview = await candidate.initialize();
    await persistSelection(overview);
    this.service = candidate;
    return overview;
  }

  requireProject() {
    if (!this.service) {
      throw new ChronoDraftError("NO_PROJECT", "请先选择一个写作文件夹。");
    }
    return this.service;
  }
}

module.exports = { ProjectSession };
