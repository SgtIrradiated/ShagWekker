const DEFAULT_EVENTS = [
  {
    id: "core-focus",
    time: "10:15",
    label: "Eerste Shaggie Ritueel",
    recurrence: "Daily",
    description: "Rol een verse shag en neem een diepe trek met je ochtendkoffie.",
    color: "#9b6aff"
  },
  {
    id: "core-lunch",
    time: "12:00",
    label: "Broodje Tabakspraat",
    recurrence: "Daily",
    description: "Lunchpauze op het balkon met een sjekkie en straatpraat.",
    color: "#6affc8"
  },
  {
    id: "core-afternoon",
    time: "14:30",
    label: "Middag Shag Shuffle",
    recurrence: "MonWedThu",
    description: "Alleen op ma/wo/do: even uitblazen en de middagshag aansteken.",
    color: "#ffc66a"
  },
  {
    id: "core-wrap",
    time: "16:00",
    label: "Borrel Shag Afsluiter",
    recurrence: "MonWedThu",
    description: "Sluit de dag af met een stevige shag en napraat over de dag.",
    color: "#ff9b6a"
  }
];

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
  { src: `${AUDIO_DIRECTORY}audio.mp3`, title: "Blije Man" },
  { src: `${AUDIO_DIRECTORY}Hank.mp3`, title: "Are You Sure Hank Done It This Way" },
  { src:  `${AUDIO_DIRECTORY}nicotinerzshy.mp3`, title: "Donaldy Trumpowich" },
  { src:  `${AUDIO_DIRECTORY}blyat.mp3`, title: "Blyat" }
];

