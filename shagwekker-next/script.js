/* ==========================================================================
   ShagWekker — één script voor alle pagina's.

   Patroon: elke initX() zoekt z'n eigen ankerelement op en haakt af als dat
   ontbreekt. De init()-IIFE onderaan roept álles onvoorwaardelijk aan;
   pagina-verschillen zitten puur in de markup.
   ========================================================================== */

"use strict";

/* ----------------------------- Storage keys ------------------------------ */

const EVENTS_STORAGE_KEY = "shagwekker.events.v2";
const STORAGE_KEY = "shagwekker.customEvents.v1"; // legacy, eenmalig gemigreerd
const LEGACY_KEY = "multiCountdown.times"; // oer-legacy, eenmalig gemigreerd
const SHAGMETER_KEY = "shagwekker.shagmeter.state.v1";
const THEME_KEY = "shagwekker.preferences.theme.v1";
const ACCENT_KEY = "shagwekker.preferences.accent.v1";
const CONTRAST_KEY = "shagwekker.preferences.contrast.v1";
const ALARM_PREFS_KEY = "shagwekker.alarm.prefs.v1";
const ONBOARDED_KEY = "shagwekker.onboarded.v1";

const EXPORT_SCHEMA = "shagwekker.cues.v2";
const EXPORT_SCHEMA_V1 = "shagwekker.cues.v1";

const DEFAULT_ACCENT = "#ff0000";
const RECURRENCES = ["Daily", "Weekdays", "Weekends", "SpecificWeekdays"];
const DAY_SHORT = ["Zo", "Ma", "Di", "Wo", "Do", "Vr", "Za"];
const ALARM_ROLLOVER_MS = 90 * 1000; // venster waarbinnen een verstreken cue nog afgaat

const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

/* ------------------------------- Kleine hulpjes -------------------------- */

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage vol of geblokkeerd — dan maar zonder geheugen */
  }
}

function uid() {
  return `cue-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function localDateStamp(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function formatClock(date) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const clock = `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
  return days > 0 ? `${days}d ${clock}` : clock;
}

function humanizeCountdown(ms) {
  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes < 1) return "minder dan een minuut";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 1) return `${minutes} ${minutes === 1 ? "minuut" : "minuten"}`;
  if (minutes === 0) return `${hours} uur`;
  return `${hours} uur en ${minutes} ${minutes === 1 ? "minuut" : "minuten"}`;
}

/* --------------------------------- Toasts -------------------------------- */

function showToast(message, tone = "info") {
  const region = document.querySelector("[data-toast-region]");
  if (!region) return;
  const toast = document.createElement("div");
  toast.className = `toast toast--${tone}`;
  toast.textContent = message;
  region.appendChild(toast);
  window.setTimeout(() => {
    toast.classList.add("toast--leaving");
    window.setTimeout(() => toast.remove(), 400);
  }, 4200);
}

/* --------------------------- Event-datamodel ------------------------------
   Eén uniforme, volledig bewerkbare entiteit:
   { id, time, label, recurrence, color, notes, updatedAt, weekdays? }       */

function makeExampleEvent() {
  return {
    id: uid(),
    time: "15:00",
    label: "Voorbeeld Shaggie",
    recurrence: "Daily",
    color: DEFAULT_ACCENT,
    notes: "Pas me aan of gooi me weg — zo maak je je eigen ShagPauze.",
    updatedAt: new Date().toISOString(),
  };
}

