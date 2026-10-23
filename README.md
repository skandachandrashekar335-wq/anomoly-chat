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
3. **Dynamic Room Expiry (Absolute Lifetime)**:
   - The room creator chooses the room's lifespan before creating it:
     - **5 minutes** (Default)
     - **10 minutes**
     - **15 minutes**
     - **20 minutes**
     - **Custom duration** (1 to 60 minutes)
   - Expiration is an **absolute lifetime** synchronized between all peers via session metadata. Joining or sending messages does not reset the room's absolute destruction time.
   - When expired: all WebRTC connections sever, input controls lock, and memory is wiped clean.
4. **Client-Side Offline QR Codes**:
   - Scannable QR codes are generated directly in the browser via `qrcode.min.js`.
   - Zero network requests or backend image generation endpoints required.
5. **Session Key in URL Hash (`#key=...&exp=...`)**:
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

The project includes 25 automated tests in `src/index.test.ts`:

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

---

## 📱 Browser & Viewport Verification

The user interface has been tested across all responsive viewports:
- **Desktop (1440px & 1280px)**: Compact chat card (`height: min(700px, calc(100vh - 110px))`), natural column message flow, subtle hover lift on interactive cards.
- **Tablet (768px)**: Flexible container scaling, accessible touch targets.
- **Mobile (390px)**: Neumorphic hamburger navigation, touch-friendly composer fixed at viewport bottom, `100dvh` layout preventing keyboard clipping.
