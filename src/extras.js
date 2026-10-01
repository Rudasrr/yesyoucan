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
const HLAD = [['ok', '🙂 v pohodě'], ['hlad', '😐 hlad'], ['vlk', '😖 vlčí hlad']];
A.setHunger = (date, v) => Undo.run('Hlad', () => { const day = getDay(date); day.hunger = day.hunger === v ? null : v; saveDay(day); render(); },
  v === 'vlk' ? 'Zapsáno. Když to bude pět dní v řadě, trenér to uvidí a zpomalí tempo.' : 'Zapsáno.');
function hungerRow(date, day) {
  return `<div class="field"><label class="f">Jak ti dnes bylo s jídlem?</label><div class="chips">${HLAD.map(([k, l]) => `<button class="chip ${day.hunger === k ? 'on' : ''} write" onclick="A.setHunger('${date}','${k}')">${l}</button>`).join('')}</div><div class="hint">Pro trenéra cennější než většina čísel – pět dní hladu v řadě znamená zpomalit.</div></div>`;
}

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
  Store.rows('days', uid).filter(r => r.updated_at > seen).forEach(r => { const d = r.data; const ev = evaluateDay(d.date); const bits = []; if (ev.confirmed) bits.push(ev.ok ? 'den OK' : 'den nesedí'); if (ev.cheats.beers) bits.push(`🍺 ${ev.cheats.beers}`); if (ev.cheats.over) bits.push(`+${ev.cheats.over} kcal přes`); if (d.training && Object.values(d.training.done || {}).some(Boolean)) bits.push('🏋️ trénink'); if ((d.walk_min || 0)) bits.push(`🚶 ${d.walk_min} min`); if (d.steps != null) bits.push(`👣 ${fmt0(d.steps)}`); items.push(`📅 ${czDateShort(d.date)}: ${bits.join(' · ') || 'zápis upraven'}`); });
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
  if (posl && daysBetween(posl, t) >= 3) push(1, `Poslední vážení ${czDateShort(posl)} – ${daysBetween(posl, t)} ${DEN(daysBetween(posl, t))} zpátky. Bez váhy se nedá nic ladit.`, { head: `${daysBetween(posl, t)} ${DEN(daysBetween(posl, t))} bez vážení.` });
  else if (!posl && daysBetween(s.start_date, t) >= 2) push(1, 'Zatím žádné vážení.', { head: 'Zatím se nevážil.' });
  // dny bez zápisu
  let nepotv = 0; for (let k = 1; k <= 7; k++) { const dt = addDays(t, -k); if (dt >= s.start_date && !evaluateDay(dt).confirmed) nepotv++; }
  if (nepotv >= 2) push(nepotv >= 4 ? 1 : 2, `${nepotv} ze 7 posledních dnů nepotvrzených – nevíš, co opravdu jedl. Hodnocení dnů i přes limit počítá jen s potvrzenými.`, { head: `${nepotv} ${DEN(nepotv)} nepotvrzených.` });
  // přes limit po sobě
  let pres = 0; for (let k = 1; k <= 14; k++) { const ev = evaluateDay(addDays(t, -k)); if (!ev.confirmed) break; if (ev.cheats.over > 0) pres++; else break; }
  if (pres >= 3) push(1, `${pres} ${DEN(pres)} po sobě přes limit. Otevři ty dny v týdnu a podívej se, co je táhne nahoru.`, { head: `${pres} ${DEN(pres)} po sobě přes limit.` });
  // tempo
  paceGuard().forEach(g => push(g.lv, g.text.replace(/^[^\wÁ-ž]+ /, ''), g.text.includes('rychleji') ? { head: 'Hubne rychleji, než je zdravé.', go: "go('nastaveni')", label: 'Tempo' } : { go: "go('nastaveni')", label: 'Plán' }));
  if (ov.rows.length > 14) { const a = ov.rows[ov.rows.length - 1].avg, b = ov.rows[ov.rows.length - 15].avg;
    if (Math.abs(a - b) < 0.3) push(2, `Průměr se dva týdny nehnul (${fmt1(b)} → ${fmt1(a)} kg). Zvaž udržovací týden nebo úpravu tempa.`, { head: 'Váha dva týdny stojí.', go: "go('nastaveni')", label: 'Plán' }); }
  // kroky
  { const cil = stepsTarget(s), w2 = currentWeight(); let pod = 0, kcal = 0, zapsano = 0;
    for (let k = 1; k <= 7; k++) { const d2 = effectiveDay(addDays(t, -k)); const bk = daySteps(d2); if (bk == null) continue; zapsano++; if (bk < cil) { pod++; kcal += (cil - bk) * kcalPerStep(w2); } }
    if (pod >= 3) push(1, `${pod} ${DEN(pod)} pod cílem ${fmt0(cil)} kroků – ${fmt0(kcal)} kcal, to je ${fmt2(kcal / KG_KCAL)} kg úbytku, který nebude. Zvaž nižší cíl kroků.`, {});
    else if (zapsano <= 2 && daysBetween(s.start_date, t) >= 7) push(2, `Kroky za poslední týden zapsal jen ${zapsano}×. Bez nich nevíš, jestli faktor běžného výdeje sedí.`, {}); }
  // hlad
  let vlk = 0; for (let k = 0; k <= 7; k++) if (effectiveDay(addDays(t, -k)).hunger === 'vlk') vlk++;
  if (vlk >= 3) push(1, `${vlk}× vlčí hlad za týden. Tempo je nejspíš moc rychlé – zpomal dřív, než to vzdá.`, { head: 'Opakovaně vlčí hlad.', go: "go('nastaveni')", label: 'Tempo' });
  // plánování
  const thisMon = mondayOf(t), nextMon = addDays(thisMon, 7); const pt = weekPlanned(thisMon), pn = weekPlanned(nextMon);
  if (pt < 35) push(pt === 0 ? 1 : 2, `Tento týden má naplánováno ${pt}/35 jídel.`, {});
  if (dayIndex(t) >= 5 && pn < 35) push(2, `Příští týden zatím ${pn}/35 jídel.`, {});
  // chůze
  { let log = 0, ok = 0; for (let k = 1; k <= 14; k++) { const ev = evaluateDay(addDays(t, -k)); if (!ev.logged) continue; log++; if ((ev.day.walk_min || 0) >= (ev.day.act ? ev.day.act.planWalk : s.walk_min)) ok++; }
    if (log >= 5 && ok / log < 0.6) push(2, `Chůzi splnil jen ${ok} z ${log} zapsaných dnů.`, {}); }
  // nastavení podle dat
  settingsAdvice().filter(a => a.lv === 1).forEach(a => push(1, a.text, a.apply ? { apply: `A.applyAdvice(${JSON.stringify(JSON.stringify(a.apply)).replace(/"/g, '&quot;')})`, label: a.label } : { go: "go('nastaveni')", label: 'Plán' }));
  const ph = phaseSuggestion(); if (ph) push(2, ph.text, { apply: `A.applyPhase(${ph.rec})`, label: `${fmt1(ph.rec)} km/h` });
  // cíl a udržování
  if (!s.maintain && ov.cur - s.goal_weight <= 0) push(1, `Robert dosáhl cílové váhy ${s.goal_weight} kg. Zapni udržování – jinak deficit běží dál.`, { head: 'Robert je u cíle.', apply: 'A.setMaintain(true)', label: 'Udržování' });
  else if (!s.maintain && ov.cur - s.goal_weight <= 2) push(2, `Robert je ${fmt1(ov.cur - s.goal_weight)} kg od cíle. Připrav udržování.`, { go: "App.coachTab='cile';go('nastaveni')", label: 'Plán' });
  // udržovací týden – jeden práh všude: po 8 týdnech upozornit, Plán radí 6–10
  const mw = (s.maint_weeks || []).slice().sort(); const odKdy = mw.length ? mw[mw.length - 1] : s.start_date; const tydnu = Math.floor(daysBetween(odKdy, t) / 7);
  if (tydnu >= 8) push(2, `${tydnu} týdnů bez udržovacího týdne. Po osmi týdnech deficitu se vyplatí jeden týden na nule.`, { go: "App.coachTab='cile';go('nastaveni')", label: 'Zařadit' });
  const apl = activePlanFor(t);
  if (!apl) push(3, `Žádný tréninkový plán – Robert jede na výchozích ${s.walk_min} min chůze.`, { go: "App.coachTab='trenink';go('nastaveni')", label: 'Trénink' });
  return out.sort((a, b) => a.lv - b.lv);
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
