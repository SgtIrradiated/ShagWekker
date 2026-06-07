const DEFAULT_EVENTS = [
  {
    id: "core-focus",
    time: "10:15",
    label: "Eerste Kleine Pauze",
    recurrence: "Daily",
    description: "Eerste Kleine Pauze = Eerste Shaggie Ritueel -15 Min",
    color: "#9b6aff"
  },
  {
    id: "core-lunch",
    time: "12:00",
    label: "Der Große Pauze",
    recurrence: "Daily",
    description: "Maximum Shag Tijd -30 Min",
    color: "#6affc8"
  },
  {
    id: "core-afternoon",
    time: "14:30",
    label: "Middag Kleine Pauze",
    recurrence: "MonWedThu",
    description: "Middag Shag Shuffle - even uitblazen en de middagshag aansteken. -15 Min",
    color: "#ffc66a"
  },
  {
    id: "core-wrap",
    time: "16:00",
    label: "Weg hier",
    recurrence: "MonWedThu",
    description: "Sluit de dag af met een stevige shag.",
    color: "#ff9b6a"
  }
];

const DEFAULT_EVENT_IDS = new Set(DEFAULT_EVENTS.map(event => event.id));

const STORAGE_KEY = "shagwekker.customEvents.v1";
const LEGACY_KEY = "multiCountdown.times";
const SUMMARY_MESSAGES = [
  "You're ahead of the rhythm—keep the groove going!",
  "Nice! Your cadence is crystal clear.",
  "Dial in your focus and enjoy the flow.",
  "Double-check your next cue to stay effortless."
];

const AUDIO_DIRECTORY = "audio/";
const AUDIO_EXTENSIONS = [".mp3", ".ogg", ".wav", ".m4a", ".aac", ".flac", ".webm"];
const AUDIO_PROGRESS_STEPS = 1000;
// Pas deze lijst aan om vaste tracks te tonen zonder dat er dynamische scanning nodig is.
const STATIC_AUDIO_REFERENCES = [
  { src: `${AUDIO_DIRECTORY}Shag Track.flac`, title: "De Shag Trek", artist: "Shag Archives" },
  { src: `${AUDIO_DIRECTORY}audio.mp3`, title: "Blije Man", artist: "Shag Collective" },
  { src: `${AUDIO_DIRECTORY}nicotinerzshy.mp3`, title: "Donaldy Trumpowich", artist: "Kremlin Cut" },
  { src: `${AUDIO_DIRECTORY}bankametaal.mp3`, title: "Banka Wird Zur Snackbar", artist: "Harammstein" },
  { src: `${AUDIO_DIRECTORY}blyat.mp3`, title: "Blyat", artist: "Ruski Rolls" }
];

const DEFAULT_ACCENT_COLOR = "#ff0000";
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

const PREFERENCE_KEYS = {
  highContrast: "shagwekker.preferences.highContrast",
  accentColor: "shagwekker.preferences.accentColor"
};

const SHAGMETER_STORAGE_KEY = "shagwekker.shagmeter.state.v1";

function readStoredPreference(key) {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    console.warn(`Unable to read preference "${key}"`, error);
    return null;
  }
}

function writeStoredPreference(key, value) {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    console.warn(`Unable to persist preference "${key}"`, error);
  }
}

