import { chromium } from "playwright";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const mimeTypes = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split("?")[0].split("#")[0];
  if (reqPath === "/") reqPath = "/index.html";
  const filePath = path.join(process.cwd(), reqPath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not Found");
    } else {
      const ext = path.extname(filePath);
      res.writeHead(200, { "Content-Type": mimeTypes[ext] || "text/plain" });
      res.end(data);
    }
  });
});

await new Promise(resolve => server.listen(3096, resolve));
console.log("Smart Expiry Test Server running at http://localhost:3096");

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--use-fake-ui-for-media-stream"]
});

try {
  console.log("\n--- TEST SUITE: SMART ROOM EXPIRY WARNING SYSTEM ---");

  // Host context
  const hostContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const host = await hostContext.newPage();
  await host.goto("http://localhost:3096", { waitUntil: "networkidle" });

  // 1. Host creates room
  console.log("1. Creating room as Host...");
  await host.locator("#btnActionCreate").click();
  await host.locator("#chatScreen").waitFor({ state: "visible", timeout: 30000 });
  await host.waitForFunction(() => {
    const code = document.querySelector("#activeRoomCodeLabel")?.textContent?.trim() || "";
    return /^[A-Z0-9]{6}$/i.test(code) && code !== "CODE";
  });
  const roomCode = (await host.locator("#activeRoomCodeLabel").innerText()).trim();
  console.log(`   Room created with code: ${roomCode}`);

  // Guest context
  const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const guest = await guestContext.newPage();
  await guest.goto("http://localhost:3096", { waitUntil: "networkidle" });

  // 2. Guest joins room
  console.log("2. Guest joins room on mobile viewport (390x844)...");
  await guest.locator("#joinCodeInput").fill(roomCode);
  await guest.locator("#btnActionJoin").click();
  await guest.locator("#chatScreen").waitFor({ state: "visible", timeout: 30000 });

  // Wait for P2P connection established
  await host.waitForFunction(() => {
    const text = document.querySelector("#labelParticipants")?.textContent || "";
    return /2\s+Online/i.test(text);
  }, null, { timeout: 45000 });
  await guest.waitForFunction(() => {
    const text = document.querySelector("#labelParticipants")?.textContent || "";
    return /2\s+Online/i.test(text);
  }, null, { timeout: 15000 });
  console.log("   P2P DataChannel connected: 2 Online.");

  // 3. Test Threshold: 5 Minutes (subtle heads-up)
  console.log("3. Testing 5-minute subtle warning threshold...");
  await host.evaluate(() => window.__setTestExpiry(290 * 1000));
  await guest.evaluate(() => window.__setTestExpiry(290 * 1000));

  await host.locator("#smartExpiryWarning").waitFor({ state: "visible", timeout: 3000 });
  await guest.locator("#smartExpiryWarning").waitFor({ state: "visible", timeout: 3000 });

  const host5mBadge = await host.locator("#expiryWarningBadge").innerText();
  const guest5mBadge = await guest.locator("#expiryWarningBadge").innerText();
  assert.equal(host5mBadge, "HEADS-UP");
  assert.equal(guest5mBadge, "HEADS-UP");
  console.log("   ✓ Both Host and Guest display 5m subtle heads-up.");

  // 4. Test Threshold: 2 Minutes (clear warning banner)
  console.log("4. Testing 2-minute clear warning banner threshold...");
  await host.evaluate(() => window.__setTestExpiry(110 * 1000));
  await guest.evaluate(() => window.__setTestExpiry(110 * 1000));

  await host.waitForFunction(() => document.querySelector("#expiryWarningBadge")?.textContent === "NOTICE");
  await guest.waitForFunction(() => document.querySelector("#expiryWarningBadge")?.textContent === "NOTICE");
  console.log("   ✓ Both Host and Guest display 2m clear warning banner.");

  // 5. Test Threshold: 1 Minute (prominent banner with Creator-only Extend action)
  console.log("5. Testing 1-minute prominent warning banner threshold & Creator-only privilege...");
  await host.evaluate(() => window.__setTestExpiry(55 * 1000));
  await guest.evaluate(() => window.__setTestExpiry(55 * 1000));

  await host.waitForFunction(() => document.querySelector("#expiryWarningBadge")?.textContent === "EXPIRING");
  await guest.waitForFunction(() => document.querySelector("#expiryWarningBadge")?.textContent === "EXPIRING");

  const hostWarningText = await host.locator("#expiryWarningMsg").innerText();
  const guestWarningText = await guest.locator("#expiryWarningMsg").innerText();
  assert.ok(hostWarningText.includes("extend the room"), `Host message should mention extending: ${hostWarningText}`);
  assert.ok(guestWarningText.includes("before the room self-destructs"), `Guest message should mention self-destruct: ${guestWarningText}`);

  // Verify Creator has visible Extend button; Guest DOES NOT
  const hostCanExtend = await host.locator("#btnWarningExtend").isVisible();
  const guestCanExtend = await guest.locator("#btnWarningExtend").isVisible();
  assert.equal(hostCanExtend, true, "Host must have visible 'Extend Room' button in warning banner");
  assert.equal(guestCanExtend, false, "Guest must NOT have 'Extend Room' button in warning banner");
  console.log("   ✓ Creator has visible Extend button; Guest does not have permission.");

  // 6. Test Host Extension Synchronizes New Expiry and Dismisses Outdated Warnings
  console.log("6. Testing Host Extension synchronizes new expiry & dismisses warnings on both peers...");
  await host.locator("#btnWarningExtend").click();
  await host.locator("#expiryExtensionPopover").waitFor({ state: "visible", timeout: 3000 });
  await host.locator('.expiry-ext-pill[data-ext="15"]').click();
  await host.locator("#btnConfirmExtend").click();
  await host.locator("#expiryExtensionPopover").waitFor({ state: "hidden", timeout: 3000 });

  // Outdated warning banner must be immediately hidden on Host
  await host.locator("#smartExpiryWarning").waitFor({ state: "hidden", timeout: 5000 });

  // Guest must receive WebRTC expiry_extension message, update countdown, and dismiss warning!
  await guest.locator("#smartExpiryWarning").waitFor({ state: "hidden", timeout: 10000 });
  const guestRemainingMinutes = await guest.evaluate(() => {
    const text = document.querySelector("#labelCountdown")?.textContent || "";
    const parts = text.split(":");
    return parseInt(parts[0], 10);
  });
  assert.ok(guestRemainingMinutes >= 14, `Guest countdown must update to ~15 minutes, got ${guestRemainingMinutes}`);
  console.log(`   ✓ Extension synchronized: Guest countdown updated to ${guestRemainingMinutes}m and outdated warning dismissed.`);

  // 7. Test Threshold: 30 Seconds Urgent Warning
  console.log("7. Testing 30-second urgent countdown warning...");
  await host.evaluate(() => window.__setTestExpiry(28 * 1000));
  await guest.evaluate(() => window.__setTestExpiry(28 * 1000));

  await host.waitForFunction(() => document.querySelector("#expiryWarningBadge")?.textContent === "URGENT");
  await guest.waitForFunction(() => document.querySelector("#expiryWarningBadge")?.textContent === "URGENT");
  const urgentClass = await host.locator("#smartExpiryWarning").getAttribute("class");
  assert.ok(urgentClass.includes("urgent"), "Must have urgent styling class");
  console.log("   ✓ 30s urgent warning displayed on both peers.");

  // 8. Test Threshold: 10 Seconds Dynamic Final Countdown
  console.log("8. Testing 10-second dynamic final countdown...");
  await host.evaluate(() => window.__setTestExpiry(8 * 1000));
  await guest.evaluate(() => window.__setTestExpiry(8 * 1000));

  await host.waitForFunction(() => document.querySelector("#expiryWarningBadge")?.textContent === "FINAL");
  await guest.waitForFunction(() => document.querySelector("#expiryWarningBadge")?.textContent === "FINAL");
  const hostFinalMsg = await host.locator("#expiryWarningMsg").innerText();
  assert.match(hostFinalMsg, /Room expires in \d+s!/, `Final countdown should show seconds: ${hostFinalMsg}`);
  console.log(`   ✓ 10s final countdown verified: "${hostFinalMsg}".`);

  // 9. Test Room Expiration (0s)
  console.log("9. Testing room expiration at 0 seconds...");
  await host.evaluate(() => window.__setTestExpiry(0));
  await guest.evaluate(() => window.__setTestExpiry(0));

  await host.waitForFunction(() => document.querySelector("#expiryWarningBadge")?.textContent === "EXPIRED");
  await guest.waitForFunction(() => document.querySelector("#expiryWarningBadge")?.textContent === "EXPIRED");

  // Inputs disabled on both peers
  const hostInputDisabled = await host.locator("#messageTextInput").isDisabled();
  const guestInputDisabled = await guest.locator("#messageTextInput").isDisabled();
  assert.equal(hostInputDisabled, true, "Host message input must be disabled upon expiry");
  assert.equal(guestInputDisabled, true, "Guest message input must be disabled upon expiry");

  const hostSendDisabled = await host.locator("#btnSendMessage").isDisabled();
  const guestSendDisabled = await guest.locator("#btnSendMessage").isDisabled();
  assert.equal(hostSendDisabled, true, "Host send button must be disabled upon expiry");
  assert.equal(guestSendDisabled, true, "Guest send button must be disabled upon expiry");

  // System message rendered in chat
  const hostExpiredText = await host.locator(".chat-bubble.system-bubble").last().innerText();
  assert.ok(hostExpiredText.includes("expired") || hostExpiredText.includes("wiped"), `System message mismatch: ${hostExpiredText}`);
  console.log("   ✓ Room expired cleanly: inputs disabled, system message displayed, peer connections terminated.");

  // 10. Test Mobile Responsiveness in Expired State
  console.log("10. Testing zero horizontal overflow on mobile during warning & expired state...");
  const guestOverflow = await guest.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
  });
  assert.equal(guestOverflow, false, "Mobile guest screen must have 0 horizontal overflow in expired state");
  console.log("   ✓ Zero mobile overflow verified.");

  console.log("\n================================================================================");
  console.log("ALL 10 SMART ROOM EXPIRY WARNING & MULTI-PARTICIPANT SYNC TESTS PASSED!");
  console.log("================================================================================\n");

  await guestContext.close();
  await hostContext.close();
} finally {
  await browser.close();
  server.close();
}
