/* ===== Obrazovky trenéra ===== */
App.dashRange = 14;
VIEWS.klient = function () {
  const s = S(), meas = Meas(), ov = calcOverview(s, meas);
  const today = todayISO(); const uid = Store.ownerId(); const N = App.dashRange;
  const dayRecs = Store.rows('days', uid).map(r => r.data); const byDate = Object.fromEntries(dayRecs.map(d => [d.date, d]));
  const measBy = Object.fromEntries(meas.map(m => [m.date, m]));
  const range = []; for (let k = N - 1; k >= 0; k--) range.push(addDays(today, -k));
  const rows = range.map(dt => { const rec = byDate[dt]; if (!rec) return { dt, none: true, cheats: {} }; const ev = evaluateDay(dt); return { dt, ...ev, walk: ev.day.walk_min || 0, walkOk: (ev.day.walk_min || 0) >= s.walk_min, hasFood: ev.d.tot.kcal > 0, closed: dt < today, closedOk: dt < today ? (ev.day.closed ? !!ev.day.closedOk : ev.ok) : false }; });
  const past = rows.filter(r => r.dt < today);
  const logged = past.filter(r => !r.none), withFood = past.filter(r => r.hasFood), okDays = past.filter(r => r.closed && r.closedOk);
  const walkOk = logged.filter(r => r.walkOk).length, walkAvg = logged.length ? logged.reduce((a, r) => a + r.walk, 0) / logged.length : 0;
  const noWeigh = range.filter(dt => dt >= s.start_date && dt < today && !(measBy[dt] && measBy[dt].weight != null));
  const cheats = rows.reduce((a, r) => ({ beers: a.beers + (r.cheats.beers || 0), fried: a.fried + (r.cheats.fried || 0), over: a.over + (r.cheats.over ? 1 : 0), overK: a.overK + (r.cheats.over || 0), edits: a.edits + (r.cheats.edits || 0), situace: a.situace + (r.cheats.situace || 0), skipped: a.skipped + (r.cheats.skipped || 0) }), { beers: 0, fried: 0, over: 0, overK: 0, edits: 0, situace: 0, skipped: 0 });
  const eatenTotal = logged.reduce((a, r) => a + r.eaten, 0);
  const thisMon = mondayOf(today), nextMon = addDays(thisMon, 7);
  const planThis = weekPlanned(thisMon), planNext = weekPlanned(nextMon);
  const lw = ov.lastWaist;
  // alerty
  const AL = [];
  if (noWeigh.length >= 3) AL.push([1, `⚖️ ${noWeigh.length} dnů bez vážení za ${N} dní (${noWeigh.slice(-3).map(czDateShort).join(', ')}${noWeigh.length > 3 ? '…' : ''})`]);
  if (planThis < 35) AL.push([planThis === 0 ? 1 : 2, `🗓️ Tento týden má naplánováno ${planThis}/35 jídel`]);
  if (dayIndex(today) >= 5 && planNext < 35) AL.push([2, `🗓️ Příští týden zatím ${planNext}/35 jídel`]);
  const noLog = past.slice(-7).filter(r => r.none).length; if (noLog >= 2) AL.push([1, `📵 ${noLog} z posledních 7 dnů bez jakéhokoli zápisu`]);
  if (cheats.over >= 2) AL.push([1, `🍺 ${cheats.over} dnů přes limit (celkem +${fmt0(cheats.overK)} kcal), ${cheats.beers} piv, ${fmt0(cheats.fried)} g smaženého`]);
  else if (cheats.beers > 6) AL.push([2, `🍺 ${cheats.beers} piv za ${N} dní`]);
  if (logged.length >= 5 && walkOk / logged.length < 0.6) AL.push([2, `🚶 Chůzi splnil jen ${walkOk} z ${logged.length} zapsaných dnů (průměr ${fmt0(walkAvg)} min)`]);
  if (ov.weekBack && ov.weekBack.lostW != null && ov.weekBack.lostW <= 0) AL.push([1, `📉 Týdenní průměr váhy nešel dolů (${fmt2(ov.weekBack.lostW)} kg)`]);
  if (ov.weekBack && ov.weekBack.lostW >= ov.weekBack.planW * 0.9) AL.push([3, `🔥 Váha na plánu: −${fmt2(ov.weekBack.lostW)} kg za týden`]);
  if (okDays.length >= 5) AL.push([3, `✅ ${okDays.length} dnů z ${past.length} uzavřených v pořádku`]);
  paceGuard().forEach(g => AL.push([g.lv, g.text]));
  const apl = activePlanFor(today); AL.push([apl ? 3 : 2, apl ? `🏋️ Tréninkový plán „${esc(apl.name)}“ platí od ${czDateShort(apl.active_from)}` : '🏋️ Žádný tréninkový plán – Robert jede na výchozích ' + s.walk_min + ' min chůze. Založ ho v Tréninku.']);
  if (!AL.length) AL.push([3, 'Bez upozornění.']);
  // týdenní souhrn (6 týdnů)
  const weeks = []; for (let k = 5; k >= 0; k--) { const mon = addDays(thisMon, -7 * k); const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i)).filter(dt => dt <= today);
    const evs = days.filter(dt => byDate[dt]).map(dt => evaluateDay(dt)); const wRows = ov.rows.filter(r => days.includes(r.date));
    const wAvg = wRows.length ? wRows.reduce((a, r) => a + r.weight, 0) / wRows.length : null;
    weeks.push({ mon, days: days.length, logged: evs.length, ok: evs.filter(e => e.day.date < today ? (e.day.closed ? e.day.closedOk : e.ok) : false).length, walk: evs.length ? evs.reduce((a, e) => a + (e.day.walk_min || 0), 0) / evs.length : 0, beers: evs.reduce((a, e) => a + e.cheats.beers, 0), over: evs.filter(e => e.cheats.over).length, weigh: days.filter(dt => measBy[dt] && measBy[dt].weight != null).length, wAvg, planned: weekPlanned(mon), cells: days.map(dt => { const r = byDate[dt]; if (!r) return 0; if (dt >= today) return 3; return (r.closed ? r.closedOk : evaluateDay(dt).ok) ? 2 : 1; }) }); }
  weeks.forEach((w, i) => { w.delta = i > 0 && weeks[i - 1].wAvg != null && w.wAvg != null ? w.wAvg - weeks[i - 1].wAvg : null; });
  // grafy
  const walkPts = rows.map((r, i) => [i, r.none ? 0 : r.walk]); const intakePts = rows.filter(r => r.hasFood).map(r => [range.indexOf(r.dt), r.d.intake]); const limitPts = rows.filter(r => r.hasFood).map(r => [range.indexOf(r.dt), r.d.base.maxIntake]);
  const seedNote = Store.db.foods.some(r => r.user_id == null) ? '' : `<div class="banner" style="margin-bottom:10px">Recepty a suroviny běží z výchozích dat v aplikaci. Klikni dole na „Naplnit výchozí data“, aby byly v cloudu a šly upravovat.</div>`;
  const pct = (a, b) => b ? Math.round(a / b * 100) + ' %' : '–';
  const quiet = quietHeader();
  if (!App.dashDetail) return `<div class="row between" style="margin-bottom:8px"><h1>📊 Dashboard – ${esc((() => { const c = Store.clients.find(x => x.id === uid) || {}; return c.display_name || c.name || c.email || 'klient' })())}${help('Tichý přehled: barva a věta nahoře říkají, jestli zasáhnout. Pod tím plnění dnů, chůze a cheaty za zvolené období, tempo cíl/plán/realita a doporučení. Detail rozbalí grafy váhy a příjmu. Chipy 7/14/28 mění období.')}</h1><div class="chips">${[7, 14, 28].map(n => `<span class="chip ${N === n ? 'on' : ''}" onclick="App.dashRange=${n};render()">${n} dní</span>`).join('')}</div></div>${seedNote}${quiet}
    <div class="grid g3"><div class="card tint"><h3>Plnění dne</h3><div style="font-size:30px;font-weight:900;margin:6px 0" class="${okDays.length >= past.length * 0.7 ? 'ok' : 'warn'}">${okDays.length} / ${past.length}</div><div class="small muted">dnů v pořádku za ${N} dní</div></div><div class="card tint"><h3>Chůze a trénink</h3><div style="font-size:30px;font-weight:900;margin:6px 0" class="${logged.length && walkOk / logged.length >= 0.7 ? 'ok' : 'warn'}">${pct(walkOk, logged.length)}</div><div class="small muted">dnů s chůzí splněnou · Ø ${fmt0(walkAvg)} min</div></div><div class="card tint"><h3>Cheaty</h3><div style="font-size:30px;font-weight:900;margin:6px 0" class="${cheats.over ? 'bad' : 'ok'}">${cheats.over} <span style="font-size:14px;font-weight:600">dnů přes</span></div><div class="small muted">🍺 ${cheats.beers} · 🍟 ${fmt0(cheats.fried)} g · ${cheats.situace}× situace</div></div></div>`;
  return `<div class="row between" style="margin-bottom:8px"><h1>📊 Dashboard – ${esc((() => { const c = Store.clients.find(x => x.id === uid) || {}; return c.display_name || c.name || c.email || 'klient' })())}${help('Tichý přehled: barva a věta nahoře říkají, jestli zasáhnout. Pod tím plnění dnů, chůze a cheaty za zvolené období, tempo cíl/plán/realita a doporučení. Detail rozbalí grafy váhy a příjmu. Chipy 7/14/28 mění období.')}</h1><div class="chips">${[7, 14, 28].map(n => `<span class="chip ${N === n ? 'on' : ''}" onclick="App.dashRange=${n};render()">${n} dní</span>`).join('')}</div></div>${seedNote}${quiet}
  <div class="card"><div class="stats3 wk">
    <div><b>${fmt1(ov.cur)} <small>kg</small></b><span>průměr 7 vážení</span></div>
    <div><b class="ok">−${fmt1(ov.lost)} <small>kg</small></b><span>od startu · ${Math.round(ov.progress * 100)} % cesty</span></div>
    <div><b class="${ov.weekBack && ov.weekBack.lostW > 0 ? 'ok' : 'bad'}">${ov.weekBack && ov.weekBack.lostW != null ? (ov.weekBack.lostW >= 0 ? '−' : '+') + fmt2(Math.abs(ov.weekBack.lostW)) : '–'} <small>kg</small></b><span>poslední týden (plán ${ov.weekBack && ov.weekBack.planW ? fmt2(ov.weekBack.planW) : '–'})</span></div>
    <div><b class="${ov.dev != null && ov.dev >= 0 ? 'ok' : 'bad'}">${ov.dev != null ? (ov.dev >= 0 ? '+' : '−') + fmt2(Math.abs(ov.dev)) : '–'} <small>kg</small></b><span>proti plánované křivce</span></div>
    <div><b>${ov.forecast || '–'}</b><span>prognóza cíle ${s.goal_weight} kg</span></div>
  </div></div>
  <div class="card"><div class="row between"><h2>💬 Vzkaz Robertovi</h2><span class="tiny muted">${coachNote() ? 'zobrazuje se na jeho Dnes' : 'zatím žádný'}</span></div>
    <div class="row" style="margin-top:8px"><input type="text" id="cnote" value="${esc(coachNote() || '')}" placeholder="např. Tento týden drž pátek na 3 pivech – zbytek jde skvěle." style="flex:1;min-width:220px"><button class="btn sm" onclick="saveCoachNote(document.querySelector('#cnote').value.trim()||null);UI.toast('Vzkaz uložen');render()">Uložit</button>${coachNote() ? '<button class="btn sec sm" onclick="saveCoachNote(null);render()">Smazat</button>' : ''}</div></div>
  <div class="grid g32">
   <div class="card"><h2>Upozornění</h2><div style="margin-top:8px">${AL.sort((a, b) => a[0] - b[0]).map(([lv, tx]) => `<div class="alert a${lv}">${tx}</div>`).join('')}</div></div>
   <div class="card"><h2>Plánování</h2><table class="small" style="margin-top:6px"><tr><td>Tento týden (${czDateShort(thisMon)})</td><td class="n ${planThis >= 35 ? 'ok' : 'bad'} b">${planThis}/35</td></tr><tr><td>Příští týden (${czDateShort(nextMon)})</td><td class="n ${planNext >= 35 ? 'ok' : (dayIndex(today) >= 5 ? 'warn' : 'muted')} b">${planNext}/35</td></tr><tr><td>Nákup na tento týden</td><td class="n">${(() => { const sd = shoppingDone(thisMon); return sd.total ? `${sd.done}/${sd.total}` : '–'; })()}</td></tr><tr><td>Vlastní recepty</td><td class="n">${Recipes().filter(r => r.own && !r.deleted).length}</td></tr></table></div>
  </div>
  <div class="grid g4">
    <div class="card tint"><h3>Plnění dne</h3><div style="font-size:30px;font-weight:900;margin:6px 0" class="${okDays.length >= past.length * 0.7 ? 'ok' : 'warn'}">${okDays.length} / ${past.length}</div><div class="small muted">dnů uzavřených v pořádku · ${logged.length} se zápisem · ${past.length - logged.length} prázdných</div></div>
    <div class="card tint"><h3>Chůze</h3><div style="font-size:30px;font-weight:900;margin:6px 0" class="${logged.length && walkOk / logged.length >= 0.7 ? 'ok' : 'warn'}">${pct(walkOk, logged.length)}</div><div class="small muted">dnů s ${s.walk_min}+ min · průměr ${fmt0(walkAvg)} min/den</div></div>
    <div class="card tint"><h3>Vážení a jídla</h3><div style="font-size:30px;font-weight:900;margin:6px 0" class="${noWeigh.length <= 2 ? 'ok' : 'bad'}">${noWeigh.length} <span style="font-size:14px;font-weight:600">bez vážení</span></div><div class="small muted">odkliknuto ${eatenTotal} z ${logged.length * 5} jídel · limit v ${pct(withFood.filter(r => !r.cheats.over).length, withFood.length)} dnů s jídlem</div></div>
    <div class="card tint"><h3>Cheaty</h3><div style="font-size:30px;font-weight:900;margin:6px 0" class="${cheats.over ? 'bad' : 'ok'}">${cheats.over} <span style="font-size:14px;font-weight:600">dnů přes limit</span></div><div class="small muted">🍺 ${cheats.beers} piv · 🍟 ${fmt0(cheats.fried)} g · ${cheats.edits} ručních úprav · ${cheats.situace}× „situace“ · ${cheats.skipped}× vynecháno</div></div>
  </div>
  <div class="card"><h2>Týdny</h2><div class="tbl"><table class="small" style="margin-top:6px"><tr><th>Týden od</th><th>Dny (zeleně OK)</th><th class="n">OK / zapsáno</th><th class="n">Vážení</th><th class="n">Ø chůze</th><th class="n">Piva</th><th class="n">Přes limit</th><th class="n">Plán</th><th class="n">Ø váha</th><th class="n">Změna</th></tr>
    ${weeks.map(w => `<tr><td class="b" style="white-space:nowrap">${czDateShort(w.mon)}${w.mon === thisMon ? ' <span class="muted">(teď)</span>' : ''}</td><td style="min-width:160px"><div class="wkcells">${w.cells.map((c, i) => `<div class="d${c}">${DAY_SHORT[i]}</div>`).join('')}</div></td><td class="n ${w.logged && w.ok / w.logged >= 0.7 ? 'ok' : ''}">${w.ok} / ${w.logged}</td><td class="n ${w.weigh < w.days ? 'warn' : 'ok'}">${w.weigh}/${w.days}</td><td class="n">${w.logged ? fmt0(w.walk) + ' min' : '–'}</td><td class="n ${w.beers > 3 ? 'warn' : ''}">${w.beers}</td><td class="n ${w.over ? 'bad' : ''}">${w.over}</td><td class="n ${w.planned >= 35 ? 'ok' : 'warn'}">${w.planned}/35</td><td class="n">${w.wAvg != null ? fmt1(w.wAvg) : '–'}</td><td class="n ${w.delta != null ? (w.delta < 0 ? 'ok b' : 'bad b') : ''}">${w.delta != null ? (w.delta > 0 ? '+' : '') + fmt2(w.delta) : ''}</td></tr>`).join('')}</table></div>
    <p class="hint">Barvy dnů: zelená = v pořádku, červená = nesedí, žlutá = dnešek (běží), šedá = bez zápisu.</p></div>
  <div class="grid g2">
    <div class="card"><h2>Váha proti plánu</h2>${lineChart({ series: [{ name: 'plán', color: '#9aa7ab', dash: true, pts: Array.from({ length: Math.max(84, (ov.last ? ov.last.idx : 0) + 14) + 1 }, (_, i) => [i, planWeightAt(s, i)]) }, { name: 'ranní váha', color: '#a8c6e4', pts: ov.rows.map(r => [r.idx, r.weight]), thin: true }, { name: 'průměr 7 dní', color: '#1478d4', pts: ov.rows.map(r => [r.idx, r.avg]), dots: true }], xLabel: 'dní od startu', yUnit: 'kg', h: 230, hLine: { y: s.goal_weight, label: 'cíl ' + s.goal_weight, color: '#16a34a' } })}</div>
    <div class="card"><h2>Příjem proti limitu (${N} dní)</h2>${intakePts.length ? lineChart({ series: [{ name: 'limit dne', color: '#9aa7ab', dash: true, pts: limitPts }, { name: 'příjem', color: '#c81f2b', pts: intakePts, dots: true }], xLabel: 'dny (0 = před ' + (N - 1) + ' dny)', yUnit: 'kcal', h: 230 }) : '<p class="muted small">Zatím žádný den s jídlem.</p>'}
      <h3 style="margin-top:12px">Chůze (minuty)</h3>${barChart(walkPts.map(p => p[1]), range.map(dt => DAY_SHORT[dayIndex(dt)]), s.walk_min)}</div>
  </div>
  <div class="grid g2">
    <div class="card"><h2>Posledních ${N} dní</h2><div class="tbl"><table class="small" style="margin-top:6px"><tr><th>Den</th><th class="n">Váha</th><th class="n">Příjem / limit</th><th class="n">Bílk.</th><th class="n">Chůze</th><th class="n">👣</th><th class="n">Jídla</th><th>Stav</th></tr>
      ${rows.slice().reverse().map(r => { const m = measBy[r.dt]; return `<tr><td class="n" style="text-align:left">${czDateShort(r.dt)} <span class="muted">${DAY_SHORT[dayIndex(r.dt)]}</span></td><td class="n">${m && m.weight != null ? fmt1(m.weight) : '<span class="muted">–</span>'}</td>
        ${r.none ? '<td class="n muted" colspan="5">bez zápisu</td><td></td>' : `<td class="n ${r.hasFood ? (r.cheats.over ? 'bad' : 'ok') : 'muted'}">${r.hasFood ? `${fmt0(r.d.intake)} / ${fmt0(r.d.base.maxIntake)}` : '–'}${r.cheats.beers ? ` <span class="warn">🍺${r.cheats.beers}</span>` : ''}${r.cheats.fried ? ` <span class="warn">🍟</span>` : ''}</td><td class="n ${r.hasFood ? (r.d.tot.p >= r.d.protTarget ? 'ok' : 'bad') : ''}">${r.hasFood ? fmt0(r.d.tot.p) : ''}</td><td class="n ${r.walkOk ? 'ok' : 'bad'}">${r.walk} min</td><td class="n muted">${fmt0(daySteps(r.day))}</td><td class="n">${r.eaten}/5</td><td class="${r.closed ? (r.closedOk ? 'ok' : 'bad') : 'warn'}">${r.closed ? (r.closedOk ? 'OK' : 'nesedí') : 'dnes'}${r.cheats.edits ? ` <span class="muted">· ${r.cheats.edits} úprav</span>` : ''}</td>`}</tr>`; }).join('')}</table></div>
      <div class="row" style="margin-top:8px"><button class="btn sec sm" onclick="go('dnes')">Otevřít jeho Dnes</button><button class="btn sec sm" onclick="go('tyden')">Jeho Týden</button></div></div>
    <div>
     <div class="card"><h3>Poslední obvody${lw ? ` · ${czDate(lw.date)}` : ''}</h3>${lw ? `<div class="kpi" style="margin-top:6px"><div class="acc"><div class="v">${lw.waist ?? '–'}</div><div class="l">pas (cíl ${s.goal_waist})</div></div><div><div class="v">${lw.hips ?? '–'}</div><div class="l">boky</div></div><div><div class="v">${lw.chest ?? '–'}</div><div class="l">hrudník</div></div><div><div class="v">${lw.thigh ?? '–'}</div><div class="l">stehno</div></div><div><div class="v">${lw.arm ?? '–'}</div><div class="l">paže</div></div></div>` : '<p class="muted small">Zatím žádné obvody.</p>'}
      <p class="small muted" style="margin-top:8px">Fáze chůze: ${esc(ov.phase)} · pas/výška ${ov.waistRatio != null ? fmt2(ov.waistRatio) : '–'} (cíl pod 0,50)</p></div>
     <div class="card"><h3>Co vidí Robert</h3><div style="margin-top:6px">${praise(today).map(p => `<div class="praise ${p.tone}" style="margin-bottom:6px;padding:10px 12px"><span class="em" style="font-size:20px">${p.em}</span><div class="small">${esc(p.text)}</div></div>`).join('')}</div>
      <div class="small muted">Série: ${streakOk()} dnů OK v řadě · ${weighStreak()} dnů vážení v řadě</div></div>
     <div class="card"><h3>Správa dat</h3><p class="small muted" style="margin:4px 0 8px">Naplnění je bezpečné opakovat – záznamy se párují podle id. Vážení ze sešitu si nahraje Robert sám v Účtu (trenér do jeho zápisů nepíše).</p>
      <div class="row"><button class="btn sec sm" onclick="A.seedAll()">Naplnit výchozí data</button>${Store.localMode() ? '<button class="btn sec sm" onclick="A.seedMeas()">Nahrát 14 vážení ze sešitu</button>' : ''}</div></div>
    </div>
  </div>`;
};
A.seedAll = () => UI.confirm('Nahrát 200 receptů, 196 surovin a výchozí nastavení ze sešitu do databáze?', () => {
  SEED.foods.forEach(f => { const { id, ...data } = f; Store.put('foods', id, data, null); });
  SEED.recipes.forEach(r => { const { id, ...data } = r; Store.put('recipes', id, data, null); });
  if (!settingsRec()) saveSettings({ ...SEED.settings });
  UI.toast('Výchozí data nahrána'); render();
});
A.seedMeas = () => UI.confirm('Nahrát 14 vážení a obvody (27. 8. – 9. 9. 2026) ze sešitu jako klientovu historii?', () => {
  SEED.measurements.forEach(m => saveMeas({ ...m, note: m.note && m.note.startsWith('START') ? 'start' : m.note }));
  UI.toast('Vážení nahrána'); render();
});

