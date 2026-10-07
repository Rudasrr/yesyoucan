/* ===== Jádro ===== */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = sel => document.querySelector(sel);
const App = { view: 'dnes', date: todayISO(), week: mondayOf(todayISO()), ro: false, moreOpen: false, preview: false, openCourse: null };
const A = {};  // akce
const oid = (p, k) => `${p}:${Store.ownerId()}:${k}`;  // id unikátní napříč uživateli

/* ---- data ---- */
function settingsRec() { const uid = Store.ownerId(); return Store.rows('settings').find(r => r.user_id === uid); }
function S() {
  const rec = settingsRec();
  const d = { ...SEED.settings, ...(rec ? rec.data : {}) };
  d.courses = (rec && rec.data.courses) || SEED.settings.courses;
  d.met = SEED.met; d.phase_thresholds = SEED.phase_thresholds; d.phases = SEED.phases;
  /* Start a startovní váha se nezadávají (6. 10. 2026): je to první vážení. Trenér je dřív
     vyplňoval ručně a mohly se rozejít s daty. */
  try { const first = Meas().filter(m => m.weight != null && !m.deleted).sort((a, b) => a.date.localeCompare(b.date))[0]; if (first) { d.start_date = first.date; d.start_weight = Number(first.weight); } } catch (e) { }
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
function saveDay(day) { App._sbc = null; App._sbd = null; App._stride = null; const d = JSON.parse(JSON.stringify(day)); Object.values(d.meals || {}).forEach(m => { delete m.cookGrams; delete m.fromCook; }); delete d.act; Store.put('days', oid('d', day.date), d); }
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
  run(label, fn, after) { this.cap = []; try { fn(); } finally { const ch = this.cap; this.cap = null; if (ch.length) this.last = { label, ch, hist: histAdd(label, ch) }; }
    const msg = typeof after === 'function' ? after() : (after || label);
    UI.toast(msg, this.last && this.last.label === label ? () => Undo.undo() : null); },
  record(t, id) { if (!this.cap) return; if (this.cap.some(c => c.t === t && c.id === id)) return; const r = Store.db[t].find(x => x.id === id); this.cap.push({ t, id, prev: r ? JSON.parse(JSON.stringify(r)) : null }); },
  undo() { if (!this.last) return; const ch = this.last; this.last = null;
    ch.ch.forEach(c => { if (c.prev) Store.put(c.t, c.id, c.prev.data, c.prev.user_id, c.prev.deleted); else Store.remove(c.t, c.id); });
    if (ch.hist) histMark(ch.hist, { undone: new Date().toISOString() });
    render(); UI.toast('Vráceno: ' + ch.label); }
};
const _put = Store.put.bind(Store), _rm = Store.remove.bind(Store);
/* Historie změn trenéra (6. 10. 2026): každá jeho akce se uloží i s tím, jak data vypadala
   před a po – v Historii změn jde kdykoli vrátit, ne jen do 9 s v hlášce. Ukládá se do
   trenérových předvoleb (prefs, id h:<uid>:<čas>), Robert je nevidí. */
function histAdd(label, ch) {
  if (!isCoach() || !Store.uid()) return null;
  const snap = r => r ? { data: r.data, user_id: r.user_id, deleted: !!r.deleted } : null;
  const id = `h:${Store.uid()}:${Date.now()}`;
  _put('prefs', id, { at: new Date().toISOString(), label, ch: ch.map(c => ({ t: c.t, id: c.id, prev: snap(c.prev), next: snap(Store.db[c.t].find(x => x.id === c.id)) })) }, Store.uid());
  return id;
}
function histMark(id, patch) { const r = Store.db.prefs.find(x => x.id === id); if (r) _put('prefs', id, { ...r.data, ...patch }, r.user_id); }
function histRows() { const me = Store.uid(); return Store.rows('prefs', me).filter(r => r.id.startsWith('h:')).sort((a, b) => b.data.at.localeCompare(a.data.at)); }
Store.put = function (t, id, data, userId, deleted) { Undo.record(t, id); const r = _put(t, id, data, userId); if (deleted) { r.deleted = true; this.save(t); this.queue(t, r); } return r; };
Store.remove = function (t, id) { Undo.record(t, id); return _rm(t, id); };

