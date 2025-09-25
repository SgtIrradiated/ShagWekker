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
  { src: `${AUDIO_DIRECTORY}Shag Track.flac`, title: "De Shag Trek" },
  { src: `${AUDIO_DIRECTORY}audio.mp3`, title: "Blije Man" },
  { src: `${AUDIO_DIRECTORY}30 Days In The Hole.flac`, title: "30 Days In The Hole" },
  { src: `${AUDIO_DIRECTORY}Hank.mp3`, title: "Are You Sure Hank Done It This Way" },
  { src: `${AUDIO_DIRECTORY}nicotinerzshy.mp3`, title: "Donaldy Trumpowich" },
  { src: `${AUDIO_DIRECTORY}blyat.mp3`, title: "Blyat" }
];

const DEFAULT_ACCENT_COLOR = "#ff0000";
const BOMBOCLOCK_ACCENT_COLOR = "#1f8a3b";
const BOMBOCLOCK_ACTIVATION_CLICKS = 3;
const BOMBOCLOCK_REPLACEMENTS = [
  { pattern: /Shaggies/g, replacement: "Jonkos" },
  { pattern: /shaggies/g, replacement: "jonkos" },
  { pattern: /ShagWekker/g, replacement: "BomboClock" },
  { pattern: /Shag/g, replacement: "Jonko" },
  { pattern: /shag/g, replacement: "jonko" }
];
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

