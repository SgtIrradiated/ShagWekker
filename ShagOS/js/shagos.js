const ShagOS = (() => {
  const STORAGE_PREFIX = 'ShagOS:v1:';
  const defaults = {
    theme: 'glass',
    wallpaper: 'aurora',
    volume: 0.6,
    soundsEnabled: true,
  };

  const storage = (() => {
    let isAvailable = false;
    try {
      const testKey = `${STORAGE_PREFIX}__test`;
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      isAvailable = true;
    } catch (error) {
      console.warn('[ShagOS] localStorage unavailable, falling back to memory store.', error);
    }

    const memoryStore = new Map();

    function get(key, fallback) {
      const namespaced = `${STORAGE_PREFIX}${key}`;
      try {
        if (isAvailable) {
          const raw = window.localStorage.getItem(namespaced);
          return raw ? JSON.parse(raw) : fallback;
        }
      } catch (error) {
        console.warn('[ShagOS] Failed to read storage key', key, error);
      }
      return memoryStore.has(namespaced) ? memoryStore.get(namespaced) : fallback;
    }

    function set(key, value) {
      const namespaced = `${STORAGE_PREFIX}${key}`;
      try {
        if (isAvailable) {
          window.localStorage.setItem(namespaced, JSON.stringify(value));
          return;
        }
      } catch (error) {
        console.warn('[ShagOS] Failed to write storage key', key, error);
      }
      memoryStore.set(namespaced, value);
    }

    return {
      get,
      set,
      isAvailable,
    };
  })();

  const state = {
    settings: storage.get('settings', defaults),
    windows: new Map(),
    zIndex: 1,
    activeWindowId: null,
    docs: storage.get('shagpadDocs', []),
  };

  const wallpaperLabels = {
    aurora: 'Aurora glass wallpaper',
    sunrise: 'Sunrise bloom wallpaper',
    noir: 'Noir luxe wallpaper',
  };

  state.settings = { ...defaults, ...state.settings };

  const root = document.getElementById('shagos-root');
  const wallpaperLayer = document.getElementById('wallpaperLayer');
  const splash = document.getElementById('shagosSplash');
  const desktop = document.getElementById('shagosDesktop');
  const windowLayer = document.getElementById('windowLayer');
  const taskbarCenter = document.getElementById('taskbarApps');
  const clockEl = document.getElementById('taskbarClock');
  const launcherButton = document.getElementById('launcherButton');
  const launcher = document.getElementById('launcher');
  const bootChime = document.getElementById('bootChime');
  const uiClick = document.getElementById('uiClick');
  const volumeTrayButton = document.getElementById('volumeTray');

  if (!root) {
    throw new Error('ShagOS root not found.');
  }

  const volumePopover = createVolumePopover();

  function persistSettings() {
    storage.set('settings', state.settings);
  }

  function persistDocs() {
    storage.set('shagpadDocs', state.docs);
    broadcastDocsChange();
  }

  const DOCS_EVENT = 'shagos:docs-changed';

  function broadcastDocsChange() {
    document.dispatchEvent(new CustomEvent(DOCS_EVENT));
  }

  function applyTheme(theme) {
    const body = document.body;
    body.classList.remove('theme-light', 'theme-dark', 'theme-glass');
    const themeClass = theme === 'light' ? 'theme-light' : theme === 'dark' ? 'theme-dark' : 'theme-glass';
    body.classList.add(themeClass);
  }

  function applyWallpaper(wallpaper) {
    wallpaperLayer.style.backgroundImage = `url("assets/wallpapers/${wallpaper}.svg")`;
    wallpaperLayer.setAttribute('aria-label', wallpaperLabels[wallpaper] || 'Desktop wallpaper');
  }

  function applyVolume(volume) {
    const clamped = Math.min(1, Math.max(0, volume));
    bootChime.volume = clamped;
    uiClick.volume = clamped;
    const volumeSlider = volumePopover.querySelector('input[type="range"]');
    if (volumeSlider && Number(volumeSlider.value) !== clamped) {
      volumeSlider.value = String(clamped);
    }
  }

  function playClick() {
    if (!state.settings.soundsEnabled) return;
    try {
      uiClick.currentTime = 0;
      uiClick.play().catch(() => {});
    } catch (error) {
      console.warn('[ShagOS] Unable to play UI sound', error);
    }
  }

  function showDesktop() {
    desktop.hidden = false;
    splash.setAttribute('hidden', '');
  }

  function clampToViewport(rect) {
    const { innerWidth, innerHeight } = window;
    const minX = 12;
    const minY = 12;
    const maxX = innerWidth - rect.width - 12;
    const maxY = innerHeight - rect.height - 12 - 90; // keep above taskbar
    return {
      x: Math.min(Math.max(rect.x, minX), Math.max(minX, maxX)),
      y: Math.min(Math.max(rect.y, minY), Math.max(minY, maxY)),
      width: rect.width,
      height: rect.height,
    };
  }

  const windowManager = (() => {
    function createWindow(app, payload = {}) {
      if (!app) return null;
      if (!app.allowMultiple) {
        const existing = [...state.windows.values()].find((w) => w.appId === app.id);
        if (existing) {
          focusWindow(existing.id);
          return existing;
        }
      }

      const id = `${app.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const windowEl = document.createElement('div');
      windowEl.className = 'shagos-window';
      windowEl.dataset.id = id;
      windowEl.setAttribute('role', 'dialog');
      windowEl.setAttribute('aria-label', app.title);

      const titlebar = document.createElement('header');
      titlebar.className = 'shagos-window__titlebar';

      const dragRegion = document.createElement('div');
      dragRegion.className = 'shagos-window__drag-region';
      dragRegion.tabIndex = 0;

      const title = document.createElement('span');
      title.className = 'shagos-window__title';
      title.textContent = app.title;
      dragRegion.appendChild(title);

      const controls = document.createElement('div');
      controls.className = 'shagos-window__controls';
      controls.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
      });

      const minimizeButton = document.createElement('button');
      minimizeButton.type = 'button';
      minimizeButton.className = 'shagos-window__button';
      minimizeButton.innerHTML = '—';
      minimizeButton.title = 'Minimize';

      const closeButton = document.createElement('button');
      closeButton.type = 'button';
      closeButton.className = 'shagos-window__button';
      closeButton.innerHTML = '✕';
      closeButton.title = 'Close';

      controls.append(minimizeButton, closeButton);

      const body = document.createElement('div');
      body.className = 'shagos-window__body';

      titlebar.append(dragRegion, controls);
      windowEl.append(titlebar, body);

      if (app.resizable) {
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'shagos-window__resize';
        windowEl.append(resizeHandle);
        setupResize(windowEl, resizeHandle);
      }

      const taskbarButton = createTaskbarButton(app, id);

      windowLayer.appendChild(windowEl);

      const instance = {
        id,
        appId: app.id,
        element: windowEl,
        title,
        taskbarButton,
        minimized: false,
        onClose: null,
      };

      state.windows.set(id, instance);
      app.mount({ container: body, windowId: id, payload, instance });
      positionWindow(windowEl);
      focusWindow(id);

      minimizeButton.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
      });
      minimizeButton.addEventListener('click', () => {
        playClick();
        minimizeWindow(id);
      });

      closeButton.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
      });
      closeButton.addEventListener('click', () => {
        playClick();
        closeWindow(id);
      });

      windowEl.addEventListener('pointerdown', () => {
        focusWindow(id);
      });

      setupDrag(windowEl, dragRegion);

      return instance;
    }

    function positionWindow(windowEl) {
      const bounds = windowLayer.getBoundingClientRect();
      const width = Math.min(windowEl.offsetWidth || 540, bounds.width - 40);
      const height = Math.min(windowEl.offsetHeight || 360, bounds.height - 120);
      const offset = (state.windows.size % 4) * 24;
      const x = bounds.left + bounds.width / 2 - width / 2 + offset;
      const y = bounds.top + 80 + offset;
      const clamped = clampToViewport({ x, y, width, height });
      windowEl.style.left = `${clamped.x}px`;
      windowEl.style.top = `${clamped.y}px`;
      windowEl.style.width = `${width}px`;
    }

    function setupDrag(windowEl, handle) {
      let dragging = false;
      let startX = 0;
      let startY = 0;
      let rect = { left: 0, top: 0 };

      const onPointerDown = (event) => {
        if (event.button !== 0) return;
        const interactiveTarget = event.target.closest(
          '.shagos-window__controls, button, a, input, select, textarea, [contenteditable="true"]'
        );
        if (interactiveTarget) {
          return;
        }
        dragging = true;
        startX = event.clientX;
        startY = event.clientY;
        const computed = windowEl.getBoundingClientRect();
        rect = { left: computed.left, top: computed.top, width: computed.width, height: computed.height };
        windowEl.setPointerCapture(event.pointerId);
        handle.style.cursor = 'grabbing';
        event.preventDefault();
      };

      const onPointerMove = (event) => {
        if (!dragging) return;
        const deltaX = event.clientX - startX;
        const deltaY = event.clientY - startY;
        const next = clampToViewport({
          x: rect.left + deltaX,
          y: rect.top + deltaY,
          width: rect.width,
          height: rect.height,
        });
        windowEl.style.left = `${next.x}px`;
        windowEl.style.top = `${next.y}px`;
      };

      const onPointerUp = (event) => {
        if (!dragging) return;
        dragging = false;
        windowEl.releasePointerCapture(event.pointerId);
        handle.style.cursor = 'grab';
      };

      handle.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    }

    function setupResize(windowEl, handle) {
      let resizing = false;
      let startX = 0;
      let startY = 0;
      let startWidth = 0;
      let startHeight = 0;

      handle.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        resizing = true;
        startX = event.clientX;
        startY = event.clientY;
        const rect = windowEl.getBoundingClientRect();
        startWidth = rect.width;
        startHeight = rect.height;
        windowEl.setPointerCapture(event.pointerId);
        event.preventDefault();
      });

      window.addEventListener('pointermove', (event) => {
        if (!resizing) return;
        const deltaX = event.clientX - startX;
        const deltaY = event.clientY - startY;
        const width = Math.max(320, startWidth + deltaX);
        const height = Math.max(240, startHeight + deltaY);
        const clamped = clampToViewport({
          x: windowEl.offsetLeft,
          y: windowEl.offsetTop,
          width,
          height,
        });
        windowEl.style.width = `${clamped.width}px`;
        windowEl.style.height = `${clamped.height}px`;
      });

      window.addEventListener('pointerup', (event) => {
        if (!resizing) return;
        resizing = false;
        windowEl.releasePointerCapture(event.pointerId);
      });
    }

    function focusWindow(id) {
      const instance = state.windows.get(id);
      if (!instance) return;
      state.zIndex += 1;
      instance.element.style.zIndex = state.zIndex;
      state.activeWindowId = id;
      instance.element.classList.remove('is-blurred');
      taskbarCenter.querySelectorAll('button').forEach((button) => {
        button.dataset.active = button.dataset.windowId === id ? 'true' : 'false';
      });
      state.windows.forEach((win) => {
        if (win.id !== id) {
          win.element.classList.add('is-blurred');
        }
      });

      taskbarCenter.querySelectorAll('button').forEach((button) => {
        button.setAttribute('aria-selected', button.dataset.windowId === id ? 'true' : 'false');
      });
    }

    function minimizeWindow(id) {
      const instance = state.windows.get(id);
      if (!instance) return;
      instance.minimized = true;
      instance.element.classList.add('is-minimized');
      instance.taskbarButton.dataset.badge = 'true';
      instance.taskbarButton.dataset.active = 'false';
      instance.taskbarButton.setAttribute('aria-selected', 'false');
      if (state.activeWindowId === id) {
        state.activeWindowId = null;
      }
    }

    function toggleMinimize(id) {
      const instance = state.windows.get(id);
      if (!instance) return;
      if (instance.minimized) {
        instance.minimized = false;
        instance.element.classList.remove('is-minimized');
        instance.taskbarButton.dataset.badge = 'false';
        instance.taskbarButton.setAttribute('aria-selected', 'true');
        focusWindow(id);
      } else {
        minimizeWindow(id);
      }
    }

    function closeWindow(id) {
      const instance = state.windows.get(id);
      if (!instance) return;
      if (typeof instance.onClose === 'function') {
        instance.onClose();
      }
      instance.element.remove();
      instance.taskbarButton.remove();
      state.windows.delete(id);
      if (state.activeWindowId === id) {
        state.activeWindowId = null;
      }
    }

    function focusNextWindow() {
      const visibleWindows = [...state.windows.values()].filter((w) => !w.minimized);
      if (!visibleWindows.length) return;
      const ordered = visibleWindows.sort((a, b) => Number(a.element.style.zIndex || 0) - Number(b.element.style.zIndex || 0));
      const currentIndex = ordered.findIndex((w) => w.id === state.activeWindowId);
      const next = ordered[(currentIndex + 1) % ordered.length];
      focusWindow(next.id);
    }

    return {
      createWindow,
      focusWindow,
      minimizeWindow,
      toggleMinimize,
      closeWindow,
      focusNextWindow,
    };
  })();

  function createTaskbarButton(app, windowId) {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('role', 'tab');
    button.dataset.windowId = windowId;
    button.dataset.active = 'false';
    button.dataset.badge = 'false';
    button.setAttribute('aria-selected', 'false');

    const icon = document.createElement('img');
    icon.src = app.icon;
    icon.alt = '';
    icon.width = 20;
    icon.height = 20;

    const label = document.createElement('span');
    label.textContent = app.shortTitle || app.title;

    button.append(icon, label);
    taskbarCenter.appendChild(button);

    button.addEventListener('click', () => {
      playClick();
      windowManager.toggleMinimize(windowId);
    });

    return button;
  }

  function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    clockEl.textContent = `${hours}:${minutes}`;
  }

  function createVolumePopover() {
    const popover = document.createElement('div');
    popover.className = 'shagos-volume-pop';
    popover.setAttribute('aria-hidden', 'true');

    const header = document.createElement('div');
    header.className = 'shagos-volume-pop__header';

    const label = document.createElement('label');
    label.setAttribute('for', 'volumeSlider');
    label.textContent = 'Master volume';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'shagos-volume-pop__close';
    closeBtn.setAttribute('aria-label', 'Close volume popover');
    closeBtn.innerHTML = '✕';
    closeBtn.addEventListener('click', () => {
      playClick();
      closeVolumePopover();
    });

    header.append(label, closeBtn);

    const slider = document.createElement('input');
    slider.id = 'volumeSlider';
    slider.type = 'range';
    slider.min = '0';
    slider.max = '1';
    slider.step = '0.05';
    slider.value = state.settings.volume;
    slider.className = 'shagos-slider';

    slider.addEventListener('input', () => {
      state.settings.volume = Number(slider.value);
      applyVolume(state.settings.volume);
      persistSettings();
    });

    slider.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeVolumePopover();
      }
    });

    popover.append(header, slider);
    document.body.appendChild(popover);
    return popover;
  }

  function openVolumePopover() {
    volumePopover.setAttribute('aria-hidden', 'false');
    volumeTrayButton.setAttribute('aria-expanded', 'true');
    const slider = volumePopover.querySelector('input[type="range"]');
    if (slider) {
      slider.value = state.settings.volume;
      slider.focus();
    }
  }

  function closeVolumePopover(options = {}) {
    const { returnFocus = true } = options;
    const wasOpen = volumePopover.getAttribute('aria-hidden') === 'false';
    volumePopover.setAttribute('aria-hidden', 'true');
    volumeTrayButton.setAttribute('aria-expanded', 'false');
    if (returnFocus && wasOpen) {
      volumeTrayButton.focus();
    }
  }

  function openApp(appId, payload) {
    const app = apps[appId];
    if (!app) return null;
    playClick();
    return windowManager.createWindow(app, payload);
  }

  const apps = {
    settings: {
      id: 'settings',
      title: 'Settings',
      shortTitle: 'Settings',
      icon: 'assets/icons/settings.svg',
      allowMultiple: false,
      resizable: false,
      mount({ container, instance }) {
        const wrapper = document.createElement('div');
        wrapper.className = 'shagos-settings';

        const appearance = document.createElement('section');
        appearance.className = 'shagos-settings__group';
        appearance.innerHTML = `
          <h3>Appearance</h3>
          <div class="shagos-settings__option">
            <label for="themeSelector">Theme mode</label>
            <div class="shagos-settings__theme" id="themeSelector"></div>
          </div>
          <div class="shagos-settings__option">
            <label>Wallpapers</label>
            <div class="shagos-settings__wallpapers" id="wallpaperSelector"></div>
          </div>
        `;

        const system = document.createElement('section');
        system.className = 'shagos-settings__group';
        system.innerHTML = `
          <h3>System</h3>
          <div class="shagos-settings__option">
            <label for="volumeControl">Master volume</label>
            <input type="range" id="volumeControl" class="shagos-slider" min="0" max="1" step="0.05" value="${state.settings.volume}" />
          </div>
          <div class="shagos-settings__option">
            <label for="uiSoundToggle">UI Sounds</label>
            <input type="checkbox" id="uiSoundToggle" ${state.settings.soundsEnabled ? 'checked' : ''} />
          </div>
          <div class="shagos-settings__option">
            <div class="shagos-about">
              <strong>About</strong>
              <span>ShagOS v1.0</span>
              <span>Crafted for the ShagWekker universe.</span>
            </div>
          </div>
        `;

        if (!storage.isAvailable) {
          const notice = document.createElement('p');
          notice.className = 'shagos-notice';
          notice.textContent = 'Preferences are running in memory only. Changes will reset after closing the tab.';
          system.appendChild(notice);
        }

        wrapper.append(appearance, system);
        container.appendChild(wrapper);

        const themeSelector = appearance.querySelector('#themeSelector');
        ['glass', 'light', 'dark'].forEach((theme) => {
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'shagos-chip';
          chip.dataset.theme = theme;
          chip.textContent = theme.charAt(0).toUpperCase() + theme.slice(1);
          chip.dataset.selected = state.settings.theme === theme ? 'true' : 'false';
          chip.addEventListener('click', () => {
            state.settings.theme = theme;
            persistSettings();
            applyTheme(theme);
            playClick();
            themeSelector.querySelectorAll('.shagos-chip').forEach((item) => {
              item.dataset.selected = item.dataset.theme === theme ? 'true' : 'false';
            });
          });
          themeSelector.appendChild(chip);
        });

        const wallpapers = [
          { id: 'aurora', label: 'Aurora Glass' },
          { id: 'sunrise', label: 'Sunrise Bloom' },
          { id: 'noir', label: 'Noir Luxe' },
        ];

        const wallpaperSelector = appearance.querySelector('#wallpaperSelector');
        wallpapers.forEach((wallpaper) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.dataset.wallpaper = wallpaper.id;
          button.dataset.selected = state.settings.wallpaper === wallpaper.id ? 'true' : 'false';
          button.title = wallpaper.label;

          const img = document.createElement('img');
          img.src = `assets/wallpapers/${wallpaper.id}.svg`;
          img.alt = wallpaper.label;

          button.appendChild(img);
          button.addEventListener('click', () => {
            state.settings.wallpaper = wallpaper.id;
            persistSettings();
            applyWallpaper(wallpaper.id);
            playClick();
            wallpaperSelector.querySelectorAll('button').forEach((item) => {
              item.dataset.selected = item.dataset.wallpaper === wallpaper.id ? 'true' : 'false';
            });
          });

          wallpaperSelector.appendChild(button);
        });

        const volumeControl = system.querySelector('#volumeControl');
        volumeControl.addEventListener('input', () => {
          state.settings.volume = Number(volumeControl.value);
          applyVolume(state.settings.volume);
          persistSettings();
        });

        const uiSoundToggle = system.querySelector('#uiSoundToggle');
        uiSoundToggle.addEventListener('change', () => {
          state.settings.soundsEnabled = uiSoundToggle.checked;
          persistSettings();
        });

        instance.onClose = () => {
          closeVolumePopover({ returnFocus: false });
        };
      },
    },
    shagpad: {
      id: 'shagpad',
      title: 'ShagPad',
      shortTitle: 'ShagPad',
      icon: 'assets/icons/notepad.svg',
      allowMultiple: true,
      resizable: true,
      mount({ container, windowId, instance }) {
        const wrapper = document.createElement('div');
        wrapper.className = 'shagpad';

        const toolbar = document.createElement('div');
        toolbar.className = 'shagpad__toolbar';

        const newBtn = document.createElement('button');
        newBtn.type = 'button';
        newBtn.textContent = 'New';

        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.textContent = 'Save';

        const loadBtn = document.createElement('button');
        loadBtn.type = 'button';
        loadBtn.textContent = 'Load';

        const exportBtn = document.createElement('button');
        exportBtn.type = 'button';
        exportBtn.textContent = 'Export .txt';

        const select = document.createElement('select');
        select.className = 'shagpad__select';
        select.setAttribute('aria-label', 'Saved documents');

        toolbar.append(newBtn, saveBtn, loadBtn, exportBtn, select);

        const editor = document.createElement('textarea');
        editor.className = 'shagpad__editor';
        editor.placeholder = 'Start writing your notes...';

        wrapper.append(toolbar, editor);
        container.appendChild(wrapper);

        const instanceState = {
          currentDocId: null,
        };

        function refreshSelect() {
          const docs = state.docs;
          select.innerHTML = '';
          const placeholder = document.createElement('option');
          placeholder.value = '';
          placeholder.textContent = docs.length ? 'Select a document' : 'No saved documents yet';
          select.appendChild(placeholder);
          docs.forEach((doc) => {
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = `${doc.name}`;
            if (doc.id === instanceState.currentDocId) {
              option.selected = true;
            }
            select.appendChild(option);
          });
        }

        refreshSelect();

        const onDocsChanged = () => {
          refreshSelect();
        };

        document.addEventListener(DOCS_EVENT, onDocsChanged);

        newBtn.addEventListener('click', () => {
          if (editor.value.trim().length && !confirm('Discard current note?')) {
            return;
          }
          editor.value = '';
          instanceState.currentDocId = null;
          refreshSelect();
          playClick();
        });

        saveBtn.addEventListener('click', () => {
          const content = editor.value;
          const name = prompt('Document name', instanceState.currentDocId ? getDoc(instanceState.currentDocId)?.name : 'Untitled note');
          if (!name) return;
          if (instanceState.currentDocId) {
            updateDoc(instanceState.currentDocId, { name, content });
          } else {
            const docId = saveDoc({ name, content });
            instanceState.currentDocId = docId;
          }
          persistDocs();
          playClick();
        });

        loadBtn.addEventListener('click', () => {
          const docId = select.value;
          if (!docId) return;
          const doc = getDoc(docId);
          if (!doc) return;
          editor.value = doc.content;
          instanceState.currentDocId = doc.id;
          playClick();
        });

        exportBtn.addEventListener('click', () => {
          const blob = new Blob([editor.value], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = `${instanceState.currentDocId ? getDoc(instanceState.currentDocId)?.name : 'shagpad-note'}.txt`;
          document.body.appendChild(anchor);
          anchor.click();
          document.body.removeChild(anchor);
          URL.revokeObjectURL(url);
          playClick();
        });

        select.addEventListener('change', () => {
          const docId = select.value;
          if (!docId) return;
          const doc = getDoc(docId);
          if (doc) {
            editor.value = doc.content;
            instanceState.currentDocId = doc.id;
          }
        });

        instance.onClose = () => {
          document.removeEventListener(DOCS_EVENT, onDocsChanged);
        };
      },
    },
  };

  function getDoc(id) {
    return state.docs.find((doc) => doc.id === id) || null;
  }

  function saveDoc({ name, content }) {
    const docId = `doc-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    state.docs.push({ id: docId, name, content, updatedAt: Date.now() });
    return docId;
  }

  function updateDoc(id, payload) {
    const doc = getDoc(id);
    if (!doc) return;
    doc.name = payload.name;
    doc.content = payload.content;
    doc.updatedAt = Date.now();
  }

  function initLauncher() {
    launcherButton.addEventListener('click', () => {
      const isOpen = launcher.getAttribute('aria-hidden') === 'false';
      launcher.setAttribute('aria-hidden', isOpen ? 'true' : 'false');
      launcherButton.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
      if (!isOpen) {
        launcher.querySelector('button').focus();
      }
      playClick();
    });

    launcher.querySelectorAll('[data-app]').forEach((button) => {
      button.addEventListener('click', () => {
        const appId = button.dataset.app;
        launcher.setAttribute('aria-hidden', 'true');
        launcherButton.setAttribute('aria-expanded', 'false');
        openApp(appId);
      });
    });

    document.addEventListener('click', (event) => {
      if (!launcher.contains(event.target) && !launcherButton.contains(event.target)) {
        launcher.setAttribute('aria-hidden', 'true');
        launcherButton.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function initTaskbar() {
    document.querySelectorAll('[data-open-app]').forEach((button) => {
      button.addEventListener('click', () => {
        const appId = button.dataset.openApp;
        openApp(appId);
      });
    });
  }

  function initKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
      if (event.altKey && event.key.toLowerCase() === 'tab') {
        event.preventDefault();
        windowManager.focusNextWindow();
      }

      if (event.key === 'Escape' && state.activeWindowId) {
        event.preventDefault();
        playClick();
        windowManager.closeWindow(state.activeWindowId);
      }
    });
  }

  function initVolumeTray() {
    volumeTrayButton.addEventListener('click', () => {
      playClick();
      openVolumePopover();
    });
  }

  function initClock() {
    updateClock();
    setInterval(updateClock, 1000 * 30);
  }

  function boot() {
    applyTheme(state.settings.theme);
    applyWallpaper(state.settings.wallpaper);
    applyVolume(state.settings.volume);

    setTimeout(() => {
      showDesktop();
      try {
        bootChime.currentTime = 0;
        bootChime.play().catch(() => {});
      } catch (error) {
        console.warn('[ShagOS] Boot chime failed', error);
      }
    }, 2400);
  }

  function init() {
    initLauncher();
    initTaskbar();
    initKeyboardShortcuts();
    initVolumeTray();
    initClock();

    boot();
  }

  init();

  return {
    openApp,
    state,
    storage,
    windowManager,
  };
})();

window.ShagOS = ShagOS;
