/* ===== Obrazovky Roberta ===== */
const VIEWS = {};

/* ---------- MĚŘENÍ ---------- */
App.measDate = todayISO();
VIEWS._mereni = function () {
  const s = S(), ov = calcOverview(s, Meas());
  const meas = Meas(); const byDate = Object.fromEntries(meas.map(m => [m.date, m]));
  const rows = ov.rows; const rowMap = Object.fromEntries(rows.map(r => [r.date, r]));
  const sel = App.measDate; const cur = byDate[sel] || { date: sel };
  const isSun = dayIndex(sel) === 6;
  const today = todayISO();
  const last = addDays(today, 1) > s.start_date ? today : s.start_date;
  const dates = []; for (let d = last; d >= s.start_date && dates.length < 400; d = addDays(d, -1)) dates.push(d);
  const missing = dates.filter(d => d !== today && !byDate[d]).length;
  const inp = (f, l, step = '0.1') => `<div class="in"><label class="f">${l}</label>${stepper('m_' + f, cur[f] ?? '', Number(step), 0)}</div>`;
  return `
  ${flow('mereni', ['Ráno po WC, nalačno', 'Zapiš váhu', 'V neděli i obvody'], 'Jedno číslo z rána nic neznamená – appka počítá s průměrem posledních sedmi vážení.')}
  <div class="row between" style="margin-bottom:8px"><h1>Měření${help('Váha každé ráno po WC, nalačno. Jedno číslo nic neznamená – appka počítá průměr posledních 7 vážení. Obvody stačí v neděli, vždy stejné místo. Zápis, který vybočuje o víc než 2 kg, se před uložením zeptá.')}</h1><span class="small muted">start ${czDate(s.start_date)}${ov.last ? ` · ${ov.count} vážení` : ''}</span></div>
  <div class="grid g23">
   <div>
    <div class="card">
     <div class="kpi"><div><div class="v">${fmt1(ov.cur)}</div><div class="l">kg · průměr 7 vážení</div></div>
       <div><div class="v">${ov.last ? fmt1(ov.last.weight) : '–'}</div><div class="l">poslední zápis${ov.last ? ' ' + czDateShort(ov.last.date) : ''}</div></div>
       <div><div class="v">${fmt1(ov.last ? ov.last.bmi : s.start_weight / Math.pow(s.height / 100, 2))}</div><div class="l">BMI</div></div>
       <div><div class="v ${ov.dev != null ? (ov.dev >= 0 ? 'ok' : 'bad') : ''}">${ov.dev != null ? (ov.dev >= 0 ? '+' : '−') + fmt1(Math.abs(ov.dev)) : '–'}</div><div class="l">kg proti plánu</div></div></div>
    </div>
    <div class="card">
     <h2>${sel === today ? 'Dnešní zápis' : 'Zápis ' + czDate(sel)} <span class="muted small" style="font-weight:400">${DAY_NAMES[dayIndex(sel)]}</span></h2>
     <p class="small muted" style="margin:4px 0 10px">Po probuzení, po WC, nalačno. ${isSun ? 'Neděle – změř i obvody: ráno nalačno, uvolněné břicho, vždy stejné místo.' : 'Obvody stačí v neděli.'}</p>
     <div class="row" style="margin-bottom:8px"><input type="date" value="${sel}" min="${s.start_date}" style="width:auto" onchange="App.measDate=this.value;render()"></div>
     <div class="grid mgrid" style="grid-template-columns:1fr 1fr;gap:8px">${inp('weight', 'Váha (kg)')}${inp('waist', 'Pas (cm)', '0.5')}${inp('hips', 'Boky (cm)', '0.5')}${inp('chest', 'Hrudník (cm)', '0.5')}${inp('thigh', 'Stehno (cm)', '0.5')}${inp('arm', 'Paže (cm)', '0.5')}</div>
     <div class="in" style="margin-top:8px"><label class="f">Poznámka</label><input type="text" id="m_note" value="${esc(cur.note || '')}"></div>
     <div class="row" style="margin-top:10px"><button class="btn write" onclick="A.saveMeas()">Uložit zápis</button>${byDate[sel] ? `<button class="btn sec sm write" onclick="A.delMeas('${sel}')">Smazat</button>` : ''}</div>
    </div>
    ${missing ? `<div class="banner">Chybí ${missing} ${missing === 1 ? 'zápis' : (missing < 5 ? 'zápisy' : 'zápisů')} od startu. Klikni na řádek v tabulce a doplň, co si pamatuješ – nebo nech být, průměr si poradí.</div>` : ''}
   </div>
   <div class="card tight"><div class="tbl"><table class="small">
    <tr><th>Datum</th><th class="hm"></th><th class="n">Váha</th><th class="n">Ø 7 dní</th><th class="n">Shozeno</th><th class="n hm">Plán</th><th class="n hm">Pas</th><th class="n hm">Boky</th><th class="n hm">Hrud.</th><th class="n hm">Steh.</th><th class="n hm">Paže</th></tr>
    ${dates.map(d => { const m = byDate[d], r = rowMap[d]; const wk = Math.floor(daysBetween(s.start_date, d) / 7);
      return `<tr class="${dayIndex(d) === 6 ? 'sun' : ''} ${d === today ? 'today' : ''}" style="cursor:pointer" onclick="App.measDate='${d}';render()">
        <td>${czDateShort(d)} <span class="muted">${DAY_SHORT[dayIndex(d)]}</span></td><td class="muted tiny hm">${wk}. t.</td>
        <td class="n">${m && m.weight != null ? fmt1(m.weight) : '<span class="muted">–</span>'}</td><td class="n">${r ? fmt1(r.avg) : ''}</td><td class="n">${r ? fmt1(r.lost) : ''}</td><td class="n muted hm">${fmt1(planWeightAt(s, daysBetween(s.start_date, d)))}</td>
        <td class="n hm">${m && m.waist != null ? m.waist : ''}</td><td class="n hm">${m && m.hips != null ? m.hips : ''}</td><td class="n hm">${m && m.chest != null ? m.chest : ''}</td><td class="n hm">${m && m.thigh != null ? m.thigh : ''}</td><td class="n hm">${m && m.arm != null ? m.arm : ''}</td></tr>`; }).join('')}
   </table></div></div>
  </div>`;
};
A.saveMeas = () => {
  /* Robert píše na české klávesnici čárku – „131,4“ se dřív tiše zahodilo. */
  const MEZ = { weight: [30, 400], waist: [40, 250], hips: [40, 250], chest: [40, 250], thigh: [20, 150], arm: [10, 100] };
  let upraveno = null;
  const g = f => { const el = $('#m_' + f); const r = omez(el ? el.value : '', MEZ[f][0], MEZ[f][1]); if (r.mimo) upraveno = f; return r.n; };
  const m = { date: App.measDate, weight: g('weight'), waist: g('waist'), hips: g('hips'), chest: g('chest'), thigh: g('thigh'), arm: g('arm'), note: $('#m_note').value || null };
  if (upraveno) { UI.toast('Tohle číslo mi nesedí – zkontroluj ho, zapsal jsem nejbližší rozumnou hodnotu.'); }
  if (m.weight == null && m.waist == null) { UI.toast('Zapiš aspoň váhu'); return; }
  const pl = m.weight != null ? weightPlausible(m.weight, m.date) : { ok: true };
  if (!pl.ok && !A._forceMeas) { const mm = UI.modal(`<h2>Sedí to?</h2><p class="muted" style="margin-top:8px">Zapisuješ <b>${fmt1(m.weight)} kg</b>, ale průměr posledních dnů je <b>${fmt1(pl.prev.avg)} kg</b> (rozdíl ${(pl.diff > 0 ? '+' : '−') + fmt1(Math.abs(pl.diff))} kg je nezvyklý). Překlep, nebo jiná váha?</p><div class="row" style="margin-top:12px"><button class="btn sec" onclick="UI.closeModal()">Opravím</button><button class="btn" id="mfy">Je to správně, ulož</button></div>`); mm.querySelector('#mfy').onclick = () => { mm.remove(); A._forceMeas = true; A.saveMeas(); A._forceMeas = false; }; return; }
  Undo.run('Zápis měření', () => { saveMeas(m); render(); }, () => { const ov = calcOverview(S(), Meas()); return `Zápis uložen. Průměr 7 dní ${fmt1(ov.cur)} kg${ov.dev != null ? (ov.dev >= 0 ? `, ${fmt2(ov.dev)} kg před plánem.` : `, ${fmt2(-ov.dev)} kg za plánem.`) : '.'}`; });
};
A.delMeas = d => UI.confirm(`Smazat zápis z ${czDate(d)}?`, () => A.delMeas0(d), 'Smazat');
A.delMeas0 = d => Undo.run('Smazat zápis', () => { Store.remove('measurements', oid('m', d)); render(); }, `Zápis z ${czDate(d)} smazán.`);

