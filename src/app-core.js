/* ===== Jádro ===== */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = sel => document.querySelector(sel);
const App = { view: 'dnes', date: todayISO(), week: mondayOf(todayISO()), ro: false, moreOpen: false, preview: false, coachPlan: false, openCourse: null };
const A = {};  // akce
const oid = (p, k) => `${p}:${Store.ownerId()}:${k}`;  // id unikátní napříč uživateli

/* ---- data ---- */
function settingsRec() { const uid = Store.ownerId(); return Store.rows('settings').find(r => r.user_id === uid); }
function S() {
  const rec = settingsRec();
  const d = { ...SEED.settings, ...(rec ? rec.data : {}) };
  d.courses = (rec && rec.data.courses) || SEED.settings.courses;
  d.met = SEED.met; d.phase_thresholds = SEED.phase_thresholds; d.phases = SEED.phases;
  return d;
}
function saveSettings(data) { const uid = Store.ownerId(); const old = settingsRec(); Store.put('settings', 'settings:' + uid, { ...(old ? { coach_note: old.data.coach_note, coach_note_at: old.data.coach_note_at } : {}), ...data }, uid); }
function saveCoachNote(text) { const uid = Store.ownerId(); const old = settingsRec(); Store.put('settings', 'settings:' + uid, { ...(old ? old.data : SEED.settings), coach_note: text, coach_note_at: new Date().toISOString() }, uid); }
/* globální data = seed ze sešitu přepsaný tím, co je v databázi (podle id); smazané v DB mizí */
function mergedGlobal(table, seedRows) {
  const map = new Map(seedRows.map(r => [r.id, { ...r, seed: true }]));
  Store.db[table].filter(r => r.user_id == null).forEach(r => { map.set(r.id, { id: r.id, ...r.data, deleted: !!r.deleted }); });
  return [...map.values()];
}
function Foods() {
  const uid = Store.ownerId();
  const mine = Store.rows('foods').filter(r => r.user_id === uid && r.user_id != null);
  const own = mine.filter(r => !r.data.overrides).map(r => ({ id: r.id, ...r.data, own: true }));
  const ov = Object.fromEntries(mine.filter(r => r.data.overrides).map(r => [r.data.overrides, r]));   // vlastni verze globalni potraviny
  const glob = mergedGlobal('foods', SEED.foods).filter(f => !f.deleted).map(f => ov[f.id] ? { ...f, ...ov[f.id].data, id: f.id, overrides: undefined, overridden: true, ovId: ov[f.id].id } : f);
  return glob.concat(own).sort((a, b) => (a.cat + a.name).localeCompare(b.cat + b.name, 'cs'));
}
/* uživatelské preference: oblíbené recepty, naposledy použité */
function Prefs() { const r = Store.rows('prefs', Store.ownerId()).find(x => x.id === oid('p', 'main')); return r ? r.data : { favs: [], recent: [] }; }
function savePrefs(d) { Store.put('prefs', oid('p', 'main'), d); }
function isFav(name) { return Prefs().favs.includes(name); }
function toggleFav(name) { const p = Prefs(); p.favs = p.favs.includes(name) ? p.favs.filter(x => x !== name) : p.favs.concat([name]); savePrefs(p); }
function noteRecent(name) { if (!name || name === SITUACE || name === VYNECHAT) return; const p = Prefs(); p.recent = [name].concat((p.recent || []).filter(x => x !== name)).slice(0, 30); savePrefs(p); }
function coachNote() { const r = settingsRec(); return r && r.data.coach_note ? r.data.coach_note : null; }
function recipesFor(courseName) { return Recipes().filter(r => r.course === courseName && r.name && !r.deleted).sort((a, b) => (a.own === b.own ? (a.num || 0) - (b.num || 0) : (a.own ? 1 : -1))); }
function Meas() { return Store.rows('measurements', Store.ownerId()).map(r => ({ id: r.id, ...r.data })); }
function saveMeas(m) { Store.put('measurements', oid('m', m.date), m); }
function getDay(date) {
  const r = Store.rows('days', Store.ownerId()).find(x => x.data.date === date);
  return r ? JSON.parse(JSON.stringify(r.data)) : { date, meals: {}, walk_min: null, walk_kmh: null, exercise_min: 0, beers: 0, fried_g: 0, fromPlan: true };
}
function saveDay(day) { Store.put('days', oid('d', day.date), day); }
function getWeek(monday) {
  const r = Store.rows('week_plans', Store.ownerId()).find(x => x.data.week === monday);
  return r ? JSON.parse(JSON.stringify(r.data)) : { week: monday, plan: [[null, null, null, null, null], [null, null, null, null, null], [null, null, null, null, null], [null, null, null, null, null], [null, null, null, null, null], [null, null, null, null, null], [null, null, null, null, null]] };
}
function saveWeek(w) { Store.put('week_plans', oid('w', w.week), w); }
function getShop(monday) { const r = Store.rows('shopping', Store.ownerId()).find(x => x.data.week === monday); return r ? r.data : { week: monday, checked: {} }; }
function currentWeight() { return calcOverview(S(), Meas()).cur; }
/* den s doplněním z plánu: pokud den nemá vlastní volbu chodu, bere se plán týdne */
function effectiveDay(date) {
  const day = getDay(date);
  const wk = getWeek(mondayOf(date)); const sels = wk.plan[dayIndex(date)];
  const s = S();
  s.courses.forEach((c, i) => { if (!day.meals[c.key]) day.meals[c.key] = {}; if (day.meals[c.key].sel === undefined) day.meals[c.key].sel = sels[i] || null; day.meals[c.key].planned = sels[i] || null; });
  if (day.walk_kmh == null) day.walk_kmh = s.walk_kmh;
  try { day.act = dayAct(date, day, currentWeight()); if (day.act.walk_kmh && getDay(date).walk_kmh == null) day.walk_kmh = day.act.walk_kmh; } catch (e) { }
  return day;
}