function normalizeHexColor(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (HEX_COLOR_PATTERN.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return null;
}

function resolveHexColor(value, fallback = DEFAULT_ACCENT_COLOR) {
  return normalizeHexColor(value) ?? fallback;
}

function getCurrentAccentColor() {
  const inline = normalizeHexColor(document.documentElement.style.getPropertyValue("--accent"));
  if (inline) {
    return inline;
  }
  if (typeof window !== "undefined" && typeof window.getComputedStyle === "function") {
    const computed = normalizeHexColor(
      window.getComputedStyle(document.documentElement).getPropertyValue("--accent")
    );
    if (computed) {
      return computed;
    }
  }
  return DEFAULT_ACCENT_COLOR;
}

const pad = n => String(n).padStart(2, "0");
const toMinutes = hhmm => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const uniqueId = () => `evt-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 7)}`;

const AUDIO_EXTENSION_CHECK = new Set(AUDIO_EXTENSIONS.map(ext => ext.toLowerCase()));

function isAllowedAudioFile(fileName = "") {
  const lower = fileName.toLowerCase();
  return Array.from(AUDIO_EXTENSION_CHECK).some(ext => lower.endsWith(ext));
}

function sanitizeAudioFileName(path = "") {
  let decoded = path;
  try {
    decoded = decodeURIComponent(path);
  } catch (error) {
    decoded = path;
  }
  decoded = decoded.split(/[?#]/)[0];
  const normalized = decoded.replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);
  return segments.pop() || normalized;
}

function prettifyTrackLabel(path = "") {
  const fileName = sanitizeAudioFileName(path).replace(/\.[^.]+$/, "");
  if (!fileName.trim()) {
    return "Onbenoemde track";
  }
  return fileName
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b(\p{L})/gu, match => match.toUpperCase());
}

function resolveAudioUrl(path = "") {
  if (/^https?:/i.test(path)) {
    return path;
  }
  const trimmed = path.replace(/^\.\//, "").replace(/^\//, "");
  if (!trimmed) {
    return "";
  }
  return trimmed.startsWith(AUDIO_DIRECTORY) ? trimmed : `${AUDIO_DIRECTORY}${trimmed}`;
}

function createTrackDescriptor(path, explicitLabel, meta = {}) {
  if (!path && path !== 0) {
    return null;
  }
  const reference = String(path).trim();
  if (!reference) {
    return null;
  }
  const fileName = sanitizeAudioFileName(reference);
  if (!isAllowedAudioFile(fileName)) {
    return null;
  }
  const url = resolveAudioUrl(reference);
  if (!url) {
    return null;
  }
  const label = explicitLabel?.toString().trim() || prettifyTrackLabel(fileName);
  const descriptor = { url, label, fileName };
  if (meta && typeof meta === "object") {
    const { artist, cover, album } = meta;
    if (typeof artist === "string" && artist.trim()) {
      descriptor.artist = artist.trim();
    }
    if (typeof cover === "string" && cover.trim()) {
      descriptor.cover = cover.trim();
    }
    if (typeof album === "string" && album.trim()) {
      descriptor.album = album.trim();
    }
  }
  return descriptor;
}

function dedupeTracks(tracks) {
  const seen = new Set();
  return tracks.filter(track => {
    if (!track || !track.url) {
      return false;
    }
    const key = track.url;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

const STATIC_AUDIO_LIBRARY = dedupeTracks(
  STATIC_AUDIO_REFERENCES.map(entry => {
    if (typeof entry === "string") {
      return createTrackDescriptor(entry);
    }
    if (entry && typeof entry === "object") {
      const reference = entry.src || entry.url || entry.file || entry.path || entry.href;
      const meta = {
        artist: entry.artist || entry.author || entry.creator,
        cover: entry.cover || entry.art || entry.image,
        album: entry.album,
      };
      return createTrackDescriptor(reference, entry.title || entry.label || entry.name, meta);
    }
    return null;
  }).filter(Boolean)
);

async function discoverAudioTracks() {
  let configured = [];
  if (typeof window !== "undefined") {
    const custom = window.SHAG_AUDIO_TRACKS;
    if (Array.isArray(custom)) {
      configured = custom
        .map(entry => {
          if (typeof entry === "string") {
            return createTrackDescriptor(entry);
          }
          if (entry && typeof entry === "object") {
            const reference = entry.src || entry.url || entry.file || entry.path || entry.href;
            const meta = {
              artist: entry.artist || entry.author || entry.creator,
              cover: entry.cover || entry.art || entry.image,
              album: entry.album,
            };
            return createTrackDescriptor(reference, entry.title || entry.label || entry.name, meta);
          }
          return null;
        })
        .filter(Boolean);
    }
  }

  return dedupeTracks([...configured, ...STATIC_AUDIO_LIBRARY]);
}

function formatAudioTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return `${minutes}:${pad(remainder)}`;
}

const AUDIO_STATE_KEY = "shagwekker.audio.state.v1";
const LEGACY_AUDIO_SHUFFLE_KEY = "shagwekker.audio.shuffle.v1";
const AUDIO_REPEAT_MODES = ["off", "all", "one"];
const AUDIO_DEFAULT_VOLUME = 0.8;
const AUDIO_VISUALIZER_FFT = 64;

function loadAudioState() {
  const raw = readStoredPreference(AUDIO_STATE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch (error) {
      console.warn("Kon audiostatus niet lezen", error);
    }
  }
  // Migrate the legacy shuffle-only preference into the unified state shape.
  const legacyShuffle = readStoredPreference(LEGACY_AUDIO_SHUFFLE_KEY);
  if (legacyShuffle !== null) {
    return { shuffle: legacyShuffle === "true" };
  }
  return {};
}

function initAudioPlayer() {
  const playerEl = document.querySelector("[data-audio-player]");
  if (!playerEl) {
    return;
  }

  const els = {
    lounge: playerEl.closest(".audio-lounge"),
    select: playerEl.querySelector("[data-audio-select]"),
    status: playerEl.querySelector("[data-audio-status]"),
    empty: playerEl.querySelector("[data-audio-empty]"),
    title: playerEl.querySelector("[data-audio-title]"),
    meta: playerEl.querySelector("[data-audio-meta]"),
    art: playerEl.querySelector("[data-audio-art]"),
    play: playerEl.querySelector("[data-audio-play]"),
    stop: playerEl.querySelector("[data-audio-stop]"),
    prev: playerEl.querySelector("[data-audio-prev]"),
    next: playerEl.querySelector("[data-audio-next]"),
    shuffle: playerEl.querySelector("[data-audio-shuffle]"),
    repeat: playerEl.querySelector("[data-audio-repeat]"),
    mute: playerEl.querySelector("[data-audio-mute]"),
    download: playerEl.querySelector("[data-audio-download]"),
    progress: playerEl.querySelector("[data-audio-progress]"),
    progressTrack: playerEl.querySelector(".audio-player__progress-track"),
    current: playerEl.querySelector("[data-audio-current]"),
    total: playerEl.querySelector("[data-audio-total]"),
    volume: playerEl.querySelector("[data-audio-volume]"),
    volumeBox: playerEl.querySelector(".audio-player__volume-box"),
    waveform: playerEl.querySelector(".audio-player__waveform"),
  };

  if (!els.select || !els.status || !els.play || !els.stop || !els.progress || !els.current || !els.total) {
    return;
  }

  els.progress.max = String(AUDIO_PROGRESS_STEPS);
  playerEl.dataset.state = "loading";

  const defaults = {
    title: els.title?.textContent?.trim() || "Shag Archives Mix",
    meta: els.meta?.textContent?.trim() || "Wachtend op selectie",
    cover: els.art?.getAttribute("data-fallback-src") || els.art?.getAttribute("src") || "",
  };

  const persisted = loadAudioState();
  const reducedMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const audio = new Audio();
  audio.preload = "auto";

  const state = {
    tracks: [],
    index: -1,
    seeking: false,
    shuffle: Boolean(persisted.shuffle),
    repeat: AUDIO_REPEAT_MODES.includes(persisted.repeat) ? persisted.repeat : "off",
    muted: Boolean(persisted.muted),
    lastVolume: clampVolume(persisted.volume, AUDIO_DEFAULT_VOLUME),
    pendingSeek: typeof persisted.time === "number" && persisted.time > 0 ? persisted.time : 0,
  };

  audio.volume = state.lastVolume;
  audio.muted = state.muted;

  /* ── Persistence ──────────────────────────────────────────── */
  let persistTimer = 0;
  const snapshot = () => ({
    index: state.index,
    time: Number.isFinite(audio.currentTime) ? Math.floor(audio.currentTime) : 0,
    volume: state.lastVolume,
    muted: state.muted,
    shuffle: state.shuffle,
    repeat: state.repeat,
  });
  const persist = () => writeStoredPreference(AUDIO_STATE_KEY, JSON.stringify(snapshot()));
  const persistSoon = () => {
    if (persistTimer) {
      return;
    }
    persistTimer = window.setTimeout(() => {
      persistTimer = 0;
      persist();
    }, 1500);
  };

  /* ── Status helper ────────────────────────────────────────── */
  const setStatus = message => {
    els.status.textContent = message;
  };

  /* ── Now-playing metadata ─────────────────────────────────── */
  const renderTrackDetail = track => {
    if (els.title) {
      els.title.textContent = track?.label ?? defaults.title;
    }
    if (els.meta) {
      const meta = track
        ? track.artist || track.album || (track.fileName ? prettifyTrackLabel(track.fileName) : null) || "Shag Archives"
        : defaults.meta;
      els.meta.textContent = meta;
    }
    if (els.art) {
      const cover = track?.cover || defaults.cover;
      if (cover) {
        els.art.src = cover;
      }
      els.art.alt = track ? `Album art voor ${track.label}` : "Album art placeholder";
    }
    updateMediaSession(track);
  };

  /* ── Media Session (OS / lock-screen controls) ────────────── */
  const updateMediaSession = track => {
    if (!("mediaSession" in navigator)) {
      return;
    }
    if (!track) {
      navigator.mediaSession.metadata = null;
      return;
    }
    try {
      const artwork = track.cover || defaults.cover;
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: track.label,
        artist: track.artist || "Shag Archives",
        album: track.album || "ShagWekker Soundscapes",
        artwork: artwork ? [{ src: artwork, sizes: "512x512", type: "image/png" }] : [],
      });
    } catch (error) {
      console.warn("Media Session metadata mislukt", error);
    }
  };

  if ("mediaSession" in navigator) {
    const ms = navigator.mediaSession;
    const safe = fn => () => {
      try {
        fn();
      } catch (error) {
        console.warn("Media Session actie mislukt", error);
      }
    };
    ms.setActionHandler("play", safe(() => play()));
    ms.setActionHandler("pause", safe(() => audio.pause()));
    ms.setActionHandler("previoustrack", safe(() => cycle(-1)));
    ms.setActionHandler("nexttrack", safe(() => cycle(1)));
    ms.setActionHandler("seekto", safe(details => {
      if (details && typeof details.seekTime === "number") {
        audio.currentTime = details.seekTime;
      }
    }));
  }

  /* ── Transport button states ──────────────────────────────── */
  const renderToggle = (button, active) => {
    if (!button) {
      return;
    }
    button.setAttribute("aria-pressed", String(Boolean(active)));
    button.classList.toggle("is-active", Boolean(active));
  };

  const renderTransport = () => {
    renderToggle(els.shuffle, state.shuffle);
    if (els.repeat) {
      els.repeat.dataset.mode = state.repeat;
      const active = state.repeat !== "off";
      els.repeat.setAttribute("aria-pressed", String(active));
      els.repeat.classList.toggle("is-active", active);
      els.repeat.classList.toggle("is-one", state.repeat === "one");
      const labels = { off: "Herhaal: uit", all: "Herhaal: alles", one: "Herhaal: deze track" };
      els.repeat.setAttribute("aria-label", labels[state.repeat]);
    }
    renderMute();
  };

  const renderMute = () => {
    const silent = state.muted || state.lastVolume === 0;
    renderToggle(els.mute, silent);
    if (els.mute) {
      els.mute.setAttribute("aria-label", silent ? "Geluid aan" : "Dempen");
    }
    playerEl.classList.toggle("is-muted", silent);
  };

  const renderPlayState = playing => {
    playerEl.classList.toggle("is-playing", playing);
    if (els.lounge) {
      els.lounge.classList.toggle("audio-lounge--playing", playing);
    }
    els.play.setAttribute("aria-label", playing ? "Pause" : "Play");
    els.play.setAttribute("aria-pressed", String(playing));
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = playing ? "playing" : "paused";
    }
  };

  /* ── Progress / time ──────────────────────────────────────── */
  const setProgressVisual = ratio => {
    const pct = `${(Math.max(0, Math.min(1, ratio)) * 100).toFixed(2)}%`;
    els.progressTrack?.style.setProperty("--audio-progress", pct);
  };

  const renderBuffered = () => {
    if (!els.progressTrack) {
      return;
    }
    let ratio = 0;
    if (Number.isFinite(audio.duration) && audio.duration > 0 && audio.buffered.length) {
      ratio = Math.max(0, Math.min(1, audio.buffered.end(audio.buffered.length - 1) / audio.duration));
    }
    els.progressTrack.style.setProperty("--audio-buffered", `${(ratio * 100).toFixed(2)}%`);
  };

  const resetProgress = () => {
    els.progress.value = "0";
    els.progress.disabled = true;
    els.progressTrack?.classList.remove("is-seeking");
    setProgressVisual(0);
    els.progressTrack?.style.setProperty("--audio-buffered", "0%");
    els.current.textContent = "0:00";
    els.total.textContent = "0:00";
  };

  const renderProgress = ended => {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
      setProgressVisual(0);
      return;
    }
    const ratio = ended ? 1 : Math.max(0, Math.min(1, audio.currentTime / audio.duration));
    els.progress.value = String(Math.round(ratio * AUDIO_PROGRESS_STEPS));
    setProgressVisual(ratio);
    renderBuffered();
    els.current.textContent = formatAudioTime(ended ? audio.duration : audio.currentTime);
    els.total.textContent = formatAudioTime(audio.duration);
  };

  /* ── Volume ───────────────────────────────────────────────── */
  const applyVolumeVisual = ratio => {
    const pct = `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`;
    els.volume?.style.setProperty("--audio-volume", pct);
    els.volumeBox?.style.setProperty("--audio-volume", pct);
  };

  const applyVolume = (ratio, { fromSlider = false } = {}) => {
    const clamped = clampVolume(ratio, AUDIO_DEFAULT_VOLUME);
    state.lastVolume = clamped;
    state.muted = clamped === 0;
    audio.muted = state.muted;
    audio.volume = clamped;
    applyVolumeVisual(clamped);
    if (els.volume && !fromSlider) {
      els.volume.value = String(Math.round(clamped * 100));
    }
    renderMute();
    persistSoon();
  };

  const toggleMute = () => {
    if (state.muted || audio.muted) {
      state.muted = false;
      audio.muted = false;
      if (state.lastVolume === 0) {
        applyVolume(AUDIO_DEFAULT_VOLUME);
        return;
      }
      audio.volume = state.lastVolume;
    } else {
      state.muted = true;
      audio.muted = true;
    }
    renderMute();
    persistSoon();
  };

  /* ── Download link ────────────────────────────────────────── */
  const updateDownloadLink = track => {
    if (!els.download) {
      return;
    }
    if (track) {
      els.download.hidden = false;
      els.download.href = track.url;
      const name = (track.fileName || track.label.replace(/\s+/g, "-")).toLowerCase();
      els.download.setAttribute("download", name);
      els.download.setAttribute("aria-label", `Download ${track.label}`);
    } else {
      els.download.hidden = true;
      els.download.removeAttribute("href");
      els.download.removeAttribute("aria-label");
    }
  };

  /* ── Live Web Audio visualizer ────────────────────────────── */
  const viz = { ctx: null, analyser: null, data: null, raf: 0, bars: [], failed: false };
  if (els.waveform) {
    viz.bars = Array.from(els.waveform.querySelectorAll("span"));
  }

  const setupVisualizer = () => {
    if (viz.ctx || viz.failed || reducedMotion || !viz.bars.length) {
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) {
      viz.failed = true;
      return;
    }
    try {
      viz.ctx = new Ctx();
      const source = viz.ctx.createMediaElementSource(audio);
      viz.analyser = viz.ctx.createAnalyser();
      viz.analyser.fftSize = AUDIO_VISUALIZER_FFT;
      viz.analyser.smoothingTimeConstant = 0.8;
      viz.data = new Uint8Array(viz.analyser.frequencyBinCount);
      source.connect(viz.analyser);
      viz.analyser.connect(viz.ctx.destination);
      els.waveform.classList.add("audio-player__waveform--live");
    } catch (error) {
      console.warn("Visualizer niet beschikbaar, val terug op animatie", error);
      viz.failed = true;
      viz.ctx = null;
    }
  };

  const renderVisualizer = () => {
    if (!viz.analyser) {
      return;
    }
    viz.analyser.getByteFrequencyData(viz.data);
    const bins = viz.data.length;
    for (let i = 0; i < viz.bars.length; i += 1) {
      const value = viz.data[Math.min(i, bins - 1)] / 255;
      const height = 8 + value * 92;
      viz.bars[i].style.height = `${height.toFixed(1)}%`;
    }
    viz.raf = window.requestAnimationFrame(renderVisualizer);
  };

  const startVisualizer = () => {
    if (viz.failed || reducedMotion) {
      return;
    }
    setupVisualizer();
    if (viz.ctx && viz.ctx.state === "suspended") {
      viz.ctx.resume().catch(() => {});
    }
    if (viz.analyser && !viz.raf) {
      viz.raf = window.requestAnimationFrame(renderVisualizer);
    }
  };

  const stopVisualizer = () => {
    if (viz.raf) {
      window.cancelAnimationFrame(viz.raf);
      viz.raf = 0;
    }
    viz.bars.forEach(bar => {
      bar.style.removeProperty("height");
    });
  };

  /* ── Track loading & playback ─────────────────────────────── */
  const loadTrack = (index, { autoplay = false } = {}) => {
    if (!state.tracks.length) {
      renderTrackDetail(null);
      return;
    }
    const next = Number(index);
    if (!Number.isInteger(next) || !state.tracks[next]) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      state.index = -1;
      resetProgress();
      updateDownloadLink(null);
      renderTrackDetail(null);
      setStatus("Selecteer een track om te luisteren.");
      els.select.value = "";
      return;
    }

    const track = state.tracks[next];
    const wasPlaying = !audio.paused && !audio.ended;
    audio.pause();
    state.index = next;
    els.select.value = String(next);
    resetProgress();
    updateDownloadLink(track);
    audio.src = track.url;
    audio.load();
    renderTrackDetail(track);
    setStatus(`Geselecteerd: ${track.label}. Druk op play.`);

    if (autoplay || wasPlaying) {
      audio.addEventListener("canplay", () => play(), { once: true });
    }
    persistSoon();
  };

  function play() {
    if (!state.tracks.length) {
      return;
    }
    if (state.index === -1) {
      loadTrack(0);
    }
    startVisualizer();
    return audio
      .play()
      .then(() => {
        if (state.index >= 0) {
          setStatus(`Aan het spelen: ${state.tracks[state.index].label}`);
        }
      })
      .catch(error => {
        console.warn("Afspelen geblokkeerd", error);
        setStatus("Afspelen werd geblokkeerd. Klik opnieuw om te proberen.");
      });
  }

  const togglePlay = () => {
    if (!state.tracks.length) {
      return;
    }
    if (audio.paused || audio.ended) {
      play();
    } else {
      audio.pause();
    }
  };

  const stopPlayback = () => {
    audio.pause();
    audio.currentTime = 0;
    renderProgress();
    renderPlayState(false);
    persist();
  };

  function cycle(delta) {
    if (!state.tracks.length) {
      return;
    }
    let next;
    if (state.shuffle && state.tracks.length > 1) {
      do {
        next = Math.floor(Math.random() * state.tracks.length);
      } while (next === state.index);
    } else {
      const base = state.index === -1 ? 0 : state.index;
      next = (base + delta + state.tracks.length) % state.tracks.length;
    }
    loadTrack(next, { autoplay: true });
  }

  /* ── Track list population ────────────────────────────────── */
  const populateSelect = () => {
    els.select.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Kies een track...";
    els.select.appendChild(placeholder);
    state.tracks.forEach((track, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = track.label;
      els.select.appendChild(option);
    });
    els.select.disabled = false;
    els.select.value = "";
    if (els.empty) {
      els.empty.hidden = true;
    }
    playerEl.dataset.state = "ready";
    setStatus("Selecteer een track en druk op play.");
  };

  /* ── Initial UI sync ──────────────────────────────────────── */
  resetProgress();
  updateDownloadLink(null);
  renderTrackDetail(null);
  renderTransport();
  if (els.volume) {
    els.volume.value = String(Math.round(state.lastVolume * 100));
  }
  applyVolumeVisual(state.lastVolume);
  setStatus("Vaste playlist wordt geladen...");

  /* ── Load tracks, then restore session ────────────────────── */
  discoverAudioTracks()
    .then(found => {
      state.tracks = found;
      if (!state.tracks.length) {
        els.select.disabled = true;
        if (els.empty) {
          els.empty.hidden = false;
        }
        playerEl.dataset.state = "empty";
        setStatus("Geen audiobestanden gevonden. Werk de vaste playlist bij in script.js.");
        return;
      }
      populateSelect();
      const restoreIndex = Number(persisted.index);
      if (Number.isInteger(restoreIndex) && state.tracks[restoreIndex]) {
        loadTrack(restoreIndex);
        setStatus(`Hervat: ${state.tracks[restoreIndex].label}. Druk op play.`);
      }
    })
    .catch(error => {
      console.error("Audio discovery faalde", error);
      els.select.disabled = true;
      if (els.empty) {
        els.empty.hidden = false;
      }
      playerEl.dataset.state = "error";
      setStatus("Kon de vaste playlist niet laden. Controleer je configuratie.");
    });

  /* ── Event wiring: controls ───────────────────────────────── */
  els.select.addEventListener("change", event => {
    const { value } = event.target;
    loadTrack(value === "" ? -1 : Number(value));
  });

  els.play.addEventListener("click", togglePlay);
  els.stop.addEventListener("click", () => {
    if (!state.tracks.length) {
      return;
    }
    stopPlayback();
    setStatus(state.index >= 0 ? `Gestopt: ${state.tracks[state.index].label}` : "Afspelen gestopt.");
  });
  els.prev?.addEventListener("click", () => cycle(-1));
  els.next?.addEventListener("click", () => cycle(1));

  els.shuffle?.addEventListener("click", () => {
    state.shuffle = !state.shuffle;
    renderTransport();
    persist();
  });

  els.repeat?.addEventListener("click", () => {
    const i = AUDIO_REPEAT_MODES.indexOf(state.repeat);
    state.repeat = AUDIO_REPEAT_MODES[(i + 1) % AUDIO_REPEAT_MODES.length];
    renderTransport();
    persist();
  });

  els.mute?.addEventListener("click", toggleMute);

  /* ── Event wiring: volume ─────────────────────────────────── */
  if (els.volume) {
    const onVolume = event => {
      const value = Number(event.target.value);
      const ratio = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) / 100 : 0;
      applyVolume(ratio, { fromSlider: true });
    };
    els.volume.addEventListener("input", onVolume);
    els.volume.addEventListener("change", onVolume);
  }

  /* ── Event wiring: seek ───────────────────────────────────── */
  els.progress.addEventListener("input", () => {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
      return;
    }
    state.seeking = true;
    els.progressTrack?.classList.add("is-seeking");
    const ratio = Number(els.progress.value) / AUDIO_PROGRESS_STEPS;
    els.current.textContent = formatAudioTime(ratio * audio.duration);
    setProgressVisual(ratio);
  });

  const endSeek = () => {
    els.progressTrack?.classList.remove("is-seeking");
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
      state.seeking = false;
      return;
    }
    const ratio = Number(els.progress.value) / AUDIO_PROGRESS_STEPS;
    audio.currentTime = ratio * audio.duration;
    state.seeking = false;
    persistSoon();
  };
  els.progress.addEventListener("change", endSeek);
  els.progress.addEventListener("mouseup", endSeek);
  els.progress.addEventListener("touchend", endSeek, { passive: true });

  /* ── Event wiring: media element ──────────────────────────── */
  audio.addEventListener("loadedmetadata", () => {
    els.progress.disabled = false;
    if (state.pendingSeek > 0 && state.pendingSeek < audio.duration) {
      audio.currentTime = state.pendingSeek;
    }
    state.pendingSeek = 0;
    renderProgress();
  });

  audio.addEventListener("progress", renderBuffered);

  audio.addEventListener("timeupdate", () => {
    if (state.seeking) {
      return;
    }
    renderProgress();
    if (!audio.paused) {
      persistSoon();
    }
  });

  audio.addEventListener("play", () => {
    renderPlayState(true);
    startVisualizer();
    if (state.index >= 0) {
      setStatus(`Aan het spelen: ${state.tracks[state.index].label}`);
    }
  });

  audio.addEventListener("pause", () => {
    if (audio.ended) {
      return;
    }
    renderPlayState(false);
    stopVisualizer();
    if (state.index >= 0) {
      setStatus(`Gepauzeerd: ${state.tracks[state.index].label}`);
    }
    persist();
  });

  audio.addEventListener("ended", () => {
    renderProgress(true);
    stopVisualizer();
    if (!state.tracks.length) {
      renderPlayState(false);
      return;
    }
    if (state.repeat === "one") {
      audio.currentTime = 0;
      play();
      return;
    }
    const isLast = state.index >= state.tracks.length - 1;
    if (state.shuffle || state.repeat === "all" || !isLast) {
      cycle(1);
      return;
    }
    renderPlayState(false);
    setStatus("Einde van de playlist.");
    persist();
  });

  audio.addEventListener("emptied", () => {
    resetProgress();
    renderPlayState(false);
  });

  audio.addEventListener("error", event => {
    console.warn("Audiofout", event);
    renderPlayState(false);
    stopVisualizer();
    resetProgress();
    setStatus("Kan de geselecteerde track niet afspelen.");
  });

  /* ── Event wiring: keyboard shortcuts ─────────────────────── */
  playerEl.addEventListener("keydown", event => {
    if (event.target.matches("input, select, textarea")) {
      return;
    }
    switch (event.key) {
      case " ":
        event.preventDefault();
        togglePlay();
        break;
      case "ArrowRight":
        if (Number.isFinite(audio.duration)) {
          audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
        }
        break;
      case "ArrowLeft":
        if (Number.isFinite(audio.duration)) {
          audio.currentTime = Math.max(0, audio.currentTime - 5);
        }
        break;
      case "n":
      case "N":
        cycle(1);
        break;
      case "p":
      case "P":
        cycle(-1);
        break;
      case "m":
      case "M":
        toggleMute();
        break;
      case "s":
      case "S":
        els.shuffle?.click();
        break;
      case "r":
      case "R":
        els.repeat?.click();
        break;
      default:
        break;
    }
  });

  /* ── Persist on page hide ─────────────────────────────────── */
  window.addEventListener("pagehide", persist);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      persist();
    }
  });

  if (!playerEl.hasAttribute("tabindex")) {
    playerEl.setAttribute("tabindex", "0");
  }
}

