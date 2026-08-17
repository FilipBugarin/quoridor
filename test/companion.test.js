import assert from "node:assert/strict";
import test from "node:test";

import { BOT_MESSAGE_CATALOG, nextLocalScore, selectBotMessage } from "../src/companion.js";

test("increments the local scoreboard for the winning side", () => {
  assert.deepEqual(nextLocalScore({ player: 2, bot: 4 }, "player"), { player: 3, bot: 4 });
  assert.deepEqual(nextLocalScore({ player: 2, bot: 4 }, "bot"), { player: 2, bot: 5 });
});

test("keeps malformed scoreboard values safe", () => {
  assert.deepEqual(nextLocalScore({ player: "oops", bot: -1 }, "player"), { player: 1, bot: 0 });
});

test("selects bot messages from the requested event catalog", () => {
  const message = selectBotMessage("wall", () => 0);

  assert.equal(message, BOT_MESSAGE_CATALOG.wall[0]);
});

test("falls back to move messages for unknown bot events", () => {
  const message = selectBotMessage("unknown", () => 0);

  assert.equal(message, BOT_MESSAGE_CATALOG.move[0]);
});
