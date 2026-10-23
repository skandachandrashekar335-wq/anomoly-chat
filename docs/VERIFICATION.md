# Anomoly Chat — Verification & Quality Record

This document records the automated test results, browser-level integration tests, screenshot artifacts, and release quality checklist for **Anomoly Chat**.

---

## 1. Automated Test Suite (40 Passing Tests)

Run the full automated unit, protocol, and security test suite:

```bash
npm ci
npm run typecheck
npm test
```

### Test Suite Breakdown (`src/index.test.ts`):
- **Helper Functions (3 tests)**:
  - Generates valid 6-character room codes using non-ambiguous character set.
  - Rejects ambiguous or malformed room codes.
  - Detects expired rooms accurately based on TTL.
- **Room Creation & Joining (4 tests)**:
  - Creates room and assigns valid 6-character code.
  - Allows multiple clients to join existing rooms.
  - Returns appropriate errors for non-existent rooms.
  - Validates forbidden characters in room codes.
- **Room-Scoped Isolation (1 test)**:
  - Verifies zero message leakage across separate room codes.
- **Validation & Rate Limiting (6 tests)**:
  - Rejects empty and whitespace-only messages.
  - Rejects messages strictly exceeding 500 characters.
  - Enforces sliding-window rate limits against rapid spam flooding.
  - Rejects rapid join attempts to protect against brute-force guessing.
- **Room Expiry & QR Generation (4 tests)**:
  - Immediate rejection when joining expired rooms.
  - Memory sweep garbage collection.
  - Clean room leave and connection close handling.
  - SVG QR code generation via backend utility.
- **Browser-First WebRTC & Dynamic Expiry Protocol (7 tests)**:
  - Presets (5m, 10m, 15m, 20m) calculation.
  - Strict boundary clamping for custom durations (1–60 minutes).
  - Absolute expiration calculation (`expiresAt = createdAt + lifetimeMs`).
  - Automatic detection and blocking of expired room invitations.
  - URL fragment hash parsing (`#key=...&exp=...`) without server leakage.
  - DOM textContent XSS injection resistance against `<script>`, `onerror`, and HTML vectors.
  - Sliding-window message throttling.
- **Feature 1 — Real Document Sharing Engine (10 tests)**:
  - Rejection of empty 0-byte files.
  - Acceptance of valid documents up to exactly 10 MiB limit.
  - Rejection of files exceeding 10 MiB limit by even 1 byte.
  - Document allowlist validation (`.pdf`, `.doc`, `.docx`, `.txt`, `.rtf`, `.ppt`, `.pptx`, `.xls`, `.xlsx`, `.odt`, `.ods`, `.odp`).
  - Rejection of dangerous executable extensions (`.exe`, `.sh`, `.bat`, `.js`, `.py`, `.html`).
  - Filename sanitization against directory traversal (`../`, `..\`) and injection symbols.
  - Filename capping at 100 characters while preserving file extension.
  - Chunk boundary calculation for 16 KiB chunks.
  - SHA-256 binary reassembly verification.
  - SHA-256 detection of corrupted or tampered payloads.
- **Feature 2 — Creator-Controlled Expiry Extension (5 tests)**:
  - Preset increments (+5m, +10m, +15m, +20m).
  - Custom duration validation strictly between 1 and 60 minutes.
  - Expired room lockout enforcement (cannot extend an expired room).
  - 4-hour maximum total room lifetime ceiling from room creation.
  - Authoritative validation: Host ignores guest requests; Guests accept extensions only from the verified Host connection.

---

## 2. Browser E2E Smoke & Screenshot Suite

Run the automated browser test suite (Playwright Chromium):

```bash
# 1. Install browser binary (first time only)
npx playwright install --with-deps chromium

# 2. Run automated smoke tests and screenshot capture
npm run test:smoke
```

### Verified Checks in E2E Suite:
1. **Homepage Response**: Verifies HTTP 200, valid title, and presence of core interactive elements.
2. **Responsive Zero-Overflow**: Verifies mobile viewport (`390px`) document width matches viewport (`clientWidth === scrollWidth === 390px`) with zero horizontal overflow.
3. **Room Creation Flow**: Selects duration preset, verifies duration calculation, and creates active room.
4. **Client-Side QR Code**: Opens invite modal, verifies QR image rendering and share link construction.
5. **Real Two-Peer Session**: Joins with a second isolated browser context, waits for WebRTC DataChannel connection (`2 Online`).
6. **Bidirectional Messaging**: Exchanges text messages between peers over encrypted DataChannel.
7. **Document Transfer**: Sends a synthetic PDF, streams 16 KiB chunks, verifies SHA-256 digest on receiver, and verifies download button rendering.
8. **Creator Extension**: Creator adds +10m to active room; verifies real-time guest countdown synchronization.
9. **Zero Console Errors**: Asserts zero unhandled JavaScript errors across all pages.

---

## 3. Real Curated Screenshot Gallery

Genuine screenshots generated directly from running application sessions are tracked in [`docs/screenshots/`](screenshots/):

| File | Description | Resolution / Viewport |
| :--- | :--- | :--- |
| [`desktop-home.png`](screenshots/desktop-home.png) | Desktop landing page with Neumorphism hero and feature cards | 1440 × 900 px |
| [`desktop-full-page.png`](screenshots/desktop-full-page.png) | Complete full-height desktop landing page from navigation to footer | 1440 px full-page |
| [`mobile-home.png`](screenshots/mobile-home.png) | Mobile viewport layout with zero horizontal overflow | 390 × 844 px |
| [`room-creation.png`](screenshots/room-creation.png) | Interactive room creation card with expiry duration presets and custom slider | 1440 × 900 px |
| [`active-chat.png`](screenshots/active-chat.png) | Active two-peer room with live countdown and bidirectional conversation | 1440 × 900 px |
| [`invite-qr.png`](screenshots/invite-qr.png) | Real invitation modal with in-browser generated QR code and copy link | 1440 × 900 px |
| [`document-transfer.png`](screenshots/document-transfer.png) | Real document card showing bit-for-bit verified SHA-256 badge and download button | 1280 × 900 px |

---

## 4. Release Checklist

Before tagging a production release:

- [x] Run `npm run typecheck` — zero TypeScript errors.
- [x] Run `npm test` — all 40 unit and protocol tests passing.
- [x] Run `npm run test:smoke` — all browser smoke tests passing with zero console errors.
- [x] Ensure `index.html` and `public/index.html` are strictly synchronized.
- [x] Check that all screenshot links in `README.md` and documentation use valid relative paths.
- [x] Confirm `.github/workflows/ci.yml` passes on push to `main`.
- [x] Verify live production deployment on `https://anomoly-chat.vercel.app`.
- [x] Test live two-peer messaging on production between two independent browser profiles.
- [x] Test live document sharing and SHA-256 verification on production.
- [x] Verify creator-only extension privilege and guest lockout on production.