/* ---- UI ---- */
const UI = {
  toast(msg, undoFn, btnLabel) { const t = $('#toast'); if (!t) return; t.innerHTML = `<span>${esc(paceFix(msg))}</span>${undoFn ? `<button class="ubtn" id="undo-btn">${esc(btnLabel || 'Zpět')}</button>` : ''}`; if (undoFn) t.querySelector('#undo-btn').onclick = () => { t.classList.remove('on'); undoFn(); }; t.classList.add('on'); clearTimeout(this._t); this._t = setTimeout(() => t.classList.remove('on'), undoFn ? 9000 : 3000); },
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
    const m = document.createElement('div'); m.className = 'modal' + (opts && opts.center ? ' center' : ''); m.innerHTML = `<div class="box">${paceFix(html)}</div>`;
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
  resheet(m, html) { if (!m || !document.body.contains(m)) return; const box = m.querySelector('.box'); const st = box.scrollTop; box.innerHTML = paceFix(html); box.scrollTop = st; },
  /* zavřít okno – s otázkou, pokud v něm něco rozdělaného zůstalo */
  tryClose(m) {
    if (!m) return;
    setTimeout(() => { if (!document.querySelector('.modal')) document.body.classList.remove('has-modal'); }, 0);
    if (m._guard && m._guard()) { m._guard = null; UI.confirm('Zavřít bez uložení? Rozdělané změny se ztratí.', () => m.remove(), 'Zavřít a zahodit'); return; }
    if (m._onclose) m._onclose();
    m.remove();
  },
  closeModal() { window._redraw = null; const all = document.querySelectorAll('.modal'); UI.tryClose(all[all.length - 1]); },
  confirm(text, onYes, yesLabel, safe) { const m = this.modal(`<p style="font-size:16px;font-weight:600">${esc(text)}</p><div class="row"><button class="btn ${safe ? '' : 'danger'}" id="cy">${esc(yesLabel || 'Ano')}</button><button class="btn sec" onclick="UI.closeModal()">Zpět</button></div>`, { center: 1 }); m.querySelector('#cy').onclick = () => { m.remove(); if (!document.querySelector('.modal')) document.body.classList.remove('has-modal'); onYes(); }; },
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
const MORE_CLIENT = [['recepty', 'Recepty', 'všech 200 jídel a tvoje vlastní', 'fork'], ['suroviny', 'Suroviny', 'hodnoty na 100 g, vlastní suroviny', 'cart'], ['ucet', 'Nastavení', 'připomínky, nádoby, odhlášení', 'gear'], ['navod', 'Návod', 'pravidla, slovníček, jak appka počítá', 'clip']];
/* Trenér plánuje cíle a trénink, ne jídlo (1. 10. 2026) – databáze potravin ani
   plánování jídel za Roberta v jeho menu nejsou. */
const NAV_COACH = [['klient', 'Přehled'], ['nastaveni', 'Plán'], ['trenink', 'Trénink']];
const MORE_COACH = [['historie', 'Historie změn', 'co jsi změnil a kdy · jde vrátit', 'cal'], ['ucet', 'Nastavení', 'účet, data do Excelu, odhlášení', 'gear'], ['navod', 'Návod', 'pravidla, slovníček, jak appka počítá', 'clip']];
/* staré názvy obrazovek (odkazy v úkolech, připomínkách, testech) → nové místo */
const VIEW_ALIAS = { tyden: ['plan', { planTab: 'jidla' }], jidlo: ['plan', {}], nakup: ['plan', { planTab: 'nakup' }], spiz: ['plan', { planTab: 'nakup' }], vareni: ['plan', { planTab: 'vareni' }],
  mereni: ['pokrok', {}], prehled: ['pokrok', {}], zprava: ['klient', {}], databaze: ['klient', {}] };

/* Ikony (6. 10. 2026): jedna sada čárových ikon místo emoji. ico('walk') → <svg class="ic"> */
const ICN = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  dumbbell: '<path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12"/>', gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>', trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  scale: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 10a4 4 0 0 1 6 0M12 10l1.5-1.5"/>', fork: '<path d="M7 3v7a2 2 0 0 0 4 0V3M9 12v9M17 3c-2 2-2 7 0 9v9"/>',
  walk: '<circle cx="13" cy="4.5" r="2"/><path d="M10 21l2-6 3 3v3M8 12l3-4 4 1 2 3"/>', feet: '<ellipse cx="8" cy="8" rx="2.5" ry="4"/><ellipse cx="16" cy="14" rx="2.5" ry="4"/>',
  flame: '<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-6 1 1 2 2 3 2 0-2-1-4 0-6z"/>', target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  check: '<path d="M5 12l4 4 10-10"/>', alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.01"/>', trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M10 15h4v3h-4zM8 21h8"/>',
  moon: '<path d="M20 14A8 8 0 1 1 10 4a7 7 0 0 0 10 10z"/>', cup: '<path d="M5 8h12v6a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5zM17 10h2a2 2 0 0 1 0 4h-2"/>', bolt: '<path d="M13 3L5 13h6l-1 8 8-10h-6z"/>',
  clip: '<rect x="5" y="4" width="14" height="17" rx="3"/><path d="M9 4h6v3H9zM9 12l2 2 4-4"/>', ruler: '<path d="M4 16L16 4l4 4L8 20z"/><path d="M8 12l2 2M11 9l2 2M14 6l2 2"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>', beer: '<path d="M6 8h10v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2zM16 10h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2M6 8a3 3 0 0 1 5-2 3 3 0 0 1 5 2"/>',
  cart: '<path d="M3 4h2l2 12h11l2-8H6"/><circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/>', pot: '<path d="M4 10h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM2 10h20M9 6c0-1 1-2 3-2s3 1 3 2"/>', plus: '<path d="M12 5v14M5 12h14"/>',
};
const ico = (n, cls) => `<svg class="ic${cls ? ' ' + cls : ''}" viewBox="0 0 24 24">${ICN[n] || ''}</svg>`;
const ICONS = { dnes: ico('sun'), plan: ico('cal'), pokrok: ico('trend'), klient: ico('grid'), nastaveni: ico('sliders'), trenink: ico('dumbbell') };

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
function nav() { return isCoach() ? NAV_COACH : NAV_CLIENT; }
function moreItems() { return isCoach() ? MORE_COACH : MORE_CLIENT; }
function go(v) {
  if (VIEW_ALIAS[v]) { const [to, st] = VIEW_ALIAS[v]; Object.assign(App, st); v = to; }
  App.view = v; UI.closeModal(); render(); window.scrollTo(0, 0);
}

