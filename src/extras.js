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
function containersCard() { const c = containers(); return `<div class="card stack s8"><h2>🥄 Moje nádoby</h2><p class="small muted">Podle nich se počítají míry „≈ 1 hrnek“ v receptech. Hrnek změř jednou (nalij vodu a přelij do odměrky), platí všude.</p>
  <div class="grid g2">${Object.entries(c).map(([k, v]) => `<div class="field"><label class="f">${v.label}</label><div class="numf" style="flex:1"><input type="text" inputmode="decimal" value="${v.g != null ? v.g : v.ml}" onchange="A.setContainer('${k}',this.value)" style="width:100%"><span>${v.g != null ? 'g' : 'ml'}</span></div>${SEED.containers[k].ml !== v.ml || SEED.containers[k].g !== v.g ? `<div class="hint">výchozí ${SEED.containers[k].g != null ? SEED.containers[k].g + ' g' : SEED.containers[k].ml + ' ml'}</div>` : ''}</div>`).join('')}</div>
  <p class="hint">1 hrnek (${c.hrnek.ml} ml) ≈ ${fmt0(c.hrnek.ml * 0.8)} g vařené rýže · 1 lžíce (${c.lzice.ml} ml) ≈ ${fmt0(c.lzice.ml * 1.2)} g tvarohu, ${fmt0(c.lzice.ml * 0.5)} g vloček.</p></div>`; }

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

/* Hlad je jediný signál, který trenérovi z čísel chybí. Pět dní vlčího hladu v řadě
   znamená, že tempo je moc rychlé. */
/* ===== Jak šel den: krátký záznam pro trenéra při potvrzení dne (1. 10. 2026) =====
   Trenér potřebuje kontext, ne čísla navíc. Robert ťukne na hotové odpovědi (všechno
   nepovinné, nic ho nezdrží) a může dopsat pár slov. Je to jednosměrný záznam dne –
   v appce dál nejsou vzkazy ani odpovědi. Hlad zůstává v day.hunger (signály s ním počítají). */
const HLAD = [['ok', '🙂 v pohodě'], ['hlad', '😐 hlad'], ['vlk', '😖 vlčí hlad']];
const CHECKIN = [
  ['feel', '😊 Jak ses cítil?', [['super', '😀 skvěle'], ['ok', '🙂 dobře'], ['meh', '😐 nic moc'], ['bad', '😣 špatně']]],
  ['hunger', '🍽️ Hlad', HLAD],
  ['crave', '🍫 Chutě na sladké nebo slané', [['ne', 'žádné'], ['trochu', 'trochu'], ['silne', 'silné']]],
  ['move', '🚶 Pohyb šel', [['lehce', 'lehce'], ['akorat', 'akorát'], ['tezce', 'těžce'], ['bolest', '🤕 něco bolí']]],
  ['sleep', '😴 Spánek minulou noc', [['dobre', 'dobře'], ['prumer', 'průměrně'], ['spatne', 'špatně']]],
  ['stress', '🧠 Stres', [['klid', 'klid'], ['bezny', 'běžný'], ['hodne', 'hodně']]]];
const checkinVal = (day, k) => k === 'hunger' ? day.hunger : ((day.checkin || {})[k]);
const checkinLabel = (k, v) => { const q = CHECKIN.find(x => x[0] === k); const o = q && q[2].find(x => x[0] === v); return o ? o[1] : ''; };
/* zápis bez hlášky – ťuká se rychle za sebou, toast by jen překážel */
A.setCheckin = (date, k, v) => { const day = getDay(date);
  if (k === 'hunger') day.hunger = day.hunger === v ? null : v;
  else { day.checkin = day.checkin || {}; if (k === 'note') day.checkin.note = String(v || '').trim().slice(0, 500) || null; else day.checkin[k] = day.checkin[k] === v ? null : v; }
  saveDay(day); render(); };
A.setHunger = (date, v) => A.setCheckin(date, 'hunger', v);
function checkinHtml(date, day) {
  return `<div class="stack s8">${CHECKIN.map(([k, q, opts]) => `<div class="field"><label class="f">${q}</label><div class="chips">${opts.map(([v, l]) => `<button class="chip ${checkinVal(day, k) === v ? 'on' : ''} write" onclick="A.setCheckin('${date}','${k}','${v}')">${l}</button>`).join('')}</div></div>`).join('')}
    <div class="field"><label class="f">✍️ Chceš něco dodat? <span class="muted">(nepovinné)</span></label><textarea id="ci-note" rows="2" class="write" placeholder="např. v práci byl dort, bolelo koleno…" onchange="A.setCheckin('${date}','note',this.value)">${esc((day.checkin || {}).note || '')}</textarea></div></div>`;
}
function hungerRow(date, day) { return checkinHtml(date, day); }
/* krátké shrnutí pro trenéra: „😀 skvěle · hlad · chutě silné · …“ */
function checkinSummary(day) { const parts = CHECKIN.map(([k]) => { const v = checkinVal(day, k); if (!v) return ''; const l = checkinLabel(k, v);
  return k === 'feel' ? l : k === 'hunger' ? 'hlad: ' + l.replace(/^\S+ /, '') : k === 'crave' ? 'chutě ' + l : k === 'move' ? 'pohyb ' + l.replace(/^\S+ /, '') : k === 'sleep' ? 'spánek ' + l : 'stres ' + l; }).filter(Boolean);
  return parts.join(' · '); }
const FEEL_EM = { super: '😀', ok: '🙂', meh: '😐', bad: '😣' };

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
A.cookDone = (recipe, n, covers, gc, porce) => Undo.run('Uvařeno', () => {
  const list = cooks().concat([{ id: 'c' + Date.now(), at: todayISO(), recipe, n, covers, gc: gc || 0, porce: porce || null }]);
  saveCooks(list); render();
}, `Uvařeno ${n}× ${recipe}. Krabičky pokrývají ${covers.length} ${covers.length === 1 ? 'jídlo' : (covers.length < 5 ? 'jídla' : 'jídel')} – porce se počítají podle krabičky.`);
A.cookDel = id => UI.confirm('Smazat záznam o vaření? Krabičky se přestanou počítat.', () => {
  saveCooks(cooks().filter(c => c.id !== id)); render(); UI.toast('Záznam smazán.');
}, 'Smazat');
A.cookWeigh = (id, v) => { const list = cooks(); const c = list.find(x => x.id === id); if (!c) return; c.gc = Number(v) || 0; saveCooks(list); render(); };