/* ---- Zpet (jedna uroven) ---- */
const Undo = { cap: null, last: null,
  run(label, fn, after) { this.cap = []; try { fn(); } finally { const ch = this.cap; this.cap = null; if (ch.length) this.last = { label, ch }; }
    const msg = typeof after === 'function' ? after() : (after || label);
    UI.toast(msg, this.last && this.last.label === label ? () => Undo.undo() : null); },
  record(t, id) { if (!this.cap) return; if (this.cap.some(c => c.t === t && c.id === id)) return; const r = Store.db[t].find(x => x.id === id); this.cap.push({ t, id, prev: r ? JSON.parse(JSON.stringify(r)) : null }); },
  undo() { if (!this.last) return; const ch = this.last; this.last = null;
    ch.ch.forEach(c => { if (c.prev) Store.put(c.t, c.id, c.prev.data, c.prev.user_id, c.prev.deleted); else Store.remove(c.t, c.id); });
    render(); UI.toast('Vráceno: ' + ch.label); }
};
const _put = Store.put.bind(Store), _rm = Store.remove.bind(Store);
Store.put = function (t, id, data, userId, deleted) { Undo.record(t, id); const r = _put(t, id, data, userId); if (deleted) { r.deleted = true; this.save(t); this.queue(t, r); } return r; };
Store.remove = function (t, id) { Undo.record(t, id); return _rm(t, id); };

