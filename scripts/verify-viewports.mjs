import { chromium } from "playwright";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const viewports = [
  { name: "desktop-1440", width: 1440, height: 900, isMobile: false },
  { name: "laptop-1280", width: 1280, height: 800, isMobile: false },
  { name: "tablet-768", width: 768, height: 1024, isMobile: true },
  { name: "mobile-390", width: 390, height: 844, isMobile: true },
  { name: "narrow-320", width: 320, height: 700, isMobile: true },
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

  // Assert no horizontal overflow (allowing at most 1px for subpixel rendering)
  const hasOverflow = metrics.scrollWidth > metrics.clientWidth + 1;
  assert.ok(!hasOverflow, `Viewport ${vp.name} (${vp.width}x${vp.height}) has overflow: client=${metrics.clientWidth}, scroll=${metrics.scrollWidth}`);

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

  assert.deepEqual(pageErrors, [], `Page errors on ${vp.name}: ${pageErrors.join(", ")}`);

  results.push({
    viewport: vp.name,
    size: `${vp.width}x${vp.height}`,
    clientWidth: metrics.clientWidth,
    scrollWidth: metrics.scrollWidth,
    overflow: false,
    errors: pageErrors.length,
  });

  await context.close();
}

await browser.close();
server.close();

console.log("\n--- Multi-Viewport Responsive Verification Results ---");
console.table(results);
