import test from "node:test";
import assert from "node:assert/strict";
import WebSocket from "ws";

import { createServer } from "../server.js";

function waitForMessage(socket, type) {
  return new Promise((resolve) => {
    const onMessage = (raw) => {
      const message = JSON.parse(raw.toString());
      if (message.type === type) {
        socket.off("message", onMessage);
        resolve(message);
      }
    };
    socket.on("message", onMessage);
  });
}

test("creates a room, joins it, and broadcasts a move", async (t) => {
  const app = createServer({ cleanupMs: 10_000 });
  await new Promise((resolve) => app.httpServer.listen(0, "127.0.0.1", resolve));
  t.after(() => app.close());

  const { port } = app.httpServer.address();
  const url = `ws://127.0.0.1:${port}/ws`;
  const host = new WebSocket(url);
  const guest = new WebSocket(url);
  t.after(() => host.close());
  t.after(() => guest.close());

  await Promise.all([
    new Promise((resolve) => host.once("open", resolve)),
    new Promise((resolve) => guest.once("open", resolve))
  ]);

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
});
