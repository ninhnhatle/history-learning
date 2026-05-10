import { STORAGE_KEYS } from "../config.js";
import { normalizeBank, validateBank } from "../data/schema.js";

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/**
 * @returns {import('./questions.js').QuestionBank|null}
 */
export function loadBank() {
  const raw = readJson(STORAGE_KEYS.BANK, null);
  if (!raw) return null;
  return normalizeBank(raw);
}

/**
 * @param {import('./questions.js').QuestionBank} bank
 */
export function saveBank(bank) {
  const v = validateBank(bank);
  if (!v.ok) throw new Error(v.errors.join("; "));
  writeJson(STORAGE_KEYS.BANK, bank);
}

/**
 * @param {import('./questions.js').QuestionBank} incoming
 * @param {'merge'|'replace'} mode
 */
export function mergeOrReplaceBank(incoming, mode) {
  const cur = loadBank();
  if (mode === "replace" || !cur) {
    saveBank(normalizeBank(incoming));
    return loadBank();
  }
  const periodMap = new Map(cur.periods.map((p) => [p.id, p]));
  for (const p of incoming.periods || []) periodMap.set(p.id, p);
  const qMap = new Map(cur.questions.map((q) => [q.id, q]));
  for (const q of incoming.questions || []) qMap.set(q.id, q);
  const next = {
    ...cur,
    version: Math.max(cur.version || 1, incoming.version || 1),
    periods: [...periodMap.values()].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    questions: [...qMap.values()],
  };
  saveBank(next);
  return loadBank();
}

export function loadAttempts() {
  return readJson(STORAGE_KEYS.ATTEMPTS, []);
}

/**
 * @param {object} attempt
 */
export function appendAttempt(attempt) {
  const list = loadAttempts();
  list.push({ ...attempt, savedAt: Date.now() });
  const trimmed = list.slice(-80);
  writeJson(STORAGE_KEYS.ATTEMPTS, trimmed);
}

export function loadProfile() {
  return readJson(STORAGE_KEYS.PROFILE, { xp: 0, titleKey: "linh_moi" });
}

/**
 * @param {object} profile
 */
export function saveProfile(profile) {
  writeJson(STORAGE_KEYS.PROFILE, profile);
}

export function loadStreak() {
  return readJson(STORAGE_KEYS.STREAK, {
    lastActiveDay: null,
    current: 0,
    longest: 0,
  });
}

/**
 * @param {object} s
 */
export function saveStreak(s) {
  writeJson(STORAGE_KEYS.STREAK, s);
}

export function loadBadges() {
  return readJson(STORAGE_KEYS.BADGES, []);
}

/**
 * @param {{ id: string, at: number }[]} badges
 */
export function saveBadges(badges) {
  writeJson(STORAGE_KEYS.BADGES, badges);
}
