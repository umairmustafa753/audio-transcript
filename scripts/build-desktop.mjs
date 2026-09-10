// Builds the Next.js app as a self-contained server for the desktop app, in
// .next/standalone. Plain Node rather than shell commands so it runs the same
// on Windows and macOS.

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, readdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const standalone = path.join(root, ".next", "standalone");
const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next");

rmSync(standalone, { recursive: true, force: true });

const build = spawnSync(process.execPath, [nextBin, "build"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, BUILD_TARGET: "desktop" },
});
if (build.status !== 0) process.exit(build.status ?? 1);

if (!existsSync(path.join(standalone, "server.js"))) {
  console.error(`Expected ${path.join(standalone, "server.js")} after the build.`);
  process.exit(1);
}

// The standalone server leaves static assets to a CDN; the desktop app has none.
cpSync(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), {
  recursive: true,
});
if (existsSync(path.join(root, "public"))) {
  cpSync(path.join(root, "public"), path.join(standalone, "public"), { recursive: true });
}

// sharp backs next/image, which this app never uses, and it ships a native
// binary for the build machine only. Without it the server is pure JavaScript,
// so one Mac can package for Windows and both Mac architectures.
for (const dir of ["sharp", "@img"]) {
  rmSync(path.join(standalone, "node_modules", dir), { recursive: true, force: true });
}

// Next copies .env files into the build. Anything in there would be shipped to
// every user who installs the app, so strip them. Keys belong in Settings.
for (const name of readdirSync(standalone)) {
  if (name.startsWith(".env")) rmSync(path.join(standalone, name), { force: true });
}

console.log("Desktop server ready in .next/standalone");
