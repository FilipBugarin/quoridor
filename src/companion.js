export const BOT_MESSAGE_CATALOG = {
  thinking: [
    "Reading your maze.",
    "Checking the shortest escape.",
    "Looking for a clean block."
  ],
  move: [
    "I found a lane.",
    "Keeping the race alive.",
    "Small step, big pressure."
  ],
  wall: [
    "That shortcut looked too comfortable.",
    "A little detour never hurt.",
    "Let's make the board interesting."
  ],
  win: [
    "Clean finish.",
    "Path found.",
    "That race was mine."
  ],
  lose: [
    "Good route.",
    "You broke through.",
    "I should have saved a wall."
  ]
};

export function nextLocalScore(currentScore = {}, winner) {
  const score = {
    player: safeScoreValue(currentScore.player),
    bot: safeScoreValue(currentScore.bot)
  };

  if (winner === "player" || winner === "bot") score[winner] += 1;
  return score;
}

export function selectBotMessage(event, random = Math.random) {
  const messages = BOT_MESSAGE_CATALOG[event] || BOT_MESSAGE_CATALOG.move;
  const index = Math.floor(clampRandom(random()) * messages.length);
  return messages[index];
}

function safeScoreValue(value) {
  return Number.isInteger(value) && value > 0 ? value : 0;
}

function clampRandom(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(0.999999, value));
}