const PREFERENCE_KEYS = {
  highContrast: "shagwekker.preferences.highContrast"
};

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

  let tracks = [];
  let activeTrackIndex = -1;
  let isSeeking = false;

  const setStatus = message => {
    statusEl.textContent = message;
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
          color: "#6aa2ff",
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
      color: typeof evt.color === "string" ? evt.color : "#6aa2ff",
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

function renderDefaultBoard(container) {
  container.innerHTML = "";
  [...DEFAULT_EVENTS]
    .sort((a, b) => toMinutes(a.time) - toMinutes(b.time))
    .forEach(event => {
      container.appendChild(buildEventCard(event));
    });
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

function buildTimeline(listEl, events, compact) {
  listEl.innerHTML = "";
  listEl.classList.toggle("timeline--compact", Boolean(compact));
  listEl.dataset.state = events.length ? "populated" : "empty";

  const now = new Date();
  const dayWindow = 24 * 60 * 60 * 1000;
  const entries = events.map(event => {
    const next = nextOccurrenceFor(event, now);
    const remain = next - now;
    return {
      event,
      next,
      remain,
      countdown: diffParts(remain)
    };
  });

  entries.sort((a, b) => a.remain - b.remain);
  entries.slice(0, 6).forEach(entry => {
    const accent = entry.event.color || "#6aa2ff";
    const detail = entry.event.notes?.trim() || entry.event.description || "";
    const relativeProgress = 1 - Math.max(0, Math.min(1, entry.remain / dayWindow));
    const progressPercent = relativeProgress <= 0 ? 0 : Math.max(1, Math.round(relativeProgress * 100));
    const progressLabel = progressPercent <= 0
      ? "Cue is more than a day away"
      : `${progressPercent}% of today's rhythm complete before this cue`;

    const item = document.createElement("li");
    item.className = "timeline__item";
    item.dataset.color = accent;
    item.style.setProperty("--timeline-accent", accent);
    item.innerHTML = `
      <div class="timeline__decor" aria-hidden="true">
        <span class="timeline__dot"></span>
        <span class="timeline__glow"></span>
      </div>
      <div class="timeline__body">
        <header class="timeline__header">
          <p class="timeline__label">${entry.event.label}</p>
          <time class="timeline__time" datetime="${entry.event.time}">${entry.event.time}</time>
        </header>
        ${detail ? `<p class="timeline__detail">${detail}</p>` : ""}
        <div class="timeline__meta">
          <span class="timeline__pill">${recurrenceTag(entry.event.recurrence)}</span>
          <span class="timeline__count"><span class="timeline__count-label">Next in</span>${formatCountdown(entry.countdown, compact)}</span>
        </div>
        <div class="timeline__progress" role="img" aria-label="${progressLabel}">
          <span style="--fill: ${progressPercent}%"></span>
        </div>
      </div>
    `;
    listEl.appendChild(item);
  });

  if (!listEl.children.length) {
    const item = document.createElement("li");
    item.className = "timeline__item timeline__item--empty";
    item.innerHTML = `
      <div class="timeline__body">
        <p class="timeline__label">Add a cue to populate the timeline.</p>
        <p class="timeline__detail">Your saved reminders will animate into this timeline once you create them.</p>
      </div>
    `;
    listEl.appendChild(item);
  }
}

function updateSummaries(now, events, soonest) {
  const liveClock = document.getElementById("liveClock");
  liveClock.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const customSummaryCount = document.getElementById("customSummaryCount");
  const customCount = events.filter(evt => !DEFAULT_EVENTS.find(def => def.id === evt.id)).length;
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

function updateCountdowns(events, compact) {
  const now = new Date();
  let soonest = null;

  events.forEach(event => {
    const card = document.querySelector(`.event-card[data-id="${event.id}"]`);
    if (!card) return;
    const next = nextOccurrenceFor(event, now);
    const remain = next - now;
    const parts = diffParts(remain);
    const countEl = card.querySelector(".event-card__count");
    if (countEl) {
      countEl.textContent = formatCountdown(parts, compact);
    }
    if (!soonest || remain < soonest.remain) {
      soonest = { event, remain };
    }
  });

  highlightSoonestCard(soonest);
  updateSummaries(now, events, soonest);
  return now;
}

function setAccentColor(color) {
  document.documentElement.style.setProperty("--accent", color);
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
    colorInput.value = document.documentElement.style.getPropertyValue("--accent") || "#6aa2ff";
    notesInput.value = "";
    cancelEdit.hidden = true;
    submitBtn.textContent = "Save cue";
    return;
  }

  editingId.value = event.id;
  labelInput.value = event.label;
  timeInput.value = event.time;
  recurrenceSelect.value = event.recurrence;
  colorInput.value = event.color || "#6aa2ff";
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
  if (accentControl) {
    setAccentColor(accentControl.value);
    accentControl.addEventListener("input", event => {
      setAccentColor(event.target.value);
    });
  }

  initAudioPlayer();

  const defaultBoard = document.getElementById("defaultBoard");
  const customBoard = document.getElementById("customBoard");
  const timelineList = document.getElementById("timelineList");
  const customEmptyState = document.getElementById("customEmptyState");
  const precisionToggle = document.getElementById("precisionToggle");
  const demoButton = document.getElementById("demoButton");
  const clearCustom = document.getElementById("clearCustom");
  const cancelEdit = document.getElementById("cancelEdit");
  const createEventForm = document.getElementById("createEventForm");

  const plannerElementsReady =
    defaultBoard &&
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
    renderDefaultBoard(defaultBoard);
    renderCustomBoard(customBoard, customEvents, customEmptyState);
    buildTimeline(timelineList, getAllEvents(customEvents), compactMode);
    updateCountdowns(getAllEvents(customEvents), compactMode);
  };

  renderAll();

  precisionToggle.addEventListener("click", () => {
    compactMode = !compactMode;
    precisionToggle.setAttribute("aria-pressed", String(compactMode));
    precisionToggle.textContent = compactMode ? "Detailed view" : "Compact view";
    buildTimeline(timelineList, getAllEvents(customEvents), compactMode);
    updateCountdowns(getAllEvents(customEvents), compactMode);
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
    const color = formData.get("color").toString();
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
    setEditingState(null);
    renderAll();
    createEventForm.reset();
  });

  setInterval(() => {
    const now = updateCountdowns(getAllEvents(customEvents), compactMode);
    if (now.getSeconds() % 5 === 0) {
      buildTimeline(timelineList, getAllEvents(customEvents), compactMode);
    }
  }, 1000);
})();
