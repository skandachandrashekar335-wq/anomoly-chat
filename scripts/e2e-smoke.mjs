import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const baseURL = process.env.BASE_URL || "https://anomoly-chat.vercel.app";
const outDir = path.resolve("docs/screenshots");
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const errors = [];
const pages = [];

function watch(page, label) {
  page.on("pageerror", error => errors.push(`${label}: ${error.message}`));
  page.on("console", message => {
    if (message.type() === "error") errors.push(`${label} console: ${message.text()}`);
  });
  pages.push(page);
}

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const host = await context.newPage();
  watch(host, "host");
  const response = await host.goto(baseURL, { waitUntil: "networkidle", timeout: 60000 });
  assert.ok(response && response.status() === 200, `Homepage HTTP status: ${response?.status()}`);
  await host.locator("h1").first().waitFor({ state: "visible" });
  assert.match(await host.title(), /Anomoly Chat/i);
  await host.screenshot({ path: path.join(outDir, "desktop-home.png"), fullPage: true, animations: "disabled" });

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const mobile = await mobileContext.newPage();
  watch(mobile, "mobile");
  await mobile.goto(baseURL, { waitUntil: "networkidle", timeout: 60000 });
  await mobile.locator("h1").first().waitFor({ state: "visible" });
  const mobileMetrics = await mobile.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth
  }));
  assert.ok(mobileMetrics.document <= mobileMetrics.viewport + 1,
    `Mobile horizontal overflow: viewport=${mobileMetrics.viewport}, document=${mobileMetrics.document}`);
  await mobile.screenshot({ path: path.join(outDir, "mobile-home.png"), fullPage: true, animations: "disabled" });

  // Exercise the actual deployed room flow with two isolated browser contexts.
  await host.locator("#btnActionCreate").click();
  await host.locator("#chatScreen").waitFor({ state: "visible", timeout: 30000 });
  await host.locator("#activeRoomCodeLabel").waitFor({ state: "visible" });
  const roomCode = (await host.locator("#activeRoomCodeLabel").innerText()).trim();
  assert.match(roomCode, /^[A-Z0-9]{6}$/i, `Unexpected room code: ${roomCode}`);
  await host.screenshot({ path: path.join(outDir, "desktop-room.png"), fullPage: true, animations: "disabled" });

  const guestContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const guest = await guestContext.newPage();
  watch(guest, "guest");
  await guest.goto(baseURL, { waitUntil: "networkidle", timeout: 60000 });
  await guest.locator("#joinCodeInput").fill(roomCode);
  await guest.locator("#btnActionJoin").click();
  await guest.locator("#chatScreen").waitFor({ state: "visible", timeout: 30000 });

  // Wait for the UI to report the second peer; fail with a useful message if signaling is unavailable.
  await guest.waitForFunction(() => {
    const text = document.querySelector("#labelParticipants")?.textContent || "";
    return /2\s+Online/i.test(text);
  }, { timeout: 45000 });
  await host.waitForFunction(() => {
    const text = document.querySelector("#labelParticipants")?.textContent || "";
    return /2\s+Online/i.test(text);
  }, { timeout: 15000 });

  const message = `Anomoly E2E smoke ${new Date().toISOString()}`;
  await host.locator("#messageTextInput").fill(message);
  await host.locator("#btnSendMessage").click();
  await guest.getByText(message, { exact: true }).waitFor({ state: "visible", timeout: 15000 });
  await guest.screenshot({ path: path.join(outDir, "desktop-live-chat.png"), fullPage: true, animations: "disabled" });

  // Check the invite modal and QR content on the real active room.
  const inviteButton = host.locator("#btnOpenInviteModal");
  if (await inviteButton.count()) {
    await inviteButton.click();
    await host.locator("#inviteModal").waitFor({ state: "visible", timeout: 5000 });
    await host.screenshot({ path: path.join(outDir, "desktop-invite-qr.png"), fullPage: true, animations: "disabled" });
  }

  assert.deepEqual(errors, [], `Browser console/page errors:\n${errors.join("\n")}`);
  console.log(JSON.stringify({
    result: "PASS",
    baseURL,
    checks: ["homepage HTTP 200", "desktop screenshot", "mobile screenshot and overflow", "create room", "join from second browser context", "two-peer connection", "message delivery", "console errors"],
    roomCode,
    mobileMetrics,
    screenshots: (await fs.readdir(outDir)).filter(name => name.endsWith(".png"))
  }, null, 2));

  await guestContext.close();
  await mobileContext.close();
  await context.close();
} finally {
  await browser.close();
}
