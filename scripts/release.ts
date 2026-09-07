#!/usr/bin/env bun
// Lockstep release for @thegreataxios/webmcp*.
// Usage: bun scripts/release.ts <version> --otp <code> [--dry-run]
//
// Bumps all four packages together, publishes in dependency order,
// restores workspace:* deps, then commits + tags. Re running with a fresh
// OTP resumes: already-published versions are skipped.
import { $ } from "bun";

const PUBLISH_ORDER = ["core", "bridge", "react", "webmcp"] as const;
const SCOPE = "@thegreataxios";

function usage(): never {
  console.error("Usage: bun scripts/release.ts <version> --otp <code> [--dry-run]");
  process.exit(1);
}

const [version, ...rest] = Bun.argv.slice(2);
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) usage();
const dryRun = rest.includes("--dry-run");

let otp = "";
const otpFlag = rest.findIndex((a) => a === "--otp" || a.startsWith("--otp="));
if (otpFlag !== -1) {
  const flag = rest[otpFlag];
  otp = flag.includes("=") ? flag.split("=").slice(1).join("=") : (rest[otpFlag + 1] ?? "");
}
if (!otp && !dryRun) usage();
if (dryRun && !otp) otp = "000000";

const pkgName = (dir: string) =>
  dir === "webmcp" ? `${SCOPE}/webmcp` : `${SCOPE}/webmcp-${dir}`;
const pkgPath = (dir: string) => `packages/${dir}/package.json`;

async function readJson(path: string): Promise<Record<string, unknown>> {
  return (await Bun.file(path).json()) as Record<string, unknown>;
}

async function writeJson(path: string, data: Record<string, unknown>) {
  if (dryRun) return;
  await Bun.write(path, JSON.stringify(data, null, 2) + "\n");
}

function rewriteDeps(data: Record<string, unknown>, from: string, to: string) {
  for (const section of ["dependencies", "devDependencies", "peerDependencies"]) {
    const deps = data[section] as Record<string, string> | undefined;
    if (!deps) continue;
    for (const [k, v] of Object.entries(deps)) {
      if (v === from) deps[k] = to;
    }
  }
}

const run = async (cmd: string, cwd?: string) => {
  console.log(`$ ${cmd}${cwd ? `  (in ${cwd})` : ""}`);
  if (dryRun) return;
  if (cwd) await $`sh -c ${cmd}`.cwd(cwd);
  else await $`sh -c ${cmd}`;
};

// 1. Preconditions -----------------------------------------------------------
const dirty = (await $`git status --porcelain`.text()).trim();
if (dirty) {
  console.error("Refusing: working tree is dirty. Commit or stash first.");
  process.exit(1);
}
try {
  await $`git rev-parse v${version}`.quiet();
  console.error(`Refusing: tag v${version} already exists.`);
  process.exit(1);
} catch {
  // tag free — good
}
const current = ((await readJson(pkgPath("core")))["version"] ?? "") as string;
if (current === version) {
  console.error(`Refusing: packages already at ${version}.`);
  process.exit(1);
}

// 2. Checks ------------------------------------------------------------------
await run("bun run build");
await run("bun run test");
await run("bun run typecheck");

// 3. Bump + rewrite workspace:* ----------------------------------------------
for (const dir of PUBLISH_ORDER) {
  const path = pkgPath(dir);
  const data = await readJson(path);
  data["version"] = version;
  rewriteDeps(data, "workspace:*", version);
  await writeJson(path, data);
}

// 4. Publish in dependency order ----------------------------------------------
let failed = false;
for (const dir of PUBLISH_ORDER) {
  const name = pkgName(dir);
  const exists = await $`npm view ${name}@${version} version`.quiet().then(
    () => true,
    () => false,
  );
  if (exists) {
    console.log(`~ ${name}@${version} already published, skipping`);
    continue;
  }
  try {
    await run(`npm publish --access public --otp ${otp}`, `packages/${dir}`);
  } catch {
    console.error(`Publish failed for ${name}. Rerun with a fresh OTP to resume.`);
    failed = true;
    break;
  }
}

// 5. Always restore workspace:* (keep bumped versions) -------------------------
for (const dir of PUBLISH_ORDER) {
  const path = pkgPath(dir);
  const data = await readJson(path);
  rewriteDeps(data, version, "workspace:*");
  await writeJson(path, data);
}
if (failed) process.exit(1);

// 6. Commit + tag --------------------------------------------------------------
await run(`git add packages/core/package.json packages/react/package.json packages/bridge/package.json packages/webmcp/package.json bun.lock`);
await run(`git commit -m "chore(release): v${version}"`);
await run(`git tag v${version}`);

console.log(`\nDone. Push with: git push origin2 main --follow-tags`);
