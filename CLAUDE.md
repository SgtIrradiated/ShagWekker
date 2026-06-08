# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ShagWekker is a **dependency-free, single-page-per-feature static PWA** that counts down to recurring "shag" (rolling-tobacco) breaks. There is **no build step, no package manager, no test framework, and no transpilation** — the deployed files are the source files. The UI copy is in Dutch (deliberately slangy/"Bargoens"); keep new user-facing strings in the same register.

## Running locally

The app uses absolute paths (`/index.html`, `/style.css`) and registers a service worker, so it **must be served over HTTP** — opening files via `file://` breaks navigation and the SW. Serve the repo root:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

There are no lint/test/build commands. "Testing" is manual: load the relevant page in a browser, hard-reload to bypass the service-worker cache, and verify behaviour.

## Architecture

### One shared script, page-guarded modules

Every HTML page loads the **same** `script.js`. There is no router and no per-page bundle. Instead, the file defines many `initX()` functions; each one looks up its anchor element (e.g. `document.querySelector("[data-audio-player]")`, `document.getElementById("timelineList")`) and **returns early if that element is absent**. A single IIFE `init()` at the bottom of `script.js` calls every `initX()` unconditionally — page differentiation happens entirely through which elements exist in each page's markup. When adding a feature, follow this pattern: write an `initFeature()` that bails when its root element is missing, then add one call inside the bottom `init()`.

`gallery.html` has a small **inline** IIFE (`initGallery`) instead of living in `script.js`, because its content is page-local.

### Pages

- `index.html` — the main wekker: countdown timeline, custom-cue CRUD form, audio player, ShagMeter, theming, onboarding.
- `shagmeter.html` — standalone ShagMeter tracker view.
- `library.html` — resource/download library.
- `gallery.html` — image gallery (inline script).

### Event / countdown data model

The countdown engine is the core. Every event is a **single, uniform, fully-editable** entity — there are no hardcoded "core" cards anymore. The whole list lives in `localStorage` behind the `eventStore` adapter (see persistence conventions) and is loaded with `eventStore.load()`. On a verse install the store is seeded with exactly one editable example card (`makeExampleEvent()`); the user can edit or delete it like any other cue. Clearing all cues leaves an empty store (the presence of the v2 key is the "already initialized" flag, so it is **not** re-seeded).

An event has the shape `{ id, time, label, recurrence, color, notes, updatedAt, weekdays? }`. `notes` replaced the old core-only `description` field (migration falls back to `description`). `updatedAt` is a per-event ISO timestamp written on every create/update — it carries no behaviour today but is the intended sync key for a future API backend.

Recurrence is handled by `nextOccurrenceFor(event, now)` switching on `event.recurrence`. Supported values: `Daily`, `Weekdays`, `Weekends`, `SpecificWeekdays` (reads `event.weekdays`, an array of JS day numbers 0–6). The legacy named combo `MonWedThu` (= days `[1,3,4]`) is no longer a runtime value — `normalizeEvents()` folds it into `SpecificWeekdays` on load. Adding a new recurrence type means adding a `case` here **and** a branch in `recurrenceTag()` for the display label.

`updateCountdowns()` runs on a 1-second `setInterval`, recomputing the soonest event and refreshing the timeline, summaries, tab badge, and alarm checks.

### Persistence conventions

All `localStorage` keys are namespaced `shagwekker.*` and **version-suffixed** (`.vN`) so the schema can evolve without colliding:
- `shagwekker.events.v2` (`EVENTS_STORAGE_KEY`) — the unified, editable event list, read/written **only** through the `eventStore` adapter. On first load it migrates from `shagwekker.customEvents.v1` (`STORAGE_KEY`) and the oldest `multiCountdown.times` (`LEGACY_KEY`), then removes those keys; if there is nothing to migrate it seeds the example card.
- `shagwekker.shagmeter.state.v1` — ShagMeter state.
- `shagwekker.audio.state.v1` (`AUDIO_STATE_KEY`) — audio player session (track index, position, volume, mute, shuffle, repeat); migrates the legacy `shagwekker.audio.shuffle.v1` key.
- `shagwekker.preferences.*` — high-contrast and accent-color prefs.

