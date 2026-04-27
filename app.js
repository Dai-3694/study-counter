const STORAGE_KEY = "study-tv-timer-state-v1";
const FIVE_MINUTES = 5 * 60;
const STUDY_STATUSES = new Set(["idle", "running", "paused", "finished"]);
const TV_STATUSES = new Set(["idle", "running", "paused", "done"]);

const defaultState = {
  studyStatus: "idle", // idle | running | paused | finished
  studyAccumulated: 0,
  studyStartedAt: null,
  reviewVisible: false,
  adjustedSeconds: 0,
  approvedSeconds: 0,
  tvStatus: "idle", // idle | running | paused | done
  tvRemaining: 0,
  tvStartedAt: null,
};

let state = loadState();
let audioContext;

const elements = {
  approvedTime: document.getElementById("approvedTime"),
  statusText: document.getElementById("statusText"),
  studyTime: document.getElementById("studyTime"),
  studyStartBtn: document.getElementById("studyStartBtn"),
  studyPauseBtn: document.getElementById("studyPauseBtn"),
  studyEndBtn: document.getElementById("studyEndBtn"),
  reviewMessage: document.getElementById("reviewMessage"),
  adjustedTime: document.getElementById("adjustedTime"),
  minusFiveBtn: document.getElementById("minusFiveBtn"),
  plusFiveBtn: document.getElementById("plusFiveBtn"),
  confirmBtn: document.getElementById("confirmBtn"),
  tvTime: document.getElementById("tvTime"),
  tvStartBtn: document.getElementById("tvStartBtn"),
  tvPauseBtn: document.getElementById("tvPauseBtn"),
  tvResetBtn: document.getElementById("tvResetBtn"),
};

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return { ...defaultState };
    return normalizeState({ ...defaultState, ...JSON.parse(saved) });
  } catch (error) {
    console.warn("保存データを読み込めませんでした", error);
    return { ...defaultState };
  }
}

function normalizeState(nextState) {
  const numericKeys = ["studyAccumulated", "adjustedSeconds", "approvedSeconds", "tvRemaining"];
  numericKeys.forEach((key) => {
    nextState[key] = Math.max(0, Math.floor(Number(nextState[key]) || 0));
  });

  nextState.studyStartedAt = toValidTimestamp(nextState.studyStartedAt);
  nextState.tvStartedAt = toValidTimestamp(nextState.tvStartedAt);

  if (!STUDY_STATUSES.has(nextState.studyStatus)) {
    nextState.studyStatus = defaultState.studyStatus;
  }
  if (!TV_STATUSES.has(nextState.tvStatus)) {
    nextState.tvStatus = defaultState.tvStatus;
  }
  if (nextState.studyStatus !== "running") {
    nextState.studyStartedAt = null;
  }
  if (nextState.tvStatus !== "running") {
    nextState.tvStartedAt = null;
  }
  if (typeof nextState.reviewVisible !== "boolean") {
    nextState.reviewVisible = Boolean(nextState.reviewVisible);
  }

  return nextState;
}

function toValidTimestamp(value) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? Math.floor(timestamp) : null;
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("保存データを書き込めませんでした", error);
  }
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function getStudySeconds() {
  if (state.studyStatus !== "running" || !state.studyStartedAt) {
    return state.studyAccumulated;
  }
  return state.studyAccumulated + Math.max(0, nowSeconds() - state.studyStartedAt);
}

function getTvRemainingSeconds() {
  if (state.tvStatus !== "running" || !state.tvStartedAt) {
    return state.tvRemaining;
  }
  return Math.max(0, state.tvRemaining - Math.max(0, nowSeconds() - state.tvStartedAt));
}

function preserveTvCredit() {
  const remaining = getTvRemainingSeconds();
  state.tvRemaining = remaining;
  state.approvedSeconds = remaining;
  state.tvStartedAt = null;
  state.tvStatus = "idle";
  return remaining;
}

