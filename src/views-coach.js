/* ===== Obrazovky trenéra: Robert · Plán ===== */
/* Komunikace s Robertem se v appce nevede (rozhodnutí 29. 9. 2026). */
/* ---------- ROBERT: co se děje, kde to vzniklo, co s tím (1. 10. 2026) ----------
   Celá obrazovka se vejde na notebook 1366×768 bez rolování: pruh s verdiktem a čísly,
   graf (váha / obvody) vedle problémů a dole mapa 14 dní. Podrobnosti jsou v listech.
   Problémy mají jeden zdroj – diagnoza() (rozbor váhy + signály bez duplicit). */
App.cg = App.cg || 'w'; App.cgR = App.cgR || 56; App.cgO = App.cgO || 'waist';
VIEWS.klient = function () {
  const s = S(), ov = calcOverview(s, Meas()); const uid = Store.ownerId();
  const dg = diagnoza(); const r = perRange(); const pd = diagnoza(r.from, r.to); App._diag = pd.list;
  const state = { 1: ['bad', '🔴 Zasáhnout', 'tint-b'], 2: ['warn', '🟡 Pohlídat', 'tint-o'], 3: ['ok', '🟢 V pořádku', 'tint-ok'] }[dg.lvl];
  const name = (Store.clients.find(x => x.id === uid) || {}).display_name || 'Robert';
  const ch = sinceLast();
  const W = weightWhy(), p0 = dg.list[0];
  const head = W.state === 'pomalu' ? `Hubne pomaleji než plán${p0 ? ' – hlavně: ' + p0.title : ''}` : W.state === 'rychle' ? `Hubne rychleji než plán${p0 ? ' – ' + p0.title : ''}` : p0 && dg.lvl < 3 ? p0.title : (ov.weekBack && ov.weekBack.lostW != null ? `Drží plán: −${fmt2(ov.weekBack.lostW)} kg za týden.` : 'Zatím málo dat.');
  return `<div class="card ${state[2]} kstrip">
    <div class="kv"><div class="row nowrap"><span class="pill ${state[0]}">${state[1]}</span><b class="kn">${esc(name)}</b><span class="small muted">${czDateShort(todayISO())}</span></div><div class="kh">${esc(head)}</div></div>
    <div class="kpis">${kpis(s, ov)}</div>
    <div class="kact">${ch.items.length ? `<button class="btn ghost sm" onclick="A.sinceSheet()" title="Od poslední návštěvy">🔔 ${ch.items.length}</button>` : ''}<button class="btn ghost sm" onclick="A.numbersSheet()" title="Čísla za 6 týdnů a 28 dní">📊</button></div>
  </div>
  <div class="cock">
    <div class="card kprob">${probList(pd, r)}</div>
    <div class="card kchart">${chartCard(s, ov)}</div>
    <div class="card kmap">${periodCard()}</div>
  </div>`;
};
/* pět čísel: týdenní průměr, trend, prognóza, pas, potvrzené dny */
function kpis(s, ov) {
  const wa = weekAvgs(), t = todayISO(), thisMon = mondayOf(t);
  let cur = wa[wa.length - 1]; if (cur && cur.mon === thisMon && cur.n < 2 && wa.length > 1) cur = wa[wa.length - 2];
  const prev = cur ? wa.find(x => x.mon === addDays(cur.mon, -7)) : null;
  const tr = trend21(); const planW = ov.cur * effSettings(s, t).rate_pct / 100;
  const prog = tr && tr.perWeek > 0.02 && ov.cur > s.goal_weight ? czDate(addDays(t, Math.round((ov.cur - s.goal_weight) / tr.perWeek * 7))) : tr ? 'nepůjde' : '–';
  const wm = Meas().filter(m => m.waist != null).sort((a, b) => a.date.localeCompare(b.date)); const wl = wm[wm.length - 1];
  const w4 = wl ? ([...wm].reverse().find(m => m.date <= addDays(wl.date, -28)) || wm[0]) : null;
  let conf = 0; for (let k = 1; k <= 7; k++) if (evaluateDay(addDays(t, -k)).confirmed) conf++;
  const k = (val, lab, cls, title) => `<div class="kpi" ${title ? `title="${esc(title)}"` : ''}><b class="${cls || ''}">${val}</b><span>${lab}</span></div>`;
  return k(cur ? fmt1(cur.avg) + (prev ? ` <small class="${cur.avg <= prev.avg ? 'ok' : 'bad'}">${signed1(cur.avg - prev.avg)}</small>` : '') : '–', cur ? `Ø týden od ${czDateShort(cur.mon)}` : 'Ø týden')
    + k(tr ? kgTyd(tr.perWeek) : '–', `trend 3 t · plán −${fmt2(planW)}`, tr ? (tr.perWeek >= planW * 0.8 ? 'ok' : 'bad') : '', 'sklon přímky přes vážení za 21 dní, kg za týden')
    + k(prog, `cíl ${s.goal_weight} kg tímto tempem`, '')
    + k(wl ? fmt1(wl.waist) + (w4 && w4 !== wl ? ` <small class="${wl.waist <= w4.waist ? 'ok' : 'bad'}">${signed1(wl.waist - w4.waist)}</small>` : '') : '–', wl ? `pas · ${czDateShort(wl.date)}` : 'pas – neměřil')
    + k(`${conf}<small>/7</small>`, 'potvrzených dnů', conf >= 6 ? 'ok' : conf >= 4 ? '' : 'bad');
}
/* problémy: co · dopad · kde · náprava; nejvýš tři, zbytek v listu */
const kdeTxt = (kde, max) => (kde || []).slice().sort().slice(-max).map(d => `${DAY_SHORT[dayIndex(d)]} ${parseISO(d).getDate()}.`).join(' · ') + ((kde || []).length > max ? ' …' : '');
function probRow(p, i) {
  return `<div class="sig prob" onclick="A.probSheet(${i})" onmouseenter="A.hiDays(${i})" onmouseleave="A.hiDays(-1)"><span class="sv l${p.lv}"></span>
    <div class="sx"><b>${p.em || ''} ${esc(p.title)}</b>${p.kg ? ` <span class="pill ${p.lv === 1 ? 'bad' : 'warn'}">≈ ${fmt2(p.kg)} kg/týden</span>` : ''}<div class="small muted">${p.kde && p.kde.length ? 'kde: ' + kdeTxt(p.kde, 5) : esc(p.sub || '').slice(0, 90)}</div></div>
    ${p.apply ? `<button class="btn sm" onclick="event.stopPropagation();${p.apply}">${esc(p.label)}</button>` : p.go ? `<button class="btn sec sm" onclick="event.stopPropagation();${p.go}">${esc(p.label || 'Otevřít')}</button>` : ''}</div>`;
}
function probList(pd, r) {
  const W = pd.W, list = pd.list; const top = list.slice(0, 3);
  return `<div class="ch"><h2>Problémy <small class="muted">· ${esc(r.lab)}</small></h2><div class="row nowrap">${W.state !== 'malo' ? `<span class="pill ${W.state === 'ok' ? 'ok' : 'warn'}" title="tempo za období: realita / plán">${kgTyd(W.realW)} / ${kgTyd(W.planW)} kg</span>` : ''}${list.length > 3 ? `<button class="btn ghost sm" onclick="A.probAll()">+ ${list.length - 3}</button>` : ''}</div></div>
    ${top.length ? top.map(probRow).join('') : '<div class="sig"><span class="sv l3"></span><div class="sx">Nic nevázne – drží limit, pohyb i vážení.</div></div>'}`;
}
A.probAll = () => UI.sheet('Všechny problémy', `${App._diag.length} · seřazené podle důležitosti`, `<div class="card flush">${App._diag.map(probRow).join('')}</div>`);
A.probSheet = i => { const p = App._diag[i]; if (!p) return;
  UI.sheet(`${p.em || ''} ${p.title}`, p.kg ? `≈ ${fmt2(p.kg)} kg za týden` : ({ 1: 'zasáhnout', 2: 'pohlídat', 3: 'na vědomí' }[p.lv]),
    `${p.sub ? `<p>${esc(p.sub)}</p>` : ''}${p.kde && p.kde.length ? `<h3>Kde</h3><div class="chips">${p.kde.slice().sort().map(d => `<button class="chip" onclick="A.coachDaySheet('${d}')">${DAY_SHORT[dayIndex(d)]} ${czDateShort(d)}</button>`).join('')}</div>` : ''}`,
    p.apply ? `<button class="btn" onclick="UI.closeModal();${p.apply}">${esc(p.label)}</button>` : p.go ? `<button class="btn sec" onclick="UI.closeModal();${p.go}">${esc(p.label || 'Otevřít')}</button>` : ''); };