/* ---- UI ---- */
const UI = {
  toast(msg, undoFn, btnLabel) { const t = $('#toast'); t.innerHTML = `<span>${esc(msg)}</span>${undoFn ? `<button class="ubtn" id="undo-btn">${esc(btnLabel || 'Zpět')}</button>` : ''}`; if (undoFn) t.querySelector('#undo-btn').onclick = () => { t.classList.remove('on'); undoFn(); }; t.classList.add('on'); clearTimeout(this._t); this._t = setTimeout(() => t.classList.remove('on'), undoFn ? 9000 : 3000); },
  syncBadge() {
    const el = $('#syncb'); if (!el) return;
    if (Store.localMode()) { el.innerHTML = '<span class="dot off"></span>bez cloudu'; return; }
    if (!navigator.onLine) { el.innerHTML = `<span class="dot off"></span>offline${Store.outbox.length ? ' · ' + Store.outbox.length + ' čeká' : ''}`; return; }
    if (Store.lastError) { el.innerHTML = `<span class="dot err" title="${esc(Store.lastError)}"></span>chyba sync`; return; }
    if (Store.syncing || Store.outbox.length) { el.innerHTML = `<span class="dot busy"></span>ukládám…`; return; }
    el.innerHTML = '<span class="dot"></span>uloženo';
  },
  modal(html, opts) {
    const m = document.createElement('div'); m.className = 'modal'; m.innerHTML = `<div class="box">${html}</div>`;
    if (opts && opts.guardEdits) {   // editor: nezavírat rozdělanou práci bez zeptání
      const dirty = () => { m._dirty = true; };
      m.addEventListener('input', dirty); m.addEventListener('change', dirty);
      m._guard = () => !!m._dirty;
    }
    m.addEventListener('click', e => { if (e.target === m) UI.tryClose(m); });
    document.body.appendChild(m); return m;
  },
  /* zavřít okno – s otázkou, pokud v něm něco rozdělaného zůstalo */
  tryClose(m) {
    if (!m) return;
    if (m._guard && m._guard()) { m._guard = null; UI.confirm('Zavřít bez uložení? Rozdělané změny se ztratí.', () => m.remove(), 'Zavřít a zahodit'); return; }
    m.remove();
  },
  closeModal() { const all = document.querySelectorAll('.modal'); UI.tryClose(all[all.length - 1]); },
  confirm(text, onYes, yesLabel) { const m = this.modal(`<p>${esc(text)}</p><div class="row"><button class="btn danger" id="cy">${esc(yesLabel || 'Ano')}</button><button class="btn sec" onclick="UI.closeModal()">Zpět</button></div>`); m.querySelector('#cy').onclick = () => { m.remove(); onYes(); }; }
};

const NAV_CLIENT = [['dnes', 'Dnes'], ['tyden', 'Týden'], ['prehled', 'Přehled'], ['mereni', 'Měření'], ['nakup', 'Nákup'], ['vareni', 'Vaření'], ['recepty', 'Recepty'], ['suroviny', 'Suroviny'], ['navod', 'Návod']];
const NAV_COACH = [['klient', 'Dashboard'], ['zprava', 'Zpráva'], ['trenink', 'Trénink'], ['nastaveni', 'Nastavení'], ['databaze', 'Databáze'], ['dnes', 'Dnes'], ['tyden', 'Týden'], ['prehled', 'Přehled'], ['mereni', 'Měření'], ['nakup', 'Nákup'], ['vareni', 'Vaření'], ['recepty', 'Recepty'], ['suroviny', 'Suroviny'], ['navod', 'Návod']];
const MOB_MAIN_CLIENT = ['dnes', 'tyden', 'prehled', 'mereni'];
const MOB_MAIN_COACH = ['klient', 'trenink', 'nastaveni', 'dnes'];
const ICONS = {
  dnes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  mereni: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M12 12l3-3"/><path d="M7 15h10"/></svg>',
  prehled: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19V5"/><path d="M4 19h16"/><path d="M7 15l4-5 3 3 5-7"/></svg>',
  tyden: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  zprava: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>',
  trenink: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 10v4M21 10v4M6 8v8M18 8v8M6 12h12"/></svg>',
  klient: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>',
  nastaveni: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.2-1.6l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2.8-1.6L13.3 2h-2.6l-.4 2.8a7 7 0 0 0-2.8 1.6l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .5.1 1.1.2 1.6l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2.8 1.6l.4 2.8h2.6l.4-2.8a7 7 0 0 0 2.8-1.6l2.3.9 2-3.4-2-1.5c.1-.5.2-1.1.2-1.6z"/></svg>',
  databaze: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>'
};

