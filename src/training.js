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

/* ===== Obrazovka trenéra: Trénink ===== */
App.tpId = null; App.tpDay = 0;
VIEWS.trenink = function () {
  const s = S(), plans = trainingPlans(), w = currentWeight(), ov = calcOverview(s, Meas());
  const pl = plans.find(p => p.id === App.tpId) || plans[plans.length - 1];
  if (pl) App.tpId = pl.id;
  const guard = paceGuard();
  const head = `<div class="row between" style="margin-bottom:8px"><h1>🏋️ Trénink${help('Týdenní šablona Po–Ne. Když plán přiřadíš od data, Robert od toho dne vidí chůzi a cviky v úkolech; jeho limit jídla se zvedne o kalorie z plánované aktivity (deficit zůstává stejný), recepty, Týden, Nákup i Vaření se přepočítají samy. Odhad kalorií z tréninku je hrubý (±30 %) – hlavní páka hubnutí je jídlo.')}</h1>
    <div class="row"><button class="btn sm" onclick="A.tpNew()">+ Nový plán</button>${pl ? `<button class="btn sec sm" onclick="A.tpCopy()">Kopírovat</button>` : ''}</div></div>
    ${guard.map(g => `<div class="alert a${g.lv}">${g.text}</div>`).join('')}
    <div class="card"><div class="stats3 wk"><div><b>${fmt1(w)} <small>kg</small></b><span>aktuální váha</span></div><div><b>${fmt0(10 * w + 6.25 * s.height - 5 * s.age + 5)}</b><span>klidový výdej (kcal) – pod něj limit nejde</span></div><div><b>${fmt0(w * s.rate_pct / 100 * KG_KCAL / 7)}</b><span>plánovaný deficit/den (${String(s.rate_pct).replace('.', ',')} %)</span></div><div><b>${esc(ov.phase.split(' – ')[0])}</b><span>fáze chůze podle váhy</span></div><div><b>${fmt1(s.walk_kmh)} <small>km/h</small></b><span>tempo chůze (Nastavení)</span></div><div><b>${(() => { const st = stepsStat(Array.from({ length: 14 }, (_, i) => addDays(todayISO(), -i))); return st ? fmt0(st.avg) : '–'; })()} <small>👣</small></b><span>běžná chůze Ø kroků/den (14 dní, jen info)</span></div></div>${paceLine()}</div>`;
  if (!plans.length) return head + `<div class="card"><h2>Zatím žádný plán</h2><p class="muted" style="margin-top:6px">Založ první plán – začni jen chůzí podle fáze (${esc(ov.phase)}), cviky přidávej po týdnu či dvou. Doporučený začátek pro ${fmt0(w)} kg: 3× týdně 20 minut cviků s vlastní vahou (dřep na židli, klik o stůl, přítah na stole, most) po 2–3 sériích, mezi tím chůze.</p><button class="btn" onclick="A.tpNew()">Založit plán</button></div>`;
  const tabs = `<div class="chips" style="margin-bottom:10px">${plans.map(p => `<span class="chip ${p.id === pl.id ? 'on' : ''}" onclick="App.tpId='${p.id}';render()">${esc(p.name)}${p.active_from ? ` · od ${czDateShort(p.active_from)}` : ''}</span>`).join('')}</div>`;
  // statistiky dnů
  const lastWeekAct = (() => { const mon = mondayOf(todayISO()); let k = 0; for (let i = 0; i < 7; i++) { const dt = addDays(mon, -7 + i); const d = getDay(dt); const a = dayAct(dt, d, w); k += (d.walk_min || 0) * calcBase(s, w, 0, 0, s.walk_kmh, 0, 0).walkPerMin + a.doneKcal; } return k; })();
  const dayStats = pl.days.map((d, i) => { const act = { planWalk: Number(d.walk_min) || 0, planKcal: sessionKcal(d.items, w) }; const b = calcBase(s, w, act.planWalk, 0, d.walk_kmh || s.walk_kmh, 0, 0, act); return { i, d, act, b, walkKcal: act.planWalk * b.walkPerMin, warn: b.planBelowBmr }; });
  const weekAct = dayStats.reduce((a, x) => a + x.walkKcal + x.act.planKcal, 0);
  const weekDef = dayStats.reduce((a, x) => a + (x.b.minOut - x.b.planLimit), 0);
  const warns = [];
  dayStats.filter(x => x.warn).forEach(x => warns.push(`${DAY_NAMES[x.i]}: limit by vyšel pod klidový výdej – drží ho spodní hranice, deficit dne je proto o ${fmt0(x.b.bmr - (x.b.minOut - x.b.deficit))} kcal nižší. Přidej chůzi, jinak týden nedá cílové tempo.`));
  if (weekDef / KG_KCAL < w * s.rate_pct / 100 * 0.97) warns.push(`Plán dává −${fmt2(weekDef / KG_KCAL)} kg/týden, cíl je −${fmt2(w * s.rate_pct / 100)}. Deficit drží appka sama – sníží ho jen spodní hranice jídla ve dnech s málo pohybu. Přidej chůzi v označených dnech.`);
  if (lastWeekAct > 0 && weekAct > lastWeekAct * 1.2) warns.push(`Aktivita ${fmt0(weekAct)} kcal/týden je o ${Math.round((weekAct / lastWeekAct - 1) * 100)} % víc než Robert reálně zvládl minulý týden (${fmt0(lastWeekAct)} kcal). Doporučené navýšení je do 20 %.`);
  if (ov.cur > 124 && pl.days.some(d => d.items.some(it => /Běh|Švihadlo|Angličák/.test(it.ex)))) warns.push('Nad 124 kg sešit nedoporučuje běh ani skoky (kolena, kotníky). Nahraď chůzí do kopce nebo kolem.');
  const dayCards = dayStats.map(x => `<div class="wkday ${App.tpDay === x.i ? 'today' : ''}" onclick="App.tpDay=${x.i};render()" style="cursor:pointer"><div class="dh"><b>${DAY_NAMES[x.i]}</b>${x.warn ? '<span class="bad">⚠️</span>' : ''}</div>
    <div class="small">🚶 ${x.act.planWalk} min · ${fmt0(x.walkKcal)} kcal</div>
    <div class="small">${x.d.items.length ? x.d.items.map(it => `🏋️ ${esc(itemLabel(it))}`).join('<br>') : '<span class="muted">bez cviků</span>'}</div>
    <div class="tiny muted" style="margin-top:6px">limit ${fmt0(x.b.planLimit)} kcal${x.act.planKcal ? ` · trénink ~${fmt0(x.act.planKcal)} kcal` : ''}</div></div>`).join('');
  const ed = pl.days[App.tpDay]; const es = dayStats[App.tpDay];
  const exOpts = `<optgroup label="Silové – vlastní váha, kettlebell, expander">${EX_LIB.filter(e => e.type === 'strength').map(e => `<option value="${esc(e.ex)}">${esc(e.ex)}</option>`).join('')}</optgroup><optgroup label="Kardio">${EX_LIB.filter(e => e.type === 'cardio').map(e => `<option value="${esc(e.ex)}">${esc(e.ex)}</option>`).join('')}</optgroup><option value="__custom">Vlastní cvik…</option>`;
  const base0 = calcBase(s, w, s.walk_min, 0, s.walk_kmh, 0, 0); const foodDelta = es.b.planLimit - base0.planLimit;
  const dateOf = addDays(mondayOf(todayISO()), App.tpDay); const wkR = getWeek(mondayOf(dateOf));
  const rPlan = wkR.plan[App.tpDay].some(Boolean) ? calcPlanDay(s, Foods(), Recipes(), wkR.plan[App.tpDay], w, { planWalk: es.act.planWalk, planKcal: es.act.planKcal }) : null;
  const foodBox = `<div class="foodbox"><div><b>${fmt0(es.b.planLimit)}</b><span>limit podle plánu</span></div><div><b class="${foodDelta > 0 ? 'ok' : foodDelta < 0 ? 'bad' : ''}">${foodDelta ? signed0(foodDelta) : '±0'}</b><span>proti dni bez tréninku (${fmt0(base0.planLimit)})</span></div><div><b>${fmt0(es.b.minOut - es.b.planLimit)}</b><span>deficit dne${es.b.planBelowBmr ? ' <span class="bad">· snížený spodní hranicí</span>' : ''}</span></div>
    ${rPlan ? `<div><b class="${Math.abs(rPlan.planLimit - rPlan.kcal) <= 100 ? 'ok' : 'warn'}">${fmt0(rPlan.kcal)}</b><span>Robertův plán jídel ${czDateShort(dateOf)} → ${Math.abs(rPlan.planLimit - rPlan.kcal) <= 100 ? 'sedí' : (rPlan.planLimit > rPlan.kcal ? `musí přidat ${fmt0(rPlan.planLimit - rPlan.kcal)} kcal` : `musí ubrat ${fmt0(rPlan.kcal - rPlan.planLimit)} kcal`)}${Math.abs(rPlan.planLimit - rPlan.kcal) > 100 ? ' – uvidí výzvu „Dorovnat“' : ''}</span></div>` : `<div><b class="muted">–</b><span>Robert nemá na ${czDateShort(dateOf)} naplánovaná jídla</span></div>`}</div>`;
  const editor = `<div class="card"><div class="row between"><h2>${DAY_NAMES[App.tpDay]} – úprava</h2><span class="small muted">klidový výdej ${fmt0(es.b.bmr)} kcal</span></div>${foodBox}
    <div class="grid" style="grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;max-width:420px"><div class="in"><label class="f">Chůze (minut)</label><input type="number" min="0" step="5" value="${ed.walk_min ?? ''}" onchange="A.tpDayField('walk_min',this.value)"></div><div class="in"><label class="f">Tempo</label><select onchange="A.tpDayField('walk_kmh',this.value)">${SEED.met.map(([k]) => `<option value="${k}" ${Number(ed.walk_kmh || s.walk_kmh) === k ? 'selected' : ''}>${fmt1(k)} km/h</option>`).join('')}</select></div></div>
    <table class="small" style="margin-top:10px"><tr><th>Cvik</th><th class="n">Série</th><th class="n">Opak. / s</th><th class="n">Zátěž kg</th><th class="n">Minut</th><th>Intenzita</th><th class="n">~kcal</th><th></th></tr>
    ${ed.items.map((it, j) => { const lib = EX_LIB.find(e => e.ex === it.ex); const isC = it.type === 'cardio'; return `<tr><td><b>${esc(it.ex)}</b>${it.note ? `<div class="tiny muted">${esc(it.note)}</div>` : ''}${(() => { const sg = progressSuggestion(it); return sg ? `<div class="tiny ${sg.apply ? 'ok' : 'muted'}">${esc(sg.text)}${sg.apply ? ` <button class="btn sec sm" style="padding:1px 8px;font-size:11px" onclick="A.tpApplyProgress(${j})">použít</button>` : ''}</div>` : ''; })()}</td>
      <td class="n">${isC ? '' : `<input type="number" min="1" style="width:60px" value="${it.sets}" onchange="A.tpItem(${j},'sets',this.value)">`}</td><td class="n">${isC ? '' : `<input type="number" min="1" style="width:70px" value="${it.reps}" onchange="A.tpItem(${j},'reps',this.value)">`}</td><td class="n">${isC ? '' : `<input type="number" min="0" step="0.5" style="width:70px" value="${it.weight || ''}" placeholder="–" onchange="A.tpItem(${j},'weight',this.value)">`}</td>
      <td class="n"><input type="number" min="0" step="5" style="width:70px" value="${it.min || ''}" placeholder="${isC ? '' : fmt0(itemMinutes(it))}" onchange="A.tpItem(${j},'min',this.value)"></td>
      <td>${isC ? `<span class="muted">MET ${itemMet(it)}</span>` : `<select style="width:auto;min-height:32px;padding:3px 6px" onchange="A.tpItem(${j},'intensity',this.value)">${Object.entries(INTENSITY_LABEL).map(([k, l]) => `<option value="${k}" ${(it.intensity || 'medium') === k ? 'selected' : ''}>${l}</option>`).join('')}</select>`}</td>
      <td class="n">${fmt0(itemKcal(it, w))}</td><td class="n"><button class="xbtn" onclick="A.tpItemDel(${j})">×</button></td></tr>`; }).join('')}
    <tr><td colspan="6" class="b">Trénink celkem · ${fmt0(ed.items.reduce((a, it) => a + itemMinutes(it), 0))} min</td><td class="n b">${fmt0(es.act.planKcal)}</td><td></td></tr></table>
    <div class="row" style="margin-top:10px"><button class="btn sec sm" onclick="A.tpPickEx()">+ přidat cvik</button><button class="btn sec sm" onclick="A.exLibrary()">🏋️ Knihovna cviků</button><input type="text" id="tpnote" placeholder="poznámka k tréninku (volitelně)" value="${esc(ed.note || '')}" style="flex:1;min-width:180px" onchange="A.tpDayField('note',this.value)"></div>
    <div class="row" style="margin-top:8px"><button class="btn sec sm" onclick="A.tpCopyDay()">Zkopírovat tento den na…</button><button class="btn sec sm" onclick="A.tpClearDay()">Vyprázdnit den</button></div></div>`;
  const summary = `<div class="card"><h2>Týden celkem</h2><div class="stats3 wk" style="margin-top:8px"><div><b>${fmt0(weekAct)}</b><span>kcal z aktivity za týden (min. týden reálně ${fmt0(lastWeekAct)})</span></div><div><b>${fmt0(weekDef / 7)}</b><span>průměrný deficit/den</span></div><div><b class="${weekDef / KG_KCAL >= w * s.rate_pct / 100 * 0.97 ? 'ok' : 'bad'}">−${fmt2(weekDef / KG_KCAL)} <small>kg</small></b><span>projektované tempo (cíl min. −${fmt2(w * s.rate_pct / 100)})</span></div><div><b>${pl.days.filter(d => d.items.length).length}×</b><span>tréninků v týdnu</span></div></div>
    ${warns.map(t => `<div class="alert a2" style="margin-top:8px">${esc(t)}</div>`).join('')}
    ${!warns.length ? '<div class="alert a3" style="margin-top:8px">Plán je v mezích: limit nad klidovým výdejem, tempo drží cíl, navýšení aktivity pod 20 %.</div>' : ''}
    <div class="row" style="margin-top:10px"><div class="in"><label class="f">Název plánu</label><input type="text" value="${esc(pl.name)}" style="width:220px" onchange="A.tpField('name',this.value)"></div><div class="in"><label class="f">Platí od (přiřadit Robertovi)</label><input type="date" value="${pl.active_from || ''}" style="width:auto" onchange="A.tpField('active_from',this.value||null)"></div><span class="sp"></span><button class="btn danger sm" onclick="A.tpDelete()">Smazat plán</button></div>
    <p class="hint">${pl.active_from ? `Robert tento plán vidí od ${czDate(pl.active_from)}. Změny se mu propíší okamžitě.` : 'Plán zatím není přiřazený – Robert vidí výchozích ' + s.walk_min + ' min chůze denně.'}</p></div>`;
  return head + tabs + `<div class="wkgrid7" style="margin-bottom:12px">${dayCards}</div>` + editor + summary;
};
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
A.tpCopyDay = () => { const m = UI.modal(`<h2>Zkopírovat ${DAY_NAMES[App.tpDay]} na…</h2><div class="chips" style="margin:12px 0">${DAY_NAMES.map((n, i) => i === App.tpDay ? '' : `<label class="chip"><input type="checkbox" value="${i}" style="width:16px;height:16px;min-height:0;margin-right:6px">${n}</label>`).join('')}</div><div class="row"><button class="btn" id="cpok">Zkopírovat</button><button class="btn sec" onclick="UI.closeModal()">Zpět</button></div>`);
  m.querySelector('#cpok').onclick = () => { const pl = trainingPlans().find(p => p.id === App.tpId); const src = JSON.stringify(pl.days[App.tpDay]); [...m.querySelectorAll('input:checked')].forEach(i => { pl.days[+i.value] = JSON.parse(src); }); m.remove(); Undo.run('Den zkopírován', () => saveTrainingPlan(pl)); render(); }; };