/* najetí na problém zvýrazní jeho dny v mapě */
const MAP_ROW = { nepotvrz: 'jidlo', jidlo: 'jidlo', preslimit: 'jidlo', podlimit: 'jidlo', spodni: 'jidlo', pohyb: 'chuze', chuze: 'chuze', kroky: 'kroky', krokyzap: 'kroky', trenink: 'trenink', vazeni: 'vaha', 'vazeni-malo': 'vaha', voda: 'vaha', psych: 'pocit', hlad: 'pocit', spanek: 'pocit', stres: 'pocit', chute: 'pocit', nalada: 'pocit', bolest: 'pocit' };
A.hiDays = i => { document.querySelectorAll('.dmap .hi').forEach(e => e.classList.remove('hi')); const p = i >= 0 && App._diag ? App._diag[i] : null; if (!p || !p.kde) return;
  const r = MAP_ROW[p.key]; p.kde.forEach(d => document.querySelectorAll(r ? `.dmap [data-dt="${d}"][data-r="${r}"], .dmap .dm-h[data-dt="${d}"]` : `.dmap [data-dt="${d}"]`).forEach(e => e.classList.add('hi'))); };

/* graf: váha (týdenní průměry, trend, plán s pásmem) nebo obvody */
function chartCard(s, ov) {
  const seg = (v, lab) => `<button class="${App.cg === v ? 'on' : ''}" onclick="App.cg='${v}';render()">${lab}</button>`;
  const sub = App.cg === 'w' ? [[56, '8 t'], [91, '3 m'], [0, 'vše']].map(([v, l]) => `<button class="chip ${App.cgR === v ? 'on' : ''}" onclick="App.cgR=${v};render()">${l}</button>`).join('')
    : CIRC.map(([k, l]) => `<button class="chip ${App.cgO === k ? 'on' : ''}" onclick="App.cgO='${k}';render()">${l}</button>`).join('');
  return `<div class="row between nowrap kch"><div class="seg sm">${seg('w', 'Váha')}${seg('o', 'Obvody')}</div><div class="chips">${sub}</div></div>
    ${App.cg === 'w' ? coachWeightChart(s, ov) : circChart(s)}`;
}
const CIRC = [['waist', 'Pas'], ['hips', 'Boky'], ['chest', 'Hrudník'], ['thigh', 'Stehno'], ['arm', 'Paže']];
function coachWeightChart(s, ov) {
  const rows = ov.rows; if (!rows.length) return '<p class="muted small">Zatím žádné vážení.</p>';
  const last = rows[rows.length - 1].idx; const range = App.cgR || (last + 1);
  const x0 = Math.max(0, last - range + 1), ext = Math.max(7, Math.round(range * 0.2)), x1 = last + ext;
  const narrow = window.innerWidth < 640;   // na telefonu užší plátno, ať text na osách není drobný
  const W = narrow ? 420 : 760, H = narrow ? 230 : 186, L = 40, R = 10, T = 14, B = 22;
  const vis = rows.filter(r => r.idx >= x0); const tr = trend21(); const wa = weekAvgs();
  const ys = vis.map(r => r.weight).concat([planWeightAt(s, x0) + 0.5, planWeightAt(s, x1) - 0.5]); if (tr) ys.push(tr.y - tr.perWeek / 7 * ext);
  let y0 = Math.min(...ys) - 0.4, y1 = Math.max(...ys) + 0.4;
  const X = x => L + (x - x0) / (x1 - x0) * (W - L - R), Y = y => T + (y1 - y) / (y1 - y0) * (H - T - B);
  let g = `<svg class="chart" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img">`;
  const st = niceStep((y1 - y0) / 4); for (let v = Math.ceil(y0 / st) * st; v <= y1; v += st) g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="#e6ebea"/><text x="${L - 6}" y="${Y(v) + 4}" font-size="11" fill="#7a878c" text-anchor="end">${fmtTick(v)}</text>`;
  // osa: pondělky jako data
  const step = range > 120 ? 28 : range > 60 ? 14 : 7;
  for (let x = x0; x <= x1; x++) { const dt = addDays(s.start_date, x); if (dayIndex(dt) !== 0 || daysBetween(mondayOf(addDays(s.start_date, x0)), dt) % step) continue;
    g += `<line x1="${X(x)}" x2="${X(x)}" y1="${T}" y2="${H - B}" stroke="#f0f2f5"/><text x="${X(x)}" y="${H - 7}" font-size="11" fill="#7a878c" text-anchor="middle">${czDateShort(dt)}</text>`; }
  // plán s pásmem ±0,5 kg
  const pp = []; for (let x = x0; x <= x1; x++) pp.push([X(x), planWeightAt(s, x)]);
  g += `<path d="M${pp.map(p => `${p[0].toFixed(1)},${Y(p[1] + 0.5).toFixed(1)}`).join('L')}L${pp.slice().reverse().map(p => `${p[0].toFixed(1)},${Y(p[1] - 0.5).toFixed(1)}`).join('L')}Z" fill="rgba(154,163,184,.13)"/>`;
  g += `<path d="M${pp.map(p => `${p[0].toFixed(1)},${Y(p[1]).toFixed(1)}`).join('L')}" fill="none" stroke="#9aa3b8" stroke-width="1.5" stroke-dasharray="6 5"/>`;
  // vybrané období dole
  { const pr = perRange(); const a = Math.max(x0, daysBetween(s.start_date, pr.from)), b = Math.min(x1, daysBetween(s.start_date, pr.to) + 1); if (b > a) g += `<rect x="${X(a)}" y="${T}" width="${X(b) - X(a)}" height="${H - B - T}" fill="rgba(20,120,212,.07)" rx="4"/>`; }
  // ranní váhy
  g += `<path d="M${vis.map(r => `${X(r.idx).toFixed(1)},${Y(r.weight).toFixed(1)}`).join('L')}" fill="none" stroke="#a8c6e4" stroke-width="1.2"/>`;
  vis.forEach(r => { g += `<circle cx="${X(r.idx)}" cy="${Y(r.weight)}" r="2.6" fill="#a8c6e4"/>`; });
  // týdenní průměry: schod přes Po–Ne s číslem
  wa.forEach(w => { const a = daysBetween(s.start_date, w.mon), b = a + 6; if (b < x0) return; const xa = X(Math.max(a, x0)), xb = X(Math.min(b, last));
    g += `<line x1="${xa}" x2="${xb}" y1="${Y(w.avg)}" y2="${Y(w.avg)}" stroke="#1478d4" stroke-width="3" stroke-linecap="round"/><text x="${(xa + xb) / 2}" y="${Y(w.avg) - 7}" font-size="11.5" font-weight="700" fill="#0f5fa8" text-anchor="middle">${fmt1(w.avg)}</text>`; });
  // trend 21 dní a jeho pokračování
  if (tr) { const ty = x => tr.y - tr.slope * 0 + tr.slope * (x - tr.at); const xa = Math.max(tr.from, x0);
    g += `<line x1="${X(xa)}" x2="${X(last)}" y1="${Y(ty(xa))}" y2="${Y(ty(last))}" stroke="#d97706" stroke-width="2.2"/><line x1="${X(last)}" x2="${X(x1)}" y1="${Y(ty(last))}" y2="${Y(ty(x1))}" stroke="#d97706" stroke-width="2" stroke-dasharray="4 4"/>`; }
  (s.log || []).forEach(l => { const x = daysBetween(s.start_date, l.at); if (x < x0 || x > x1) return; g += `<line x1="${X(x)}" x2="${X(x)}" y1="${T}" y2="${H - B}" stroke="#8a5a9e" stroke-width="1.2" stroke-dasharray="2 3"/><text x="${X(x) + 3}" y="${T + 9}" font-size="10" fill="#8a5a9e">${esc(l.pop.split(' ')[0] + ' ' + l.to)}</text>`; });
  const id = 'ct' + (++lineChart.n); lineChart.reg[id] = weightTips(ov, true).filter(t => t.x >= x0).map(t => ({ sx: X(t.x), sy: Y(t.y), html: t.html }));
  g += `<g class="tipg" style="display:none"><line y1="${T}" y2="${H - B}" stroke="#1478d4" stroke-width="1" stroke-dasharray="2 3"/><circle r="5.5" fill="#fff" stroke="#1478d4" stroke-width="2.5"/></g></svg>`;
  return `<div class="chartw" data-tip="${id}">${g}<div class="ctip" hidden></div></div>
    <div class="legend"><span><i style="background:#1478d4"></i>týdenní průměr</span><span><i style="background:#d97706"></i>trend 3 t${tr ? ' ' + kgTyd(tr.perWeek) + '/t' : ''}</span><span><i style="background:#9aa3b8"></i>plán ± 0,5 kg</span><span><i style="background:#a8c6e4"></i>ranní váha</span></div>`;
}
function circChart(s) {
  const k = App.cgO, lab = (CIRC.find(c => c[0] === k) || [k, k])[1];
  const ms = Meas().filter(m => m[k] != null).sort((a, b) => a.date.localeCompare(b.date));
  if (!ms.length) return `<p class="muted small">${lab}: zatím žádné měření. Robert měří obvody v neděli.</p>`;
  const f = ms[0]; const pts = ms.map(m => [daysBetween(s.start_date, m.date), m[k]]);
  const tips = ms.map(m => ({ x: daysBetween(s.start_date, m.date), y: m[k], html: `<b>${DAY_SHORT[dayIndex(m.date)]} ${czDateShort(m.date)}</b><br><span class="w">${fmt1(m[k])} cm</span> ${lab.toLowerCase()}<br>${m === f ? 'první měření' : `${signed1(m[k] - f[k])} cm od ${czDateShort(f.date)}`}` }));
  return lineChart({ series: [{ name: lab.toLowerCase() + ' (cm)', color: '#1478d4', pts, dots: true }], xLabel: '', yUnit: 'cm', h: 186, tips, xFmt: x => czDateShort(addDays(s.start_date, x)), hLine: k === 'waist' && s.goal_waist && Math.min(...ms.map(m => m[k])) - s.goal_waist <= 6 ? { y: s.goal_waist, label: 'cíl ' + s.goal_waist + ' cm', color: '#15803d' } : null })
    + `<div class="small muted">${ms.length} ${sklon(ms.length, 'měření', 'měření', 'měření')}${k === 'waist' && s.goal_waist ? ` · cíl ${s.goal_waist} cm` : ''} · ${ms.length > 1 ? `${signed1(ms[ms.length - 1][k] - f[k])} cm od ${czDateShort(f.date)}` : 'zatím jedno'}</div>`;
}
/* mapa 14 dní: řádky = oblasti, sloupce = dny; červený řádek = příčina, červený sloupec = špatný den */
function dayMap(dates) {
  const s = S(), t = todayISO(), cil = stepsTarget(s);
  const uid = Store.ownerId(), by = Object.fromEntries(Store.rows('days', uid).map(r => [r.data.date, r.data])); const mb = Object.fromEntries(Meas().map(m => [m.date, m]));
  const E = Object.fromEntries(dates.map(d => [d, by[d] ? evaluateDay(d) : null]));
  const rows = [
    ['jidlo', '🍽️', 'Jídlo', d => { const e = E[d]; if (!e) return ['', d < t ? 'miss' : '']; if (!e.confirmed) return [d === t ? '·' : '?', d === t ? '' : 'miss']; return e.cheats.over ? ['+' + fmt0(e.cheats.over), 'bad'] : ['✓', 'ok']; }],
    ['chuze', '🚶', 'Chůze', d => { const e = E[d]; if (!e) return ['', '']; const m = e.day.walk_min || 0, p = e.d.base.planWalk; if (d === t && m < p) return [m || '·', '']; return [m, m >= p - 5 ? 'ok' : m >= p * 0.5 ? 'warn' : 'bad']; }],
    ['kroky', '👣', 'Kroky', d => { const e = E[d]; const bk = e ? daySteps(e.day) : null; if (bk == null) return [d < t ? '–' : '', d < t && e ? 'miss' : '']; return [fmt1(bk / 1000) + 'k', bk >= cil * 0.9 ? 'ok' : bk >= cil * 0.6 ? 'warn' : 'bad']; }],
    ['trenink', '🏋️', 'Trénink', d => { const e = E[d]; const ap = dayActivityPlan(d); if (!(ap.items || []).length) return ['', '']; if (!e) return [d < t ? '✗' : '·', d < t ? 'bad' : '']; const B = e.d.base; return B.doneKcal >= B.planKcal * 0.5 ? ['✓', 'ok'] : [d < t ? '✗' : '·', d < t ? 'bad' : '']; }],
    ['vaha', '⚖️', 'Váha', d => { const m = mb[d]; return m && m.weight != null ? [fmt1(m.weight), ''] : [d <= t ? '–' : '', d < t ? 'warn' : '']; }],
    ['pocit', '🙂', 'Pocit', d => { const e = E[d]; if (!e) return ['', '']; const c = e.day.checkin || {}; const em = (FEEL_EM[c.feel] || '') + (e.day.hunger === 'vlk' ? '🐺' : '') + (c.sleep === 'spatne' ? '😴' : '') + (c.stress === 'hodne' ? '😣' : '') + (c.move === 'bolest' ? '🤕' : '');
      return [em, c.feel === 'bad' || c.move === 'bolest' ? 'bad' : (c.sleep === 'spatne' || c.stress === 'hodne' || e.day.hunger === 'vlk') ? 'warn' : '']; }],
  ];
  const head = `<div class="dm-l dm-t" title="zelená sedí · červená ujela · šrafovaná chybí · ťukni na den"></div>${dates.map(d => `<button class="dm-h ${d === t ? 'dnes' : ''}" data-dt="${d}" onclick="A.coachDaySheet('${d}')" ${d > t ? 'disabled' : ''}>${DAY_SHORT[dayIndex(d)]} <b>${parseISO(d).getDate()}. ${parseISO(d).getMonth() + 1}.</b></button>`).join('')}<div class="dm-s"></div>`;
  const body = rows.map(([rk, em, lab, f]) => { const cells = dates.map(d => [d, ...f(d)]); const done = cells.filter(c => c[2] === 'ok').length, bad = cells.filter(c => c[2] === 'bad' || c[2] === 'miss').length;
    return `<div class="dm-l">${em} ${lab}</div>${cells.map(([d, v, c]) => `<button class="dm-c ${c} ${dayIndex(d) === 0 ? 'po' : ''}" data-dt="${d}" data-r="${rk}" onclick="A.coachDaySheet('${d}')" ${d > t ? 'disabled' : ''} title="${czDateShort(d)} · ${lab}"><span>${v}</span></button>`).join('')}<div class="dm-s">${done || bad ? `<b class="ok">${done}</b>/<b class="bad">${bad}</b>` : ''}</div>`; }).join('');
  return `<div class="dmap d${dates.length}">${head}${body}</div>`;
}

/* den u Roberta v listu: co snědl, chůze, kroky a hlad */
/* ---------- Období: měsíc → týden → den ----------
   Trenér se dívá na cíle a jejich plnění: měsíc se rozpadne na týdny, týden na dny,
   den se otevře v panelu vpravo (plán proti skutečnosti). Problémy vpravo nahoře se
   počítají za vybrané období. Výchozí je tento týden. */
function perRange() {
  const p = App.per || (App.per = { lvl: 'w', start: mondayOf(todayISO()) });
  if (p.lvl === 'm') { const days = monthDays(p.start); return { from: p.start, to: days[days.length - 1], lab: monthName(p.start) }; }
  return { from: p.start, to: addDays(p.start, 6), lab: `${czDateShort(p.start)}–${czDateShort(addDays(p.start, 6))}` };
}
A.perLvl = lvl => { const t = todayISO(), p = App.per; App.per = lvl === 'm' ? { lvl, start: monthStart(p.start <= t && t <= addDays(p.start, 6) ? t : p.start) } : { lvl, start: p.lvl === 'm' && p.start.slice(0, 7) !== t.slice(0, 7) ? mondayOf(p.start) : mondayOf(t) }; render(); };
A.perMove = dir => { const p = App.per; App.per = { lvl: p.lvl, start: p.lvl === 'm' ? addMonths(p.start, dir) : addDays(p.start, 7 * dir) }; render(); };
A.perWeek = mon => { App.per = { lvl: 'w', start: mon }; render(); };
function periodCard() {
  const p = App.per, r = perRange(), t = todayISO(); const R = periodStats(r.from, r.to); const s = S();
  const next = p.lvl === 'm' ? addMonths(p.start, 1) : addDays(p.start, 7);
  const tile = (val, lab, cls) => `<div class="kpi"><b class="${cls || ''}">${val}</b><span>${lab}</span></div>`;
  const ratio = (a, b) => b ? a / b : 1; const cl = (x, ok, mid) => x >= ok ? 'ok' : x >= mid ? '' : 'bad';
  const tiles = R.empty ? '<span class="small muted">před startem plánu</span>' : ((R.wDelta != null ? tile(signed1(R.wDelta).replace('.', ','), `Ø ${fmt1(R.wAvg)} kg · plán −${fmt1(R.wPlan)}`, R.wDelta <= -R.wPlan * 0.8 ? 'ok' : 'bad') : tile(R.wAvg != null ? fmt1(R.wAvg) : '–', 'Ø váha'))
    + tile(`${R.inLimit}<small>/${R.conf}</small>`, `v limitu${R.n - R.conf ? ` · ${R.n - R.conf} nepotvrz.` : ''}`, R.conf ? cl(ratio(R.inLimit, R.conf), 0.85, 0.6) : 'bad')
    + tile(R.defAvg != null ? fmt0(R.defAvg) : '–', `Ø deficit · plán ${R.defPlanAvg != null ? fmt0(R.defPlanAvg) : '–'}`, R.defAvg != null ? cl(ratio(R.defAvg, R.defPlanAvg), 0.9, 0.6) : '')
    + tile(R.walkPlan ? `${fmt0(R.walk)}<small>/${fmt0(R.walkPlan)}</small>` : '–', 'min chůze', R.walkPlan ? cl(ratio(R.walk, R.walkPlan), 0.9, 0.6) : '')
    + tile(R.stepsAvg != null ? fmt1(R.stepsAvg / 1000) + 'k' : '–', `Ø kroky · cíl ${fmt0(stepsTarget(s) / 1000)}k`, R.stepsAvg != null ? cl(ratio(R.stepsAvg, stepsTarget(s)), 0.9, 0.6) : 'bad')
    + tile(`${R.trDone}<small>/${R.trPlan}</small>`, 'tréninky', R.trPlan ? cl(ratio(R.trDone, R.trPlan), 0.9, 0.5) : '')
    + tile(`${R.weigh}<small>/${R.wDays}</small>`, 'vážení', cl(ratio(R.weigh, R.wDays), 0.85, 0.5)));
  const head = `<div class="kper"><div class="seg sm"><button class="${p.lvl === 'm' ? 'on' : ''}" onclick="A.perLvl('m')">Měsíc</button><button class="${p.lvl === 'w' ? 'on' : ''}" onclick="A.perLvl('w')">Týden</button></div>
    <div class="row nowrap pnav"><button class="iconbtn sm" onclick="A.perMove(-1)" aria-label="předchozí">‹</button><b>${r.lab}</b><button class="iconbtn sm" onclick="A.perMove(1)" ${next > t ? 'disabled' : ''} aria-label="další">›</button></div>
    <div class="kpis ptiles">${tiles}</div></div>`;
  if (p.lvl === 'w') return head + dayMap(Array.from({ length: 7 }, (_, i) => addDays(r.from, i)));
  // měsíc: řádky týdnů, klik otevře týden
  const mons = []; for (let m = mondayOf(r.from); m <= r.to; m = addDays(m, 7)) mons.push(m);
  const rows = mons.map(m => { const W = periodStats(m < r.from ? r.from : m, addDays(m, 6) > r.to ? r.to : addDays(m, 6)); const fut = m > t || W.empty;
    const c = (v, cls) => `<div class="mw-c ${cls || ''}">${v}</div>`;
    return `<button class="mw-r" onclick="A.perWeek('${m}')" ${fut ? 'disabled' : ''}><div class="mw-l">${czDateShort(m)}–${czDateShort(addDays(m, 6))}</div>`
      + (fut ? `<div class="mw-c muted mw-all">${W.empty ? 'před startem' : 'ještě nebyl'}</div>` :
      c(W.wAvg != null ? `${fmt1(W.wAvg)}${W.wDelta != null ? ` <small class="${W.wDelta <= -W.wPlan * 0.8 ? 'ok' : 'bad'}">${signed1(W.wDelta)}</small>` : ''}` : '–')
      + c(`${W.inLimit}/${W.conf}`, W.conf ? (W.inLimit / W.conf >= 0.85 ? 'ok' : W.inLimit / W.conf < 0.6 ? 'bad' : '') : 'miss')
      + c(W.defAvg != null ? fmt0(W.defAvg) : '–', W.defAvg != null ? (W.defAvg >= W.defPlanAvg * 0.9 ? 'ok' : W.defAvg < W.defPlanAvg * 0.6 ? 'bad' : '') : '')
      + (W.walkPlan ? c(`${fmt0(W.walk)}/${fmt0(W.walkPlan)}`, W.walk >= W.walkPlan * 0.9 ? 'ok' : W.walk < W.walkPlan * 0.6 ? 'bad' : '') : c('–', 'miss'))
      + c(W.stepsAvg != null ? fmt1(W.stepsAvg / 1000) + 'k' : '–', W.stepsAvg != null ? (W.stepsAvg >= stepsTarget(s) * 0.9 ? 'ok' : W.stepsAvg < stepsTarget(s) * 0.6 ? 'bad' : '') : 'miss')
      + c(`${W.trDone}/${W.trPlan}`, W.trPlan ? (W.trDone >= W.trPlan ? 'ok' : 'bad') : '')
      + c(`${W.weigh}/${W.wDays}`, W.weigh >= W.wDays * 0.85 ? 'ok' : W.weigh < W.wDays * 0.5 ? 'bad' : '')) + '</button>'; }).join('');
  return head + `<div class="mweeks"><div class="mw-h"><div>týden</div><div>Ø váha</div><div>v limitu</div><div>Ø deficit</div><div>chůze</div><div>kroky</div><div>tréninky</div><div>vážení</div></div>${rows}</div>`;
}
/* ---------- Den: plán proti skutečnosti, co ho rozhodlo a co s tím ---------- */
function dayVerdict(date) {
  const s = S(), ev = evaluateDay(date), d = ev.d, B = d.base, day = ev.day; const out = []; let rec = '';
  if (!ev.confirmed && date < todayISO()) out.push(['bad', 'Den nepotvrzený – jídla níž jsou plán, ne skutečnost.']);
  const short = Math.max(0, B.planWalk - (day.walk_min || 0)), shortK = short * B.walkPerMin + Math.max(0, B.planKcal - B.doneKcal);
  const over = ev.confirmed ? d.intake - B.maxIntake : 0;
  if (ev.confirmed && over > dayTol(B.maxIntake)) { const mv = Math.min(over, shortK);
    out.push(['bad', `Přes limit o ${fmt0(over)} kcal – ${mv >= over * 0.5 ? `hlavně proto, že chyběl pohyb (${fmt0(mv)} kcal)` : B.cheatKcal ? `cheat ${fmt0(B.cheatKcal)} kcal nepokrytý chůzí` : 'jídlo nad plán'}.`]);
    rec = mv >= over * 0.5 ? `Ten den rozhodla chůze. Když mu ${DAY_NAMES[dayIndex(date)].toLowerCase()} opakovaně nevychází, dej v ten den kratší cíl nebo trénink.` : B.cheatKcal ? 'Cheat má jít do rezervy dne nebo se pokrýt chůzí navíc – appka mu to nabízí, nevyužil to.' : 'Snědl víc, než měl plán – podívej se, který chod ujel.'; }
  else if (ev.confirmed && over < -300) { out.push(['warn', `Pod limit o ${fmt0(-over)} kcal.`]); rec = 'Jednou nevadí, opakovaně bere sval a končí hladem.'; }
  else if (ev.confirmed) out.push(['ok', 'Jídlo v limitu.']);
  if (short > 5) out.push([short > B.planWalk * 0.5 ? 'bad' : 'warn', `Chůze ${day.walk_min || 0} z ${B.planWalk} min (−${fmt0(short * B.walkPerMin)} kcal).`]); else if (B.planWalk) out.push(['ok', `Chůze splněná (${day.walk_min || 0} min).`]);
  const cil = stepsTarget(s), bk = daySteps(day); if (bk == null) { if (date < todayISO()) out.push(['warn', 'Kroky nezapsané.']); } else if (bk < cil * 0.9) out.push(['warn', `Kroky ${fmt0(bk)} z ${fmt0(cil)}.`]);
  if (B.planKcal > 0) out.push(B.doneKcal >= B.planKcal * 0.5 ? ['ok', 'Trénink odcvičený.'] : ['bad', 'Trénink vynechaný.']);
  if (!rec && out.every(x => x[0] === 'ok')) rec = 'Den seděl.';
  return { out, rec, ev };
}
A.coachDaySheet = date => openSheet(() => {
  const s = S(), { out, rec, ev } = dayVerdict(date), d = ev.d, B = d.base, day = ev.day; const t = todayISO();
  const m = Meas().find(x => x.date === date), mNext = Meas().find(x => x.date === addDays(date, 1));
  const items = (day.act || {}).items || []; const tr = day.training || {}; const done = tr.done || {}; const log = tr.log || {};
  const cil = stepsTarget(s), bk = daySteps(day);
  const nav = `<div class="row between nowrap"><button class="btn ghost sm" onclick="UI.closeModal();A.coachDaySheet('${addDays(date, -1)}')">‹ ${czDateShort(addDays(date, -1))}</button>${date < t ? `<button class="btn ghost sm" onclick="UI.closeModal();A.coachDaySheet('${addDays(date, 1)}')">${czDateShort(addDays(date, 1))} ›</button>` : ''}</div>`;
  const verdict = `<div class="card ${ev.stav === 'ok' ? 'tint-ok' : ev.stav === 'bad' ? 'tint-b' : 'tint-o'} stack s8">${out.map(([c, x]) => `<div class="small"><span class="${c}">${c === 'ok' ? '✓' : c === 'bad' ? '✗' : '!'}</span> ${esc(x)}</div>`).join('')}${rec ? `<div class="b">→ ${esc(rec)}</div>` : ''}</div>`;
  const stats = `<div class="stats3"><div><b class="${ev.cheats.over ? 'bad' : ''}">${d.tot.kcal ? fmt0(d.intake) : '–'} <small>/ ${fmt0(B.maxIntake)}</small></b><span>snědeno / limit</span></div><div><b class="${ev.confirmed && B.totalOut - d.intake < B.deficit * 0.6 ? 'bad' : ''}">${ev.confirmed ? fmt0(B.totalOut - d.intake) : '–'} <small>/ ${fmt0(B.deficit)}</small></b><span>deficit / plán</span></div><div><b class="${d.tot.kcal && d.tot.p >= d.protTarget ? 'ok' : ''}">${d.tot.kcal ? fmt0(d.tot.p) : '–'} <small>/ ${fmt0(d.protTarget || S().protein_min)} g</small></b><span>bílkoviny</span></div></div>`;
  const meals = `<div class="list">${d.courses.map((c, ci) => { const mm = day.meals[c.key] || {}; return `<div class="li static"><span class="ck ${mm.eaten ? 'on' : ''}">${mm.eaten ? '✓' : ''}</span><span class="em">${COURSE_EMOJI[c.key]}</span><div class="tx"><b>${esc(c.sel || 'nevybráno')}</b><span>${esc(s.courses[ci].name)} · cíl ${fmt0(c.target)} kcal${c.edited ? ' · upraveno' : ''}${c.skipped ? ' · vynechal' : ''}</span></div><span class="val k ${c.kcal > c.target * 1.15 ? 'bad' : ''}">${c.kcal ? fmt0(c.kcal) : ''}</span></div>`; }).join('')}
    ${B.cheatKcal ? `<div class="li static cheat"><span class="ck na"></span><span class="em">🍻</span><div class="tx"><b>Cheat · ${esc(cheatPopis(day))}</b><span>${B.cheatCoverable ? `pokrýt ${B.cheatWalk} min chůze navíc` : 'větší, než jde uchodit'}</span></div><span class="val">${fmt0(B.cheatKcal)}</span></div>` : ''}</div>`;
  const move = `<div class="list"><div class="li static"><span class="em">🚶</span><div class="tx"><b>Chůze ${day.walk_min || 0} z ${B.planWalk} min</b><span>${B.cheatWalk ? `z toho ${B.cheatWalk} min za cheat` : 'cíl dne'}</span></div><span class="val ${(day.walk_min || 0) >= B.planWalk - 5 ? 'ok' : 'bad'}">${(day.walk_min || 0) >= B.planWalk - 5 ? '✓' : '−' + (B.planWalk - (day.walk_min || 0))}</span></div>
    <div class="li static"><span class="em">👣</span><div class="tx"><b>Kroky ${bk == null ? 'nezapsané' : fmt0(bk)}</b><span>běžná chůze · cíl ${fmt0(cil)}</span></div><span class="val ${bk != null && bk >= cil * 0.9 ? 'ok' : 'bad'}">${bk == null ? '–' : bk >= cil * 0.9 ? '✓' : Math.round(bk / cil * 100) + ' %'}</span></div>
    ${items.map((it, i) => { const sets = ((log[i] || {}).sets || []).length; return `<div class="li static"><span class="em">🏋️</span><div class="tx"><b>${esc(itemLabel(it))}</b><span>${sets ? `odcvičeno ${sets} ${sklon(sets, 'série', 'série', 'sérií')}${it.sets ? ` z ${it.sets}` : ''}` : done[i] ? 'odškrtnuto' : 'neodcvičeno'}</span></div><span class="val ${done[i] || sets ? 'ok' : 'bad'}">${done[i] || sets ? '✓' : '✗'}</span></div>`; }).join('')}
    ${tr.rpe ? `<div class="small muted">náročnost ${tr.rpe}/5${tr.feel ? ' · ' + esc(tr.feel) : ''}</div>` : ''}</div>`;
  const rest = `<div class="small muted">Váha ráno ${m && m.weight != null ? fmt1(m.weight) + ' kg' : '–'} · druhý den ${mNext && mNext.weight != null ? fmt1(mNext.weight) + ' kg' : '–'}</div>
    <div class="card stack s8"><b>Jak šel den</b>${checkinSummary(day) ? `<div>${esc(checkinSummary(day))}</div>` : '<div class="small muted">Nevyplnil.</div>'}${(day.checkin || {}).note ? `<div class="bubble" style="background:var(--p-bg)"><div>„${esc(day.checkin.note)}“</div></div>` : ''}</div>`;
  return UI.sheetHtml(`${DAY_NAMES[dayIndex(date)]} ${czDateShort(date)}`, ev.stav === 'ok' ? 'potvrzený · den seděl' : ev.stav === 'bad' ? 'potvrzený · den neseděl' : ev.stav === 'dnes' ? 'probíhá' : 'nepotvrzený – níž je jen plán',
    `${nav}${verdict}${stats}<h3>Jídla – plán a skutečnost</h3>${meals}<h3>Pohyb</h3>${move}${rest}`,
    `<button class="btn sec" onclick="A.trDaySheet('${date}')">🏋️ Upravit trénink dne</button>`);
});
/* novinky od minulé návštěvy */
A.sinceSheet = () => { const ch = sinceLast();
  UI.sheet('🔔 Od tvé poslední návštěvy', ch.since ? czDate(isoDate(new Date(ch.since))) : '', ch.items.length ? `<ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:4px">${ch.items.slice(0, 40).map(t => `<li class="small">${t}</li>`).join('')}</ul>` : '<p class="muted">Nic nového.</p>'); };
/* čísla pro hloubku: 6 týdnů, 28 dní, příjem proti limitu a chůze */
A.numbersSheet = () => {
  const s = S(), ov = calcOverview(s, Meas()); const today = todayISO(); const uid = Store.ownerId(); const N = 28;
  const byDate = Object.fromEntries(Store.rows('days', uid).map(r => [r.data.date, r.data])); const measBy = Object.fromEntries(Meas().map(m => [m.date, m]));
  const range = []; for (let k = N - 1; k >= 0; k--) range.push(addDays(today, -k));
  const rows = range.map(dt => { if (!byDate[dt]) return { dt, none: true }; const ev = evaluateDay(dt); return { dt, ...ev, walk: ev.day.walk_min || 0, hasFood: ev.confirmed && ev.d.tot.kcal > 0, closedOk: dt < today ? (ev.confirmed ? ev.ok : 'nezapsany') : null }; });
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
      ${r.none ? '<td class="n muted" colspan="4">bez zápisu</td><td></td>' : `<td class="n ${r.hasFood ? (r.cheats.over ? 'bad' : 'ok') : 'muted'}">${r.hasFood ? `${fmt0(r.d.intake)}/${fmt0(r.d.base.maxIntake)}` : '–'}</td><td class="n">${r.hasFood ? fmt0(r.d.tot.p) : ''}</td><td class="n ${r.walk >= s.walk_min ? 'ok' : ''}">${r.walk}</td><td class="n">${daySteps(r.day) == null ? '–' : fmt0(daySteps(r.day))}</td><td class="${r.closedOk == null ? 'warn' : r.closedOk === 'nezapsany' ? 'muted' : r.closedOk ? 'ok' : 'bad'}">${r.closedOk == null ? 'dnes' : r.closedOk === 'nezapsany' ? 'nepotvrzený' : r.closedOk ? 'OK' : 'nesedí'}</td>`}</tr>`; }).join('')}</table></div>`);
};