/* ---------- PŘEHLED ---------- */
VIEWS._prehled = function () {
  const s = S(), meas = Meas(), ov = calcOverview(s, meas);
  const b = calcBase(s, ov.cur, s.walk_min, 0, s.walk_kmh, 0, 0);
  const T = SEED.texts.prehled;
  const dots = Math.round(ov.progress * 28);
  const wRows = ov.rows;
  const planPts = [], realPts = [];
  const horizon = Math.max(84, (ov.last ? ov.last.idx : 0) + 14);
  for (let i = 0; i <= horizon; i += 1) planPts.push([i, planWeightAt(s, i)]);
  wRows.forEach(r => realPts.push([r.idx, r.avg]));
  const rawPts = wRows.map(r => [r.idx, r.weight]);
  const waistRows = meas.filter(m => m.waist != null).sort((a, b2) => a.date < b2.date ? -1 : 1).map(m => [daysBetween(s.start_date, m.date), m.waist]);
  const circ = k => meas.filter(m => m[k] != null).sort((a, b2) => a.date < b2.date ? -1 : 1).map(m => [daysBetween(s.start_date, m.date), m[k]]);
  const fmtReal = v => typeof v === 'number' ? fmt2(v) : v;
  return `
  ${flow('prehled', ['Podívej se, jak si vedeš', 'Porovnej plán a skutečnost', 'Sleduj trend, ne jeden den'], 'Rozhoduje čára, ne tečka. Když jsi pod plánem dva týdny v řadě, řekni to trenérovi.')}
  <h1 style="margin-bottom:8px">Přehled${help('Jak jsi na cestě: aktuální váha (průměr 7 dní), kolik je dole a kolik zbývá, prognóza data cíle z tvého skutečného tempa, týdenní ohlédnutí a grafy. Plánovaná křivka = 0,7 % váhy týdně od startu.')}</h1>
  <div class="card">
   <div class="kpi"><div><div class="v">${fmt1(ov.cur)}</div><div class="l">váha (kg) · průměr 7 vážení</div></div><div><div class="v ok">${fmt1(ov.lost)}</div><div class="l">shozeno (kg)</div></div><div><div class="v">${fmt1(ov.remaining)}</div><div class="l">zbývá (kg)</div></div><div><div class="v">${Math.round(ov.progress * 100)} %</div><div class="l">cesty za tebou</div></div></div>
   <div class="bar" style="margin:12px 0 6px"><i style="width:${ov.progress * 100}%"></i></div>
   <div class="small muted">${String(s.start_weight).replace('.', ',')} kg → ${s.goal_weight} kg · pas pod ${s.goal_waist} cm${help(T.avg_note)}</div>
  </div>

  <div class="card"><h2>Jak si vedeš${help('Vlevo co říká plán, vpravo co ukazuje váha. Prognóza vychází z dosavadního tempa – ke konci se hubnutí vždycky zpomalí, takže reálné datum bývá o něco později.')}</h2>
   <div class="rings">
     ${ring(clamp((s.start_weight - ov.cur) / Math.max(1, s.start_weight - s.goal_weight) * 100, 0, 100), fmt0(clamp((s.start_weight - ov.cur) / Math.max(1, s.start_weight - s.goal_weight) * 100, 0, 100)) + ' %', 'cesty k cíli · zbývá ' + fmt1(Math.max(0, ov.cur - s.goal_weight)) + ' kg', 'var(--p)')}
     ${ring(ov.avgWeekLoss != null ? clamp(ov.avgWeekLoss / Math.max(0.01, ov.cur * s.rate_pct / 100) * 100, 0, 130) : 0, ov.avgWeekLoss != null ? fmt0(ov.avgWeekLoss / Math.max(0.01, ov.cur * s.rate_pct / 100) * 100) + ' %' : '–', 'tempa proti plánu · ' + (ov.avgWeekLoss != null ? fmt2(ov.avgWeekLoss) : '–') + ' z ' + fmt2(ov.cur * s.rate_pct / 100) + ' kg', ov.avgWeekLoss != null && ov.avgWeekLoss >= ov.cur * s.rate_pct / 100 * 0.9 ? 'var(--ok)' : 'var(--y)')}
     ${ring(clamp(ov.count / Math.max(1, (ov.daysSinceStart || 1)) * 100, 0, 100), ov.count + '×', 'vážení z ' + (ov.daysSinceStart ?? '–') + ' dní', 'var(--carb)')}
     <div class="ring" style="display:flex;flex-direction:column;justify-content:center;align-items:center;gap:4px">
       ${spark(ov.rows.slice(-14).map(r => r.avg), 'var(--p)')}
       <div class="rlab">trend průměru za 14 dní<br><b>${ov.rows.length > 1 ? (ov.rows[ov.rows.length - 1].avg <= ov.rows[0].avg ? 'jde dolů' : 'jde nahoru') : '–'}</b></div></div>
   </div>
   <div style="margin-top:14px"><div class="small muted" style="font-weight:700;margin-bottom:2px">Úbytek za týden: plán proti skutečnosti</div>
     ${dualBar(ov.cur * s.rate_pct / 100, ov.avgWeekLoss || 0, Math.max(ov.cur * s.rate_pct / 100, ov.avgWeekLoss || 0) * 1.15, ' kg')}</div>
   <table class="small vs" style="margin-top:14px"><tr><th>Ukazatel</th><th class="n">Plán</th><th class="n">Skutečnost</th></tr>
    <tr><td>Váha</td><td class="n">${fmt1(planWeightAt(s, ov.daysSinceStart || 0))} kg</td><td class="n b">${fmt1(ov.cur)} kg</td></tr>
    <tr><td>Shozeno od startu</td><td class="n">${fmt1(Math.max(0, s.start_weight - planWeightAt(s, ov.daysSinceStart || 0)))} kg</td><td class="n b ${ov.dev != null && ov.dev >= 0 ? 'ok' : 'bad'}">${fmt1(Math.max(0, s.start_weight - ov.cur))} kg</td></tr>
    <tr><td>Úbytek za týden</td><td class="n">${fmt2(ov.cur * s.rate_pct / 100)} kg</td><td class="n b">${ov.avgWeekLoss != null ? fmt2(ov.avgWeekLoss) + ' kg' : 'zatím málo dat'}</td></tr>
    <tr><td>Cíl dosažen</td><td class="n">${(() => { for (let i = 0; i < 1500; i++) if (planWeightAt(s, i) <= s.goal_weight) return czDate(addDays(s.start_date, i)); return '–'; })()}</td><td class="n b">${ov.forecast || '–'}</td></tr>
    <tr><td>Pas</td><td class="n">${s.goal_waist} cm (cíl)</td><td class="n b">${(() => { const m = Meas().filter(x => x.waist).sort((a, b) => b.date.localeCompare(a.date))[0]; return m ? fmt1(m.waist) + ' cm' : '–'; })()}</td></tr>
    <tr><td>Pas dělený výškou</td><td class="n">pod 0,50</td><td class="n b">${ov.waistRatio != null ? fmt2(ov.waistRatio) : '–'}</td></tr>
    <tr><td>Cílová váha</td><td class="n">${s.goal_weight} kg</td><td class="n">zbývá ${fmt1(Math.max(0, ov.cur - s.goal_weight))} kg</td></tr>
    <tr><td>Vážení</td><td class="n">každé ráno</td><td class="n">${ov.count}× za ${ov.daysSinceStart ?? '–'} dní</td></tr></table>
   <div class="obv" style="margin-top:14px"><div class="small muted" style="font-weight:700;margin-bottom:6px">Obvody od startu${help('Když váha týden stojí a pas jde dolů, děje se přesně to, co má – ubývá tuk a drží se svaly. Proto se obvody sledují vedle váhy, ne místo ní.')}</div>
     <div class="rings">${['waist,pas', 'hips,boky', 'chest,hrudník', 'thigh,stehno', 'arm,paže'].map(x => { const [k, lab] = x.split(','); const rs = Meas().filter(m => m[k] != null).sort((a, b) => a.date.localeCompare(b.date)); if (!rs.length) return ''; const prvni = rs[0][k], posl = rs[rs.length - 1][k], d = posl - prvni;
       return `<div class="ring okruh"><div class="ov">${fmt1(posl)}<small> cm</small></div><div class="rlab">${lab}${rs.length > 1 ? `<br><b class="${Math.abs(d) < 0.05 ? 'muted' : (d < 0 ? 'ok' : 'bad')}">${Math.abs(d) < 0.05 ? 'beze změny' : (d < 0 ? '−' : '+') + fmt1(Math.abs(d)) + ' cm'}</b>` : ''}</div></div>`; }).join('') || '<p class="muted small">Zatím žádné obvody. Změř se v neděli – pas, boky, hrudník, stehno, paže.</p>'}</div></div>
   <details style="margin-top:12px"><summary class="small" style="cursor:pointer;font-weight:700">Pas a ostatní obvody v grafu</summary>
     <div style="margin-top:8px">${waistRows.length ? lineChart({ series: [{ name: 'pas (cm)', color: '#1478d4', pts: waistRows, dots: true }], xLabel: 'dní od startu', yUnit: 'cm', hLine: { y: s.goal_waist, label: 'cíl ' + s.goal_waist + ' cm', color: '#2f8f5b' }, h: 220 }) : '<p class="muted small">Zatím žádný obvod pasu. Změř v neděli.</p>'}</div>
     <div style="margin-top:8px">${lineChart({ series: [{ name: 'boky', color: '#1478d4', pts: circ('hips'), dots: true }, { name: 'hrudník', color: '#5b8c3e', pts: circ('chest'), dots: true }, { name: 'stehno', color: '#b7791f', pts: circ('thigh'), dots: true }, { name: 'paže', color: '#8a5a9e', pts: circ('arm'), dots: true }], xLabel: 'dní od startu', yUnit: 'cm', h: 220 })}</div></details>
   <details style="margin-top:8px"><summary class="small" style="cursor:pointer;font-weight:700">Plán proti realitě po týdnech</summary><p class="small muted" style="margin:4px 0 8px">${T.plan_vs_reality_intro.replace('0,70', String(s.rate_pct).replace('.', ','))}</p>
    <table class="small"><tr><th>Za jak dlouho</th><th class="n">Teoreticky</th><th class="n">Reálně čekej</th><th class="n">Skutečnost</th></tr>
    ${ov.pvr.map(r => `<tr><td>${r.weeks} ${r.weeks === 1 ? 'týden' : (r.weeks < 5 ? 'týdny' : 'týdnů')}</td><td class="n">${fmt2(r.theory)} kg</td><td class="n">${fmt2(r.expect)} kg</td><td class="n ${typeof r.real === 'number' ? (r.real >= r.expect ? 'ok b' : 'bad b') : 'muted'}">${fmtReal(r.real)}${typeof r.real === 'number' ? ' kg' : ''}</td></tr>`).join('')}</table></details>
   <details style="margin-top:8px"><summary class="small" style="cursor:pointer;font-weight:700">Cíle a čísla plánu</summary><table class="small" style="margin-top:6px"><tr><td>Výška</td><td class="n">${s.height} cm</td></tr><tr><td>Startovní váha</td><td class="n">${s.start_weight} kg</td></tr><tr><td>Cílová váha</td><td class="n">${s.goal_weight} kg</td></tr><tr><td>Cíl úbytku za týden</td><td class="n">${fmt2(ov.weekTarget)} kg (${String(s.rate_pct).replace('.', ',')} % váhy)</td></tr><tr><td>Cílový obvod pasu</td><td class="n">${s.goal_waist} cm</td></tr><tr><td>Minimální bílkoviny</td><td class="n">${s.protein_min} g</td></tr><tr><td>Denní cíl chůze</td><td class="n">${s.walk_min} min · ${fmt1(s.walk_kmh)} km/h</td></tr></table></details>
   <p class="hint" style="margin-top:8px">Jsi ${ov.dev != null ? (ov.dev >= 0 ? '<b class="ok">před plánem o ' + fmt2(ov.dev) + ' kg</b>' : '<b class="bad">za plánem o ' + fmt2(-ov.dev) + ' kg</b>') : 'zatím bez srovnání'}. ${T.prognosis_note}</p></div>
  <div class="card"><h2>Týdenní ohlédnutí</h2><div class="status st${ov.weekBack.state}" style="margin-top:8px">${esc(ov.weekBack.text)}</div><p class="hint">${T.week_note}</p></div>
  <div class="card"><h2>Váha proti plánu</h2>
   ${lineChart({ series: [{ name: 'plán', color: '#9aa7ab', dash: true, pts: planPts }, { name: 'ranní váha', color: '#a8c6e4', pts: rawPts, thin: true }, { name: 'průměr 7 dní', color: '#1478d4', pts: realPts, dots: true }], xLabel: 'dní od startu', yUnit: 'kg', hLine: { y: s.goal_weight, label: 'cíl ' + s.goal_weight + ' kg', color: '#2f8f5b' }, marks: (s.log || []).map(l => ({ x: daysBetween(s.start_date, l.at), label: l.pop.split(' ')[0] + ' ' + l.to })) })}
  </div>`;
};