function createTrackDescriptor(path, explicitLabel) {
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
  return { url, label, fileName };
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
      return createTrackDescriptor(reference, entry.title || entry.label || entry.name);
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
            return createTrackDescriptor(reference, entry.title || entry.label || entry.name);
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

function initAudioPlayer() {
  const playerEl = document.querySelector("[data-audio-player]");
  if (!playerEl) {
    return;
  }

  const loungeSection = playerEl.closest(".audio-lounge");
  const selectEl = playerEl.querySelector("[data-audio-select]");
  const statusEl = playerEl.querySelector("[data-audio-status]");
  const emptyStateEl = playerEl.querySelector("[data-audio-empty]");
  const playButton = playerEl.querySelector("[data-audio-play]");
  const stopButton = playerEl.querySelector("[data-audio-stop]");
  const progressInput = playerEl.querySelector("[data-audio-progress]");
  const currentTimeEl = playerEl.querySelector("[data-audio-current]");
  const totalTimeEl = playerEl.querySelector("[data-audio-total]");
  const downloadLink = playerEl.querySelector("[data-audio-download]");
  const volumeInput = playerEl.querySelector("[data-audio-volume]");
  const volumeBox = playerEl.querySelector(".audio-player__volume-box");

  if (
    !selectEl ||
    !statusEl ||
    !playButton ||
    !stopButton ||
    !progressInput ||
    !currentTimeEl ||
    !totalTimeEl
  ) {
    return;
  }

  progressInput.max = String(AUDIO_PROGRESS_STEPS);
  playerEl.dataset.state = "loading";

  const audio = new Audio();
  audio.preload = "auto";
  const DEFAULT_VOLUME = 0.8;
  audio.volume = DEFAULT_VOLUME;

  let tracks = [];
  let activeTrackIndex = -1;
  let isSeeking = false;

  const setStatus = message => {
    statusEl.textContent = message;
  };

  const applyVolumeVisual = ratio => {
    if (!volumeInput) {
      return;
    }
    const clamped = Math.max(0, Math.min(1, ratio));
    volumeInput.style.setProperty("--audio-volume", `${Math.round(clamped * 100)}%`);
    if (volumeBox) {
      volumeBox.style.setProperty("--audio-volume", `${Math.round(clamped * 100)}%`);
    }
  };

  const resetProgress = () => {
    progressInput.value = "0";
    progressInput.disabled = true;
    progressInput.style.setProperty("--audio-progress", "0%");
    currentTimeEl.textContent = "0:00";
    totalTimeEl.textContent = "0:00";
  };

  const updateDownloadLink = track => {
    if (!downloadLink) {
      return;
    }
    if (track) {
      downloadLink.hidden = false;
      downloadLink.href = track.url;
      const suggestedName = (track.fileName || track.label.replace(/\s+/g, "-")).toLowerCase();
      downloadLink.setAttribute("download", suggestedName);
      downloadLink.setAttribute("aria-label", `Download ${track.label}`);
    } else {
      downloadLink.hidden = true;
      downloadLink.removeAttribute("href");
      downloadLink.removeAttribute("aria-label");
    }
  };

  const updatePlayState = isPlaying => {
    playerEl.classList.toggle("is-playing", Boolean(isPlaying));
    if (loungeSection) {
      loungeSection.classList.toggle("audio-lounge--playing", Boolean(isPlaying));
    }
    playButton.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
  };

  const updateProgress = ended => {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
      progressInput.style.setProperty("--audio-progress", "0%");
      return;
    }
    const ratio = ended ? 1 : Math.max(0, Math.min(1, audio.currentTime / audio.duration));
    progressInput.value = String(Math.round(ratio * AUDIO_PROGRESS_STEPS));
    progressInput.style.setProperty("--audio-progress", `${(ratio * 100).toFixed(2)}%`);
    currentTimeEl.textContent = formatAudioTime(ended ? audio.duration : audio.currentTime);
    totalTimeEl.textContent = formatAudioTime(audio.duration);
  };

  const selectTrack = index => {
    if (!tracks.length) {
      return;
    }
    const nextIndex = Number(index);
    if (!Number.isInteger(nextIndex) || !tracks[nextIndex]) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      activeTrackIndex = -1;
      resetProgress();
      updateDownloadLink(null);
      setStatus("Selecteer een track om te luisteren.");
      return;
    }

    const track = tracks[nextIndex];
    const shouldResume = !audio.paused && !audio.ended;
    audio.pause();
    activeTrackIndex = nextIndex;
    resetProgress();
    updateDownloadLink(track);
    audio.src = track.url;
    audio.load();
    setStatus(`Geselecteerd: ${track.label}. Druk op play.`);

    if (shouldResume) {
      const resumePlayback = () => {
        audio.play().catch(error => {
          console.warn("Autoplay blocked", error);
          setStatus(`Geselecteerd: ${track.label}. Klik op play om te starten.`);
        });
      };
      audio.addEventListener("canplay", resumePlayback, { once: true });
    }
  };

  const populateSelect = () => {
    selectEl.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Kies een track...";
    selectEl.appendChild(placeholder);

    tracks.forEach((track, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = track.label;
      selectEl.appendChild(option);
    });

    selectEl.disabled = false;
    selectEl.value = "";
    if (emptyStateEl) {
      emptyStateEl.hidden = true;
    }
    playerEl.dataset.state = "ready";
    setStatus("Selecteer een track en druk op play.");
  };

  const stopPlayback = () => {
    audio.pause();
    audio.currentTime = 0;
    updateProgress();
    updatePlayState(false);
  };

  resetProgress();
  updateDownloadLink(null);
  setStatus("Vaste playlist wordt geladen...");

  if (volumeInput) {
    const initialValue = Number(volumeInput.value);
    const normalized = Number.isFinite(initialValue) ? Math.max(0, Math.min(100, initialValue)) / 100 : DEFAULT_VOLUME;
    audio.volume = normalized;
    volumeInput.value = String(Math.round(normalized * 100));
    applyVolumeVisual(normalized);

    const handleVolumeInput = event => {
      const value = Number(event.target.value);
      const ratio = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) / 100 : 0;
      audio.volume = ratio;
      applyVolumeVisual(ratio);
    };

    volumeInput.addEventListener("input", handleVolumeInput);
    volumeInput.addEventListener("change", handleVolumeInput);
  }

  discoverAudioTracks()
    .then(foundTracks => {
      tracks = foundTracks;
      activeTrackIndex = -1;
      if (tracks.length) {
        populateSelect();
      } else {
        selectEl.disabled = true;
        if (emptyStateEl) {
          emptyStateEl.hidden = false;
        }
        playerEl.dataset.state = "empty";
        setStatus("Geen audiobestanden gevonden. Werk de vaste playlist bij in script.js.");
        updateDownloadLink(null);
      }
    })
    .catch(error => {
      console.error("Audio discovery failed", error);
      selectEl.disabled = true;
      if (emptyStateEl) {
        emptyStateEl.hidden = false;
      }
      playerEl.dataset.state = "error";
      setStatus("Kon de vaste playlist niet laden. Controleer je configuratie.");
    });

  selectEl.addEventListener("change", event => {
    const { value } = event.target;
    if (value === "") {
      selectTrack(-1);
      return;
    }
    selectTrack(Number(value));
  });

  playButton.addEventListener("click", () => {
    if (!tracks.length) {
      return;
    }
    if (activeTrackIndex === -1) {
      selectTrack(0);
    }
    if (audio.paused || audio.ended) {
      audio
        .play()
        .then(() => {
          if (activeTrackIndex >= 0) {
            setStatus(`Aan het spelen: ${tracks[activeTrackIndex].label}`);
          }
        })
        .catch(error => {
          console.warn("Audio playback failed", error);
          setStatus("Afspelen werd geblokkeerd. Klik opnieuw om te proberen.");
        });
    } else {
      audio.pause();
    }
  });

  stopButton.addEventListener("click", () => {
    if (!tracks.length) {
      return;
    }
    stopPlayback();
    if (activeTrackIndex >= 0) {
      setStatus(`Gestopt: ${tracks[activeTrackIndex].label}`);
    } else {
      setStatus("Afspelen gestopt.");
    }
  });

  progressInput.addEventListener("input", () => {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
      return;
    }
    isSeeking = true;
    const ratio = Number(progressInput.value) / AUDIO_PROGRESS_STEPS;
    const targetTime = ratio * audio.duration;
    currentTimeEl.textContent = formatAudioTime(targetTime);
    progressInput.style.setProperty("--audio-progress", `${(ratio * 100).toFixed(2)}%`);
  });

  const endSeeking = () => {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
      isSeeking = false;
      return;
    }
    const ratio = Number(progressInput.value) / AUDIO_PROGRESS_STEPS;
    audio.currentTime = ratio * audio.duration;
    isSeeking = false;
  };

  progressInput.addEventListener("change", endSeeking);
  progressInput.addEventListener("mouseup", endSeeking);
  progressInput.addEventListener("touchend", endSeeking, { passive: true });

  audio.addEventListener("loadedmetadata", () => {
    progressInput.disabled = false;
    updateProgress();
  });

  audio.addEventListener("timeupdate", () => {
    if (isSeeking) {
      return;
    }
    updateProgress();
  });

  audio.addEventListener("play", () => {
    updatePlayState(true);
    if (activeTrackIndex >= 0) {
      setStatus(`Aan het spelen: ${tracks[activeTrackIndex].label}`);
    }
  });

  audio.addEventListener("pause", () => {
    if (audio.ended) {
      return;
    }
    updatePlayState(false);
    if (activeTrackIndex >= 0) {
      setStatus(`Gepauzeerd: ${tracks[activeTrackIndex].label}`);
    }
  });

  audio.addEventListener("ended", () => {
    updateProgress(true);
    updatePlayState(false);
    if (activeTrackIndex >= 0) {
      setStatus(`Track afgelopen: ${tracks[activeTrackIndex].label}`);
    } else {
      setStatus("Track afgelopen.");
    }
  });

  audio.addEventListener("emptied", () => {
    resetProgress();
    updatePlayState(false);
  });

  audio.addEventListener("error", event => {
    console.warn("Audio error", event);
    updatePlayState(false);
    resetProgress();
    setStatus("Kan de geselecteerde track niet afspelen.");
  });
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

