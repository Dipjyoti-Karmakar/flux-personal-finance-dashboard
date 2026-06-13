
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithRedirect, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, initializeFirestore, persistentLocalCache, collection, doc, setDoc, deleteDoc, onSnapshot, writeBatch, query, where, deleteField, orderBy, limit, serverTimestamp, getDocs, addDoc, runTransaction } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const CICO={food:'🍜',transport:'🚗',housing:'🏠',entertainment:'🎮',health:'💊',shopping:'🛍',utilities:'⚡',utility:'⚡',occasions:'🎉',salary:'💼',freelance:'💻',investment:'📈',stationery:'📝',other:'✦'};
const CAT_COLOR = {
  food:          '#c8876e',  // warm terracotta
  transport:     '#6e9dc8',  // steel blue
  housing:       '#8dc86e',  // leaf green
  entertainment: '#c86e9d',  // magenta
  health:        '#6ec8b8',  // teal
  shopping:      '#c8a96e',  // gold
  utilities:     '#f6d365',  // amber
  utility:       '#f6d365',  // legacy alias
  occasions:     '#9d6ec8',  // violet
  salary:        '#5dba8a',  // income green
  freelance:     '#30cfd0',  // cyan
  investment:    '#b490ca',  // lavender
  stationery:    '#8fa828',  // olive
  other:         '#7a8099',  // muted slate
};
function getCatColor(cat) { return CAT_COLOR[cat] || CAT_COLOR.other; }
const MN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MF=['January','February','March','April','May','June','July','August','September','October','November','December'];

const TX_PAGE_SIZE = 20;
const TX_TODAY_SIZE = 5;
let txVisibleCount = 5;
let txs = [];
let events = {};
let cType='income', cMode='online';
let theme=localStorage.getItem('flux_theme')||'dark';
let statsMode='month'; 

let cDtFilt = 'today';
let cTyFilt = 'all';
let cModeFilt = 'all';
let cEventFilt = 'all';
let cTxSearch = '';
let cLogSearch = '';
let lastCatList = null;

let rawImportRows = [];
let importHeaders = [];
let headerRowIdx = 0;
let pend = [];
let currentMap = { date: -1, amount: -1, income: -1, expense: -1, desc: -1, type: -1, mode: -1, cat: -1 };
let impFilt = 'all';

let editingTxId = null;
let confirmActionCallback = null;

let userId = null;
let unsubscribeFirestore = null;
let unsubscribeEvents = null;
let unsubscribeActivityLog = null;
let unsubscribeRecurring = null;
let eventsUseFallback = false;
let activityLogs = [];
let recurringList = [];
let editingRecurringId = null;
let currentRecType = 'expense';
let currentRecFreq = 'monthly';
let reportPeriodMode = 'month';
let trendAbort = null;
let trendMode = 'expense'; // 'expense' | 'income' | 'both'
let activeCatFilter = null;       // Currently selected category key or null
let catTxVisibleCount = 20;       // Paginated count for category drill-down
const CAT_TX_PAGE_SIZE = 20;      // Page size for category transaction list
let _undoTimer = null;
let _undoTxData = null;
let _undoClearLogsTimer = null;
let _undoClearLogsData = null;

const firebaseConfig = {
  apiKey: "AIzaSyD9sEai-TSuIHDuv6zL-3utgdBBfb3FN4k",
  authDomain: "my-ledger-8f8b5.firebaseapp.com",
  projectId: "my-ledger-8f8b5",
  storageBucket: "my-ledger-8f8b5.firebasestorage.app",
  messagingSenderId: "796158024233",
  appId: "1:796158024233:web:fd8dc9b325ebc14f069a38",
  measurementId: "G-E2TG7M6ZGK"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, {
  localCache: persistentLocalCache()
});
const provider = new GoogleAuthProvider();

document.addEventListener('DOMContentLoaded', () => {
  apTheme(theme);
  document.getElementById('txDt').value = getTodayStr();
  
  // Auto-rollover date at midnight if left on "today"
  let _lastToday = getTodayStr();
  setInterval(() => {
    const _now = getTodayStr();
    if (_now !== _lastToday) {
      const dtEl = document.getElementById('txDt');
      if (dtEl && dtEl.value === _lastToday) dtEl.value = _now;
      _lastToday = _now;
    }
  }, 60000);

  render();
  initScrollTop();
  initSwipeActions();
  initParallax();
  initAutocomplete();
});

function showConfirm(title, msg, actionFn, isDestructive = true) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMsg').textContent = msg;
    const btn = document.getElementById('confirmActionBtn');
    
    if (isDestructive) {
        btn.style.background = 'var(--ex)';
        btn.style.borderColor = 'var(--ex)';
        btn.style.color = '#fff';
    } else {
        btn.style.background = 'var(--ac)';
        btn.style.borderColor = 'var(--ac)';
        btn.style.color = '#0d0f14';
    }
    
    confirmActionCallback = actionFn;
    document.getElementById('confirmMod').classList.add('op');
}

function closeConfirm() {
    document.getElementById('confirmMod').classList.remove('op');
    confirmActionCallback = null;
}

document.getElementById('confirmActionBtn').addEventListener('click', () => {
    if (confirmActionCallback) confirmActionCallback();
    closeConfirm();
});

async function toggleAuth() {
  if (userId) {
    try {
      await signOut(auth);
    } catch (e) {
      console.error(e);
      showToast("Sign out failed", "er");
    }
  } else {
    try {
      await signInWithRedirect(auth, provider);
    } catch (e) {
      console.error(e);
      showToast("Login failed", "er");
    }
  }
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    userId = user.uid;
    if (unsubscribeFirestore) unsubscribeFirestore();
    if (unsubscribeEvents) unsubscribeEvents();
    if (unsubscribeActivityLog) unsubscribeActivityLog();
    document.getElementById('authBtn').innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg> Sign Out`;
    loadDataFromCloud();
    loadEvents();
    loadActivityLog();
    loadRecurring();
    // Clear stale localStorage activity log (migrated to Firestore)
    try { localStorage.removeItem('flux_activity_log'); } catch(_) {}
    showSkeletons();
  } else {
    userId = null;
    txs = [];
    events = {};
    if(unsubscribeFirestore) unsubscribeFirestore();
    if(unsubscribeEvents) unsubscribeEvents();
    if(unsubscribeActivityLog) unsubscribeActivityLog();
    if(unsubscribeRecurring) unsubscribeRecurring();
    activityLogs = [];
    recurringList = [];
    
    document.getElementById('authBtn').innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg> Sign In`;
    
    const dot = document.getElementById('cloudDot');
    dot.className = 'sync-dot offline';
    const text = document.getElementById('cloudText');
    text.textContent = 'Sync: Offline';
    text.style.color = 'var(--mu)';
    
    render(); 
  }
});

function loadDataFromCloud() {
  if (!userId) return;
  // Show loading spinner while initial sync is in progress
  const dot = document.getElementById('cloudDot');
  dot.className = 'sync-dot';
  dot.style.background = 'var(--ac)';
  dot.style.boxShadow = '0 0 8px var(--ac)';
  dot.style.animation = 'syncPulse 1s ease-in-out infinite';
  const text = document.getElementById('cloudText');
  text.textContent = 'Syncing…';
  text.style.color = 'var(--ac)';

  const colRef = collection(db, 'users', userId, 'transactions');
  
  unsubscribeFirestore = onSnapshot(colRef, (snapshot) => {
    const loadedTxs = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (typeof data.date === 'string' && data.date && typeof data.amount === 'number' && isFinite(data.amount) && data.amount > 0) {
        // V7: Use clean object to prevent prototype pollution (delete __proto__ is a no-op)
        const clean = Object.assign(Object.create(null), data);
        loadedTxs.push({ id: doc.id, ...clean });
      }
    });
    txs = loadedTxs.sort((a,b) => new Date(b.date) - new Date(a.date));
    // Exclude tx pending soft-delete during undo window
    if (_undoTxData) txs = txs.filter(t => t.id !== _undoTxData.id);
    
    const dot = document.getElementById('cloudDot');
    dot.className = 'sync-dot online';
    dot.style.background = ''; dot.style.boxShadow = ''; dot.style.animation = '';
    const text = document.getElementById('cloudText');
    text.textContent = 'Sync: Completed';
    text.style.color = 'var(--tx)';
    
    debouncedRender();
  }, (err) => {
    console.error("Cloud sync error:", err);
    const dot = document.getElementById('cloudDot');
    dot.className = 'sync-dot offline';
    dot.style.background = ''; dot.style.boxShadow = ''; dot.style.animation = '';
    const text = document.getElementById('cloudText');
    text.textContent = 'Sync: Offline';
    text.style.color = 'var(--ex)';
    showToast('Failed to sync. Check internet or permissions.', 'er');
  });
}

function apTheme(t, evt){
  function commit(){
    theme=t;
    document.documentElement.setAttribute('data-theme',t);
    const label = t==='dark'?'Dark':'Light';
    document.querySelectorAll('.thlbl').forEach(el => el.textContent = label);
    localStorage.setItem('flux_theme',t);
    renderTrend();
  }
  // Circular wipe animation when triggered by a click
  if(evt && evt.currentTarget){
    const r = evt.currentTarget.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const ov = document.createElement('div');
    ov.className = 'theme-wipe';
    ov.style.background = t === 'dark' ? '#0d0f14' : '#e9e7e2';
    ov.style.setProperty('--cx', cx + 'px');
    ov.style.setProperty('--cy', cy + 'px');
    document.body.appendChild(ov);
    requestAnimationFrame(() => requestAnimationFrame(() => ov.classList.add('expand')));
    setTimeout(() => { commit(); setTimeout(() => ov.remove(), 120); }, 500);
  } else {
    commit();
  }
}

const toggles = ['#thtog_desktop'];
toggles.forEach(id => {
  const el = document.querySelector(id);
  if(el) el.addEventListener('click',(e)=>apTheme(theme==='dark'?'light':'dark', e));
});

function updStatsDt() { if (statsMode === 'custom') { activeCatFilter = null; catTxVisibleCount = CAT_TX_PAGE_SIZE; renderStats(); renderTrend(); renderCats(); renderSplit(); } }
function clearStatsDt() { document.getElementById('statsFrom').value = ''; document.getElementById('statsTo').value = ''; updStatsDt(); }

function setStatsMode(m) {
  statsMode = m;
  activeCatFilter = null; // reset category drill-down on filter change
  catTxVisibleCount = CAT_TX_PAGE_SIZE;
  document.getElementById('stM_month').classList.toggle('act', m === 'month');
  document.getElementById('stM_yr').classList.toggle('act', m === 'year');
  document.getElementById('stM_all').classList.toggle('act', m === 'all');
  document.getElementById('stM_custom').classList.toggle('act', m === 'custom');
  const cdw = document.getElementById('statsCustomDt');
  cdw.classList.toggle('vis', m === 'custom');
  renderStats();
  renderTrend();
  renderCats();
  renderSplit();
}

function setType(t){cType=t;document.getElementById('bInc').className='tb'+(t==='income'?' ai':'');document.getElementById('bExp').className='tb'+(t==='expense'?' ae':'');document.getElementById('txC').innerHTML=t==='income'?'<option value="salary">💼 Salary</option><option value="freelance">💻 Freelance</option><option value="investment">📈 Investment</option><option value="other">✶ Other</option>':'<option value="food">🍜 Food</option><option value="transport">🚗 Transport</option><option value="housing">🏠 Housing</option><option value="entertainment">🎮 Entertainment</option><option value="health">💊 Health</option><option value="shopping">🛍 Shopping</option><option value="utilities">⚡ Utilities</option><option value="occasions">🎉 Occasions</option><option value="stationery">📝 Stationery</option><option value="other">✶ Other</option>';}
function setMode(m){cMode=m;document.getElementById('bOnl').className='tb'+(m==='online'?' ao':'');document.getElementById('bOfl').className='tb'+(m==='offline'?' af':'');}

function setDt(filterVal, btn) {
  cDtFilt = filterVal;
  txVisibleCount = (filterVal === 'today') ? TX_TODAY_SIZE : TX_PAGE_SIZE;
  document.querySelectorAll('.ft.dt-flt').forEach(b => b.classList.remove('act'));
  btn.classList.add('act');
  
  const wrap = document.getElementById('customDtWrap');
  if(filterVal === 'custom') {
    wrap.style.display = 'flex';
  } else {
    wrap.style.display = 'none';
  }
  
  renderTxList();
}

function updCustomDt() {
  if(cDtFilt === 'custom') renderTxList();
}

function clearCustomDt() {
    document.getElementById('cDtFrom').value = '';
    document.getElementById('cDtTo').value = '';
    updCustomDt();
}

function setF(filterVal, btn) {
  cTyFilt = filterVal;
  txVisibleCount = (cDtFilt === 'today' && cModeFilt !== 'event') ? TX_TODAY_SIZE : TX_PAGE_SIZE;
  document.querySelectorAll('.ft.ty-flt').forEach(b => b.classList.remove('act'));
  btn.classList.add('act');
  renderTxList();
}

function setModeFilt(filterVal, btn) {
  cModeFilt = filterVal;
  txVisibleCount = (cDtFilt === 'today' && filterVal !== 'event' && filterVal !== 'subscription') ? TX_TODAY_SIZE : TX_PAGE_SIZE;
  document.querySelectorAll('.ft.mode-flt').forEach(b => b.classList.remove('act'));
  btn.classList.add('act');
  const evtWrap = document.getElementById('eventTxFilterWrap');
  if (evtWrap) evtWrap.style.display = filterVal === 'event' ? 'block' : 'none';
  // Toggle tx panel height expansion for event mode
  const txPanel = document.getElementById('txPanel');
  const catAreaWrap = document.getElementById('catAreaWrap');
  if (txPanel) txPanel.classList.toggle('tx-event-expand', filterVal === 'event');
  if (catAreaWrap) catAreaWrap.classList.toggle('tx-event-expand', filterVal === 'event');
  const dtBtns = document.querySelectorAll('.ft.dt-flt');
  const customWrap = document.getElementById('customDtWrap');
  if (filterVal === 'event') {
    dtBtns.forEach(b => { b.style.opacity = '0.35'; b.style.pointerEvents = 'none'; });
    if (customWrap) customWrap.style.display = 'none';
  } else {
    dtBtns.forEach(b => { b.style.opacity = ''; b.style.pointerEvents = ''; });
    if (customWrap && cDtFilt === 'custom') customWrap.style.display = 'flex';
  }
  renderTxList();
}

function setEventFilter(eventId) {
  cEventFilt = eventId || 'all';
  txVisibleCount = TX_PAGE_SIZE;
  if (cModeFilt === 'event') renderTxList();
}

const MAX_AMOUNT = 900000000000000; // 900 Trillion

async function addTx() {
  const desc = document.getElementById('txD').value.trim();
  const amt = parseFloat(document.getElementById('txA').value);
  const cat = document.getElementById('txC').value;
  const date = document.getElementById('txDt').value;
  
  if(!desc) return shake('txD');
  // FIXED: Explicitly guard against NaN (empty/text input), Infinity, negative, and excessive amounts
  if(isNaN(amt) || !isFinite(amt) || amt <= 0 || amt > MAX_AMOUNT) return shake('txA');
  if(!date) return shake('txDt');
  
  if (!userId) {
     showToast('Please Sign In to save transactions', 'er');
     return;
  }

  const eventId = document.getElementById('txEvent').value || '';
  const newTx = { type: cType, mode: cMode, desc, amount: amt, cat, date };
  if (eventId) newTx.eventId = eventId;
  const txId = uid();
  
  const btn = document.querySelector('.fb2 .sbtn');
  try {
    const docRef = doc(db, 'users', userId, 'transactions', txId);
    await setDoc(docRef, newTx);
    
    document.getElementById('txD').value = '';
    document.getElementById('txA').value = '';
    document.getElementById('txDt').value = getTodayStr();
    
    // Button checkmark animation
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = '✓ Added';
      btn.classList.add('success-flash');
      setTimeout(() => { btn.textContent = orig; btn.classList.remove('success-flash'); }, 1200);
    }
    
    // Mark the new TX for highlight after next render
    window._highlightTxId = txId;
    
    // Log the addition
    writeLog('ADD', `Added <strong>"${esc(desc)}"</strong> — ${fmt(amt)}, ${cat||'other'}, ${fmtDt(date)}, ${cMode}`, cType);

    showToast('Transaction added', 'ok');
    // Confetti on milestones: 1st, 10th, 25th, every 50th
    const mc = txs.length + 1;
    if (mc === 1 || mc === 10 || mc === 25 || mc % 50 === 0) launchConfetti();
  } catch(e) {
    console.error("Error adding transaction", e);
    showToast('Error saving to cloud.', 'er');
  }
}

function uid() { 
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2); 
}
function shake(id){const el=document.getElementById(id);el.style.borderColor='var(--ex)';el.animate([{transform:'translateX(-4px)'},{transform:'translateX(4px)'},{transform:'translateX(-3px)'},{transform:'translateX(0)'}],{duration:280});setTimeout(()=>{el.style.borderColor='';},600);}

function askDelTx(id) {
    showConfirm(
        'Delete Transaction',
        'Are you sure? You will have 5 seconds to undo after confirming.',
        () => executeSoftDelete(id),
        true
    );
}

function executeSoftDelete(id) {
    // V5+: If there's already a pending delete, commit it before overwriting
    // FIXED: Clear timer FIRST to prevent the old timer callback from double-committing
    if (_undoTxData) {
      if (_undoTimer) { clearTimeout(_undoTimer); _undoTimer = null; }
      commitDelete(_undoTxData.id);
      _undoTxData = null;
    }
    
    // Find the transaction data for undo
    const txData = txs.find(t => t.id === id);
    if (!txData) return;
    // Animate out
    const el = document.getElementById('tx-' + id);
    if (el) {
      const wrap = el.closest('.txi-wrap') || el;
      Object.assign(wrap.style, { transition: 'opacity .18s,transform .18s', opacity: '0', transform: 'translateX(-8px)' });
    }
    // Store for undo — FIXED: only include eventId in undo payload if it existed,
    // avoids writing eventId:'' to Firestore for transactions that never had one.
    const undoData = { type: txData.type, mode: txData.mode, desc: txData.desc, amount: txData.amount, cat: txData.cat, date: txData.date };
    // V10: Only include _imp if it was explicitly true
    if (txData._imp) undoData._imp = true;
    if (txData.eventId) undoData.eventId = txData.eventId;
    _undoTxData = { id, data: undoData };
    // Remove from local array immediately for responsive feel
    txs = txs.filter(t => t.id !== id);
    render();
    // Show undo toast with 5-second recovery window
    showUndoToast(id);
}

function showUndoToast(txId) {
  if (_undoTimer) clearTimeout(_undoTimer);
  const el = document.getElementById('toast');
  el.innerHTML = 'Transaction deleted <button class="undo-btn" onclick="undoDelete()">↩ Undo</button>';
  el.className = 'tst er sh';
  clearTimeout(el._t);
  _undoTimer = setTimeout(() => {
    commitDelete(txId);
    el.className = 'tst';
    _undoTxData = null;
  }, 5000);
}

async function commitDelete(id) {
  // Capture the undo data before it potentially gets cleared by the timeout synchronously
  const logData = (_undoTxData && _undoTxData.id === id) ? _undoTxData.data : null;
  
  // Log deletion synchronously to ensure it's captured immediately when the undo window expires
  if (logData) {
    writeLog('DELETE', `Deleted <strong>"${esc(logData.desc)}"</strong> — ${fmt(logData.amount)}, ${logData.cat||'other'}, ${fmtDt(logData.date)}, ${logData.mode}`, logData.type);
  }
  
  if (!userId) return;
  
  try {
    await deleteDoc(doc(db, 'users', userId, 'transactions', id));
  } catch(e) {
    console.error('Error deleting', e);
    showToast('Error deleting from cloud', 'er');
  }
}

async function undoDelete() {
  if (!_undoTxData || !userId) return;
  const { id, data } = _undoTxData;
  if (_undoTimer) { clearTimeout(_undoTimer); _undoTimer = null; }
  const el = document.getElementById('toast');
  el.className = 'tst';
  try {
    await setDoc(doc(db, 'users', userId, 'transactions', id), data);
    showToast('Transaction restored', 'ok');
  } catch(e) {
    console.error('Undo failed', e);
    showToast('Failed to restore transaction', 'er');
  }
  _undoTxData = null;
}

// FIXED: No longer suppresses ALL toasts during the undo window — only suppresses
// neutral/success toasts. Error toasts always show so users see sync failures.
function showToast(msg,type){if(_undoTimer && type !== 'er')return;const el=document.getElementById('toast');el.textContent=msg;el.className='tst '+(type||'')+' sh';clearTimeout(el._t);el._t=setTimeout(()=>{el.className='tst';},2800);}
function fmt(n){return (n < 0 ? '-' : '') + '₹'+Math.abs(n).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});}
function fmtS(n){return '₹'+Math.abs(n).toLocaleString('en-IN',{maximumFractionDigits:0});}
function fmtDt(d){return new Date(d+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'2-digit'});}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}

function getLegibleColor(c) {
  if (!/^#[0-9a-fA-F]{3,8}$/.test(c)) return '#c8a96e';
  let hex = c.replace(/^#/, '');
  if(hex.length === 3) hex = hex.split('').map(x=>x+x).join('');
  let r = parseInt(hex.substring(0,2), 16), g = parseInt(hex.substring(2,4), 16), b = parseInt(hex.substring(4,6), 16);
  let lum = (0.299*r + 0.587*g + 0.114*b) / 255;
  if (theme === 'dark' && lum < 0.45) {
    const mix = (0.45 - lum) / (1 - lum);
    r = r + (255 - r) * mix; g = g + (255 - g) * mix; b = b + (255 - b) * mix;
  } else if (theme === 'light' && lum > 0.55) {
    const mix = (lum - 0.55) / lum;
    r = r * (1 - mix); g = g * (1 - mix); b = b * (1 - mix);
  }
  return '#' + [r,g,b].map(x => Math.round(x).toString(16).padStart(2,'0')).join('');
}

function getTodayStr() {
  const now = new Date();
  return new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 10);
}

function getActiveTxs() {
  const now = new Date();
  const localISO = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString();
  
  if (statsMode === 'month') {
    const prefix = localISO.slice(0, 7); 
    return txs.filter(t => t.date.startsWith(prefix));
  }
  if (statsMode === 'year') {
    const cY = now.getFullYear();
    return txs.filter(t => new Date(t.date+'T00:00:00').getFullYear() === cY);
  }
  if (statsMode === 'custom') {
    const from = document.getElementById('statsFrom').value;
    const to = document.getElementById('statsTo').value;
    let list = txs;
    if (from) list = list.filter(t => t.date >= from);
    if (to) list = list.filter(t => t.date <= to);
    return list;
  }
  return txs; // 'all'
}

function render(){
  // I2 FIX: Compute active transactions once and pass to all sub-renderers
  const aTxs = getActiveTxs();
  renderStats(aTxs);
  renderTxList();
  renderSplit(aTxs);
  renderTrend(aTxs);
  renderYearly();
  renderEvents();
  renderInsights();
  if (typeof twemoji !== 'undefined') {
    // Only re-parse dynamic content areas — never the entire body (too expensive)
    ['txList','ctArea','spArea','insightList','yrArea','subList','logList','eventList'].forEach(id => {
      const el = document.getElementById(id);
      if (el) twemoji.parse(el);
    });
  }
}

// Debounced render - coalesces rapid Firestore snapshot fires (e.g. during batch imports)
let _renderTimer = null;
function debouncedRender() {
  if (_renderTimer) clearTimeout(_renderTimer);
  _renderTimer = setTimeout(() => { 
    _renderTimer = null; 
    render(); 
    tagPastSubscriptions();
  }, 120);
}

async function tagPastSubscriptions() {
  if (!userId || !recurringList || !recurringList.length || !txs || !txs.length) return;
  const toTag = [];
  txs.forEach(tx => {
    if (tx._recurring) return;
    const matchingRec = recurringList.find(rec => {
      if (!rec.name || !tx.desc) return false;
      if (rec.name.trim().toLowerCase() !== tx.desc.trim().toLowerCase()) return false;
      if (Math.abs(rec.amount || 0) !== Math.abs(tx.amount || 0)) return false;
      if (rec.type !== tx.type) return false;
      
      // We removed the strict date matching. If the Name, Amount, and Type match perfectly,
      // it is safely considered the same subscription. This fixes issues where billing days
      // fluctuate due to weekends, shorter months, or manual entry differences.
      return true;
    });
    if (matchingRec) toTag.push(tx.id);
  });
  
  if (!toTag.length) return;
  
  try {
    for (let i = 0; i < toTag.length; i += 450) {
      const chunk = toTag.slice(i, i + 450);
      const batch = writeBatch(db);
      chunk.forEach(id => batch.update(doc(db, 'users', userId, 'transactions', id), { _recurring: true }));
      await batch.commit();
    }
    showToast(`Auto-tagged ${toTag.length} past subscriptions!`, 'ok');
    console.log(`Auto-tagged ${toTag.length} past transactions as subscriptions.`);
  } catch(e) { console.error('Failed to auto-tag past subscriptions:', e); }
}

// ─── Animated number counter ────────────────────────────────────────────────
// Counts from the current displayed value to the new target.
// Uses page-load-relative timing so the counter always starts exactly when the
// last .card-in card becomes fully visible to the user (~4000ms after load).
// Per-element cancellation prevents overlapping rAF loops when re-renders fire
// in rapid succession (e.g. Firestore batch imports, fast filter switching).
const _pageLoadTime = performance.now();
// App entrance animation: 3.3s delay + last card-in delay (0.18s) + card-in duration (0.5s) ≈ 4000ms
const CARDS_VISIBLE_AT_MS = 4000;

function animateVal(el, target, formatter, duration) {
  if (!el) return;
  duration = duration || 1400; // snappy but smooth

  // Parse current displayed value, stripping currency symbols and separators
  const cur = parseFloat(String(el.textContent).replace(/[^0-9.\-]/g, '')) || 0;
  if (cur === target) { el.textContent = formatter(target); return; }

  // Cancel any in-progress animation on this element
  if (el._animCancel) { el._animCancel(); el._animCancel = null; }

  let cancelled = false;
  const cancelFn = () => { cancelled = true; };
  el._animCancel = cancelFn;

  // Compute how long to wait before starting the count-up.
  // If data arrives before the cards are visible we wait; if after, we start immediately.
  const elapsed = performance.now() - _pageLoadTime;
  const delay = Math.max(0, CARDS_VISIBLE_AT_MS - elapsed);

  setTimeout(() => {
    if (cancelled) return;
    const start = performance.now();
    const diff = target - cur;
    function tick(now) {
      if (cancelled) return;
      const progress = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 4); // ease-out quartic
      el.textContent = formatter(cur + diff * ease);
      if (progress < 1) requestAnimationFrame(tick);
      else if (el._animCancel === cancelFn) el._animCancel = null; // done — clean up
    }
    requestAnimationFrame(tick);
  }, delay);
}