/* ---------- TÝDEN ---------- */
function weekToggle() {
  const thisMon = mondayOf(todayISO()), nextMon = addDays(thisMon, 7);
  if (App.week !== thisMon && App.week !== nextMon) App.week = thisMon;
  return `<div class="chips noprint"><span class="chip ${App.week === thisMon ? 'on' : ''}" onclick="App.week='${thisMon}';render()">Tento týden · ${czDateShort(thisMon)}–${czDateShort(addDays(thisMon, 6))}</span><span class="chip ${App.week === nextMon ? 'on' : ''}" onclick="App.week='${nextMon}';render()">Příští týden · ${czDateShort(nextMon)}–${czDateShort(addDays(nextMon, 6))}</span></div>`;
}
/* Motivační hlášky k týdnu podle stavu */
function weekMessages(days, s, filled, w) {
  const M = []; const okDays = days.filter(d => d.r.state === 2).length, bad = days.filter(d => d.r.state === 1 && d.r.filled === 5), sit = days.reduce((a, d) => a + d.sels.filter(x => x === SITUACE).length, 0);
  const totalDef = days.filter(d => d.r.filled === 5).reduce((a, d) => a + (d.r.planLimit + calcBase(s, w, s.walk_min, 0, s.walk_kmh, 0, 0).deficit - d.r.kcal), 0);
  if (filled === 0) M.push({ tone: 'neutral', em: '🗓️', text: 'Prázdný týden. Deset minut plánování teď ti ušetří sedm dní rozhodování s prázdným žaludkem.' });
  else if (filled < 35) M.push({ tone: 'push', em: '✍️', text: `Chybí ${35 - filled} ${sklon(35 - filled, 'jídlo', 'jídla', 'jídel')}. Doplň je – bez plánu se den skládá naslepo a to je přesně chvíle, kdy se sáhne po něčem jiném.` });
  else if (okDays === 7) M.push({ tone: 'good', em: '🏆', text: `Všech sedm dní sedí do limitu. Tímto plánem jsi za týden dole o ${fmt2(totalDef / KG_KCAL)} kg – zbývá to jen sníst a dojít.` });
  else if (bad.length) M.push({ tone: 'push', em: '🎯', text: `${bad.length === 1 ? 'Jeden den' : bad.length + ' dny'} (${bad.map(d => DAY_NAMES[d.i]).join(', ')}) ${bad.length === 1 ? 'nesedí' : 'nesedí'}. Vyměň jednu variantu za lehčí a je to.` });
  else M.push({ tone: 'good', em: '👍', text: 'Týden je naplánovaný a sedí. Teď nákup, ať to není jen plán.' });
  if (sit >= 5) M.push({ tone: 'push', em: '🎲', text: `${sit}× „vyřeším podle situace“ – to je ${sit} loterií. Zkus aspoň polovinu nahradit konkrétním jídlem.` });
  else if (sit > 0 && filled === 35) M.push({ tone: 'neutral', em: '🎲', text: `${sit}× „podle situace“ – v pořádku, drž u nich cíl jídla a bílkovinu.` });
  const ws = weighStreak(), st = streakOk();
  if (st >= 3) M.push({ tone: 'good', em: '🔥', text: `${st} ${st < 5 ? 'dny' : 'dnů'} v řadě v pořádku. Plán je jen papír – ty ho plníš.` });
  return M;
}
VIEWS.tyden = function () {
  const s = S(), foods = Foods(), recipes = Recipes(), w = currentWeight();
  const toggle = weekToggle();
  const wk = getWeek(App.week); const today = todayISO();
  if (wk.auto && !wk.reviewed && !App.ro) { wk.reviewed = true; saveWeek(wk); }
  const days = wk.plan.map((sels, i) => ({ i, date: addDays(App.week, i), sels, r: calcPlanDay(effSettings(s, addDays(App.week, i)), foods, recipes, sels, w, planActFor(addDays(App.week, i), w)) }));
  const filled = days.reduce((a, d) => a + d.r.filled, 0);
  const full = days.filter(d => d.r.filled === 5);
  const base = calcBase(s, w, s.walk_min, 0, s.walk_kmh, 0, 0);
  const sumK = full.reduce((a, d) => a + d.r.kcal, 0), sumP = full.reduce((a, d) => a + d.r.p, 0);
  const weekDef = full.reduce((a, d) => a + (base.minOut - d.r.kcal), 0);
  const prev = getWeek(addDays(App.week, -7)); const prevHas = prev.plan.some(d => d.some(Boolean));
  const pbtn = (d, ci) => { const sel = d.sels[ci]; const cc = d.r.courses[ci]; const rem = d.r.planLimit - d.r.kcal + cc.kcal; const pg = d.r.protTarget - d.r.p + cc.p;
    return `<button class="pickbtn sm ${sel ? '' : 'empty'}" onclick="openPicker({courseKey:'${s.courses[ci].key}',current:${JSON.stringify(sel || '').replace(/"/g, '&quot;')},remaining:${Math.round(rem)},protGap:${Math.round(pg)},onPick:n=>A.planSel(${d.i},${ci},n)})"><span>${sel ? esc(sel) : '+ vybrat'}</span>${sel && sel !== SITUACE && sel !== VYNECHAT && isFav(sel) ? '<i class="star on">★</i>' : ''}</button>`; };
  const msgs = weekMessages(days, s, filled, w);
  /* Nesmí vedle sebe stát „týden sedí“ a „jeden den nesedí“ – nejdřív se řekne to horší. */
  const mism = days.filter(d => d.date >= today && dayMismatch(d.date));
  if (mism.length) msgs.unshift({ tone: 'push', em: '🏋️',
    text: `${mism.length} ${mism.length === 1 ? 'den nesedí' : (mism.length < 5 ? 'dny nesedí' : 'dnů nesedí')} s limitem – změnila se aktivita. Rozklikni den a dej „dorovnat“.` });
  // motivační statistiky
  const closed = days.filter(d => { const rec = Store.rows('days', Store.ownerId()).find(x => x.data.date === d.date); return rec && rec.data.closed; });
  const closedOk = closed.filter(d => Store.rows('days', Store.ownerId()).find(x => x.data.date === d.date).data.closedOk).length;
  const weighed = days.filter(d => Meas().some(m => m.date === d.date && m.weight != null)).length;
  const walked = days.reduce((a, d) => a + ((getDay(d.date).walk_min) || 0), 0);
  const isThis = App.week === mondayOf(today);

  return `${flow('tyden', ['Nech si navrhnout týden', 'Dolaď, co nechceš', 'Zkontroluj, že dny sedí', 'Běž nakoupit'], 'Plánuješ jen tento a příští týden. Den, který nesedí, má červený proužek – rozklikni ho a vyměň jedno jídlo.')}
  <div class="row between" style="margin-bottom:8px"><h1>Týden${help('Plán sedmi dní. Nech si ho navrhnout (💡) a jen dolaď, nebo vybírej ručně. U každého dne vidíš stav proti limitu toho dne – limit počítá s plánovanou chůzí a tréninkem. Z plánu se sám skládá Nákup i Vaření; na Dnes ti jídla naskočí automaticky.')}</h1>${toggle}</div>
  <div class="praise ${msgs[0].tone}"><span class="em">${msgs[0].em}</span><div>${esc(msgs[0].text)}${msgs[1] ? `<div class="small muted" style="margin-top:4px;font-weight:500">${msgs[1].em} ${esc(msgs[1].text)}</div>` : ''}</div></div>
  <div class="card"><div class="stats3 wk">
    <div><b class="${filled === 35 ? 'ok' : ''}">${filled} <small>/ 35</small></b><span>jídel naplánováno</span></div>
    <div><b>${full.length ? fmt0(sumK / full.length) : '–'}</b><span>kcal/den · limit ${fmt0(base.planLimit)}</span></div>
    <div><b>${full.length ? fmt0(sumP / full.length) : '–'} <small>g</small></b><span>bílkovin/den · min. ${s.protein_min}</span></div>
    <div><b class="ok">${full.length ? '−' + fmt2(weekDef / KG_KCAL * 7 / full.length) : '–'} <small>kg</small></b><span>za týden tímto plánem</span></div>
    ${isThis ? `<div><b>${closedOk} <small>/ ${closed.length}</small></b><span>dnů zatím v pořádku</span></div><div><b>${weighed} <small>/ 7</small></b><span>ranních vážení</span></div><div><b>${fmt0(walked)} <small>min</small></b><span>chůze (${fmt0(walked * base.walkPerMin)} kcal)</span></div>` : ''}
  </div></div>
  <div class="row noprint" style="margin-bottom:10px"><button class="btn sm write" onclick="A.genWeek('all')">💡 Naplánuj mi týden</button><span class="chip ${routineOn() ? 'on' : ''}" onclick="A.toggleRoutine()" title="stejná snídaně a svačina celý týden – méně vážení, dvě jídla zpaměti">${routineOn() ? '✓ ' : ''}rutina</span>${filled && filled < 35 ? `<button class="btn sec sm write" onclick="A.genWeek('empty')">Doplnit prázdná místa</button>` : ''}${prevHas ? `<button class="btn sec sm write" onclick="A.copyWeek()">Zkopírovat minulý týden</button>` : ''}${filled ? `<button class="btn sec sm write" onclick="A.clearWeek()">Vyprázdnit</button>` : ''}<span class="sp"></span><span class="small muted">limit ${fmt0(base.planLimit)} kcal${help(`Limit počítá s ${s.walk_min} min chůze při ${fmt1(s.walk_kmh)} km/h a s tréninkem, který máš na ten den v plánu. Piva a smažené zadáváš až v ten den na Dnes – do plánu týdne nepatří.`)}</span></div>
  <div class="wdays">${days.map(d => { const past = d.date < today; const open = (App.weekOpen == null ? (days.find(x => x.date === today) || days[0]).i : App.weekOpen) === d.i;
    const mm = dayMismatch(d.date);
    return `<div class="wday ${d.date === today ? 'today' : ''} ${open ? 'open' : ''} st${d.r.state}" ${past ? 'style="opacity:.8"' : ''}>
      <div class="wdh" onclick="A.weekDay(${d.i})">
        <span class="wdn">${DAY_NAMES[d.i]} <span class="muted" style="font-weight:600">${czDateShort(d.date)}</span></span>
        <span class="wdsum">${d.r.filled ? `${fmt0(d.r.kcal)} kcal · ${fmt0(d.r.p)} g bílkovin · limit ${fmt0(d.r.planLimit)}` : 'zatím nic naplánováno'}</span>
        <span class="stt st${d.r.state}">${esc(d.r.status)}</span>
        <span class="cotog">${open ? '▴' : '▾'}</span></div>
      ${!open ? '' : `<div class="wdb">
        ${s.courses.map((c, ci) => `<div class="wrow">
          <span class="wem">${COURSE_EMOJI[c.key]}</span><span class="wtime">${c.time}</span>
          <div class="wpick">${pbtn(d, ci)}</div>
          <span class="wkc m-kcal">${d.r.courses[ci].active || d.r.courses[ci].situace ? fmt0(d.r.courses[ci].kcal) + ' kcal' : '–'}</span></div>`).join('')}
        <div class="row between" style="margin-top:10px">
          <button class="btn sec sm write" onclick="A.genDay(${d.i})">💡 Navrhnout celý den znovu</button>
          ${mm && d.date >= today ? `<button class="btn sec sm write" onclick="A.fitDay('${d.date}')">💡 ${mm.diff > 0 ? 'přidat ' + fmt0(mm.diff) : 'ubrat ' + fmt0(-mm.diff)} kcal</button>` : ''}</div></div>`}</div>`; }).join('')}</div>`;
};
A.weekDay = i => { App.weekOpen = App.weekOpen === i ? -1 : i; render(); };
A.planSel = (di, ci, v) => Undo.run('Plán', () => { const wk = getWeek(App.week); wk.plan[di][ci] = v || null; saveWeek(wk); noteRecent(v); render(); }, () => { const r = calcPlanDay(S(), Foods(), Recipes(), getWeek(App.week).plan[di], currentWeight()); return `${DAY_NAMES[di]}: ${S().courses[ci].name.toLowerCase()} → ${v === SITUACE ? 'podle situace' : v === VYNECHAT ? 'vynechat' : v}. ${r.filled === 5 ? 'Den ' + r.status + '.' : 'Zbývá vybrat ' + (5 - r.filled) + ' jídel.'}`; });
A.copyWeek = () => Undo.run('Kopie týdne', () => { const prev = getWeek(addDays(App.week, -7)); const wk = getWeek(App.week); wk.plan = JSON.parse(JSON.stringify(prev.plan)); saveWeek(wk); render(); }, 'Minulý týden zkopírován. Uprav, co chceš jinak.');
A.clearWeek = () => Undo.run('Vyprázdnit týden', () => { const wk = getWeek(App.week); wk.plan = wk.plan.map(() => [null, null, null, null, null]); saveWeek(wk); render(); }, 'Týden vyprázdněn.');

