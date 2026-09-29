/* ===== Obrazovky trenéra: Robert · Plán · Databáze ===== */

/* ---------- ROBERT: mám zasáhnout? ----------
   Dřív Dashboard (dvě verze nad sebou) a Zpráva vedle sebe: stejné metriky, stejný
   den po dni a tři tlačítka „poslat vzkaz“, která přepisovala jeden slot. Teď jedna
   obrazovka: verdikt a akce, co vyžaduje zásah, týden, vzkazy, graf. */
VIEWS.klient = function () {
  const s = S(), ov = calcOverview(s, Meas()); const uid = Store.ownerId();
  const sig = signaly();
  const lvl = sig.some(x => x.lv === 1) ? 1 : sig.some(x => x.lv === 2) ? 2 : 3;
  const state = { 1: ['bad', '🔴 Zasáhnout', 'tint-b'], 2: ['warn', '🟡 Pohlídat', 'tint-o'], 3: ['ok', '🟢 V pořádku', 'tint-ok'] }[lvl];
  const wb = ov.weekBack;
  const line = wb && wb.lostW != null ? (wb.lostW >= wb.planW * 0.9 ? `Váha −${fmt2(wb.lostW)} kg za týden, drží tempo.` : wb.lostW > 0 ? `Váha −${fmt2(wb.lostW)} kg za týden, pomaleji než plán (${fmt2(wb.planW)}).` : 'Váha za týden nešla dolů.') : 'Zatím málo vážení na týdenní trend.';
  const top = sig.find(x => x.msg);
  const msg = lvl === 3 ? `Dobrá práce, ${fmt1(ov.lost)} kg dole. Drž to a jedeme dál.` : (top ? top.msg : null);
  const p = paceOverview();
  const name = (Store.clients.find(x => x.id === uid) || {}).display_name || 'Robert';
  const ch = sinceLast();
  return `<div class="ph"><div class="pt"><h1>${esc(name)}</h1><span class="sub">${czDate(todayISO())}</span></div></div>
  ${Store.db.foods.some(r => r.user_id == null) || !Store.clients.length || Store.localMode() ? '' : `<div class="notice warn">Recepty a suroviny běží z výchozích dat. V Nastavení je „Naplnit výchozí data“.</div>`}
  <div class="card ${state[2]} stack">
    <div class="row"><span class="pill ${state[0]}">${state[1]}</span>${ch.items.length ? `<button class="btn ghost sm" style="margin-left:auto" onclick="A.sinceSheet()">🔔 ${ch.items.length} ${sklon(ch.items.length, 'novinka', 'novinky', 'novinek')}</button>` : ''}</div>
    <div style="font-size:19px;font-weight:750;line-height:1.3">${esc(lvl === 3 ? line : (sig[0] ? sig[0].head || line : line))}</div>
    <div class="mini"><div><b>−${fmt2(p.target)}</b><span>cíl kg/týden</span></div><div><b class="${p.ok ? 'ok' : 'bad'}">−${fmt2(p.projThis)}</b><span>plán týdne</span></div><div><b class="${p.actual == null ? '' : p.actual >= p.target * 0.9 ? 'ok' : 'bad'}">${p.actual == null ? '–' : (p.actual >= 0 ? '−' : '+') + fmt2(Math.abs(p.actual))}</b><span>realita</span></div></div>
    ${msg ? `<button class="btn multi" onclick="A.sendCoachMsg(${JSON.stringify(msg).replace(/"/g, '&quot;')})">✉️ Poslat: „${esc(msg)}“</button>` : ''}
  </div>
  ${sig.length ? `<div class="card flush"><div class="lh">${lvl === 3 ? 'Na vědomí' : 'Co vyžaduje akci'}</div>${sig.map((x, i) => `<div class="sig"><span class="sv l${x.lv}"></span><div class="sx">${esc(x.text)}</div>${x.apply ? `<button class="btn sm" onclick="${x.apply}">${esc(x.label)}</button>` : x.msg ? `<button class="btn sec sm" onclick="A.msgSheet(${i})">Vzkaz</button>` : x.go ? `<button class="btn sec sm" onclick="${x.go}">${esc(x.label || 'Otevřít')}</button>` : ''}</div>`).join('')}</div>` : ''}
  ${weekCard()}
  ${threadCardC()}
  <div class="card"><div class="ch"><h2>Váha proti plánu</h2>${ov.avgWeekLoss != null ? `<span class="pill ${ov.avgWeekLoss >= ov.cur * s.rate_pct / 100 * 0.9 ? 'ok' : 'warn'}">−${fmt2(ov.avgWeekLoss)} kg/týden</span>` : ''}</div>
    ${lineChart({ series: [{ name: 'plán', color: '#9aa3b8', dash: true, pts: Array.from({ length: Math.max(84, (ov.last ? ov.last.idx : 0) + 14) + 1 }, (_, i) => [i, planWeightAt(s, i)]) }, { name: 'ranní váha', color: '#a8c6e4', pts: ov.rows.map(r => [r.idx, r.weight]), thin: true }, { name: 'průměr 7 dní', color: '#1478d4', pts: ov.rows.map(r => [r.idx, r.avg]), dots: true }], xLabel: 'dní od startu', yUnit: 'kg', h: 230, marks: (s.log || []).map(l => ({ x: daysBetween(s.start_date, l.at), label: l.pop.split(' ')[0] + ' ' + l.to })) })}
    <p class="hint">Průměr 7 dní ${fmt1(ov.cur)} kg · od startu −${fmt1(ov.lost)} kg · prognóza ${ov.forecast || '–'}. Svislé čáry jsou tvoje zásahy.</p></div>
  <div class="card flush"><div class="navrow" onclick="A.numbersSheet()"><span class="ico">📊</span><div class="tx"><b>Čísla za 6 týdnů a 28 dní</b><span>týdny, dny, příjem proti limitu, chůze, kroky</span></div><span class="chev">›</span></div>
    <div class="navrow" onclick="go('__preview')"><span class="ico">👁️</span><div class="tx"><b>Pohled Roberta</b><span>appka přesně tak, jak ji vidí on</span></div><span class="chev">›</span></div></div>`;
};

/* týden: sedm políček, čtyři čísla a týdenní zpráva jedním tlačítkem */
function weekCard() {
  const today = todayISO(); const start = App.repWeek || mondayOf(today);
  const R = weekReport(start);
  const cells = R.days.map(dt => { const rec = Store.rows('days', Store.ownerId()).find(r => r.data.date === dt);
    if (dt > today) return `<div class="d0" style="opacity:.45">${DAY_SHORT[dayIndex(dt)]}<small>·</small></div>`;
    if (dt === today) return `<button class="d3" onclick="A.coachDaySheet('${dt}')">${DAY_SHORT[dayIndex(dt)]}<small>dnes</small></button>`;
    if (!rec) return `<button class="d0" onclick="A.coachDaySheet('${dt}')">${DAY_SHORT[dayIndex(dt)]}<small>–</small></button>`;
    const ev = evaluateDay(dt); const ok = rec.data.closed ? rec.data.closedOk : ev.ok;
    return `<button class="${ok ? 'd2' : 'd1'}" onclick="A.coachDaySheet('${dt}')">${DAY_SHORT[dayIndex(dt)]}<small>${ev.cheats.beers ? '🍺' + ev.cheats.beers : ok ? '✓' : '✗'}</small></button>`; }).join('');
  return `<div class="card stack"><div class="row between nowrap"><button class="iconbtn" onclick="App.repWeek=addDays('${start}',-7);render()" aria-label="týden zpět">‹</button><b>Týden ${czDateShort(start)}–${czDateShort(addDays(start, 6))}</b><button class="iconbtn" onclick="App.repWeek=addDays('${start}',7);render()" ${start >= mondayOf(today) ? 'disabled' : ''} aria-label="další týden">›</button></div>
    <div class="dots7">${cells}</div>
    <div class="stats"><div class="stat"><b>${R.weigh} <small>/ ${R.past}</small></b><span>vážení</span></div><div class="stat"><b>${R.okN} <small>/ ${R.recs.length}</small></b><span>dny v pořádku</span></div><div class="stat"><b>${fmt0(R.walk)} <small>min</small></b><span>chůze</span></div><div class="stat"><b>${R.beers} 🍺 · ${R.over}</b><span>piv · dnů přes limit</span></div></div>
    <button class="btn sec" onclick="A.copyReport('${start}')">📋 Zkopírovat týdenní zprávu</button></div>`;
}
A.copyReport = start => { const R = weekReport(start); const done = () => UI.toast('Zpráva zkopírovaná do schránky.');
  if (navigator.clipboard) navigator.clipboard.writeText(R.text).then(done).catch(() => A.reportSheet(start)); else A.reportSheet(start); };
A.reportSheet = start => { const R = weekReport(start); UI.sheet('📋 Týdenní zpráva', `${czDateShort(start)}–${czDateShort(addDays(start, 6))}`, `<pre class="small" style="white-space:pre-wrap;margin:0;font-family:inherit">${esc(R.text)}</pre>`); };

/* vzkazy: Robertovy poznámky ke dnům a tvoje odpovědi v jednom vlákně, jedno pole na psaní */
function threadCardC() {
  const it = threadItems(6); const note = coachNote();
  return `<div class="card stack"><h2>💬 Vzkazy</h2>
    ${it.length ? `<div class="stack s8">${it.map(x => `<div class="bubble" style="${x.who === 'robert' ? 'background:var(--p-bg)' : ''}"><div><span class="who" style="${x.who === 'robert' ? 'color:var(--p-ink)' : ''}">${x.who === 'robert' ? 'Robert' : 'Ty'} · <a href="#" onclick="A.coachDaySheet('${x.date}');return false">${czDateShort(x.date)}</a></span>${esc(x.text)}</div></div>`).join('')}</div>` : '<p class="small muted">Zatím nic. Robertovy poznámky ke dnům a tvoje odpovědi se sbíhají sem.</p>'}
    ${note ? `<div class="row small muted nowrap"><span style="flex:1;min-width:0">Na jeho Dnes teď visí: „${esc(note)}“</span><button class="btn ghost sm" onclick="saveCoachNote(null);render();UI.toast('Vzkaz z Dnes odebrán.')">odebrat</button></div>` : ''}
    <div class="row nowrap"><input type="text" id="cmsg" placeholder="Napiš Robertovi…" onkeydown="if(event.key==='Enter')A.sendCoachMsg(this.value)"><button class="btn" onclick="A.sendCoachMsg(document.getElementById('cmsg').value)">Poslat</button></div></div>`;
}
/* jeden vzkaz = objeví se Robertovi na Dnes a zůstane ve vlákně u dnešního dne */
A.sendCoachMsg = text => { text = String(text || '').trim(); if (!text) { UI.toast('Napiš, co mu chceš vzkázat.'); return; }
  Undo.run('Vzkaz odeslán', () => { saveCoachNote(text); Store.put('training', oid('note', todayISO()), { reply: text, at: new Date().toISOString() }); }, 'Vzkaz odeslán – Robert ho uvidí na Dnes.'); UI.closeModal(); render(); };
A.msgSheet = i => { const x = signaly()[i]; if (!x) return;
  UI.sheet('✉️ Vzkaz Robertovi', esc(x.text), `<textarea id="msgt" rows="3">${esc(x.msg || '')}</textarea><p class="hint">Uvidí ho nahoře na Dnes v kartě Teď.</p>`, `<button class="btn" onclick="A.sendCoachMsg(document.getElementById('msgt').value)">Poslat</button>`); };

/* den u Roberta v listu: co snědl, chůze, kroky, hlad, poznámka a odpověď */
A.coachDaySheet = date => openSheet(() => {
  const ev = evaluateDay(date), d = ev.d, day = ev.day, s = S(); const rep = coachReply(date); const m = Meas().find(x => x.date === date);
  const steps = daySteps(getDay(date));
  return UI.sheetHtml(`${DAY_NAMES[dayIndex(date)]} ${czDateShort(date)}`, d.tot.kcal ? (ev.ok ? 'den seděl' : 'den neseděl') : 'bez jídla',
    `<div class="stats"><div class="stat"><b class="${ev.cheats.over ? 'bad' : ''}">${d.tot.kcal ? fmt0(d.intake) : '–'} <small>/ ${fmt0(d.base.maxIntake)}</small></b><span>kcal z limitu</span></div><div class="stat"><b class="${d.tot.p >= d.protTarget ? 'ok' : ''}">${fmt0(d.tot.p)} <small>g</small></b><span>bílkoviny</span></div><div class="stat"><b>${day.walk_min || 0} <small>min</small></b><span>chůze</span></div><div class="stat"><b>${steps == null ? '–' : fmt0(steps)}</b><span>kroků · cíl ${fmt0(stepsTarget(s))}</span></div></div>
    <div class="list">${d.courses.map((c, ci) => `<div class="li static"><span class="ck ${(day.meals[c.key] || {}).eaten ? 'on' : ''}">${(day.meals[c.key] || {}).eaten ? '✓' : ''}</span><span class="em">${COURSE_EMOJI[c.key]}</span><div class="tx"><b>${esc(c.sel || 'nevybráno')}</b><span>${esc(s.courses[ci].name)}${c.edited ? ' · upraveno' : ''}</span></div><span class="val k">${c.kcal ? fmt0(c.kcal) : ''}</span></div>`).join('')}
      ${d.base.cheatKcal ? `<div class="li static cheat"><span class="ck na"></span><span class="em">🍻</span><div class="tx"><b>Cheat · ${esc(cheatPopis(day))}</b></div><span class="val">${fmt0(d.base.cheatKcal)}</span></div>` : ''}</div>
    <div class="small muted">${m && m.weight != null ? `Váha ${fmt1(m.weight)} kg · ` : 'Bez vážení · '}hlad: ${day.hunger === 'vlk' ? '😖 vlčí' : day.hunger === 'hlad' ? '😐 hlad' : day.hunger === 'ok' ? '🙂 v pohodě' : 'nezapsáno'}${day.training && day.training.rpe ? ` · trénink náročnost ${day.training.rpe}/5` : ''}</div>
    ${day.note ? `<div class="bubble" style="background:var(--p-bg)"><div><span class="who" style="color:var(--p-ink)">Robert</span>${esc(day.note)}</div></div>` : ''}
    <div class="field"><label class="f">Odpověď k tomuto dni</label><div class="row nowrap"><input type="text" id="rep-${date}" value="${esc(rep && rep.reply || '')}" placeholder="odpověď Robertovi…"><button class="btn sm" onclick="A.saveReply('${date}',document.getElementById('rep-${date}').value.trim())">Odeslat</button></div></div>`,
    `<button class="btn sec" onclick="A.tpOverride('${date}')">🏋️ Jednorázová změna tréninku</button>`);
});
/* novinky od minulé návštěvy */
A.sinceSheet = () => { const ch = sinceLast();
  UI.sheet('🔔 Od tvé poslední návštěvy', ch.since ? czDate(isoDate(new Date(ch.since))) : '', ch.items.length ? `<ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:4px">${ch.items.slice(0, 40).map(t => `<li class="small">${t}</li>`).join('')}</ul>` : '<p class="muted">Nic nového.</p>'); };