function renderStats(sTxs){
  if (!sTxs) sTxs = getActiveTxs();

  const inc=sTxs.filter(t=>t.type==='income'),exp=sTxs.filter(t=>t.type==='expense');
  const tI=inc.reduce((s,t)=>s+t.amount,0),tE=exp.reduce((s,t)=>s+t.amount,0),bal=tI-tE;
  
  const bel=document.getElementById('sBal');
  // Pass signed balance to animation loop, but apply absolute value before formatting
  animateVal(bel, bal, (v) => fmt(Math.abs(v)));
  bel.className='sv big '+(bal>0?'pos':bal<0?'neg':'neu');
  document.getElementById('sBalSub').textContent=bal>=0?'↑ In the green':'↓ Overspent';
  
  // Update balance card glow
  const bc=document.getElementById('balCard');
  bc.classList.remove('glow-pos','glow-neg','glow-neu');
  bc.classList.add(bal>0?'glow-pos':bal<0?'glow-neg':'glow-neu');
  
  animateVal(document.getElementById('sInc'), tI, fmt);
  document.getElementById('sIncS').textContent=inc.length+' transaction'+(inc.length!==1?'s':'');
  
  animateVal(document.getElementById('sExp'), tE, fmt);
  document.getElementById('sExpS').textContent=exp.length+' transaction'+(exp.length!==1?'s':'');
  
  // Calculate true elapsed days based on the current date filter
  let elapsedDays = 1;
  const now = new Date();
  const todayStr = getTodayStr();
  const todayDate = new Date(todayStr + 'T00:00:00');

  let avgNumerator = tE;

  if (statsMode === 'month') {
    elapsedDays = now.getDate();
  } else if (statsMode === 'year') {
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    elapsedDays = Math.max(1, Math.floor((todayDate - startOfYear) / 86400000) + 1);
  } else if (statsMode === 'all' && sTxs.length > 0) {
    const dates = sTxs.map(t => t.date).sort();
    const firstDt = new Date(dates[0] + 'T00:00:00');
    elapsedDays = Math.max(1, Math.floor((todayDate - firstDt) / 86400000) + 1);
  } else if (statsMode === 'custom' && sTxs.length > 0) {
    const from = document.getElementById('statsFrom').value;
    const to = document.getElementById('statsTo').value;
    const dates = sTxs.map(t => t.date).sort();
    const firstDt = new Date((from || dates[0]) + 'T00:00:00');
    // If 'to' is not provided, use today's date or the last transaction date, whichever is smaller, to prevent future txs from inflating elapsed days
    const lastDt = new Date((to || (dates[dates.length-1] > todayStr ? todayStr : dates[dates.length-1])) + 'T00:00:00');
    elapsedDays = Math.max(1, Math.floor((lastDt - firstDt) / 86400000) + 1);
  }

  animateVal(document.getElementById('sAvg'), elapsedDays > 0 ? avgNumerator / elapsedDays : 0, fmtS);

  const aDays=new Set(sTxs.map(t=>t.date)).size;
  animateVal(document.getElementById('sDays'), aDays, v=>Math.round(v).toString());
}

function renderTxList(){
  const el=document.getElementById('txList');
  let list=txs;
  
  // Power the 'By Category' summary using ONLY the date filters
  let catList = txs;
  const now = new Date();
  const todayISO = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0,10);
  if (cDtFilt === 'today') {
    catList = catList.filter(t => t.date === todayISO);
  } else if (cDtFilt === 'month') {
    const monthPrefix = todayISO.slice(0,7);
    catList = catList.filter(t => t.date.startsWith(monthPrefix));
  } else if (cDtFilt === 'year') {
    const yearPrefix = todayISO.slice(0,4);
    catList = catList.filter(t => t.date.startsWith(yearPrefix));
  } else if (cDtFilt === 'custom') {
    const fromDt = document.getElementById('cDtFrom').value;
    const toDt = document.getElementById('cDtTo').value;
    if (fromDt || toDt) {
      if(fromDt) catList = catList.filter(t => t.date >= fromDt);
      if(toDt) catList = catList.filter(t => t.date <= toDt);
    }
  }
  lastCatList = catList;
  renderCats(catList);
  
  
  // When mode filter is "Event", filter by event (date filters skipped for event view)
  const isEventFilter = (cModeFilt === 'event');
  let activeEvent = null;

  if (isEventFilter) {
    list = list.filter(t => !!t.eventId);
    if (cEventFilt !== 'all') {
      list = list.filter(t => t.eventId === cEventFilt);
      activeEvent = events[cEventFilt] || null;
    }
  } else {
    const now = new Date();
    const todayISO = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0,10);
    if (cDtFilt === 'today') {
      list = list.filter(t => t.date === todayISO);
    } else if (cDtFilt === 'month') {
      const monthPrefix = todayISO.slice(0,7);
      list = list.filter(t => t.date.startsWith(monthPrefix));
    } else if (cDtFilt === 'year') {
      const yearPrefix = todayISO.slice(0,4);
      list = list.filter(t => t.date.startsWith(yearPrefix));
    } else if (cDtFilt === 'custom') {
      const fromDt = document.getElementById('cDtFrom').value;
      const toDt = document.getElementById('cDtTo').value;
      if (fromDt || toDt) {
          if(fromDt) list = list.filter(t => t.date >= fromDt);
          if(toDt) list = list.filter(t => t.date <= toDt);
      }
    }
  }

  // Type: All Types / Income / Expense
  if (cTyFilt === 'income') list = list.filter(t => t.type === 'income');
  else if (cTyFilt === 'expense') list = list.filter(t => t.type === 'expense');

  // Mode: All / Online / Offline / Subscription / Event (event already applied above when isEventFilter)
  if (!isEventFilter) {
    if (cModeFilt === 'online') list = list.filter(t => t.mode === 'online');
    else if (cModeFilt === 'offline') list = list.filter(t => t.mode !== 'online');
    else if (cModeFilt === 'subscription') list = list.filter(t => !!t._recurring);
  }

  // Apply text search filter
  if (cTxSearch) {
    const q = cTxSearch.toLowerCase();
    list = list.filter(t => t.desc.toLowerCase().includes(q));
  }

  document.getElementById('txCnt').textContent = list.length;

  // Compute totals for all date filters (today, month, all, custom) and event/type/mode filters
  const showTotals = true;
  let filtIncome = 0, filtExpense = 0;
  if (showTotals) {
    list.forEach(t => {
      if (t.type === 'income') filtIncome += t.amount;
      else filtExpense += t.amount;
    });
  }

  if(!list.length){
    el.innerHTML='<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-title">No matching transactions</div><div class="empty-sub">Try adjusting your filters or search query</div></div>';
    return;
  }
  
  const renderList = list.slice(0, txVisibleCount);
  const hasMore = list.length > txVisibleCount;
  const remaining = list.length - txVisibleCount;
  
  // V1: Ensure event colors are safe hex strings and highly legible
  const safeColor = getLegibleColor;
  
  let html = renderList.map(tx=>{
    let evtBadge = '';
    let evtBorder = '';
    if (tx.eventId && events[tx.eventId]) {
      const sColor = safeColor(events[tx.eventId].color);
      evtBadge = `<span class="event-badge" style="background:${sColor}22;color:${sColor};border:1px solid ${sColor}44;">${esc(events[tx.eventId].name)}</span>`;
      evtBorder = `border-left:3px solid ${sColor};`;
    }
    // FIXED: Sanitize type/mode before injecting into class attributes to prevent
    // malformed data from Firestore or imports from breaking the HTML structure.
    const safeType = (tx.type === 'income' || tx.type === 'expense') ? tx.type : 'expense';
    const safeMode = (tx.mode === 'online' || tx.mode === 'offline') ? tx.mode : 'offline';
    return `
    <div class="txi-wrap" data-txid="${esc(tx.id)}">
      <div class="txi-actions act-left"><button class="txi-act" onclick="editTx('${esc(tx.id)}')">\u270F\uFE0F Edit</button></div>
      <div class="txi-actions act-right"><button class="txi-act" onclick="askDelTx('${esc(tx.id)}')">\uD83D\uDDD1 Delete</button></div>
      <div class="txi${tx.eventId && events[tx.eventId] ? ' tx-event' : ''}" id="tx-${tx.id}" style="${evtBorder}">
      <div class="dot ${safeType}"></div>
      <div class="ti">
        <div class="tn">${esc(tx.desc)}</div>
        <div class="tm">
          <span class="bg ct" data-cat="${tx.cat||'other'}">${CICO[tx.cat]||'✦'} ${tx.cat||'other'}</span>
          <span class="bg ${safeMode==='online'?'on':'of'}">${safeMode==='online'?'⚡ online':'🏪 offline'}</span>
          ${tx._recurring ? '<span class="bg" style="background:rgba(157,122,200,0.18);color:var(--of);border:1px solid rgba(157,122,200,0.35);font-weight:600;">subscription</span>' : ''}
          ${evtBadge}
          ${tx._imp?'<span class="bg ip">xlsx</span>':''}
          <span>${fmtDt(tx.date)}</span>
        </div>
      </div>
      <span class="ta ${safeType}">${fmt(tx.amount)}</span>
      <div style="display:flex;gap:4px;margin-left:8px">
        <button class="td" onclick="editTx('${esc(tx.id)}')" title="Edit" aria-label="Edit transaction: ${esc(tx.desc)}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </button>
        <button class="td" onclick="askDelTx('${esc(tx.id)}')" title="Delete" aria-label="Delete transaction: ${esc(tx.desc)}">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>
      </div>
    </div></div>`;
  }).join('');
    
  if (hasMore) {
    html += `<div style="text-align:center;padding:16px;"><button class="sbtn" onclick="loadMoreTx()" style="background:var(--s2);color:var(--ac);border:1px solid var(--ac);font-size:11px;padding:10px 16px;">▼ Load ${Math.min(TX_PAGE_SIZE, remaining)} More (${remaining} remaining)</button></div>`;
  }

  // Prepend totals bar for event / custom range / all dates
  if (showTotals && list.length) {
    const net = filtIncome - filtExpense;
    let evtHeader = '';
    if (isEventFilter && activeEvent) {
      const sColor = safeColor(activeEvent.color);
      evtHeader = `<div style="display:flex;align-items:center;gap:10px;width:100%;margin-bottom:8px;">
        <div style="width:4px;height:28px;border-radius:2px;background:${sColor};flex-shrink:0;"></div>
        <span style="font-family:'DM Mono',monospace;font-size:13px;font-weight:600;color:var(--tx);">${esc(activeEvent.name)}</span>
        <span style="font-family:'DM Mono',monospace;font-size:11px;color:var(--mu);margin-left:auto;">${activeEvent.start || '?'} → ${activeEvent.end || '?'}</span>
      </div>`;
    }

    let savRateHtml = '';
    if ((isEventFilter || cDtFilt !== 'today') && filtIncome > 0) {
      const savRate = Math.round((net / filtIncome) * 100);
      savRateHtml = `
        <div style="width:1px;height:20px;background:var(--bd);"></div>
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-family:'DM Mono',monospace;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--mu);font-weight:600;">Savings Rate</span>
          <span style="font-family:'DM Mono',monospace;font-size:14px;font-weight:600;color:${savRate >= 0 ? 'var(--in)' : 'var(--ex)'};">${savRate > 0 ? '+' : ''}${savRate}%</span>
        </div>
      `;
    }

    html = `<div style="position:sticky;top:-12px;z-index:10;margin:-12px -14px 12px -14px;padding:14px 18px;background:var(--s2);border-bottom:1px solid var(--bd);">
      ${evtHeader}
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-family:'DM Mono',monospace;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--mu);font-weight:600;">Income</span>
          <span style="font-family:'DM Mono',monospace;font-size:14px;font-weight:600;color:var(--in);">${fmt(filtIncome)}</span>
        </div>
        <div style="width:1px;height:20px;background:var(--bd);"></div>
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-family:'DM Mono',monospace;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--mu);font-weight:600;">Expense</span>
          <span style="font-family:'DM Mono',monospace;font-size:14px;font-weight:600;color:var(--ex);">${fmt(filtExpense)}</span>
        </div>
        <div style="width:1px;height:20px;background:var(--bd);"></div>
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-family:'DM Mono',monospace;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--mu);font-weight:600;">Net</span>
          <span style="font-family:'DM Mono',monospace;font-size:14px;font-weight:600;color:${net >= 0 ? 'var(--in)' : 'var(--ex)'};">${fmt(Math.abs(net))}</span>
        </div>
        ${savRateHtml}
      </div>
    </div>` + html;
  }
  
  el.innerHTML = html;

  // Highlight newly added transaction — skip if edit modal is open (would cause visual overlap)
  if (window._highlightTxId && !document.getElementById('editMod').classList.contains('op')) {
    const hEl = document.getElementById('tx-' + window._highlightTxId);
    if (hEl) hEl.classList.add('tx-new');
    window._highlightTxId = null;
  }
}

function updECat(type) {
  const el = document.getElementById('eCat');
  el.innerHTML = type === 'income' ? 
    '<option value="salary">💼 Salary</option><option value="freelance">💻 Freelance</option><option value="investment">📈 Investment</option><option value="other">✦ Other</option>' : 
    '<option value="food">🍜 Food</option><option value="transport">🚗 Transport</option><option value="housing">🏠 Housing</option><option value="entertainment">🎮 Entertainment</option><option value="health">💊 Health</option><option value="shopping">🛍 Shopping</option><option value="utilities">⚡ Utilities</option><option value="occasions">🎉 Occasions</option><option value="stationery">📝 Stationery</option><option value="other">✦ Other</option>';
}

function editTx(id) {
  const tx = txs.find(t => t.id === id);
  if(!tx) return;
  editingTxId = id;
  window._highlightTxId = null; // clear any pending new-tx highlight to avoid visual overlap
  
  // Store before snapshot for diffing
  window._editSnapshot = { ...tx };

  document.getElementById('eTy').value = tx.type;
  updECat(tx.type); 
  document.getElementById('eCat').value = tx.cat;
  document.getElementById('eMo').value = tx.mode;
  document.getElementById('eDesc').value = tx.desc;
  document.getElementById('eAmt').value = tx.amount;
  document.getElementById('eDt').value = tx.date;
  
  populateEventSelects();
  document.getElementById('eEvent').value = tx.eventId || '';
  
  document.getElementById('editMod').classList.add('op');
}

function closeEditMod() {
  document.getElementById('editMod').classList.remove('op');
  editingTxId = null;
}

async function saveEditTx() {
  if(!editingTxId || !userId) return;
  
  const desc = document.getElementById('eDesc').value.trim();
  const amt = parseFloat(document.getElementById('eAmt').value);
  const cat = document.getElementById('eCat').value;
  const date = document.getElementById('eDt').value;
  const type = document.getElementById('eTy').value;
  const mode = document.getElementById('eMo').value;

  if(!desc) return shake('eDesc');
  // FIXED: Same NaN/Infinity guard as addTx — parseFloat("") gives NaN (!NaN=true passes
  // incorrectly), and parseFloat("1e500") gives Infinity (> 0 passes incorrectly).
  // V13: Also guard against excessive amounts.
  if(isNaN(amt) || !isFinite(amt) || amt <= 0 || amt > MAX_AMOUNT) return shake('eAmt');
  if(!date) return shake('eDt');

  const eventId = document.getElementById('eEvent').value || '';
  // FIXED: When the user clears the event selection, we must remove the eventId field
  // from Firestore entirely (using deleteField) rather than writing eventId:''. 
  // Writing '' with merge:true would leave a dirty field on all edited transactions.
  const updatedTx = { desc, amount: amt, cat, date, type, mode,
    eventId: eventId ? eventId : deleteField() };
  
  try {
    const docRef = doc(db, 'users', userId, 'transactions', editingTxId);
    await setDoc(docRef, updatedTx, { merge: true });
    
    // Generate diff for logging
    if (window._editSnapshot) {
       const b = window._editSnapshot;
       let diffs = [];
       if (b.desc !== desc) diffs.push(`desc <span class="log-change log-from">"${esc(b.desc)}"</span><span class="log-arrow">→</span><span class="log-change log-to">"${esc(desc)}"</span>`);
       if (b.amount !== amt) diffs.push(`amount <span class="log-change log-from">${fmt(b.amount)}</span><span class="log-arrow">→</span><span class="log-change log-to">${fmt(amt)}</span>`);
       if (b.cat !== cat) diffs.push(`cat <span class="log-change log-from">${b.cat||'other'}</span><span class="log-arrow">→</span><span class="log-change log-to">${cat||'other'}</span>`);
       if (b.date !== date) diffs.push(`date <span class="log-change log-from">${fmtDt(b.date)}</span><span class="log-arrow">→</span><span class="log-change log-to">${fmtDt(date)}</span>`);
       if (b.mode !== mode) diffs.push(`mode <span class="log-change log-from">${b.mode}</span><span class="log-arrow">→</span><span class="log-change log-to">${mode}</span>`);
       if (b.type !== type) diffs.push(`type <span class="log-change log-from">${b.type}</span><span class="log-arrow">→</span><span class="log-change log-to">${type}</span>`);
       
       if (diffs.length > 0) {
         writeLog('EDIT', `Edited <strong>"${esc(b.desc)}"</strong>: ${diffs.join(', ')}`);
       }
    }

    closeEditMod();
    showToast('Transaction updated', 'ok');
  } catch(e) {
    console.error("Error updating", e);
    showToast("Error updating cloud", "er");
  }
}

document.getElementById('editMod').addEventListener('click', function(e) { if(e.target === this) closeEditMod(); });

// Global Escape key handler for all modals
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (document.getElementById('confirmMod').classList.contains('op')) { closeConfirm(); return; }
  if (document.getElementById('eventMod').classList.contains('op')) { closeEventMod(); return; }
  if (document.getElementById('editMod').classList.contains('op')) { closeEditMod(); return; }
  if (document.getElementById('impMod').classList.contains('op')) { closeMod(); return; }
});

