import test from "node:test";
import assert from "node:assert/strict";

import {
  BOT,
  PLAYER,
  applyAction,
  createInitialState,
  getLegalMoves,
  isWallLegal,
  serializeState
} from "../src/game.js";
import { chooseBotAction } from "../src/bot.js";

test("initial state gives the bottom player three legal opening moves", () => {
  const state = createInitialState();

  assert.deepEqual(
    getLegalMoves(state, PLAYER).map((move) => `${move.r},${move.c}`).sort(),
    ["7,4", "8,3", "8,5"]
  );
});

test("a legal move advances the turn to the opponent", () => {
  const state = createInitialState();
  const result = applyAction(state, PLAYER, { type: "move", to: { r: 7, c: 4 } });

  assert.equal(result.ok, true);
  assert.equal(state.pawns[PLAYER].r, 7);
  assert.equal(state.currentTurn, BOT);
});

test("a wall cannot overlap or cross another wall", () => {
  const state = createInitialState();
  state.walls.h.add("4,4");

  assert.equal(isWallLegal(state, "h", 4, 4), false);
  assert.equal(isWallLegal(state, "v", 4, 4), false);
});

test("a legal wall spends one wall and advances the turn", () => {
  const state = createInitialState();
  const result = applyAction(state, PLAYER, { type: "wall", orientation: "h", r: 4, c: 4 });

  assert.equal(result.ok, true);
  assert.equal(state.pawns[PLAYER].walls, 9);
  assert.equal(state.walls.h.has("4,4"), true);
  assert.equal(state.currentTurn, BOT);
});

test("serialization round-trips sets into plain arrays", () => {
  const state = createInitialState();
  state.walls.v.add("3,4");

  const serialized = serializeState(state);

  assert.deepEqual(serialized.walls.v, ["3,4"]);
  assert.equal(serialized.pawns[PLAYER].walls, 10);
});

test("bot chooses a legal action from the initial state", () => {
  const state = createInitialState();
  state.currentTurn = BOT;
  const action = chooseBotAction(state, "normal");

  const result = applyAction(state, BOT, action);

  assert.equal(result.ok, true);
});