/* čísla pro hloubku: 6 týdnů, 28 dní, příjem proti limitu a chůze */
A.numbersSheet = () => {
  const s = S(), ov = calcOverview(s, Meas()); const today = todayISO(); const uid = Store.ownerId(); const N = 28;
  const byDate = Object.fromEntries(Store.rows('days', uid).map(r => [r.data.date, r.data])); const measBy = Object.fromEntries(Meas().map(m => [m.date, m]));
  const range = []; for (let k = N - 1; k >= 0; k--) range.push(addDays(today, -k));
  const rows = range.map(dt => { if (!byDate[dt]) return { dt, none: true }; const ev = evaluateDay(dt); return { dt, ...ev, walk: ev.day.walk_min || 0, hasFood: ev.d.tot.kcal > 0, closedOk: dt < today ? (ev.day.closed ? !!ev.day.closedOk : ev.ok) : null }; });
  const thisMon = mondayOf(today); const weeks = [];
  for (let k = 5; k >= 0; k--) { const mon = addDays(thisMon, -7 * k); const R = weekReport(mon); weeks.push({ mon, R, planned: weekPlanned(mon) }); }
  const walkPts = rows.map(r => r.none ? 0 : r.walk); const intakePts = rows.filter(r => r.hasFood).map(r => [range.indexOf(r.dt), r.d.intake]); const limitPts = rows.filter(r => r.hasFood).map(r => [range.indexOf(r.dt), r.d.base.maxIntake]);
  UI.sheet('📊 Čísla', 'posledních 6 týdnů a 28 dní',
    `<h3>Týdny</h3><div class="tbl"><table class="small"><tr><th>Od</th><th class="n">OK</th><th class="n">Vážení</th><th class="n">Chůze</th><th class="n">Piva</th><th class="n">Přes</th><th class="n">Plán</th><th class="n">Ø váha</th></tr>
    ${weeks.map(w => `<tr><td>${czDateShort(w.mon)}</td><td class="n">${w.R.okN}/${w.R.recs.length}</td><td class="n">${w.R.weigh}/${w.R.past}</td><td class="n">${fmt0(w.R.walk)}</td><td class="n">${w.R.beers}</td><td class="n ${w.R.over ? 'bad' : ''}">${w.R.over}</td><td class="n ${w.planned >= 35 ? 'ok' : 'warn'}">${w.planned}/35</td><td class="n">${w.R.wEnd ? fmt1(w.R.wEnd.avg) : '–'}</td></tr>`).join('')}</table></div>
    <h3>Příjem proti limitu</h3>${intakePts.length ? lineChart({ series: [{ name: 'limit dne', color: '#9aa3b8', dash: true, pts: limitPts }, { name: 'příjem', color: '#c81f2b', pts: intakePts, dots: true }], xLabel: 'dny (0 = před 27 dny)', yUnit: 'kcal', h: 210 }) : '<p class="muted small">Zatím žádný den s jídlem.</p>'}
    <h3>Chůze (minuty)</h3>${barChart(walkPts, range.map(dt => DAY_SHORT[dayIndex(dt)].slice(0, 1)), s.walk_min)}
    <h3>Dny</h3><div class="tbl"><table class="small"><tr><th>Den</th><th class="n">Váha</th><th class="n">Příjem</th><th class="n">B</th><th class="n">Chůze</th><th class="n">👣</th><th>Stav</th></tr>
    ${rows.slice().reverse().map(r => { const m = measBy[r.dt]; return `<tr onclick="A.coachDaySheet('${r.dt}')"><td>${czDateShort(r.dt)} <span class="muted">${DAY_SHORT[dayIndex(r.dt)]}</span></td><td class="n">${m && m.weight != null ? fmt1(m.weight) : '<span class="muted">–</span>'}</td>
      ${r.none ? '<td class="n muted" colspan="4">bez zápisu</td><td></td>' : `<td class="n ${r.hasFood ? (r.cheats.over ? 'bad' : 'ok') : 'muted'}">${r.hasFood ? `${fmt0(r.d.intake)}/${fmt0(r.d.base.maxIntake)}` : '–'}</td><td class="n">${r.hasFood ? fmt0(r.d.tot.p) : ''}</td><td class="n ${r.walk >= s.walk_min ? 'ok' : ''}">${r.walk}</td><td class="n">${daySteps(r.day) == null ? '–' : fmt0(daySteps(r.day))}</td><td class="${r.closedOk == null ? 'warn' : r.closedOk ? 'ok' : 'bad'}">${r.closedOk == null ? 'dnes' : r.closedOk ? 'OK' : 'nesedí'}</td>`}</tr>`; }).join('')}</table></div>`);
};

