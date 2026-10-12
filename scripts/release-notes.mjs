// Prints the CHANGELOG.md section of one version (without its heading), for the release body.
//
//   node scripts/release-notes.mjs 0.2.0
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const version = process.argv[2]?.replace(/^v/, "");
if (!version) {
  console.error("Usage: node scripts/release-notes.mjs <x.y.z>");
  process.exit(2);
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lines = fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8").split(/\r?\n/);
const start = lines.findIndex((line) => line.startsWith(`## [${version}]`));
if (start < 0) {
  console.error(`CHANGELOG.md has no section for ${version}`);
  process.exit(1);
}
const end = lines.findIndex((line, i) => i > start && line.startsWith("## ["));
const notes = lines
  .slice(start + 1, end < 0 ? undefined : end)
  .join("\n")
  .trim();
if (!notes) {
  console.error(`The CHANGELOG.md section for ${version} is empty`);
  process.exit(1);
}
console.log(notes);
