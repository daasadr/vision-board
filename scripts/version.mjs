// Sets the app version everywhere it is declared, or checks that they agree.
//
//   node scripts/version.mjs 0.2.0     sets package.json, tauri.conf.json, Cargo.toml (+ lock)
//   node scripts/version.mjs --check   fails unless all three agree (and match $RELEASE_TAG)
//
// The release workflow runs --check with the pushed tag, so a tag never ships another version.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = {
  package: path.join(root, "package.json"),
  tauri: path.join(root, "src-tauri", "tauri.conf.json"),
  cargo: path.join(root, "src-tauri", "Cargo.toml"),
};
const CARGO_VERSION = /^(version\s*=\s*")([^"]+)(")/m;
const SEMVER = /^\d+\.\d+\.\d+$/;

function versions() {
  return {
    package: JSON.parse(fs.readFileSync(files.package, "utf8")).version,
    tauri: JSON.parse(fs.readFileSync(files.tauri, "utf8")).version,
    cargo: fs.readFileSync(files.cargo, "utf8").match(CARGO_VERSION)?.[2],
  };
}

function setJsonVersion(file, version) {
  const text = fs.readFileSync(file, "utf8");
  // Replace only the top-level "version" line, keeping the file's formatting.
  const updated = text.replace(/^(\s{2}"version":\s*")[^"]+(")/m, `$1${version}$2`);
  if (updated === text && !text.includes(`"version": "${version}"`)) {
    throw new Error(`no version field in ${file}`);
  }
  fs.writeFileSync(file, updated);
}

const arg = process.argv[2];
if (arg === "--check") {
  const found = versions();
  const tag = process.env.RELEASE_TAG?.replace(/^v/, "");
  const all = new Set(Object.values(found));
  if (all.size !== 1 || (tag && !all.has(tag))) {
    console.error(`Versions disagree: ${JSON.stringify({ ...found, tag })}`);
    process.exit(1);
  }
  console.log(`Version ${found.package}${tag ? ` matches tag v${tag}` : ""}`);
} else if (arg && SEMVER.test(arg)) {
  setJsonVersion(files.package, arg);
  setJsonVersion(files.tauri, arg);
  const cargo = fs.readFileSync(files.cargo, "utf8");
  fs.writeFileSync(files.cargo, cargo.replace(CARGO_VERSION, `$1${arg}$3`));
  // Cargo.lock records the crate version too; update just that entry, offline.
  execFileSync("cargo", ["update", "--offline", "--workspace"], {
    cwd: path.join(root, "src-tauri"),
    stdio: "inherit",
  });
  console.log(`Version set to ${arg}. Add a section for it to CHANGELOG.md.`);
} else {
  console.error("Usage: node scripts/version.mjs <x.y.z> | --check");
  process.exit(2);
}
