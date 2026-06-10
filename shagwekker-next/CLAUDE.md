# CLAUDE.md — shagwekker-next

This file provides guidance to Claude Code (claude.ai/code) when working with code in this folder.

## What this is

A ground-up rebuild of **ShagWekker**: a dependency-free, static PWA that counts down to recurring "shag" (rolling-tobacco) breaks. There is **no build step, no package manager, no test framework, and no transpilation** — the deployed files are the source files. UI copy is Dutch (deliberately slangy/"Bargoens"); keep new user-facing strings in the same register.

**The audio player is deliberately absent from this build.** It will return later as a separate standalone module — do not weave it back into `index.html` or `script.js`. The small alarm chime (a synthesized-WAV `<audio data-alarm-chime>` element in `initAlarm()`) is *not* the player and stays.

## Running locally

The app uses absolute paths (`/index.html`, `/style.css`) and registers a service worker, so it **must be served over HTTP with this folder as the web root** — `file://` breaks navigation and the SW:

```bash
cd shagwekker-next
python3 -m http.server 8000   # then open http://localhost:8000
```

There are no lint/test/build commands. "Testing" is manual: load the page, hard-reload to bypass the service-worker cache, verify behaviour. (The `Gallery` / `ShagFiles` nav links point at `/gallery.html` and `/files/`, which live in the wider site, not in this folder.)

## Architecture

### One shared script, page-guarded modules

Every HTML page loads the **same** `script.js`. There is no router. The file defines many `initX()` functions; each looks up its anchor element (e.g. `document.querySelector("[data-planner]")`, `[data-shagmeter]`) and **returns early if that element is absent**. The `(function init(){…})()` IIFE at the bottom calls every `initX()` unconditionally — page differentiation happens entirely through which elements exist in each page's markup. When adding a feature: write an `initFeature()` that bails when its root element is missing, then add one call inside the bottom `init()`.

Two cross-module seams exist for modules that may or may not be initialized on a given page: `alarmCenter` and `tabBadge` are module-level objects with no-op methods that `initAlarm()` / `initTabBadge()` overwrite when their anchors exist. The planner calls them blindly.

### Pages

- `index.html` — the full wekker: hero, status grid, planner (countdown timeline + cue CRUD + import/export), ShagMeter, insights, theming panel, onboarding.
- `shagmeter.html` — standalone ShagMeter plus a read-only "next cue" card.

### Event / countdown data model

Every event is a single, uniform, fully-editable entity — no hardcoded "core" cards. Shape:

```js
{ id, time, label, recurrence, color, notes, updatedAt, weekdays? }
```

`notes` replaced the old core-only `description` field (`normalizeEvents()` falls back to `description` on read). `updatedAt` is a per-event ISO timestamp written on every create/update; it is the merge key for JSON import today and the intended sync key for a future API backend.

Recurrence is handled by `nextOccurrenceFor(event, now)` switching on `event.recurrence`. Supported values: `Daily`, `Weekdays`, `Weekends`, `SpecificWeekdays` (reads `event.weekdays`, an array of JS day numbers 0–6). The legacy named combo `MonWedThu` (= days `[1,3,4]`) is no longer a runtime value — `normalizeEvents()` folds it into `SpecificWeekdays` on load. Adding a new recurrence type means a `case` in `recurrenceMatchesDay()` **and** a branch in `recurrenceTag()` for the display label.

The planner's `tick()` runs on a 1-second `setInterval`, recomputing the soonest event and refreshing the timeline, hero summary, stats, tab badge, live-region announcement, and alarm checks. The timeline **reconciles DOM nodes by event id** (`timelineNodes` map): nodes are created/removed/refilled only when an event appears, disappears, or its `updatedAt` changes; per-tick work is limited to countdown text and an order check. User text is always rendered with `textContent` — never `innerHTML` — so imported cues can't inject markup.

### Persistence conventions

All `localStorage` keys are namespaced `shagwekker.*` and **version-suffixed** (`.vN`):