function clampVolume(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return Math.max(0, Math.min(1, num));
}

function loadCustomEvents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return normalizeCustomEvents(parsed);
      }
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const parsedLegacy = JSON.parse(legacy);
      if (Array.isArray(parsedLegacy)) {
        const migrated = parsedLegacy.map((time, idx) => ({
          id: uniqueId(),
          time,
          label: `Legacy cue ${idx + 1}`,
          recurrence: "Daily",
          color: DEFAULT_ACCENT_COLOR,
          notes: "Imported from the previous version."
        }));
        saveCustomEvents(migrated);
        localStorage.removeItem(LEGACY_KEY);
        return normalizeCustomEvents(migrated);
      }
    }
  } catch (error) {
    console.warn("Failed to load saved events", error);
  }
  return [];
}

function normalizeWeekdays(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const cleaned = value
    .map(Number)
    .filter(day => Number.isInteger(day) && day >= 0 && day <= 6);
  return Array.from(new Set(cleaned)).sort((a, b) => a - b);
}

function normalizeCustomEvents(events) {
  return events
    .filter(evt => typeof evt === "object" && evt !== null)
    .map(evt => {
      const recurrence = ["Daily", "Weekdays", "Weekends", "SpecificWeekdays"].includes(evt.recurrence)
        ? evt.recurrence
        : "Daily";
      const normalized = {
        id: evt.id || uniqueId(),
        time: typeof evt.time === "string" ? evt.time : "12:00",
        label: typeof evt.label === "string" && evt.label.trim() ? evt.label.trim() : "Untitled cue",
        recurrence,
        color: resolveHexColor(evt.color),
        notes: typeof evt.notes === "string" ? evt.notes.trim() : ""
      };
      if (recurrence === "SpecificWeekdays") {
        normalized.weekdays = normalizeWeekdays(evt.weekdays);
      }
      return normalized;
    })
    .sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
}

