import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const SOURCE_ROOT = new URL(".", import.meta.url).pathname;

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:js|jsx)$/.test(entry.name) ? [path] : [];
  });
}

test("the retired editor cannot return as a parallel implementation", () => {
  for (const path of ["components", "hooks", "constants"]) {
    const directory = join(SOURCE_ROOT, path);
    const files = existsSync(directory) ? sourceFiles(directory) : [];
    assert.deepEqual(files, [], `retired src/${path} must stay empty; extend src/cad instead`);
  }
});

test("CAD domain modules do not depend on React components", () => {
  const domainFiles = sourceFiles(join(SOURCE_ROOT, "cad")).filter(
    (path) =>
      !path.endsWith(".test.js") &&
      !path.endsWith(".jsx") &&
      !path.endsWith("useCadState.js"),
  );

  for (const path of domainFiles) {
    const source = readFileSync(path, "utf8");
    assert.doesNotMatch(source, /from\s+["']react["']/);
    assert.doesNotMatch(source, /from\s+["'][^"']*components\//);
  }
});

test("the app has a single CAD composition root", () => {
  const app = readFileSync(join(SOURCE_ROOT, "App.jsx"), "utf8");
  assert.match(app, /\.\/cad\/CadCanvas/);
  assert.match(app, /\.\/cad\/useCadState/);
  assert.doesNotMatch(app, /\.\/components\//);
  assert.doesNotMatch(app, /useFloorplanState/);
});
