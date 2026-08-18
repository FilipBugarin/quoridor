import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync("index.html", "utf8");

test("mobile layout keeps the board before the side panel", () => {
  const boardStageIndex = html.indexOf('<section class="board-stage"');
  const sidePanelIndex = html.indexOf('<aside class="side-panel"');

  assert.ok(boardStageIndex > -1, "board stage markup should exist");
  assert.ok(sidePanelIndex > -1, "side panel markup should exist");
  assert.ok(boardStageIndex < sidePanelIndex, "board stage should appear before side panel");
  assert.doesNotMatch(html, /\.side-panel\s*\{\s*order:\s*-1;/);
});

test("mobile layout has a compact HUD inside the board stage", () => {
  const boardStageIndex = html.indexOf('<section class="board-stage"');
  const mobileHudIndex = html.indexOf('<div class="mobile-hud"');
  const boardFrameIndex = html.indexOf('<div class="board-frame"');

  assert.ok(mobileHudIndex > -1, "mobile HUD markup should exist");
  assert.ok(mobileHudIndex > boardStageIndex, "mobile HUD should be inside the board stage");
  assert.ok(mobileHudIndex < boardFrameIndex, "mobile HUD should appear above the board");
  assert.match(html, /\.mobile-hud\s*\{[\s\S]*?display:\s*none;/);
  assert.match(html, /@media \(max-width:\s*930px\)[\s\S]*?\.mobile-hud\s*\{[\s\S]*?display:\s*grid;/);
});
