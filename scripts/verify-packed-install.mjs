import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const packageRoot = resolve(new URL("..", import.meta.url).pathname);
const sandbox = mkdtempSync(join(tmpdir(), "cuemap-ts-pack-") );

try {
  execFileSync("npm", ["pack", "--pack-destination", sandbox], { cwd: packageRoot, stdio: "inherit" });
  const tarball = join(sandbox, "cuemap-0.7.2.tgz");
  execFileSync("npm", ["init", "-y"], { cwd: sandbox, stdio: "ignore" });
  execFileSync("npm", ["install", "--ignore-scripts", "--no-save", tarball], { cwd: sandbox, stdio: "inherit" });
  const probe = [
    "const fs = require('node:fs'); const path = require('node:path');",
    "const pkg = JSON.parse(fs.readFileSync(path.join(path.dirname(require.resolve('cuemap')), '..', 'package.json')));",
    "if (pkg.version !== '0.7.2') throw new Error('unexpected package version');",
    "const sdk = require('cuemap');",
    "if (typeof sdk.default !== 'function') throw new Error('default SDK export missing');",
    "const embedded = require('cuemap/embedded');",
    "if (typeof embedded.EmbeddedCueMap?.start !== 'function') throw new Error('embedded export missing');",
  ].join(" ");
  execFileSync(process.execPath, ["-e", probe], { cwd: sandbox, stdio: "inherit" });
  assert.ok(true);
  console.log("verified the packed TypeScript SDK in a fresh npm project");
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}
