/* ---------- Configuration ---------- */
const DEFAULT_TIMES = ["10:15","12:00","14:30"]; // 24h HH:MM
const USER_STORAGE_KEY = "multiCountdown.userTimes";
const WEEKDAY_COUNTDOWN = { time: "16:00", label: "weekdays" };

/* ---------- Utilities ---------- */
const pad = n => String(n).padStart(2, '0');
const toMinutes = hhmm => { const [h,m] = hhmm.split(":").map(Number); return h*60 + m; };

function loadUserTimes(){
  try{
    const saved = JSON.parse(localStorage.getItem(USER_STORAGE_KEY)||"null");
    if(Array.isArray(saved)) return normalizeTimes(saved);
  }catch{}
  return [];
}

function saveUserTimes(times){
  try{ localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(times)); }catch{}
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
const defaultListEl = document.getElementById('defaultList');
const userCardsEl = document.getElementById('userCards');
const clockEl = document.getElementById('clock');
const addForm = document.getElementById('addForm');
const timeInput = document.getElementById('timeInput');
const resetBtn = document.getElementById('resetBtn');

let USER_TIMES = loadUserTimes();

function buildUI(){
  // default timers
  defaultListEl.innerHTML = '';
  DEFAULT_TIMES.forEach(t => {
    const li = document.createElement('li');
    li.className = 'default-item timer';
    li.dataset.time = t;
    li.innerHTML = `
      <div class="when"><span class="time-label">${t}</span> daily</div>
      <div class="count" aria-live="off">--:--:--</div>
    `;
    defaultListEl.appendChild(li);
  });

  const wLi = document.createElement('li');
  wLi.className = 'default-item timer';
  wLi.dataset.time = WEEKDAY_COUNTDOWN.time;
  wLi.dataset.weekdays = 'true';
  wLi.innerHTML = `
    <div class="when"><span class="time-label">${WEEKDAY_COUNTDOWN.time}</span> ${WEEKDAY_COUNTDOWN.label}</div>
    <div class="count" aria-live="off">--:--:--</div>
  `;
  defaultListEl.appendChild(wLi);

  // user timers
  userCardsEl.innerHTML = '';
  USER_TIMES.forEach(t => {
    const card = document.createElement('article');
    card.className = 'card user-card timer';
    card.dataset.time = t;
    card.innerHTML = `
      <div class="when"><span class="time-label">${t}</span> daily</div>
      <div class="count" aria-live="off">--:--:--</div>
    `;
    userCardsEl.appendChild(card);
  });
}

function update(){
  const now = new Date();
  clockEl.textContent = now.toLocaleTimeString(undefined, {hour12:false});

  let soonest = {ms: Number.POSITIVE_INFINITY, el: null};

  document.querySelectorAll('.timer').forEach(item =>{
    const t = item.dataset.time;
    const weekdayOnly = item.dataset.weekdays === 'true';
    const next = weekdayOnly ? nextWeekdayOccurrence(now, t) : nextOccurrence(now, t);
    const remain = next - now;
    const countEl = item.querySelector('.count');

    const parts = diffParts(remain);
    countEl.textContent = formatDiff(parts);

    item.classList.toggle('due', remain <= 1000);
    item.classList.toggle('late', remain < 0);

    if(remain < soonest.ms){ soonest = {ms: remain, el: item}; }
  });

  document.querySelectorAll('.timer.next').forEach(el=>el.classList.remove('next'));
  if(soonest.el) soonest.el.classList.add('next');
}

addForm.addEventListener('submit', (e)=>{
  e.preventDefault();
  const v = timeInput.value.trim();
  if(!/^\d{2}:\d{2}$/.test(v)) return;
  const next = normalizeTimes([...USER_TIMES, v]);
  USER_TIMES = next;
  saveUserTimes(USER_TIMES);
  buildUI();
  update();
  timeInput.value = '';
});

resetBtn.addEventListener('click', ()=>{
  USER_TIMES = [];
  saveUserTimes(USER_TIMES);
  buildUI();
  update();
});

buildUI();
update();
setInterval(update, 1000);
