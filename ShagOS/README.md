# ShagOS v1.0

ShagOS is a client-side, glassmorphic desktop environment that runs entirely inside the browser. It is designed to feel like a lightweight Windows 11-inspired workspace with translucent surfaces, soft shadows, and smooth GPU-accelerated transitions only.

## Architecture Overview

- **Entry point**: [`shagos.html`](./shagos.html) bootstraps the experience and loads the compiled CSS/JS along with audio and visual assets.
- **Styling**: [`css/shagos.css`](./css/shagos.css) defines the liquid-glass visuals, responsive layout, and accessibility affordances for windows, taskbar, launcher, and bundled apps.
- **Runtime**: [`js/shagos.js`](./js/shagos.js) instantiates the `window.ShagOS` namespace, manages settings persistence, window lifecycle, taskbar, keyboard shortcuts (Alt+Tab, Escape), wallpaper/theme management, and app registration.
- **Assets**: `assets/` hosts wallpapers (SVG), icons (SVG), and UI sounds (WAV). All assets are self-hosted for CSP compliance.
- **Persistence**: Settings and ShagPad documents are stored in `localStorage` under the `ShagOS:v1:` namespace. A guarded in-memory fallback keeps the UI responsive if storage is unavailable.

## Built-in Applications

- **Settings**: Configure wallpaper, theme (Glass, Light, Dark), UI sounds, and master volume. Settings persist between sessions when storage is available.
- **ShagPad**: A resizable notepad supporting multiple windows, new/load/save/export workflows, and shared document storage.

## Adding New Apps

1. Register a new app inside the `apps` map in [`js/shagos.js`](./js/shagos.js) with a unique `id`, metadata (`title`, `icon`), and a `mount` function that receives a DOM container and window instance metadata.
2. Use `window.ShagOS.openApp('yourAppId')` to launch from taskbar buttons, the launcher grid, or custom triggers.
3. Provide an SVG icon in `assets/icons/` and reference it via the `icon` property.
4. Keep interactions within the provided container to inherit window styling and persistence utilities.

## Known Limitations (v1)

- Window tiling, snapping previews, and keyboard resizing are not implemented.
- The launcher grid is static; installing or uninstalling apps requires code changes.
- Mobile layout is responsive but not optimized for handheld ergonomics.
- UI sounds are minimal sine-wave tones; richer sound design is slated for a future release.

Contributions should preserve the glassmorphism aesthetic, avoid blocking network calls during boot, and namespace additional storage keys with the existing `ShagOS:v1:` prefix.
