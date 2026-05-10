/**
 * @param {HTMLElement} container
 * @param {import('../modules/questions.js').QuestionBank} bank
 * @param {string|null} selectedId
 * @param {(periodId: string) => void} onSelect
 */
export function renderTimeline(container, bank, selectedId, onSelect) {
  const periods = [...bank.periods].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  container.innerHTML = "";
  const track = document.createElement("div");
  track.className = "timeline-track";
  track.setAttribute("role", "list");

  for (const p of periods) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "timeline-node";
    btn.dataset.periodId = p.id;
    if (selectedId === p.id) btn.classList.add("is-selected");
    btn.setAttribute("role", "listitem");

    const dot = document.createElement("span");
    dot.className = "timeline-node__dot";
    dot.style.background = p.color || "var(--color-gold)";

    const label = document.createElement("span");
    label.className = "timeline-node__label";
    label.textContent = p.shortLabel || p.label;

    const years = document.createElement("span");
    years.className = "timeline-node__years";
    const r = p.range;
    years.textContent = r ? `${r.startYear} — ${r.endYear}` : "";

    btn.append(dot, label, years);
    btn.addEventListener("click", () => onSelect(p.id));
    track.appendChild(btn);
  }

  container.appendChild(track);
}

/**
 * @param {import('../modules/questions.js').QuestionBank} bank
 * @param {string} id
 */
export function findPeriod(bank, id) {
  return bank.periods.find((p) => p.id === id) ?? null;
}
