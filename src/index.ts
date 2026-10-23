/**
 * Anomoly Chat — Ephemeral, In-Memory WebSocket Chat Server
 * 
 * Engineering Architecture:
 * - Express serves the static frontend (vanilla HTML/CSS/JS)
 * - 'ws' handles real-time bidirectional communication
 * - Explicit room routing: Map<roomCode, Set<WebSocket>>
 * - In-memory only: zero database writes, zero disk persistence
 * - Immediate expiry: checks TTL on every request, sweeps every 30s
 * - Input validation: length enforcement (max 500 chars), empty string rejection, rate limiting
 */

import express from "express";
import http from "http";
import WebSocket from "ws";
import crypto from "crypto";
import QRCode from "qrcode";

// ----- Configuration ---------------------------------------------------------

export const ROOM_TTL_MS = 5 * 60 * 1000; // 5 minutes inactivity TTL
export const SWEEP_INTERVAL_MS = 30 * 1000; // 30 seconds periodic sweep
export const ROOM_CODE_LENGTH = 6;
export const MAX_MESSAGE_LENGTH = 500;
export const MAX_ROOM_MESSAGES = 100;
export const RATE_LIMIT_WINDOW_MS = 2000;
export const MAX_MESSAGES_PER_WINDOW = 5;

// Alphanumeric characters excluding visually ambiguous ones: 0, O, I, l
export const SAFE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

// ----- Document Sharing & Expiry Extension Constants -------------------------
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MiB strictly enforced
export const CHUNK_SIZE = 16384;               // 16 KiB chunks
export const MAX_TOTAL_ROOM_LIFETIME_MS = 4 * 60 * 60 * 1000; // 4 hours maximum lifetime ceiling

export const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".txt",
  ".rtf",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  ".odt",
  ".ods",
  ".odp"
] as const;

export type AllowedExtension = typeof ALLOWED_EXTENSIONS[number];

// ----- Types -----------------------------------------------------------------

export interface Message {
  id: string;
  roomCode: string;
  sender: string;
  text: string;
  timestamp: number;
}

export interface Room {
  code: string;
  createdAt: number;
  lastActivity: number;
  messages: Message[];
  maxMessages: number;
}

interface SocketMeta {
  roomCode: string | null;
  messageTimestamps: number[];
}

// ----- Room State (In-Memory) ------------------------------------------------

export const rooms = new Map<string, Room>();
export const roomClients = new Map<string, Set<WebSocket>>();
const socketMetaMap = new WeakMap<WebSocket, SocketMeta>();

// ----- Helper Functions ------------------------------------------------------

export function isSafeRoomCode(code: string): boolean {
  if (typeof code !== "string" || code.length !== ROOM_CODE_LENGTH) {
    return false;
  }
  for (const char of code) {
    if (!SAFE_CHARS.includes(char)) return false;
  }
  return true;
}

export function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += SAFE_CHARS[crypto.randomInt(0, SAFE_CHARS.length)];
  }
  return code;
}

export function isRoomExpired(room: Room, now: number = Date.now()): boolean {
  return now - room.lastActivity > ROOM_TTL_MS;
}

export function cleanExpiredRoom(code: string): void {
  const clients = roomClients.get(code);
  if (clients) {
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: "error",
          code: "ROOM_EXPIRED",
          text: "Room expired due to inactivity."
        }));
      }
    }
    roomClients.delete(code);
  }
  rooms.delete(code);
}

export function sweepExpiredRooms(): number {
  const now = Date.now();
  let sweptCount = 0;
  for (const [code, room] of rooms.entries()) {
    if (isRoomExpired(room, now)) {
      cleanExpiredRoom(code);
      sweptCount++;
    }
  }
  return sweptCount;
}

export function broadcastInRoom(roomCode: string, payload: unknown, excludeWs?: WebSocket): void {
  const clients = roomClients.get(roomCode);
  if (!clients) return;

  const json = JSON.stringify(payload);
  for (const client of clients) {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
      client.send(json);
    }
  }
}

function sendParticipantCount(roomCode: string): void {
  const clients = roomClients.get(roomCode);
  const count = clients ? clients.size : 0;
  broadcastInRoom(roomCode, {
    type: "roomState",
    code: roomCode,
    participantCount: count,
  });
}