// Focus trap for open modals - keeps Tab/Shift+Tab inside the active modal
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;
  const modals = ['confirmMod', 'eventMod', 'editMod', 'impMod'];
  let activeModal = null;
  for (const id of modals) {
    const el = document.getElementById(id);
    if (el && el.classList.contains('op')) { activeModal = el; break; }
  }
  if (!activeModal) return;
  const focusable = activeModal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (!focusable.length) return;
  const first = focusable[0], last = focusable[focusable.length - 1];
  if (e.shiftKey) {
    if (document.activeElement === first) { e.preventDefault(); last.focus(); }
  } else {
    if (document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

function setTrendMode(m) {
  trendMode = m;
  document.getElementById('ttExp').classList.toggle('act', m === 'expense');
  document.getElementById('ttInc').classList.toggle('act', m === 'income');
  document.getElementById('ttBoth').classList.toggle('act', m === 'both');
  renderTrend();
}

function renderTrend(passedTxs) {
  if (trendAbort) trendAbort.abort();
  trendAbort = new AbortController();
  const signal = trendAbort.signal;
  document.getElementById('trendTip').classList.remove('sh');
  const aTxs = passedTxs || getActiveTxs();
  const showExp = trendMode === 'expense' || trendMode === 'both';
  const showInc = trendMode === 'income' || trendMode === 'both';
  const exp = showExp ? aTxs.filter(t => t.type === 'expense') : [];
  const inc = showInc ? aTxs.filter(t => t.type === 'income') : [];
  const area = document.getElementById('trendArea');
  if(!exp.length && !inc.length){ area.setAttribute('aria-label','No trend data available'); area.innerHTML='<div class="empty-state"><div class="empty-icon">📈</div><div class="empty-title">No data for this view</div><div class="empty-sub">Add transactions to see your trend visualized here</div></div>'; return; }

  const expGroups = {}, incGroups = {};
  const isMonth = statsMode === 'month';
  const isYear = statsMode === 'year';

  exp.forEach(t => { const key = isMonth ? t.date : t.date.slice(0, 7); expGroups[key] = (expGroups[key] || 0) + t.amount; });
  inc.forEach(t => { const key = isMonth ? t.date : t.date.slice(0, 7); incGroups[key] = (incGroups[key] || 0) + t.amount; });

  // Merge all keys from both datasets
  const allGroups = {};
  Object.keys(expGroups).forEach(k => { allGroups[k] = true; });
  Object.keys(incGroups).forEach(k => { allGroups[k] = true; });

  const now = new Date();
  
  if (isMonth) {
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
      for (let d = 1; d <= lastDay; d++) {
          let k = `${y}-${m}-${String(d).padStart(2, '0')}`;
          allGroups[k] = true;
      }
  } else if (isYear) {
      const y = now.getFullYear();
      for (let m = 1; m <= 12; m++) {
          let k = `${y}-${String(m).padStart(2, '0')}`;
          allGroups[k] = true;
      }
  } else {
      // I6 FIX: Merged identical gap-filling for 'all' and 'custom' modes
      let keys = Object.keys(allGroups).sort();
      if (keys.length > 1) {
          let [sY, sM] = keys[0].split('-').map(Number);
          let [eY, eM] = keys[keys.length - 1].split('-').map(Number);
          let curY = sY, curM = sM;
          while (curY < eY || (curY === eY && curM <= eM)) {
              let k = `${curY}-${String(curM).padStart(2, '0')}`;
              allGroups[k] = true;
              curM++; if (curM > 12) { curM = 1; curY++; }
          }
      }
  }

  let keys = Object.keys(allGroups).sort();
  let expVals = keys.map(k => expGroups[k] || 0);
  let incVals = keys.map(k => incGroups[k] || 0);
  
  let fmtL = d => isMonth 
      ? parseInt(d.split('-')[2]) + ' ' + MN[parseInt(d.split('-')[1])-1] 
      : MN[parseInt(d.split('-')[1])-1] + " '" + d.slice(2,4);

  // Accessibility summary
  let ariaDesc = '';
  if (showExp && expVals.length > 1) {
    const eTotal = expVals.reduce((a,b) => a+b, 0);
    const eFirst = expVals.find(v => v > 0) || 0;
    const eLast = [...expVals].reverse().find(v => v > 0) || 0;
    if (eFirst > 0) {
      const pctChange = Math.round(((eLast - eFirst) / eFirst) * 100);
      ariaDesc += `Expenses ${pctChange >= 0 ? 'up' : 'down'} ${Math.abs(pctChange)}% over period, total ${fmtS(eTotal)}. `;
    }
  }
  if (showInc && incVals.length > 1) {
    const iTotal = incVals.reduce((a,b) => a+b, 0);
    const iFirst = incVals.find(v => v > 0) || 0;
    const iLast = [...incVals].reverse().find(v => v > 0) || 0;
    if (iFirst > 0) {
      const pctChange = Math.round(((iLast - iFirst) / iFirst) * 100);
      ariaDesc += `Income ${pctChange >= 0 ? 'up' : 'down'} ${Math.abs(pctChange)}% over period, total ${fmtS(iTotal)}.`;
    }
  }
  area.setAttribute('aria-label', ariaDesc || 'Trend chart with data');

  area.innerHTML = '<div style="position:relative; width:100%; height:100%; flex:1;"><canvas id="trendC" style="position:absolute; inset:0; width:100%; height:100%; touch-action:none;"></canvas></div>';
  const cv = document.getElementById('trendC');
  const tip = document.getElementById('trendTip');
  
  const rect = cv.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  cv.width = rect.width * dpr;
  cv.height = rect.height * dpr;
  
  const ctx = cv.getContext('2d');
  ctx.scale(dpr, dpr);
  
  const w = rect.width, h = rect.height;
  const px = 15, pyT = 20, pyB = 25;
  const gW = w - px*2, gH = h - pyT - pyB;
  const max = Math.max(...(showExp ? expVals : []), ...(showInc ? incVals : []), 1);

  const makePts = (vArr) => keys.map((k, i) => ({
      x: keys.length === 1 ? w/2 : px + (i / (keys.length - 1)) * gW,
      y: pyT + gH - (vArr[i] / max) * gH,
      val: vArr[i],
      label: fmtL(k)
  }));
  const ePts = showExp ? makePts(expVals) : [];
  const iPts = showInc ? makePts(incVals) : [];

  // Drawing helper for one line series
  const drawSeries = (pts, color, glowColor, gradTop, gradMid, highlightIdx) => {
      if (!pts.length) return;
      if (pts.length === 1) {
          ctx.beginPath(); ctx.moveTo(px, pts[0].y); ctx.lineTo(w-px, pts[0].y);
          ctx.strokeStyle = color; ctx.lineWidth = 2.5;
          ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]);
          ctx.beginPath(); ctx.moveTo(px, pts[0].y); ctx.lineTo(w-px, pts[0].y);
          ctx.strokeStyle = glowColor; ctx.lineWidth = 8; ctx.stroke();
          ctx.beginPath(); ctx.arc(w/2, pts[0].y, 5, 0, 2*Math.PI);
          ctx.fillStyle = color; ctx.fill();
          ctx.lineWidth = 2; ctx.strokeStyle = theme === 'dark' ? '#13161e' : '#fff'; ctx.stroke();
          return;
      }
      // Area fill
      ctx.beginPath();
      pts.forEach((p, i) => { if(i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
      ctx.lineTo(pts[pts.length-1].x, pyT + gH); ctx.lineTo(pts[0].x, pyT + gH); ctx.closePath();
      const grad = ctx.createLinearGradient(0, pyT, 0, h - pyB);
      grad.addColorStop(0, gradTop); grad.addColorStop(0.6, gradMid); grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad; ctx.fill();
      // Line glow
      ctx.beginPath(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      pts.forEach((p, i) => { if(i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
      ctx.strokeStyle = glowColor; ctx.lineWidth = 10; ctx.stroke();
      // Main line
      ctx.beginPath(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      pts.forEach((p, i) => { if(i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
      const lineGrad = ctx.createLinearGradient(pts[0].x, 0, pts[pts.length-1].x, 0);
      // FIXED: The previous approach tried to convert a hex color to rgba using string
      // replace(), which silently failed on hex strings like '#e07070'. Now we use
      // globalAlpha on a cloned path for the faded start effect instead.
      lineGrad.addColorStop(0, color); lineGrad.addColorStop(0.3, color); lineGrad.addColorStop(1, color);
      ctx.strokeStyle = lineGrad; ctx.lineWidth = 2.5; ctx.globalAlpha = 1; ctx.stroke();
      // Dots
      pts.forEach((p, i) => {
          const isHL = (highlightIdx === i); const hasVal = p.val > 0;
          if (hasVal || isHL) {
              const r = isHL ? 5 : 3; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 2 * Math.PI);
              ctx.fillStyle = isHL ? color : (theme === 'dark' ? glowColor : color);
              ctx.fill();
              if (isHL || pts.length <= 12) { ctx.lineWidth = 2; ctx.strokeStyle = theme === 'dark' ? '#13161e' : '#fff'; ctx.stroke(); }
          }
      });
  };

  const expColor = '#e07070', incColor = '#5dba8a';

  const drawBase = (highlightIdx) => {
      ctx.clearRect(0,0,w,h);
      ctx.font = '11px DM Mono';
      const gridColor = theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';
      for (let g = 0; g <= 4; g++) { const gy = pyT + (gH / 4) * g; ctx.beginPath(); ctx.moveTo(px, gy); ctx.lineTo(w - px, gy); ctx.strokeStyle = gridColor; ctx.lineWidth = 1; ctx.stroke(); }
      // Max label
      ctx.fillStyle = theme === 'dark' ? 'rgba(200,169,110,0.4)' : 'rgba(120,100,60,0.4)'; ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.font = '10px DM Mono'; ctx.fillText(fmtS(max), w - px, pyT + 3); ctx.font = '11px DM Mono';

      // Draw expense series
      if (showExp) drawSeries(ePts, expColor,
        theme === 'dark' ? 'rgba(224,112,112,0.18)' : 'rgba(179,48,48,0.12)',
        theme === 'dark' ? 'rgba(224,112,112,0.25)' : 'rgba(179,48,48,0.18)',
        theme === 'dark' ? 'rgba(224,112,112,0.08)' : 'rgba(179,48,48,0.06)',
        highlightIdx);
      // Draw income series
      if (showInc) drawSeries(iPts, incColor,
        theme === 'dark' ? 'rgba(93,186,138,0.18)' : 'rgba(40,140,90,0.12)',
        theme === 'dark' ? 'rgba(93,186,138,0.25)' : 'rgba(40,140,90,0.18)',
        theme === 'dark' ? 'rgba(93,186,138,0.08)' : 'rgba(40,140,90,0.06)',
        highlightIdx);

      // Crosshair
      const refPts = ePts.length ? ePts : iPts;
      if (highlightIdx !== undefined && highlightIdx >= 0 && refPts[highlightIdx]) {
          const hp = refPts[highlightIdx];
          ctx.beginPath(); ctx.moveTo(hp.x, pyT); ctx.lineTo(hp.x, pyT + gH);
          ctx.strokeStyle = theme === 'dark' ? 'rgba(200,169,110,0.15)' : 'rgba(100,80,40,0.1)';
          ctx.lineWidth = 1; ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]);
      }

      // Legend in both mode
      if (trendMode === 'both') {
          ctx.font = '10px DM Mono'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
          ctx.fillStyle = expColor; ctx.fillRect(px, pyT - 14, 8, 8); ctx.fillText(' Expense', px + 10, pyT - 15);
          const ew = ctx.measureText(' Expense').width;
          ctx.fillStyle = incColor; ctx.fillRect(px + 18 + ew, pyT - 14, 8, 8); ctx.fillText(' Income', px + 28 + ew, pyT - 15);
      }

      // X-axis labels
      const refP = refPts.length ? refPts : [];
      if (refP.length < 2) return;
      ctx.fillStyle = theme === 'dark' ? '#7a8099' : '#6d7283'; ctx.textBaseline = 'top'; ctx.font = '11px DM Mono';
      const maxLabels = 5, skip = Math.max(1, Math.ceil(refP.length / maxLabels));
      const firstLbl = refP[0].label, lastLbl = refP[refP.length - 1].label;
      const firstLblW = ctx.measureText(firstLbl).width, lastLblW = ctx.measureText(lastLbl).width;
      const firstLblEnd = refP[0].x + firstLblW + 12, lastLblStart = refP[refP.length - 1].x - lastLblW - 12;
      let lastDrawnX = -Infinity;
      for (let i = 0; i < refP.length; i++) {
          if (i === 0) { ctx.textAlign = 'left'; ctx.fillText(firstLbl, refP[i].x, h - pyB + 6); lastDrawnX = refP[i].x + firstLblW; }
          else if (i === refP.length - 1) { if (lastLblStart > lastDrawnX + 8) { ctx.textAlign = 'right'; ctx.fillText(lastLbl, refP[i].x, h - pyB + 6); } }
          else if (i % skip === 0) { const lW = ctx.measureText(refP[i].label).width, lL = refP[i].x - lW/2, lR = refP[i].x + lW/2; if (lL > firstLblEnd && lR < lastLblStart && lL > lastDrawnX + 8) { ctx.textAlign = 'center'; ctx.fillText(refP[i].label, refP[i].x, h - pyB + 6); lastDrawnX = lR; } }
      }
  };

  drawBase(); 

  const refPts = ePts.length ? ePts : iPts;
  if(refPts.length > 1) {
      const handleMove = (e) => {
          if (e.cancelable) e.preventDefault(); 
          const currentRect = cv.getBoundingClientRect();
          let cx = e.clientX;
          if (e.touches && e.touches.length > 0) cx = e.touches[0].clientX;
          const mx = cx - currentRect.left; 
          let closestIdx = 0, minDist = Math.abs(mx - refPts[0].x);
          for(let i=1; i<refPts.length; i++) { const dist = Math.abs(mx - refPts[i].x); if(dist < minDist) { minDist = dist; closestIdx = i; } }

          drawBase(closestIdx);

          // Build tooltip with both values when in both mode
          let tipHTML = `<div>${refPts[closestIdx].label}</div>`;
          if (showExp && ePts[closestIdx]) tipHTML += `<div class="val" style="color:${expColor}">Exp: ${fmt(ePts[closestIdx].val)}</div>`;
          if (showInc && iPts[closestIdx]) tipHTML += `<div class="val" style="color:${incColor}">Inc: ${fmt(iPts[closestIdx].val)}</div>`;
          tip.innerHTML = tipHTML;
          let displayX = currentRect.left + refPts[closestIdx].x;
          let displayY = currentRect.top + refPts[closestIdx].y - 10;
          tip.style.left = '0px'; tip.style.top = '0px'; tip.classList.add('sh');
          const tipRect = tip.getBoundingClientRect();
          const tipW = tipRect.width, tipH = tipRect.height;
          displayX = Math.max(tipW / 2 + 8, Math.min(displayX, window.innerWidth - tipW / 2 - 8));
          if (displayY - tipH < 8) displayY = currentRect.top + refPts[closestIdx].y + tipH + 14;
          tip.style.left = displayX + 'px'; tip.style.top = displayY + 'px';
      };

      const handleLeave = () => { drawBase(); tip.classList.remove('sh'); };

      cv.addEventListener('mousemove', handleMove, { signal });
      cv.addEventListener('touchstart', handleMove, { passive: false, signal });
      cv.addEventListener('touchmove', handleMove, { passive: false, signal });
      cv.addEventListener('mouseleave', handleLeave, { signal });
      cv.addEventListener('touchend', handleLeave, { signal });
  }
}

window.addEventListener('resize', () => {
    if(window._resizeT) clearTimeout(window._resizeT);
    window._resizeT = setTimeout(() => { renderTrend(); }, 200);
});

function renderCats(passedTxs){
  const aTxs = passedTxs || lastCatList || getActiveTxs();
  const exp=aTxs.filter(t=>t.type==='expense'),area=document.getElementById('ctArea');
  if(!exp.length){activeCatFilter=null;area.innerHTML='<div class="empty-state"><div class="empty-icon">📂</div><div class="empty-title">No data yet</div><div class="empty-sub">Your expense categories will appear here once you start tracking</div></div>';return;}
  const tot={};
  let totalExp=0;
  exp.forEach(t=>{tot[t.cat||'other']=(tot[t.cat||'other']||0)+t.amount;totalExp+=t.amount;});
  const cats=Object.entries(tot).sort((a,b)=>b[1]-a[1]);
  // If the active filter no longer exists in the data, close it
  if(activeCatFilter && !tot[activeCatFilter]) activeCatFilter=null;
  let barHtml='<div style="display:flex;height:12px;border-radius:6px;overflow:hidden;gap:2px;margin-bottom:12px;">';
  cats.forEach(([cat,val],i)=>{const pct=(val/totalExp)*100;barHtml+=`<div style="width:${pct}%;background:${getCatColor(cat)};transition:width .5s cubic-bezier(0.16,1,0.3,1);" title="${cat}: ${pct.toFixed(1)}%"></div>`;});
  barHtml+='</div>';
  let detHtml=`<div class="cat-tag-list${activeCatFilter?' is-extended':''}">`;
  cats.forEach(([cat,val],i)=>{
    const pct=Math.round((val/totalExp)*100);
    const isActive=activeCatFilter===cat;
    detHtml+=`<div class="cat-tag${isActive?' cat-tag-active':''}" onclick="toggleCatFilter('${esc(cat)}')"><div style="width:10px;height:10px;border-radius:3px;background:${getCatColor(cat)};"></div><span class="cat-tag-name">${CICO[cat]||'✦'} ${cat}</span><span class="cat-tag-amt">${fmtS(val)}</span><span class="cat-tag-pct">${pct}%</span><span class="cat-arrow">▼</span></div>`;
  });
  detHtml+='</div>';
  if (activeCatFilter) {
    detHtml+='<div class="cat-tx-panel cat-tx-open" id="catTxPanel"></div>';
  }
  area.innerHTML=barHtml+detHtml;
  if(activeCatFilter) renderCatTxList(aTxs);
}

function toggleCatFilter(cat) {
  if (activeCatFilter === cat) {
    activeCatFilter = null;
  } else {
    activeCatFilter = cat;
    catTxVisibleCount = CAT_TX_PAGE_SIZE;
  }
  renderCats();
}

function renderCatTxList(passedTxs) {
  const panel = document.getElementById('catTxPanel');
  if (!panel || !activeCatFilter) return;
  const aTxs = passedTxs || lastCatList || getActiveTxs();
  const list = aTxs.filter(t => t.type === 'expense' && (t.cat || 'other') === activeCatFilter)
    .sort((a,b) => new Date(b.date) - new Date(a.date));
  const totalAmt = list.reduce((s,t) => s+t.amount, 0);
  const renderList = list.slice(0, catTxVisibleCount);
  const hasMore = list.length > catTxVisibleCount;
  const remaining = list.length - catTxVisibleCount;

  let txHtml = '';
  if (!list.length) {
    txHtml = '<div class="empty-state" style="padding:24px 16px"><div class="empty-icon" style="font-size:28px">🔍</div><div class="empty-title">No transactions</div><div class="empty-sub">No expense transactions in this category for the selected period</div></div>';
  } else {
    txHtml = renderList.map(tx => {
      let evtBadge = '';
      let evtBorder = '';
      if (tx.eventId && events[tx.eventId]) {
        const sColor = getLegibleColor(events[tx.eventId].color);
        evtBadge = `<span class="event-badge" style="background:${sColor}22;color:${sColor};border:1px solid ${sColor}44;">${esc(events[tx.eventId].name)}</span>`;
        evtBorder = `border-left:3px solid ${sColor};`;
      }
      const safeType = (tx.type === 'income' || tx.type === 'expense') ? tx.type : 'expense';
      const safeMode = (tx.mode === 'online' || tx.mode === 'offline') ? tx.mode : 'offline';
      return `
      <div class="txi-wrap" data-txid="${esc(tx.id)}">
        <div class="txi-actions act-left"><button class="txi-act" onclick="editTx('${esc(tx.id)}')">✏️ Edit</button></div>
        <div class="txi-actions act-right"><button class="txi-act" onclick="askDelTx('${esc(tx.id)}')">🗑 Delete</button></div>
        <div class="txi${tx.eventId && events[tx.eventId] ? ' tx-event' : ''}" id="cat-tx-${tx.id}" style="${evtBorder}">
        <div class="dot ${safeType}"></div>
        <div class="ti">
          <div class="tn">${esc(tx.desc)}</div>
          <div class="tm">
            <span class="bg ${safeMode==='online'?'on':'of'}">${safeMode==='online'?'⚡ online':'🏪 offline'}</span>
            ${evtBadge}
            ${tx._imp?'<span class="bg ip">xlsx</span>':''}
            <span>${fmtDt(tx.date)}</span>
          </div>
        </div>
        <span class="ta ${safeType}">${fmt(tx.amount)}</span>
        <div style="display:flex;gap:4px;margin-left:8px">
          <button class="td" onclick="editTx('${esc(tx.id)}')" title="Edit" aria-label="Edit transaction: ${esc(tx.desc)}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button class="td" onclick="askDelTx('${esc(tx.id)}')" title="Delete" aria-label="Delete transaction: ${esc(tx.desc)}">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div></div>`;
    }).join('');
    if (hasMore) {
      txHtml += `<div style="text-align:center;padding:12px;"><button class="sbtn" onclick="loadMoreCatTx()" style="background:var(--s2);color:var(--ac);border:1px solid var(--ac);font-size:11px;padding:10px 16px;">▼ Load ${Math.min(CAT_TX_PAGE_SIZE, remaining)} More (${remaining} remaining)</button></div>`;
    }
  }

  panel.innerHTML = `<div class="cat-tx-inner">
    <div class="cat-tx-hdr">
      <div class="cat-tx-hdr-info">
        <span class="cat-tx-hdr-name">${CICO[activeCatFilter]||'✦'} ${activeCatFilter}</span>
        <div class="cat-tx-hdr-stats">
          <span class="cat-tx-hdr-amt">${fmt(totalAmt)}</span>
          <span class="cat-tx-hdr-cnt">${list.length} transaction${list.length!==1?'s':''}</span>
        </div>
      </div>
      <button class="cat-tx-close" onclick="closeCatPanel()" title="Close" aria-label="Close category transactions">×</button>
    </div>
    <div class="cat-tx-list" id="catTxListInner">${txHtml}</div>
  </div>`;
  // Attach swipe actions to the category tx list
  attachSwipeToContainer(document.getElementById('catTxListInner'));
}

function loadMoreCatTx() {
  catTxVisibleCount += CAT_TX_PAGE_SIZE;
  renderCatTxList();
}

function closeCatPanel() {
  activeCatFilter = null;
  renderCats();
}

function renderSplit(passedTxs){
  const exp=(passedTxs || getActiveTxs()).filter(t=>t.type==='expense'),area=document.getElementById('spArea');
  if(!exp.length){area.innerHTML='<div class="empty-state"><div class="empty-icon">⚡</div><div class="empty-title">No expense data</div><div class="empty-sub">Online vs offline breakdown will show once you have expenses</div></div>';return;}
  const onl=exp.filter(t=>t.mode==='online'),ofl=exp.filter(t=>t.mode!=='online');
  const oA=onl.reduce((s,t)=>s+t.amount,0),fA=ofl.reduce((s,t)=>s+t.amount,0),tot=oA+fA;
  const op=tot>0?(oA/tot*100).toFixed(1):0,fp=tot>0?(fA/tot*100).toFixed(1):0;
  // FIXED: Use Set size with a minimum of 1 to prevent division by zero / Infinity avg/day
  const onlDays=Math.max(1,new Set(onl.map(t=>t.date)).size);
  const oflDays=Math.max(1,new Set(ofl.map(t=>t.date)).size);
  area.innerHTML=`<div class="spw"><div class="spb"><div class="sps" style="width:${op}%;background:var(--on)"></div><div class="sps" style="width:${fp}%;background:var(--of)"></div></div><div class="spl"><span class="splb" style="color:var(--on)">⚡ Online ${op}%</span><span class="splb" style="color:var(--of)">🏪 Offline ${fp}%</span></div></div><div class="spcs"><div class="spc"><div class="spcl" style="color:var(--on)">Online</div><div class="spcv" style="color:var(--on)">${fmt(oA)}</div><div class="spcs2">${onl.length} transactions</div><div class="spcs2">${onl.length>0?fmtS(oA/onlDays)+' avg/day':'—'}</div></div><div class="spc"><div class="spcl" style="color:var(--of)">Offline</div><div class="spcv" style="color:var(--of)">${fmt(fA)}</div><div class="spcs2">${ofl.length} transactions</div><div class="spcs2">${ofl.length>0?fmtS(fA/oflDays)+' avg/day':'—'}</div></div></div>`;
}

// ── Month-over-Month Insights (max 8, high-impact) ──
function renderInsights() {
  const area = document.getElementById('insightList');
  const periodEl = document.getElementById('insightPeriod');
  if (!area) return;
  const now = new Date();
  const cY = now.getFullYear(), cM = now.getMonth(), cD = now.getDate();
  const curPrefix = `${cY}-${String(cM + 1).padStart(2, '0')}`;
  const pDate = new Date(cY, cM - 1, 1);
  const pY = pDate.getFullYear(), pM = pDate.getMonth();
  const prevPrefix = `${pY}-${String(pM + 1).padStart(2, '0')}`;
  const daysInMonth = new Date(cY, cM + 1, 0).getDate();
  if (periodEl) periodEl.textContent = `${MF[cM]} ${cY}`;
  const curTxs = txs.filter(t => t.date.startsWith(curPrefix));
  const prevTxs = txs.filter(t => t.date.startsWith(prevPrefix));
  if (!curTxs.length && !prevTxs.length) { area.innerHTML = '<div class="insight-empty">Add transactions to see insights</div>'; return; }
  const insights = [];
  let curInc = 0, curExp = 0, prevInc = 0, prevExp = 0;
  const curCats = {}, prevCats = {}, curDayExp = {};
  const curExpDays = new Set();
  curTxs.forEach(t => { if (t.type === 'income') curInc += t.amount; else { curExp += t.amount; const c = t.cat || 'other'; curCats[c] = (curCats[c] || 0) + t.amount; curDayExp[t.date] = (curDayExp[t.date] || 0) + t.amount; curExpDays.add(t.date); } });
  prevTxs.forEach(t => { if (t.type === 'income') prevInc += t.amount; else { prevExp += t.amount; const c = t.cat || 'other'; prevCats[c] = (prevCats[c] || 0) + t.amount; } });
  const curSav = curInc - curExp, prevSav = prevInc - prevExp;
  const todayISO = getTodayStr();

  // 1. Budget pacing with daily burn rate
  const pastExp = curTxs.filter(t => t.type === 'expense' && t.date <= todayISO).reduce((s, t) => s + t.amount, 0);
  if (cD > 2 && pastExp > 0) {
    const dailyBurn = Math.round(pastExp / cD);
    const projected = Math.round((pastExp / cD) * daysInMonth);
    const rem = daysInMonth - cD;
    if (prevExp > 0) {
      const overPct = Math.round(((projected - prevExp) / prevExp) * 100);
      if (overPct >= 10) insights.push({ icon: '⚠️', text: `At <strong>${fmtS(dailyBurn)}/day</strong>, projected <strong>${fmtS(projected)}</strong> by month-end — <span class="up">${overPct}% over</span> last month. ${rem} days to adjust.` });
      else if (overPct <= -10) insights.push({ icon: '🎯', text: `Great pace! <strong>${fmtS(dailyBurn)}/day</strong> → <strong>${fmtS(projected)}</strong> by month-end — <span class="down">${Math.abs(overPct)}% under</span> ${MF[pM]}'s ${fmtS(prevExp)}` });
    } else {
      insights.push({ icon: '📐', text: `Burning <strong>${fmtS(dailyBurn)}/day</strong> — projected <strong>${fmtS(projected)}</strong> by month-end (${rem} days left)` });
    }
  }

  // 2. Savings rate with benchmark context
  if (curInc > 0) {
    const savRate = Math.round((curSav / curInc) * 100);
    if (savRate >= 20) insights.push({ icon: '🏆', text: `Saving <strong><span class="down">${savRate}%</span></strong> of income — <strong>${fmtS(curSav)}</strong> kept. Above the 20% benchmark!` });
    else if (savRate > 0) { const gap = fmtS(curInc * 0.2 - curSav); insights.push({ icon: '💵', text: `Saving <strong>${savRate}%</strong> of income (<strong>${fmtS(curSav)}</strong>). ${gap} more to hit the 20% target.` }); }
    else if (savRate < 0) insights.push({ icon: '🔴', text: `Overspending by <strong><span class="up">${fmtS(Math.abs(curSav))}</span></strong> — expenses exceed income by ${Math.abs(savRate)}%` });
  }

  // 3. Savings momentum vs last month
  if (prevTxs.length > 0) {
    const savDiff = curSav - prevSav;
    if (Math.abs(savDiff) > 0) {
      if (savDiff > 0) insights.push({ icon: '💰', text: `Savings <span class="down">improved</span> by <strong>${fmtS(Math.abs(savDiff))}</strong> vs ${MF[pM]} (${fmtS(prevSav)} → ${fmtS(curSav)})` });
      else insights.push({ icon: '📉', text: `Savings <span class="up">dropped</span> by <strong>${fmtS(Math.abs(savDiff))}</strong> vs ${MF[pM]} (${fmtS(prevSav)} → ${fmtS(curSav)})` });
    }
  }

  // 4. Total expense comparison
  if (prevExp > 0) {
    const expPct = ((curExp - prevExp) / prevExp) * 100;
    if (Math.abs(expPct) >= 5) {
      if (expPct > 0) insights.push({ icon: '📊', text: `Spending <span class="up">up ${Math.round(Math.abs(expPct))}%</span> vs ${MF[pM]} — <strong>${fmtS(curExp)}</strong> vs ${fmtS(prevExp)} (+${fmtS(curExp - prevExp)})` });
      else insights.push({ icon: '✅', text: `Spending <span class="down">down ${Math.round(Math.abs(expPct))}%</span> vs ${MF[pM]} — <strong>${fmtS(curExp)}</strong> vs ${fmtS(prevExp)} (saved ${fmtS(prevExp - curExp)})` });
    }
  }

  // 5. Peak spending day + no-spend streak
  const dayEntries = Object.entries(curDayExp).sort((a, b) => b[1] - a[1]);
  if (dayEntries.length > 0) {
    const [topDay, topDayAmt] = dayEntries[0];
    const avgDay = curExp / Math.max(1, curExpDays.size);
    const ratio = topDayAmt / avgDay;
    let extra = ratio >= 2 ? ` — <span class="up">${ratio.toFixed(1)}x daily avg</span>` : '';
    const sorted = [...curExpDays].filter(d => d <= todayISO).sort().reverse();
    let streak = '';
    if (sorted.length > 0) { const gap = Math.floor((new Date(todayISO+'T00:00:00') - new Date(sorted[0]+'T00:00:00'))/86400000); if (gap >= 2) streak = ` No-spend streak: <strong>${gap} days</strong> 🔥`; }
    insights.push({ icon: '📅', text: `Peak spend: <strong>${fmtDt(topDay)}</strong> at <strong>${fmtS(topDayAmt)}</strong>${extra}.${streak}` });
  }

  // 6. Top expense category
  const catEntries = Object.entries(curCats).sort((a, b) => b[1] - a[1]);
  if (catEntries.length > 0) {
    const [topCat, topAmt] = catEntries[0];
    const pct = curExp > 0 ? Math.round((topAmt / curExp) * 100) : 0;
    const prevA = prevCats[topCat] || 0;
    let vsLast = '';
    if (prevA > 0) { const cc = Math.round(((topAmt - prevA) / prevA) * 100); if (Math.abs(cc) >= 10) vsLast = ` (<span class="${cc > 0 ? 'up' : 'down'}">${cc > 0 ? '+' : ''}${cc}%</span> vs last month)`; }
    insights.push({ icon: CICO[topCat] || '✦', text: `Top expense: <strong>${topCat.charAt(0).toUpperCase() + topCat.slice(1)}</strong> at <strong>${fmtS(topAmt)}</strong> (${pct}%)${vsLast}` });
  }

  // 7. Biggest category swing with amounts
  if (prevTxs.length > 0) {
    const allC = new Set([...Object.keys(curCats), ...Object.keys(prevCats)]);
    let bCat = null, bPct = 0, bDir = '', bCur = 0, bPrev = 0;
    allC.forEach(cat => { const cur = curCats[cat]||0, prev = prevCats[cat]||0; if (prev > 0) { const p = ((cur-prev)/prev)*100; if (Math.abs(p)>Math.abs(bPct)&&Math.abs(p)>=10){bPct=p;bCat=cat;bDir=p>0?'up':'down';bCur=cur;bPrev=prev;}} });
    if (bCat) { const cn = bCat.charAt(0).toUpperCase()+bCat.slice(1); insights.push({ icon: bDir==='up'?'🔺':'🔻', text: `<strong>${cn}</strong> <span class="${bDir==='up'?'up':'down'}">${bDir} ${Math.round(Math.abs(bPct))}%</span> — ${fmtS(bPrev)} → ${fmtS(bCur)}` }); }
  }

  // 8. Income comparison
  if (prevInc > 0) {
    const iPct = ((curInc - prevInc) / prevInc) * 100;
    if (Math.abs(iPct) >= 5) {
      if (iPct > 0) insights.push({ icon: '📈', text: `Income <span class="down">up ${Math.round(Math.abs(iPct))}%</span> vs ${MF[pM]} — <strong>${fmtS(curInc)}</strong> (+${fmtS(curInc-prevInc)})` });
      else insights.push({ icon: '📉', text: `Income <span class="up">down ${Math.round(Math.abs(iPct))}%</span> vs ${MF[pM]} — <strong>${fmtS(curInc)}</strong> (-${fmtS(prevInc-curInc)})` });
    }
  }

  if (!insights.length) {
    area.innerHTML = !prevTxs.length && curTxs.length ? '<div class="insight-empty">No previous month data to compare — insights will appear next month</div>' : '<div class="insight-empty">Spending is roughly the same as last month</div>';
    return;
  }
  area.innerHTML = insights.map(i => `<div class="insight-item"><div class="insight-icon">${i.icon}</div><div class="insight-text">${i.text}</div></div>`).join('');
}





function renderYearly(){
  const area=document.getElementById('yrArea');
  const now=new Date(),todayISO=new Date(now.getTime()-(now.getTimezoneOffset()*60000)).toISOString().slice(0,10),cY=now.getFullYear(),cM=now.getMonth(),cD=now.getDate();
  
  if(!txs.length){area.innerHTML='<div class="empty-state"><div class="empty-icon">📆</div><div class="empty-title">Yearly Overview</div><div class="empty-sub">Add transactions to see your year at a glance</div></div>';return;}
  // I1 FIX: Pre-compute year/month index to avoid thousands of redundant new Date() calls
  const txByYM = {}; // { year: { month: [txs] } }
  const yearSet = new Set([cY]);
  txs.forEach(t => {
    const d = new Date(t.date+'T00:00:00');
    const y = d.getFullYear(), m = d.getMonth();
    yearSet.add(y);
    if (!txByYM[y]) txByYM[y] = {};
    if (!txByYM[y][m]) txByYM[y][m] = [];
    txByYM[y][m].push(t);
  });
  const yrs=[...yearSet].sort((a,b)=>b-a);
  area.innerHTML=yrs.map(yr=>mkYrBlock(yr,txByYM[yr]||{},todayISO,cY,cM,cD)).join('');
}

function mkYrBlock(yr,yrMonths,todayISO,cY,cM,cD){
  const isCur=yr===cY;
  const yrTxs = Object.values(yrMonths).flat();
  const yrExp=yrTxs.filter(t=>t.type==='expense');
  const yrInc=yrTxs.filter(t=>t.type==='income');
  const yrTot=yrExp.reduce((s,t)=>s+t.amount,0);
  const yrTotInc=yrInc.reduce((s,t)=>s+t.amount,0);
  const yrNet=yrTotInc-yrTot;
  const yrSavRate=yrTotInc>0?Math.round((yrNet/yrTotInc)*100):null;
  const yrD=new Set(yrExp.map(t=>t.date)).size;
  // Calculate true average daily spend over elapsed days, not just active days
  const startDt = new Date(yr, 0, 1);
  const endDt = isCur ? new Date(todayISO + 'T00:00:00') : new Date(yr, 11, 31);
  const yrElapsedDays = Math.max(1, Math.floor((endDt - startDt) / 86400000) + 1);
  const yrAvg=yrElapsedDays>0?yrTot/yrElapsedDays:0;
  const yrO=yrExp.filter(t=>t.mode==='online').reduce((s,t)=>s+t.amount,0);
  const yrF=yrExp.filter(t=>t.mode!=='online').reduce((s,t)=>s+t.amount,0);
  const mT=Array.from({length:12},(_,m)=>{
    const mExp=(yrMonths[m]||[]).filter(t=>t.type==='expense');
    return mExp.reduce((s,t)=>s+t.amount,0);
  });
  const mMax=Math.max(...mT,1),lastM=isCur?cM:11;
  const sparks=mT.slice(0,lastM+1).map((v,m)=>{const h=Math.max(3,Math.round((v/mMax)*28));return `<div class="spk${isCur&&m===cM?' cm':''}" style="height:${h}px" data-tip="${MN[m]}: ${fmtS(v)}"></div>`;}).join('');
  const mnHTML=Array.from({length:12},(_,m)=>mkMnCard(m,yr,yrMonths,isCur,cM,cD,todayISO,mMax,yrTot)).join('');
  const netClr=yrNet>=0?'var(--in)':'var(--ex)';
  const savRateHtml=yrSavRate!==null?`<div class="ysi"><span class="ysl">Savings Rate</span><span class="ysv" style="color:${yrSavRate>=0?'var(--in)':'var(--ex)'}">${yrSavRate>0?'+':''}${yrSavRate}%</span></div>`:'';
  return `<div class="yb${isCur?' cy':''}" id="yb${yr}"><div class="yh" onclick="togYr('yb${yr}')"><div style="display:flex;flex-direction:column;align-items:flex-start;gap:4px;flex-shrink:0;"><span class="yl">${yr}</span>${isCur?'<span class="ytag">Current</span>':''}</div><div class="yrsum"><div class="ysi"><span class="ysl">Expenses</span><span class="ysv n">${fmt(yrTot)}</span></div><div class="ysi"><span class="ysl">Income</span><span class="ysv p">${fmt(yrTotInc)}</span></div><div class="ysi"><span class="ysl">Net</span><span class="ysv" style="color:${netClr}">${fmt(Math.abs(yrNet))}</span></div>${savRateHtml}<div class="ysi"><span class="ysl">Avg/Day</span><span class="ysv u">${fmtS(yrAvg)}</span></div><div class="ysi"><span class="ysl">Active Days</span><span class="ysv" style="color:var(--mu)">${yrD}d</span></div><div class="ysi"><span class="ysl">Online</span><span class="ysv" style="color:var(--on)">${fmtS(yrO)}</span></div><div class="ysi"><span class="ysl">Offline</span><span class="ysv" style="color:var(--of)">${fmtS(yrF)}</span></div></div><div class="yspk">${sparks}</div><span class="ych">▼</span></div><div class="mng">${mnHTML}</div></div>`;
}

function mkMnCard(m,yr,yrMonths,isCurYr,cM,cD,todayISO,mMax,yrTot){
  const isCur=isCurYr&&m===cM,isFut=isCurYr&&m>cM;
  const mAll=(yrMonths[m]||[]);
  const mE=mAll.filter(t=>t.type==='expense');
  const mI=mAll.filter(t=>t.type==='income');
  const tot=mE.reduce((s,t)=>s+t.amount,0),cnt=mE.length;
  const mInc=mI.reduce((s,t)=>s+t.amount,0);
  const mNet=mInc-tot;
  const mSavRate=mInc>0?Math.round((mNet/mInc)*100):null;
  const days=new Set(mE.map(t=>t.date)).size;
  // Calculate true average daily spend over elapsed days in this month
  const dim=new Date(yr,m+1,0).getDate();
  const elapsedM = isCur ? cD : isFut ? 0 : dim;
  const avg=elapsedM>0?tot/elapsedM:0;
  const onl=mE.filter(t=>t.mode==='online').reduce((s,t)=>s+t.amount,0);
  const ofl=mE.filter(t=>t.mode!=='online').reduce((s,t)=>s+t.amount,0);
  const prog=isCur?Math.round((cD/dim)*100):isFut?0:100;
  const bp=mMax>0?Math.round((tot/mMax)*100):0;
  const ys2=yrTot>0?Math.round(tot/yrTot*100):0;
  let tdHTML='';
  if(isCur){const tdS=mE.filter(t=>t.date===todayISO).reduce((s,t)=>s+t.amount,0),tdC=mE.filter(t=>t.date===todayISO).length;tdHTML=`<div class="tdc"><span class="tdcl">Today, ${cD} ${MN[m]}</span><span class="tdcv">${fmt(tdS)} <span style="font-size:10px;opacity:.7">${tdC} tx</span></span></div>`;}
  const mTxCount = mAll.length;
  const netClr=mNet>=0?'var(--in)':'var(--ex)';
  const incRow=mInc>0?`<div class="ms"><span class="msl">Income</span><span class="msv h" style="color:var(--in)">${fmtS(mInc)}</span></div>`:'';
  const netRow=mInc>0||tot>0?`<div class="ms"><span class="msl">Net</span><span class="msv" style="color:${netClr}">${fmtS(Math.abs(mNet))}</span></div>`:'';
  const savRateRow=mSavRate!==null?`<div class="ms"><span class="msl">Savings Rate</span><span class="msv h" style="color:${mSavRate>=0?'var(--in)':'var(--ex)'}">${mSavRate>0?'+':''}${mSavRate}%</span></div>`:'';

  return `<div class="mc${isCur?' cm2':isFut?' ft':''}" onclick="if(!${isFut}) lazyLoadMonthTxs(this, ${yr}, ${m})">
    <div class="mct"><span class="mcn">${MF[m]} ${isCur ? '<span class="now-badge">● NOW</span>' : ''}</span><span class="mcv">${tot>0?fmt(tot):'—'}</span></div>
    <div class="mcs">
      <div class="ms"><span class="msl">Transactions</span><span class="msv${cnt>0?' h':''}">${mTxCount}</span></div>
      <div class="ms"><span class="msl">Active Days</span><span class="msv${days>0?' h':''}">${days}/${dim}</span></div>
      <div class="ms"><span class="msl">Avg/Day</span><span class="msv${avg>0?' h':''}">${avg>0?fmtS(avg):'—'}</span></div>
      <div class="ms"><span class="msl">% of Year</span><span class="msv${ys2>0?' h':''}">${ys2>0?ys2+'%':'—'}</span></div>
      ${incRow}${netRow}${savRateRow}
    </div>
    <div style="display:flex;gap:10px;margin-bottom:${isCur?'6px':'0'}">
      <div class="ms"><span class="msl">⚡ Online</span><span class="msv" style="color:var(--on)">${onl>0?fmtS(onl):'—'}</span></div>
      <div class="ms"><span class="msl">🏪 Offline</span><span class="msv" style="color:var(--of)">${ofl>0?fmtS(ofl):'—'}</span></div>
    </div>
    ${tdHTML}
    <div class="mbw"><div class="mbb${isCur?' tp':''}" style="width:${bp}%"></div></div>
    ${isCur?`<div class="mpr">${prog}% of month elapsed</div>`:''}
    ${!isFut ? `<div class="mc-hint">▼ View ${mTxCount} Txs</div>` : ''}
  </div>`;
}

function togYr(id){document.getElementById(id).classList.toggle('op');}

// Lazy-load month card transaction list on first click
function lazyLoadMonthTxs(el, yr, m) {
  el.classList.toggle('op-tx');
  if (!el.classList.contains('op-tx')) return;
  if (el.querySelector('.tx-cnt')) return;
  const mTxs = txs.filter(t => {
    const d = new Date(t.date+'T00:00:00');
    return d.getFullYear() === yr && d.getMonth() === m;
  }).sort((a,b) => new Date(b.date) - new Date(a.date));
  let html;
  if (mTxs.length > 0) {
    const isCapped = mTxs.length > 50;
    const renderTxs = isCapped ? mTxs.slice(0, 50) : mTxs;
    html = `<div class="tx-cnt" onclick="event.stopPropagation();">` +
      renderTxs.map(t => `<div class="mtx-item"><div class="mtx-dt">${fmtDt(t.date)}</div><div class="mtx-desc" title="${esc(t.desc)}">${esc(t.desc)}</div><div class="mtx-amt ${t.type==='income'?'inc':'exp'}">${fmt(t.amount)}</div></div>`).join('') +
      (isCapped ? `<div style="text-align:center;color:var(--mu);font-size:10px;padding:10px 0;font-family:'DM Mono',monospace;letter-spacing:.5px;border-top:1px solid var(--bd);margin-top:4px;">Showing latest 50 of ${mTxs.length} transactions</div>` : '') +
      `</div>`;
  } else {
    html = `<div class="tx-cnt" onclick="event.stopPropagation();"><div style="text-align:center;color:var(--di);font-size:10px;padding:12px 0;font-family:'DM Mono',monospace;">No transactions for this month</div></div>`;
  }
  el.insertAdjacentHTML('beforeend', html);
}

const ALI={date:['date','transaction date','txn date','trans date','dt','value date'],desc:['description','desc','particulars','narration','details','merchant','note','notes','remarks','item'],amount:['amount','value','sum','total','amt','transaction amount','price'],income:['credit','deposit','income','cr','in','credits','deposits'],expense:['debit','withdrawal','expense','dr','out','debits','withdrawals'],type:['type','transaction type','txn type','direction','dr/cr','dr cr'],mode:['mode','payment mode','payment method','channel','medium','online/offline','pay mode','upi/cash'],cat:['category','cat','tag']};
function nH(h){return String(h).toLowerCase().trim().replace(/[\s_\-\/]+/g,' ');}

function dMap(hds){
  const nm=hds.map(nH),mp={date:-1,amount:-1,income:-1,expense:-1,desc:-1,type:-1,mode:-1,cat:-1};
  for(const[f,al]of Object.entries(ALI)){
    for(let i=0;i<nm.length;i++){
      if(al.includes(nm[i])&&Object.values(mp).indexOf(i)===-1){
        mp[f]=i;break;
      }
    }
  }
  return mp;
}

function pDt(v) {
  if(v == null || v === '') return null;
  if(v instanceof Date && !isNaN(v)) {
      const z = new Date(v.getTime() - (v.getTimezoneOffset() * 60000));
      return z.toISOString().slice(0,10);
  }
  if(typeof v === 'number') {
      // B7 FIX: Apply timezone correction so Excel serial dates don't shift by one day
      const dt = new Date((v - 25569) * 86400 * 1000);
      const z = new Date(dt.getTime() - (dt.getTimezoneOffset() * 60000));
      return z.toISOString().slice(0,10);
  }
  
  const s = String(v).trim();
  if(/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
  
  const m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if(m){
    let d = parseInt(m[1]), mo = parseInt(m[2]);
    // FIXED: Two-digit year heuristic — instead of blindly prepending '20',
    // check if the result would be more than 5 years in the future (extremely
    // unlikely for real financial transactions). If so, treat it as a 19xx date.
    // e.g. '31/12/99' → tries 2099 first → 2099 > currentYear+5 → uses 1999.
    let yr;
    if (m[3].length === 2) {
      const candidate = parseInt('20' + m[3]);
      yr = String(candidate > new Date().getFullYear() + 5 ? 1900 + parseInt(m[3]) : candidate);
    } else {
      yr = m[3];
    }
    // FIXED: Swap day/month when month part is > 12 and day part is unambiguous.
    // Also handle the edge case where both are > 12 (invalid date — return null).
    if (mo > 12 && d <= 12) { [d, mo] = [mo, d]; }
    else if (mo > 12 && d > 12) { return null; } // Both values > 12: unresolvable
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) return `${yr}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }
  
  const dt = new Date(s);
  if(!isNaN(dt)) {
      const z = new Date(dt.getTime() - (dt.getTimezoneOffset() * 60000));
      return z.toISOString().slice(0,10);
  }
  return null;
}

function pMd(v){if(!v)return null;const s=String(v).toLowerCase();if(/online|upi|neft|imps|net.?bank|card|digital|wallet|paytm|gpay|phonepe|rtgs/.test(s))return 'online';if(/offline|cash|pos|atm/.test(s))return 'offline';return null;}
function pTp(v){if(!v)return null;const s=String(v).toLowerCase();if(/income|credit|cr\b|salary|inflow|receipt/.test(s))return 'income';return 'expense';}
function pCt(v){if(!v)return 'other';const s=String(v).toLowerCase();for(const k of Object.keys(CICO)){if(s.includes(k))return k;}return 'other';}

function getReportData() {
  let fromDate, toDate, reportTitle;
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  if (reportPeriodMode === 'month') {
    const m = parseInt(document.getElementById('rptMonth').value);
    const y = parseInt(document.getElementById('rptYear').value);
    fromDate = `${y}-${String(m).padStart(2,'0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    toDate = `${y}-${String(m).padStart(2,'0')}-${lastDay}`;
    reportTitle = `${MONTHS[m-1]} ${y}  Finance Report`;
  } else if (reportPeriodMode === 'year') {
    const y = parseInt(document.getElementById('rptYearOnly').value);
    fromDate = `${y}-01-01`; toDate = `${y}-12-31`;
    reportTitle = `${y}  Annual Finance Report`;
  } else if (reportPeriodMode === 'event') {
    const rptEventId = document.getElementById('rptEvent').value;
    if (!rptEventId) { return { error: 'Please select an event' }; }
    const evt = events[rptEventId];
    reportTitle = `Event: ${evt.name}`;
    const evTxs = txs.filter(t => t.eventId === rptEventId);
    if(evTxs.length) {
      evTxs.sort((a,b)=>a.date.localeCompare(b.date));
      fromDate = evTxs[0].date;
      toDate = evTxs[evTxs.length-1].date;
    } else {
      fromDate = getTodayStr();
      toDate = fromDate;
    }
  } else {
    fromDate = document.getElementById('rptFrom').value;
    toDate = document.getElementById('rptTo').value;
    if (!fromDate || !toDate || fromDate > toDate) { return { error: 'Invalid date range' }; }
    reportTitle = `${fromDate} to ${toDate}  Finance Report`;
  }

  const incInc = document.getElementById('rptIncome').checked;
  const incExp = document.getElementById('rptExpenses').checked;

  let allInPeriod = txs;
  if (reportPeriodMode === 'event') {
    const rptEventId = document.getElementById('rptEvent').value;
    allInPeriod = allInPeriod.filter(t => t.eventId === rptEventId);
  } else {
    allInPeriod = allInPeriod.filter(t => t.date >= fromDate && t.date <= toDate);
  }
  
  let filtered = [...allInPeriod];
  if (!incInc) filtered = filtered.filter(t => t.type !== 'income');
  if (!incExp) filtered = filtered.filter(t => t.type !== 'expense');
  filtered.sort((a,b) => a.date.localeCompare(b.date));

  return { fromDate, toDate, reportTitle, allInPeriod, filtered };
}

function exportCSV() {
  const reportData = getReportData();
  if (reportData.error) {
    showToast(reportData.error, 'er');
    return;
  }
  
  const { fromDate, toDate, filtered } = reportData;
  const exportTxs = filtered;
  
  if (!exportTxs || !exportTxs.length) {
    showToast('No transactions to export', 'er');
    return;
  }
  
  // V3: CSV formula injection defense
  const csvSafe = (str) => {
    const s = String(str);
    if (/^[=+\-@\t\r\n]/.test(s)) return "'" + s;
    return s;
  };

  const hasEvents = exportTxs.some(t => t.eventId && events[t.eventId]);
  const headers = ['Date', 'Description', 'Amount', 'Type', 'Mode', 'Category'];
  if (hasEvents) headers.push('Event');

  const rows = exportTxs.map(t => {
    const row = [
      t.date,
      `"${csvSafe(t.desc).replace(/"/g, '""')}"`,
      t.amount,
      `"${csvSafe(t.type).replace(/"/g, '""')}"`,
      `"${csvSafe(t.mode).replace(/"/g, '""')}"`,
      `"${csvSafe(t.cat).replace(/"/g, '""')}"`
    ];
    if (hasEvents) {
      if (t.eventId && events[t.eventId]) {
        // CSV files don't support cell background colors, so we add a distinct emoji to stand out
        row.push(`"🎨 ${csvSafe(events[t.eventId].name).replace(/"/g, '""')}"`);
      } else {
        row.push('""');
      }
    }
    return row.join(',');
  });
  
  const csvContent = "\uFEFF" + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `flux-export-${fromDate}-to-${toDate}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Export successful', 'ok');
  closeReportMod();
}

function doImport(e){
  const file=e.target.files[0];if(!file)return;e.target.value='';
  // V12: Reject files over 5MB to prevent browser freeze
  if (file.size > 5 * 1024 * 1024) {
    showToast('File too large (max 5MB)', 'er');
    return;
  }
  const r=new FileReader();
  r.onload=ev=>{
    try {
      const d=new Uint8Array(ev.target.result),wb=XLSX.read(d,{type:'array',cellDates:true,raw:false}),ws=wb.Sheets[wb.SheetNames[0]];
      rawImportRows=XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:false});
      
      if(rawImportRows.length<2){showToast('File appears empty','er');return;}
      
      let bestScore=-1;
      for(let i=0;i<Math.min(6,rawImportRows.length);i++){
        const map=dMap(rawImportRows[i].map(String));
        const score=Object.values(map).filter(v=>v!==-1).length;
        if(score>bestScore){bestScore=score;headerRowIdx=i;currentMap=map;importHeaders=rawImportRows[i].map(String);}
      }
      
      renderMappingUI(file.name);
    }catch(er){showToast('Could not read file: '+er.message,'er');}
  };
  r.readAsArrayBuffer(file);
}

function setImpFilt(v) {
  impFilt = v;
  updatePreview();
}

function renderMappingUI(fname){
  const fields = [
    { id: 'date', label: 'Date *' },
    { id: 'desc', label: 'Description' },
    { id: 'amount', label: 'Amount (All/Single)' },
    { id: 'income', label: 'Income (Credit)' },
    { id: 'expense', label: 'Expense (Debit)' },
    { id: 'type', label: 'Type (Inc/Exp)' },
    { id: 'mode', label: 'Mode (On/Off)' },
    { id: 'cat', label: 'Category' }
  ];

  let selHTML = fields.map(f => {
    let opts = `<option value="-1">-- Ignore / Default --</option>`;
    importHeaders.forEach((h, i) => {
      let sel = currentMap[f.id] === i ? 'selected' : '';
      opts += `<option value="${i}" ${sel}>Col ${i+1}: ${esc(h)}</option>`;
    });
    return `<div class="map-item"><label>${f.label}</label><select id="map_${f.id}" onchange="updateMapping()">${opts}</select></div>`;
  }).join('');

  document.getElementById('modBody').innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px">
      <div class="it" style="margin-bottom:0">File: <strong>${esc(fname)}</strong></div>
      <button class="btn" style="padding:5px 10px; font-size:10px" onclick="document.getElementById('xlIn').click()">Change File</button>
    </div>
    <div class="map-grid">${selHTML}</div>
    
    <div style="margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid var(--bd);">
        <div style="font-size: 10px; color: var(--mu); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; font-family: 'DM Mono', monospace; font-weight:600;">Import Mode</div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
            <label style="display: flex; align-items: center; gap: 8px; color: var(--tx); font-size: 13px; cursor: pointer; text-transform: none; letter-spacing: normal; font-family: 'DM Sans', sans-serif;">
                <input type="radio" name="impMode" value="append" checked>
                Smart Append (Skips exact duplicates)
            </label>
            <label style="display: flex; align-items: center; gap: 8px; color: var(--tx); font-size: 13px; cursor: pointer; text-transform: none; letter-spacing: normal; font-family: 'DM Sans', sans-serif;">
                <input type="radio" name="impMode" value="replace">
                Overwrite all previously imported data
            </label>
        </div>
    </div>

    <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:10px;">
      <div id="prevStats" class="it" style="margin-bottom:0; font-size:12px;"></div>
      <select id="impFiltSel" onchange="setImpFilt(this.value)" style="width:140px; padding:6px 8px; font-size:11px;">
        <option value="all">Show All Rows</option>
        <option value="valid">Valid Rows Only</option>
        <option value="skipped">Skipped Rows Only</option>
      </select>
    </div>
    <div class="tw" id="prevTable"></div>
  `;
  document.getElementById('impMod').classList.add('op');
  
  impFilt = 'all'; 
  document.getElementById('impFiltSel').value = 'all';
  updatePreview();
}

function updateMapping() {
  ['date','amount','income','expense','desc','type','mode','cat'].forEach(f => {
    currentMap[f] = parseInt(document.getElementById('map_'+f).value);
  });
  updatePreview();
}

function updatePreview() {
  const dr = rawImportRows.slice(headerRowIdx + 1).filter(r => r.some(c => String(c).trim() !== ''));

  pend = dr.flatMap((row, idx) => {
    const get = f => currentMap[f] !== -1 ? row[currentMap[f]] : null;
    
    const dISO = pDt(get('date'));
    const rd = get('date');
    // V11: Truncate imported description to 50 chars to match UI input limit and save Firestore storage
    const desc = (String(get('desc') || '').trim() || ('Row ' + (headerRowIdx + 2 + idx))).substring(0, 50);
    const mode = pMd(get('mode')) || 'offline';
    const cat = pCt(get('cat'));
    const mappedType = get('type') ? pTp(get('type')) : null;

    const extAmt = (val) => {
      if (val == null || val === '') return null;
      if (typeof val === 'number') return val;
      const s = String(val).replace(/[^0-9.-]/g, '');
      const n = parseFloat(s);
      return isNaN(n) ? null : n;
    };

    const incVal = extAmt(get('income'));
    const expVal = extAmt(get('expense'));
    const amtVal = extAmt(get('amount'));

    const results = [];

    if (incVal !== null && incVal !== 0) {
      results.push({
        _r: headerRowIdx + 2 + idx,
        date: dISO, desc,
        amount: Math.abs(incVal),
        type: 'income',
        mode, cat,
        _rd: rd,
        _ra: get('income')
      });
    }

    if (expVal !== null && expVal !== 0) {
      results.push({
        _r: headerRowIdx + 2 + idx,
        date: dISO, desc,
        amount: Math.abs(expVal),
        type: 'expense',
        mode, cat,
        _rd: rd,
        _ra: get('expense')
      });
    }

    if (results.length === 0 && amtVal !== null && amtVal !== 0) {
      results.push({
        _r: headerRowIdx + 2 + idx,
        date: dISO, desc,
        amount: Math.abs(amtVal),
        type: mappedType || 'expense',
        mode, cat,
        _rd: rd,
        _ra: get('amount')
      });
    }

    if (results.length === 0) {
      results.push({
        _r: headerRowIdx + 2 + idx,
        date: dISO, desc,
        amount: null,
        type: mappedType || 'expense',
        mode, cat,
        _rd: rd,
        _ra: ''
      });
    }

    return results.map(t => {
      const errs = [];
      if (!t.date) errs.push('Date Invalid/Missing');
      if (t.amount === null || t.amount <= 0) errs.push('Amount Missing/Zero');
      return {
        ...t,
        _v: errs.length === 0,
        _err: errs.join(', ')
      };
    });
  });

  const vldCount = pend.filter(r => r._v).length;
  const btn = document.getElementById('impBtn');
  btn.disabled = vldCount === 0;
  btn.textContent = 'Import ' + vldCount + ' Valid Row' + (vldCount !== 1 ? 's' : '');

  document.getElementById('prevStats').innerHTML = `<strong>${vldCount}</strong> valid rows &nbsp;·&nbsp; <span style="color:var(--ex)">${pend.length - vldCount} skipped</span>`;

  let displayRows = pend;
  if (impFilt === 'valid') displayRows = pend.filter(r => r._v);
  if (impFilt === 'skipped') displayRows = pend.filter(r => !r._v);

  document.getElementById('prevTable').innerHTML = `
    <table class="pt">
      <thead>
        <tr>
          <th>#</th>
          <th>Date</th>
          <th>Description</th>
          <th>Amount</th>
          <th>Type</th>
          <th>Mode</th>
          <th>Cat</th>
          ${impFilt !== 'valid' ? '<th>Issue</th>' : ''}
        </tr>
      </thead>
      <tbody>
        ${displayRows.slice(0, 100).map(r => `
          <tr class="${r._v ? '' : 'sk'}">
            <td style="color:var(--di);font-family:'DM Mono',monospace">${r._r}</td>
            <td style="font-family:'DM Mono',monospace;font-size:11px">${r.date || '<span style="color:var(--ex)">' + esc(String(r._rd || 'Missing')) + '</span>'}</td>
            <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.desc)}</td>
            <td style="font-family:'DM Mono',monospace">${r.amount != null ? '₹' + r.amount.toLocaleString('en-IN') : '<span style="color:var(--ex)">' + esc(String(r._ra || 'Missing')) + '</span>'}</td>
            <td><span class="bdg ${r.type === 'income' ? 'bi' : 'be'}">${r.type}</span></td>
            <td><span class="bdg ${r.mode === 'online' ? 'bo' : 'bf'}">${r.mode}</span></td>
            <td>${CICO[r.cat] || '✦'} ${r.cat}</td>
            ${impFilt !== 'valid' ? `<td style="color:var(--ex);font-family:'DM Mono',monospace;font-size:10px">${r._err}</td>` : ''}
          </tr>
        `).join('')}
        ${displayRows.length > 100 ? `<tr><td colspan="${impFilt !== 'valid' ? '8' : '7'}" style="text-align:center;color:var(--di);font-family:'DM Mono',monospace;font-size:10px;padding:8px">… ${displayRows.length - 100} more rows</td></tr>` : ''}
      </tbody>
    </table>
  `;
}

function closeMod(){
  document.getElementById('impMod').classList.remove('op');
  pend=[];
  rawImportRows=[];
  impFilt='all';
}

function attemptImport() {
    const mode = document.querySelector('input[name="impMode"]:checked').value;
    if (mode === 'replace') {
        showConfirm(
            "Overwrite Data", 
            "This will permanently delete all previously imported transactions before importing the new ones. Proceed?", 
            () => executeImport(mode),
            true
        );
    } else {
        executeImport(mode);
    }
}

async function executeImport(mode) {
  if (!userId) {
      showToast('Cannot import, you are not connected to the cloud.', 'er');
      return;
  }
  
  const btn = document.getElementById('impBtn');
  btn.disabled = true;
  btn.textContent = "Syncing with Cloud...";

  const vld = pend.filter(r => r._v);
  let addedCount = 0;

  try {
      let batches = [];
      let currentBatch = writeBatch(db);
      let opCount = 0;

      // FIXED: Batch counter bug — previously the op was added to the batch BEFORE
      // the limit check incremented opCount, meaning the 450th op was in the
      // committed batch but opCount reset to 0 and a new empty batch was opened,
      // causing the committed batch to include the 450th op twice on next flush.
      // Now: check BEFORE adding, so we roll over cleanly at the boundary.
      const checkBatchLimit = () => {
          if (opCount >= 449) {
              batches.push(currentBatch.commit());
              currentBatch = writeBatch(db);
              opCount = 0;
          }
          opCount++;
      };

      if (mode === 'replace') {
        const importedTxs = txs.filter(t => t._imp);
        for (const t of importedTxs) {
           checkBatchLimit();
           currentBatch.delete(doc(db, 'users', userId, 'transactions', t.id));
        }
      }

      for (const r of vld) {
        // FIXED: Duplicate detection now uses case-insensitive description comparison.
        // Previously "Groceries" and "groceries" were treated as different transactions.
        const isDup = txs.some(t =>
          t.date === r.date &&
          t.amount === r.amount &&
          t.desc.toLowerCase() === r.desc.toLowerCase() &&
          t.type === r.type
        );
        if (mode === 'replace' || !isDup) {
          checkBatchLimit();
          const newId = uid();
          const nTx = { type:r.type, mode:r.mode, desc:r.desc, amount:r.amount, cat:r.cat, date:r.date, _imp:true };
          currentBatch.set(doc(db, 'users', userId, 'transactions', newId), nTx);
          addedCount++;
        }
      }

      if (opCount > 0) {
          batches.push(currentBatch.commit());
      }

      await Promise.all(batches);

      closeMod();
      if (addedCount > 0) {
        writeLog('IMPORT', `Imported ${addedCount} transaction${addedCount !== 1 ? 's' : ''} (mode: ${mode})`);
        showToast('Imported ' + addedCount + ' transaction' + (addedCount !== 1 ? 's' : ''), 'ok');
      } else {
        showToast('No new transactions to import (All duplicates)', 'ok');
      }
  } catch (error) {
      console.error("Import error", error);
      const code = error?.code || '';
      let msg;
      if (code === 'resource-exhausted') {
        msg = `Quota exceeded after ${addedCount} rows. Wait or upgrade Firestore plan.`;
      } else if (code === 'unavailable' || code === 'deadline-exceeded') {
        msg = `Network issue after ${addedCount} rows. Check connection and retry.`;
      } else if (code === 'permission-denied') {
        msg = 'Permission denied. Check Firestore security rules.';
      } else {
        msg = `Import failed after ${addedCount} rows: ${code || error?.message || 'Unknown error'}`;
      }
      showToast(msg, 'er');
      btn.disabled = false;
      btn.textContent = "Import Valid Rows";
  }
}

document.getElementById('impMod').addEventListener('click',function(e){if(e.target===this)closeMod();});

// === Events Feature ===
function loadEvents() {
  if (!userId) return;
  if (unsubscribeEvents) unsubscribeEvents();
  eventsUseFallback = false;
  const evtRef = collection(db, 'users', userId, 'events');
  unsubscribeEvents = onSnapshot(evtRef, (snap) => {
    events = {};
    snap.forEach(d => { events[d.id] = { id: d.id, _src: 'events', ...d.data() }; });
    populateEventSelects();
    renderEvents();
    // After loading the real events collection, silently check if any events
    // are still stranded in the old fallback location (transactions collection)
    // and migrate them across automatically.
    migrateStrandedEvents();
  }, (err) => {
    console.error('Events sync error:', err);
    if (err?.code === 'permission-denied') {
      eventsUseFallback = true;
      const fallbackQ = query(collection(db, 'users', userId, 'transactions'), where('_metaType', '==', 'event'));
      unsubscribeEvents = onSnapshot(fallbackQ, (snap2) => {
        events = {};
        snap2.forEach(d => {
          const data = d.data();
          events[d.id] = {
            id: d.id,
            _src: 'transactions',
            name: data.name,
            start: data.start,
            end: data.end,
            color: data.color,
            createdAt: data.createdAt
          };
        });
        populateEventSelects();
        renderEvents();
      }, (fallbackErr) => {
        console.error('Events fallback sync error:', fallbackErr);
        showToast('Events blocked by Firestore rules', 'er');
      });
      showToast('Events running in compatibility mode', 'ok');
    }
  });
}

// Migrates events stranded in the transactions fallback collection into the
// proper events subcollection. Runs silently after every successful events load.
async function migrateStrandedEvents() {
  if (!userId) return;
  try {
    const fallbackQ = query(
      collection(db, 'users', userId, 'transactions'),
      where('_metaType', '==', 'event')
    );
    const snap = await getDocs(fallbackQ);
    if (snap.empty) return; // Nothing to migrate
    console.log(`[Events] Migrating ${snap.size} stranded event(s) from transactions → events`);
    const batch = writeBatch(db);
    snap.forEach(d => {
      const data = d.data();
      const cleanEvent = {
        name: data.name || '',
        start: data.start || '',
        end: data.end || '',
        color: data.color || '#c8a96e',
        createdAt: data.createdAt || Date.now()
      };
      // Write to the proper events collection
      batch.set(doc(db, 'users', userId, 'events', d.id), cleanEvent);
      // Delete the stale copy from transactions
      batch.delete(d.ref);
    });
    await batch.commit();
    showToast(`Restored ${snap.size} saved event(s)`, 'ok');
    console.log('[Events] Migration complete');
  } catch (e) {
    // Non-fatal — if migration fails (e.g. rules not yet updated), just log it
    console.warn('[Events] Migration skipped:', e?.code || e?.message);
  }
}

function getEventDocRef(eventId, src) {
  if (!userId) return null;
  const source = src || (eventsUseFallback ? 'transactions' : 'events');
  if (source === 'transactions') {
    return doc(db, 'users', userId, 'transactions', eventId);
  }
  return doc(db, 'users', userId, 'events', eventId);
}

function populateEventSelects() {
  const evtOpts = '<option value="">\u2014 No Event \u2014</option>' +
    Object.values(events).map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('');
  const txEvt = document.getElementById('txEvent');
  if (txEvt) txEvt.innerHTML = evtOpts;
  const eEvt = document.getElementById('eEvent');
  if (eEvt) eEvt.innerHTML = evtOpts;
  const evtFilterSel = document.getElementById('eventTxFilterSel');
  if (evtFilterSel) {
    const prev = cEventFilt;
    evtFilterSel.innerHTML = '<option value="all">All</option>' +
      Object.values(events).map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('');
    cEventFilt = (prev === 'all' || events[prev]) ? prev : 'all';
    evtFilterSel.value = cEventFilt;
  }
}

function renderEvents() {
  const area = document.getElementById('eventList');
  if (!area) return;
  const evts = Object.values(events);
  evts.sort((a, b) => (b.start || '').localeCompare(a.start || ''));
  if (!evts.length) {
    area.innerHTML = '<div class="empty-state" style="padding:24px 16px"><div class="empty-icon" style="font-size:28px">🎯</div><div class="empty-title">No events yet</div><div class="empty-sub">Create events to group spending</div></div>';
    return;
  }
  const safeColor = getLegibleColor;
  const itemsHtml = evts.map(e => {
    const sColor = safeColor(e.color);
    let daysStr = '';
    if (e.start && e.end) {
      const d1 = new Date(e.start);
      const d2 = new Date(e.end);
      if (!isNaN(d1) && !isNaN(d2)) {
        const diffDays = Math.round(Math.abs(d2 - d1) / 86400000) + 1;
        daysStr = `<span style="white-space:nowrap;"><span style="opacity:0.5;margin-right:4px;">•</span><span style="font-weight:600;color:var(--tx);">${diffDays} day${diffDays !== 1 ? 's' : ''}</span></span>`;
      }
    }
    return `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:var(--rs);background:var(--s2);border:1px solid var(--bd);border-left:3px solid ${sColor};">
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:600;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(e.name)}</div>
        <div style="display:flex;align-items:center;flex-wrap:wrap;gap:6px;font-family:'DM Mono',monospace;font-size:10px;color:var(--mu);">
          <span style="white-space:nowrap;">${e.start || '?'}</span>
          <span style="font-size:12px;line-height:1;transform:translateY(-0.5px);">\u2192</span>
          <span style="white-space:nowrap;">${e.end || '?'}</span>
          ${daysStr}
        </div>
      </div>
      <button class="td" onclick="showEditEvent('${e.id}')" title="Edit" aria-label="Edit event: ${esc(e.name)}" style="opacity:1;transform:none;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button class="td" onclick="applyEventToTxs('${e.id}')" title="Apply to transactions" aria-label="Apply event ${esc(e.name)} to transactions" style="opacity:1;transform:none;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
      </button>
      <button class="td" onclick="askDeleteEvent('${e.id}')" title="Delete" aria-label="Delete event: ${esc(e.name)}" style="opacity:1;transform:none;">
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      </button>
    </div>
  `; }).join('');
  area.innerHTML = '<div class="split-fade-in" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:12px;">' + itemsHtml + '</div>';
}

function setSplitView(view) {
  document.getElementById('stSplit').classList.toggle('act', view === 'split');
  document.getElementById('stEvents').classList.toggle('act', view === 'events');
  
  const spArea = document.getElementById('spArea');
  const evArea = document.getElementById('eventList');
  const title = document.getElementById('splitEventTitle');
  const newBtn = document.getElementById('eventNewBtn');
  
  if (view === 'events') {
    if (spArea) spArea.style.display = 'none';
    if (evArea) evArea.style.display = 'block';
    if (title) title.textContent = 'Events';
    if (newBtn) newBtn.style.display = 'block';
  } else {
    if (evArea) evArea.style.display = 'none';
    if (spArea) spArea.style.display = 'block';
    if (title) title.textContent = 'Online vs Offline';
    if (newBtn) newBtn.style.display = 'none';
  }
}

let editingEventId = null;

function showCreateEvent() {
  if (!userId) { showToast('Please sign in first', 'er'); return; }
  editingEventId = null;
  document.getElementById('eventModTitle').textContent = 'New Event';
  document.getElementById('eventModSaveBtn').textContent = 'Create Event';
  document.getElementById('evtName').value = '';
  document.getElementById('evtStart').value = '';
  document.getElementById('evtEnd').value = '';
  document.getElementById('evtColor').value = '#c8a96e';
  document.getElementById('evtColorHex').textContent = '#c8a96e';
  document.getElementById('eventMod').classList.add('op');
}

function closeEventMod() {
  document.getElementById('eventMod').classList.remove('op');
  editingEventId = null;
}

document.getElementById('evtColor').addEventListener('input', (e) => {
  document.getElementById('evtColorHex').textContent = e.target.value;
});
document.getElementById('eventMod').addEventListener('click', function(e) { if (e.target === this) closeEventMod(); });

async function createEvent(evt) {
  if (!userId) return;
  const dateRx = /^\d{4}-\d{2}-\d{2}$/;
  if (!evt?.name || !evt.name.trim()) {
    showToast('Event name is required', 'er');
    return;
  }
  if (!dateRx.test(evt.start) || !dateRx.test(evt.end)) {
    showToast('Use dates as YYYY-MM-DD', 'er');
    return;
  }
  if (evt.start > evt.end) {
    showToast('Start date must be before end date', 'er');
    return;
  }
  const cleanEvent = {
    name: evt.name.trim(),
    start: evt.start,
    end: evt.end,
    color: evt.color || '#c8a96e',
    createdAt: Date.now()
  };
  const evtId = uid();
  try {
    const payload = eventsUseFallback ? { ...cleanEvent, _metaType: 'event' } : cleanEvent;
    await setDoc(getEventDocRef(evtId), payload);
    showToast('Event created', 'ok');
    showConfirm('Apply to Transactions', `Apply "${cleanEvent.name}" to transactions between ${cleanEvent.start} and ${cleanEvent.end}?`, () => assignTransactionsToEvent(evtId, cleanEvent.start, cleanEvent.end), false);
  } catch(e) {
    console.error('Error creating event', e);
    if (e?.code === 'permission-denied' && !eventsUseFallback) {
      try {
        eventsUseFallback = true;
        await setDoc(getEventDocRef(evtId, 'transactions'), { ...cleanEvent, _metaType: 'event' });
        loadEvents();
        showToast('Event created (compat mode)', 'ok');
        showConfirm('Apply to Transactions', `Apply "${cleanEvent.name}" to transactions between ${cleanEvent.start} and ${cleanEvent.end}?`, () => assignTransactionsToEvent(evtId, cleanEvent.start, cleanEvent.end), false);
        return;
      } catch (fallbackCreateErr) {
        console.error('Fallback create failed', fallbackCreateErr);
      }
    }
    const errMsg = e?.code ? `${e.code}` : (e?.message || 'Unknown error');
    showToast(`Error creating event: ${errMsg}`, 'er');
  }
}

function showEditEvent(evtId) {
  const evt = events[evtId];
  if (!evt) return;
  editingEventId = evtId;
  document.getElementById('eventModTitle').textContent = 'Edit Event';
  document.getElementById('eventModSaveBtn').textContent = 'Save Changes';
  document.getElementById('evtName').value = evt.name || '';
  document.getElementById('evtStart').value = evt.start || '';
  document.getElementById('evtEnd').value = evt.end || '';
  document.getElementById('evtColor').value = evt.color || '#c8a96e';
  document.getElementById('evtColorHex').textContent = evt.color || '#c8a96e';
  document.getElementById('eventMod').classList.add('op');
}

async function saveEventMod() {
  const name = document.getElementById('evtName').value.trim();
  const start = document.getElementById('evtStart').value;
  const end = document.getElementById('evtEnd').value;
  const color = document.getElementById('evtColor').value || '#c8a96e';
  if (!name) { shake('evtName'); return; }
  if (!start) { shake('evtStart'); return; }
  if (!end) { shake('evtEnd'); return; }
  // FIXED: Shake the end-date field visually as well as showing a toast, so the
  // user knows exactly which field is wrong (previously only a toast appeared).
  if (start > end) { shake('evtEnd'); showToast('Start date must be before end date', 'er'); return; }
  const evtId = editingEventId;
  closeEventMod();
  if (evtId) {
    await editEvent(evtId, { name, start, end, color });
  } else {
    await createEvent({ name, start, end, color });
  }
}

async function editEvent(evtId, data) {
  if (!userId) return;
  try {
    const src = events[evtId]?._src;
    const payload = (src === 'transactions' || eventsUseFallback) ? { ...data, _metaType: 'event' } : data;
    await setDoc(getEventDocRef(evtId, src), payload, { merge: true });
    showToast('Event updated', 'ok');
  } catch(e) {
    console.error('Error updating event', e);
    const errMsg = e?.code ? `${e.code}` : (e?.message || 'Unknown error');
    showToast(`Error updating event: ${errMsg}`, 'er');
  }
}

function askDeleteEvent(evtId) {
  const evt = events[evtId];
  if (!evt) return;
  showConfirm('Delete Event', `Delete "${evt.name}"? This removes the event tag from all associated transactions.`, () => deleteEvent(evtId), true);
}

async function deleteEvent(evtId) {
  if (!userId) return;
  try {
    await removeEventFromTransactions(evtId);
    await deleteDoc(getEventDocRef(evtId, events[evtId]?._src));
    showToast('Event deleted', 'ok');
  } catch(e) {
    console.error('Error deleting event', e);
    const errMsg = e?.code ? `${e.code}` : (e?.message || 'Unknown error');
    showToast(`Error deleting event: ${errMsg}`, 'er');
  }
}

async function assignTransactionsToEvent(evtId, start, end) {
  if (!userId) return;
  const matching = txs.filter(t => t.date >= start && t.date <= end);
  if (!matching.length) { showToast('No transactions in date range', 'er'); return; }
  showToast(`Applying to ${matching.length} transactions...`, 'ok');
  for (let i = 0; i < matching.length; i += 450) {
    const chunk = matching.slice(i, i + 450);
    const batch = writeBatch(db);
    chunk.forEach(tx => { batch.set(doc(db, 'users', userId, 'transactions', tx.id), { eventId: evtId }, { merge: true }); });
    await batch.commit();
    showToast(`Applied ${Math.min(i + 450, matching.length)} / ${matching.length}`, 'ok');
  }
  showToast(`Applied to ${matching.length} transactions`, 'ok');
}

function applyEventToTxs(evtId) {
  const evt = events[evtId];
  if (!evt) return;
  showConfirm('Apply Event', `Apply "${evt.name}" to all transactions between ${evt.start} and ${evt.end}?`, () => assignTransactionsToEvent(evtId, evt.start, evt.end), false);
}

async function removeEventFromTransactions(evtId) {
  if (!userId) return;
  const matching = txs.filter(t => t.eventId === evtId);
  if (!matching.length) return;
  for (let i = 0; i < matching.length; i += 450) {
    const chunk = matching.slice(i, i + 450);
    const batch = writeBatch(db);
    // FIXED: Use deleteField() to fully remove the eventId field from Firestore documents
    // instead of setting it to '' (empty string). The old approach left a dirty eventId:''
    // field on every transaction. deleteField() with merge:true removes the field entirely,
    // keeping the document clean and matching its original structure.
    chunk.forEach(tx => { batch.set(doc(db, 'users', userId, 'transactions', tx.id), { eventId: deleteField() }, { merge: true }); });
    await batch.commit();
    showToast(`Removing tags ${Math.min(i + 450, matching.length)} / ${matching.length}`, 'ok');
  }
}

function loadMoreTx() {
  txVisibleCount += (cDtFilt === 'today' && cModeFilt !== 'event') ? TX_TODAY_SIZE : TX_PAGE_SIZE;
  renderTxList();
}

// FAB: scroll to New Transaction form & auto-hide when form is visible
function scrollToForm() {
  const form = document.querySelector('.fb2');
  if (form) form.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
(function initFab() {
  const fab = document.getElementById('fab');
  if (!fab) return;
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const form = document.querySelector('.fb2');
      if (form) {
        const rect = form.getBoundingClientRect();
        const visible = rect.top < window.innerHeight && rect.bottom > 0;
        fab.classList.toggle('hide', visible);
      }
      ticking = false;
    });
  }, { passive: true });
})();

function setTxSearch(val) {
  cTxSearch = val;
  txVisibleCount = (cDtFilt === 'today' && cModeFilt !== 'event') ? TX_TODAY_SIZE : TX_PAGE_SIZE;
  renderTxList();
}

/* ── Activity Log Logic (Firestore-synced) ── */
const ACTIVITY_LOG_LIMIT = 200;

function writeLog(action, msg, txType) {
  if (!userId) return;
  try {
    const entry = { a: action, m: msg, t: serverTimestamp() };
    if (txType) entry.tp = txType; // 'income' or 'expense' for ADD/DELETE
    addDoc(collection(db, 'users', userId, 'activities'), entry).catch(e => {
      console.warn('Activity log write failed:', e);
    });
  } catch (e) {
    console.error('Failed to write activity log', e);
  }
}

function loadActivityLog() {
  if (!userId) return;
  if (unsubscribeActivityLog) unsubscribeActivityLog();
  const actRef = collection(db, 'users', userId, 'activities');
  const actQuery = query(actRef, orderBy('t', 'desc'), limit(ACTIVITY_LOG_LIMIT));
  unsubscribeActivityLog = onSnapshot(actQuery, (snap) => {
    if (_undoClearLogsData) return;
    activityLogs = [];
    snap.forEach(d => {
      const data = d.data();
      activityLogs.push({ id: d.id, ...data });
    });
    if (document.getElementById('logView').style.display !== 'none') {
      renderLogs();
    }
  }, (err) => {
    console.error('Activity log sync error:', err);
    // If permission-denied, show a one-time toast
    if (err?.code === 'permission-denied') {
      showToast('Activity log needs Firestore rules update', 'er');
    }
  });
}

function renderLogs() {
  const listEl = document.getElementById('logList');
  if (!listEl) return;
  const filter = document.getElementById('logFilter').value;
  let logs = [...activityLogs];

  if (filter !== 'all') {
    logs = logs.filter(l => l.a === filter);
  }
  if (cLogSearch) {
    logs = logs.filter(l => (l.m || '').toLowerCase().includes(cLogSearch));
  }

  if (logs.length === 0) {
    listEl.innerHTML = `<div class="log-empty"><div class="log-empty-icon">📝</div><div class="log-empty-title">No activity yet</div><div class="log-empty-sub">Your transaction history and edits will appear here.</div></div>`;
    return;
  }

  // Action icon colours and labels
  const actIcons  = { 'ADD': '➕', 'EDIT': '✏️', 'DELETE': '🗑️', 'IMPORT': '📥' };
  const actLabels = { 'ADD': 'Added', 'EDIT': 'Edited', 'DELETE': 'Deleted', 'IMPORT': 'Imported' };

  // Helper: try to infer tx type from legacy log messages that don't have 'tp' field
  function inferTxType(l) {
    if (l.tp) return l.tp;
    if (l.a !== 'ADD' && l.a !== 'DELETE') return null;
    const m = (l.m || '').toLowerCase();
    if (/salary|freelance|investment|income/.test(m)) return 'income';
    return null;
  }

  listEl.innerHTML = logs.map(l => {
    const ts = l.t;
    const d  = ts ? (ts.toDate ? ts.toDate() : new Date(ts)) : new Date();
    const timeStr = `${d.getDate()} ${d.toLocaleString('default',{month:'short'})} ${d.getFullYear().toString().slice(-2)}, ${d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`;

    const isAuto = l.a === 'ADD' && (l.m || '').includes('Auto-added');
    const showTypePill = l.a === 'ADD' || l.a === 'DELETE';
    const txType = showTypePill ? inferTxType(l) : null;
    const actionLabel = actLabels[l.a] || l.a;

    const dotColorClass = txType === 'income' ? 'income' : (txType === 'expense' ? 'expense' : 'neutral');

    const pSty = "padding:3px 8px;border-radius:12px;font-size:10px;font-weight:600;display:inline-flex;align-items:center;gap:4px;letter-spacing:0.3px;";

    let actionPill = '';
    if (l.a === 'EDIT') actionPill = `<span style="${pSty}background:var(--ag);color:var(--ac);border:1px solid var(--ac);">✏️ Edited</span>`;
    else if (l.a === 'IMPORT') actionPill = `<span style="${pSty}background:var(--ob);color:var(--on);border:1px solid var(--on);">📥 Imported</span>`;
    else if (l.a === 'DELETE') actionPill = `<span style="${pSty}background:var(--eb);color:var(--ex);border:1px solid var(--ex);">🗑️ Deleted</span>`;
    else if (l.a === 'ADD') {
      if (isAuto) actionPill = `<span style="${pSty}background:var(--fb);color:var(--of);border:1px solid var(--of);">🔄 Auto-recurring</span>`;
      else actionPill = `<span style="${pSty}background:var(--ib);color:var(--in);border:1px solid var(--in);">➕ Added</span>`;
    }
    else actionPill = `<span style="${pSty}background:var(--s3);color:var(--tx);border:1px solid var(--bd);">${actIcons[l.a] || '•'} ${actionLabel}</span>`;

    let typePill = '';
    if (txType === 'income') typePill = `<span style="${pSty}background:transparent;color:var(--in);border:1px dashed var(--in);">↑ Income</span>`;
    else if (txType === 'expense') typePill = `<span style="${pSty}background:transparent;color:var(--ex);border:1px dashed var(--ex);">↓ Expense</span>`;

    const timePill = `<span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--mu);">${timeStr}</span>`;

    return `<div class="txi card-in" style="cursor:default;padding:14px 16px;">
      <div class="dot ${dotColorClass}" ${dotColorClass==='neutral'?'style="background:var(--mu);box-shadow:0 0 8px var(--mu)"':''}></div>
      <div class="ti">
        <div class="tn log-msg" style="white-space:normal;overflow:visible;line-height:1.4;margin-bottom:6px;font-size:13px;font-weight:600;">${l.m}</div>
        <div class="tm" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          ${actionPill}
          ${typePill}
          ${timePill}
        </div>
      </div>
    </div>`;
  }).join('');
  if (typeof twemoji !== 'undefined') twemoji.parse(listEl);
}


/* \u2500\u2500 Recurring Transactions (Subscriptions) \u2500\u2500 */

function computeNextDue(fromDate, freq, customDays) {
  const d = new Date(fromDate + 'T00:00:00');
  if (freq === 'daily')   d.setDate(d.getDate() + 1);
  else if (freq === 'weekly')  d.setDate(d.getDate() + 7);
  else if (freq === 'monthly') d.setMonth(d.getMonth() + 1);
  else if (freq === 'yearly')  d.setFullYear(d.getFullYear() + 1);
  else if (freq === 'custom' && customDays) d.setDate(d.getDate() + parseInt(customDays, 10));
  // Use local date parts directly to avoid UTC midnight rollback for IST users
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getMonthKey() {
  const t = getTodayStr(); // e.g. "2026-06-05"
  return t.slice(0, 7);   // e.g. "2026-06"
}

function loadRecurring() {
  if (!userId) return;
  if (unsubscribeRecurring) unsubscribeRecurring();
  const recRef = collection(db, 'users', userId, 'recurring');
  unsubscribeRecurring = onSnapshot(recRef, (snap) => {
    recurringList = [];
    snap.forEach(d => recurringList.push({ id: d.id, ...d.data() }));
    recurringList.sort((a, b) => (a.nextDue || '').localeCompare(b.nextDue || ''));
    if (document.getElementById('subView').style.display !== 'none') renderRecurring();
    checkAndTriggerRecurring();
    tagPastSubscriptions();
  }, err => console.error('Recurring sync error:', err));
}

const triggeringRecs = new Set();
async function checkAndTriggerRecurring() {
  if (!userId || !recurringList.length) return;
  const today = getTodayStr();
  const monthKey = getMonthKey();
  const triggered = [];
  for (const rec of recurringList) {
    if (!rec.active) continue;
    if (!rec.nextDue || today < rec.nextDue) continue;
    // For monthly: skip if already triggered this month
    if (rec.freq === 'monthly' && rec.lastTriggered === monthKey) continue;
    // For others: skip if lastTriggered is today
    if (rec.freq !== 'monthly' && rec.lastTriggered === today) continue;
    
    // Prevent duplicates if the user manually paid this subscription early
    const dueD = new Date(rec.nextDue + 'T00:00:00');
    let wDays = 10;
    if (rec.freq === 'weekly') wDays = 3;
    if (rec.freq === 'daily') wDays = 0;
    if (rec.freq === 'custom') wDays = Math.max(1, Math.floor((rec.customDays || 1) / 2));
    
    const minD = new Date(dueD.getTime() - wDays * 86400000).toISOString().slice(0, 10);
    const manuallyPaid = txs.some(t => 
      !t._auto && 
      t.desc.trim().toLowerCase() === rec.name.trim().toLowerCase() && 
      Math.abs(t.amount) === Math.abs(rec.amount) &&
      t.date >= minD && t.date <= today
    );

    if (manuallyPaid) {
      const nextKey = (rec.freq === 'monthly') ? monthKey : today;
      await setDoc(doc(db, 'users', userId, 'recurring', rec.id), {
        nextDue: computeNextDue(rec.nextDue, rec.freq, rec.customDays),
        lastTriggered: nextKey
      }, { merge: true });
      writeLog('UPDATE', `Skipped duplicate auto-add for ${esc(rec.name)} (already manually paid early). Advanced due date.`);
      continue;
    }

    if (triggeringRecs.has(rec.id)) continue;
    triggeringRecs.add(rec.id);
    
    try {
      const txId = uid();
      const nextKey = (rec.freq === 'monthly') ? monthKey : today;
      
      // Optimistic local UI update
      const optimisticTx = {
        id: txId, type: rec.type, mode: rec.mode || 'online',
        desc: rec.name, cat: rec.cat, amount: rec.amount, date: today, _recurring: true, _auto: true
      };
      if (!txs.find(t => t.id === txId)) {
        txs.unshift(optimisticTx);
        debouncedRender();
      }

      await runTransaction(db, async (transaction) => {
        const recDoc = await transaction.get(doc(db, 'users', userId, 'recurring', rec.id));
        if (!recDoc.exists()) throw "not_found";
        const data = recDoc.data();
        if (data.freq === 'monthly' && data.lastTriggered === monthKey) throw "already_triggered";
        if (data.freq !== 'monthly' && data.lastTriggered === today) throw "already_triggered";
        if (today < data.nextDue) throw "not_due";
        
        transaction.set(doc(db, 'users', userId, 'transactions', txId), {
          type: data.type, mode: data.mode || 'online',
          desc: data.name, cat: data.cat,
          amount: data.amount, date: today, _recurring: true, _auto: true
        });
        transaction.update(recDoc.ref, {
          nextDue: computeNextDue(data.nextDue, data.freq, data.customDays),
          lastTriggered: nextKey
        });
      });
      triggered.push(rec.name);
      writeLog('ADD', `Auto-added recurring: ${esc(rec.name)} (₹${rec.amount})`);
    } catch(e) { 
      // Revert optimistic update if transaction failed
      txs = txs.filter(t => t.id !== txId);
      debouncedRender();
      if (e !== "already_triggered" && e !== "not_due") {
        console.error('Failed to trigger recurring:', rec.name, e); 
      }
    } finally {
      triggeringRecs.delete(rec.id);
    }
  }
  if (triggered.length) showToast(`✓ Auto-added: ${triggered.join(', ')}`, 'ok');
}

function renderRecurring() {
  const area = document.getElementById('subList');
  if (!area) return;
  const today = getTodayStr();
  const FREQ = { daily:'Daily', weekly:'Weekly', monthly:'Monthly', yearly:'Yearly' };
  // Update summary bar
  let monthlyTotal = 0, yearlyTotal = 0, dueCount = 0, activeCount = 0;
  recurringList.forEach(r => {
    if (!r.active) return;
    activeCount++;
    const amt = r.type === 'expense' ? r.amount : 0;
    if (r.freq === 'monthly') monthlyTotal += amt;
    else if (r.freq === 'yearly') yearlyTotal += amt / 12;
    else if (r.freq === 'weekly') monthlyTotal += amt * 4.33;
    else if (r.freq === 'daily') monthlyTotal += amt * 30;
    else if (r.freq === 'custom' && r.customDays > 0) monthlyTotal += (amt * 365.25 / r.customDays) / 12;
    if (r.nextDue && r.nextDue <= today) dueCount++;
    else if (r.nextDue) {
      const days = Math.ceil((new Date(r.nextDue) - new Date(today)) / 86400000);
      if (days <= 7) dueCount++;
    }
  });
  const el = (id) => document.getElementById(id);
  if (el('subTotalMonthly')) el('subTotalMonthly').textContent = '₹' + (monthlyTotal).toLocaleString('en-IN', {maximumFractionDigits:0});
  if (el('subTotalYearly')) el('subTotalYearly').textContent = '₹' + (monthlyTotal * 12 + yearlyTotal * 12).toLocaleString('en-IN', {maximumFractionDigits:0});
  if (el('subDueCount')) el('subDueCount').textContent = dueCount;
  if (el('subActiveCount')) el('subActiveCount').textContent = activeCount;

  if (!recurringList.length) {
    area.innerHTML = `<div class="empty-state" style="padding:48px 24px;grid-column:1/-1;text-align:center;background:var(--sf);border:1px solid var(--bd);border-radius:var(--r)">
      <div class="empty-icon" style="font-size:36px;margin-bottom:12px">🔁</div>
      <div class="empty-title">No subscriptions yet</div>
      <div class="empty-sub">Add recurring transactions like rent, Netflix, or salary to auto-track them every month.</div>
    </div>`;
    return;
  }
  area.innerHTML = recurringList.map(rec => {
    const isDue = rec.nextDue && rec.nextDue <= today;
    const daysUntil = rec.nextDue ? Math.ceil((new Date(rec.nextDue) - new Date(today)) / 86400000) : null;
    let statusHtml;
    if (!rec.active) {
      statusHtml = `<span style="font-size:10px;color:var(--mu);background:var(--s3);padding:3px 8px;border-radius:4px;font-family:'DM Mono',monospace;font-weight:600">PAUSED</span>`;
    } else if (isDue) {
      statusHtml = `<span style="font-size:10px;color:var(--ac);background:var(--ag);padding:3px 8px;border-radius:4px;font-family:'DM Mono',monospace;font-weight:600">⚡ DUE</span>`;
    } else if (daysUntil !== null && daysUntil <= 3) {
      statusHtml = `<span style="font-size:10px;color:var(--ex);background:var(--eb);padding:3px 8px;border-radius:4px;font-family:'DM Mono',monospace;font-weight:600">In ${daysUntil}d</span>`;
    } else {
      statusHtml = `<span style="font-size:10px;color:var(--in);background:var(--ib);padding:3px 8px;border-radius:4px;font-family:'DM Mono',monospace;font-weight:600">✓ Active</span>`;
    }
    const amtColor = rec.type === 'income' ? 'var(--in)' : 'var(--ex)';
    const amtSign = rec.type === 'income' ? '+' : '-';
    const catIcon = CICO[rec.cat] || '✦';
    return `<div class="sub-card ${rec.active ? '' : 'sub-paused'}">
      <div style="display:flex;align-items:center;gap:12px">
        <div style="width:44px;height:44px;border-radius:12px;background:var(--s2);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;border:1px solid var(--bd)">${catIcon}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:14px;margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(rec.name)}</div>
          <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--mu);letter-spacing:.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${rec.freq === 'custom' ? rec.customDays + ' Days' : (FREQ[rec.freq]||rec.freq)} · Next: ${rec.nextDue || '—'}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-family:'DM Mono',monospace;font-weight:700;font-size:17px;color:${amtColor}">${amtSign}₹${Math.abs(rec.amount).toLocaleString('en-IN',{maximumFractionDigits:2})}</div>
          <div style="margin-top:5px">${statusHtml}</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:14px;padding-top:12px;border-top:1px solid var(--bd)">
        <button class="ib" style="flex:1;justify-content:center;font-size:10px;padding:7px 4px" onclick="toggleRecurringActive('${rec.id}',${!rec.active})">${rec.active ? '⏸ Pause' : '▶ Resume'}</button>
        <button class="ib" style="flex:1;justify-content:center;font-size:10px;padding:7px 4px" onclick="openEditRecurring('${rec.id}')">✏ Edit</button>
        <button class="ib" style="flex:1;justify-content:center;font-size:10px;padding:7px 4px;color:var(--ex)" onclick="askDeleteRecurring('${rec.id}')">🗑 Delete</button>
      </div>
    </div>`;
  }).join('');
  if (typeof twemoji !== 'undefined') twemoji.parse(area);
}

function openAddRecurring() {
  if (!userId) { showToast('Sign in to add subscriptions', 'er'); return; }
  editingRecurringId = null;
  currentRecType = 'expense';
  currentRecFreq = 'monthly';
  document.getElementById('recurringModTitle').textContent = 'New Subscription';
  document.getElementById('recurringModSaveBtn').textContent = 'Create Subscription';
  document.getElementById('recName').value = '';
  document.getElementById('recAmount').value = '';
  document.getElementById('recCat').value = 'entertainment';
  document.getElementById('recNextDue').value = getTodayStr();
  setRecType('expense');
  setRecFreq('monthly');
  document.getElementById('recurringMod').classList.add('op');
}

function openEditRecurring(id) {
  const rec = recurringList.find(r => r.id === id);
  if (!rec) return;
  editingRecurringId = id;
  currentRecType = rec.type || 'expense';
  currentRecFreq = rec.freq || 'monthly';
  document.getElementById('recurringModTitle').textContent = 'Edit Subscription';
  document.getElementById('recurringModSaveBtn').textContent = 'Save Changes';
  document.getElementById('recName').value = rec.name || '';
  document.getElementById('recAmount').value = rec.amount || '';
  document.getElementById('recCat').value = rec.cat || 'other';
  document.getElementById('recNextDue').value = rec.nextDue || '';
  if (rec.freq === 'custom') document.getElementById('recCustomDays').value = rec.customDays || '';
  setRecType(currentRecType);
  setRecFreq(currentRecFreq);
  document.getElementById('recurringMod').classList.add('op');
}

function closeRecurringMod() {
  document.getElementById('recurringMod').classList.remove('op');
}

function setRecType(type) {
  currentRecType = type;
  document.getElementById('recTypeExp').className = 'tb' + (type === 'expense' ? ' ae' : '');
  document.getElementById('recTypeInc').className = 'tb' + (type === 'income' ? ' ai' : '');
}

function setRecFreq(freq) {
  currentRecFreq = freq;
  ['Monthly','Weekly','Yearly','Daily','Custom'].forEach(f => {
    const btn = document.getElementById('freq' + f);
    if (btn) btn.classList.toggle('act', freq === f.toLowerCase());
  });
  if (document.getElementById('recCustomDaysRow')) {
    document.getElementById('recCustomDaysRow').style.display = freq === 'custom' ? 'block' : 'none';
  }
}

async function saveRecurringMod() {
  const name = document.getElementById('recName').value.trim();
  const amount = parseFloat(document.getElementById('recAmount').value);
  const cat = document.getElementById('recCat').value;
  const nextDue = document.getElementById('recNextDue').value;
  const customDays = parseInt(document.getElementById('recCustomDays').value, 10);
  if (!name) { shake('recName'); return; }
  if (!amount || amount <= 0) { shake('recAmount'); return; }
  if (currentRecFreq === 'custom' && (!customDays || customDays <= 0)) { shake('recCustomDays'); return; }
  if (!nextDue) { shake('recNextDue'); return; }
  const data = { name, amount, type: currentRecType, mode: 'online', cat, freq: currentRecFreq, nextDue, active: true };
  if (currentRecFreq === 'custom') data.customDays = customDays;
  closeRecurringMod();
  if (editingRecurringId) {
    try {
      await setDoc(doc(db, 'users', userId, 'recurring', editingRecurringId), data, { merge: true });
      showToast('Subscription updated', 'ok');
    } catch(e) { showToast('Error updating: ' + (e?.code || e?.message), 'er'); }
  } else {
    try {
      data.createdAt = Date.now();
      await setDoc(doc(db, 'users', userId, 'recurring', uid()), data);
      showToast('Subscription created', 'ok');
      writeLog('ADD', `Created recurring subscription: ${esc(name)}`);
    } catch(e) { showToast('Error creating: ' + (e?.code || e?.message), 'er'); }
  }
}

async function toggleRecurringActive(id, active) {
  if (!userId) return;
  try {
    await setDoc(doc(db, 'users', userId, 'recurring', id), { active }, { merge: true });
    showToast(active ? 'Subscription resumed' : 'Subscription paused', 'ok');
  } catch(e) { showToast('Error: ' + (e?.code || e?.message), 'er'); }
}

function askDeleteRecurring(id) {
  const rec = recurringList.find(r => r.id === id);
  if (!rec) return;
  showConfirm('Delete Subscription', `Delete "${rec.name}"? Future transactions won't be auto-added, but past ones remain.`, () => deleteRecurring(id), true);
}

async function deleteRecurring(id) {
  if (!userId) return;
  try {
    await deleteDoc(doc(db, 'users', userId, 'recurring', id));
    showToast('Subscription deleted', 'ok');
  } catch(e) { showToast('Error deleting: ' + (e?.code || e?.message), 'er'); }
}

document.getElementById('recurringMod').addEventListener('click', function(e) { if (e.target === this) closeRecurringMod(); });

/* \u2500\u2500 PDF Monthly Reports \u2500\u2500 */

let reportModType = 'pdf';

function openReportMod(type = 'pdf') {
  reportModType = type;
  document.getElementById('reportModTitle').textContent = type === 'csv' ? 'Export CSV' : 'Generate PDF Report';
  
  const eventTab = document.getElementById('rptPeriodEvent');
  const btn = document.getElementById('pdfGenBtn');
  if (type === 'csv') {
    eventTab.style.display = 'none';
    if (reportPeriodMode === 'event') reportPeriodMode = 'month';
    btn.innerHTML = '📄 Download CSV';
    btn.onclick = exportCSV;
  } else {
    eventTab.style.display = 'block';
    btn.innerHTML = '📄 Generate &amp; Download PDF';
    btn.onclick = generatePDF;
  }

  const now = new Date();
  // Populate year selectors with all years present in transactions + current year
  const years = [...new Set(txs.map(t => t.date?.slice(0,4)).filter(Boolean))].sort((a,b) => b-a);
  if (!years.includes(String(now.getFullYear()))) years.unshift(String(now.getFullYear()));
  const yearOpts = years.map(y => `<option value="${y}">${y}</option>`).join('');
  document.getElementById('rptYear').innerHTML = yearOpts;
  document.getElementById('rptYearOnly').innerHTML = yearOpts;
  document.getElementById('rptMonth').value = now.getMonth() + 1;
  document.getElementById('rptYear').value = now.getFullYear();
  document.getElementById('rptYearOnly').value = now.getFullYear();
  document.getElementById('rptFrom').value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  document.getElementById('rptTo').value = getTodayStr();
  
  const evtOpts = ['<option value="">-- Select Event --</option>'];
  Object.values(events).forEach(e => evtOpts.push(`<option value="${e.id}">${e.name}</option>`));
  document.getElementById('rptEvent').innerHTML = evtOpts.join('');

  setReportPeriod(reportPeriodMode || 'month');
  document.getElementById('reportMod').classList.add('op');
}

function closeReportMod() {
  document.getElementById('reportMod').classList.remove('op');
}

function setReportPeriod(mode) {
  reportPeriodMode = mode;
  ['Month','Year','Custom','Event'].forEach(m => {
    const el = document.getElementById('rptPeriod' + m);
    if(el) el.classList.toggle('act', mode === m.toLowerCase());
  });
  document.getElementById('rptMonthYearRow').style.display = mode === 'month' ? 'grid' : 'none';
  document.getElementById('rptYearOnlyRow').style.display = mode === 'year' ? 'block' : 'none';
  document.getElementById('rptCustomRow').style.display = mode === 'custom' ? 'block' : 'none';
  document.getElementById('rptEventRow').style.display = mode === 'event' ? 'block' : 'none';
}

async function generatePDF() {
  if (typeof window.jspdf === 'undefined') { showToast('PDF library not loaded yet, try again', 'er'); return; }
  const btn = document.getElementById('pdfGenBtn');
  btn.disabled = true; btn.textContent = 'Generating...';
  try {
    const hasVFS = typeof pdfMake !== 'undefined' && pdfMake.vfs && pdfMake.vfs['Roboto-Regular.ttf'];
    const curSym = hasVFS ? '₹' : 'INR';
    // Helper: format amount without rupee symbol (jsPDF helvetica doesn't support Unicode Rs.)
    const fmtPDF = (n) => {
      const abs = Math.abs(n).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2});
      return `${curSym} ${abs}`;
    };
    const fmtPDFS = (n) => {
      const abs = Math.abs(n).toLocaleString('en-IN', {maximumFractionDigits:0});
      return (n < 0 ? '- ' : '') + `${curSym} ` + abs;
    };

    const reportData = getReportData();
    if (reportData.error) {
      showToast(reportData.error, 'er');
      btn.disabled = false; btn.innerHTML = '📄 Generate &amp; Download PDF';
      return;
    }
    const { fromDate, toDate, reportTitle, allInPeriod, filtered } = reportData;

    const incCat = document.getElementById('rptCatBreakdown').checked;
    const incList = document.getElementById('rptTxList').checked;

    const totalInc = allInPeriod.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
    const totalExp = allInPeriod.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
    const netBal = totalInc - totalExp;
    const savRate = totalInc > 0 ? ((netBal/totalInc)*100).toFixed(1) : '0.0';
    const txCount = allInPeriod.length;

    // Category data for insights
    const catMap = {};
    allInPeriod.filter(t=>t.type==='expense').forEach(t => { catMap[t.cat||'other'] = (catMap[t.cat||'other']||0) + t.amount; });
    const catEntries = Object.entries(catMap).sort((a,b)=>b[1]-a[1]);
    const topCat = catEntries[0];
    const avgDailyExp = totalExp > 0 ? totalExp / Math.max(1, Math.round((new Date(toDate) - new Date(fromDate)) / 86400000) + 1) : 0;
    const expTxs = allInPeriod.filter(t=>t.type==='expense');
    const largestTx = expTxs.length ? expTxs.reduce((m,t)=>t.amount>m.amount?t:m, expTxs[0]) : null;
    const onlineExp = allInPeriod.filter(t=>t.type==='expense'&&t.mode==='online').reduce((s,t)=>s+t.amount,0);
    const offlineExp = allInPeriod.filter(t=>t.type==='expense'&&t.mode==='offline').reduce((s,t)=>s+t.amount,0);

    // Init PDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
    
    // Inject Roboto font to support Unicode Rupee symbol (₹)
    if (typeof pdfMake !== 'undefined' && pdfMake.vfs && pdfMake.vfs['Roboto-Regular.ttf']) {
      doc.addFileToVFS('Roboto-Regular.ttf', pdfMake.vfs['Roboto-Regular.ttf']);
      doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
      doc.addFileToVFS('Roboto-Medium.ttf', pdfMake.vfs['Roboto-Medium.ttf']);
      doc.addFont('Roboto-Medium.ttf', 'Roboto', 'bold');
      
      const origSetFont = doc.setFont.bind(doc);
      doc.setFont = function(fontName, fontStyle, fontWeight) {
        if (fontName && fontName.toLowerCase() === 'helvetica') fontName = 'Roboto';
        return origSetFont(fontName, fontStyle, fontWeight);
      };
    }
    
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const pL = 15, pR = W - 15;

    // Colour palette — premium dark-on-light document style
    const gold = [184, 134, 11];
    const goldLight = [247, 231, 178];
    const panel = [255, 255, 255];
    const panel2 = [246, 247, 250];
    const panel3 = [237, 239, 245];
    const darkText = [18, 22, 38];
    const white = [18, 22, 38]; // alias kept for compat — this is actually dark text for light bg
    const green = [30, 130, 80];
    const greenBg = [220, 244, 232];
    const red = [185, 28, 28];
    const redBg = [254, 226, 226];
    const blueBg = [219, 234, 254];
    const blue = [37, 99, 200];
    const muted = [90, 98, 120];
    const bd = [210, 214, 228];
    const altRow = [249, 250, 252];
    const borderDark = [180, 185, 205];
    const headerBg = [18, 22, 38];
    const headerText = [240, 242, 248];
    const headerMuted = [148, 156, 180];
    const accentStripe = [200, 169, 110];

    // ── Helper: compute readable text color for any bg hex color ──
    const getContrastColor = (hexColor) => {
      if (!hexColor) return [18, 22, 38];
      const hex = hexColor.replace('#', '');
      if (hex.length !== 6) return [18, 22, 38];
      const r = parseInt(hex.substr(0,2),16) / 255;
      const g = parseInt(hex.substr(2,2),16) / 255;
      const b = parseInt(hex.substr(4,2),16) / 255;
      // sRGB luminance
      const toLinear = c => c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4);
      const L = 0.2126*toLinear(r) + 0.7152*toLinear(g) + 0.0722*toLinear(b);
      // Use dark text for light backgrounds (L > 0.179), white for dark
      return L > 0.35 ? [18, 22, 38] : [255, 255, 255];
    };
    // ── Helper: hex to RGB array ──
    const hexToRgb = (hex) => {
      if (!hex) return null;
      const h = hex.replace('#', '');
      if (h.length !== 6) return null;
      return [parseInt(h.substr(0,2),16), parseInt(h.substr(2,2),16), parseInt(h.substr(4,2),16)];
    };

    let curY = 0;
    let pageNum = 1;

    const addPage = () => { doc.addPage(); curY = 20; pageNum++; };
    const checkBreak = (needed) => { if (curY + needed > H - 18) addPage(); };

    // Section title helper — text vertically centred in the strip
    const sectionTitle = (title) => {
      checkBreak(17);
      const stripH = 11;
      // Background strip
      doc.setFillColor(...panel3);
      doc.roundedRect(pL, curY, W - 30, stripH, 2, 2, 'F');
      // Gold left accent bar (full height, square right edge)
      doc.setFillColor(...accentStripe);
      doc.roundedRect(pL, curY, 4, stripH, 1, 1, 'F');
      doc.rect(pL + 2, curY, 2, stripH, 'F');
      // Title text — PDF centering formula: baseline = stripTop + (stripH + capH) / 2
      // 9.5pt bold cap height ≈ 9.5 × 0.3528mm × 0.72 ≈ 2.41mm
      const capH95 = 9.5 * 0.3528 * 0.72;
      doc.setFont('helvetica','bold'); doc.setFontSize(9.5); doc.setTextColor(...darkText);
      doc.text(title, pL + 10, curY + (stripH + capH95) / 2);
      curY += stripH + 5;
    };

    // ── PAGE 1: HEADER BANNER ──────────────────────────────────────────────
    // Deep navy header background
    doc.setFillColor(...headerBg);
    doc.rect(0, 0, W, 50, 'F');
    // Gold accent stripe
    doc.setFillColor(...accentStripe);
    doc.rect(0, 47, W, 2.5, 'F');
    // Thin lighter stripe below
    doc.setFillColor(200, 190, 150);
    doc.rect(0, 49.5, W, 0.8, 'F');

    // Brand mark — vertical accent bar + FLUX
    doc.setFillColor(...accentStripe);
    doc.rect(pL, 10, 3, 24, 'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(28); doc.setTextColor(...accentStripe);
    doc.text('Flux', pL + 8, 28);
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...headerMuted);
    doc.text('PERSONAL FINANCE', pL + 8, 34);

    // Report title (right-aligned in header)
    doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(...headerText);
    doc.text(reportTitle, pR, 22, { align:'right' });
    const genDate = new Date().toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'});
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...headerMuted);
    doc.text(`Generated: ${genDate}`, pR, 30, { align:'right' });
    curY = 60;

    // ── SUMMARY CARDS — premium redesign (2x2 grid) ──────────────────────
    const cardW = (W - 30 - 6) / 2;
    const cardH = 34;
    const cardGap = 6;
    const summaryCards = [
      { label:'NET BALANCE',    val: fmtPDF(netBal, true),  color: netBal >= 0 ? green : red, bgColor: netBal>=0 ? greenBg : redBg, sub: netBal>=0 ? 'Positive cash flow' : 'Spending exceeds income' },
      { label:'TOTAL INCOME',   val: fmtPDFS(totalInc),     color: green, bgColor: greenBg, sub: `${allInPeriod.filter(t=>t.type==='income').length} income entries` },
      { label:'TOTAL EXPENSES', val: fmtPDFS(totalExp),     color: red,   bgColor: redBg,   sub: `${expTxs.length} expense entries` },
      { label:'SAVINGS RATE',   val: `${savRate}%`,         color: parseFloat(savRate)>=20 ? green : parseFloat(savRate)>=0 ? [140,100,20] : red, bgColor: parseFloat(savRate)>=20 ? greenBg : parseFloat(savRate)>=0 ? [255,248,220] : redBg, sub: parseFloat(savRate)>=20?'Healthy savings':'Below target (20%)' },
    ];
    summaryCards.forEach((c, i) => {
      const row = Math.floor(i / 2), col = i % 2;
      const cx = pL + col * (cardW + cardGap);
      const cy = curY + row * (cardH + cardGap);
      // Card background — very light tint
      doc.setFillColor(...panel); doc.roundedRect(cx, cy, cardW, cardH, 3, 3, 'F');
      // Subtle border
      doc.setDrawColor(...bd); doc.setLineWidth(0.25); doc.roundedRect(cx, cy, cardW, cardH, 3, 3, 'S');
      // Left accent bar in card color
      doc.setFillColor(...c.color); doc.roundedRect(cx, cy, 4, cardH, 1.5, 1.5, 'F');
      doc.setFillColor(...c.color); doc.rect(cx + 2, cy, 2, cardH, 'F'); // square off right side of bar
      // Label
      doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(...muted);
      doc.text(c.label, cx + 9, cy + 8);
      // Value — large and colored
      doc.setFont('helvetica','bold'); doc.setFontSize(16); doc.setTextColor(...c.color);
      doc.text(c.val, cx + 9, cy + 21);
      // Sub-label
      doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(...muted);
      doc.text(c.sub, cx + 9, cy + 29);
    });
    curY += (cardH + cardGap) * 2 + 4;

    // Tx count summary strip — text vertically centred
    const txStripH = 10;
    // 8.5pt cap height ≈ 8.5 × 0.3528mm × 0.72 ≈ 2.16mm; baseline = top + (h + capH) / 2
    const txCapH = 8.5 * 0.3528 * 0.72;
    const txTextY = curY + (txStripH + txCapH) / 2;
    doc.setFillColor(...panel2); doc.roundedRect(pL, curY, W - 30, txStripH, 2, 2, 'F');
    doc.setDrawColor(...bd); doc.setLineWidth(0.2); doc.roundedRect(pL, curY, W - 30, txStripH, 2, 2, 'S');
    doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(...darkText);
    doc.text(`${txCount} total transactions`, pL + 6, txTextY);
    doc.setTextColor(green[0], green[1], green[2]);
    doc.text(`${allInPeriod.filter(t=>t.type==='income').length} income`, pL + 70, txTextY);
    doc.setTextColor(red[0], red[1], red[2]);
    doc.text(`${expTxs.length} expenses`, pL + 105, txTextY);
    curY += txStripH + 8;

    // ── INSIGHTS ─────────────────────────────────────────────────────────
    if (txCount > 0) {
      sectionTitle('KEY INSIGHTS');
      const insights = [];
      if (topCat) insights.push(`Highest spend category: ${topCat[0].charAt(0).toUpperCase()+topCat[0].slice(1)} (${fmtPDFS(topCat[1])}, ${totalExp>0?((topCat[1]/totalExp)*100).toFixed(1):'0'}% of expenses)`);
      if (largestTx) insights.push(`Largest single expense: ${largestTx.desc||'(no description)'} on ${largestTx.date} for ${fmtPDFS(largestTx.amount)}`);
      if (avgDailyExp > 0) insights.push(`Average daily spending: ${fmtPDF(avgDailyExp)} per day`);
      if (totalExp > 0) {
        const onlinePct = ((onlineExp/totalExp)*100).toFixed(0);
        insights.push(`Payment split: ${onlinePct}% online (${fmtPDFS(onlineExp)})  vs  ${100-parseInt(onlinePct)}% offline (${fmtPDFS(offlineExp)})`);
      }
      if (catEntries.length >= 2) insights.push(`Second highest: ${catEntries[1][0].charAt(0).toUpperCase()+catEntries[1][0].slice(1)} at ${fmtPDFS(catEntries[1][1])} (${totalExp>0?((catEntries[1][1]/totalExp)*100).toFixed(1):'0'}%)`);
      if (parseFloat(savRate) > 30) insights.push('Excellent savings rate! You are saving more than 30% of income this period.');
      else if (parseFloat(savRate) > 0) insights.push(`You saved ${fmtPDFS(netBal)} this period. Aim for 20%+ for strong financial health.`);
      else if (netBal < 0) insights.push(`Spending exceeded income by ${fmtPDFS(Math.abs(netBal))}. Review top categories to reduce costs.`);

      // Font metrics for 9pt regular
      const FS = 9, PT = 0.3528;
      const capH  = FS * PT * 0.72;   // ~2.286mm — height of capital letters above baseline
      const descH = FS * PT * 0.22;   // ~0.700mm — depth of descenders below baseline
      const lineH = FS * PT * 1.15;   // ~3.647mm — matches jsPDF default line-height factor
      const vPad  = 3.5;              // equal top & bottom padding in mm

      insights.forEach((ins) => {
        doc.setFont('helvetica','normal'); doc.setFontSize(FS);
        const insLines = doc.splitTextToSize(ins, W - pL - 15 - 18);

        // Strip height = actual text block height + equal padding top and bottom
        // blockH: from top of first capital to bottom of last descender
        const blockH = capH + (insLines.length - 1) * lineH + descH;
        const stripH = blockH + vPad * 2;
        checkBreak(stripH + 3);
        const stripY = curY;

        // Background strip
        doc.setFillColor(...panel2);
        doc.roundedRect(pL, stripY, W - 30, stripH, 2, 2, 'F');

        // Gold bullet — at exact vertical centre of strip (= centre of text block)
        doc.setFillColor(...accentStripe);
        doc.circle(pL + 7, stripY + stripH / 2, 1.5, 'F');

        // Text — first baseline = stripTop + vPad + capH
        // This places top of first capital at (stripTop + vPad) — perfectly centred
        doc.setTextColor(...darkText);
        const firstBaseline = stripY + vPad + capH;
        insLines.forEach((line, li) => {
          doc.text(line, pL + 14, firstBaseline + li * lineH);
        });

        curY = stripY + stripH + 3;
      });
      curY += 6;
    }

    // ── PAGE 2: TREND CHARTS (Income and Expense) ───────────────────
    if (allInPeriod.length > 0) {
      doc.addPage();
      curY = 20;
      sectionTitle('INCOME AND EXPENSE TRENDS');
      
      const trendData = {};
      allInPeriod.forEach(t => {
        if (!trendData[t.date]) trendData[t.date] = { inc: 0, exp: 0 };
        if (t.type === 'income') trendData[t.date].inc += t.amount;
        if (t.type === 'expense') trendData[t.date].exp += t.amount;
      });
      
      const startTs = new Date(fromDate).getTime();
      const endTs = new Date(toDate).getTime();
      const daysCount = Math.max(1, Math.round((endTs - startTs) / 86400000) + 1);
      
      const pts = [];
      if (daysCount > 90) {
        const mData = {};
        allInPeriod.forEach(t => {
          const my = t.date.slice(0, 7);
          if (!mData[my]) mData[my] = { inc: 0, exp: 0 };
          if (t.type === 'income') mData[my].inc += t.amount;
          if (t.type === 'expense') mData[my].exp += t.amount;
        });
        
        let currD = new Date(fromDate.slice(0,7) + '-01');
        const endD = new Date(toDate.slice(0,7) + '-01');
        while (currD <= endD) {
          const my = `${currD.getFullYear()}-${String(currD.getMonth()+1).padStart(2,'0')}`;
          const v = mData[my] || { inc: 0, exp: 0 };
          pts.push({ label: currD.toLocaleString('default',{month:'short'}) + ' ' + String(currD.getFullYear()).slice(2), inc: v.inc, exp: v.exp });
          currD.setMonth(currD.getMonth() + 1);
        }
      } else {
        for (let i = 0; i < daysCount; i++) {
          const d = new Date(startTs + i * 86400000);
          const dStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
          const v = trendData[dStr] || { inc: 0, exp: 0 };
          pts.push({ label: `${d.getDate()} ${d.toLocaleString('default',{month:'short'})}`, inc: v.inc, exp: v.exp });
        }
      }
      
      const drawTrendChart = (title, dataKey, color, startY) => {
        const chartH = 110;
        const fullW = W - pL - 15;
        const cX = pL;
        const cY = startY;
        
        doc.setFillColor(...panel2); doc.roundedRect(cX, cY, fullW, chartH, 3, 3, 'F');
        doc.setDrawColor(...borderDark); doc.setLineWidth(0.15); doc.roundedRect(cX, cY, fullW, chartH, 3, 3, 'S');
        
        doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...gold);
        doc.text(title, cX + fullW/2, cY + 8, {align:'center'});

        let maxAmt = 0;
        pts.forEach(d => { maxAmt = Math.max(maxAmt, d[dataKey]); });
        maxAmt = maxAmt > 0 ? Math.ceil(maxAmt * 1.1) : 1000;
        
        const padLeft = 25; 
        const padRight = 10;
        const padTop = 16;
        const padBottom = 22; 
        const drawW = fullW - padLeft - padRight;
        const drawH = chartH - padTop - padBottom;
        const gridX = cX + padLeft;
        const gridY = cY + padTop;
        const gridBottom = gridY + drawH;
        
        doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(...muted);
        for (let i = 0; i <= 4; i++) {
          const yPos = gridBottom - (i / 4) * drawH;
          const amtVal = (maxAmt * (i / 4));
          const amtStr = amtVal >= 100000 ? (amtVal/100000).toFixed(1)+'L' : amtVal >= 1000 ? (amtVal/1000).toFixed(1)+'k' : amtVal.toFixed(0);
          
          doc.text(amtStr, gridX - 3, yPos + 2.5, { align: 'right' });
          doc.setDrawColor(...bd); doc.setLineWidth(0.1);
          doc.line(gridX, yPos, gridX + drawW, yPos);
        }
        
        const getX = (idx) => gridX + (pts.length <= 1 ? drawW/2 : (idx / (pts.length - 1)) * drawW);
        const getY = (val) => gridBottom - (val / maxAmt) * drawH;
        
        doc.setDrawColor(...color); doc.setLineWidth(1.0);
        for (let i = 1; i < pts.length; i++) doc.line(getX(i-1), getY(pts[i-1][dataKey]), getX(i), getY(pts[i][dataKey]));
        
        doc.setFillColor(...color);
        for (let i = 0; i < pts.length; i++) doc.circle(getX(i), getY(pts[i][dataKey]), 1.2, 'F');
        
        const labelSteps = Math.max(1, Math.ceil(pts.length / 8));
        
        doc.setFont('helvetica','bold'); doc.setFontSize(7.5);
        const placedLabels = [];
        for (let i = 0; i < pts.length; i++) {
          const val = pts[i][dataKey];
          if (val > 0) {
            const amtStr = val >= 100000 ? (val/100000).toFixed(1)+'L' : val >= 1000 ? (val/1000).toFixed(1)+'k' : val.toFixed(0);
            const currY = getY(val);
            const prevY = i > 0 ? getY(pts[i-1][dataKey]) : currY;
            const nextY = i < pts.length - 1 ? getY(pts[i+1][dataKey]) : currY;
            
            let isValley = (currY >= prevY && currY >= nextY) || (i===0 && nextY < currY) || (i===pts.length-1 && prevY < currY);
            
            const offsets = isValley ? [4.5, -2.5, 7.5, -5.5] : [-2.5, 4.5, -5.5, 7.5];
            const txtW = doc.getTextWidth(amtStr);
            const txtH = 3;
            
            let finalOff = offsets[0];
            for (let off of offsets) {
               const cx = getX(i);
               const cy = currY + off;
               let collides = false;
               for (let pl of placedLabels) {
                  if (Math.abs(cx - pl.x) < (txtW + pl.w)/2 + 1.5 && Math.abs(cy - pl.y) < txtH + 1) {
                     collides = true; break;
                  }
               }
               if (!collides) {
                  finalOff = off; break;
               }
            }
            
            const drawX = getX(i);
            const drawY = currY + finalOff;
            
            // Mask background to prevent line intersection
            doc.setFillColor(...panel2);
            doc.rect(drawX - txtW/2 - 0.5, drawY - 2.5, txtW + 1, 3.2, 'F');
            
            doc.setTextColor(...color);
            doc.text(amtStr, drawX, drawY, { align: 'center' });
            
            placedLabels.push({x: drawX, y: drawY, w: txtW});
          }
        }
        
        doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...muted);
        for (let i = 0; i < pts.length; i += labelSteps) {
          if (i !== pts.length - 1 && (pts.length - 1 - i) < labelSteps * 0.6) continue;
          const lx = getX(i);
          doc.text(pts[i].label, lx, gridBottom + 7, { align: 'center' });
          doc.setDrawColor(...bd); doc.setLineWidth(0.1); doc.line(lx, gridBottom, lx, gridBottom + 2.5);
        }
        if (pts.length > 1 && (pts.length - 1) % labelSteps !== 0) {
           const lst = pts.length - 1;
           const lx = getX(lst);
           doc.text(pts[lst].label, lx, gridBottom + 7, { align: 'center' });
           doc.line(lx, gridBottom, lx, gridBottom + 2.5);
        }
        
        return cY + chartH;
      };

      let nextY = drawTrendChart('INCOME TREND', 'inc', green, curY);
      drawTrendChart('EXPENSE TREND', 'exp', red, nextY + 16);
      
      curY = nextY + 140;
    }

    // ── PAGE 3: CHARTS (Category Donut + Online/Offline Donut) ───────────
    if (catEntries.length > 0 || totalExp > 0) {
      doc.addPage();
      curY = 20;
      sectionTitle('SPENDING ANALYSIS');

      // Helper: draw a donut slice using polygon arc approximation
      const drawDonutSlice = (cx, cy, r, innerR, startDeg, endDeg, fillColor) => {
        const STEPS = Math.max(8, Math.round(Math.abs(endDeg - startDeg) / 3));
        const toRad = (d) => (d - 90) * Math.PI / 180;
        const outerPts = [], innerPts = [];
        for (let i = 0; i <= STEPS; i++) {
          const a = toRad(startDeg + (endDeg - startDeg) * i / STEPS);
          outerPts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
        }
        for (let i = STEPS; i >= 0; i--) {
          const a = toRad(startDeg + (endDeg - startDeg) * i / STEPS);
          innerPts.push([cx + innerR * Math.cos(a), cy + innerR * Math.sin(a)]);
        }
        const allPts = [...outerPts, ...innerPts];
        const lineSegs = [];
        for (let i = 1; i < allPts.length; i++) {
          lineSegs.push([allPts[i][0] - allPts[i-1][0], allPts[i][1] - allPts[i-1][1]]);
        }
        doc.setFillColor(...fillColor);
        doc.lines(lineSegs, allPts[0][0], allPts[0][1], [1, 1], 'F', true);
      };

      // Chart colour palette (accessible, distinct)
      const PALETTE = [
        [200,169,110],[93,186,138],[110,157,200],[224,112,112],
        [157,122,200],[200,185,80],[80,200,185],[200,120,80],
        [140,200,100],[200,100,160],[100,160,200],[160,200,140],
      ];

      const chartPanelTop = curY;
      const sideColW = (W - pL - 15) / 2 - 3;
      const fullW = W - pL - 15;
      
      const catFullWidth = true; // User preference: always stack donut charts top and bottom
      const catW = catFullWidth ? fullW : sideColW;

      // ── LEFT: CATEGORY DISTRIBUTION ──────────────────────────────────────
      const leftX = pL;
      const catChartTitle = 'CATEGORY DISTRIBUTION';
      // Panel background
      doc.setFillColor(...panel2); doc.roundedRect(leftX, chartPanelTop, catW, 110, 3, 3, 'F');
      doc.setDrawColor(...borderDark); doc.setLineWidth(0.15); doc.roundedRect(leftX, chartPanelTop, catW, 110, 3, 3, 'S');
      // Title
      doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...gold);
      doc.text(catChartTitle, leftX + catW/2, chartPanelTop + 8, {align:'center'});

      const catCX = leftX + (catFullWidth ? 45 : 32), catCY = chartPanelTop + 55;
      const catR = 26, catInnerR = 15;

      if (catEntries.length > 0) {
        let catAngle = 0;
        catEntries.forEach(([cat, amt], idx) => {
          const slice = totalExp > 0 ? (amt / totalExp) * 360 : 0;
          if (slice > 0) drawDonutSlice(catCX, catCY, catR, catInnerR, catAngle, catAngle + slice, PALETTE[idx % PALETTE.length]);
          catAngle += slice;
        });
        // Center hole label
        doc.setFillColor(...panel); doc.circle(catCX, catCY, catInnerR - 0.5, 'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...muted);
        doc.text('EXP', catCX, catCY - 2, {align:'center'});
        doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(...red);
        doc.text(fmtPDFS(totalExp), catCX, catCY + 4, {align:'center'});

        // Legend
        const maxLegendItems = catFullWidth ? Math.min(catEntries.length, 12) : Math.min(catEntries.length, 6);
        const cols = catFullWidth ? 2 : 1;
        const itemsPerCol = Math.ceil(maxLegendItems / cols);
        const startY = catCY - ((itemsPerCol - 1) * 11) / 2;
        
        catEntries.slice(0, maxLegendItems).forEach(([cat, amt], idx) => {
          const c = Math.floor(idx / itemsPerCol);
          const r = idx % itemsPerCol;
          const legendX = leftX + (catFullWidth ? 76 + c * 52 : catR * 2 + 8);
          
          const ly = startY + r * 11 + 3; // +3 for text baseline alignment
          const pct = totalExp > 0 ? ((amt/totalExp)*100).toFixed(0) : '0';
          const label = cat.charAt(0).toUpperCase() + cat.slice(1);
          
          doc.setFillColor(...PALETTE[idx % PALETTE.length]); doc.roundedRect(legendX, ly - 3.5, 4.5, 4.5, 0.5, 0.5, 'F');
          
          doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(...white);
          let maxLen = catFullWidth ? 10 : 6;
          let displayLabel = label.length > maxLen ? label.slice(0,maxLen-1)+'..' : label;
          doc.text(displayLabel, legendX + 6.5, ly);
          
          const rightEdgeX = catFullWidth ? legendX + 48 : leftX + catW - 6;
          doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...muted);
          doc.text(fmtPDFS(amt), rightEdgeX, ly, {align:'right'});
          
          doc.setTextColor(...white);
          doc.text(`${pct}%`, rightEdgeX - 22, ly, {align:'right'});
        });
        if (catEntries.length > maxLegendItems) {
          const ly = startY + itemsPerCol * 11 + 3;
          const legendX = leftX + (catFullWidth ? 76 : catR * 2 + 8);
          doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...muted);
          doc.text(`+${catEntries.length - maxLegendItems} more`, legendX, ly);
        }
      } else {
        doc.setFont('helvetica','normal'); doc.setFontSize(9.5); doc.setTextColor(...muted);
        doc.text('No expense data', leftX + catW/2, chartPanelTop + 48, {align:'center'});
      }

      // ── RIGHT: ONLINE vs OFFLINE ──────────────────────────────────────────
      if (catFullWidth) {
        curY = chartPanelTop + 110 + 10;
      }
      const splitPanelTop = catFullWidth ? curY : chartPanelTop;
      const rightX = catFullWidth ? leftX : leftX + sideColW + 6;
      const splitW = catFullWidth ? fullW : sideColW;

      doc.setFillColor(...panel2); doc.roundedRect(rightX, splitPanelTop, splitW, 110, 3, 3, 'F');
      doc.setDrawColor(...borderDark); doc.setLineWidth(0.15); doc.roundedRect(rightX, splitPanelTop, splitW, 110, 3, 3, 'S');
      doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...gold);
      doc.text('PAYMENT CHANNEL SPLIT', rightX + splitW/2, splitPanelTop + 8, {align:'center'});

      const oCX = rightX + (catFullWidth ? 45 : 26), oCY = splitPanelTop + 55;
      const oR = catFullWidth ? 26 : 18, oInnerR = catFullWidth ? 15 : 10;
      const onlinePctVal = totalExp > 0 ? onlineExp / totalExp : 0;
      const offlinePctVal = 1 - onlinePctVal;

      if (totalExp > 0) {
        // Online slice (blue)
        const onlineSlice = onlinePctVal * 360;
        if (onlineSlice > 1) drawDonutSlice(oCX, oCY, oR, oInnerR, 0, onlineSlice, [110,157,200]);
        if (onlineSlice < 359) drawDonutSlice(oCX, oCY, oR, oInnerR, onlineSlice, 360, [157,122,200]);
        // Center hole
        doc.setFillColor(...panel); doc.circle(oCX, oCY, oInnerR - 0.5, 'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...muted);
        doc.text('SPLIT', oCX, oCY - 2, {align:'center'});
        doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(...red);
        doc.text(fmtPDFS(totalExp), oCX, oCY + 4, {align:'center'});

        // Legend items
        const oLegendX = rightX + (catFullWidth ? 100 : oR * 2 + 8);
        const oItems = [
          { label:'Online', pct:(onlinePctVal*100).toFixed(1), amt:onlineExp, color:[110,157,200] },
          { label:'Offline', pct:(offlinePctVal*100).toFixed(1), amt:offlineExp, color:[157,122,200] },
        ].sort((a,b) => b.amt - a.amt);
        const oStartY = oCY - 5;
        oItems.forEach((item, idx) => {
          const ly = oStartY + idx * 14;
          doc.setFillColor(...item.color); doc.roundedRect(oLegendX, ly - 4, 4.5, 4.5, 0.5, 0.5, 'F');
          
          doc.setFont('helvetica','bold'); doc.setFontSize(9.5); doc.setTextColor(...item.color);
          doc.text(`${item.pct}%`, oLegendX + 7, ly);
          
          doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(...muted);
          doc.text(item.label, oLegendX + 24, ly);
          
          const rightEdgeX = catFullWidth ? oLegendX + 60 : rightX + splitW - 6;
          doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...white);
          doc.text(fmtPDFS(item.amt), rightEdgeX, ly, {align:'right'});
        });
      } else {
        doc.setFont('helvetica','normal'); doc.setFontSize(9.5); doc.setTextColor(...muted);
        doc.text('No expense data', rightX + splitW/2, splitPanelTop + 48, {align:'center'});
      }

      curY = splitPanelTop + 110 + 10;
    }

    // ── CATEGORY BREAKDOWN ───────────────────────────────────────────────
    if (incCat && catEntries.length > 0) {
      doc.addPage(); // Give CATEGORY BREAKDOWN the whole page
      curY = 20;
      sectionTitle('CATEGORY BREAKDOWN (EXPENSES)');
      const catRows = catEntries.map(([cat,amt]) => {
        const pct = totalExp > 0 ? ((amt/totalExp)*100).toFixed(1)+'%' : '0%';
        const catLabel = cat.charAt(0).toUpperCase() + cat.slice(1);
        return [catLabel, fmtPDFS(amt), pct];
      });
      doc.autoTable({
        startY: curY, head:[['Category','Amount','Share of Expenses']], body: catRows,
        margin:{left:pL, right:15}, theme:'grid',
        headStyles:{ fillColor: headerBg, textColor: accentStripe, fontStyle:'bold', fontSize:9.5, cellPadding:5 },
        bodyStyles:{ fillColor: panel, textColor: darkText, fontSize:9, cellPadding:4.5, valign:'middle' },
        alternateRowStyles:{ fillColor: altRow },
        columnStyles:{ 0:{}, 1:{cellWidth:44,halign:'right'}, 2:{cellWidth:38,halign:'right'} },
        tableLineColor: bd, tableLineWidth: 0.2,
        didParseCell: (d) => {
          if (d.section === 'body' && d.column.index === 1) {
            d.cell.styles.textColor = red;
            d.cell.styles.fontStyle = 'bold';
          }
          if (d.section === 'body' && d.column.index === 2) {
            d.cell.styles.textColor = muted;
          }
        }
      });
      curY = doc.lastAutoTable.finalY + 12;
    }

    // ── TRANSACTION LIST ─────────────────────────────────────────────────
    if (incList && filtered.length) {
      if (!incCat || catEntries.length >= 7) {
        doc.addPage();
        curY = 20;
      }
      sectionTitle('TRANSACTION LIST');
      
      const hasEvents = filtered.some(t => t.eventId && events[t.eventId]);
      const headRow = hasEvents ? ['Date','Description','Category','Amount','Mode','Event'] : ['Date','Description','Category','Amount','Mode'];
      
      const txRows = filtered.map(t => {
        const d = new Date(t.date + 'T00:00:00');
        // Use standard spaces for date; we remove fixed width so it won't wrap anyway
        const day   = String(d.getDate()).padStart(2, '0');
        const mon   = d.toLocaleString('default', {month:'short'});
        const yr    = d.getFullYear();
        const dateStr = `${day} ${mon} ${yr}`;
        const amtStr = fmtPDF(t.type==='income' ? t.amount : -t.amount, true);
        // Use real spaces after common delimiters (+,/) because jsPDF ignores zero-width spaces for wrapping
        const desc = (t.desc || '(no description)').replace(/([+,/])/g, '$1 ');
        const catLabel = (t.cat||'other').charAt(0).toUpperCase()+(t.cat||'other').slice(1);
        
        const row = [dateStr, desc, catLabel, amtStr, (t.mode||'online')];
        if (hasEvents) {
          row.push(t.eventId && events[t.eventId] ? events[t.eventId].name : '');
        }
        // pass metadata for styling (id, type, event color)
        row.push(t.id, t.type, (t.eventId && events[t.eventId] ? events[t.eventId].color : ''));
        return row;
      });
      doc.autoTable({
        startY: curY, head:[headRow], body: txRows,
        margin:{left:pL, right:15}, theme:'grid',
        headStyles:{ fillColor: headerBg, textColor: accentStripe, fontStyle:'bold', fontSize:8.5, cellPadding:4 },
        bodyStyles:{ fillColor: panel, textColor: darkText, fontSize:8.5, cellPadding:3.5, valign:'middle' },
        alternateRowStyles:{ fillColor: altRow },
        columnStyles: hasEvents 
          ? { 0:{cellWidth: 'wrap', halign:'left'}, 1:{}, 2:{cellWidth: 26}, 3:{cellWidth: 'wrap', halign:'right'}, 4:{cellWidth: 16,halign:'center'}, 5:{cellWidth: 24} }
          : { 0:{cellWidth: 'wrap', halign:'left'}, 1:{}, 2:{cellWidth: 26}, 3:{cellWidth: 'wrap', halign:'right'}, 4:{cellWidth: 16,halign:'center'} },
        tableLineColor: bd, tableLineWidth: 0.15,
        didParseCell: (d) => {
          if (d.section==='body') {
            const idIdx = hasEvents ? 6 : 5;
            const typeIdx = hasEvents ? 7 : 6;
            const colorIdx = hasEvents ? 8 : -1;
            
            const isLargest = largestTx && d.row.raw[idIdx] === largestTx.id;
            const evHex = hasEvents ? d.row.raw[colorIdx] : '';
            
            // Amount column: green for income, red for expense
            if (d.column.index === 3) {
              d.cell.styles.textColor = d.row.raw[typeIdx] === 'income' ? green : red;
              d.cell.styles.fontStyle = 'bold';
            }
            
            // Event column: use event background color + auto-computed readable text color
            if (hasEvents && d.column.index === 5 && evHex) {
              const rgb = hexToRgb(evHex);
              if (rgb) {
                d.cell.styles.fillColor = rgb;
                d.cell.styles.textColor = getContrastColor(evHex);
                d.cell.styles.fontStyle = 'bold';
              }
            }
            
            // Highlight largest transaction row (golden highlight, skip event cell)
            if (isLargest && (!hasEvents || d.column.index !== 5)) {
              d.cell.styles.fillColor = goldLight;
              d.cell.styles.textColor = [100, 70, 5];
              d.cell.styles.fontStyle = 'bold';
            }
          }
          if (d.section==='head') {
            // Keep amount header aligned
            if (d.column.index === 3) d.cell.styles.halign = 'right';
            if (d.column.index === 4) d.cell.styles.halign = 'center';
          }
        }
      });
    }

    // ── FOOTER on every page ─────────────────────────────────────────────
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      // Footer background
      doc.setFillColor(...headerBg); doc.rect(0, H - 13, W, 13, 'F');
      // Accent top stripe
      doc.setFillColor(...accentStripe); doc.rect(0, H - 13, W, 1.5, 'F');
      // Footer text
      doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...headerMuted);
      doc.text('Flux — Personal Finance Dashboard', pL, H - 5);
      doc.setTextColor(...accentStripe);
      doc.text(`${i} / ${totalPages}`, pR, H - 5, {align:'right'});
    }

    // Save
    const fileName = `flux-report-${fromDate}-to-${toDate}.pdf`;
    doc.save(fileName);
    closeReportMod();
    showToast('PDF downloaded', 'ok');
  } catch(e) {
    console.error('PDF generation error:', e);
    showToast('PDF failed: ' + (e?.message||'Unknown error'), 'er');
  } finally {
    btn.disabled = false; btn.innerHTML = '📄 Generate & Download PDF';
  }
}

