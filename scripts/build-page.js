const fs = require("fs");
const path = require("path");

const jsController = fs.readFileSync(path.join(__dirname, "client-controller.js"), "utf8");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Anomoly Chat — Temporary Peer-to-Peer Chat & Document Sharing</title>
  <meta name="description" content="Temporary, accountless peer-to-peer chat and document sharing. No registration, no server database, browser-to-browser WebRTC encryption with absolute room expiry.">
  <meta name="theme-color" content="#EBEBE8">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%230066FF%22 stroke-width=%222.2%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><path d=%22M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z%22/><circle cx=%229%22 cy=%2210%22 r=%221.2%22 fill=%22%230066FF%22/><circle cx=%2215%22 cy=%2210%22 r=%221.2%22 fill=%22%230066FF%22/></svg>">

  <!-- Google Fonts: Inter for UI & Playfair Display for editorial emphasis -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@1,400;1,600&display=swap" rel="stylesheet">

  <!-- Client-side WebRTC and QR libraries (Static, Serverless, Zero-Database) -->
  <script src="peerjs.min.js"></script>
  <script src="qrcode.min.js"></script>

  <!-- Warm Industrial Stylesheet -->
  <link rel="stylesheet" href="style.css">
</head>
<body>

  <!-- Texture Overlay (Fractal Noise ~3.5%) -->
  <div class="noise-overlay" aria-hidden="true"></div>

  <!-- 12-Column Architectural Grid Overlay -->
  <div class="grid-overlay" aria-hidden="true">
    <div class="grid-col"></div>
    <div class="grid-col"></div>
    <div class="grid-col"></div>
    <div class="grid-col"></div>
    <div class="grid-col"></div>
    <div class="grid-col"></div>
    <div class="grid-col"></div>
    <div class="grid-col"></div>
    <div class="grid-col"></div>
    <div class="grid-col"></div>
    <div class="grid-col"></div>
    <div class="grid-col"></div>
  </div>

  <!-- ==========================================================================
       NAVIGATION BAR
       ========================================================================== -->
  <header class="navbar" id="topNavbar">
    <div class="container">
      <div class="nav-inner">
        <a href="#hero" class="nav-brand" aria-label="Anomoly Chat Home">
          <div class="brand-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              <circle cx="9" cy="10" r="1" fill="currentColor"></circle>
              <circle cx="15" cy="10" r="1" fill="currentColor"></circle>
            </svg>
          </div>
          <div class="brand-title-wrap">
            <span class="brand-text">ANOMOLY CHAT</span>
            <span class="brand-badge">P2P RAM</span>
          </div>
        </a>

        <nav aria-label="Primary Navigation">
          <ul class="nav-links">
            <li><a href="#start" class="nav-link">Rooms</a></li>
            <li><a href="#features" class="nav-link">Features</a></li>
            <li><a href="#how-it-works" class="nav-link">Architecture</a></li>
            <li><a href="#security" class="nav-link">Privacy & Security</a></li>
            <li><a href="#faq" class="nav-link">FAQ</a></li>
          </ul>
        </nav>

        <div class="nav-actions">
          <button class="btn btn-primary btn-sm neu-btn neu-btn-primary neu-btn-sm" id="navCreateBtn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Create Room
          </button>
          <button class="nav-toggle" id="navToggleBtn" aria-label="Toggle navigation" aria-expanded="false">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Mobile Navigation Drawer -->
    <div class="mobile-menu" id="mobileMenu" aria-label="Mobile Navigation">
      <ul class="mobile-nav-links">
        <li><a href="#start" class="mobile-nav-link" onclick="closeMobileMenu()">Rooms</a></li>
        <li><a href="#features" class="mobile-nav-link" onclick="closeMobileMenu()">Features</a></li>
        <li><a href="#how-it-works" class="mobile-nav-link" onclick="closeMobileMenu()">Architecture</a></li>
        <li><a href="#security" class="mobile-nav-link" onclick="closeMobileMenu()">Privacy & Security</a></li>
        <li><a href="#faq" class="mobile-nav-link" onclick="closeMobileMenu()">FAQ</a></li>
      </ul>
      <button class="btn btn-primary neu-btn neu-btn-primary" style="width: 100%;" id="mobileCreateBtn">
        Create a Room Now
      </button>
    </div>
  </header>

  <!-- ==========================================================================
       LANDING SCREEN
       ========================================================================== -->
  <main id="landingScreen">

    <!-- HERO SECTION -->
    <section class="hero-section" id="hero">
      <div class="container">
        <div class="hero-grid">
          <div class="hero-content">
            <div class="hero-eyebrow">
              <span class="status-dot-active"></span>
              <span>PEER-TO-PEER · BROWSER-NATIVE · EPHEMERAL</span>
            </div>
            <h1 class="hero-headline">
              Temporary chat that <em class="font-serif">disappears</em> when you're done.
            </h1>
            <p class="hero-copy">
              Accountless, direct browser-to-browser communication. No telephone numbers, passwords, or emails. Encrypted over WebRTC DataChannels, held purely in memory, and automatically wiped on absolute expiration.
            </p>
            <div class="hero-ctas">
              <button class="btn btn-primary neu-btn neu-btn-primary" id="heroCreateBtn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Create a Room
              </button>
              <a href="#start" class="btn btn-secondary neu-btn neu-btn-secondary" id="heroJoinBtn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                  <polyline points="10 17 15 12 10 7"></polyline>
                  <line x1="15" y1="12" x2="3" y2="12"></line>
                </svg>
                Join with Code
              </a>
            </div>
            <div class="hero-tech-readout">
              <span>● WEBRTC P2P</span>
              <span>● NO SERVER DB</span>
              <span>● 10MB SHA-256 DOCS</span>
              <span>● ABSOLUTE EXPIRY</span>
            </div>
          </div>

          <!-- Hero Product Visualization Panel -->
          <div class="hero-mockup-wrapper">
            <div class="hero-product-panel" aria-label="Interactive room preview">
              <div class="product-panel-header">
                <div class="panel-header-left">
                  <span class="panel-dot"></span>
                  <span class="product-panel-title">ROOM #X9K4P2 · DIRECT DATACHANNEL</span>
                </div>
                <span class="product-panel-timer">04:38 REMAINING</span>
              </div>
              <div class="product-panel-body">
                <div class="mockup-msg mockup-msg-in">
                  Ready to review the architecture brief?
                  <span class="mockup-msg-meta">PEER A · 14:20</span>
                </div>
                <div class="mockup-msg mockup-msg-out">
                  Sending the 2.4 MB document over WebRTC now.
                  <span class="mockup-msg-meta">YOU · 14:21</span>
                </div>
                <div class="mockup-doc-card">
                  <div class="mockup-doc-icon">PDF</div>
                  <div class="mockup-doc-info">
                    <span class="mockup-doc-name">project-architecture.pdf (2.4 MB)</span>
                    <span class="mockup-doc-sub">SHA-256 VERIFIED · IN-MEMORY BLOB</span>
                  </div>
                </div>
                <div class="mockup-msg mockup-msg-in">
                  Received bit-for-bit match. Memory wipes on timer expiry.
                  <span class="mockup-msg-meta">PEER A · 14:22</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ROOM ENTRY SECTION (#start) -->
    <section class="section" id="start">
      <div class="container">
        <div class="section-header">
          <div class="section-eyebrow">ROOM ORCHESTRATION</div>
          <h2 class="section-title">Create or Join a Room</h2>
          <p class="section-description">
            Zero friction, zero registration. Spin up an ephemeral room or join an existing session via 6-character room code.
          </p>
        </div>

        <div class="room-entry-wrapper">
          <div class="room-entry-grid">
            <!-- Create Room Card -->
            <div class="entry-card">
              <div class="entry-card-header">
                <div class="entry-icon-box">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="16"></line>
                    <line x1="8" y1="12" x2="16" y2="12"></line>
                  </svg>
                </div>
                <div>
                  <h3 class="entry-title">Create a New Room</h3>
                  <p class="entry-description">
                    Authoritative creator privileges. Configure initial duration; extend active rooms up to 4 hours.
                  </p>
                </div>
              </div>

              <div class="entry-body">
                <!-- Dynamic Room Expiry Selector -->
                <div class="expiry-selector-wrapper">
                  <div class="expiry-selector-label">
                    <span>ROOM LIFETIME DURATION</span>
                    <span style="color: var(--accent);">ABSOLUTE COUNTDOWN</span>
                  </div>
                  <div class="expiry-presets" id="expiryPresetsGroup" role="radiogroup" aria-label="Room Expiry Duration">
                    <button type="button" class="expiry-pill active" data-minutes="5" role="radio" aria-checked="true">5m</button>
                    <button type="button" class="expiry-pill" data-minutes="10" role="radio" aria-checked="false">10m</button>
                    <button type="button" class="expiry-pill" data-minutes="15" role="radio" aria-checked="false">15m</button>
                    <button type="button" class="expiry-pill" data-minutes="20" role="radio" aria-checked="false">20m</button>
                    <button type="button" class="expiry-pill" data-minutes="custom" role="radio" aria-checked="false">Custom</button>
                  </div>
                  <div class="custom-expiry-container" id="customExpiryContainer" style="display: none;">
                    <input
                      type="number"
                      id="customExpiryInput"
                      class="custom-expiry-input"
                      min="1"
                      max="60"
                      value="15"
                      placeholder="15"
                      aria-label="Custom duration in minutes"
                    />
                    <span style="font-family: var(--font-mono); font-size: 0.8125rem; color: var(--text-secondary);">minutes (1 – 60 min)</span>
                  </div>
                  <div class="selected-lifetime-indicator" id="selectedLifetimeIndicator">
                    Configured Lifetime: <strong id="lifetimeDisplayLabel">5 minutes</strong> (clock ticks forward continuously)
                  </div>
                </div>

                <div>
                  <button class="btn btn-primary neu-btn neu-btn-primary" style="width: 100%;" id="btnActionCreate">
                    <span id="createBtnText">Create Room Now</span>
                  </button>
                  <div class="input-helper-msg" id="createStatusMsg">Browser-to-browser P2P via WebRTC</div>
                </div>
              </div>
            </div>

            <!-- Join Room Card -->
            <div class="entry-card">
              <div class="entry-card-header">
                <div class="entry-icon-box" style="color: var(--success); border-color: rgba(34, 197, 94, 0.4);">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                    <polyline points="10 17 15 12 10 7"></polyline>
                    <line x1="15" y1="12" x2="3" y2="12"></line>
                  </svg>
                </div>
                <div>
                  <h3 class="entry-title">Join Existing Room</h3>
                  <p class="entry-description">
                    Enter the 6-character room code shared by your peer to initialize direct transport.
                  </p>
                </div>
              </div>

              <div class="entry-body">
                <div>
                  <label for="joinCodeInput" style="display: block; font-family: var(--font-mono); font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-secondary); margin-bottom: 0.5rem;">
                    ROOM ACCESS CODE
                  </label>
                  <input
                    type="text"
                    id="joinCodeInput"
                    class="neu-input neu-input-code"
                    placeholder="X9K4P2"
                    maxlength="6"
                    autocomplete="off"
                    spellcheck="false"
                    aria-label="6-character room code"
                  />
                </div>
                <div>
                  <button class="btn btn-secondary neu-btn neu-btn-secondary" style="width: 100%;" id="btnActionJoin">
                    Join Room
                  </button>
                  <div class="input-helper-msg" id="joinStatusMsg">Enter 6 alphanumeric characters</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- FEATURES SECTION -->
    <section class="section" id="features">
      <div class="container">
        <div class="section-header">
          <div class="section-eyebrow">CAPABILITY SPECIFICATION</div>
          <h2 class="section-title">Engineered for Ephemeral Utility</h2>
          <p class="section-description">
            A restrained, robust feature set built on open browser standards without invasive trackers or always-on telemetry.
          </p>
        </div>

        <div class="features-grid">
          <div class="feature-card">
            <div class="feature-num">01 / TRANSPORT</div>
            <h3 class="feature-title">Browser-to-Browser WebRTC</h3>
            <p class="feature-text">
              Direct peer-to-peer data channels bypass central databases. Chat messages and binary document chunks flow over encrypted DTLS sockets directly between connected browser instances.
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-num">02 / PRIVACY</div>
            <h3 class="feature-title">Zero Account Registration</h3>
            <p class="feature-text">
              No user accounts, emails, or phone numbers. Ephemeral session tokens reside exclusively in URL fragment hashes (<span class="font-mono">#key=...</span>), preventing server-side leakage in HTTP referrers.
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-num">03 / DOCUMENTS</div>
            <h3 class="feature-title">10 MiB Binary Transfers</h3>
            <p class="feature-text">
              Native document streaming for PDF, Word, Excel, PowerPoint, Text, and OpenDocument formats. Sliced into 16 KiB chunks with backpressure throttling and zero Base64 inflation.
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-num">04 / INTEGRITY</div>
            <h3 class="feature-title">Cryptographic SHA-256</h3>
            <p class="feature-text">
              Bit-for-bit file verification calculated in hardware via the Web Crypto API (<span class="font-mono">crypto.subtle</span>). Tampered or corrupted chunks are detected before enabling downloads.
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-num">05 / LIFETIME</div>
            <h3 class="feature-title">Absolute Auto-Destruction</h3>
            <p class="feature-text">
              Preset durations (5m, 10m, 15m, 20m) or custom values (1–60m). Countdown reflects absolute wall time; message activity does not prolong the session, guaranteeing timely destruction.
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-num">06 / AUTHORITY</div>
            <h3 class="feature-title">Creator Expiry Control</h3>
            <p class="feature-text">
              The room creator holds exclusive authority to extend active sessions on the fly up to a strict 4-hour ceiling. Guest interfaces synchronize time updates in real time without page reload.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- HOW IT WORKS -->
    <section class="section" id="how-it-works">
      <div class="container">
        <div class="section-header">
          <div class="section-eyebrow">PROTOCOL WALKTHROUGH</div>
          <h2 class="section-title">How It Works in 3 Steps</h2>
          <p class="section-description">
            Zero setup, zero configuration. Connect and converse in seconds.
          </p>
        </div>

        <div class="steps-grid">
          <div class="step-card">
            <div class="step-number">01</div>
            <h3 class="step-title">Generate or Enter Code</h3>
            <p class="step-desc">
              Generate a unique 6-character room code in 1 click, or paste an invitation code shared by a peer. Ambiguous glyphs (0, O, I, l) are strictly excluded.
            </p>
          </div>

          <div class="step-card">
            <div class="step-number">02</div>
            <h3 class="step-title">Share Invitation or QR</h3>
            <p class="step-desc">
              Send the full invitation URL containing the session secret, or present the live vector QR code for instantaneous smartphone camera scanning.
            </p>
          </div>

          <div class="step-card">
            <div class="step-number">03</div>
            <h3 class="step-title">Converse & Auto-Destruct</h3>
            <p class="step-desc">
              WebRTC negotiates an in-memory direct channel. When the countdown reaches 00:00, all active sockets sever, in-memory Blob URLs revoke, and RAM wipes cleanly.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- PRODUCT WALKTHROUGH -->
    <section class="section" id="walkthrough">
      <div class="container">
        <div class="section-header">
          <div class="section-eyebrow">INTERFACE GUIDE</div>
          <h2 class="section-title">Feature Navigation</h2>
          <p class="section-description">
            Essential operational details for navigating Anomoly Chat effectively.
          </p>
        </div>

        <div class="walkthrough-grid">
          <div class="walkthrough-item">
            <div class="walkthrough-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="16"></line>
                <line x1="8" y1="12" x2="16" y2="12"></line>
              </svg>
            </div>
            <div class="walkthrough-content">
              <h4>Creating a Room</h4>
              <p>Click "Create Room" to instantiate a room authority. Share the secret-bearing URL fragment to broker direct peer connectivity.</p>
            </div>
          </div>

          <div class="walkthrough-item">
            <div class="walkthrough-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </div>
            <div class="walkthrough-content">
              <h4>Joining via Code</h4>
              <p>Input the 6-character room identifier and press Enter. The client automatically validates code format before contacting signaling.</p>
            </div>
          </div>

          <div class="walkthrough-item">
            <div class="walkthrough-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            </div>
            <div class="walkthrough-content">
              <h4>Sending Messages</h4>
              <p>Press Enter to dispatch messages; Shift+Enter creates a new line. Messages are strictly capped at 500 characters and rate-limited to avoid socket flooding.</p>
            </div>
          </div>

          <div class="walkthrough-item">
            <div class="walkthrough-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="18" cy="5" r="3"></circle>
                <circle cx="6" cy="12" r="3"></circle>
                <circle cx="18" cy="19" r="3"></circle>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
              </svg>
            </div>
            <div class="walkthrough-content">
              <h4>Sharing Invitations</h4>
              <p>Click "Invite / QR" inside an active room to display the vector QR code or invoke native system share sheets via the Web Share API.</p>
            </div>
          </div>

          <div class="walkthrough-item">
            <div class="walkthrough-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </div>
            <div class="walkthrough-content">
              <h4>Leaving a Room</h4>
              <p>Click "Leave" to cleanly sever WebRTC DataChannels, revoke in-memory object URLs, and purge conversation logs from client RAM.</p>
            </div>
          </div>

          <div class="walkthrough-item">
            <div class="walkthrough-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
            <div class="walkthrough-content">
              <h4>Duration Extension</h4>
              <p>The room host can click the countdown pill to open the extension popover and add +5m, +10m, +15m, +20m, or custom duration up to 4h.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- PRIVACY & SECURITY DISCLOSURE -->
    <section class="section" id="security">
      <div class="container">
        <div class="section-header">
          <div class="section-eyebrow">HONEST DISCLOSURE</div>
          <h2 class="section-title">Privacy & Security Boundaries</h2>
          <p class="section-description">
            Transparent technical disclosure of what this browser-first architecture does and does not protect.
          </p>
        </div>

        <div class="security-card">
          <h3>Architectural Reality & Threat Model</h3>
          <p>
            Anomoly Chat provides ephemeral, accountless communication between cooperating browser nodes. "Anonymous" indicates zero personal account credentials or phone numbers are harvested. It does not mean undetectable across global network infrastructure.
          </p>
          <div class="security-grid">
            <div class="security-point">
              <span class="security-badge">IP EXPOSURE</span>
              <p>Direct WebRTC UDP connections inherently expose public IP addresses to connected peers during ICE candidate negotiation.</p>
            </div>
            <div class="security-point">
              <span class="security-badge">SIGNALING</span>
              <p>Public signaling servers (0.peerjs.com) broker initial SDP offer/answers; connection timestamps and IP metadata are observed during handshake.</p>
            </div>
            <div class="security-point">
              <span class="security-badge">FIREWALLS</span>
              <p>Direct peer connections rely on STUN hole-punching. Restrictive enterprise firewalls or symmetric CGNAT may require TURN relays.</p>
            </div>
            <div class="security-point">
              <span class="security-badge">LOCAL FILES</span>
              <p>Once a binary document is assembled and downloaded to a recipient's local disk, it cannot be remotely recalled or wiped.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- FAQ SECTION -->
    <section class="section" id="faq">
      <div class="container">
        <div class="section-header">
          <div class="section-eyebrow">FREQUENTLY ASKED QUESTIONS</div>
          <h2 class="section-title">Common Questions</h2>
          <p class="section-description">
            Direct, factual answers concerning room lifetimes, cryptography, and protocol limits.
          </p>
        </div>

        <div class="faq-list">
          <div class="faq-item">
            <button class="faq-question">
              <span>Can strangers guess my room code?</span>
              <span class="faq-icon">+</span>
            </button>
            <div class="faq-answer">
              Room codes are 6 characters generated from a 32-character unambiguous charset (32^6 = 1,073,741,824 combinations). Additionally, full URLs contain a cryptographic 128-bit session secret in the URL hash (#key=...) that is never transmitted to web servers in HTTP requests.
            </div>
          </div>

          <div class="faq-item">
            <button class="faq-question">
              <span>Does typing or sending messages reset the countdown?</span>
              <span class="faq-icon">+</span>
            </button>
            <div class="faq-answer">
              No. Anomoly Chat enforces an absolute expiration model (remainingMs = expiresAt - Date.now()). Message activity does not reset the lifespan. Only the room creator can authoritatively extend active sessions using the creator extension popover.
            </div>
          </div>

          <div class="faq-item">
            <button class="faq-question">
              <span>What document formats and file sizes are supported?</span>
              <span class="faq-icon">+</span>
            </button>
            <div class="faq-answer">
              Common document formats (.pdf, .docx, .doc, .xlsx, .xls, .pptx, .ppt, .txt, .rtf, .odt, .ods, .odp) up to strictly 10 MiB (10,485,760 bytes). Files are sliced into 16 KiB chunks, transferred via ArrayBuffer, and validated bit-for-bit against a sender-computed SHA-256 digest.
            </div>
          </div>

          <div class="faq-item">
            <button class="faq-question">
              <span>What happens if the room host closes their browser tab?</span>
              <span class="faq-icon">+</span>
            </button>
            <div class="faq-answer">
              Because the room creator acts as the authoritative coordination node, closing the host's tab severs the WebRTC connection. When the connection closes, guest nodes enter disconnected status and local in-memory state is cleared.
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- FOOTER -->
    <footer class="site-footer">
      <div class="container">
        <div class="footer-grid">
          <div class="footer-brand">
            <h4>ANOMOLY CHAT</h4>
            <p class="footer-tagline">
              Accountless peer-to-peer communication and verifiable document transfers using WebRTC DataChannels and client-side cryptography.
            </p>
          </div>

          <div class="footer-col">
            <h5>Navigation</h5>
            <ul class="footer-links-list">
              <li><a href="#start" class="footer-link">Rooms</a></li>
              <li><a href="#features" class="footer-link">Features</a></li>
              <li><a href="#how-it-works" class="footer-link">Architecture</a></li>
              <li><a href="#security" class="footer-link">Privacy & Security</a></li>
              <li><a href="#faq" class="footer-link">FAQ</a></li>
            </ul>
          </div>

          <div class="footer-col">
            <h5>Open Source</h5>
            <ul class="footer-links-list">
              <li><a href="https://github.com/skandachandrashekar335-wq/anomoly-chat" target="_blank" rel="noopener noreferrer" class="footer-link">GitHub Repository</a></li>
              <li><a href="https://github.com/skandachandrashekar335-wq/anomoly-chat/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" class="footer-link">Apache 2.0 License</a></li>
              <li><a href="https://github.com/skandachandrashekar335-wq/anomoly-chat/blob/main/SECURITY.md" target="_blank" rel="noopener noreferrer" class="footer-link">Security Policy</a></li>
              <li><a href="https://github.com/skandachandrashekar335-wq/anomoly-chat/blob/main/docs/ARCHITECTURE.md" target="_blank" rel="noopener noreferrer" class="footer-link">Architecture Docs</a></li>
            </ul>
          </div>
        </div>

        <div class="footer-bottom">
          <div>
            &copy; <span id="currentYear">2026</span> Anomoly Chat. Released for educational software development.
          </div>
          <div class="footer-legal-links">
            <span>BCA Learning Project</span>
            <span>·</span>
            <span>WebRTC P2P</span>
            <span>·</span>
            <span>Vanilla TypeScript & JS</span>
          </div>
        </div>
      </div>
    </footer>
  </main>

  <!-- ==========================================================================
       CHAT SCREEN (LIVE ROOM VIEW)
       ========================================================================== -->
  <div id="chatScreen">
    <div class="chat-container">
      <div class="chat-panel">
        <!-- Chat Header -->
        <div class="chat-panel-header">
          <div class="chat-room-info">
            <button class="btn btn-secondary btn-sm neu-btn neu-btn-secondary neu-btn-sm" id="btnLeaveRoom" title="Leave room and return home">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              Leave
            </button>
            <button class="room-badge-btn" id="btnCopyRoomCode" title="Click to copy room code">
              <span id="activeRoomCodeLabel">CODE</span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
          </div>

          <div class="chat-status-badges">
            <div class="status-pill waiting" id="pillP2PStatus" title="WebRTC Direct P2P Status">
              <span>●</span>
              <span id="labelP2PStatus">P2P INITIALIZING</span>
            </div>
            <div class="status-pill online" id="pillParticipants">
              <span>●</span>
              <span id="labelParticipants">1 ONLINE</span>
            </div>
            <div class="status-pill timer" id="pillCountdown" title="Auto-expires when inactive">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span id="labelCountdown">05:00</span>
            </div>
          </div>

          <div class="chat-header-actions">
            <button class="btn btn-primary btn-sm neu-btn neu-btn-primary neu-btn-sm" id="btnOpenShareModal">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="18" cy="5" r="3"></circle>
                <circle cx="6" cy="12" r="3"></circle>
                <circle cx="18" cy="19" r="3"></circle>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
              </svg>
              Invite / QR
            </button>
          </div>

          <!-- Creator Expiry Extension Popover (Clickable Countdown for Host) -->
          <div class="expiry-popover" id="expiryExtensionPopover" style="display: none;" role="dialog" aria-label="Extend Room Lifetime">
            <div class="expiry-popover-header">
              <h4>Extend Room Duration</h4>
              <button type="button" class="expiry-popover-close" id="btnCloseExpiryExt" aria-label="Close extension popover">&times;</button>
            </div>
            <p style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-secondary); margin-bottom: 0.75rem;">
              Host privilege: synchronize additional duration across all connected peers.
            </p>
            <div class="expiry-ext-presets" id="expiryExtPresets" role="radiogroup" aria-label="Extension presets">
              <button type="button" class="expiry-ext-pill active" data-ext="5" role="radio" aria-checked="true">+5m</button>
              <button type="button" class="expiry-ext-pill" data-ext="10" role="radio" aria-checked="false">+10m</button>
              <button type="button" class="expiry-ext-pill" data-ext="15" role="radio" aria-checked="false">+15m</button>
              <button type="button" class="expiry-ext-pill" data-ext="20" role="radio" aria-checked="false">+20m</button>
              <button type="button" class="expiry-ext-pill" data-ext="custom" role="radio" aria-checked="false">Custom</button>
            </div>
            <div class="custom-ext-input-wrap" id="customExtInputWrap" style="display: none; margin-bottom: 0.75rem;">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <input
                  type="number"
                  id="customExtInput"
                  class="custom-expiry-input"
                  min="1"
                  max="60"
                  value="15"
                  placeholder="15"
                  aria-label="Custom extension in minutes"
                  style="width: 72px; padding: 0.4rem;"
                />
                <span style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-secondary);">minutes (1 – 60m)</span>
              </div>
            </div>
            <div class="expiry-ext-preview" id="expiryExtPreview" style="font-family: var(--font-mono); font-size: 0.75rem; margin-bottom: 0.75rem;">
              Extension: <strong id="extAmountDisplay" style="color: var(--accent);">+5 minutes</strong><br />
              <span id="extNewTimeDisplay" style="color: var(--text-muted);">New expiry: calculating...</span>
            </div>
            <button type="button" class="btn btn-primary btn-sm neu-btn neu-btn-primary neu-btn-sm" style="width: 100%;" id="btnConfirmExtend">
              Apply Extension
            </button>
          </div>
        </div>

        <!-- Chat Status Banner -->
        <div class="chat-status-banner" id="chatStatusBanner" style="display: none;">
          <span id="chatStatusBannerText">Status notification</span>
          <button type="button" class="btn-dismiss-banner" id="btnDismissBanner" aria-label="Dismiss banner">&times;</button>
        </div>

        <!-- Messages Area -->
        <div class="chat-messages" id="chatMessagesArea">
          <div class="chat-empty-state" id="chatEmptyState">
            <div class="chat-empty-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            </div>
            <h3>Room Initialized</h3>
            <p>
              Direct WebRTC data channel ready. Share your room code or invitation link to begin conversing.
            </p>
          </div>
        </div>

        <!-- Composer -->
        <div class="chat-composer-box">
          <!-- Pending Document Attachment Preview Bar -->
          <div class="attachment-preview-bar" id="attachmentPreviewBar" style="display: none;">
            <div class="attachment-preview-info">
              <span class="attachment-type-badge" id="attachmentTypeBadge">PDF</span>
              <div class="attachment-details">
                <span class="attachment-file-name" id="attachmentFileName" style="font-weight: 600; font-size: 0.8125rem;">document.pdf</span>
                <span class="attachment-file-size" id="attachmentFileSize" style="font-family: var(--font-mono); font-size: 0.6875rem; color: var(--text-muted); margin-left: 0.5rem;">1.2 MB</span>
              </div>
            </div>
            <button type="button" class="attachment-cancel-btn" id="btnCancelAttachment" title="Remove attachment" aria-label="Remove attachment">&times;</button>
          </div>

          <form class="composer-form" id="composerForm" onsubmit="return false;">
            <button type="button" class="composer-attach-btn" id="btnAttachDocument" title="Attach document (PDF, Word, Excel, PowerPoint, Text, OpenDocument up to 10MB)" aria-label="Attach document">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
              </svg>
            </button>
            <input
              type="file"
              id="fileAttachmentInput"
              style="display:none;"
              accept=".pdf,.doc,.docx,.txt,.rtf,.ppt,.pptx,.xls,.xlsx,.odt,.ods,.odp"
            />

            <div class="composer-input-container">
              <input
                type="text"
                id="messageTextInput"
                class="composer-input"
                placeholder="Type a message (Enter to send, Shift+Enter for newline)..."
                maxlength="500"
                autocomplete="off"
              />
              <div class="char-limit-indicator" id="charLimitIndicator">0/500</div>
            </div>
            <button type="submit" class="btn btn-primary neu-btn neu-btn-primary" id="btnSendMessage" aria-label="Send message" style="padding: 0 1.25rem;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  </div>

  <!-- ==========================================================================
       INVITATION & QR CODE MODAL
       ========================================================================== -->
  <div class="modal-overlay" id="inviteModal">
    <div class="modal-card">
      <button class="modal-close-btn" id="btnCloseInviteModal" aria-label="Close modal">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      <h3 style="font-size: 1.25rem; font-weight: 700;">Invite Peer to Room</h3>
      <p style="color: var(--text-secondary); font-size: 0.875rem; margin-top: 0.35rem;">
        Scan this vector QR code on any mobile device or copy the direct invitation link.
      </p>

      <div class="qr-frame">
        <img id="modalQrImg" src="" alt="Room QR Code" />
      </div>

      <div class="share-link-box">
        <span class="share-url-text" id="shareUrlText">http://...</span>
      </div>

      <div style="display: flex; gap: 0.75rem; justify-content: center;">
        <button class="btn btn-primary btn-sm neu-btn neu-btn-primary neu-btn-sm" id="btnModalCopyLink">
          Copy Link
        </button>
        <button class="btn btn-secondary btn-sm neu-btn neu-btn-secondary neu-btn-sm" id="btnModalNativeShare">
          Share...
        </button>
      </div>
    </div>
  </div>

  <!-- Toast Notification -->
  <div class="toast" id="appToast">Notification message</div>

  <!-- ==========================================================================
       VANILLA JAVASCRIPT APPLICATION CONTROLLER — BROWSER-FIRST WEBRTC P2P
       ========================================================================== -->
  <script>
` + jsController + `
  </script>
</body>
</html>
`;

fs.writeFileSync("index.html", html, "utf8");
fs.writeFileSync("public/index.html", html, "utf8");
console.log("Successfully assembled index.html and public/index.html (" + html.length + " bytes)");