A `storage` event listener (keyed on `EVENTS_STORAGE_KEY`) keeps multiple open tabs in sync. When changing a persisted shape, bump the version suffix and handle migration from the old key rather than mutating in place.

#### Swapping localStorage for an API (accounts / cloud sync)

All event persistence is funnelled through the single `eventStore` adapter (`load()` / `save(events)`) and an in-memory `events` array drives rendering — no call site touches `localStorage` for events directly. To back events with a user account:

1. Make `eventStore.load()` / `eventStore.save()` `async` (fetch/PUT the signed-in user's events), keeping the localStorage copy as an offline cache and seed fallback.
2. `await` the two `eventStore.load()` call sites — `renderAll()` in the planner IIFE and `renderTimelineCard()` in `initShagMeter()` — and `await` the `eventStore.save()` calls in the planner handlers.
3. Use the per-event `updatedAt` timestamp as the conflict/merge key when reconciling local and remote copies.

Keep the seam narrow: nothing outside `eventStore` should know whether the backend is localStorage or an API.

### Service worker (`sw.js`)

App-shell caching with a versioned `CACHE_NAME` (`shagwekker-vNNN`, zero-padded three digits). The `SHELL` array is precached; everything under `/audio/`, `/gallery/`, `/files/` is **network-only and must never be cached** (large media). HTML/navigations use stale-while-revalidate with an `/index.html` fallback; other shell assets are cache-first.

**Whenever you change a shell asset (`index.html`, `style.css`, `script.js`, manifest, shell icons), bump `CACHE_NAME`** — otherwise returning users keep the stale cached copy. Add genuinely new shell files to the `SHELL` array.

### Theming

Accent color is a single CSS custom property driven by `setAccentColor()` / `resetAccentColor()` (default `#ff0000`), persisted per the preference keys above. The accent flows into the audio player, timeline, and other accent-tinted surfaces. `initThemeSwitcher()` resolves light/dark/system.

### Audio player (`initAudioPlayer`)

`STATIC_AUDIO_REFERENCES` near the top of `script.js` is the curated playlist (the player does not scan the directory); allowed extensions are gated by `AUDIO_EXTENSIONS` / `isAllowedAudioFile()`. To add a track, drop the file in `audio/` and add an entry. The player is a self-contained module driven by a single `state` object and pure `renderX()` helpers, with: a `<select>` track picker, transport (play/pause/stop/prev/next), **shuffle + repeat** (off/all/one), seek, volume + **mute**, and download. Three integrations worth knowing:
- **Live visualizer** — lazily builds a Web Audio `AnalyserNode` on first play (autoplay-policy safe) that drives the 24 `.audio-player__waveform span` bars; falls back to the CSS animation when `prefers-reduced-motion` or Web Audio is unavailable. Note `createMediaElementSource(audio)` reroutes element output through the graph, so the `AudioContext` must be `resume()`d on the play gesture.
- **Session resume** — `shagwekker.audio.state.v1` (see persistence conventions); restores track/position/volume/modes on load but never auto-plays.
- **Media Session API** — lock-screen / OS media-key metadata and handlers, guarded for unsupported browsers.

## Conventions

- **Vanilla everything** — no frameworks, no npm dependencies. Don't introduce a build toolchain unless explicitly asked.
- New shared behaviour goes in `script.js` as a page-guarded `initX()` wired into the bottom `init()` IIFE; page-local behaviour can stay inline.
- Match the existing Dutch, playful tone for UI strings and commit messages.
- Toasts (`showToast`) are the standard user-feedback mechanism; tones are `info` / `success` / `warning`.
