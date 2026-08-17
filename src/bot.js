import {
  BOT,
  PLAYER,
  SIZE,
  getLegalMoves,
  isWallLegal,
  key,
  pathLengthFrom,
  shortestPathFor
} from "./game.js";

export const BOT_DIFFICULTIES = {
  easy: {
    label: "Easy",
    help: "Easy bot makes more casual moves and rarely blocks.",
    thinkingMs: 180,
    randomMoveChance: 0.42,
    wallChance: 0.14,
    wallScoreThreshold: 2.2,
    playerPressure: 1.25,
    selfPenalty: 1.1,
    moveNoise: 1.2,
    wallNoise: 0.55,
    randomCandidates: 4
  },
  normal: {
    label: "Normal",
    help: "Normal bot balances racing and blocking.",
    thinkingMs: 260,
    randomMoveChance: 0.12,
    wallChance: 0.34,
    wallScoreThreshold: 1.2,
    playerPressure: 2,
    selfPenalty: 0.9,
    moveNoise: 0.18,
    wallNoise: 0.2,
    randomCandidates: 8
  },
  hard: {
    label: "Hard",
    help: "Hard bot races efficiently and looks harder for useful walls.",
    thinkingMs: 360,
    randomMoveChance: 0.02,
    wallChance: 0.58,
    wallScoreThreshold: 0.65,
    playerPressure: 2.75,
    selfPenalty: 0.75,
    moveNoise: 0.04,
    wallNoise: 0.06,
    randomCandidates: 12
  }
};

export function getBotProfile(difficulty = "normal") {
  return BOT_DIFFICULTIES[difficulty] || BOT_DIFFICULTIES.normal;
}

export function chooseBotAction(state, difficulty = "normal") {
  const profile = getBotProfile(difficulty);
  const wall = chooseBotWall(state, profile);
  if (wall) return wall;

  const legalMoves = getLegalMoves(state, BOT);
  if (!legalMoves.length) return { type: "move", to: { ...state.pawns[BOT] } };

  if (Math.random() < profile.randomMoveChance) {
    return { type: "move", to: legalMoves[Math.floor(Math.random() * legalMoves.length)] };
  }

  const scored = legalMoves.map((move) => ({
    move,
    score: scoreBotMove(state, move, profile)
  })).sort((a, b) => a.score - b.score);

  return { type: "move", to: scored[0].move };
}

function scoreBotMove(state, move, profile) {
  const botPath = pathLengthFrom(state, move, BOT);
  const playerPath = shortestPathFor(state, PLAYER).length;
  const centerBias = Math.abs(move.c - 4) * 0.04;
  const racePressure = playerPath <= botPath + 1 ? -0.18 : 0;
  return botPath + centerBias + racePressure + Math.random() * profile.moveNoise;
}

function chooseBotWall(state, profile) {
  if (state.pawns[BOT].walls <= 0) return null;
  if (Math.random() > profile.wallChance) return null;

  const playerDistance = shortestPathFor(state, PLAYER).length;
  const botDistance = shortestPathFor(state, BOT).length;
  if (playerDistance === 0 || botDistance === 0 || playerDistance > botDistance + 3) return null;

  const candidates = generateWallCandidatesNear(state.pawns[PLAYER], profile.randomCandidates);
  let best = null;

  for (const candidate of candidates) {
    if (!isWallLegal(state, candidate.orientation, candidate.r, candidate.c)) continue;

    state.walls[candidate.orientation].add(key(candidate.r, candidate.c));
    const newPlayerDistance = shortestPathFor(state, PLAYER).length;
    const newBotDistance = shortestPathFor(state, BOT).length;
    state.walls[candidate.orientation].delete(key(candidate.r, candidate.c));

    const score = (newPlayerDistance - playerDistance) * profile.playerPressure
      - (newBotDistance - botDistance) * profile.selfPenalty
      + Math.random() * profile.wallNoise;
    if (!best || score > best.score) best = { ...candidate, score };
  }

  if (!best || best.score < profile.wallScoreThreshold) return null;
  return { type: "wall", orientation: best.orientation, r: best.r, c: best.c };
}

function generateWallCandidatesNear(position, randomCandidates = 8) {
  const candidates = [];
  const rows = [position.r - 1, position.r, position.r + 1].map(clampWallIndex);
  const cols = [position.c - 1, position.c, position.c + 1].map(clampWallIndex);

  for (const r of rows) {
    for (const c of cols) {
      candidates.push({ orientation: "h", r, c });
      candidates.push({ orientation: "v", r, c });
    }
  }

  for (let i = 0; i < randomCandidates; i++) {
    candidates.push({
      orientation: Math.random() > 0.5 ? "h" : "v",
      r: Math.floor(Math.random() * (SIZE - 1)),
      c: Math.floor(Math.random() * (SIZE - 1))
    });
  }

  return shuffle(uniqueWallCandidates(candidates));
}

function clampWallIndex(value) {
  return Math.max(0, Math.min(SIZE - 2, value));
}

function uniqueWallCandidates(candidates) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    const value = `${candidate.orientation}:${candidate.r},${candidate.c}`;
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function shuffle(items) {
  return items
    .map((item) => ({ item, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ item }) => item);
}