function renderShell() {
  const items = nav();
  const on = v => App.view === v;
  $('#nav-desk').innerHTML = items.map(([v, l]) => `<button class="${on(v) ? 'on' : ''}" onclick="go('${v}')">${isCoach() ? ICONS[v] || '' : ''}${l}</button>`).join('');
  $('#nav-mob').innerHTML = items.map(([v, l]) => `<button class="${on(v) ? 'on' : ''}" onclick="go('${v}')">${ICONS[v]}${l}</button>`).join('');
  $('#who').textContent = App.preview ? 'náhled' : (isCoach() ? 'trenér' : 'Robert');
  const av = $('#avatar'); if (av) { av.innerHTML = isCoach() ? `<span class="avc">T</span><span class="avt">Trenér · více</span>` : 'R'; av.classList.toggle('on', App.view === 'more' || moreItems().some(x => x[0] === App.view)); }
  document.body.classList.toggle('wide', !!isCoach());
  if (!realCoach()) autoClosePast();
  UI.syncBadge();
}

/* obrazovky, které patří Robertovi – trenér je vidí jen v náhledu, ať neklikne omylem do jeho dat */
const CLIENT_ONLY = ['dnes', 'plan', 'pokrok', 'recepty', 'suroviny'];
function render() {
  App._sbc = null; App._stride = null; STEPS.stride = strideM();   // průměr kroků a délka kroku se počítají znovu
  document.querySelectorAll('.popx').forEach(p => p.remove());   // nápověda nepřežije překreslení
  if (!Store.profile) { renderLogin(); return; }
  document.body.classList.remove('out'); $('#login').classList.remove('on'); $('#app').classList.add('on');
  if (VIEW_ALIAS[App.view]) { const [to, st] = VIEW_ALIAS[App.view]; Object.assign(App, st); App.view = to; }
  if (isCoach() && CLIENT_ONLY.includes(App.view)) App.view = 'klient';
  App.ro = realCoach() && App.preview;
  renderShell();
  const el = $('#main'); el.className = App.ro ? 'wrap ro' : 'wrap';
  const V = VIEWS[App.view] || (isCoach() ? VIEWS.klient : VIEWS.dnes);
  let head = '';
  if (isCoach() && Store.clients.length > 1) head = `<div class="row small muted">Klient: <select style="width:auto;min-height:34px;padding:3px 8px" onchange="Store.clientId=this.value;LS.set('clientId',this.value);render()">${Store.clients.map(c => `<option value="${c.id}" ${c.id === Store.clientId ? 'selected' : ''}>${esc(c.display_name || c.name || c.email || c.id.slice(0, 8))}</option>`).join('')}</select></div>`;
  // překreslení nesmí sebrat kurzor z rozepsaného pole ani odskočit se stránkou
  const ae = document.activeElement;
  const keep = ae && ae.id && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA') && el.contains(ae)
    ? { id: ae.id, s: ae.selectionStart, e: ae.selectionEnd } : null;
  const sy = window.scrollY;
  el.innerHTML = paceFix(head + V());
  el.querySelectorAll('input[type=number]:not([inputmode])').forEach(i => i.setAttribute('inputmode', 'decimal'));
  if (keep) { const n = document.getElementById(keep.id); if (n) { n.focus(); try { n.setSelectionRange(keep.s, keep.e); } catch (e) { } } }
  if (Math.abs(window.scrollY - sy) > 2) window.scrollTo(0, sy);
  if (typeof window._sheetRedraw === 'function') window._sheetRedraw();
  maybeIntro();
  if (App.view === 'ucet' && typeof pushStavDoplnit === 'function') pushStavDoplnit();
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
  client: [['sun', 'Dnes', 'Nahoře dva kroužky: kolik ještě můžeš sníst a kolik se ještě hýbat. Pod nimi Další krok s tlačítkem – když nevíš, drž se ho.'],
    ['cal', 'Plán', 'Jídla na další dny, nákup podle seznamu a vaření dopředu. Tři kroky vedle sebe.'],
    ['trend', 'Pokrok', 'Váha ráno po WC, nalačno. Uvidíš, kolik už je dole, další milník a své série.']],
  coach: [['grid', 'Přehled', 'Týdenní kontrola se skóre, Průběh od celé cesty po jednotlivý den a Co řešit – každý problém s návrhem a tlačítkem.'],
    ['sliders', 'Plán', 'Cíl a termín, pohyb a jídlo. Appka hlídá, jestli Robert termín stihne, a když dlouhodobě neplní, navrhne přeplánování.'],
    ['dumbbell', 'Trénink', 'Kalendář s délkou a kcal každého dne, partie těla a kontrola plánu s návrhy. Navrhnout měsíc sestaví vyvážený plán.']]
};
function maybeIntro() {
  if (navigator.webdriver || document.querySelector('.modal')) return;
  const k = 'introSeen:' + (realCoach() ? 'coach' : 'client'); if (LS.get(k, false)) return;
  LS.set(k, true); A.intro(0);
}
A.intro = i => {
  const cards = INTRO[realCoach() ? 'coach' : 'client']; const c = cards[i];
  UI.closeModal();
  UI.modal(`<div class="intro"><div class="ie">${ico(c[0])}</div><h2>${c[1]}</h2><p>${c[2]}</p><div class="idots">${cards.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
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
