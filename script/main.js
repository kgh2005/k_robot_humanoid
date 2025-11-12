document.addEventListener("DOMContentLoaded", () => {
  /* ========= 라운드 모드 (1분 / 2분) ========= */
  // roundMode: "1" 또는 "2"
  let roundMode = "2"; // 기본 2분

  function getRoundSeconds() {
    return roundMode === "1" ? 60 : 120;
  }

  const modeRadios = document.querySelectorAll('input[name="roundMode"]');

  /* ========= 타이머 ========= */
  const display = document.getElementById("timerDisplay");
  const startBtn = document.getElementById("startBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const resetBtn = document.getElementById("resetBtn");
  const mainPanel = document.querySelector(".panel[data-tab='match']");

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
  function flashPanel(panelEl) {
    if (!panelEl) return;
    panelEl.classList.add("flash");
    setTimeout(() => {
      panelEl.classList.remove("flash");
    }, 900);
  }

  /* ========= 타이머 진행 중 이벤트 ========= */
  function checkAnnouncements(totalSeconds) {
    const ROUND_SECONDS = getRoundSeconds();

    if (totalSeconds === lastAnnouncedSecond) return;
    lastAnnouncedSecond = totalSeconds;

    // 0초는 아무 것도 안 함
    if (totalSeconds === 0) return;

    if (roundMode === "2") {
      // ===== 2분 모드 =====
      // 삑: 1:00(60), 1:30(90), 1:50(110), 1:51~1:59(111~119)
      // 2:00(120) → 긴 삐비빅
      if (
        totalSeconds === 60 ||   // 1:00
        totalSeconds === 90 ||   // 1:30
        totalSeconds === 110     // 1:50
      ) {
        shortBeep();
        flashPanel(mainPanel);
        return;
      }

      if (totalSeconds >= 111 && totalSeconds <= 119) {
        // 1:51 ~ 1:59
        shortBeep();
        flashPanel(mainPanel);
        return;
      }

      if (totalSeconds === ROUND_SECONDS) {
        // 2:00
        longBeepPattern();
        flashPanel(mainPanel);
        clearInterval(timerInterval);
        timerInterval = null;
        elapsedMs = ROUND_SECONDS * 1000;
        display.textContent = formatTime(elapsedMs);
        return;
      }
    } else {
      // ===== 1분 모드 =====
      // 삑: 0:30(30), 0:50(50), 0:51~0:59(51~59)
      // 1:00(60) → 긴 삐비빅
      if (totalSeconds === 30 || totalSeconds === 50) {
        shortBeep();
        flashPanel(mainPanel);
        return;
      }

      if (totalSeconds >= 51 && totalSeconds <= 59) {
        shortBeep();
        flashPanel(mainPanel);
        return;
      }

      if (totalSeconds === ROUND_SECONDS) {
        longBeepPattern();
        flashPanel(mainPanel);
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

      const newMode = radio.value === "1" ? "1" : "2";
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
        // 점수 초기화 (해당 선수 점수만 0, 나머지 유지)
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

      // delta를 반대로 적용해서 되돌림
      scores[last.fighter] -= last.delta;
      if (scores[last.fighter] < 0) scores[last.fighter] = 0;

      renderScores();
      updateUndoState();
    });
  }

  renderScores();
  updateUndoState();

  /* ========= 탭 전환 ========= */
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tab;
      tabButtons.forEach((b) => b.classList.toggle("active", b === btn));
      tabContents.forEach((panel) => {
        panel.classList.toggle(
          "hidden",
          panel.dataset.tab !== target
        );
      });
    });
  });

  /* ========= 투표 추첨 기능 ========= */
  const voteMaxNumberInput = document.getElementById("voteMaxNumber");
  const voteSetRangeBtn = document.getElementById("voteSetRangeBtn");
  const voteRangeInfo = document.getElementById("voteRangeInfo");
  const voteNameInput = document.getElementById("voteName");
  const voteDrawBtn = document.getElementById("voteDrawBtn");
  const voteLastResult = document.getElementById("voteLastResult");
  const voteResultsList = document.getElementById("voteResultsList");
  const voteExportCsvBtn = document.getElementById("voteExportCsvBtn");
  const voteExportTxtBtn = document.getElementById("voteExportTxtBtn");

  let voteMaxNumber = null;
  const voteResults = [];        // { name, number }
  let usedNumbers = new Set();   // 이미 뽑힌 번호들

  function renderVoteRangeInfo() {
    if (!voteMaxNumber || voteMaxNumber < 1) {
      voteRangeInfo.textContent = "현재 범위가 설정되지 않았습니다.";
    } else {
      voteRangeInfo.textContent = `현재 범위: 1 ~ ${voteMaxNumber} (사용된 번호: ${usedNumbers.size}개)`;
    }
  }

  function renderVoteResults() {
    voteResultsList.innerHTML = "";
    if (voteResults.length === 0) {
      const p = document.createElement("p");
      p.className = "vote-empty";
      p.textContent = "아직 추첨된 데이터가 없습니다.";
      voteResultsList.appendChild(p);
      return;
    }

    // 오름차순 정렬 (번호 기준: 작은 번호가 위로)
    const sorted = [...voteResults].sort((a, b) => a.number - b.number);

    sorted.forEach((item) => {
      const row = document.createElement("div");
      row.className = "vote-result-item";

      const left = document.createElement("span");
      left.className = "name";
      left.textContent = item.name;

      const right = document.createElement("span");
      right.className = "num";
      right.textContent = `번호 ${item.number}`;

      row.appendChild(left);
      row.appendChild(right);
      voteResultsList.appendChild(row);
    });
  }

  voteSetRangeBtn.addEventListener("click", () => {
    const value = parseInt(voteMaxNumberInput.value, 10);
    if (Number.isNaN(value) || value < 1) {
      alert("1 이상의 숫자를 입력해주세요.");
      return;
    }

    // 이미 결과가 있는데 범위를 바꾸면 초기화 여부 확인
    if (
      voteMaxNumber !== null &&
      voteMaxNumber !== value &&
      (voteResults.length > 0 || usedNumbers.size > 0)
    ) {
      const ok = confirm(
        "범위를 변경하면 기존 추첨 결과가 모두 삭제됩니다.\n정말 변경하시겠습니까?"
      );
      if (!ok) {
        // 입력값 되돌리기
        if (voteMaxNumber !== null) {
          voteMaxNumberInput.value = String(voteMaxNumber);
        } else {
          voteMaxNumberInput.value = "";
        }
        return;
      }
      voteResults.length = 0;
      usedNumbers.clear();
      renderVoteResults();
    }

    voteMaxNumber = value;
    renderVoteRangeInfo();
  });

  voteDrawBtn.addEventListener("click", () => {
    const name = voteNameInput.value.trim();
    if (!voteMaxNumber || voteMaxNumber < 1) {
      alert("먼저 투표 인원 수를 설정해주세요.");
      return;
    }
    if (!name) {
      alert("이름을 입력해주세요.");
      return;
    }

    if (usedNumbers.size >= voteMaxNumber) {
      alert("모든 번호가 이미 사용되었습니다.");
      return;
    }

    // 중복 안 나는 번호 뽑기
    let randomNum;
    do {
      randomNum = Math.floor(Math.random() * voteMaxNumber) + 1;
    } while (usedNumbers.has(randomNum));

    usedNumbers.add(randomNum);
    voteResults.push({ name, number: randomNum });

    voteLastResult.innerHTML = `마지막 결과: <strong>${name} : ${randomNum}</strong>`;
    renderVoteResults();
    renderVoteRangeInfo();

    voteNameInput.value = "";
    voteNameInput.focus();
  });

  function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function buildResultLines() {
    // 파일도 번호 오름차순으로 저장
    const sorted = [...voteResults].sort((a, b) => a.number - b.number);
    return sorted.map((r) => `${r.name} : ${r.number}`).join("\n");
  }

  voteExportCsvBtn.addEventListener("click", () => {
    if (voteResults.length === 0) {
      alert("저장할 데이터가 없습니다.");
      return;
    }
    const lines = buildResultLines();
    downloadFile("vote_results.csv", lines, "text/csv;charset=utf-8");
  });

  voteExportTxtBtn.addEventListener("click", () => {
    if (voteResults.length === 0) {
      alert("저장할 데이터가 없습니다.");
      return;
    }
    const lines = buildResultLines();
    downloadFile("vote_results.txt", lines, "text/plain;charset=utf-8");
  });

  renderVoteRangeInfo();
  renderVoteResults();
});
