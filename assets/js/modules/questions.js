/**
 * @typedef {{ id: string, label: string, shortLabel?: string, range?: { startYear: number, endYear: number }, color?: string, order?: number, summary?: string }} Period
 */

/**
 * @typedef {{ id: string, text: string }} McOption
 */

/**
 * @typedef {{ leftId: string, leftText: string, rightId: string, rightText: string }} MatchPair
 */

/**
 * @typedef {{ id: string, label: string }} SortItem
 */

/**
 * @typedef {{
 *   id: string,
 *   type: 'multiple_choice',
 *   periodId: string,
 *   difficulty?: string,
 *   tags?: string[],
 *   stem: string,
 *   options: McOption[],
 *   correctOptionId: string,
 *   explanation: string,
 *   media?: { url: string, alt?: string, caption?: string } | null,
 *   points?: number
 * }} QMultipleChoice
 */

/**
 * @typedef {{
 *   id: string,
 *   type: 'match_pairs',
 *   periodId: string,
 *   difficulty?: string,
 *   tags?: string[],
 *   stem: string,
 *   pairs: MatchPair[],
 *   explanation: string,
 *   media?: { url: string, alt?: string, caption?: string } | null,
 * }} QMatchPairs
 */

/**
 * @typedef {{
 *   id: string,
 *   type: 'timeline_sort',
 *   periodId: string,
 *   difficulty?: string,
 *   tags?: string[],
 *   stem: string,
 *   items: SortItem[],
 *   correctOrder: string[],
 *   explanation: string,
 *   media?: { url: string, alt?: string, caption?: string } | null,
 * }} QTimelineSort
 */

/**
 * @typedef {QMultipleChoice|QMatchPairs|QTimelineSort} Question
 */

/**
 * @typedef {{ version: number, locale?: string, title?: string, periods: Period[], questions: Question[] }} QuestionBank
 */

/**
 * @template T
 * @param {T[]} arr
 * @returns {T[]}
 */
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * @param {QuestionBank} bank
 * @param {string|null} periodId
 */
export function filterQuestionsByPeriod(bank, periodId) {
  if (!periodId) return bank.questions;
  return bank.questions.filter((q) => q.periodId === periodId);
}

/**
 * @param {Question} q
 */
export function defaultPointsForQuestion(q) {
  if ("points" in q && typeof q.points === "number") return q.points;
  const d = q.difficulty || "medium";
  if (d === "easy") return 8;
  if (d === "hard") return 15;
  return 10;
}

/**
 * @param {QMultipleChoice} q
 */
export function shuffleMultipleChoice(q) {
  return {
    question: q,
    optionOrder: shuffle(q.options.map((o) => o.id)),
  };
}

/**
 * @param {QMatchPairs} q
 */
export function shuffleMatchPairs(q) {
  const rights = shuffle(q.pairs.map((p) => p.rightId));
  return { question: q, rightOrder: rights };
}

/**
 * @param {QTimelineSort} q
 */
export function shuffleSortItems(q) {
  return { question: q, itemOrder: shuffle(q.items.map((i) => i.id)) };
}

/**
 * @param {QMultipleChoice} q
 * @param {string} selectedOptionId
 */
export function gradeMultipleChoice(q, selectedOptionId) {
  const ok = selectedOptionId === q.correctOptionId;
  return { correct: ok, score: ok ? defaultPointsForQuestion(q) : 0 };
}

/**
 * @param {QMatchPairs} q
 * @param {Record<string, string>} mapping leftId -> rightId placed in slot
 */
export function gradeMatchPairs(q, mapping) {
  let correct = 0;
  for (const p of q.pairs) {
    if (mapping[p.leftId] === p.rightId) correct += 1;
  }
  const total = q.pairs.length;
  const fraction = total ? correct / total : 0;
  const base = defaultPointsForQuestion({ ...q, type: "match_pairs" });
  const score = Math.round(base * fraction);
  return { correct: fraction === 1, score, detail: { correct, total } };
}

/**
 * @param {QTimelineSort} q
 * @param {string[]} orderIds top-to-bottom user order
 */
export function gradeTimelineSort(q, orderIds) {
  const ok =
    orderIds.length === q.correctOrder.length &&
    orderIds.every((id, i) => id === q.correctOrder[i]);
  return { correct: ok, score: ok ? defaultPointsForQuestion(q) : 0 };
}

/**
 * @param {QuestionBank} bank
 * @param {string} periodId
 */
export function countQuestionsInPeriod(bank, periodId) {
  return bank.questions.filter((q) => q.periodId === periodId).length;
}
