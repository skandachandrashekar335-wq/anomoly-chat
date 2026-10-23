# Security and privacy

Anomoly Chat is an accountless, browser-first chat experiment. Please read these limits before using it for sensitive information.

## Reporting a vulnerability

Do not publish working exploit details, private room invitation URLs, session fragments, or real documents in an issue. Use GitHub's private vulnerability reporting feature if it is enabled for this repository; otherwise contact the repository maintainer privately through their GitHub profile.

Please include:
- A concise description and impact.
- Reproduction steps using synthetic data.
- Browser/OS details.
- Any relevant sanitized console output.

## Data flow

- The static frontend is served from Vercel.
- PeerJS's public signaling infrastructure helps peers exchange connection metadata.
- After a WebRTC data channel opens, messages and document chunks are sent directly between peers when network conditions permit.
- This project does not intentionally upload chat text or document contents to an application database or file-storage service.
- QR codes are generated in the browser.

## Privacy limits

- No account, phone number, or email registration is required. This is not a guarantee of untraceability.
- PeerJS signaling and network operators may observe connection metadata and IP addresses.
- Direct WebRTC connections can expose each peer's public IP address to the other peer.
- Some networks cannot establish a direct connection without a TURN relay. A relay would carry traffic and could observe network metadata.
- WebRTC data channels are encrypted in transit. This alone does not establish peer identity or provide a guarantee against a malicious peer.
- Room expiry and creator authorization are enforced by the browser protocol. Without a trusted server, a malicious client can modify its own code or state; expiry is not tamper-proof against the room creator.
- Browser memory management, operating-system paging, browser internals, and the recipient's chosen download destination are outside the application's complete control.

## Document sharing

- The client rejects empty files, files larger than 10 MiB, and extensions outside the configured document allowlist.
- Extension checks are not malware scanning and do not prove file contents match the filename.
- A received file is made available for download only after the implementation's SHA-256 integrity check succeeds.
- The app does not intentionally persist file contents in localStorage, IndexedDB, Cache Storage, or an application file database.
- Recipients can save, copy, or redistribute files they receive. Expiring a room cannot delete a file already downloaded by another participant.
- Do not open documents from untrusted senders.

## Safe use

Do not use Anomoly Chat as a substitute for audited secure messaging, regulated data transfer, or communications that require guaranteed deletion, identity verification, or server-enforced access control.
