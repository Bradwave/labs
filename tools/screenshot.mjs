#!/usr/bin/env node
// Labs · tools/screenshot.mjs
// Takes docs/screenshot.png of each lab with headless Chrome: 1280 × 800, light theme, English interface,
// after the lab has run for a few real seconds (so graphs and trails have content).
// Used by each lab's README, the root README and the home page.
// Usage: node tools/screenshot.mjs                 every lab
//        node tools/screenshot.mjs pendulum-lab     one or more labs
//        WAIT=6000 node tools/screenshot.mjs …      longer run before the capture (ms, default 4500)
// Needs Google Chrome (macOS path below, or CHROME=/path/to/chrome) and Node 22+ (built-in WebSocket).
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { KIT_ROOT, appDir, pickApps } from "./lib.mjs";

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
if (!existsSync(CHROME)) {
  console.error(`Chrome not found at ${CHROME} (set CHROME=/path/to/chrome)`);
  process.exit(1);
}
const PORT = 8177, DEBUG = 9277, WAIT = +(process.env.WAIT || 4500);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const apps = pickApps(process.argv.slice(2));

const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: KIT_ROOT, stdio: "ignore" });
const profile = mkdtempSync(join(tmpdir(), "labs-shots-"));
const chrome = spawn(CHROME, ["--headless=new", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check", `--user-data-dir=${profile}`,
  "--lang=en-US", `--remote-debugging-port=${DEBUG}`, "about:blank"], { stdio: "ignore" });

// ---------- a minimal DevTools Protocol client ----------
async function connect() {
  for (let i = 0; i < 50; i++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${DEBUG}/json/list`)).json();
      const page = targets.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch (e) {}
    await sleep(200);
  }
  throw new Error("Chrome did not start");
}
function client(url) {
  const ws = new WebSocket(url);
  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const { ok, ko } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? ko(new Error(m.error.message)) : ok(m.result);
    }
  };
  const ready = new Promise((r) => (ws.onopen = r));
  const send = (method, params = {}) => new Promise((ok, ko) => { const n = ++id; pending.set(n, { ok, ko }); ws.send(JSON.stringify({ id: n, method, params })); });
  return { ready, send, close: () => ws.close() };
}

try {
  await sleep(800);
  const cdp = client(await connect());
  await cdp.ready;
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }, { name: "prefers-reduced-motion", value: "no-preference" }] });
  await cdp.send("Emulation.setLocaleOverride", { locale: "en-US" }).catch(() => {});
  for (const app of apps) {
    const out = join(appDir(app.slug), "docs", "screenshot.png");
    mkdirSync(join(appDir(app.slug), "docs"), { recursive: true });
    try {
      await cdp.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/${app.slug}/` });
      await sleep(WAIT);
      const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
      writeFileSync(out, Buffer.from(data, "base64"));
      console.log(`${app.slug}: ${Math.round(Buffer.from(data, "base64").length / 1024)} kB`);
    } catch (e) {
      console.log(`${app.slug}: failed (${e.message})`);
    }
  }
  cdp.close();
} finally {
  chrome.kill();
  server.kill();
  await sleep(300);
  rmSync(profile, { recursive: true, force: true });
}
