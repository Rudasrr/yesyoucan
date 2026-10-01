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
function saveSettings(data) { const uid = Store.ownerId(); const d = { ...data }; delete d.coach_note; delete d.coach_note_at; Store.put('settings', 'settings:' + uid, d, uid); }
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
function recipesFor(courseName) { return Recipes().filter(r => r.course === courseName && r.name && !r.deleted).sort((a, b) => (a.own === b.own ? (a.num || 0) - (b.num || 0) : (a.own ? 1 : -1))); }
function Meas() { return Store.rows('measurements', Store.ownerId()).map(r => ({ id: r.id, ...r.data })); }
function saveMeas(m) { Store.put('measurements', oid('m', m.date), m); }
function getDay(date) {
  const r = Store.rows('days', Store.ownerId()).find(x => x.data.date === date);
  return r ? JSON.parse(JSON.stringify(r.data)) : { date, meals: {}, walk_min: null, walk_kmh: null, exercise_min: 0, beers: 0, fried_g: 0, fromPlan: true };
}
function saveDay(day) { const d = JSON.parse(JSON.stringify(day)); Object.values(d.meals || {}).forEach(m => { delete m.cookGrams; delete m.fromCook; }); delete d.act; Store.put('days', oid('d', day.date), d); }
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
  s.courses.forEach((c, i) => { if (!day.meals[c.key]) day.meals[c.key] = {}; if (day.meals[c.key].sel === undefined) day.meals[c.key].sel = sels[i] || null; day.meals[c.key].planned = sels[i] || null;
    // uvařená dávka: gramy porce podle krabičky
    const ck = typeof cookFor === 'function' ? cookFor(date, c.key) : null; const m = day.meals[c.key];
    if (ck && ck.porce && ck.recipe === m.sel) { const r = Recipes().find(x => x.name === m.sel && !x.deleted); if (r) { m.cookGrams = {}; r.items.forEach((it, idx) => { const g = ck.porce[(m.swaps && m.swaps[idx]) || it.food]; if (g != null) m.cookGrams[idx] = Math.round(g); }); m.fromCook = true; } } });
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
  toast(msg, undoFn, btnLabel) { const t = $('#toast'); if (!t) return; t.innerHTML = `<span>${esc(msg)}</span>${undoFn ? `<button class="ubtn" id="undo-btn">${esc(btnLabel || 'Zpět')}</button>` : ''}`; if (undoFn) t.querySelector('#undo-btn').onclick = () => { t.classList.remove('on'); undoFn(); }; t.classList.add('on'); clearTimeout(this._t); this._t = setTimeout(() => t.classList.remove('on'), undoFn ? 9000 : 3000); },
  syncBadge() {
    const el = $('#syncb'); if (!el) return;
    if (Store.localMode()) { el.innerHTML = '<span class="dot off"></span>bez cloudu'; return; }
    if (!navigator.onLine) { el.innerHTML = `<span class="dot off"></span>offline${Store.outbox.length ? ' · ' + Store.outbox.length + ' čeká' : ''}`; return; }
    if (Store.lastError || (Store.odlozene || []).length) { el.innerHTML = `<span class="dot err"></span>chyba sync`; el.style.cursor = 'pointer'; el.onclick = () => A.syncInfo(); return; }
    el.onclick = () => A.syncInfo(); el.style.cursor = 'pointer';
    if (Store.syncing || Store.outbox.length) { el.innerHTML = `<span class="dot busy"></span>ukládám…`; return; }
    el.innerHTML = '<span class="dot"></span>uloženo';
  },
  modal(html, opts) {
    const m = document.createElement('div'); m.className = 'modal' + (opts && opts.center ? ' center' : ''); m.innerHTML = `<div class="box">${html}</div>`;
    if (opts && opts.guardEdits) {   // editor: nezavírat rozdělanou práci bez zeptání
      const dirty = () => { m._dirty = true; };
      m.addEventListener('input', dirty); m.addEventListener('change', dirty);
      m._guard = () => !!m._dirty;
    }
    m.addEventListener('click', e => { if (e.target === m) UI.tryClose(m); });
    document.body.appendChild(m);
    m.querySelectorAll('input[type=number]:not([inputmode])').forEach(i => i.setAttribute('inputmode', 'decimal'));
    document.body.classList.add('has-modal');
    return m;
  },
  /* Spodní list: nadpis, podtitul, obsah a tlačítka přilepená dole.
     Všechno, co patří k jedné věci, je v jednom listu – stránka pod ním se nehýbe. */
  sheet(title, sub, body, foot, opts) {
    const o = opts || {};
    return this.modal(this.sheetHtml(title, sub, body, foot, o.side), o);
  },
  sheetHtml(title, sub, body, foot, side) {
    return `<div class="sh"><h2>${title}${sub ? `<span class="shsub">${sub}</span>` : ''}</h2>${side || ''}<button class="xbtn" onclick="UI.closeModal()" aria-label="zavřít">×</button></div>${body}${foot ? `<div class="shfoot">${foot}</div>` : ''}`;
  },
  /* překreslit obsah otevřeného listu (po změně v něm) */
  resheet(m, html) { if (!m || !document.body.contains(m)) return; const box = m.querySelector('.box'); const st = box.scrollTop; box.innerHTML = html; box.scrollTop = st; },
  /* zavřít okno – s otázkou, pokud v něm něco rozdělaného zůstalo */
  tryClose(m) {
    if (!m) return;
    setTimeout(() => { if (!document.querySelector('.modal')) document.body.classList.remove('has-modal'); }, 0);
    if (m._guard && m._guard()) { m._guard = null; UI.confirm('Zavřít bez uložení? Rozdělané změny se ztratí.', () => m.remove(), 'Zavřít a zahodit'); return; }
    if (m._onclose) m._onclose();
    m.remove();
  },
  closeModal() { window._redraw = null; const all = document.querySelectorAll('.modal'); UI.tryClose(all[all.length - 1]); },
  confirm(text, onYes, yesLabel) { const m = this.modal(`<p style="font-size:16px;font-weight:600">${esc(text)}</p><div class="row"><button class="btn danger" id="cy">${esc(yesLabel || 'Ano')}</button><button class="btn sec" onclick="UI.closeModal()">Zpět</button></div>`, { center: 1 }); m.querySelector('#cy').onclick = () => { m.remove(); if (!document.querySelector('.modal')) document.body.classList.remove('has-modal'); onYes(); }; },
  /* nabídka akcí pod ⋯ – [[popisek, onclick, varianta]] */
  menu(title, items) {
    return this.sheet(title, '', `<div class="list">${items.filter(Boolean).map(([l, act, sub]) => `<div class="navrow" onclick="UI.closeModal();${act}"><div class="tx"><b>${l}</b>${sub ? `<span>${sub}</span>` : ''}</div><span class="chev">›</span></div>`).join('')}</div>`);
  }
};

