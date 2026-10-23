# Verification record

This document separates automated checks from environment-dependent browser behavior. Do not interpret a passing unit test as proof that every public network can establish a WebRTC connection.

## Automated checks

The latest feature implementation report (commit `e018508`) recorded **40 passing tests** using:

```bash
npm ci
npm run typecheck
npm test
```

The tests in `src/index.test.ts` cover helper functions, message validation/rate limiting, expiry calculations, document size/type validation, filename sanitization, chunk calculations, SHA-256 integrity calculations, and expiry-extension rules.

A GitHub Actions workflow now runs typechecking and the test suite on pushes and pull requests. Its run status is the repeatable CI evidence for each new revision:
https://github.com/skandachandrashekar335-wq/anomoly-chat/actions

## Previously reported browser checks

The implementation report for `e018508` recorded a headless-browser test using two independent browser contexts:

- Host and guest established a WebRTC DataChannel.
- A synthetic 64 KiB PDF payload was transferred.
- The receiver's SHA-256 digest matched the sender's digest.
- A host expiry extension was reflected in the guest countdown.
- A guest could not open the creator's extension UI.
- The live Vercel site returned HTTP 200.

These are the prior implementation report's results. The screenshots created by the local Antigravity environment were not checked into this repository, so this file does not present those local file paths as downloadable evidence.

## Release checklist

Run these checks before a release, especially after changing the browser protocol or PeerJS configuration:

- [ ] Open the deployed site on two separate devices or browser profiles.
- [ ] Create a room and join via the actual public invitation URL.
- [ ] Exchange messages in both directions.
- [ ] Transfer a real, non-sensitive test PDF smaller than 10 MiB.
- [ ] Download and open the received PDF; compare its SHA-256 digest with the sender's.
- [ ] Confirm an empty file, unsupported extension, and file larger than 10 MiB are rejected.
- [ ] Confirm creator expiry extensions update the other participant's countdown.
- [ ] Confirm a guest cannot extend the room through the intended UI.
- [ ] Test expiry, disconnect, cancellation, and cleanup behavior.
- [ ] Check browser console and network failures.
- [ ] Check 390px, 768px, 1280px, and 1440px layouts for overflow and clipped controls.
- [ ] Confirm GitHub Actions is green for the release commit.
- [ ] Confirm the Vercel production deployment is serving the same revision.

## Test limitations

- Unit tests for chunking and hashing do not, by themselves, prove the browser-to-browser transfer protocol works in all environments.
- Headless browser tests cannot represent every NAT, firewall, or mobile-network configuration.
- Without TURN, some peers will be unable to establish a direct connection.
- Browser-only expiry and creator authorization are not tamper-proof against a malicious client.
