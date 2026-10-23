# Anomoly Chat

Anonymous. Ephemeral. Private text conversations without accounts or digital footprints.

**Status: Production-Grade Foundation & Verified UI**

A modern, high-performance in-memory WebSocket chat application built with:
- **Neumorphism (Soft UI)** design system with responsive typography and balanced tactile surfaces
- **Room-scoped broadcasting**: Strict server-side message routing using `Map<roomCode, Set<WebSocket>>`
- **100% in-memory**: Volatile RAM storage only; zero database writes, zero disk logs
- **Automatic 5-minute inactivity TTL**: Rooms auto-destruct 5 minutes after the last message
- **Instant invitations & real QR codes**: Shareable URL pre-fills room codes; native Web Share API with clipboard fallback; real SVG QR code generator (`/api/qr`)
- **Strict security & validation**: Server-side 500-character cap, empty-message rejection, and sliding-window rate limiting
- **Automated test suite**: 18 real automated tests covering room lifecycles, cross-room isolation, validation, brute-force protection, and QR generation

## Tech Stack
- **Runtime**: Node.js (v20+ / ES2022)
- **Framework**: Express 5
- **Realtime Transport**: `ws` (WebSockets)
- **Type Safety**: TypeScript (`tsc`)
- **Frontend**: Vanilla HTML5, CSS3 (Neumorphism Design Tokens), and ES6 JavaScript (zero front-end framework bloat)
- **Test Runner**: Node.js built-in test runner (`node:test`)

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Typecheck and build
npm run typecheck
npm run build

# 3. Run automated test suite
npm test

# 4. Start the server
npm start

# 5. Open in browser
# Visit http://localhost:3000
```

## Available Scripts

- `npm run build`: Compiles TypeScript to `dist/`
- `npm run typecheck`: Runs `tsc --noEmit` to verify type safety
- `npm test`: Builds and executes the automated test suite (18 tests)
- `npm start`: Starts the application on port 3000 (or `$PORT`)
- `npm run dev`: Starts the application with `ts-node` for live development

## Engineering Architecture & Privacy Notice

1. **In-Memory Heap**: All rooms and active socket connections exist purely in the Node.js memory heap (`Map<string, Room>`). A server restart completely purges all history.
2. **Immediate Expiry**: Rooms that remain inactive for over 5 minutes reject operations immediately on the next message attempt and are automatically cleaned up by a periodic 30-second garbage sweep.
3. **Honest Security**: Messages travel encrypted over TLS/WSS in production to protect transit. The application is **not** end-to-end encrypted (E2EE), as the server inspects message routing and enforces rate limits in RAM.