/* ===== Progres v tréninku (trenér) ===== */
function exerciseHistory(ex) { const uid = Store.ownerId(); let done = 0, weeks = new Set(); Store.rows('days', uid).forEach(r => { const d = r.data; if (!d.training || !d.training.done) return; const act = dayActivityPlan(d.date); (act.items || []).forEach((it, i) => { if (it.ex === ex && d.training.done[i]) { done++; weeks.add(mondayOf(d.date)); } }); }); return { done, weeks: weeks.size }; }
function progressSuggestion(it) { if (it.type !== 'strength') return null; const h = exerciseHistory(it.ex); if (h.weeks >= 2 && h.done >= 4) { const lib = EX_LIB.find(e => e.ex === it.ex); return lib && lib.timed ? { text: `${h.done}× splněno ve ${h.weeks} týdnech → +10 s`, apply: { reps: it.reps + 10 } } : (it.reps < 15 ? { text: `${h.done}× splněno ve ${h.weeks} týdnech → +1 opakování`, apply: { reps: it.reps + 1 } } : { text: `${h.done}× splněno, ${it.reps} opak. → +1 série, zpět na 10`, apply: { sets: it.sets + 1, reps: 10 } }); } return h.done ? { text: `${h.done}× splněno` } : null; }

/* ===== Fáze chůze: návrh přepnutí tempa ===== */
const PHASE_KMH = [[124, 5], [117, 5.5], [110, 6], [102, 6.5], [0, 7]];
function phaseSuggestion() { const s = S(), ov = calcOverview(s, Meas()); let rec = 5; for (const [th, k] of PHASE_KMH) { if (ov.cur > th) { rec = k; break; } rec = k; } if (rec > s.walk_kmh && ov.count >= 7) return { rec, text: `Robert je pod ${PHASE_KMH.find(x => x[1] === rec) ? (PHASE_KMH[PHASE_KMH.findIndex(x => x[1] === rec) - 1] || [124])[0] : 124} kg – fáze doporučuje tempo ${fmt1(rec)} km/h (teď ${fmt1(s.walk_kmh)}).` }; return null; }
A.applyPhase = kmh => commitSettings({ ...S(), walk_kmh: kmh }, `Tempo chůze ${fmt1(kmh)} km/h`);

/* ===== Změny od minulé návštěvy trenéra =====
   Razítko se posune jednou za otevření appky, ne při každém překreslení – jinak by
   novinky zmizely hned po první akci. Dřív byla razítka dvě a každé jinak. */
function sinceLast() {
  const key = 'coachSeen:' + Store.ownerId();
  if (!App._since || App._since.k !== key) { App._since = { k: key, at: LS.get(key, null) }; LS.set(key, new Date().toISOString()); }
  const seen = App._since.at;
  if (!seen) return { first: true, items: [] };
  const uid = Store.ownerId(); const items = [];
  Store.rows('measurements', uid).filter(r => r.updated_at > seen).forEach(r => items.push(`⚖️ ${czDateShort(r.data.date)}: váha ${fmt1(r.data.weight)} kg${r.data.waist ? `, pas ${r.data.waist} cm` : ''}`));
  Store.rows('days', uid).filter(r => r.updated_at > seen).forEach(r => { const d = r.data; const ev = evaluateDay(d.date); const bits = []; if (ev.confirmed) bits.push(ev.ok ? 'den OK' : 'den nesedí'); if (ev.cheats.beers) bits.push(`🍺 ${ev.cheats.beers}`); if (ev.cheats.over) bits.push(`+${ev.cheats.over} kcal přes`); if (d.training && Object.values(d.training.done || {}).some(Boolean)) bits.push('🏋️ trénink'); if (checkinSummary(d)) bits.push(checkinSummary(d)); if ((d.checkin || {}).note) bits.push(`„${esc(d.checkin.note.slice(0, 60))}“`); if ((d.walk_min || 0)) bits.push(`🚶 ${d.walk_min} min`); if (d.steps != null) bits.push(`👣 ${fmt0(d.steps)}`); items.push(`📅 ${czDateShort(d.date)}: ${bits.join(' · ') || 'zápis upraven'}`); });
  Store.rows('week_plans', uid).filter(r => r.updated_at > seen).forEach(r => items.push(`🗓️ Plán týdne od ${czDateShort(r.data.week)} (${r.data.plan.flat().filter(Boolean).length}/35)`));
  Store.rows('recipes', uid).filter(r => r.updated_at > seen).forEach(r => items.push(`📖 Recept: ${esc(r.data.name)}${r.data.overrides ? ' (jeho verze)' : ''}`));
  return { first: false, since: seen, items };
}

/* ===== Týden v číslech (pro kartu týdne u trenéra) ===== */
function weekReport(start) {
  const s = S(), ov = calcOverview(s, Meas()); const uid = Store.ownerId(); const today = todayISO();
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i)); const past = days.filter(dt => dt <= today).length;
  const recs = days.map(dt => Store.rows('days', uid).find(r => r.data.date === dt)).filter(Boolean).map(r => r.data);
  const evs = recs.map(r => evaluateDay(r.date));
  const okN = evs.filter(e => e.day.date < today && e.ok).length; const potvrz = evs.filter(e => e.confirmed && e.day.date < today);
  const walk = recs.reduce((a, r) => a + (r.walk_min || 0), 0), beers = evs.reduce((a, e) => a + e.cheats.beers, 0), fried = evs.reduce((a, e) => a + e.cheats.fried, 0), over = evs.filter(e => e.cheats.over).length;
  const trainPlanned = days.filter(dt => dt <= today).reduce((a, dt) => a + ((dayActivityPlan(dt).items || []).length ? 1 : 0), 0), trainDone = recs.filter(r => r.training && Object.values(r.training.done || {}).some(Boolean)).length;
  const weigh = days.filter(dt => Meas().some(m => m.date === dt && m.weight != null)).length;
  const wRows = ov.rows.filter(r => days.includes(r.date)); const wStart = ov.rows.filter(r => r.date < start).slice(-1)[0]; const wEnd = wRows.slice(-1)[0];
  const delta = wStart && wEnd ? wEnd.avg - wStart.avg : null;
  const fed = potvrz.filter(e => e.d.tot.kcal); const intakeAvg = fed.length ? fed.reduce((a, e) => a + e.d.intake, 0) / fed.length : 0; const limitAvg = fed.length ? fed.reduce((a, e) => a + e.d.base.maxIntake, 0) / fed.length : 0;
  return { start, days, past, recs, evs, okN, potvrz, walk, beers, fried, over, trainPlanned, trainDone, weigh, wEnd, delta };
}