/* ---------- NASTAVENÍ ---------- */
VIEWS.nastaveni = function () {
  const s = S();
  const f = (k, l, note, step = 'any') => `<div class="in"><label class="f">${l}</label><input type="number" step="${step}" id="st_${k}" value="${s[k]}"><div class="tiny muted">${note}</div></div>`;
  return `<h1 style="margin-bottom:6px">Nastavení</h1><p class="small muted" style="margin-bottom:10px">Tohle nastavuje trenér. Změna se propíše do všech výpočtů klienta. Aktuální váhu tu nenajdeš – ta se počítá z Měření jako průměr posledních sedmi vážení.</p>${(() => { const al = settingsAdvice().filter(a => a.lv <= 2); return al.length ? `<div class="card"><h2>Doporučení${help('Appka porovnává nastavení s Robertovými daty (kroky, tempo hubnutí, váha) a s doporučenými rozsahy. Tlačítko použije doporučenou hodnotu; vždy jde vrátit Zpět.')}</h2>${al.map(a => `<div class="alert a${a.lv}" style="margin-top:8px"><div style="flex:1">${esc(a.text)}</div>${a.apply ? `<button class="btn sm" onclick="A.applyAdvice(${JSON.stringify(JSON.stringify(a.apply)).replace(/"/g, '&quot;')})">${a.label}</button>` : ''}</div>`).join('')}</div>` : '<div class="alert a3" style="margin-bottom:10px">Nastavení odpovídá Robertovým datům i doporučeným rozsahům.</div>'; })()}
  <div class="grid g2">
   <div class="card"><h2>Kdo</h2><div class="grid" style="grid-template-columns:1fr 1fr;gap:10px;margin-top:8px">${f('height', 'Výška (cm)', 'měří se jednou')}${f('age', 'Věk', 'uprav na začátku roku')}${f('activity', 'Faktor běžné aktivity', 'sedavá práce a 5 000 kroků = 1,34 · pod 3 000 kroků 1,2 · 7 000 kroků 1,4 · 9 000+ 1,48', '0.01')}<div style="grid-column:1/-1">${adviceBox('activity')}</div><div class="in"><label class="f">Datum startu</label><input type="date" id="st_start_date" value="${s.start_date}"><div class="tiny muted">od něj se odvíjí kalendář vážení a plánovaná křivka</div></div></div></div>
   <div class="card"><h2>Cíle</h2><div class="grid" style="grid-template-columns:1fr 1fr;gap:10px;margin-top:8px">${f('start_weight', 'Startovní váha (kg)', 'váha na začátku, kvůli grafům se nemění', '0.1')}${f('goal_weight', 'Cílová váha (kg)', 'u téhle váhy se přepne na udržení', '0.1')}${f('goal_waist', 'Cílový obvod pasu (cm)', 'polovina výšky – uznávaný zdravotní práh')}${f('rate_pct', 'Cílové tempo (% váhy za týden)', 'řídí denní deficit; 0,5 až 1 % je udržitelné, nad 1 % ztráta svalu', '0.05')}<div style="grid-column:1/-1">${adviceBox('rate_pct')}${adviceBox('goal_weight')}${adviceBox('goal_waist')}</div></div><p class="small muted" style="margin-top:8px">Cíl úbytku za týden (u startovní váhy): <b>${fmt2(s.start_weight * s.rate_pct / 100)} kg</b> – dopočítá se.</p></div>
   <div class="card"><h2>Chůze a výživa</h2><div class="grid" style="grid-template-columns:1fr 1fr;gap:10px;margin-top:8px"><div class="in"><label class="f">Tempo chůze (km/h)</label><select id="st_walk_kmh">${SEED.met.map(([k, m]) => `<option value="${k}" ${k === s.walk_kmh ? 'selected' : ''}>${fmt1(k)} km/h (MET ${String(m).replace('.', ',')})</option>`).join('')}</select><div class="tiny muted">zvyš, až klient postoupí do další fáze</div></div>${f('walk_min', 'Denní cíl chůze (minut)', 'výchozí – platí, když den nemá tréninkový plán', '5')}${f('protein_min', 'Minimální bílkoviny (g)', `chrání sval v deficitu · doporučeno 1,6–2 g na kg cílové váhy = ${Math.round(1.6 * s.goal_weight)}–${Math.round(2 * s.goal_weight)} g`, '5')}<div style="grid-column:1/-1">${adviceBox('protein_min')}${adviceBox('walk_min')}</div></div></div>
   <div class="card"><h2>Cíle chodů (kcal)</h2><div class="grid" style="grid-template-columns:1fr 1fr;gap:10px;margin-top:8px">${s.courses.map((c, i) => `<div class="in"><label class="f">${c.name} · ${c.time}</label><input type="number" step="10" id="st_c${i}" value="${c.kcal}"></div>`).join('')}</div><p class="small muted" style="margin-top:8px">Součet: <b id="st_sum">${courseTargetSum(s)}</b> kcal za den. Poměr chodů určuje, jak se plánovací limit dělí mezi jídla; součet sám limit nemění.</p>${adviceBox('courses')}</div>
  </div>
  <div class="row"><button class="btn" onclick="A.saveSettings()">Uložit nastavení</button><span class="small muted">Fáze chůze a MET tabulka jsou pevné podle sešitu.</span></div>`;
};
A.saveSettings = () => {
  const s = S(); const g = k => Number($('#st_' + k).value);
  const d = { height: g('height'), age: g('age'), activity: g('activity'), start_weight: g('start_weight'), goal_weight: g('goal_weight'), goal_waist: g('goal_waist'), rate_pct: g('rate_pct'), walk_kmh: g('walk_kmh'), walk_min: g('walk_min'), protein_min: g('protein_min'), start_date: $('#st_start_date').value,
    courses: s.courses.map((c, i) => ({ ...c, kcal: g('c' + i) })) };
  if (!d.start_date || d.height < 100 || d.goal_weight >= d.start_weight) { UI.toast('Zkontroluj hodnoty (výška, váhy, datum)'); return; }
  saveSettings(d); UI.toast('Nastavení uloženo'); render();
};

/* ---------- RECEPTY A SUROVINY ---------- */
App.dbTab = 'recipes'; App.dbQ = ''; App.dbCourse = '';
VIEWS.databaze = function () {
  const foods = Foods(); const recipes = Recipes().filter(r => !r.own && !r.deleted); const fmap = Object.fromEntries(foods.map(f => [f.name, f]));
  const q = App.dbQ.toLowerCase();
  const seedNote = Store.db.foods.some(r => r.user_id == null) ? '' : `<div class="banner" style="margin-bottom:10px">Databáze běží z výchozích dat v aplikaci. Úprava položky ji uloží do cloudu; ostatní zůstanou výchozí. Pro úplnou kopii klikni v Přehledu klienta na „Naplnit výchozí data“.</div>`;
  let body;
  if (App.dbTab === 'recipes') {
    const list = recipeList(recipes); body = recipeFilterBar(recipes) + `<div class="card tight" style="margin-top:10px">${list.html}</div><p class="hint">Úpravy platí pro všechny. Přejmenování receptu se propíše do Robertových plánů.</p>`;
  } else { go('suroviny'); return ''; 
  }
  return `<h1 style="margin-bottom:8px">Recepty a suroviny${help('Globální databáze pro Roberta. Recepty i suroviny tady měníš pro všechny; Robertovy vlastní recepty, suroviny a jeho verze výchozích položek se nedotknou. Suroviny edituj na obrazovce Suroviny (stejný seznam).')}</h1>${seedNote}
  <div class="row" style="margin-bottom:10px"><div class="chips"><span class="chip ${App.dbTab === 'recipes' ? 'on' : ''}" onclick="App.dbTab='recipes';render()">Recepty (${recipes.length})</span><span class="chip ${App.dbTab === 'foods' ? 'on' : ''}" onclick="go('suroviny')">Suroviny (${foods.length}) ›</span></div>
    <span class="sp"></span><button class="btn sm" onclick="${App.dbTab === 'recipes' ? "A.editRecipe()" : "A.editFood()"}">${App.dbTab === 'recipes' ? 'Nový recept' : 'Nová surovina'}</button></div>${body}`;
};
A.editFood = (id, mode, after) => {
  const own = mode === 'own', over = mode === 'override'; const owner = (own || over) ? Store.ownerId() : null;
  const src = id ? Foods().find(x => x.id === id) : null;
  const f = src ? { ...src } : { id: own ? oid('food', Date.now()) : 'f:' + Date.now(), cat: 'Ostatní', name: '', kcal: '', p: '', c: '', f: '' };
  if (over) { f.saveId = src.ovId || oid('ov', src.id); f.overrides = src.id; }
  const cats = [...new Set(Foods().map(x => x.cat))];
  const m = UI.modal(`<h2>${over ? 'Moje verze suroviny' : (id ? 'Upravit surovinu' : (own ? 'Moje surovina' : 'Nová surovina'))}</h2><p class="small muted" style="margin:4px 0 8px">Hodnoty na 100 g (nebo 100 ml) z obalu.${own ? ' Uvidíš ji jen ty a půjde použít v tvých receptech i při přidávání surovin.' : ''}${over ? ' Změna platí jen pro tebe – trenérova databáze zůstává. Název se nemění.' : ''}</p>
    <div class="grid" style="grid-template-columns:1fr 1fr;gap:8px"><div class="in"><label class="f">Kategorie</label><select id="fc">${cats.map(c => `<option ${c === f.cat ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div><div class="in"><label class="f">Název</label><input type="text" id="fn" value="${esc(f.name)}"></div>
    <div class="in"><label class="f">kcal</label><input type="number" id="fk" value="${f.kcal}"></div><div class="in"><label class="f">Bílkoviny (g)</label><input type="number" step="0.1" id="fp" value="${f.p}"></div><div class="in"><label class="f">Sacharidy (g)</label><input type="number" step="0.1" id="fs" value="${f.c}"></div><div class="in"><label class="f">Tuky (g)</label><input type="number" step="0.1" id="ff" value="${f.f}"></div></div>
    <div class="row" style="margin-top:12px"><button class="btn" id="fsave">Uložit</button><button class="btn sec" onclick="UI.closeModal()">Zavřít</button>${id ? `<span class="sp"></span><button class="btn danger sm" id="fdel">${over ? 'Vrátit původní' : 'Smazat'}</button>` : ''}</div><div class="small muted" id="fuse" style="margin-top:8px"></div>`, { guardEdits: true });
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
  else if (del) del.onclick = () => { const used = Recipes().filter(r => r.items.some(it => it.food === f.name)); if (used.length) { UI.toast(`Nelze smazat – používá ji ${used.length} receptů`); return; } UI.confirm('Smazat surovinu?', () => { if (!own) Store.put('foods', f.id, { ...f }, null); Store.remove('foods', f.id); m.remove(); render(); }); };
};
