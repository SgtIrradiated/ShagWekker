/* global React */
const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ============ Background ============
function AppBackground() {
  return (
    <div className="app-bg" aria-hidden="true">
      <div className="app-bg__orb app-bg__orb--1" />
      <div className="app-bg__orb app-bg__orb--2" />
      <div className="app-bg__orb app-bg__orb--3" />
      <div className="app-bg__grid" />
      <div className="app-bg__noise" />
    </div>
  );
}

// ============ Nav ============
function Nav({ currentPage, onNav, soundOn, onSoundToggle, theme, onThemeToggle, notifyOn, onNotifyToggle, onContrastToggle, contrastOn }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNav = (item, evt) => {
    if (evt) evt.preventDefault();
    setMobileOpen(false);
    onNav(item);
  };

  const items = window.NAV_ITEMS;

  return (
    <div className="nav-wrap">
      <nav className="nav" aria-label="Primary">
        <button className="nav__brand" onClick={() => handleNav({ id: 'home', section: 'hero' })} aria-label="ShagWekker home">
          <span className="nav__brand-mark">
            <img src="assets/shag.png" alt="" />
          </span>
          <span className="nav__brand-name">ShagWekker</span>
        </button>
        <ul className="nav__list">
          {items.map((item, i) => {
            const isActive = currentPage === item.id && (!item.section || (item.section === 'hero' && currentPage === 'home'));
            return (
              <li key={i}>
                <a
                  href="#"
                  className="nav__link"
                  data-active={isActive ? 'true' : 'false'}
                  onClick={(e) => handleNav(item, e)}
                >
                  {item.label}
                </a>
              </li>
            );
          })}
        </ul>
        <div className="nav__actions">
          <button
            className="nav__icon-btn"
            data-on={notifyOn ? 'true' : 'false'}
            onClick={onNotifyToggle}
            title="Notificaties"
            aria-pressed={notifyOn}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" strokeLinecap="round" />
            </svg>
          </button>
          <button
            className="nav__icon-btn"
            onClick={onThemeToggle}
            title={`Theme: ${theme}`}
          >
            {theme === 'light' ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" strokeLinejoin="round" />
              </svg>
            )}
          </button>
          <button
            className="nav__icon-btn"
            data-on={contrastOn ? 'true' : 'false'}
            onClick={onContrastToggle}
            title="High contrast"
            aria-pressed={contrastOn}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 3v18" />
              <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" />
            </svg>
          </button>
        </div>
        <button
          className="nav__toggle"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label="Menu"
          aria-expanded={mobileOpen}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {mobileOpen ? (
              <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" />
            ) : (
              <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </nav>
      <div className="nav__mobile-menu" data-open={mobileOpen ? 'true' : 'false'}>
        <ul>
          {items.map((item, i) => (
            <li key={i}>
              <a href="#" onClick={(e) => handleNav(item, e)}>{item.label}</a>
            </li>
          ))}
        </ul>
        <div className="nav__mobile-divider" />
        <ul>
          <li><a href="#" onClick={(e) => { e.preventDefault(); onNotifyToggle(); setMobileOpen(false); }}>Notificaties {notifyOn ? '✓ aan' : 'uit'}</a></li>
          <li><a href="#" onClick={(e) => { e.preventDefault(); onThemeToggle(); setMobileOpen(false); }}>Thema: {theme}</a></li>
          <li><a href="#" onClick={(e) => { e.preventDefault(); onContrastToggle(); setMobileOpen(false); }}>High contrast {contrastOn ? '✓' : ''}</a></li>
        </ul>
      </div>
    </div>
  );
}

// ============ Toast stack ============
function ToastStack({ toasts }) {
  return (
    <div className="toast-stack" role="region" aria-label="Meldingen" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast">{t.text}</div>
      ))}
    </div>
  );
}

// ============ Footer ============
function Footer() {
  return (
    <footer className="footer container">
      <p>© {new Date().getFullYear()} ShagWekker. Shag kun je helaas niet eten, maar wel lekker roken.</p>
      <a className="footer__back" href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>↑ Back to top</a>
    </footer>
  );
}

// ============ Section header ============
function SectionHead({ eyebrow, title, hint, actions, id }) {
  return (
    <header className="section-head" id={id}>
      <div>
        {eyebrow && <p className="section-head__eyebrow">{eyebrow}</p>}
        {title && <h2>{title}</h2>}
        {hint && <p className="section-head__hint">{hint}</p>}
      </div>
      {actions && <div className="section-head__actions">{actions}</div>}
    </header>
  );
}

// ============ Helpers ============
function pad(n) { return String(n).padStart(2, '0'); }

function timeToMinutes(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function nextOccurrence(cue, now) {
  // returns Date of next occurrence
  const [hh, mm] = cue.time.split(':').map(Number);
  const candidate = new Date(now);
  candidate.setHours(hh, mm, 0, 0);

  const daysAhead = (() => {
    const isWeekend = (d) => d === 0 || d === 6;
    const isWeekday = (d) => d >= 1 && d <= 5;
    for (let i = 0; i < 14; i++) {
      const d = new Date(candidate);
      d.setDate(d.getDate() + i);
      const dow = d.getDay();
      if (i === 0 && d <= now) continue;
      switch (cue.recurrence) {
        case 'Daily': return i;
        case 'Weekdays': if (isWeekday(dow)) return i; break;
        case 'Weekends': if (isWeekend(dow)) return i; break;
        case 'SpecificWeekdays':
          if ((cue.weekdays || []).includes(dow)) return i;
          break;
        default: return i;
      }
    }
    return 0;
  })();

  candidate.setDate(candidate.getDate() + daysAhead);
  return candidate;
}

function formatCountdown(ms) {
  if (ms <= 0) return 'nu';
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}u ${pad(m)}m ${pad(s)}s`;
  if (m > 0) return `${m}m ${pad(s)}s`;
  return `${s}s`;
}

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return typeof initial === 'function' ? initial() : initial;
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }, [key, value]);
  return [value, setValue];
}

// ============ ShagMeter ring ============
function ShagMeterRing({ count, goal }) {
  const pct = Math.min(count / goal, 1);
  const r = 100;
  const c = 2 * Math.PI * r;
  const dash = `${c * pct} ${c}`;
  return (
    <div className="shagmeter__ring">
      <svg viewBox="0 0 240 240">
        <defs>
          <linearGradient id="shagGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--magenta)" />
          </linearGradient>
        </defs>
        <circle className="shagmeter__ring-track" cx="120" cy="120" r={r} />
        <circle
          className="shagmeter__ring-fill"
          cx="120" cy="120" r={r}
          strokeDasharray={dash}
        />
      </svg>
      <div className="shagmeter__ring-center">
        <div>
          <div className="shagmeter__count">{count}</div>
          <div className="shagmeter__count-label">van {goal} Shaggies</div>
        </div>
      </div>
    </div>
  );
}

// ============ Modal ============
function Modal({ open, onClose, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <div className="modal" data-open={open ? 'true' : 'false'} onClick={(e) => { if (e.target.classList.contains('modal')) onClose(); }}>
      <div className="modal__dialog" role="dialog" aria-modal="true">
        <button className="modal__close" type="button" onClick={onClose} aria-label="Sluit">×</button>
        {children}
      </div>
    </div>
  );
}

Object.assign(window, {
  AppBackground, Nav, ToastStack, Footer, SectionHead,
  ShagMeterRing, Modal,
  pad, timeToMinutes, nextOccurrence, formatCountdown,
  useNow, useLocalStorage,
});