- `shagwekker.events.v2` (`EVENTS_STORAGE_KEY`) — the unified event list, read/written **only** through the `eventStore` adapter. On first load it migrates from `shagwekker.customEvents.v1` (`STORAGE_KEY`) and the oldest `multiCountdown.times` (`LEGACY_KEY`), then removes those keys; if there is nothing to migrate it seeds exactly one editable example card (`makeExampleEvent()`). **The presence of the v2 key is the "already initialized" flag** — clearing all cues leaves an empty store and is never re-seeded.
- `shagwekker.shagmeter.state.v1` — ShagMeter state (`{ count, date }`, resets on day rollover).
- `shagwekker.preferences.theme.v1` / `shagwekker.preferences.accent.v1` / `shagwekker.preferences.contrast.v1` — theming prefs.
- `shagwekker.alarm.prefs.v1` — chime + notification toggles.
- `shagwekker.onboarded.v1` — coachmark tour completed.

A `storage` event listener (keyed on `EVENTS_STORAGE_KEY`) keeps multiple open tabs in sync. When changing a persisted shape, bump the version suffix and migrate from the old key rather than mutating in place.

Import/export uses schema id `shagwekker.cues.v2` (`shagwekker.cues.v1` and bare arrays are accepted on import); merging is by `id` with newest `updatedAt` winning.

#### Swapping localStorage for an API (accounts / cloud sync)

All event persistence is funnelled through the single `eventStore` adapter (`load()` / `save(events)`); no call site touches `localStorage` for events directly. To back events with a user account: make `load()`/`save()` async (keeping localStorage as offline cache and seed fallback), `await` the call sites in `initPlanner()` and `initNextCueCard()`, and reconcile with `updatedAt` as the conflict key. Keep the seam narrow: nothing outside `eventStore` should know what the backend is.

### Service worker (`sw.js`)

App-shell caching with a versioned `CACHE_NAME` (`shagwekker-vNNN`, zero-padded three digits). The `SHELL` array is precached **per file via `Promise.allSettled`** so one missing icon can't fail the whole install. Everything under `/gallery/` and `/files/` is **network-only and must never be cached** (large media). Navigations use stale-while-revalidate with an `/index.html` fallback; other shell assets are cache-first.

**Whenever you change a shell asset (`index.html`, `shagmeter.html`, `style.css`, `script.js`, manifest, shell icons), bump `CACHE_NAME`** — otherwise returning users keep the stale cached copy. Add genuinely new shell files to the `SHELL` array.

### Theming

Accent is the single `--accent` CSS custom property, driven by `setAccentColor()` / `resetAccentColor()` (default `#ff0000`), persisted per the preference keys above. It flows into buttons, the timeline, the ShagMeter ring, focus rings and the favicon badge via `color-mix()`. `initThemeSwitcher()` resolves light / dark / sepia / auto (`prefers-color-scheme`). **All text colors route through theme variables (`--ink`, `--muted`)** — never hardcode `rgba(255,255,255,…)` text, or the light/sepia themes break. Don't reference CSS variables that aren't defined in `:root` or a theme block.

### Alarm

`initAlarm()` owns a minimal chime (`<audio>` fed a WAV synthesized in `buildChimeWav()` — zero extra files) and the Notifications API; both toggles are persisted. The planner detects an elapsed occurrence within a 90-second rollover window (`ALARM_ROLLOVER_MS`) and calls `alarmCenter.fire(event)`. **Alarms only fire while a tab is open and foregrounded** (browsers throttle background timers) — the UI says so next to the chime toggle; keep that caveat visible unless service-worker-based triggers are added.

## Conventions

- **Vanilla everything** — no frameworks, no npm. Don't introduce a build toolchain unless explicitly asked.
- New shared behaviour goes in `script.js` as a page-guarded `initX()` wired into the bottom `init()` IIFE.
- Match the existing Dutch, playful tone for UI strings and commit messages.
- Toasts (`showToast`) are the standard user-feedback mechanism; tones are `info` / `success` / `warning`.
- The `NPC Timer Demo` must never silently overwrite saved cues — it is gated behind a `confirm()`. Keep it that way.
