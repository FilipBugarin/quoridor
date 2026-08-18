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