function formatTime(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function setStatusText() {
  if (state.tvStatus === "done") {
    elements.statusText.textContent = "テレビ時間はおしまい！また勉強をがんばろう。";
    return;
  }
  if (state.tvStatus === "running") {
    elements.statusText.textContent = "テレビタイマーが動いています。";
    return;
  }
  if (state.tvStatus === "paused") {
    elements.statusText.textContent = "テレビタイマーは一時停止中です。残り時間は次の勉強後も残ります。";
    return;
  }
  if (state.studyStatus === "running") {
    elements.statusText.textContent = "いい調子！勉強時間をカウント中です。";
    return;
  }
  if (state.studyStatus === "paused") {
    elements.statusText.textContent = "勉強タイマーは一時停止中です。再開できます。";
    return;
  }
  if (state.reviewVisible) {
    elements.statusText.textContent = "成果を見てもらって、テレビ時間を決めてもらおう。";
    return;
  }
  if (getTvRemainingSeconds() > 0) {
    elements.statusText.textContent = "テレビを見る準備ができました。";
    return;
  }
  elements.statusText.textContent = "まずは「勉強スタート」を押してね。";
}

function render() {
  const studySeconds = getStudySeconds();
  const tvRemaining = getTvRemainingSeconds();

  elements.studyTime.textContent = formatTime(studySeconds);
  elements.adjustedTime.textContent = formatTime(state.adjustedSeconds);
  elements.approvedTime.textContent = formatTime(tvRemaining);
  elements.tvTime.textContent = formatTime(tvRemaining);
  elements.reviewMessage.classList.toggle("hidden", !state.reviewVisible);

  elements.studyStartBtn.textContent = state.studyStatus === "paused" ? "勉強を再開" : "勉強スタート";
  elements.studyStartBtn.disabled = state.studyStatus === "running" || state.studyStatus === "finished" || state.tvStatus === "running";
  elements.studyPauseBtn.textContent = state.studyStatus === "paused" ? "停止中" : "一時停止";
  elements.studyPauseBtn.disabled = state.studyStatus !== "running";
  elements.studyEndBtn.disabled = !["running", "paused"].includes(state.studyStatus);

  const canAdjust = state.reviewVisible;
  elements.minusFiveBtn.disabled = !canAdjust || state.adjustedSeconds <= 0;
  elements.plusFiveBtn.disabled = !canAdjust;
  elements.confirmBtn.disabled = !canAdjust;

  elements.tvStartBtn.textContent = state.tvStatus === "paused" ? "テレビを再開" : "テレビを見る";
  elements.tvStartBtn.disabled = tvRemaining <= 0 || state.tvStatus === "running";
  elements.tvPauseBtn.textContent = state.tvStatus === "paused" ? "停止中" : "一時停止";
  elements.tvPauseBtn.disabled = state.tvStatus !== "running";
  elements.tvResetBtn.disabled = state.approvedSeconds <= 0 || state.tvStatus === "running";

  setStatusText();
}

function startStudy() {
  preserveTvCredit();
  state.studyStatus = "running";
  state.studyStartedAt = nowSeconds();
  state.reviewVisible = false;
  saveState();
  render();
}

function pauseStudy() {
  if (state.studyStatus !== "running") return;
  state.studyAccumulated = getStudySeconds();
  state.studyStartedAt = null;
  state.studyStatus = "paused";
  saveState();
  render();
}

function endStudy() {
  if (!["running", "paused"].includes(state.studyStatus)) return;
  preserveTvCredit();
  state.studyAccumulated = getStudySeconds();
  state.studyStartedAt = null;
  state.studyStatus = "finished";
  state.reviewVisible = true;
  state.adjustedSeconds = state.studyAccumulated;
  saveState();
  render();
}

function adjustTime(deltaSeconds) {
  if (!state.reviewVisible) return;
  state.adjustedSeconds = Math.max(0, state.adjustedSeconds + deltaSeconds);
  saveState();
  render();
}

function confirmTvTime() {
  const remainingTvSeconds = getTvRemainingSeconds();
  const earnedSeconds = Math.max(0, state.adjustedSeconds);
  state.approvedSeconds = remainingTvSeconds + earnedSeconds;
  state.tvRemaining = state.approvedSeconds;
  state.tvStartedAt = null;
  state.tvStatus = state.approvedSeconds > 0 ? "idle" : "done";
  state.reviewVisible = false;
  state.studyStatus = "idle";
  state.studyAccumulated = 0;
  state.studyStartedAt = null;
  saveState();
  render();
}

function startTv() {
  const remainingTvSeconds = getTvRemainingSeconds();
  if (remainingTvSeconds <= 0) return;
  unlockAudio();
  state.approvedSeconds = remainingTvSeconds;
  state.tvRemaining = remainingTvSeconds;
  state.tvStartedAt = nowSeconds();
  state.tvStatus = "running";
  saveState();
  render();
}

function pauseTv() {
  if (state.tvStatus !== "running") return;
  state.tvRemaining = getTvRemainingSeconds();
  state.approvedSeconds = state.tvRemaining;
  state.tvStartedAt = null;
  state.tvStatus = state.tvRemaining > 0 ? "paused" : "done";
  saveState();
  render();
}

function resetTv() {
  state.tvRemaining = state.approvedSeconds;
  state.tvStartedAt = null;
  state.tvStatus = state.approvedSeconds > 0 ? "idle" : "done";
  saveState();
  render();
}

function finishTv() {
  state.tvRemaining = 0;
  state.tvStartedAt = null;
  state.tvStatus = "done";
  state.approvedSeconds = 0;
  saveState();
  render();
  playAlarm();
}

function checkpointRunningTimers() {
  const currentTime = nowSeconds();

  if (state.studyStatus === "running" && state.studyStartedAt) {
    state.studyAccumulated = getStudySeconds();
    state.studyStartedAt = currentTime;
  }

  if (state.tvStatus === "running" && state.tvStartedAt) {
    state.tvRemaining = getTvRemainingSeconds();
    state.approvedSeconds = state.tvRemaining;
    state.tvStartedAt = currentTime;
  }

  saveState();
}

function handleAppHidden() {
  checkpointRunningTimers();
}

function handleAppVisible() {
  tick();
}

function unlockAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!audioContext) {
    audioContext = new AudioContextClass();
  }
  if (audioContext.state === "suspended") {
    const resumePromise = audioContext.resume();
    if (resumePromise?.catch) {
      resumePromise.catch((error) => {
        console.warn("AudioContextの開始に失敗しました", error);
      });
    }
  }
  return audioContext;
}