A.tpDelete = () => UI.confirm('Smazat tento plán? Robert se vrátí k výchozí chůzi.', () => { Undo.run('Plán smazán', () => Store.remove('training', App.tpId)); App.tpId = null; render(); });
/* jednorázová změna dne (trenér z Robertova Dnes) */
A.tpOverride = date => { const cur = trainingOverride(date) || { ...dayActivityPlan(date) }; delete cur.source; delete cur.planName;
  const m = UI.modal(`<h2>Jednorázová změna · ${czDate(date)}</h2><p class="small muted" style="margin:4px 0 10px">Platí jen pro tento den, šablona zůstává.</p><div class="row"><div class="in"><label class="f">Chůze (min)</label><input type="number" id="ovw" value="${cur.walk_min ?? ''}" style="width:100px"></div><div class="in" style="flex:1"><label class="f">Poznámka pro Roberta</label><input type="text" id="ovn" value="${esc(cur.note || '')}"></div></div>
    <p class="small muted" style="margin-top:8px">Cviky: ${cur.items && cur.items.length ? cur.items.map(itemLabel).join(' · ') : 'žádné'} <button class="btn sec sm" id="ovclr">bez cviků</button></p>
    <div class="row" style="margin-top:10px"><button class="btn" id="ovok">Uložit změnu</button><button class="btn sec" onclick="UI.closeModal()">Zpět</button>${trainingOverride(date) ? '<button class="btn danger sm" id="ovdel">Zrušit výjimku</button>' : ''}</div>`);
  let items = cur.items || []; m.querySelector('#ovclr').onclick = () => { items = []; m.querySelector('#ovclr').textContent = '✓ bez cviků'; };
  m.querySelector('#ovok').onclick = () => { const data = { walk_min: Number(m.querySelector('#ovw').value) || 0, walk_kmh: cur.walk_kmh, items, note: m.querySelector('#ovn').value }; m.remove(); Undo.run('Výjimka uložena', () => Store.put('training', oid('to', date), data)); render(); };
  const del = m.querySelector('#ovdel'); if (del) del.onclick = () => UI.confirm('Zrušit výjimku a vrátit se k plánu?', () => { m.remove(); Undo.run('Výjimka zrušena', () => Store.remove('training', oid('to', date))); render(); }, 'Zrušit výjimku');
}

