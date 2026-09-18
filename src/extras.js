/* ===== Domácí míry: ⚖️ zvaž · 🥄 odměř · ✋ od oka =====
   Nádoby: Robert má 6 slotů s výchozí velikostí (Nastavení → Moje nádoby); gramy = objem × hustota. */
const MODE_EM = { vaz: '⚖️', odm: '🥄', oko: '✋' };
const MODE_LABEL = { vaz: 'zvaž', odm: 'odměř', oko: 'od oka' };
function containers() { const p = Prefs(); const out = {}; Object.entries(SEED.containers).forEach(([k, v]) => { out[k] = { ...v, ...(p.containers && p.containers[k] ? p.containers[k] : {}) }; }); return out; }
A.setContainer = (k, v) => { const p = Prefs(); p.containers = p.containers || {}; p.containers[k] = SEED.containers[k].g != null ? { g: Number(v) } : { ml: Number(v) }; savePrefs(p); UI.toast(`${SEED.containers[k].label}: ${v} ${SEED.containers[k].g != null ? 'g' : 'ml'} – míry v receptech přepočítány`); render(); };
function measureOf(food) { return SEED.measures[food] || { m: 'vaz' }; }
const UNIT_PLURAL = { hrnek: ['hrnek', 'hrnky', 'hrnků'], lzice: ['lžíce', 'lžíce', 'lžic'], lzicka: ['lžička', 'lžičky', 'lžiček'], sklenice: ['sklenice', 'sklenice', 'sklenic'], naberacka: ['naběračka', 'naběračky', 'naběraček'], odmerka: ['odměrka', 'odměrky', 'odměrek'], plátek: ['plátek', 'plátky', 'plátků'], kus: ['kus', 'kusy', 'kusů'], hrst: ['hrst', 'hrsti', 'hrstí'], půlka: ['půlka', 'půlky', 'půlek'], dílek: ['dílek', 'dílky', 'dílků'], stroužek: ['stroužek', 'stroužky', 'stroužků'], bílek: ['bílek', 'bílky', 'bílků'] };
function plural(n, u) { const p = UNIT_PLURAL[u] || [u, u, u]; return n === 1 ? p[0] : (n < 5 ? p[1] : p[2]); }
function qtyText(n) { if (n < 0.375) return ['¼', 1]; if (n < 0.625) return ['½', 1]; if (n < 0.875) return ['¾', 1]; const r = Math.round(n * 2) / 2; const whole = Math.floor(r); const half = r - whole >= 0.5; return [half ? `${whole}½` : String(whole), whole >= 1 && !half ? whole : (whole === 1 ? 2 : Math.max(2, whole))]; }
/* text domácí míry pro dané gramy */
function measureText(food, g) {
  const m = measureOf(food); if (!g) return '';
  if (m.ck) g = cookedG(food, g);   // hrnek nabíráš uvařené, recept je v suchém stavu
  let unitG = null, unit = null;
  if (m.c) { const C = containers(); let cu = m.c; let c = C[cu]; unitG = c.g != null ? c.g : c.ml * (m.dens || 1);
    // velké množství → větší nádoba (3+ lžičky → lžíce, 6+ lžic → hrnek)
    if (cu === 'lzicka' && g / unitG > 3) { cu = 'lzice'; unitG = C.lzice.ml * (m.dens || 1); }
    if (cu === 'lzice' && g / unitG > 6) { cu = 'hrnek'; unitG = C.hrnek.ml * (m.dens || 1); }
    unit = cu; }
  else if (m.kus) { unitG = m.g; unit = m.kus; }
  else if (m.hrst) { unitG = m.hrst; unit = 'hrst'; }
  if (!unitG) return m.m === 'vaz' ? '' : '';
  const [q, pn] = qtyText(g / unitG);
  return `${MODE_EM[m.m]} ≈ ${q} ${plural(pn, unit)}`;
}
/* Zadávání v domácích mírách. Pravda zůstává v gramech – míra je jen vstupní a
   zobrazovací vrstva. Kdyby recept ukládal „2 hrnky“, tak by přeměření hrnku tiše
   změnilo kalorie ve všech jídlech, kde ho máš; a trenérův recept by u každého
   znamenal něco jiného. Proto se míra hned převede na gramy a jednotka se pamatuje
   jen jako štítek. */
function unitOf(food) {
  const m = measureOf(food); if (!m) return null;
  let unitG = null, unit = null;
  if (m.c) { const C = containers(); const c = C[m.c]; if (!c) return null; unitG = c.g != null ? c.g : c.ml * (m.dens || 1); unit = m.c; }
  else if (m.kus) { unitG = m.g; unit = m.kus; }
  else if (m.hrst) { unitG = m.hrst; unit = 'hrst'; }
  if (!unitG) return null;
  if (m.ck) unitG = unitG / (SEED_YLD[food] || 1);   // míra platí pro hotové jídlo, recept je v suchém stavu
  return { unit, g: unitG, label: plural(1, unit), mode: m.m };
}
App.unitOn = {};
A.unitToggle = id => { App.unitOn[id] = !App.unitOn[id]; if (window._redraw) window._redraw(); else render(); };
/* políčko gramů s přepínačem jednotky */
function gInput(id, food, g, onchange, cls) {
  const u = unitOf(food);
  const on = u && App.unitOn[id];
  const val = on ? Math.round(g / u.g * 4) / 4 : gShow(g);
  const step = on ? 0.25 : 5;
  const handler = on ? `${onchange.replace('this.value', `(this.value*${u.g})`)}` : onchange;
  return `<span class="gstep">${on ? '' : `<button class="gb" onclick="A.gnudge(this,-10)">−</button>`}<input class="g ${cls || ''}" type="number" min="0" step="${step}" value="${val || ''}" onchange="${handler}">${on ? '' : `<button class="gb" onclick="A.gnudge(this,10)">+</button>`}${u ? `<button class="gu gub" title="přepnout na ${on ? 'gramy' : u.label}" onclick="A.unitToggle('${esc(id)}')">${on ? u.label : 'g'}</button>` : '<span class="gu">g</span>'}</span>${on ? `<div class="tiny muted">${fmt0(g)} g</div>` : ''}`;
}

