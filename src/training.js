/* ===== TRÉNINK =====
   Tabulka `training` (píše trenér, čte klient):
     tp:<uid>:<id>   plán  { name, days:[7 × { walk_min, walk_kmh, items:[...] }], active_from: 'YYYY-MM-DD'|null, created }
     to:<uid>:<date> výjimka na den { walk_min, walk_kmh, items, note }
   Položka: { ex: 'název', type: 'strength'|'cardio', sets, reps, weight, min, intensity: 'light'|'medium'|'hard', note }
   Splnění zapisuje Robert do days: day.training = { done: {idx:true}, doneAll } */
const EX_LIB = [
  // silové s vlastní vahou / doma
  { ex: 'Dřep', type: 'strength', note: 'chodidla na šířku boků, kolena ven, celé chodidlo na zemi' },
  { ex: 'Dřep na židli (dosed)', type: 'strength', note: 'na začátek: dosednout a zvednout se bez rukou' },
  { ex: 'Klik', type: 'strength', note: 'tělo v jedné linii; lehčí varianta o stůl nebo zeď' },
  { ex: 'Klik o stůl', type: 'strength' },
  { ex: 'Přítah na stole (inverzní řada)', type: 'strength', note: 'leh pod pevným stolem, přitáhnout hrudník k desce' },
  { ex: 'Přítah na hrazdě / TRX', type: 'strength' },
  { ex: 'Výpad', type: 'strength', note: 'krok vpřed, koleno nad kotníkem; počet je na každou nohu' },
  { ex: 'Výstup na schod / bednu', type: 'strength' },
  { ex: 'Most (glute bridge)', type: 'strength' },
  { ex: 'Prkno (plank)', type: 'strength', timed: true, note: 'výdrž v sekundách místo opakování' },
  { ex: 'Boční prkno', type: 'strength', timed: true },
  { ex: 'Mrtvý brouk (dead bug)', type: 'strength' },
  { ex: 'Ptačí pes (bird dog)', type: 'strength' },
  { ex: 'Zvedání pánve v leže', type: 'strength' },
  { ex: 'Angličák (burpee)', type: 'strength', met: 8 },
  { ex: 'Horolezec (mountain climber)', type: 'strength', met: 8 },
  // kettlebell
  { ex: 'Kettlebell swing', type: 'strength', met: 6 },
  { ex: 'Goblet dřep s kettlebell', type: 'strength' },
  { ex: 'Mrtvý tah s kettlebell', type: 'strength' },
  { ex: 'Kettlebell tlak nad hlavu', type: 'strength' },
  { ex: 'Kettlebell přítah v předklonu', type: 'strength' },
  { ex: 'Farmářská chůze s kettlebell', type: 'strength', timed: true },
  // expander
  { ex: 'Veslování s expanderem', type: 'strength' },
  { ex: 'Tlak s expanderem', type: 'strength' },
  { ex: 'Rozpažování s expanderem', type: 'strength' },
  { ex: 'Dřep s expanderem', type: 'strength' },
  { ex: 'Chůze do strany s gumou (monster walk)', type: 'strength' },
  // kardio
  { ex: 'Chůze svižná', type: 'cardio', met: 4.3 }, { ex: 'Chůze do kopce', type: 'cardio', met: 6 }, { ex: 'Běh pomalý', type: 'cardio', met: 8 }, { ex: 'Střídání běh / chůze', type: 'cardio', met: 6 },
  { ex: 'Kolo v klidu', type: 'cardio', met: 5 }, { ex: 'Kolo svižně', type: 'cardio', met: 7 }, { ex: 'Plavání', type: 'cardio', met: 6 }, { ex: 'Švihadlo', type: 'cardio', met: 9 }, { ex: 'Schody', type: 'cardio', met: 7 }, { ex: 'Rotoped / eliptical', type: 'cardio', met: 5 }, { ex: 'Veslovací trenažér', type: 'cardio', met: 6 },
];
const INTENSITY_MET = { light: 3, medium: 4.5, hard: 6 };
const INTENSITY_LABEL = { light: 'lehce', medium: 'středně', hard: 'těžce' };
const SET_MINUTES = 1.6;   // práce ~40 s + pauza ~55 s

/* minuty a kcal jedné položky pro danou váhu */
function itemMinutes(it) { if (it.min > 0) return Number(it.min); if (it.type === 'strength') return (Number(it.sets) || 1) * SET_MINUTES; return 0; }
function itemMet(it) { if (it.type === 'cardio') { const lib = EX_LIB.find(e => e.ex === it.ex); return it.met || (lib && lib.met) || 5; } const lib = EX_LIB.find(e => e.ex === it.ex); return (lib && lib.met) || INTENSITY_MET[it.intensity || 'medium']; }
function itemKcal(it, weight) { return (itemMet(it) - 1) * 3.5 * weight / 200 * itemMinutes(it); }
function sessionKcal(items, weight) { return (items || []).reduce((a, it) => a + itemKcal(it, weight), 0); }
function itemLabel(it) { if (it.type === 'cardio') return `${it.ex} · ${it.min} min`; const lib = EX_LIB.find(e => e.ex === it.ex); const rep = lib && lib.timed ? `${it.reps} s` : `${it.reps} opak.`; return `${it.ex} · ${it.sets} × ${rep}${it.weight ? ` · ${it.weight} kg` : ''}`; }

/* data */
function TrainingRows() { return Store.rows('training', Store.ownerId()); }
function trainingPlans() { return TrainingRows().filter(r => r.id.startsWith('tp:')).map(r => ({ id: r.id, ...r.data })).sort((a, b) => (a.created || '').localeCompare(b.created || '')); }
function trainingOverride(date) { const r = TrainingRows().find(x => x.id === oid('to', date)); return r ? r.data : null; }
function saveTrainingPlan(pl) { const { id, ...data } = pl; Store.put('training', id, data); }
function emptyDay() { return { walk_min: S().walk_min, walk_kmh: S().walk_kmh, items: [] }; }
function newPlan(name) { return { id: oid('tp', Date.now()), name: name || 'Nový plán', days: Array.from({ length: 7 }, emptyDay), active_from: null, created: new Date().toISOString() }; }
/* aktivní plán pro datum: nejnovější active_from <= date */
function activePlanFor(date) { const c = trainingPlans().filter(p => p.active_from && p.active_from <= date).sort((a, b) => b.active_from.localeCompare(a.active_from)); return c[0] || null; }
/* plánovaná aktivita dne */
function dayActivityPlan(date) {
  const ov = trainingOverride(date); if (ov) return { ...ov, source: 'override' };
  const pl = activePlanFor(date); if (pl) return { ...pl.days[dayIndex(date)], source: 'plan', planName: pl.name };
  return { walk_min: S().walk_min, walk_kmh: S().walk_kmh, items: [], source: 'default' };
}
function planActFor(date, weight) { const ap = dayActivityPlan(date); return { planWalk: ap.walk_min != null ? Number(ap.walk_min) : S().walk_min, planKcal: sessionKcal(ap.items || [], weight), items: ap.items || [], stepsBase: stepsBaseFor(date) }; }
function weekActs(monday, weight) { return Array.from({ length: 7 }, (_, i) => planActFor(addDays(monday, i), weight)); }
/* act pro calcBase z plánu + splnění zapsaného ve dni */
function dayAct(date, day, weight) {
  const ap = dayActivityPlan(date); const items = ap.items || [];
  const done = (day && day.training && day.training.done) || {};
  const planKcal = sessionKcal(items, weight);
  const doneKcal = items.reduce((a, it, i) => a + (done[i] ? itemKcal(it, weight) : 0), 0);
  const doneAll = items.length > 0 && items.every((_, i) => done[i]);
  const sb = stepsBaseFor(date);
  return { planWalk: ap.walk_min != null ? Number(ap.walk_min) : S().walk_min, planKcal, doneKcal, planItems: items.length, doneAll, items, source: ap.source, note: ap.note, walk_kmh: ap.walk_kmh,
    stepsBase: sb, stepsReal: sb != null && day && day.steps != null ? bezneKroky(day, S().walk_kmh) : null };
}

/* ===== Hlídání tempa (trenér) ===== */
function paceGuard() {
  const s = S(), ov = calcOverview(s, Meas()), out = [];
  const w = ov.cur; const bmr = 10 * w + 6.25 * s.height - 5 * s.age + 5;
  if (ov.weekBack && ov.weekBack.lostW != null && ov.weekBack.planW && ov.weekBack.lostW > ov.weekBack.planW * 1.3) out.push({ lv: 1, text: `📉 Hubne rychleji než plán: −${fmt2(ov.weekBack.lostW)} kg za týden (cíl ${fmt2(ov.weekBack.planW)}). Buď sníž tempo v Nastavení, nebo ať Robert dojí limit.` });
  if (s.rate_pct > 1) out.push({ lv: 1, text: `⚠️ Tempo ${String(s.rate_pct).replace('.', ',')} % váhy/týden je nad doporučeným maximem 1 %.` });
  // příjem pod limitem 3 dny v řadě
  const uid = Store.ownerId(); const recs = Object.fromEntries(Store.rows('days', uid).map(r => [r.data.date, r.data]));
  let under = 0, bmrDays = 0; for (let k = 1; k <= 3; k++) { const dt = addDays(todayISO(), -k); const d = recs[dt]; if (!d) break; const ev = evaluateDay(dt); if (ev.confirmed && ev.d.tot.kcal > 0 && ev.d.intake < ev.d.base.maxIntake - 300) under++; if (ev.d.base.belowBmr) bmrDays++; }
  if (under >= 3) out.push({ lv: 1, text: '🍽️ Tři dny v řadě jedl o 300+ kcal míň, než smí. Deficit je větší než cílový – zvaž nižší tempo nebo větší porce.' });
  if (bmrDays >= 2) out.push({ lv: 2, text: `🛡️ ${bmrDays} z posledních 3 dnů držela limit spodní hranice (${fmt0(calcBase(S(), currentWeight(), 0, 0, S().walk_kmh, 0, 0).floor)} kcal) – málo cíleného pohybu, deficit proto vyšel menší. Zvaž lehčí plán nebo víc chůze.` });
  return out;
}
/* věta pro Roberta, když je deficit moc velký */
function paceMessageForClient() { const s = S(), ov = calcOverview(s, Meas()); if (ov.weekBack && ov.weekBack.lostW != null && ov.weekBack.planW && ov.weekBack.lostW > ov.weekBack.planW * 1.3) return `Hubneš rychleji, než je zdravé (−${fmt2(ov.weekBack.lostW)} kg za týden). Dojídej přílohy do limitu – deficit je už teď větší, než má být.`; return null; }