/* ===== Signály pro trenéra: jedno místo, jedny prahy =====
   Dřív se upozornění skládala z pěti zdrojů na třech obrazovkách a stejné pravidlo
   (vážení, udržovací týden) se objevilo dvakrát až čtyřikrát s jinými prahy.
   Každý signál má úroveň (1 zasáhnout · 2 pohlídat · 3 na vědomí), text,
   krátký titulek pro verdikt a akci v appce: nastavit, nebo otevřít. */
function signaly() {
  const s = S(), out = [], t = todayISO(); const ov = calcOverview(s, Meas());
  const push = (lv, text, o) => out.push({ lv, text, ...(o || {}) });
  // vážení
  const ms = Meas().filter(m => m.weight != null).map(m => m.date).sort(); const posl = ms[ms.length - 1];
  if (posl && daysBetween(posl, t) >= 3) push(1, `Poslední vážení ${czDateShort(posl)} – ${daysBetween(posl, t)} ${DEN(daysBetween(posl, t))} zpátky. Bez váhy se nedá nic ladit.`, { key: 'vazeni', em: '⚖️', head: `${daysBetween(posl, t)} ${DEN(daysBetween(posl, t))} bez vážení.` });
  else if (!posl && daysBetween(s.start_date, t) >= 2) push(1, 'Zatím žádné vážení.', { key: 'vazeni', em: '⚖️', head: 'Zatím se nevážil.' });
  // dny bez zápisu
  let nepotv = 0; const nepD = []; for (let k = 1; k <= 7; k++) { const dt = addDays(t, -k); if (dt >= s.start_date && !evaluateDay(dt).confirmed) { nepotv++; nepD.push(dt); } }
  if (nepotv >= 2) push(nepotv >= 4 ? 1 : 2, `${nepotv} ze 7 posledních dnů nepotvrzených – nevíš, co opravdu jedl. Hodnocení dnů i přes limit počítá jen s potvrzenými.`, { key: 'nepotvrz', em: '❓', kde: nepD, head: `${nepotv} ${DEN(nepotv)} nepotvrzených.` });
  // přes limit po sobě
  let pres = 0; const presD = []; for (let k = 1; k <= 14; k++) { const ev = evaluateDay(addDays(t, -k)); if (!ev.confirmed) break; if (ev.cheats.over > 0) { pres++; presD.push(addDays(t, -k)); } else break; }
  if (pres >= 3) push(1, `${pres} ${DEN(pres)} po sobě přes limit. Otevři ty dny v týdnu a podívej se, co je táhne nahoru.`, { key: 'preslimit', em: '🍽️', kde: presD, head: `${pres} ${DEN(pres)} po sobě přes limit.` });
  // tempo
  paceGuard().forEach(g => push(g.lv, g.text.replace(/^[^\wÁ-ž]+ /, ''), g.text.includes('rychleji') ? { key: 'tempo', em: '⚡', head: 'Hubne rychleji, než je zdravé.', go: "go('nastaveni')", label: 'Tempo' } : { key: 'tempo', em: '🎯', go: "go('nastaveni')", label: 'Plán' }));
  if (ov.rows.length > 14) { const a = ov.rows[ov.rows.length - 1].avg, b = ov.rows[ov.rows.length - 15].avg;
    if (Math.abs(a - b) < 0.3) push(2, `Průměr se dva týdny nehnul (${fmt1(b)} → ${fmt1(a)} kg). Zvaž udržovací týden nebo úpravu tempa.`, { key: 'stoji', em: '⏸️', head: 'Váha dva týdny stojí.', go: "go('nastaveni')", label: 'Plán' }); }
  // kroky
  { const cil = stepsTarget(s), w2 = currentWeight(); let pod = 0, kcal = 0, zapsano = 0; const podD = [];
    for (let k = 1; k <= 7; k++) { const d2 = effectiveDay(addDays(t, -k)); const bk = daySteps(d2); if (bk == null) continue; zapsano++; if (bk < cil) { pod++; podD.push(addDays(t, -k)); kcal += (cil - bk) * kcalPerStep(w2); } }
    if (pod >= 3) push(1, `${pod} ${DEN(pod)} pod cílem ${fmt0(cil)} kroků – ${fmt0(kcal)} kcal, to je ${fmt2(kcal / KG_KCAL)} kg úbytku, který nebude. Zvaž nižší cíl kroků.`, { key: 'kroky', em: '👣', kde: podD, head: `${pod} ${DEN(pod)} pod cílem kroků.` });
    else if (zapsano <= 2 && daysBetween(s.start_date, t) >= 7) push(2, `Kroky za poslední týden zapsal jen ${zapsano}×. Bez nich nevíš, jestli faktor běžného výdeje sedí.`, { key: 'krokyzap', em: '👣', head: `Kroky zapsané jen ${zapsano}× za týden.` }); }
  // hlad
  let vlk = 0; const vlkD = []; for (let k = 0; k <= 7; k++) if (effectiveDay(addDays(t, -k)).hunger === 'vlk') { vlk++; vlkD.push(addDays(t, -k)); }
  if (vlk >= 3) push(1, `${vlk}× vlčí hlad za týden. Tempo je nejspíš moc rychlé – zpomal dřív, než to vzdá.`, { key: 'hlad', em: '🐺', kde: vlkD, head: 'Opakovaně vlčí hlad.', go: "go('nastaveni')", label: 'Tempo' });
  // vzorce z denního záznamu (posledních 7 dnů)
  { const ci = Array.from({ length: 7 }, (_, k) => effectiveDay(addDays(t, -k - 1))); const n = f => ci.filter(f).length; const kde = f => ci.filter(f).map(d => d.date);
    const bol = n(d => (d.checkin || {}).move === 'bolest'); if (bol >= 2) push(1, `${bol}× za týden „něco bolí“ při pohybu. Podívej se na dny a zvaž lehčí trénink.`, { key: 'bolest', em: '🤕', kde: kde(d => (d.checkin || {}).move === 'bolest'), head: 'Opakovaně ho něco bolí.', go: "App.coachTab='trenink';go('nastaveni')", label: 'Trénink' });
    const sp = n(d => (d.checkin || {}).sleep === 'spatne'); if (sp >= 3) push(2, `${sp}× za týden špatný spánek – s ním roste hlad a padá vůle.`, { key: 'spanek', em: '😴', kde: kde(d => (d.checkin || {}).sleep === 'spatne') });
    const st = n(d => (d.checkin || {}).stress === 'hodne'); if (st >= 3) push(2, `${st}× za týden hodně stresu.`, { key: 'stres', em: '😣', kde: kde(d => (d.checkin || {}).stress === 'hodne') });
    const cr = n(d => (d.checkin || {}).crave === 'silne'); if (cr >= 3) push(2, `${cr}× za týden silné chutě – zvaž, jestli limit není moc nízký, nebo přidej sytější přílohy.`, { key: 'chute', em: '🍫', kde: kde(d => (d.checkin || {}).crave === 'silne') });
    const fl = n(d => (d.checkin || {}).feel === 'bad'); if (fl >= 3) push(2, `${fl}× za týden se cítil špatně.`, { key: 'nalada', em: '😞', kde: kde(d => (d.checkin || {}).feel === 'bad') }); }
  // plánování
  const thisMon = mondayOf(t), nextMon = addDays(thisMon, 7); const pt = weekPlanned(thisMon), pn = weekPlanned(nextMon);
  if (pt < 35) push(pt === 0 ? 2 : 3, `Robert si tento týden naplánoval ${pt}/35 jídel.`, { key: 'planjidel', em: '🗓️' });
  if (dayIndex(t) >= 5 && pn < 35) push(3, `Robert má na příští týden naplánováno ${pn}/35 jídel.`, { key: 'planjidel2', em: '🗓️' });
  // chůze
  { let log = 0, ok = 0; const chD = []; for (let k = 1; k <= 14; k++) { const ev = evaluateDay(addDays(t, -k)); if (!ev.logged) continue; log++; if ((ev.day.walk_min || 0) >= (ev.day.act ? ev.day.act.planWalk : s.walk_min)) ok++; else chD.push(addDays(t, -k)); }
    if (log >= 5 && ok / log < 0.6) push(2, `Chůzi splnil jen ${ok} z ${log} zapsaných dnů.`, { key: 'chuze', em: '🚶', kde: chD }); }
  // nastavení podle dat
  settingsAdvice().filter(a => a.lv === 1).forEach(a => push(1, a.text, a.apply ? { key: 'advice:' + a.field, em: '⚙️', apply: `A.applyAdvice(${JSON.stringify(JSON.stringify(a.apply)).replace(/"/g, '&quot;')})`, label: a.label } : { key: 'advice:' + a.field, em: '⚙️', go: "go('nastaveni')", label: 'Plán' }));
  const ph = phaseSuggestion(); if (ph) push(2, ph.text, { key: 'faze', em: '🚶', apply: `A.applyPhase(${ph.rec})`, label: `${fmt1(ph.rec)} km/h` });
  // cíl a udržování
  if (!s.maintain && ov.cur - s.goal_weight <= 0) push(1, `Robert dosáhl cílové váhy ${s.goal_weight} kg. Zapni udržování – jinak deficit běží dál.`, { key: 'cil', em: '🏁', head: 'Robert je u cíle.', apply: 'A.setMaintain(true)', label: 'Udržování' });
  else if (!s.maintain && ov.cur - s.goal_weight <= 2) push(2, `Robert je ${fmt1(ov.cur - s.goal_weight)} kg od cíle. Připrav udržování.`, { key: 'cil', em: '🏁', go: "App.coachTab='cile';go('nastaveni')", label: 'Plán' });
  // udržovací týden – jeden práh všude: po 8 týdnech upozornit, Plán radí 6–10
  const mw = (s.maint_weeks || []).slice().sort(); const odKdy = mw.length ? mw[mw.length - 1] : s.start_date; const tydnu = Math.floor(daysBetween(odKdy, t) / 7);
  if (tydnu >= 8) push(2, `${tydnu} týdnů bez udržovacího týdne. Po osmi týdnech deficitu se vyplatí jeden týden na nule.`, { key: 'udrz', em: '⏸️', go: "App.coachTab='cile';go('nastaveni')", label: 'Zařadit' });
  const apl = activePlanFor(t); const naDatum = Array.from({ length: 14 }, (_, i) => addDays(t, i)).some(d => trainingOverride(d));
  if (!apl && !naDatum) push(3, `Žádný tréninkový plán – Robert jede na výchozích ${s.walk_min} min chůze.`, { key: 'trenink', em: '🏋️', go: "App.coachTab='trenink';go('nastaveni')", label: 'Trénink' });
  return out.sort((a, b) => a.lv - b.lv);
}

