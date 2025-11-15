document.addEventListener("DOMContentLoaded", () => {
  /* ========= 라운드 모드 (1분 / 2분) ========= */
  let roundMode = "2";
  const modeRadios = document.querySelectorAll('input[name="roundMode"]');
  function getRoundSeconds() { return roundMode === "1" ? 60 : 120; }

  /* ========= 타이머 ========= */
  const display = document.getElementById("timerDisplay");
  const startBtn = document.getElementById("startBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const resetBtn = document.getElementById("resetBtn");
  const mainPanel = document.querySelector(".panel[data-tab='match']");

  let timerInterval = null;
  let startTime = null;
  let elapsedMs = 0;
  let lastAnnouncedSecond = null;

  function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const centis = Math.floor((ms % 1000) / 10);
    return `${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}.${String(centis).padStart(2,"0")}`;
  }

  function resetTimerState() {
    clearInterval(timerInterval);
    timerInterval = null;
    elapsedMs = 0;
    lastAnnouncedSecond = null;
    display.textContent = formatTime(0);
  }

  /* ========= 효과음 ========= */
  let audioCtx = null;
  function ensureAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }
  function playBeep(durationMs=150, freq=1200, vol=0.3) {
    const ctx = ensureAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    gain.gain.value = vol;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    const dur = durationMs / 1000;
    osc.start(now);
    osc.stop(now + dur);
  }
  function shortBeep() { playBeep(120, 1400, 0.35); }
  function longBeepPattern() { for (let i = 0; i < 8; i++) setTimeout(() => playBeep(120, 1500, 0.45), i * 150); }

  /* ========= 화면 깜빡임 ========= */
  function flashPanel(panelEl) {
    if (!panelEl) return;
    panelEl.classList.add("flash");
    setTimeout(() => panelEl.classList.remove("flash"), 900);
  }

  /* ========= 타이머 이벤트 ========= */
  function checkAnnouncements(totalSeconds) {
    const ROUND_SECONDS = getRoundSeconds();
    if (totalSeconds === lastAnnouncedSecond) return;
    lastAnnouncedSecond = totalSeconds;
    if (totalSeconds === 0) return;

    if (roundMode === "2") {
      if (totalSeconds === 60 || totalSeconds === 90 || totalSeconds === 110) {
        shortBeep(); flashPanel(mainPanel); return;
      }
      if (totalSeconds >= 111 && totalSeconds <= 119) {
        shortBeep(); flashPanel(mainPanel); return;
      }
      if (totalSeconds === ROUND_SECONDS) {
        longBeepPattern(); flashPanel(mainPanel);
        clearInterval(timerInterval); timerInterval = null;
        elapsedMs = ROUND_SECONDS * 1000;
        display.textContent = formatTime(elapsedMs);
        return;
      }
    } else {
      if (totalSeconds === 30 || totalSeconds === 50) {
        shortBeep(); flashPanel(mainPanel); return;
      }
      if (totalSeconds >= 51 && totalSeconds <= 59) {
        shortBeep(); flashPanel(mainPanel); return;
      }
      if (totalSeconds === ROUND_SECONDS) {
        longBeepPattern(); flashPanel(mainPanel);
        clearInterval(timerInterval); timerInterval = null;
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

  modeRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      const newMode = radio.value === "1" ? "1" : "2";
      if (newMode === roundMode) return;
      const ok = confirm("라운드 시간을 변경하면 타이머가 0으로 초기화됩니다.\n정말 변경하시겠습니까?");
      if (!ok) { modeRadios.forEach((r) => { r.checked = (r.value === roundMode); }); return; }
      roundMode = newMode;
      resetTimerState();
    });
  });

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
    const ok = confirm("타이머를 0으로 리셋하고 알림 상태를 초기화합니다.\n정말 리셋할까요?");
    if (!ok) return;
    resetTimerState();
  });

  display.textContent = formatTime(0);

  /* ========= 점수 + Undo ========= */
  const scores = { red: 0, blue: 0 };
  const redScoreEl = document.getElementById("redScore");
  const blueScoreEl = document.getElementById("blueScore");
  const undoBtn = document.getElementById("undoBtn");
  const history = [];

  function fmtScore(v) {
    const n = Math.round(v * 10) / 10;
    const s = n.toFixed(1);
    return s.endsWith(".0") ? s.slice(0, -2) : s;
  }
  function renderScores() { redScoreEl.textContent = fmtScore(scores.red); blueScoreEl.textContent = fmtScore(scores.blue); }
  function updateUndoState() { if (undoBtn) undoBtn.disabled = history.length === 0; }

  document.querySelectorAll(".fighter").forEach((box) => {
    box.addEventListener("click", (e) => {
      const btn = e.target.closest("button"); if (!btn) return;
      const fighter = btn.dataset.fighter;
      const reset = btn.dataset.reset;
      if (fighter && !reset) {
        const amount = parseFloat(btn.dataset.score || "0");
        scores[fighter] += amount; if (scores[fighter] < 0) scores[fighter] = 0;
        history.push({ fighter, delta: amount }); renderScores(); updateUndoState();
      } else if (fighter && reset) {
        const ok = confirm(`${fighter.toUpperCase()} 점수를 0으로 초기화합니다.\n정말 초기화할까요?`);
        if (!ok) return;
        const prev = scores[fighter]; if (prev !== 0) history.push({ fighter, delta: -prev });
        scores[fighter] = 0; renderScores(); updateUndoState();
      }
    });
  });

  if (undoBtn) {
    undoBtn.addEventListener("click", () => {
      const last = history.pop(); if (!last) { alert("되돌릴 점수가 없습니다."); return; }
      const ok = confirm("직전에 변경된 점수를 한 번 취소합니다.\n정말 되돌릴까요?");
      if (!ok) { history.push(last); return; }
      scores[last.fighter] -= last.delta; if (scores[last.fighter] < 0) scores[last.fighter] = 0;
      renderScores(); updateUndoState();
    });
  }

  renderScores(); updateUndoState();

  /* ========= 탭 전환 ========= */
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tab;
      tabButtons.forEach((b) => b.classList.toggle("active", b === btn));
      tabContents.forEach((panel) => panel.classList.toggle("hidden", panel.dataset.tab !== target));
    });
  });

  /* ========= 투표 추첨 ========= */
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
  const voteResults = [];            // { name, number }
  let usedNumbers = new Set();

  function renderVoteRangeInfo() {
    if (!voteMaxNumber || voteMaxNumber < 1) voteRangeInfo.textContent = "현재 범위가 설정되지 않았습니다.";
    else voteRangeInfo.textContent = `현재 범위: 1 ~ ${voteMaxNumber} (사용된 번호: ${usedNumbers.size}개)`;
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
    const sorted = [...voteResults].sort((a, b) => a.number - b.number); // 오름차순
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
    if (Number.isNaN(value) || value < 1) { alert("1 이상의 숫자를 입력해주세요."); return; }
    if (voteMaxNumber !== null && voteMaxNumber !== value && (voteResults.length > 0 || usedNumbers.size > 0)) {
      const ok = confirm("범위를 변경하면 기존 추첨 결과가 모두 삭제됩니다.\n정말 변경하시겠습니까?");
      if (!ok) {
        voteMaxNumberInput.value = voteMaxNumber !== null ? String(voteMaxNumber) : "";
        return;
      }
      voteResults.length = 0;
      usedNumbers.clear();
      renderVoteResults();
    }
    voteMaxNumber = value;
    renderVoteRangeInfo();
  });

  // ====== 말풍선 요소 ======
  const bubbleOverlay = document.getElementById("bubbleOverlay");
  const bubbleName = document.getElementById("bubbleName");
  const bubbleNumber = document.getElementById("bubbleNumber");
  const bubbleOkBtn = document.getElementById("bubbleOkBtn");

  function showBubble(name, num) {
    bubbleName.textContent = name;
    bubbleNumber.textContent = String(num);
    bubbleOverlay.classList.remove("bubble-hidden");
  }
  function hideBubble() {
    bubbleOverlay.classList.add("bubble-hidden");
  }
  if (bubbleOkBtn) {
    bubbleOkBtn.addEventListener("click", hideBubble);
  }
  if (bubbleOverlay) {
    bubbleOverlay.addEventListener("click", (e) => {
      if (e.target === bubbleOverlay) hideBubble();
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !bubbleOverlay.classList.contains("bubble-hidden")) {
      hideBubble();
    }
  });

  voteDrawBtn.addEventListener("click", () => {
    const name = voteNameInput.value.trim();
    if (!voteMaxNumber || voteMaxNumber < 1) { alert("먼저 투표 인원 수를 설정해주세요."); return; }
    if (!name) { alert("이름을 입력해주세요."); return; }
    if (usedNumbers.size >= voteMaxNumber) { alert("모든 번호가 이미 사용되었습니다."); return; }

    let num;
    do { num = Math.floor(Math.random() * voteMaxNumber) + 1; } while (usedNumbers.has(num));
    usedNumbers.add(num);
    voteResults.push({ name, number: num });

    // 말풍선 크게 표시
    showBubble(name, num);

    voteLastResult.innerHTML = `마지막 결과: <strong>${name} : ${num}</strong>`;
    renderVoteResults();
    renderVoteRangeInfo();
    voteNameInput.value = "";
    voteNameInput.focus();
  });

  function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // TXT용(사람 읽기)
  function buildVoteLines() {
    const sorted = [...voteResults].sort((a, b) => a.number - b.number);
    return sorted.map((r) => `${r.name} : ${r.number}`).join("\n");
  }

  // CSV용(엑셀 컬럼 분리: name, number)
  function buildVoteCSV() {
    const header = "name,number";
    const sorted = [...voteResults].sort((a, b) => a.number - b.number);
    const lines = sorted.map(r => {
      const fields = [r.name, r.number];
      return fields.map(f => `"${String(f).replace(/"/g, '""')}"`).join(",");
    });
    return [header, ...lines].join("\n");
  }

  const voteExportCsvBtnEl = voteExportCsvBtn;
  if (voteExportCsvBtnEl) {
    voteExportCsvBtnEl.addEventListener("click", () => {
      if (voteResults.length === 0) { alert("저장할 데이터가 없습니다."); return; }
      const csv = buildVoteCSV();
      downloadFile("vote_results.csv", "\uFEFF" + csv, "text/csv;charset=utf-8");
    });
  }
  if (voteExportTxtBtn) {
    voteExportTxtBtn.addEventListener("click", () => {
      if (voteResults.length === 0) { alert("저장할 데이터가 없습니다."); return; }
      downloadFile("vote_results.txt", buildVoteLines(), "text/plain;charset=utf-8");
    });
  }

  renderVoteRangeInfo();
  renderVoteResults();

  /* ========= 경기 결과 저장 / 수정 / 삭제 ========= */
  const saveMatchBtn = document.getElementById("saveMatchBtn");
  const matchResultsBody = document.getElementById("matchResultsBody");
  const exportMatchesCsvBtn = document.getElementById("exportMatchesCsvBtn");
  const exportMatchesTxtBtn = document.getElementById("exportMatchesTxtBtn");
  const redNameInput = document.getElementById("redName");
  const blueNameInput = document.getElementById("blueName");

  /** match item: { id, durationSec, redName, redScore, blueName, blueScore, editing } */
  const matchResults = [];
  let matchAutoId = 1;

  function renderMatchResults() {
    matchResultsBody.innerHTML = "";
    if (matchResults.length === 0) {
      const tr = document.createElement("tr");
      tr.className = "empty";
      const td = document.createElement("td");
      td.colSpan = 7;
      td.textContent = "아직 저장된 결과가 없습니다.";
      tr.appendChild(td);
      matchResultsBody.appendChild(tr);
      return;
    }

    matchResults.forEach((m, idx) => {
      const tr = document.createElement("tr");
      tr.dataset.index = String(idx);

      const tdIdx = document.createElement("td");
      tdIdx.textContent = String(idx + 1);
      tr.appendChild(tdIdx);

      if (m.editing) {
        const tdDur = document.createElement("td");
        const inDur = document.createElement("input");
        inDur.type = "number";
        inDur.min = "0";
        inDur.step = "1";
        inDur.className = "inline-input num";
        inDur.dataset.field = "durationSec";
        inDur.value = String(m.durationSec);
        tdDur.appendChild(inDur);
        tr.appendChild(tdDur);

        const tdRName = document.createElement("td");
        const inRN = document.createElement("input");
        inRN.type = "text";
        inRN.className = "inline-input";
        inRN.dataset.field = "redName";
        inRN.value = m.redName;
        tdRName.appendChild(inRN);
        tr.appendChild(tdRName);

        const tdRScore = document.createElement("td");
        const inRS = document.createElement("input");
        inRS.type = "number";
        inRS.min = "0";
        inRS.step = "0.1";
        inRS.className = "inline-input num";
        inRS.dataset.field = "redScore";
        inRS.value = String(m.redScore);
        tdRScore.appendChild(inRS);
        tr.appendChild(tdRScore);

        const tdBName = document.createElement("td");
        const inBN = document.createElement("input");
        inBN.type = "text";
        inBN.className = "inline-input";
        inBN.dataset.field = "blueName";
        inBN.value = m.blueName;
        tdBName.appendChild(inBN);
        tr.appendChild(tdBName);

        const tdBScore = document.createElement("td");
        const inBS = document.createElement("input");
        inBS.type = "number";
        inBS.min = "0";
        inBS.step = "0.1";
        inBS.className = "inline-input num";
        inBS.dataset.field = "blueScore";
        inBS.value = String(m.blueScore);
        tdBScore.appendChild(inBS);
        tr.appendChild(tdBScore);

        const tdAct = document.createElement("td");
        tdAct.className = "results-actions";
        const btnSave = document.createElement("button");
        btnSave.className = "small primary";
        btnSave.dataset.action = "save";
        btnSave.textContent = "저장";
        const btnCancel = document.createElement("button");
        btnCancel.className = "small";
        btnCancel.dataset.action = "cancel";
        btnCancel.textContent = "취소";
        tdAct.appendChild(btnSave);
        tdAct.appendChild(btnCancel);
        tr.appendChild(tdAct);

      } else {
        const tdDur = document.createElement("td");
        tdDur.textContent = String(m.durationSec);
        tr.appendChild(tdDur);

        const tdRName = document.createElement("td");
        tdRName.textContent = m.redName;
        tr.appendChild(tdRName);

        const tdRScore = document.createElement("td");
        tdRScore.textContent = fmtScore(parseFloat(m.redScore));
        tr.appendChild(tdRScore);

        const tdBName = document.createElement("td");
        tdBName.textContent = m.blueName;
        tr.appendChild(tdBName);

        const tdBScore = document.createElement("td");
        tdBScore.textContent = fmtScore(parseFloat(m.blueScore));
        tr.appendChild(tdBScore);

        const tdAct = document.createElement("td");
        tdAct.className = "results-actions";
        const btnEdit = document.createElement("button");
        btnEdit.className = "small";
        btnEdit.dataset.action = "edit";
        btnEdit.textContent = "수정";
        const btnDel = document.createElement("button");
        btnDel.className = "small danger";
        btnDel.dataset.action = "delete";
        btnDel.textContent = "삭제";
        tdAct.appendChild(btnEdit);
        tdAct.appendChild(btnDel);
        tr.appendChild(tdAct);
      }

      matchResultsBody.appendChild(tr);
    });
  }

  function buildMatchesCSV() {
    const header = "duration_seconds,name_red,score_red,name_blue,score_blue";
    const lines = matchResults.map((m) => {
      const fields = [m.durationSec, m.redName, m.redScore, m.blueName, m.blueScore];
      return fields.map((f) => `"${String(f).replace(/"/g, '""')}"`).join(",");
    });
    return [header, ...lines].join("\n");
  }

  function buildMatchesTXT() {
    return matchResults
      .map((m) => `[${m.durationSec}s] RED ${m.redName}: ${m.redScore} | BLUE ${m.blueName}: ${m.blueScore}`)
      .join("\n");
  }

  const saveMatchBtnEl = saveMatchBtn;
  if (saveMatchBtnEl) {
    saveMatchBtnEl.addEventListener("click", () => {
      const redName = (redNameInput.value || "RED").trim();
      const blueName = (blueNameInput.value || "BLUE").trim();
      const redScore = fmtScore(scores.red);
      const blueScore = fmtScore(scores.blue);
      const durationSec = Math.floor(elapsedMs / 1000);

      const ok = confirm(
        `경기 결과를 저장할까요?\n` +
        `진행 시간: ${durationSec}초\n` +
        `RED(${redName}) 점수: ${redScore}\n` +
        `BLUE(${blueName}) 점수: ${blueScore}`
      );
      if (!ok) return;

      matchResults.push({
        id: matchAutoId++,
        durationSec,
        redName,
        redScore,
        blueName,
        blueScore,
        editing: false
      });

      renderMatchResults();
      flashPanel(document.querySelector('.panel[data-tab="results"]'));
    });
  }

  if (exportMatchesCsvBtn) {
    exportMatchesCsvBtn.addEventListener("click", () => {
      if (matchResults.length === 0) { alert("저장할 경기 결과가 없습니다."); return; }
      const csv = buildMatchesCSV();
      downloadFile("match_results.csv", "\uFEFF" + csv, "text/csv;charset=utf-8");
    });
  }
  if (exportMatchesTxtBtn) {
    exportMatchesTxtBtn.addEventListener("click", () => {
      if (matchResults.length === 0) { alert("저장할 경기 결과가 없습니다."); return; }
      downloadFile("match_results.txt", buildMatchesTXT(), "text/plain;charset=utf-8");
    });
  }

  matchResultsBody.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const tr = e.target.closest("tr");
    if (!tr) return;
    const idx = parseInt(tr.dataset.index, 10);
    if (Number.isNaN(idx)) return;
    const action = btn.dataset.action;

    const item = matchResults[idx];
    if (!item) return;

    if (action === "edit") {
      matchResults.forEach((m, i) => { if (i !== idx) m.editing = false; });
      item.editing = true;
      renderMatchResults();
      return;
    }

    if (action === "cancel") {
      item.editing = false;
      renderMatchResults();
      return;
    }

    if (action === "save") {
      const row = matchResultsBody.querySelector(`tr[data-index="${idx}"]`);
      if (!row) return;
      const inDur = row.querySelector('input[data-field="durationSec"]');
      const inRN = row.querySelector('input[data-field="redName"]');
      const inRS = row.querySelector('input[data-field="redScore"]');
      const inBN = row.querySelector('input[data-field="blueName"]');
      const inBS = row.querySelector('input[data-field="blueScore"]');

      let dur = parseInt((inDur.value || "0"), 10);
      if (Number.isNaN(dur) || dur < 0) dur = 0;

      const rn = (inRN.value || "RED").trim();
      const bn = (inBN.value || "BLUE").trim();

      const rsNum = Math.max(0, Math.round(parseFloat(inRS.value || "0") * 10) / 10);
      const bsNum = Math.max(0, Math.round(parseFloat(inBS.value || "0") * 10) / 10);

      const rs = fmtScore(rsNum);
      const bs = fmtScore(bsNum);

      item.durationSec = dur;
      item.redName = rn || "RED";
      item.blueName = bn || "BLUE";
      item.redScore = rs;
      item.blueScore = bs;
      item.editing = false;

      renderMatchResults();
      return;
    }

    if (action === "delete") {
      const ok = confirm("이 경기 결과를 삭제할까요?");
      if (!ok) return;
      matchResults.splice(idx, 1);
      renderMatchResults();
      return;
    }
  });

  renderMatchResults();
});