function modeBadge(food) { const m = measureOf(food); return `<span class="mbadge m-${m.m}" title="${MODE_LABEL[m.m]}">${MODE_EM[m.m]}</span>`; }
/* karta Moje nádoby */
function containersCard() { const c = containers(); return `<div class="card"><h2>🥄 Moje nádoby${help('Šest nádob, které používáš doma. Nastav jejich skutečnou velikost (hrnek změř: nalij vodu a přelij do odměrky) a appka podle nich přepočítá všechny míry v receptech. Lžička a lžíce jsou standardní 5 a 15 ml.')}</h2><p class="small muted" style="margin:4px 0 10px">Podle těchto velikostí se počítají míry „≈ 1 hrnek“ v receptech. Změř jednou, platí všude.</p>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px">${Object.entries(c).map(([k, v]) => `<div class="in"><label class="f">${v.label}</label><div class="row" style="gap:6px;flex-wrap:nowrap"><input type="number" min="1" step="${v.g != null ? 1 : 5}" value="${v.g != null ? v.g : v.ml}" onchange="A.setContainer('${k}',this.value)"><span class="small muted">${v.g != null ? 'g' : 'ml'}</span></div>${SEED.containers[k].ml !== v.ml || SEED.containers[k].g !== v.g ? `<div class="tiny muted">výchozí ${SEED.containers[k].g != null ? SEED.containers[k].g + ' g' : SEED.containers[k].ml + ' ml'}</div>` : ''}</div>`).join('')}</div>
  <p class="hint">Příklady: 1 hrnek (${c.hrnek.ml} ml) ≈ ${fmt0(c.hrnek.ml * 0.8)} g vařené rýže, ${fmt0(c.hrnek.ml * 0.6)} g vařených těstovin, ${fmt0(c.hrnek.ml * 1.03)} g mléka · 1 lžíce (${c.lzice.ml} ml) ≈ ${fmt0(c.lzice.ml * 1.2)} g tvarohu, ${fmt0(c.lzice.ml * 0.5)} g vloček, ${fmt0(c.lzice.ml * 0.65)} g oříšků.</p></div>`; }

/* zaokrouhlení porcí: příloha na 10 g (odchylka od sešitu: MROUND 5) */

/* ===== Tolerance nahlas: „sedí“ do ±60 kcal ===== */
function toleranceText(kcal, target) { const d = kcal - target; if (Math.abs(d) <= 60) return { ok: true, text: 'sedí' }; return { ok: false, text: d > 0 ? `o ${fmt0(d)} kcal víc` : `${fmt0(-d)} kcal volných` }; }

/* ===== Haptika + animace ===== */
function buzz(pattern) { try { if (navigator.vibrate) navigator.vibrate(pattern || 30); } catch (e) { } }
function celebrate(kind) {
  buzz(kind === 'day' ? [40, 60, 40, 60, 120] : 40);
  if (kind !== 'day') return;
  const c = document.createElement('div'); c.className = 'confetti'; const colors = ['#1478d4', '#c81f2b', '#101828', '#4aa3e8', '#e0452f'];
  for (let i = 0; i < 40; i++) { const p = document.createElement('i'); p.style.left = (5 + Math.random() * 90) + '%'; p.style.background = colors[i % 5]; p.style.animationDelay = (Math.random() * 0.4) + 's'; p.style.animationDuration = (1.4 + Math.random()) + 's'; c.appendChild(p); }
  document.body.appendChild(c); setTimeout(() => c.remove(), 2600);
}
function popEl(sel) { const el = document.querySelector(sel); if (!el) return; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }

/* ===== Poznámka ke dni (Robert) + odpověď trenéra ===== */
function coachReply(date) { const r = TrainingRows().find(x => x.id === oid('note', date)); return r ? r.data : null; }
A.saveNote = (date, text) => { Undo.run(text ? 'Poznámka uložena – trenér ji uvidí' : 'Poznámka smazána', () => { const day = getDay(date); day.note = text || null; day.noteAt = new Date().toISOString(); saveDay(day); }); render(); };
A.saveReply = (date, text) => { Undo.run(text ? 'Odpověď odeslána Robertovi' : 'Odpověď smazána', () => Store.put('training', oid('note', date), { reply: text || null, at: new Date().toISOString() })); render(); };
/* Hlad je jediný signál, který trenérovi chybí. Pět dní vlčího hladu v řadě znamená,
   že tempo je moc rychlé – a to z čísel nepoznáš, dokud to Robert nenapíše do poznámky. */
const HLAD = [['ok', '🙂 v pohodě'], ['hlad', '😐 hlad'], ['vlk', '😖 vlčí hlad']];
A.setHunger = (date, v) => Undo.run('Hlad', () => { const day = getDay(date); day.hunger = day.hunger === v ? null : v; saveDay(day); render(); },
  v === 'vlk' ? 'Zapsáno. Když to bude pět dní v řadě, trenér to uvidí a zpomalí tempo.' : 'Zapsáno.');
function hungerRow(date, day) {
  return `<div class="fulfil write" style="margin-bottom:10px"><div class="row between"><span class="fgoal">Jak ti dnes bylo s jídlem?${help('Jedno ťuknutí denně. Pro trenéra je to cennější než většina čísel: když máš hlad pět dní v řadě, je tempo moc rychlé a patří zpomalit dřív, než to vzdáš.')}</span></div>
    <div class="row" style="gap:6px;margin-top:6px">${HLAD.map(([k, l]) => `<span class="chip ${day.hunger === k ? 'on' : ''}" onclick="A.setHunger('${date}','${k}')">${l}</span>`).join('')}</div></div>`;
}
/* Vlákno vzkazů: poznámky ke dnům a odpovědi trenéra v jedné niti, ne rozeseté po dnech. */
function threadItems(limit) {
  const uid = Store.ownerId();
  const out = [];
  Store.rows('days', uid).forEach(r => { const d = r.data;
    if (d.note) out.push({ date: d.date, at: d.noteAt, who: 'robert', text: d.note });
  });
  Store.rows('training', uid).forEach(r => {   // id má tvar note:<uid>:<datum>
    const p = r.id.split(':'); if (p[0] !== 'note' || !r.data || !r.data.reply) return;
    out.push({ date: p[2], at: r.data.at, who: 'trener', text: r.data.reply }); });
  return out.sort((a, b) => (b.at || b.date).localeCompare(a.at || a.date)).slice(0, limit || 20);
}
function threadCard(limit) {
  const it = threadItems(limit);
  if (!it.length) return `<div class="card"><h2>💬 Vzkazy</h2><p class="small muted" style="margin-top:6px">Zatím nic. Poznámky ke dnům a odpovědi se sbíhají sem.</p></div>`;
  return `<div class="card"><h2>💬 Vzkazy${help('Všechny poznámky ke dnům a odpovědi na jednom místě, od nejnovější. Psát se dá u konkrétního dne – tam zůstává kontext.')}</h2>
    <div class="thread">${it.map(x => `<div class="nb ${x.who === 'robert' ? 'rob' : 'coach'}"><b>${x.who === 'robert' ? 'Robert' : 'Trenér'} · <a href="#" onclick="App.date='${x.date}';go('dnes');return false">${czDateShort(x.date)}</a>:</b> ${esc(x.text)}</div>`).join('')}</div></div>`;
}
function noteCard(date, day) {
  const rep = coachReply(date); const coach = realCoach() && !App.preview;
  return `<div class="card"><h2>💬 Poznámka ke dni${help('Napiš trenérovi, co se dělo – bolest, únava, jídlo mimo plán, proč něco nevyšlo. Trenér odpoví přímo sem. Pár slov stačí.')}</h2>
    ${coach ? '' : hungerRow(date, day)}
    ${coach ? `<div class="notebox">${day.note ? `<div class="nb rob"><b>Robert${day.noteAt ? ' · ' + czDateShort(isoDate(new Date(day.noteAt))) : ''}:</b> ${esc(day.note)}</div>` : '<div class="small muted">Robert k tomuto dni nic nenapsal.</div>'}
      <div class="row" style="margin-top:8px"><input type="text" id="rep-${date}" value="${esc(rep && rep.reply || '')}" placeholder="odpověď Robertovi…" style="flex:1;min-width:200px;pointer-events:auto"><button class="btn sm" style="pointer-events:auto" onclick="A.saveReply('${date}',document.getElementById('rep-${date}').value.trim())">Odeslat</button></div></div>`
    : `<div class="notebox"><textarea id="note-${date}" rows="2" placeholder="např. bolelo koleno, běh jsem vynechal; v práci byl dort…" style="resize:vertical">${esc(day.note || '')}</textarea><div class="row" style="margin-top:6px"><button class="btn sm write" onclick="A.saveNote('${date}',document.getElementById('note-${date}').value.trim())">Uložit poznámku</button></div>
      ${rep && rep.reply ? `<div class="nb coach" style="margin-top:8px"><b>Trenér${rep.at ? ' · ' + czDateShort(isoDate(new Date(rep.at))) : ''}:</b> ${esc(rep.reply)}</div>` : ''}</div>`}</div>`;
}