/* ===== Robert: karta Aktivita dne ===== */
function renderActivityCard(date, day, d) {
  const s = S(); const act = day.act || {}; const items = act.items || []; const done = (day.training && day.training.done) || {};
  const wt = d.base.planWalk; const wm = day.walk_min || 0;
  const items_html = items.length ? `<div class="tasks" style="margin-top:8px">${items.map((it, i) => `<div class="task ${done[i] ? 'done' : ''}" onclick="A.trainDone(${i},${!done[i]})"><span class="ck">${done[i] ? '✓' : ''}</span><span style="font-size:18px">${it.type === 'cardio' ? '🏃' : '🏋️'}</span><div><div class="tx">${esc(itemLabel(it))}</div>${it.note ? `<div class="sub">${esc(it.note)}</div>` : ''}</div><span class="go">${fmt0(itemKcal(it, currentWeight()))} kcal</span></div>`).join('')}</div>
    ${!act.doneAll ? `<div class="row" style="margin-top:8px"><button class="btn sm write" onclick="A.trainDoneAll()">✓ Celý trénink hotový</button></div>` : ''}` : '';
  return `<div class="card ga-walk" id="aktivita"><div class="row between"><h2>🚶 Aktivita dnes${help('Chůze a trénink zvedají celkový výdej, a tím i limit jídla – plánovaný deficit zůstává stejný, takže hubneš pořád stejně rychle, jen se víc najíš. Zapiš, co jsi skutečně udělal. Bez pohybu limit klesne na spodní hranici; appka ti řekne, kolik minut chybí.')}</h2><span class="pill">cílený pohyb ${fmt0(d.base.totalOut - d.base.baseOut)} kcal</span>${isCoach() ? `<button class="btn sec sm" style="pointer-events:auto" onclick="A.tpOverride('${date}')">Jednorázová změna</button>` : ''}</div>
    ${act.note ? `<div class="notice" style="margin:8px 0">${esc(act.note)}</div>` : ''}
    <div class="row" style="margin-top:8px">${[15, 30, 60].map(n => `<button class="btn sec sm write" onclick="A.addWalk(${n})">+${n} min</button>`).join('')}<span class="pill ${wm >= wt ? 'ok' : ''}">chůze ${wm} / ${wt} min · ${fmt0(wm * d.base.walkPerMin)} kcal</span></div>
    ${d.base.belowBmr ? `<div class="alert a2" style="margin-top:8px">Zatím máš málo cíleného pohybu – limit by vyšel pod klidový výdej, tak ho držím na spodní hranici. Chůze klidový výdej nezvedá, ale zvedá celkový výdej: od ${d.base.walkToBmr}. minuty ti začne růst i limit.</div>` : ''}
    ${items_html}
    <div class="row" style="margin-top:10px"><span class="small muted">👣 Běžná chůze dnes (práce, nákup, doma):</span><input type="number" step="500" min="0" value="${daySteps(day)}" style="width:110px;min-height:34px" onchange="A.setSteps(this.value)"><span class="small muted">kroků · jen informace pro trenéra, do cíle ${d.base.planWalk} min se nepočítá</span></div>
    <details style="margin-top:10px"><summary class="small muted" style="cursor:pointer">Upravit ručně (minuty, tempo, piva, smažené)</summary>
    <div class="grid" style="grid-template-columns:1fr 1fr;gap:8px;margin-top:8px"><div class="in"><label class="f">Ušlé minuty</label><input type="number" min="0" step="5" value="${day.walk_min ?? ''}" placeholder="0" onchange="A.setWalk(this.value)"></div><div class="in"><label class="f">Tempo</label><select onchange="A.dayField('walk_kmh',this.value,'Tempo změněno')">${SEED.met.map(([k]) => `<option value="${k}" ${Number(day.walk_kmh) === k ? 'selected' : ''}>${fmt1(k)} km/h</option>`).join('')}</select></div>
    <div class="in"><label class="f">Piv dnes (0,5 l)</label><input type="number" min="0" step="1" value="${day.beers || ''}" placeholder="0" onchange="A.dayField('beers',this.value,'Piva zapsána')"></div><div class="in"><label class="f">Smažené (g)</label><input type="number" min="0" step="50" value="${day.fried_g || ''}" placeholder="0" onchange="A.dayField('fried_g',this.value,'Smažené zapsáno')"></div></div><p class="hint">${esc(d.friday)}</p></details></div>`;
}
A.trainDone = (i, v) => { const items = (effectiveDay(App.date).act || {}).items || []; Undo.run(v ? `Hotovo: ${items[i] ? items[i].ex : ''}` : 'Cvik vrácen', () => { const day = getDay(App.date); day.training = day.training || { done: {} }; day.training.done[i] = v; saveDay(day); }, () => { const dd = calcDay(S(), Foods(), Recipes(), effectiveDay(App.date), currentWeight()); return `Limit dne je teď ${fmt0(dd.base.maxIntake)} kcal.`; }); render(); };
A.trainDoneAll = () => { const items = (effectiveDay(App.date).act || {}).items || []; Undo.run('Celý trénink odškrtnutý', () => { const day = getDay(App.date); day.training = { done: Object.fromEntries(items.map((_, i) => [i, true])) }; saveDay(day); }, () => { const dd = calcDay(S(), Foods(), Recipes(), effectiveDay(App.date), currentWeight()); return `+${fmt0(dd.base.doneKcal)} kcal aktivity, limit ${fmt0(dd.base.maxIntake)} kcal.`; }); render(); };

