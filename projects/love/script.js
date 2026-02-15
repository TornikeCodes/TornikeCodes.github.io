const CONFIG = {
  celebrationMonthIndex: 1,
  valentineDay: 15,
  birthdayDay: 15,
  startHour: 9,
  startMinute: 58,
  startSecond: 39,
  schedule: {
    mode: "fixed_year",
    fixedYear: 2026,
  },
  songAudio: "song.mp3",
  songDurationSec: 188,
  transitionTimestampSec: 81,
  lyricsFile: "lyrics.txt",
  part1Lyrics: "lyrics-part1.txt",
  part2Lyrics: "lyrics-part2.txt",
  lockAtTransitionBeforeBirthday: false,
};



const el = {
  phaseLabel: document.getElementById("phase-label"),
  statusText: document.getElementById("status-text"),
  countdownSection: document.getElementById("countdown-section"),
  days: document.getElementById("days"),
  hours: document.getElementById("hours"),
  minutes: document.getElementById("minutes"),
  seconds: document.getElementById("seconds"),
  playerBox: document.getElementById("player-box"),
  playerTime: document.getElementById("player-time"),
  progressFill: document.getElementById("progress-fill"),
  startBtn: document.getElementById("start-btn"),
  lyric: document.getElementById("current-lyric"),
  lyricsWrap: document.getElementById("lyrics-wrap"),
  player: document.getElementById("song-player"),
  heartRain: document.getElementById("heart-rain"),
  emojiRain: document.getElementById("emoji-rain"),
  fxCanvas: document.getElementById("fx-canvas"),
  envelopeStage: document.getElementById("envelope-stage"),
  envelopeDrop: document.getElementById("envelope-drop"),
  envelopeArt: document.getElementById("envelope-art"),
  openEnvelopeBtn: document.getElementById("open-envelope-btn"),
  letterCard: document.getElementById("letter-card"),
  closeLetterBtn: document.getElementById("close-letter-btn"),
};

const realSchedule = resolveRealSchedule(new Date());
const state = {
  unlocked: false,
  birthdayTriggered: false,
  postTransitionAligned: false,
  autoplayAttempted: false,
  splitHold: false,
  splitResumeTimer: null,
  activeRainInterval: null,
  lyrics: [],
  lyricIndex: -1,
  duration: 0,
  hasPlayed: false,
  envelopeShown: false,
};

const fx = createFireworksSystem(el.fxCanvas);
el.player.src = CONFIG.songAudio;
startHeartRain();
disableLyricsBox();
init();

async function init() {
  state.lyrics = await loadUnifiedLyrics();
  bindEvents();
  tick();
  setInterval(tick, 1000);
}

function bindEvents() {
  el.startBtn.addEventListener("click", forceStartFromUserGesture);
  el.openEnvelopeBtn.addEventListener("click", openEnvelopeLetter);
  el.closeLetterBtn.addEventListener("click", closeEnvelopeLetter);

  el.player.addEventListener("loadedmetadata", () => {
    state.duration = Number.isFinite(el.player.duration) ? el.player.duration : 0;
    updatePlayerProgress();
  });

  el.player.addEventListener("play", () => {
    state.hasPlayed = true;
    enableLyricsBox();
  });

  el.player.addEventListener("timeupdate", onTimeUpdate);
  el.player.addEventListener("ended", onEnded);
  window.addEventListener("resize", () => fx.resize());
}

function tick() {
  const now = new Date();
  const { startAt, birthdayAt } = getSchedule();

  if (now < startAt) {
    applyCountdownState(startAt);
    return;
  }

  if (!state.unlocked) {
    state.unlocked = true;
    state.autoplayAttempted = false;
    state.birthdayTriggered = false;
    state.postTransitionAligned = false;
  }

  showPlayer();

  if (!state.autoplayAttempted) {
    state.autoplayAttempted = true;
    autoStartPlayback();
  }

  if (now < birthdayAt) {
    setPhase("before_midnight", birthdayAt);
    updateCountdown(birthdayAt - now);
    enforcePreMidnightSplit();
    updatePlayerProgress();
    return;
  }

  setPhase("birthday");
  updateCountdown(0);

  if (!state.birthdayTriggered) {
    state.birthdayTriggered = true;
    triggerBirthdayMoment();
  }

  if (!state.postTransitionAligned) {
    if (el.player.currentTime < CONFIG.transitionTimestampSec - 0.1) {
      el.player.currentTime = CONFIG.transitionTimestampSec;
    }
    state.postTransitionAligned = true;
  }

  if (state.splitHold) {
    state.splitHold = false;
    el.player.play().catch(() => {
      el.startBtn.classList.remove("hidden");
      el.startBtn.textContent = "Tap To Continue Song";
    });
  }

  if (el.player.paused) {
    el.player.play().then(() => {
      el.startBtn.classList.add("hidden");
    }).catch(() => {
      el.startBtn.classList.remove("hidden");
      el.startBtn.textContent = "Tap To Continue Song";
    });
  }

  updatePlayerProgress();
}

