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

test("records move and wall actions in newest-first history", () => {
  const state = createInitialState();

  applyAction(state, PLAYER, { type: "move", to: { r: 7, c: 4 } });
  applyAction(state, BOT, { type: "wall", orientation: "h", r: 4, c: 4 });

  assert.deepEqual(state.history.map((entry) => entry.type), ["wall", "move"]);
  assert.equal(state.history[0].actor, BOT);
  assert.equal(state.history[0].orientation, "h");
  assert.deepEqual(state.history[1].to, { r: 7, c: 4 });
});

test("records a win after a pawn reaches its goal row", () => {
  const state = createInitialState();
  state.pawns[PLAYER].r = 1;
  state.pawns[PLAYER].c = 3;

  applyAction(state, PLAYER, { type: "move", to: { r: 0, c: 3 } });

  assert.equal(state.winner, PLAYER);
  assert.equal(state.history[0].type, "win");
  assert.equal(state.history[0].actor, PLAYER);
});

test("serialization round-trips sets into plain arrays", () => {
  const state = createInitialState();
  state.walls.v.add("3,4");

  const serialized = serializeState(state);

  assert.deepEqual(serialized.walls.v, ["3,4"]);
  assert.equal(serialized.pawns[PLAYER].walls, 10);
  assert.deepEqual(serialized.history, []);
});

test("bot chooses a legal action from the initial state", () => {
  const state = createInitialState();
  state.currentTurn = BOT;
  const action = chooseBotAction(state, "normal");

  const result = applyAction(state, BOT, action);

  assert.equal(result.ok, true);
});
