# Share-Link Multiplayer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build hosted share-link Quoridor multiplayer with a Node.js WebSocket room server while preserving local bot play.

**Architecture:** Extract Quoridor rules into a pure shared module used by both browser and server. Serve `index.html` from a small Node HTTP server and use WebSockets for room creation, joining, server-authoritative actions, presence, restart, and state broadcasts.

**Tech Stack:** Plain HTML/CSS/JavaScript, Node.js, `ws`, Node's built-in test runner.

---

## File Structure

- Create `package.json`: npm metadata, start script, test script, dependencies.
- Create `server.js`: HTTP static server and WebSocket room manager.
- Create `src/game.js`: shared game state, legal moves, wall validation, action application, serialization.
- Create `src/bot.js`: bot decision logic extracted from current browser script.
- Modify `index.html`: mode switch, online room UI, WebSocket client, rendering against shared state.
- Create `test/game.test.js`: pure rules tests.
- Create `test/server.test.js`: WebSocket room smoke tests.

## Tasks

### Task 1: Package and Test Harness

- [ ] Create `package.json` with `start`, `dev`, and `test` scripts.
- [ ] Add dependencies: `ws`.
- [ ] Add Node test files that initially fail because `src/game.js` and `server.js` exports do not exist.
- [ ] Run `npm test` and confirm failures are missing-module failures.
- [ ] Commit package/test harness.

### Task 2: Shared Game Rules

- [ ] Create `src/game.js` with constants `SIZE`, `MAX_WALLS`, `PLAYER`, `BOT`.
- [ ] Implement `createInitialState`, `serializeState`, `hydrateState`, `getLegalMoves`, `isWallLegal`, `applyMove`, `applyWall`, `applyAction`, and `finishIfWon`.
- [ ] Preserve existing movement behavior: one-cell moves, straight jumps, diagonal jumps when blocked behind, wall collision checks, path-preserving wall legality.
- [ ] Run `npm test -- test/game.test.js` and confirm rule tests pass.
- [ ] Commit shared game rules.

### Task 3: Bot Extraction

- [ ] Create `src/bot.js` with existing difficulty profiles and `chooseBotAction`.
- [ ] Use the pure game helpers for pathfinding, legal moves, and wall scoring.
- [ ] Keep bot behavior local-only; the server will not run bot turns in online rooms.
- [ ] Add a small test or covered assertion that bot returns a legal action from the initial state.
- [ ] Commit bot extraction.

### Task 4: WebSocket Room Server

- [ ] Create `server.js` that serves static files and opens `WS /ws`.
- [ ] Implement messages: `createRoom`, `joinRoom`, `action`, `restart`.
- [ ] Broadcast canonical room state with player side, room code, turn, presence, and game-over fields.
- [ ] Reject full rooms, unknown rooms, illegal actions, and actions from the wrong side.
- [ ] Add in-memory room cleanup after stale disconnects.
- [ ] Run `npm test -- test/server.test.js` and confirm room tests pass.
- [ ] Commit room server.

### Task 5: Browser Multiplayer UI

- [ ] Modify `index.html` to load shared rules and bot code.
- [ ] Add `Vs Bot` / `Online` mode control.
- [ ] In online mode, show create/join/copy-link controls and room status.
- [ ] Enable input only for the local side's turn.
- [ ] Send online moves and walls to the server; render only server-broadcast canonical state.
- [ ] Preserve existing bot mode behavior and visual styling.
- [ ] Commit browser online UI.

### Task 6: Local Verification

- [ ] Run `npm test`.
- [ ] Start `npm start`.
- [ ] Open two browser sessions to the local room link.
- [ ] Verify create room, join room, move broadcast, wall broadcast, wrong-turn lock, restart, disconnect status, and bot mode.
- [ ] Fix defects discovered in manual testing.
- [ ] Commit fixes.

### Task 7: GitHub and Render Deployment Prep

- [ ] Add remote `origin` as `https://github.com/FilipBugarin/quoridor.git` if missing.
- [ ] Commit all implementation files.
- [ ] Push `main` to GitHub.
- [ ] Deploy on Render as a Node Web Service with build command `npm install` and start command `npm start`.
- [ ] Verify the Render URL creates and joins a room with a share link.

## Self-Review

- Spec coverage: create/join links, two-player sync, bot preservation, WebSocket hosting, server-authoritative validation, reconnect status, restart, tests, and Render deploy prep are covered.
- Placeholder scan: no TBD/TODO placeholders remain.
- Type consistency: room messages use `createRoom`, `joinRoom`, `action`, and `restart`; game actions use `move` and `wall`.