/* ===== nápověda (i) ===== */
function help(text) { return `<button class="ibtn" type="button" onclick="event.stopPropagation();UI.pop(this,${JSON.stringify(text).replace(/"/g, '&quot;')})" title="nápověda">i</button>`; }
UI.pop = (el, text) => { document.querySelectorAll('.pop').forEach(p => p.remove()); const p = document.createElement('div'); p.className = 'pop'; p.innerHTML = `<div>${esc(text)}</div>`; document.body.appendChild(p); const r = el.getBoundingClientRect(); const w = Math.min(340, window.innerWidth - 24); p.style.width = w + 'px'; p.style.left = Math.max(12, Math.min(r.left, window.innerWidth - w - 12)) + 'px'; p.style.top = (r.bottom + 8 + window.scrollY) + 'px'; const close = e => { if (!p.contains(e.target)) { p.remove(); document.removeEventListener('click', close); } }; setTimeout(() => document.addEventListener('click', close), 0); };

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
    m.querySelector('.box').innerHTML = `<div class="row between"><h2>🏋️ Cviky <span class="muted small" style="font-weight:600">${L.length} z ${Exercises().length}</span></h2><button class="xbtn" onclick="UI.closeModal()">×</button></div>
      <div class="frow" style="margin-top:8px"><input type="text" id="exq" placeholder="hledat cvik…" value="${esc(ExPick.q)}" style="flex:1;min-width:160px"></div>
      <div class="frow"><span class="flab">Filtr</span><div class="seg">${[['', 'vše'], ['strength', 'silové'], ['cardio', 'kardio']].map(([k, l]) => `<button class="${ExPick.type === k ? 'on' : ''}" onclick="ExPick.type='${k}';window._exdraw()">${l}</button>`).join('')}</div>
        <button class="chip ${ExPick.fav ? 'on' : ''}" onclick="ExPick.fav=!ExPick.fav;window._exdraw()">★ oblíbené</button>
        <button class="btn sec sm" onclick="A.exEdit(null)">+ nový cvik</button></div>
      <div class="plist" style="margin-top:8px">${L.map(e => `<div class="pitem" ${onPick ? `onclick="window._expick('${e.slug}')"` : ''}>
          <div style="flex:1;min-width:0"><div class="pn">${esc(e.ex)}${e.own ? ' <span class="pill">moje</span>' : ''}${e.seed ? '' : ' <span class="pill">nový</span>'}</div>
            <div class="pi">${EX_TYPE_LABEL[e.type || 'strength']}${e.met ? ' · MET ' + e.met : ''}${e.note ? ' · ' + esc(e.note) : ''}</div></div>
          <button class="star ${isExFav(e.slug) ? 'on' : ''}" onclick="event.stopPropagation();A.exFav('${e.slug}')" title="oblíbené">${isExFav(e.slug) ? '★' : '☆'}</button>
          <button class="xbtn" title="upravit" onclick="event.stopPropagation();A.exEdit('${e.slug}')">✎</button></div>`).join('') || '<p class="muted small" style="margin-top:8px">Nic takového tu není. Zkus jiné slovo, nebo si cvik přidej.</p>'}</div>`;
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
  const m = UI.modal(`<div class="row between"><h2>${sl ? 'Upravit cvik' : 'Nový cvik'}</h2><button class="xbtn" onclick="UI.closeModal()">×</button></div>
    <div class="in" style="margin-top:10px"><label class="f">Název</label><input type="text" id="exn" value="${esc(e.ex)}"></div>
    <div class="row" style="margin-top:8px;align-items:flex-end">
      <div class="in"><label class="f">Typ</label><select id="ext" style="width:auto">${Object.entries(EX_TYPE_LABEL).map(([k, l]) => `<option value="${k}" ${(e.type || 'strength') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="in"><label class="f">MET (volitelně)</label><input type="number" id="exm" step="0.5" min="0" style="width:90px" value="${e.met || ''}"></div>
      <div class="in"><label class="f">Série</label><input type="number" id="exs" min="1" style="width:80px" value="${e.sets || ''}"></div>
      <div class="in"><label class="f">Opakování</label><input type="number" id="exr" min="1" style="width:100px" value="${e.reps || ''}"></div></div>
    <div class="in" style="margin-top:8px"><label class="f">Poznámka k provedení</label><input type="text" id="exnote" value="${esc(e.note || '')}" placeholder="např. kolena ven, záda rovná"></div>
    <p class="small muted" style="margin-top:8px">MET nech prázdné u běžných silových cviků – appka použije intenzitu z plánu. Série a opakování se předvyplní, až cvik vložíš do tréninku.</p>
    <div class="row" style="margin-top:12px"><button class="btn" id="exok">Uložit</button><button class="btn sec" onclick="UI.closeModal()">Zavřít</button>${canDel ? '<span class="sp"></span><button class="btn danger sm" id="exdel">Smazat</button>' : ''}</div>
    <div class="bad small" id="exerr" style="margin-top:8px"></div>`, { guardEdits: true });
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