function realCoach() { return Store.profile && Store.profile.role === 'coach'; }
function isCoach() { return realCoach() && !App.preview; }
A.togglePreview = () => { App.preview = !App.preview; App.coachPlan = false; App.view = App.preview ? 'dnes' : 'klient'; render(); UI.toast(App.preview ? 'Vidíš appku Robertovými očima – jen náhled, nic se neuloží.' : 'Zpět v trenérském pohledu.'); };
/* Plánování za klienta: primárně si den skládá sám, tohle je pojistka pro trenéra. */
A.toggleCoachPlan = () => { App.coachPlan = !App.coachPlan; render(); UI.toast(App.coachPlan ? 'Plánuješ za Roberta – co uložíš, uvidí u sebe.' : 'Zpátky jen na koukání.'); };
function nav() { return isCoach() ? NAV_COACH : NAV_CLIENT; }
function go(v) { App.view = v; App.moreOpen = false; UI.closeModal(); render(); window.scrollTo(0, 0); }

function renderShell() {
  const items = nav();
  const main = isCoach() ? MOB_MAIN_COACH : MOB_MAIN_CLIENT;
  const label = v => items.find(x => x[0] === v)[1];
  const deskItems = items;
  $('#nav-desk').innerHTML = deskItems.map(([v, l]) => `<button class="${App.view === v ? 'on' : ''}" onclick="go('${v}')">${l}</button>`).join('') + `<button class="${App.view === 'ucet' ? 'on' : ''}" onclick="go('ucet')" title="Účet, připomínky, záloha">⚙︀ Účet</button>` + (realCoach() ? `<button class="${App.preview ? 'on' : ''}" onclick="A.togglePreview()" title="Náhled Robertova rozhraní">👁️ ${App.preview ? 'Zpět do trenéra' : 'Pohled Roberta'}</button>` : '');
  $('#nav-mob').innerHTML = main.map(v => `<button class="${App.view === v ? 'on' : ''}" onclick="go('${v}')">${ICONS[v]}${label(v)}</button>`).join('') +
    `<button class="${!main.includes(App.view) ? 'on' : ''}" onclick="go('more')">${ICONS.more}Více</button>`;
  $('#who').textContent = App.preview ? 'náhled Roberta' : (isCoach() ? 'trenér' : 'Robert');
  if (!realCoach()) autoClosePast();
  UI.syncBadge();
}

function render() {
  if (!Store.profile) { renderLogin(); return; }
  $('#login').classList.remove('on'); $('#app').classList.add('on');
  App.ro = realCoach() && ((App.preview && !App.coachPlan) || (!App.preview && !['klient', 'zprava', 'trenink', 'nastaveni', 'databaze', 'suroviny', 'recepty', 'more', 'ucet'].includes(App.view)));
  renderShell();
  const el = $('#main'); el.className = App.ro ? 'wrap ro' : 'wrap';
  const V = VIEWS[App.view] || VIEWS.dnes;
  let head = '';
  if (isCoach() && Store.clients.length > 1 && App.view !== 'databaze') head = `<div class="row small muted" style="margin-bottom:8px">Klient: <select style="width:auto;min-height:30px;padding:3px 8px" onchange="Store.clientId=this.value;LS.set('clientId',this.value);render()">${Store.clients.map(c => `<option value="${c.id}" ${c.id === Store.clientId ? 'selected' : ''}>${esc(c.display_name || c.name || c.email || c.id.slice(0, 8))}</option>`).join('')}</select></div>`;
  const planBtns = `<span class="row" style="gap:6px"><button class="btn sec sm" style="pointer-events:auto" onclick="A.toggleCoachPlan()">${App.coachPlan ? '👁️ Jen koukat' : '✏️ Plánovat za Roberta'}</button><button class="btn sm" style="pointer-events:auto" onclick="A.togglePreview()">Zpět do trenéra</button></span>`;
  if (App.ro) head += `<div class="notice row between" style="margin-bottom:10px"><span>${App.preview ? '👁️ Robertův pohled – přesně to, co vidí on. Jen náhled, nic se neuloží.' : 'Náhled na Robertova data – jen ke čtení.'}</span>${App.preview ? planBtns : ''}</div>`;
  else if (App.preview && App.coachPlan) head += `<div class="notice warn row between" style="margin-bottom:10px"><span>✏️ Plánuješ za Roberta – co tu uložíš, uvidí u sebe. Normálně si den skládá sám.</span>${planBtns}</div>`;
  el.innerHTML = head + V();
}