/* ===== Obrazovka trenéra: Trénink (záložka v Plánu) =====
   Robertův týden, ne plány s daty. Trenér vidí konkrétní dny (tento a příští týden)
   a u každého řekne, co se cvičí. Při uložení volí jediné: platí to každý takový
   den od dneška (šablona týdne), nebo jen tento jeden den (výjimka).
   Dřív se plány zakládaly s polem „Platí od“ – bez něj je Robert neviděl – a úprava
   šablony zpětně přepsala i minulé dny, které už odcvičil. Teď si appka verze drží
   sama: změna šablony vytvoří na pozadí novou verzi platnou od dneška. */
/* šablona, která platí dnes (nejnovější verze s active_from ≤ dnes) */
function trTemplate() { return activePlanFor(todayISO()); }
/* změna šablony týdne od dneška; minulé dny zůstanou na staré verzi */
function editTemplate(fn) {
  const t = todayISO(); const cur = trTemplate();
  let pl;
  if (!cur) { const vse = trainingPlans(); const last = vse[vse.length - 1];
    pl = last ? { ...JSON.parse(JSON.stringify(last)), id: oid('tp', Date.now()) } : newPlan('Robertův týden');
    pl.active_from = mondayOf(t); }                 // první šablona platí od pondělí, historie ještě není
  else if (cur.active_from >= t) pl = JSON.parse(JSON.stringify(cur));   // dnešní verze – upravit na místě
  else pl = { ...JSON.parse(JSON.stringify(cur)), id: oid('tp', Date.now()), active_from: t, created: new Date().toISOString() };
  pl.name = 'Robertův týden';
  fn(pl); saveTrainingPlan(pl);
}
/* Staré plány bez „Platí od“ (před 29. 9.) – převzít poslední jako Robertův týden */
function adoptLegacyPlan() {
  if (trTemplate()) return; const vse = trainingPlans().filter(p => !p.active_from || p.active_from > todayISO()); if (!vse.length) return;
  const pl = vse[vse.length - 1]; if (pl.active_from) return; pl.active_from = mondayOf(todayISO()); saveTrainingPlan(pl);
}
function trDaySummary(ap) { const items = ap.items || [];
  return `🚶 ${ap.walk_min ?? S().walk_min} min${items.length ? ' · 🏋️ ' + items.map(it => esc(it.ex)).join(', ') : ''}`; }
/* ---- Měsíc: plán tréninku dopředu (1. 10. 2026) ----
   Trenér plánuje aspoň na měsíc. Kalendář měsíce, den se upravuje v listu a dny,
   týdny i celý měsíc jdou kopírovat. Zkopírovaný den se uloží jako plán konkrétního
   data (výjimka to:<uid>:<datum>); šablona „každé X“ zůstává základem pro dny, které
   trenér nenaplánoval. */
const MESICE = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];
const monthStart = d => d.slice(0, 8) + '01';
const addMonths = (m, n) => { const [y, mo] = m.split('-').map(Number); const t = new Date(Date.UTC(y, mo - 1 + n, 1)); return t.toISOString().slice(0, 10); };
const monthName = m => { const [y, mo] = m.split('-').map(Number); return `${MESICE[mo - 1]} ${y}`; };
function monthDays(m) { const out = []; for (let d = m; d.slice(0, 7) === m.slice(0, 7); d = addDays(d, 1)) out.push(d); return out; }
/* plán dne tak, jak ho uvidí Robert (výjimka > šablona > výchozí chůze) */
function trDayData(dt) { const ap = dayActivityPlan(dt); return { walk_min: ap.walk_min != null ? Number(ap.walk_min) : S().walk_min, walk_kmh: ap.walk_kmh || S().walk_kmh, items: JSON.parse(JSON.stringify(ap.items || [])) }; }
const trSame = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/* kopírování: dvojice [zdroj, cíl]; do minulosti ne, přepsání vlastního plánu se potvrzuje */
function trCopyPairs(pairs, label) {
  /* den, který by po kopii vypadal stejně jako teď (třeba podle šablony), se nepřepisuje –
     jinak by zbytečně zamrzl a nereagoval na pozdější změnu šablony */
  const t = todayISO(); const P = pairs.filter(([src, dst]) => dst >= t && src !== dst && !trSame(trDayData(src), trDayData(dst)));
  if (!P.length) { UI.toast('Nic se nezměnilo – vybrané dny už mají stejný plán.'); App.trSel = null; UI.closeModal(); return; }
  const prepis = P.filter(([, dst]) => trainingOverride(dst)).length;
  const run = () => { UI.closeModal(); Undo.run(label, () => P.forEach(([src, dst]) => Store.put('training', oid('to', dst), trDayData(src))),
    `${label}: ${P.length} ${sklon(P.length, 'den', 'dny', 'dní')}. Robert je uvidí v Dnes.`); App.trSel = null; render(); };
  if (prepis) UI.confirm(`${prepis} ${sklon(prepis, 'den už má', 'dny už mají', 'dní už má')} vlastní plán – přepsat?`, run, 'Přepsat'); else run();
}

App.trMonth = null; App.trSel = null;
VIEWS.trenink = function () {
  return `<div class="ph"><div class="pt"><h1>Trénink</h1><span class="sub">Robertův kalendář · den upravíš ťuknutím</span></div></div>${trMonthHtml()}`;
};
function trMonthHtml() {
  if (!App.ro) adoptLegacyPlan();
  const s = S(), w = currentWeight(), ov = calcOverview(s, Meas()); const t = todayISO();
  if (!App.trMonth) App.trMonth = monthStart(t);
  const m = App.trMonth; const days = monthDays(m); const gridStart = mondayOf(m);
  const gridEnd = addDays(mondayOf(days[days.length - 1]), 6); const grid = []; for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) grid.push(d);
  const acts = days.map(dt => { const ap = dayActivityPlan(dt); const act = { planWalk: ap.walk_min != null ? Number(ap.walk_min) : s.walk_min, planKcal: sessionKcal(ap.items || [], w) }; const b = calcBase(s, w, act.planWalk, 0, ap.walk_kmh || s.walk_kmh, 0, 0, act); return { dt, ap, act, b }; });
  const fut = acts.filter(x => x.dt >= t);
  const warns = [];
  const nizko = fut.filter(x => x.b.planBelowBmr); if (nizko.length) warns.push(`${nizko.length} ${sklon(nizko.length, 'den', 'dny', 'dní')} s málo pohybem (${nizko.slice(0, 4).map(x => czDateShort(x.dt)).join(', ')}${nizko.length > 4 ? '…' : ''}) – limit drží spodní hranice a deficit je menší. Přidej chůzi.`);
  if (ov.cur > 124 && fut.some(x => (x.ap.items || []).some(it => /Běh|Švihadlo|Angličák/.test(it.ex)))) warns.push('Nad 124 kg sešit nedoporučuje běh ani skoky. Nahraď chůzí do kopce nebo kolem.');
  const def = fut.reduce((a, x) => a + (x.b.minOut - x.b.planLimit), 0); const kgT = fut.length ? def / fut.length * 7 / KG_KCAL : null; const cil = w * s.rate_pct / 100;
  if (kgT != null && kgT < cil * 0.97) warns.push(`Zbytek měsíce dá −${fmt2(kgT)} kg/týden místo −${fmt2(cil)} – brzdí ho dny s málo pohybem.`);
  const trenDni = acts.filter(x => (x.ap.items || []).length).length;
  const cell = dt => { const inM = dt.slice(0, 7) === m.slice(0, 7); if (!inM) return '<div class="tm0"></div>';
    const ap = dayActivityPlan(dt); const n = (ap.items || []).length; const vyj = ap.source === 'override';
    return `<button class="tmd ${dt === t ? 'dnes' : ''} ${dt < t ? 'past' : ''} ${n ? 'tr' : ''}" onclick="A.trDaySheet('${dt}')" aria-label="${czDate(dt)}"><b>${parseISO(dt).getDate()}</b><span>${n ? '🏋️' + n : '🚶' + (ap.walk_min ?? s.walk_min)}</span>${vyj ? '<i></i>' : ''}</button>`; };
  return `<div class="pgrid tgrid"><div class="pcol"><div class="card stack s8"><div class="row between nowrap"><button class="iconbtn" onclick="App.trMonth=addMonths(App.trMonth,-1);render()" aria-label="předchozí měsíc">‹</button><b style="font-size:17px">${monthName(m)}</b><button class="iconbtn" onclick="App.trMonth=addMonths(App.trMonth,1);render()" aria-label="další měsíc">›</button></div>
    <div class="tmgrid">${DAY_SHORT.map(d => `<div class="tmh">${d}</div>`).join('')}${grid.map(cell).join('')}</div>
    <div class="row between small muted"><span>${trenDni} ${sklon(trenDni, 'tréninkový den', 'tréninkové dny', 'tréninkových dní')} · tečka = naplánováno na datum</span></div>
    <div class="row"><button class="btn sec sm" onclick="A.trCopyWeekSheet()">📑 Kopírovat týden</button><button class="btn sec sm" onclick="A.trCopyMonthSheet()">📑 Kopírovat měsíc</button><button class="btn ghost sm" onclick="A.trResetMonth()">↺ vrátit měsíc na šablonu</button></div></div></div>
  <div class="pcol"><div class="card stack s8"><div class="row between"><h2>Měsíc</h2>${kgT != null ? `<span class="pill ${kgT >= cil * 0.97 ? 'ok' : 'warn'}">−${fmt2(kgT)} kg/týden</span>` : ''}</div>
    ${warns.slice(0, 6).map(x => `<div class="alert a2"><div>${esc(x)}</div></div>`).join('') || '<div class="small muted">V pořádku: pohyb drží tempo.</div>'}${warns.length > 6 ? `<div class="small muted">a dalších ${warns.length - 6}…</div>` : ''}</div>
  <div class="card flush"><div class="navrow" onclick="A.trInsight()"><span class="ico">📈</span><div class="tx"><b>Jak Robert cvičí</b><span>odcvičené tréninky, náročnost, zátěž u cviků</span></div><span class="chev">›</span></div>
    <div class="navrow" onclick="A.twLibrary()"><span class="ico">💾</span><div class="tx"><b>Uložené tréninky</b><span>${Workouts().length} · vložíš je do kteréhokoli dne</span></div><span class="chev">›</span></div>
    <div class="navrow" onclick="A.exLibrary()"><span class="ico">🏋️</span><div class="tx"><b>Knihovna cviků</b><span>${Exercises().length} cviků · upravit nebo přidat</span></div><span class="chev">›</span></div></div></div></div>`;
};

