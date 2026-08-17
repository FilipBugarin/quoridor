export const SIZE = 9;
export const MAX_WALLS = 10;
export const MAX_HISTORY = 12;
export const PLAYER = "player";
export const BOT = "bot";

export function createInitialState() {
  return {
    currentTurn: PLAYER,
    gameOver: false,
    winner: null,
    lastAction: null,
    history: [],
    pawns: {
      [PLAYER]: { r: 8, c: 4, walls: MAX_WALLS },
      [BOT]: { r: 0, c: 4, walls: MAX_WALLS }
    },
    walls: {
      h: new Set(),
      v: new Set()
    }
  };
}

export function serializeState(state) {
  return {
    currentTurn: state.currentTurn,
    gameOver: state.gameOver,
    winner: state.winner,
    lastAction: state.lastAction ? structuredClone(state.lastAction) : null,
    history: state.history ? structuredClone(state.history) : [],
    pawns: {
      [PLAYER]: { ...state.pawns[PLAYER] },
      [BOT]: { ...state.pawns[BOT] }
    },
    walls: {
      h: [...state.walls.h].sort(),
      v: [...state.walls.v].sort()
    }
  };
}

export function hydrateState(raw) {
  return {
    currentTurn: raw.currentTurn,
    gameOver: raw.gameOver,
    winner: raw.winner,
    lastAction: raw.lastAction ? structuredClone(raw.lastAction) : null,
    history: raw.history ? structuredClone(raw.history) : [],
    pawns: {
      [PLAYER]: { ...raw.pawns[PLAYER] },
      [BOT]: { ...raw.pawns[BOT] }
    },
    walls: {
      h: new Set(raw.walls.h),
      v: new Set(raw.walls.v)
    }
  };
}

export function applyAction(state, actor, action) {
  if (state.gameOver) return { ok: false, error: "Game is over." };
  if (state.currentTurn !== actor) return { ok: false, error: "It is not your turn." };

  if (action?.type === "move") return applyMove(state, actor, action.to);
  if (action?.type === "wall") return applyWall(state, actor, action.orientation, action.r, action.c);
  return { ok: false, error: "Unknown action." };
}

export function applyMove(state, actor, to) {
  if (!to || !Number.isInteger(to.r) || !Number.isInteger(to.c)) {
    return { ok: false, error: "Invalid move target." };
  }

  const legal = getLegalMoves(state, actor).some((move) => move.r === to.r && move.c === to.c);
  if (!legal) return { ok: false, error: "Illegal move." };

  const from = { r: state.pawns[actor].r, c: state.pawns[actor].c };
  state.pawns[actor].r = to.r;
  state.pawns[actor].c = to.c;
  state.lastAction = { type: "move", actor, from, to: { r: to.r, c: to.c } };
  recordHistory(state, state.lastAction);
  finishIfWon(state);
  advanceTurn(state, actor);
  return { ok: true };
}

export function applyWall(state, actor, orientation, r, c) {
  if (state.pawns[actor].walls <= 0) return { ok: false, error: "No walls left." };
  if (!isWallLegal(state, orientation, r, c)) return { ok: false, error: "Illegal wall." };

  state.walls[orientation].add(key(r, c));
  state.pawns[actor].walls -= 1;
  state.lastAction = { type: "wall", actor, orientation, r, c };
  recordHistory(state, state.lastAction);
  advanceTurn(state, actor);
  return { ok: true };
}

function recordHistory(state, action) {
  state.history = [structuredClone(action), ...(state.history || [])].slice(0, MAX_HISTORY);
}

function recordWinHistory(state, actor) {
  if (state.history?.[0]?.type === "win" && state.history[0].actor === actor) return;
  recordHistory(state, { type: "win", actor });
}

function advanceTurn(state, actor) {
  if (state.gameOver) return;
  state.currentTurn = otherActor(actor);
}

export function finishIfWon(state) {
  if (state.pawns[PLAYER].r === goalRowFor(PLAYER)) {
    state.gameOver = true;
    state.winner = PLAYER;
    recordWinHistory(state, PLAYER);
    return true;
  }

  if (state.pawns[BOT].r === goalRowFor(BOT)) {
    state.gameOver = true;
    state.winner = BOT;
    recordWinHistory(state, BOT);
    return true;
  }

  return false;
}