function askClearLogs() {
  if (activityLogs.length === 0) { showToast('No logs to clear', 'ok'); return; }
  clearLogs();
}

function esc(str) { return str.replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

document.getElementById('reportMod').addEventListener('click', function(e) { if (e.target === this) closeReportMod(); });

function switchTab(tab) {
  document.getElementById('tabDash').classList.toggle('act', tab === 'dashboard');
  document.getElementById('tabSub').classList.toggle('act', tab === 'subscriptions');
  document.getElementById('tabLog').classList.toggle('act', tab === 'log');
  document.getElementById('dashboardView').style.display = tab === 'dashboard' ? 'block' : 'none';
  document.getElementById('subView').style.display = tab === 'subscriptions' ? 'block' : 'none';
  document.getElementById('logView').style.display = tab === 'log' ? 'block' : 'none';
  
  const fab = document.getElementById('fab');
  if (fab) fab.style.display = tab === 'dashboard' ? '' : 'none';
  
  if (tab === 'dashboard') renderTrend();
  if (tab === 'log') renderLogs();
  if (tab === 'subscriptions') renderRecurring();
}

function clearLogs() {
  if (!userId) { showToast('Sign in to clear logs', 'er'); return; }
  
  if (_undoClearLogsTimer) {
    clearTimeout(_undoClearLogsTimer);
    commitClearLogs();
  }
  
  _undoClearLogsData = [...activityLogs];
  
  activityLogs = [];
  renderLogs();
  
  const el = document.getElementById('toast');
  el.innerHTML = 'Activity log cleared <button class="undo-btn" onclick="undoClearLogs()">↺ Undo</button>';
  el.className = 'tst er sh';
  clearTimeout(el._t);
  
  _undoClearLogsTimer = setTimeout(() => {
    commitClearLogs();
    el.className = 'tst';
  }, 5000);
}

async function commitClearLogs() {
  if (!_undoClearLogsData) return;
  const refsToDelete = _undoClearLogsData.map(l => doc(db, 'users', userId, 'activities', l.id));
  _undoClearLogsData = null;
  _undoClearLogsTimer = null;
  
  try {
    for (let i = 0; i < refsToDelete.length; i += 450) {
      const chunk = refsToDelete.slice(i, i + 450);
      const batch = writeBatch(db);
      chunk.forEach(ref => batch.delete(ref));
      await batch.commit();
    }
  } catch (e) {
    console.error('Error clearing activity log:', e);
  }
}

function undoClearLogs() {
  if (!_undoClearLogsData || !userId) return;
  if (_undoClearLogsTimer) { clearTimeout(_undoClearLogsTimer); _undoClearLogsTimer = null; }
  
  const el = document.getElementById('toast');
  el.className = 'tst';
  
  activityLogs = _undoClearLogsData;
  _undoClearLogsData = null;
  renderLogs();
}

window.addTx = addTx;
window.askDelTx = askDelTx;
window.editTx = editTx;
window.closeEditMod = closeEditMod;
window.saveEditTx = saveEditTx;
window.exportCSV = exportCSV;
window.doImport = doImport;
window.closeMod = closeMod;
window.attemptImport = attemptImport; 
window.setStatsMode = setStatsMode;
window.updStatsDt = updStatsDt;
window.clearStatsDt = clearStatsDt;
window.setTrendMode = setTrendMode;
window.undoDelete = undoDelete;
window.setType = setType;
window.setMode = setMode;
window.setDt = setDt;
window.setF = setF;
window.setModeFilt = setModeFilt;
window.updECat = updECat;
window.updateMapping = updateMapping;
window.setImpFilt = setImpFilt;
window.togYr = togYr;
window.lazyLoadMonthTxs = lazyLoadMonthTxs;
window.toggleAuth = toggleAuth;
window.closeConfirm = closeConfirm;
window.updCustomDt = updCustomDt;
window.clearCustomDt = clearCustomDt;
window.loadMoreTx = loadMoreTx;
window.setTxSearch = setTxSearch;
window.setLogSearch = function(val) { cLogSearch = val.toLowerCase(); renderLogs(); };
window.scrollToForm = scrollToForm;
window.setEventFilter = setEventFilter;
window.showCreateEvent = showCreateEvent;
window.showEditEvent = showEditEvent;
window.applyEventToTxs = applyEventToTxs;
window.askDeleteEvent = askDeleteEvent;
window.closeEventMod = closeEventMod;
window.saveEventMod = saveEventMod;
window.installPWA = installPWA;
window.dismissPWA = dismissPWA;
window.toggleCatFilter = toggleCatFilter;
window.closeCatPanel = closeCatPanel;
window.loadMoreCatTx = loadMoreCatTx;
window.switchTab = switchTab;
window.renderLogs = renderLogs;
window.askClearLogs = askClearLogs;
window.undoClearLogs = undoClearLogs;
window.clearLogs = clearLogs;
window.setSplitView = setSplitView;
// Recurring
window.openAddRecurring = openAddRecurring;
window.openEditRecurring = openEditRecurring;
window.closeRecurringMod = closeRecurringMod;
window.saveRecurringMod = saveRecurringMod;
window.setRecType = setRecType;
window.setRecFreq = setRecFreq;
window.toggleRecurringActive = toggleRecurringActive;
window.askDeleteRecurring = askDeleteRecurring;
// PDF
window.openReportMod = openReportMod;
window.closeReportMod = closeReportMod;
window.setReportPeriod = setReportPeriod;
window.generatePDF = generatePDF;

// ── PWA: Service Worker Registration & Install Prompt ──
let _deferredPrompt = null;

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    console.log('[PWA] Service Worker registered, scope:', reg.scope);
  }).catch((err) => {
    console.warn('[PWA] SW registration failed:', err);
  });
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  _deferredPrompt = e;
  // Show install snackbar unless user previously dismissed it
  if (!sessionStorage.getItem('flux_pwa_dismissed')) {
    const bar = document.getElementById('pwaSnackbar');
    if (bar) {
      bar.classList.add('vis');
      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        if (bar.classList.contains('vis')) dismissPWA();
      }, 5000);
    }
  }
});