function normalizeTime(value) {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${pad2(hours)}:${pad2(minutes)}`;
}

function normalizeEvents(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const events = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;

    const time = normalizeTime(item.time);
    if (!time) continue;

    let recurrence = item.recurrence;
    let weekdays = Array.isArray(item.weekdays) ? item.weekdays : undefined;

    // Legacy combinatie "MonWedThu" wordt bij laden ingevouwen.
    if (recurrence === "MonWedThu") {
      recurrence = "SpecificWeekdays";
      weekdays = [1, 3, 4];
    }
    if (!RECURRENCES.includes(recurrence)) recurrence = "Daily";

    if (recurrence === "SpecificWeekdays") {
      weekdays = [...new Set((weekdays || [])
        .map(Number)
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))]
        .sort((a, b) => a - b);
      if (weekdays.length === 0) {
        recurrence = "Daily";
        weekdays = undefined;
      }
    } else {
      weekdays = undefined;
    }

    let id = typeof item.id === "string" && item.id ? item.id : uid();
    if (seen.has(id)) id = uid();
    seen.add(id);

    const label = String(item.label ?? "").trim() || "Shagpauze";
    const color = typeof item.color === "string" && /^#[0-9a-f]{6}$/i.test(item.color)
      ? item.color.toLowerCase()
      : DEFAULT_ACCENT;
    // `notes` verving het oude core-only `description`-veld.
    const notes = String(item.notes ?? item.description ?? "").trim();
    const updatedAt = typeof item.updatedAt === "string" && !Number.isNaN(Date.parse(item.updatedAt))
      ? item.updatedAt
      : new Date().toISOString();

    const event = { id, time, label, recurrence, color, notes, updatedAt };
    if (weekdays) event.weekdays = weekdays;
    events.push(event);
  }

  return events;
}

function recurrenceMatchesDay(event, day) {
  switch (event.recurrence) {
    case "Weekdays":
      return day >= 1 && day <= 5;
    case "Weekends":
      return day === 0 || day === 6;
    case "SpecificWeekdays":
      return Array.isArray(event.weekdays) && event.weekdays.includes(day);
    case "Daily":
    default:
      return true;
  }
}

function nextOccurrenceFor(event, now = new Date()) {
  const time = normalizeTime(event.time);
  if (!time) return null;
  const [hours, minutes] = time.split(":").map(Number);
  for (let offset = 0; offset <= 7; offset += 1) {
    const candidate = new Date(
      now.getFullYear(), now.getMonth(), now.getDate() + offset,
      hours, minutes, 0, 0,
    );
    if (candidate <= now) continue;
    if (recurrenceMatchesDay(event, candidate.getDay())) return candidate;
  }
  return null;
}

function recurrenceTag(event) {
  switch (event.recurrence) {
    case "Weekdays":
      return "Doordeweeks";
    case "Weekends":
      return "Weekend";
    case "SpecificWeekdays":
      return [1, 2, 3, 4, 5, 6, 0]
        .filter((day) => (event.weekdays || []).includes(day))
        .map((day) => DAY_SHORT[day])
        .join(" · ") || "Specifieke dagen";
    case "Daily":
    default:
      return "Elke dag";
  }
}

/* ------------------------------- eventStore -------------------------------
   De enige naad richting opslag. load()/save() kunnen later async worden en
   tegen een API praten; niets buiten deze adapter raakt localStorage voor
   events aan. De aanwezigheid van de v2-sleutel is de "al geïnitialiseerd"-
   vlag: alles wissen laat een lege store achter en wordt nooit her-geseed.  */

const eventStore = {
  load() {
    const raw = localStorage.getItem(EVENTS_STORAGE_KEY);
    if (raw !== null) {
      try {
        return normalizeEvents(JSON.parse(raw));
      } catch {
        return [];
      }
    }

    // Eerste keer: eenmalig migreren vanaf de oude sleutels.
    const migrated = [];
    const v1 = readJson(STORAGE_KEY);
    if (Array.isArray(v1)) migrated.push(...v1);

    let legacy = readJson(LEGACY_KEY);
    if (typeof legacy === "string") legacy = legacy.split(",");
    if (Array.isArray(legacy)) {
      migrated.push(...legacy
        .filter((entry) => typeof entry === "string")
        .map((entry) => ({ time: entry.trim(), label: "Shagpauze" })));
    }

    const events = normalizeEvents(migrated);
    const seeded = events.length > 0 ? events : [makeExampleEvent()];
    this.save(seeded);
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_KEY);
    } catch {
      /* niks aan te doen */
    }
    return seeded;
  },

  save(events) {
    writeJson(EVENTS_STORAGE_KEY, events);
  },
};

/* --------------------- Gedeelde module-koppelpunten -----------------------
   De planner praat tegen deze objecten; initAlarm/initTabBadge vullen ze in
   wanneer hun ankers bestaan. Zonder anker blijven het no-ops.              */

const alarmCenter = { fire() {} };
const tabBadge = { setImminent() {} };

/* ------------------------- Thema & accent (altijd) ------------------------ */

function setAccentColor(color, persist = true) {
  document.documentElement.style.setProperty("--accent", color);
  if (persist) {
    try {
      localStorage.setItem(ACCENT_KEY, color);
    } catch { /* jammer dan */ }
  }
}

function resetAccentColor() {
  document.documentElement.style.removeProperty("--accent");
  try {
    localStorage.removeItem(ACCENT_KEY);
  } catch { /* jammer dan */ }
}

function applyThemeChoice(choice, persist = true) {
  const root = document.documentElement;
  const valid = ["light", "dark", "sepia", "auto"];
  const safeChoice = valid.includes(choice) ? choice : "auto";
  const resolved = safeChoice === "auto"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : safeChoice;
  root.dataset.theme = resolved;
  root.dataset.themeChoice = safeChoice;
  if (persist) {
    try {
      localStorage.setItem(THEME_KEY, safeChoice);
    } catch { /* jammer dan */ }
  }
}

function initPreferences() {
  const root = document.documentElement;
  if (!root) return;

  applyThemeChoice(localStorage.getItem(THEME_KEY) || "auto", false);

  const schemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
  schemeQuery.addEventListener("change", () => {
    if (root.dataset.themeChoice === "auto") applyThemeChoice("auto", false);
  });

  const accent = localStorage.getItem(ACCENT_KEY);
  if (accent && /^#[0-9a-f]{6}$/i.test(accent)) setAccentColor(accent, false);

  if (localStorage.getItem(CONTRAST_KEY) === "1") root.classList.add("high-contrast");
}

function initThemeSwitcher() {
  const switcher = document.querySelector("[data-theme-switcher]");
  if (!switcher) return;

  const buttons = [...switcher.querySelectorAll("[data-theme-choice]")];

  function syncPressed() {
    const choice = document.documentElement.dataset.themeChoice || "auto";
    buttons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.themeChoice === choice));
    });
  }

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      applyThemeChoice(button.dataset.themeChoice);
      syncPressed();
    });
  });

  syncPressed();
}

function initAccentPicker() {
  const input = document.querySelector("[data-accent-input]");
  if (!input) return;

  const stored = localStorage.getItem(ACCENT_KEY);
  if (stored && /^#[0-9a-f]{6}$/i.test(stored)) input.value = stored;

  input.addEventListener("input", () => setAccentColor(input.value));

  const reset = document.querySelector("[data-accent-reset]");
  if (reset) {
    reset.addEventListener("click", () => {
      resetAccentColor();
      input.value = DEFAULT_ACCENT;
      showToast("Accent terug naar vertrouwd rood.", "info");
    });
  }
}

function initHighContrast() {
  const toggle = document.querySelector("[data-contrast-toggle]");
  if (!toggle) return;

  const root = document.documentElement;

  function sync() {
    toggle.setAttribute("aria-pressed", String(root.classList.contains("high-contrast")));
  }

  toggle.addEventListener("click", () => {
    const enabled = root.classList.toggle("high-contrast");
    try {
      if (enabled) localStorage.setItem(CONTRAST_KEY, "1");
      else localStorage.removeItem(CONTRAST_KEY);
    } catch { /* jammer dan */ }
    sync();
  });

  sync();
}

/* ------------------------------- Mobiele nav ------------------------------ */

function initMobileNav() {
  const toggle = document.querySelector("[data-nav-toggle]");
  const nav = document.querySelector("[data-site-nav]");
  const backdrop = document.querySelector("[data-nav-backdrop]");
  if (!toggle || !nav || !backdrop) return;

  const main = document.querySelector("[data-page-main]");
  const footer = document.querySelector("[data-page-footer]");
  let open = false;

  function setOpen(next) {
    open = next;
    document.documentElement.classList.toggle("nav-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    backdrop.hidden = !open;
    if (main) main.inert = open;
    if (footer) footer.inert = open;
    if (open) {
      const first = nav.querySelector("a, button");
      if (first) first.focus();
    }
  }

  toggle.addEventListener("click", () => setOpen(!open));
  backdrop.addEventListener("click", () => setOpen(false));
  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) setOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && open) {
      setOpen(false);
      toggle.focus();
    }
  });
}

/* --------------------------- Alarm: bel + notificaties --------------------
   Losse, minimale chime (géén audiospeler) plus de Notifications API.
   De chime-WAV wordt ter plekke gesynthetiseerd: nul extra bestanden.      */

function buildChimeWav() {
  const sampleRate = 22050;
  const duration = 1.2;
  const total = Math.floor(sampleRate * duration);
  const buffer = new ArrayBuffer(44 + total * 2);
  const view = new DataView(buffer);

  const writeText = (offset, text) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeText(0, "RIFF");
  view.setUint32(4, 36 + total * 2, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, total * 2, true);

  const notes = [
    { freq: 880.0, start: 0.0 },
    { freq: 1174.66, start: 0.18 },
    { freq: 1567.98, start: 0.36 },
  ];
  for (let i = 0; i < total; i += 1) {
    const t = i / sampleRate;
    let sample = 0;
    for (const note of notes) {
      if (t < note.start) continue;
      const local = t - note.start;
      sample += Math.sin(2 * Math.PI * note.freq * local) * Math.exp(-local * 5) * 0.28;
    }
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, sample)) * 0x7fff, true);
  }

  return buffer;
}

function initAlarm() {
  const chime = document.querySelector("[data-alarm-chime]");
  if (!chime) return;

  const prefs = Object.assign({ chime: true, notify: false }, readJson(ALARM_PREFS_KEY));
  const chimeToggle = document.querySelector("[data-chime-toggle]");
  const notifyToggle = document.querySelector("[data-notify-toggle]");
  let chimeReady = false;

  function persist() {
    writeJson(ALARM_PREFS_KEY, prefs);
  }

  function ensureChime() {
    if (chimeReady) return;
    chime.src = URL.createObjectURL(new Blob([buildChimeWav()], { type: "audio/wav" }));
    chimeReady = true;
  }

  function notificationsUsable() {
    return "Notification" in window && Notification.permission === "granted";
  }

  function syncToggles() {
    if (chimeToggle) chimeToggle.setAttribute("aria-pressed", String(prefs.chime));
    if (notifyToggle) {
      notifyToggle.setAttribute("aria-pressed", String(prefs.notify && notificationsUsable()));
    }
  }

  if (chimeToggle) {
    chimeToggle.addEventListener("click", () => {
      prefs.chime = !prefs.chime;
      persist();
      syncToggles();
      if (prefs.chime) {
        ensureChime();
        chime.currentTime = 0;
        chime.play().catch(() => {});
        showToast("Belletje aan — je hoort 'm zo rinkelen.", "success");
      } else {
        showToast("Belletje uit. Stille shaggies dan maar.", "info");
      }
    });
  }

  if (notifyToggle) {
    notifyToggle.addEventListener("click", async () => {
      if (!("Notification" in window)) {
        showToast("Je browser doet niet aan notificaties.", "warning");
        return;
      }
      if (prefs.notify && notificationsUsable()) {
        prefs.notify = false;
        persist();
        syncToggles();
        showToast("Notificaties uit.", "info");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        prefs.notify = true;
        persist();
        showToast("Notificaties aan — je mist geen shaggie meer.", "success");
      } else {
        prefs.notify = false;
        persist();
        showToast("Notificaties geweigerd door je browser.", "warning");
      }
      syncToggles();
    });
  }

  alarmCenter.fire = (event) => {
    showToast(`${event.label} — Tijd voor je shagpauze.`, "success");
    if (prefs.chime) {
      ensureChime();
      chime.currentTime = 0;
      chime.play().catch(() => {});
    }
    if (prefs.notify && notificationsUsable()) {
      try {
        new Notification(event.label || "ShagWekker", {
          body: "Tijd voor je shagpauze.",
          icon: "/android-chrome-192x192.png",
          tag: `shagwekker-${event.id}`,
        });
      } catch { /* sommige browsers zeuren — toast + bel staan er al */ }
    }
  };

  syncToggles();
}

/* ------------------------ Tabblad-badge & titelflits ----------------------- */

function initTabBadge() {
  const iconLink = document.querySelector('link[rel="icon"]');
  if (!iconLink) return;

  const baseHref = iconLink.href;
  const baseTitle = document.title;
  const baseImage = new Image();
  baseImage.src = baseHref;

  let imminent = false;
  let flashOn = false;
  let timer = null;

  function badgeHref() {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (!ctx) return baseHref;
    if (baseImage.complete && baseImage.naturalWidth > 0) {
      ctx.drawImage(baseImage, 0, 0, 64, 64);
    }
    const accent = getComputedStyle(document.documentElement)
      .getPropertyValue("--accent").trim() || DEFAULT_ACCENT;
    ctx.beginPath();
    ctx.arc(46, 46, 16, 0, Math.PI * 2);
    ctx.fillStyle = accent;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    try {
      return canvas.toDataURL("image/png");
    } catch {
      return baseHref;
    }
  }

  function flash() {
    flashOn = !flashOn;
    document.title = flashOn ? "🚨 Bijna shagtijd! — ShagWekker" : baseTitle;
  }

  function calm() {
    if (timer) {
      window.clearInterval(timer);
      timer = null;
    }
    flashOn = false;
    document.title = baseTitle;
    iconLink.href = baseHref;
  }

  function sync() {
    if (imminent && document.hidden) {
      if (!timer) {
        iconLink.href = badgeHref();
        timer = window.setInterval(flash, 1000);
        flash();
      }
    } else {
      calm();
    }
  }

  tabBadge.setImminent = (value) => {
    if (value === imminent) return;
    imminent = value;
    sync();
  };

  document.addEventListener("visibilitychange", sync);
}

/* ---------------------------------- Planner --------------------------------
   Countdown-engine, timeline (DOM-reconciliatie op id), CRUD, import/export,
   demo-cues, statistieken en de 1-seconde-tick.                              */

function demoEvents() {
  const stamp = new Date().toISOString();
  return [
    { id: uid(), time: "09:30", label: "Ochtend Shaggie", recurrence: "Weekdays", color: "#ff0000", notes: "Eerst koffie, dan vloeitje.", updatedAt: stamp },
    { id: uid(), time: "12:45", label: "Lunch Shag", recurrence: "Daily", color: "#ff8800", notes: "Na de boterham met hagelslag.", updatedAt: stamp },
    { id: uid(), time: "16:20", label: "Vrijmibo Shaggie", recurrence: "SpecificWeekdays", weekdays: [5], color: "#22aa55", notes: "Met een biertje erbij.", updatedAt: stamp },
    { id: uid(), time: "11:00", label: "Weekend Bakkie & Shaggie", recurrence: "Weekends", color: "#3377ff", notes: "Rustig aan, het is weekend.", updatedAt: stamp },
  ];
}

function initPlanner() {
  const root = document.querySelector("[data-planner]");
  if (!root) return;

  /* -- DOM-grepen -- */
  const form = root.querySelector("[data-cue-form]");
  const labelInput = form.querySelector("#cueLabel");
  const timeInput = form.querySelector("#cueTime");
  const colorInput = form.querySelector("#cueColor");
  const recurrenceSelect = form.querySelector("#cueRecurrence");
  const notesInput = form.querySelector("#cueNotes");
  const weekdayPicker = form.querySelector("[data-weekday-picker]");
  const weekdayBoxes = [...form.querySelectorAll('input[name="weekday"]')];
  const submitButton = form.querySelector("[data-cue-submit]");
  const cancelButton = form.querySelector("[data-cue-cancel]");

  const listEl = root.querySelector("[data-timeline-list]");
  const emptyEl = root.querySelector("[data-timeline-empty]");
  const announcer = root.querySelector("[data-countdown-announcer]");

  const heroNext = document.querySelector("[data-hero-next]");
  const heroEmpty = document.querySelector("[data-hero-empty]");
  const heroLabel = document.querySelector("[data-hero-label]");
  const heroCountdown = document.querySelector("[data-hero-countdown]");
  const heroTime = document.querySelector("[data-hero-time]");
  const statCues = document.querySelector("[data-stat-cues]");
  const statMg = document.querySelector("[data-stat-mg]");

  /* -- staat -- */
  let events = eventStore.load();
  let editingId = null;
  let lastOrderSignature = "";
  let lastAnnouncedMinute = -1;
  const timelineNodes = new Map(); // id -> { li, refs..., stamp }
  const alarmSchedule = new Map(); // id -> volgende afgaan (ms-epoch)

  function persist() {
    eventStore.save(events);
  }

  /* ------------------------------ Formulier ------------------------------ */

  function syncWeekdayPicker() {
    weekdayPicker.hidden = recurrenceSelect.value !== "SpecificWeekdays";
  }

  function resetForm() {
    editingId = null;
    form.reset();
    colorInput.value = DEFAULT_ACCENT;
    submitButton.textContent = "Las in!";
    cancelButton.hidden = true;
    syncWeekdayPicker();
  }

  function startEditing(event) {
    editingId = event.id;
    labelInput.value = event.label;
    timeInput.value = event.time;
    colorInput.value = event.color;
    recurrenceSelect.value = event.recurrence;
    notesInput.value = event.notes;
    weekdayBoxes.forEach((box) => {
      box.checked = (event.weekdays || []).includes(Number(box.value));
    });
    submitButton.textContent = "Werk bij";
    cancelButton.hidden = false;
    syncWeekdayPicker();
    labelInput.focus();
  }

  recurrenceSelect.addEventListener("change", syncWeekdayPicker);
  cancelButton.addEventListener("click", resetForm);

  form.addEventListener("submit", (submitEvent) => {
    submitEvent.preventDefault();

    const label = labelInput.value.trim();
    const time = normalizeTime(timeInput.value);
    if (!label || !time) {
      showToast("Naam én tijdstip zijn verplicht, maat.", "warning");
      return;
    }

    const recurrence = recurrenceSelect.value;
    const weekdays = weekdayBoxes
      .filter((box) => box.checked)
      .map((box) => Number(box.value))
      .sort((a, b) => a - b);
    if (recurrence === "SpecificWeekdays" && weekdays.length === 0) {
      showToast("Kies minstens één dag voor je shaggie.", "warning");
      return;
    }

    const payload = {
      label,
      time,
      recurrence,
      color: colorInput.value,
      notes: notesInput.value.trim(),
      updatedAt: new Date().toISOString(),
    };
    if (recurrence === "SpecificWeekdays") payload.weekdays = weekdays;

    if (editingId) {
      const index = events.findIndex((event) => event.id === editingId);
      if (index !== -1) {
        const updated = { ...events[index], ...payload };
        if (recurrence !== "SpecificWeekdays") delete updated.weekdays;
        events[index] = updated;
        showToast("Cue bijgewerkt", "success");
      }
    } else {
      events.push({ id: uid(), ...payload });
      showToast("Cue opgeslagen", "success");
    }

    persist();
    resetForm();
    tick();
  });

  /* ------------------------------- Timeline ------------------------------ */

  function buildTimelineNode(event) {
    const li = document.createElement("li");
    li.className = "timeline-item";
    li.dataset.id = event.id;

    const bar = document.createElement("span");
    bar.className = "timeline-item__bar";
    bar.setAttribute("aria-hidden", "true");

    const head = document.createElement("div");
    head.className = "timeline-item__head";

    const label = document.createElement("span");
    label.className = "timeline-item__label";

    const tag = document.createElement("span");
    tag.className = "timeline-item__tag";

    const time = document.createElement("span");
    time.className = "timeline-item__time";

    head.append(label, tag, time);

    const countdown = document.createElement("span");
    countdown.className = "timeline-item__countdown";

    const next = document.createElement("span");
    next.className = "timeline-item__next";

    const notes = document.createElement("p");
    notes.className = "timeline-item__notes";

    const actions = document.createElement("div");
    actions.className = "timeline-item__actions";

    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "btn btn--chip";
    edit.dataset.edit = event.id;
    edit.textContent = "Bewerk";

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "btn btn--chip btn--danger";
    remove.dataset.remove = event.id;
    remove.textContent = "Verwijder";

    actions.append(edit, remove);
    li.append(bar, head, countdown, next, notes, actions);

    const node = { li, bar, label, tag, time, countdown, next, notes, stamp: null };
    timelineNodes.set(event.id, node);
    return node;
  }

  function fillTimelineNode(node, event) {
    node.bar.style.background = event.color;
    node.li.style.setProperty("--cue-color", event.color);
    // Altijd textContent voor gebruikerstekst — nooit innerHTML (XSS bij import).
    node.label.textContent = event.label;
    node.tag.textContent = recurrenceTag(event);
    node.time.textContent = event.time;
    node.notes.textContent = event.notes;
    node.notes.hidden = !event.notes;
    node.stamp = event.updatedAt;
  }

  function syncTimeline(now) {
    const items = events
      .map((event) => ({ event, next: nextOccurrenceFor(event, now) }))
      .sort((a, b) => {
        const ta = a.next ? a.next.getTime() : Infinity;
        const tb = b.next ? b.next.getTime() : Infinity;
        return ta - tb;
      });

    // Weggegooide cues opruimen.
    const liveIds = new Set(items.map((item) => item.event.id));
    for (const [id, node] of timelineNodes) {
      if (!liveIds.has(id)) {
        node.li.remove();
        timelineNodes.delete(id);
      }
    }

    // Reconciliatie op id: bestaande nodes bijwerken, nieuwe aanmaken.
    items.forEach((item, index) => {
      let node = timelineNodes.get(item.event.id);
      if (!node) {
        node = buildTimelineNode(item.event);
        listEl.appendChild(node.li);
        lastOrderSignature = ""; // nieuwe node: volgorde sowieso herzien
      }
      if (node.stamp !== item.event.updatedAt) fillTimelineNode(node, item.event);

      node.countdown.textContent = item.next ? formatCountdown(item.next - now) : "—";
      node.next.textContent = item.next
        ? `gaat af om ${formatClock(item.next)}${item.next.getDate() !== now.getDate() ? ` (${DAY_SHORT[item.next.getDay()]})` : ""}`
        : "geen volgende keer gepland";
      node.li.classList.toggle("is-next", index === 0 && Boolean(item.next));
      node.li.classList.toggle("is-imminent", Boolean(item.next) && item.next - now < 60000);
    });

    // Alleen her-ordenen als de volgorde echt is veranderd.
    const signature = items.map((item) => item.event.id).join("|");
    if (signature !== lastOrderSignature) {
      items.forEach((item) => listEl.appendChild(timelineNodes.get(item.event.id).li));
      lastOrderSignature = signature;
    }

    emptyEl.hidden = events.length > 0;
    listEl.hidden = events.length === 0;

    return items;
  }

  listEl.addEventListener("click", (clickEvent) => {
    const editId = clickEvent.target.closest("[data-edit]")?.dataset.edit;
    if (editId) {
      const event = events.find((entry) => entry.id === editId);
      if (event) startEditing(event);
      return;
    }
    const removeId = clickEvent.target.closest("[data-remove]")?.dataset.remove;
    if (removeId) {
      events = events.filter((entry) => entry.id !== removeId);
      if (editingId === removeId) resetForm();
      persist();
      showToast("Cue verwijderd", "info");
      tick();
    }
  });

  /* -------------------------- Samenvattingen & badge ---------------------- */

  function updateSummary(items, now) {
    const soonest = items.find((item) => item.next);

    if (heroNext && heroEmpty) {
      if (soonest) {
        heroNext.hidden = false;
        heroEmpty.hidden = true;
        heroLabel.textContent = soonest.event.label;
        heroCountdown.textContent = formatCountdown(soonest.next - now);
        heroTime.textContent = `om ${formatClock(soonest.next)} · ${recurrenceTag(soonest.event)}`;
      } else {
        heroNext.hidden = true;
        heroEmpty.hidden = false;
      }
    }

    if (statCues) statCues.textContent = String(events.length);
    if (statMg) {
      // Elke sigaret 0,7 mg en we roken er lekker twee per cue.
      const mg = (events.length * 2 * 0.7).toFixed(1).replace(".", ",");
      statMg.textContent = `${mg} mg`;
    }

    return soonest;
  }

  function announce(soonest, now) {
    if (!announcer) return;
    const minute = now.getMinutes();
    if (minute === lastAnnouncedMinute) return;
    lastAnnouncedMinute = minute;
    announcer.textContent = soonest
      ? `Volgende shagpauze: ${soonest.event.label} over ${humanizeCountdown(soonest.next - now)}.`
      : "Geen shagpauzes gepland.";
  }

  /* --------------------------------- Alarm -------------------------------- */

  function checkAlarms(items, now) {
    const nowMs = now.getTime();
    const liveIds = new Set(items.map((item) => item.event.id));
    for (const id of alarmSchedule.keys()) {
      if (!liveIds.has(id)) alarmSchedule.delete(id);
    }

    for (const item of items) {
      const nextMs = item.next ? item.next.getTime() : null;
      const scheduled = alarmSchedule.get(item.event.id);

      // De eerder ingeplande keer is verstreken (de "volgende" is doorgerold):
      // binnen het rollover-venster alsnog laten afgaan.
      if (
        scheduled !== undefined
        && scheduled <= nowMs
        && nowMs - scheduled < ALARM_ROLLOVER_MS
        && scheduled !== nextMs
      ) {
        alarmCenter.fire(item.event);
      }

      if (nextMs !== null) alarmSchedule.set(item.event.id, nextMs);
      else alarmSchedule.delete(item.event.id);
    }
  }

  /* ------------------------------ Import/export --------------------------- */

  const exportButton = root.querySelector("[data-export-button]");
  const importButton = root.querySelector("[data-import-button]");
  const importInput = root.querySelector("[data-import-input]");
  const clearButton = root.querySelector("[data-clear-button]");

  if (exportButton) {
    exportButton.addEventListener("click", () => {
      const payload = {
        schema: EXPORT_SCHEMA,
        exportedAt: new Date().toISOString(),
        cues: events,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `shagwekker-cues-${localDateStamp()}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showToast("Cues geëxporteerd", "success");
    });
  }

  if (importButton && importInput) {
    importButton.addEventListener("click", () => importInput.click());
    importInput.addEventListener("change", async () => {
      const file = importInput.files && importInput.files[0];
      importInput.value = "";
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        let cues = null;
        if (Array.isArray(data)) {
          cues = data;
        } else if (data && Array.isArray(data.cues)) {
          if (data.schema && data.schema !== EXPORT_SCHEMA && data.schema !== EXPORT_SCHEMA_V1) {
            throw new Error("onbekend schema");
          }
          cues = data.cues;
        }
        const imported = normalizeEvents(cues);
        if (!imported.length) throw new Error("geen cues");

        // Mergen op id; nieuwste updatedAt wint.
        const byId = new Map(events.map((event) => [event.id, event]));
        let touched = 0;
        for (const cue of imported) {
          const existing = byId.get(cue.id);
          if (!existing || Date.parse(cue.updatedAt) >= Date.parse(existing.updatedAt)) {
            byId.set(cue.id, cue);
            touched += 1;
          }
        }
        events = [...byId.values()];
        persist();
        tick();
        showToast(`${touched} cue${touched === 1 ? "" : "s"} geïmporteerd`, "success");
      } catch {
        showToast("Dat bestand is geen geldige cue-export.", "warning");
      }
    });
  }

  if (clearButton) {
    clearButton.addEventListener("click", () => {
      if (!events.length) {
        showToast("Er valt niks weg te gooien.", "info");
        return;
      }
      if (!window.confirm("Alle ShagPauzes de prullenbak in. Zeker weten?")) return;
      events = [];
      resetForm();
      persist();
      tick();
      showToast("Alle cues verwijderd", "info");
    });
  }

  /* --------------------------------- Demo --------------------------------- */

  const demoButton = document.querySelector("[data-demo-button]");
  if (demoButton) {
    demoButton.addEventListener("click", () => {
      // Bewust achter een confirm: de demo mag nooit stilletjes je eigen
      // cues overschrijven.
      const ok = window.confirm(
        "De NPC Timer Demo vervangt je huidige cues door een setje demo-cues. Doorgaan?",
      );
      if (!ok) {
        showToast("Demo afgeblazen — je eigen cues blijven staan.", "info");
        return;
      }
      events = demoEvents();
      resetForm();
      persist();
      tick();
      showToast("Demo-cues geladen", "success");
    });
  }

  /* ------------------------------ De seconde-tik --------------------------- */

  function tick() {
    const now = new Date();
    const items = syncTimeline(now);
    const soonest = updateSummary(items, now);
    checkAlarms(items, now);
    announce(soonest, now);
    tabBadge.setImminent(Boolean(soonest) && soonest.next - now < 60000);
  }

  window.addEventListener("storage", (storageEvent) => {
    if (storageEvent.key !== EVENTS_STORAGE_KEY) return;
    events = eventStore.load();
    if (editingId && !events.some((event) => event.id === editingId)) resetForm();
    tick();
  });

  syncWeekdayPicker();
  tick();
  window.setInterval(tick, 1000);
}

