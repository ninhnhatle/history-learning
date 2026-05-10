import { BADGE_DEFS, TITLE_LEVELS } from "../config.js";
import { loadBadges, loadProfile, loadStreak, saveBadges, saveProfile, saveStreak } from "./storage.js";

/**
 * @param {number} xp
 */
export function titleForXp(xp) {
  let cur = TITLE_LEVELS[0];
  for (const t of TITLE_LEVELS) {
    if (xp >= t.minXp) cur = t;
  }
  return cur;
}

/**
 * @param {number} delta
 */
export function addXp(delta) {
  const p = loadProfile();
  const xp = Math.max(0, (p.xp || 0) + delta);
  const title = titleForXp(xp);
  saveProfile({ xp, titleKey: title.key });
  return { xp, title };
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function previousDayKey(dayKey) {
  const [y, m, d] = dayKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d - 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/**
 * Gọi khi người dùng hoàn thành một phiên có hoạt động (trả lời ít nhất 1 câu).
 */
export function recordActivityDay() {
  const t = todayKey();
  const s = loadStreak();
  if (s.lastActiveDay === t) {
    saveStreak(s);
    return s;
  }
  let next = s.current || 0;
  if (s.lastActiveDay == null) next = 1;
  else if (s.lastActiveDay === previousDayKey(t)) next = (s.current || 0) + 1;
  else next = 1;
  const longest = Math.max(s.longest || 0, next);
  const out = { lastActiveDay: t, current: next, longest };
  saveStreak(out);
  return out;
}

/**
 * @param {object} ctx
 * @param {{ correctCount: number, total: number, mode: string, periodId: string|null }} ctx
 */
export function evaluateBadges(ctx) {
  const existing = new Set(loadBadges().map((b) => b.id));
  const next = [...loadBadges()];
  const push = (id) => {
    if (existing.has(id)) return;
    existing.add(id);
    next.push({ id, at: Date.now() });
  };

  if (ctx.correctCount >= 1) push(BADGE_DEFS.first_win.id);

  const streak = loadStreak();
  if (streak.current >= 3) push(BADGE_DEFS.streak_3.id);
  if (streak.current >= 7) push(BADGE_DEFS.streak_7.id);

  if (ctx.mode === "exam" && ctx.total > 0 && ctx.correctCount / ctx.total >= 0.8) {
    push(BADGE_DEFS.exam_star.id);
  }

  if (ctx.periodId && ctx.correctCount >= 5) push(BADGE_DEFS.period_master.id);

  saveBadges(next);
  return next;
}
