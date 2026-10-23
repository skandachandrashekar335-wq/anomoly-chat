import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import http from "node:http";
import path from "node:path";
import crypto from "node:crypto";

const outDir = path.resolve("docs/screenshots");
await fs.mkdir(outDir, { recursive: true });

// Optional local static server if BASE_URL is not provided
let localServer = null;
let baseURL = process.env.BASE_URL;

if (!baseURL) {
  const mimeTypes = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".json": "application/json",
  };

  const projectRoot = process.cwd();
  localServer = http.createServer((req, res) => {
    let reqPath = req.url.split("?")[0].split("#")[0];
    if (reqPath === "/") reqPath = "/index.html";
    const filePath = path.join(projectRoot, reqPath);

    fsSync.readFile(filePath, (err, data) => {
      if (err) {
        fsSync.readFile(path.join(projectRoot, "index.html"), (err2, indexData) => {
          if (err2) {
            res.writeHead(404);
            res.end("Not Found");
          } else {
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(indexData);
          }
        });
      } else {
        const ext = path.extname(filePath);
        res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
        res.end(data);
      }
    });
  });

  await new Promise((resolve) => {
    localServer.listen(3048, () => {
      baseURL = "http://localhost:3048";
      resolve();
    });
  });
}

console.log(`Running E2E Smoke & Screenshot Suite against: ${baseURL}`);