/* ---------- SPÍŽ ---------- */
/* Jen trvanlivé suroviny a jen tři stavy. Čerstvé se neevidují – ty kupuješ pokaždé.
   Cílem není vědět, kolik čeho máš, ale co nedávat na lístek. */
VIEWS._spiz = function () {
  const foods = Foods().filter(f => f.pantry);
  const s = S(), recipes = Recipes(), w = currentWeight();
  const wk = getWeek(App.week);
  const need = Object.fromEntries(calcShopping(s, Foods(), recipes, wk.plan, w, weekActs(App.week, w)).map(x => [x.food, x.g]));
  const gr = {};
  foods.forEach(f => { (gr[f.aisle] = gr[f.aisle] || []).push(f); });
  const st = f => pantryState(f.name, need[f.name] || 0);
  const pocet = { mam: 0, dochazi: 0, nemam: 0 };
  foods.forEach(f => pocet[st(f)]++);
  const znam = f => !!pantryRaw()[f.name];   // dokud Robert neťukne, nic nesvítí – červená u 55 položek jen straší
  const btn = (f, k) => `<button class="pst ${znam(f) && st(f) === k ? 'on ' + PANTRY_ST[k][1] : ''}" onclick="A.pantry('${esc(f.name)}','${k}')">${PANTRY_ST[k][0]}</button>`;
  return `${flow('spiz', ['Projdi to jednou po nákupu', 'Ťukni mám / dochází / nemám', 'Lístek se tím sám zkrátí'], 'Tohle není inventura. Gramy appka nechce – stačí jí vědět, co nemá dávat na nákupní lístek. Odškrtnutím v Nákupu se položka překlopí na „mám“ sama a z tvé spotřeby si spočítá, na kolik týdnů balení vyjde; pak se sama přepne na „dochází“.')}
  <div class="row between" style="margin-bottom:6px"><h1>Spíž${help('Trvanlivé suroviny, které vydrží doma déle než týden: přílohy, luštěniny, oleje, koření, konzervy, ořechy, protein. Čerstvé (maso, zelenina, mléčné) tu schválně nejsou – ty se kupují na každý týden znovu a evidovat je by byla práce navíc bez užitku. Dokud neťukneš nic, bere se to jako „nemám“ a surovina je na lístku.')}</h1></div>
  <p class="small muted" style="margin-bottom:10px">${foods.length} trvanlivých surovin · mám ${pocet.mam}, dochází ${pocet.dochazi}, neoznačeno ${pocet.nemam}. Co máš, nebude na nákupním lístku.</p>
  <div class="card"><div class="plist3">${Object.entries(gr).map(([a, fs]) => `<div class="pgrp"><h3>${esc(a)}</h3>${fs.map(f => `<div class="prow"><div class="pn">${esc(f.name)}${f.pack ? `<span class="tiny muted"> · ${f.pack >= 1000 ? fmt1(f.pack / 1000) + ' kg' : f.pack + ' g'}${need[f.name] ? ` · týdně ${fmt0(need[f.name])} g` : ''}</span>` : ''}</div><div class="pb">${['mam', 'dochazi', 'nemam'].map(k => btn(f, k)).join('')}</div></div>`).join('')}</div>`).join('')}</div></div>`;
};

/* ---------- NÁKUP ---------- */
/* Jeden seznam, dvě podoby: „v obchodě“ s velkými zaškrtávátky a „na tisk“ na jednu A4.
   Řazení podle regálů, ne podle kategorií potravin – obchod projdeš jednou. */
App.shopMode = 'obchod';
App.shopDays = null;   // null = celý týden, jinak pole indexů dnů
A.shopMode = m => { App.shopMode = m; render(); };
A.shopDay = i => { const cur = App.shopDays || [0, 1, 2, 3, 4, 5, 6]; App.shopDays = cur.includes(i) ? cur.filter(x => x !== i) : cur.concat([i]).sort(); if (App.shopDays.length === 7) App.shopDays = null; render(); };
A.shopAll = () => { App.shopDays = null; render(); };
A.shopFromToday = () => { const mon = App.week, t = todayISO(); const ds = []; for (let k = 0; k < 7; k++) if (addDays(mon, k) >= t) ds.push(k); App.shopDays = ds.length && ds.length < 7 ? ds : null; render(); };