/* ===== Menu =====
   Robert: tři obrazovky na tři otázky – co dnes, co dopředu, jak mi to jde.
   Trenér: tři obrazovky – mám zasáhnout, co nastavit, co je v databázi.
   Zbytek je pod kolečkem s iniciálou vpravo nahoře (Více). */
const NAV_CLIENT = [['dnes', 'Dnes'], ['plan', 'Plán'], ['pokrok', 'Pokrok']];
const MORE_CLIENT = [['recepty', 'Recepty', 'všech 200 jídel a tvoje vlastní', '📖'], ['suroviny', 'Suroviny', 'hodnoty na 100 g, vlastní suroviny', '🥦'], ['ucet', 'Nastavení', 'připomínky, nádoby, záloha, odhlášení', '⚙️'], ['navod', 'Návod', 'pravidla, slovníček, jak appka počítá', '📘']];
const NAV_COACH = [['klient', 'Robert'], ['nastaveni', 'Plán'], ['databaze', 'Databáze']];
const MORE_COACH = [['__preview', 'Pohled Roberta', 'appka přesně tak, jak ji vidí on', '👁️'], ['ucet', 'Nastavení', 'účet, výchozí data, odhlášení', '⚙️'], ['navod', 'Návod', 'pravidla, slovníček, jak appka počítá', '📘']];
/* staré názvy obrazovek (odkazy v úkolech, připomínkách, testech) → nové místo */
const VIEW_ALIAS = { tyden: ['plan', { planTab: 'jidla' }], jidlo: ['plan', {}], nakup: ['plan', { planTab: 'nakup' }], spiz: ['plan', { planTab: 'nakup' }], vareni: ['plan', { planTab: 'vareni' }],
  mereni: ['pokrok', {}], prehled: ['pokrok', {}], zprava: ['klient', {}], trenink: ['nastaveni', { coachTab: 'trenink' }] };