/* ===== Váha proti plánu: popisek bodu a rozbor příčin =====
   Jeden zdroj pro „proč váha nejde podle plánu“ (weightWhy). Ranní váha odráží den
   předtím, proto popisek i rozbor čtou den před vážením. Každá příčina se přepočítá
   na kg za týden (7 700 kcal = 1 kg), aby šlo porovnat, co z rozdílu vysvětluje. */
function dayBrief(dt) {
  const r = Store.rows('days', Store.ownerId()).find(x => x.data.date === dt);
  if (!r) return 'bez zápisu';
  const ev = evaluateDay(dt); const day = ev.day; const bits = [];
  if (!ev.confirmed) bits.push('nepotvrzený');
  else bits.push(ev.cheats.over ? `<span class="bad">+${fmt0(ev.cheats.over)} kcal přes limit</span>` : '<span class="ok">✓ v limitu</span>');
  if (day.walk_min) bits.push(`🚶 ${day.walk_min} min`);
  if (day.beers) bits.push(`🍺 ${day.beers}`);
  const bk = daySteps(day); if (bk != null) bits.push(`👣 ${fmt0(bk)}`);
  return bits.join(' · ');
}
function weightTips(ov, raw) {
  const wa = raw ? Object.fromEntries(weekAvgs().map(w => [w.mon, w.avg])) : {};
  return ov.rows.map(r => { const d = r.dev; const plan = d >= 0 ? `<span class="ok">${fmt1(d)} kg pod plánem</span>` : `<span class="bad">${fmt1(-d)} kg nad plánem</span>`;
    return { x: r.idx, y: raw ? r.weight : r.avg, html: `<b>${DAY_SHORT[dayIndex(r.date)]} ${czDateShort(r.date)}</b><br><span class="w">${fmt1(r.weight)} kg</span> ráno<br>${raw ? `Ø týdne ${fmt1(wa[mondayOf(r.date)])}` : `průměr 7 dní ${fmt1(r.avg)}`} · plán ${fmt1(r.plan)}<br>${Math.abs(d) < 0.05 ? 'přesně na plánu' : plan}<span class="d">den předtím: ${dayBrief(addDays(r.date, -1))}</span>` }; });
}
const kgTyd = v => (v >= 0 ? '−' : '+') + fmt2(Math.abs(v));
/* Rozbor za období (from–to, výchozí posledních ~14 dní). Váha: sklon přímky přes ranní
   vážení od from do rána po to (ranní váha odráží den předtím). Chování: dny from–to, nejdéle včera.
   Příčiny se ukazují vždy; když váha jde podle plánu, jsou o stupeň mírnější. */