/* --------------------------------- ShagMeter ------------------------------ */

function initShagMeter() {
  const root = document.querySelector("[data-shagmeter]");
  if (!root) return;

  const goal = Number(root.dataset.shagmeterGoal) || 8;
  const ring = root.querySelector("[data-shagmeter-ring]");
  const countEl = root.querySelector("[data-shagmeter-count]");
  const statusEl = root.querySelector("[data-shagmeter-status]");
  const addButton = root.querySelector("[data-shagmeter-add]");
  const resetButton = root.querySelector("[data-shagmeter-reset]");

  function freshState() {
    return { count: 0, date: localDateStamp() };
  }

  function loadState() {
    const stored = readJson(SHAGMETER_KEY);
    if (
      stored
      && typeof stored === "object"
      && Number.isInteger(stored.count)
      && stored.count >= 0
      && stored.date === localDateStamp()
    ) {
      return { count: stored.count, date: stored.date };
    }
    return freshState();
  }

  let state = loadState();

  function persist() {
    writeJson(SHAGMETER_KEY, state);
  }

  function statusText() {
    return `${state.count} van ${goal} Shaggies genoteerd.`;
  }

  function render() {
    const progress = Math.min(state.count / goal, 1) * 100;
    ring.style.setProperty("--progress", String(progress));
    ring.setAttribute("aria-valuenow", String(Math.min(state.count, goal)));
    ring.setAttribute("aria-valuetext", statusText());
    countEl.textContent = String(state.count);
    statusEl.textContent = state.count >= goal ? "Doel bereikt!" : statusText();
    root.classList.toggle("is-complete", state.count >= goal);
  }

  function erupt() {
    if (reducedMotionQuery.matches) return;
    root.classList.remove("is-erupting");
    // reflow zodat de animatie opnieuw kan starten
    void root.offsetWidth;
    root.classList.add("is-erupting");
    window.setTimeout(() => root.classList.remove("is-erupting"), 1400);
  }

  function rolloverIfNewDay() {
    if (state.date !== localDateStamp()) {
      state = freshState();
      persist();
      render();
    }
  }

  addButton.addEventListener("click", () => {
    rolloverIfNewDay();
    state.count = Math.min(state.count + 1, 99);
    persist();
    render();
    if (state.count === goal) {
      erupt();
      showToast("Doel bereikt!", "success");
    }
  });

  resetButton.addEventListener("click", () => {
    state = freshState();
    persist();
    render();
    showToast("ShagMeter gereset.", "info");
  });

  window.addEventListener("storage", (storageEvent) => {
    if (storageEvent.key !== SHAGMETER_KEY) return;
    state = loadState();
    render();
  });

  // Middernacht-rollover ook zonder klik oppikken.
  window.setInterval(rolloverIfNewDay, 60 * 1000);

  render();
}