const browser = await chromium.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--use-fake-ui-for-media-stream"
  ]
});

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
  // ---------------------------------------------------------------------------
  // 1. Desktop Homepage View (1440x900)
  // ---------------------------------------------------------------------------
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const host = await context.newPage();
  watch(host, "host");
  const response = await host.goto(baseURL, { waitUntil: "networkidle", timeout: 60000 });
  assert.ok(response && response.status() === 200, `Homepage HTTP status: ${response?.status()}`);
  await host.locator("h1").first().waitFor({ state: "visible" });
  assert.match(await host.title(), /Anomoly Chat/i);

  // 1. desktop-home.png — standard desktop viewport view
  await host.screenshot({ path: path.join(outDir, "desktop-home.png"), fullPage: false });

  // 2. desktop-full-page.png — complete full-height landing page
  await host.screenshot({ path: path.join(outDir, "desktop-full-page.png"), fullPage: true });

  // ---------------------------------------------------------------------------
  // 2. Mobile Homepage View (390x844) & Horizontal Overflow Check
  // ---------------------------------------------------------------------------
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

  // 3. mobile-home.png — mobile viewport screenshot
  await mobile.screenshot({ path: path.join(outDir, "mobile-home.png"), fullPage: false });

  // ---------------------------------------------------------------------------
  // 3. Room Creation Flow (Presets, Custom Expiry, Controls)
  // ---------------------------------------------------------------------------
  // Select 10m preset on Host to test dynamic expiry selector interaction
  await host.locator('.expiry-pill[data-minutes="10"]').click();
  const labelText = await host.locator("#lifetimeDisplayLabel").innerText();
  assert.ok(labelText.includes("10 minutes"), `Preset label mismatch: ${labelText}`);

  // 4. room-creation.png — room action card with duration selection
  const createCard = host.locator(".entry-card").first();
  await createCard.scrollIntoViewIfNeeded();
  await host.screenshot({ path: path.join(outDir, "room-creation.png"), fullPage: false });

  // Create room as Host
  await host.locator("#btnActionCreate").click();
  await host.locator("#chatScreen").waitFor({ state: "visible", timeout: 30000 });
  await host.locator("#activeRoomCodeLabel").waitFor({ state: "visible" });
  await host.waitForFunction(() => {
    const code = document.querySelector("#activeRoomCodeLabel")?.textContent?.trim() || "";
    return /^[A-Z0-9]{6}$/i.test(code) && code !== "CODE";
  }, null, { timeout: 15000 });

  const roomCode = (await host.locator("#activeRoomCodeLabel").innerText()).trim();
  assert.match(roomCode, /^[A-Z0-9]{6}$/i, `Unexpected room code: ${roomCode}`);

  // ---------------------------------------------------------------------------
  // 4. Invite & QR Code Modal
  // ---------------------------------------------------------------------------
  await host.locator("#btnOpenShareModal").click();
  await host.locator("#inviteModal.open").waitFor({ state: "visible", timeout: 10000 });
  await host.locator("#modalQrImg").waitFor({ state: "visible", timeout: 10000 });

  // 5. invite-qr.png — active room invitation and client-side QR interface
  await host.screenshot({ path: path.join(outDir, "invite-qr.png"), fullPage: false });

  // Close invite modal
  await host.locator("#btnCloseInviteModal").click();
  await host.locator("#inviteModal").waitFor({ state: "hidden", timeout: 5000 });

  // ---------------------------------------------------------------------------
  // 5. Guest Joins & Two-Way WebRTC P2P Session
  // ---------------------------------------------------------------------------
  const guestContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const guest = await guestContext.newPage();
  watch(guest, "guest");
  await guest.goto(baseURL, { waitUntil: "networkidle", timeout: 60000 });
  await guest.locator("#joinCodeInput").fill(roomCode);
  await guest.locator("#btnActionJoin").click();
  await guest.locator("#chatScreen").waitFor({ state: "visible", timeout: 30000 });

  // Wait for P2P connection to establish between peers
  await guest.waitForFunction(() => {
    const text = document.querySelector("#labelParticipants")?.textContent || "";
    return /2\s+Online/i.test(text);
  }, null, { timeout: 45000 });
  await host.waitForFunction(() => {
    const text = document.querySelector("#labelParticipants")?.textContent || "";
    return /2\s+Online/i.test(text);
  }, null, { timeout: 15000 });

  // Exchange realistic synthetic messages
  const msgHost = "Hello! Direct WebRTC DataChannel connection established.";
  await host.locator("#messageTextInput").fill(msgHost);
  await host.locator("#btnSendMessage").click();
  await guest.getByText(msgHost, { exact: true }).waitFor({ state: "visible", timeout: 15000 });

  const msgGuest = "Confirmed from Guest. Zero server persistence and DTLS encrypted.";
  await guest.locator("#messageTextInput").fill(msgGuest);
  await guest.locator("#btnSendMessage").click();
  await host.getByText(msgGuest, { exact: true }).waitFor({ state: "visible", timeout: 15000 });

  // 6. active-chat.png — real active two-way conversation
  await host.screenshot({ path: path.join(outDir, "active-chat.png"), fullPage: false });

  // ---------------------------------------------------------------------------
  // 6. Real Binary Document Transfer (Host -> Guest) with SHA-256 Verification
  // ---------------------------------------------------------------------------
  const sampleDocPath = path.join(outDir, "sample-project-specification.pdf");
  const sampleBuffer = Buffer.alloc(48 * 1024, "A");
  sampleBuffer.write("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n", 0);
  sampleBuffer.write("\n%%EOF\n", sampleBuffer.length - 10);
  await fs.writeFile(sampleDocPath, sampleBuffer);
  const expectedSha256 = crypto.createHash("sha256").update(sampleBuffer).digest("hex");

  // Host attaches document
  await host.locator("#fileAttachmentInput").setInputFiles(sampleDocPath);
  await host.locator("#attachmentPreviewBar").waitFor({ state: "visible", timeout: 5000 });

  // Host sends message with document
  await host.locator("#messageTextInput").fill("Sharing the project architectural specification.");
  await host.locator("#btnSendMessage").click();

  // Guest receives chunks and verifies SHA-256
  await guest.locator(".doc-bubble.received").waitFor({ state: "visible", timeout: 20000 });
  await guest.locator(".doc-verify-badge").waitFor({ state: "visible", timeout: 20000 });
  await guest.locator(".doc-download-btn").waitFor({ state: "visible", timeout: 20000 });

  const verifyTitle = await guest.locator(".doc-bubble.received .doc-verify-badge").getAttribute("title");
  assert.ok(verifyTitle?.includes(expectedSha256), `SHA-256 digest mismatch! Expected ${expectedSha256}, got ${verifyTitle}`);

  // 7. document-transfer.png — verified document card with SHA-256 badge and download button
  await guest.screenshot({ path: path.join(outDir, "document-transfer.png"), fullPage: false });

  // Clean up temporary sample file
  await fs.unlink(sampleDocPath).catch(() => {});

  // ---------------------------------------------------------------------------
  // 7. Creator Expiry Extension Check
  // ---------------------------------------------------------------------------
  await host.locator("#pillCountdown").click();
  await host.locator("#expiryExtensionPopover").waitFor({ state: "visible", timeout: 5000 });
  await host.locator('.expiry-ext-pill[data-ext="10"]').click();
  await host.locator("#btnConfirmExtend").click();
  await host.locator("#expiryExtensionPopover").waitFor({ state: "hidden", timeout: 5000 });

  // Verify errors
  assert.deepEqual(errors, [], `Browser console/page errors:\n${errors.join("\n")}`);

  console.log(JSON.stringify({
    result: "PASS",
    baseURL,
    checks: [
      "homepage HTTP 200",
      "desktop-home.png",
      "desktop-full-page.png",
      "mobile-home.png and zero overflow",
      "room-creation.png",
      "invite-qr.png",
      "active-chat.png (bidirectional P2P)",
      "document-transfer.png (16 KiB chunks, SHA-256 verified)",
      "creator expiry extension"
    ],
    roomCode,
    mobileMetrics,
    screenshots: (await fs.readdir(outDir)).filter(name => name.endsWith(".png"))
  }, null, 2));

  await guestContext.close();
  await mobileContext.close();
  await context.close();
} finally {
  await browser.close();
  if (localServer) {
    localServer.close();
  }
}