/* ---- přihlášení ---- */
/* Přístupy bez cloudu (jen bariéra proti omylu – v souboru jsou čitelné; skutečné ověření dělá Supabase) */
const LOCAL_USERS = { 'r.pesek24@gmail.com': { pw: 'mamnato', role: 'client' }, 'rehor.rudolf@gmail.com': { pw: '06392', role: 'coach' } };
function renderLogin() {
  $('#app').classList.remove('on'); const L = $('#login'); L.classList.add('on');
  // jedna přihlašovací obrazovka pro všechny – jestli je to trenér nebo klient, řekne profil
  L.innerHTML = `<div class="card"><div class="hero-logo pic"><img src="logo.png" alt=""></div><h1>YesYouCan</h1><p class="muted small" style="margin:6px 0 14px">Přihlaš se e-mailem a heslem.</p>
    <div class="in"><label class="f">E-mail</label><input type="email" id="lem" autocomplete="username"></div>
    <div class="in" style="margin-top:8px"><label class="f">Heslo</label><input type="password" id="lpw" autocomplete="current-password"></div>
    <div id="lerr" class="bad small" style="margin-top:8px"></div>
    <div class="row" style="margin-top:12px"><button class="btn" id="lbtn" onclick="doLogin()">Přihlásit</button>${Store.localMode() ? '' : '<button class="btn sec" onclick="doReset()">Zapomenuté heslo</button>'}</div>
    ${Store.localMode() ? '<p class="tiny muted" style="margin-top:8px">Režim bez cloudu: data zůstávají v tomto prohlížeči.</p>' : ''}</div>`;
  $('#lpw').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  $('#lem').focus();
}
function localLogin(role) {
  Store.profile = { id: role === 'coach' ? 'local-coach' : 'local-client', role, local: true }; LS.set('profile', Store.profile);
  Store.clients = [{ id: 'local-client', display_name: 'Robert' }]; Store.clientId = 'local-client';
  App.view = role === 'coach' ? 'klient' : 'dnes'; render();
}
async function doLogin() {
  const b = $('#lbtn'); b.disabled = true; $('#lerr').textContent = '';
  if (Store.localMode()) { const em = $('#lem').value.trim().toLowerCase(), u = LOCAL_USERS[em]; if (u && u.pw === $('#lpw').value) { localLogin(u.role); } else $('#lerr').textContent = 'Špatný e-mail nebo heslo.'; b.disabled = false; return; }
  try { await Store.signIn($('#lem').value.trim(), $('#lpw').value); await afterLogin(); }
  catch (e) { $('#lerr').textContent = 'Přihlášení se nepovedlo: ' + (e.message === 'Invalid login credentials' ? 'špatný e-mail nebo heslo.' : e.message); }
  b.disabled = false;
}
async function doReset() {
  const em = $('#lem').value.trim(); if (!em) { $('#lerr').textContent = 'Napiš svůj e-mail a pak klikni na Zapomenuté heslo.'; return; }
  try { await Store.resetPassword(em); $('#lerr').innerHTML = '<span class="ok">Odkaz na nové heslo je v e-mailu.</span>'; } catch (e) { $('#lerr').textContent = e.message; }
}
async function afterLogin() {
  await Store.loadProfile();
  if (Store.profile.missing) { $('#login').innerHTML = `<div class="card"><h2>Účet zatím nemá roli</h2><p class="small muted" style="margin-top:8px">Trenér musí v Supabase v tabulce <b>profiles</b> přidat řádek s tvým ID a rolí (viz NAVOD.md). Pak se přihlaš znovu.</p><button class="btn sec" onclick="Store.signOut().then(render)">Odhlásit</button></div>`; Store.profile = null; return; }
  App.view = isCoach() ? 'klient' : 'dnes';
  render();
  await Store.sync(); render();
}

