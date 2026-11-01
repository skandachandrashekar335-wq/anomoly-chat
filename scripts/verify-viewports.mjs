import { chromium } from "playwright";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const viewports = [
  { name: "narrow-320", width: 320, height: 700, isMobile: true },
  { name: "mobile-375", width: 375, height: 812, isMobile: true },
  { name: "mobile-390", width: 390, height: 844, isMobile: true },
  { name: "mobile-430", width: 430, height: 932, isMobile: true },
  { name: "tablet-768", width: 768, height: 1024, isMobile: true },
  { name: "laptop-1280", width: 1280, height: 800, isMobile: false },
  { name: "desktop-1440", width: 1440, height: 900, isMobile: false },
];

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

await new Promise(resolve => server.listen(3098, resolve));
console.log("Local verification server running at http://localhost:3098");

const browser = await chromium.launch({ headless: true });
const results = [];

for (const vp of viewports) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.isMobile,
    hasTouch: vp.isMobile,
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", err => pageErrors.push(err.message));

  await page.goto("http://localhost:3098", { waitUntil: "networkidle" });

  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));

  // Assert landing page has no horizontal overflow (allowing at most 1px for subpixel rendering)
  const hasOverflow = metrics.scrollWidth > metrics.clientWidth + 1;
  assert.ok(!hasOverflow, `Landing page on viewport ${vp.name} (${vp.width}x${vp.height}) has overflow: client=${metrics.clientWidth}, scroll=${metrics.scrollWidth}`);

  // Test interactive controls: FAQ accordion
  const firstFaq = page.locator(".faq-question").first();
  await firstFaq.click();
  const firstFaqAnswer = page.locator(".faq-answer").first();
  await firstFaqAnswer.waitFor({ state: "visible", timeout: 3000 });
  await firstFaq.click(); // Close it

  // If mobile/tablet, test mobile menu open and close
  if (vp.isMobile) {
    const navToggle = page.locator("#navToggleBtn");
    if (await navToggle.isVisible()) {
      await navToggle.click();
      await page.locator("#mobileMenu").waitFor({ state: "visible", timeout: 3000 });
      await navToggle.click();
      await page.locator("#mobileMenu").waitFor({ state: "hidden", timeout: 3000 });
    }
  }

  // Test Room Creation and Chat View Responsiveness on this Viewport
  await page.locator("#btnActionCreate").click();
  await page.locator("#chatScreen").waitFor({ state: "visible", timeout: 20000 });

  // Verify chat screen metrics & zero overflow
  const chatMetrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    chatScreenWidth: document.getElementById("chatScreen").scrollWidth,
    chatScreenClient: document.getElementById("chatScreen").clientWidth,
  }));
  const chatOverflow = chatMetrics.scrollWidth > chatMetrics.clientWidth + 1 ||
                       chatMetrics.chatScreenWidth > chatMetrics.chatScreenClient + 1;
  assert.ok(!chatOverflow, `Chat view on viewport ${vp.name} has overflow: client=${chatMetrics.clientWidth}, scroll=${chatMetrics.scrollWidth}`);

  // Verify that Countdown timer is visible and active on all screens, including mobile!
  const countdownVisible = await page.locator("#pillCountdown").isVisible();
  assert.ok(countdownVisible, `Countdown timer must be visible on viewport ${vp.name}`);

  // Verify Invite QR Modal sizing on this viewport
  await page.locator("#btnOpenShareModal").click();
  await page.locator("#inviteModal").waitFor({ state: "visible", timeout: 3000 });
  const modalMetrics = await page.evaluate(() => {
    const card = document.querySelector(".modal-card");
    return {
      cardWidth: card.offsetWidth,
      viewportWidth: window.innerWidth,
    };
  });
  assert.ok(modalMetrics.cardWidth <= modalMetrics.viewportWidth, `Modal card (${modalMetrics.cardWidth}px) exceeds viewport (${modalMetrics.viewportWidth}px) on ${vp.name}`);
  await page.locator("#btnCloseInviteModal").click();
  await page.locator("#inviteModal").waitFor({ state: "hidden", timeout: 3000 });

  // Test Smart Expiry Warning on this viewport
  await page.evaluate(() => {
    if (window.__setTestExpiry) {
      window.__setTestExpiry(55 * 1000); // 55s: tier 1m
    }
  });
  await page.locator("#smartExpiryWarning").waitFor({ state: "visible", timeout: 3000 });
  const warningHeadline = await page.locator("#expiryWarningHeadline").innerText();
  assert.ok(warningHeadline.includes("1 Minute") || warningHeadline.includes("Expiring"), `Expected warning headline, got: ${warningHeadline}`);

  // Verify Host has visible 'Extend Room' button on warning banner
  const extendBtnVisible = await page.locator("#btnWarningExtend").isVisible();
  assert.ok(extendBtnVisible, `Host must see Extend Room button in warning banner on ${vp.name}`);

  // Verify Creator Popover sizing on this viewport
  await page.locator("#btnWarningExtend").click();
  await page.locator("#expiryExtensionPopover").waitFor({ state: "visible", timeout: 3000 });
  const popoverMetrics = await page.evaluate(() => {
    const pop = document.getElementById("expiryExtensionPopover");
    const rect = pop.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      width: rect.width,
      viewportWidth: window.innerWidth,
    };
  });
  assert.ok(popoverMetrics.left >= 0 && popoverMetrics.right <= popoverMetrics.viewportWidth + 2,
    `Popover out of bounds on ${vp.name}: left=${popoverMetrics.left}, right=${popoverMetrics.right}, vw=${popoverMetrics.viewportWidth}`);
  await page.locator("#btnCloseExpiryExt").click();
  await page.locator("#expiryExtensionPopover").waitFor({ state: "hidden", timeout: 3000 });

  // Leave room cleanly
  await page.locator("#btnLeaveRoom").click();
  await page.locator("#landingScreen").waitFor({ state: "visible", timeout: 5000 });

  assert.deepEqual(pageErrors, [], `Page errors on ${vp.name}: ${pageErrors.join(", ")}`);

  results.push({
    viewport: vp.name,
    size: `${vp.width}x${vp.height}`,
    clientWidth: metrics.clientWidth,
    scrollWidth: metrics.scrollWidth,
    overflow: false,
    chatVerified: true,
    warningVerified: true,
    errors: pageErrors.length,
  });

  await context.close();
}

await browser.close();
server.close();

console.log("\n--- Multi-Viewport Responsive Verification Results ---");
console.table(results);