/* ---------- PLÁN: co nastavit ----------
   Nahoře páky, které trenér opravdu mění (tempo, chůze, kroky, fáze, udržovací týden).
   Věci na roky – výška, věk, datum startu, cílové hodnoty – jsou v listu Profil.
   Každá změna se ukládá hned, dá se vrátit a zapíše se do historie a do grafu. */
App.coachTab = 'cile';
VIEWS.nastaveni = function () {
  const t = App.coachTab === 'trenink' ? 'trenink' : 'cile';
  return `<div class="ph"><div class="pt"><h1>Plán</h1></div></div>
  <div class="seg"><button class="${t === 'cile' ? 'on' : ''}" onclick="App.coachTab='cile';render()">Cíle</button><button class="${t === 'trenink' ? 'on' : ''}" onclick="App.coachTab='trenink';render()">Trénink</button></div>
  ${t === 'cile' ? cileHtml() : VIEWS.trenink()}`;
};
function cileHtml() {
  const s = S(); const cw = currentWeight(); const ph = phaseSuggestion();
  const mw = (s.maint_weeks || []).slice().sort(); const tday = todayISO(); const thisMon = mondayOf(tday);
  const odKdy = mw.length ? mw[mw.length - 1] : s.start_date; const tydnu = Math.floor(daysBetween(odKdy, tday) / 7);
  const tydny = Array.from({ length: 10 }, (_, k) => addDays(thisMon, k * 7));
  const numf = (k, unit, step) => `<div class="numf"><input type="text" inputmode="decimal" id="st_${k}" value="${s[k] >= 1000 ? fmt0(s[k]) : String(s[k]).replace('.', ',')}" onchange="A.setSetting('${k}',this.value)"><span>${unit}</span></div>`;
  return `<div class="card stack s8"><div class="row between"><h2>Tempo hubnutí</h2><b style="font-size:20px" id="ratep">${String(s.rate_pct).replace('.', ',')} %</b></div>
    <input type="range" id="st_rate_pct" min="0.3" max="1.2" step="0.05" value="${s.rate_pct}" oninput="const v=this.value,w=${cw};document.getElementById('ratep').textContent=String(v).replace('.',',')+' %';document.getElementById('ratev').textContent=(Math.round(w*v)/100).toString().replace('.',',')+' kg za týden · deficit '+Math.round(w*v/100*7700/7)+' kcal/den'" onchange="A.setSetting('rate_pct',this.value)">
    <div class="small muted"><span id="ratev">${fmt2(cw * s.rate_pct / 100)} kg za týden · deficit ${fmt0(cw * s.rate_pct / 100 * KG_KCAL / 7)} kcal/den</span> · 0,5–1 % je udržitelné</div>
    ${adviceBox('rate_pct')}</div>
  <div class="card flush">
    <div class="navrow" style="cursor:default"><div class="tx"><b>Cíl chůze</b><span>denně, když den nemá trénink</span></div>${numf('walk_min', 'min')}</div>
    <div class="navrow" style="cursor:default"><div class="tx"><b>Cíl kroků</b><span>běžná chůze · faktor ${String(s.activity).replace('.', ',')} se dopočítá</span></div>${numf('steps_goal', 'kroků')}</div>
    <div class="navrow" style="cursor:default"><div class="tx"><b>Tempo chůze</b><span>fáze ${esc(calcOverview(s, Meas()).phase.split(' – ')[0])}${ph ? ` · doporučeno ${fmt1(ph.rec)} km/h` : ''}</span></div><select style="width:128px" onchange="A.setSetting('walk_kmh',this.value)">${SEED.met.map(([k, m]) => `<option value="${k}" ${k === s.walk_kmh ? 'selected' : ''}>${fmt1(k)} km/h</option>`).join('')}</select></div>
    ${adviceBox('walk_min') || adviceBox('activity') ? `<div style="padding:0 14px 12px" class="stack s8">${adviceBox('walk_min')}${adviceBox('activity')}</div>` : ''}
    ${ph ? `<div style="padding:0 14px 12px"><div class="alert a2"><div>🚶 ${esc(ph.text)}</div><button class="btn sm" onclick="A.applyPhase(${ph.rec})">Přepnout</button></div></div>` : ''}
  </div>
  <div class="card stack s8"><div class="row between"><h2>Udržovací týden</h2>${tydnu >= 6 ? '<span class="pill warn">je čas</span>' : ''}</div>
    <div class="chips scroll">${tydny.map(m => `<button class="chip ${mw.includes(m) ? 'on' : ''}" onclick="A.maintWeek('${m}')">${czDateShort(m)}</button>`).join('')}</div>
    <div class="small muted">${mw.length ? `Poslední ${czDateShort(odKdy)}, od té doby ${tydnu} ${sklon(tydnu, 'týden', 'týdny', 'týdnů')} v deficitu.` : `Zatím žádný · ${tydnu} ${sklon(tydnu, 'týden', 'týdny', 'týdnů')} od startu.`} Doporučení: jeden po šesti až deseti týdnech – deficit nula, limit na celkovém výdeji.</div></div>
  <div class="card flush">
    <div class="navrow" onclick="A.profileSheet()"><span class="ico">👤</span><div class="tx"><b>Profil a výchozí hodnoty</b><span>výška ${s.height} · věk ${s.age} · start ${czDateShort(s.start_date)} · cíl ${s.goal_weight} kg · bílkoviny ${s.protein_min} g</span></div><span class="chev">›</span></div>
    <div class="navrow" onclick="A.logSheet()"><span class="ico">🕓</span><div class="tx"><b>Historie změn</b><span>${(s.log || []).length} ${sklon((s.log || []).length, 'zásah', 'zásahy', 'zásahů')} · vidíš je i v grafu váhy</span></div><span class="chev">›</span></div></div>`;
}
/* meze, aby překlep nerozbil výpočet */
const SET_MEZ = { height: [120, 230], age: [15, 100], activity: [1.1, 2], start_weight: [40, 400], goal_weight: [40, 400],
  goal_waist: [50, 200], rate_pct: [0.3, 1.2], walk_kmh: [2, 9], walk_min: [0, 600], rest_sec: [15, 600], protein_min: [60, 400], steps_goal: [0, 30000] };
