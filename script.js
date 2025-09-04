/* ---------- Configuration ---------- */
const DEFAULT_TIMES = ["10:15","12:00","14:30"]; // 24h HH:MM
const STORAGE_KEY = "multiCountdown.times";
const WEEKDAY_COUNTDOWN = { time: "16:00", label: "weekdays" };

/* ---------- Utilities ---------- */
const pad = n => String(n).padStart(2, '0');
const toMinutes = hhmm => { const [h,m] = hhmm.split(":").map(Number); return h*60 + m; };

function parseTimesFromURL(){
  const qs = new URLSearchParams(location.search);
  const raw = qs.get('times');
  if(!raw) return null;
  return raw.split(',').map(s=>s.trim()).filter(v=>/^\d{1,2}:\d{2}$/.test(v));
}

function loadTimes(){
  const fromURL = parseTimesFromURL();
  if(fromURL && fromURL.length) return normalizeTimes(fromURL);
  try{
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)||"null");
    if(Array.isArray(saved) && saved.length) return normalizeTimes(saved);
  }catch{}
  return normalizeTimes(DEFAULT_TIMES);
}

function saveTimes(times){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(times)); }catch{}
}

function normalizeTimes(arr){
  return Array.from(new Set(arr.map(t => t.trim())))
    .filter(v => /^\d{1,2}:\d{2}$/.test(v))
    .map(v => {
      let [h, m] = v.split(':').map(Number);
      h = Math.max(0, Math.min(23, h));
      m = Math.max(0, Math.min(59, m));
      return `${pad(h)}:${pad(m)}`;
    })
    .sort((a, b) => toMinutes(a) - toMinutes(b));
}

function nextOccurrence(now, hhmm){
  const [h,m] = hhmm.split(":").map(Number);
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  if(target <= now) target.setDate(target.getDate()+1);
  return target;
}

function nextWeekdayOccurrence(now, hhmm){
  const [h,m] = hhmm.split(":").map(Number);
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  if(target <= now) target.setDate(target.getDate()+1);
  while(target.getDay() === 0 || target.getDay() === 6){
    target.setDate(target.getDate()+1);
  }
  return target;
}

function diffParts(ms){
  const sec = Math.max(0, Math.floor(ms/1000));
  const d = Math.floor(sec/86400);
  const h = Math.floor((sec%86400)/3600);
  const m = Math.floor((sec%3600)/60);
  const s = sec%60;
  return {d,h,m,s};
}

function formatDiff({d,h,m,s}){
  const core = `${pad(h + d*24)}:${pad(m)}:${pad(s)}`;
  return core;
}

/* ---------- App ---------- */
const cardsEl = document.getElementById('cards');
const clockEl = document.getElementById('clock');
const addForm = document.getElementById('addForm');
const timeInput = document.getElementById('timeInput');
const resetBtn = document.getElementById('resetBtn');
const imgSizeInput = document.getElementById('imgSize');
const logoImage = document.getElementById('logoImage');

let TIMES = loadTimes();

function buildUI(){
  cardsEl.innerHTML = '';
  TIMES.forEach(t => {
    const card = document.createElement('article');
    card.className = 'card';
    card.dataset.time = t;
    card.innerHTML = `
      <div class="when"><span class="time-label">${t}</span> daily</div>
      <div class="count" aria-live="off">--:--:--</div>
    `;
    cardsEl.appendChild(card);
  });

  const wCard = document.createElement('article');
  wCard.className = 'card';
  wCard.dataset.time = WEEKDAY_COUNTDOWN.time;
  wCard.dataset.weekdays = 'true';
  wCard.innerHTML = `
    <div class="when"><span class="time-label">${WEEKDAY_COUNTDOWN.time}</span> ${WEEKDAY_COUNTDOWN.label}</div>
    <div class="count" aria-live="off">--:--:--</div>
  `;
  cardsEl.appendChild(wCard);
}

function update(){
  const now = new Date();
  clockEl.textContent = now.toLocaleTimeString(undefined, {hour12:false});

  let soonest = {ms: Number.POSITIVE_INFINITY, el: null};

  document.querySelectorAll('.card').forEach(card =>{
    const t = card.dataset.time;
    const weekdayOnly = card.dataset.weekdays === 'true';
    const next = weekdayOnly ? nextWeekdayOccurrence(now, t) : nextOccurrence(now, t);
    const remain = next - now;
    const countEl = card.querySelector('.count');

    const parts = diffParts(remain);
    countEl.textContent = formatDiff(parts);

    card.classList.toggle('due', remain <= 1000);
    card.classList.toggle('late', remain < 0);

    if(remain < soonest.ms){ soonest = {ms: remain, el: card}; }
  });

  document.querySelectorAll('.card.next').forEach(el=>el.classList.remove('next'));
  if(soonest.el) soonest.el.classList.add('next');
}

addForm.addEventListener('submit', (e)=>{
  e.preventDefault();
  const v = timeInput.value.trim();
  if(!/^\d{2}:\d{2}$/.test(v)) return;
  const next = normalizeTimes([...TIMES, v]);
  TIMES = next;
  saveTimes(TIMES);
  buildUI();
  update();
  timeInput.value = '';
});

resetBtn.addEventListener('click', ()=>{
  TIMES = normalizeTimes(DEFAULT_TIMES);
  saveTimes(TIMES);
  buildUI();
  update();
});

if(imgSizeInput && logoImage){
  const updateImageSize = () => {
    logoImage.style.width = imgSizeInput.value + 'px';
  };
  imgSizeInput.addEventListener('input', updateImageSize);
  updateImageSize();
}

buildUI();
update();
setInterval(update, 1000);
