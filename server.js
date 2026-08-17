import http from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";

import { BOT, PLAYER, applyAction, createInitialState, serializeState } from "./src/game.js";
import { generateShareQrSvg } from "./src/qr.js";

const SPECTATOR = "spectator";
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC_ROOT = __dirname;
const DEFAULT_CLEANUP_MS = 5 * 60 * 1000;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

export function createServer({ cleanupMs = DEFAULT_CLEANUP_MS } = {}) {
  const rooms = new Map();
  const httpServer = http.createServer((request, response) => {
    serveStatic(request, response).catch(() => {
      response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      response.end("Server error");
    });
  });

  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url, "http://localhost");
    if (url.pathname !== "/ws") {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  wss.on("connection", (ws) => {
    const client = { ws, roomCode: null, side: null };

    ws.on("message", (raw) => {
      let message;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        send(ws, { type: "error", message: "Invalid JSON." });
        return;
      }

      handleMessage(rooms, client, message, cleanupMs);
    });

    ws.on("close", () => {
      detachClient(rooms, client, cleanupMs);
    });
  });

  return {
    httpServer,
    rooms,
    close: () => new Promise((resolve) => {
      for (const room of rooms.values()) {
        for (const connection of Object.values(room.players)) connection?.ws.close();
        for (const connection of room.spectators) connection.ws.close();
      }
      wss.close(() => httpServer.close(resolve));
    })
  };
}

function handleMessage(rooms, client, message, cleanupMs) {
  if (message.type === "createRoom") {
    const room = createRoom(rooms);
    attachClient(room, client, PLAYER);
    sendRoomState(room, client);
    return;
  }

  if (message.type === "joinRoom") {
    const roomCode = String(message.roomCode || "").trim().toUpperCase();
    const room = rooms.get(roomCode);
    if (!room) {
      send(client.ws, { type: "error", code: "room-not-found", message: "Room not found." });
      return;
    }

    const side = chooseJoinSide(room) || SPECTATOR;
    attachClient(room, client, side);
    broadcastRoomState(room);
    return;
  }

  if (message.type === "action") {
    const room = getClientRoom(rooms, client);
    if (!room) return;
    if (client.side === SPECTATOR) {
      send(client.ws, { type: "error", code: "spectator-locked", message: "Spectators can watch, but cannot play." });
      return;
    }

    const result = applyAction(room.state, client.side, message.action);
    if (!result.ok) send(client.ws, { type: "error", code: "illegal-action", message: result.error });
    broadcastRoomState(room);
    return;
  }

  if (message.type === "restart") {
    const room = getClientRoom(rooms, client);
    if (!room) return;
    if (client.side === SPECTATOR) {
      send(client.ws, { type: "error", code: "spectator-locked", message: "Spectators can watch, but cannot restart." });
      return;
    }

    resetRoomState(room);
    broadcastRoomState(room);
    return;
  }

  if (message.type === "requestRematch") {
    const room = getClientRoom(rooms, client);
    if (!room) return;
    if (client.side === SPECTATOR) {
      send(client.ws, { type: "error", code: "spectator-locked", message: "Spectators can watch, but cannot request rematch." });
      return;
    }

    room.rematchReady[client.side] = true;
    if (room.rematchReady[PLAYER] && room.rematchReady[BOT]) resetRoomState(room);
    broadcastRoomState(room);
    return;
  }

  send(client.ws, { type: "error", code: "unknown-message", message: "Unknown message type." });
  cleanupRooms(rooms, cleanupMs);
}

function createRoom(rooms) {
  let code = "";
  do {
    code = Math.random().toString(36).slice(2, 6).toUpperCase();
  } while (rooms.has(code));

  const room = {
    code,
    state: createInitialState(),
    players: {
      [PLAYER]: null,
      [BOT]: null
    },
    spectators: new Set(),
    rematchReady: {
      [PLAYER]: false,
      [BOT]: false
    },
    disconnectedAt: null
  };
  rooms.set(code, room);
  return room;
}

function attachClient(room, client, side) {
  if (client.roomCode) detachClientFromRoom(room, client);

  client.roomCode = room.code;
  client.side = side;
  if (side === SPECTATOR) {
    room.spectators.add(client);
  } else {
    room.players[side]?.ws.close();
    room.players[side] = client;
  }
  room.disconnectedAt = null;
}

function detachClient(rooms, client, cleanupMs) {
  const room = getClientRoom(rooms, client, false);
  if (!room) return;

  detachClientFromRoom(room, client);
  room.disconnectedAt = Date.now();
  broadcastRoomState(room);
  cleanupRooms(rooms, cleanupMs);
}

function detachClientFromRoom(room, client) {
  if (client.side === SPECTATOR) room.spectators.delete(client);
  if (room.players[client.side] === client) room.players[client.side] = null;
  client.roomCode = null;
  client.side = null;
}

function chooseJoinSide(room) {
  if (!room.players[PLAYER]) return PLAYER;
  if (!room.players[BOT]) return BOT;
  return null;
}

function getClientRoom(rooms, client, notify = true) {
  const room = rooms.get(client.roomCode);
  if (!room && notify) {
    send(client.ws, { type: "error", code: "not-in-room", message: "You are not in a room." });
  }
  return room;
}

function broadcastRoomState(room) {
  for (const side of [PLAYER, BOT]) {
    const client = room.players[side];
    if (client && client.ws.readyState === client.ws.OPEN) sendRoomState(room, client);
  }
  for (const client of room.spectators) {
    if (client.ws.readyState === client.ws.OPEN) sendRoomState(room, client);
  }
}

function sendRoomState(room, client) {
  send(client.ws, {
    type: "roomState",
    roomCode: room.code,
    side: client.side,
    state: serializeState(room.state),
    presence: {
      [PLAYER]: Boolean(room.players[PLAYER]),
      [BOT]: Boolean(room.players[BOT])
    },
    spectators: room.spectators.size,
    rematchReady: { ...room.rematchReady }
  });
}

function resetRoomState(room) {
  room.state = createInitialState();
  room.rematchReady = {
    [PLAYER]: false,
    [BOT]: false
  };
}

function send(ws, payload) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
}

function cleanupRooms(rooms, cleanupMs) {
  const now = Date.now();
  for (const [code, room] of rooms) {
    const empty = !room.players[PLAYER] && !room.players[BOT] && room.spectators.size === 0;
    if (empty && room.disconnectedAt && now - room.disconnectedAt > cleanupMs) rooms.delete(code);
  }
}

async function serveStatic(request, response) {
  const url = new URL(request.url, "http://localhost");
  if (url.pathname === "/qr.svg") {
    await serveQrSvg(url, response);
    return;
  }

  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const normalized = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(PUBLIC_ROOT, normalized);

  if (!filePath.startsWith(PUBLIC_ROOT) || !existsSync(filePath)) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, { "content-type": MIME_TYPES[extname(filePath)] || "application/octet-stream" });
  createReadStream(filePath).pipe(response);
}

async function serveQrSvg(url, response) {
  const shareUrl = url.searchParams.get("url");
  if (!shareUrl) {
    response.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
    response.end("Missing QR URL.");
    return;
  }

  const svg = await generateShareQrSvg(shareUrl);
  response.writeHead(200, {
    "content-type": "image/svg+xml; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(svg);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  const app = createServer();
  app.httpServer.listen(port, () => {
    console.log(`Quoridor listening on http://localhost:${port}`);
  });
}