const SET_POP = { rate_pct: 'tempo hubnutí (%)', walk_min: 'cíl chůze (min)', protein_min: 'bílkoviny (g)', goal_weight: 'cílová váha (kg)', activity: 'faktor běžného výdeje', walk_kmh: 'tempo chůze (km/h)', goal_waist: 'cíl pasu (cm)', steps_goal: 'cíl kroků/den', height: 'výška (cm)', age: 'věk', start_weight: 'startovní váha (kg)' };
/* Jedno místo, kudy jde každá změna nastavení – ruční, z doporučení i z fáze chůze.
   Dřív se změny z doporučení nelogovaly a v grafu po nich nezůstala značka. */
function commitSettings(d, label, msg) {
  const s = S(); const clean = { ...d }; delete clean.met; delete clean.phase_thresholds; delete clean.phases;
  const log = (s.log || []).slice();
  Object.keys(SET_POP).forEach(k => { if (clean[k] !== undefined && s[k] !== clean[k]) log.push({ at: todayISO(), k, pop: SET_POP[k], from: s[k], to: clean[k] }); });
  clean.log = log; clean.maint_weeks = clean.maint_weeks || s.maint_weeks || [];
  Undo.run(label, () => saveSettings(clean), msg || 'Robertovi se přepočítal limit i plány.'); render();
}
A.setSetting = (k, v) => {
  const s = S(); const m = SET_MEZ[k];
  if (k === 'start_date') { if (!v) { UI.toast('Datum startu musí být vyplněné.'); render(); return; } commitSettings({ ...s, start_date: v }, 'Datum startu'); return; }
  const r = m ? omez(v, m[0], m[1]) : { n: cislo(v), mimo: false };
  if (r.n == null) { UI.toast('Tohle není číslo – nechávám původní hodnotu.'); render(); return; }
  if (r.mimo) UI.toast(`Mimo rozumný rozsah – uložil jsem ${String(r.n).replace('.', ',')}.`);
  const d = { ...s, [k]: r.n };
  if ((k === 'goal_weight' || k === 'start_weight') && d.goal_weight >= d.start_weight) { UI.toast('Cílová váha musí být nižší než startovní.'); render(); return; }
  /* Cíl kroků a faktor běžného výdeje jsou totéž číslo ze dvou stran – limit jídla
     počítá s faktorem. Když trenér změní cíl kroků, faktor se dopočítá sám. */
  let msg;
  if (k === 'steps_goal') { const rec = factorForSteps(r.n); if (rec !== s.activity) { d.activity = rec; msg = `Cíl ${fmt0(r.n)} kroků – faktor běžného výdeje srovnán na ${String(rec).replace('.', ',')}.`; } }
  commitSettings(d, (SET_POP[k] || k) + ' změněno', msg);
};
A.setCourseKcal = (i, v) => { const s = S(); const r = omez(v, 0, 2000); if (r.n == null) return; const courses = s.courses.map((c, j) => j === i ? { ...c, kcal: r.n } : c); commitSettings({ ...s, courses }, 'Cíl chodu změněn'); };
A.profileSheet = () => openSheet(() => {
  const s = S();
  const f = (k, l, note) => `<div class="field"><label class="f">${l}</label><input type="text" inputmode="decimal" id="st_${k}" value="${String(s[k]).replace('.', ',')}" onchange="A.setSetting('${k}',this.value)">${note ? `<div class="hint">${note}</div>` : ''}</div>`;
  return UI.sheetHtml('👤 Profil a výchozí hodnoty', 'mění se jednou za čas · ukládá se hned',
    `<div class="grid g2">${f('height', 'Výška (cm)')}${f('age', 'Věk')}</div>
    <div class="field"><label class="f">Datum startu</label><input type="date" id="st_start_date" value="${s.start_date}" onchange="A.setSetting('start_date',this.value)"><div class="hint">od něj se odvíjí kalendář vážení a plánovaná křivka</div></div>
    <div class="grid g2">${f('start_weight', 'Startovní váha (kg)')}${f('goal_weight', 'Cílová váha (kg)')}</div>
    <div class="grid g2">${f('goal_waist', 'Cílový pas (cm)', 'polovina výšky')}${f('protein_min', 'Bílkoviny min. (g)', `doporučeno ${Math.round(1.6 * s.goal_weight)}–${Math.round(2 * s.goal_weight)} g`)}</div>
    ${adviceBox('protein_min')}${adviceBox('goal_waist')}${adviceBox('goal_weight')}
    <div class="grid g2">${f('activity', 'Faktor běžného výdeje', 'sedavě + 5 000 kroků = 1,34')}${f('rest_sec', 'Pauza mezi sériemi (s)')}</div>
    <h3>Cíle chodů (kcal)</h3>
    <div class="grid g2">${s.courses.map((c, i) => `<div class="field"><label class="f">${esc(c.name)} · ${c.time}</label><input type="text" inputmode="decimal" id="st_c${i}" value="${c.kcal}" onchange="A.setCourseKcal(${i},this.value)"></div>`).join('')}</div>
    <p class="hint">Součet ${courseTargetSum(s)} kcal. Poměr chodů určuje, jak se limit dělí mezi jídla; součet sám limit nemění.</p>${adviceBox('courses')}`);
});
A.logSheet = () => { const s = S(); const log = (s.log || []).slice().reverse();
  UI.sheet('🕓 Historie změn', 'každá změna nastavení', log.length ? `<div class="list">${log.map(l => `<div class="li static"><span class="tm">${czDateShort(l.at)}</span><div class="tx"><b>${esc(l.pop)}</b><span>${esc(String(l.from).replace('.', ','))} → ${esc(String(l.to).replace('.', ','))}</span></div></div>`).join('')}</div>` : '<p class="muted">Zatím žádná změna.</p>'); };