function slopeW(pts) {
  if (pts.length < 4) return null;
  const mx = pts.reduce((t, x) => t + x.idx, 0) / pts.length, my = pts.reduce((t, x) => t + x.weight, 0) / pts.length;
  const sxx = pts.reduce((t, x) => t + (x.idx - mx) ** 2, 0); if (!sxx) return null;
  return -pts.reduce((t, x) => t + (x.idx - mx) * (x.weight - my), 0) / sxx * 7;
}
function weightWhy(from, to) {
  const s = S(), rows = calcMeasurements(s, Meas()), t = todayISO();
  if (!from) { if (rows.length < 5) return { state: 'malo', causes: [] }; const a = rows[rows.length - 1]; from = addDays(a.date, -14); to = addDays(a.date, -1); }
  if (from < s.start_date) from = s.start_date;
  const end = to < t ? to : addDays(t, -1);
  const pts = rows.filter(r => r.date >= from && r.date <= addDays(to, 1));
  const span = Math.max(1, daysBetween(from, addDays(to < t ? to : t, 1)));
  const w = pts.length ? pts.reduce((a, r) => a + r.weight, 0) / pts.length : currentWeight();
  const realW = slopeW(pts);
  let planKg = 0; for (let k = 0; k < span; k++) planKg += w * effSettings(s, addDays(from, k)).rate_pct / 100 / 7;
  const planW = planKg / span * 7, gap = realW == null ? planW : planW - realW;
  const state = realW == null ? 'malo' : realW < planW * 0.8 && gap >= 0.15 ? 'pomalu' : (realW > planW * 1.4 && realW - planW >= 0.3 ? 'rychle' : 'ok');
  const days = []; for (let dt = from; dt <= end; dt = addDays(dt, 1)) days.push(dt);
  const n = days.length, uid = Store.ownerId(), byDate = Object.fromEntries(Store.rows('days', uid).map(r => [r.data.date, r.data]));
  const cil = stepsTarget(s); const X = { conf: 0, over: 0, move: 0, food: 0, cheatDays: 0, beers: 0, under: 0, floor: 0, stepsN: 0, stepsSum: 0, stepsGap: 0, walk: 0, walkPlan: 0, trMiss: 0 };
  const D = { nez: [], over: [], move: [], floor: [], steps: [], under: [], vlk: [], psych: [], tr: [], sleep: 0, stress: 0, crave: 0 };
  days.forEach(dt => {
    if (!byDate[dt]) { D.nez.push(dt); return; }
    const ev = evaluateDay(dt), day = ev.day, B = ev.d.base;
    const bk = daySteps(day); if (bk != null) { X.stepsN++; X.stepsSum += bk; X.stepsGap += (cil - bk) * kcalPerStep(w); if (bk < cil * 0.9) D.steps.push(dt); }
    if (!ev.confirmed) { D.nez.push(dt); return; }
    X.conf++; const ci = day.checkin || {};
    if (day.hunger === 'vlk') D.vlk.push(dt);
    if (ci.sleep === 'spatne' || ci.stress === 'hodne' || ci.crave === 'silne') D.psych.push(dt);
    if (ci.sleep === 'spatne') D.sleep++; if (ci.stress === 'hodne') D.stress++; if (ci.crave === 'silne') D.crave++;
    X.walk += day.walk_min || 0; X.walkPlan += B.planWalk; const trMiss = B.planKcal > 0 && B.doneKcal < B.planKcal * 0.5; if (trMiss) { X.trMiss++; D.tr.push(dt); }
    if ((day.walk_min || 0) < B.planWalk - 5 || trMiss) D.move.push(dt);
    if (B.belowBmr) { D.floor.push(dt); X.floor += B.maxIntake - B.maxIntakeRaw; }
    const over = ev.d.intake - B.maxIntake;
    if (over > dayTol(B.maxIntake)) { const move = Math.min(over, Math.max(0, B.planWalk - (day.walk_min || 0)) * B.walkPerMin + Math.max(0, B.planKcal - B.doneKcal));
      D.over.push(dt); X.over += over; X.move += move; X.food += over - move; if (B.cheatKcal > 0) X.cheatDays++; X.beers += day.beers || 0; }
    else if (over < -300) { D.under.push(dt); X.under += -over; }
  });
  const perW = (sum, base) => base ? sum / base * 7 / KG_KCAL : 0;   // kcal v okně → kg za týden
  const lvK = k => state === 'pomalu' ? (k >= gap * 0.4 ? 1 : 2) : state === 'rychle' ? 3 : (k >= 0.1 ? 2 : 3);
  const C = []; const add = o => C.push(o);
  const nez = D.nez.length;
  if (n && nez >= Math.min(3, n)) add({ key: 'nepotvrz', lv: nez / n >= 0.5 ? 1 : 2, em: '❓', data: true, kde: D.nez, title: `${nez} z ${n} ${DEN(n)} nepotvrzených`, sub: 'Appka nevidí, co opravdu jedl – rozbor stojí jen na potvrzených dnech. Ať večer potvrdí den.' });
  const wDates = new Set(rows.map(r => r.date)); const bezVahy = []; for (let dt = from; dt <= (to < t ? to : t); dt = addDays(dt, 1)) if (!wDates.has(dt)) bezVahy.push(dt);
  const wN = span - bezVahy.length;
  if (span >= 4 && wN < span * 0.6) add({ key: 'vazeni-malo', lv: 2, em: '⚖️', data: true, kde: bezVahy, title: `Jen ${wN} vážení za ${span} ${DEN(span)}`, sub: 'Průměr stojí na pár číslech, trend je nejistý. Vážit se každé ráno.' });
  const kFood = perW(X.food, X.conf), kMove = perW(X.move, X.conf), kFloor = perW(X.floor, X.conf);
  if (D.over.length && kFood >= 0.03) add({ key: 'jidlo', lv: lvK(kFood), em: '🍽️', kg: kFood, kde: D.over, title: `Snědl víc, než měl: ${D.over.length}× přes limit`, sub: X.cheatDays ? `Z toho ${X.cheatDays}× cheat${X.beers ? ` (${X.beers} piv)` : ''}. Cheat patří do rezervy dne, ne navíc.` : 'Bez cheatu – porce nebo jídlo mimo plán. Otevři ty dny.' });
  if (D.move.length && kMove >= 0.03) { const avgW = Math.round(X.walk / X.conf), avgP = Math.round(X.walkPlan / X.conf);
    add({ key: 'pohyb', lv: lvK(kMove), em: '🚶', kg: kMove, kde: D.move, title: `Méně pohybu: Ø ${avgW} z ${avgP} min chůze${X.trMiss ? ` · ${X.trMiss}× bez tréninku` : ''}`, sub: 'Jídlo z plánu počítá s celým pohybem – bez něj přetáhne limit. Nastav cíl, který reálně ujde.', go: "App.coachTab='cile';go('nastaveni')", label: 'Cíl chůze' }); }
  else if (D.tr.length) add({ key: 'trenink', lv: 2, em: '🏋️', kde: D.tr, title: `${D.tr.length}× vynechaný trénink`, sub: 'Plán tréninku a skutečnost se rozcházejí. Uprav dny, které mu nesedí.', go: "App.coachTab='trenink';go('nastaveni')", label: 'Trénink' });
  if (kFloor >= 0.04) add({ key: 'spodni', lv: 2, em: '🧱', kg: kFloor, kde: D.floor, title: `${D.floor.length}× limit na spodní hranici jídla`, sub: 'Deficit ten den vyšel menší, než chce tempo. Přidej chůzi nebo sniž tempo.', go: "App.coachTab='cile';go('nastaveni')", label: 'Plán' });
  // kroky: skrytá chyba – limit je nevidí, faktor výdeje počítá s cílem
  if (X.stepsN >= 3) { const avg = X.stepsSum / X.stepsN, k = perW(X.stepsGap, X.stepsN); const rec = factorForSteps(avg);
    const fix = Math.abs(rec - s.activity) >= 0.05 ? { apply: `A.applyAdvice(${JSON.stringify(JSON.stringify({ activity: rec })).replace(/"/g, '&quot;')})`, label: `Faktor ${String(rec).replace('.', ',')}` } : {};
    if (state !== 'rychle' && k >= 0.04) add({ key: 'kroky', lv: lvK(k), em: '👣', kg: k, kde: D.steps, title: `Kroky Ø ${fmt0(avg)} z ${fmt0(cil)}`, sub: `Výdej je o ~${fmt0(k * KG_KCAL / 7)} kcal/den nižší, než počítá limit – a limit to nevidí. Sniž faktor, nebo ať chodí víc.`, ...fix });
    if (state === 'rychle' && k <= -0.04) add({ key: 'kroky', lv: 2, em: '👣', kg: -k, title: `Chodí víc, než počítá faktor: Ø ${fmt0(avg)} kroků`, sub: 'Výdej je vyšší, než si appka myslí, deficit vychází větší. Zvedni faktor.', ...fix }); }
  else if (n >= 5) add({ key: 'krokyzap', lv: 2, em: '👣', data: true, title: `Kroky zapsané jen ${X.stepsN}× z ${n}`, sub: 'Bez nich nejde ověřit odhad výdeje – největší skrytá chyba plánu.' });
  if (state === 'rychle') {
    const kU = perW(X.under, X.conf);
    if (kU >= 0.04) add({ key: 'podlimit', lv: 1, em: '🥗', kg: kU, kde: D.under, title: `Jí pod limit: ${D.under.length}× o víc než 300 kcal`, sub: 'Rychlé hubnutí bere sval a končí hladem. Ať dojídá do limitu, hlavně bílkoviny.' });
    if (pts.length && pts[0].idx < 21) add({ key: 'start', lv: 3, em: '💧', title: 'Začátek hubnutí', sub: 'První tři týdny jde dolů hlavně voda a glykogen. Rychlý start je normální.' });
  }
  if (D.vlk.length >= 2) add({ key: 'hlad', lv: state === 'rychle' ? 1 : 2, em: '🐺', kde: D.vlk, title: `${D.vlk.length}× vlčí hlad`, sub: 'Takové tempo dlouho nevydrží. Zpomal.', go: "App.coachTab='cile';go('nastaveni')", label: 'Tempo' });
  if (D.psych.length >= 3) add({ key: 'psych', lv: 3, em: '😴', kde: D.psych, title: [D.sleep && `${D.sleep}× špatný spánek`, D.stress && `${D.stress}× stres`, D.crave && `${D.crave}× silné chutě`].filter(Boolean).join(' · '), sub: 'Zvedá hlad a chutě – často stojí za přejídáním.' });
  // zbytek, který záznamy nevysvětlí
  const expl = C.reduce((tt, c) => tt + (c.kg && !c.data ? c.kg : 0), 0), rest = gap - expl;
  if (state === 'pomalu' && X.conf >= n * 0.6 && rest >= 0.15) { const bmr = calcBase(s, w, 0, 0, s.walk_kmh, 0, 0).bmr; const f = Math.max(1.2, Math.round((s.activity - rest * KG_KCAL / 7 / bmr) * 100) / 100);
    const krokyFix = C.some(c => c.key === 'kroky' && c.apply);   // faktor podle kroků má přednost – dvě různá čísla by mátla
    add({ key: 'zbytek', lv: 2, em: '🔍', kg: rest, last: true, title: 'Zbytek záznamy nevysvětlí', sub: `Buď jí víc, než zapisuje (olej, pití, ochutnávky), nebo je výdej nadhodnocený o ~${fmt0(rest * KG_KCAL / 7)} kcal/den.${krokyFix ? ' Nejdřív oprav faktor podle kroků a týden počkej.' : ''}`,
      ...(krokyFix || f >= s.activity ? {} : { apply: `A.applyAdvice(${JSON.stringify(JSON.stringify({ activity: f })).replace(/"/g, '&quot;')})`, label: `Faktor ${String(f).replace('.', ',')}` }) }); }
  // jednorázový skok
  const a = pts[pts.length - 1];
  if (a && a.weight - a.avg >= 0.8) { const y = byDate[addDays(a.date, -1)] || {}, y2 = byDate[addDays(a.date, -2)] || {}; const cheat = [y, y2].some(d => d.beers || d.fried_g || (d.cheat_items || []).length);
    add({ key: 'voda', lv: 3, em: '💧', kde: [a.date], title: `Vážení ${czDateShort(a.date)} o ${fmt1(a.weight - a.avg)} kg nad průměrem`, sub: cheat ? 'Po cheatu (sůl, alkohol) drží tělo 2–3 dny vodu. Počkej na průměr.' : 'Jednorázový skok – rozhoduje průměr, ne jedna tečka.' }); }
  C.sort((p, q) => (!!p.last - !!q.last) || (p.lv - q.lv) || ((q.kg || 0) - (p.kg || 0)));
  return { state, realW, planW, gap, span, n, conf: X.conf, expl, causes: C, from, to };
}
/* Čísla za období: cíle proti plnění. Hodnotí se dny do včerejška, dnešek je rozjetý. */
function periodStats(from, to) {
  const s = S(), t = todayISO(); if (from < s.start_date) from = s.start_date;
  if (from > to) return { empty: true };
  const end = to < t ? to : addDays(t, -1); const uid = Store.ownerId(); const by = Object.fromEntries(Store.rows('days', uid).map(r => [r.data.date, r.data]));
  const R = { from, to, n: 0, conf: 0, inLimit: 0, over: 0, def: 0, defPlan: 0, walk: 0, walkPlan: 0, steps: 0, stepsN: 0, trPlan: 0, trDone: 0, weigh: 0, wDays: 0 };
  for (let dt = from; dt <= end; dt = addDays(dt, 1)) { R.n++;
    const ap = dayActivityPlan(dt); if ((ap.items || []).length) R.trPlan++;
    if (!by[dt]) continue;   // nezapsaný den: chůze se neví, ne „neušel“
    const ev = evaluateDay(dt), B = ev.d.base; R.walkPlan += B.planWalk; R.walk += ev.day.walk_min || 0;
    if (B.planKcal > 0 && B.doneKcal >= B.planKcal * 0.5) R.trDone++;
    const bk = daySteps(ev.day); if (bk != null) { R.stepsN++; R.steps += bk; }
    if (ev.confirmed) { R.conf++; if (ev.cheats.over) R.over++; else R.inLimit++; R.def += B.totalOut - ev.d.intake; R.defPlan += B.deficit; } }
  const ms = calcMeasurements(s, Meas()); const inP = ms.filter(r => r.date >= from && r.date <= (to < t ? to : t)); R.wDays = daysBetween(from, to < t ? to : t) + 1; R.weigh = inP.length;
  const len = daysBetween(from, to) + 1; const prev = ms.filter(r => r.date >= addDays(from, -len) && r.date < from);
  const avg = a => a.length ? a.reduce((x, r) => x + r.weight, 0) / a.length : null;
  R.wAvg = avg(inP); R.wPrev = avg(prev); R.wDelta = R.wAvg != null && R.wPrev != null ? R.wAvg - R.wPrev : null;
  R.wPlan = (R.wAvg || currentWeight()) * effSettings(s, from).rate_pct / 100 * len / 7;
  R.defAvg = R.conf ? R.def / R.conf : null; R.defPlanAvg = R.conf ? R.defPlan / R.conf : null; R.stepsAvg = R.stepsN ? R.steps / R.stepsN : null;
  const wm = Meas().filter(m => m.waist != null && m.date <= to).sort((a, b) => a.date.localeCompare(b.date)); const wIn = wm.filter(m => m.date >= from); const wBefore = wm.filter(m => m.date < from);
  R.waist = wIn.length ? wIn[wIn.length - 1].waist : null; R.waistDelta = R.waist != null && wBefore.length ? R.waist - wBefore[wBefore.length - 1].waist : null;
  return R;
}
/* Trend: sklon přímky přes vážení za posledních 21 dní (kg/týden, kladné = hubne) */
function trend21() {
  const rows = calcMeasurements(S(), Meas()); if (!rows.length) return null;
  const last = rows[rows.length - 1]; const r = rows.filter(x => x.idx > last.idx - 21);
  if (r.length < 5) return null;
  const mx = r.reduce((t, x) => t + x.idx, 0) / r.length, my = r.reduce((t, x) => t + x.weight, 0) / r.length;
  const sxx = r.reduce((t, x) => t + (x.idx - mx) ** 2, 0); if (!sxx) return null;
  const slope = r.reduce((t, x) => t + (x.idx - mx) * (x.weight - my), 0) / sxx;
  return { perWeek: -slope * 7, slope, at: last.idx, y: my + slope * (last.idx - mx), from: r[0].idx, n: r.length };
}
/* Týdenní průměry Po–Ne */
function weekAvgs() {
  const by = {}; calcMeasurements(S(), Meas()).forEach(r => { const m = mondayOf(r.date); (by[m] = by[m] || []).push(r.weight); });
  return Object.keys(by).sort().map(m => ({ mon: m, avg: by[m].reduce((t, v) => t + v, 0) / by[m].length, n: by[m].length }));
}
/* Jeden seznam problémů pro trenéra: rozbor váhy (weightWhy) + signály (signaly) bez duplicit.
   Co stejné téma řeší rozbor (s dopadem v kg/týden a dny), signál se nepřidá. */
