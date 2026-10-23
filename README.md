# Anomoly Chat

<p align="center">
  <strong>Temporary, accountless chat — directly between browsers.</strong><br />
  Text and document sharing over WebRTC, with rooms that expire.
</p>

<p align="center">
  <a href="https://anomoly-chat.vercel.app"><strong>Open the live app</strong></a> ·
  <a href="https://github.com/skandachandrashekar335-wq/anomoly-chat/actions"><strong>CI / test runs</strong></a> ·
  <a href="LICENSE"><strong>Apache-2.0 License</strong></a> ·
  <a href="SECURITY.md"><strong>Security & privacy</strong></a>
</p>

---

## At a glance

- **No registration:** no account, phone number, or email is required.
- **Peer-to-peer chat:** messages use WebRTC data channels after connection setup.
- **Temporary rooms:** choose 5, 10, 15, 20 minutes, or a custom lifetime of 1–60 minutes.
- **Creator-controlled extensions:** the room creator can add time while a room is active, within a four-hour total lifetime ceiling.
- **Document transfer:** share allowlisted PDF, Word, PowerPoint, Excel, text, RTF, and OpenDocument files up to **10 MiB**.
- **Integrity check:** received documents are checked against a SHA-256 digest before the download action is enabled.
- **QR invitations:** QR codes are generated in the browser.
- **Responsive UI:** designed for desktop, tablet, and mobile.
- **Static hosting:** the frontend is deployed on Vercel; the project does not run its own always-on chat server.

> **Privacy note:** “anonymous” means no account or contact details are requested. It does not mean untraceable. See [Security & privacy](SECURITY.md) for the actual data flow and limitations.

## Live app

**https://anomoly-chat.vercel.app**

To try it:
1. Open the live app in one browser and create a room.
2. Share the invitation link or QR code with a second browser/device.
3. Send a text message to check the connection.
4. Use the attachment button to transfer a supported document (up to 10 MiB), then download it on the receiving device.
5. As the room creator, click the countdown to extend an active room.

Peer-to-peer connectivity depends on the networks involved. Some restrictive networks require a TURN relay, which is not currently bundled as a guaranteed fallback.

## How it works

```text
Browser A ── secure signaling handshake ── PeerJS signaling service
    │                                         │
    └──────── direct WebRTC data channel ─────┘
                         │
                      Browser B
```

1. **Static frontend:** Vercel serves the HTML, CSS, JavaScript, and bundled client libraries.
2. **Signaling:** PeerJS's public signaling service helps browsers exchange the connection information needed to start WebRTC.
3. **Chat and files:** once the data channel is established, text and document chunks travel peer-to-peer when the network allows a direct connection.
4. **No app file store:** the application does not upload document contents to its own storage service. Received file data is held temporarily in browser memory for integrity checking and download.
5. **QR codes:** generated locally in the browser.

WebRTC encrypts data in transit. The signaling service still sees connection metadata, and direct peer-to-peer networking can expose peers' public IP addresses to each other. A TURN relay, if added in the future, would relay traffic for connections that cannot be established directly.

## Features

### Temporary rooms
- Six-character room codes and shareable invitations.
- Default room lifetime: **5 minutes**.
- Presets: **5, 10, 15, and 20 minutes**; custom initial lifetime: **1–60 minutes**.
- Countdown synchronized between connected peers.
- Creator-only extensions: **+5, +10, +15, +20 minutes**, or custom **1–60 minutes**.
- Maximum total room lifetime: **4 hours from creation**.
- Expired rooms lock the UI and close active connections.

**Architecture limitation:** this is a browser-first design, not a trusted server-enforced room service. The creator's browser acts as the room authority; if the creator closes the tab or loses connectivity, the session can end. A modified/malicious client can bypass client-side rules. Do not use this design for regulated, high-risk, or adversarial communications.

### Text messaging
- Real-time messages over WebRTC data channels.
- Safe DOM text rendering to avoid treating user messages as HTML.
- Message length and basic rate controls.

### Document sharing
- Supported extensions: `.pdf`, `.doc`, `.docx`, `.txt`, `.rtf`, `.ppt`, `.pptx`, `.xls`, `.xlsx`, `.odt`, `.ods`, `.odp`.
- Maximum size: **10 MiB (10,485,760 bytes)** per file; empty and oversized files are rejected.
- Binary transfer in **16 KiB chunks**; no Base64 expansion.
- Backpressure handling to avoid overwhelming the data channel.
- SHA-256 integrity verification before a completed download is offered.
- No intentional persistence to localStorage, IndexedDB, Cache Storage, or an application file database.
- Temporary buffers and Blob URLs are cleared when transfer/session cleanup runs.

The extension allowlist is not malware scanning. Only download documents from people you trust. The app cannot control all browser/OS memory behavior or the recipient's normal download destination.

## Run locally

Requirements: Node.js 22 or newer and npm.

```bash
git clone https://github.com/skandachandrashekar335-wq/anomoly-chat.git
cd anomoly-chat
npm ci
npm run typecheck
npm test
```

The test command compiles TypeScript and runs the Node.js built-in test runner.

For the optional local Express development server:

```bash
npm start
```

The static frontend is also available from `index.html` and `public/index.html` using any local static HTTP server. Peer-to-peer features require internet access to reach the signaling service; opening a file directly with `file://` may not work as expected.

## Quality checks and proof

- Automated test source: [`src/index.test.ts`](src/index.test.ts)
- GitHub Actions: [workflow runs](https://github.com/skandachandrashekar335-wq/anomoly-chat/actions)
- Feature verification checklist and recorded test scope: [`docs/VERIFICATION.md`](docs/VERIFICATION.md)
- Security and privacy notes: [`SECURITY.md`](SECURITY.md)

The latest implementation report recorded **40 passing automated tests** and a two-browser WebRTC test for chat, a sample document transfer with SHA-256 verification, and a synchronized creator expiry extension. These are reported results, not a guarantee that every device/network combination will work. The GitHub Actions workflow provides a repeatable automated check for future changes; browser-network behavior still needs testing on real devices and networks.

## Project structure

```text
.
├── index.html                 # Main browser app
├── public/
│   ├── index.html             # Static deployment copy
│   ├── peerjs.min.js          # PeerJS client bundle
│   └── qrcode.min.js          # Client-side QR generation
├── src/
│   ├── index.ts               # Shared utilities and optional local server
│   └── index.test.ts          # Automated tests
├── docs/
│   └── VERIFICATION.md        # Test evidence and manual release checklist
├── .github/workflows/ci.yml   # Automated CI
├── vercel.json                # Static deployment headers/config
├── SECURITY.md
└── LICENSE                    # Apache License 2.0
```

## License

This project is licensed under the **Apache License 2.0**. See [LICENSE](LICENSE).

## Contributing

Bug reports and improvements are welcome. Please:
1. Reproduce the issue and include browser/OS/network details without sharing private room links or secrets.
2. Run `npm run typecheck` and `npm test`.
3. Test both desktop and mobile layouts for UI changes.
4. Never commit credentials, session invitations, private files, or personal data.

For security concerns, follow [SECURITY.md](SECURITY.md).