A.maintWeek = m => { const s = S(); const mw = (s.maint_weeks || []).slice();
  const i = mw.indexOf(m); if (i >= 0) mw.splice(i, 1); else mw.push(m);
  Undo.run('Udržovací týden', () => saveSettings({ ...s, maint_weeks: mw.sort() }), i >= 0 ? `Týden od ${czDateShort(m)} zase v deficitu.` : `Týden od ${czDateShort(m)} je udržovací – deficit nula, limit na celkovém výdeji.`); render(); };
A.seedAll = () => UI.confirm(`Nahrát ${SEED.recipes.length} receptů, ${SEED.foods.length} surovin a výchozí nastavení ze sešitu do databáze?`, () => {
  SEED.foods.forEach(f => { const { id, ...data } = f; Store.put('foods', id, data, null); });
  SEED.recipes.forEach(r => { const { id, ...data } = r; Store.put('recipes', id, data, null); });
  if (!settingsRec()) saveSettings({ ...SEED.settings });
  UI.toast('Výchozí data nahrána'); render();
}, 'Nahrát data');
A.seedMeas = () => UI.confirm('Nahrát 14 vážení a obvody (27. 8. – 9. 9. 2026) ze sešitu jako historii?', () => {
  SEED.measurements.forEach(m => saveMeas({ ...m, note: m.note && m.note.startsWith('START') ? 'start' : m.note }));
  UI.toast('Vážení nahrána'); render();
}, 'Nahrát vážení');