const DIAG_SAME = { nepotvrz: ['nepotvrz'], kroky: ['kroky', 'advice:activity'], krokyzap: ['krokyzap'], jidlo: ['preslimit'], pohyb: ['chuze'], hlad: ['hlad'], psych: ['spanek', 'stres', 'chute'] };
function diagnoza(from, to) {
  const W = weightWhy(from, to); const keys = new Set(W.causes.map(c => c.key));
  const skip = new Set(); keys.forEach(k => (DIAG_SAME[k] || []).forEach(x => skip.add(x)));
  const sig = (!to || to >= addDays(todayISO(), -1) ? signaly() : []).filter(x => !skip.has(x.key))   // signály platí pro teď, ne pro minulé období.map(x => ({ key: x.key, lv: x.lv, em: x.em || { 1: '🔴', 2: '🟡', 3: '🟢' }[x.lv], title: x.head || x.text, sub: x.head ? x.text : '', kde: x.kde, apply: x.apply, go: x.go, label: x.label }));
  const all = W.causes.concat(sig);
  all.sort((p, q) => (!!p.last - !!q.last) || (p.lv - q.lv) || ((q.kg || 0) - (p.kg || 0)));
  return { W, list: all, lvl: all.some(x => x.lv === 1) ? 1 : all.some(x => x.lv === 2) ? 2 : 3 };
}

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
const PANTRY_ST = { mam: ['mám doma', 'ok'], nemam: ['došlo', 'bad'] };
function pantryRaw() { const p = Prefs(); return p.pantry || {}; }
/* Dva stavy (30. 9. 2026): „mám doma“ platí, dokud Robert neťukne „došlo“. Dřív appka
   sama odhadovala ze spotřeby, kdy balení dojde – chytré, ale neprůhledné: položka se
   na lístku objevila bez zjevného důvodu. */
