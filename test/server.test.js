import test from "node:test";
import assert from "node:assert/strict";
import WebSocket from "ws";

import { createServer } from "../server.js";

function waitForMessage(socket, type) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off("message", onMessage);
      reject(new Error(`Timed out waiting for ${type}`));
    }, 1000);
    const onMessage = (raw) => {
      const message = JSON.parse(raw.toString());
      if (message.type === type) {
        clearTimeout(timeout);
        socket.off("message", onMessage);
        resolve(message);
      }
    };
    socket.on("message", onMessage);
  });
}

async function openSocket(url, t) {
  const socket = new WebSocket(url);
  await new Promise((resolve) => socket.once("open", resolve));
  return socket;
}

test("creates a room, joins it, and broadcasts a move", async () => {
  const app = createServer({ cleanupMs: 10_000 });
  await new Promise((resolve) => app.httpServer.listen(0, "127.0.0.1", resolve));

  const { port } = app.httpServer.address();
  const url = `ws://127.0.0.1:${port}/ws`;
  const host = await openSocket(url);
  const guest = await openSocket(url);

  try {
    host.send(JSON.stringify({ type: "createRoom" }));
    const created = await waitForMessage(host, "roomState");
    assert.equal(created.side, "player");

    guest.send(JSON.stringify({ type: "joinRoom", roomCode: created.roomCode }));
    const joined = await waitForMessage(guest, "roomState");
    assert.equal(joined.side, "bot");

    const hostUpdate = waitForMessage(host, "roomState");
    host.send(JSON.stringify({ type: "action", action: { type: "move", to: { r: 7, c: 4 } } }));
    const updated = await hostUpdate;

    assert.equal(updated.state.pawns.player.r, 7);
    assert.equal(updated.state.currentTurn, "bot");
  } finally {
    host.close();
    guest.close();
    await app.close();
  }
});

test("joins a full room as a spectator and receives broadcasts", async () => {
  const app = createServer({ cleanupMs: 10_000 });
  await new Promise((resolve) => app.httpServer.listen(0, "127.0.0.1", resolve));

  const { port } = app.httpServer.address();
  const url = `ws://127.0.0.1:${port}/ws`;
  const host = await openSocket(url);
  const guest = await openSocket(url);
  const third = await openSocket(url);

  try {
    host.send(JSON.stringify({ type: "createRoom" }));
    const created = await waitForMessage(host, "roomState");

    guest.send(JSON.stringify({ type: "joinRoom", roomCode: created.roomCode }));
    await waitForMessage(guest, "roomState");

    third.send(JSON.stringify({ type: "joinRoom", roomCode: created.roomCode }));
    const spectator = await waitForMessage(third, "roomState");
    assert.equal(spectator.side, "spectator");
    assert.equal(spectator.spectators, 1);

    const spectatorUpdate = waitForMessage(third, "roomState");
    host.send(JSON.stringify({ type: "action", action: { type: "move", to: { r: 7, c: 4 } } }));
    const updated = await spectatorUpdate;
    assert.equal(updated.state.pawns.player.r, 7);
    assert.equal(updated.state.currentTurn, "bot");
  } finally {
    host.close();
    guest.close();
    third.close();
    await app.close();
  }
});

test("restarts an online game only after both players request rematch", async () => {
  const app = createServer({ cleanupMs: 10_000 });
  await new Promise((resolve) => app.httpServer.listen(0, "127.0.0.1", resolve));

  const { port } = app.httpServer.address();
  const url = `ws://127.0.0.1:${port}/ws`;
  const host = await openSocket(url);
  const guest = await openSocket(url);

  try {
    host.send(JSON.stringify({ type: "createRoom" }));
    const created = await waitForMessage(host, "roomState");

    guest.send(JSON.stringify({ type: "joinRoom", roomCode: created.roomCode }));
    await waitForMessage(guest, "roomState");

    host.send(JSON.stringify({ type: "action", action: { type: "move", to: { r: 7, c: 4 } } }));
    await waitForMessage(host, "roomState");

    guest.send(JSON.stringify({ type: "requestRematch" }));
    const oneReady = await waitForMessage(host, "roomState");
    assert.equal(oneReady.state.pawns.player.r, 7);
    assert.equal(oneReady.rematchReady.bot, true);
    assert.equal(oneReady.rematchReady.player, false);

    host.send(JSON.stringify({ type: "requestRematch" }));
    const restarted = await waitForMessage(host, "roomState");
    assert.equal(restarted.state.pawns.player.r, 8);
    assert.equal(restarted.state.currentTurn, "player");
    assert.equal(restarted.rematchReady.player, false);
    assert.equal(restarted.rematchReady.bot, false);
  } finally {
    host.close();
    guest.close();
    await app.close();
  }
});
