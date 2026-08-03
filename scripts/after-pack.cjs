const { execFile } = require("node:child_process");
const path = require("node:path");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);

async function plistBuddy(plistPath, command, { optional = false } = {}) {
  try {
    await execFileAsync("/usr/libexec/PlistBuddy", ["-c", command, plistPath]);
  } catch (error) {
    if (!optional) throw error;
  }
}

module.exports = async function hardenPackagedApplication(context) {
  if (context.electronPlatformName !== "darwin") return;

  const productName = context.packager.appInfo.productFilename;
  const plistPath = path.join(context.appOutDir, `${productName}.app`, "Contents", "Info.plist");
  await plistBuddy(plistPath, "Delete :NSAppTransportSecurity", { optional: true });
  await plistBuddy(plistPath, "Add :NSAppTransportSecurity dict");
  await plistBuddy(plistPath, "Add :NSAppTransportSecurity:NSAllowsArbitraryLoads bool false");
  await plistBuddy(plistPath, "Add :NSAppTransportSecurity:NSAllowsLocalNetworking bool false");

  for (const key of [
    "NSBluetoothAlwaysUsageDescription",
    "NSBluetoothPeripheralUsageDescription",
    "NSCameraUsageDescription",
    "NSMicrophoneUsageDescription",
  ]) {
    await plistBuddy(plistPath, `Delete :${key}`, { optional: true });
  }
};