function saveCustomEvents(events) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch (error) {
    console.warn("Unable to persist events", error);
  }
}

function nextDailyOccurrence(now, time) {
  const [hours, minutes] = time.split(":").map(Number);
  const target = new Date(now);
  target.setHours(hours, minutes, 0, 0);
  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }
  return target;
}

function nextWeekdayOccurrence(now, time) {
  const target = nextDailyOccurrence(now, time);
  while (target.getDay() === 0 || target.getDay() === 6) {
    target.setDate(target.getDate() + 1);
  }
  return target;
}

function nextWeekendOccurrence(now, time) {
  const target = nextDailyOccurrence(now, time);
  while (target.getDay() >= 1 && target.getDay() <= 5) {
    target.setDate(target.getDate() + 1);
  }
  return target;
}

function nextSpecificWeekdaysOccurrence(now, time, allowedWeekdays) {
  const target = nextDailyOccurrence(now, time);
  while (!allowedWeekdays.includes(target.getDay())) {
    target.setDate(target.getDate() + 1);
  }
  return target;
}

function nextOccurrenceFor(event, now) {
  switch (event.recurrence) {
    case "MonWedThu":
      return nextSpecificWeekdaysOccurrence(now, event.time, [1, 3, 4]);
    case "SpecificWeekdays": {
      const days = Array.isArray(event.weekdays) ? event.weekdays : [];
      if (!days.length) {
        return null;
      }
      return nextSpecificWeekdaysOccurrence(now, event.time, days);
    }
    case "Weekdays":
      return nextWeekdayOccurrence(now, event.time);
    case "Weekends":
      return nextWeekendOccurrence(now, event.time);
    default:
      return nextDailyOccurrence(now, event.time);
  }
}

function diffParts(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}

