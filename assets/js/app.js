import { buildAiPromptTemplate } from "./ui/aiPromptHelper.js";
import { findPeriod, renderTimeline } from "./ui/timelineView.js";
import { runQuiz } from "./ui/quizView.js";
import { normalizeBank, validateBank } from "./data/schema.js";
import { SAMPLE_BANK } from "./data/sampleBank.js";
import { loadBadges, loadBank, loadProfile, loadStreak, mergeOrReplaceBank, saveBank } from "./modules/storage.js";
import { titleForXp } from "./modules/gamification.js";
import { BADGE_DEFS, TITLE_LEVELS } from "./config.js";
import { countQuestionsInPeriod, filterQuestionsByPeriod } from "./modules/questions.js";

/** @type {import('./modules/questions.js').QuestionBank | null} */
let liveBank = null;

/** @type {string|null} */
let selectedPeriodId = null;

/** @type {(() => void) | null} */
let quizCleanup = null;

function ensureBank() {
  if (!liveBank) {
    const stored = loadBank();
    liveBank = stored || normalizeBank(SAMPLE_BANK);
    if (!stored) {
      saveBank(liveBank);
    }
  }
  return liveBank;
}

function toast(msg) {
  const root = document.getElementById("toast-root");
  if (!root) return;
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function updateHeaderStats() {
  const el = document.getElementById("header-stats");
  if (!el) return;
  const p = loadProfile();
  const t = titleForXp(p.xp || 0);
  const s = loadStreak();
  el.textContent = `XP ${p.xp ?? 0} · ${t.label} · Chuỗi ${s.current ?? 0} ngày`;
}

function updateHeroBadge() {
  const el = document.getElementById("hero-badge-preview");
  if (!el) return;
  const badges = loadBadges();
  if (badges.length === 0) {
    el.textContent = "Hoàn thành bài để mở huy chương đầu tiên.";
    return;
  }
  const last = badges[badges.length - 1];
  const def = Object.values(BADGE_DEFS).find((b) => b.id === last.id);
  el.innerHTML = `<strong>${def?.label ?? "Huy chương"}</strong><br/><span style="font-size:0.8rem">${def?.desc ?? ""}</span>`;
}

function refreshBankCount() {
  const b = ensureBank();
  const c = document.getElementById("bank-question-count");
  if (c) c.textContent = `${b.questions.length} câu · ${b.periods.length} thời kỳ`;
}

function refreshTimeline() {
  const root = document.getElementById("timeline-root");
  if (!root) return;
  renderTimeline(root, ensureBank(), selectedPeriodId, (id) => {
    selectedPeriodId = id;
    renderPeriodPanel();
    refreshTimeline();
  });
}

function renderPeriodPanel() {
  const panel = document.getElementById("period-panel");
  const title = document.getElementById("period-panel-title");
  const summary = document.getElementById("period-panel-summary");
  const count = document.getElementById("period-panel-count");
  if (!panel || !title || !summary || !count) return;

  if (!selectedPeriodId) {
    panel.hidden = true;
    return;
  }

  const bank = ensureBank();
  const p = findPeriod(bank, selectedPeriodId);
  if (!p) {
    panel.hidden = true;
    return;
  }

  panel.hidden = false;
  title.textContent = p.label;
  summary.textContent = p.summary || "";
  const n = countQuestionsInPeriod(bank, selectedPeriodId);
  count.textContent = `${n} câu hỏi gắn thời kỳ này.`;
}

function showView(name) {
  const home = document.getElementById("view-home");
  const quiz = document.getElementById("view-quiz");
  const bank = document.getElementById("view-bank");
  [home, quiz, bank].forEach((v) => {
    if (v) v.hidden = true;
  });
  const nav = document.querySelectorAll(".site-nav__link");
  nav.forEach((b) => b.classList.remove("is-active"));
  if (name === "home" && home) {
    home.hidden = false;
    document.querySelector('[data-nav="home"]')?.classList.add("is-active");
  }
  if (name === "bank" && bank) {
    bank.hidden = false;
    document.querySelector('[data-nav="bank"]')?.classList.add("is-active");
  }
  if (name === "quiz" && quiz) {
    quiz.hidden = false;
  }
}

function openQuiz(mode, periodId) {
  const bank = ensureBank();
  const subset = filterQuestionsByPeriod(bank, periodId);
  if (subset.length === 0) {
    toast("Không có câu hỏi trong lựa chọn này.");
    return;
  }

  const mount = document.getElementById("quiz-root");
  if (!mount) return;

  quizCleanup?.();
  quizCleanup = null;

  showView("quiz");
  mount.innerHTML = "";

  quizCleanup =
    runQuiz({
      bank,
      mode,
      periodId,
      mount,
      onExit: () => {
        quizCleanup?.();
        quizCleanup = null;
        showView("home");
        updateHeaderStats();
        updateHeroBadge();
        refreshBankCount();
        refreshTimeline();
      },
      onFinish: () => {
        updateHeaderStats();
        updateHeroBadge();
      },
    }) ?? null;
}

function setupNav() {
  document.querySelectorAll(".site-nav__link").forEach((btn) => {
    btn.addEventListener("click", () => {
      const dest = btn.getAttribute("data-nav");
      if (dest === "home") showView("home");
      if (dest === "bank") {
        showView("bank");
        refreshBankCount();
      }
    });
  });
}

function setupPeriodActions() {
  document.getElementById("btn-practice")?.addEventListener("click", () => {
    if (selectedPeriodId) openQuiz("practice", selectedPeriodId);
  });
  document.getElementById("btn-exam")?.addEventListener("click", () => {
    if (selectedPeriodId) openQuiz("exam", selectedPeriodId);
  });
  document.getElementById("btn-clear-period")?.addEventListener("click", () => {
    selectedPeriodId = null;
    renderPeriodPanel();
    refreshTimeline();
  });

  document.getElementById("btn-all-practice")?.addEventListener("click", () => openQuiz("practice", null));
  document.getElementById("btn-all-exam")?.addEventListener("click", () => openQuiz("exam", null));
}

function setupQuizChrome() {
  document.getElementById("quiz-exit")?.addEventListener("click", () => {
    if (!confirm("Thoát phiên làm bài? Tiến trình phiên này sẽ mất.")) return;
    quizCleanup?.();
    quizCleanup = null;
    const mount = document.getElementById("quiz-root");
    if (mount) mount.innerHTML = "";
    showView("home");
    updateHeaderStats();
  });
}

function setupBankUi() {
  const tabs = document.querySelectorAll(".bank-tab");
  const panels = {
    manual: document.getElementById("bank-panel-manual"),
    import: document.getElementById("bank-panel-import"),
    ai: document.getElementById("bank-panel-ai"),
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const key = tab.getAttribute("data-bank-tab");
      tabs.forEach((t) => t.classList.remove("is-active"));
      tab.classList.add("is-active");
      Object.entries(panels).forEach(([k, el]) => {
        if (el) el.hidden = k !== key;
      });
    });
  });

  const promptTa = document.getElementById("ai-prompt-template");
  if (promptTa) promptTa.value = buildAiPromptTemplate();

  document.getElementById("btn-copy-prompt")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(buildAiPromptTemplate());
      toast("Đã sao chép prompt.");
    } catch {
      toast("Không thể sao chép — hãy chọn và copy thủ công.");
    }
  });

  document.getElementById("btn-merge-import")?.addEventListener("click", () => {
    const raw = document.getElementById("import-json")?.value || "";
    try {
      const parsed = JSON.parse(raw);
      const norm = normalizeBank(parsed);
      const v = validateBank(norm);
      if (!v.ok) {
        toast(v.errors.join(" "));
        return;
      }
      liveBank = mergeOrReplaceBank(norm, "merge");
      refreshBankCount();
      refreshTimeline();
      toast("Đã gộp JSON vào ngân hàng.");
    } catch (e) {
      toast("JSON không hợp lệ.");
    }
  });

  document.getElementById("btn-replace-import")?.addEventListener("click", () => {
    const raw = document.getElementById("import-json")?.value || "";
    try {
      const parsed = JSON.parse(raw);
      const norm = normalizeBank(parsed);
      const v = validateBank(norm);
      if (!v.ok) {
        toast(v.errors.join(" "));
        return;
      }
      liveBank = mergeOrReplaceBank(norm, "replace");
      refreshBankCount();
      refreshTimeline();
      toast("Đã thay thế ngân hàng.");
    } catch {
      toast("JSON không hợp lệ.");
    }
  });

  document.getElementById("btn-export-bank")?.addEventListener("click", () => {
    const b = ensureBank();
    const blob = new Blob([JSON.stringify(b, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "question-bank.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  document.getElementById("btn-reset-bank")?.addEventListener("click", () => {
    if (!confirm("Khôi phục ngân hàng mẫu? Câu bạn thêm sẽ mất nếu chưa xuất file.")) return;
    liveBank = normalizeBank(SAMPLE_BANK);
    saveBank(liveBank);
    refreshBankCount();
    refreshTimeline();
    toast("Đã khôi phục mẫu.");
  });

  document.getElementById("form-add-mc")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const form = /** @type {HTMLFormElement} */ (e.target);
    const fd = new FormData(form);
    const periodId = String(fd.get("periodId") || "").trim();
    const stem = String(fd.get("stem") || "").trim();
    const difficulty = String(fd.get("difficulty") || "medium");
    const correct = String(fd.get("correct") || "a");
    const explanation = String(fd.get("explanation") || "").trim();
    const mediaUrl = String(fd.get("mediaUrl") || "").trim();

    const letters = ["a", "b", "c", "d"];
    const options = letters.map((L) => ({
      id: `opt-${L}`,
      text: String(fd.get(L) || "").trim(),
    }));

    if (options.some((o) => !o.text)) {
      toast("Điền đủ 4 lựa chọn.");
      return;
    }

    const correctOptionId = `opt-${correct}`;
    const q = {
      id: `mc-user-${Date.now()}`,
      type: "multiple_choice",
      periodId,
      difficulty,
      tags: [],
      stem,
      options,
      correctOptionId,
      explanation,
      media: mediaUrl ? { url: mediaUrl, alt: "", caption: "" } : null,
      points: 10,
    };

    const bank = ensureBank();
    const v = validateBank({ ...bank, questions: [...bank.questions, q] });
    if (!v.ok) {
      toast(v.errors[0] || "Lỗi dữ liệu");
      return;
    }

    bank.questions.push(q);
    if (!bank.periods.some((p) => p.id === periodId)) {
      bank.periods.push({
        id: periodId,
        label: periodId,
        shortLabel: periodId,
        range: { startYear: 0, endYear: 0 },
        color: "#c9a227",
        order: bank.periods.length + 1,
        summary: "Thời kỳ do người dùng thêm.",
      });
    }
    saveBank(bank);
    liveBank = bank;
    form.reset();
    refreshBankCount();
    refreshTimeline();
    toast("Đã thêm câu trắc nghiệm.");
  });
}

window.addEventListener("histlearn:toast", (e) => {
  const msg = /** @type {CustomEvent} */ (e).detail;
  if (typeof msg === "string") toast(msg);
});

function init() {
  ensureBank();
  setupNav();
  setupPeriodActions();
  setupQuizChrome();
  setupBankUi();
  refreshTimeline();
  renderPeriodPanel();
  updateHeaderStats();
  updateHeroBadge();
  refreshBankCount();

  const titles = TITLE_LEVELS.map((t) => `${t.minXp} XP → ${t.label}`).join("\n");
  console.info("[Sử học THCS] Ngưỡng danh hiệu:\n" + titles);
}

init();