VIEWS._nakup = function () {
  const s = S(), foods = Foods(), recipes = Recipes(), w = currentWeight();
  const wk = getWeek(App.week); const shop = getShop(App.week);
  const pick = App.shopDays;
  const list = calcShopping(s, foods, recipes, wk.plan, w, weekActs(App.week, w), pick);
  const dnu = pick ? pick.length : 7;
  const napoveda = 'Seznam se skládá z naplánovaných jídel a je přepočítaný na tvoji váhu. Množství jsou v nákupním stavu – rýže a luštěniny suché, maso syrové. Trvanlivé suroviny appka zaokrouhlí na celá balení a ty, které máš podle Spíže doma, na lístek vůbec nedá. Řazení je podle regálů, ať obchod projdeš jednou.';
  const flowBlok = flow('nakup', ['Vyber dny, na které nakupuješ', 'Projdi regály a odškrtávej', 'Zbytek doma doplní Spíž'], 'Lístek jde vytisknout na jednu A4 (přepni na „na tisk“). Odškrtnutí se ukládá a drží se týdne.');
  const dayChips = `<div class="row noprint" style="gap:6px;flex-wrap:wrap;margin-bottom:10px"><span class="small muted" style="font-weight:700">Nakupuju na:</span>
    ${DAY_NAMES.map((d, i) => `<span class="chip ${!pick || pick.includes(i) ? 'on' : ''}" onclick="A.shopDay(${i})">${DAY_SHORT[i]}</span>`).join('')}
    <button class="btn sec sm" onclick="A.shopAll()">celý týden</button><button class="btn sec sm" onclick="A.shopFromToday()">od dneška</button></div>`;
  const head = `${flowBlok}<div class="row between" style="margin-bottom:6px"><h1>Nákup${help(napoveda)}</h1>
    <div class="row noprint"><div class="seg">${[['obchod', '🛒 v obchodě'], ['tisk', '🖨️ na tisk']].map(([k, l]) => `<button class="${App.shopMode === k ? 'on' : ''}" onclick="A.shopMode('${k}')">${l}</button>`).join('')}</div>${App.shopMode === 'tisk' ? '<button class="btn sm" onclick="window.print()">Vytisknout</button>' : ''}</div></div>
    <div class="row noprint" style="margin-bottom:8px">${weekToggle()}</div>${dayChips}`;
  if (!list.length) return head + `<div class="card">Na vybrané dny nemáš naplánovaná jídla. Naplánuj je v Týdnu a seznam se složí sám.</div>`;

  // spíž: co máš doma, na lístek nepatří
  const tydnu = Math.max(0.5, dnu / 7);
  const doma = [], koupit = [];
  list.forEach(x => { const st = x.pantry ? pantryState(x.food, x.g / tydnu) : 'nemam'; (st === 'mam' ? doma : koupit).push({ ...x, pstate: st }); });
  const done = koupit.filter(x => shop.checked[x.food]).length;

  // co se změnilo po nákupu: odškrtnuté položky, kterých je teď v plánu víc
  const dokup = koupit.filter(x => shop.checked[x.food] && shop.bought && shop.bought[x.food] != null && x.g > shop.bought[x.food] + 20)
    .map(x => ({ ...x, chybi: x.g - shop.bought[x.food] }));

  const aisles = [...new Set(koupit.map(x => x.aisle))];
  const radek = x => `<tr class="${shop.checked[x.food] ? 'muted' : ''}"><td style="width:34px" class="noprint"><input type="checkbox" ${shop.checked[x.food] ? 'checked' : ''} onchange="A.shopCheck('${esc(x.food)}',this.checked,${x.g})" style="width:22px;height:22px;min-height:0"></td>
    <td class="pcell" style="${shop.checked[x.food] ? 'text-decoration:line-through' : ''}">${esc(x.food)}${x.pstate === 'dochazi' ? ' <span class="pill">dochází</span>' : ''}${x.uses > 1 && (['Ořechy a semínka', 'Uzeniny'].includes(x.cat) || /Sýr|Eidam|Gouda|Feta|Šunka/.test(x.food)) ? `<div class="tiny muted">rozděl po nákupu na ${x.uses} ${sklon(x.uses, 'porci', 'porce', 'porcí')} po ${fmt0(x.g / x.uses)} g</div>` : ''}</td>
    <td class="n b">${x.buy}</td><td class="n muted tiny noprint">${x.packs ? `potřeba ${fmt0(x.g)} g` : ''}</td></tr>`;

  if (App.shopMode === 'tisk') {
    return head + `<p class="small muted" style="margin-bottom:8px">Lístek na ${dnu} ${dnu === 1 ? 'den' : (dnu < 5 ? 'dny' : 'dnů')} · ${koupit.length} položek${doma.length ? ` · ${doma.length} máš doma` : ''}. Vytiskne se na jednu stránku.</p>
      <div class="card"><h2 class="ptitle">Nákup · ${czDateShort(App.week)}${pick ? ` · ${pick.map(i => DAY_SHORT[i]).join(' ')}` : ' · celý týden'}</h2>
      <div class="plist2">${aisles.map(a => `<div class="pgrp"><h3>${esc(a)}</h3>${koupit.filter(x => x.aisle === a).map(x => `<div class="pln"><span class="box"></span><span class="nm">${esc(x.food)}</span><b>${x.buy}</b></div>`).join('')}</div>`).join('')}</div></div>`;
  }
  return head + `<p class="small muted" style="margin-bottom:8px">Na ${dnu} ${dnu === 1 ? 'den' : (dnu < 5 ? 'dny' : 'dnů')} · koupit ${koupit.length} položek, odškrtnuto ${done}. ${doma.length ? `${doma.length} ${doma.length === 1 ? 'položku' : (doma.length < 5 ? 'položky' : 'položek')} máš podle Spíže doma – na lístku nejsou.` : ''}</p>
  ${dokup.length ? `<div class="alert a2" style="margin-bottom:10px"><div style="flex:1">Po nákupu jsi měnil plán. Dokup: ${dokup.map(x => `<b>${esc(x.food)} ${fmt0(x.chybi)} g</b>`).join(', ')}.</div></div>` : ''}
  <div class="masonry">${aisles.map(a => `<div class="card tight"><h3 style="margin-bottom:4px">${esc(a)}</h3><table class="small">${koupit.filter(x => x.aisle === a).map(radek).join('')}</table></div>`).join('')}</div>
  ${doma.length ? `<details class="card tight" style="margin-top:0"><summary class="small" style="cursor:pointer;font-weight:700">Máš doma ze spíže (${doma.length})</summary><table class="small" style="margin-top:6px">${doma.map(x => `<tr><td class="pcell">${esc(x.food)}</td><td class="n muted">${x.buy}</td><td class="n noprint"><button class="btn sec sm write" onclick="A.pantry('${esc(x.food)}','dochazi')">došlo</button></td></tr>`).join('')}</table></details>` : ''}
  <div class="row noprint"><button class="btn sec sm write" onclick="A.shopReset()">Odškrtnout vše zpět</button></div>`;
};
A.shopCheck = (food, v, g) => { const shop = getShop(App.week); shop.checked[food] = v; shop.bought = shop.bought || {};
  if (v) { shop.bought[food] = g; const f = Foods().find(x => x.name === food); if (f && f.pantry) setPantry(food, 'mam', (f.pack || 0) * Math.max(1, Math.ceil(g / (f.pack || 1)))); }
  else delete shop.bought[food];
  Store.put('shopping', oid('s', App.week), shop); render(); const sd = shoppingDone(App.week); if (sd.done >= sd.total) UI.toast('Nákup kompletní. Vaření máš v rozpisu.'); };