/* ===== „Co jsem snědl“ – text → suroviny ===== */
function parseAteText(text) {
  const foods = Foods(); const t = ' ' + text.toLowerCase().replace(/[,.;]/g, ' ') + ' '; const found = [];
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const tn = norm(t);
  foods.forEach(f => { const words = norm(f.name).split(/[\s(/]+/).filter(w => w.length > 3); if (!words.length) return; const stem = words[0].slice(0, Math.max(4, words[0].length - 2)); if (tn.includes(stem)) found.push(f); });
  // odstranit duplicity se stejným kmenem – vzít nejkratší název
  const by = {}; found.forEach(f => { const k = norm(f.name).split(/[\s(/]+/)[0].slice(0, 4); if (!by[k] || f.name.length < by[k].name.length) by[k] = f; });
  return Object.values(by).slice(0, 8);
}
A.ateText = (key, text) => { const day = effectiveDay(App.date); const m = day.meals[key]; m.ate_text = text; const found = parseAteText(text);
  Undo.run(found.length ? `Rozpoznáno ${found.length} surovin – uprav gramy` : 'Zapsáno. Suroviny jsem nerozpoznal – přidej je ručně.', () => { m.extra = found.map(f => { const ms = measureOf(f.name); return { food: f.name, g: ms.g && ms.m !== 'vaz' ? ms.g : 100 }; }); saveDay(day); }); render(); };

/* ===== Generátor: rutina (stejná snídaně a svačina) ===== */
function routineOn() { const p = Prefs(); return p.routine !== false; }
A.toggleRoutine = () => { const p = Prefs(); p.routine = !routineOn(); savePrefs(p); UI.toast(p.routine ? 'Rutina zapnutá: snídaně a svačina stejné celý týden' : 'Rutina vypnutá: každý den jiné'); render(); };

/* ===== Krabičky: vaření jako záznam, ne zaškrtávátko =====
   Dřív bylo „uvařeno“ jen příznak receptu na týden. Proto nešlo vařit od středy,
   nešlo vařit na půl týdne a řádek hlásil „uvařeno“ i to, co uvařené nebylo.
   Záznam říká: kdy, co, kolik porcí a které sloty (den + chod) to pokrývá.
   Z toho vypadne i zbytek v lednici – uvaříš 4 porce, sníš 3, jedna zbývá. */
function cooks() { const p = Prefs(); return (p.cooks || []).filter(c => !c.del); }
function saveCooks(list) { const p = Prefs(); p.cooks = list; savePrefs(p); }
function cookFor(date, key) { return cooks().find(c => (c.covers || []).some(x => x.d === date && x.k === key)); }
/* kolik porcí ze záznamu ještě nebylo snědeno */
function cookLeft(c) {
  const snedeno = (c.covers || []).filter(x => { const day = effectiveDay(x.d); return (day.meals[x.k] || {}).eaten; }).length;
  return Math.max(0, (c.n || 0) - snedeno);
}
/* trvanlivost v lednici podle složení: maso a ryby 3 dny, jinak 4, samé suché 5 */
function shelfDays(items, foods) {
  const fm = Object.fromEntries(foods.map(f => [f.name, f]));
  const cats = Object.keys(items).map(n => (fm[n] || {}).cat || '');
  if (cats.some(c => c === 'Maso' || c === 'Ryby')) return 3;
  if (cats.some(c => c === 'Mléčné a sýry' || c === 'Zelenina')) return 4;
  return 5;
}
A.cookDone = (recipe, n, covers, gc) => Undo.run('Uvařeno', () => {
  const list = cooks().concat([{ id: 'c' + Date.now(), at: todayISO(), recipe, n, covers, gc: gc || 0 }]);
  saveCooks(list); render();
}, `Uvařeno ${n}× ${recipe}. Krabičky pokrývají ${covers.length} ${covers.length === 1 ? 'jídlo' : (covers.length < 5 ? 'jídla' : 'jídel')}.`);
A.cookDel = id => UI.confirm('Smazat záznam o vaření? Krabičky se přestanou počítat.', () => {
  saveCooks(cooks().filter(c => c.id !== id)); render(); UI.toast('Záznam smazán.');
}, 'Smazat');
A.cookWeigh = (id, v) => { const list = cooks(); const c = list.find(x => x.id === id); if (!c) return; c.gc = Number(v) || 0; saveCooks(list); render(); };

/* ===== Progres v tréninku (trenér) ===== */
function exerciseHistory(ex) { const uid = Store.ownerId(); let done = 0, weeks = new Set(); Store.rows('days', uid).forEach(r => { const d = r.data; if (!d.training || !d.training.done) return; const act = dayActivityPlan(d.date); (act.items || []).forEach((it, i) => { if (it.ex === ex && d.training.done[i]) { done++; weeks.add(mondayOf(d.date)); } }); }); return { done, weeks: weeks.size }; }
function progressSuggestion(it) { if (it.type !== 'strength') return null; const h = exerciseHistory(it.ex); if (h.weeks >= 2 && h.done >= 4) { const lib = EX_LIB.find(e => e.ex === it.ex); return lib && lib.timed ? { text: `${h.done}× splněno ve ${h.weeks} týdnech → +10 s`, apply: { reps: it.reps + 10 } } : (it.reps < 15 ? { text: `${h.done}× splněno ve ${h.weeks} týdnech → +1 opakování`, apply: { reps: it.reps + 1 } } : { text: `${h.done}× splněno, ${it.reps} opak. → +1 série, zpět na 10`, apply: { sets: it.sets + 1, reps: 10 } }); } return h.done ? { text: `${h.done}× splněno` } : null; }
A.tpApplyProgress = (j) => { const pl = trainingPlans().find(p => p.id === App.tpId); const it = pl.days[App.tpDay].items[j]; const sg = progressSuggestion(it); if (!sg || !sg.apply) return; Object.assign(it, sg.apply); Undo.run(`Progres: ${it.ex} → ${it.sets} × ${it.reps}`, () => saveTrainingPlan(pl)); render(); };

/* ===== Fáze chůze: návrh přepnutí tempa ===== */
const PHASE_KMH = [[124, 5], [117, 5.5], [110, 6], [102, 6.5], [0, 7]];
function phaseSuggestion() { const s = S(), ov = calcOverview(s, Meas()); let rec = 5; for (const [th, k] of PHASE_KMH) { if (ov.cur > th) { rec = k; break; } rec = k; } if (rec > s.walk_kmh && ov.count >= 7) return { rec, text: `Robert je pod ${PHASE_KMH.find(x => x[1] === rec) ? (PHASE_KMH[PHASE_KMH.findIndex(x => x[1] === rec) - 1] || [124])[0] : 124} kg – fáze doporučuje tempo ${fmt1(rec)} km/h (teď ${fmt1(s.walk_kmh)}).` }; return null; }
A.applyPhase = kmh => { const s = S(); const d = { ...s }; delete d.met; delete d.phase_thresholds; delete d.phases; d.walk_kmh = kmh; Undo.run(`Tempo chůze změněno na ${fmt1(kmh)} km/h`, () => saveSettings(d), 'Robertův limit i plány se přepočítaly.'); render(); };

/* ===== Změny od minulé návštěvy trenéra ===== */
function sinceLast() {
  const key = 'coachSeen:' + Store.ownerId(); const seen = LS.get(key, null); const now = new Date().toISOString(); LS.set(key, now);
  if (!seen) return { first: true, items: [] };
  const uid = Store.ownerId(); const items = [];
  Store.rows('measurements', uid).filter(r => r.updated_at > seen).forEach(r => items.push(`⚖️ ${czDateShort(r.data.date)}: váha ${fmt1(r.data.weight)} kg${r.data.waist ? `, pas ${r.data.waist} cm` : ''}`));
  Store.rows('days', uid).filter(r => r.updated_at > seen).forEach(r => { const d = r.data; const ev = evaluateDay(d.date); const bits = []; if (d.closed) bits.push(d.closedOk ? 'den OK' : 'den nesedí'); if (ev.cheats.beers) bits.push(`🍺 ${ev.cheats.beers}`); if (ev.cheats.fried) bits.push('🍟'); if (ev.cheats.over) bits.push(`+${ev.cheats.over} kcal přes`); if (d.note) bits.push(`💬 „${d.note.slice(0, 60)}“`); if (d.training && Object.values(d.training.done || {}).some(Boolean)) bits.push('🏋️ trénink'); if ((d.walk_min || 0)) bits.push(`🚶 ${d.walk_min} min`); items.push(`📅 ${czDateShort(d.date)}: ${bits.join(' · ') || 'zápis upraven'}`); });
  Store.rows('week_plans', uid).filter(r => r.updated_at > seen).forEach(r => items.push(`🗓️ Plán týdne od ${czDateShort(r.data.week)} změněn (${r.data.plan.flat().filter(Boolean).length}/35)`));
  Store.rows('recipes', uid).filter(r => r.updated_at > seen).forEach(r => items.push(`📖 Recept: ${r.data.name}${r.data.overrides ? ' (jeho verze)' : ''}`));
  return { first: false, since: seen, items };
}
App.dashDetail = false;
function quietHeader() {
  const s = S(), ov = calcOverview(s, Meas()); const g = paceGuard(); const ch = sinceLast();
  const noWeigh3 = [1, 2, 3].filter(k => !Meas().some(m => m.date === addDays(todayISO(), -k) && m.weight != null)).length;
  const lvl = g.some(x => x.lv === 1) || noWeigh3 >= 3 ? 1 : (g.length || noWeigh3 >= 2 || (ov.weekBack && ov.weekBack.lostW != null && ov.weekBack.lostW < ov.weekBack.planW * 0.5) ? 2 : 3);
  const state = { 1: ['🔴', 'Zasáhnout'], 2: ['🟡', 'Sledovat'], 3: ['🟢', 'V pořádku'] }[lvl];
  let line = ov.weekBack && ov.weekBack.lostW != null ? (ov.weekBack.lostW >= ov.weekBack.planW * 0.9 ? `Váha −${fmt2(ov.weekBack.lostW)} kg za týden, drží tempo.` : ov.weekBack.lostW > 0 ? `Váha −${fmt2(ov.weekBack.lostW)} kg, pomaleji než plán (${fmt2(ov.weekBack.planW)}).` : 'Váha za týden nešla dolů.') : 'Zatím málo dat na týdenní trend.';
  const sugg = lvl === 3 ? `Robertovi: „Dobrá práce, ${fmt1(ov.lost)} kg dole. Drž pátky a jedeme dál.“` : (g[0] ? g[0].text.replace(/^[^ ]+ /, '') : `Robertovi: „${noWeigh3 >= 2 ? 'Zvaž se každé ráno – bez čísel nevidím, jak jdeš.' : 'Drž limit a dojdi svých 60 minut.'}“`);
  const ph = phaseSuggestion();
  return `<div class="card quiet"><div class="row between"><div><div class="qs">${state[0]} ${state[1]}</div><div class="qline">${esc(line)}</div></div><button class="btn sec sm" onclick="App.dashDetail=!App.dashDetail;render()">${App.dashDetail ? 'Skrýt detail' : 'Detail'}</button></div>
    ${paceLine()}
    <div class="qsugg"><span>✉️</span><div>${esc(sugg)}</div><button class="btn sm" onclick="saveCoachNote(${JSON.stringify(sugg.replace(/^Robertovi: [„"]?/, '').replace(/[“"]$/, '')).replace(/"/g, '&quot;')});UI.toast('Odesláno jako vzkaz Robertovi');render()">Poslat jako vzkaz</button></div>
    ${settingsAdvice().filter(a => a.lv === 1).slice(0, 2).map(a => `<div class="alert a1" style="margin-top:8px"><div style="flex:1">⚙️ ${esc(a.text)}</div>${a.apply ? `<button class="btn sm" onclick="A.applyAdvice(${JSON.stringify(JSON.stringify(a.apply)).replace(/"/g, '&quot;')})">${a.label}</button>` : '<button class="btn sec sm" onclick="go(\'nastaveni\')">Nastavení</button>'}</div>`).join('')}
    ${ph ? `<div class="alert a2" style="margin-top:8px">🚶 ${esc(ph.text)} <button class="btn sm" style="margin-left:8px" onclick="A.applyPhase(${ph.rec})">Přepnout na ${fmt1(ph.rec)} km/h</button></div>` : ''}
    <details style="margin-top:10px" ${ch.items.length && ch.items.length <= 12 ? 'open' : ''}><summary class="small b" style="cursor:pointer">🔔 Od tvé poslední návštěvy${ch.first ? '' : ` (${czDateShort(isoDate(new Date(ch.since)))})`} · ${ch.first ? 'první návštěva' : ch.items.length + (ch.items.length === 1 ? ' změna' : (ch.items.length > 1 && ch.items.length < 5) ? ' změny' : ' změn')}</summary>
      ${ch.items.length ? `<ul class="qlist">${ch.items.slice(0, 30).map(t => `<li>${t}</li>`).join('')}</ul>` : '<p class="small muted" style="margin:6px 0 0">Nic nového.</p>'}</details></div>`;
}

/* ===== Týdenní zpráva (pondělí) ===== */
VIEWS.zprava = function () {
  const s = S(), ov = calcOverview(s, Meas()); const uid = Store.ownerId();
  const mon = mondayOf(todayISO()); const start = App.repWeek || addDays(mon, -7); const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const recs = days.map(dt => Store.rows('days', uid).find(r => r.data.date === dt)).filter(Boolean).map(r => r.data);
  const evs = recs.map(r => evaluateDay(r.date));
  const okN = recs.filter(r => r.closedOk).length, walk = recs.reduce((a, r) => a + (r.walk_min || 0), 0), beers = evs.reduce((a, e) => a + e.cheats.beers, 0), fried = evs.reduce((a, e) => a + e.cheats.fried, 0), over = evs.filter(e => e.cheats.over).length;
  const trainPlanned = days.reduce((a, dt) => a + ((dayActivityPlan(dt).items || []).length ? 1 : 0), 0), trainDone = recs.filter(r => r.training && Object.values(r.training.done || {}).some(Boolean)).length;
  const weigh = days.filter(dt => Meas().some(m => m.date === dt && m.weight != null)).length;
  const wRows = ov.rows.filter(r => days.includes(r.date)); const wStart = ov.rows.filter(r => r.date < start).slice(-1)[0]; const wEnd = wRows.slice(-1)[0];
  const delta = wStart && wEnd ? wEnd.avg - wStart.avg : null;
  const notes = recs.filter(r => r.note).map(r => `${czDateShort(r.date)}: ${r.note}`);
  const intakeAvg = evs.filter(e => e.d.tot.kcal).length ? evs.filter(e => e.d.tot.kcal).reduce((a, e) => a + e.d.intake, 0) / evs.filter(e => e.d.tot.kcal).length : 0;
  const limitAvg = evs.filter(e => e.d.tot.kcal).length ? evs.filter(e => e.d.tot.kcal).reduce((a, e) => a + e.d.base.maxIntake, 0) / evs.filter(e => e.d.tot.kcal).length : 0;
  const say = [];
  if (delta != null) say.push(delta <= -0.6 ? `Váha −${fmt2(-delta)} kg za týden – přesně tempo plánu, chval.` : delta < 0 ? `Váha −${fmt2(-delta)} kg – směr dobrý, tempo pomalejší; zkontroluj pátky a limit.` : `Váha +${fmt2(delta)} kg – týden bez úbytku; ptej se na pití a víkend.`);
  if (weigh < 5) say.push(`Vážil se jen ${weigh}× – bez čísel nevidíš trend. Připomeň ranní váhu.`);
  if (okN >= 5) say.push(`${okN} z 7 dnů v pořádku – disciplína drží.`); else if (recs.length) say.push(`Jen ${okN} dnů v pořádku z ${recs.length} zapsaných – podívej se, co nejčastěji nesedí (${(() => { const c = {}; evs.forEach(e => e.d.checks.filter(x => x.state === 1).forEach(x => { c[x.name] = (c[x.name] || 0) + 1; })); return Object.entries(c).sort((a, b) => b[1] - a[1]).map(x => x[0].toLowerCase()).slice(0, 2).join(', ') || 'zápisy chybí'; })()}).`);
  if (beers > 6 || over >= 2) say.push(`Cheaty: ${beers} piv, ${over} dnů přes limit – pátek řeš explicitně (3 piva místo 6 = 4 kg za rok).`);
  if (trainPlanned && trainDone < trainPlanned) say.push(`Trénink splnil ${trainDone} z ${trainPlanned} – zjisti proč (čas, bolest, chuť) a případně zkrať.`);
  if (intakeAvg && intakeAvg < limitAvg - 300) say.push(`Jedl průměrně ${fmt0(intakeAvg)} kcal při limitu ${fmt0(limitAvg)} – deficit je moc velký, ať dojídá přílohy.`);
  if (!say.length) say.push('Týden v normě – krátká pochvala stačí.');
  const text = `Týden ${czDateShort(start)}–${czDateShort(addDays(start, 6))}\nVáha: ${wEnd ? fmt1(wEnd.avg) + ' kg (Ø7)' : '–'}${delta != null ? `, změna ${(delta > 0 ? '+' : '') + fmt2(delta)} kg` : ''}, od startu −${fmt1(ov.lost)} kg\nDny v pořádku: ${okN}/${recs.length} · vážení ${weigh}/7 · chůze ${fmt0(walk)} min · trénink ${trainDone}/${trainPlanned} · běžná chůze Ø ${(() => { const st = stepsStat(days); return st ? fmt0(st.avg) + ' kroků' : '–'; })()}\nCheaty: ${beers} piv, ${fmt0(fried)} g smaženého, ${over} dnů přes limit\nPrůměrný příjem ${fmt0(intakeAvg)} kcal / limit ${fmt0(limitAvg)}\n${notes.length ? 'Poznámky Roberta:\n' + notes.map(n => '– ' + n).join('\n') + '\n' : ''}Co říct:\n${say.map(x => '– ' + x).join('\n')}`;
  return `${flow('zprava', ['Přečti si shrnutí týdne', 'Uprav si text', 'Zkopíruj a pošli Robertovi'], 'Zpráva se skládá sama z toho, co Robert za týden zapsal.')}
  <div class="row between" style="margin-bottom:8px"><h1>📋 Týdenní zpráva${help('Shrnutí minulého týdne pro trenéra: váha, disciplína, aktivita, cheaty a Robertovy poznámky, plus tři věty, co mu říct. „Zkopírovat“ vloží text do schránky pro zprávu; „Poslat jako vzkaz“ ho ukáže Robertovi na Dnes.')}</h1><div class="row"><button class="btn sec sm" onclick="App.repWeek=addDays('${start}',-7);render()">‹ týden zpět</button><b>${czDateShort(start)}–${czDateShort(addDays(start, 6))}</b>${start < addDays(mon, -7) ? `<button class="btn sec sm" onclick="App.repWeek=addDays('${start}',7);render()">další ›</button>` : ''}</div></div>
  <div class="card"><div class="stats3 wk"><div><b>${wEnd ? fmt1(wEnd.avg) : '–'} <small>kg</small></b><span>Ø7 na konci týdne</span></div><div><b class="${delta != null && delta < 0 ? 'ok' : 'bad'}">${delta != null ? (delta > 0 ? '+' : '') + fmt2(delta) : '–'} <small>kg</small></b><span>změna za týden</span></div><div><b class="${okN >= 5 ? 'ok' : 'warn'}">${okN} <small>/ ${recs.length}</small></b><span>dnů v pořádku</span></div><div><b class="${weigh >= 6 ? 'ok' : 'warn'}">${weigh} <small>/ 7</small></b><span>vážení</span></div><div><b>${fmt0(walk)} <small>min</small></b><span>chůze</span></div><div><b class="${trainPlanned && trainDone < trainPlanned ? 'warn' : 'ok'}">${trainDone} <small>/ ${trainPlanned}</small></b><span>tréninků</span></div><div><b class="${beers > 6 || over ? 'bad' : ''}">${beers} 🍺 · ${over}</b><span>piv · dnů přes limit</span></div></div></div>
  <div class="grid"><div class="card"><h2>Co Robertovi říct</h2><ul class="qlist" style="margin-top:8px">${say.map(x => `<li>${esc(x)}</li>`).join('')}</ul><div class="row" style="margin-top:10px"><button class="btn sm" onclick="navigator.clipboard&&navigator.clipboard.writeText(${JSON.stringify(text).replace(/"/g, '&quot;')}).then(()=>UI.toast('Zpráva zkopírována do schránky'))">📋 Zkopírovat zprávu</button><button class="btn sec sm" onclick="saveCoachNote(${JSON.stringify(say[0]).replace(/"/g, '&quot;')});UI.toast('Poslána první věta jako vzkaz');render()">Poslat první větu jako vzkaz</button></div></div>
  <div class="card"><h2>Robertovy poznámky</h2>${notes.length ? `<ul class="qlist" style="margin-top:8px">${notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : '<p class="small muted" style="margin-top:6px">Žádné poznámky.</p>'}<h3 style="margin-top:12px">Den po dni</h3><table class="small" style="margin-top:6px"><tr><th>Den</th><th class="n">Příjem/limit</th><th class="n">Chůze</th><th>Stav</th></tr>${days.map(dt => { const r = recs.find(x => x.date === dt); if (!r) return `<tr><td>${czDateShort(dt)}</td><td colspan="3" class="muted">bez zápisu</td></tr>`; const e = evs[recs.indexOf(r)]; return `<tr><td>${czDateShort(dt)} ${DAY_SHORT[dayIndex(dt)]}</td><td class="n ${e.cheats.over ? 'bad' : ''}">${e.d.tot.kcal ? `${fmt0(e.d.intake)}/${fmt0(e.d.base.maxIntake)}` : '–'}</td><td class="n">${r.walk_min || 0} min</td><td class="${r.closedOk ? 'ok' : 'bad'}">${r.closedOk ? 'OK' : (r.closed ? 'nesedí' : 'otevřený')}${e.cheats.beers ? ` 🍺${e.cheats.beers}` : ''}</td></tr>`; }).join('')}</table></div></div>
  <div class="card tight"><pre class="small" style="white-space:pre-wrap;margin:0;font-family:inherit">${esc(text)}</pre></div>`;
};

/* ===== Tempo: cíl · plán · realita ===== */
function paceOverview() {
  const s = S(), w = currentWeight(), ov = calcOverview(s, Meas());
  const target = w * s.rate_pct / 100;                           // kg/týden podle nastavení
  const mon = mondayOf(todayISO()); const nextMon = addDays(mon, 7);
  const weekOf = m => Array.from({ length: 7 }, (_, i) => { const dt = addDays(m, i); const a = planActFor(dt, w); const b = calcBase(s, w, a.planWalk, 0, s.walk_kmh, 0, 0, a); return { dt, b, floorLoss: b.planLimit - (b.minOut - b.deficit) }; });
  const thisW = weekOf(mon), nextW = weekOf(nextMon);
  const proj = W => W.reduce((a, x) => a + (x.b.minOut - x.b.planLimit), 0) / KG_KCAL;
  const floorDays = W => W.filter(x => x.floorLoss > 0);
  const actual = ov.weekBack && ov.weekBack.lostW != null ? ov.weekBack.lostW : null;
  return { target, projThis: proj(thisW), projNext: proj(nextW), floorThis: floorDays(thisW), floorNext: floorDays(nextW), actual, ok: proj(thisW) >= target * 0.97 };
}
function paceLine() { const p = paceOverview(); return `<div class="pace"><span>🎯 cíl <b>−${fmt2(p.target)} kg</b>/týden</span><span>📐 plán <b class="${p.ok ? 'ok' : 'bad'}">−${fmt2(p.projThis)}</b></span><span>📈 realita <b class="${p.actual == null ? '' : p.actual >= p.target * 0.9 ? 'ok' : 'bad'}">${p.actual == null ? '–' : (p.actual >= 0 ? '−' : '+') + fmt2(Math.abs(p.actual))}</b></span>${p.floorThis.length ? `<span class="bad small">spodní hranice jídla ${p.floorThis.map(x => DAY_SHORT[dayIndex(x.dt)]).join(', ')} – deficit nižší o ${fmt0(p.floorThis.reduce((a, x) => a + x.floorLoss, 0))} kcal/týden</span>` : ''}</div>`; }

/* ===== Nesoulad plánu jídla a limitu dne (po změně tréninku) ===== */
function dayMismatch(date) {
  const s = S(), w = currentWeight(); const wk = getWeek(mondayOf(date)); const sels = wk.plan[dayIndex(date)];
  if (!sels.some(Boolean)) return null;
  const r = calcPlanDay(s, Foods(), Recipes(), sels, w, planActFor(date, w)); if (r.filled < 5) return null;
  const diff = r.planLimit - r.kcal;
  const wkRow = Store.rows('week_plans', Store.ownerId()).find(x => x.data.week === wk.week);
  const trainingChanged = TrainingRows().some(t => wkRow && t.updated_at > wkRow.updated_at && (t.id.startsWith('tp:') || t.id === oid('to', date)));
  if (Math.abs(diff) <= 100) return null;
  return { diff, limit: r.planLimit, planned: r.kcal, trainingChanged };
}
/* výběr receptu chodu, který se vejde do zbytku (remaining) a doplní bílkoviny */
function pickFitting(s, foods, recipes, courseKey, remaining, protGap, exclude, budgetOpt) {
  const course = s.courses.find(c => c.key === courseKey); const budget = budgetOpt || calcBase(s, currentWeight(), s.walk_min, 0, s.walk_kmh, 0, 0).planLimit; const favs = Prefs().favs;
  const cands = recipesFor(course.name).filter(r => r.name !== exclude).map(r => { const inf = calcCourse(s, foods, recipes, course, r.name, null, budget); const over = inf.kcal - remaining;
    return { name: r.name, score: (over > 30 ? 1000 + over : Math.abs(inf.kcal - remaining) * 0.6) - Math.min(inf.p, Math.max(0, protGap)) * 3 - (favs.includes(r.name) ? 40 : 0) + Math.random() * 20 }; });
  cands.sort((a, b) => a.score - b.score); return cands[0] ? cands[0].name : null;
}
/* dorovnat den: měnit chody, až plán sedí do limitu (±60) */
A.fitDay = date => { const s = S(), foods = Foods(), recipes = Recipes(), w = currentWeight(); const wk = getWeek(mondayOf(date)); const di = dayIndex(date); const act = planActFor(date, w);
  Undo.run('Den dorovnán k limitu', () => { const tried = new Set(); for (let t = 0; t < 10; t++) { const r = calcPlanDay(s, foods, recipes, wk.plan[di], w, act); const diff = r.planLimit - r.kcal; if (Math.abs(diff) <= 60) break;
      const cands = r.courses.map((c, ci) => ({ ci, c })).filter(x => x.c.active && !tried.has(x.ci)); if (!cands.length) break;
      cands.sort((a, b) => diff > 0 ? a.c.kcal - b.c.kcal : b.c.kcal - a.c.kcal); const pick = cands[0]; tried.add(pick.ci);
      const name = pickFitting(s, foods, recipes, s.courses[pick.ci].key, pick.c.kcal + diff, r.protTarget - r.p + pick.c.p, pick.c.sel, r.planLimit); if (name) wk.plan[di][pick.ci] = name; }
    saveWeek(wk); }, (() => { const r = calcPlanDay(s, foods, recipes, wk.plan[di], w, act); const diff = r.planLimit - r.kcal; return Math.abs(diff) <= 100 ? `Sedí: ${fmt0(r.kcal)} kcal při limitu ${fmt0(r.planLimit)}.` : diff > 0 ? `Recepty výš nesahají – ${fmt0(r.kcal)}/${fmt0(r.planLimit)} kcal. Zbylých ${fmt0(diff)} kcal přidej přílohou nebo ořechy v Jídlech dne.` : `Pořád přes o ${fmt0(-diff)} kcal – uber přílohu v Jídlech dne.`; })()); render(); };
/* ===== Spíž: trvanlivé suroviny =====
   Pravidlo návrhu: appka nepotřebuje vědět, kolik čeho máš doma. Potřebuje vědět,
   co NEMÁ dávat na lístek. Proto jen tři stavy a žádné gramy. Čerstvé suroviny se
   neevidují vůbec – ty kupuješ pokaždé znovu.
   Stav se odvozuje sám: odškrtnutím na lístku se položka překlopí na „mám“ a appka
   z týdenní spotřeby odhadne, na kolik týdnů balení vyjde. Až doba uplyne, sama se
   přepne na „dochází“ a objeví se na dalším lístku. Ty to jen opravíš, když se to rozejde. */
const PANTRY_ST = { mam: ['mám', 'ok'], dochazi: ['dochází', 'warn'], nemam: ['nemám', 'bad'] };
function pantryRaw() { const p = Prefs(); return p.pantry || {}; }
function pantryState(food, weeklyNeed) {
  const r = pantryRaw()[food];
  if (!r) return 'nemam';
  if (r.st !== 'mam') return r.st;
  if (!r.at || !(weeklyNeed > 0) || !r.g) return 'mam';
  const tydnu = r.g / weeklyNeed;
  const uplynulo = daysBetween(r.at, todayISO()) / 7;
  return uplynulo >= tydnu ? 'dochazi' : 'mam';
}
function setPantry(food, st, g) {
  const p = Prefs(); p.pantry = p.pantry || {};
  if (st === 'mam') p.pantry[food] = { st, at: todayISO(), g: g || (p.pantry[food] || {}).g || 0 };
  else p.pantry[food] = { st };
  savePrefs(p);
}
A.pantry = (food, st) => { setPantry(food, st); render(); UI.toast(`${food}: ${PANTRY_ST[st][0]}`); };

/* Doplnění zpětně: když Robert pár dní nezapisoval, nemá proklikávat dny po jednom
   a hádat, co mu chybí. Tohle mu řekne kolik a hodí ho rovnou na první takový den. */
function catchUpAlert() {
  const today = todayISO(); const miss = []; const ms = Meas();
  for (let k = 1; k <= 7; k++) { const dt = addDays(today, -k);
    const day = effectiveDay(dt); const meas = ms.some(m => m.date === dt && m.weight != null);
    const jidlo = S().courses.some(c => (day.meals[c.key] || {}).eaten);
    if (!jidlo && !meas && !(day.walk_min > 0)) miss.push(dt); }
  if (!miss.length) return '';
  const first = miss[miss.length - 1];
  return `<div class="alert a2" style="margin-bottom:10px"><div style="flex:1">${miss.length === 1 ? `Za ${czDateShort(miss[0])} nemáš zapsáno nic – ani váhu, ani jídlo, ani chůzi.` : `Chybí ti zápisy za ${miss.length} dny: ${miss.slice().reverse().map(czDateShort).join(', ')}.`} Doplň aspoň váhu, průměr se pak srovná.</div><button class="btn sm" onclick="App.date='${first}';App.stripWeek=mondayOf('${first}');go('dnes')">Doplnit ${czDateShort(first)}</button></div>`;
}
function mismatchAlert(date) { const m = dayMismatch(date); if (!m) return ''; return `<div class="alert ${m.diff > 0 ? 'a2' : 'a1'}" style="margin-bottom:10px"><div style="flex:1">${m.trainingChanged ? '🏋️ Trenér změnil trénink. ' : ''}Limit dne je <b>${fmt0(m.limit)} kcal</b>, plán jídel má <b>${fmt0(m.planned)}</b> – ${m.diff > 0 ? `<b>přidej ${fmt0(m.diff)} kcal</b>, jinak jsi v moc velkém deficitu` : `<b>uber ${fmt0(-m.diff)} kcal</b>, jinak jsi přes`}.</div><button class="btn sm write" onclick="A.fitDay('${date}')">💡 Dorovnat</button></div>`; }

/* ===== Běžná denní chůze (kroky) – jen informace pro trenéra, nepočítá se do cíle ani limitu ===== */
/* cíl kroků (nastavuje se jednou) vs. co Robert opravdu ušel (zapisuje každý den).
   Dřív se tyhle dvě věci mísily: dokud nic nezapsal, tvářil se cíl jako skutečnost
   a trenér podle vymyšlených čísel ladil faktor aktivity. */
function stepsGoal() { const p = Prefs(); return p.defaultSteps || 5000; }
function defaultSteps() { return stepsGoal(); }
function daySteps(day) { return day.steps != null ? day.steps : null; }
A.setSteps = (v, isDefault) => { const n = Number(v) || 0; if (isDefault) { const p = Prefs(); p.defaultSteps = n; savePrefs(p); UI.toast(`Výchozí běžná chůze: ${fmt0(n)} kroků/den`); }
  else Undo.run(`Běžná chůze dnes: ${fmt0(n)} kroků`, () => { const day = getDay(App.date); day.steps = n; saveDay(day); }, 'Jen pro trenéra – do cíle chůze se nepočítá.'); render(); };
function stepsStat(days) { const uid = Store.ownerId(); const vals = days.map(dt => { const r = Store.rows('days', uid).find(x => x.data.date === dt); return r ? daySteps(r.data) : null; }).filter(v => v != null); return vals.length ? { avg: vals.reduce((a, b) => a + b, 0) / vals.length, n: vals.length, min: Math.min(...vals) } : null; }

/* ===== Doporučení k nastavení (trenér) ===== */
function factorForSteps(avg) { if (avg < 3000) return 1.2; if (avg < 4500) return 1.28; if (avg < 6500) return 1.34; if (avg < 8500) return 1.4; return 1.48; }
function settingsAdvice() {
  const s = S(), w = currentWeight(), ov = calcOverview(s, Meas()); const A_ = [];
  const b = calcBase(s, w, s.walk_min, 0, s.walk_kmh, 0, 0);
  // kroky → faktor aktivity
  const st = stepsStat(Array.from({ length: 14 }, (_, i) => addDays(todayISO(), -i)));
  if (st && st.n >= 5) { const rec = factorForSteps(st.avg); if (Math.abs(rec - s.activity) >= 0.05) { const dl = Math.round((rec - s.activity) * b.bmr);
    A_.push({ field: 'activity', lv: 1, text: `Běžná chůze Ø ${fmt0(st.avg)} kroků/den (${st.n} dní), faktor ${String(s.activity).replace('.', ',')} počítá s ~5 000. ${rec < s.activity ? `Výdej je nadhodnocený o ~${fmt0(-dl)} kcal/den – Robert by mohl hubnout pomaleji, než čekáš, nebo přibírat.` : `Výdej je podhodnocený o ~${fmt0(dl)} kcal/den – Robert je ve větším deficitu, než chceš.`} Doporučení: faktor ${String(rec).replace('.', ',')} (limit ${dl > 0 ? '+' : ''}${fmt0(dl)} kcal/den).`, apply: { activity: rec }, label: `Nastavit ${String(rec).replace('.', ',')}` }); }
    else A_.push({ field: 'activity', lv: 3, text: `Běžná chůze Ø ${fmt0(st.avg)} kroků/den sedí s faktorem ${String(s.activity).replace('.', ',')}.` }); }
  // tempo
  if (s.rate_pct > 1) A_.push({ field: 'rate_pct', lv: 1, text: `Tempo ${String(s.rate_pct).replace('.', ',')} % je nad 1 % – riziko ztráty svalu a únavy. Doporučení: 0,7–1,0 %.`, apply: { rate_pct: 1 }, label: 'Nastavit 1,0 %' });
  else if (s.rate_pct < 0.5) A_.push({ field: 'rate_pct', lv: 2, text: `Tempo ${String(s.rate_pct).replace('.', ',')} % je pomalé (−${fmt2(w * s.rate_pct / 100)} kg/týden). Pro ${fmt0(w)} kg je udržitelné 0,7 %.`, apply: { rate_pct: 0.7 }, label: 'Nastavit 0,7 %' });
  if (ov.weekBack && ov.weekBack.lostW != null && ov.count >= 14) { if (ov.weekBack.lostW > ov.weekBack.planW * 1.4) A_.push({ field: 'rate_pct', lv: 2, text: `Realita −${fmt2(ov.weekBack.lostW)} kg/týden je výrazně nad cílem −${fmt2(ov.weekBack.planW)}. Buď nejí do limitu, nebo je výdej nastavený výš, než je – zkontroluj kroky a faktor; tempo nezvyšuj.` }); }
  // bílkoviny
  const pMin = Math.round(1.6 * s.goal_weight), pMax = Math.round(2.0 * s.goal_weight);
  if (s.protein_min < pMin) A_.push({ field: 'protein_min', lv: 2, text: `Minimum bílkovin ${s.protein_min} g je pod doporučením ${pMin}–${pMax} g (1,6–2 g na kg cílové váhy) – při deficitu chrání sval.`, apply: { protein_min: pMin }, label: `Nastavit ${pMin} g` });
  else if (s.protein_min > pMax + 20) A_.push({ field: 'protein_min', lv: 2, text: `Minimum bílkovin ${s.protein_min} g je zbytečně vysoké (doporučení ${pMin}–${pMax} g) – zvedá cenu jídla a ubírá místo příloze.` });
  // chůze
  if (s.walk_min < 30) A_.push({ field: 'walk_min', lv: 2, text: `Denní cíl chůze ${s.walk_min} min je málo – bez pohybu limit padá na spodní hranici (klidový výdej) a deficit vyjde menší, než má. Sešit počítá se 60.` });
  if (s.walk_min > 120) A_.push({ field: 'walk_min', lv: 2, text: `Cíl ${s.walk_min} min denně je hodně; nad 90 min klesá plnění. Raději trénink navíc než delší chůze.` });
  // pas, cíl
  if (Math.abs(s.goal_waist - s.height / 2) > 4) A_.push({ field: 'goal_waist', lv: 3, text: `Cílový pas ${s.goal_waist} cm; zdravotní práh je polovina výšky = ${Math.round(s.height / 2)} cm.` });
  const bmiGoal = s.goal_weight / Math.pow(s.height / 100, 2); if (bmiGoal < 20 || bmiGoal > 30) A_.push({ field: 'goal_weight', lv: 2, text: `Cílová váha ${s.goal_weight} kg = BMI ${fmt1(bmiGoal)}. ${bmiGoal > 30 ? 'Stále obezita – po dosažení zvaž další cíl.' : 'Pod 20 – příliš nízký cíl.'}` });
  // chody vs limit
  const sum = courseTargetSum(s); if (Math.abs(sum - 2450) > 300) A_.push({ field: 'courses', lv: 2, text: `Součet cílů chodů ${sum} kcal se výrazně liší od základny sešitu 2 450 – poměr chodů řídí jen dělení limitu, součet sám limit nemění; nech blízko 2 450.` });
  // spodní hranice jídla
  if (b.planBelowBmr) A_.push({ field: 'walk_min', lv: 1, text: `S nastavenou chůzí ${s.walk_min} min by limit vyšel pod klidový výdej (${fmt0(b.bmr)} kcal) – spodní hranice ho drží nahoře, takže deficit vyjde menší než cíl. Přidej chůzi nebo sniž tempo.` });
  return A_;
}
A.applyAdvice = (json) => { const s = S(); const d = { ...s }; delete d.met; delete d.phase_thresholds; delete d.phases; Object.assign(d, JSON.parse(json)); Undo.run('Nastavení upraveno podle doporučení', () => saveSettings(d), 'Robertův limit i plány se přepočítaly.'); render(); };
function adviceBox(field) { const list = settingsAdvice().filter(a => a.field === field); return list.map(a => `<div class="alert a${a.lv}" style="margin-top:6px"><div style="flex:1">${esc(a.text)}</div>${a.apply ? `<button class="btn sm" onclick="A.applyAdvice(${JSON.stringify(JSON.stringify(a.apply)).replace(/"/g, '&quot;')})">${a.label}</button>` : ''}</div>`).join(''); }
