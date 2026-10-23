# Anomoly Chat

> **Anonymous. Temporary. Browser-to-Browser Text Chat.**
> No user accounts, no phone numbers or email registration, no message database, and no persistent server.

**Live Production URL:** [https://anomoly-chat.vercel.app](https://anomoly-chat.vercel.app)

---

## 🌟 Key Architecture Decisions

Anomoly Chat has migrated from an always-on persistent server to a **browser-first, serverless WebRTC peer-to-peer architecture** hosted on Vercel:

1. **Browser-to-Browser WebRTC DataChannels**:
   - Chat messages travel **directly between devices** via WebRTC DataChannels (`RTCDataChannel`).
   - Transport encryption is enforced at the network protocol layer using standard WebRTC DTLS/SRTP cryptography.
   - Zero database writes, zero server disk storage, zero message logs.
2. **Static Vercel Deployment**:
   - The entire application runs as static assets hosted globally on Vercel's Edge CDN.
   - Instant loading, zero cold-starts, zero server maintenance costs.
3. **P2P Binary Document Sharing (Up to 10 MiB)**:
   - Participants can share PDF, Word, Excel, PowerPoint, Text, RTF, and OpenDocument formats directly over WebRTC DataChannels.
   - Files are sliced into **16 KiB binary chunks** transferred via `ArrayBuffer` without Base64 inflation.
   - **Backpressure Management**: Prevents buffer saturation on slow networks by monitoring `bufferedAmount` and yielding to the event loop.
   - **SHA-256 Integrity Verification**: Sender computes cryptographic digest (`crypto.subtle.digest`); recipient verifies full payload bit-for-bit before generating an in-memory download link.
   - **Zero Persistence**: Files exist strictly in transient browser RAM as ephemeral Object URLs and are immediately revoked when leaving the room.
4. **Creator-Controlled Room Expiry Extension**:
   - The room creator (Host) has exclusive privilege to add time to active rooms (+5m, +10m, +15m, +20m presets or custom 1–60m).
   - Authoritative Host-only extension: guests cannot alter room duration; guest clients reject extension messages unless sent by the verified Host.
   - **Real-Time Synchronization**: Countdown timer updates synchronously across all connected peers without requiring page reloads.
   - **4-Hour Maximum Lifetime**: Absolute ceiling of 4 hours from creation prevents runaway lingering rooms. Expired rooms cannot be resurrected.
5. **Dynamic Room Expiry (Absolute Lifetime)**:
   - The room creator chooses the room's lifespan before creating it:
     - **5 minutes** (Default)
     - **10 minutes**
     - **15 minutes**
     - **20 minutes**
     - **Custom duration** (1 to 60 minutes)
   - Expiration is an **absolute lifetime** synchronized between all peers via session metadata. Joining or sending messages does not reset the room's absolute destruction time.
   - When expired: all WebRTC connections sever, input controls lock, and memory is wiped clean.
6. **Client-Side Offline QR Codes**:
   - Scannable QR codes are generated directly in the browser via `qrcode.min.js`.
   - Zero network requests or backend image generation endpoints required.
7. **Session Key in URL Hash (`#key=...&exp=...`)**:
   - Cryptographic session secrets and absolute expiration timestamps are passed in the URL fragment (`#hash`).
   - Browsers **never send URL fragments in HTTP request headers or referrers**, protecting session credentials from intermediate network observers.

---

## 🌐 Networking & Signaling: The Honest Truth

WebRTC requires **signaling** to exchange connection metadata (ICE candidates and session descriptions) before two browsers can establish a direct peer-to-peer connection:

- **Signaling Mechanism**: Handled via the public PeerJS cloud signaling infrastructure (`0.peerjs.com`) over secure WebSockets (`wss:`). The signaling server only brokers the initial handshake; it never receives, relays, or stores chat messages once the direct DataChannel opens.
- **NAT Traversal (STUN)**: Public Google STUN servers (`stun:stun.l.google.com:19302`) allow peers to discover their public IP and port mappings.
- **Firewall & Symmetric NAT Limitations (TURN)**: Direct P2P hole-punching works across most residential networks. However, restrictive enterprise firewalls, cellular carrier-grade NATs (CGNAT), or symmetric NATs require a TURN relay server to route traffic when direct connections fail. If a direct P2P connection cannot be established within 12 seconds, Anomoly Chat displays a transparent notification banner explaining the NAT/firewall constraint.

---

## 🔒 Privacy & Security Analysis

- **No User Registration**: Anyone can create or join a room with a 6-character code. No credentials, cookies, or tracking pixels exist.
- **Transport Security**: Direct WebRTC DataChannels are encrypted by standard DTLS (Datagram Transport Layer Security).
- **XSS Protection**: All incoming messages are inserted into the DOM strictly via `.textContent = text` on safe `<div>` elements. Raw HTML or script tags cannot execute.
- **Rate Limiting**: Client-side sliding-window rate limiting prevents flooding (maximum 5 messages per 2-second window).
- **Privacy Limitations**:
  - WebRTC peer-to-peer connections expose peers' public IP addresses to each other to establish direct UDP sockets.
  - The signaling server observes public IP addresses and peer connection timings during the initial handshake.
  - Anomoly Chat provides **ephemeral, accountless anonymity**, not complete untraceability.

---

## 🛠️ Tech Stack

- **Frontend**: Vanilla HTML5, CSS3 (Neumorphism / Soft UI), Vanilla JavaScript (ES2022)
- **Peer-to-Peer**: WebRTC DataChannel & `peerjs` (bundled static 85KB)
- **Offline QR**: `qrcode` (bundled static 24KB)
- **Hosting**: Vercel Static Hosting (`vercel.json`)
- **Local Dev Server**: Node.js & Express 5 (optional for local testing)
- **Test Runner**: Node.js built-in test suite (`node:test`)

---

## 🚀 Quick Start & Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Tests
```bash
# Typecheck TypeScript files
npm run typecheck

# Run test suite (25 automated unit & protocol tests)
npm test
```

### 3. Local Development Server
```bash
# Start local development server on http://localhost:3000
npm start
```
Or open `index.html` with any local static HTTP server (e.g. `npx serve public` or `python3 -m http.server 3000`).

---

## 🧪 Automated Test Suite

The project includes **40 automated tests** in `src/index.test.ts` across 9 distinct test suites:

- **Helper Functions**: 6-character code generation, ambiguous character avoidance (`0`, `O`, `I`, `l`), format validation.
- **Validation & Rate Limiting**: Empty message rejection, 500-character cap, rapid-fire rate limiting.
- **Dynamic Expiry Suite**:
  - Correct duration calculation for presets: 5m, 10m, 15m, 20m.
  - Strict boundary clamping for custom duration (1 to 60 minutes).
  - Absolute expiration calculation (`expiresAt = createdAt + lifetimeMs`).
  - Automatic detection and blocking of expired invitations (`now >= expiresAt`).
- **WebRTC Protocol & Security**:
  - Safe URL hash fragment parsing (`#key=...&exp=...`).
  - XSS injection defense validation (verifying `.textContent` immunity against `<script>`, `onerror`, and HTML vectors).
  - Sliding-window spam throttling.
- **Feature 1 — Real Document Sharing Engine**:
  - Rejection of empty 0-byte files.
  - Strict 10 MiB upper limit enforcement (rejecting 10MB + 1 byte).
  - Extension allowlist verification (.pdf, .doc, .docx, .txt, .rtf, .ppt, .pptx, .xls, .xlsx, .odt, .ods, .odp).
  - Rejection of executable / scripting extensions (.exe, .sh, .bat, .js, .py, .html, etc.).
  - Filename sanitization against directory traversal (`../`, `..\`) and injection characters.
  - Filename capping at 100 characters with extension preservation.
  - Accurate chunk count calculation for 16 KiB chunks.
  - SHA-256 binary integrity verification on chunk reassembly.
  - Detection of corrupted / tampered payloads during transmission.
- **Feature 2 — Creator-Controlled Expiry Extension**:
  - Host duration extensions with preset increments (+5m, +10m, +15m, +20m).
  - Custom extensions strictly between 1 and 60 minutes.
  - Expired room lockout enforcement (cannot extend an expired room).
  - 4-hour maximum total room lifetime ceiling enforcement.
  - Authoritative validation: Host ignores guest requests; Guests accept extensions only from the verified Host connection.

---

## 📱 Browser & Viewport Verification

The user interface has been tested across all responsive viewports:
- **Desktop (1440px & 1280px)**: Compact chat card (`height: min(700px, calc(100vh - 110px))`), natural column message flow, subtle hover lift on interactive cards.
- **Tablet (768px)**: Flexible container scaling, accessible touch targets.
- **Mobile (390px)**: Neumorphic hamburger navigation, touch-friendly composer fixed at viewport bottom, `100dvh` layout preventing keyboard clipping.
