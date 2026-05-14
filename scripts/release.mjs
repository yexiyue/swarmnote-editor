#!/usr/bin/env node
/**
 * Release helper for the @swarmnote/editor monorepo.
 *
 * Usage:
 *   pnpm release patch     # 0.1.0 → 0.1.1
 *   pnpm release minor     # 0.1.0 → 0.2.0
 *   pnpm release major     # 0.1.0 → 1.0.0
 *   pnpm release <version> # e.g. 1.0.0-beta.0
 *
 * What it does:
 *   1. Bumps version of all 3 publishable packages in lockstep
 *   2. Bumps root package.json version (for tag clarity)
 *   3. Regenerates CHANGELOG.md via git-cliff (using the new tag)
 *   4. Commits as "chore(release): vX.Y.Z"
 *   5. Creates an annotated tag vX.Y.Z
 *   6. Prints next steps (push)
 *
 * It does NOT push. Review the commit + tag locally, then:
 *   git push && git push --tags
 *
 * The CI workflow `.github/workflows/release.yml` picks up the tag push
 * and runs `pnpm publish -r --filter "@swarmnote/*"`.
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const PACKAGES = [
  "packages/editor-core",
  "packages/editor-react",
  "packages/editor-react-native",
];

function run(cmd, opts = {}) {
  return execSync(cmd, { stdio: "inherit", cwd: repoRoot, ...opts });
}

function runCapture(cmd) {
  return execSync(cmd, { cwd: repoRoot, encoding: "utf8" }).trim();
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, data) {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

function ensureCleanGit() {
  const status = runCapture("git status --porcelain");
  if (status) {
    console.error("✗ working tree is dirty. Commit or stash first.");
    console.error(status);
    process.exit(1);
  }
}

function ensureMainBranch() {
  const branch = runCapture("git rev-parse --abbrev-ref HEAD");
  if (branch !== "main") {
    console.error(`✗ not on main (current: ${branch}). Release must run from main.`);
    process.exit(1);
  }
}

function bumpVersion(currentVersion, type) {
  // If type looks like a semver, use it directly
  if (/^\d+\.\d+\.\d+(-[\w.-]+)?$/.test(type)) return type;

  const [major, minor, patch] = currentVersion.split("-")[0].split(".").map(Number);
  switch (type) {
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "major":
      return `${major + 1}.0.0`;
    default:
      console.error(`✗ unknown bump type: ${type}`);
      console.error("Use one of: patch / minor / major / <explicit-version>");
      process.exit(1);
  }
}

function main() {
  const bumpType = process.argv[2];
  if (!bumpType) {
    console.error("Usage: pnpm release <patch|minor|major|x.y.z>");
    process.exit(1);
  }

  ensureCleanGit();
  ensureMainBranch();

  // Pull latest from main so we don't bump on stale base
  run("git pull --ff-only");

  // Read current version from editor-core (canonical)
  const corePkgPath = resolve(repoRoot, "packages/editor-core/package.json");
  const currentVersion = readJson(corePkgPath).version;
  const newVersion = bumpVersion(currentVersion, bumpType);

  console.log(`\n→ Bumping ${currentVersion} → ${newVersion}\n`);

  // Bump all package versions (in lockstep)
  for (const pkgDir of PACKAGES) {
    const pkgPath = resolve(repoRoot, pkgDir, "package.json");
    const pkg = readJson(pkgPath);
    pkg.version = newVersion;
    writeJson(pkgPath, pkg);
    console.log(`  ✓ ${pkg.name} → ${newVersion}`);
  }

  // Bump root package.json too (purely cosmetic, helps tag-version match)
  const rootPkgPath = resolve(repoRoot, "package.json");
  const rootPkg = readJson(rootPkgPath);
  rootPkg.version = newVersion;
  writeJson(rootPkgPath, rootPkg);

  // Regenerate CHANGELOG.md with the new tag
  console.log("\n→ Regenerating CHANGELOG.md via git-cliff");
  run(`git-cliff --tag v${newVersion} -o CHANGELOG.md`);

  // Stage + commit + tag
  console.log("\n→ Committing and tagging");
  run("git add -A");
  run(`git commit -m "chore(release): v${newVersion}"`);
  run(`git tag -a v${newVersion} -m "Release v${newVersion}"`);

  console.log(`\n✓ Released v${newVersion} locally.`);
  console.log("\nNext steps:");
  console.log("  git push && git push --tags");
  console.log("\nCI will then build + publish all packages to npm.");
}

main();
