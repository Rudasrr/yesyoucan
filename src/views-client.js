/* ===== Obrazovky Roberta: Plán, Pokrok, Více ===== */
const VIEWS = {};

/* ---------- POKROK: jak mi to jde ----------
   Dřív dvě záložky (Zápis a historie · Přehled), obě začínaly čtyřmi čísly a dvě z nich
   byla stejná. Teď jedno velké číslo, graf proti plánu a zbytek v listech. */
App.measDate = todayISO();
VIEWS.pokrok = function () {
  const s = S(), meas = Meas(), ov = calcOverview(s, meas);
  const lost = Math.max(0, ov.lost || 0), weeks = Math.max(1, Math.round((ov.daysSinceStart || 0) / 7));
  const mi = milestone(s, ov), ws = weighStreak(), wr = weighRecord(), cs = confirmStreak();
  const lw = meas.filter(m => m.waist != null).sort((a, b) => a.date.localeCompare(b.date));
  const wd = lw.length > 1 ? lw[lw.length - 1].waist - lw[0].waist : null;
  return `<div class="ph"><div class="pt"><h1>Pokrok</h1><span class="sub">${ov.count} ${sklon(ov.count, 'vážení', 'vážení', 'vážení')}</span></div><div class="act"><button class="btn sm write" onclick="A.measSheet(todayISO())">${ico('plus')} Zápis</button></div></div>
  <div class="card pkhero">
    <span class="lab">Od startu</span>
    <div class="k num">${lost > 0 ? '−' + fmt1(lost) : '0'} kg</div>
    <div class="s">za ${weeks} ${sklon(weeks, 'týden', 'týdny', 'týdnů')} · z ${fmt1(s.start_weight)} na ${fmt1(ov.cur)} kg</div>
    ${lost >= 0.25 ? `<div class="tipg">${ico('star')}<span>To je ${Math.round(lost * 4)} ${sklon(Math.round(lost * 4), 'kostka', 'kostky', 'kostek')} másla. O tolik míň neseš každý krok.</span></div>` : `<div class="tipg">${ico('star')}<span>Každé ranní vážení se počítá. Průměr ukáže cestu za pár dní.</span></div>`}
  </div>
  ${mi ? `<div class="card mile"><div class="row between"><b>${mi.goal ? 'Cíl' : 'Další milník'}: ${fmt1(mi.next)} kg</b><span class="small muted">zbývá ${fmt1(Math.max(0, ov.cur - mi.next))} kg</span></div><div class="bar"><i style="width:${Math.max(4, mi.prog * 100)}%"></i></div><div class="row between small muted"><span>${fmt1(mi.prev)}</span><span>${fmt1(mi.next)}</span></div></div>` : ''}
  <div class="streaks"><div class="sk">${ico('flame')}<b class="num">${ws || wr}</b><span>${!ws ? `tvůj rekord ve vážení v řadě – nová série začne ranním vážením` : ws >= wr && ws > 1 ? 'dní vážení v řadě – tvůj rekord' : `${sklon(ws, 'den', 'dny', 'dní')} vážení v řadě · rekord ${wr}`}</span></div><div class="sk">${ico('check')}<b class="num">${cs}</b><span>${cs ? `${sklon(cs, 'potvrzený den', 'potvrzené dny', 'potvrzených dnů')} v řadě` : 'potvrzené dny – začni dnes večer'}</span></div></div>
  <div class="secl">Odznaky</div><div class="badges">${badges(s, ov, wr).map(b => `<div class="bd ${b.on ? 'on' : 'off'}"><i>${ico(b.i)}</i>${esc(b.t)}</div>`).join('')}</div>
  <div class="card"><div class="ch"><h2>Tvoje cesta</h2><span class="small muted">průměr každého týdne</span></div>${pathChart(s, ov, mi)}</div>
  <div class="card flush">
    <div class="navrow" onclick="A.circSheet()"><span class="ico">${ico('ruler')}</span><div class="tx"><b>Obvody</b><span>${lw.length ? `pas ${fmt1(lw[lw.length - 1].waist)} cm${wd != null && wd < -0.05 ? ` · ${signed1(wd)} cm od prvního` : ''}` : 'změř v neděli – za měsíc uvidíš, kde ubývá'}</span></div><span class="chev">›</span></div>
    <div class="navrow" onclick="A.historySheet()"><span class="ico">${ico('cal')}</span><div class="tx"><b>Historie zápisů</b><span>${ov.last ? 'poslední ' + czDateShort(ov.last.date) : 'zatím nic'}</span></div><span class="chev">›</span></div>
    <div class="navrow" onclick="A.resumeSheet()"><span class="ico">${ico('trophy')}</span><div class="tx"><b>Týdenní shrnutí</b><span>jak se ti dařilo, týden po týdnu</span></div><span class="chev">›</span></div>
  </div>`;
};
/* Další milník: nejbližší násobek 5 kg pod aktuálním průměrem, nakonec cílová váha. */
function milestone(s, ov) {
  if (ov.cur == null) return null;
  const goal = s.goal_weight; let next = Math.floor((ov.cur - 0.05) / 5) * 5;
  if (goal != null && next <= goal) next = goal;
  const prev = Math.min(s.start_weight, next + 5);
  return { next, prev, goal: next === goal, prog: clamp((prev - ov.cur) / Math.max(0.1, prev - next), 0, 1) };
}
function weighRecord() { const ds = Meas().filter(m => m.weight != null).map(m => m.date).sort(); let best = 0, n = 0, last = null;
  ds.forEach(d => { n = last && addDays(last, 1) === d ? n + 1 : (last === d ? n : 1); last = d; best = Math.max(best, n); }); return best; }
function confirmStreak() { let n = 0, dt = todayISO(); if (!evaluateDay(dt).confirmed) dt = addDays(dt, -1);
  while (n < 400 && evaluateDay(dt).confirmed) { n++; dt = addDays(dt, -1); } return n; }
function badges(s, ov, wr) {
  const lost = Math.max(0, ov.lost || 0), out = [];
  const kg = [1, 3, 5, 10, 15, 20, 30, 40].filter(k => k <= Math.max(1, s.start_weight - s.goal_weight));
  kg.forEach(k => out.push({ on: lost >= k, i: k === 1 ? 'star' : 'trophy', t: k === 1 ? 'První kilo' : `−${k} kg` }));
  [[7, '7 dní vážení'], [30, '30 dní vážení']].forEach(([n, t]) => out.push({ on: wr >= n, i: 'flame', t }));
  const waists = Meas().filter(m => m.waist != null).length; out.push({ on: waists >= 4, i: 'ruler', t: '4× obvody' });
  /* odemčené napřed, z uzamčených jen dva nejbližší – ať je vidět, kam dál */
  const on = out.filter(b => b.on), off = out.filter(b => !b.on).slice(0, 2);
  return [...on, ...off];
}
/* Vlastní cesta: týdenní průměry od startu, bez plánu a prognózy – Robert vidí jen, kudy šel. */
function pathChart(s, ov, mi) {
  const wk = weekAvgs().map(x => ({ x: Math.max(0, Math.min(ov.daysSinceStart || 0, daysBetween(s.start_date, x.mon) + 3)), y: x.avg })); if (wk.length < 1) return '<p class="muted small">Graf se ukáže po prvním týdnu vážení.</p>';
  const pts = [[0, s.start_weight], ...wk.map(x => [x.x, x.y])];
  const w = 400, h = 180, L = 8, R = 8, T = 20, B = 22, x1 = Math.max(7, pts[pts.length - 1][0]);
  const ys = pts.map(p => p[1]).concat(mi ? [mi.next] : []); const y0 = Math.min(...ys) - 0.6, y1 = Math.max(...ys) + 0.4;
  const X = x => L + x / x1 * (w - L - R), Y = y => T + (y1 - y) / (y1 - y0) * (h - T - B);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('');
  return `<svg class="pchart" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="pgr" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#16a34a" stop-opacity=".22"/><stop offset="1" stop-color="#16a34a" stop-opacity="0"/></linearGradient></defs>
    ${mi ? `<line x1="${L}" x2="${w - R}" y1="${Y(mi.next)}" y2="${Y(mi.next)}" stroke="#16a34a" stroke-dasharray="4 5"/><text x="${w - R}" y="${Y(mi.next) - 6}" font-size="12" font-weight="700" fill="#16a34a" text-anchor="end">${mi.goal ? 'cíl' : 'další milník'} ${fmt1(mi.next)} kg</text>` : ''}
    <path d="${d}L${X(pts[pts.length - 1][0])},${h - B}L${X(0)},${h - B}Z" fill="url(#pgr)"/><path d="${d}" fill="none" stroke="#16a34a" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
    ${pts.map(p => `<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="4" fill="#fff" stroke="#16a34a" stroke-width="2.5"><title>${fmt1(p[1])} kg</title></circle>`).join('')}
    <text x="${L}" y="${h - 6}" font-size="11.5" fill="#94a3b8">${czDateShort(s.start_date)}</text><text x="${w - R}" y="${h - 6}" font-size="11.5" fill="#94a3b8" text-anchor="end">${czDateShort(addDays(s.start_date, pts[pts.length - 1][0]))}</text></svg>`;
}
/* ---------- TÝDENNÍ SHRNUTÍ (1. 10. 2026) ----------
   Jednou týdně Robert uvidí, jak si vedl: čísla, pochvala za to, co se povedlo, jeden
   tip na příští týden a výzva k týdennímu vážení a obvodům. V neděli od poledne
   (tento týden) a v pondělí a úterý (minulý týden) nahoře na Dnes; kdykoli v Pokroku. */