const ICONS = {
  dnes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  plan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  pokrok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19V5"/><path d="M4 19h16"/><path d="M7 15l4-5 3 3 5-7"/></svg>',
  klient: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>',
  nastaveni: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h10M4 17h6M18 7h2M14 17h6"/><circle cx="16" cy="7" r="2"/><circle cx="12" cy="17" r="2"/></svg>',
  databaze: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></svg>'
};

/* Co se děje se synchronizací. Dřív se uživatel dozvěděl jen to, že „chyba sync“ –
   bez šance zjistit, co vázne, a bez možnosti s tím cokoli udělat. */
A.syncInfo = () => {
  const od = Store.odlozene || [], ob = Store.outbox || [];
  const popis = { settings: 'nastavení', foods: 'suroviny', recipes: 'recepty', measurements: 'vážení', days: 'dny', week_plans: 'plány týdne', shopping: 'nákup', prefs: 'předvolby', training: 'trénink' };
  const sk = {}; od.forEach(x => { const k = (x.t || '') + '|' + (x.msg || ''); sk[k] = (sk[k] || 0) + 1; });
  UI.sheet('Synchronizace', Store.lastSync ? 'poslední ' + czDateShort(Store.lastSync.slice(0, 10)) : '',
    `<div class="stats3 two"><div><b>${ob.length}</b><span>čeká na odeslání</span></div><div><b class="${od.length ? 'bad' : ''}">${od.length}</b><span>odloženo kvůli chybě</span></div></div>
    ${Store.lastError ? `<div class="alert a1"><div><b>Poslední chyba:</b> ${esc(Store.lastError)}</div></div>` : ''}
    ${od.length ? `<div class="tbl"><table class="small"><tr><th>Co</th><th class="n">kolik</th><th>Proč</th></tr>
      ${Object.entries(sk).map(([k, n2]) => { const t = k.split('|')[0], msg = k.slice(t.length + 1); return `<tr><td class="b">${esc(popis[t] || t)}</td><td class="n">${n2}×</td><td class="muted">${esc(msg.slice(0, 80))}</td></tr>`; }).join('')}</table></div>
      <p class="hint">Tyhle záznamy databáze odmítla. Zbytek se ukládá dál, takhle to appku neblokuje.</p>` : ''}
    ${!od.length && !Store.lastError ? `<p class="muted">Všechno je uložené.</p>` : ''}`,
    `<button class="btn" onclick="A.syncNow()">Zkusit teď</button>${od.length ? `<button class="btn sec" onclick="A.syncClear()">Zapomenout odložené</button>` : ''}`);
};
A.syncNow = () => { UI.closeModal(); Store.lastError = null; Store.sync().then(() => { render(); UI.toast(Store.lastError ? 'Pořád to nejde: ' + Store.lastError : 'Synchronizováno.'); }); };
A.syncClear = () => { Store.odlozene = []; LS.set('odlozene', []); Store.lastError = null; UI.closeModal(); render(); UI.toast('Odložené záznamy zapomenuty.'); };