/* ---- service worker: appka se otevře i bez signálu ---- */
function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;   // testy běží z file://
  navigator.serviceWorker.register('./sw.js').then(reg => {
    reg.addEventListener('updatefound', () => {
      const sw = reg.installing; if (!sw) return;
      sw.addEventListener('statechange', () => {
        // controller = appka už jednou běžela z cache → tohle je nová verze, ne první instalace
        if (sw.state === 'installed' && navigator.serviceWorker.controller) UI.toast('Nová verze – obnovit', () => location.reload(), 'Obnovit');
      });
    });
  }).catch(e => console.warn('SW:', e));
}

/* ---- start ---- */
async function boot() {
  registerSW();
  Store.load();
  let cloud = false;
  try { cloud = await Store.initCloud(); }
  catch (e) {  // bez internetu se knihovna nenačte – jedeme z lokální kopie dat
    console.warn(e); const prof = LS.get('profile', null);
    if (prof && !prof.local) { Store.profile = prof; Store.clients = LS.get('clients', []); Store.clientId = LS.get('clientId', null); App.view = isCoach() ? 'klient' : 'dnes'; render(); UI.toast('Jsi offline – pracuješ s uloženou kopií'); }
    else { $('#login').classList.add('on'); $('#login').innerHTML = '<div class="card"><h2>Bez internetu</h2><p class="small muted" style="margin-top:6px">První přihlášení potřebuje připojení. Připoj se a obnov stránku.</p></div>'; }
    return;
  }
  if (cloud) {
    // návrat z odkazu na obnovu hesla
    if (location.hash.includes('type=recovery')) {
      Store.sb.auth.onAuthStateChange((ev) => { if (ev === 'PASSWORD_RECOVERY') showNewPassword(); });
    }
    if (Store.session) { try { await afterLogin(); } catch (e) { console.warn(e); renderLogin(); } } else renderLogin();
  } else {
    Store.profile = LS.get('profile', null);
    if (Store.profile && Store.profile.local) localLogin(Store.profile.role); else renderLogin();
  }
  window.addEventListener('online', () => { UI.syncBadge(); Store.sync().then(ch => { if (ch) render(); }); });
  window.addEventListener('offline', () => UI.syncBadge());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') Store.sync().then(ch => { if (ch) render(); }); });
  setInterval(() => Store.sync().then(ch => { if (ch && App.view !== 'recepty') render(); }), 60000);
}
function showNewPassword() {
  const m = UI.modal(`<h2>Nové heslo</h2><div class="in" style="margin-top:10px"><label class="f">Nové heslo (min. 8 znaků)</label><input type="password" id="npw"></div><div class="row" style="margin-top:10px"><button class="btn" id="npb">Uložit heslo</button></div><div id="nperr" class="bad small"></div>`);
  m.querySelector('#npb').onclick = async () => { try { await Store.updatePassword(m.querySelector('#npw').value); m.remove(); UI.toast('Heslo změněno'); location.hash = ''; } catch (e) { m.querySelector('#nperr').textContent = e.message; } };
}
document.addEventListener('DOMContentLoaded', boot);
