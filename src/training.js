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
function planActFor(date, weight) { const ap = dayActivityPlan(date); return { planWalk: ap.walk_min != null ? Number(ap.walk_min) : S().walk_min, planKcal: sessionKcal(ap.items || [], weight), items: ap.items || [] }; }
function weekActs(monday, weight) { return Array.from({ length: 7 }, (_, i) => planActFor(addDays(monday, i), weight)); }
/* act pro calcBase z plánu + splnění zapsaného ve dni */
function dayAct(date, day, weight) {
  const ap = dayActivityPlan(date); const items = ap.items || [];
  const done = (day && day.training && day.training.done) || {};
  const planKcal = sessionKcal(items, weight);
  const doneKcal = items.reduce((a, it, i) => a + (done[i] ? itemKcal(it, weight) : 0), 0);
  const doneAll = items.length > 0 && items.every((_, i) => done[i]);
  return { planWalk: ap.walk_min != null ? Number(ap.walk_min) : S().walk_min, planKcal, doneKcal, planItems: items.length, doneAll, items, source: ap.source, note: ap.note, walk_kmh: ap.walk_kmh };
}

/* ===== Hlídání tempa (trenér) ===== */
function paceGuard() {
  const s = S(), ov = calcOverview(s, Meas()), out = [];
  const w = ov.cur; const bmr = 10 * w + 6.25 * s.height - 5 * s.age + 5;
  if (ov.weekBack && ov.weekBack.lostW != null && ov.weekBack.planW && ov.weekBack.lostW > ov.weekBack.planW * 1.3) out.push({ lv: 1, text: `📉 Hubne rychleji než plán: −${fmt2(ov.weekBack.lostW)} kg za týden (cíl ${fmt2(ov.weekBack.planW)}). Buď sníž tempo v Nastavení, nebo ať Robert dojí limit.` });
  if (s.rate_pct > 1) out.push({ lv: 1, text: `⚠️ Tempo ${String(s.rate_pct).replace('.', ',')} % váhy/týden je nad doporučeným maximem 1 %.` });
  // příjem pod limitem 3 dny v řadě
  const uid = Store.ownerId(); const recs = Object.fromEntries(Store.rows('days', uid).map(r => [r.data.date, r.data]));
  let under = 0, bmrDays = 0; for (let k = 1; k <= 3; k++) { const dt = addDays(todayISO(), -k); const d = recs[dt]; if (!d) break; const ev = evaluateDay(dt); if (ev.d.tot.kcal > 0 && ev.d.intake < ev.d.base.maxIntake - 300) under++; if (ev.d.base.belowBmr) bmrDays++; }
  if (under >= 3) out.push({ lv: 1, text: '🍽️ Tři dny v řadě jedl o 300+ kcal míň, než smí. Deficit je větší než cílový – řekni mu, ať dojídá přílohy, nebo přidej porce.' });
  if (bmrDays >= 2) out.push({ lv: 2, text: `🛡️ ${bmrDays} z posledních 3 dnů držela limit spodní hranice (klidový výdej ${fmt0(bmr)} kcal) – málo cíleného pohybu, deficit proto vyšel menší. Zvaž lehčí plán nebo víc chůze.` });
  return out;
}
/* věta pro Roberta, když je deficit moc velký */
function paceMessageForClient() { const s = S(), ov = calcOverview(s, Meas()); if (ov.weekBack && ov.weekBack.lostW != null && ov.weekBack.planW && ov.weekBack.lostW > ov.weekBack.planW * 1.3) return `Hubneš rychleji, než je zdravé (−${fmt2(ov.weekBack.lostW)} kg za týden). Dojídej přílohy do limitu – deficit je už teď větší, než má být.`; return null; }