function realCoach() { return Store.profile && Store.profile.role === 'coach'; }
function isCoach() { return realCoach() && !App.preview; }
A.togglePreview = () => { App.preview = !App.preview; App.coachPlan = false; App.view = App.preview ? 'dnes' : 'klient'; UI.closeModal(); render(); window.scrollTo(0, 0); UI.toast(App.preview ? 'Vidíš appku Robertovýma očima – jen náhled, nic se neuloží.' : 'Zpět v trenérském pohledu.'); };
/* Plánování za klienta: primárně si den skládá sám, tohle je pojistka pro trenéra. */
A.toggleCoachPlan = () => { App.coachPlan = !App.coachPlan; render(); UI.toast(App.coachPlan ? 'Plánuješ za Roberta – co uložíš, uvidí u sebe.' : 'Zpátky jen na koukání.'); };
function nav() { return isCoach() ? NAV_COACH : NAV_CLIENT; }
function moreItems() { return isCoach() ? MORE_COACH : MORE_CLIENT; }
function go(v) {
  if (v === '__preview') { A.togglePreview(); return; }
  if (VIEW_ALIAS[v]) { const [to, st] = VIEW_ALIAS[v]; Object.assign(App, st); v = to; }
  App.view = v; UI.closeModal(); render(); window.scrollTo(0, 0);
}

function renderShell() {
  const items = nav();
  const on = v => App.view === v;
  $('#nav-desk').innerHTML = items.map(([v, l]) => `<button class="${on(v) ? 'on' : ''}" onclick="go('${v}')">${l}</button>`).join('');
  $('#nav-mob').innerHTML = items.map(([v, l]) => `<button class="${on(v) ? 'on' : ''}" onclick="go('${v}')">${ICONS[v]}${l}</button>`).join('');
  $('#who').textContent = App.preview ? 'náhled' : (isCoach() ? 'trenér' : 'Robert');
  const av = $('#avatar'); if (av) { av.textContent = isCoach() ? 'T' : 'R'; av.classList.toggle('on', App.view === 'more' || moreItems().some(x => x[0] === App.view)); }
  document.body.classList.toggle('wide', !!isCoach());
  if (!realCoach()) autoClosePast();
  UI.syncBadge();
}

/* obrazovky, které patří Robertovi – trenér je vidí jen v náhledu, ať neklikne omylem do jeho dat */
const CLIENT_ONLY = ['dnes', 'plan', 'pokrok'];
function render() {
  if (!Store.profile) { renderLogin(); return; }
  document.body.classList.remove('out'); $('#login').classList.remove('on'); $('#app').classList.add('on');
  if (VIEW_ALIAS[App.view]) { const [to, st] = VIEW_ALIAS[App.view]; Object.assign(App, st); App.view = to; }
  if (isCoach() && CLIENT_ONLY.includes(App.view)) App.view = 'klient';
  App.ro = realCoach() && App.preview && !App.coachPlan;
  renderShell();
  const el = $('#main'); el.className = App.ro ? 'wrap ro' : 'wrap';
  const V = VIEWS[App.view] || (isCoach() ? VIEWS.klient : VIEWS.dnes);
  let head = '';
  if (isCoach() && Store.clients.length > 1 && App.view !== 'databaze') head = `<div class="row small muted">Klient: <select style="width:auto;min-height:34px;padding:3px 8px" onchange="Store.clientId=this.value;LS.set('clientId',this.value);render()">${Store.clients.map(c => `<option value="${c.id}" ${c.id === Store.clientId ? 'selected' : ''}>${esc(c.display_name || c.name || c.email || c.id.slice(0, 8))}</option>`).join('')}</select></div>`;
  const planBtns = `<span class="row" style="margin-left:auto"><button class="btn sec sm" onclick="A.toggleCoachPlan()">${App.coachPlan ? '👁️ Jen koukat' : '✏️ Plánovat za Roberta'}</button><button class="btn sm" onclick="A.togglePreview()">Zpět do trenéra</button></span>`;
  if (App.preview) head += `<div class="notice ${App.coachPlan ? 'warn' : ''}"><span>${App.coachPlan ? '✏️ Plánuješ za Roberta – co uložíš, uvidí u sebe.' : '👁️ Robertův pohled – jen náhled, nic se neuloží.'}</span>${planBtns}</div>`;
  // překreslení nesmí sebrat kurzor z rozepsaného pole ani odskočit se stránkou
  const ae = document.activeElement;
  const keep = ae && ae.id && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA') && el.contains(ae)
    ? { id: ae.id, s: ae.selectionStart, e: ae.selectionEnd } : null;
  const sy = window.scrollY;
  el.innerHTML = head + V();
  el.querySelectorAll('input[type=number]:not([inputmode])').forEach(i => i.setAttribute('inputmode', 'decimal'));
  if (keep) { const n = document.getElementById(keep.id); if (n) { n.focus(); try { n.setSelectionRange(keep.s, keep.e); } catch (e) { } } }
  if (Math.abs(window.scrollY - sy) > 2) window.scrollTo(0, sy);
  if (typeof window._sheetRedraw === 'function') window._sheetRedraw();
  maybeIntro();
}