function normalizeCustomEvents(events) {
  return events
    .filter(evt => typeof evt === "object" && evt !== null)
    .map(evt => ({
      id: evt.id || uniqueId(),
      time: typeof evt.time === "string" ? evt.time : "12:00",
      label: typeof evt.label === "string" && evt.label.trim() ? evt.label.trim() : "Untitled cue",
      recurrence: ["Daily", "Weekdays", "Weekends"].includes(evt.recurrence) ? evt.recurrence : "Daily",
      color: resolveHexColor(evt.color),
      notes: typeof evt.notes === "string" ? evt.notes.trim() : ""
    }))
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

function recurrenceTag(recurrence) {
  switch (recurrence) {
    case "MonWedThu":
      return "Mon/Wed/Thu";
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
        <p class="event-card__meta"><span class="event-time">${event.time}</span> · ${recurrenceTag(event.recurrence)}</p>
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
  events.forEach(event => {
    container.appendChild(buildEventCard(event, "custom"));
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
    pillEl.textContent = recurrenceTag(entry.event.recurrence);
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
  const fragment = document.createDocumentFragment();

  entries.forEach(entry => {
    const accent = resolveHexColor(entry.event.color, fallbackAccent);
    const item = existingItems.get(entry.event.id) || createTimelineItem();
    updateTimelineItem(item, entry, compact, soonest && soonest.event.id === entry.event.id, accent, fallbackAccent);
    fragment.appendChild(item);
  });

  listEl.replaceChildren(fragment);
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
    !timelineList ||
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
    const now = new Date();
    const customEvents = loadCustomEvents();
    const events = getAllEvents(customEvents);

    let soonest = null;
    events.forEach(event => {
      const next = nextOccurrenceFor(event, now);
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

  const sliderMin = Number(goalInput.min) || 1;
  const sliderMax = Number(goalInput.max) || 20;

  const clampGoal = value => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return sliderMin;
    }
    return Math.min(sliderMax, Math.max(sliderMin, Math.round(numeric)));
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

  const defaultGoal = clampGoal(goalInput.value || sliderMin);
  let state = loadState() || { goal: defaultGoal, count: 0 };

  let lastCompletionState = state.count >= state.goal && state.goal > 0;
  let explosionCleanupTimer = null;

  goalInput.value = state.goal;
  if (state.count > state.goal) {
    state.count = state.goal;
    persistState(state);
  }

  const updateGoalValue = () => {
    goalValueEl.textContent = pluralizeShag(state.goal);
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
    state.goal = clampGoal(event.target.value);
    goalInput.value = state.goal;
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
  if (persist) {
    writeStoredPreference(PREFERENCE_KEYS.accentColor, resolved);
  }
}

function initBomboClockEasterEgg() {
  const brand = document.querySelector(".site-header .brand");
  if (!brand) {
    return;
  }

  let activationCount = 0;
  let textTransformed = false;
  let accentApplied = false;
  const animationClass = "brand--bombo-hint";

  const triggerHintAnimation = () => {
    brand.classList.remove(animationClass);
    // Force a reflow so the animation can replay on successive clicks.
    void brand.offsetWidth;
    brand.classList.add(animationClass);
  };

  const applyReplacements = () => {
    if (textTransformed) {
      return;
    }

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          return node && node.nodeValue && node.nodeValue.trim()
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        }
      }
    );

    const transform = value =>
      BOMBOCLOCK_REPLACEMENTS.reduce((current, replacement) => {
        return current.replace(replacement.pattern, replacement.replacement);
      }, value);

    while (walker.nextNode()) {
      const node = walker.currentNode;
      const original = node.nodeValue;
      const updated = transform(original);
      if (updated !== original) {
        node.nodeValue = updated;
      }
    }

    if (typeof document.title === "string" && document.title) {
      const updatedTitle = transform(document.title);
      if (updatedTitle !== document.title) {
        document.title = updatedTitle;
      }
    }

    document.querySelectorAll("[aria-label]").forEach(element => {
      const label = element.getAttribute("aria-label");
      if (label) {
        const updated = transform(label);
        if (updated !== label) {
          element.setAttribute("aria-label", updated);
        }
      }
    });

    textTransformed = true;
  };

  const applyAccent = () => {
    if (accentApplied) {
      return;
    }

    setAccentColor(BOMBOCLOCK_ACCENT_COLOR, { persist: false });
    const accentControl = document.getElementById("accentControl");
    const normalized = normalizeHexColor(BOMBOCLOCK_ACCENT_COLOR);
    if (accentControl && normalized) {
      accentControl.value = normalized;
    }
    accentApplied = true;
  };

  brand.addEventListener("click", () => {
    activationCount += 1;
    triggerHintAnimation();
    if (activationCount >= BOMBOCLOCK_ACTIVATION_CLICKS) {
      applyReplacements();
      applyAccent();
    }
  });

  brand.addEventListener("animationend", event => {
    if (event.target === brand) {
      brand.classList.remove(animationClass);
    }
  });
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

  if (!event) {
    editingId.value = "";
    labelInput.value = "";
    timeInput.value = "";
    recurrenceSelect.value = "Daily";
    colorInput.value = getCurrentAccentColor();
    notesInput.value = "";
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
  cancelEdit.hidden = false;
  submitBtn.textContent = "Update cue";
}

(function init() {
  const footerYear = document.getElementById("footerYear");
  if (footerYear) {
    footerYear.textContent = new Date().getFullYear();
  }

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

  initBomboClockEasterEgg();

  initAudioPlayer();
  initShagMeter();

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
  });

  clearCustom.addEventListener("click", () => {
    if (!customEvents.length) return;
    if (confirm("Remove all custom cues?")) {
      customEvents = [];
      saveCustomEvents(customEvents);
      setEditingState(null);
      renderAll();
    }
  });

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

    if (!/^\d{2}:\d{2}$/.test(time)) {
      alert("Please provide a valid time in HH:MM format.");
      return;
    }

    if (id) {
      customEvents = customEvents.map(evt => (evt.id === id ? { ...evt, label, time, recurrence, color, notes } : evt));
    } else {
      customEvents = [
        ...customEvents,
        { id: uniqueId(), label, time, recurrence, color, notes }
      ];
    }

    customEvents = normalizeCustomEvents(customEvents);
    saveCustomEvents(customEvents);
    renderAll();
    createEventForm.reset();
    setEditingState(null);
  });

  setInterval(() => {
    updateCountdowns(getAllEvents(customEvents), compactMode, { timelineList });
  }, 1000);
})();
