/** @typedef {'practice'|'exam'} QuizMode */

export const STORAGE_KEYS = {
  BANK: "histlearn_bank_v1",
  ATTEMPTS: "histlearn_attempts_v1",
  PROFILE: "histlearn_profile_v1",
  STREAK: "histlearn_streak_v1",
  BADGES: "histlearn_badges_v1",
};

/** Giây cho mỗi câu trong chế độ thi thử (đồng hồ tổng). */
export const EXAM_SECONDS_PER_QUESTION = 45;

export const TITLE_LEVELS = [
  { key: "linh_moi", label: "Lính mới", minXp: 0 },
  { key: "hoc_gia", label: "Học giả", minXp: 80 },
  { key: "nha_tham_hiem", label: "Nhà thám hiểm", minXp: 220 },
  { key: "su_gia", label: "Sử gia", minXp: 450 },
];

export const BADGE_DEFS = {
  first_win: { id: "first_win", label: "Khởi đầu", desc: "Trả lời đúng lần đầu" },
  streak_3: { id: "streak_3", label: "Kiên trì", desc: "Chuỗi 3 ngày học" },
  streak_7: { id: "streak_7", label: "Bền bỉ", desc: "Chuỗi 7 ngày học" },
  exam_star: { id: "exam_star", label: "Sát hạch", desc: "Thi thử đạt ≥80%" },
  period_master: { id: "period_master", label: "Tinh thông", desc: "Hoàn thành ≥5 câu đúng trong một thời kỳ" },
};