/* ---- přihlášení ---- */
/* Přístupy bez cloudu (jen bariéra proti omylu – v souboru jsou čitelné; skutečné ověření dělá Supabase) */
const LOCAL_USERS = { 'r.pesek24@gmail.com': { pw: 'mamnato', role: 'client' }, 'rehor.rudolf@gmail.com': { pw: '06392', role: 'coach' } };
function renderLogin() {
  document.body.classList.add('out'); $('#app').classList.remove('on'); const L = $('#login'); L.classList.add('on');
  // jedna přihlašovací obrazovka pro všechny – jestli je to trenér nebo klient, řekne profil
  L.innerHTML = `<div class="card"><div class="hero-logo pic"><img src="logo.png" alt=""></div><h1>YesYouCan</h1><p class="muted small">Přihlaš se e-mailem a heslem.</p>
    <div class="in"><label class="f">E-mail</label><input type="email" id="lem" autocomplete="username"></div>
    <div class="in"><label class="f">Heslo</label><input type="password" id="lpw" autocomplete="current-password"></div>
    <div id="lerr" class="bad small"></div>
    <div class="row"><button class="btn" id="lbtn" onclick="doLogin()">Přihlásit</button>${Store.localMode() ? '' : '<button class="btn sec" onclick="doReset()">Zapomenuté heslo</button>'}</div>
    ${Store.localMode() ? '<p class="tiny muted">Režim bez cloudu: data zůstávají v tomto prohlížeči.</p>' : ''}</div>`;
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
  if (Store.profile.missing) { $('#login').innerHTML = `<div class="card"><h2>Účet zatím nemá roli</h2><p class="small muted">Trenér musí v Supabase v tabulce <b>profiles</b> přidat řádek s tvým ID a rolí (viz NAVOD.md). Pak se přihlaš znovu.</p><button class="btn sec" onclick="Store.signOut().then(render)">Odhlásit</button></div>`; Store.profile = null; return; }
  App.view = isCoach() ? 'klient' : 'dnes';
  render();
  await Store.sync(); render();
}