/* -------------------- Volgende-cue-kaart (shagmeter.html) ------------------ */

function initNextCueCard() {
  const card = document.querySelector("[data-next-cue]");
  if (!card) return;

  const emptyEl = document.querySelector("[data-next-cue-empty]");
  const labelEl = card.querySelector("[data-next-cue-label]");
  const countdownEl = card.querySelector("[data-next-cue-countdown]");
  const timeEl = card.querySelector("[data-next-cue-time]");

  let events = eventStore.load();

  function tick() {
    const now = new Date();
    let soonest = null;
    for (const event of events) {
      const next = nextOccurrenceFor(event, now);
      if (next && (!soonest || next < soonest.next)) soonest = { event, next };
    }
    if (soonest) {
      card.hidden = false;
      if (emptyEl) emptyEl.hidden = true;
      labelEl.textContent = soonest.event.label;
      countdownEl.textContent = formatCountdown(soonest.next - now);
      timeEl.textContent = `om ${formatClock(soonest.next)} · ${recurrenceTag(soonest.event)}`;
    } else {
      card.hidden = true;
      if (emptyEl) emptyEl.hidden = false;
    }
  }

  window.addEventListener("storage", (storageEvent) => {
    if (storageEvent.key !== EVENTS_STORAGE_KEY) return;
    events = eventStore.load();
    tick();
  });

  tick();
  window.setInterval(tick, 1000);
}

