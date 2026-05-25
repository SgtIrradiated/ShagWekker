/* global React, ReactDOM, window */
const { useState: useStateA, useEffect: useEffectA, useMemo: useMemoA, useCallback: useCallbackA, useRef: useRefA } = React;

const TWEAK_DEFAULTS = window.__TWEAK_DEFAULTS || {
  "theme": "dark",
  "accent": "#ff3344",
  "density": "cozy",
  "glassBlur": 28
};

function App() {
  // ---------- Page routing ----------
  const [page, setPage] = useStateA('home');
  const [mobileNavOpen, setMobileNavOpen] = useStateA(false);

  // ---------- Persisted state ----------
  const [cues, setCues] = window.useLocalStorage('sw_cues', window.DEFAULT_CUES);
  const [shagCount, setShagCount] = window.useLocalStorage('sw_shag_count', 0);
  const [shagGoal, setShagGoal] = window.useLocalStorage('sw_shag_goal', 8);
  const [editingCue, setEditingCue] = useStateA(null);

  // ---------- Tweakable state ----------
  const [tweaks, setTweak] = window.useTweaks(TWEAK_DEFAULTS);

  const [soundOn, setSoundOn] = useStateA(true);
  const [notifyOn, setNotifyOn] = useStateA(false);
  const [contrastOn, setContrastOn] = useStateA(false);

  // ---------- Toasts ----------
  const [toasts, setToasts] = useStateA([]);
  const pushToast = useCallbackA((text) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter(x => x.id !== id)), 3000);
  }, []);

  // ---------- Apply tweaks to root ----------
  useEffectA(() => {
    document.documentElement.setAttribute('data-theme', tweaks.theme);
    document.documentElement.setAttribute('data-density', tweaks.density);
    document.documentElement.style.setProperty('--accent', tweaks.accent);
    document.documentElement.style.setProperty('--accent-soft', tweaks.accent);
    document.documentElement.style.setProperty('--glass-blur', `${tweaks.glassBlur}px`);
    if (contrastOn) document.documentElement.setAttribute('data-contrast', 'high');
    else document.documentElement.removeAttribute('data-contrast');
  }, [tweaks, contrastOn]);

  // ---------- Nav ----------
  const handleNav = useCallbackA((item) => {
    if (item.id !== page) {
      setPage(item.id);
      window.scrollTo({ top: 0 });
      if (item.section) {
        setTimeout(() => {
          document.getElementById(item.section)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 80);
      }
    } else if (item.section) {
      document.getElementById(item.section)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [page]);

  // ---------- Cue actions ----------
  const handleCueAdd = useCallbackA((cue) => {
    setCues((arr) => {
      const exists = arr.some(c => c.id === cue.id);
      if (exists) {
        return arr.map(c => c.id === cue.id ? { ...c, ...cue, isDefault: c.isDefault } : c);
      }
      return [...arr, cue];
    });
    setEditingCue(null);
    pushToast(`Cue ${editingCue ? 'bijgewerkt' : 'opgeslagen'}: ${cue.label}`);
  }, [editingCue, pushToast, setCues]);

  const handleCueDelete = useCallbackA((id) => {
    setCues((arr) => arr.filter(c => c.id !== id));
    pushToast('Cue verwijderd.');
  }, [pushToast, setCues]);

  const handleCueEdit = useCallbackA((cue) => {
    setEditingCue(cue);
    if (cue) {
      setTimeout(() => document.getElementById('customize')?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }, []);

  // ---------- ShagMeter ----------
  const handleAddShag = useCallbackA(() => {
    setShagCount((c) => {
      const next = c + 1;
      if (next === shagGoal) pushToast(`🎉 Doel bereikt: ${shagGoal} Shaggies!`);
      return next;
    });
  }, [shagGoal, pushToast, setShagCount]);

  const handleResetShag = useCallbackA(() => {
    setShagCount(0);
    pushToast('ShagMeter gereset.');
  }, [pushToast, setShagCount]);

  // ---------- Accent (legacy controls) ----------
  const handleAccentChange = useCallbackA((c) => {
    setTweak('accent', c);
  }, [setTweak]);
  const handleAccentReset = useCallbackA(() => {
    setTweak('accent', '#ff3344');
  }, [setTweak]);

  // ---------- Toggles ----------
  const handleSoundToggle = useCallbackA(() => setSoundOn(s => { pushToast(`Geluid ${!s ? 'aan' : 'uit'}`); return !s; }), [pushToast]);
  const handleNotifyToggle = useCallbackA(() => setNotifyOn(s => { pushToast(`Notificaties ${!s ? 'aan' : 'uit'}`); return !s; }), [pushToast]);
  const handleContrastToggle = useCallbackA(() => setContrastOn(s => { pushToast(`High contrast ${!s ? 'aan' : 'uit'}`); return !s; }), [pushToast]);
  const handleThemeToggle = useCallbackA(() => {
    const order = ['dark', 'light'];
    const idx = order.indexOf(tweaks.theme);
    const next = order[(idx + 1) % order.length];
    setTweak('theme', next);
  }, [tweaks.theme, setTweak]);

  // ---------- State bag for pages ----------
  const state = {
    cues, shagCount, shagGoal, accent: tweaks.accent, editingCue,
  };

  // ---------- Render page ----------
  let pageEl = null;
  switch (page) {
    case 'shagmeter':
      pageEl = <window.ShagmeterPage state={state} onAddShag={handleAddShag} onResetShag={handleResetShag} onSetGoal={setShagGoal} onNav={handleNav} onToast={pushToast} />;
      break;
    case 'gallery':
      pageEl = <window.GalleryPage onNav={handleNav} />;
      break;
    case 'library':
      pageEl = <window.LibraryPage onNav={handleNav} onToast={pushToast} />;
      break;
    case 'archief':
      pageEl = <window.ArchiefPage />;
      break;
    default:
      pageEl = (
        <window.HomePage
          state={state}
          onCueAdd={handleCueAdd}
          onCueDelete={handleCueDelete}
          onCueEdit={handleCueEdit}
          onAddShag={handleAddShag}
          onResetShag={handleResetShag}
          onSetGoal={setShagGoal}
          onAccentChange={handleAccentChange}
          onAccentReset={handleAccentReset}
          soundOn={soundOn}
          onSoundToggle={handleSoundToggle}
          onToast={pushToast}
          onNav={handleNav}
        />
      );
  }

  return (
    <>
      <window.AppBackground />
      <div className="app" id="top">
        <window.Nav
          currentPage={page}
          onNav={handleNav}
          soundOn={soundOn}
          onSoundToggle={handleSoundToggle}
          notifyOn={notifyOn}
          onNotifyToggle={handleNotifyToggle}
          contrastOn={contrastOn}
          onContrastToggle={handleContrastToggle}
          theme={tweaks.theme}
          onThemeToggle={handleThemeToggle}
        />
        <main>
          {pageEl}
        </main>
        <div className="container">
          <window.Footer />
        </div>
      </div>
      <window.ToastStack toasts={toasts} />

      <window.TweaksPanel title="Tweaks">
        <window.TweakSection label="Appearance">
          <window.TweakRadio
            label="Theme"
            value={tweaks.theme}
            onChange={(v) => setTweak('theme', v)}
            options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }]}
          />
          <window.TweakRadio
            label="Density"
            value={tweaks.density}
            onChange={(v) => setTweak('density', v)}
            options={[{ value: 'compact', label: 'Compact' }, { value: 'cozy', label: 'Cozy' }, { value: 'spacious', label: 'Spacious' }]}
          />
          <window.TweakSlider
            label="Glass blur"
            value={tweaks.glassBlur}
            onChange={(v) => setTweak('glassBlur', v)}
            min={0} max={60} step={2}
            unit="px"
          />
        </window.TweakSection>
        <window.TweakSection label="Accent color">
          <window.TweakColor
            label="Accent"
            value={tweaks.accent}
            onChange={(v) => setTweak('accent', v)}
            options={['#ff3344', '#ff7a1a', '#ffc233', '#33d684', '#33b8ff', '#a26bff', '#ff5fa2']}
          />
        </window.TweakSection>
      </window.TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