function installPWA() {
  if (!_deferredPrompt) return;
  _deferredPrompt.prompt();
  _deferredPrompt.userChoice.then((result) => {
    if (result.outcome === 'accepted') {
      showToast('Flux installed! Find it on your home screen.', 'ok');
    }
    _deferredPrompt = null;
    const bar = document.getElementById('pwaSnackbar');
    if (bar) bar.classList.remove('vis');
  });
}

function dismissPWA() {
  const bar = document.getElementById('pwaSnackbar');
  if (bar) bar.classList.remove('vis');
  sessionStorage.setItem('flux_pwa_dismissed', '1');
}

window.addEventListener('appinstalled', () => {
  const bar = document.getElementById('pwaSnackbar');
  if (bar) bar.classList.remove('vis');
  _deferredPrompt = null;
});

// -- Skeleton Loading Placeholders --
function showSkeletons() {
  const txList = document.getElementById('txList');
  if (txList) {
    txList.innerHTML = Array.from({length: 5}, () =>
      `<div class="skel-row"><div class="skel skel-circle"></div><div style="flex:1;display:flex;flex-direction:column;gap:6px"><div class="skel skel-bar w80"></div><div class="skel skel-bar w40" style="height:8px"></div></div><div class="skel skel-amt"></div></div>`
    ).join('');
  }
  const trendArea = document.getElementById('trendArea');
  if (trendArea) {
    trendArea.innerHTML = '<div class="skel-block"><div class="skel skel-line tall w80"></div><div class="skel skel-line w60"></div><div class="skel skel-line" style="height:100px"></div></div>';
  }
  const ctArea = document.getElementById('ctArea');
  if (ctArea) {
    ctArea.innerHTML = '<div class="skel-block"><div class="skel skel-line" style="height:12px;border-radius:6px"></div><div style="display:flex;gap:8px;flex-wrap:wrap">' +
      Array.from({length: 4}, () => '<div class="skel skel-line" style="width:80px;height:32px;border-radius:8px"></div>').join('') + '</div></div>';
  }
  const spArea = document.getElementById('spArea');
  if (spArea) {
    spArea.innerHTML = '<div class="skel-block"><div class="skel skel-line" style="height:12px;border-radius:6px"></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div class="skel skel-line" style="height:80px;border-radius:12px"></div><div class="skel skel-line" style="height:80px;border-radius:12px"></div></div></div>';
  }
}