function weekResume(start) {
  const s = S(), R = weekReport(start), w = currentWeight(); const planW = w * s.rate_pct / 100;
  const st = stepsStat(R.days); const cilChuze = (s.walk_min || 60) * R.past;
  const wins = [], tips = [];
  if (R.delta != null && R.delta <= -planW * 0.9) wins.push(`Váha −${fmt2(-R.delta)} kg – přesně tempo plánu.`);
  else if (R.delta != null && R.delta < 0) wins.push(`Váha jde dolů: −${fmt2(-R.delta)} kg za týden.`);
  if (R.okN >= 5) wins.push(`${R.okN} ${DEN(R.okN)} v pořádku – tohle je ten návyk.`);
  if (R.weigh >= Math.min(6, R.past)) wins.push(`Vážil ses ${R.weigh}× – proto ti průměr říká pravdu.`);
  if (R.walk >= cilChuze * 0.9 && R.walk > 0) wins.push(`Chůze ${fmt0(R.walk)} min – cíl splněný.`);
  if (st && st.avg >= stepsTarget(s)) wins.push(`Běžná chůze v průměru ${fmt0(st.avg)} kroků – nad cílem.`);
  if (R.trainPlanned && R.trainDone >= R.trainPlanned) wins.push(`Všechny tréninky odcvičené (${R.trainDone}).`);
  if (R.potvrz.length < R.past - 1) tips.push('Každý večer potvrď den – jedno ťuknutí, a appka ví, jak ti to jde.');
  else if (R.weigh < R.past - 2) tips.push('Zvaž se každé ráno – jedno číslo nic neznamená, sedm už ano.');
  else if (R.walk < cilChuze * 0.7) tips.push('Zkus chůzi rozdělit na 2× 30 minut – jde to snáz a počítá se stejně.');
  else if (R.over >= 2) tips.push('Tip: cheat zapiš ráno dopředu – appka ti přidá chůzi a jídlo zůstane, jak je.');
  else if (st && st.avg < stepsTarget(s)) tips.push('Víc kroků = víc jídla: schody místo výtahu, pět minut po obědě.');
  else if (R.delta != null && R.delta >= 0) tips.push('Váha se občas na týden zastaví – to je normální. Drž to dál, průměr se pohne.');
  const head = wins[0] || (R.recs.length ? 'Týden je za tebou – každý zapsaný den se počítá.' : 'Tenhle týden je zatím prázdný.');
  return { R, st, wins, tip: tips[0] || 'Pokračuj stejně – funguje to.', head };
}
function resumeStart() { const t = todayISO(), di = dayIndex(t), h = nowMin();
  if (di === 6 && h >= 12 * 60) return mondayOf(t);
  if (di <= 1) return addDays(mondayOf(t), -7);
  return null; }
function obvodyTentoTyden() { const t = todayISO(); return Meas().some(m => m.date >= addDays(t, -6) && m.waist != null); }
function resumeCard() {
  const start = resumeStart(); if (!start || App.date !== todayISO() || realCoach() && !App.preview) return '';
  if (LS.get('resumeSeen', null) === start) return '';
  const X = weekResume(start); const R = X.R; if (!R.recs.length && !R.weigh) return '';
  return `<div class="card tint-ok stack s8"><div class="row between nowrap"><b>${ico('trophy')} Tvůj týden ${czDateShort(start)}–${czDateShort(addDays(start, 6))}</b><button class="xbtn sm" onclick="LS.set('resumeSeen','${start}');render()" aria-label="skrýt">×</button></div>
    <div style="font-size:18px;font-weight:750;line-height:1.3">${esc(X.head)}</div>
    <div class="stats3"><div><b>${R.potvrz.length}</b><span>potvrzených dnů</span></div><div><b class="ok">${R.delta != null && R.delta < 0 ? '−' + fmt2(-R.delta) : R.weigh + '×'} <small>${R.delta != null && R.delta < 0 ? 'kg' : ''}</small></b><span>${R.delta != null && R.delta < 0 ? 'váha za týden' : 'vážení'}</span></div><div><b>${fmt0(R.walk)} <small>min</small></b><span>chůze</span></div></div>
    <div class="small">${ico('star')} ${esc(X.tip)}</div>
    <div class="row">${obvodyTentoTyden() ? '' : `<button class="btn sm write" onclick="A.measSheet(todayISO(),true)">${ico('ruler')} Zapsat váhu a obvody</button>`}<button class="btn sec sm" onclick="A.resumeSheet('${start}')">Celé shrnutí</button></div></div>`;
}
A.resumeSheet = start => { App.resumeW = start || resumeStart() || addDays(mondayOf(todayISO()), -7); openSheet(() => {
  const st0 = App.resumeW; const X = weekResume(st0); const R = X.R; const t = todayISO();
  return UI.sheetHtml(`Týden ${czDateShort(st0)}–${czDateShort(addDays(st0, 6))}`, esc(X.head),
    `<div class="row between nowrap"><button class="iconbtn" onclick="App.resumeW=addDays(App.resumeW,-7);window._sheetRedraw()" aria-label="týden zpět">‹</button><span class="small muted">${st0 === mondayOf(t) ? 'tento týden' : 'listuj po týdnech'}</span><button class="iconbtn" ${st0 >= mondayOf(t) ? 'disabled' : ''} onclick="App.resumeW=addDays(App.resumeW,7);window._sheetRedraw()" aria-label="další týden">›</button></div>
    ${X.wins.length ? `<div class="list">${X.wins.map(x => `<div class="li static"><span class="em">✅</span><div class="tx"><b style="-webkit-line-clamp:3">${esc(x)}</b></div></div>`).join('')}</div>` : ''}
    <div class="stats"><div class="stat"><b>${R.okN} <small>/ ${R.past}</small></b><span>dní v pořádku</span></div><div class="stat"><b>${R.potvrz.length}</b><span>potvrzených dní</span></div><div class="stat"><b>${R.weigh}×</b><span>vážení</span></div><div class="stat"><b>${R.delta != null ? (R.delta > 0 ? '+' : '−') + fmt2(Math.abs(R.delta)) : '–'} <small>kg</small></b><span>váha (průměr 7)</span></div><div class="stat"><b>${fmt0(R.walk)} <small>min</small></b><span>chůze</span></div><div class="stat"><b>${X.st ? fmt0(X.st.avg) : '–'}</b><span>běžná chůze Ø kroků</span></div><div class="stat"><b>${R.trainDone} <small>/ ${R.trainPlanned}</small></b><span>tréninků</span></div><div class="stat"><b>${R.beers} 🍺 · ${R.over}</b><span>piv · dnů přes limit</span></div></div>
    <div class="alert a4"><div>💡 ${esc(X.tip)}</div></div>`,
    obvodyTentoTyden() ? '' : `<button class="btn write" onclick="UI.closeModal();A.measSheet(todayISO(),true)">📏 Zapsat váhu a obvody</button>`); }); };