function applyCountdownState(startAt) {
  state.unlocked = false;
  state.autoplayAttempted = false;
  state.splitHold = false;

  showCountdown();
  setPhase("locked", startAt);
  updateCountdown(startAt - new Date());
}

function autoStartPlayback() {
  alignForMidnightTransition();
  el.player.play().then(() => {
    el.startBtn.classList.add("hidden");
  }).catch(() => {
    el.startBtn.classList.remove("hidden");
    el.startBtn.textContent = "Tap To Start Music";
  });
}

function forceStartFromUserGesture() {
  const now = new Date();
  const { birthdayAt } = getSchedule();

  if (now < birthdayAt) {
    alignForMidnightTransition();
  } else if (el.player.currentTime < CONFIG.transitionTimestampSec) {
    el.player.currentTime = CONFIG.transitionTimestampSec;
  }

  el.player.play().then(() => {
    el.startBtn.classList.add("hidden");
  });
}

function alignForMidnightTransition() {
  const now = new Date();
  const { birthdayAt } = getSchedule();
  const secondsToMidnight = Math.max(0, (birthdayAt - now) / 1000);

  if (secondsToMidnight <= CONFIG.transitionTimestampSec) {
    const desired = CONFIG.transitionTimestampSec - secondsToMidnight;
    if (Math.abs(el.player.currentTime - desired) > 0.35) {
      el.player.currentTime = desired;
    }
  } else if (el.player.currentTime >= CONFIG.transitionTimestampSec - 0.01) {
    el.player.currentTime = 0;
  }
}

function onTimeUpdate() {
  const now = new Date();
  const { birthdayAt } = getSchedule();

  if (now < birthdayAt) {
    enforcePreMidnightSplit();
  }

  updatePlayerProgress();
  syncLyrics();
}

function enforcePreMidnightSplit() {
  if (!CONFIG.lockAtTransitionBeforeBirthday) return;

  const now = new Date();
  const { birthdayAt } = getSchedule();
  if (now >= birthdayAt) return;
  if (birthdayAt - now <= 500) return;

  if (el.player.currentTime >= CONFIG.transitionTimestampSec) {
    el.player.pause();
    el.player.currentTime = CONFIG.transitionTimestampSec;
    state.splitHold = true;
    el.startBtn.classList.add("hidden");

    if (!state.splitResumeTimer) {
      const resumeInMs = Math.max(0, birthdayAt - now) + 80;
      state.splitResumeTimer = setTimeout(() => {
        state.splitResumeTimer = null;
        resumeAfterMidnightSplit();
      }, resumeInMs);
    }
  }
}

function resumeAfterMidnightSplit() {
  const now = new Date();
  const { birthdayAt } = getSchedule();

  if (now < birthdayAt) {
    const resumeInMs = Math.max(0, birthdayAt - now) + 80;
    state.splitResumeTimer = setTimeout(() => {
      state.splitResumeTimer = null;
      resumeAfterMidnightSplit();
    }, resumeInMs);
    return;
  }

  state.splitHold = false;
  if (el.player.currentTime < CONFIG.transitionTimestampSec - 0.1) {
    el.player.currentTime = CONFIG.transitionTimestampSec;
  }

  el.player.play().then(() => {
    el.startBtn.classList.add("hidden");
  }).catch(() => {
    el.startBtn.classList.remove("hidden");
    el.startBtn.textContent = "Tap To Continue Song";
  });
}

function onEnded() {
  revealEnvelopeOverlay();
}

function syncLyrics() {
  if (!state.lyrics.length) {
    el.lyric.textContent = "Add full-song lyrics in lyrics.txt (or split files).";
    return;
  }

  const t = el.player.currentTime;
  let idx = state.lyricIndex;

  if (idx < 0 || idx >= state.lyrics.length || t < state.lyrics[idx].time) {
    idx = 0;
  }

  while (idx + 1 < state.lyrics.length && t >= state.lyrics[idx + 1].time) {
    idx += 1;
  }

  if (idx !== state.lyricIndex) {
  state.lyricIndex = idx;

  const lyricEl = el.lyric;

  lyricEl.classList.add("fade-out");

  setTimeout(() => {
    lyricEl.textContent = state.lyrics[idx].text;

    lyricEl.classList.remove("fade-out");
    lyricEl.classList.add("fade-in");

    setTimeout(() => {
      lyricEl.classList.remove("fade-in");
    }, 400);

  }, 400);
}

}

