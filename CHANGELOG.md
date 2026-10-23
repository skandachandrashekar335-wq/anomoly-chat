# Changelog

All notable changes to **Anomoly Chat** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-10-24

### Added
- **Browser-First WebRTC P2P Architecture**: Migrated from a persistent Node.js WebSocket server to direct peer-to-peer communication via WebRTC `RTCDataChannel`, brokered by PeerJS cloud signaling.
- **P2P Binary Document Sharing**:
  - Direct peer-to-peer transmission of PDF, Word (`.doc`, `.docx`), Excel (`.xls`, `.xlsx`), PowerPoint (`.ppt`, `.pptx`), text (`.txt`, `.rtf`), and OpenDocument (`.odt`, `.ods`, `.odp`) formats up to **10 MiB (10,485,760 bytes)**.
  - 16 KiB binary chunking over `ArrayBuffer` without Base64 encoding overhead.
  - Real-time backpressure management via `dataChannel.bufferedAmount` to prevent socket saturation.
  - Bit-for-bit SHA-256 cryptographic integrity verification using `crypto.subtle.digest`.
  - Ephemeral in-memory `Blob` allocation with automatic Object URL revocation on room exit.
- **Creator-Controlled Room Expiry Extension**:
  - Authoritative Host extension popover with presets (+5m, +10m, +15m, +20m) and custom duration (1–60 minutes).
  - Maximum total room lifetime ceiling enforced at 4 hours from creation.
  - Real-time guest synchronization over DataChannel without page reloads.
  - Security authorization check: non-host peers cannot open the extension UI or trigger unauthorized extensions.
- **Dynamic Absolute Room Expiry**: Preset room durations (5m default, 10m, 15m, 20m) and custom durations (1–60m). Countdown timer locked to absolute timestamp (`roomExpiresAt = createdAt + lifetimeMs`).
- **Client-Side Offline QR Codes**: Instant scannable QR code generation in-browser via bundled `qrcode.min.js`.
- **URL Hash Fragment Security**: Cryptographic session secret and expiry timestamp are embedded in the URL fragment (`#key=...&exp=...`), ensuring credentials are never transmitted to web servers in HTTP headers or referrers.
- **Neumorphism Design System**: Tactile Soft-UI design tokens (`--neu-flat`, `--neu-pressed`, `--neu-btn`) with responsive layouts for desktop (1440px), tablet (768px), and mobile (390px).
- **Automated Test Suite**: 40 automated tests in `src/index.test.ts` covering room code generation, XSS sanitization, rate-limiting, chunk boundaries, SHA-256 integrity, and expiry extension bounds.
- **Automated Browser E2E Smoke Suite**: Playwright script (`scripts/e2e-smoke.mjs`) testing two-peer connection, message exchange, document transfer, mobile viewport zero-overflow, and screenshot capture.
- **GitHub Actions CI**: Automated workflow (`.github/workflows/ci.yml`) running `npm run typecheck`, `npm run build`, `npm test`, Playwright smoke tests, and screenshot artifact uploads.
- **Open Source Documentation**: `LICENSE` (Apache-2.0), `SECURITY.md`, `CONTRIBUTING.md`, `docs/ARCHITECTURE.md`, `docs/VERIFICATION.md`, and issue/PR templates.

### Changed
- Converted chat screen from unbounded container to compact layout (`height: min(700px, calc(100vh - 110px))`) with natural bottom-to-top message stacking.
- Synchronized production static assets between `index.html` and `public/index.html`.
- Updated documentation and FAQs to reflect honest privacy limitations regarding WebRTC IP exposure and signaling metadata.

---

## [0.2.0] - 2026-10-23 (Commit `f2c9be0`)

### Added
- Static deployment configuration for Vercel (`vercel.json`).
- Dynamic expiry presets on room creation (5m, 10m, 15m, 20m, custom).
- PeerJS client integration for browser-side signaling.
- Offline QR generation integration.

---

## [0.1.0] - 2026-10-23 (Commit `74de595`)

### Added
- Initial runnable application foundation.
- Node.js & Express server with in-memory WebSocket room routing.
- Baseline Neumorphic UI design system.
- Initial unit test suite with 17 passing tests.