function formatCountdown(parts, compact = false) {
  const { days, hours, minutes, seconds } = parts;
  if (compact) {
    if (days > 0) {
      return `${days}d ${hours}h`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }
  const daySegment = days > 0 ? `${days}d ` : "";
  return `${daySegment}${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
}

function getAllEvents(customEvents) {
  return [...DEFAULT_EVENTS, ...customEvents];
}

const WEEKDAY_SHORT = ["Zo", "Ma", "Di", "Wo", "Do", "Vr", "Za"];

function recurrenceTag(recurrence, weekdays) {
  switch (recurrence) {
    case "MonWedThu":
      return "Mon/Wed/Thu";
    case "SpecificWeekdays":
      return Array.isArray(weekdays) && weekdays.length
        ? weekdays.map(day => WEEKDAY_SHORT[day]).join(" · ")
        : "Geen dagen";
    case "Weekdays":
      return "Weekdays";
    case "Weekends":
      return "Weekends";
    default:
      return "Daily";
  }
}

function buildEventCard(event, source = "core") {
  const card = document.createElement("article");
  card.className = "event-card";
  card.dataset.id = event.id;
  card.dataset.time = event.time;
  card.dataset.recurrence = event.recurrence;
  card.dataset.source = source;
  card.dataset.label = event.label;
  if (event.color) {
    card.dataset.color = event.color;
    card.style.setProperty("--card-accent", event.color);
  }

  const pillLabel = source === "custom" ? "Personal" : "Core";
  const note = source === "custom" ? event.notes : event.description;

  card.innerHTML = `
    <div class="event-card__top">
      <div>
        <p class="event-card__label">${event.label}</p>
        <p class="event-card__meta"><span class="event-time">${event.time}</span> · ${recurrenceTag(event.recurrence, event.weekdays)}</p>
      </div>
      <span class="pill">${pillLabel}</span>
    </div>
    ${note ? `<p class="event-card__note">${note}</p>` : ""}
    <div class="event-card__count" aria-live="off">--h --m --s</div>
  `;

  if (source === "custom") {
    const actions = document.createElement("div");
    actions.className = "event-card__actions";
    actions.innerHTML = `
      <button type="button" class="btn ghost" data-action="edit">Edit</button>
      <button type="button" class="btn ghost danger" data-action="remove">Remove</button>
    `;
    card.appendChild(actions);
  }

  return card;
}

function renderCustomBoard(container, events, emptyStateEl) {
  container.innerHTML = "";
  if (!events.length) {
    emptyStateEl.hidden = false;
    return;
  }
  emptyStateEl.hidden = true;
  const isList = container.tagName === "UL" || container.tagName === "OL";
  events.forEach(event => {
    const card = buildEventCard(event, "custom");
    if (isList) {
      const li = document.createElement("li");
      li.appendChild(card);
      container.appendChild(li);
    } else {
      container.appendChild(card);
    }
  });
}

function createTimelineItem() {
  const item = document.createElement("li");
  item.className = "timeline__item";
  item.innerHTML = `
    <div class="timeline__decor" aria-hidden="true">
      <span class="timeline__dot"></span>
      <span class="timeline__glow"></span>
    </div>
    <div class="timeline__body">
      <header class="timeline__header">
        <div class="timeline__header-main">
          <p class="timeline__label"></p>
          <p class="timeline__detail" hidden></p>
        </div>
        <div class="timeline__eta">
          <span class="timeline__count-label">Next in</span>
          <span class="timeline__countdown" data-countdown aria-live="off">--</span>
        </div>
      </header>
      <div class="timeline__meta">
        <time class="timeline__time" datetime=""></time>
        <span class="timeline__pill"></span>
      </div>
      <div class="timeline__progress" role="img" aria-label="">
        <span class="timeline__progress-fill"></span>
      </div>
    </div>
  `;
  return item;
}

function updateTimelineItem(item, entry, compact, isNext, accent, fallbackAccent) {
  item.dataset.id = entry.event.id;
  item.dataset.next = entry.next.toISOString();
  item.dataset.color = accent;
  item.style.setProperty("--timeline-accent", accent);
  item.classList.toggle("is-next", Boolean(isNext));

  const labelEl = item.querySelector(".timeline__label");
  const detailEl = item.querySelector(".timeline__detail");
  const countdownEl = item.querySelector(".timeline__countdown");
  const timeEl = item.querySelector(".timeline__time");
  const pillEl = item.querySelector(".timeline__pill");
  const progressEl = item.querySelector(".timeline__progress");
  const progressFill = item.querySelector(".timeline__progress-fill");

  if (labelEl) {
    labelEl.textContent = entry.event.label;
  }

  const detail = entry.event.notes?.trim() || entry.event.description || "";
  if (detailEl) {
    if (detail) {
      detailEl.textContent = detail;
      detailEl.hidden = false;
    } else {
      detailEl.textContent = "";
      detailEl.hidden = true;
    }
  }

  const countdownText = formatCountdown(diffParts(entry.remain), compact);
  if (countdownEl) {
    countdownEl.textContent = countdownText;
  }

  if (timeEl) {
    timeEl.dateTime = entry.event.time;
    timeEl.textContent = entry.event.time;
  }

  if (pillEl) {
    pillEl.textContent = recurrenceTag(entry.event.recurrence, entry.event.weekdays);
  }

  const dayWindow = 24 * 60 * 60 * 1000;
  const relativeProgress = 1 - Math.max(0, Math.min(1, entry.remain / dayWindow));
  const progressPercent = relativeProgress <= 0 ? 0 : Math.max(1, Math.round(relativeProgress * 100));
  const progressLabel = progressPercent <= 0
    ? "Cue is more than a day away"
    : `${progressPercent}% of today's rhythm complete before this cue`;

  if (progressEl) {
    progressEl.setAttribute("aria-label", progressLabel);
  }
  if (progressFill) {
    progressFill.style.width = `${progressPercent}%`;
  }

  const glow = item.querySelector(".timeline__glow");
  const dot = item.querySelector(".timeline__dot");
  const accentColor = accent || fallbackAccent;
  if (glow) {
    glow.style.setProperty("--timeline-accent", accentColor);
  }
  if (dot) {
    dot.style.setProperty("--timeline-accent", accentColor);
  }
}

function renderTimeline(listEl, events, compact, now = new Date(), soonest = null) {
  if (!listEl) return;

  listEl.classList.toggle("timeline--compact", Boolean(compact));

  const fallbackAccent = getCurrentAccentColor();
  const entries = events
    .map(event => {
      const next = nextOccurrenceFor(event, now);
      const remain = next - now;
      return { event, next, remain };
    })
    .filter(entry => Number.isFinite(entry.remain))
    .sort((a, b) => a.remain - b.remain)
    .slice(0, 6);

  if (!entries.length) {
    listEl.dataset.state = "empty";
    const empty = document.createElement("li");
    empty.className = "timeline__item timeline__item--empty";
    empty.innerHTML = `
      <div class="timeline__decor" aria-hidden="true">
        <span class="timeline__dot"></span>
      </div>
      <div class="timeline__body">
        <p class="timeline__label">No cues scheduled</p>
        <p class="timeline__detail">Add a personal cue or tweak the rhythm to see it light up here.</p>
      </div>
    `;
    listEl.replaceChildren(empty);
    return;
  }

  listEl.dataset.state = "populated";

  const existingItems = new Map(
    Array.from(listEl.children)
      .filter(item => item.dataset?.id)
      .map(item => [item.dataset.id, item])
  );
  Array.from(listEl.querySelectorAll(".timeline__item--empty")).forEach(node => node.remove());
  const seenIds = new Set();

  entries.forEach((entry, index) => {
    const accent = resolveHexColor(entry.event.color, fallbackAccent);
    const item = existingItems.get(entry.event.id) || createTimelineItem();

    if (!item.isConnected) {
      listEl.appendChild(item);
    }

    updateTimelineItem(
      item,
      entry,
      compact,
      soonest && soonest.event.id === entry.event.id,
      accent,
      fallbackAccent
    );

    const currentPosition = listEl.children[index];
    if (currentPosition !== item) {
      listEl.insertBefore(item, currentPosition ?? null);
    }

    seenIds.add(entry.event.id);
  });

  Array.from(listEl.children).forEach(child => {
    const id = child.dataset?.id;
    if (!id || seenIds.has(id)) {
      return;
    }
    child.remove();
  });
}

function updateSummaries(now, events, soonest) {
  const liveClock = document.getElementById("liveClock");
  liveClock.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const customSummaryCount = document.getElementById("customSummaryCount");
  const customCount = events.filter(evt => !DEFAULT_EVENT_IDS.has(evt.id)).length;
  customSummaryCount.textContent = customCount;

  const nextEventName = document.getElementById("nextEventName");
  const nextEventCountdown = document.getElementById("nextEventCountdown");
  const focusMessage = document.getElementById("focusMessage");

  if (soonest) {
    nextEventName.textContent = `${soonest.event.label} · ${soonest.event.time}`;
    announceNextEvent(soonest.event.label);
    nextEventCountdown.textContent = formatCountdown(diffParts(soonest.remain), false);
    const focusDetail = soonest.event.notes || soonest.event.description;
    focusMessage.textContent = focusDetail
      ? `Prep for “${focusDetail}”`
      : `Set the tone for ${soonest.event.label.toLowerCase()}.`;
  } else {
    nextEventName.textContent = "Waiting for your first cue";
    nextEventCountdown.textContent = "--h --m --s";
    focusMessage.textContent = SUMMARY_MESSAGES[0];
  }
}

function highlightSoonestCard(soonest) {
  document.querySelectorAll(".event-card").forEach(card => card.classList.remove("is-next"));
  if (soonest && soonest.event) {
    const card = document.querySelector(`.event-card[data-id="${soonest.event.id}"]`);
    if (card) {
      card.classList.add("is-next");
    }
  }
}

function updateCountdowns(events, compact, { timelineList } = {}) {
  const now = new Date();
  let soonest = null;

  events.forEach(event => {
    const next = nextOccurrenceFor(event, now);
    if (!next) {
      return;
    }
    const remain = next - now;
    if (!soonest || remain < soonest.remain) {
      soonest = { event, remain, next };
    }

    const card = document.querySelector(`.event-card[data-id="${event.id}"]`);
    if (!card) {
      return;
    }
    const countEl = card.querySelector(".event-card__count");
    if (countEl) {
      countEl.textContent = formatCountdown(diffParts(remain), compact);
    }
  });

  checkAlarms(events, now);
  updateTabBadge(soonest);
  highlightSoonestCard(soonest);
  if (timelineList) {
    renderTimeline(timelineList, events, compact, now, soonest);
  }
  updateSummaries(now, events, soonest);
  return now;
}

function initShagMeter() {
  const section = document.querySelector("[data-shagmeter]");
  if (!section) {
    return false;
  }

  const timelineList = section.querySelector("[data-shagmeter-timeline]");
  const meterEl = section.querySelector("[data-shagmeter-meter]");
  const statusEl = section.querySelector("[data-shagmeter-status]");
  const goalInput = section.querySelector("[data-shagmeter-goal]");
  const goalValueEl = section.querySelector("[data-shagmeter-goal-value]");
  const addButton = section.querySelector("[data-shagmeter-add]");
  const resetButton = section.querySelector("[data-shagmeter-reset]");
  const shagmeterCard = section.querySelector(".shagmeter-card");
  const countValueEl = section.querySelector("[data-shagmeter-count]");
  const countLabelEl = section.querySelector("[data-shagmeter-count-label]");
  const explosionEl = section.querySelector("[data-shagmeter-explosion]");

  if (
    !meterEl ||
    !statusEl ||
    !goalInput ||
    !goalValueEl ||
    !addButton ||
    !resetButton ||
    !shagmeterCard ||
    !countValueEl ||
    !countLabelEl
  ) {
    return false;
  }

  let timelineItem = null;

  const renderTimelineCard = () => {
    if (!timelineList) {
      return;
    }
    const now = new Date();
    const customEvents = loadCustomEvents();
    const events = getAllEvents(customEvents);

    let soonest = null;
    events.forEach(event => {
      const next = nextOccurrenceFor(event, now);
      if (!next) {
        return;
      }
      const remain = next - now;
      if (!soonest || remain < soonest.remain) {
        soonest = { event, remain, next };
      }
    });

    if (!soonest) {
      timelineList.dataset.state = "empty";
      timelineList.innerHTML = `
        <li class="timeline__item timeline__item--empty">
          <div class="timeline__decor" aria-hidden="true">
            <span class="timeline__dot"></span>
          </div>
          <div class="timeline__body">
            <p class="timeline__label">Geen cues gepland</p>
            <p class="timeline__detail">Ga naar de planner om er eentje toe te voegen.</p>
          </div>
        </li>
      `;
      timelineItem = null;
      return;
    }

    timelineList.dataset.state = "populated";
    if (!timelineItem) {
      timelineList.innerHTML = "";
      timelineItem = createTimelineItem();
      timelineList.appendChild(timelineItem);
    }

    const fallbackAccent = getCurrentAccentColor();
    const accent = resolveHexColor(soonest.event.color, fallbackAccent);
    updateTimelineItem(timelineItem, soonest, false, true, accent, fallbackAccent);
  };

  renderTimelineCard();
  setInterval(renderTimelineCard, 1000);

  const goalMin = Number(goalInput.min) || 1;
  const goalMax = Number(goalInput.max) || 9999;

  const clampGoal = value => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return goalMin;
    }
    return Math.min(goalMax, Math.max(goalMin, Math.round(numeric)));
  };

  const shagUnit = amount => {
    if (amount === 1) {
      return "shaggie";
    }
    return "Shaggies";
  };

  const pluralizeShag = amount => {
    if (amount === 1) {
      return "1 shaggie";
    }
    return `${amount} Shaggies`;
  };

  const loadState = () => {
    try {
      const stored = localStorage.getItem(SHAGMETER_STORAGE_KEY);
      if (!stored) {
        return null;
      }
      const parsed = JSON.parse(stored);
      if (
        parsed &&
        typeof parsed === "object" &&
        Number.isFinite(parsed.goal) &&
        Number.isFinite(parsed.count)
      ) {
        return {
          goal: clampGoal(parsed.goal),
          count: Math.max(0, Math.floor(parsed.count))
        };
      }
    } catch (error) {
      console.warn("Unable to load shagmeter state", error);
    }
    return null;
  };

  const persistState = state => {
    try {
      localStorage.setItem(SHAGMETER_STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn("Unable to persist shagmeter state", error);
    }
  };

  const defaultGoal = clampGoal(goalInput.value || goalMin);
  let state = loadState() || { goal: defaultGoal, count: 0 };

  let lastCompletionState = state.count >= state.goal && state.goal > 0;
  let explosionCleanupTimer = null;

  goalInput.value = state.goal;
  if (state.count > state.goal) {
    state.count = state.goal;
    persistState(state);
  }

  const updateGoalValue = () => {
    goalValueEl.textContent = shagUnit(state.goal);
  };

  const stopExplosion = () => {
    if (explosionCleanupTimer) {
      clearTimeout(explosionCleanupTimer);
      explosionCleanupTimer = null;
    }
    shagmeterCard.classList.remove("is-exploding");
    meterEl.classList.remove("is-active");
    if (explosionEl) {
      explosionEl.classList.remove("is-active");
    }
  };

  const triggerExplosion = () => {
    if (explosionCleanupTimer) {
      clearTimeout(explosionCleanupTimer);
    }
    shagmeterCard.classList.add("is-exploding");
    if (explosionEl) {
      explosionEl.classList.remove("is-active");
      void explosionEl.offsetWidth;
      explosionEl.classList.add("is-active");
    }
    meterEl.classList.remove("is-active");
    void meterEl.offsetWidth;
    meterEl.classList.add("is-active");
    explosionCleanupTimer = window.setTimeout(() => {
      shagmeterCard.classList.remove("is-exploding");
      meterEl.classList.remove("is-active");
      explosionCleanupTimer = null;
    }, 2400);
  };

  if (explosionEl) {
    explosionEl.addEventListener("animationend", () => {
      explosionEl.classList.remove("is-active");
    });
  }

  const updateMeter = () => {
    const safeGoal = state.goal > 0 ? state.goal : 1;
    const ratio = safeGoal > 0 ? state.count / safeGoal : 0;
    const clampedRatio = Math.min(1, Math.max(0, ratio));
    meterEl.style.setProperty("--shagmeter-progress", clampedRatio.toFixed(4));
    meterEl.setAttribute("aria-valuemax", String(state.goal));
    meterEl.setAttribute("aria-valuenow", String(Math.min(state.count, state.goal)));
    meterEl.setAttribute(
      "aria-valuetext",
      state.count >= state.goal
        ? "Doel bereikt"
        : `${pluralizeShag(state.count)} van ${pluralizeShag(state.goal)}`
    );

    const statusText =
      state.count >= state.goal && state.goal > 0
        ? `Doel bereikt! ${pluralizeShag(state.count)} genoteerd.`
        : `${pluralizeShag(state.count)} van ${pluralizeShag(state.goal)} genoteerd.`;

    statusEl.textContent = statusText;

    countValueEl.textContent = String(state.count);
    countLabelEl.textContent = shagUnit(state.count);

    const isComplete = state.count >= state.goal && state.goal > 0;
    shagmeterCard.classList.toggle("is-complete", isComplete);
    addButton.disabled = state.goal > 0 && state.count >= state.goal;

    if (isComplete && !lastCompletionState) {
      triggerExplosion();
    } else if (!isComplete && lastCompletionState) {
      stopExplosion();
    }

    lastCompletionState = isComplete;
  };

  updateGoalValue();
  updateMeter();

  goalInput.addEventListener("input", event => {
    const raw = event.target.value;
    if (raw === "" || raw === "-") return;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 1) return;
    state.goal = clampGoal(raw);
    if (state.count > state.goal) {
      state.count = state.goal;
    }
    updateGoalValue();
    updateMeter();
    persistState(state);
  });

  goalInput.addEventListener("change", event => {
    const clamped = clampGoal(event.target.value || state.goal);
    state.goal = clamped;
    goalInput.value = clamped;
    if (state.count > state.goal) {
      state.count = state.goal;
    }
    updateGoalValue();
    updateMeter();
    persistState(state);
  });

  addButton.addEventListener("click", () => {
    state.count = Math.min(state.goal, state.count + 1);
    updateMeter();
    persistState(state);
  });

  resetButton.addEventListener("click", () => {
    state.count = 0;
    updateMeter();
    persistState(state);
  });

  return true;
}