function pantryState(food) { const r = pantryRaw()[food]; return r && r.st === 'mam' ? 'mam' : 'nemam'; }
function setPantry(food, st, g) {
  const p = Prefs(); p.pantry = p.pantry || {};
  if (st === 'mam') p.pantry[food] = { st, at: todayISO(), g: g || (p.pantry[food] || {}).g || 0 };
  else p.pantry[food] = { st };
  savePrefs(p);
}
A.pantry = (food, st) => { setPantry(food, st); render(); UI.toast(`${food}: ${PANTRY_ST[st][0]}`); };

A.fillWeight = (date, v) => {
  const r = omez(v, 30, 400); const n = r.n;
  if (n == null) return;
  if (r.mimo) UI.toast('Váha mimo rozumný rozsah – zapsal jsem nejbližší hodnotu.');
  const m = Meas().find(x => x.date === date) || { date };
  saveMeas({ ...m, weight: n });
  UI.toast(`${czDateShort(date)}: ${fmt1(n)} kg zapsáno.`); render();
};

function mismatchAlert(date) { const m = dayMismatch(date); if (!m) return ''; return `<div class="alert ${m.diff > 0 ? 'a2' : 'a1'}"><div>${m.trainingChanged ? '🏋️ Trenér změnil trénink. ' : ''}Limit dne je <b>${fmt0(m.limit)} kcal</b>, plán jídel má <b>${fmt0(m.planned)}</b> – ${m.diff > 0 ? `<b>přidej ${fmt0(m.diff)} kcal</b>, jinak jsi v moc velkém deficitu` : `<b>uber ${fmt0(-m.diff)} kcal</b>, jinak jsi přes`}.</div><button class="btn sm write" onclick="A.fitDay('${date}')">💡 Dorovnat</button></div>`; }