// -- Scroll-to-Top Button --
function initScrollTop() {
  const btn = document.getElementById('scrollTopBtn');
  if (!btn) return;
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      btn.classList.toggle('vis', window.scrollY > 400);
      ticking = false;
    });
  }, { passive: true });
}

// -- Swipe-to-Action (Mobile Touch) -- panel width must match CSS .txi-actions width
const SWIPE_ACTION_PX = 84;

// Reusable swipe-to-action attachment for any container with .txi-wrap items
function attachSwipeToContainer(container) {
  if (!container || !('ontouchstart' in window)) return;
  let startX, startY, currentWrap, swiping;
  const THRESHOLD = 50;
  function resetAll(except) {
    container.querySelectorAll('.txi-wrap.swiped-left,.txi-wrap.swiped-right').forEach(w => {
      if (w === except) return;
      w.classList.remove('swiped-left','swiped-right','swiping');
      const inner = w.querySelector('.txi');
      if (inner) inner.style.transform = '';
    });
  }
  container.addEventListener('touchstart', (e) => {
    const wrap = e.target.closest('.txi-wrap');
    if (!wrap) return;
    resetAll(wrap);
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    currentWrap = wrap;
    swiping = false;
  }, { passive: true });
  container.addEventListener('touchmove', (e) => {
    if (!currentWrap) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (!swiping && Math.abs(dy) > Math.abs(dx)) { currentWrap = null; return; }
    if (Math.abs(dx) > 10) swiping = true;
    if (!swiping) return;
    e.preventDefault();
    currentWrap.classList.add('swiping');
    const clamped = Math.max(-SWIPE_ACTION_PX - 20, Math.min(SWIPE_ACTION_PX + 20, dx));
    const inner = currentWrap.querySelector('.txi');
    if (inner) inner.style.transform = 'translateX(' + clamped + 'px)';
  }, { passive: false });
  container.addEventListener('touchend', () => {
    if (!currentWrap) return;
    currentWrap.classList.remove('swiping');
    const inner = currentWrap.querySelector('.txi');
    if (!inner) { currentWrap = null; return; }
    const tmatch = inner.style.transform.match(/translateX\((-?[\d.]+)px\)/);
    const dx = tmatch ? parseFloat(tmatch[1]) : 0;
    if (dx < -THRESHOLD) {
      inner.style.transform = 'translateX(-' + SWIPE_ACTION_PX + 'px)';
      currentWrap.classList.add('swiped-left');
      currentWrap.classList.remove('swiped-right');
    } else if (dx > THRESHOLD) {
      inner.style.transform = 'translateX(' + SWIPE_ACTION_PX + 'px)';
      currentWrap.classList.add('swiped-right');
      currentWrap.classList.remove('swiped-left');
    } else {
      inner.style.transform = '';
      currentWrap.classList.remove('swiped-left','swiped-right');
    }
    currentWrap = null;
  }, { passive: true });
}

