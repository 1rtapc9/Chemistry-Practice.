// adaptive.js
// Exports functions for difficulty management and normalization

export function normalizeAnswer(s) {
  if (s == null) return '';
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:()]/g, '') // remove common punctuation
    ;
}

/**
 * decideNextState({currentGrade, currentStreak, wasCorrect})
 * - increases grade by 1 (max 12) after 2 correct in a row (streak threshold configurable here)
 * - decreases grade by 1 (min 6) after a wrong answer, and resets streak
 */
export function decideNextState({ currentGrade, currentStreak, wasCorrect, upThreshold = 2, minGrade=6, maxGrade=12 }) {
  let nextGrade = currentGrade;
  let nextStreak = currentStreak;
  if (wasCorrect) {
    nextStreak = currentStreak + 1;
    if (nextStreak >= upThreshold && currentGrade < maxGrade) {
      nextGrade = currentGrade + 1;
      nextStreak = 0;
    }
  } else {
    nextStreak = 0;
    if (currentGrade > minGrade) nextGrade = currentGrade - 1;
  }
  return { nextGrade, nextStreak };
}