/* ---------- PLÁN: co nastavit ----------
   Nahoře páky, které trenér opravdu mění (tempo, chůze, kroky, fáze, udržovací týden).
   Věci na roky – výška, věk, datum startu, cílové hodnoty – jsou v listu Profil.
   Každá změna se ukládá hned, dá se vrátit a zapíše se do historie a do grafu. */
App.coachTab = 'cile';
VIEWS.nastaveni = function () {
  const t = App.coachTab === 'trenink' ? 'trenink' : 'cile';
  return `<div class="ph"><div class="pt"><h1>Plán</h1></div><div class="seg pseg"><button class="${t === 'cile' ? 'on' : ''}" onclick="App.coachTab='cile';render()">Cíle</button><button class="${t === 'trenink' ? 'on' : ''}" onclick="App.coachTab='trenink';render()">Trénink</button></div></div>
  ${t === 'cile' ? cileHtml() : VIEWS.trenink()}`;
};
function cileHtml() {
  const s = S(); const cw = currentWeight(); const ph = phaseSuggestion();
  const mw = (s.maint_weeks || []).slice().sort(); const tday = todayISO(); const thisMon = mondayOf(tday);
  const odKdy = mw.length ? mw[mw.length - 1] : s.start_date; const tydnu = Math.floor(daysBetween(odKdy, tday) / 7);
  const tydny = Array.from({ length: 10 }, (_, k) => addDays(thisMon, k * 7));
  const numf = (k, unit, step) => `<div class="numf"><input type="text" inputmode="decimal" id="st_${k}" value="${s[k] >= 1000 ? fmt0(s[k]) : String(s[k]).replace('.', ',')}" onchange="A.setSetting('${k}',this.value)"><span>${unit}</span></div>`;
  const odCile = calcOverview(s, Meas()).cur - s.goal_weight;
  const [chuze, udrz, profil] = cileRest(s);
  const grid = first => `<div class="pgrid"><div class="pcol">${first}${udrz}</div><div class="pcol">${chuze}${profil}</div></div>`;
  if (s.maintain) return grid(`<div class="card tint-ok stack s8"><div class="row between"><h2>Udržování</h2><span class="pill ok">cíl dosažen</span></div><div class="small muted">Deficit je nula natrvalo, limit sedí na celkovém výdeji. Tempo ${String(s.rate_pct).replace('.', ',')} % se vrátí, když udržování vypneš.</div><button class="btn sec sm" style="align-self:flex-start" onclick="A.setMaintain(false)">Vypnout udržování</button></div>`);
  return grid(`<div class="card stack s8"><div class="row between"><h2>Tempo hubnutí</h2><b style="font-size:20px" id="ratep">${String(s.rate_pct).replace('.', ',')} %</b></div>
    <input type="range" id="st_rate_pct" min="0.3" max="1.2" step="0.05" value="${s.rate_pct}" oninput="const v=this.value,w=${cw};document.getElementById('ratep').textContent=String(v).replace('.',',')+' %';document.getElementById('ratev').textContent=(Math.round(w*v)/100).toString().replace('.',',')+' kg za týden · deficit '+Math.round(w*v/100*7700/7)+' kcal/den'" onchange="A.setSetting('rate_pct',this.value)">
    <div class="small muted"><span id="ratev">${fmt2(cw * s.rate_pct / 100)} kg za týden · deficit ${fmt0(cw * s.rate_pct / 100 * KG_KCAL / 7)} kcal/den</span> · 0,5–1 % je udržitelné</div>
    ${adviceBox('rate_pct')}
    ${odCile <= 3 ? `<div class="alert ${odCile <= 0 ? 'a3' : 'a4'}"><div>${odCile <= 0 ? 'Robert je u cíle.' : `Robert je ${fmt1(odCile)} kg od cíle.`} Udržování nastaví deficit na nulu natrvalo.</div><button class="btn sm" onclick="A.setMaintain(true)">Zapnout udržování</button></div>` : ''}</div>`);
}
function cileRest(s) {
  const ph = phaseSuggestion(); const mw = (s.maint_weeks || []).slice().sort(); const tday = todayISO(); const thisMon = mondayOf(tday);
  const odKdy = mw.length ? mw[mw.length - 1] : s.start_date; const tydnu = Math.floor(daysBetween(odKdy, tday) / 7);
  const tydny = Array.from({ length: 10 }, (_, k) => addDays(thisMon, k * 7));
  const numf = (k, unit) => `<div class="numf"><input type="text" inputmode="decimal" id="st_${k}" value="${s[k] >= 1000 ? fmt0(s[k]) : String(s[k]).replace('.', ',')}" onchange="A.setSetting('${k}',this.value)"><span>${unit}</span></div>`;
  return [`<div class="card flush">
    <div class="navrow" style="cursor:default"><div class="tx"><b>Cíl chůze</b><span>denně, když den nemá trénink</span></div>${numf('walk_min', 'min')}</div>
    <div class="navrow" style="cursor:default"><div class="tx"><b>Cíl kroků</b><span>běžná chůze · faktor ${String(s.activity).replace('.', ',')} se dopočítá</span></div>${numf('steps_goal', 'kroků')}</div>
    <div class="navrow" style="cursor:default"><div class="tx"><b>Tempo chůze</b><span>fáze ${esc(calcOverview(s, Meas()).phase.split(' – ')[0])}${ph ? ` · doporučeno ${fmt1(ph.rec)} km/h` : ''}</span></div><select style="width:128px" onchange="A.setSetting('walk_kmh',this.value)">${SEED.met.map(([k, m]) => `<option value="${k}" ${k === s.walk_kmh ? 'selected' : ''}>${fmt1(k)} km/h</option>`).join('')}</select></div>
    ${adviceBox('walk_min') || adviceBox('activity') ? `<div style="padding:0 14px 12px" class="stack s8">${adviceBox('walk_min')}${adviceBox('activity')}</div>` : ''}
    ${ph ? `<div style="padding:0 14px 12px"><div class="alert a2"><div>🚶 ${esc(ph.text)}</div><button class="btn sm" onclick="A.applyPhase(${ph.rec})">Přepnout</button></div></div>` : ''}
  </div>`,
  `<div class="card stack s8"><div class="row between"><h2>Udržovací týden</h2>${tydnu >= 6 ? '<span class="pill warn">je čas</span>' : ''}</div>
    <div class="chips scroll">${tydny.map(m => `<button class="chip ${mw.includes(m) ? 'on' : ''}" onclick="A.maintWeek('${m}')">${czDateShort(m)}</button>`).join('')}</div>
    <div class="small muted">${mw.length ? `Poslední ${czDateShort(odKdy)}, od té doby ${tydnu} ${sklon(tydnu, 'týden', 'týdny', 'týdnů')} v deficitu.` : `Zatím žádný · ${tydnu} ${sklon(tydnu, 'týden', 'týdny', 'týdnů')} od startu.`} Doporučení: jeden po šesti až deseti týdnech – deficit nula, limit na celkovém výdeji.</div></div>`,
  `<div class="card flush">
    <div class="navrow" onclick="A.profileSheet()"><span class="ico">👤</span><div class="tx"><b>Profil a výchozí hodnoty</b><span>výška ${s.height} · věk ${s.age} · start ${czDateShort(s.start_date)} · cíl ${s.goal_weight} kg · bílkoviny ${s.protein_min} g</span></div><span class="chev">›</span></div>
    <div class="navrow" onclick="A.logSheet()"><span class="ico">🕓</span><div class="tx"><b>Historie změn</b><span>${(s.log || []).length} ${sklon((s.log || []).length, 'zásah', 'zásahy', 'zásahů')} · vidíš je i v grafu váhy</span></div><span class="chev">›</span></div></div>`];
}
/* meze, aby překlep nerozbil výpočet */
const SET_MEZ = { height: [120, 230], age: [15, 100], activity: [1.1, 2], start_weight: [40, 400], goal_weight: [40, 400],
  goal_waist: [50, 200], rate_pct: [0.3, 1.2], walk_kmh: [2, 9], walk_min: [0, 600], rest_sec: [15, 600], protein_min: [60, 400], steps_goal: [0, 30000] };