/* ===== Obrazovka trenéra: Trénink (záložka v Plánu) =====
   Dřív začínala osmi čísly, která s tréninkem nesouvisela (váha, klidový výdej, fáze…),
   a pod editorem dne bylo sedm tlačítek ve dvou řadách. Teď: plány, sedm dní,
   editor vybraného dne a jedna věta, co týden udělá s tempem. */
App.tpId = null; App.tpDay = 0;
VIEWS.trenink = function () {
  const s = S(), plans = trainingPlans(), w = currentWeight(), ov = calcOverview(s, Meas());
  const pl = plans.find(p => p.id === App.tpId) || plans[plans.length - 1];
  if (pl) App.tpId = pl.id;
  if (!plans.length) return `<div class="card empty"><span class="em">🏋️</span><b>Zatím žádný tréninkový plán</b><span>Robert jede na výchozích ${s.walk_min} min chůze. Pro ${fmt0(w)} kg doporučený začátek: 3× týdně 20 minut cviků s vlastní vahou (dřep na židli, klik o stůl, přítah na stole, most) po 2–3 sériích, mezi tím chůze.</span><button class="btn" onclick="A.tpNew()">Založit plán</button></div>`;
  const lastWeekAct = (() => { const mon = mondayOf(todayISO()); let k = 0; for (let i = 0; i < 7; i++) { const dt = addDays(mon, -7 + i); const d = getDay(dt); const a = dayAct(dt, d, w); k += (d.walk_min || 0) * calcBase(s, w, 0, 0, s.walk_kmh, 0, 0).walkPerMin + a.doneKcal; } return k; })();
  const dayStats = pl.days.map((d, i) => { const act = { planWalk: Number(d.walk_min) || 0, planKcal: sessionKcal(d.items, w) }; const b = calcBase(s, w, act.planWalk, 0, d.walk_kmh || s.walk_kmh, 0, 0, act); return { i, d, act, b, walkKcal: act.planWalk * b.walkPerMin, warn: b.planBelowBmr }; });
  const weekAct = dayStats.reduce((a, x) => a + x.walkKcal + x.act.planKcal, 0);
  const weekDef = dayStats.reduce((a, x) => a + (x.b.minOut - x.b.planLimit), 0);
  const warns = [];
  dayStats.filter(x => x.warn).forEach(x => warns.push(`${DAY_NAMES[x.i]}: limit by vyšel pod klidový výdej – deficit dne je o ${fmt0(x.b.bmr - (x.b.minOut - x.b.deficit))} kcal nižší. Přidej chůzi.`));
  if (weekDef / KG_KCAL < w * s.rate_pct / 100 * 0.97) warns.push(`Plán dává −${fmt2(weekDef / KG_KCAL)} kg/týden, cíl je −${fmt2(w * s.rate_pct / 100)}. Přidej chůzi ve dnech s ⚠️.`);
  if (lastWeekAct > 0 && weekAct > lastWeekAct * 1.2) warns.push(`Aktivita ${fmt0(weekAct)} kcal/týden je o ${Math.round((weekAct / lastWeekAct - 1) * 100)} % víc, než Robert zvládl minulý týden (${fmt0(lastWeekAct)}). Doporučené navýšení je do 20 %.`);
  if (ov.cur > 124 && pl.days.some(d => d.items.some(it => /Běh|Švihadlo|Angličák/.test(it.ex)))) warns.push('Nad 124 kg sešit nedoporučuje běh ani skoky. Nahraď chůzí do kopce nebo kolem.');
  const ed = pl.days[App.tpDay]; const es = dayStats[App.tpDay];
  const base0 = calcBase(s, w, s.walk_min, 0, s.walk_kmh, 0, 0); const foodDelta = es.b.planLimit - base0.planLimit;
  const dateOf = addDays(mondayOf(todayISO()), App.tpDay); const wkR = getWeek(mondayOf(dateOf));
  const rPlan = wkR.plan[App.tpDay].some(Boolean) ? calcPlanDay(s, Foods(), Recipes(), wkR.plan[App.tpDay], w, { planWalk: es.act.planWalk, planKcal: es.act.planKcal }) : null;
  const fit = rPlan ? (Math.abs(rPlan.planLimit - rPlan.kcal) <= 100 ? 'Robertův plán jídel sedí' : (rPlan.planLimit > rPlan.kcal ? `Robert musí přidat ${fmt0(rPlan.planLimit - rPlan.kcal)} kcal – uvidí „Dorovnat“` : `Robert musí ubrat ${fmt0(rPlan.kcal - rPlan.planLimit)} kcal – uvidí „Dorovnat“`)) : 'Robert na ten den nemá naplánovaná jídla';
  return `<div class="chips scroll">${plans.map(p => `<button class="chip ${p.id === pl.id ? 'on' : ''}" onclick="App.tpId='${p.id}';render()">${esc(p.name)}${p.active_from ? ` · od ${czDateShort(p.active_from)}` : ''}</button>`).join('')}<button class="chip" onclick="A.tpNew()">+ Nový plán</button></div>
  <div class="card stack s8"><div class="row between nowrap"><div style="min-width:0"><b>${esc(pl.name)}</b><div class="small muted">${pl.active_from ? `Robert ho vidí od ${czDate(pl.active_from)}.` : 'Zatím nepřiřazený – Robert vidí výchozí chůzi.'}</div></div><button class="iconbtn" onclick="A.tpMenu()" aria-label="plán">⋯</button></div>
    <div class="grid g2"><div class="field"><label class="f">Název</label><input type="text" value="${esc(pl.name)}" onchange="A.tpField('name',this.value)"></div><div class="field"><label class="f">Platí od</label><input type="date" value="${pl.active_from || ''}" onchange="A.tpField('active_from',this.value||null)"></div></div></div>
  <div class="wdays7">${dayStats.map(x => `<button class="${App.tpDay === x.i ? 'on' : ''} ${x.warn ? 'warn' : ''}" onclick="App.tpDay=${x.i};render()">${DAY_SHORT[x.i]}${x.warn ? '⚠️' : ''}<span>${x.d.items.length ? '🏋️ ' + x.d.items.length : '🚶 ' + x.act.planWalk}</span></button>`).join('')}</div>
  <div class="card stack">
    <div class="row between nowrap"><h2>${DAY_NAMES[App.tpDay]}</h2><button class="iconbtn" onclick="A.tpDayMenu()" aria-label="den">⋯</button></div>
    <div class="stats3"><div><b>${fmt0(es.b.planLimit)}</b><span>limit podle plánu</span></div><div><b class="${foodDelta > 0 ? 'ok' : foodDelta < 0 ? 'bad' : ''}">${foodDelta ? signed0(foodDelta) : '±0'}</b><span>proti dni bez tréninku</span></div><div><b>${fmt0(es.b.minOut - es.b.planLimit)}</b><span>deficit dne${es.b.planBelowBmr ? ' · snížený' : ''}</span></div></div>
    <div class="small ${rPlan && Math.abs(rPlan.planLimit - rPlan.kcal) > 100 ? 'warn' : 'muted'}">${fit} (${czDateShort(dateOf)}).</div>
    <div class="grid g2"><div class="field"><label class="f">Chůze (minut)</label><input type="text" inputmode="decimal" value="${ed.walk_min ?? ''}" onchange="A.tpDayField('walk_min',this.value)"></div><div class="field"><label class="f">Tempo</label><select onchange="A.tpDayField('walk_kmh',this.value)">${SEED.met.map(([k]) => `<option value="${k}" ${Number(ed.walk_kmh || s.walk_kmh) === k ? 'selected' : ''}>${fmt1(k)} km/h</option>`).join('')}</select></div></div>
    <div>${ed.items.map((it, j) => { const isC = it.type === 'cardio'; const sg = progressSuggestion(it);
      return `<div class="exrow"><div class="exn">${esc(it.ex)}<span>${isC ? `kardio · MET ${itemMet(it)}` : `${fmt0(itemMinutes(it))} min`} · ~${fmt0(itemKcal(it, w))} kcal${it.note ? ' · ' + esc(it.note) : ''}</span>${sg ? `<span class="${sg.apply ? 'ok' : ''}">${esc(sg.text)}${sg.apply ? ` <button class="btn ghost sm" style="min-height:24px;padding:0 4px" onclick="A.tpApplyProgress(${j})">použít</button>` : ''}</span>` : ''}</div><button class="xbtn sm" onclick="A.tpItemDel(${j})" aria-label="odebrat">×</button>
        <div class="exf">${isC ? `<div class="in wide"><label class="f">Minut</label><input type="text" inputmode="decimal" value="${it.min || ''}" onchange="A.tpItem(${j},'min',this.value)"></div>`
          : `<div class="in"><label class="f">Série</label><input type="text" inputmode="decimal" value="${it.sets}" onchange="A.tpItem(${j},'sets',this.value)"></div><div class="in"><label class="f">${EX_LIB.find(e => e.ex === it.ex && e.timed) ? 'Sekund' : 'Opak.'}</label><input type="text" inputmode="decimal" value="${it.reps}" onchange="A.tpItem(${j},'reps',this.value)"></div><div class="in"><label class="f">kg</label><input type="text" inputmode="decimal" value="${it.weight || ''}" placeholder="–" onchange="A.tpItem(${j},'weight',this.value)"></div><div class="in"><label class="f">Pauza s</label><input type="text" inputmode="decimal" value="${it.rest || ''}" placeholder="${S().rest_sec || REST_DEFAULT}" onchange="A.tpItem(${j},'rest',this.value)"></div><div class="in wide"><label class="f">Intenzita</label><select onchange="A.tpItem(${j},'intensity',this.value)">${Object.entries(INTENSITY_LABEL).map(([k, l]) => `<option value="${k}" ${(it.intensity || 'medium') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`}</div></div>`; }).join('') || '<p class="small muted">Bez cviků – jen chůze.</p>'}</div>
    <div class="row"><button class="btn sec sm" onclick="A.tpPickEx()">+ přidat cvik</button><button class="btn ghost sm" onclick="A.twInsertPlanDay()">📂 vložit uložený</button></div>
    <div class="field"><label class="f">Poznámka pro Roberta k tomuto dni</label><input type="text" id="tpnote" value="${esc(ed.note || '')}" placeholder="volitelně" onchange="A.tpDayField('note',this.value)"></div>
  </div>
  <div class="card stack s8"><div class="row between"><h2>Týden celkem</h2><span class="pill ${weekDef / KG_KCAL >= w * s.rate_pct / 100 * 0.97 ? 'ok' : 'warn'}">−${fmt2(weekDef / KG_KCAL)} kg/týden</span></div>
    <div class="small muted">${fmt0(weekAct)} kcal z aktivity · ${pl.days.filter(d => d.items.length).length}× trénink · cíl −${fmt2(w * s.rate_pct / 100)} kg · minulý týden reálně ${fmt0(lastWeekAct)} kcal</div>
    ${warns.map(t => `<div class="alert a2"><div>${esc(t)}</div></div>`).join('') || '<div class="alert a3"><div>Plán je v mezích: limit nad klidovým výdejem, tempo drží cíl, navýšení aktivity pod 20 %.</div></div>'}</div>`;
};
A.tpMenu = () => UI.menu('Plán', [['📋 Kopírovat plán', 'A.tpCopy()', 'jako základ nového'], ['💾 Uložené tréninky', 'A.twLibrary()', 'šablony pro vkládání do dnů'], ['🏋️ Knihovna cviků', 'A.exLibrary()', 'upravit nebo přidat cvik'], ['🗑️ Smazat plán', 'A.tpDelete()', 'Robert se vrátí k výchozí chůzi']]);
A.tpDayMenu = () => UI.menu(DAY_NAMES[App.tpDay], [['📂 Vložit uložený trénink', 'A.twInsertPlanDay()', ''], ['💾 Uložit den jako trénink', 'A.twSaveDay()', 'pod jménem do šablon'], ['📑 Zkopírovat den na…', 'A.tpCopyDay()', 'další dny v týdnu'], ['🧹 Vyprázdnit den', 'A.tpClearDay()', 'jen chůze']]);
A.tpNew = () => { const pl = newPlan('Plán ' + (trainingPlans().length + 1)); Undo.run('Nový plán založen', () => saveTrainingPlan(pl)); App.tpId = pl.id; render(); };
A.tpCopy = () => { const src = trainingPlans().find(p => p.id === App.tpId); const pl = { ...JSON.parse(JSON.stringify(src)), id: oid('tp', Date.now()), name: src.name + ' (kopie)', active_from: null, created: new Date().toISOString() }; Undo.run('Plán zkopírován', () => saveTrainingPlan(pl)); App.tpId = pl.id; render(); };
A.tpField = (f, v) => { const pl = trainingPlans().find(p => p.id === App.tpId); pl[f] = v; Undo.run(f === 'active_from' ? (v ? `Plán platí od ${czDate(v)}` : 'Plán odpojen') : 'Plán uložen', () => saveTrainingPlan(pl), f === 'active_from' && v ? 'Robertovi se přepočítal limit i recepty.' : ''); render(); };
A.tpDayField = (f, v) => { const pl = trainingPlans().find(p => p.id === App.tpId); pl.days[App.tpDay][f] = f === 'note' ? v : (v === '' ? null : Number(v)); Undo.run('Den upraven', () => saveTrainingPlan(pl)); render(); };
A.tpPickEx = () => openExPicker(e => { if (e) A.tpItemAdd(e.slug); });
A.tpItemAdd = (key) => {
  const e = key ? (exBySlug(key) || Exercises().find(x => x.ex === key)) : null;
  if (!e) { UI.toast('Vyber cvik z knihovny.'); return; }
  const it = e.type === 'cardio' ? { ex: e.ex, type: 'cardio', min: 20, met: e.met || null }
    : { ex: e.ex, type: 'strength', sets: e.sets || 3, reps: e.reps || (e.timed ? 30 : 12), intensity: e.intensity || 'medium', note: e.note || '' };
  const pl = trainingPlans().find(p => p.id === App.tpId); pl.days[App.tpDay].items.push(it); Undo.run(`Přidáno: ${e.ex}`, () => saveTrainingPlan(pl)); render(); };
A.tpItem = (j, f, v) => { const pl = trainingPlans().find(p => p.id === App.tpId); const it = pl.days[App.tpDay].items[j]; it[f] = f === 'intensity' ? v : (v === '' ? null : Number(v)); Undo.run('Cvik upraven', () => saveTrainingPlan(pl)); render(); };
A.tpItemDel = j => { const pl = trainingPlans().find(p => p.id === App.tpId); const it = pl.days[App.tpDay].items[j]; pl.days[App.tpDay].items.splice(j, 1); Undo.run(`Odebráno: ${it.ex}`, () => saveTrainingPlan(pl)); render(); };
A.tpClearDay = () => { const pl = trainingPlans().find(p => p.id === App.tpId); pl.days[App.tpDay] = emptyDay(); Undo.run('Den vyprázdněn', () => saveTrainingPlan(pl)); render(); };
A.tpCopyDay = () => { const m = UI.sheet(`Zkopírovat ${DAY_NAMES[App.tpDay].toLowerCase()} na…`, 'cviky, chůzi i poznámku', `<div class="chips">${DAY_NAMES.map((n, i) => i === App.tpDay ? '' : `<label class="chip"><input type="checkbox" value="${i}" style="width:18px;height:18px">${n}</label>`).join('')}</div>`, `<button class="btn" id="cpok">Zkopírovat</button>`);
  m.querySelector('#cpok').onclick = () => { const pl = trainingPlans().find(p => p.id === App.tpId); const src = JSON.stringify(pl.days[App.tpDay]); [...m.querySelectorAll('input:checked')].forEach(i => { pl.days[+i.value] = JSON.parse(src); }); m.remove(); Undo.run('Den zkopírován', () => saveTrainingPlan(pl)); render(); }; };
A.tpDelete = () => UI.confirm('Smazat tento plán? Robert se vrátí k výchozí chůzi.', () => { Undo.run('Plán smazán', () => Store.remove('training', App.tpId)); App.tpId = null; render(); }, 'Smazat plán');
/* jednorázová změna dne (trenér z Robertova Dnes) */
A.tpOverride = date => { const cur = trainingOverride(date) || { ...dayActivityPlan(date) }; delete cur.source; delete cur.planName;
  const m = UI.sheet(`Jednorázová změna · ${czDateShort(date)}`, 'platí jen pro tento den, šablona zůstává', `<div class="grid g2"><div class="field"><label class="f">Chůze (min)</label><input type="text" inputmode="decimal" id="ovw" value="${cur.walk_min ?? ''}"></div><div class="field"><label class="f">Poznámka pro Roberta</label><input type="text" id="ovn" value="${esc(cur.note || '')}"></div></div>
    <p class="small muted">Cviky: <span id="ovitems">${cur.items && cur.items.length ? cur.items.map(itemLabel).join(' · ') : 'žádné'}</span></p><div class="row"><button class="btn sec sm" id="ovclr">bez cviků</button><button class="btn sec sm" id="ovtw">📂 Vložit uložený trénink</button></div>`,
    `<button class="btn" id="ovok">Uložit změnu</button>${trainingOverride(date) ? '<button class="btn danger" id="ovdel">Zrušit výjimku</button>' : ''}`);
  let items = cur.items || [];
  const showItems = () => { m.querySelector('#ovitems').textContent = items.length ? items.map(itemLabel).join(' · ') : 'žádné'; };
  m.querySelector('#ovclr').onclick = () => { items = []; showItems(); m.querySelector('#ovclr').textContent = '✓ bez cviků'; };
  m.querySelector('#ovtw').onclick = () => openWorkoutPicker(w => { if (!w) return; items = JSON.parse(JSON.stringify(w.items || [])); showItems(); UI.toast(`Vloženo: ${w.name}. Ulož změnu, ať to platí.`); });
  m.querySelector('#ovok').onclick = () => { const data = { walk_min: Number(m.querySelector('#ovw').value) || 0, walk_kmh: cur.walk_kmh, items, note: m.querySelector('#ovn').value }; m.remove(); Undo.run('Výjimka uložena', () => Store.put('training', oid('to', date), data)); render(); };
  const del = m.querySelector('#ovdel'); if (del) del.onclick = () => UI.confirm('Zrušit výjimku a vrátit se k plánu?', () => { m.remove(); Undo.run('Výjimka zrušena', () => Store.remove('training', oid('to', date))); render(); }, 'Zrušit výjimku');
}

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
  const body = items.length ? `${act.note ? `<div class="notice">${esc(act.note)}</div>` : ''}
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
function help(text) { return `<button class="ibtn" type="button" onclick="event.stopPropagation();UI.pop(this,${JSON.stringify(text).replace(/"/g, '&quot;')})" title="nápověda">i</button>`; }
UI.pop = (el, text) => { document.querySelectorAll('.popx').forEach(p => p.remove()); const p = document.createElement('div'); p.className = 'popx'; p.innerHTML = `<div>${esc(text)}</div>`; document.body.appendChild(p); const r = el.getBoundingClientRect(); const w = Math.min(340, window.innerWidth - 24); p.style.width = w + 'px'; p.style.left = Math.max(12, Math.min(r.left, window.innerWidth - w - 12)) + 'px'; p.style.top = (r.bottom + 8 + window.scrollY) + 'px'; const close = e => { if (!p.contains(e.target)) { p.remove(); document.removeEventListener('click', close); } }; setTimeout(() => document.addEventListener('click', close), 0); };

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

