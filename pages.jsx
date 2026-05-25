/* global React, window */
const { useState: useStateP, useEffect: useEffectP, useRef: useRefP, useMemo: useMemoP, useCallback: useCallbackP } = React;

// ============ HOME PAGE ============
function HomePage({ state, onCueAdd, onCueDelete, onCueEdit, onAddShag, onResetShag, onSetGoal, onAccentChange, onAccentReset, soundOn, onSoundToggle, onToast, onNav }) {
  const now = window.useNow(1000);

  const nextEvent = useMemoP(() => {
    if (!state.cues.length) return null;
    let next = null;
    for (const cue of state.cues) {
      const occ = window.nextOccurrence(cue, now);
      if (occ > now && (!next || occ < next.when)) {
        next = { cue, when: occ };
      }
    }
    return next;
  }, [state.cues, now]);

  return (
    <div className="page-view" key="home">
      {/* ===== HERO ===== */}
      <section className="container">
        <div className="hero" id="hero">
          <div className="hero__content">
            <p className="hero__eyebrow">Medemogelijk gemaakt door British American Tobacco</p>
            <h1 className="hero__title">ShagWekker.</h1>
            <p className="hero__lead">Een Wekker. Voor Shag. Door Shag.</p>
            <p className="hero__lead hero__lead--accent">Simpelweg Revolutionair.</p>
            <div className="hero__actions">
              <a className="btn btn--primary" href="#planner" onClick={(e) => { e.preventDefault(); document.getElementById('planner')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
                Open planner
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </a>
              <button className="btn btn--outline" onClick={() => onToast('NPC Timer Demo gestart — kijk eens in de Nicotineteller.')}>
                NPC Timer Demo
              </button>
              <a className="btn btn--ghost" href="#" onClick={(e) => { e.preventDefault(); onNav({ id: 'library' }); }}>ShagFiles ↗</a>
            </div>
          </div>
          <figure className="hero__media">
            <img src="assets/shag.png" alt="ShagWekker logo" loading="lazy" />
          </figure>
        </div>
      </section>

      {/* ===== STATUS GRID ===== */}
      <section className="container">
        <div className="status-grid">
          <article className="glass status-card">
            <header className="status-card__header">
              <h2 className="status-card__title">Next up</h2>
              <time className="status-card__clock">{window.pad(now.getHours())}:{window.pad(now.getMinutes())}:{window.pad(now.getSeconds())}</time>
            </header>
            <p className="status-card__label">{nextEvent ? nextEvent.cue.label : 'Waiting for your first cue'}</p>
            <p className="status-card__count status-card__count--mono">
              {nextEvent ? window.formatCountdown(nextEvent.when - now) : '--h --m --s'}
            </p>
          </article>

          <article className="glass status-card">
            <header className="status-card__header">
              <h2 className="status-card__title">Ingelasde Nicotine Doseringen</h2>
            </header>
            <p className="status-card__label">Elke sigaret = 0,7 mg aan Nicotine*** dus rook er lekker twee!</p>
            <p className="status-card__count">{state.cues.length}</p>
            <p className="status-card__hint">Shag.</p>
          </article>

          <article className="glass status-card">
            <header className="status-card__header">
              <h2 className="status-card__title">Roken is lekker en bevorderd de cognitieve functie.</h2>
            </header>
            <p className="status-card__label">Shag.</p>
            <div className="status-card__controls">
              <div className="control-row">
                <label htmlFor="accentControl">Accent</label>
                <input
                  type="color"
                  id="accentControl"
                  className="color-input"
                  value={state.accent}
                  onChange={(e) => onAccentChange(e.target.value)}
                  aria-label="Pick accent color"
                />
                <code className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>{state.accent}</code>
                <button type="button" className="btn btn--ghost btn--mini" onClick={onAccentReset} style={{ marginLeft: 'auto' }}>Reset</button>
              </div>
              <div className="control-row">
                <button className="btn btn--ghost btn--mini" onClick={onSoundToggle} aria-pressed={soundOn}>
                  Geluid: {soundOn ? 'aan' : 'uit'}
                </button>
              </div>
            </div>
          </article>
        </div>
      </section>

      {/* ===== ShagMeter embed ===== */}
      <section className="container">
        <div className="glass shagmeter-embed">
          <header className="shagmeter-embed__head">
            <h3 className="shagmeter-embed__title">ShagMeter — dagelijks doel</h3>
            <a href="#" className="shagmeter-embed__link" onClick={(e) => { e.preventDefault(); onNav({ id: 'shagmeter' }); }}>Volledige pagina →</a>
          </header>
          <div className="shagmeter">
            <div className="shagmeter__goal">
              <span className="shagmeter__goal-label">Dagelijkse shag goal</span>
              <span className="shagmeter__goal-value">
                {state.shagGoal}
                <span className="shagmeter__goal-unit">Shaggies</span>
              </span>
              <input
                type="range"
                min="1"
                max="20"
                step="1"
                value={state.shagGoal}
                onChange={(e) => onSetGoal(Number(e.target.value))}
                aria-label="Dagelijkse shag goal"
              />
              <p className="shagmeter__status">
                <strong>{state.shagCount}</strong> van <strong>{state.shagGoal}</strong> Shaggies genoteerd.
              </p>
              <div className="shagmeter__actions">
                <button type="button" className="shagmeter__add" onClick={onAddShag} aria-label="Voeg een shaggie toe">+</button>
                <span className="shagmeter__add-label">Shaggie</span>
                <button type="button" className="btn btn--ghost btn--mini" onClick={onResetShag}>Reset</button>
              </div>
            </div>
            <div className="shagmeter__visual">
              <window.ShagMeterRing count={state.shagCount} goal={state.shagGoal} />
            </div>
          </div>
        </div>
      </section>

      {/* ===== Planner / Nicotineteller ===== */}
      <section className="container" id="planner">
        <window.SectionHead
          eyebrow="What's on deck"
          title="Nicotineteller"
          hint="Core pauzes en je eigen rituelen lopen hier realtime mee."
        />
        <div className="glass planner">
          <p className="planner__intro">
            Laat de glimmende timeline jouw volgende shagmoment aftellen — standaard cues en persoonlijke inlassingen smelten samen.
          </p>
          <Timeline cues={state.cues} now={now} nextEvent={nextEvent} />
        </div>
      </section>

      {/* ===== Customize / Inlassen ===== */}
      <section className="container" id="customize">
        <window.SectionHead
          eyebrow="Als je maar niet genoeg van je Shag kan krijgen."
          title="Las een shag pauze in;"
          actions={
            <>
              <button className="btn btn--ghost" onClick={() => onToast('JSON export gegenereerd (mock).')}>Export JSON</button>
              <button className="btn btn--ghost" onClick={() => onToast('Selecteer een JSON bestand om te importeren.')}>Import JSON</button>
              <button className="btn btn--ghost btn--danger" onClick={() => { if (confirm('Verwijder alle eigen cues?')) { state.cues.filter(c => !c.isDefault).forEach(c => onCueDelete(c.id)); onToast('Alle eigen cues verwijderd.'); } }}>Clear all</button>
            </>
          }
        />
        <div className="customize">
          <div className="glass customize__form">
            <CueForm onSubmit={onCueAdd} onEdit={onCueEdit} editing={state.editingCue} onCancelEdit={() => onCueEdit(null)} />
          </div>
          <div className="glass customize__board">
            <header className="customize__board-head">
              <h3>Ingelasde ShagPauzes Overzicht</h3>
            </header>
            {state.cues.filter(c => !c.isDefault).length === 0 ? (
              <p className="custom-empty">Las een ShagPauze in, en bewerk ze hier!</p>
            ) : (
              <ul className="cue-grid">
                {state.cues.filter(c => !c.isDefault).map((cue) => (
                  <li key={cue.id} className="cue-card" style={{ borderLeftColor: cue.color }}>
                    <p className="cue-card__time">{cue.time}</p>
                    <p className="cue-card__label">{cue.label}</p>
                    <p className="cue-card__meta">{window.RECURRENCE_LABELS[cue.recurrence]}{cue.recurrence === 'SpecificWeekdays' && cue.weekdays ? ` · ${cue.weekdays.map(d => window.WEEKDAY_NAMES[d]).join(',')}` : ''}</p>
                    {cue.notes && <p className="cue-card__notes">{cue.notes}</p>}
                    <div className="cue-card__actions">
                      <button className="cue-card__btn" onClick={() => onCueEdit(cue)}>Bewerk</button>
                      <button className="cue-card__btn cue-card__btn--danger" onClick={() => onCueDelete(cue.id)}>Verwijder</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* ===== Insights ===== */}
      <section className="container" id="insights">
        <window.SectionHead
          eyebrow="Van Nelle Zware"
          title="Pro-Nicotinergische websites."
          hint="Handige links als het gaat om Shag."
        />
        <ul className="insights__grid">
          <li>
            <a className="glass insight-tile" href="https://ishetalpauze.nl" target="_blank" rel="noopener noreferrer" style={{ '--tile-accent': '#ff3344' }}>
              <span className="insight-tile__glow" aria-hidden="true" />
              <span className="insight-tile__icon" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" focusable="false">
                  <rect x="9" y="9" width="30" height="30" rx="12" ry="12" fill="none" stroke="currentColor" strokeWidth="2.5" opacity="0.82" />
                  <path d="M16 29c2.4-4.6 6.1-7.4 11.2-7.4 3.4 0 5.9 1.6 7.8 3.8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
                  <circle cx="20.5" cy="21" r="2.5" fill="currentColor" />
                </svg>
              </span>
              <span className="insight-tile__label">IsHetAlPauze.nl</span>
              <span className="insight-tile__hint">De inferieure voorganger van ShagWekker. (Plugin Circlejerk)</span>
              <span className="insight-tile__arrow">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 17L17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
            </a>
          </li>
          <li>
            <a className="glass insight-tile" href="https://jensen.nl/" target="_blank" rel="noopener noreferrer" style={{ '--tile-accent': '#ffd447' }}>
              <span className="insight-tile__glow" aria-hidden="true" />
              <span className="insight-tile__icon" aria-hidden="true">
                <img src="assets/jensen.svg" alt="" width="32" height="32" loading="lazy" />
              </span>
              <span className="insight-tile__label"><b>JENSEN</b></span>
              <span className="insight-tile__hint">Ontdek meer via <b>JENSEN.nl.</b></span>
              <span className="insight-tile__arrow">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 17L17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
            </a>
          </li>
        </ul>
      </section>

      {/* ===== Audio Lounge ===== */}
      <section className="container" id="audio-lounge">
        <window.SectionHead
          eyebrow="ShagWekker Soundscapes"
          title="Audio Pauze Parlor."
          hint="Selecteer een audiotrack uit de shag-archieven en laat het ritme je volgende trek bepalen."
        />
        <div className="glass audio-player">
          <AudioPlayerWidget />
        </div>
      </section>

      {/* ===== Soundboard ===== */}
      <section className="container" id="soundboard">
        <window.SectionHead
          eyebrow="Snelle shag-sfx"
          title="Soundboard."
          hint="Druk op een pad voor een korte clip — onafhankelijk van de speler hierboven."
        />
        <div className="soundboard">
          {window.SOUNDBOARD_PADS.map((pad) => (
            <SoundboardPad key={pad.id} pad={pad} onToast={onToast} />
          ))}
        </div>
      </section>

      {/* ===== Gallery preview ===== */}
      <section className="container" id="gallery-preview">
        <window.SectionHead
          eyebrow="Oogsnoep"
          title="Uit de gallery."
          actions={<a className="btn btn--ghost" href="#" onClick={(e) => { e.preventDefault(); onNav({ id: 'gallery' }); }}>Meer in de gallery →</a>}
        />
        <div className="gallery-strip">
          {window.GALLERY_ITEMS.slice(0, 5).map((item, i) => (
            <div key={i} className="gallery-strip__item">
              {item.src ? (
                <img src={item.src} alt={item.alt || item.title} loading="lazy" />
              ) : (
                <div className="gallery-strip__item-placeholder">
                  <div>{item.placeholder || 'Image'}<br /><small>placeholder</small></div>
                </div>
              )}
              <div className="gallery-strip__caption">{item.title}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ============ Timeline ============
function Timeline({ cues, now, nextEvent }) {
  const sorted = useMemoP(() => {
    return [...cues]
      .map(c => ({ ...c, _next: window.nextOccurrence(c, now) }))
      .sort((a, b) => a._next - b._next);
  }, [cues, now]);

  return (
    <ol className="timeline">
      {sorted.map((cue) => {
        const isNext = nextEvent && cue.id === nextEvent.cue.id;
        const delta = cue._next - now;
        return (
          <li key={cue.id} className={`timeline__item ${isNext ? 'timeline__item--next' : ''}`}>
            <span className="timeline__time">{cue.time}</span>
            <div className="timeline__body">
              <p className="timeline__label">
                <span className="timeline__dot" style={{ background: cue.color }} />
                {cue.label}
              </p>
              <p className="timeline__meta">
                <span className="timeline__chip">{window.RECURRENCE_LABELS[cue.recurrence]}</span>
                {cue.isDefault ? <span className="timeline__chip">Default</span> : <span className="timeline__chip">Inlas</span>}
                {cue.notes && <span>{cue.notes}</span>}
              </p>
            </div>
            <div className={`timeline__countdown ${isNext ? 'timeline__countdown--next' : ''}`}>
              {window.formatCountdown(delta)}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ============ Cue Form ============
function CueForm({ onSubmit, onEdit, editing, onCancelEdit }) {
  const [form, setForm] = useStateP({
    label: '', time: '12:00', recurrence: 'Daily', color: '#ff3344', notes: '', weekdays: [],
  });

  useEffectP(() => {
    if (editing) {
      setForm({
        label: editing.label || '',
        time: editing.time || '12:00',
        recurrence: editing.recurrence || 'Daily',
        color: editing.color || '#ff3344',
        notes: editing.notes || '',
        weekdays: editing.weekdays || [],
      });
    }
  }, [editing]);

  const reset = () => setForm({ label: '', time: '12:00', recurrence: 'Daily', color: '#ff3344', notes: '', weekdays: [] });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.label.trim()) return;
    onSubmit({
      id: editing ? editing.id : `c${Date.now()}`,
      ...form,
    });
    reset();
  };

  const toggleWeekday = (d) => {
    setForm((f) => ({
      ...f,
      weekdays: f.weekdays.includes(d) ? f.weekdays.filter(x => x !== d) : [...f.weekdays, d].sort(),
    }));
  };

  return (
    <form onSubmit={handleSubmit} autoComplete="off">
      <div className="form-field">
        <label htmlFor="labelInput">Label</label>
        <input id="labelInput" className="text-input" type="text" required placeholder="e.g. Hydration break" maxLength={32}
          value={form.label} onChange={(e) => setForm(f => ({ ...f, label: e.target.value }))} />
      </div>
      <div className="form-row">
        <div className="form-field">
          <label htmlFor="timeInput">Time</label>
          <input id="timeInput" className="text-input time-input" type="time" required
            value={form.time} onChange={(e) => setForm(f => ({ ...f, time: e.target.value }))} />
        </div>
        <div className="form-field">
          <label htmlFor="recurrenceSelect">Recurrence</label>
          <select id="recurrenceSelect" className="select-input"
            value={form.recurrence} onChange={(e) => setForm(f => ({ ...f, recurrence: e.target.value }))}>
            <option value="Daily">Dagelijks</option>
            <option value="Weekdays">Doordeweeks</option>
            <option value="Weekends">Weekenden</option>
            <option value="SpecificWeekdays">Specifieke dagen</option>
          </select>
        </div>
      </div>
      <div className="form-field form-field--color">
        <label htmlFor="colorInput">Shag Kleur</label>
        <input id="colorInput" type="color" className="color-input"
          value={form.color} onChange={(e) => setForm(f => ({ ...f, color: e.target.value }))} />
        <code className="mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>{form.color}</code>
      </div>
      {form.recurrence === 'SpecificWeekdays' && (
        <fieldset className="weekday-picker">
          <legend>Kies dagen</legend>
          <div className="weekday-picker__opts">
            {[1,2,3,4,5,6,0].map((d) => (
              <label key={d} className="weekday-pill" data-on={form.weekdays.includes(d) ? 'true' : 'false'}>
                <input type="checkbox" checked={form.weekdays.includes(d)} onChange={() => toggleWeekday(d)} />
                {window.WEEKDAY_NAMES[d]}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="form-field">
        <label htmlFor="notesInput">Notitties</label>
        <textarea id="notesInput" className="text-input" rows="3" placeholder="Add an optional intention or checklist." maxLength={120}
          value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} />
      </div>
      <div className="form-actions">
        <button className="btn btn--primary" type="submit">{editing ? 'Update cue' : 'Save cue'}</button>
        {editing && <button className="btn btn--ghost" type="button" onClick={() => { onCancelEdit(); reset(); }}>Cancel edit</button>}
      </div>
    </form>
  );
}

// ============ Audio Player widget ============
function AudioPlayerWidget() {
  const [trackIdx, setTrackIdx] = useStateP(0);
  const [playing, setPlaying] = useStateP(false);
  const [progress, setProgress] = useStateP(0);
  const [shuffle, setShuffle] = useStateP(false);
  const tracks = window.AUDIO_TRACKS;
  const track = tracks[trackIdx];

  useEffectP(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setProgress((p) => {
        if (p >= 1) { setPlaying(false); return 0; }
        return p + 0.005;
      });
    }, 200);
    return () => clearInterval(id);
  }, [playing]);

  const parseDur = (s) => {
    const [m, sec] = s.split(':').map(Number);
    return m * 60 + sec;
  };
  const totalSec = parseDur(track.duration);
  const curSec = Math.floor(progress * totalSec);
  const fmtSec = (s) => `${Math.floor(s / 60)}:${window.pad(s % 60)}`;

  const next = () => { setTrackIdx((i) => (shuffle ? Math.floor(Math.random() * tracks.length) : (i + 1) % tracks.length)); setProgress(0); };
  const prev = () => { setTrackIdx((i) => (i - 1 + tracks.length) % tracks.length); setProgress(0); };

  return (
    <>
      <figure className={`audio-player__art ${playing ? 'audio-player__art--playing' : ''}`}>
        <img src="assets/shag.png" alt="" />
      </figure>
      <div className="audio-player__body">
        <p className="audio-player__status">
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', boxShadow: '0 0 8px var(--accent-glow)' }} />
          {playing ? 'Now playing' : 'Vaste playlist wordt geladen...'}
        </p>
        <h3 className="audio-player__title">{track.title}</h3>
        <p className="audio-player__meta">{track.meta}</p>

        <div className="audio-player__selector">
          <select className="select-input" value={trackIdx} onChange={(e) => { setTrackIdx(Number(e.target.value)); setProgress(0); }}>
            {tracks.map((t, i) => <option key={t.id} value={i}>{t.title}</option>)}
          </select>
        </div>

        <div className={`audio-player__waveform ${playing ? 'audio-player__waveform--playing' : ''}`} aria-hidden="true">
          {Array.from({ length: 28 }).map((_, i) => (
            <span key={i} style={{ '--wave': (Math.sin(i * 0.7) + 1) / 2, '--wave-index': i }} />
          ))}
        </div>

        <div className="audio-player__controls">
          <button className="audio-player__ctrl" onClick={prev} aria-label="Vorige">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="17,5 17,19 8,12" /><rect x="5" y="5" width="2.5" height="14" rx="1" /></svg>
          </button>
          <button className="audio-player__ctrl audio-player__ctrl--play" onClick={() => setPlaying(p => !p)} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="8,5 8,19 19,12" /></svg>
            )}
          </button>
          <button className="audio-player__ctrl" onClick={() => { setPlaying(false); setProgress(0); }} aria-label="Stop">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1.5" /></svg>
          </button>
          <button className="audio-player__ctrl" onClick={next} aria-label="Volgende">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="7,5 7,19 16,12" /><rect x="16.5" y="5" width="2.5" height="14" rx="1" /></svg>
          </button>
          <button className="audio-player__ctrl" data-on={shuffle ? 'true' : 'false'} onClick={() => setShuffle(s => !s)} aria-label="Shuffle" aria-pressed={shuffle}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
            </svg>
          </button>
        </div>

        <div className="audio-player__progress">
          <span>{fmtSec(curSec)}</span>
          <input type="range" min="0" max="1000" value={progress * 1000} onChange={(e) => setProgress(Number(e.target.value) / 1000)} aria-label="Spoel door" />
          <span>{track.duration}</span>
        </div>

        <p className="audio-player__motto">Laat de klanken je shagmoment timen.</p>
      </div>
    </>
  );
}

// ============ Soundboard pad — plays the actual audio file ============
function SoundboardPad({ pad, onToast }) {
  const [active, setActive] = useStateP(false);
  const audioRef = useRefP(null);

  const click = () => {
    setActive(true);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
    onToast(`▶ ${pad.label}`);
    setTimeout(() => setActive(false), 800);
  };

  return (
    <>
      <audio ref={audioRef} src={pad.src} preload="none" />
      <button className={`soundboard__pad ${active ? 'soundboard__pad--playing' : ''}`} onClick={click}>
        {pad.label}
      </button>
    </>
  );
}

// ============ SHAGMETER PAGE ============
function ShagmeterPage({ state, onAddShag, onResetShag, onSetGoal, onNav, onToast }) {
  const now = window.useNow(1000);
  const nextEvent = useMemoP(() => {
    if (!state.cues.length) return null;
    let next = null;
    for (const cue of state.cues) {
      const occ = window.nextOccurrence(cue, now);
      if (occ > now && (!next || occ < next.when)) {
        next = { cue, when: occ };
      }
    }
    return next;
  }, [state.cues, now]);

  return (
    <div className="page-view" key="shagmeter">
      <section className="container">
        <div className="hero">
          <div className="hero__content">
            <p className="hero__eyebrow">Sla je volgende shag nooit over</p>
            <h1 className="hero__title">ShagMeter.</h1>
            <p className="hero__lead">
              Hou de Nicotine Teller vibe levend op een aparte pagina. Een snelle blik geeft je direct de eerstvolgende shag cue én je dagelijkse shag-doel.
            </p>
            <div className="hero__actions">
              <a className="btn btn--primary" href="#meter" onClick={(e) => { e.preventDefault(); document.getElementById('meter')?.scrollIntoView({ behavior: 'smooth' }); }}>Ga naar de meter</a>
              <a className="btn btn--ghost" href="#" onClick={(e) => { e.preventDefault(); onNav({ id: 'home', section: 'planner' }); }}>Terug naar de planning</a>
            </div>
          </div>
          <figure className="hero__media">
            <window.ShagMeterRing count={state.shagCount} goal={state.shagGoal} />
          </figure>
        </div>
      </section>

      <section className="container" id="meter">
        <window.SectionHead
          eyebrow="Next up"
          title="Jouw eerstvolgende shagmoment & ShagMeter"
          hint="Koppelt de Nicotineteller aan een dagelijkse shag goal. Klik en vul die meter."
        />
        <div className="customize">
          <div className="glass planner">
            <h3 style={{ margin: '0 0 6px', fontSize: 18, letterSpacing: '-0.02em' }}>Volgende cue</h3>
            <p style={{ margin: '0 0 18px', color: 'var(--ink-3)', fontSize: 14 }}>Direct gekloond uit de Nicotineteller.</p>
            <Timeline cues={state.cues} now={now} nextEvent={nextEvent} />
          </div>

          <div className="glass shagmeter-embed">
            <header className="shagmeter-embed__head">
              <h3 className="shagmeter-embed__title">ShagMeter</h3>
            </header>
            <p style={{ margin: '0 0 18px', color: 'var(--ink-3)', fontSize: 14 }}>Tel je Shaggies tot je doel bereikt is.</p>
            <div className="shagmeter__goal">
              <span className="shagmeter__goal-label">Dagelijkse shag goal</span>
              <span className="shagmeter__goal-value">{state.shagGoal}<span className="shagmeter__goal-unit">Shaggies</span></span>
              <input type="range" min="1" max="20" step="1" value={state.shagGoal} onChange={(e) => onSetGoal(Number(e.target.value))} />
            </div>
            <div className="shagmeter__visual" style={{ margin: '24px 0' }}>
              <window.ShagMeterRing count={state.shagCount} goal={state.shagGoal} />
            </div>
            <p className="shagmeter__status">
              <strong>{state.shagCount}</strong> van <strong>{state.shagGoal}</strong> Shaggies genoteerd.
            </p>
            <div className="shagmeter__actions">
              <button type="button" className="shagmeter__add" onClick={onAddShag} aria-label="Voeg een shaggie toe">+</button>
              <span className="shagmeter__add-label">Shaggie</span>
              <button type="button" className="btn btn--ghost btn--mini" onClick={onResetShag}>Reset</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ============ GALLERY PAGE ============
function GalleryPage({ onNav }) {
  const [modal, setModal] = useStateP(null);

  return (
    <div className="page-view" key="gallery">
      <section className="container">
        <div className="hero">
          <div className="hero__content">
            <p className="hero__eyebrow">Curate je rookmomenten</p>
            <h1 className="hero__title">Visual gallery.</h1>
            <p className="hero__lead">Hieronder wat oogsnoep voor voor je oogballen.</p>
            <div className="hero__actions">
              <a className="btn btn--primary" href="#gallery" onClick={(e) => { e.preventDefault(); document.getElementById('gallery')?.scrollIntoView({ behavior: 'smooth' }); }}>Bekijk de gallery</a>
              <a className="btn btn--ghost" href="#" onClick={(e) => { e.preventDefault(); onNav({ id: 'library' }); }}>Ga naar ShagFiles</a>
              <a className="btn btn--outline btn--mini" href="#" onClick={(e) => { e.preventDefault(); onNav({ id: 'archief' }); }} title="Open Hét Archief">
                <span aria-hidden="true" style={{ marginRight: 4 }}>✶</span>
                Hét Archief
              </a>
            </div>
          </div>
          <figure className="hero__media">
            <div style={{ width: '80%', height: '80%', display: 'grid', placeItems: 'center', textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--ink-3)', fontSize: 14 }}>
              <div>
                Er wordt nog aan ShagWekker gewerkt.<br />
                <small style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--ink-4)' }}>Work In Progress</small>
              </div>
            </div>
          </figure>
        </div>
      </section>

      <section className="container" id="gallery">
        <window.SectionHead
          eyebrow="Visuele collectie"
          title="Foton-database"
          hint="Leuke plaatjes om te bezichtigen voor/tijdens je dikke shag"
        />
        <div className="gallery-grid" role="list">
          {window.GALLERY_ITEMS.map((item, i) => (
            <article key={i} className="glass gallery-card" role="listitem" onClick={() => item.src && setModal(item)}>
              <figure className="gallery-card__frame">
                {item.src ? (
                  <img src={item.src} alt={item.alt || item.title} loading="lazy" />
                ) : (
                  <div className="gallery-strip__item-placeholder">
                    <div>{item.placeholder || 'Image'}<br /><small>placeholder</small></div>
                  </div>
                )}
              </figure>
              <div>
                <h3 className="gallery-card__title">{item.title}</h3>
                {item.description && <p className="gallery-card__desc">{item.description}</p>}
              </div>
            </article>
          ))}
        </div>
      </section>

      <window.Modal open={!!modal} onClose={() => setModal(null)}>
        {modal && (
          <>
            <img className="modal__image" src={modal.src} alt={modal.alt || modal.title} />
            <div className="modal__caption">
              <h3>{modal.title}</h3>
              {modal.description && <p>{modal.description}</p>}
            </div>
          </>
        )}
      </window.Modal>
    </div>
  );
}

// ============ LIBRARY (ShagFiles) PAGE ============
function LibraryPage({ onNav, onToast }) {
  return (
    <div className="page-view" key="library">
      <section className="container">
        <div className="hero">
          <div className="hero__content">
            <p className="hero__eyebrow">Altijd binnen handbereik</p>
            <h1 className="hero__title">Resource library.</h1>
            <p className="hero__lead">
              Dè plek om de énige echte Shag Files te downloaden. Met <code className="mono" style={{ color: 'var(--accent-soft)' }}>ShagSpeed</code>
            </p>
            <div className="hero__actions">
              <a className="btn btn--primary" href="#downloads" onClick={(e) => { e.preventDefault(); document.getElementById('downloads')?.scrollIntoView({ behavior: 'smooth' }); }}>
                Downloads <code className="mono" style={{ marginLeft: 6, fontSize: 12 }}>ShagSpeed</code>
              </a>
              <a className="btn btn--ghost" href="#" onClick={(e) => { e.preventDefault(); onNav({ id: 'home', section: 'planner' }); }}>Terug naar de Wekker</a>
            </div>
          </div>
          <figure className="hero__media">
            <div style={{ width: '80%', height: '80%', display: 'grid', placeItems: 'center', textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--ink-3)', fontSize: 13, padding: 24 }}>
              <div>
                <div style={{ fontSize: 64, marginBottom: 16, opacity: 0.6 }}>⚡</div>
                Downloadsnelheid sneller dan hoe hij die sigaret opsmoket.<br />
                <code className="mono" style={{ color: 'var(--accent-soft)', marginTop: 8, display: 'inline-block' }}>ShagSpeed</code>
              </div>
            </div>
          </figure>
        </div>
      </section>

      <section className="container" id="downloads">
        <window.SectionHead
          eyebrow="Downloads"
          title="Kant-en-klare sjekkie content"
          hint="Één Centrale Plek om de ShagFiles te downloaden."
        />
        <div className="resource-grid" role="list">
          {window.RESOURCE_ITEMS.map((item, i) => (
            <article key={i} className="glass resource-card" role="listitem">
              <span className={`resource-card__badge ${!item.badge ? 'resource-card__badge--empty' : ''}`}>{item.badge || '—'}</span>
              <h3 className="resource-card__title">{item.title}</h3>
              <p className="resource-card__meta">{item.meta}</p>
              <div className="resource-card__actions">
                {item.href ? (
                  <a
                    className="btn btn--outline btn--mini"
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                  >
                    {item.cta}
                  </a>
                ) : (
                  <button className="btn btn--outline btn--mini" onClick={() => onToast('Leeg slot.')}>
                    {item.cta}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="container">
        <window.SectionHead
          eyebrow="ShagFiles Info"
          title="Een selectie van ShagFiles."
          hint="Waarom ShagWekker aan ShagFiles doet."
        />
        <div className="resource-notes">
          {window.RESOURCE_NOTES.map((note, i) => (
            <article key={i} className="resource-note">
              <h3 dangerouslySetInnerHTML={{ __html: note.title }} />
              <p>{note.body}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

// ============ ARCHIEF PAGE — plays actual video files ============
function ArchiefPage() {
  return (
    <div className="page-view" key="archief">
      <section className="container">
        <window.SectionHead
          eyebrow="Videovault"
          title="Hèt Archief"
          hint="Een zorgvuldig opgebouwde collectie van bewegend beeld rondom de ShagWekker legende. Scroll door de lijst om het verleden (en de toekomst) opnieuw te beleven."
        />
        <div className="archive-list">
          {window.ARCHIVE_VIDEOS.map((video, i) => (
            <article key={i} className="glass archive-video">
              <header>
                <h3 className="archive-video__title" dangerouslySetInnerHTML={{ __html: video.title }} />
                <p className="archive-video__desc" dangerouslySetInnerHTML={{ __html: video.description }} />
              </header>
              <video
                className="archive-video__player"
                controls
                preload="metadata"
                src={video.src}
              />
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

Object.assign(window, {
  HomePage, ShagmeterPage, GalleryPage, LibraryPage, ArchiefPage,
});
