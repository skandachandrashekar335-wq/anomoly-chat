import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import WebSocket from "ws";
import {
  createAppServer,
  rooms,
  roomClients,
  generateRoomCode,
  isSafeRoomCode,
  isRoomExpired,
  sweepExpiredRooms,
  ROOM_TTL_MS,
  MAX_MESSAGE_LENGTH,
} from "./index";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createClient(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    ws.on("open", () => resolve(ws));
    ws.on("error", reject);
  });
}

function waitForMessage(
  ws: WebSocket,
  predicate: (msg: any) => boolean,
  timeoutMs = 2000
): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for matching message after ${timeoutMs}ms`));
    }, timeoutMs);

    function onMessage(raw: WebSocket.RawData) {
      try {
        const parsed = JSON.parse(raw.toString());
        if (predicate(parsed)) {
          cleanup();
          resolve(parsed);
        }
      } catch {
        // ignore
      }
    }

    function cleanup() {
      clearTimeout(timer);
      ws.off("message", onMessage);
    }

    ws.on("message", onMessage);
  });
}

describe("Anomoly Chat Server Test Suite", () => {
  let appServer: ReturnType<typeof createAppServer>;
  const testPort = 3099;
  const activeSockets: WebSocket[] = [];

  async function getClient(): Promise<WebSocket> {
    const ws = await createClient(testPort);
    activeSockets.push(ws);
    return ws;
  }

  before(async () => {
    appServer = createAppServer(testPort);
    if (appServer.listenPromise) {
      await appServer.listenPromise;
    }
  });

  after(async () => {
    for (const ws of activeSockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.terminate();
      }
    }
    for (const client of appServer.wss.clients) {
      client.terminate();
    }
    await appServer.close();
  });

  beforeEach(() => {
    rooms.clear();
    roomClients.clear();
  });

  describe("Helper Functions", () => {
    it("generates valid 6-character room codes", () => {
      for (let i = 0; i < 50; i++) {
        const code = generateRoomCode();
        assert.equal(code.length, 6);
        assert.equal(isSafeRoomCode(code), true);
      }
    });

    it("rejects ambiguous or invalid room codes", () => {
      assert.equal(isSafeRoomCode("ABCDE"), false); // too short
      assert.equal(isSafeRoomCode("ABCDEFG"), false); // too long
      assert.equal(isSafeRoomCode("ABCD01"), false); // contains '0'
      assert.equal(isSafeRoomCode("ABCDOI"), false); // contains 'O', 'I'
      assert.equal(isSafeRoomCode("ABCDl5"), false); // contains 'l'
      assert.equal(isSafeRoomCode(""), false);
      assert.equal(isSafeRoomCode("AB-DEF"), false);
    });

    it("detects expired rooms accurately", () => {
      const freshRoom = {
        code: "TEST01",
        createdAt: Date.now(),
        lastActivity: Date.now(),
        messages: [],
        maxMessages: 100,
      };
      assert.equal(isRoomExpired(freshRoom), false);

      const expiredRoom = {
        code: "TEST02",
        createdAt: Date.now() - (ROOM_TTL_MS + 1000),
        lastActivity: Date.now() - (ROOM_TTL_MS + 1000),
        messages: [],
        maxMessages: 100,
      };
      assert.equal(isRoomExpired(expiredRoom), true);
    });
  });

  describe("Room Creation & Joining", () => {
    it("creates a room and returns roomCreated with valid code", async () => {
      const client = await getClient();
      const promise = waitForMessage(client, (m) => m.type === "roomCreated");
      client.send(JSON.stringify({ type: "createRoom" }));
      const response = await promise;

      assert.equal(response.type, "roomCreated");
      assert.equal(typeof response.code, "string");
      assert.equal(response.code.length, 6);
      assert.equal(rooms.has(response.code), true);
      assert.equal(roomClients.get(response.code)?.size, 1);
    });

    it("allows another client to join an existing room and receive roomJoined", async () => {
      const host = await getClient();
      const guest = await getClient();

      const hostCreatePromise = waitForMessage(host, (m) => m.type === "roomCreated");
      host.send(JSON.stringify({ type: "createRoom" }));
      const created = await hostCreatePromise;
      const code = created.code;

      const guestJoinPromise = waitForMessage(guest, (m) => m.type === "roomJoined");
      guest.send(JSON.stringify({ type: "joinRoom", code }));
      const joined = await guestJoinPromise;

      assert.equal(joined.type, "roomJoined");
      assert.equal(joined.code, code);
      assert.ok(Array.isArray(joined.recentMessages));
      assert.equal(roomClients.get(code)?.size, 2);
    });

    it("returns ROOM_NOT_FOUND when joining a nonexistent room", async () => {
      const client = await getClient();
      const errPromise = waitForMessage(client, (m) => m.type === "error");
      client.send(JSON.stringify({ type: "joinRoom", code: "ZZZZZZ" }));
      const err = await errPromise;

      assert.equal(err.type, "error");
      assert.equal(err.code, "ROOM_NOT_FOUND");
    });

    it("returns INVALID_CODE_FORMAT when room code contains forbidden characters", async () => {
      const client = await getClient();
      const errPromise = waitForMessage(client, (m) => m.type === "error");
      client.send(JSON.stringify({ type: "joinRoom", code: "000000" }));
      const err = await errPromise;

      assert.equal(err.type, "error");
      assert.equal(err.code, "INVALID_CODE_FORMAT");
    });
  });

  describe("Room-Scoped Message Routing & Isolation", () => {
    it("broadcasts messages only to participants in the same room", async () => {
      const host1 = await getClient();
      const guest1 = await getClient();
      const host2 = await getClient();

      // Room 1 setup
      const r1Promise = waitForMessage(host1, (m) => m.type === "roomCreated");
      host1.send(JSON.stringify({ type: "createRoom" }));
      const r1 = await r1Promise;

      const g1JoinPromise = waitForMessage(guest1, (m) => m.type === "roomJoined");
      guest1.send(JSON.stringify({ type: "joinRoom", code: r1.code }));
      await g1JoinPromise;

      // Room 2 setup
      const r2Promise = waitForMessage(host2, (m) => m.type === "roomCreated");
      host2.send(JSON.stringify({ type: "createRoom" }));
      const r2 = await r2Promise;
      assert.notEqual(r1.code, r2.code);

      // Track any messages received by Host 2
      let host2ReceivedAnyChat = false;
      function checkHost2(raw: WebSocket.RawData) {
        try {
          const parsed = JSON.parse(raw.toString());
          if (parsed.type === "message") {
            host2ReceivedAnyChat = true;
          }
        } catch {}
      }
      host2.on("message", checkHost2);

      // Host 1 sends message in Room 1
      const guestMsgPromise = waitForMessage(
        guest1,
        (m) => m.type === "message" && m.message.text === "Hello Room 1"
      );
      host1.send(JSON.stringify({ type: "sendMessage", text: "Hello Room 1" }));

      const guestMsg = await guestMsgPromise;
      assert.equal(guestMsg.message.text, "Hello Room 1");
      assert.equal(guestMsg.message.roomCode, r1.code);

      await wait(100);
      host2.off("message", checkHost2);
      assert.equal(host2ReceivedAnyChat, false, "Cross-room isolation violated!");
    });
  });

  describe("Validation & Rate Limiting", () => {
    it("rejects empty messages", async () => {
      const client = await getClient();
      const createP = waitForMessage(client, (m) => m.type === "roomCreated");
      client.send(JSON.stringify({ type: "createRoom" }));
      await createP;

      const errP = waitForMessage(client, (m) => m.type === "error");
      client.send(JSON.stringify({ type: "sendMessage", text: "   " }));
      const err = await errP;

      assert.equal(err.type, "error");
      assert.equal(err.code, "EMPTY_MESSAGE");
    });

    it("rejects messages exceeding 500 characters", async () => {
      const client = await getClient();
      const createP = waitForMessage(client, (m) => m.type === "roomCreated");
      client.send(JSON.stringify({ type: "createRoom" }));
      await createP;

      const longText = "x".repeat(MAX_MESSAGE_LENGTH + 1);
      const errP = waitForMessage(client, (m) => m.type === "error");
      client.send(JSON.stringify({ type: "sendMessage", text: longText }));
      const err = await errP;

      assert.equal(err.type, "error");
      assert.equal(err.code, "MESSAGE_TOO_LONG");
    });

    it("rejects sendMessage when not in any room", async () => {
      const client = await getClient();
      const errP = waitForMessage(client, (m) => m.type === "error");
      client.send(JSON.stringify({ type: "sendMessage", text: "Lost" }));
      const err = await errP;

      assert.equal(err.type, "error");
      assert.equal(err.code, "NOT_IN_ROOM");
    });

    it("handles malformed JSON gracefully", async () => {
      const client = await getClient();
      const errP = waitForMessage(client, (m) => m.type === "error");
      client.send("{{{INVALID JSON");
      const err = await errP;

      assert.equal(err.type, "error");
      assert.equal(err.code, "INVALID_JSON");
    });

    it("enforces rate limiting on rapid messages", async () => {
      const client = await getClient();
      const createP = waitForMessage(client, (m) => m.type === "roomCreated");
      client.send(JSON.stringify({ type: "createRoom" }));
      await createP;

      let rateLimitHit = false;
      const rateLimitPromise = waitForMessage(
        client,
        (m) => m.type === "error" && m.code === "RATE_LIMITED"
      );

      // Send 7 rapid messages (limit is 5 in 2s)
      for (let i = 0; i < 7; i++) {
        client.send(JSON.stringify({ type: "sendMessage", text: `Rapid ${i}` }));
      }

      const res = await rateLimitPromise;
      assert.equal(res.code, "RATE_LIMITED");
    });

    it("enforces rate limiting on rapid join attempts to protect against brute force", async () => {
      const client = await getClient();
      const rateLimitPromise = waitForMessage(
        client,
        (m) => m.type === "error" && m.code === "RATE_LIMITED"
      );

      for (let i = 0; i < 7; i++) {
        client.send(JSON.stringify({ type: "joinRoom", code: `TEST0${i}` }));
      }

      const res = await rateLimitPromise;
      assert.equal(res.code, "RATE_LIMITED");
    });
  });

  describe("Room Expiry & Cleanup", () => {
    it("immediately rejects join on expired room", async () => {
      const client = await getClient();
      const createP = waitForMessage(client, (m) => m.type === "roomCreated");
      client.send(JSON.stringify({ type: "createRoom" }));
      const created = await createP;
      const code = created.code;

      // Force room to be expired
      const room = rooms.get(code)!;
      room.lastActivity = Date.now() - (ROOM_TTL_MS + 5000);

      const guest = await getClient();
      const errP = waitForMessage(guest, (m) => m.type === "error");
      guest.send(JSON.stringify({ type: "joinRoom", code }));
      const err = await errP;

      assert.equal(err.type, "error");
      assert.equal(err.code, "ROOM_EXPIRED");
      assert.equal(rooms.has(code), false, "Expired room must be purged immediately");
    });

    it("sweeps expired rooms from memory", () => {
      const code1 = "SWEEP1";
      const code2 = "SWEEP2";

      rooms.set(code1, {
        code: code1,
        createdAt: Date.now() - (ROOM_TTL_MS + 10000),
        lastActivity: Date.now() - (ROOM_TTL_MS + 10000),
        messages: [],
        maxMessages: 100,
      });

      rooms.set(code2, {
        code: code2,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        messages: [],
        maxMessages: 100,
      });

      const swept = sweepExpiredRooms();
      assert.equal(swept, 1);
      assert.equal(rooms.has(code1), false);
      assert.equal(rooms.has(code2), true);
    });

    it("handles leaveRoom command cleanly", async () => {
      const client = await getClient();
      const createP = waitForMessage(client, (m) => m.type === "roomCreated");
      client.send(JSON.stringify({ type: "createRoom" }));
      const created = await createP;

      const leaveP = waitForMessage(client, (m) => m.type === "leftRoom");
      client.send(JSON.stringify({ type: "leaveRoom" }));
      const resp = await leaveP;

      assert.equal(resp.type, "leftRoom");
      assert.equal(resp.code, created.code);
      assert.equal(roomClients.get(created.code)?.has(client), false);
    });

    it("generates valid SVG QR code via /api/qr endpoint", async () => {
      const testUrl = "http://localhost:3000/?room=ABCDEF";
      const res = await fetch(`http://localhost:${testPort}/api/qr?url=${encodeURIComponent(testUrl)}`);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get("content-type")?.includes("image/svg+xml"), true);
      const svg = await res.text();
      assert.ok(svg.includes("<svg"), "Response should contain SVG tag");
      assert.ok(svg.includes("#3D4852"), "Response should contain dark color token");
    });
  });
});