/* uložit rozdělaný den plánu jako šablonu */
A.twSaveDay = () => {
  const pl = trainingPlans().find(p => p.id === App.tpId); if (!pl) return;
  const items = pl.days[App.tpDay].items || [];
  if (!items.length) { UI.toast('V tomhle dni zatím žádné cviky nejsou – nejdřív nějaké přidej.'); return; }
  A.twEdit(null, { name: `${DAY_NAMES[App.tpDay]} – ${pl.name}`, items: JSON.parse(JSON.stringify(items)) });
};
A.twLibrary = () => openWorkoutPicker(null);

/* vložit šablonu do dne plánu nebo na konkrétní datum */
A.twInsertPlanDay = () => openWorkoutPicker(w => {
  if (!w) return;
  const pl = trainingPlans().find(p => p.id === App.tpId); if (!pl) return;
  const had = (pl.days[App.tpDay].items || []).length;
  const put = () => { pl.days[App.tpDay].items = JSON.parse(JSON.stringify(w.items || [])); saveTrainingPlan(pl); render(); };
  if (had) UI.confirm(`V ${DAY_NAMES[App.tpDay].toLowerCase()} už ${had === 1 ? 'je 1 cvik' : 'jsou cviky (' + had + ')'}. Nahradit je tréninkem ${w.name}?`, () => Undo.run(`Vloženo: ${w.name}`, put), 'Nahradit');
  else Undo.run(`Vloženo: ${w.name}`, put);
});

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
    : share > 0 ? ['🙂', 'Něco je vždycky líp než nic.', 'Nedokončený trénink není prohra. Napiš dolů, co se stalo – trenér s tím může něco udělat.']
    : ['🛋️', 'Dnes to nevyšlo.', 'Stane se. Zapiš proč, ať to není jen tichá díra v týdnu.'];
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
    <div class="in"><label class="f">Poznámka pro trenéra</label><input type="text" id="trnote" placeholder="např. bolelo levé koleno, dřepy jsem zkrátil"></div>
    <div class="row"><button class="btn" id="trsave">Uložit a zavřít</button></div>`);
  let rpe = null, feel = null;
  const pick = (box, set) => m.querySelectorAll(`#${box} .chip`).forEach(b => b.onclick = () => {
    m.querySelectorAll(`#${box} .chip`).forEach(x => x.classList.remove('on')); b.classList.add('on'); set(b.dataset.v);
  });
  pick('trrpe', v => rpe = Number(v)); pick('trfeel', v => feel = v);
  m.querySelector('#trsave').onclick = () => {
    const note = m.querySelector('#trnote').value.trim();
    m.remove();
    Undo.run('Trénink zapsaný', () => trWriteDay(date, t => {
      t.finished = new Date().toISOString(); t.rpe = rpe; t.feel = feel; t.note = note;
      if (prs.length) t.prs = prs;
      t.doneAll = items.length > 0 && items.every((_, k) => t.done[k]);
    }), `${doneN} z ${items.length} cviků, ${setsDone} sérií, ${fmt0(kcal)} kcal. Trenér to uvidí.`);
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
  return `<div class="notice"><b>Trénink zapsaný:</b> ${doneN} z ${items.length} cviků${r ? ` · náročnost ${r[0]} (${r[1]})` : ''}${f ? ` · ${f[1]} ${f[2]}` : ''}${st.note ? `<div class="small">„${esc(st.note)}“</div>` : ''}</div>`;
}