/* zápis měření v listu: váha denně, obvody v neděli (nebo kdykoli na požádání) */
A.measSheet = (date, withCirc) => {
  App.measDate = date || todayISO();
  const s = S(); const draw = () => {
    const sel = App.measDate; const cur = Meas().find(m => m.date === sel) || { date: sel };
    const circ = withCirc || dayIndex(sel) === 6 || ['waist', 'hips', 'chest', 'thigh', 'arm'].some(k => cur[k] != null);
    const inp = (f, l, step) => `<div class="field"><label class="f">${l}</label>${stepper('m_' + f, cur[f] ?? '', step, 0)}</div>`;
    return UI.sheetHtml(sel === todayISO() ? 'Dnešní zápis' : 'Zápis ' + czDate(sel), `${DAY_NAMES[dayIndex(sel)]} · po probuzení, po WC, nalačno`,
      `<div class="field"><label class="f">Datum</label><input type="date" value="${sel}" min="${s.start_date}" max="${todayISO()}" onchange="App.measDate=this.value;window._measDraw()"></div>
      ${inp('weight', 'Váha (kg)', 0.1)}
      ${circ ? `<div class="grid g2">${inp('waist', 'Pas (cm)', 0.5)}${inp('hips', 'Boky (cm)', 0.5)}${inp('chest', 'Hrudník (cm)', 0.5)}${inp('thigh', 'Stehno (cm)', 0.5)}${inp('arm', 'Paže (cm)', 0.5)}</div><p class="hint">Obvody ráno nalačno, uvolněné břicho, vždy stejné místo.</p>` : `<button class="btn ghost sm" style="align-self:flex-start" onclick="window._measCirc()">+ obvody</button>`}
      <div class="field"><label class="f">Poznámka</label><input type="text" id="m_note" value="${esc(cur.note || '')}"></div>`,
      `<button class="btn write" onclick="A.saveMeas()">Uložit zápis</button>${Meas().some(m => m.date === sel) ? `<button class="btn danger write" onclick="A.delMeas('${sel}')">Smazat</button>` : ''}`);
  };
  const m = UI.modal(draw());
  window._measDraw = () => UI.resheet(m, draw());
  window._measCirc = () => { withCirc = true; window._measDraw(); };
};
A.circSheet = () => {
  const s = S(), meas = Meas();
  const circ = k => meas.filter(m => m[k] != null).sort((a, b) => a.date < b.date ? -1 : 1).map(m => [daysBetween(s.start_date, m.date), m[k]]);
  const waist = circ('waist');
  UI.sheet('Obvody', 'od startu · vždy stejné místo',
    `<div class="rings">${['waist,pas', 'hips,boky', 'chest,hrudník', 'thigh,stehno', 'arm,paže'].map(x => { const [k, lab] = x.split(','); const rs = meas.filter(m => m[k] != null).sort((a, b) => a.date.localeCompare(b.date)); if (!rs.length) return ''; const d = rs[rs.length - 1][k] - rs[0][k];
      return `<div class="ring"><div style="font-size:22px;font-weight:800">${fmt1(rs[rs.length - 1][k])}<small class="muted" style="font-size:12px"> cm</small></div><div class="rlab">${lab}${rs.length > 1 ? `<br><b class="${Math.abs(d) < 0.05 ? 'muted' : (d < 0 ? 'ok' : 'bad')}">${Math.abs(d) < 0.05 ? 'beze změny' : signed1(d) + ' cm'}</b>` : ''}</div></div>`; }).join('') || '<p class="muted small">Zatím žádné obvody. Změř se v neděli.</p>'}</div>
    <p class="small muted">Když váha týden stojí a pas jde dolů, děje se přesně to, co má – ubývá tuk a drží se svaly.</p>
    ${waist.length ? lineChart({ series: [{ name: 'pas (cm)', color: '#1478d4', pts: waist, dots: true }], xLabel: 'dní od startu', yUnit: 'cm', hLine: { y: s.goal_waist, label: 'cíl ' + s.goal_waist + ' cm', color: '#15803d' }, h: 220 }) : ''}
    ${lineChart({ series: [{ name: 'boky', color: '#1478d4', pts: circ('hips'), dots: true }, { name: 'hrudník', color: '#5b8c3e', pts: circ('chest'), dots: true }, { name: 'stehno', color: '#b7791f', pts: circ('thigh'), dots: true }, { name: 'paže', color: '#8a5a9e', pts: circ('arm'), dots: true }], xLabel: 'dní od startu', yUnit: 'cm', h: 220 })}`,
    `<button class="btn write" onclick="A.measSheet(todayISO(),true)">Zapsat obvody</button>`);
};
A.historySheet = () => {
  const s = S(), ov = calcOverview(s, Meas()); const byDate = Object.fromEntries(Meas().map(m => [m.date, m])); const rowMap = Object.fromEntries(ov.rows.map(r => [r.date, r]));
  const today = todayISO(); const dates = []; for (let d = today; d >= s.start_date && dates.length < 400; d = addDays(d, -1)) dates.push(d);
  UI.sheet('Historie zápisů', 'ťukni na den a oprav nebo doplň',
    `<div class="tbl"><table class="small"><tr><th>Datum</th><th class="n">Váha</th><th class="n">Ø 7 dní</th>${isCoach() ? '<th class="n">Plán</th>' : ''}<th class="n">Pas</th></tr>
    ${dates.map(d => { const m = byDate[d], r = rowMap[d]; return `<tr class="${dayIndex(d) === 6 ? 'sun' : ''} ${d === today ? 'today' : ''}" onclick="UI.closeModal();A.measSheet('${d}')"><td>${czDateShort(d)} <span class="muted">${DAY_SHORT[dayIndex(d)]}</span></td><td class="n">${m && m.weight != null ? fmt1(m.weight) : '<span class="muted">–</span>'}</td><td class="n">${r ? fmt1(r.avg) : ''}</td>${isCoach() ? `<td class="n muted">${fmt1(planWeightAt(s, daysBetween(s.start_date, d)))}</td>` : ''}<td class="n">${m && m.waist != null ? m.waist : ''}</td></tr>`; }).join('')}</table></div>`);
};
A.planVsRealSheet = () => {
  const s = S(), ov = calcOverview(s, Meas()); const T = SEED.texts.prehled; const fmtReal = v => typeof v === 'number' ? fmt2(v) : v;
  UI.sheet('Plán proti skutečnosti', `tempo ${String(s.rate_pct).replace('.', ',')} % váhy za týden`,
    `<table class="small"><tr><th>Ukazatel</th><th class="n">Plán</th><th class="n">Skutečnost</th></tr>
    <tr><td>Váha</td><td class="n">${fmt1(planWeightAt(s, ov.daysSinceStart || 0))} kg</td><td class="n b">${fmt1(ov.cur)} kg</td></tr>
    <tr><td>Shozeno od startu</td><td class="n">${fmt1(Math.max(0, s.start_weight - planWeightAt(s, ov.daysSinceStart || 0)))} kg</td><td class="n b ${ov.dev != null && ov.dev >= 0 ? 'ok' : 'bad'}">${fmt1(Math.max(0, s.start_weight - ov.cur))} kg</td></tr>
    <tr><td>Úbytek za týden</td><td class="n">${fmt2(ov.cur * s.rate_pct / 100)} kg</td><td class="n b">${ov.avgWeekLoss != null ? fmt2(ov.avgWeekLoss) + ' kg' : 'málo dat'}</td></tr>
    <tr><td>Cíl dosažen</td><td class="n">${planGoalDate(s) ? czDate(planGoalDate(s)) : '–'}</td><td class="n b">${goalForecast(s, ov).text}</td></tr>
    <tr><td>Pas dělený výškou</td><td class="n">pod 0,50</td><td class="n b">${ov.waistRatio != null ? fmt2(ov.waistRatio) : '–'}</td></tr></table>
    <p class="small muted">${esc(T.plan_vs_reality_intro.replace('0,70', String(s.rate_pct).replace('.', ',')))}</p>
    <table class="small"><tr><th>Za jak dlouho</th><th class="n">Teoreticky</th><th class="n">Reálně čekej</th><th class="n">Skutečnost</th></tr>
    ${ov.pvr.map(r => `<tr><td>${r.weeks} ${sklon(r.weeks, 'týden', 'týdny', 'týdnů')}</td><td class="n">${fmt2(r.theory)} kg</td><td class="n">${fmt2(r.expect)} kg</td><td class="n ${typeof r.real === 'number' ? (r.real >= r.expect ? 'ok b' : 'bad b') : 'muted'}">${fmtReal(r.real)}${typeof r.real === 'number' ? ' kg' : ''}</td></tr>`).join('')}</table>
    <h3>Cíle a čísla plánu</h3>
    <table class="small"><tr><td>Startovní váha</td><td class="n">${s.start_weight} kg</td></tr><tr><td>Cílová váha</td><td class="n">${s.goal_weight} kg</td></tr><tr><td>Cíl úbytku za týden</td><td class="n">${fmt2(ov.weekTarget)} kg</td></tr><tr><td>Cílový obvod pasu</td><td class="n">${s.goal_waist} cm</td></tr><tr><td>Minimální bílkoviny</td><td class="n">${s.protein_min} g</td></tr><tr><td>Denní cíl chůze</td><td class="n">${s.walk_min} min · ${fmt1(s.walk_kmh)} km/h</td></tr><tr><td>Cíl kroků</td><td class="n">${fmt0(stepsTarget(s))}</td></tr></table>
    <p class="hint">${esc(T.prognosis_note)}</p>`);
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
  if (!pl.ok && !A._forceMeas) { const mm = UI.modal(`<h2>Sedí to?</h2><p class="muted">Zapisuješ <b>${fmt1(m.weight)} kg</b>, ale průměr posledních dnů je <b>${fmt1(pl.prev.avg)} kg</b> (rozdíl ${(pl.diff > 0 ? '+' : '−') + fmt1(Math.abs(pl.diff))} kg je nezvyklý). Překlep, nebo jiná váha?</p><div class="row"><button class="btn sec" onclick="UI.closeModal()">Opravím</button><button class="btn" id="mfy">Je to správně, ulož</button></div>`); mm.querySelector('#mfy').onclick = () => { mm.remove(); A._forceMeas = true; A.saveMeas(); A._forceMeas = false; }; return; }
  Undo.run('Zápis měření', () => { saveMeas(m); UI.closeModal(); render(); }, () => { const ov = calcOverview(S(), Meas()); return `Zápis uložen. Průměr 7 dní ${fmt1(ov.cur)} kg${ov.dev != null ? (ov.dev >= 0 ? `, ${fmt2(ov.dev)} kg před plánem.` : `, ${fmt2(-ov.dev)} kg za plánem.`) : '.'}`; });
};
A.delMeas = d => UI.confirm(`Smazat zápis z ${czDate(d)}?`, () => A.delMeas0(d), 'Smazat');
A.delMeas0 = d => Undo.run('Smazat zápis', () => { Store.remove('measurements', oid('m', d)); UI.closeModal(); render(); }, `Zápis z ${czDate(d)} smazán.`);

