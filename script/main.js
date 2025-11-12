document.addEventListener("DOMContentLoaded", () => {
  /* ========= 설정 ========= */
  const ROUND_SECONDS = 180; // 3분 라운드

  /* ========= 타이머 ========= */
  const display = document.getElementById("timerDisplay");
  const startBtn = document.getElementById("startBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const resetBtn = document.getElementById("resetBtn");
  const mainPanel = document.querySelector(".panel"); // 깜빡일 대상

  let timerInterval = null;
  let startTime = null;
  let elapsedMs = 0;              // 누적 시간(ms)
  let lastAnnouncedSecond = null; // 마지막으로 처리한 초

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

  /* ========= 효과음 (Web Audio) ========= */
  let audioCtx = null;

  function ensureAudioCtx() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
  }

  // 기본 삐빅
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

  // finish용 긴 삐비비비비빅 (짧은 삐빅 여러 번)
  function longBeepPattern() {
    const count = 8;      // 몇 번 반복할지
    const interval = 150; // 간격(ms)

    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        playBeep(120, 1500, 0.45);
        // 중간에 살짝 낮은 톤 섞고 싶으면 조건 걸어도 됨
      }, i * interval);
    }
  }

  /* ========= 화면 깜빡임 ========= */
  function flashPanel() {
    if (!mainPanel) return;
    mainPanel.classList.add("flash");
    setTimeout(() => {
      mainPanel.classList.remove("flash");
    }, 900); // CSS 애니메이션보다 약간 길게
  }

  /* ========= (0초 전용) 음성 출력 ========= */
  function speak(text, lang) {
    if (!("speechSynthesis" in window)) {
      console.log("[VOICE]", text);
      return;
    }
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang || "en-US";
    window.speechSynthesis.speak(utter);
  }

  /* ========= 타이머 진행 중 이벤트 ========= */
  function checkAnnouncements(totalSeconds) {
    if (totalSeconds === lastAnnouncedSecond) return;
    lastAnnouncedSecond = totalSeconds;

    // 0초는 start 버튼에서 Fight 처리 → 여기서는 패스
    if (totalSeconds === 0) return;

    // 1:00 → 짧은 삐빅 + 깜빡
    if (totalSeconds === 60) {
      shortBeep();
      flashPanel();
      return;
    }

    // 2:00
    if (totalSeconds === 120) {
      shortBeep();
      flashPanel();
      return;
    }

    // 2:30 (150초)
    if (totalSeconds === 150) {
      shortBeep();
      flashPanel();
      return;
    }

    // 2:50 (170초)
    if (totalSeconds === 170) {
      shortBeep();
      flashPanel();
      return;
    }

    // 2:51 ~ 2:59 → 카운트다운 9~1: 매 초마다 삐빅
    if (totalSeconds >= 171 && totalSeconds <= 179) {
      shortBeep();
      flashPanel();
      return;
    }

    // 3:00 → 길게 삐비비비비빅 + 타이머 정지
    if (totalSeconds === ROUND_SECONDS) {
      longBeepPattern();
      flashPanel();
      clearInterval(timerInterval);
      timerInterval = null;
      elapsedMs = ROUND_SECONDS * 1000;
      display.textContent = formatTime(elapsedMs);
    }
  }

  function updateTimer() {
    const now = Date.now();
    elapsedMs = now - startTime;
    const totalSeconds = Math.floor(elapsedMs / 1000);

    if (totalSeconds >= ROUND_SECONDS) {
      checkAnnouncements(ROUND_SECONDS);
      return;
    }

    display.textContent = formatTime(elapsedMs);
    checkAnnouncements(totalSeconds);
  }

  // 시작 / 재개
  startBtn.addEventListener("click", () => {
    if (timerInterval) return;

    // 0초에서 처음 시작할 때만 "Fight" (음성)
    if (elapsedMs === 0) {
      speak("Fight", "en-US");
      lastAnnouncedSecond = 0;
    }

    startTime = Date.now() - elapsedMs;
    timerInterval = setInterval(updateTimer, 10);
  });

  // 일시정지
  pauseBtn.addEventListener("click", () => {
    if (!timerInterval) return;
    clearInterval(timerInterval);
    timerInterval = null;
  });

  // 리셋
  resetBtn.addEventListener("click", () => {
    clearInterval(timerInterval);
    timerInterval = null;
    elapsedMs = 0;
    lastAnnouncedSecond = null;
    display.textContent = formatTime(0);
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

  document.querySelectorAll(".fighter").forEach((box) => {
    box.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;

      const fighter = btn.dataset.fighter;
      const reset = btn.dataset.reset;

      // 점수 추가
      if (fighter && !reset) {
        const amount = parseFloat(btn.dataset.score || "0");
        scores[fighter] += amount;
        if (scores[fighter] < 0) scores[fighter] = 0;

        history.push({ fighter, delta: amount });
        renderScores();
        updateUndoState();
      }
      // 점수 초기화
      else if (fighter && reset) {
        scores[fighter] = 0;
        renderScores();
        history.length = 0;
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

      scores[last.fighter] -= last.delta;
      if (scores[last.fighter] < 0) scores[last.fighter] = 0;

      renderScores();
      updateUndoState();
    });
  }

  renderScores();
  updateUndoState();
});