function setAccentColor(color, { persist = false } = {}) {
  const resolved = resolveHexColor(color);
  document.documentElement.style.setProperty("--accent", resolved);
  const accentValue = document.getElementById("accentValue");
  if (accentValue) {
    accentValue.textContent = resolved;
  }
  const accentControl = document.getElementById("accentControl");
  if (accentControl && accentControl.value.toLowerCase() !== resolved) {
    accentControl.value = resolved;
  }
  if (persist) {
    writeStoredPreference(PREFERENCE_KEYS.accentColor, resolved);
  }
}

function resetAccentColor() {
  setAccentColor(DEFAULT_ACCENT_COLOR, { persist: true });
}

function setEditingState(event) {
  const editingId = document.getElementById("editingId");
  const labelInput = document.getElementById("labelInput");
  const timeInput = document.getElementById("timeInput");
  const recurrenceSelect = document.getElementById("recurrenceSelect");
  const colorInput = document.getElementById("colorInput");
  const notesInput = document.getElementById("notesInput");
  const cancelEdit = document.getElementById("cancelEdit");
  const submitBtn = document.getElementById("submitBtn");
  const weekdayPicker = document.getElementById("weekdayPicker");
  const weekdayBoxes = document.querySelectorAll('#weekdayPicker input[name="weekday"]');

  const setWeekdayBoxes = (days = []) => {
    weekdayBoxes.forEach(box => {
      box.checked = days.includes(Number(box.value));
    });
    if (weekdayPicker) {
      weekdayPicker.hidden = !days.length && (!recurrenceSelect || recurrenceSelect.value !== "SpecificWeekdays");
    }
  };

  if (!event) {
    editingId.value = "";
    labelInput.value = "";
    timeInput.value = "";
    recurrenceSelect.value = "Daily";
    colorInput.value = getCurrentAccentColor();
    notesInput.value = "";
    setWeekdayBoxes([]);
    if (weekdayPicker) {
      weekdayPicker.hidden = true;
    }
    cancelEdit.hidden = true;
    submitBtn.textContent = "Save cue";
    return;
  }

  editingId.value = event.id;
  labelInput.value = event.label;
  timeInput.value = event.time;
  recurrenceSelect.value = event.recurrence;
  colorInput.value = resolveHexColor(event.color, getCurrentAccentColor());
  notesInput.value = event.notes || "";
  setWeekdayBoxes(event.recurrence === "SpecificWeekdays" ? event.weekdays || [] : []);
  if (weekdayPicker) {
    weekdayPicker.hidden = event.recurrence !== "SpecificWeekdays";
  }
  cancelEdit.hidden = false;
  submitBtn.textContent = "Update cue";
}

const CUES_EXPORT_SCHEMA = "shagwekker.cues.v1";
let toastStackEl = null;

function initToasts() {
  toastStackEl = document.getElementById("toastStack");
}

function showToast(message, { tone = "info", duration = 4000 } = {}) {
  if (!toastStackEl) {
    toastStackEl = document.getElementById("toastStack");
  }
  if (!toastStackEl) {
    return;
  }
  const toast = document.createElement("div");
  toast.className = `toast toast--${tone}`;
  toast.setAttribute("role", "status");

  const text = document.createElement("span");
  text.className = "toast__message";
  text.textContent = message;
  toast.appendChild(text);

  const close = document.createElement("button");
  close.type = "button";
  close.className = "toast__close";
  close.setAttribute("aria-label", "Melding sluiten");
  close.textContent = "×";
  toast.appendChild(close);

  const dismiss = () => {
    if (!toast.isConnected) {
      return;
    }
    toast.classList.add("toast--leaving");
    const remove = () => toast.remove();
    toast.addEventListener("transitionend", remove, { once: true });
    setTimeout(remove, 400);
  };

  close.addEventListener("click", dismiss);
  toastStackEl.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("toast--visible"));

  if (duration > 0) {
    setTimeout(dismiss, duration);
  }
}

let lastAnnouncedEvent = null;

function announceNextEvent(name) {
  const announcer = document.getElementById("nextEventAnnouncer");
  if (!announcer || !name || name === lastAnnouncedEvent) {
    return;
  }
  lastAnnouncedEvent = name;
  announcer.textContent = `Volgende cue: ${name}`;
}

function initMobileNav() {
  const toggle = document.getElementById("navToggle");
  const nav = document.querySelector(".site-nav");
  const backdrop = document.getElementById("navBackdrop");
  const main = document.getElementById("main");
  if (!toggle || !nav) {
    return;
  }

  const setOpen = isOpen => {
    nav.classList.toggle("site-nav--open", isOpen);
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.setAttribute("aria-label", isOpen ? "Menu sluiten" : "Menu openen");
    if (backdrop) {
      backdrop.hidden = !isOpen;
    }
    if (main && "inert" in HTMLElement.prototype) {
      main.inert = isOpen;
    }
  };

  toggle.addEventListener("click", () => {
    setOpen(!nav.classList.contains("site-nav--open"));
  });

  nav.addEventListener("click", event => {
    if (event.target.closest("a")) {
      setOpen(false);
    }
  });

  if (backdrop) {
    backdrop.addEventListener("click", () => setOpen(false));
  }

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && nav.classList.contains("site-nav--open")) {
      setOpen(false);
      toggle.focus();
    }
  });
}