/* ------------------------------- Onboarding -------------------------------- */

function initOnboarding() {
  const planner = document.querySelector("[data-planner]");
  if (!planner) return;
  if (localStorage.getItem(ONBOARDED_KEY)) return;

  const steps = [
    {
      target: "[data-cue-form]",
      title: "Las je eerste shaggie in",
      text: "Naam, tijdstip, herhaling, kleurtje — klaar. Meer heeft een goeie ShagPauze niet nodig.",
    },
    {
      target: "[data-timeline-list]",
      title: "De glimmende timeline",
      text: "Hier tellen al je cues realtime af. Bewerken of weggooien kan per kaartje.",
    },
    {
      target: "[data-shagmeter]",
      title: "ShagMeter",
      text: "Turf elke gerookte shaggie en jaag op je dagdoel. Bij acht barst het feest los.",
    },
  ];

  let index = 0;
  let highlighted = null;
  const previouslyFocused = document.activeElement;

  const overlay = document.createElement("div");
  overlay.className = "coachmark-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "coachmarkTitle");

  const card = document.createElement("div");
  card.className = "coachmark glass";
  card.tabIndex = -1;

  const title = document.createElement("h2");
  title.id = "coachmarkTitle";
  title.className = "coachmark__title";

  const text = document.createElement("p");
  text.className = "coachmark__text";

  const dots = document.createElement("p");
  dots.className = "coachmark__dots";

  const actions = document.createElement("div");
  actions.className = "coachmark__actions";

  const skipButton = document.createElement("button");
  skipButton.type = "button";
  skipButton.className = "btn btn--ghost";
  skipButton.textContent = "Sla over";

  const nextButton = document.createElement("button");
  nextButton.type = "button";
  nextButton.className = "btn btn--primary";

  actions.append(skipButton, nextButton);
  card.append(title, text, dots, actions);
  overlay.appendChild(card);

  function clearHighlight() {
    if (highlighted) {
      highlighted.classList.remove("coach-target");
      highlighted = null;
    }
  }

  function showStep() {
    const step = steps[index];
    title.textContent = step.title;
    text.textContent = step.text;
    dots.textContent = `Stap ${index + 1} van ${steps.length}`;
    nextButton.textContent = index === steps.length - 1 ? "Klaar" : "Volgende";

    clearHighlight();
    const target = document.querySelector(step.target);
    if (target) {
      highlighted = target;
      target.classList.add("coach-target");
      target.scrollIntoView({
        block: "center",
        behavior: reducedMotionQuery.matches ? "auto" : "smooth",
      });
    }
    card.focus();
  }

  function finish() {
    try {
      localStorage.setItem(ONBOARDED_KEY, "1");
    } catch { /* jammer dan */ }
    clearHighlight();
    overlay.remove();
    document.removeEventListener("keydown", onKeydown);
    if (previouslyFocused && typeof previouslyFocused.focus === "function") {
      previouslyFocused.focus();
    }
  }

  function onKeydown(keyEvent) {
    if (keyEvent.key === "Escape") finish();
  }

  skipButton.addEventListener("click", finish);
  nextButton.addEventListener("click", () => {
    if (index === steps.length - 1) {
      finish();
      showToast("Rondleiding klaar — veel shagplezier!", "success");
      return;
    }
    index += 1;
    showStep();
  });
  document.addEventListener("keydown", onKeydown);

  document.body.appendChild(overlay);
  showStep();
}

/* ------------------------------ Service worker ----------------------------- */

function initServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* offline blijft dan gewoon uit — geen drama */
    });
  });
}

/* ----------------------------------- Init ---------------------------------- */

(function init() {
  initPreferences();
  initThemeSwitcher();
  initAccentPicker();
  initHighContrast();
  initMobileNav();
  initAlarm();
  initTabBadge();
  initPlanner();
  initShagMeter();
  initNextCueCard();
  initOnboarding();
  initServiceWorker();
})();
