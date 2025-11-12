document.addEventListener("DOMContentLoaded", () => {
  /* ========= 타이머 로직 ========= */
  const display = document.getElementById("timerDisplay");
  const startBtn = document.getElementById("startBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const resetBtn = document.getElementById("resetBtn");

  let timerInterval = null;
  let startTime = null;
  let elapsedMs = 0; // 누적 시간(ms)

  function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const centis = Math.floor((ms % 1000) / 10); // 1/100초

    const mm = String(minutes).padStart(2, "0");
    const ss = String(seconds).padStart(2, "0");
    const cs = String(centis).padStart(2, "0");
    return `${mm}:${ss}.${cs}`;
  }

  function updateTimer() {
    const now = Date.now();
    elapsedMs = now - startTime;
    display.textContent = formatTime(elapsedMs);
  }

  startBtn.addEventListener("click", () => {
    if (timerInterval) return; // 이미 동작 중이면 무시
    startTime = Date.now() - elapsedMs; // 재개 시 누적 반영
    timerInterval = setInterval(updateTimer, 10);
  });

  pauseBtn.addEventListener("click", () => {
    if (!timerInterval) return;
    clearInterval(timerInterval);
    timerInterval = null;
  });

  resetBtn.addEventListener("click", () => {
    clearInterval(timerInterval);
    timerInterval = null;
    elapsedMs = 0;
    display.textContent = formatTime(0);
  });

  display.textContent = formatTime(0);

  /* ========= 점수 로직 + Undo ========= */
  const scores = {
    red: 0,
    blue: 0,
  };

  const redScoreEl = document.getElementById("redScore");
  const blueScoreEl = document.getElementById("blueScore");

  // 직전 점수 기록 (스택)
  const history = [];
  const undoBtn = document.getElementById("undoBtn");

  function renderScores() {
    // 0.5 단위라서 소수점 한 자리까지 표시하고, .0은 제거
    const format = (v) => {
      const str = v.toFixed(1);
      return str.endsWith(".0") ? str.slice(0, -2) : str;
    };
    redScoreEl.textContent = format(scores.red);
    blueScoreEl.textContent = format(scores.blue);
  }

  function updateUndoState() {
    if (!undoBtn) return;
    undoBtn.disabled = history.length === 0;
  }

  document.querySelectorAll(".fighter").forEach((box) => {
    box.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;

      const fighter = btn.dataset.fighter;
      const reset = btn.dataset.reset;

      // 점수 증가 버튼
      if (fighter && !reset) {
        const amount = parseFloat(btn.dataset.score || "0");
        scores[fighter] += amount;
        if (scores[fighter] < 0) scores[fighter] = 0;

        // 히스토리에 기록 (Undo용)
        history.push({ fighter, delta: amount });

        renderScores();
        updateUndoState();
      }
      // 점수 초기화 버튼
      else if (fighter && reset) {
        scores[fighter] = 0;
        renderScores();

        // 리셋 후에는 이전 기록이 헷갈릴 수 있어서 Undo 스택도 비움
        history.length = 0;
        updateUndoState();
      }
    });
  });

  // Undo 버튼: 마지막 점수 변화 한 번 취소
  if (undoBtn) {
    undoBtn.addEventListener("click", () => {
      const last = history.pop();
      if (!last) {
        alert("되돌릴 점수가 없습니다.");
        return;
      }

      scores[last.fighter] -= last.delta;
      if (scores[last.fighter] < 0) scores[last.fighter] = 0;

      renderScores();
      updateUndoState();
    });
  }

  renderScores();
  updateUndoState();

  /* ========= 대진표 로직 (localStorage) ========= */
  const BRACKET_KEY = "humanoidBracketV1";
  const bracketForm = document.getElementById("bracketForm");
  const bracketBody = document.getElementById("bracketBody");
  const clearBtn = document.getElementById("clearBracket");
  const redNameInput = document.getElementById("redName");
  const blueNameInput = document.getElementById("blueName");

  function saveBracket() {
    const rows = [];
    bracketBody.querySelectorAll("tr").forEach((tr) => {
      const cells = tr.querySelectorAll("td");
      rows.push({
        round: cells[0].textContent,
        p1: cells[1].textContent,
        p2: cells[2].textContent,
        winner: cells[3].textContent,
      });
    });
    localStorage.setItem(BRACKET_KEY, JSON.stringify(rows));
  }

  function addRow(match) {
    const tr = document.createElement("tr");

    const tdRound = document.createElement("td");
    const tdP1 = document.createElement("td");
    const tdP2 = document.createElement("td");
    const tdWinner = document.createElement("td");
    const tdActions = document.createElement("td");

    tdRound.textContent = match.round || "";
    tdP1.textContent = match.p1 || "";
    tdP2.textContent = match.p2 || "";
    tdWinner.textContent = match.winner || "";

    const delBtn = document.createElement("button");
    delBtn.textContent = "삭제";
    delBtn.classList.add("small");
    delBtn.addEventListener("click", () => {
      tr.remove();
      saveBracket();
    });
    tdActions.appendChild(delBtn);

    tr.appendChild(tdRound);
    tr.appendChild(tdP1);
    tr.appendChild(tdP2);
    tr.appendChild(tdWinner);
    tr.appendChild(tdActions);

    bracketBody.appendChild(tr);
  }

  function loadBracket() {
    const raw = localStorage.getItem(BRACKET_KEY);
    if (!raw) return;
    try {
      const rows = JSON.parse(raw);
      rows.forEach(addRow);
    } catch (e) {
      console.warn("대진표 불러오기 실패:", e);
    }
  }

  bracketForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const formData = new FormData(bracketForm);
    const round = (formData.get("round") || "").trim();
    const p1 =
      (formData.get("p1") || "").trim() || redNameInput.value.trim();
    const p2 =
      (formData.get("p2") || "").trim() || blueNameInput.value.trim();
    const winner = (formData.get("winner") || "").trim();

    if (!round && !p1 && !p2) {
      alert("라운드 또는 선수 이름을 입력해 주세요.");
      return;
    }

    addRow({ round, p1, p2, winner });
    saveBracket();
    bracketForm.reset();
  });

  clearBtn.addEventListener("click", () => {
    if (!confirm("대진표를 모두 삭제할까요? (되돌릴 수 없습니다)")) return;
    bracketBody.innerHTML = "";
    localStorage.removeItem(BRACKET_KEY);
  });

  loadBracket();
});
