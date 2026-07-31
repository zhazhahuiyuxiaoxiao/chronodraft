import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = path.resolve(import.meta.dirname, "..");
const buildDirectory = path.join(root, "build");
const source = path.join(buildDirectory, "icon.svg");
const png = path.join(buildDirectory, "icon.png");
const iconset = path.join(buildDirectory, "icon.iconset");

if (process.platform !== "darwin") {
  throw new Error("图标生成脚本需要 macOS 的 qlmanage、sips 和 iconutil。");
}

await fs.mkdir(buildDirectory, { recursive: true });
await execFileAsync("qlmanage", ["-t", "-s", "1024", "-o", buildDirectory, source]);
await fs.rename(`${source}.png`, png).catch(async (error) => {
  if (error.code !== "EEXIST") throw error;
  await fs.rm(png, { force: true });
  await fs.rename(`${source}.png`, png);
});

await fs.rm(iconset, { recursive: true, force: true });
await fs.mkdir(iconset, { recursive: true });

const variants = [
  [16, "icon_16x16.png"],
  [32, "icon_16x16@2x.png"],
  [32, "icon_32x32.png"],
  [64, "icon_32x32@2x.png"],
  [128, "icon_128x128.png"],
  [256, "icon_128x128@2x.png"],
  [256, "icon_256x256.png"],
  [512, "icon_256x256@2x.png"],
  [512, "icon_512x512.png"],
  [1024, "icon_512x512@2x.png"],
];

for (const [size, filename] of variants) {
  await execFileAsync("sips", [
    "-z",
    String(size),
    String(size),
    png,
    "--out",
    path.join(iconset, filename),
  ]);
}

await execFileAsync("iconutil", [
  "-c",
  "icns",
  iconset,
  "-o",
  path.join(buildDirectory, "icon.icns"),
]);

const windowsPngPath = path.join(buildDirectory, "icon-256.png");
await execFileAsync("sips", ["-z", "256", "256", png, "--out", windowsPngPath]);
const windowsPng = await fs.readFile(windowsPngPath);
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header.writeUInt8(0, 6);
header.writeUInt8(0, 7);
header.writeUInt8(0, 8);
header.writeUInt8(0, 9);
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(windowsPng.length, 14);
header.writeUInt32LE(22, 18);
await fs.writeFile(path.join(buildDirectory, "icon.ico"), Buffer.concat([header, windowsPng]));

await fs.rm(iconset, { recursive: true, force: true });
await fs.rm(windowsPngPath, { force: true });
console.log("Generated build/icon.png, build/icon.icns and build/icon.ico");