function updatePlayerProgress() {
  const duration = safeDuration();
  const t = Math.min(el.player.currentTime, duration);
  const pct = duration > 0 ? (t / duration) * 100 : 0;

  el.progressFill.style.width = `${pct}%`;
  el.playerTime.textContent = `${formatClock(t)} / ${formatClock(duration)}`;
}

function safeDuration() {
  if (state.duration > 0) return state.duration;
  if (Number.isFinite(el.player.duration) && el.player.duration > 0) return el.player.duration;
  return CONFIG.songDurationSec;
}

function showCountdown() {
  el.countdownSection.classList.remove("hidden");
  el.playerBox.classList.add("hidden");
  disableLyricsBox();
}

function showPlayer() {
  el.countdownSection.classList.add("hidden");
  el.playerBox.classList.remove("hidden");
}

function disableLyricsBox() {
  if (state.hasPlayed) return;
  el.lyricsWrap.classList.add("is-disabled");
  el.lyricsWrap.setAttribute("aria-disabled", "true");
  el.lyric.textContent = "Lyrics unlock when the song starts.";
}

function enableLyricsBox() {
  el.lyricsWrap.classList.remove("is-disabled");
  el.lyricsWrap.setAttribute("aria-disabled", "false");
}

function revealEnvelopeOverlay() {
  if (state.envelopeShown) return;
  state.envelopeShown = true;

  el.envelopeStage.classList.add("visible");
  el.envelopeStage.setAttribute("aria-hidden", "false");
  el.letterCard.classList.add("hidden");
}

function hideEnvelopeOverlay() {
  el.envelopeStage.classList.remove("visible");
  el.envelopeStage.setAttribute("aria-hidden", "true");
  el.envelopeArt.classList.remove("open");
  el.letterCard.classList.add("hidden");
}

function openEnvelopeLetter() {
  el.envelopeArt.classList.add("open");
  el.envelopeStage.classList.add("letter-open");
  setTimeout(() => {
    el.letterCard.classList.remove("hidden");
    el.letterCard.scrollTop = 0;
  }, 420);
}

function closeEnvelopeLetter() {
  el.letterCard.classList.add("hidden");
  el.envelopeArt.classList.remove("open");
  el.envelopeStage.classList.remove("letter-open");
}

function setPhase(phase, at) {
  if (phase === "locked") {
    el.phaseLabel.textContent = "❤️ 11:59 ❤️";
    el.statusText.textContent = `This gift opens when the countdown ends (${formatDate(at)}).`;
  }

  if (phase === "before_midnight") {
    el.phaseLabel.textContent = "❤️ 11:59 ❤️";
    el.statusText.textContent = "!!! Happy valentines baby !!!";
  }

  if (phase === "birthday") {
    el.phaseLabel.textContent = "❤️ 12:00 ❤️";
    el.statusText.textContent = "!!! Happy birthday baby !!!";
  }

}

function resetPlaybackForModeSwitch() {
  if (state.splitResumeTimer) {
    clearTimeout(state.splitResumeTimer);
    state.splitResumeTimer = null;
  }

  state.unlocked = false;
  state.autoplayAttempted = false;
  state.birthdayTriggered = false;
  state.postTransitionAligned = false;
  state.splitHold = false;
  state.lyricIndex = -1;
  state.hasPlayed = false;
  state.envelopeShown = false;

  el.player.pause();
  el.player.currentTime = 0;
  el.startBtn.textContent = "Tap To Start Music";
  el.startBtn.classList.add("hidden");

  startHeartRain();
  disableLyricsBox();
  hideEnvelopeOverlay();
}

function getSchedule() {
  return realSchedule;
}

function resolveRealSchedule(now) {
  let year = now.getFullYear();

  if (CONFIG.schedule.mode === "fixed_year") {
    year = CONFIG.schedule.fixedYear;
  } else {
    const thisYearBirthdayEnd = new Date(now.getFullYear(), CONFIG.celebrationMonthIndex, CONFIG.birthdayDay, 23, 59, 59, 999);
    year = now > thisYearBirthdayEnd ? now.getFullYear() + 1 : now.getFullYear();
  }

  return {
    startAt: new Date(
      year,
      CONFIG.celebrationMonthIndex,
      CONFIG.valentineDay,
      CONFIG.startHour,
      CONFIG.startMinute,
      CONFIG.startSecond,
      0
    ),
    birthdayAt: new Date(year, CONFIG.celebrationMonthIndex, CONFIG.birthdayDay, 0, 0, 0, 0),
  };
}

function updateCountdown(msLeft) {
  const safe = Math.max(0, msLeft);
  const totalSeconds = Math.floor(safe / 1000);
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  el.days.textContent = pad(d);
  el.hours.textContent = pad(h);
  el.minutes.textContent = pad(m);
  el.seconds.textContent = pad(s);
}

