import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const candidates = [
  process.env.CHROME_BIN,
  "google-chrome-stable",
  "google-chrome",
  "chromium",
  "chromium-browser",
].filter(Boolean);
const chrome = candidates.find(
  (candidate) => spawnSync("sh", ["-c", `command -v "${candidate}"`]).status === 0,
);

if (!chrome) {
  if (process.env.BROWSER_TEST_REQUIRED === "1") {
    throw new Error("Chrome/Chromium is required for browser tests.");
  }
  process.stdout.write("Browser tests skipped: Chrome/Chromium is not installed.\n");
  process.exit(0);
}

const profile = await mkdtemp(join(tmpdir(), "reno-lite-browser-"));
const server = spawn(
  process.platform === "win32" ? "node_modules/.bin/vite.cmd" : "node_modules/.bin/vite",
  ["--host", "127.0.0.1", "--port", "4173", "--strictPort"],
  { stdio: ["ignore", "pipe", "pipe"] },
);

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch("http://127.0.0.1:4173/");
      if (response.ok) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Vite did not become ready for browser tests.");
}

try {
  await waitForServer();
  const browser = spawnSync(
    chrome,
    [
      "--headless",
      "--no-sandbox",
      "--disable-gpu",
      `--user-data-dir=${profile}`,
      "--window-size=1280,800",
      "--virtual-time-budget=15000",
      "--dump-dom",
      "http://127.0.0.1:4173/?browser-test",
    ],
    { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
  );
  const output = `${browser.stdout || ""}\n${browser.stderr || ""}`;
  if (browser.status !== 0 || !output.includes('id="browser-test-result" data-status="passed"')) {
    process.stderr.write(output);
    throw new Error("Browser interaction suite failed.");
  }
  process.stdout.write("Browser interaction suite passed.\n");
} finally {
  server.kill("SIGTERM");
  await rm(profile, { recursive: true, force: true });
}
