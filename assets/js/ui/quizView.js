import { EXAM_SECONDS_PER_QUESTION } from "../config.js";
import {
  addXp,
  evaluateBadges,
  recordActivityDay,
  titleForXp,
} from "../modules/gamification.js";
import {
  filterQuestionsByPeriod,
  gradeMatchPairs,
  gradeMultipleChoice,
  gradeTimelineSort,
  shuffle,
  shuffleMatchPairs,
  shuffleMultipleChoice,
  shuffleSortItems,
} from "../modules/questions.js";
import { appendAttempt, loadAttempts, loadProfile } from "../modules/storage.js";

/**
 * @typedef {{
 *   bank: import('../modules/questions.js').QuestionBank,
 *   mode: import('../config.js').QuizMode,
 *   periodId: string|null,
 *   mount: HTMLElement,
 *   onExit: () => void,
 *   onFinish?: (summary: object) => void,
 * }} QuizRunOptions
 */

/**
 * @param {QuizRunOptions} opts
 */
export function runQuiz(opts) {
  const { bank, mode, periodId, mount, onExit, onFinish } = opts;
  let list = filterQuestionsByPeriod(bank, periodId);
  list = shuffle(list);
  if (list.length === 0) {
    mount.innerHTML =
      "<div class=\"quiz-card\"><p>Không có câu hỏi trong lựa chọn này. Hãy thêm câu trong Ngân hàng.</p></div>";
    const row = document.createElement("div");
    row.className = "quiz-actions";
    const back = document.createElement("button");
    back.type = "button";
    back.className = "btn btn--primary";
    back.textContent = "Quay lại";
    back.addEventListener("click", onExit);
    row.appendChild(back);
    mount.firstElementChild?.appendChild(row);
    return () => {
      mount.innerHTML = "";
    };
  }

  const session = {
    mode,
    periodId,
    questions: list,
    index: 0,
    results: [],
    score: 0,
    correctCount: 0,
    startedAt: Date.now(),
    timerId: /** @type {ReturnType<typeof setInterval>|null} */ (null),
    remainingSec:
      mode === "exam" ? Math.max(60, list.length * EXAM_SECONDS_PER_QUESTION) : null,
  };

  const ui = {
    timerEl: /** @type {HTMLElement|null} */ (document.getElementById("quiz-timer")),
    scoreEl: /** @type {HTMLElement|null} */ (document.getElementById("quiz-score")),
    progressEl: /** @type {HTMLElement|null} */ (document.getElementById("quiz-progress")),
    modeLabelEl: /** @type {HTMLElement|null} */ (document.getElementById("quiz-mode-label")),
  };

  function updateHud() {
    if (ui.modeLabelEl) {
      ui.modeLabelEl.textContent = mode === "practice" ? "Luyện tập" : "Thi thử";
    }
    if (ui.progressEl) {
      ui.progressEl.textContent = `Câu ${session.index + 1} / ${list.length}`;
    }
    if (ui.scoreEl) {
      ui.scoreEl.textContent =
        mode === "exam" ? `Điểm: ${session.score}` : `Điểm (phiên): ${session.score}`;
    }
    if (ui.timerEl) {
      if (mode === "exam" && session.remainingSec != null) {
        ui.timerEl.hidden = false;
        const m = Math.floor(session.remainingSec / 60);
        const s = session.remainingSec % 60;
        ui.timerEl.textContent = `Thời gian: ${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
        ui.timerEl.classList.toggle("is-low", session.remainingSec <= 15);
      } else {
        ui.timerEl.hidden = true;
      }
    }
  }

  function stopTimer() {
    if (session.timerId) {
      clearInterval(session.timerId);
      session.timerId = null;
    }
  }

  function startTimer() {
    if (mode !== "exam" || session.remainingSec == null) return;
    stopTimer();
    session.timerId = setInterval(() => {
      if (session.remainingSec == null) return;
      session.remainingSec -= 1;
      updateHud();
      if (session.remainingSec <= 0) {
        stopTimer();
        finishQuiz(true);
      }
    }, 1000);
  }

  function recordResult(entry) {
    session.results.push(entry);
    if (entry.score > 0) session.score += entry.score;
    if (entry.correct) session.correctCount += 1;
  }

  function goNext() {
    session.index += 1;
    if (session.index >= list.length) {
      finishQuiz(false);
      return;
    }
    renderCurrent();
  }

  function finishQuiz(timedOut) {
    stopTimer();
    const durationMs = Date.now() - session.startedAt;
    const total = list.length;
    const accuracy = total ? Math.round((session.correctCount / total) * 100) : 0;

    if (session.correctCount > 0 || session.results.length > 0) {
      recordActivityDay();
      const xpBase =
        mode === "exam"
          ? Math.round(session.score / 4) + session.correctCount * 2
          : session.correctCount * 4;
      addXp(Math.max(0, xpBase));
      evaluateBadges({
        correctCount: session.correctCount,
        total,
        mode,
        periodId,
      });
    }

    appendAttempt({
      mode,
      periodId,
      score: session.score,
      totalQuestions: total,
      correctCount: session.correctCount,
      accuracy,
      timedOut: !!timedOut,
      durationMs,
      at: Date.now(),
    });

    renderResults({ timedOut, durationMs, accuracy, total });
    onFinish?.({
      score: session.score,
      correctCount: session.correctCount,
      total,
      mode,
      periodId,
    });
  }

  function renderResults({ timedOut, durationMs, accuracy, total }) {
    const rank = computeLocalRank(mode, periodId, session.score);
    mount.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "quiz-card result-screen";

    const h2 = document.createElement("h2");
    h2.textContent = timedOut ? "Hết giờ!" : "Hoàn thành!";
    wrap.appendChild(h2);

    const p = document.createElement("p");
    p.textContent = `Đúng ${session.correctCount}/${total} · Điểm ${session.score} · Độ chính xác ${accuracy}%`;
    wrap.appendChild(p);

    const rankEl = document.createElement("div");
    rankEl.className = "result-rank";
    rankEl.textContent = rank.label;
    wrap.appendChild(rankEl);

    const xpNote = document.createElement("p");
    xpNote.style.fontSize = "0.95rem";
    xpNote.style.opacity = "0.85";
    const profile = loadProfile();
    const title = titleForXp(profile.xp || 0);
    xpNote.textContent = `XP hiện tại: ${profile.xp ?? 0} · Danh hiệu: ${title.label}`;
    wrap.appendChild(xpNote);

    const detail = document.createElement("details");
    detail.style.marginTop = "1rem";
    detail.style.textAlign = "left";
    const sum = document.createElement("summary");
    sum.textContent = "Xem chi tiết từng câu";
    detail.appendChild(sum);
    const ul = document.createElement("ul");
    ul.style.paddingLeft = "1.2rem";
    for (const r of session.results) {
      const li = document.createElement("li");
      li.style.marginBottom = "0.5rem";
      const ok = r.correct ? "✓" : "✗";
      li.textContent = `${ok} ${r.stemShort} — ${r.score} điểm`;
      ul.appendChild(li);
    }
    detail.appendChild(ul);
    wrap.appendChild(detail);

    const actions = document.createElement("div");
    actions.className = "quiz-actions";
    actions.style.justifyContent = "center";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn--primary";
    btn.textContent = "Về trang chủ";
    btn.addEventListener("click", onExit);
    actions.appendChild(btn);
    wrap.appendChild(actions);

    mount.appendChild(wrap);

    const meta = document.createElement("p");
    meta.style.fontSize = "0.85rem";
    meta.style.opacity = "0.65";
    meta.style.marginTop = "1rem";
    meta.textContent = `Thời gian làm bài: ${Math.round(durationMs / 1000)} giây`;
    wrap.insertBefore(meta, detail);
  }

  function renderCurrent() {
    updateHud();
    const q = list[session.index];
    mount.innerHTML = "";
    const card = document.createElement("div");
    card.className = "quiz-card";
    card.dataset.questionId = q.id;

    const meta = document.createElement("div");
    meta.className = "quiz-card__meta";
    const tagType = document.createElement("span");
    tagType.className = "tag";
    tagType.textContent =
      q.type === "multiple_choice"
        ? "Trắc nghiệm"
        : q.type === "match_pairs"
          ? "Nối cặp"
          : "Sắp xếp thời gian";
    meta.appendChild(tagType);
    if (q.difficulty) {
      const tagD = document.createElement("span");
      tagD.className = "tag";
      tagD.textContent = q.difficulty;
      meta.appendChild(tagD);
    }
    card.appendChild(meta);

    const stem = document.createElement("div");
    stem.className = "quiz-stem";
    stem.textContent = q.stem;
    card.appendChild(stem);

    mount.appendChild(card);

    if (q.type === "multiple_choice") renderMc(card, q);
    else if (q.type === "match_pairs") renderMatch(card, q);
    else renderSort(card, q);
  }

  /**
   * @param {HTMLElement} card
   * @param {import('../modules/questions.js').QMultipleChoice} q
   */
  function renderMc(card, q) {
    const { optionOrder } = shuffleMultipleChoice(q);
    const keys = ["A", "B", "C", "D"];

    const optsEl = document.createElement("div");
    optsEl.className = "mc-options";

    let answered = false;

    const explanationHost = document.createElement("div");

    function appendMcNext() {
      const actions = document.createElement("div");
      actions.className = "quiz-actions";
      const next = document.createElement("button");
      next.type = "button";
      next.className = "btn btn--accent";
      next.textContent = session.index + 1 >= list.length ? "Xem kết quả" : "Câu tiếp →";
      next.addEventListener("click", () => goNext());
      actions.appendChild(next);
      card.appendChild(actions);
    }

    for (let i = 0; i < optionOrder.length; i++) {
      const oid = optionOrder[i];
      const opt = q.options.find((o) => o.id === oid);
      if (!opt) continue;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mc-option";
      const key = document.createElement("span");
      key.className = "mc-option__key";
      key.textContent = keys[i] ?? String(i + 1);
      const text = document.createElement("span");
      text.textContent = opt.text;
      btn.append(key, text);

      btn.addEventListener("click", () => {
        if (answered) return;
        answered = true;
        const g = gradeMultipleChoice(q, opt.id);
        recordResult({
          questionId: q.id,
          type: q.type,
          correct: g.correct,
          score: g.score,
          stemShort: q.stem.slice(0, 72),
        });

        for (const el of optsEl.querySelectorAll(".mc-option")) {
          el.disabled = true;
        }

        if (mode === "practice") {
          btn.classList.add(g.correct ? "is-correct" : "is-wrong");
          optsEl.querySelectorAll(".mc-option").forEach((el, idx) => {
            const linkedId = optionOrder[idx];
            if (linkedId === q.correctOptionId) el.classList.add("is-correct");
          });
          if (g.correct) celebrate(card);
          explanationHost.innerHTML = "";
          explanationHost.appendChild(buildExplanation(q));
          card.appendChild(explanationHost);
        } else {
          btn.style.boxShadow = "0 0 0 2px rgba(232, 197, 71, 0.55)";
        }

        appendMcNext();
      });

      optsEl.appendChild(btn);
    }

    card.appendChild(optsEl);
  }

  /**
   * @param {HTMLElement} card
   * @param {import('../modules/questions.js').QMatchPairs} q
   */
  function renderMatch(card, q) {
    const { rightOrder } = shuffleMatchPairs(q);
    const mapping = /** @type {Record<string, string|null>} */ ({});

    const grid = document.createElement("div");
    grid.className = "match-grid";

    const leftCol = document.createElement("div");
    leftCol.className = "match-col";
    const h4l = document.createElement("h4");
    h4l.textContent = "Mốc / nội dung";
    leftCol.appendChild(h4l);

    for (const p of q.pairs) {
      mapping[p.leftId] = null;
      const slot = document.createElement("div");
      slot.className = "match-slot";
      slot.dataset.leftId = p.leftId;
      const lab = document.createElement("span");
      lab.className = "match-slot__label";
      lab.textContent = p.leftText;
      const zone = document.createElement("div");
      zone.className = "match-slot__drop";
      zone.style.minHeight = "40px";
      zone.style.flex = "1";
      slot.append(lab, zone);
      leftCol.appendChild(slot);
      bindDropZone(zone, mapping, p.leftId);
    }

    const rightCol = document.createElement("div");
    rightCol.className = "match-col";
    const h4r = document.createElement("h4");
    h4r.textContent = "Kéo thả vào ô tương ứng";
    rightCol.appendChild(h4r);

    const pool = document.createElement("div");
    pool.className = "match-pool";
    pool.dataset.role = "pool";
    bindPool(pool, mapping);

    for (const rid of rightOrder) {
      const pair = q.pairs.find((x) => x.rightId === rid);
      if (!pair) continue;
      const chip = document.createElement("div");
      chip.className = "match-chip";
      chip.draggable = true;
      chip.dataset.rightId = rid;
      chip.textContent = pair.rightText;
      chip.addEventListener("dragstart", (e) => {
        chip.classList.add("is-dragging");
        e.dataTransfer?.setData("text/right-id", rid);
      });
      chip.addEventListener("dragend", () => chip.classList.remove("is-dragging"));
      pool.appendChild(chip);
    }

    rightCol.appendChild(pool);
    grid.append(leftCol, rightCol);
    card.appendChild(grid);

    const actions = document.createElement("div");
    actions.className = "quiz-actions";
    const submit = document.createElement("button");
    submit.type = "button";
    submit.className = "btn btn--primary";
    submit.textContent = mode === "practice" ? "Kiểm tra" : "Nộp câu";
    const explanationHost = document.createElement("div");

    submit.addEventListener("click", () => {
      const filled = q.pairs.every((p) => mapping[p.leftId] != null);
      if (!filled) {
        window.dispatchEvent(new CustomEvent("histlearn:toast", { detail: "Hãy nối đủ các cặp." }));
        return;
      }
      const g = gradeMatchPairs(q, /** @type {Record<string, string>} */ (mapping));
      recordResult({
        questionId: q.id,
        type: q.type,
        correct: g.correct,
        score: g.score,
        stemShort: q.stem.slice(0, 72),
      });

      if (mode === "practice") {
        highlightMatchSlots(leftCol, q, mapping);
        if (g.correct) celebrate(card);
        explanationHost.innerHTML = "";
        explanationHost.appendChild(buildExplanation(q));
        card.appendChild(explanationHost);
        submit.disabled = true;
        addNextButton(card, () => goNext());
      } else {
        goNext();
      }
    });

    actions.appendChild(submit);
    card.appendChild(actions);
  }

  /**
   * @param {HTMLElement} zone
   * @param {Record<string, string|null>} mapping
   * @param {string} leftId
   */
  function bindDropZone(zone, mapping, leftId) {
    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
    });
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      const rid = e.dataTransfer?.getData("text/right-id");
      if (!rid) return;
      const chip = document.querySelector(`.match-chip[data-right-id="${CSS.escape(rid)}"]`);
      if (!chip) return;
      for (const k of Object.keys(mapping)) {
        if (mapping[k] === rid) mapping[k] = null;
      }
      const old = zone.querySelector(".match-chip");
      const pool = document.querySelector(".match-pool");
      if (old && old !== chip) {
        pool?.appendChild(old);
        for (const k of Object.keys(mapping)) {
          if (mapping[k] === old.dataset.rightId) mapping[k] = null;
        }
      }
      zone.appendChild(chip);
      mapping[leftId] = rid;
    });
  }

  /**
   * @param {HTMLElement} pool
   * @param {Record<string, string|null>} mapping
   */
  function bindPool(pool, mapping) {
    pool.addEventListener("dragover", (e) => e.preventDefault());
    pool.addEventListener("drop", (e) => {
      e.preventDefault();
      const rid = e.dataTransfer?.getData("text/right-id");
      if (!rid) return;
      const chip = document.querySelector(`.match-chip[data-right-id="${CSS.escape(rid)}"]`);
      if (!chip) return;
      pool.appendChild(chip);
      const leftKey = Object.keys(mapping).find((k) => mapping[k] === rid);
      if (leftKey) mapping[leftKey] = null;
    });
  }

  /**
   * @param {HTMLElement} leftCol
   * @param {import('../modules/questions.js').QMatchPairs} q
   * @param {Record<string, string|null>} mapping
   */
  function highlightMatchSlots(leftCol, q, mapping) {
    for (const p of q.pairs) {
      const ok = mapping[p.leftId] === p.rightId;
      const slot = leftCol.querySelector(`[data-left-id="${CSS.escape(p.leftId)}"]`);
      slot?.style.setProperty("border-color", ok ? "rgba(76,175,122,0.65)" : "rgba(196,76,76,0.55)");
    }
  }

  /**
   * @param {HTMLElement} card
   * @param {import('../modules/questions.js').QTimelineSort} q
   */
  function renderSort(card, q) {
    const { itemOrder } = shuffleSortItems(q);
    const ul = document.createElement("ul");
    ul.className = "sort-list";

    for (const iid of itemOrder) {
      const it = q.items.find((x) => x.id === iid);
      if (!it) continue;
      const li = document.createElement("li");
      li.className = "sort-item";
      li.draggable = true;
      li.dataset.itemId = it.id;
      const handle = document.createElement("span");
      handle.className = "sort-item__handle";
      handle.textContent = "≡";
      const txt = document.createElement("span");
      txt.textContent = it.label;
      li.append(handle, txt);

      li.addEventListener("dragstart", (e) => {
        e.dataTransfer?.setData("text/item-id", it.id);
        ul.dataset.dragId = it.id;
      });
      li.addEventListener("dragover", (e) => {
        e.preventDefault();
        const fromId = ul.dataset.dragId;
        if (!fromId) return;
        const fromEl = ul.querySelector(`[data-item-id="${CSS.escape(fromId)}"]`);
        if (!fromEl || fromEl === li) return;
        const rect = li.getBoundingClientRect();
        const before = e.clientY < rect.top + rect.height / 2;
        if (before) ul.insertBefore(fromEl, li);
        else ul.insertBefore(fromEl, li.nextSibling);
      });
      li.addEventListener("drop", (e) => e.preventDefault());

      ul.appendChild(li);
    }

    ul.addEventListener("dragend", () => {
      delete ul.dataset.dragId;
    });
    ul.addEventListener("dragover", (e) => e.preventDefault());

    card.appendChild(ul);

    const actions = document.createElement("div");
    actions.className = "quiz-actions";
    const submit = document.createElement("button");
    submit.type = "button";
    submit.className = "btn btn--primary";
    submit.textContent = mode === "practice" ? "Kiểm tra thứ tự" : "Nộp câu";

    const explanationHost = document.createElement("div");

    submit.addEventListener("click", () => {
      const order = [...ul.querySelectorAll(".sort-item")].map((el) => el.dataset.itemId || "");
      const g = gradeTimelineSort(q, order);
      recordResult({
        questionId: q.id,
        type: q.type,
        correct: g.correct,
        score: g.score,
        stemShort: q.stem.slice(0, 72),
      });

      if (mode === "practice") {
        ul.style.opacity = "0.95";
        if (g.correct) celebrate(card);
        else {
          for (const li of ul.children) {
            const id = li.dataset.itemId;
            const ok = q.correctOrder.indexOf(id || "") === [...ul.children].indexOf(li);
            li.style.borderColor = ok ? "rgba(76,175,122,0.55)" : "rgba(196,76,76,0.45)";
          }
        }
        explanationHost.innerHTML = "";
        explanationHost.appendChild(buildExplanation(q));
        card.appendChild(explanationHost);
        submit.disabled = true;
        addNextButton(card, () => goNext());
      } else {
        goNext();
      }
    });

    actions.appendChild(submit);
    card.appendChild(actions);
  }

  /**
   * @param {import('../modules/questions.js').Question} q
   */
  function buildExplanation(q) {
    const box = document.createElement("div");
    box.className = "explanation";
    const t = document.createElement("div");
    t.className = "explanation__title";
    t.textContent = "Giải thích";
    const p = document.createElement("div");
    p.textContent = q.explanation;
    box.append(t, p);

    if (q.media?.url) {
      const fig = document.createElement("figure");
      fig.className = "quiz-media";
      const img = document.createElement("img");
      img.src = q.media.url;
      img.alt = q.media.alt || "";
      fig.appendChild(img);
      if (q.media.caption) {
        const cap = document.createElement("figcaption");
        cap.textContent = q.media.caption;
        fig.appendChild(cap);
      }
      box.appendChild(fig);
    }
    return box;
  }

  /**
   * @param {HTMLElement} card
   * @param {() => void} fn
   */
  function addNextButton(card, fn) {
    const actions = card.querySelector(".quiz-actions") || document.createElement("div");
    if (!actions.classList.contains("quiz-actions")) {
      actions.className = "quiz-actions";
      card.appendChild(actions);
    }
    const next = document.createElement("button");
    next.type = "button";
    next.className = "btn btn--accent";
    next.textContent = session.index + 1 >= list.length ? "Xem kết quả" : "Câu tiếp →";
    next.addEventListener("click", fn);
    actions.appendChild(next);
  }

  /**
   * @param {HTMLElement} card
   */
  function celebrate(card) {
    card.classList.add("reward-flash");
    spawnConfetti();
    setTimeout(() => card.classList.remove("reward-flash"), 900);
  }

  function spawnConfetti() {
    const colors = ["#e8c547", "#5a8068", "#c44c4c", "#f5e6d3"];
    for (let i = 0; i < 16; i++) {
      const bit = document.createElement("div");
      bit.className = "confetti-bit";
      bit.style.left = `${10 + Math.random() * 80}%`;
      bit.style.top = "-10px";
      bit.style.background = colors[i % colors.length];
      bit.style.animationDuration = `${0.85 + Math.random() * 0.5}s`;
      document.body.appendChild(bit);
      setTimeout(() => bit.remove(), 1200);
    }
  }

  updateHud();
  startTimer();
  renderCurrent();

  return () => {
    stopTimer();
    mount.innerHTML = "";
  };
}

/**
 * @param {import('../config.js').QuizMode} mode
 * @param {string|null} periodId
 * @param {number} score
 */
function computeLocalRank(mode, periodId, score) {
  const attempts = loadAttempts().filter((a) => a.mode === mode);
  const relevant = periodId
    ? attempts.filter((a) => a.periodId === periodId)
    : attempts;
  const scores = relevant.map((a) => a.score);
  const sorted = [...scores].sort((a, b) => b - a);
  const place = sorted.indexOf(score) + 1;
  const total = sorted.length;
  return {
    label:
      mode === "exam"
        ? `Trong các lần thi thử gần đây (máy bạn), điểm này xếp thứ ${place}/${total}.`
        : `Phiên luyện tập — điểm tích luỹ ${score}.`,
  };
}