function formatDate(date) {
  return date.toLocaleString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatClock(sec) {
  const safe = Math.max(0, Math.floor(sec));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function pad(v) {
  return String(v).padStart(2, "0");
}

async function loadUnifiedLyrics() {
  const full = await fetchText(CONFIG.lyricsFile);
  if (full.ok) {
    const parsed = parseLyrics(full.text);
    if (parsed.length) return parsed;
  }

  const [p1, p2] = await Promise.all([
    fetchText(CONFIG.part1Lyrics),
    fetchText(CONFIG.part2Lyrics),
  ]);

  const part1 = p1.ok ? parseLyrics(p1.text) : [];
  const part2 = p2.ok ? parseLyrics(p2.text) : [];

  if (!part1.length && !part2.length) return [];
  if (!part1.length) return maybeShiftPart2(part2);
  if (!part2.length) return part1;

  const shiftedPart2 = maybeShiftPart2(part2);
  return [...part1, ...shiftedPart2].sort((a, b) => a.time - b.time);
}

function maybeShiftPart2(part2) {
  if (!part2.length) return [];
  const first = part2[0].time;
  const isAbsolute = first >= Math.max(1, CONFIG.transitionTimestampSec - 2);
  if (isAbsolute) return part2;
  return part2.map((line) => ({
    time: line.time + CONFIG.transitionTimestampSec,
    text: line.text,
  }));
}

async function fetchText(path) {
  try {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) return { ok: false, text: "" };
    return { ok: true, text: await response.text() };
  } catch {
    return { ok: false, text: "" };
  }
}

function parseLyrics(raw) {
  const lines = raw.split(/\r?\n/);
  const parsed = [];

  for (const line of lines) {
    const match = line.match(/^\s*\[(\d{2}):(\d{2})(?:\.(\d{1,3}))?\]\s*(.+)\s*$/);
    if (!match) continue;

    const mm = Number(match[1]);
    const ss = Number(match[2]);
    const ms = match[3] ? Number(match[3].padEnd(3, "0")) : 0;
    parsed.push({ time: mm * 60 + ss + ms / 1000, text: match[4] });
  }

  return parsed.sort((a, b) => a.time - b.time);
}

function startHeartRain() {
  stopRain();
  state.activeRainInterval = setInterval(() => {
    spawnFallNode(el.heartRain, "❤", 0.8, 1.6, 9, 14);
  }, 180);
}

function startTadaRain() {
  stopRain();
  state.activeRainInterval = setInterval(() => {
    spawnFallNode(el.emojiRain, "🎉", 0.9, 1.7, 8, 12);
  }, 180);
}

function stopRain() {
  if (state.activeRainInterval) {
    clearInterval(state.activeRainInterval);
    state.activeRainInterval = null;
  }
  el.heartRain.innerHTML = "";
  el.emojiRain.innerHTML = "";
}

function spawnFallNode(container, symbol, minScale, maxScale, minDuration, maxDuration) {
  const node = document.createElement("span");
  node.className = "fall";
  node.textContent = symbol;
  node.style.left = `${Math.random() * 100}%`;
  node.style.fontSize = `${(Math.random() * (maxScale - minScale) + minScale).toFixed(2)}rem`;
  node.style.animationDuration = `${(Math.random() * (maxDuration - minDuration) + minDuration).toFixed(2)}s`;
  node.style.opacity = (Math.random() * 0.4 + 0.5).toFixed(2);
  container.appendChild(node);
  setTimeout(() => node.remove(), 16000);
}

function triggerBirthdayMoment() {
  el.heartRain.innerHTML = "";
  fx.burstSequence(18);
  setTimeout(startTadaRain, 2200);
}

function createFireworksSystem(canvas) {
  const ctx = canvas.getContext("2d");
  let w = 0;
  let h = 0;
  let particles = [];
  let raf = null;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }

  function createBurst(x, y) {
    const count = 52;
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.15;
      const speed = Math.random() * 4 + 1.8;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color: `hsl(${Math.floor(Math.random() * 50 + 340)}, 100%, ${Math.floor(Math.random() * 20 + 60)}%)`,
      });
    }
  }

  function animate() {
    ctx.clearRect(0, 0, w, h);
    particles = particles.filter((p) => p.life > 0.02);

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.035;
      p.life *= 0.97;

      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    if (particles.length) {
      raf = requestAnimationFrame(animate);
    } else {
      cancelAnimationFrame(raf);
      raf = null;
      ctx.clearRect(0, 0, w, h);
    }
  }

  function burstSequence(totalBursts) {
    resize();
    for (let i = 0; i < totalBursts; i += 1) {
      setTimeout(() => {
        createBurst(Math.random() * w * 0.8 + w * 0.1, Math.random() * h * 0.45 + h * 0.08);
        if (!raf) animate();
      }, i * 160);
    }
  }

  resize();
  return { resize, burstSequence };
}
