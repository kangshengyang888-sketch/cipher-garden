import { FEEDBACK, MAX_GUESSES } from './constants.js';

export function evaluateGuess(guess, target) {
  const n = guess.length;
  const feedback = Array(n).fill(FEEDBACK.ABSENT);
  const targetMatched = Array(n).fill(false);
  const guessMatched = Array(n).fill(false);

  for (let i = 0; i < n; i++) {
    if (
      guess[i].e === target[i].e &&
      guess[i].r === target[i].r &&
      guess[i].c === target[i].c
    ) {
      feedback[i] = FEEDBACK.EXACT;
      targetMatched[i] = true;
      guessMatched[i] = true;
    }
  }

  for (let i = 0; i < n; i++) {
    if (guessMatched[i]) continue;
    if (guess[i].e >= 0 && guess[i].e === target[i].e) {
      feedback[i] = FEEDBACK.PARTIAL;
      guessMatched[i] = true;
    }
  }

  const emojiPool = {};
  for (let i = 0; i < n; i++) {
    if (targetMatched[i]) continue;
    const e = target[i].e;
    if (e < 0) continue;
    emojiPool[e] = (emojiPool[e] || 0) + 1;
  }

  for (let i = 0; i < n; i++) {
    if (guessMatched[i]) continue;
    const e = guess[i].e;
    if (e < 0) continue;
    if (emojiPool[e] > 0) {
      feedback[i] = FEEDBACK.PRESENT;
      emojiPool[e]--;
      guessMatched[i] = true;
    }
  }

  return feedback;
}

export function isFullyCorrect(feedback) {
  return feedback.every((f) => f === FEEDBACK.EXACT);
}

export function countPlanted(cells) {
  return cells.filter((c) => c.e >= 0).length;
}

export function cloneGrid(cells) {
  return cells.map((c) => ({ ...c }));
}

export { MAX_GUESSES };
