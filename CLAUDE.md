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

Two pages (`gallery.html`, `het-archief.html`) have small **inline** IIFEs (`initGallery`, `initArchive`) instead of living in `script.js`, because their content is page-local.

### Pages

- `index.html` — the main wekker: countdown timeline, custom-cue CRUD form, audio player, ShagMeter, theming, onboarding.
- `shagmeter.html` — standalone ShagMeter tracker view.
- `library.html` — resource/download library.
- `gallery.html` — image gallery (inline script).
- `het-archief.html` — video archive (inline script).

### Event / countdown data model

The countdown engine is the core. Events come from two sources, merged by `getAllEvents()`:
- `DEFAULT_EVENTS` — hardcoded core breaks at the top of `script.js` (ids prefixed `core-`, tracked in `DEFAULT_EVENT_IDS`).
- **Custom events** — user-created, persisted in `localStorage`.

Recurrence is handled by `nextOccurrenceFor(event, now)` switching on `event.recurrence`. Supported values: `Daily`, `Weekdays`, `Weekends`, `SpecificWeekdays` (reads `event.weekdays`, an array of JS day numbers 0–6), and the legacy named combo `MonWedThu` (= days `[1,3,4]`). Adding a new recurrence type means adding a `case` here **and** a branch in `recurrenceTag()` for the display label.

`updateCountdowns()` runs on a 1-second `setInterval`, recomputing the soonest event and refreshing the timeline, summaries, tab badge, and alarm checks.

### Persistence conventions

All `localStorage` keys are namespaced `shagwekker.*` and **version-suffixed** (`.vN`) so the schema can evolve without colliding:
- `shagwekker.customEvents.v1` (`STORAGE_KEY`) — custom events; `multiCountdown.times` (`LEGACY_KEY`) is migrated in.
- `shagwekker.shagmeter.state.v1` — ShagMeter state.
- `shagwekker.audio.state.v1` (`AUDIO_STATE_KEY`) — audio player session (track index, position, volume, mute, shuffle, repeat); migrates the legacy `shagwekker.audio.shuffle.v1` key.
- `shagwekker.preferences.*` — high-contrast and accent-color prefs.

A `storage` event listener keeps multiple open tabs in sync. When changing a persisted shape, bump the version suffix and handle migration from the old key rather than mutating in place.

### Service worker (`sw.js`)

App-shell caching with a versioned `CACHE_NAME` (`shagwekker-vN`). The `SHELL` array is precached; everything under `/audio/`, `/gallery/`, `/files/`, `/HetArchief/` is **network-only and must never be cached** (large media). HTML/navigations use stale-while-revalidate with an `/index.html` fallback; other shell assets are cache-first.

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
