const TYPES = new Set(["multiple_choice", "match_pairs", "timeline_sort"]);

/**
 * @param {unknown} bank
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateBank(bank) {
  const errors = [];
  if (!bank || typeof bank !== "object") {
    return { ok: false, errors: ["Bank không hợp lệ"] };
  }
  if (!Array.isArray(bank.periods)) errors.push("Thiếu mảng periods");
  if (!Array.isArray(bank.questions)) errors.push("Thiếu mảng questions");
  if (errors.length) return { ok: false, errors };

  bank.periods.forEach((p, i) => {
    if (!p?.id) errors.push(`periods[${i}] thiếu id`);
  });
  bank.questions.forEach((q, i) => {
    const r = validateQuestion(q);
    if (!r.ok) errors.push(...r.errors.map((e) => `questions[${i}]: ${e}`));
  });
  return { ok: errors.length === 0, errors };
}

/**
 * @param {unknown} q
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateQuestion(q) {
  const errors = [];
  if (!q || typeof q !== "object") return { ok: false, errors: ["Câu hỏi không phải object"] };
  if (!q.id) errors.push("thiếu id");
  if (!TYPES.has(q.type)) errors.push(`type không hợp lệ: ${q.type}`);
  if (!q.periodId) errors.push("thiếu periodId");
  if (!q.stem) errors.push("thiếu stem");
  if (!q.explanation) errors.push("thiếu explanation");

  if (q.type === "multiple_choice") {
    if (!Array.isArray(q.options) || q.options.length < 2) errors.push("multiple_choice cần options");
    else q.options.forEach((o, i) => {
      if (!o?.id || !o?.text) errors.push(`options[${i}] thiếu id/text`);
    });
    if (!q.correctOptionId) errors.push("thiếu correctOptionId");
  }
  if (q.type === "match_pairs") {
    if (!Array.isArray(q.pairs) || q.pairs.length === 0) errors.push("match_pairs cần pairs");
    else {
      q.pairs.forEach((p, i) => {
        if (!p.leftId || !p.rightId || p.leftText == null || p.rightText == null) {
          errors.push(`pairs[${i}] thiếu trường`);
        }
      });
    }
  }
  if (q.type === "timeline_sort") {
    if (!Array.isArray(q.items) || q.items.length < 2) errors.push("timeline_sort cần items");
    if (!Array.isArray(q.correctOrder)) errors.push("thiếu correctOrder");
    else {
      const ids = new Set(q.items?.map((x) => x.id));
      q.correctOrder.forEach((id) => {
        if (!ids.has(id)) errors.push(`correctOrder chứa id không có trong items: ${id}`);
      });
    }
  }
  return { ok: errors.length === 0, errors };
}

export function normalizeBank(raw) {
  const bank = {
    version: Number(raw?.version) || 1,
    locale: raw?.locale || "vi-VN",
    title: raw?.title || "Ngân hàng",
    periods: Array.isArray(raw?.periods) ? raw.periods : [],
    questions: Array.isArray(raw?.questions) ? raw.questions : [],
  };
  return bank;
}