/* ---- větší ovládání čísel: − hodnota + (palcem na telefonu) ---- */
function stepper(id, value, step, min, max, onchange, placeholder) {
  const st = step || 1;
  return `<div class="step2"><button class="sbtn" type="button" onclick="A.num('${id}',${-st},${min ?? ''},${max ?? ''})" aria-label="míň">−</button>` +
    /* Desetinná pole jsou text s číselnou klávesnicí – „131,4“ z české klávesnice
       prohlížeč v type=number tiše zahodí a Robertovi se nic neuloží. */
    `<input type="${st < 1 ? 'text' : 'number'}" inputmode="decimal" id="${id}" value="${value}"${placeholder ? ` placeholder="${placeholder}"` : ''} ${st < 1 ? '' : `step="${st}"`} ${min != null && st >= 1 ? `min="${min}"` : ''} ${max != null && st >= 1 ? `max="${max}"` : ''}${onchange ? ` onchange="${onchange}"` : ''}>` +
    `<button class="sbtn" type="button" onclick="A.num('${id}',${st},${min ?? ''},${max ?? ''})" aria-label="víc">+</button></div>`;
}
/* posun hodnoty v políčku vedle tlačítka (gramáž v jídle) */
A.gnudge = (btn, d) => {
  const inp = btn.parentElement.querySelector('input'); if (!inp) return;
  inp.value = Math.max(0, (cislo(inp.value) || 0) + d);
  inp.dispatchEvent(new Event('change', { bubbles: true }));
};
A.num = (id, d, min, max) => {
  const el = document.getElementById(id); if (!el) return;
  let v = (cislo(el.value) || 0) + d;
  if (min !== '' && min != null) v = Math.max(min, v);
  if (max !== '' && max != null) v = Math.min(max, v);
  el.value = Math.round(v * 100) / 100;
  el.dispatchEvent(new Event('change', { bubbles: true }));
};

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
  Store.refreshSeed();
  Store.refreshEpoch();
  Store.migrateDry();
  let cloud = false;
  try { cloud = await Store.initCloud(); }
  catch (e) {  // bez internetu se knihovna nenačte – jedeme z lokální kopie dat
    console.warn(e); const prof = LS.get('profile', null);
    if (prof && !prof.local) { Store.profile = prof; Store.clients = LS.get('clients', []); Store.clientId = LS.get('clientId', null); App.view = isCoach() ? 'klient' : 'dnes'; render(); UI.toast('Jsi offline – pracuješ s uloženou kopií'); }
    else { $('#login').classList.add('on'); $('#login').innerHTML = '<div class="card"><h2>Bez internetu</h2><p class="small muted">První přihlášení potřebuje připojení. Připoj se a obnov stránku.</p></div>'; }
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
  const m = UI.modal(`<h2>Nové heslo</h2><div class="in"><label class="f">Nové heslo (min. 8 znaků)</label><input type="password" id="npw"></div><div class="row"><button class="btn" id="npb">Uložit heslo</button></div><div id="nperr" class="bad small"></div>`);
  m.querySelector('#npb').onclick = async () => { try { await Store.updatePassword(m.querySelector('#npw').value); m.remove(); UI.toast('Heslo změněno'); location.hash = ''; } catch (e) { m.querySelector('#nperr').textContent = e.message; } };
}
document.addEventListener('DOMContentLoaded', boot);

/* ===== Úvod při prvním spuštění =====
   Dřív měla každá obrazovka nahoře pruh s návodem o třech až čtyřech krocích. Kdo to
   jednou pochopil, četl pak jen text navíc. Teď je to jednorázový úvod na tři karty
   a zbytek je v Návodu. Automatické testy (navigator.webdriver) úvod přeskakují. */
