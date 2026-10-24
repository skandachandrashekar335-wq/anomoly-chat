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

await new Promise(resolve => server.listen(3097, resolve));
console.log("Interactive testing server running on http://localhost:3097");

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--use-fake-ui-for-media-stream"]
});

const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

const errors = [];
page.on("pageerror", err => errors.push(err.message));

await page.goto("http://localhost:3097", { waitUntil: "domcontentloaded" });

console.log("1. Testing Navigation smooth scroll...");
await page.locator('a[href="#features"].nav-link').click();
await page.waitForTimeout(500);
const featuresRect = await page.locator("#features").boundingBox();
assert.ok(featuresRect.y <= 300, `Expected #features near top, got y=${featuresRect.y}`);

// Scroll back to top
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(300);

console.log("2. Testing Expiry Presets & Custom Input toggle...");
await page.locator('.expiry-pill[data-minutes="custom"]').click();
await page.locator("#customExpiryContainer").waitFor({ state: "visible", timeout: 2000 });
await page.locator("#customExpiryInput").fill("35");
await page.locator("#customExpiryInput").dispatchEvent("input");
const customText = await page.locator("#lifetimeDisplayLabel").innerText();
assert.ok(customText.includes("35 minutes"), `Expected 35 minutes, got ${customText}`);

await page.locator('.expiry-pill[data-minutes="15"]').click();
await page.locator("#customExpiryContainer").waitFor({ state: "hidden", timeout: 2000 });
const p15Text = await page.locator("#lifetimeDisplayLabel").innerText();
assert.ok(p15Text.includes("15 minutes"), `Expected 15 minutes, got ${p15Text}`);

console.log("3. Testing Invalid Room Code validation on Join...");
await page.locator("#joinCodeInput").fill("ABC");
await page.locator("#btnActionJoin").click();
const errorMsg = await page.locator("#joinStatusMsg").innerText();
assert.ok(errorMsg.includes("6-character"), `Expected code length error, got: ${errorMsg}`);

console.log("4. Testing Room Creation & Transition to Chat Screen...");
await page.locator("#btnActionCreate").click();
await page.locator("#chatScreen").waitFor({ state: "visible", timeout: 30000 });
const code = await page.locator("#activeRoomCodeLabel").innerText();
assert.equal(code.length, 6, `Expected 6-char code, got ${code}`);

console.log("5. Testing Modal Open, QR generation, Copy Link, and Modal Close...");
await page.locator("#btnOpenShareModal").click();
await page.locator("#inviteModal").waitFor({ state: "visible", timeout: 3000 });
const qrSrc = await page.locator("#modalQrImg").getAttribute("src");
assert.ok(qrSrc.startsWith("data:image/"), `Expected QR data URL, got ${qrSrc.slice(0, 30)}`);
await page.locator("#btnModalCopyLink").click();
await page.locator("#appToast").waitFor({ state: "visible", timeout: 2000 });

// Close modal via close button
await page.locator("#btnCloseInviteModal").click();
await page.locator("#inviteModal").waitFor({ state: "hidden", timeout: 2000 });

console.log("6. Testing Host Creator Expiry Extension popover...");
await page.locator("#pillCountdown.creator-interactive").click();
await page.locator("#expiryExtensionPopover").waitFor({ state: "visible", timeout: 3000 });
await page.locator('.expiry-ext-pill[data-ext="20"]').click();
const extLabel = await page.locator("#extAmountDisplay").innerText();
assert.ok(extLabel.includes("20"), `Expected +20 minutes preview, got ${extLabel}`);
await page.locator("#btnCloseExpiryExt").click();
await page.locator("#expiryExtensionPopover").waitFor({ state: "hidden", timeout: 2000 });

console.log("7. Testing Leave Room and return to Landing Screen...");
await page.locator("#btnLeaveRoom").click();
await page.locator("#chatScreen").waitFor({ state: "hidden", timeout: 3000 });
await page.locator("#landingScreen").waitFor({ state: "visible", timeout: 3000 });

console.log("8. Testing FAQ accordion toggles...");
const faqItems = await page.$$(".faq-item");
assert.equal(faqItems.length, 4, `Expected 4 FAQ items, got ${faqItems.length}`);
for (let i = 0; i < faqItems.length; i++) {
  const btn = page.locator(".faq-question").nth(i);
  const ans = page.locator(".faq-answer").nth(i);
  await btn.click();
  await ans.waitFor({ state: "visible", timeout: 2000 });
  await btn.click();
  await ans.waitFor({ state: "hidden", timeout: 2000 });
}

console.log("9. Testing Mobile Navigation Drawer Toggle on 390px viewport...");
const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
const mobilePage = await mobileContext.newPage();
await mobilePage.goto("http://localhost:3097", { waitUntil: "domcontentloaded" });
const toggleBtn = mobilePage.locator("#navToggleBtn");
await toggleBtn.waitFor({ state: "visible", timeout: 2000 });
await toggleBtn.click();
await mobilePage.locator("#mobileMenu").waitFor({ state: "visible", timeout: 2000 });
await toggleBtn.click();
await mobilePage.locator("#mobileMenu").waitFor({ state: "hidden", timeout: 2000 });
await mobileContext.close();

assert.deepEqual(errors, [], `Console errors encountered: ${errors.join(", ")}`);

console.log("\nALL 8 INTERACTION TESTS PASSED WITH ZERO ERRORS!");

await browser.close();
server.close();