function initSwipeActions() {
  if (!('ontouchstart' in window)) return;
  const txList = document.getElementById('txList');
  if (txList) attachSwipeToContainer(txList);
  // Global reset when tapping outside any swipe wrap
  document.addEventListener('touchstart', (e) => {
    if (!e.target.closest('.txi-wrap')) {
      document.querySelectorAll('.txi-wrap.swiped-left,.txi-wrap.swiped-right').forEach(w => {
        w.classList.remove('swiped-left','swiped-right','swiping');
        const inner = w.querySelector('.txi');
        if (inner) inner.style.transform = '';
      });
    }
  }, { passive: true });
}

// -- Celebration Confetti --
function launchConfetti() {
  const canvas = document.createElement('canvas');
  canvas.id = 'confettiCanvas';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const colors = ['#c8a96e','#5dba8a','#e07070','#6e9dc8','#9d7ac8','#f0c040'];
  const particles = [];
  for (let i = 0; i < 80; i++) {
    particles.push({
      x: canvas.width / 2, y: canvas.height * 0.4,
      vx: (Math.random() - 0.5) * 20,
      vy: Math.random() * -16 - 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 6 + 3,
      rot: Math.random() * 360,
      rotV: (Math.random() - 0.5) * 12,
      grav: 0.45 + Math.random() * 0.15,
      alpha: 1,
      decay: 0.007 + Math.random() * 0.007
    });
  }
  function frame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    particles.forEach(p => {
      if (p.alpha <= 0) return;
      alive = true;
      p.x += p.vx; p.vy += p.grav; p.y += p.vy;
      p.vx *= 0.98; p.rot += p.rotV; p.alpha -= p.decay;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    });
    if (alive) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}

