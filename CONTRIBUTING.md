# Contributing to Anomoly Chat

Thank you for your interest in contributing to **Anomoly Chat**! We welcome contributions from developers of all experience levels.

Anomoly Chat is an open-source, temporary, accountless peer-to-peer chat and document sharing application built with **WebRTC**, **Vanilla HTML/CSS/JS**, and **TypeScript**.

---

## Code of Conduct & Core Principles

Before contributing, please review our core architectural and privacy principles:

1. **Accountless & Ephemeral by Design**: No user registration, passwords, phone numbers, or email addresses.
2. **Zero Server Message Persistence**: We do not run persistent database services. All chat messages and document chunks travel peer-to-peer via WebRTC `RTCDataChannel`.
3. **Honest Privacy & Security**: We never claim "military-grade untraceability" or "bulletproof security". WebRTC peer connections inherently expose public IP addresses between peers, signaling metadata is visible to brokers, and client-side logic can be bypassed by malicious actors. We state these limitations transparently in [`SECURITY.md`](SECURITY.md).
4. **Vanilla Frontend**: The frontend is intentionally built with vanilla HTML5, CSS3 (Neumorphism / Soft UI), and vanilla JavaScript. Avoid adding heavyweight frontend frameworks (React, Vue, Angular) unless agreed in a prior architectural RFC.

---

## Local Development Setup

### 1. Prerequisites
- **Node.js**: Version `22.x` or newer (LTS recommended)
- **npm**: Version `10.x` or newer
- **Git**

### 2. Clone & Install
```bash
git clone https://github.com/skandachandrashekar335-wq/anomoly-chat.git
cd anomoly-chat
npm ci
```

### 3. Run Quality Checks
Always ensure your changes pass the typechecker and automated test suite:
```bash
# 1. TypeScript typecheck
npm run typecheck

# 2. Automated unit & protocol test suite (40 tests)
npm test

# 3. Browser E2E smoke tests & screenshot verification
npx playwright install --with-deps chromium
npm run test:smoke
```

### 4. Running the Application Locally
You can run the application with the included local Node/Express development server:
```bash
npm start
```
Then visit `http://localhost:3000` in your web browser.

Alternatively, because the frontend is purely static, you can serve it with any local static HTTP server:
```bash
npx serve public
```

---

## Architectural Guidelines

- **HTML & Static Assets**: The root `index.html` and `public/index.html` must remain synchronized. When editing markup or client-side logic, update both or copy `index.html` to `public/index.html`.
- **Neumorphism Design System**: Follow the soft-UI design tokens defined in CSS (`--bg: #E0E5EC`, `--neu-flat`, `--neu-pressed`, `--neu-btn`). Maintain responsive layouts across desktop (1440px), tablet (768px), and mobile (390px).
- **DOM Safety (XSS Protection)**: Never use `innerHTML` for rendering incoming peer messages or untrusted metadata. Always use `.textContent` or `document.createTextNode()`.
- **Binary Chunking Protocol**: Document transfers use 16 KiB (`16,384 bytes`) binary chunks via `ArrayBuffer` with backpressure checks (`dataChannel.bufferedAmount`) and SHA-256 verification (`crypto.subtle.digest`). Do not use Base64 strings for binary data.
- **Memory Safety**: Any transient Object URLs (`URL.createObjectURL(blob)`) must be tracked and revoked (`URL.revokeObjectURL(url)`) when leaving a room or when a room expires.

---

## Pull Request Guidelines

1. **Fork & Branch**: Create a feature branch with a descriptive name:
   ```bash
   git checkout -b feat/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```
2. **Commit Messages**: Follow standard Conventional Commits:
   - `feat: add custom TURN configuration option`
   - `fix: resolve mobile keyboard viewport clipping`
   - `docs: clarify signaling metadata exposure`
   - `test: add unit test for corrupted chunk recovery`
3. **Keep PRs Focused**: Avoid bundling unrelated changes or massive formatting rewrites into a single PR.
4. **No Secrets or Credentials**: Never commit private keys, environment tokens, local credentials, or sensitive test files.
5. **Continuous Integration**: Ensure that all GitHub Actions workflow checks pass on your branch.

---

## Submitting Issues

- **Bug Reports**: Use our [Bug Report Template](.github/ISSUE_TEMPLATE/bug_report.md) with reproduction steps, browser versions, and synthetic payloads.
- **Feature Requests**: Use our [Feature Request Template](.github/ISSUE_TEMPLATE/feature_request.md) with clear user value and architectural rationale.
- **Security Disclosures**: Please follow our [Responsible Vulnerability Disclosure Policy](SECURITY.md). Do not submit security vulnerabilities to public GitHub issues.