/* ---------- NÁVOD / START ---------- */
VIEWS.navod = function () {
  const s = S(), ov = calcOverview(s, Meas()); const T = SEED.texts; const b = calcBase(s, ov.cur, s.walk_min, 0, s.walk_kmh, 0, 0);
  const costs = calcCosts(s, ov.cur);
  const sec = (id, em, title, sub, body, open) => `<details class="hsec" ${open ? 'open' : ''}><summary><span class="hem">${em}</span><div><div class="ht">${title}</div><div class="hs">${sub}</div></div><span class="muted">▾</span></summary><div class="hb">${body}</div></details>`;
  const tiles = (rows) => `<div class="tiles">${rows.map(r => `<div class="tile"><div class="tt">${esc(r[0])}</div><div class="tb">${esc(r[1])}</div>${r[2] ? `<div class="ts">${esc(r[2])}</div>` : ''}</div>`).join('')}</div>`;
  const steps = (rows) => `<div class="steps">${rows.map((r, i) => `<div class="step"><span class="sn">${i + 1}</span><div><div class="tt">${esc(r[0])}</div><div class="ts">${esc(r[1])}</div></div></div>`).join('')}</div>`;
  const RULE_EM = ['🍽️', '🥩', '🥦', '💧', '🚶', '⏱️', '🎯', '🗓️', '🥛', '🧭'];
  return `${flow('navod', ['Přečti si deset pravidel', 'Mrkni na slovníček', 'Vrať se sem, když nevíš'], '')}<h1 style="margin-bottom:8px">Start a návod</h1>
  <div class="card grad3" style="padding:20px"><p style="font-size:17px;font-weight:700;margin:0">${esc(T.start_intro[0])}</p><p class="small" style="opacity:.9;margin:8px 0 0">${esc(T.start_intro[1])}</p></div>
  <div class="tiles" style="margin-bottom:12px"><div class="tile big"><div class="tt">${fmt0(b.planLimit)}</div><div class="tb">kcal na jídlo a pití za den</div></div><div class="tile big"><div class="tt">${fmt1(Math.max(0, ov.cur - s.goal_weight))} kg</div><div class="tb">do cíle ${s.goal_weight} kg</div></div><div class="tile big"><div class="tt">${Math.round(ov.progress * 100)} %</div><div class="tb">cesty za tebou</div></div><div class="tile big"><div class="tt">${esc(ov.phase.split(' – ')[0])}</div><div class="tb">${esc(ov.phase.split(' – ')[1] || 'fáze chůze')}</div></div></div>
  ${sec('rules', '📜', 'Deset pravidel, která platí vždy', 'Krátká. Když si nebudeš vědět rady, vrať se sem.', `<div class="rules2">${T.rules.map((r, i) => `<div class="rule"><span class="rem">${RULE_EM[i] || '•'}</span><div>${esc(r)}</div></div>`).join('')}</div>`, true)}
  ${sec('day', '☀️', 'Jak vypadá tvůj den v appce', 'Ráno váha, pět jídel, chůze, večer shrnutí. Appka tě vede kartou „Teď“.', steps([['Ráno: zvaž se', 'Po WC, nalačno. Zapíšeš přímo v kartě Teď. Průměr 7 dní si poradí s výkyvy.'], ['Jídla podle plánu', 'Naskočí z Týdne. Po každém klikni „Snědl jsem“. Nesedí? 💡 navrhne jiné, které se vejde.'], ['Chůze a trénink', 'Zapiš minuty tlačítky +15/+30/+60. Trénink od trenéra odškrtni. Aktivita zvedá limit jídla.'], ['Pátek', 'Piva a smažené zapiš – přílohy se samy zmenší, bílkovina drží.'], ['Večer', 'Nic neukládáš. Po 20:30 uvidíš shrnutí, o půlnoci se den uloží sám.']]))}
  ${sec('week', '🗓️', 'Neděle – 10 minut', 'Obvody, plán týdne, nákup. Appka to navrhne sama, ty jen upravíš.', steps([['Změř obvody', 'Pas, boky, hrudník, stehno, paže – ráno nalačno, stejné místo.'], ['Projdi návrh týdne', 'Po 18:00 appka navrhne příští týden. Změň, co nechceš (hvězdičkou označ oblíbené – budou častěji).'], ['Nákup', 'Seznam se složí sám z plánu. Odškrtávej „mám“.'], ['Vaření', 'Rozpis podle receptů (na krabičky) nebo podle dnů. Gramy syrové, přepočítané na tvoji váhu.']]))}
  ${sec('costs', '💸', 'Kolik co stojí', `Denní deficit je teď ${fmt0(costs.deficit)} kcal. Kilo tuku = 7 700 kcal ≈ týden.`, tiles(costs.rows.map(r => [r[1], r[0], r[2]])) + `<p class="hint">${esc(T.costs_note)}</p>`)}
  ${sec('ways', '🧭', 'Dvě cesty, jak appku používat', esc(T.navod.two_ways), tiles(T.navod.ways.map(r => [r[0], r[1], r[2]])))}
  ${sec('food', '🍳', 'Vlastní a upravená jídla', 'Recepty jde upravit, složit vlastní i vyměnit surovinu v konkrétní den.', steps(T.navod.custom.map(r => [r[0], r[1] + ' (' + r[2].replace('list ', '') + ')'])))}
  ${sec('vahy', '🥄', 'Jak jíst bez váhy', 'Zvaž jen bílkovinu. Přílohu odměř hrnkem nebo lžící, zeleninu od oka.', `<p class="small" style="margin-bottom:10px">⚖️ maso, ryba, sýr, tvaroh – tady se chyba počítá, važ. 🥄 příloha, mléko, vločky, ořechy, oleje – odměř nádobou. ✋ zelenina, koření – od oka, hrst je hrst. Míry v receptech vychází z tvých nádob:</p>` + containersCard())}
  ${sec('measure', '📏', 'Kdy měřit a co zapisovat', 'Váha denně, obvody v neděli.', tiles(T.navod.measure.map(r => [r[0], r[1], r[2]])) + `<p class="hint">${esc(T.navod.measure_notes[0])}</p><p class="hint">${esc(T.navod.measure_notes[1])}</p>`)}
  ${sec('slovnik', '📖', 'Slovníček – co které číslo znamená', 'Appka používá pořád stejná slova. Tady je, co za nimi je.', tiles([
    ['Klidový výdej', `${fmt0(b.bmr)} kcal`, 'Kolik tělo spotřebuje za den, i kdybys celý den ležel. Chůzí se nezvedá – mění se s váhou, výškou a věkem.'],
    ['Běžný výdej', `${fmt0(b.baseOut)} kcal`, `Klidový výdej plus obyčejný den: práce, schody, nákup (× ${String(s.activity).replace('.', ',')}). Bez cíleného pohybu.`],
    ['Cílený pohyb', `${fmt0(s.walk_min * b.walkPerMin)} kcal při ${s.walk_min} min chůze`, 'Co spálíš navíc tím, že se hýbeš schválně – chůze a trénink. Jediné číslo, se kterým dnes něco naděláš.'],
    ['Celkový výdej', `${fmt0(b.minOut)} kcal`, 'Běžný výdej + cílený pohyb. Kolik dnes spálíš dohromady.'],
    ['Plánovaný deficit', `${fmt0(b.deficit)} kcal`, `Kolik má na konci dne chybět, aby váha šla dolů o ${String(s.rate_pct).replace('.', ',')} % týdně. Tohle číslo appka nesnižuje.`],
    ['Dnešní deficit', 'celkový výdej − příjem', 'Kolik ti dnes doopravdy chybí. Když je menší než plánovaný, hubnutí se zpomalí.'],
    ['Limit dne', `${fmt0(b.maxIntake)} kcal`, 'Kolik můžeš dnes sníst, aby deficit vyšel. Roste s tím, kolik se dnes pohybuješ.'],
    ['Limit podle plánu', `${fmt0(b.planLimit)} kcal`, 'Totéž, ale počítá s chůzí a tréninkem, které máš na den naplánované. Podle něj ti appka dopředu nakrájí porce.'],
    ['Rezerva', 'limit dne − příjem', 'Kolik ti ještě zbývá do limitu. Velké číslo nahoře na Dnes.'],
    ['Spodní hranice jídla', `${fmt0(b.bmr)} kcal`, 'Limit nikdy nespadne pod klidový výdej. Když na ní limit drží, znamená to málo pohybu – a menší deficit, než má být.'],
    ['Cíl jídla', 'např. snídaně 620 kcal', 'Kolik má mít jedno jídlo. Appka podle toho škáluje přílohu.'],
    ['Cíl chůze', `${s.walk_min} min denně`, 'Kolik minut chůze máš denně ujít. Pozor, neplést s cílem jídla.'],
    ['Tempo hubnutí', `${String(s.rate_pct).replace('.', ',')} % váhy týdně`, 'Jak rychle má váha klesat. Mění ho jen trenér.'],
  ]))}
  ${sec('why', '🧠', 'O plánu – proč je postavený takhle', 'Cíl, klíčová čísla a rozhodnutí.', tiles(T.o_planu.goal.map(r => [r[0], r[1]])) + '<h3 style="margin:12px 0 6px">Klíčová čísla</h3>' + tiles(T.o_planu.numbers.map(r => [r[0], r[1]])) + '<h3 style="margin:12px 0 6px">Rozhodnutí</h3>' + tiles(T.o_planu.decisions.map(r => [r[0], r[1]])))}`;
};

/* ---------- SUROVINY (náhled) ---------- */
App.fq = '';
App.fcol = {};
VIEWS._suroviny = function () {
  const foods = Foods(); const q = App.fq.toLowerCase().trim(); const coach = isCoach();
  const list = foods.filter(f => !q || f.name.toLowerCase().includes(q) || f.cat.toLowerCase().includes(q)).sort((a, b) => App.fsort === 'kcal' ? a.kcal - b.kcal : App.fsort === 'p' ? b.p - a.p : a.name.localeCompare(b.name, 'cs'));
  const cats = [...new Set(foods.map(f => f.cat))].sort((a, b) => a.localeCompare(b, 'cs'));
  const edit = f => coach ? `A.editFood('${f.id}')` : (f.own ? `A.editFood('${f.id}','own')` : `A.editFood('${f.id}','override')`);
  const row = f => `<tr><td class="b">${f.own ? '📌 ' : (f.overridden ? '✏️ ' : '')}${esc(f.name)}</td><td class="n b">${vShow(f.kcal)}</td><td class="n">${vShow(f.p)}</td><td class="n hm">${vShow(f.c)}</td><td class="n hm">${vShow(f.f)}</td><td class="n"><button class="ebtn write" title="upravit" onclick="${edit(f)}">✎</button></td></tr>`;
  const grouped = !q && !App.fsort;
  return `${flow('suroviny', ['Hledej surovinu', 'Zkontroluj hodnoty', 'Uprav nebo přidej vlastní'], 'Hodnoty jsou na 100 g v tom stavu, v jakém surovinu kupuješ (rýže suchá, maso syrové). Když si surovinu upravíš, počítají s ní tvoje recepty.')}
  <div class="row between" style="margin-bottom:8px"><h1>Suroviny${help('Databáze surovin (na 100 g v nákupním stavu – rýže suchá, maso syrové), ze které jsou složené recepty. Klikni na kategorii pro sbalení. Tužka u výchozí suroviny vytvoří tvoji verzi (✏️) – trenérova databáze zůstává; 📌 jsou tvoje vlastní suroviny, které jde použít v receptech i při přidávání surovin do jídla.')}</h1><button class="btn sm write" onclick="A.editFood(null,'${coach ? 'global' : 'own'}')">+ ${coach ? 'nová surovina' : 'moje surovina'}</button></div>
  <p class="small muted" style="margin-bottom:8px">${foods.length} surovin · hodnoty na 100 g${coach ? ' · úpravy platí pro všechny' : ''}</p>
  <div class="frow"><span class="flab">Hledat</span><input type="text" id="fq" placeholder="surovina nebo kategorie…" value="${esc(App.fq)}" style="flex:1;min-width:180px" oninput="App.fq=this.value;render();const i=document.querySelector('#fq');i.focus();i.setSelectionRange(i.value.length,i.value.length)"></div>
  <div class="frow" style="margin-bottom:10px"><span class="flab">Řadit</span><div class="seg">${[['', 'kategorie A–Z'], ['kcal', 'kcal ↑'], ['p', 'bílkoviny ↓']].map(([k, l]) => `<button class="${App.fsort === k ? 'on' : ''}" onclick="App.fsort='${k}';render()">${l}</button>`).join('')}</div></div>
  <div class="card tight"><div class="tbl"><table class="small ftab"><thead><tr><th>Surovina</th><th class="n">kcal</th><th class="n">Bílk.</th><th class="n hm">Sach.</th><th class="n hm">Tuky</th><th></th></tr></thead><tbody>
    ${grouped ? cats.map(c => { const items = list.filter(f => f.cat === c); const col = App.fcol[c]; return `<tr class="cath" onclick="App.fcol['${esc(c)}']=!App.fcol['${esc(c)}'];render()"><td colspan="6">${col ? '▸' : '▾'} ${c === 'Pozor' ? '⚠️ ' : ''}${esc(c)} <span class="muted" style="font-weight:500">· ${items.length}</span></td></tr>` + (col ? '' : items.map(row).join('')); }).join('') : list.map(row).join('')}
  </tbody></table></div>${!list.length ? '<p class="muted small" style="padding:10px">Nic nenalezeno.</p>' : ''}</div>`;
};
App.fsort = '';