// -- Parallax on Summary Cards --
function initParallax() {
  if (window.innerWidth < 768) return;
  const cards = document.querySelectorAll('.sc.card-in');
  if (!cards.length) return;
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      cards.forEach((card, i) => {
        const rect = card.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          const offset = (rect.top - window.innerHeight / 2) * 0.03 * (1 + i * 0.12);
          card.style.setProperty('--py', offset.toFixed(1) + 'px');
          card.classList.add('parallax-active');
        }
      });
      ticking = false;
    });
  }, { passive: true });
}

// -- Autocomplete for Description Input --
function initAutocomplete() {
  const input = document.getElementById('txD');
  if (!input) return;
  const wrap = input.parentElement;
  wrap.style.position = 'relative';
  const list = document.createElement('div');
  list.className = 'ac-list';
  list.id = 'acList';
  wrap.appendChild(list);
  let selIdx = -1;
  function show() {
    const val = input.value.trim().toLowerCase();
    if (!val) { list.classList.remove('vis'); return; }
    const descs = [...new Set(txs.map(t => t.desc))];
    const matches = descs.filter(d => d.toLowerCase().includes(val)).slice(0, 8);
    if (!matches.length) { list.classList.remove('vis'); return; }
    selIdx = -1;
    list.innerHTML = matches.map((m, i) => {
      // V6: Use the existing esc() function which properly handles single quotes too
      const safe = esc(m);
      return '<div class="ac-item" data-idx="' + i + '" data-val="' + safe + '">' + safe + '</div>';
    }).join('');
    list.classList.add('vis');
  }
  input.addEventListener('input', show);
  input.addEventListener('focus', show);
  list.addEventListener('mousedown', (e) => {
    const item = e.target.closest('.ac-item');
    if (item) { input.value = item.dataset.val; list.classList.remove('vis'); }
  });
  input.addEventListener('blur', () => setTimeout(() => list.classList.remove('vis'), 150));
  input.addEventListener('keydown', (e) => {
    const items = list.querySelectorAll('.ac-item');
    if (!items.length || !list.classList.contains('vis')) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selIdx = Math.min(selIdx + 1, items.length - 1);
      items.forEach((it, i) => it.classList.toggle('sel', i === selIdx));
      items[selIdx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selIdx = Math.max(selIdx - 1, 0);
      items.forEach((it, i) => it.classList.toggle('sel', i === selIdx));
      items[selIdx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && selIdx >= 0) {
      e.preventDefault();
      input.value = items[selIdx].dataset.val;
      list.classList.remove('vis');
    } else if (e.key === 'Escape') {
      list.classList.remove('vis');
    }
  });
}