/* ---------- DATABÁZE ---------- */
App.dbTab = 'recipes';
VIEWS.databaze = function () {
  const foods = Foods(); const recipes = Recipes().filter(r => !r.own && !r.deleted);
  const t = App.dbTab === 'foods' ? 'foods' : 'recipes';
  return `<div class="ph"><div class="pt"><h1>Databáze</h1><span class="sub">úpravy platí pro všechny</span></div><div class="act"><button class="btn sm" onclick="${t === 'recipes' ? 'A.editRecipe()' : "A.editFood(null,'global')"}">+ Nový</button></div></div>
  <div class="seg"><button class="${t === 'recipes' ? 'on' : ''}" onclick="App.dbTab='recipes';render()">Recepty · ${recipes.length}</button><button class="${t === 'foods' ? 'on' : ''}" onclick="App.dbTab='foods';render()">Suroviny · ${foods.length}</button></div>
  ${t === 'recipes' ? recipeBrowser(recipes) : VIEWS._suroviny()}`;
};
/* 200 receptů pod sebou dělalo 18 000 px. Bez hledání a filtru se ukážou chody,
   ťuknutím se rozbalí jen ten jeden. */
function recipeBrowser(recipes) {
  const s = S(); const anyFil = App.rq || Object.keys(App.rfil).some(k => App.rfil[k]);
  if (anyFil) { const list = recipeList(recipes); return recipeFilterBar(recipes) + `<div class="small muted" style="padding:0 4px">${list.count} ${sklon(list.count, 'recept', 'recepty', 'receptů')}</div><div class="card flush">${list.html}</div>`; }
  const favs = Prefs().favs;
  return recipeFilterBar(recipes) + `<div class="card flush">${s.courses.map(c => { const n = recipes.filter(r => r.course === c.name && !r.deleted).length;
    return `<div class="navrow" onclick="window._rf('c:${c.key}')"><span class="ico">${COURSE_EMOJI[c.key]}</span><div class="tx"><b>${esc(c.name)}</b><span>${n} ${sklon(n, 'recept', 'recepty', 'receptů')} · cíl ${c.kcal} kcal</span></div><span class="chev">›</span></div>`; }).join('')}
    ${favs.length ? `<div class="navrow" onclick="window._rf('fav')"><span class="ico">⭐</span><div class="tx"><b>Oblíbené</b><span>${favs.length}</span></div><span class="chev">›</span></div>` : ''}
    ${recipes.some(r => r.own || r.overridden) ? `<div class="navrow" onclick="window._rf('own')"><span class="ico">📌</span><div class="tx"><b>Moje recepty a verze</b><span>${recipes.filter(r => r.own || r.overridden).length}</span></div><span class="chev">›</span></div>` : ''}</div>`;
}