const SET_POP = { maintain: 'udržování (cíl dosažen)', rate_pct: 'tempo hubnutí (%)', walk_min: 'cíl chůze (min)', protein_min: 'bílkoviny (g)', goal_weight: 'cílová váha (kg)', activity: 'faktor běžného výdeje', walk_kmh: 'tempo chůze (km/h)', goal_waist: 'cíl pasu (cm)', steps_goal: 'cíl kroků/den', height: 'výška (cm)', age: 'věk', start_weight: 'startovní váha (kg)' };
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
A.setMaintain = on => commitSettings({ ...S(), maintain: !!on }, on ? 'Udržování zapnuto' : 'Udržování vypnuto', on ? 'Deficit je nula – Robertův limit sedí na celkovém výdeji.' : `Zpátky na tempo ${String(S().rate_pct).replace('.', ',')} %.`);
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

/* ---------- RECEPTY: přehled po chodech (Robertova obrazovka Recepty) ---------- */
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

/* fromId: Robert si z výchozí suroviny dělá kopii (moje surovina), výchozí nepřepisuje */
A.editFood = (id, mode, after, fromId) => {
  const own = mode === 'own', over = mode === 'override'; const owner = (own || over) ? Store.ownerId() : null;
  const src = id ? Foods().find(x => x.id === id) : null; const from = fromId ? Foods().find(x => x.id === fromId) : null;
  const f = src ? { ...src } : from ? { id: oid('food', Date.now()), cat: from.cat, name: from.name + ' (moje)', kcal: from.kcal, p: from.p, c: from.c, f: from.f } : { id: own ? oid('food', Date.now()) : 'f:' + Date.now(), cat: 'Ostatní', name: '', kcal: '', p: '', c: '', f: '' };
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