const INTRO = {
  client: [['☀️', 'Dnes', 'Nahoře vidíš, kolik ještě můžeš sníst. Pod tím karta Teď – jeden další krok a jedno tlačítko. Když nevíš, drž se jí.'],
    ['🗓️', 'Plán', 'Jednou týdně: nech si navrhnout jídla, nakup podle seznamu a uvař dopředu. Tři kroky vedle sebe.'],
    ['📈', 'Pokrok', 'Váha ráno po WC, nalačno. Appka počítá s průměrem sedmi vážení – jedno číslo nic neznamená.']],
  coach: [['🚦', 'Robert', 'Barva a jedna věta řeknou, jestli zasáhnout. Pod tím jen to, co vyžaduje akci – každé s tlačítkem.'],
    ['🎛️', 'Plán', 'Nahoře páky, které měníš opravdu: tempo, chůze, kroky, udržovací týden. Trénink je vedle.'],
    ['👁️', 'Pohled Roberta', 'Pod kolečkem vpravo nahoře uvidíš appku přesně tak, jak ji vidí on.']]
};
function maybeIntro() {
  if (navigator.webdriver || document.querySelector('.modal')) return;
  const k = 'introSeen:' + (realCoach() ? 'coach' : 'client'); if (LS.get(k, false)) return;
  LS.set(k, true); A.intro(0);
}
A.intro = i => {
  const cards = INTRO[realCoach() ? 'coach' : 'client']; const c = cards[i];
  UI.closeModal();
  UI.modal(`<div class="intro"><div class="ie">${c[0]}</div><h2>${c[1]}</h2><p>${c[2]}</p><div class="idots">${cards.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
    <div class="row" style="justify-content:center">${i < cards.length - 1 ? `<button class="btn ghost" onclick="UI.closeModal()">Přeskočit</button><button class="btn" onclick="A.intro(${i + 1})">Další</button>` : `<button class="btn" onclick="UI.closeModal()">Začít</button>`}</div></div>`, { center: 1 });
};

/* ===== Způsoby zobrazení plnění =====
   ring   – kolečko pro „kolik z cíle“ (jedno číslo, jeden cíl)
   dualBar– dva pruhy přes sebe: co říká plán a co je skutečnost
   spark  – trend za posledních pár dní */
function ring(pct, cislo, popis, barva, velikost) {
  const S = velikost || 108, r = S / 2 - 9, C = 2 * Math.PI * r;
  const p = clamp(pct, 0, 100);
  return `<div class="ring" style="--rs:${S}px"><svg viewBox="0 0 ${S} ${S}" width="${S}" height="${S}" aria-hidden="true">
      <circle cx="${S / 2}" cy="${S / 2}" r="${r}" fill="none" stroke="rgba(22,32,58,.07)" stroke-width="9"/>
      <circle cx="${S / 2}" cy="${S / 2}" r="${r}" fill="none" stroke="${barva || 'var(--p)'}" stroke-width="9" stroke-linecap="round"
        stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - p / 100)}" transform="rotate(-90 ${S / 2} ${S / 2})"/></svg>
    <div class="rval"><b>${cislo}</b></div><div class="rlab">${esc(popis)}</div></div>`;
}
function dualBar(planHod, realHod, max, jednotka) {
  const m = Math.max(max || 0, planHod, realHod, 1);
  const pp = clamp(planHod / m * 100, 0, 100), pr = clamp(realHod / m * 100, 0, 100);
  return `<div class="dual"><div class="dbar plan" style="width:${pp}%"></div><div class="dbar real ${realHod >= planHod ? 'ok' : 'low'}" style="width:${pr}%"></div>
    <div class="dleg"><span><i class="lp"></i>plán ${fmt2(planHod)}${jednotka}</span><span><i class="lr ${realHod >= planHod ? 'ok' : 'low'}"></i>skutečnost ${fmt2(realHod)}${jednotka}</span></div></div>`;
}
function spark(hodnoty, barva) {
  const v = hodnoty.filter(x => x != null);
  if (v.length < 2) return '';
  const min = Math.min(...v), max = Math.max(...v), r = (max - min) || 1;
  const W = 120, H = 34;
  const body = v.map((x, i) => `${(i / (v.length - 1) * W).toFixed(1)},${(H - 3 - (x - min) / r * (H - 6)).toFixed(1)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true"><polyline points="${body}" fill="none" stroke="${barva || 'var(--p)'}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
