
    (function () {
      "use strict";

      // ----- Application State -----------------------------------------------
      var peer = null;
      var isHost = false;
      var activeRoomCode = null;
      var sessionKey = null;
      var roomCreatedAt = 0;
      var roomExpiresAt = 0;
      var selectedDurationMinutes = 5;   // 5 min default
      var hostConnection = null;         // For guest: connection to host
      var activeConnections = [];        // For host: list of active guest DataConnections
      var countdownInterval = null;
      var connectTimeoutTimer = null;
      var messageTimestamps = [];        // Rate limiting: max 5 messages per 2s

      var SAFE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      var PEER_CONFIG = {
        debug: 1,
        config: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" }
          ]
        }
      };

      // ----- DOM Element Selectors -------------------------------------------
      var landingScreen = document.getElementById("landingScreen");
      var chatScreen = document.getElementById("chatScreen");
      var topNavbar = document.getElementById("topNavbar");

      var navCreateBtn = document.getElementById("navCreateBtn");
      var mobileCreateBtn = document.getElementById("mobileCreateBtn");
      var heroCreateBtn = document.getElementById("heroCreateBtn");
      var btnActionCreate = document.getElementById("btnActionCreate");
      var createBtnText = document.getElementById("createBtnText");
      var createStatusMsg = document.getElementById("createStatusMsg");

      var expiryPresetsGroup = document.getElementById("expiryPresetsGroup");
      var customExpiryContainer = document.getElementById("customExpiryContainer");
      var customExpiryInput = document.getElementById("customExpiryInput");
      var lifetimeDisplayLabel = document.getElementById("lifetimeDisplayLabel");

      var btnActionJoin = document.getElementById("btnActionJoin");
      var joinCodeInput = document.getElementById("joinCodeInput");
      var joinStatusMsg = document.getElementById("joinStatusMsg");

      var navToggleBtn = document.getElementById("navToggleBtn");
      var mobileMenu = document.getElementById("mobileMenu");

      var btnLeaveRoom = document.getElementById("btnLeaveRoom");
      var activeRoomCodeLabel = document.getElementById("activeRoomCodeLabel");
      var btnCopyRoomCode = document.getElementById("btnCopyRoomCode");
      var pillP2PStatus = document.getElementById("pillP2PStatus");
      var labelP2PStatus = document.getElementById("labelP2PStatus");
      var pillParticipants = document.getElementById("pillParticipants");
      var labelParticipants = document.getElementById("labelParticipants");
      var pillCountdown = document.getElementById("pillCountdown");
      var labelCountdown = document.getElementById("labelCountdown");
      var btnOpenShareModal = document.getElementById("btnOpenShareModal");

      var chatStatusBanner = document.getElementById("chatStatusBanner");
      var chatStatusBannerText = document.getElementById("chatStatusBannerText");
      var btnDismissBanner = document.getElementById("btnDismissBanner");

      var chatMessagesArea = document.getElementById("chatMessagesArea");
      var chatEmptyState = document.getElementById("chatEmptyState");
      var composerForm = document.getElementById("composerForm");
      var messageTextInput = document.getElementById("messageTextInput");
      var btnSendMessage = document.getElementById("btnSendMessage");
      var charLimitIndicator = document.getElementById("charLimitIndicator");

      var inviteModal = document.getElementById("inviteModal");
      var btnCloseInviteModal = document.getElementById("btnCloseInviteModal");
      var modalQrImg = document.getElementById("modalQrImg");
      var shareUrlText = document.getElementById("shareUrlText");
      var btnModalCopyLink = document.getElementById("btnModalCopyLink");
      var btnModalNativeShare = document.getElementById("btnModalNativeShare");
      var appToast = document.getElementById("appToast");

      // ----- Document Attachment Selectors -----------------------------------
      var btnAttachDocument = document.getElementById("btnAttachDocument");
      var fileAttachmentInput = document.getElementById("fileAttachmentInput");
      var attachmentPreviewBar = document.getElementById("attachmentPreviewBar");
      var attachmentTypeBadge = document.getElementById("attachmentTypeBadge");
      var attachmentFileName = document.getElementById("attachmentFileName");
      var attachmentFileSize = document.getElementById("attachmentFileSize");
      var btnCancelAttachment = document.getElementById("btnCancelAttachment");

      // ----- Creator Expiry Extension Selectors ------------------------------
      var expiryExtensionPopover = document.getElementById("expiryExtensionPopover");
      var btnCloseExpiryExt = document.getElementById("btnCloseExpiryExt");
      var expiryExtPresets = document.getElementById("expiryExtPresets");
      var customExtInputWrap = document.getElementById("customExtInputWrap");
      var customExtInput = document.getElementById("customExtInput");
      var extAmountDisplay = document.getElementById("extAmountDisplay");
      var extNewTimeDisplay = document.getElementById("extNewTimeDisplay");
      var btnConfirmExtend = document.getElementById("btnConfirmExtend");

      // ----- Document Transfer & Expiry Constants / State -------------------
      var MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MiB strictly enforced
      var CHUNK_SIZE = 16384;               // 16 KiB chunks
      var MAX_TOTAL_ROOM_LIFETIME_MS = 4 * 60 * 60 * 1000; // 4 hours maximum lifetime ceiling

      var ALLOWED_FILE_TYPES = {
        ".pdf": { label: "PDF", mime: "application/pdf" },
        ".doc": { label: "DOC", mime: "application/msword" },
        ".docx": { label: "DOCX", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
        ".txt": { label: "TXT", mime: "text/plain" },
        ".rtf": { label: "RTF", mime: "application/rtf" },
        ".ppt": { label: "PPT", mime: "application/vnd.ms-powerpoint" },
        ".pptx": { label: "PPTX", mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
        ".xls": { label: "XLS", mime: "application/vnd.ms-excel" },
        ".xlsx": { label: "XLSX", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
        ".odt": { label: "ODT", mime: "application/vnd.oasis.opendocument.text" },
        ".ods": { label: "ODS", mime: "application/vnd.oasis.opendocument.spreadsheet" },
        ".odp": { label: "ODP", mime: "application/vnd.oasis.opendocument.presentation" }
      };

      var pendingAttachment = null;
      var activeBlobUrls = new Set();
      var activeTransfers = new Map();
      var selectedExtensionMinutes = 5;

      document.getElementById("currentYear").textContent = new Date().getFullYear();

      // ----- Notification & Status Helpers -----------------------------------

      function showToast(message) {
        appToast.textContent = message;
        appToast.classList.add("show");
        setTimeout(function () {
          appToast.classList.remove("show");
        }, 2500);
      }

      function showBanner(text, type) {
        if (!chatStatusBanner) return;
        chatStatusBanner.className = "chat-status-banner " + (type || "");
        chatStatusBannerText.textContent = text;
        chatStatusBanner.style.display = "flex";
      }

      function hideBanner() {
        if (!chatStatusBanner) return;
        chatStatusBanner.style.display = "none";
      }

      if (btnDismissBanner) {
        btnDismissBanner.addEventListener("click", hideBanner);
      }

      function updateP2PStatus(stateClass, text) {
        if (!pillP2PStatus || !labelP2PStatus) return;
        pillP2PStatus.className = "status-pill " + stateClass;
        labelP2PStatus.textContent = text;
      }

      function updateParticipantCount(count) {
        if (!labelParticipants) return;
        labelParticipants.textContent = count + (count === 1 ? " Online" : " Online");
      }

      // ----- Cryptographic & Room Code Generators -----------------------------

      function generateRoomCode() {
        var code = "";
        var randValues = new Uint32Array(6);
        (window.crypto || window.msCrypto).getRandomValues(randValues);
        for (var i = 0; i < 6; i++) {
          code += SAFE_CHARS[randValues[i] % SAFE_CHARS.length];
        }
        return code;
      }

      function generateSessionKey() {
        var bytes = new Uint8Array(8);
        (window.crypto || window.msCrypto).getRandomValues(bytes);
        return Array.from(bytes, function (b) {
          return ("0" + b.toString(16)).slice(-2);
        }).join("");
      }

      function getShareUrl(code, key, expiresAt) {
        var origin = window.location.origin;
        var path = window.location.pathname;
        var url = origin + path + "?room=" + encodeURIComponent(code);
        var hashParts = [];
        if (key) hashParts.push("key=" + encodeURIComponent(key));
        if (expiresAt) hashParts.push("exp=" + encodeURIComponent(expiresAt));
        if (hashParts.length > 0) {
          url += "#" + hashParts.join("&");
        }
        return url;
      }

      // ----- Document Sanitization & Cryptographic Integrity Helpers ----------

      function sanitizeFilename(filename) {
        if (!filename || typeof filename !== "string") return "document";
        // Strip directory traversal characters
        var clean = filename.replace(/^.*[\\\/]/, "");
        // Strip non-printable / control characters
        clean = clean.replace(/[\x00-\x1F\x7F]/g, "");
        // Replace hazardous filesystem and injection chars with underscore
        clean = clean.replace(/[<>:"/\\|?*#;`$]/g, "_");
        // Trim leading/trailing dots and spaces
        clean = clean.trim().replace(/^\.+/, "").replace(/\.+$/, "");
        if (!clean) clean = "document";
        // Cap length at 100 characters while preserving extension
        if (clean.length > 100) {
          var extIdx = clean.lastIndexOf(".");
          if (extIdx > 0 && extIdx > clean.length - 15) {
            clean = clean.slice(0, 85) + clean.slice(extIdx);
          } else {
            clean = clean.slice(0, 100);
          }
        }
        return clean;
      }

      function getFileExtension(filename) {
        if (!filename) return "";
        var idx = filename.lastIndexOf(".");
        return idx !== -1 ? filename.slice(idx).toLowerCase() : "";
      }

      function formatBytes(bytes) {
        if (bytes === 0) return "0 Bytes";
        var k = 1024;
        var sizes = ["Bytes", "KB", "MB", "GB"];
        var i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
      }

      function toUint8Array(chunk) {
        if (chunk instanceof Uint8Array) return chunk;
        if (chunk instanceof ArrayBuffer) return new Uint8Array(chunk);
        if (chunk && chunk.buffer instanceof ArrayBuffer) {
          return new Uint8Array(chunk.buffer, chunk.byteOffset || 0, chunk.byteLength);
        }
        return new Uint8Array(chunk);
      }

      async function calculateSHA256(arrayBuffer) {
        if (window.crypto && window.crypto.subtle && window.crypto.subtle.digest) {
          try {
            var hashBuffer = await window.crypto.subtle.digest("SHA-256", arrayBuffer);
            var hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
          } catch (e) {
            console.warn("Subtle crypto error:", e);
          }
        }
        return "sha256-unsupported";
      }

      // ----- Document Chat Rendering & Transfer Engine -------------------------

      function renderDocMessage(transfer, isSelf) {
        chatEmptyState.style.display = "none";

        var bubble = document.createElement("div");
        bubble.className = "chat-bubble doc-bubble " + (isSelf ? "sent" : "received");
        bubble.id = "docBubble_" + transfer.transferId;

        var date = new Date(transfer.timestamp || Date.now());
        var timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        var metaText = isSelf ? "You · " + timeStr : "Anonymous · " + timeStr;

        var cardHeader = document.createElement("div");
        cardHeader.className = "doc-card-header";

        var iconBadge = document.createElement("div");
        iconBadge.className = "doc-icon-badge";
        var extLabel = (transfer.ext || "").replace(/^\./, "").toUpperCase() || "DOC";
        iconBadge.textContent = extLabel.slice(0, 4);

        var docInfo = document.createElement("div");
        docInfo.className = "doc-info";

        var docName = document.createElement("span");
        docName.className = "doc-name";
        docName.textContent = transfer.name;
        docName.title = transfer.name;

        var docSize = document.createElement("span");
        docSize.className = "doc-size";
        docSize.textContent = formatBytes(transfer.size);

        docInfo.appendChild(docName);
        docInfo.appendChild(docSize);
        cardHeader.appendChild(iconBadge);
        cardHeader.appendChild(docInfo);

        var progressContainer = document.createElement("div");
        progressContainer.className = "doc-progress-container";
        progressContainer.id = "docProgress_" + transfer.transferId;

        var progressBg = document.createElement("div");
        progressBg.className = "doc-progress-bar-bg";
        var progressFill = document.createElement("div");
        progressFill.className = "doc-progress-bar-fill";
        progressFill.style.width = (transfer.progress || 0) + "%";
        progressBg.appendChild(progressFill);

        var statusText = document.createElement("div");
        statusText.className = "doc-status-text";
        var statusSpan = document.createElement("span");
        statusSpan.className = "doc-status-label";
        statusSpan.textContent = transfer.status || (isSelf ? "Preparing..." : "Receiving...");

        var cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.className = "doc-cancel-link";
        cancelBtn.textContent = "Cancel";
        cancelBtn.addEventListener("click", function () {
          cancelTransfer(transfer.transferId, true);
        });

        statusText.appendChild(statusSpan);
        statusText.appendChild(cancelBtn);

        progressContainer.appendChild(progressBg);
        progressContainer.appendChild(statusText);

        var actionsDiv = document.createElement("div");
        actionsDiv.className = "doc-actions";
        actionsDiv.id = "docActions_" + transfer.transferId;
        actionsDiv.style.display = "none";

        var downloadBtn = document.createElement("a");
        downloadBtn.className = "neu-btn neu-btn-primary neu-btn-sm doc-download-btn";
        downloadBtn.id = "docDownloadBtn_" + transfer.transferId;
        downloadBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Download';

        var verifyBadge = document.createElement("span");
        verifyBadge.className = "doc-verify-badge";
        verifyBadge.id = "docVerify_" + transfer.transferId;

        actionsDiv.appendChild(downloadBtn);
        actionsDiv.appendChild(verifyBadge);

        var metaDiv = document.createElement("div");
        metaDiv.className = "bubble-meta";
        metaDiv.textContent = metaText;

        bubble.appendChild(cardHeader);
        bubble.appendChild(progressContainer);
        bubble.appendChild(actionsDiv);
        bubble.appendChild(metaDiv);

        chatMessagesArea.appendChild(bubble);
        chatMessagesArea.scrollTop = chatMessagesArea.scrollHeight;

        return {
          bubble: bubble,
          progressFill: progressFill,
          statusLabel: statusSpan,
          cancelBtn: cancelBtn,
          progressContainer: progressContainer,
          actionsDiv: actionsDiv,
          downloadBtn: downloadBtn,
          verifyBadge: verifyBadge
        };
      }

      function updateDocProgress(transferId, percent, statusLabel) {
        var t = activeTransfers.get(transferId);
        if (!t || !t.elements) return;
        t.elements.progressFill.style.width = percent + "%";
        if (statusLabel) {
          t.elements.statusLabel.textContent = statusLabel;
        }
      }

      function completeDocTransfer(transferId, blobUrl, sha256) {
        var t = activeTransfers.get(transferId);
        if (!t || !t.elements) return;

        t.elements.progressFill.style.width = "100%";
        t.elements.cancelBtn.style.display = "none";
        t.elements.progressContainer.style.display = "none";
        t.elements.actionsDiv.style.display = "flex";

        t.elements.downloadBtn.href = blobUrl;
        t.elements.downloadBtn.download = t.name;

        var shortHash = sha256 ? sha256.slice(0, 8) : "";
        t.elements.verifyBadge.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> SHA-256: ' + shortHash + '...';
        t.elements.verifyBadge.title = "Integrity verified (SHA-256: " + sha256 + ")";

        chatMessagesArea.scrollTop = chatMessagesArea.scrollHeight;
      }

      function failDocTransfer(transferId, reason) {
        var t = activeTransfers.get(transferId);
        if (!t || !t.elements) return;

        t.elements.cancelBtn.style.display = "none";
        t.elements.statusLabel.textContent = reason || "Transfer failed";
        t.elements.statusLabel.style.color = "var(--error)";
        t.elements.progressFill.style.background = "var(--error)";
      }

      function cancelTransfer(transferId, notifyPeer) {
        var t = activeTransfers.get(transferId);
        if (!t) return;
        t.cancelled = true;

        if (t.elements) {
          t.elements.cancelBtn.style.display = "none";
          t.elements.statusLabel.textContent = "Cancelled";
        }

        t.chunks = null;

        if (notifyPeer) {
          var cancelMsg = { type: "file_cancel", transferId: transferId };
          if (isHost) {
            broadcastToGuests(cancelMsg);
          } else if (hostConnection && hostConnection.open) {
            try { hostConnection.send(cancelMsg); } catch (e) {}
          }
        }
      }

      async function sendFileInChunks(transfer) {
        var buffer = transfer.buffer;
        var totalChunks = transfer.totalChunks;
        var transferId = transfer.transferId;

        for (var i = 0; i < totalChunks; i++) {
          if (transfer.cancelled) {
            console.log("[Transfer] Cancelled by user during send:", transferId);
            return;
          }
          if (Date.now() >= roomExpiresAt) {
            failDocTransfer(transferId, "Room expired during transfer");
            return;
          }

          var start = i * CHUNK_SIZE;
          var end = Math.min(start + CHUNK_SIZE, buffer.byteLength);
          var chunk = buffer.slice(start, end);

          var msg = {
            type: "file_chunk",
            transferId: transferId,
            index: i,
            chunk: chunk
          };

          if (isHost) {
            for (var k = 0; k < activeConnections.length; k++) {
              var c = activeConnections[k];
              if (c && c.open && c.dataChannel) {
                while (c.dataChannel.bufferedAmount > 64 * 1024) {
                  await new Promise(function (r) { setTimeout(r, 10); });
                }
              }
            }
            broadcastToGuests(msg);
          } else if (hostConnection && hostConnection.open) {
            if (hostConnection.dataChannel) {
              while (hostConnection.dataChannel.bufferedAmount > 64 * 1024) {
                await new Promise(function (r) { setTimeout(r, 10); });
              }
            }
            hostConnection.send(msg);
          } else {
            failDocTransfer(transferId, "Peer disconnected during transfer");
            return;
          }

          var pct = Math.round(((i + 1) / totalChunks) * 100);
          updateDocProgress(transferId, pct, "Sending " + pct + "%");

          if (i % 8 === 0) {
            await new Promise(function (r) { setTimeout(r, 0); });
          }
        }

        var blob = new Blob([buffer], { type: transfer.mime });
        var blobUrl = URL.createObjectURL(blob);
        activeBlobUrls.add(blobUrl);
        completeDocTransfer(transferId, blobUrl, transfer.sha256);
      }

      function initiateFileTransfer(att) {
        var transferId = "xfer-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
        var totalChunks = Math.ceil(att.size / CHUNK_SIZE);

        var txTransfer = {
          transferId: transferId,
          name: att.name,
          size: att.size,
          ext: att.ext,
          mime: att.typeInfo.mime,
          totalChunks: totalChunks,
          timestamp: Date.now(),
          cancelled: false
        };

        txTransfer.elements = renderDocMessage(txTransfer, true);
        activeTransfers.set(transferId, txTransfer);

        var reader = new FileReader();
        reader.onload = async function (e) {
          var buffer = e.target.result;
          txTransfer.buffer = buffer;

          updateDocProgress(transferId, 0, "Computing SHA-256...");
          var sha256 = await calculateSHA256(buffer);
          txTransfer.sha256 = sha256;

          if (txTransfer.cancelled) return;

          var startMsg = {
            type: "file_start",
            transferId: transferId,
            name: att.name,
            size: att.size,
            ext: att.ext,
            mime: att.typeInfo.mime,
            totalChunks: totalChunks,
            sha256: sha256,
            timestamp: txTransfer.timestamp
          };

          if (isHost) {
            broadcastToGuests(startMsg);
          } else if (hostConnection && hostConnection.open) {
            hostConnection.send(startMsg);
          } else {
            failDocTransfer(transferId, "No active connection to send file.");
            return;
          }

          await sendFileInChunks(txTransfer);
        };

        reader.onerror = function () {
          failDocTransfer(transferId, "Failed to read local file.");
        };

        reader.readAsArrayBuffer(att.file);
      }

      // ----- Creator Room Expiry Extension Controller -------------------------

      function setupCreatorExpiryExtension() {
        if (!pillCountdown) return;

        pillCountdown.addEventListener("click", function (e) {
          e.stopPropagation();
          if (!isHost) return;
          if (Date.now() >= roomExpiresAt) {
            showToast("Room has already expired.");
            return;
          }
          var isOpen = expiryExtensionPopover.style.display === "block";
          expiryExtensionPopover.style.display = isOpen ? "none" : "block";
          if (!isOpen) {
            updateExtensionPreview();
          }
        });

        if (expiryExtensionPopover) {
          expiryExtensionPopover.addEventListener("click", function (e) {
            e.stopPropagation();
          });
        }

        if (btnCloseExpiryExt) {
          btnCloseExpiryExt.addEventListener("click", function () {
            expiryExtensionPopover.style.display = "none";
          });
        }

        document.addEventListener("click", function (e) {
          if (expiryExtensionPopover && expiryExtensionPopover.style.display === "block" &&
              !expiryExtensionPopover.contains(e.target) &&
              !pillCountdown.contains(e.target)) {
            expiryExtensionPopover.style.display = "none";
          }
        });

        if (expiryExtPresets) {
          var extPills = expiryExtPresets.querySelectorAll(".expiry-ext-pill");
          extPills.forEach(function (pill) {
            pill.addEventListener("click", function () {
              extPills.forEach(function (p) {
                p.classList.remove("active");
                p.setAttribute("aria-checked", "false");
              });
              pill.classList.add("active");
              pill.setAttribute("aria-checked", "true");

              var mode = pill.dataset.ext;
              if (mode === "custom") {
                customExtInputWrap.style.display = "block";
                var val = parseInt(customExtInput.value, 10);
                if (isNaN(val) || val < 1) val = 15;
                if (val > 60) val = 60;
                selectedExtensionMinutes = val;
                customExtInput.value = val;
                customExtInput.focus();
              } else {
                customExtInputWrap.style.display = "none";
                selectedExtensionMinutes = parseInt(mode, 10) || 5;
              }
              updateExtensionPreview();
            });
          });
        }

        if (customExtInput) {
          customExtInput.addEventListener("input", function () {
            var val = parseInt(customExtInput.value, 10);
            if (!isNaN(val)) {
              if (val > 60) val = 60;
              if (val < 1) val = 1;
              selectedExtensionMinutes = val;
            } else {
              selectedExtensionMinutes = 15;
            }
            updateExtensionPreview();
          });
        }

        if (btnConfirmExtend) {
          btnConfirmExtend.addEventListener("click", function () {
            applyCreatorExtension();
          });
        }
      }

      function updateExtensionPreview() {
        if (!extAmountDisplay || !extNewTimeDisplay) return;
        extAmountDisplay.textContent = "+" + selectedExtensionMinutes + " minutes";

        var currentBase = Math.max(Date.now(), roomExpiresAt);
        var target = currentBase + (selectedExtensionMinutes * 60 * 1000);

        var maxLifetimeEnd = roomCreatedAt + MAX_TOTAL_ROOM_LIFETIME_MS;
        if (target > maxLifetimeEnd) {
          target = maxLifetimeEnd;
          var cappedMin = Math.max(0, Math.floor((maxLifetimeEnd - roomExpiresAt) / 60000));
          extAmountDisplay.textContent = "+" + cappedMin + " minutes (capped at 4h max)";
        }

        var d = new Date(target);
        var timeStr = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        extNewTimeDisplay.textContent = "New expiry: " + timeStr;
      }

      function applyCreatorExtension() {
        if (!isHost) return;
        if (Date.now() >= roomExpiresAt) {
          showToast("Cannot extend an expired room.");
          expiryExtensionPopover.style.display = "none";
          return;
        }

        var target = roomExpiresAt + (selectedExtensionMinutes * 60 * 1000);
        var maxLifetimeEnd = roomCreatedAt + MAX_TOTAL_ROOM_LIFETIME_MS;
        if (target > maxLifetimeEnd) {
          target = maxLifetimeEnd;
        }

        var effectiveMinutes = Math.round((target - roomExpiresAt) / 60000);
        if (effectiveMinutes <= 0) {
          showToast("Maximum total room lifetime (4 hours) reached.");
          expiryExtensionPopover.style.display = "none";
          return;
        }

        roomExpiresAt = target;
        startAbsoluteCountdown(roomExpiresAt);
        updateInviteModalData(activeRoomCode, sessionKey, roomExpiresAt);
        window.history.replaceState(null, "", getShareUrl(activeRoomCode, sessionKey, roomExpiresAt));

        broadcastToGuests({
          type: "expiry_extension",
          newExpiresAt: roomExpiresAt,
          extendedByMinutes: effectiveMinutes
        });

        expiryExtensionPopover.style.display = "none";
        showToast("Room lifetime extended by +" + effectiveMinutes + "m!");
      }

      // ----- Dynamic Expiry Selector Management ------------------------------

      function setupExpirySelector() {
        if (!expiryPresetsGroup) return;

        var presetButtons = expiryPresetsGroup.querySelectorAll(".expiry-pill");
        presetButtons.forEach(function (btn) {
          btn.addEventListener("click", function () {
            presetButtons.forEach(function (b) {
              b.classList.remove("active");
              b.setAttribute("aria-checked", "false");
            });
            btn.classList.add("active");
            btn.setAttribute("aria-checked", "true");

            var mode = btn.dataset.minutes;
            if (mode === "custom") {
              customExpiryContainer.style.display = "flex";
              var val = parseInt(customExpiryInput.value, 10);
              if (isNaN(val) || val < 1) val = 15;
              if (val > 60) val = 60;
              selectedDurationMinutes = val;
              customExpiryInput.value = val;
              customExpiryInput.focus();
            } else {
              customExpiryContainer.style.display = "none";
              selectedDurationMinutes = parseInt(mode, 10) || 5;
            }
            updateLifetimeDisplay();
          });
        });

        if (customExpiryInput) {
          customExpiryInput.addEventListener("input", function () {
            var val = parseInt(customExpiryInput.value, 10);
            if (!isNaN(val)) {
              if (val > 60) val = 60;
              if (val < 1) val = 1;
              selectedDurationMinutes = val;
            } else {
              selectedDurationMinutes = 15;
            }
            updateLifetimeDisplay();
          });
        }
      }

      function updateLifetimeDisplay() {
        if (!lifetimeDisplayLabel) return;
        lifetimeDisplayLabel.textContent = selectedDurationMinutes + " minutes";
      }

      // ----- WebRTC Host Flow -------------------------------------------------

      function triggerCreateRoom() {
        if (typeof Peer === "undefined") {
          showToast("WebRTC library loading... please check network.");
          return;
        }

        cleanupExistingPeer();
        setCreateButtonLoading(true);

        var code = generateRoomCode();
        var key = generateSessionKey();
        var durationMinutes = selectedDurationMinutes || 5;
        var now = Date.now();
        var lifetimeMs = durationMinutes * 60 * 1000;
        var expiresAt = now + lifetimeMs;

        roomCreatedAt = now;
        roomExpiresAt = expiresAt;

        var hostPeerId = "anomoly-v2-" + code.toUpperCase();

        try {
          peer = new Peer(hostPeerId, PEER_CONFIG);
        } catch (e) {
          console.error("Peer instantiation failed:", e);
          showToast("Failed to initialize WebRTC peer.");
          setCreateButtonLoading(false);
          return;
        }

        peer.on("open", function (id) {
          console.log("[Host] WebRTC Peer active with ID:", id);
          isHost = true;
          activeRoomCode = code;
          sessionKey = key;
          activeConnections = [];

          // Preserve key and expiration in URL hash (browsers never send hash to server)
          window.history.replaceState(null, "", getShareUrl(code, key, expiresAt));

          setCreateButtonLoading(false);
          enterRoom(code, true, expiresAt);
          updateP2PStatus("waiting", "Waiting for Peer");
          showToast("Room " + code + " created (" + durationMinutes + "m lifetime)!");
        });

        peer.on("connection", function (conn) {
          console.log("[Host] Incoming guest connection attempt:", conn.peer);
          setupHostConnection(conn);
        });

        peer.on("error", function (err) {
          console.error("[Host] Peer error:", err);
          if (err.type === "unavailable-id") {
            // Code collision — retry seamlessly
            console.warn("[Host] Code collision detected, retrying...");
            cleanupExistingPeer();
            triggerCreateRoom();
            return;
          }
          setCreateButtonLoading(false);
          showToast("Connection notice: " + (err.type || "Peer error"));
        });
      }

      function setupHostConnection(conn) {
        conn.on("open", function () {
          console.log("[Host] Guest DataChannel open:", conn.peer);
        });

        conn.on("data", function (raw) {
          handleHostIncomingData(conn, raw);
        });

        conn.on("close", function () {
          console.log("[Host] Guest disconnected:", conn.peer);
          removeHostConnection(conn);
        });

        conn.on("error", function (err) {
          console.warn("[Host] DataChannel error on conn:", err);
          removeHostConnection(conn);
        });
      }

      function handleHostIncomingData(conn, data) {
        if (!data || typeof data !== "object") return;

        switch (data.type) {
          case "auth":
            // Verify optional session secret
            if (sessionKey && data.key && data.key !== sessionKey) {
              conn.send({ type: "error", text: "Invalid room security key." });
              conn.close();
              return;
            }

            // Check if room is already expired
            if (Date.now() >= roomExpiresAt) {
              conn.send({ type: "error", text: "Room has already expired." });
              conn.close();
              return;
            }

            // Accept guest
            if (activeConnections.indexOf(conn) === -1) {
              activeConnections.push(conn);
            }

            conn.send({
              type: "auth_ok",
              participantCount: activeConnections.length + 1,
              createdAt: roomCreatedAt,
              expiresAt: roomExpiresAt
            });

            // Update participant counts across peers
            broadcastToGuests({
              type: "participantCount",
              count: activeConnections.length + 1
            });

            updateParticipantCount(activeConnections.length + 1);
            updateP2PStatus("online", "P2P Direct");
            showBanner("Direct WebRTC DataChannel connection established (DTLS encrypted).", "connected");
            showToast("A participant joined your room!");
            break;

          case "chat":
            if (Date.now() >= roomExpiresAt) {
              return; // Room expired, ignore
            }
            if (typeof data.text === "string" && data.text.trim().length > 0) {
              var cleanText = data.text.slice(0, 500);
              renderChatMessage(cleanText, data.timestamp || Date.now(), false);

              // Relay to all other connected guests
              activeConnections.forEach(function (c) {
                if (c !== conn && c.open) {
                  try {
                    c.send(data);
                  } catch (e) {}
                }
              });
            }
            break;

          case "leave":
            removeHostConnection(conn);
            break;

          case "file_start":
            if (Date.now() >= roomExpiresAt) return;
            if (!data.transferId || !data.name || typeof data.size !== "number" || data.size <= 0 || data.size > MAX_FILE_SIZE) {
              console.warn("[Host] Disallowed file_start payload:", data);
              return;
            }
            var hSanitized = sanitizeFilename(data.name);
            var hExt = getFileExtension(hSanitized);
            if (!ALLOWED_FILE_TYPES[hExt]) {
              console.warn("[Host] Disallowed file extension:", hExt);
              return;
            }

            var hRxTransfer = {
              transferId: data.transferId,
              name: hSanitized,
              size: data.size,
              ext: hExt,
              mime: ALLOWED_FILE_TYPES[hExt].mime,
              totalChunks: data.totalChunks,
              sha256: data.sha256,
              chunks: new Array(data.totalChunks),
              receivedCount: 0,
              timestamp: data.timestamp || Date.now()
            };

            hRxTransfer.elements = renderDocMessage(hRxTransfer, false);
            activeTransfers.set(data.transferId, hRxTransfer);

            // Relay to all other connected guests
            activeConnections.forEach(function (c) {
              if (c !== conn && c.open) {
                try { c.send(data); } catch (e) {}
              }
            });
            break;

          case "file_chunk":
            if (Date.now() >= roomExpiresAt) return;
            var hRx = activeTransfers.get(data.transferId);
            if (!hRx || hRx.cancelled) return;

            if (typeof data.index !== "number" || data.index < 0 || data.index >= hRx.totalChunks) return;
            if (!hRx.chunks[data.index]) {
              hRx.chunks[data.index] = data.chunk;
              hRx.receivedCount++;
            }

            var hPct = Math.round((hRx.receivedCount / hRx.totalChunks) * 100);
            updateDocProgress(hRx.transferId, hPct, "Receiving " + hPct + "%");

            // Relay chunk to all other connected guests
            activeConnections.forEach(function (c) {
              if (c !== conn && c.open) {
                try { c.send(data); } catch (e) {}
              }
            });

            if (hRx.receivedCount === hRx.totalChunks) {
              updateDocProgress(hRx.transferId, 100, "Verifying SHA-256...");
              var hAssembled = new Uint8Array(hRx.size);
              var hOffset = 0;
              for (var ci = 0; ci < hRx.totalChunks; ci++) {
                var cData = toUint8Array(hRx.chunks[ci]);
                hAssembled.set(cData, hOffset);
                hOffset += cData.byteLength;
              }
              hRx.chunks = null;

              calculateSHA256(hAssembled.buffer).then(function (computedHash) {
                if (hRx.sha256 && computedHash.toLowerCase() !== hRx.sha256.toLowerCase()) {
                  console.error("[Host] SHA-256 mismatch! Expected:", hRx.sha256, "Computed:", computedHash);
                  failDocTransfer(hRx.transferId, "Integrity check failed: corrupted document");
                  return;
                }
                var blob = new Blob([hAssembled], { type: hRx.mime });
                var blobUrl = URL.createObjectURL(blob);
                activeBlobUrls.add(blobUrl);
                completeDocTransfer(hRx.transferId, blobUrl, computedHash);
                showToast("Document received: " + hRx.name);
              }).catch(function (err) {
                console.error("[Host] SHA-256 verification error:", err);
                failDocTransfer(hRx.transferId, "Integrity check error");
              });
            }
            break;

          case "file_cancel":
            cancelTransfer(data.transferId, false);
            activeConnections.forEach(function (c) {
              if (c !== conn && c.open) {
                try { c.send(data); } catch (e) {}
              }
            });
            break;

          case "expiry_extension":
            // Host is authoritative; reject any expiry extension sent by guests
            console.warn("[Host] Unauthorized expiry_extension attempt from guest; rejecting.");
            break;
        }
      }

      function removeHostConnection(conn) {
        var idx = activeConnections.indexOf(conn);
        if (idx !== -1) {
          activeConnections.splice(idx, 1);
        }

        var total = activeConnections.length + 1;
        updateParticipantCount(total);
        broadcastToGuests({ type: "participantCount", count: total });

        if (activeConnections.length === 0) {
          updateP2PStatus("waiting", "Waiting for Peer");
          showBanner("Peer disconnected. Waiting for someone to join...", "warning");
        }
      }

      function broadcastToGuests(payload) {
        activeConnections.forEach(function (conn) {
          if (conn.open) {
            try {
              conn.send(payload);
            } catch (e) {}
          }
        });
      }

      // ----- WebRTC Guest Flow ------------------------------------------------

      function triggerJoinRoom(targetCode, targetKey, targetExpiresAt) {
        var code = (targetCode || joinCodeInput.value).trim().toUpperCase();
        var key = targetKey || sessionKey;

        if (code.length !== 6) {
          joinStatusMsg.textContent = "Please enter an exact 6-character room code.";
          joinStatusMsg.classList.add("error");
          joinCodeInput.focus();
          return;
        }

        // Check if invitation has explicit expiration timestamp in the past
        if (targetExpiresAt && Date.now() >= targetExpiresAt) {
          joinStatusMsg.textContent = "⚠️ This room invitation has expired.";
          joinStatusMsg.classList.add("error");
          showBanner("⚠️ This room invitation has expired. Rooms self-destruct after their preset lifetime.", "error");
          showToast("Invitation expired.");
          return;
        }

        if (typeof Peer === "undefined") {
          showToast("WebRTC library loading... please check network.");
          return;
        }

        cleanupExistingPeer();
        joinStatusMsg.textContent = "Connecting to host...";
        joinStatusMsg.classList.remove("error");

        try {
          peer = new Peer(PEER_CONFIG);
        } catch (e) {
          joinStatusMsg.textContent = "Failed to initialize WebRTC.";
          joinStatusMsg.classList.add("error");
          return;
        }

        var hostPeerId = "anomoly-v2-" + code;

        peer.on("open", function (guestId) {
          console.log("[Guest] Peer active with ID:", guestId);
          console.log("[Guest] Connecting to host:", hostPeerId);

          hostConnection = peer.connect(hostPeerId, { reliable: true });

          // 12-second NAT / Firewall timeout warning
          connectTimeoutTimer = setTimeout(function () {
            showBanner(
              "⚠️ Direct P2P connection taking longer than expected. STUN was unable to traverse restrictive NAT/firewall. A TURN relay would normally be needed here.",
              "warning"
            );
          }, 12000);

          setupGuestConnection(hostConnection, code, key, targetExpiresAt);
        });

        peer.on("error", function (err) {
          console.error("[Guest] Peer error:", err);
          clearTimeout(connectTimeoutTimer);
          joinStatusMsg.textContent = "Could not reach room " + code + ". Verify the code or check if host is online.";
          joinStatusMsg.classList.add("error");
          showToast("Could not connect to room " + code);
        });
      }

      function setupGuestConnection(conn, code, key, targetExpiresAt) {
        conn.on("open", function () {
          clearTimeout(connectTimeoutTimer);
          console.log("[Guest] DataChannel open to host");
          conn.send({
            type: "auth",
            key: key || ""
          });
        });

        conn.on("data", function (data) {
          handleGuestIncomingData(conn, data, code, key, targetExpiresAt);
        });

        conn.on("close", function () {
          console.warn("[Guest] Connection to host closed");
          updateP2PStatus("disconnected", "Host Disconnected");
          showBanner("The room host disconnected or closed the room.", "error");
          showToast("Host disconnected.");
        });

        conn.on("error", function (err) {
          console.error("[Guest] DataChannel error:", err);
          showToast("WebRTC DataChannel error.");
        });
      }

      function handleGuestIncomingData(conn, data, code, key, targetExpiresAt) {
        if (!data || typeof data !== "object") return;

        switch (data.type) {
          case "auth_ok":
            isHost = false;
            activeRoomCode = code;
            sessionKey = key;
            roomCreatedAt = data.createdAt || Date.now();
            roomExpiresAt = data.expiresAt || targetExpiresAt || (Date.now() + 5 * 60 * 1000);

            enterRoom(code, false, roomExpiresAt);
            updateParticipantCount(data.participantCount || 2);
            updateP2PStatus("online", "P2P Direct");
            showBanner("Connected directly to host via WebRTC DataChannel (Encrypted).", "connected");
            showToast("Joined room " + code + "!");
            break;

          case "chat":
            if (Date.now() >= roomExpiresAt) return;
            if (typeof data.text === "string" && data.text.trim().length > 0) {
              var cleanText = data.text.slice(0, 500);
              renderChatMessage(cleanText, data.timestamp || Date.now(), false);
            }
            break;

          case "participantCount":
            if (typeof data.count === "number") {
              updateParticipantCount(data.count);
            }
            break;

          case "error":
            showToast(data.text || "Connection rejected by host.");
            leaveRoomView();
            break;

          case "file_start":
            if (Date.now() >= roomExpiresAt) return;
            if (!data.transferId || !data.name || typeof data.size !== "number" || data.size <= 0 || data.size > MAX_FILE_SIZE) {
              console.warn("[Guest] Disallowed file_start payload:", data);
              return;
            }
            var gSanitized = sanitizeFilename(data.name);
            var gExt = getFileExtension(gSanitized);
            if (!ALLOWED_FILE_TYPES[gExt]) {
              console.warn("[Guest] Disallowed file extension:", gExt);
              return;
            }

            var gRxTransfer = {
              transferId: data.transferId,
              name: gSanitized,
              size: data.size,
              ext: gExt,
              mime: ALLOWED_FILE_TYPES[gExt].mime,
              totalChunks: data.totalChunks,
              sha256: data.sha256,
              chunks: new Array(data.totalChunks),
              receivedCount: 0,
              timestamp: data.timestamp || Date.now()
            };

            gRxTransfer.elements = renderDocMessage(gRxTransfer, false);
            activeTransfers.set(data.transferId, gRxTransfer);
            break;

          case "file_chunk":
            if (Date.now() >= roomExpiresAt) return;
            var gRx = activeTransfers.get(data.transferId);
            if (!gRx || gRx.cancelled) return;

            if (typeof data.index !== "number" || data.index < 0 || data.index >= gRx.totalChunks) return;
            if (!gRx.chunks[data.index]) {
              gRx.chunks[data.index] = data.chunk;
              gRx.receivedCount++;
            }

            var gPct = Math.round((gRx.receivedCount / gRx.totalChunks) * 100);
            updateDocProgress(gRx.transferId, gPct, "Receiving " + gPct + "%");

            if (gRx.receivedCount === gRx.totalChunks) {
              updateDocProgress(gRx.transferId, 100, "Verifying SHA-256...");
              var gAssembled = new Uint8Array(gRx.size);
              var gOffset = 0;
              for (var gCi = 0; gCi < gRx.totalChunks; gCi++) {
                var gcData = toUint8Array(gRx.chunks[gCi]);
                gAssembled.set(gcData, gOffset);
                gOffset += gcData.byteLength;
              }
              gRx.chunks = null;

              calculateSHA256(gAssembled.buffer).then(function (computedHash) {
                if (gRx.sha256 && computedHash.toLowerCase() !== gRx.sha256.toLowerCase()) {
                  console.error("[Guest] SHA-256 mismatch! Expected:", gRx.sha256, "Computed:", computedHash);
                  failDocTransfer(gRx.transferId, "Integrity check failed: corrupted document");
                  return;
                }
                var blob = new Blob([gAssembled], { type: gRx.mime });
                var blobUrl = URL.createObjectURL(blob);
                activeBlobUrls.add(blobUrl);
                completeDocTransfer(gRx.transferId, blobUrl, computedHash);
                showToast("Document received: " + gRx.name);
              }).catch(function (err) {
                console.error("[Guest] SHA-256 verification error:", err);
                failDocTransfer(gRx.transferId, "Integrity check error");
              });
            }
            break;

          case "file_cancel":
            cancelTransfer(data.transferId, false);
            break;

          case "expiry_extension":
            if (conn !== hostConnection) {
              console.warn("[Guest] Expiry extension received from non-host peer, ignored.");
              return;
            }
            if (typeof data.newExpiresAt !== "number" || data.newExpiresAt <= roomExpiresAt) {
              return;
            }
            roomExpiresAt = data.newExpiresAt;
            startAbsoluteCountdown(roomExpiresAt);
            var hashParts = [];
            if (sessionKey) hashParts.push("key=" + encodeURIComponent(sessionKey));
            hashParts.push("exp=" + encodeURIComponent(roomExpiresAt));
            window.history.replaceState(null, "", window.location.pathname + window.location.search + "#" + hashParts.join("&"));
            showToast("Host extended room duration by +" + (data.extendedByMinutes || "") + "m!");
            showBanner("Room duration extended by host to " + labelCountdown.textContent + " remaining.", "connected");
            break;
        }
      }

      function cleanupExistingPeer() {
        clearTimeout(connectTimeoutTimer);
        if (hostConnection) {
          try { hostConnection.close(); } catch (e) {}
          hostConnection = null;
        }
        if (activeConnections && activeConnections.length > 0) {
          activeConnections.forEach(function (c) {
            try { c.close(); } catch (e) {}
          });
          activeConnections = [];
        }
        if (peer) {
          try { peer.destroy(); } catch (e) {}
          peer = null;
        }
      }

      // ----- Room UI Transitions ----------------------------------------------

      function enterRoom(code, amHost, expiresAt) {
        activeRoomCode = code;
        activeRoomCodeLabel.textContent = code;

        landingScreen.style.display = "none";
        topNavbar.style.display = "none";
        chatScreen.style.display = "flex";

        chatMessagesArea.innerHTML = "";
        chatMessagesArea.appendChild(chatEmptyState);
        chatEmptyState.style.display = "block";

        messageTextInput.disabled = false;
        btnSendMessage.disabled = false;

        // Creator Interactive Expiry Controls
        if (amHost) {
          pillCountdown.classList.add("creator-interactive");
          pillCountdown.setAttribute("title", "Click to extend room lifetime (Creator privilege)");
          pillCountdown.setAttribute("role", "button");
          pillCountdown.setAttribute("tabindex", "0");
        } else {
          pillCountdown.classList.remove("creator-interactive");
          pillCountdown.removeAttribute("title");
          pillCountdown.removeAttribute("role");
          pillCountdown.removeAttribute("tabindex");
        }
        if (expiryExtensionPopover) {
          expiryExtensionPopover.style.display = "none";
        }

        // Reset attachment preview
        pendingAttachment = null;
        if (fileAttachmentInput) fileAttachmentInput.value = "";
        if (attachmentPreviewBar) attachmentPreviewBar.style.display = "none";

        startAbsoluteCountdown(expiresAt);
        updateInviteModalData(code, sessionKey, expiresAt);
        window.scrollTo(0, 0);
        messageTextInput.focus();
      }

      function leaveRoomView() {
        cleanupExistingPeer();
        activeRoomCode = null;
        isHost = false;
        sessionKey = null;
        roomExpiresAt = 0;
        clearInterval(countdownInterval);
        hideBanner();

        // Revoke all transient Blob URLs to free memory
        activeBlobUrls.forEach(function (url) {
          try { URL.revokeObjectURL(url); } catch (e) {}
        });
        activeBlobUrls.clear();

        // Cancel any active transfers
        activeTransfers.forEach(function (t) {
          t.cancelled = true;
          t.chunks = null;
        });
        activeTransfers.clear();

        // Reset attachment UI
        pendingAttachment = null;
        if (fileAttachmentInput) fileAttachmentInput.value = "";
        if (attachmentPreviewBar) attachmentPreviewBar.style.display = "none";
        if (expiryExtensionPopover) expiryExtensionPopover.style.display = "none";

        chatScreen.style.display = "none";
        topNavbar.style.display = "block";
        landingScreen.style.display = "block";

        chatMessagesArea.innerHTML = "";
        messageTextInput.value = "";
        updateCharCounter();

        // Clean query and hash
        window.history.replaceState(null, "", window.location.pathname);
        window.scrollTo(0, 0);
      }

      // Safe rendering preventing any HTML/script injection
      function renderChatMessage(text, timestamp, isSelf) {
        chatEmptyState.style.display = "none";

        var bubble = document.createElement("div");
        bubble.className = "chat-bubble " + (isSelf ? "sent" : "received");

        var date = new Date(timestamp || Date.now());
        var timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        var metaText = isSelf ? "You · " + timeStr : "Anonymous · " + timeStr;

        var textDiv = document.createElement("div");
        textDiv.className = "bubble-text";
        textDiv.textContent = text;

        var metaDiv = document.createElement("div");
        metaDiv.className = "bubble-meta";
        metaDiv.textContent = metaText;

        bubble.appendChild(textDiv);
        bubble.appendChild(metaDiv);

        chatMessagesArea.appendChild(bubble);
        chatMessagesArea.scrollTop = chatMessagesArea.scrollHeight;
      }

      // ----- Absolute Lifetime Countdown -------------------------------------

      function startAbsoluteCountdown(targetExpiresAt) {
        roomExpiresAt = targetExpiresAt;
        clearInterval(countdownInterval);

        function updateTick() {
          var remainingMs = roomExpiresAt - Date.now();
          if (remainingMs <= 0) {
            clearInterval(countdownInterval);
            labelCountdown.textContent = "00:00";
            messageTextInput.disabled = true;
            btnSendMessage.disabled = true;
            showBanner("⚠️ Room has expired. All peer connections closed and data wiped.", "error");
            showToast("Room lifetime reached. Room expired.");
            cleanupExistingPeer();
          } else {
            var totalSecs = Math.ceil(remainingMs / 1000);
            var mins = Math.floor(totalSecs / 60);
            var secs = totalSecs % 60;
            labelCountdown.textContent =
              (mins < 10 ? "0" : "") + mins + ":" + (secs < 10 ? "0" : "") + secs;
          }
        }

        updateTick();
        countdownInterval = setInterval(updateTick, 1000);
      }

      function setCreateButtonLoading(loading) {
        btnActionCreate.disabled = loading;
        createBtnText.textContent = loading ? "Initializing P2P..." : "Create Room Now";
      }

      // ----- Offline QR Code Generation ---------------------------------------

      function updateInviteModalData(code, key, expiresAt) {
        var url = getShareUrl(code, key, expiresAt);
        shareUrlText.textContent = url;

        if (typeof QRCode !== "undefined" && QRCode.toDataURL) {
          QRCode.toDataURL(
            url,
            {
              width: 240,
              margin: 1,
              errorCorrectionLevel: "M",
              color: { dark: "#3D4852", light: "#E0E5EC" }
            },
            function (err, dataUri) {
              if (!err && dataUri) {
                modalQrImg.src = dataUri;
                modalQrImg.style.display = "block";
              }
            }
          );
        } else {
          modalQrImg.style.display = "none";
        }
      }

      // ----- URL Parameter Parsing (1-click invitation join) -------------------

      function checkUrlRoomParameter() {
        var params = new URLSearchParams(window.location.search);
        var roomParam = params.get("room") || params.get("join");
        var hash = window.location.hash || "";
        var keyParam = null;
        var expParam = null;

        var keyMatch = hash.match(/key=([0-9a-fA-F]+)/);
        if (keyMatch) {
          keyParam = keyMatch[1];
        }

        var expMatch = hash.match(/exp=([0-9]+)/);
        if (expMatch) {
          expParam = parseInt(expMatch[1], 10);
        }

        if (roomParam) {
          roomParam = roomParam.trim().toUpperCase();
          if (roomParam.length === 6) {
            joinCodeInput.value = roomParam;

            // Check if already expired before connecting
            if (expParam && Date.now() >= expParam) {
              joinStatusMsg.textContent = "⚠️ This room invitation has already expired.";
              joinStatusMsg.classList.add("error");
              showBanner("⚠️ This room invitation has expired. Rooms self-destruct after their preset lifetime.", "error");
              showToast("Invitation has expired.");
              return;
            }

            showToast("Invitation detected for room " + roomParam);
            setTimeout(function () {
              triggerJoinRoom(roomParam, keyParam, expParam);
            }, 300);
          }
        }
      }

      // ----- Message Dispatch ------------------------------------------------

      function triggerSendMessage() {
        if (Date.now() >= roomExpiresAt) {
          showToast("Room has expired.");
          return;
        }

        var text = messageTextInput.value.trim();
        var hasText = text.length > 0;
        var hasAttachment = !!pendingAttachment;

        if (!hasText && !hasAttachment) return;

        if (hasText && text.length > 500) {
          showToast("Message exceeds 500 characters limit.");
          return;
        }

        // Rate limiting: max 5 messages per 2s
        var now = Date.now();
        messageTimestamps = messageTimestamps.filter(function (t) { return now - t < 2000; });
        if (messageTimestamps.length >= 5) {
          showToast("Please slow down. Rate limit exceeded.");
          return;
        }
        messageTimestamps.push(now);

        // Send text message if present
        if (hasText) {
          var payload = {
            type: "chat",
            text: text,
            timestamp: now
          };

          if (isHost) {
            // Host sends to all active guests
            broadcastToGuests(payload);
            renderChatMessage(text, now, true);
          } else if (hostConnection && hostConnection.open) {
            // Guest sends to host
            hostConnection.send(payload);
            renderChatMessage(text, now, true);
          } else {
            showToast("No active peer connection to send message.");
            return;
          }

          messageTextInput.value = "";
          updateCharCounter();
        }

        // Send binary document attachment if selected
        if (hasAttachment) {
          var toSend = pendingAttachment;
          pendingAttachment = null;
          if (fileAttachmentInput) fileAttachmentInput.value = "";
          if (attachmentPreviewBar) attachmentPreviewBar.style.display = "none";
          initiateFileTransfer(toSend);
        }
      }

      function triggerLeaveRoom() {
        if (isHost) {
          broadcastToGuests({ type: "leave" });
        } else if (hostConnection && hostConnection.open) {
          try { hostConnection.send({ type: "leave" }); } catch (e) {}
        }
        leaveRoomView();
        showToast("Left the room.");
      }

      function copyTextToClipboard(text, successMessage) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            showToast(successMessage);
          }).catch(function () {
            fallbackCopy(text, successMessage);
          });
        } else {
          fallbackCopy(text, successMessage);
        }
      }

      function fallbackCopy(text, successMessage) {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand("copy");
          showToast(successMessage);
        } catch (e) {
          showToast("Could not copy automatically.");
        }
        document.body.removeChild(ta);
      }

      function updateCharCounter() {
        var len = messageTextInput.value.length;
        charLimitIndicator.textContent = len + "/500";
        charLimitIndicator.classList.remove("warn", "danger");
        if (len >= 490) {
          charLimitIndicator.classList.add("danger");
        } else if (len >= 400) {
          charLimitIndicator.classList.add("warn");
        }
      }

      // ----- Event Listeners -------------------------------------------------

      setupExpirySelector();
      setupCreatorExpiryExtension();

      // Document Attachment Event Listeners
      if (btnAttachDocument && fileAttachmentInput) {
        btnAttachDocument.addEventListener("click", function () {
          fileAttachmentInput.click();
        });

        fileAttachmentInput.addEventListener("change", function () {
          if (!fileAttachmentInput.files || fileAttachmentInput.files.length === 0) return;
          var file = fileAttachmentInput.files[0];

          if (file.size > MAX_FILE_SIZE) {
            showToast("File exceeds 10MB limit (" + formatBytes(file.size) + ").");
            fileAttachmentInput.value = "";
            return;
          }

          if (file.size === 0) {
            showToast("Cannot send an empty 0-byte file.");
            fileAttachmentInput.value = "";
            return;
          }

          var cleanName = sanitizeFilename(file.name);
          var ext = getFileExtension(cleanName);
          var typeInfo = ALLOWED_FILE_TYPES[ext];

          if (!typeInfo) {
            showToast("Unsupported file extension (" + (ext || "none") + "). Allowed: PDF, Word, Excel, PPT, TXT, RTF, OpenDoc.");
            fileAttachmentInput.value = "";
            return;
          }

          pendingAttachment = {
            file: file,
            name: cleanName,
            size: file.size,
            ext: ext,
            typeInfo: typeInfo
          };

          attachmentTypeBadge.textContent = typeInfo.label;
          attachmentFileName.textContent = cleanName;
          attachmentFileSize.textContent = formatBytes(file.size);
          attachmentPreviewBar.style.display = "flex";
        });
      }

      if (btnCancelAttachment) {
        btnCancelAttachment.addEventListener("click", function () {
          pendingAttachment = null;
          if (fileAttachmentInput) fileAttachmentInput.value = "";
          if (attachmentPreviewBar) attachmentPreviewBar.style.display = "none";
        });
      }

      // Navigation & Hero buttons
      navCreateBtn.addEventListener("click", triggerCreateRoom);
      mobileCreateBtn.addEventListener("click", function () {
        closeMobileMenu();
        triggerCreateRoom();
      });
      heroCreateBtn.addEventListener("click", triggerCreateRoom);
      btnActionCreate.addEventListener("click", triggerCreateRoom);

      // Join room buttons
      btnActionJoin.addEventListener("click", function () {
        triggerJoinRoom();
      });
      joinCodeInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          triggerJoinRoom();
        }
      });
      joinCodeInput.addEventListener("input", function () {
        joinStatusMsg.textContent = "Enter 6 alphanumeric characters";
        joinStatusMsg.classList.remove("error");
      });

      // Chat controls
      btnLeaveRoom.addEventListener("click", triggerLeaveRoom);
      btnCopyRoomCode.addEventListener("click", function () {
        if (activeRoomCode) {
          copyTextToClipboard(activeRoomCode, "Room code copied: " + activeRoomCode);
        }
      });

      // Composer
      composerForm.addEventListener("submit", function (e) {
        e.preventDefault();
        triggerSendMessage();
      });

      messageTextInput.addEventListener("input", updateCharCounter);
      messageTextInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          triggerSendMessage();
        }
      });

      // Share Modal
      btnOpenShareModal.addEventListener("click", function () {
        inviteModal.classList.add("open");
      });

      btnCloseInviteModal.addEventListener("click", function () {
        inviteModal.classList.remove("open");
      });

      inviteModal.addEventListener("click", function (e) {
        if (e.target === inviteModal) {
          inviteModal.classList.remove("open");
        }
      });

      btnModalCopyLink.addEventListener("click", function () {
        if (activeRoomCode) {
          var url = getShareUrl(activeRoomCode, sessionKey, roomExpiresAt);
          copyTextToClipboard(url, "Invitation link copied to clipboard!");
        }
      });

      btnModalNativeShare.addEventListener("click", function () {
        if (!activeRoomCode) return;
        var url = getShareUrl(activeRoomCode, sessionKey, roomExpiresAt);
        if (navigator.share) {
          navigator.share({
            title: "Join me on Anomoly Chat",
            text: "Join my temporary anonymous room: " + activeRoomCode,
            url: url
          }).catch(function () {
            copyTextToClipboard(url, "Invitation link copied!");
          });
        } else {
          copyTextToClipboard(url, "Invitation link copied!");
        }
      });

      // FAQ Accordion
      var faqQuestions = document.querySelectorAll(".faq-question");
      faqQuestions.forEach(function (btn) {
        btn.addEventListener("click", function () {
          var item = btn.parentElement;
          var isActive = item.classList.contains("active");
          document.querySelectorAll(".faq-item").forEach(function (other) {
            other.classList.remove("active");
          });
          if (!isActive) {
            item.classList.add("active");
          }
        });
      });

      // Mobile Menu Toggle
      navToggleBtn.addEventListener("click", function () {
        mobileMenu.classList.toggle("open");
      });

      window.closeMobileMenu = function () {
        mobileMenu.classList.remove("open");
      };

      // Initialization on DOM ready
      checkUrlRoomParameter();
    })();
  