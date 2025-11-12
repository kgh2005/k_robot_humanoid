document.addEventListener("DOMContentLoaded", () => {
  /* ========= 라운드 모드 (1분 / 3분) ========= */
  // roundMode: "1" 또는 "3"
  let roundMode = "3"; // 기본 3분

  function getRoundSeconds() {
    return roundMode === "1" ? 60 : 180;
  }

  const modeRadios = document.querySelectorAll('input[name="roundMode"]');

  /* ========= 타이머 ========= */
  const display = document.getElementById("timerDisplay");
  const startBtn = document.getElementById("startBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const resetBtn = document.getElementById("resetBtn");
  const mainPanel = document.querySelector(".panel");

  let timerInterval = null;
  let startTime = null;
  let elapsedMs = 0;              // 누적 시간(ms)
  let lastAnnouncedSecond = null; // 마지막으로 처리한 초

  function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const centis = Math.floor((ms % 1000) / 10);

    const mm = String(minutes).padStart(2, "0");
    const ss = String(seconds).padStart(2, "0");
    const cs = String(centis).padStart(2, "0");
    return `${mm}:${ss}.${cs}`;
  }

  function resetTimerState() {
    clearInterval(timerInterval);
    timerInterval = null;
    elapsedMs = 0;
    lastAnnouncedSecond = null;
    display.textContent = formatTime(0);
  }

  /* ========= 효과음 (Web Audio) ========= */
  let audioCtx = null;

  function ensureAudioCtx() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
  }

  function playBeep(durationMs = 150, frequency = 1200, volume = 0.3) {
    const ctx = ensureAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "square";
    osc.frequency.value = frequency;
    gain.gain.value = volume;

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    const durationSec = durationMs / 1000;

    osc.start(now);
    osc.stop(now + durationSec);
  }

  function shortBeep() {
    playBeep(120, 1400, 0.35);
  }

  function longBeepPattern() {
    const count = 8;
    const interval = 150;
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        playBeep(120, 1500, 0.45);
      }, i * interval);
    }
  }

  /* ========= 화면 깜빡임 ========= */
  function flashPanel() {
    if (!mainPanel) return;
    mainPanel.classList.add("flash");
    setTimeout(() => {
      mainPanel.classList.remove("flash");
    }, 900);
  }

  /* ========= 타이머 진행 중 이벤트 ========= */
  function checkAnnouncements(totalSeconds) {
    const ROUND_SECONDS = getRoundSeconds();

    if (totalSeconds === lastAnnouncedSecond) return;
    lastAnnouncedSecond = totalSeconds;

    // 0초는 아무 것도 안 함
    if (totalSeconds === 0) return;

    if (roundMode === "3") {
      // ===== 3분 모드 =====
      // 1:00, 2:00, 2:30, 2:50, 2:51~2:59, 3:00
      if (
        totalSeconds === 60 ||
        totalSeconds === 120 ||
        totalSeconds === 150 ||
        totalSeconds === 170
      ) {
        shortBeep();
        flashPanel();
        return;
      }

      if (totalSeconds >= 171 && totalSeconds <= 179) {
        // 2:51~2:59 → 카운트다운 영역: 매 초 삐빅
        shortBeep();
        flashPanel();
        return;
      }

      if (totalSeconds === ROUND_SECONDS) {
        longBeepPattern();
        flashPanel();
        clearInterval(timerInterval);
        timerInterval = null;
        elapsedMs = ROUND_SECONDS * 1000;
        display.textContent = formatTime(elapsedMs);
        return;
      }
    } else {
      // ===== 1분 모드 =====
      // 0:30, 0:50, 0:51~0:59, 1:00
      if (totalSeconds === 30 || totalSeconds === 50) {
        shortBeep();
        flashPanel();
        return;
      }

      if (totalSeconds >= 51 && totalSeconds <= 59) {
        shortBeep();
        flashPanel();
        return;
      }

      if (totalSeconds === ROUND_SECONDS) {
        longBeepPattern();
        flashPanel();
        clearInterval(timerInterval);
        timerInterval = null;
        elapsedMs = ROUND_SECONDS * 1000;
        display.textContent = formatTime(elapsedMs);
        return;
      }
    }
  }

  function updateTimer() {
    const now = Date.now();
    elapsedMs = now - startTime;
    const ROUND_SECONDS = getRoundSeconds();
    const totalSeconds = Math.floor(elapsedMs / 1000);

    if (totalSeconds >= ROUND_SECONDS) {
      checkAnnouncements(ROUND_SECONDS);
      return;
    }

    display.textContent = formatTime(elapsedMs);
    checkAnnouncements(totalSeconds);
  }

  /* ========= 모드 변경 이벤트 (확인 팝업) ========= */
  modeRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      if (!radio.checked) return;

      const newMode = radio.value === "1" ? "1" : "3";
      if (newMode === roundMode) return;

      const ok = confirm(
        "라운드 시간을 변경하면 타이머가 0으로 초기화됩니다.\n정말 변경하시겠습니까?"
      );
      if (!ok) {
        // 선택 취소 → 기존 모드로 라디오 되돌리기
        modeRadios.forEach((r) => {
          r.checked = r.value === roundMode;
        });
        return;
      }

      roundMode = newMode;
      resetTimerState();
    });
  });

  /* ========= 타이머 컨트롤 ========= */
  startBtn.addEventListener("click", () => {
    if (timerInterval) return;
    startTime = Date.now() - elapsedMs;
    timerInterval = setInterval(updateTimer, 10);
  });

  pauseBtn.addEventListener("click", () => {
    if (!timerInterval) return;
    clearInterval(timerInterval);
    timerInterval = null;
  });

  resetBtn.addEventListener("click", () => {
    const ok = confirm(
      "타이머를 0으로 리셋하고 알림 상태를 초기화합니다.\n정말 리셋할까요?"
    );
    if (!ok) return;
    resetTimerState();
  });

  display.textContent = formatTime(0);

  /* ========= 점수 + Undo ========= */
  const scores = {
    red: 0,
    blue: 0,
  };

  const redScoreEl = document.getElementById("redScore");
  const blueScoreEl = document.getElementById("blueScore");
  const history = []; // { fighter, delta }
  const undoBtn = document.getElementById("undoBtn");

  function renderScores() {
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

  // 점수 버튼
  document.querySelectorAll(".fighter").forEach((box) => {
    box.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;

      const fighter = btn.dataset.fighter;
      const reset = btn.dataset.reset;

      if (fighter && !reset) {
        // 점수 추가
        const amount = parseFloat(btn.dataset.score || "0");
        scores[fighter] += amount;
        if (scores[fighter] < 0) scores[fighter] = 0;

        history.push({ fighter, delta: amount }); // 증가분 기록
        renderScores();
        updateUndoState();
      } else if (fighter && reset) {
        // 점수 초기화 (해당 선수 점수만 0으로, 나머지 기능 유지)
        const ok = confirm(
          `${fighter.toUpperCase()} 점수를 0으로 초기화합니다.\n정말 초기화할까요?`
        );
        if (!ok) return;

        const prev = scores[fighter];
        if (prev !== 0) {
          // 초기화도 Undo로 되돌릴 수 있게 음수 delta로 기록
          history.push({ fighter, delta: -prev });
        }

        scores[fighter] = 0;
        renderScores();
        updateUndoState();
      }
    });
  });

  // Undo: 직전 점수 변화 한 번 취소
  if (undoBtn) {
    undoBtn.addEventListener("click", () => {
      const last = history.pop();
      if (!last) {
        alert("되돌릴 점수가 없습니다.");
        return;
      }

      const ok = confirm(
        "직전에 변경된 점수를 한 번 취소합니다.\n정말 되돌릴까요?"
      );
      if (!ok) {
        // 되돌리기 취소 → pop 했던 기록 다시 복구
        history.push(last);
        return;
      }

      // delta를 빼는 방식으로 되돌림
      scores[last.fighter] -= last.delta;
      if (scores[last.fighter] < 0) scores[last.fighter] = 0;

      renderScores();
      updateUndoState();
    });
  }

  renderScores();
  updateUndoState();
});