A.editFood = (id, mode, after) => {
  const own = mode === 'own', over = mode === 'override'; const owner = (own || over) ? Store.ownerId() : null;
  const src = id ? Foods().find(x => x.id === id) : null;
  const f = src ? { ...src } : { id: own ? oid('food', Date.now()) : 'f:' + Date.now(), cat: 'Ostatní', name: '', kcal: '', p: '', c: '', f: '' };
  if (over) { f.saveId = src.ovId || oid('ov', src.id); f.overrides = src.id; }
  const cats = [...new Set(Foods().map(x => x.cat))];
  const m = UI.modal(`${UI.sheetHtml(over ? 'Moje verze suroviny' : (id ? 'Upravit surovinu' : (own ? 'Moje surovina' : 'Nová surovina')), 'hodnoty na 100 g (nebo 100 ml) z obalu', '')}<p class="small muted">${own ? 'Uvidíš ji jen ty a půjde použít v tvých receptech i při přidávání surovin.' : ''}${over ? 'Změna platí jen pro tebe – trenérova databáze zůstává. Název se nemění.' : ''}${!own && !over ? 'Úprava platí pro všechny.' : ''}</p>
    <div class="grid g2"><div class="in"><label class="f">Kategorie</label><select id="fc">${cats.map(c => `<option ${c === f.cat ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div><div class="in"><label class="f">Název</label><input type="text" id="fn" value="${esc(f.name)}"></div>
    <div class="in"><label class="f">kcal</label><input type="number" id="fk" value="${f.kcal}"></div><div class="in"><label class="f">Bílkoviny (g)</label><input type="number" step="0.1" id="fp" value="${f.p}"></div><div class="in"><label class="f">Sacharidy (g)</label><input type="number" step="0.1" id="fs" value="${f.c}"></div><div class="in"><label class="f">Tuky (g)</label><input type="number" step="0.1" id="ff" value="${f.f}"></div></div>
    <div class="small muted" id="fuse"></div><div class="shfoot"><button class="btn" id="fsave">Uložit</button>${id ? `<button class="btn danger" id="fdel">${over ? 'Vrátit původní' : 'Smazat'}</button>` : ''}</div>`, { guardEdits: true });
  if (id && !over) { const used = Recipes().filter(r => r.items.some(it => it.food === f.name)); m.querySelector('#fuse').textContent = used.length ? `Použito v ${used.length} receptech. Přejmenování se do nich propíše.` : 'V žádném receptu.'; }
  m.querySelector('#fsave').onclick = () => {
    const name = m.querySelector('#fn').value.trim(); if (!name) { UI.toast('Chybí název'); return; }
    const data = { cat: m.querySelector('#fc').value, name: over ? f.name : name, kcal: Number(m.querySelector('#fk').value), p: Number(m.querySelector('#fp').value), c: Number(m.querySelector('#fs').value), f: Number(m.querySelector('#ff').value) };
    if (over) { Undo.run('Moje verze suroviny', () => { Store.put('foods', f.saveId, { ...data, overrides: f.overrides }, owner); }, `${f.name}: tvoje verze uložena (${data.kcal} kcal). Recepty s ní počítají jen u tebe.`); m.remove(); render(); return; }
    if (!over && Foods().some(x => x.name === name && x.id !== f.id)) { UI.toast('Surovina s tímto názvem už existuje'); return; }
    if (id && name !== f.name && !own) { // propsat přejmenování do receptů
      Recipes().forEach(r => { if (r.items.some(it => it.food === f.name)) { const { id: rid, seed, own, ...rd } = r; rd.items = rd.items.map(it => it.food === f.name ? { ...it, food: name } : it); Store.put('recipes', rid, rd, own ? Store.ownerId() : null); } });
    }
    Undo.run('Surovina', () => { Store.put('foods', f.id, data, owner); }, `${name} uložena (${data.kcal} kcal / 100 g).`); m.remove(); render();
  };
  const del = m.querySelector('#fdel'); if (del && over) del.onclick = () => { if (!src.ovId) { m.remove(); return; } UI.confirm('Zahodit svoji verzi suroviny a vrátit se k trenérově?', () => { Undo.run('Vrátit původní', () => { Store.remove('foods', src.ovId); }, `${f.name}: vrácena původní hodnota trenéra.`); m.remove(); render(); }, 'Vrátit původní'); };
  else if (del) del.onclick = () => { const used = Recipes().filter(r => r.items.some(it => it.food === f.name)); if (used.length) { UI.toast(`Nelze smazat – používá ji ${used.length} ${sklon(used.length, 'recept', 'recepty', 'receptů')}`); return; } UI.confirm('Smazat surovinu?', () => { if (!own) Store.put('foods', f.id, { ...f }, null); Store.remove('foods', f.id); m.remove(); render(); }, 'Smazat'); };
};