/* ---------- VÍCE / ÚČET ---------- */
VIEWS.recepty = function () { return VIEWS._recepty(); };
VIEWS.suroviny = function () { return VIEWS._suroviny(); };
VIEWS.more = function () {
  const items = isCoach() ? MORE_COACH.concat(NAV_COACH.filter(([v]) => !MOB_MAIN_COACH.includes(v))) : MORE_CLIENT;
  const desc = { nakup: 'seznam z plánu týdne', vareni: 'rozpis na týden, tisk', recepty: 'vlastní jídla', suroviny: 'databáze potravin', navod: 'pravidla, čísla, postup', ucet: 'připomínky, kalendář, záloha', mereni: 'váha a obvody', prehled: 'grafy a statistika', tyden: 'plán 7 dní', klient: 'stav klienta', nastaveni: 'parametry plánu', zprava: 'týdenní shrnutí', trenink: 'plán cvičení', jidlo: 'nákup, spíž, vaření', databaze: 'editace databáze', dnes: 'skládání dne' };
  const col = { nakup: 'var(--grad2)', vareni: 'var(--grad)', recepty: 'var(--grad3)', suroviny: 'var(--y)', navod: 'var(--v)', ucet: 'var(--line2)', mereni: 'var(--p)', prehled: 'var(--grad)', tyden: 'var(--grad3)', dnes: 'var(--grad)' };
  const em = { nakup: '🛒', vareni: '🍳', recepty: '📖', suroviny: '🥦', navod: '📘', ucet: '⚙️', mereni: '⚖️', prehled: '📈', tyden: '🗓️', dnes: '☀️', klient: '📊', nastaveni: '⚙️', databaze: '🗄️' };
  return `<h1 style="margin-bottom:10px">Více${help('Obrazovky, které se nevešly do spodního menu. Na mobilu jsou v menu jen Dnes, Týden, Jídlo a Měření – zbytek najdeš tady.')}</h1>${realCoach() ? `<button class="btn sm" style="margin-bottom:10px;pointer-events:auto" onclick="A.togglePreview()">👁️ ${App.preview ? 'Zpět do trenéra' : 'Pohled Roberta'}</button>` : ''}<div class="more">${items.map(([v, l]) => `<button onclick="go('${v}')"><i style="background:${col[v] || 'var(--line2)'};display:flex;align-items:center;justify-content:center;font-size:18px">${em[v] || ''}</i>${l}<span>${desc[v] || ''}</span></button>`).join('')}<button onclick="go('ucet')"><i style="background:var(--line2);display:flex;align-items:center;justify-content:center;font-size:18px">🔔</i>Nastavení<span>upozornění, kalendář, záloha</span></button></div>`;
};
VIEWS.ucet = function () {
  return `<h1 style="margin-bottom:10px">Nastavení${help('Stav přihlášení a synchronizace, připomínky do prohlížeče, export dne nebo týdne do kalendáře a záloha všech dat do souboru. Záloha se hodí před větší změnou – obnovením se data vrátí do stavu ze zálohy.')}</h1>
  <div class="card"><h2>Stav</h2><p class="small muted" style="margin-top:4px">${Store.localMode() ? 'Aplikace běží bez cloudu – data jsou jen v tomto prohlížeči. Udělej si zálohu.' : `Přihlášen: ${esc(Store.session ? Store.session.user.email : '')} · role ${isCoach() ? 'trenér' : 'klient'}${Store.outbox.length ? ` · ${Store.outbox.length} ${sklon(Store.outbox.length, 'změna čeká', 'změny čekají', 'změn čeká')} na odeslání` : ' · vše odesláno'}`}</p>
    <div class="row" style="margin-top:8px">${Store.localMode() ? '' : '<button class="btn sec sm" onclick="Store.sync().then(()=>{render();UI.toast(\'Synchronizováno\')})">Synchronizovat teď</button>'}<button class="btn sec sm" onclick="A.logout()">Odhlásit</button></div></div>
  ${!isCoach() && !Meas().length ? `<div class="card"><h2>Historie ze sešitu</h2><p class="small muted" style="margin-top:4px">Zatím nemáš žádné vážení. Můžeš si nahrát 14 vážení a obvody z Excelu (27. 8. – 9. 9. 2026), ať grafy navazují.</p><div class="row" style="margin-top:8px"><button class="btn sec sm" onclick="A.seedMeas()">Nahrát vážení ze sešitu</button></div></div>` : ''}
  ${isCoach() ? '' : `<div class="card"><h2>🔔 Připomínky</h2><p class="small muted" style="margin-top:4px">Appka připomíná úkoly dne (vážení ${WEIGH_TIME}, jídla podle časů chodů, chůze, shrnutí dne ${CLOSE_TIME}, nedělní plánování), když je otevřená. Aby ti dala vědět i zavřená, přidej si připomínky do kalendáře telefonu – jednou stáhneš, kalendář pak budí sám.</p>
    <div class="row" style="margin-top:8px"><button class="btn sm" onclick="A.exportIcs()">📅 Stáhnout připomínky do kalendáře</button><button class="btn sec sm" onclick="Remind.enable()">${('Notification' in window && Notification.permission === 'granted') ? '✓ Upozornění v prohlížeči zapnuta' : 'Zapnout upozornění v prohlížeči'}</button></div>
    <p class="hint">Na iPhonu: soubor .ics otevři a potvrď „Přidat vše“. Na Androidu otevři soubor v Google Kalendáři.</p></div>`}
  ${isCoach() ? '' : containersCard()}
  ${isCoach() ? '' : `<div class="card"><h2>👣 Běžná denní chůze${help('Kroky z běžného dne (práce, nákup, doma) – bez cílené procházky. Předvyplní se každý den, můžeš změnit. Nepočítá se do cíle chůze ani do limitu jídla (základní výdej s ní už počítá); trenér ji vidí pro kontrolu.')}</h2><div class="row" style="margin-top:8px"><input type="number" step="500" min="0" value="${defaultSteps()}" style="width:130px" onchange="A.setSteps(this.value,true)"><span class="small muted">kroků za den – výchozí hodnota</span></div></div>`}
  <div class="card"><h2>Export a záloha</h2><p class="small muted" style="margin-top:4px">Excel obsahuje měření, historii dnů a plány týdnů. JSON je kompletní záloha, kterou lze nahrát zpět.</p>
    <div class="row" style="margin-top:8px"><button class="btn sec sm" onclick="A.exportXlsx()">Export do Excelu</button><button class="btn sec sm" onclick="A.exportJson()">Záloha JSON</button><label class="btn sec sm" style="cursor:pointer">Import JSON<input type="file" accept=".json" style="display:none" onchange="A.importJson(this.files[0])"></label></div></div>`;
};
A.logout = async () => { await Store.signOut(); App.view = 'dnes'; render(); };
A.exportJson = () => {
  const uid = Store.ownerId();
  const dump = { exported: new Date().toISOString(), tables: {} };
  TABLES.forEach(t => { dump.tables[t] = Store.db[t].filter(r => r.user_id === uid || r.user_id == null); });
  downloadBlob(new Blob([JSON.stringify(dump, null, 1)], { type: 'application/json' }), `yesyoucan-zaloha-${todayISO()}.json`);
};
A.importJson = async file => {
  if (!file) return; const txt = await file.text(); let dump; try { dump = JSON.parse(txt); } catch (e) { UI.toast('Soubor není platný JSON'); return; }
  if (!dump.tables) { UI.toast('Toto není záloha aplikace'); return; }
  UI.confirm('Nahrát zálohu? Novější záznamy v záloze přepíší starší, nic se nemaže.', () => {
    let n = 0;
    Object.entries(dump.tables).forEach(([t, rows]) => { if (!TABLES.includes(t)) return; rows.forEach(r => { const i = Store.db[t].findIndex(x => x.id === r.id); if (i < 0 || r.updated_at > Store.db[t][i].updated_at) { if (i < 0) Store.db[t].push(r); else Store.db[t][i] = r; Store.queue(t, r); n++; } }); Store.save(t); });
    UI.toast(`Nahráno ${n} záznamů`); render();
  }, 'Nahrát zálohu');
};
A.exportXlsx = async () => {
  try { if (!window.XLSX) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'); } catch (e) { UI.toast('Bez internetu nejde export do Excelu; použij zálohu JSON'); return; }
  const s = S(), foods = Foods(), recipes = Recipes(); const wb = XLSX.utils.book_new();
  const ov = calcOverview(s, Meas());
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ov.rows.map(r => ({ Datum: r.date, Den: DAY_SHORT[dayIndex(r.date)], 'Váha (kg)': r.weight, 'Ø 7 dní': +r.avg.toFixed(2), 'Shozeno': +r.lost.toFixed(2), 'Plán': +r.plan.toFixed(2), 'Odchylka': +r.dev.toFixed(2), BMI: +r.bmi.toFixed(1), Pas: r.waist, Boky: r.hips, Hrudník: r.chest, Stehno: r.thigh, Paže: r.arm, Poznámka: r.note }))), 'Měření');
  const days = Store.rows('days', Store.ownerId()).map(r => r.data).sort((a, b) => a.date < b.date ? -1 : 1);
  const dayRows = [];
  days.forEach(day => { const w = weightAt(s, day.date); const eff = effectiveDay(day.date); const d = calcDay(s, foods, recipes, eff, w);
    dayRows.push({ Datum: day.date, Den: DAY_SHORT[dayIndex(day.date)], 'Váha (Ø7)': +w.toFixed(1), 'Limit': Math.round(d.base.maxIntake), 'Příjem': Math.round(d.intake), 'Bílkoviny': Math.round(d.tot.p), 'Cíl bílkovin': d.protTarget, 'Chůze min': day.walk_min || 0, 'Tempo': eff.walk_kmh, 'Piva': day.beers || 0, 'Smažené g': day.fried_g || 0, 'Deficit': Math.round(d.dayDeficit), 'V pořádku': d.ok ? 'ano' : 'ne', ...Object.fromEntries(d.courses.map((c, i) => [s.courses[i].name, c.sel ? `${c.sel} (${Math.round(c.kcal)} kcal)` : ''])) }); });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dayRows), 'Dny');
  const wkRows = []; Store.rows('week_plans', Store.ownerId()).map(r => r.data).sort((a, b) => a.week < b.week ? -1 : 1).forEach(w => w.plan.forEach((sels, i) => wkRows.push({ Týden: w.week, Den: DAY_NAMES[i], Datum: addDays(w.week, i), ...Object.fromEntries(s.courses.map((c, ci) => [c.name, sels[ci] || ''])) })));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(wkRows), 'Týdny');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(recipes.filter(r => !r.deleted).map(r => ({ Chod: r.course, Název: r.name, Vlastní: r.own ? 'ano' : '', Suroviny: r.items.map(it => `${it.food} ${it.g} g${it.scale ? ' (příloha)' : ''}`).join(' · ') }))), 'Recepty');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(foods.map(f => ({ Kategorie: f.cat, Surovina: f.name, kcal: f.kcal, Bílkoviny: f.p, Sacharidy: f.c, Tuky: f.f }))), 'Suroviny');
  XLSX.writeFile(wb, `yesyoucan-export-${todayISO()}.xlsx`);
};
function weightAt(s, date) { const rows = calcMeasurements(s, Meas()).filter(r => r.date <= date); return rows.length ? rows[rows.length - 1].avg : s.start_weight; }
function downloadBlob(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }

/* ---------- SVG graf ---------- */
function lineChart({ series, xLabel, yUnit, hLine, marks, h = 260 }) {
  const W = 720, H = h, L = 44, R = 12, T = 12, B = 34;
  const all = series.flatMap(sr => sr.pts);
  if (!all.length) return '<p class="muted small">Zatím žádná data.</p>';
  let xs = all.map(p => p[0]), ys = all.map(p => p[1]);
  if (hLine) ys = ys.concat([hLine.y]);
  let x0 = Math.min(...xs), x1 = Math.max(...xs); if (x1 === x0) x1 = x0 + 7;
  let y0 = Math.min(...ys), y1 = Math.max(...ys); const pad = Math.max(1, (y1 - y0) * 0.08); y0 -= pad; y1 += pad;
  const X = x => L + (x - x0) / (x1 - x0) * (W - L - R), Y = y => T + (y1 - y) / (y1 - y0) * (H - T - B);
  const yt = []; const stepY = niceStep((y1 - y0) / 5); for (let v = Math.ceil(y0 / stepY) * stepY; v <= y1; v += stepY) yt.push(v);
  const xt = []; const stepX = niceStep((x1 - x0) / 8); for (let v = Math.ceil(x0 / stepX) * stepX; v <= x1; v += stepX) xt.push(v);
  let g = `<svg class="chart" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img">`;
  yt.forEach(v => { g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="#e6ebea"/><text x="${L - 6}" y="${Y(v) + 4}" font-size="11" fill="#7a878c" text-anchor="end">${fmtTick(v)}</text>`; });
  xt.forEach(v => { g += `<text x="${X(v)}" y="${H - B + 16}" font-size="11" fill="#7a878c" text-anchor="middle">${fmtTick(v)}</text>`; });
  g += `<text x="${(L + W - R) / 2}" y="${H - 4}" font-size="11" fill="#7a878c" text-anchor="middle">${xLabel}</text>`;
  if (hLine) g += `<line x1="${L}" x2="${W - R}" y1="${Y(hLine.y)}" y2="${Y(hLine.y)}" stroke="${hLine.color}" stroke-dasharray="3 4"/><text x="${W - R}" y="${Y(hLine.y) - 4}" font-size="11" fill="${hLine.color}" text-anchor="end">${hLine.label}</text>`;
  series.forEach(sr => { if (!sr.pts.length) return; const d = sr.pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('');
    g += `<path d="${d}" fill="none" stroke="${sr.color}" stroke-width="${sr.thin ? 1.2 : 2.2}" ${sr.dash ? 'stroke-dasharray="6 5"' : ''} stroke-linejoin="round"/>`;
    if (sr.dots) sr.pts.forEach(p => { g += `<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="3" fill="${sr.color}"/>`; }); });
  /* svislé značky: zásahy trenéra – bez nich nepoznáš, jestli změna tempa něco udělala */
  (marks || []).forEach(m => { if (m.x < x0 || m.x > x1) return;
    g += `<line x1="${X(m.x)}" x2="${X(m.x)}" y1="${T}" y2="${H - B}" stroke="#8a5a9e" stroke-width="1.2" stroke-dasharray="2 3"/>`
      + `<text x="${X(m.x) + 3}" y="${T + 11}" font-size="10" fill="#8a5a9e">${esc(m.label)}</text>`; });
  g += '</svg>';
  return g + `<div class="legend">${series.filter(sr => sr.pts.length).map(sr => `<span><i style="background:${sr.color}"></i>${sr.name}</span>`).join('')}${yUnit ? `<span class="muted">osa: ${yUnit}</span>` : ''}</div>`;
}
function niceStep(raw) { const p = Math.pow(10, Math.floor(Math.log10(raw))); const n = raw / p; return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p; }
function fmtTick(v) { return Number.isInteger(v) ? String(v) : String(Math.round(v * 10) / 10).replace('.', ','); }

function barChart(vals, labels, goal) {
  const W = 720, H = 150, L = 34, R = 8, T = 10, B = 26; const n = vals.length; const max = Math.max(goal || 0, ...vals, 10);
  const bw = (W - L - R) / n; const Y = v => T + (1 - v / max) * (H - T - B);
  let g = `<svg class="chart" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;
  g += `<line x1="${L}" x2="${W - R}" y1="${Y(0)}" y2="${Y(0)}" stroke="#e6ebea"/>`;
  vals.forEach((v, i) => { g += `<rect x="${L + i * bw + bw * 0.15}" y="${Y(v)}" width="${bw * 0.7}" height="${Y(0) - Y(v)}" rx="3" fill="${goal && v >= goal ? '#22c55e' : (v ? '#fbbf24' : '#e3e7f0')}"/>`; if (v) g += `<text x="${L + i * bw + bw / 2}" y="${Y(v) - 3}" font-size="10" fill="#5b6480" text-anchor="middle">${v}</text>`; g += `<text x="${L + i * bw + bw / 2}" y="${H - 8}" font-size="10" fill="#7a878c" text-anchor="middle">${labels[i]}</text>`; });
  if (goal) g += `<line x1="${L}" x2="${W - R}" y1="${Y(goal)}" y2="${Y(goal)}" stroke="#16a34a" stroke-dasharray="3 4"/><text x="${L - 4}" y="${Y(goal) + 4}" font-size="10" fill="#16a34a" text-anchor="end">${goal}</text>`;
  return g + '</svg>';
}

/* ===== Jídlo: nákup, vaření, recepty a suroviny pod jednou záložkou =====
   Jeden tok: co koupit → co uvařit → z čeho to je → z čeho se recepty skládají. */
const JIDLO_TABS = [
  ['nakup', '🛒 Nákup', 'Co koupit na vybrané dny'],
  ['spiz', '🫙 Spíž', 'Co máš doma z trvanlivých'],
  ['vareni', '🍳 Vaření', 'Co uvařit dopředu, ať máš hotovo'],
];
App.jidloTab = 'nakup';
A.jidlo = tab => { App.jidloTab = tab; go('jidlo'); };
A.mereni = tab => { App.merTab = tab; go('mereni'); };
VIEWS.jidlo = function () {
  const t = JIDLO_TABS.find(x => x[0] === App.jidloTab) ? App.jidloTab : 'nakup';
  const podzalozky = `<div class="subtabs noprint">${JIDLO_TABS.map(([k, l]) => `<button class="${k === t ? 'on' : ''}" onclick="App.jidloTab='${k}';render()">${l}</button>`).join('')}</div>`;
  return podzalozky + VIEWS['_' + t]();
};

/* ===== Měření: zápis i přehled pod jednou záložkou ===== */
const MER_TABS = [['zapis', '⚖️ Zápis a historie', 'Ranní váha a obvody'], ['prehled', '📈 Přehled', 'Jak si vedeš proti plánu']];
App.merTab = 'zapis';
VIEWS.mereni = function () {
  const t = MER_TABS.find(x => x[0] === App.merTab) ? App.merTab : 'zapis';
  const podzalozky = `<div class="subtabs noprint">${MER_TABS.map(([k, l]) => `<button class="${k === t ? 'on' : ''}" onclick="App.merTab='${k}';render()">${l}</button>`).join('')}</div>`;
  return podzalozky + (t === 'zapis' ? VIEWS._mereni() : VIEWS._prehled());
};