export function getLegalMoves(state, actor) {
  const self = state.pawns[actor];
  const other = state.pawns[otherActor(actor)];
  const moves = [];
  const directions = [
    { dr: -1, dc: 0 },
    { dr: 1, dc: 0 },
    { dr: 0, dc: -1 },
    { dr: 0, dc: 1 }
  ];

  for (const dir of directions) {
    const adjacent = { r: self.r + dir.dr, c: self.c + dir.dc };
    if (!insideCell(adjacent.r, adjacent.c) || isBlocked(state, self, adjacent)) continue;

    if (adjacent.r === other.r && adjacent.c === other.c) {
      const behind = { r: adjacent.r + dir.dr, c: adjacent.c + dir.dc };
      if (insideCell(behind.r, behind.c) && !isBlocked(state, adjacent, behind)) {
        moves.push(behind);
      } else {
        const sideDirs = dir.dr !== 0
          ? [{ dr: 0, dc: -1 }, { dr: 0, dc: 1 }]
          : [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }];
        for (const sideDir of sideDirs) {
          const diagonal = { r: adjacent.r + sideDir.dr, c: adjacent.c + sideDir.dc };
          if (insideCell(diagonal.r, diagonal.c) && !isBlocked(state, adjacent, diagonal)) {
            moves.push(diagonal);
          }
        }
      }
    } else {
      moves.push(adjacent);
    }
  }

  return uniquePositions(moves);
}

export function isWallLegal(state, orientation, r, c) {
  if (orientation !== "h" && orientation !== "v") return false;
  if (!insideWallSlot(r, c)) return false;

  const wallKey = key(r, c);
  if (orientation === "h") {
    if (state.walls.h.has(wallKey)) return false;
    if (state.walls.h.has(key(r, c - 1)) || state.walls.h.has(key(r, c + 1))) return false;
    if (state.walls.v.has(wallKey)) return false;
  } else {
    if (state.walls.v.has(wallKey)) return false;
    if (state.walls.v.has(key(r - 1, c)) || state.walls.v.has(key(r + 1, c))) return false;
    if (state.walls.h.has(wallKey)) return false;
  }

  state.walls[orientation].add(wallKey);
  const keepsPaths = hasPathToGoal(state, PLAYER) && hasPathToGoal(state, BOT);
  state.walls[orientation].delete(wallKey);
  return keepsPaths;
}

export function shortestPathFor(state, actor) {
  return shortestPathFrom(state, state.pawns[actor], goalRowFor(actor));
}

export function pathLengthFrom(state, position, actor) {
  const path = shortestPathFrom(state, position, goalRowFor(actor));
  return path.length ? path.length - 1 : Infinity;
}

function hasPathToGoal(state, actor) {
  return shortestPathFor(state, actor).length > 0;
}

function shortestPathFrom(state, start, goalRow) {
  const queue = [{ r: start.r, c: start.c }];
  const cameFrom = new Map([[key(start.r, start.c), null]]);

  for (let index = 0; index < queue.length; index++) {
    const current = queue[index];
    if (current.r === goalRow) return reconstructPath(current, cameFrom);

    for (const next of neighborsIgnoringPawns(state, current)) {
      const nextKey = key(next.r, next.c);
      if (cameFrom.has(nextKey)) continue;
      cameFrom.set(nextKey, key(current.r, current.c));
      queue.push(next);
    }
  }

  return [];
}

function reconstructPath(end, cameFrom) {
  const path = [end];
  let cursor = cameFrom.get(key(end.r, end.c));
  while (cursor) {
    const position = parseKey(cursor);
    path.push(position);
    cursor = cameFrom.get(cursor);
  }
  return path.reverse();
}

function neighborsIgnoringPawns(state, position) {
  const neighbors = [];
  const directions = [
    { dr: -1, dc: 0 },
    { dr: 1, dc: 0 },
    { dr: 0, dc: -1 },
    { dr: 0, dc: 1 }
  ];

  for (const dir of directions) {
    const next = { r: position.r + dir.dr, c: position.c + dir.dc };
    if (insideCell(next.r, next.c) && !isBlocked(state, position, next)) neighbors.push(next);
  }

  return neighbors;
}

export function isBlocked(state, a, b) {
  if (!insideCell(a.r, a.c) || !insideCell(b.r, b.c)) return true;

  if (a.r === b.r) {
    const row = a.r;
    const leftCol = Math.min(a.c, b.c);
    return state.walls.v.has(key(row, leftCol)) || state.walls.v.has(key(row - 1, leftCol));
  }

  if (a.c === b.c) {
    const topRow = Math.min(a.r, b.r);
    const col = a.c;
    return state.walls.h.has(key(topRow, col)) || state.walls.h.has(key(topRow, col - 1));
  }

  return true;
}

export function key(r, c) {
  return `${r},${c}`;
}

export function parseKey(value) {
  const [r, c] = value.split(",").map(Number);
  return { r, c };
}

export function goalRowFor(actor) {
  return actor === PLAYER ? 0 : SIZE - 1;
}

function otherActor(actor) {
  return actor === PLAYER ? BOT : PLAYER;
}

function uniquePositions(positions) {
  const seen = new Set();
  return positions.filter((position) => {
    const value = key(position.r, position.c);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function insideCell(r, c) {
  return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
}

function insideWallSlot(r, c) {
  return r >= 0 && r < SIZE - 1 && c >= 0 && c < SIZE - 1;
}