/* ---- kopírovat den: vybrat cílové dny v kalendáři příštích 8 týdnů ---- */
A.trCopyDaySheet = src => { App.trSel = new Set(); App.trCopySrc = src; UI.closeModal(); openSheet(trCopyDayHtml); };
function trCopyDayHtml() {
  const src = App.trCopySrc, t = todayISO(), sel = App.trSel || new Set(); const start = mondayOf(t);
  const dny = Array.from({ length: 56 }, (_, i) => addDays(start, i)); const den = DAY_NAMES[dayIndex(src)].toLowerCase();
  const sum = trDaySummary(dayActivityPlan(src));
  return UI.sheetHtml(`Zkopírovat ${czDateShort(src)}`, sum, `<div class="row"><button class="btn ghost sm" onclick="A.trSelQuick('weekday',4)">${KAZDE[dayIndex(src)]} · 4 týdny</button><button class="btn ghost sm" onclick="A.trSelQuick('weekday',8)">${KAZDE[dayIndex(src)]} · 8 týdnů</button><button class="btn ghost sm" onclick="A.trSelQuick('none')">nic</button></div>
    <div class="tmgrid">${DAY_SHORT.map(d => `<div class="tmh">${d}</div>`).join('')}${dny.map(d => { const lab = parseISO(d).getDate() === 1 ? `1. ${parseISO(d).getMonth() + 1}.` : parseISO(d).getDate(); const ap = dayActivityPlan(d); const n = (ap.items || []).length;
      return d < t || d === src ? `<div class="tmd past"><b>${lab}</b></div>` : `<button class="tmd ${sel.has(d) ? 'sel' : ''} ${n && !sel.has(d) ? 'tr' : ''}" onclick="A.trSelToggle('${d}')"><b>${lab}</b><span>${n ? '🏋️' + n : '🚶' + (ap.walk_min ?? S().walk_min)}</span></button>`; }).join('')}</div>`,
    `<button class="btn" ${sel.size ? '' : 'disabled'} onclick="A.trCopyDayGo()">Zkopírovat na ${sel.size} ${sklon(sel.size, 'den', 'dny', 'dní')}</button>`);
}
A.trSelToggle = d => { const s = App.trSel; s.has(d) ? s.delete(d) : s.add(d); if (window._sheetRedraw) window._sheetRedraw(); };
A.trSelQuick = (k, n) => { const src = App.trCopySrc, t = todayISO(); App.trSel = new Set();
  if (k === 'weekday') for (let i = 1; i <= n; i++) { const d = addDays(src, 7 * i); if (d >= t) App.trSel.add(d); }
  if (window._sheetRedraw) window._sheetRedraw(); };
A.trCopyDayGo = () => trCopyPairs([...App.trSel].sort().map(d => [App.trCopySrc, d]), `Zkopírován ${czDateShort(App.trCopySrc)}`);

/* ---- kopírovat týden: zdrojový týden → vybrané týdny ---- */
A.trCopyWeekSheet = () => { const t = todayISO(); App.trWkSrc = mondayOf(App.trMonth < monthStart(t) ? t : App.trMonth); if (App.trMonth === monthStart(t)) App.trWkSrc = mondayOf(t); App.trSel = new Set(); openSheet(trCopyWeekHtml); };
function trCopyWeekHtml() {
  const t = todayISO(); const src = App.trWkSrc; const sel = App.trSel;
  const zdroje = Array.from({ length: 10 }, (_, i) => addDays(mondayOf(t), 7 * (i - 2)));
  const cile = Array.from({ length: 12 }, (_, i) => addDays(mondayOf(t), 7 * i)).filter(x => x !== src);
  const wk = mon => `${czDateShort(mon)}–${czDateShort(addDays(mon, 6))}`;
  const nahled = Array.from({ length: 7 }, (_, i) => { const ap = dayActivityPlan(addDays(src, i)); const n = (ap.items || []).length; return `<div class="tmd"><b>${DAY_SHORT[i]}</b><span>${n ? '🏋️' + n : '🚶' + (ap.walk_min ?? S().walk_min)}</span></div>`; }).join('');
  return UI.sheetHtml('Zkopírovat týden', 'vyber, který týden a kam', `<div class="field"><label class="f">Který týden</label><div class="chips scroll">${zdroje.map(m => `<button class="chip ${m === src ? 'on' : ''}" onclick="App.trWkSrc='${m}';App.trSel.delete('${m}');window._sheetRedraw()">${wk(m)}</button>`).join('')}</div></div>
    <div class="tmgrid">${nahled}</div>
    <div class="field"><label class="f">Kam (lze víc)</label><div class="chips">${cile.map(m => `<button class="chip ${sel.has(m) ? 'on' : ''}" onclick="A.trSelToggle('${m}')">${wk(m)}</button>`).join('')}</div></div>
    <div class="row"><button class="btn ghost sm" onclick="App.trSel=new Set([1,2,3].map(i=>addDays(App.trWkSrc,7*i)).filter(x=>x>=mondayOf(todayISO())));window._sheetRedraw()">3 následující týdny</button><button class="btn ghost sm" onclick="App.trSel=new Set();window._sheetRedraw()">nic</button></div>`,
    `<button class="btn" ${sel.size ? '' : 'disabled'} onclick="A.trCopyWeekGo()">Zkopírovat do ${sel.size} ${sklon(sel.size, 'týdne', 'týdnů', 'týdnů')}</button>`);
}
A.trCopyWeekGo = () => { const src = App.trWkSrc; const pairs = []; [...App.trSel].sort().forEach(mon => { for (let i = 0; i < 7; i++) pairs.push([addDays(src, i), addDays(mon, i)]); }); trCopyPairs(pairs, `Zkopírován týden od ${czDateShort(src)}`); };

/* ---- kopírovat měsíc: n-tý den v týdnu → stejný n-tý den v cílovém měsíci ---- */
A.trCopyMonthSheet = () => { App.trSel = new Set(); openSheet(trCopyMonthHtml); };
function trCopyMonthHtml() {
  const src = App.trMonth; const sel = App.trSel; const cile = [1, 2, 3, 4, 5, 6].map(n => addMonths(src, n));
  return UI.sheetHtml(`Zkopírovat ${monthName(src)}`, 'den se mapuje podle pořadí v měsíci – 1. pondělí na 1. pondělí',
    `<div class="field"><label class="f">Kam (lze víc)</label><div class="chips">${cile.map(m => `<button class="chip ${sel.has(m) ? 'on' : ''}" onclick="A.trSelToggle('${m}')">${monthName(m)}</button>`).join('')}</div></div>
     <p class="hint">Pátý výskyt dne v týdnu (třeba 5. středa), který cílový měsíc nemá, se přeskočí.</p>`,
    `<button class="btn" ${sel.size ? '' : 'disabled'} onclick="A.trCopyMonthGo()">Zkopírovat do ${sel.size} ${sklon(sel.size, 'měsíce', 'měsíců', 'měsíců')}</button>`);
}
A.trCopyMonthGo = () => { const src = App.trMonth; const pairs = [];
  const nth = d => Math.floor((parseISO(d).getDate() - 1) / 7);
  [...App.trSel].sort().forEach(tm => { const target = monthDays(tm);
    monthDays(src).forEach(d => { const dst = target.find(x => dayIndex(x) === dayIndex(d) && nth(x) === nth(d)); if (dst) pairs.push([d, dst]); }); });
  trCopyPairs(pairs, `Zkopírován ${monthName(src)}`); };
/* zrušit plány na datum v zobrazeném měsíci (od dneška) – dny se vrátí na šablonu týdne */
A.trResetMonth = () => { const t = todayISO(); const dny = monthDays(App.trMonth).filter(d => d >= t && trainingOverride(d));
  if (!dny.length) { UI.toast('V tomhle měsíci nejsou od dneška žádné dny s vlastním plánem.'); return; }
  UI.confirm(`Zrušit plán na ${dny.length} ${sklon(dny.length, 'den', 'dny', 'dní')} a vrátit je na šablonu týdne?`, () => { Undo.run('Měsíc vrácen na šablonu', () => dny.forEach(d => Store.remove('training', oid('to', d))), `${dny.length} ${sklon(dny.length, 'den', 'dny', 'dní')} zase podle šablony.`); render(); }, 'Vrátit'); };