// ----- Document Sharing & Expiry Extension Engine Helpers --------------------

export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== "string") return "document";
  let clean = filename.replace(/^.*[\\\/]/, "");
  clean = clean.replace(/[\x00-\x1F\x7F]/g, "");
  clean = clean.replace(/[<>:"/\\|?*#;`$]/g, "_");
  clean = clean.trim().replace(/^\.+/, "").replace(/\.+$/, "");
  if (!clean) clean = "document";
  if (clean.length > 100) {
    const extIdx = clean.lastIndexOf(".");
    if (extIdx > 0 && extIdx > clean.length - 15) {
      clean = clean.slice(0, 85) + clean.slice(extIdx);
    } else {
      clean = clean.slice(0, 100);
    }
  }
  return clean;
}

export function validateDocument(
  filename: string,
  size: number
): { valid: boolean; error?: string; ext?: string; sanitizedName?: string } {
  if (typeof size !== "number" || isNaN(size) || size <= 0) {
    return { valid: false, error: "Cannot send empty file." };
  }
  if (size > MAX_FILE_SIZE) {
    return { valid: false, error: "File exceeds 10MB limit." };
  }

  const sanitized = sanitizeFilename(filename);
  const extIdx = sanitized.lastIndexOf(".");
  const ext = extIdx !== -1 ? sanitized.slice(extIdx).toLowerCase() : "";

  if (!ALLOWED_EXTENSIONS.includes(ext as any)) {
    return {
      valid: false,
      error: `Unsupported file extension (${ext || "none"}).`,
    };
  }

  return { valid: true, ext, sanitizedName: sanitized };
}

export function calculateTotalChunks(fileSize: number, chunkSize: number = CHUNK_SIZE): number {
  if (fileSize <= 0) return 0;
  return Math.ceil(fileSize / chunkSize);
}

export function calculateSha256(buffer: Buffer | Uint8Array): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function calculateCreatorExtension(
  roomCreatedAt: number,
  currentExpiresAt: number,
  extensionMinutes: number,
  now: number = Date.now()
): { valid: boolean; newExpiresAt: number; effectiveMinutes: number; error?: string } {
  if (now >= currentExpiresAt) {
    return { valid: false, newExpiresAt: currentExpiresAt, effectiveMinutes: 0, error: "Room has already expired." };
  }
  if (typeof extensionMinutes !== "number" || isNaN(extensionMinutes) || extensionMinutes < 1 || extensionMinutes > 60) {
    return { valid: false, newExpiresAt: currentExpiresAt, effectiveMinutes: 0, error: "Extension minutes must be between 1 and 60." };
  }

  const target = currentExpiresAt + extensionMinutes * 60 * 1000;
  const maxCeiling = roomCreatedAt + MAX_TOTAL_ROOM_LIFETIME_MS;
  const cappedExpiresAt = Math.min(target, maxCeiling);
  const effectiveMinutes = Math.floor((cappedExpiresAt - currentExpiresAt) / 60000);

  if (effectiveMinutes <= 0) {
    return { valid: false, newExpiresAt: currentExpiresAt, effectiveMinutes: 0, error: "Maximum total room lifetime (4 hours) reached." };
  }

  return { valid: true, newExpiresAt: cappedExpiresAt, effectiveMinutes };
}

export function validateExtensionAuthorization(
  isHost: boolean,
  isSenderHostConnection: boolean
): boolean {
  // If Host receives expiry extension message from another client, it is unauthorized
  if (isHost) return false;
  // If Guest receives expiry extension message, it is valid ONLY if sent by the host connection
  return isSenderHostConnection;
}

// ----- Server Application Setup ----------------------------------------------

export function createAppServer(port?: number) {
  const app = express();
  // Serve static files from repository root
  app.use(express.static("./"));

  // Clean favicon handler
  app.get("/favicon.ico", (req, res) => {
    res.status(204).end();
  });

  // QR Code generator endpoint
  app.get("/api/qr", async (req, res) => {
    try {
      const targetUrl = typeof req.query.url === "string" ? req.query.url.trim() : "";
      if (!targetUrl || targetUrl.length > 500) {
        return res.status(400).send("Invalid or missing URL parameter.");
      }

      // Generate SVG with Neumorphic color tokens
      const svg = await QRCode.toString(targetUrl, {
        type: "svg",
        margin: 2,
        color: {
          dark: "#3D4852",
          light: "#E0E5EC",
        },
      });

      res.type("image/svg+xml").send(svg);
    } catch (err) {
      res.status(500).send("Failed to generate QR code.");
    }
  });

  const server = http.createServer(app);
  const wss = new WebSocket.Server({ server });

  // Expiry sweep timer
  const sweepTimer = setInterval(() => {
    const swept = sweepExpiredRooms();
    if (swept > 0) {
      console.log(`[Sweep] Cleaned up ${swept} expired room(s).`);
    }
  }, SWEEP_INTERVAL_MS);

  wss.on("connection", (ws: WebSocket) => {
    socketMetaMap.set(ws, { roomCode: null, messageTimestamps: [] });

    ws.on("message", (raw: WebSocket.RawData) => {
      const meta = socketMetaMap.get(ws) || { roomCode: null, messageTimestamps: [] };
      socketMetaMap.set(ws, meta);

      let data: any;
      try {
        data = JSON.parse(raw.toString());
      } catch {
        ws.send(JSON.stringify({
          type: "error",
          code: "INVALID_JSON",
          text: "Malformed JSON payload.",
        }));
        return;
      }

      if (!data || typeof data.type !== "string") {
        ws.send(JSON.stringify({
          type: "error",
          code: "INVALID_COMMAND",
          text: "Missing or invalid command type.",
        }));
        return;
      }

      // Connection-level rate limiting (brute force and flood protection)
      const now = Date.now();
      meta.messageTimestamps = meta.messageTimestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
      if (meta.messageTimestamps.length >= MAX_MESSAGES_PER_WINDOW) {
        ws.send(JSON.stringify({
          type: "error",
          code: "RATE_LIMITED",
          text: "Rate limit exceeded. Please slow down.",
        }));
        return;
      }
      meta.messageTimestamps.push(now);

      switch (data.type) {
        case "createRoom": {
          // If socket was already in another room, leave it first
          if (meta.roomCode) {
            leaveCurrentRoom(ws, meta);
          }

          let code = generateRoomCode();
          while (rooms.has(code)) {
            code = generateRoomCode();
          }

          const now = Date.now();
          const room: Room = {
            code,
            createdAt: now,
            lastActivity: now,
            messages: [],
            maxMessages: MAX_ROOM_MESSAGES,
          };

          rooms.set(code, room);
          const clients = new Set<WebSocket>([ws]);
          roomClients.set(code, clients);
          meta.roomCode = code;

          ws.send(JSON.stringify({
            type: "roomCreated",
            code,
            createdAt: room.createdAt,
            expiresInMs: ROOM_TTL_MS,
          }));

          sendParticipantCount(code);
          break;
        }

        case "joinRoom": {
          const rawCode = typeof data.code === "string" ? data.code.trim() : "";

          if (!isSafeRoomCode(rawCode)) {
            ws.send(JSON.stringify({
              type: "error",
              code: "INVALID_CODE_FORMAT",
              text: `Room codes must be exactly ${ROOM_CODE_LENGTH} characters without ambiguous characters (0, O, I, l).`,
            }));
            break;
          }

          const room = rooms.get(rawCode);
          if (!room) {
            ws.send(JSON.stringify({
              type: "error",
              code: "ROOM_NOT_FOUND",
              text: "Room not found. It may have expired or never existed.",
            }));
            break;
          }

          if (isRoomExpired(room)) {
            cleanExpiredRoom(rawCode);
            ws.send(JSON.stringify({
              type: "error",
              code: "ROOM_EXPIRED",
              text: "This room has expired due to 5 minutes of inactivity.",
            }));
            break;
          }

          // Leave existing room if joining a different one
          if (meta.roomCode && meta.roomCode !== rawCode) {
            leaveCurrentRoom(ws, meta);
          }

          let clients = roomClients.get(rawCode);
          if (!clients) {
            clients = new Set<WebSocket>();
            roomClients.set(rawCode, clients);
          }
          clients.add(ws);
          meta.roomCode = rawCode;

          // Touch room activity on join
          room.lastActivity = Date.now();

          ws.send(JSON.stringify({
            type: "roomJoined",
            code: rawCode,
            recentMessages: room.messages,
            expiresInMs: ROOM_TTL_MS - (Date.now() - room.lastActivity),
          }));

          sendParticipantCount(rawCode);
          break;
        }

        case "sendMessage": {
          if (!meta.roomCode) {
            ws.send(JSON.stringify({
              type: "error",
              code: "NOT_IN_ROOM",
              text: "You must join a room before sending messages.",
            }));
            break;
          }

          const room = rooms.get(meta.roomCode);
          if (!room || isRoomExpired(room)) {
            if (room) cleanExpiredRoom(meta.roomCode);
            ws.send(JSON.stringify({
              type: "error",
              code: "ROOM_EXPIRED",
              text: "Room has expired. Please create or join a new room.",
            }));
            meta.roomCode = null;
            break;
          }

          // Content validation
          if (typeof data.text !== "string") {
            ws.send(JSON.stringify({
              type: "error",
              code: "INVALID_TEXT",
              text: "Message text must be a string.",
            }));
            break;
          }

          const trimmed = data.text.trim();
          if (trimmed.length === 0) {
            ws.send(JSON.stringify({
              type: "error",
              code: "EMPTY_MESSAGE",
              text: "Message cannot be empty.",
            }));
            break;
          }

          if (trimmed.length > MAX_MESSAGE_LENGTH) {
            ws.send(JSON.stringify({
              type: "error",
              code: "MESSAGE_TOO_LONG",
              text: `Message exceeds maximum allowed length of ${MAX_MESSAGE_LENGTH} characters.`,
            }));
            break;
          }

          // Create message record
          const msg: Message = {
            id: crypto.randomUUID(),
            roomCode: meta.roomCode,
            sender: "anonymous",
            text: trimmed,
            timestamp: now,
          };

          room.messages.push(msg);
          if (room.messages.length > room.maxMessages) {
            room.messages.shift(); // Drop oldest in-memory message
          }
          room.lastActivity = now;

          // Broadcast to ALL sockets in this room (including sender for state sync)
          broadcastInRoom(meta.roomCode, {
            type: "message",
            message: msg,
          });
          break;
        }

        case "leaveRoom": {
          if (meta.roomCode) {
            const oldCode = meta.roomCode;
            leaveCurrentRoom(ws, meta);
            ws.send(JSON.stringify({
              type: "leftRoom",
              code: oldCode,
            }));
          }
          break;
        }

        default:
          ws.send(JSON.stringify({
            type: "error",
            code: "UNKNOWN_COMMAND",
            text: `Unrecognized command type: ${String(data.type)}`,
          }));
          break;
      }
    });

    ws.on("close", () => {
      const meta = socketMetaMap.get(ws);
      if (meta && meta.roomCode) {
        leaveCurrentRoom(ws, meta);
      }
    });

    ws.on("error", (err) => {
      console.error("[WebSocket Error]", err);
    });
  });

  function leaveCurrentRoom(ws: WebSocket, meta: SocketMeta): void {
    const code = meta.roomCode;
    if (!code) return;

    meta.roomCode = null;
    const clients = roomClients.get(code);
    if (clients) {
      clients.delete(ws);
      if (clients.size === 0) {
        // Room remains alive until TTL sweeps it, allowing reconnects or new joiners
      } else {
        sendParticipantCount(code);
      }
    }
  }

  // Start listening if port is provided or default to 3000
  let listenPromise: Promise<void> | null = null;
  if (port !== undefined || process.env.NODE_ENV !== "test") {
    const listenPort = port !== undefined ? port : (Number(process.env.PORT) || 3000);
    listenPromise = new Promise((resolve) => {
      server.listen(listenPort, () => {
        console.log(`Anomoly Chat server active on http://localhost:${listenPort}`);
        resolve();
      });
    });
  }

  return {
    app,
    server,
    wss,
    listenPromise,
    close: () => {
      clearInterval(sweepTimer);
      return new Promise<void>((resolve) => {
        wss.close(() => {
          server.close(() => resolve());
        });
      });
    },
  };
}

// Auto-run if executed directly
if (require.main === module) {
  createAppServer(Number(process.env.PORT) || 3000);
}