/* ---------- TÝDEN ---------- */
function weekToggle() {
  const thisMon = mondayOf(todayISO()), nextMon = addDays(thisMon, 7);
  if (App.week !== thisMon && App.week !== nextMon) App.week = thisMon;
  return `<div class="seg noprint"><button class="${App.week === thisMon ? 'on' : ''}" onclick="App.week='${thisMon}';render()">Tento týden · ${czDateShort(thisMon)}</button><button class="${App.week === nextMon ? 'on' : ''}" onclick="App.week='${nextMon}';render()">Příští · ${czDateShort(nextMon)}</button></div>`;
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
/* ---------- PLÁN: co budu jíst, co koupit, co uvařit ----------
   Naplánovat → nakoupit → uvařit je skutečný sled, proto tři kroky vedle sebe
   místo dvou položek menu (Týden a Jídlo se třemi podzáložkami). */
App.planTab = 'jidla';
const PLAN_TABS = [['jidla', 'Jídla'], ['nakup', 'Nákup'], ['vareni', 'Vaření']];
A.jidlo = tab => { App.planTab = tab === 'spiz' ? 'nakup' : (PLAN_TABS.some(x => x[0] === tab) ? tab : 'nakup'); go('plan'); };
A.planTab = t => { App.planTab = t; render(); window.scrollTo(0, 0); };
VIEWS.plan = function () {
  const t = PLAN_TABS.some(x => x[0] === App.planTab) ? App.planTab : 'jidla';
  if (t === 'nakup' && App.shopMode === 'tisk') return VIEWS._nakup();
  const menu = t === 'jidla' ? 'A.weekMenu()' : t === 'nakup' ? 'A.shopMenu()' : '';
  return `<div class="ph noprint"><div class="pt"><h1>Plán</h1></div>${menu ? `<div class="act"><button class="iconbtn" onclick="${menu}" aria-label="další akce">⋯</button></div>` : ''}</div>
  <div class="seg noprint">${PLAN_TABS.map(([k, l], i) => `<button class="${k === t ? 'on' : ''}" onclick="A.planTab('${k}')"><em>${i + 1}</em>${l}</button>`).join('')}</div>
  ${t === 'vareni' ? '' : weekToggle()}
  ${VIEWS['_' + t]()}`;
};
VIEWS.tyden = () => { App.planTab = 'jidla'; return VIEWS.plan(); };

VIEWS._jidla = function () {
  const s = S(), foods = Foods(), recipes = Recipes(), w = currentWeight();
  const wk = getWeek(App.week); const today = todayISO();
  if (wk.auto && !wk.reviewed && !App.ro) { wk.reviewed = true; saveWeek(wk); }
  const days = wk.plan.map((sels, i) => ({ i, date: addDays(App.week, i), sels, r: calcPlanDay(effSettings(s, addDays(App.week, i)), foods, recipes, sels, w, planActFor(addDays(App.week, i), w)) }));
  const filled = days.reduce((a, d) => a + d.r.filled, 0);
  const full = days.filter(d => d.r.filled === 5);
  const base = calcBase(s, w, s.walk_min, 0, s.walk_kmh, 0, 0);
  const weekDef = full.reduce((a, d) => a + (base.minOut - d.r.kcal), 0);
  const okN = days.filter(d => d.r.state === 2).length;
  const msgs = weekMessages(days, s, filled, w);
  const mism = days.filter(d => d.date >= today && dayMismatch(d.date));
  const bad = days.filter(d => d.date >= today && d.r.filled === 5 && d.r.state !== 2);
  const holes = days.filter(d => d.r.filled > 0 && d.r.filled < 5);
  const tone = filled === 0 ? 'var(--line)' : (okN === 7 ? 'var(--ok)' : (bad.length || mism.length ? 'var(--cheat)' : 'var(--ok)'));
  const headline = filled === 0 ? 'Týden je prázdný' : filled < 35 ? `Naplánováno ${filled} z 35 jídel` : `${okN} ze 7 dní sedí`;
  const subline = full.length ? `Tímto plánem −${fmt2(weekDef / KG_KCAL * 7 / full.length)} kg za týden · limit ${fmt0(base.planLimit)} kcal` : 'Nech si ho navrhnout a pak jen dolaď, co nechceš.';
  let cta;
  if (filled === 0) cta = `<button class="btn block write" onclick="A.genWeek('all')">${ico('star')} Naplánuj mi týden</button>`;
  else if (filled < 35) cta = `<button class="btn block write" onclick="A.genWeek('empty')">${ico('plus')} Doplnit ${35 - filled} ${sklon(35 - filled, 'prázdné místo', 'prázdná místa', 'prázdných míst')}</button>`;
  else if (mism.length) cta = `<button class="btn block write" onclick="A.fitDay('${mism[0].date}')">Dorovnat ${DAY_NAMES[mism[0].i].toLowerCase()} k limitu</button>`;
  else if (bad.length) cta = `<button class="btn block sec write" onclick="A.planDaySheet(${bad[0].i})">Doladit ${DAY_NAMES[bad[0].i].toLowerCase()}</button>`;
  else cta = `<button class="btn block sec" onclick="A.planTab('nakup')">${ico('cart')} Pokračovat na nákup ›</button>`;
  /* vybraný den: dnes, když je v týdnu, jinak pondělí */
  if (App.pDay == null || App.pDayW !== App.week) { const ti = days.findIndex(d => d.date === today); App.pDay = ti >= 0 ? ti : 0; App.pDayW = App.week; }
  const D = days[App.pDay], r = D.r, mm = dayMismatch(D.date);
  const stc = d => d.r.filled === 0 ? '' : d.r.state === 2 && !dayMismatch(d.date) ? 'g' : 'w';
  const pick = ci => { const sel = D.sels[ci], cc = r.courses[ci]; const rem = r.planLimit - r.kcal + cc.kcal, pg = r.protTarget - r.p + cc.p;
    return `openPicker({courseKey:'${s.courses[ci].key}',current:${JSON.stringify(sel || '').replace(/"/g, '&quot;')},remaining:${Math.round(rem)},protGap:${Math.round(pg)},onPick:n=>A.planSel(${D.i},${ci},n)})`; };
  const nm = v => !v ? '<span class="muted">+ vybrat</span>' : v === SITUACE ? 'Vyřeším podle situace' : v === VYNECHAT ? '<span class="muted">vynechat</span>' : esc(v);
  return `<div class="pdays">${days.map(d => `<button class="dy ${d.i === App.pDay ? 'on' : ''} ${d.date < today ? 'past' : ''}" onclick="App.pDay=${d.i};render()"><span>${DAY_SHORT[d.i]}</span><b>${+d.date.slice(8)}</b><i class="${stc(d)}"></i></button>`).join('')}</div>
  <div class="card stack s8"><div class="row between nowrap" style="align-items:flex-start"><div><b style="font-size:17px">${DAY_NAMES[D.i]} ${czDateShort(D.date)}${hq('rTyden')}</b><div class="small muted">${r.filled ? `${fmt0(r.kcal)} z ${fmt0(r.planLimit)} kcal · bílkoviny ${fmt0(r.p)} g` : 'zatím nic naplánováno'}</div></div>${D.date >= today ? `<button class="btn sm sec write" onclick="A.genDay(${D.i})">Navrhnout jinak</button>` : ''}</div>
    ${r.filled ? `<div class="bar"><i style="width:${clamp(r.kcal / Math.max(1, r.planLimit) * 100, 2, 100)}%;background:${r.kcal > r.planLimit + dayTol(r.planLimit) ? '#d97706' : '#2563eb'}"></i></div>` : ''}
    ${mm && D.date >= today ? `<button class="btn sm write" onclick="A.fitDay('${D.date}')">${mm.diff > 0 ? 'Přidat ' + fmt0(mm.diff) : 'Ubrat ' + fmt0(-mm.diff)} kcal k limitu</button>` : ''}</div>
  <div class="card flush">${s.courses.map((c, ci) => `<div class="li" onclick="${D.date >= today || !App.ro ? pick(ci) : ''}"><span class="tm">${c.time}</span><div class="tx"><b>${nm(D.sels[ci])}</b><span>${esc(c.name.toLowerCase())}</span></div><span class="val k">${r.courses[ci].active || r.courses[ci].situace ? fmt0(r.courses[ci].kcal) : ''}</span></div>`).join('')}</div>
  ${msgs[0] && filled ? `<div class="tipb">${ico('star')}<span>${esc(msgs[0].text)}</span></div>` : ''}
  <div class="small muted" style="text-align:center">${headline}${full.length ? ' · ' + subline.split(' · ')[0].toLowerCase() : ''}</div>
  ${cta}`;
};
A.weekMenu = () => { const wk = getWeek(App.week); const filled = wk.plan.flat().filter(Boolean).length; const prev = getWeek(addDays(App.week, -7)); const prevHas = prev.plan.some(d => d.some(Boolean));
  UI.menu('Týden od ' + czDateShort(App.week), [
    ['✨ Naplánuj mi celý týden', "A.genWeek('all')", filled ? 'současný výběr se přepíše (jde vrátit)' : 'podle limitu, oblíbených a rutiny'],
    filled && filled < 35 ? ['💡 Doplnit prázdná místa', "A.genWeek('empty')", ''] : null,
    prevHas ? ['📋 Zkopírovat minulý týden', 'A.copyWeek()', ''] : null,
    [`${routineOn() ? '✓ ' : ''}Rutina: stejná snídaně a svačina`, 'A.toggleRoutine()', routineOn() ? 'zapnutá – méně vážení, dvě jídla zpaměti' : 'vypnutá – každý den jiné'],
    filled ? ['🗑️ Vyprázdnit týden', 'A.clearWeek()', ''] : null]); };
/* den plánu v listu: pět chodů, návrh znovu, dorovnání k limitu */
A.planDaySheet = i => openSheet(() => {
  const s = S(), w = currentWeight(); const wk = getWeek(App.week); const date = addDays(App.week, i); const sels = wk.plan[i];
  const r = calcPlanDay(effSettings(s, date), Foods(), Recipes(), sels, w, planActFor(date, w)); const mm = dayMismatch(date);
  const pbtn = ci => { const sel = sels[ci]; const cc = r.courses[ci]; const rem = r.planLimit - r.kcal + cc.kcal; const pg = r.protTarget - r.p + cc.p;
    return `<button class="pickbtn sm ${sel ? '' : 'empty'} write" onclick="openPicker({courseKey:'${s.courses[ci].key}',current:${JSON.stringify(sel || '').replace(/"/g, '&quot;')},remaining:${Math.round(rem)},protGap:${Math.round(pg)},onPick:n=>A.planSel(${i},${ci},n)})"><span>${sel ? (sel === SITUACE ? '🎲 podle situace' : sel === VYNECHAT ? '— vynechat' : esc(sel)) : '+ vybrat'}</span>${sel && sel !== SITUACE && sel !== VYNECHAT && isFav(sel) ? '<em>★</em>' : ''}</button>`; };
  return UI.sheetHtml(`${DAY_NAMES[i]} ${czDateShort(date)}`, r.filled ? `${fmt0(r.kcal)} kcal · ${fmt0(r.p)} g bílkovin · limit ${fmt0(r.planLimit)}` : 'zatím nic naplánováno',
    `${r.filled ? `<div class="status st${r.state === 2 ? 2 : r.state === 1 ? 1 : 3}">${esc(r.status)}${mm ? ` · plán má ${fmt0(mm.planned)}, limit ${fmt0(mm.limit)}` : ''}</div>` : ''}
    <div class="list">${s.courses.map((c, ci) => `<div class="li static"><span class="tm">${c.time}</span><span class="em">${COURSE_EMOJI[c.key]}</span><div class="tx" style="flex:1">${pbtn(ci)}</div><span class="val k">${r.courses[ci].active || r.courses[ci].situace ? fmt0(r.courses[ci].kcal) : ''}</span></div>`).join('')}</div>`,
    `<button class="btn sec write" onclick="A.genDay(${i})">💡 Navrhnout den znovu</button>${mm && date >= todayISO() ? `<button class="btn write" onclick="A.fitDay('${date}')">${mm.diff > 0 ? 'Přidat ' + fmt0(mm.diff) : 'Ubrat ' + fmt0(-mm.diff)} kcal</button>` : ''}`);
});

A.planSel = (di, ci, v) => Undo.run('Plán', () => { const wk = getWeek(App.week); wk.plan[di][ci] = v || null; saveWeek(wk); noteRecent(v); render(); }, () => { const r = calcPlanDay(S(), Foods(), Recipes(), getWeek(App.week).plan[di], currentWeight()); return `${DAY_NAMES[di]}: ${S().courses[ci].name.toLowerCase()} → ${v === SITUACE ? 'podle situace' : v === VYNECHAT ? 'vynechat' : v}. ${r.filled === 5 ? 'Den ' + r.status + '.' : 'Zbývá vybrat ' + (5 - r.filled) + ' jídel.'}`; });
A.copyWeek = () => Undo.run('Kopie týdne', () => { const prev = getWeek(addDays(App.week, -7)); const wk = getWeek(App.week); wk.plan = JSON.parse(JSON.stringify(prev.plan)); saveWeek(wk); render(); }, 'Minulý týden zkopírován. Uprav, co chceš jinak.');
A.clearWeek = () => Undo.run('Vyprázdnit týden', () => { const wk = getWeek(App.week); wk.plan = wk.plan.map(() => [null, null, null, null, null]); saveWeek(wk); render(); }, 'Týden vyprázdněn.');

App.shopMode = 'obchod';
App.shopDays = null;   // null = celý týden, jinak pole indexů dnů
A.shopMode = m => { App.shopMode = m; render(); };
A.shopDay = i => { const cur = App.shopDays || [0, 1, 2, 3, 4, 5, 6]; App.shopDays = cur.includes(i) ? cur.filter(x => x !== i) : cur.concat([i]).sort(); if (App.shopDays.length === 7) App.shopDays = null; render(); };
A.shopAll = () => { App.shopDays = null; render(); };
A.shopFromToday = () => { const mon = App.week, t = todayISO(); const ds = []; for (let k = 0; k < 7; k++) if (addDays(mon, k) >= t) ds.push(k); App.shopDays = ds.length && ds.length < 7 ? ds : null; render(); };


/* ---------- NÁKUP ----------
   Jeden seznam, dvě podoby: „v obchodě“ se zaškrtávátky a „na tisk“ na jednu A4.
   Řazení podle regálů, ne podle kategorií potravin – obchod projdeš jednou.
   Spíž už není samostatná záložka: trvanlivé suroviny mají v řádku „mám doma“. */
VIEWS._nakup = function () {
  const s = S(), foods = Foods(), recipes = Recipes(), w = currentWeight();
  const wk = getWeek(App.week); const shop = getShop(App.week);
  const pick = App.shopDays;
  const list = calcShopping(s, foods, recipes, wk.plan, w, weekActs(App.week, w), pick);
  const dnu = pick ? pick.length : 7;
  const dayp = `<div class="card noprint"><div class="row between"><b>Nakupuju na</b><span class="small muted">${dnu === 7 ? 'celý týden' : `${dnu} ${DEN(dnu)}`}</span></div>
    <div class="dayp">${DAY_NAMES.map((d, i) => `<button class="${!pick || pick.includes(i) ? 'on' : ''}" onclick="A.shopDay(${i})" title="${d}">${DAY_SHORT[i]}</button>`).join('')}</div></div>`;
  if (!list.length) return dayp + `<div class="card empty"><span class="em">🛒</span>Na vybrané dny nemáš naplánovaná jídla.<button class="btn sec sm" onclick="A.planTab('jidla')">Naplánovat jídla</button></div>`;
  const tydnu = Math.max(0.5, dnu / 7);
  const doma = [], koupit = [];
  list.forEach(x => { const st = x.pantry ? pantryState(x.food, x.g / tydnu) : 'nemam'; (st === 'mam' ? doma : koupit).push({ ...x, pstate: st }); });
  const done = koupit.filter(x => shop.checked[x.food]).length;
  const dokup = koupit.filter(x => shop.checked[x.food] && shop.bought && shop.bought[x.food] != null && x.g > shop.bought[x.food] + 20).map(x => ({ ...x, chybi: x.g - shop.bought[x.food] }));
  const aisles = [...new Set(koupit.map(x => x.aisle))];
  if (App.shopMode === 'tisk') {
    const sloupcu = koupit.length > 46 ? 3 : 2;
    return `<div class="ph noprint"><div class="pt"><h1>Nákup na tisk</h1><span class="sub">${koupit.length} ${sklon(koupit.length, 'položka', 'položky', 'položek')} · jedna A4</span></div><div class="act"><button class="btn sec sm" onclick="App.shopMode='obchod';render()">Zpět</button><button class="btn sm" onclick="window.print()">Vytisknout</button></div></div>
      <div class="card ptisk"><div class="row between"><h2>Nákup · ${czDateShort(App.week)}${pick ? ` · ${pick.map(i2 => DAY_SHORT[i2]).join(' ')}` : ' · celý týden'}</h2><span class="small muted">${koupit.length}</span></div>
      <div class="plist2" style="column-count:${sloupcu}">${aisles.map(a => `<div class="pgrp"><h3>${esc(a)}</h3>${koupit.filter(x => x.aisle === a).map(x => `<div class="pln"><span class="box"></span><span class="nm">${esc(x.food)}</span><b>${x.buy}</b></div>`).join('')}</div>`).join('')}</div></div>`;
  }
  const radek = x => `<tr class="${shop.checked[x.food] ? 'done' : ''}"><td style="width:34px"><input type="checkbox" class="write" ${shop.checked[x.food] ? 'checked' : ''} onchange="A.shopCheck('${esc(x.food)}',this.checked,${x.g})" aria-label="${esc(x.food)}"></td>
    <td class="nm">${esc(x.food)}${x.uses > 1 && (['Ořechy a semínka', 'Uzeniny'].includes(x.cat) || /Sýr|Eidam|Gouda|Feta|Šunka/.test(x.food)) ? `<div class="tiny muted">rozděl na ${x.uses} ${sklon(x.uses, 'porci', 'porce', 'porcí')} po ${fmt0(x.g / x.uses)} g</div>` : ''}${x.pantry && !shop.checked[x.food] ? `<div><button class="btn ghost sm write" style="padding:0;min-height:24px;font-size:12.5px;font-weight:600;color:var(--ink3)" onclick="A.pantry('${esc(x.food)}','mam')">mám doma ›</button></div>` : ''}</td>
    <td class="q">${x.buy}${x.packs ? `<div class="tiny muted" style="font-weight:500">potřeba ${fmt0(x.g)} g</div>` : ''}</td></tr>`;
  return dayp + `${dokup.length ? `<div class="alert a2"><div>Po nákupu se změnil plán. Dokup: ${dokup.map(x => `<b>${esc(x.food)} ${fmt0(x.chybi)} g</b>`).join(', ')}.</div></div>` : ''}
  <div class="card stack s8"><div class="row between"><b>${done} z ${koupit.length} v košíku</b>${doma.length ? `<span class="small muted">${doma.length} máš doma</span>` : ''}</div><div class="bar"><i style="width:${koupit.length ? Math.max(2, done / koupit.length * 100) : 0}%;background:#16a34a"></i></div></div>
  <div class="masonry">${aisles.map(a => `<div class="card"><h3>${esc(a)}</h3><table class="shop">${koupit.filter(x => x.aisle === a).map(radek).join('')}</table></div>`).join('')}</div>
  <div class="card flush">
    ${doma.length ? `<div class="lh">Máš doma – na lístku nejsou</div>${doma.map(x => `<div class="navrow" style="cursor:default"><div class="tx"><b>${esc(x.food)}</b><span>potřeba ${x.buy}</span></div><button class="btn sec sm write" onclick="A.pantry('${esc(x.food)}','nemam')">došlo</button></div>`).join('')}` : ''}
    <div class="navrow" onclick="A.pantrySheet()"><span class="ico">🫙</span><div class="tx"><b>Celá spíž</b><span>trvanlivé suroviny · mám doma / došlo</span></div><span class="chev">›</span></div></div>`;
};
A.shopMenu = () => UI.menu('Nákup', [
  ['🖨️ Na tisk', "App.shopMode='tisk';render()", 'jedna A4, dva nebo tři sloupce'],
  ['📅 Celý týden', 'A.shopAll()', ''], ['⏩ Od dneška', 'A.shopFromToday()', 'jen dny, které ještě přijdou'],
  ['🫙 Celá spíž', 'A.pantrySheet()', 'co máš doma z trvanlivých'],
  ['↺ Odškrtnout vše zpět', 'A.shopReset()', 'když nákup začínáš znovu']]);
/* „Odškrtnout vše zpět“ dřív volalo funkci, která neexistovala */
A.shopReset = () => Undo.run('Odškrtnutí zrušeno', () => { const shop = getShop(App.week); shop.checked = {}; shop.bought = {}; Store.put('shopping', oid('s', App.week), shop); render(); }, 'Seznam je zase celý neodškrtnutý.');
/* Spíž: jen trvanlivé suroviny a jen tři stavy. Čerstvé se neevidují. */
A.pantrySheet = () => openSheet(() => {
  const foods = Foods().filter(f => f.pantry); const s = S(), w = currentWeight();
  const need = Object.fromEntries(calcShopping(s, Foods(), Recipes(), getWeek(App.week).plan, w, weekActs(App.week, w)).map(x => [x.food, x.g]));
  const gr = {}; foods.forEach(f => { (gr[f.aisle] = gr[f.aisle] || []).push(f); });
  const st = f => pantryState(f.name, need[f.name] || 0);
  const znam = f => !!pantryRaw()[f.name];
  const btn = (f, k) => `<button class="pst ${znam(f) && st(f) === k ? 'on ' + PANTRY_ST[k][1] : ''} write" onclick="A.pantry('${esc(f.name)}','${k}')">${PANTRY_ST[k][0]}</button>`;
  return UI.sheetHtml('Spíž', `${foods.length} trvanlivých surovin · co máš, nebude na lístku`,
    `<p class="small muted">Tohle není inventura. Odškrtnutím v Nákupu se trvanlivá položka přepne na „mám doma“ a zůstane tak, dokud neťukneš „došlo“.</p>
    ${Object.entries(gr).map(([a, fs]) => `<div><div class="lh" style="padding-left:0">${esc(a)}</div>${fs.map(f => `<div class="prow"><div class="pn">${esc(f.name)}${f.pack ? `<span class="tiny muted"> · ${f.pack >= 1000 ? fmt1(f.pack / 1000) + ' kg' : f.pack + ' g'}${need[f.name] ? ` · týdně ${fmt0(need[f.name])} g` : ''}</span>` : ''}</div><div class="pb">${['mam', 'nemam'].map(k => btn(f, k)).join('')}</div></div>`).join('')}</div>`).join('')}`);
});
VIEWS.jidlo = () => VIEWS.plan();
VIEWS.mereni = () => VIEWS.pokrok();

/* ---------- VÍCE ---------- */
VIEWS.more = function () {
  const items = moreItems();
  return `<div class="ph"><div class="pt"><h1>Více</h1></div></div>
  <div class="card flush">${items.map(([v, l, sub, em]) => `<div class="navrow" onclick="go('${v}')"><span class="ico">${em}</span><div class="tx"><b>${l}</b><span>${sub}</span></div><span class="chev">›</span></div>`).join('')}</div>
  <div class="card flush"><div class="navrow" onclick="A.syncInfo()"><span class="ico">☁️</span><div class="tx"><b>${Store.localMode() ? 'Bez cloudu' : 'Synchronizace'}</b><span>${Store.localMode() ? 'data jsou jen v tomto prohlížeči' : (Store.outbox.length ? Store.outbox.length + ' ' + sklon(Store.outbox.length, 'změna čeká', 'změny čekají', 'změn čeká') : 'vše uložené')}</span></div><span class="chev">›</span></div>
    <div class="navrow" onclick="A.logout()"><span class="ico">🚪</span><div class="tx"><b>Odhlásit</b><span>${esc(Store.session ? Store.session.user.email : (isCoach() ? 'trenér' : 'Robert'))}</span></div><span class="chev">›</span></div></div>`;
};
/* ---------- NASTAVENÍ ---------- */
VIEWS.ucet = function () {
  const coach = isCoach();
  return `<div class="ph"><button class="iconbtn" onclick="go('more')" aria-label="zpět">‹</button><div class="pt"><h1>Nastavení</h1></div></div>
  <div class="card stack s8"><h2>Účet</h2><p class="small muted">${Store.localMode() ? 'Aplikace běží bez cloudu – data jsou jen v tomto prohlížeči. Udělej si zálohu.' : `Přihlášen: ${esc(Store.session ? Store.session.user.email : '')} · ${coach ? 'trenér' : 'klient'}`}</p>
    <div class="row">${Store.localMode() ? '' : '<button class="btn sec sm" onclick="Store.sync().then(()=>{render();UI.toast(\'Synchronizováno\')})">Synchronizovat teď</button>'}<button class="btn sec sm" onclick="A.logout()">Odhlásit</button></div></div>
  ${!coach && !Meas().length ? `<div class="card stack s8"><h2>Historie ze sešitu</h2><p class="small muted">Zatím nemáš žádné vážení. Můžeš nahrát 14 vážení a obvody z Excelu (27. 8. – 9. 9. 2026), ať grafy navazují.</p><div class="row"><button class="btn sec sm" onclick="A.seedMeas()">Nahrát vážení ze sešitu</button></div></div>` : ''}
  ${coach ? `<div class="card stack s8"><h2>Výchozí data</h2><p class="small muted">Naplnění je bezpečné opakovat – záznamy se párují podle id.</p><div class="row"><button class="btn sec sm" onclick="A.seedAll()">Naplnit výchozí data</button>${Store.localMode() ? '<button class="btn sec sm" onclick="A.seedMeas()">Nahrát 14 vážení ze sešitu</button>' : ''}</div></div>` : ''}
  ${coach ? '' : `<div class="card stack s8"><h2>🔔 Připomínky</h2><p class="small muted">Váha ${WEIGH_TIME}, jídla v časech chodů, kroky 20:00 a potvrzení dne ${CLOSE_TIME} – jen když to ještě nemáš hotové. Chodí i do zavřené appky.${Push.iphone() && !Push.naPlose() ? ' <b>Na iPhonu nejdřív přidej appku na plochu</b> a otevři ji odtamtud.' : ''}</p>
    <div class="row" id="pushstav"><span class="small muted">zjišťuju…</span></div>
    <details><summary class="small muted">Místo toho kalendář (.ics)</summary><div class="row"><button class="btn ghost sm" onclick="A.exportIcs()">📅 Stáhnout do kalendáře</button></div><p class="hint">Pevné časy bez ohledu na to, co máš hotové. iPhone: otevři soubor a „Přidat vše“.</p></details></div>`}
  ${coach ? '' : containersCard()}
  <div class="card stack s8"><h2>Export a záloha</h2><p class="small muted">Excel obsahuje měření, dny a plány týdnů. JSON je kompletní záloha, kterou jde nahrát zpět.</p>
    <div class="row"><button class="btn sec sm" onclick="A.exportXlsx()">Export do Excelu</button><button class="btn sec sm" onclick="A.exportJson()">Záloha JSON</button><label class="btn sec sm" style="cursor:pointer">Nahrát zálohu<input type="file" accept=".json" style="display:none" onchange="A.importJson(this.files[0])"></label></div></div>`;
};

/* ---------- SUROVINY ---------- */
App.fq = ''; App.fcol = {}; App.fsort = '';
VIEWS._suroviny = function () {
  const foods = Foods(); const q = App.fq.toLowerCase().trim(); const coach = isCoach();
  const list = foods.filter(f => !q || f.name.toLowerCase().includes(q) || f.cat.toLowerCase().includes(q)).sort((a, b) => App.fsort === 'kcal' ? a.kcal - b.kcal : App.fsort === 'p' ? b.p - a.p : a.name.localeCompare(b.name, 'cs'));
  const cats = [...new Set(foods.map(f => f.cat))].sort((a, b) => a.localeCompare(b, 'cs'));
  const edit = f => coach ? `A.editFood('${f.id}')` : (f.own ? `A.editFood('${f.id}','own')` : `A.editFood(null,'own',null,'${f.id}')`);
  const row = f => `<tr onclick="${edit(f)}"><td class="b">${f.own ? '📌 ' : (f.overridden ? '✏️ ' : '')}${esc(f.name)}</td><td class="n b m-kcal">${vShow(f.kcal)}</td><td class="n m-prot">${vShow(f.p)}</td><td class="n hm">${vShow(f.c)}</td><td class="n hm">${vShow(f.f)}</td></tr>`;
  const grouped = !q && !App.fsort;
  return `<div class="search"><input type="text" id="fq" placeholder="surovina nebo kategorie…" value="${esc(App.fq)}" oninput="App.fq=this.value;render()"></div>
  <div class="chips scroll">${[['', 'kategorie'], ['kcal', 'kcal ↑'], ['p', 'bílkoviny ↓']].map(([k, l]) => `<button class="chip ${App.fsort === k ? 'on' : ''}" onclick="App.fsort='${k}';render()">${l}</button>`).join('')}<button class="chip" onclick="A.editFood(null,'${coach ? 'global' : 'own'}')">+ ${coach ? 'nová surovina' : 'moje surovina'}</button></div>
  <div class="card flush"><div class="tbl"><table class="small"><tr><th style="padding-left:14px">Surovina · na 100 g nákupního stavu</th><th class="n">kcal</th><th class="n">B</th><th class="n hm">S</th><th class="n hm">T</th></tr>
    ${grouped ? cats.map(c => { const items = list.filter(f => f.cat === c); const col = App.fcol[c] !== false; return `<tr class="cath" onclick="App.fcol['${esc(c)}']=${col ? 'false' : 'true'};render()"><td colspan="5">${col ? '▸' : '▾'} ${c === 'Pozor' ? '⚠️ ' : ''}${esc(c)} <span class="muted" style="font-weight:500">· ${items.length}</span></td></tr>` + (col ? '' : items.map(row).join('')); }).join('') : list.map(row).join('')}
  </table></div>${!list.length ? '<div class="empty">Nic nenalezeno.</div>' : ''}</div>`;
};
VIEWS.suroviny = function () {
  return `<div class="ph"><button class="iconbtn" onclick="go('more')" aria-label="zpět">‹</button><div class="pt"><h1>Suroviny</h1><span class="sub">${Foods().length} · hodnoty na 100 g</span></div></div>${VIEWS._suroviny()}`;
};
VIEWS.recepty = function () { return VIEWS._recepty(); };

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
  return `<div class="ph"><button class="iconbtn" onclick="go('more')" aria-label="zpět">‹</button><div class="pt"><h1>Návod</h1><span class="sub">pravidla, slovníček, jak appka počítá</span></div></div>
  <div class="card tint-p stack s8"><p style="font-size:17px;font-weight:700">${esc(T.start_intro[0])}</p><p class="small muted">${esc(T.start_intro[1])}</p><div class="row"><button class="btn sec sm" onclick="A.intro(0)">Ukázat úvod znovu</button></div></div>
  <div class="tiles"><div class="tile big"><div class="tt">${fmt0(b.planLimit)}</div><div class="tb">kcal na jídlo a pití za den</div></div><div class="tile big"><div class="tt">${fmt1(Math.max(0, ov.cur - s.goal_weight))} kg</div><div class="tb">do cíle ${s.goal_weight} kg</div></div><div class="tile big"><div class="tt">${Math.round(ov.progress * 100)} %</div><div class="tb">cesty za tebou</div></div><div class="tile big"><div class="tt">${esc(ov.phase.split(' – ')[0])}</div><div class="tb">${esc(ov.phase.split(' – ')[1] || 'fáze chůze')}</div></div></div>
  ${sec('rules', '📜', 'Deset pravidel, která platí vždy', 'Krátká. Když si nebudeš vědět rady, vrať se sem.', `<div class="rules2">${T.rules.map((r, i) => `<div class="rule"><span class="rem">${RULE_EM[i] || '•'}</span><div>${esc(r)}</div></div>`).join('')}</div>`, true)}
  ${sec('day', '☀️', 'Jak vypadá tvůj den v appce', 'Ráno váha, pět jídel, chůze, večer shrnutí. Appka tě vede zvýrazněným řádkem – další krok s tlačítkem.', steps([['Ráno: zvaž se', 'Po WC, nalačno. Zapíšeš přímo ve zvýrazněném řádku. Průměr 7 dní si poradí s výkyvy.'], ['Jídla podle plánu', 'Naskočí z Plánu. Po jídle ťukni na kolečko. Nesedí? Otevři jídlo a dej 💡 jiný návrh.'], ['Chůze a trénink', 'U chůze přidávej minuty tlačítkem +15. Trénink otevři a odcvič nebo odškrtni. Pohyb zvedá limit jídla.'], ['Cheat', 'Pivo nebo řízek zapiš ráno do řádku Cheat – appka ti zvedne cíl chůze, ať tě to nestojí tempo.'], ['Večer', 'Zapiš kroky a uzavři den – uvidíš verdikt a ťukneš, jak ti bylo s jídlem. Když na to zapomeneš, den se uzavře sám.']]))}
  ${sec('week', '🗓️', 'Neděle – 10 minut', 'Obvody, plán týdne, nákup. Všechno v záložce Plán: Jídla → Nákup → Vaření.', steps([['Změř obvody', 'Pas, boky, hrudník, stehno, paže – ráno nalačno, stejné místo.'], ['Projdi návrh týdne', 'Po 18:00 appka navrhne příští týden. Změň, co nechceš (hvězdičkou označ oblíbené – budou častěji).'], ['Nákup', 'Seznam se složí sám z plánu, podle regálů. Co máš doma, označ „mám doma“.'], ['Vaření', 'Vyber dny, na které vaříš. Gramy jsou v nákupním stavu, přepočítané na tvoji váhu.']]))}
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
    ['Rezerva', 'limit dne − příjem', 'Kolik ti ještě zbývá do limitu. Kroužek Jídlo nahoře na Dnes.'],
    ['Spodní hranice jídla', `${fmt0(b.floor)} kcal`, 'Limit nikdy nespadne pod 85 % klidového výdeje. Když na ní limit drží, znamená to málo pohybu – a menší deficit, než má být.'],
    ['Cíl jídla', 'např. snídaně 620 kcal', 'Kolik má mít jedno jídlo. Appka podle toho škáluje přílohu.'],
    ['Cíl chůze', `${s.walk_min} min denně`, 'Kolik minut chůze máš denně ujít. Pozor, neplést s cílem jídla.'],
    ['Tempo hubnutí', `${String(s.rate_pct).replace('.', ',')} % váhy týdně`, 'Jak rychle má váha klesat. Mění ho jen trenér.'],
  ]))}
  ${sec('why', '🧠', 'O plánu – proč je postavený takhle', 'Cíl, klíčová čísla a rozhodnutí.', tiles(T.o_planu.goal.map(r => [r[0], r[1]])) + '<h3>Klíčová čísla</h3>' + tiles(T.o_planu.numbers.map(r => [r[0], r[1]])) + '<h3>Rozhodnutí</h3>' + tiles(T.o_planu.decisions.map(r => [r[0], r[1]])))}`;
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
function lineChart({ series, xLabel, yUnit, hLine, marks, tips, xFmt, h = 260 }) {
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
  xt.forEach(v => { g += `<text x="${X(v)}" y="${H - B + 16}" font-size="11" fill="#7a878c" text-anchor="middle">${xFmt ? xFmt(v) : fmtTick(v)}</text>`; });
  g += `<text x="${(L + W - R) / 2}" y="${H - 4}" font-size="11" fill="#7a878c" text-anchor="middle">${xLabel}</text>`;
  if (hLine) g += `<line x1="${L}" x2="${W - R}" y1="${Y(hLine.y)}" y2="${Y(hLine.y)}" stroke="${hLine.color}" stroke-dasharray="3 4"/><text x="${W - R}" y="${Y(hLine.y) - 4}" font-size="11" fill="${hLine.color}" text-anchor="end">${hLine.label}</text>`;
  series.forEach(sr => { if (!sr.pts.length) return; const d = sr.pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('');
    g += `<path d="${d}" fill="none" stroke="${sr.color}" stroke-width="${sr.thin ? 1.2 : 2.2}" ${sr.dash ? 'stroke-dasharray="6 5"' : ''} stroke-linejoin="round"/>`;
    if (sr.dots) sr.pts.forEach(p => { g += `<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="3" fill="${sr.color}"/>`; }); });
  /* svislé značky: zásahy trenéra – bez nich nepoznáš, jestli změna tempa něco udělala */
  g += marksSvg(marks, x0, x1, X, T, H - B);
  /* popisek po najetí: body se uloží do registru, svg nese jen id (HTML v atributu by se rozbilo) */
  let tipId = '';
  if (tips && tips.length) { tipId = 'ct' + (++lineChart.n); lineChart.reg[tipId] = tips.filter(t => t.x >= x0 && t.x <= x1).map(t => ({ sx: X(t.x), sy: Y(t.y), html: t.html }));
    const ks = Object.keys(lineChart.reg); if (ks.length > 40) ks.slice(0, ks.length - 40).forEach(k => delete lineChart.reg[k]);
    g += `<g class="tipg" style="display:none"><line y1="${T}" y2="${H - B}" stroke="#1478d4" stroke-width="1" stroke-dasharray="2 3"/><circle r="5.5" fill="#fff" stroke="#1478d4" stroke-width="2.5"/></g>`; }
  g += '</svg>';
  if (tipId) g = `<div class="chartw" data-tip="${tipId}">${g}<div class="ctip" hidden></div></div>`;
  return g + `<div class="legend">${series.filter(sr => sr.pts.length).map(sr => `<span><i style="background:${sr.color}"></i>${sr.name}</span>`).join('')}${yUnit ? `<span class="muted">osa: ${yUnit}</span>` : ''}</div>`;
}
lineChart.n = 0; lineChart.reg = {};
/* zásahy trenéra v grafu: víc změn v jeden den = jeden štítek, blízké štítky se střídají nahoře a níž */
function logMarks(s) { const by = {}; (s.log || []).forEach(l => { (by[l.at] = by[l.at] || []).push(l); });
  return Object.keys(by).sort().map(at => { const L = by[at]; const last = L[L.length - 1];
    return { x: daysBetween(s.start_date, at), label: L.length > 1 ? `⚙︎ ${L.length} ${sklon(L.length, 'změna', 'změny', 'změn')}` : `⚙︎ ${last.pop.split(' ')[0]} ${logVal(last, last.to)}`, title: L.map(l => `${l.pop}: ${logVal(l, l.from)} → ${logVal(l, l.to)}`).join('\n') }; }); }
const logVal = (l, v) => l.k === 'walk_kmh' ? paceTxt(v) : String(v).replace('.', ',');
function marksSvg(marks, x0, x1, X, T, bottom) { let g = '', lastX = -1e9, lvl = 0;
  (marks || []).filter(m => m.x >= x0 && m.x <= x1).forEach(m => { const px = X(m.x); lvl = px - lastX < 80 ? (lvl + 1) % 2 : 0; lastX = px;
    g += `<g><title>${esc(m.title || m.label)}</title><line x1="${px}" x2="${px}" y1="${T}" y2="${bottom}" stroke="#8a5a9e" stroke-width="1.2" stroke-dasharray="2 3"/><text x="${px + 3}" y="${T + 10 + lvl * 12}" font-size="10" fill="#8a5a9e">${esc(m.label)}</text></g>`; });
  return g; }
/* nejbližší bod podle osy x; myš i ťuknutí na mobilu */
let chartTipOn = null;
function chartTip(e) {
  const w = e.target && e.target.closest ? e.target.closest('.chartw[data-tip]') : null;
  const hide = el => { if (!el) return; const t = el.querySelector('.ctip'), g = el.querySelector('.tipg'); if (t) t.hidden = true; if (g) g.style.display = 'none'; };
  if (chartTipOn && chartTipOn !== w) { hide(chartTipOn); chartTipOn = null; }
  if (!w) return;
  const pts = lineChart.reg[w.dataset.tip], svg = w.querySelector('svg'); if (!pts || !pts.length || !svg) return;
  const m = svg.getScreenCTM(); if (!m) return;
  const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const sp = pt.matrixTransform(m.inverse());
  let best = pts[0]; pts.forEach(p => { if (Math.abs(p.sx - sp.x) < Math.abs(best.sx - sp.x)) best = p; });
  if (Math.abs(best.sx - sp.x) > 45) { hide(w); chartTipOn = null; return; }
  chartTipOn = w;
  const g = svg.querySelector('.tipg'); g.style.display = ''; const ln = g.querySelector('line'), c = g.querySelector('circle');
  ln.setAttribute('x1', best.sx); ln.setAttribute('x2', best.sx); c.setAttribute('cx', best.sx); c.setAttribute('cy', best.sy);
  const sc = svg.createSVGPoint(); sc.x = best.sx; sc.y = best.sy; const scr = sc.matrixTransform(m); const wr = w.getBoundingClientRect();
  const tip = w.querySelector('.ctip'); tip.innerHTML = best.html; tip.hidden = false;
  const px = scr.x - wr.left, py = Math.max(44, Math.min(wr.height - 44, scr.y - wr.top));
  const tw = tip.offsetWidth; let left = px + 14; if (left + tw > wr.width) left = px - 14 - tw; if (left < 0) left = Math.max(0, wr.width - tw);
  tip.style.left = left + 'px'; tip.style.top = py + 'px';
}
document.addEventListener('pointermove', chartTip); document.addEventListener('pointerdown', chartTip);
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