/* ---- den tréninku v listu: rozpracovaná úprava, uložení s volbou platnosti ---- */
App.trDraft = null;
A.trDaySheet = (date, scope) => {
  const ap = dayActivityPlan(date);
  App.trDraft = { date, walk_min: ap.walk_min != null ? Number(ap.walk_min) : S().walk_min, walk_kmh: ap.walk_kmh || S().walk_kmh, items: JSON.parse(JSON.stringify(ap.items || [])),
    scope: scope || (ap.source === 'override' ? 'day' : 'every'), wasOverride: ap.source === 'override', dirty: false };
  const m = openSheet(trDaySheetHtml, { guardEdits: true });
  m._guard = () => App.trDraft && App.trDraft.dirty;
};
function trDaySheetHtml() {
  const D = App.trDraft; if (!D) return ''; const s = S(), w = currentWeight(); const t = todayISO();
  const den = DAY_NAMES[dayIndex(D.date)].toLowerCase();
  const act = { planWalk: Number(D.walk_min) || 0, planKcal: sessionKcal(D.items, w) };
  const b = calcBase(s, w, act.planWalk, 0, D.walk_kmh || s.walk_kmh, 0, 0, act);
  const wk = getWeek(mondayOf(D.date)); const sels = wk.plan[dayIndex(D.date)];
  const r = sels.some(Boolean) ? calcPlanDay(s, Foods(), Recipes(), sels, w, act) : null;
  const pozn = [];
  if (b.planBelowBmr) pozn.push(`Málo pohybu – limit by vyšel pod spodní hranici jídla, deficit dne bude o ${fmt0(b.floor - (b.minOut - b.deficit))} kcal menší.`);
  if (r && r.filled === 5 && Math.abs(r.planLimit - r.kcal) > 100) pozn.push(`Robertova jídla na ${czDateShort(D.date)} ${r.planLimit > r.kcal ? `se nedojí do limitu (chybí ${fmt0(r.planLimit - r.kcal)} kcal)` : `se nevejdou (o ${fmt0(r.kcal - r.planLimit)} kcal víc)`} – uvidí „Dorovnat“.`);
  const inp = (j, f, v, lab, ph) => `<div class="in"><label class="f">${lab}</label><input type="text" inputmode="decimal" value="${v ?? ''}" ${ph ? `placeholder="${ph}"` : ''} onchange="A.trItem(${j},'${f}',this.value)"></div>`;
  const items = D.items.map((it, j) => { const isC = it.type === 'cardio'; const sg = progressSuggestion(it);
    return `<div class="exrow"><div class="exn">${esc(it.ex)}<span>${isC ? `kardio · MET ${itemMet(it)}` : `${fmt0(itemMinutes(it))} min`} · ~${fmt0(itemKcal(it, w))} kcal</span>${sg && sg.apply ? `<span class="ok">${esc(sg.text)} <button class="btn ghost sm" style="min-height:24px;padding:0 4px" onclick="A.trProgress(${j})">použít</button></span>` : ''}</div><button class="xbtn sm" onclick="A.trItemDel(${j})" aria-label="odebrat">×</button>
      <div class="exf">${isC ? inp(j, 'min', it.min, 'Minut') : inp(j, 'sets', it.sets, 'Série') + inp(j, 'reps', it.reps, EX_LIB.find(e => e.ex === it.ex && e.timed) ? 'Sekund' : 'Opak.') + inp(j, 'weight', it.weight, 'kg', '–') + inp(j, 'rest', it.rest, 'Pauza s' + hq('trPauza'), S().rest_sec || REST_DEFAULT)
        + `<div class="in wide"><label class="f">Intenzita${hq('trIntenzita')}</label><select onchange="A.trItem(${j},'intensity',this.value)">${Object.entries(INTENSITY_LABEL).map(([k, l]) => `<option value="${k}" ${(it.intensity || 'medium') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`}</div></div>`; }).join('');
  const kc = sessionKcal(D.items, w);
  return UI.sheetHtml(`${DAY_NAMES[dayIndex(D.date)]} ${czDateShort(D.date)}`, D.date < t ? 'minulý den – změna platí jen od dneška dál' : (D.wasOverride ? 'upravený jen pro tento den' : `podle šablony „${KAZDE[dayIndex(D.date)]}“`),
    `<div class="blk"><h4><span class="n">1</span>Chůze ten den</h4><div class="grid g2"><div class="field"><label class="f">Minut</label><input type="text" inputmode="decimal" id="trw" value="${D.walk_min}" onchange="A.trDraftField('walk_min',this.value)"></div>
      <div class="field"><label class="f">Tempo</label><select onchange="A.trDraftField('walk_kmh',this.value)">${SEED.met.map(([k]) => `<option value="${k}" ${Number(D.walk_kmh) === k ? 'selected' : ''}>${fmt1(k)} km/h</option>`).join('')}</select></div></div></div>
    <div class="blk"><h4><span class="n">2</span>Cviky${D.items.length ? `<span class="r">~${fmt0(kc)} kcal</span>` : ''}</h4>
      ${items || '<p class="small muted">Bez cviků – jen chůze.</p>'}
      <div class="row"><button class="btn sec sm" onclick="A.trPickEx()">+ cvik</button><button class="btn sec sm" onclick="A.trInsertWorkout()">+ uložený trénink</button></div></div>
    ${pozn.map(x => `<div class="alert a2"><div>${esc(x)}</div></div>`).join('')}`,
    `<div class="ftl"><span class="n">3</span>Platí${hq('trPlati')}</div><div class="seg" style="flex:1 1 100%"><button class="${D.scope === 'every' ? 'on' : ''}" onclick="A.trScope('every')">${KAZDE[dayIndex(D.date)].replace('k', 'K')}</button><button class="${D.scope === 'day' ? 'on' : ''}" onclick="A.trScope('day')">Jen ${czDateShort(D.date)}</button></div>
     <div class="hint" style="flex:1 1 100%">${D.scope === 'every' ? `Změní šablonu od dneška – ${KAZDE[dayIndex(D.date)]} bude takhle. Dny, které už Robert má za sebou, zůstanou.` : `Jen ${czDateShort(D.date)} – ostatní dny jedou dál podle šablony.`}</div>
     <button class="btn" onclick="A.trSave()">Uložit</button>`,
    `<button class="iconbtn" onclick="A.trDayMenu()" aria-label="další akce">⋯</button>`);
}
/* méně časté akce se dnem – každá s větou, co udělá */
A.trDayMenu = () => { const D = App.trDraft; if (!D) return;
  UI.menu('Další akce', [
    [`📑 ${HELP.trKopie.t}`, D.dirty ? `UI.toast('Nejdřív ulož změny, pak kopíruj.')` : `A.trCopyDaySheet('${D.date}')`, D.dirty ? 'nejdřív ulož změny' : HELP.trKopie.co],
    D.items.length ? [`💾 ${HELP.trUlozit.t}`, `A.twEdit(null,{name:'${DAY_NAMES[dayIndex(D.date)]} – trénink',items:JSON.parse(JSON.stringify(App.trDraft.items))})`, HELP.trUlozit.co] : null,
    D.items.length ? [`🧹 ${HELP.trVyprazdnit.t}`, 'A.trClear()', HELP.trVyprazdnit.co] : null,
    D.wasOverride ? [`↺ ${HELP.trVratit.t}`, 'A.trDropOverride()', HELP.trVratit.co] : null,
  ]); };
const KAZDE = ['každé pondělí', 'každé úterý', 'každou středu', 'každý čtvrtek', 'každý pátek', 'každou sobotu', 'každou neděli'];
const trDirty = () => { App.trDraft.dirty = true; if (window._sheetRedraw) window._sheetRedraw(); };
A.trDraftField = (f, v) => { const r = f === 'walk_min' ? omez(v, 0, 600) : { n: cislo(v) }; if (r.mimo) UI.toast('Chůze se plánuje v rozmezí 0 až 600 minut.'); App.trDraft[f] = r.n ?? 0; trDirty(); };
A.trItem = (j, f, v) => { const it = App.trDraft.items[j]; it[f] = f === 'intensity' ? v : (v === '' ? null : cislo(v)); trDirty(); };
A.trItemDel = j => { App.trDraft.items.splice(j, 1); trDirty(); };
A.trClear = () => { App.trDraft.items = []; trDirty(); };
A.trScope = sc => { App.trDraft.scope = sc; if (window._sheetRedraw) window._sheetRedraw(); };
A.trProgress = j => { const it = App.trDraft.items[j]; const sg = progressSuggestion(it); if (sg && sg.apply) { Object.assign(it, sg.apply); trDirty(); } };
function trNewItem(e) { return e.type === 'cardio' ? { ex: e.ex, type: 'cardio', min: 20, met: e.met || null } : { ex: e.ex, type: 'strength', sets: e.sets || 3, reps: e.reps || (e.timed ? 30 : 12), intensity: e.intensity || 'medium', note: e.note || '' }; }
A.trAdd = key => { const e = exBySlug(key) || Exercises().find(x => x.ex === key); if (!e || !App.trDraft) { UI.toast('Vyber cvik z knihovny.'); return; } App.trDraft.items.push(trNewItem(e)); trDirty(); };
A.trPickEx = () => openExPicker(e => { if (e) A.trAdd(e.slug); });
A.trInsertWorkout = () => openWorkoutPicker(wo => { if (!wo || !App.trDraft) return; App.trDraft.items = JSON.parse(JSON.stringify(wo.items || [])); trDirty(); UI.toast(`Vloženo: ${wo.name}. Ulož, ať to platí.`); });
A.trSave = () => { const D = App.trDraft; if (!D) return; const idx = dayIndex(D.date);
  const day = { walk_min: Number(D.walk_min) || 0, walk_kmh: Number(D.walk_kmh) || S().walk_kmh, items: D.items };
  const den = DAY_NAMES[idx].toLowerCase();
  Undo.run(D.scope === 'every' ? `${KAZDE[dayIndex(D.date)].replace('k', 'K')} od dneška` : `Jen ${czDateShort(D.date)}`, () => {
    if (D.scope === 'every') { editTemplate(pl => { pl.days[idx] = day; });
      // den, který měl výjimku, má po uložení „každé X“ platit podle šablony
      if (D.wasOverride && D.date >= todayISO()) Store.remove('training', oid('to', D.date)); }
    else Store.put('training', oid('to', D.date), day);
  }, D.scope === 'every' ? `Robert to uvidí ${KAZDE[dayIndex(D.date)]} od dneška. Limit i recepty se přepočítaly.` : `Platí jen ${czDateShort(D.date)}.`);
  D.dirty = false; App.trDraft = null; UI.closeModal(); render(); };
A.trDropOverride = () => { const D = App.trDraft; Undo.run('Výjimka zrušena', () => Store.remove('training', oid('to', D.date)), 'Den se vrátil na šablonu týdne.'); D.dirty = false; App.trDraft = null; UI.closeModal(); render(); };
/* Co Robert opravdu odcvičil: série, zátěž, náročnost a pocit zapisuje při běhu tréninku.
   Trenér to dřív neviděl – jen „trénink 2 ze 3“. */
A.trInsight = () => {
  const t = todayISO(); const sessions = []; const perEx = {};
  for (let k = 0; k < 42; k++) { const dt = addDays(t, -k); const items = dayActivityPlan(dt).items || []; if (!items.length) continue;
    const day = getDay(dt); const tr = day.training || {}; const done = tr.done || {}; const log = tr.log || {};
    if (dt < t || Object.keys(done).length) sessions.push({ dt, n: items.length, done: items.filter((_, i) => done[i]).length, rpe: tr.rpe, feel: tr.feel });
    items.forEach((it, i) => { const sets = ((log[i] || {}).sets || []).filter(Boolean); if (!sets.length) return;
      (perEx[it.ex] = perEx[it.ex] || []).push({ dt, sets, max: Math.max(...sets.map(x => x.kg || 0)), vol: sets.reduce((a, x) => a + (x.reps || 0) * (x.kg || 0), 0) }); }); }
  const ex = Object.entries(perEx).map(([n, L]) => { L.sort((a, b) => a.dt.localeCompare(b.dt)); const first = L[0], last = L[L.length - 1];
    return `<div class="li static"><div class="tx"><b>${esc(n)}</b><span>${L.length}× · naposledy ${czDateShort(last.dt)}: ${last.sets.map(x => `${x.reps}×${x.kg || 0}`).join(', ')}</span></div><span class="val ${last.vol > first.vol ? 'ok' : ''}">${L.length > 1 ? (last.vol > first.vol ? '↗' : last.vol < first.vol ? '↘' : '→') : ''} ${fmt0(last.max)} kg</span></div>`; }).join('');
  UI.sheet('📈 Jak Robert cvičí', 'posledních 6 týdnů',
    sessions.length ? `<div class="list">${sessions.map(x => { const f = FEELS.find(y => y[0] === x.feel); const r = RPES.find(y => y[0] === x.rpe);
      return `<div class="li static"><span class="tm">${czDateShort(x.dt)}</span><div class="tx"><b>${x.done} z ${x.n} cviků</b><span>${r ? `náročnost ${r[0]}/5 (${r[1]})` : 'bez hodnocení'}${f ? ` · ${f[1]} ${f[2]}` : ''}</span></div><span class="pill ${x.done >= x.n ? 'ok' : x.done ? 'warn' : 'bad'}">${x.done >= x.n ? 'celý' : x.done ? 'část' : 'ne'}</span></div>`; }).join('')}</div>
    <div class="lh" style="padding-left:0">Zátěž u cviků · ↗ roste objem</div>${ex ? `<div class="list">${ex}</div>` : '<p class="small muted">Zatím žádné zapsané série – zapisují se, když Robert cvičí přes „Začít cvičit“.</p>'}`
    : '<div class="empty"><span class="em">🏋️</span>Za posledních 6 týdnů žádný tréninkový den.</div>');
};
/* zpětná kompatibilita: jednorázová změna z listu dne u Roberta */
A.tpOverride = date => A.trDaySheet(date, 'day');

/* ===== Robert: karta Aktivita dne ===== */
/* tempo chůze a fáze – dřív samostatná karta v Přehledu, teď nápověda u zadávání chůze */
function tempoNapoveda() {
  const ov = calcOverview(S(), Meas());
  const faze = SEED.phases.map(p => `${p.name} (${p.weight}): ${p.pace}${p.steps !== '—' ? ', ' + p.steps + ' kroků' : ''} – ${p.goal}`).join('. ');
  return `Tempo poznáš i bez hodinek: svižně znamená, že se ještě udýcháš na hovor, ale nezazpíváš si. Teď jsi ve fázi ${ov.phase}. Rychlejší chůze je levnější než delší – hodina ti při ${fmt1(ov.cur)} kg udělá asi ${fmt0(60 * calcBase(S(), ov.cur, S().walk_min, 0, S().walk_kmh, 0, 0).walkPerMin)} kcal, svižnějším tempem zhruba o třetinu víc. Fáze: ${faze}.`;
}

/* ===== Robert: list tréninku =====
   Plán dal trenér; Robert jen hlásí, co opravdu odcvičil – po cvicích, nebo celý běh
   cvičení se sériemi a pauzami. */
A.trainSheet = () => openSheet(() => {
  const date = App.date, day = effectiveDay(date); const act = day.act || {}; const items = act.items || []; const done = (day.training && day.training.done) || {};
  const w = currentWeight(); const t = trState(date); const zapsal = Object.keys(t.log || {}).length;
  const body = items.length ? `
    <div class="list">${items.map((it, i) => `<div class="li" onclick="A.trainDone(${i},${!done[i]})">${ROW_CK(!!done[i], `A.trainDone(${i},${!done[i]})`)}<span class="em">${it.type === 'cardio' ? '🏃' : '🏋️'}</span><div class="tx"><b>${esc(itemLabel(it))}</b>${it.note ? `<span>${esc(it.note)}</span>` : ''}${trRealLine(date, i)}</div><span class="val k">${fmt0(itemKcal(it, w))}</span></div>`).join('')}</div>
    ${trSummaryLine(date)}`
    : `<div class="empty"><span class="em">🚶</span>Dnes je v plánu jen chůze.</div>`;
  const foot = !items.length ? '' : (act.doneAll ? (zapsal && !t.finished ? `<button class="btn sec write" onclick="A.trFinish()">Dokončit zápis tréninku</button>` : '')
    : `<button class="btn write" onclick="UI.closeModal();A.trRun(0)">▶︎ Začít cvičit</button><button class="btn sec write" onclick="A.trainDoneAll()">✓ Odcvičeno celé</button>${zapsal && !t.finished ? `<button class="btn ghost write" onclick="A.trFinish()">Dokončit zápis</button>` : ''}`);
  return UI.sheetHtml('🏋️ Trénink', items.length ? `${items.length} ${sklon(items.length, 'položka', 'položky', 'položek')} · ~${fmt0(act.planKcal || 0)} kcal${act.doneAll ? ' · hotovo' : ''}` : czDate(date), body, foot);
});
A.trainDone = (i, v) => { const items = (effectiveDay(App.date).act || {}).items || []; Undo.run(v ? `Hotovo: ${items[i] ? items[i].ex : ''}` : 'Cvik vrácen', () => { const day = getDay(App.date); day.training = day.training || { done: {} }; day.training.done[i] = v; saveDay(day); }, () => { const dd = calcDay(S(), Foods(), Recipes(), effectiveDay(App.date), currentWeight()); return `Limit dne je teď ${fmt0(dd.base.maxIntake)} kcal.`; }); render(); };
A.trainDoneAll = () => { const items = (effectiveDay(App.date).act || {}).items || []; Undo.run('Celý trénink odškrtnutý', () => { const day = getDay(App.date); day.training = { done: Object.fromEntries(items.map((_, i) => [i, true])) }; saveDay(day); }, () => { const dd = calcDay(S(), Foods(), Recipes(), effectiveDay(App.date), currentWeight()); return `+${fmt0(dd.base.doneKcal)} kcal aktivity, limit ${fmt0(dd.base.maxIntake)} kcal.`; }); render(); };

/* ===== nápověda (i) ===== */
function help(text) { return `<button class="hq" type="button" onclick="event.stopPropagation();UI.pop(this,${JSON.stringify(text).replace(/"/g, '&quot;')})" aria-label="nápověda">?</button>`; }
UI.pop = (el, text) => UI.popHtml(el, `<div>${esc(text)}</div>`);
UI.popHtml = (el, html) => { document.querySelectorAll('.popx').forEach(p => p.remove()); const p = document.createElement('div'); p.className = 'popx'; p.innerHTML = html; document.body.appendChild(p); const r = el.getBoundingClientRect(); const w = Math.min(340, window.innerWidth - 24); p.style.width = w + 'px'; p.style.left = Math.max(12, Math.min(r.left, window.innerWidth - w - 12)) + 'px'; p.style.top = (r.bottom + 8 + window.scrollY) + 'px'; const close = e => { if (!p.contains(e.target)) { p.remove(); document.removeEventListener('click', close); } }; setTimeout(() => document.addEventListener('click', close), 0); };

/* ===== Knihovna cviků =====
   Výchozí cviky jsou v EX_LIB. Trenér je mění globálně (řádky `exg:<slug>`,
   user_id null), klient si dělá vlastní (`ex:<uid>:<slug>`). Smazání se
   zapíše jako soft-delete stejně jako u surovin. Oblíbené jsou v prefs. */
const exSlug = n => String(n).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const EX_TYPE_LABEL = { strength: 'silový', cardio: 'kardio' };

function Exercises() {
  const uid = Store.ownerId();
  const out = new Map();
  EX_LIB.forEach(e => out.set(exSlug(e.ex), { ...e, slug: exSlug(e.ex), seed: true }));
  const apply = (rows, mark) => rows.forEach(r => {
    const sl = r.id.startsWith('exg:') ? r.id.slice(4) : r.id.split(':').pop();
    if (r.deleted) { out.delete(sl); return; }
    const prev = out.get(sl) || {};
    out.set(sl, { ...prev, ...r.data, slug: sl, seed: !!prev.seed, ...mark(r) });
  });
  apply(Store.db.training.filter(r => r.id.startsWith('exg:')), () => ({ global: true }));
  apply(Store.db.training.filter(r => r.id.startsWith('ex:') && r.user_id === uid), r => ({ own: true, ownId: r.id }));
  return [...out.values()].sort((a, b) => a.ex.localeCompare(b.ex, 'cs'));
}
function exBySlug(sl) { return Exercises().find(e => e.slug === sl); }
function exFavs() { return Prefs().exFavs || []; }
function isExFav(sl) { return exFavs().includes(sl); }

function saveExercise(e, origSlug) {
  const sl = exSlug(e.ex);
  const data = { ex: e.ex, type: e.type || 'strength', met: e.met || null, timed: !!e.timed, sets: e.sets || null, reps: e.reps || null, intensity: e.intensity || null, note: e.note || '' };
  if (isCoach()) Store.put('training', 'exg:' + sl, data, null);
  else Store.put('training', oid('ex', sl), data);
  if (origSlug && origSlug !== sl) deleteExercise(exBySlug(origSlug) || { slug: origSlug });   // přejmenování
}
function deleteExercise(e) {
  if (e.own && e.ownId) { Store.remove('training', e.ownId); return; }
  if (!isCoach()) { UI.toast('Výchozí cviky maže jen trenér. Můžeš si udělat vlastní.'); return; }
  Store.put('training', 'exg:' + e.slug, { ex: e.ex, type: e.type }, null);
  Store.remove('training', 'exg:' + e.slug);
}

A.exFav = sl => { const p = Prefs(); const f = (p.exFavs || []).slice(); const i = f.indexOf(sl); if (i < 0) f.push(sl); else f.splice(i, 1); savePrefs({ ...p, exFavs: f }); if (window._exdraw) window._exdraw(); };

/* výběrový panel: hledat, filtrovat, oblíbené, upravit, smazat, přidat nový */
const ExPick = { q: '', type: '', fav: false };
function openExPicker(onPick) {
  const m = UI.modal('');
  const draw = () => {
    let L = Exercises();
    if (ExPick.q) { const q = ExPick.q.toLowerCase(); L = L.filter(e => e.ex.toLowerCase().includes(q) || (e.note || '').toLowerCase().includes(q)); }
    if (ExPick.type) L = L.filter(e => (e.type || 'strength') === ExPick.type);
    if (ExPick.fav) L = L.filter(e => isExFav(e.slug));
    L.sort((a, b) => (isExFav(b.slug) - isExFav(a.slug)) || a.ex.localeCompare(b.ex, 'cs'));
    m.querySelector('.box').innerHTML = `<div class="sh"><h2>🏋️ Cviky${help('Knihovna cviků. Hledej podle názvu, filtruj silové a kardio, hvězdičkou si označ oblíbené – ty se řadí nahoru. Tužkou cvik upravíš, tlačítkem + nový přidáš vlastní. Výchozí cviky mění trenér pro všechny, tvoje vlastní vidíš jen ty.')} <span class="muted small" style="font-weight:600">${L.length} z ${Exercises().length}</span></h2><button class="xbtn" onclick="UI.closeModal()">×</button></div>
      <div class="search"><input type="text" id="exq" placeholder="hledat cvik…" value="${esc(ExPick.q)}"></div>
      <div class="frow"><span class="flab">Filtr</span><div class="seg">${[['', 'vše'], ['strength', 'silové'], ['cardio', 'kardio']].map(([k, l]) => `<button class="${ExPick.type === k ? 'on' : ''}" onclick="ExPick.type='${k}';window._exdraw()">${l}</button>`).join('')}</div>
        <button class="chip ${ExPick.fav ? 'on' : ''}" onclick="ExPick.fav=!ExPick.fav;window._exdraw()">★ oblíbené</button>
        <button class="btn sec sm" onclick="A.exEdit(null)">+ nový cvik</button></div>
      <div class="plist">${L.map(e => `<div class="pitem" ${onPick ? `onclick="window._expick('${e.slug}')"` : ''}>
          <div class="sp"><div class="pn">${esc(e.ex)}${e.own ? ' <span class="pill">moje</span>' : ''}${e.seed ? '' : ' <span class="pill">nový</span>'}</div>
            <div class="pi">${EX_TYPE_LABEL[e.type || 'strength']}${e.met ? ' · MET ' + e.met : ''}${e.note ? ' · ' + esc(e.note) : ''}</div></div>
          <button class="star ${isExFav(e.slug) ? 'on' : ''}" onclick="event.stopPropagation();A.exFav('${e.slug}')" title="oblíbené">${isExFav(e.slug) ? '★' : '☆'}</button>
          <button class="xbtn" title="upravit" onclick="event.stopPropagation();A.exEdit('${e.slug}')">✎</button></div>`).join('') || '<p class="muted small">Nic takového tu není. Zkus jiné slovo, nebo si cvik přidej.</p>'}</div>`;
    const q = m.querySelector('#exq');
    q.oninput = () => { ExPick.q = q.value; draw(); const n = m.querySelector('#exq'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
  };
  window._exdraw = draw;
  window._expick = sl => { m.remove(); if (onPick) onPick(exBySlug(sl)); };
  draw();
  return m;
}
A.exLibrary = () => openExPicker(null);

/* editor cviku */
A.exEdit = sl => {
  const e = sl ? exBySlug(sl) : { ex: '', type: 'strength', sets: 3, reps: 12, intensity: 'medium', note: '' };
  if (sl && !e) return;
  const canDel = sl && (e.own || isCoach());
  const m = UI.modal(`<div class="sh"><h2>${sl ? 'Upravit cvik' : 'Nový cvik'}</h2><button class="xbtn" onclick="UI.closeModal()">×</button></div>
    <div class="in"><label class="f">Název</label><input type="text" id="exn" value="${esc(e.ex)}"></div>
    <div class="grid g2">
      <div class="in"><label class="f">Typ</label><select id="ext">${Object.entries(EX_TYPE_LABEL).map(([k, l]) => `<option value="${k}" ${(e.type || 'strength') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="in"><label class="f">MET (volitelně)</label><input type="number" id="exm" step="0.5" min="0" value="${e.met || ''}"></div>
      <div class="in"><label class="f">Série</label><input type="number" id="exs" min="1" value="${e.sets || ''}"></div>
      <div class="in"><label class="f">Opakování</label><input type="number" id="exr" min="1" value="${e.reps || ''}"></div></div>
    <div class="in"><label class="f">Poznámka k provedení</label><input type="text" id="exnote" value="${esc(e.note || '')}" placeholder="např. kolena ven, záda rovná"></div>
    <p class="small muted">MET nech prázdné u běžných silových cviků – appka použije intenzitu z plánu. Série a opakování se předvyplní, až cvik vložíš do tréninku.</p>
    <div class="row"><button class="btn" id="exok">Uložit</button><button class="btn sec" onclick="UI.closeModal()">Zavřít</button>${canDel ? '<span class="sp"></span><button class="btn danger sm" id="exdel">Smazat</button>' : ''}</div>
    <div class="bad small" id="exerr"></div>`, { guardEdits: true });
  m.querySelector('#exok').onclick = () => {
    const name = m.querySelector('#exn').value.trim();
    if (!name) { m.querySelector('#exerr').textContent = 'Cvik potřebuje název.'; return; }
    const dup = Exercises().find(x => x.slug === exSlug(name) && x.slug !== sl);
    if (dup) { m.querySelector('#exerr').textContent = 'Cvik s tímto názvem už v knihovně je.'; return; }
    const data = { ex: name, type: m.querySelector('#ext').value, met: Number(m.querySelector('#exm').value) || null,
      sets: Number(m.querySelector('#exs').value) || null, reps: Number(m.querySelector('#exr').value) || null,
      intensity: e.intensity || 'medium', timed: !!e.timed, note: m.querySelector('#exnote').value.trim() };
    m.remove();
    Undo.run(sl ? 'Cvik upraven' : 'Cvik přidán', () => saveExercise(data, sl), `${name} je v knihovně. Najdeš ho přes hledání i filtr.`);
    if (window._exdraw) window._exdraw();
    render();
  };
  const del = m.querySelector('#exdel');
  if (del) del.onclick = () => UI.confirm(`Smazat cvik ${e.ex}? Z už uložených tréninků nezmizí.`, () => {
    m.remove(); Undo.run('Cvik smazán', () => deleteExercise(e)); if (window._exdraw) window._exdraw(); render();
  }, 'Smazat');
};

/* ===== Uložené tréninky (šablony) =====
   twg:<id>      globální, skládá je trenér, vidí je všichni jeho klienti
   tw:<uid>:<id> vlastní, skládá si je klient sám
   Šablona je { name, items:[...], note }. Vkládá se do dne plánu nebo
   jako jednorázová výjimka na konkrétní datum. */
function Workouts() {
  const uid = Store.ownerId();
  return Store.db.training
    .filter(r => !r.deleted && (r.id.startsWith('twg:') || (r.id.startsWith('tw:') && r.user_id === uid)))
    .map(r => ({ id: r.id, global: r.id.startsWith('twg:'), ...r.data }))
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'cs'));
}
function workoutById(id) { return Workouts().find(w => w.id === id); }
function saveWorkout(w) {
  const isNew = !w.id;
  const id = w.id || (isCoach() ? 'twg:' + Date.now() : oid('tw', Date.now()));
  const data = { name: w.name, items: w.items || [], note: w.note || '', updated: new Date().toISOString() };
  if (id.startsWith('twg:')) Store.put('training', id, data, null); else Store.put('training', id, data);
  return id;
}
const workoutKcal = (w) => (w.items || []).reduce((a, it) => a + itemKcal(it, currentWeight()), 0);
const workoutMin = (w) => (w.items || []).reduce((a, it) => a + itemMinutes(it), 0);

/* panel uložených tréninků: hledání, vložení, úprava, smazání */
const TwPick = { q: '' };
function openWorkoutPicker(onPick) {
  const m = UI.modal('');
  const draw = () => {
    const all = Workouts();
    const q = TwPick.q.toLowerCase();
    const L = !q ? all : all.filter(w => (w.name || '').toLowerCase().includes(q) || (w.items || []).some(it => it.ex.toLowerCase().includes(q)));
    m.querySelector('.box').innerHTML = `<div class="sh"><h2>💾 Uložené tréninky${help('Sestavený trénink si ulož pod jménem a pak ho vlož do kteréhokoli dne – do šablony týdne i jako jednorázovou změnu na konkrétní datum. Hledat jde podle názvu i podle cviku, který v tréninku je. Změna uložené šablony se do už vložených dnů nepropíše.')} <span class="muted small" style="font-weight:600">${L.length} z ${all.length}</span></h2><button class="xbtn" onclick="UI.closeModal()">×</button></div>
      <div class="row nowrap"><div class="search sp"><input type="text" id="twq" placeholder="hledat podle názvu nebo cviku…" value="${esc(TwPick.q)}"></div><button class="btn sec sm" onclick="A.twEdit(null)">+ nový</button></div>
      <div class="plist">${L.map(w => `<div class="pitem" ${onPick ? `onclick="window._twpick('${w.id}')"` : ''}>
          <div class="sp"><div class="pn">${esc(w.name || 'bez názvu')}${w.global ? '' : ' <span class="pill">moje</span>'}</div>
            <div class="pi">${(w.items || []).length ? esc((w.items || []).map(it => it.ex).join(' · ')) : 'zatím prázdný'}</div></div>
          <div class="pk">${fmt0(workoutKcal(w))} <span>kcal</span><br><span class="muted">${fmt0(workoutMin(w))} min</span></div>
          <button class="xbtn" title="upravit" onclick="event.stopPropagation();A.twEdit('${w.id}')">✎</button></div>`).join('') || '<p class="muted small">Zatím žádný uložený trénink. Sestav den a dej „Uložit jako trénink“, nebo si tu založ nový.</p>'}</div>`;
    const q2 = m.querySelector('#twq');
    q2.oninput = () => { TwPick.q = q2.value; draw(); const n = m.querySelector('#twq'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
  };
  window._twdraw = draw;
  window._twpick = id => { m.remove(); if (onPick) onPick(workoutById(id)); };
  draw();
  return m;
}

/* editor šablony: název, cviky, poznámka */
A.twEdit = (id, seed) => {
  const w = id ? { ...workoutById(id) } : { name: (seed && seed.name) || '', items: (seed && seed.items) || [], note: '' };
  if (id && !w.id) return;
  let items = JSON.parse(JSON.stringify(w.items || []));
  const m = UI.modal('', { guardEdits: true });
  // překreslení nesmí zahodit, co má uživatel rozepsané v polích
  const grab = () => { const n = m.querySelector('#twn'), no = m.querySelector('#twnote'); if (n) w.name = n.value; if (no) w.note = no.value; };
  const draw = () => {
    m.querySelector('.box').innerHTML = `<div class="sh"><h2>${id ? 'Upravit trénink' : 'Nový trénink'}</h2><button class="xbtn" onclick="UI.closeModal()">×</button></div>
      <div class="in"><label class="f">Název</label><input type="text" id="twn" value="${esc(w.name || '')}" placeholder="např. Pondělí – nohy a záda"></div>
      <div class="tbl"><table class="items"><tr><th>Cvik</th><th class="n">série × opak.</th><th class="n">min</th><th class="n m-kcal">kcal</th><th></th></tr>
        ${items.map((it, i) => `<tr><td>${esc(it.ex)}</td><td class="n">${it.type === 'cardio' ? '–' : `${it.sets || 3} × ${it.reps || 12}`}</td><td class="n">${fmt0(itemMinutes(it))}</td><td class="n">${fmt0(itemKcal(it, currentWeight()))}</td>
          <td class="n"><button class="xbtn" onclick="window._twdel(${i})">×</button></td></tr>`).join('') || '<tr><td colspan="5" class="muted small">Zatím prázdné – přidej cvik.</td></tr>'}
        ${items.length ? `<tr><td class="b">celkem</td><td></td><td class="n b">${fmt0(items.reduce((a, it) => a + itemMinutes(it), 0))}</td><td class="n b">${fmt0(items.reduce((a, it) => a + itemKcal(it, currentWeight()), 0))}</td><td></td></tr>` : ''}</table></div>
      <div class="row"><button class="btn sec sm" onclick="window._twadd()">+ přidat cvik</button></div>
      <div class="in"><label class="f">Poznámka (volitelně)</label><input type="text" id="twnote" value="${esc(w.note || '')}" placeholder="např. mezi sériemi 90 s pauza"></div>
      <div class="row"><button class="btn" id="twok">Uložit</button><button class="btn sec" onclick="UI.closeModal()">Zavřít</button>${id ? '<span class="sp"></span><button class="btn danger sm" id="twdel">Smazat</button>' : ''}</div>
      <div class="bad small" id="twerr"></div>`;
    m.querySelector('#twok').onclick = () => {
      const name = m.querySelector('#twn').value.trim();
      if (!name) { m.querySelector('#twerr').textContent = 'Trénink potřebuje název.'; return; }
      if (!items.length) { m.querySelector('#twerr').textContent = 'Přidej aspoň jeden cvik.'; return; }
      const data = { id, name, items, note: m.querySelector('#twnote').value.trim() };
      m.remove();
      Undo.run(id ? 'Trénink upraven' : 'Trénink uložen', () => saveWorkout(data), `${name}: ${items.length} ${items.length === 1 ? 'cvik' : items.length < 5 ? 'cviky' : 'cviků'}, ${fmt0(items.reduce((a, it) => a + itemKcal(it, currentWeight()), 0))} kcal. Vložíš ho do kteréhokoli dne.`);
      if (window._twdraw) window._twdraw();
      render();
    };
    const del = m.querySelector('#twdel');
    if (del) del.onclick = () => UI.confirm(`Smazat uložený trénink ${w.name}? Z dnů, kam jsi ho už vložil, nezmizí.`, () => {
      m.remove(); Undo.run('Trénink smazán', () => Store.remove('training', id)); if (window._twdraw) window._twdraw(); render();
    }, 'Smazat');
  };
  window._twdel = i => { grab(); items.splice(i, 1); m._dirty = true; draw(); };
  window._twadd = () => { grab(); openExPicker(e => {
    if (!e) return;
    items.push(e.type === 'cardio' ? { ex: e.ex, type: 'cardio', min: 20, met: e.met || null }
      : { ex: e.ex, type: 'strength', sets: e.sets || 3, reps: e.reps || (e.timed ? 30 : 12), intensity: e.intensity || 'medium', note: e.note || '' });
    m._dirty = true; draw();
  }); };
  draw();
};

A.twLibrary = () => openWorkoutPicker(null);

/* ===== Cvičení: série, pauzy, zápis skutečnosti =====
   Do dne se ukládá day.training = {
     done:{i:true}, doneAll,
     log:{ i:{ sets:[{reps,kg,at}] } },   co Robert opravdu udělal
     started, finished, rpe, feel, note } */
const REST_DEFAULT = 90;
const FEELS = [['super', '😀', 'skvěle'], ['ok', '🙂', 'dobře'], ['neutral', '😐', 'jde to'], ['weak', '😕', 'slabost'], ['pain', '😣', 'bolelo']];
const RPES = [[1, 'lehké'], [2, 'akorát'], [3, 'zabral jsem'], [4, 'těžké'], [5, 'na hraně']];
const mmss = sec => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
function restSec(it) { return Number(it && it.rest) || Number(S().rest_sec) || REST_DEFAULT; }
function trPlanned(date) { return ((effectiveDay(date).act || {}).items) || []; }
function trState(date) { const d = effectiveDay(date); return (d.training || { done: {} }); }
function trSets(date, i) { return ((trState(date).log || {})[i] || {}).sets || []; }
function trWriteDay(date, fn) {
  const day = getDay(date);
  day.training = day.training || { done: {} };
  day.training.log = day.training.log || {};
  fn(day.training);
  saveDay(day);
}
/* poslední zátěž u cviku – aby ji Robert nemusel psát znovu */
function lastWeightFor(ex) {
  for (let k = 1; k <= 60; k++) {
    const dt = addDays(todayISO(), -k); const st = (getDay(dt).training || {});
    const items = ((effectiveDay(dt).act || {}).items) || [];
    const i = items.findIndex(x => x.ex === ex);
    if (i >= 0 && st.log && st.log[i] && st.log[i].sets) { const last = st.log[i].sets.filter(Boolean).pop(); if (last && last.kg) return last.kg; }
  }
  return '';
}

/* nejlepší výkon u cviku před zadaným dnem – pro rekordy */
function exBest(ex, beforeDate) {
  let maxSet = 0, maxVol = 0;
  for (let k = 1; k <= 180; k++) {
    const dt = addDays(beforeDate, -k);
    const st = getDay(dt).training || {}; if (!st.log) continue;
    const items = ((effectiveDay(dt).act || {}).items) || [];
    items.forEach((it, i) => {
      if (it.ex !== ex) return;
      const sets = ((st.log[i] || {}).sets || []).filter(Boolean);
      if (!sets.length) return;
      maxSet = Math.max(maxSet, ...sets.map(x => x.kg || 0));
      maxVol = Math.max(maxVol, sets.reduce((a, x) => a + (x.reps || 0) * (x.kg || 0), 0));
    });
  }
  return { maxSet, maxVol };
}

let trModal = null, trTimer = null;
App.tr = null;

A.trRun = (i) => {
  const items = trPlanned(App.date);
  if (!items.length) { UI.toast('Na dnešek nemáš žádný trénink.'); return; }
  const best = {}; items.forEach(it => { if (it.type !== 'cardio') best[it.ex] = exBest(it.ex, App.date); });
  App.tr = { i: Math.max(0, Math.min(items.length - 1, i || 0)), rest: null, best, prs: [], extra: null };
  trWriteDay(App.date, t => { if (!t.started) t.started = new Date().toISOString(); });
  trModal = UI.modal('');
  trModal.addEventListener('click', e => { if (e.target === trModal) A.trClose(); });
  trTimer = setInterval(trTick, 250);
  trDraw();
};
A.trQuit = () => { if (trTimer) clearInterval(trTimer); trTimer = null; App.tr = null; if (trModal) trModal.remove(); trModal = null; render(); };
A.trClose = () => {
  const st = trState(App.date); const any = Object.keys(st.log || {}).length || Object.keys(st.done || {}).length;
  if (!any) { A.trQuit(); return; }
  UI.confirm('Chceš trénink ukončit a zapsat, jak to šlo? Když si jen odskakuješ, dej Zpět a pokračuj později.', () => A.trFinish(), 'Ukončit a zapsat');
};

function trTick() {
  if (!trModal || !App.tr || !App.tr.rest) return;
  const left = Math.max(0, Math.ceil((App.tr.rest.end - Date.now()) / 1000));
  const el = trModal.querySelector('#trcd'); if (el) el.textContent = mmss(left);
  const bar = trModal.querySelector('#trbar'); if (bar) bar.style.width = clamp(100 - left / App.tr.rest.len * 100, 0, 100) + '%';
  if (left <= 0) { App.tr.rest = null; buzz(80); trDraw(); }
}
A.trRestPlus = n => { if (App.tr && App.tr.rest) { App.tr.rest.end += n * 1000; App.tr.rest.len += n; trTick(); } };
A.trRestEnd = () => { if (App.tr) { App.tr.rest = null; trDraw(); } };

/* jedna série hotová: zapsat opakování a zátěž, spustit pauzu */
A.trSetDone = (i, si) => {
  const reps = trModal.querySelector('#trreps') ? trModal.querySelector('#trreps').value : '';
  const kg = trModal.querySelector('#trkg') ? trModal.querySelector('#trkg').value : '';
  trWriteDay(App.date, t => { const e = t.log[i] = t.log[i] || { sets: [] }; e.sets[si] = { reps: Number(reps) || 0, kg: Number(kg) || 0, at: new Date().toISOString() }; });
  buzz(30);
  const items = trPlanned(App.date); const it = items[i];
  const planned = Number(it.sets) || 1;
  const sets = trSets(App.date, i).filter(Boolean);
  const doneN = sets.length;
  trCheckRecord(i, it, sets);
  const wasExtra = App.tr.extra === i;
  App.tr.extra = null;
  if (doneN >= planned && !wasExtra) { trWriteDay(App.date, t => { t.done[i] = true; }); App.tr.rest = null; trNext(); return; }
  const len = restSec(it); App.tr.rest = { end: Date.now() + len * 1000, len }; trDraw();
};
/* malá pochvala za každý rekord – těžší série, nebo víc nazvedáno než kdy dřív */
function trCheckRecord(i, it, sets) {
  if (it.type === 'cardio' || !App.tr) return;
  const b = App.tr.best[it.ex] || { maxSet: 0, maxVol: 0 };
  const last = sets[sets.length - 1] || {};
  const vol = sets.reduce((a, x) => a + (x.reps || 0) * (x.kg || 0), 0);
  const hit = [];
  if (last.kg && last.kg > b.maxSet) { hit.push(`nejtěžší série: ${fmt1(last.kg)} kg`); b.maxSet = last.kg; }
  if (vol && vol > b.maxVol) { hit.push(`nejvíc nazvedáno: ${fmt0(vol)} kg`); b.maxVol = vol; }
  App.tr.best[it.ex] = b;
  if (!hit.length) return;
  App.tr.prs = App.tr.prs.filter(x => x.ex !== it.ex).concat([{ ex: it.ex, what: hit }]);
  buzz([40, 60, 40]);
  UI.toast(`🔥 Rekord u ${it.ex} – ${hit.join(' a ')}.`);
}
A.trAddSet = i => { App.tr.extra = i; App.tr.rest = null; trDraw(); };
A.trCardioDone = i => { trWriteDay(App.date, t => { t.done[i] = true; }); buzz(30); trNext(); };
function trNext() {
  const items = trPlanned(App.date); const st = trState(App.date);
  const next = items.findIndex((_, k) => !st.done[k]);
  if (next < 0) { A.trFinish(); return; }
  App.tr.i = next; trDraw();
}
A.trGo = i => { App.tr.i = i; App.tr.rest = null; trDraw(); };

function trDraw() {
  if (!trModal || !App.tr) return;
  const items = trPlanned(App.date); const st = trState(App.date); const i = App.tr.i; const it = items[i];
  const doneCount = items.filter((_, k) => st.done[k]).length;
  const head = `<div class="sh"><h2>🏋️ Trénink${help('Odcvič sérii, zapiš opakování a zátěž a ťukni na hotovo – rozeběhne se pauza. Pauzu můžeš prodloužit tlačítkem +30 s, nebo ji ukončit dřív. Až budeš hotový (nebo budeš chtít skončit), dej Ukončit trénink a zapiš, jak to šlo.')} <span class="muted small" style="font-weight:600">${doneCount} z ${items.length} hotovo</span></h2><button class="xbtn" onclick="A.trClose()">×</button></div>`;
  if (App.tr.rest) {
    trModal.querySelector('.box').innerHTML = `${head}
      <div class="trrest"><div class="trlab">PAUZA</div><div class="trcd" id="trcd">${mmss(Math.ceil((App.tr.rest.end - Date.now()) / 1000))}</div>
        <div class="bar"><i id="trbar" style="width:0%"></i></div>
        <div class="row center"><button class="btn sec" onclick="A.trRestPlus(30)">+30 s</button><button class="btn" onclick="A.trRestEnd()">Jsem připravený</button></div>
        <p class="small muted">Další: ${esc(it.ex)} · série ${trSets(App.date, i).filter(Boolean).length + 1} z ${it.sets || 1}</p></div>
      <div class="row"><button class="btn sec sm" onclick="A.trFinish()">Ukončit trénink</button></div>`;
    return;
  }
  const sets = trSets(App.date, i); const planned = Number(it.sets) || 1;
  const si = sets.filter(Boolean).length;
  const isCardio = it.type === 'cardio';
  const lastKg = (sets.filter(Boolean).slice(-1)[0] || {}).kg || lastWeightFor(it.ex) || '';
  const list = items.map((x, k) => `<button class="chip ${k === i ? 'on' : ''} ${st.done[k] ? 'okc' : ''}" onclick="A.trGo(${k})">${st.done[k] ? '✓ ' : ''}${esc(x.ex)}</button>`).join('');
  trModal.querySelector('.box').innerHTML = `${head}
    <div class="chips">${list}</div>
    <p class="tiny muted">Pořadí je na tobě – ťukni na cvik, kterým chceš začít.</p>
    <div class="trex"><div class="tt">${esc(it.ex)}</div>${it.note ? `<div class="small muted">${esc(it.note)}</div>` : ''}
      <div class="small muted">${isCardio ? `plán ${it.min} min` : `plán ${planned} × ${it.reps || 12}${it.weight ? ` · ${it.weight} kg` : ''} · pauza ${restSec(it)} s`}</div></div>
    ${sets.filter(Boolean).length ? `<div class="tbl"><table class="items"><tr><th>Série</th><th class="n">opak.</th><th class="n">kg</th></tr>
      ${sets.map((x, k) => x ? `<tr><td>${k + 1}.</td><td class="n">${x.reps}</td><td class="n">${x.kg || '–'}</td></tr>` : '').join('')}</table></div>` : ''}
    ${(() => {
      if (isCardio) return st.done[i] ? `<div class="alert a3">Hotovo.</div>`
        : `<div class="row"><button class="btn" onclick="A.trCardioDone(${i})">✓ Odcvičeno (${it.min} min)</button></div>`;
      const extra = App.tr.extra === i;
      const input = `<div class="grid g2">
          <div class="in"><label class="f">${extra || si >= planned ? `Série navíc (${si + 1}.)` : `Série ${si + 1} z ${planned}`} – opakování</label>
            ${stepper('trreps', it.reps || 12, 1, 0)}</div>
          <div class="in"><label class="f">Zátěž (kg)</label>${stepper('trkg', lastKg || 0, 2.5, 0)}</div></div>
        <div class="row"><button class="btn" onclick="A.trSetDone(${i},${si})">✓ Série hotová</button>${extra ? `<button class="btn sec sm" onclick="App.tr.extra=null;trDraw()">Zpět</button>` : ''}</div>
        <p class="tiny muted">Zapiš, kolik jsi jich opravdu udělal – i když je to míň, než je v plánu. Trenér potřebuje vidět skutečnost, ne plán.</p>`;
      if (!st.done[i] || extra) return input;
      return `<div class="alert a3">Hotovo, ${planned} ${planned === 1 ? 'série' : planned < 5 ? 'série' : 'sérií'} zapsaných. ${items.some((_, k) => !st.done[k]) ? 'Vyber další cvik nahoře, nebo ukonči trénink.' : 'Tohle byl poslední cvik.'}</div>
        <div class="row"><button class="btn sec sm" onclick="A.trAddSet(${i})">+ ještě jedna série</button></div>`;
    })()}
    <div class="row"><button class="btn sec sm" onclick="A.trFinish()">Ukončit trénink</button></div>`;
}

/* souhrn po tréninku + jak to šlo */
A.trFinish = () => {
  const date = App.date; const items = trPlanned(date); const st = trState(date);
  const doneN = items.filter((_, k) => st.done[k]).length;
  const setsPlan = items.reduce((a, it) => a + (it.type === 'cardio' ? 1 : (Number(it.sets) || 1)), 0);
  const setsDone = items.reduce((a, it, k) => a + (it.type === 'cardio' ? (st.done[k] ? 1 : 0) : trSets(date, k).filter(Boolean).length), 0);
  const volume = items.reduce((a, it, k) => a + trSets(date, k).filter(Boolean).reduce((b, x) => b + (x.reps || 0) * (x.kg || 0), 0), 0);
  const kcal = items.reduce((a, it, k) => a + (st.done[k] ? itemKcal(it, currentWeight()) : 0), 0);
  const mins = st.started ? Math.max(1, Math.round((Date.now() - new Date(st.started).getTime()) / 60000)) : 0;
  // rozdělané cviky se do kalorií dne nepočítají – cvik se počítá až celý
  const pending = items.reduce((a, it, k) => {
    if (st.done[k] || it.type === 'cardio') return a;
    const doneS = trSets(date, k).filter(Boolean).length;
    return doneS > 0 ? a + itemKcal(it, currentWeight()) : a;
  }, 0);
  const pendingN = items.filter((it, k) => !st.done[k] && it.type !== 'cardio' && trSets(date, k).filter(Boolean).length > 0).length;
  const share = setsPlan ? setsDone / setsPlan : 0;
  const prs = (App.tr && App.tr.prs) || [];
  const allDone = items.length > 0 && items.every((_, k) => st.done[k]);
  const praise = allDone ? ['🏆', 'Celý trénink hotový, od první série po poslední.', 'Tohle je ta věc, která rozhoduje. Ne jeden těžký trénink, ale to, že jsi ho dotáhl celý – a příště zase.']
    : share >= 1 ? ['💪', 'Celý trénink hotový.', 'Přesně takhle se to staví. Tělo si to pamatuje, i když se to na váze ukáže až za týden.']
    : share >= 0.7 ? ['👊', 'Většinu jsi dal.', 'To se počítá. Příště zkus dotáhnout i zbytek – rozdíl mezi 70 a 100 % dělá za měsíc hodně.']
    : share > 0 ? ['🙂', 'Něco je vždycky líp než nic.', 'Nedokončený trénink není prohra. Příště zkus dotáhnout aspoň o sérii víc.']
    : ['🛋️', 'Dnes to nevyšlo.', 'Stane se. Hlavně ať z toho není zvyk – příští trénink dej celý.'];
  if (trTimer) clearInterval(trTimer); trTimer = null; App.tr = null;
  const prHtml = prs.length ? `<div class="praise good"><span class="em">🔥</span><div><div><b>${prs.length === 1 ? 'Rekord' : `${prs.length} rekordy`}!</b></div>${prs.map(x => `<div class="small">${esc(x.ex)} – ${esc(x.what.join(', '))}</div>`).join('')}</div></div>` : '';
  if (trModal) { trModal.remove(); trModal = null; }
  const m = UI.modal(`<div class="sh"><h2>Trénink hotový</h2><button class="xbtn" onclick="UI.closeModal()">×</button></div>
    <div class="praise good"><span class="em">${praise[0]}</span><div><div>${praise[1]}</div><div class="small muted">${praise[2]}</div></div></div>
    ${prHtml}
    <div class="stats3"><div><b>${doneN} <small>/ ${items.length}</small></b><span>cviků</span></div>
      <div><b>${setsDone} <small>/ ${setsPlan}</small></b><span>sérií</span></div>
      <div><b class="m-kcal">${fmt0(kcal)}</b><span>kcal navíc${mins ? ` · ${mins} min` : ''}</span></div></div>
    ${volume ? `<p class="small muted">Zvedl jsi dohromady <b>${fmt0(volume)} kg</b> (opakování × zátěž).</p>` : ''}
    ${pendingN ? `<div class="alert a2">${pendingN === 1 ? 'Jeden cvik máš rozdělaný' : `${pendingN} cviky máš rozdělané`} – do kalorií dne se počítá až celý cvik, takže ti tam ${fmt0(pending)} kcal zatím chybí. Dotáhni série a připíšou se samy.</div>` : ''}
    <div class="in"><label class="f">Jak těžké to bylo?</label><div class="chips" id="trrpe">${RPES.map(([v, l]) => `<button class="chip" data-v="${v}">${v} · ${l}</button>`).join('')}</div></div>
    <div class="in"><label class="f">Jak se cítíš?</label><div class="chips" id="trfeel">${FEELS.map(([v, em, l]) => `<button class="chip" data-v="${v}">${em} ${l}</button>`).join('')}</div></div>
    <div class="row"><button class="btn" id="trsave">Uložit a zavřít</button></div>`);
  let rpe = null, feel = null;
  const pick = (box, set) => m.querySelectorAll(`#${box} .chip`).forEach(b => b.onclick = () => {
    m.querySelectorAll(`#${box} .chip`).forEach(x => x.classList.remove('on')); b.classList.add('on'); set(b.dataset.v);
  });
  pick('trrpe', v => rpe = Number(v)); pick('trfeel', v => feel = v);
  m.querySelector('#trsave').onclick = () => {
    m.remove();
    Undo.run('Trénink zapsaný', () => trWriteDay(date, t => {
      t.finished = new Date().toISOString(); t.rpe = rpe; t.feel = feel;
      if (prs.length) t.prs = prs;
      t.doneAll = items.length > 0 && items.every((_, k) => t.done[k]);
    }), `${doneN} z ${items.length} cviků, ${setsDone} sérií, ${fmt0(kcal)} kcal.`);
    render();
  };
};

/* co Robert opravdu odcvičil – vidí i trenér */
function trRealLine(date, i) {
  const sets = trSets(date, i).filter(Boolean);
  if (!sets.length) return '';
  const w = sets.some(x => x.kg) ? sets.map(x => `${x.reps}×${x.kg || 0} kg`).join(', ') : sets.map(x => `${x.reps}`).join(', ');
  return `<div class="tiny ok">skutečnost: ${sets.length} ${sets.length === 1 ? 'série' : sets.length < 5 ? 'série' : 'sérií'} · ${esc(w)}</div>`;
}
function trSummaryLine(date) {
  const st = trState(date); if (!st.finished) return '';
  const items = trPlanned(date); const doneN = items.filter((_, k) => st.done[k]).length;
  const r = RPES.find(x => x[0] === st.rpe); const f = FEELS.find(x => x[0] === st.feel);
  return `<div class="notice"><b>Trénink zapsaný:</b> ${doneN} z ${items.length} cviků${r ? ` · náročnost ${r[0]} (${r[1]})` : ''}${f ? ` · ${f[1]} ${f[2]}` : ''}</div>`;
}