function exportCuesToJson() {
  const payload = {
    schema: CUES_EXPORT_SCHEMA,
    exportedAt: new Date().toISOString(),
    events: loadCustomEvents()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `shagwekker-cues-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Cues geëxporteerd", { tone: "success" });
}

function parseImportedCues(text) {
  const parsed = JSON.parse(text);
  const rawEvents = Array.isArray(parsed) ? parsed : parsed && parsed.events;
  if (!Array.isArray(rawEvents)) {
    throw new Error("Geen geldige cue-lijst gevonden.");
  }
  return normalizeCustomEvents(rawEvents);
}

/* ── Phase B: alarm-clock functionality ── */
const NOTIFY_KEY = "shagwekker.notifications.enabled.v1";
const CHIME_KEY = "shagwekker.chime.enabled.v1";
const ALARM_FIRE_WINDOW_MS = 5000;

let notificationsEnabled = false;
let chimeEnabled = true;
let chimeEl = null;
const alarmNextTimes = new Map();
let alarmPrimed = false;

function initChime() {
  chimeEl = document.getElementById("chimeAudio");
  chimeEnabled = readStoredPreference(CHIME_KEY) !== "false";
  const chimeToggle = document.getElementById("chimeToggle");
  if (!chimeToggle) {
    return;
  }
  const sync = () => {
    chimeToggle.setAttribute("aria-pressed", String(chimeEnabled));
    chimeToggle.textContent = chimeEnabled ? "Geluid: aan" : "Geluid: uit";
  };
  sync();
  chimeToggle.addEventListener("click", () => {
    chimeEnabled = !chimeEnabled;
    writeStoredPreference(CHIME_KEY, chimeEnabled ? "true" : "false");
    sync();
  });
}

function playChime() {
  if (!chimeEnabled || !chimeEl) {
    return;
  }
  try {
    const instance = chimeEl.cloneNode(true);
    instance.volume = 0.7;
    const played = instance.play();
    if (played && typeof played.catch === "function") {
      played.catch(() => {});
    }
  } catch (error) {
    console.warn("Chime kon niet afspelen", error);
  }
}

function initNotifications() {
  const toggle = document.getElementById("notifyToggle");
  const supported = typeof window !== "undefined" && "Notification" in window;
  notificationsEnabled =
    supported && Notification.permission === "granted" && readStoredPreference(NOTIFY_KEY) === "true";

  if (!toggle) {
    return;
  }
  if (!supported) {
    toggle.disabled = true;
    toggle.textContent = "Geen notificaties";
    return;
  }

  const sync = () => {
    toggle.setAttribute("aria-pressed", String(notificationsEnabled));
    toggle.textContent = notificationsEnabled ? "Notificaties uit" : "Notificaties aan";
  };
  sync();

  toggle.addEventListener("click", async () => {
    if (notificationsEnabled) {
      notificationsEnabled = false;
      writeStoredPreference(NOTIFY_KEY, "false");
      sync();
      return;
    }
    let permission = Notification.permission;
    if (permission !== "granted") {
      try {
        permission = await Notification.requestPermission();
      } catch (error) {
        console.warn("Notificatiepermissie mislukt", error);
      }
    }
    if (permission === "granted") {
      notificationsEnabled = true;
      writeStoredPreference(NOTIFY_KEY, "true");
      // The click is a user gesture — prime audio so chimes can play later.
      playChime();
      showToast("Notificaties staan aan", { tone: "success" });
    } else {
      showToast("Notificaties geblokkeerd in je browser", { tone: "warning" });
    }
    sync();
  });
}

function fireAlarm(event) {
  playChime();
  if (notificationsEnabled && "Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(event.label, {
        body: "Tijd voor je shagpauze.",
        icon: "/android-chrome-192x192.png",
        tag: event.id,
        renotify: true
      });
    } catch (error) {
      console.warn("Notificatie kon niet getoond worden", error);
    }
  }
  showToast(`${event.label} — nu!`, { tone: "info" });
}

function checkAlarms(events, now) {
  const nowMs = now.getTime();
  events.forEach(event => {
    const next = nextOccurrenceFor(event, now);
    if (!next) {
      alarmNextTimes.delete(event.id);
      return;
    }
    const nextMs = next.getTime();
    const prev = alarmNextTimes.get(event.id);
    if (alarmPrimed && prev !== undefined && nextMs > prev && nowMs >= prev && nowMs - prev < ALARM_FIRE_WINDOW_MS) {
      fireAlarm(event);
    }
    alarmNextTimes.set(event.id, nextMs);
  });
  alarmPrimed = true;
}

let tabBadgeActive = false;
let tabBadgeFlash = false;
let originalTitle = "";
let originalFavicon = "";
let badgeFaviconUrl = "";
let faviconLink = null;

function buildBadgeFavicon() {
  const base = document.querySelector('link[rel="icon"][sizes="32x32"]') || document.querySelector('link[rel="icon"]');
  faviconLink = base;
  if (base) {
    originalFavicon = base.href;
  }
  if (typeof document.createElement !== "function") {
    return;
  }
  const img = new Image();
  img.onload = () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, 32, 32);
      ctx.beginPath();
      ctx.arc(24, 8, 7, 0, Math.PI * 2);
      ctx.fillStyle = "#ff2d2d";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
      badgeFaviconUrl = canvas.toDataURL("image/png");
    } catch (error) {
      badgeFaviconUrl = "";
    }
  };
  if (originalFavicon) {
    img.src = originalFavicon;
  }
}

function initTabBadge() {
  originalTitle = document.title;
  buildBadgeFavicon();
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      clearTabBadge();
    }
  });
}

function setFavicon(url) {
  if (faviconLink && url) {
    faviconLink.href = url;
  }
}

function clearTabBadge() {
  if (!tabBadgeActive) {
    return;
  }
  tabBadgeActive = false;
  tabBadgeFlash = false;
  document.title = originalTitle;
  setFavicon(originalFavicon);
}

function updateTabBadge(soonest) {
  const imminent = Boolean(soonest) && soonest.remain <= 60000 && soonest.remain >= 0;
  if (!imminent) {
    clearTabBadge();
    return;
  }
  tabBadgeActive = true;
  if (document.hidden === false) {
    return;
  }
  tabBadgeFlash = !tabBadgeFlash;
  document.title = tabBadgeFlash ? `(!) ${originalTitle}` : originalTitle;
  setFavicon(tabBadgeFlash && badgeFaviconUrl ? badgeFaviconUrl : originalFavicon);
}

const ONBOARDED_KEY = "shagwekker.onboarded.v1";

function initOnboarding() {
  if (readStoredPreference(ONBOARDED_KEY) === "true") {
    return;
  }
  const steps = [
    { sel: "#planner", title: "Nicotineteller", body: "Hier telt je eerstvolgende shagpauze realtime af." },
    { sel: "#createEventForm", title: "Las een pauze in", body: "Maak eigen cues met tijd, herhaling en kleur." },
    { sel: "#notifyToggle", title: "Zet de wekker aan", body: "Schakel notificaties en geluid in zodat ShagWekker echt rinkelt." },
    { sel: "#audio-lounge", title: "Audio Pauze Parlor", body: "Kies een track en laat het ritme je volgende shagmoment timen." }
  ].filter(step => document.querySelector(step.sel));

  if (!steps.length) {
    return;
  }

  let index = 0;
  let lastTarget = null;

  const backdrop = document.createElement("div");
  backdrop.className = "coachmark__backdrop";

  const bubble = document.createElement("div");
  bubble.className = "coachmark";
  bubble.setAttribute("role", "dialog");
  bubble.setAttribute("aria-modal", "true");
  bubble.setAttribute("aria-label", "Rondleiding");
  bubble.innerHTML = `
    <h3 class="coachmark__title"></h3>
    <p class="coachmark__body"></p>
    <div class="coachmark__nav">
      <span class="coachmark__dots"></span>
      <div class="coachmark__buttons">
        <button type="button" class="btn ghost btn--mini" data-coach="skip">Overslaan</button>
        <button type="button" class="btn primary btn--mini" data-coach="next">Volgende</button>
      </div>
    </div>
  `;

  const finish = () => {
    writeStoredPreference(ONBOARDED_KEY, "true");
    if (lastTarget) {
      lastTarget.classList.remove("coachmark-target");
    }
    backdrop.remove();
    bubble.remove();
    document.removeEventListener("keydown", onKey);
  };

  const render = () => {
    const step = steps[index];
    const target = document.querySelector(step.sel);
    if (lastTarget) {
      lastTarget.classList.remove("coachmark-target");
    }
    if (target) {
      target.classList.add("coachmark-target");
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      lastTarget = target;
    }
    bubble.querySelector(".coachmark__title").textContent = step.title;
    bubble.querySelector(".coachmark__body").textContent = step.body;
    bubble.querySelector(".coachmark__dots").textContent = `${index + 1} / ${steps.length}`;
    bubble.querySelector('[data-coach="next"]').textContent =
      index === steps.length - 1 ? "Klaar" : "Volgende";
  };

  const onKey = event => {
    if (event.key === "Escape") {
      finish();
    }
  };

  bubble.addEventListener("click", event => {
    const action = event.target.closest("[data-coach]")?.dataset.coach;
    if (action === "skip") {
      finish();
    } else if (action === "next") {
      if (index >= steps.length - 1) {
        finish();
      } else {
        index += 1;
        render();
      }
    }
  });

  document.addEventListener("keydown", onKey);
  document.body.appendChild(backdrop);
  document.body.appendChild(bubble);
  render();
}

function initServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }
  const isLocalhost = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  if (location.protocol !== "https:" && !isLocalhost) {
    return;
  }
  // Escape hatch: visiting ?unregister tears down the SW and caches.
  if (new URLSearchParams(location.search).has("unregister")) {
    navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(reg => reg.unregister()));
    if (window.caches && caches.keys) {
      caches.keys().then(keys => keys.forEach(key => caches.delete(key)));
    }
    return;
  }
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(error => {
      console.warn("Service worker registratie mislukt", error);
    });
  });
}

const THEME_KEY = "shagwekker.theme.v1";

function applyResolvedTheme(pref) {
  const root = document.documentElement;
  if (pref === "light" || pref === "dark" || pref === "sepia") {
    root.setAttribute("data-theme", pref);
    return;
  }
  const prefersLight =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: light)").matches;
  root.setAttribute("data-theme", prefersLight ? "light" : "dark");
}

function initThemeSwitcher() {
  const select = document.getElementById("themeSelect");
  const stored = readStoredPreference(THEME_KEY) || "auto";
  applyResolvedTheme(stored);

  if (typeof window !== "undefined" && window.matchMedia) {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      if ((readStoredPreference(THEME_KEY) || "auto") === "auto") {
        applyResolvedTheme("auto");
      }
    };
    if (mq.addEventListener) {
      mq.addEventListener("change", onChange);
    }
  }

  if (!select) {
    return;
  }
  select.value = stored;
  select.addEventListener("change", () => {
    writeStoredPreference(THEME_KEY, select.value);
    applyResolvedTheme(select.value);
  });
}

(function init() {
  const footerYear = document.getElementById("footerYear");
  if (footerYear) {
    footerYear.textContent = new Date().getFullYear();
  }

  initToasts();
  initThemeSwitcher();
  initServiceWorker();
  initMobileNav();
  initChime();
  initNotifications();
  initTabBadge();

  const contrastToggle = document.getElementById("contrastToggle");
  const updateHighContrast = isActive => {
    document.body.classList.toggle("high-contrast", Boolean(isActive));
    if (contrastToggle) {
      contrastToggle.setAttribute("aria-pressed", String(Boolean(isActive)));
      contrastToggle.textContent = isActive ? "Default contrast" : "High contrast";
    }
  };

  const storedContrastPreference = readStoredPreference(PREFERENCE_KEYS.highContrast);
  updateHighContrast(storedContrastPreference === "true");

  if (contrastToggle) {
    contrastToggle.addEventListener("click", () => {
      const nextState = !document.body.classList.contains("high-contrast");
      updateHighContrast(nextState);
      writeStoredPreference(PREFERENCE_KEYS.highContrast, nextState ? "true" : "false");
    });
  }

  const accentControl = document.getElementById("accentControl");
  const storedAccentPreference = readStoredPreference(PREFERENCE_KEYS.accentColor);
  const initialAccent = resolveHexColor(
    storedAccentPreference || (accentControl ? accentControl.value : null) || getCurrentAccentColor()
  );
  setAccentColor(initialAccent);
  if (accentControl) {
    accentControl.value = initialAccent;
    accentControl.addEventListener("input", event => {
      setAccentColor(event.target.value, { persist: true });
    });
  }

  const accentReset = document.getElementById("accentReset");
  if (accentReset) {
    accentReset.addEventListener("click", () => {
      resetAccentColor();
    });
  }

  initAudioPlayer();
  initShagMeter();
  initOnboarding();

  const customBoard = document.getElementById("customBoard");
  const timelineList = document.getElementById("timelineList");
  const customEmptyState = document.getElementById("customEmptyState");
  const precisionToggle = document.getElementById("precisionToggle");
  const demoButton = document.getElementById("demoButton");
  const clearCustom = document.getElementById("clearCustom");
  const cancelEdit = document.getElementById("cancelEdit");
  const createEventForm = document.getElementById("createEventForm");

  const plannerElementsReady =
    customBoard &&
    timelineList &&
    customEmptyState &&
    precisionToggle &&
    demoButton &&
    clearCustom &&
    cancelEdit &&
    createEventForm;

  if (!plannerElementsReady) {
    return;
  }

  let customEvents = loadCustomEvents();
  let compactMode = false;

  const renderAll = () => {
    renderCustomBoard(customBoard, customEvents, customEmptyState);
    updateCountdowns(getAllEvents(customEvents), compactMode, { timelineList });
  };

  renderAll();

  const recurrenceSelect = document.getElementById("recurrenceSelect");
  const weekdayPicker = document.getElementById("weekdayPicker");
  const syncWeekdayPicker = () => {
    if (weekdayPicker && recurrenceSelect) {
      weekdayPicker.hidden = recurrenceSelect.value !== "SpecificWeekdays";
    }
  };
  if (recurrenceSelect) {
    recurrenceSelect.addEventListener("change", syncWeekdayPicker);
    syncWeekdayPicker();
  }

  window.addEventListener("storage", evt => {
    if (evt.key === STORAGE_KEY) {
      customEvents = loadCustomEvents();
      setEditingState(null);
      renderAll();
    } else if (evt.key === PREFERENCE_KEYS.accentColor && evt.newValue) {
      setAccentColor(evt.newValue);
    }
  });

  precisionToggle.addEventListener("click", () => {
    compactMode = !compactMode;
    precisionToggle.setAttribute("aria-pressed", String(compactMode));
    precisionToggle.textContent = compactMode ? "Detailed view" : "Compact view";
    updateCountdowns(getAllEvents(customEvents), compactMode, { timelineList });
  });

  demoButton.addEventListener("click", () => {
    customEvents = normalizeCustomEvents([
      {
        id: uniqueId(),
        time: "09:45",
        label: "Hydration Hype",
        recurrence: "Daily",
        color: "#6ad4ff",
        notes: "Refill your bottle and take a lap."
      },
      {
        id: uniqueId(),
        time: "14:10",
        label: "Creative Coffee",
        recurrence: "Weekdays",
        color: "#ffa86a",
        notes: "Change scenery, jot down fresh ideas."
      },
      {
        id: uniqueId(),
        time: "20:30",
        label: "Wind-down Read",
        recurrence: "Daily",
        color: "#b56aff",
        notes: "Grab that novel or article you've saved."
      }
    ]);
    saveCustomEvents(customEvents);
    setEditingState(null);
    renderAll();
    showToast("Demo-cues geladen", { tone: "info" });
  });

  clearCustom.addEventListener("click", () => {
    if (!customEvents.length) return;
    if (confirm("Remove all custom cues?")) {
      customEvents = [];
      saveCustomEvents(customEvents);
      setEditingState(null);
      renderAll();
      showToast("Alle cues verwijderd", { tone: "warning" });
    }
  });

  const exportCues = document.getElementById("exportCues");
  const importCues = document.getElementById("importCues");
  const importCuesFile = document.getElementById("importCuesFile");

  if (exportCues) {
    exportCues.addEventListener("click", exportCuesToJson);
  }

  if (importCues && importCuesFile) {
    importCues.addEventListener("click", () => importCuesFile.click());
    importCuesFile.addEventListener("change", () => {
      const file = importCuesFile.files && importCuesFile.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const imported = parseImportedCues(String(reader.result));
          const replace = customEvents.length
            ? confirm("Bestaande cues vervangen? Kies Annuleren om samen te voegen.")
            : true;
          if (replace) {
            customEvents = imported;
          } else {
            customEvents = normalizeCustomEvents([
              ...customEvents,
              ...imported.map(evt => ({ ...evt, id: uniqueId() }))
            ]);
          }
          saveCustomEvents(customEvents);
          setEditingState(null);
          renderAll();
          showToast(`${imported.length} cue(s) geïmporteerd`, { tone: "success" });
        } catch (error) {
          console.warn("Import mislukt", error);
          showToast("Import mislukt: ongeldig JSON-bestand", { tone: "warning" });
        }
      };
      reader.readAsText(file);
      importCuesFile.value = "";
    });
  }

  customBoard.addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const card = button.closest(".event-card");
    if (!card) return;
    const id = card.dataset.id;
    const action = button.dataset.action;
    if (action === "remove") {
      customEvents = customEvents.filter(evt => evt.id !== id);
      saveCustomEvents(customEvents);
      setEditingState(null);
      renderAll();
      showToast("Cue verwijderd", { tone: "info" });
    }
    if (action === "edit") {
      const targetEvent = customEvents.find(evt => evt.id === id);
      if (targetEvent) {
        setEditingState(targetEvent);
      }
    }
  });

  cancelEdit.addEventListener("click", () => {
    setEditingState(null);
  });

  createEventForm.addEventListener("submit", event => {
    event.preventDefault();
    const formData = new FormData(createEventForm);
    const id = formData.get("editingId");
    const label = formData.get("label").toString().trim();
    const time = formData.get("time").toString();
    const recurrence = formData.get("recurrence").toString();
    const color = resolveHexColor(formData.get("color").toString(), getCurrentAccentColor());
    const notes = formData.get("notes").toString().trim();
    const weekdays = normalizeWeekdays(formData.getAll("weekday").map(Number));

    if (!/^\d{2}:\d{2}$/.test(time)) {
      showToast("Geef een geldige tijd op (HH:MM)", { tone: "warning" });
      return;
    }

    if (recurrence === "SpecificWeekdays" && !weekdays.length) {
      showToast("Kies minstens één dag", { tone: "warning" });
      return;
    }

    const fields = { label, time, recurrence, color, notes };
    if (recurrence === "SpecificWeekdays") {
      fields.weekdays = weekdays;
    }

    if (id) {
      customEvents = customEvents.map(evt => (evt.id === id ? { ...evt, weekdays: undefined, ...fields } : evt));
    } else {
      customEvents = [...customEvents, { id: uniqueId(), ...fields }];
    }

    customEvents = normalizeCustomEvents(customEvents);
    saveCustomEvents(customEvents);
    renderAll();
    createEventForm.reset();
    syncWeekdayPicker();
    setEditingState(null);
    showToast(id ? "Cue bijgewerkt" : "Cue opgeslagen", { tone: "success" });
  });

  setInterval(() => {
    updateCountdowns(getAllEvents(customEvents), compactMode, { timelineList });
  }, 1000);
})();