function playTone(startTime, frequency, duration) {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.001, startTime);
  gain.gain.exponentialRampToValueAtTime(0.25, startTime + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
}

function playAlarm() {
  const context = unlockAudio();
  if (!context) return;

  const base = context.currentTime;
  playTone(base, 660, 0.28);
  playTone(base + 0.35, 880, 0.28);
  playTone(base + 0.7, 660, 0.45);
}

function tick() {
  if (state.tvStatus === "running" && getTvRemainingSeconds() <= 0) {
    finishTv();
    return;
  }
  render();
}

document.addEventListener("pointerdown", unlockAudio, { once: true });
document.addEventListener("keydown", unlockAudio, { once: true });
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    handleAppHidden();
    return;
  }
  handleAppVisible();
});
window.addEventListener("pagehide", handleAppHidden);
window.addEventListener("pageshow", handleAppVisible);

if ("onfreeze" in document) {
  document.addEventListener("freeze", handleAppHidden);
}

elements.studyStartBtn.addEventListener("click", startStudy);
elements.studyPauseBtn.addEventListener("click", pauseStudy);
elements.studyEndBtn.addEventListener("click", endStudy);
elements.minusFiveBtn.addEventListener("click", () => adjustTime(-FIVE_MINUTES));
elements.plusFiveBtn.addEventListener("click", () => adjustTime(FIVE_MINUTES));
elements.confirmBtn.addEventListener("click", confirmTvTime);
elements.tvStartBtn.addEventListener("click", startTv);
elements.tvPauseBtn.addEventListener("click", pauseTv);
elements.tvResetBtn.addEventListener("click", resetTv);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((error) => {
      console.warn("Service Workerの登録に失敗しました", error);
    });
  });
}

setInterval(tick, 500);
tick();