/* ===== Běžná denní chůze (kroky) – jen informace pro trenéra, nepočítá se do cíle ani limitu ===== */
/* cíl kroků (nastavuje se jednou) vs. co Robert opravdu ušel (zapisuje každý den).
   Dřív se tyhle dvě věci mísily: dokud nic nezapsal, tvářil se cíl jako skutečnost
   a trenér podle vymyšlených čísel ladil faktor aktivity. */
function stepsGoal() { return stepsTarget(S()); }   // cil urcuje trener v Planu a cilech
function defaultSteps() { return stepsGoal(); }
function daySteps(day) { return bezneKroky(day, S().walk_kmh); }   // běžná chůze = celkem z telefonu − zapsaná chůze
function dayStepsTotal(day) { return day && day.steps != null ? Number(day.steps) : null; }
A.setSteps = v => {
  const r = omez(v, 0, 80000);
  if (r.mimo) UI.toast('Kroky zapisuju v rozmezí 0 až 80 000.');
  const n = r.n;
  Undo.run('Kroky', () => { const day = getDay(App.date); day.steps = n == null ? null : n; saveDay(day); }, () => stepsHodnoceni(daySteps(effectiveDay(App.date))));
  render();
};
/* Zhodnocení dne podle kroků: nad cíl pochvala, pod cíl konkrétní cena za týden. */
function stepsHodnoceni(n) {
  const s = S(), cil = stepsTarget(s), w = currentWeight();
  if (n == null) return 'Kroky smazány.';
  /* n = běžná chůze (celkem z telefonu minus zapsaná procházka) */
  if (n >= cil) {
    const navic = n - cil;
    const kcal = navic * kcalPerStep(w);
    return navic >= 1000
      ? `Běžná chůze ${fmt0(n)} kroků – ${fmt0(navic)} nad cíl. Máš navrch ${fmt0(kcal)} kcal, a takhle se to sčítá do ${fmt2(kcal * 7 / KG_KCAL)} kg za týden navíc. Přesně tohle rozhoduje.`
      : `Běžná chůze ${fmt0(n)} kroků – cíl ${fmt0(cil)} splněn. Přesně takhle to má vypadat.`;
  }
  const sm = { chybi: cil - n, kcal: (cil - n) * kcalPerStep(w) };
  return `Běžná chůze ${fmt0(n)} z ${fmt0(cil)} kroků. Chybí ${fmt0(sm.chybi)}, to je ${fmt0(sm.kcal)} kcal z výdeje – při celém týdnu ${fmt2(sm.kcal * 7 / KG_KCAL)} kg z úbytku. Zítra to dožeň, stačí se víc hýbat během dne.`;
}

function stepsStat(days) { const uid = Store.ownerId(); const vals = days.map(dt => { const r = Store.rows('days', uid).find(x => x.data.date === dt); return r ? daySteps(r.data) : null; }).filter(v => v != null); return vals.length ? { avg: vals.reduce((a, b) => a + b, 0) / vals.length, n: vals.length, min: Math.min(...vals) } : null; }

/* ===== Doporučení k nastavení (trenér) ===== */
function factorForSteps(avg) { if (avg < 3000) return 1.2; if (avg < 4500) return 1.28; if (avg < 6500) return 1.34; if (avg < 8500) return 1.4; return 1.48; }
function settingsAdvice() {
  const s = S(), w = currentWeight(), ov = calcOverview(s, Meas()); const A_ = [];
  const b = calcBase(s, w, s.walk_min, 0, s.walk_kmh, 0, 0);
  // kroky → faktor aktivity
  const st = stepsStat(Array.from({ length: 14 }, (_, i) => addDays(todayISO(), -i)));
  if (st && st.n >= 5) { const rec = factorForSteps(st.avg); if (Math.abs(rec - s.activity) >= 0.05) { const dl = Math.round((rec - s.activity) * b.bmr);
    A_.push({ field: 'activity', lv: 1, text: `Běžná chůze Ø ${fmt0(st.avg)} kroků/den (${st.n} dní), faktor ${String(s.activity).replace('.', ',')} počítá s cílem ${fmt0(stepsTarget(s))}. ${rec < s.activity ? `Výdej je nadhodnocený o ~${fmt0(-dl)} kcal/den – Robert by mohl hubnout pomaleji, než čekáš, nebo přibírat.` : `Výdej je podhodnocený o ~${fmt0(dl)} kcal/den – Robert je ve větším deficitu, než chceš.`} Doporučení: faktor ${String(rec).replace('.', ',')} (limit ${dl > 0 ? '+' : ''}${fmt0(dl)} kcal/den).`, apply: { activity: rec }, label: `Nastavit ${String(rec).replace('.', ',')}` }); }
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
A.applyAdvice = (json) => commitSettings({ ...S(), ...JSON.parse(json) }, 'Nastavení podle doporučení');
function adviceBox(field) { const list = settingsAdvice().filter(a => a.field === field); return list.map(a => `<div class="alert a${a.lv}"><div>${esc(a.text)}</div>${a.apply ? `<button class="btn sm" onclick="A.applyAdvice(${JSON.stringify(JSON.stringify(a.apply)).replace(/"/g, '&quot;')})">${a.label}</button>` : ''}</div>`).join(''); }
