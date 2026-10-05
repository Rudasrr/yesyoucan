/* ===== Obrazovky trenéra: Přehled · Plán · Trénink ===== */
/* Komunikace s Robertem se v appce nevede (rozhodnutí 29. 9. 2026). */
/* ---------- PŘEHLED: jak si Robert vede, kde to ujelo, co s tím (2. 10. 2026) ----------
   Středem je tabulka cílů: řádek na cíl – plán · skutečnost · rozdíl · dny (kde) · dopad v kg/týden
   · náprava. Nahoře tři čísla vždy proti plánu. Graf pod tabulkou je důkaz, ne hlavní věc.
   Vše se vejde na notebook 1366×768. Problémy mají jeden zdroj – diagnoza(). */
App.cg = App.cg || 'w'; App.cgR = App.cgR || 56; App.cgO = App.cgO || 'waist';
/* rozdíl dvou dat v letech, měsících a dnech */
function ymd(a, b) { let A_ = parseISO(a), B_ = parseISO(b), sign = 1; if (B_ < A_) { [A_, B_] = [B_, A_]; sign = -1; }
  let y = B_.getFullYear() - A_.getFullYear(), m = B_.getMonth() - A_.getMonth(), d = B_.getDate() - A_.getDate();
  if (d < 0) { m--; d += new Date(B_.getFullYear(), B_.getMonth(), 0).getDate(); } if (m < 0) { y--; m += 12; }
  const parts = [y && `${y} ${sklon(y, 'rok', 'roky', 'let')}`, m && `${m} ${sklon(m, 'měsíc', 'měsíce', 'měsíců')}`, d && `${d} ${DEN(d)}`].filter(Boolean);
  const short = [y && `${y} r`, m && `${m} m`, d && `${d} d`].filter(Boolean).join(' ') || '0 d';
  return { sign, text: parts.join(' ') || '0 dní', short }; }
VIEWS.klient = function () {
  const s = S(), ov = calcOverview(s, Meas()); const uid = Store.ownerId();
  const r = perRange(); const pd = diagnoza(r.from, r.to); App._diag = pd.list;
  const now = diagnoza(); const lvl = now.lvl;
  const state = { 1: ['bad', '🔴 Zasáhnout', 'tint-b'], 2: ['warn', '🟡 Pohlídat', 'tint-o'], 3: ['ok', '🟢 V pořádku', 'tint-ok'] }[lvl];
  const name = (Store.clients.find(x => x.id === uid) || {}).display_name || 'Robert';
  const ch = sinceLast(); const p0 = now.list[0];
  const head = p0 && lvl < 3 ? (now.W.state === 'pomalu' ? `Hubne pomaleji než plán – hlavně: ${p0.title}` : p0.title) : 'Drží plán.';
  return `<div class="card ${state[2]} kstrip"><div class="kv"><div class="row nowrap"><span class="pill ${state[0]}">${state[1]}</span><b class="kn">${esc(name)}</b><span class="small muted">${czDateShort(todayISO())}</span>
      <span class="kact">${ch.items.length ? `<button class="btn ghost sm" onclick="A.sinceSheet()" title="Od poslední návštěvy">🔔 ${ch.items.length}</button>` : ''}<button class="btn ghost sm" onclick="A.numbersSheet()" title="Tabulky za 6 týdnů a 28 dní">📊</button></span></div><div class="kh">${esc(head)}</div></div>
    <div class="kq">${stripTiles(s, ov)}</div></div>
  <div class="card kgoals">${goalsTable(pd, r)}</div>
  <div class="cock2"><div class="card kchart">${chartCard(s, ov)}</div><div class="card kmore">${moreProblems(pd)}</div></div>`;
};
/* tři čísla proti plánu: tempo · cíl · data */
function stripTiles(s, ov) {
  const t = todayISO(), tr = trend21(), planW = ov.cur * effSettings(s, t).rate_pct / 100;
  const goalPlan = planGoalDate(s); const prog = goalForecast(s, ov).date || null;
  let conf = 0, weigh = 0, steps = 0; const by = Object.fromEntries(Store.rows('days', Store.ownerId()).map(x => [x.data.date, x.data])); const mb = new Set(Meas().filter(m => m.weight != null).map(m => m.date));
  for (let k = 1; k <= 7; k++) { const dt = addDays(t, -k); if (evaluateDay(dt).confirmed) conf++; if (mb.has(dt)) weigh++; if (by[dt] && by[dt].steps != null) steps++; }
  const pct = tr && planW ? Math.round(tr.perWeek / planW * 100) : null;
  const tile = (cls, lab, help, big, cmp) => `<div class="kqi ${cls}"><div class="l">${lab}${hq(help)}</div><b>${big}</b><div class="cmp">${cmp}</div></div>`;
  const d = prog && goalPlan ? ymd(goalPlan, prog) : null;
  return tile(pct == null ? '' : pct >= 80 ? 'ok' : pct >= 50 ? 'warn' : 'bad', 'Tempo (trend 3 týdnů)', 'pTempo', tr ? `${kgTyd(tr.perWeek)} kg/týden` : '–', `plán −${fmt2(planW)}${pct != null ? ` · <b>plní na ${pct} %</b>` : ''}`)
    + tile(!d ? (tr ? 'bad' : '') : d.sign > 0 && daysBetween(goalPlan, prog) > 30 ? 'bad' : d.sign > 0 && daysBetween(goalPlan, prog) > 7 ? 'warn' : 'ok', `Cíl ${s.goal_weight} kg`, 'pCil', prog ? czDate(prog) : (tr ? 'tímto tempem ne' : '–'), goalPlan ? `podle plánu ${czDate(goalPlan)}${d ? ` · <b title="${d.text}">${d.sign > 0 ? '+' : '−'}${d.short}</b>` : ''}` : 'udržování')
    + tile(conf >= 6 && weigh >= 6 ? 'ok' : conf >= 4 ? 'warn' : 'bad', 'Zápisy za 7 dní', 'pData', `${conf}<small>/7</small> potvrzených`, `vážení ${weigh}/7 · kroky ${steps}/7`);
}
/* buňky dnů pro řádky tabulky (a mapu) */
function dayCellFns(dates) {
  const s = S(), t = todayISO(), cil = stepsTarget(s);
  const uid = Store.ownerId(), by = Object.fromEntries(Store.rows('days', uid).map(r => [r.data.date, r.data])); const mb = Object.fromEntries(Meas().map(m => [m.date, m]));
  const E = Object.fromEntries(dates.map(d => [d, by[d] ? evaluateDay(d) : null]));
  return {
    jidlo: d => { const e = E[d]; if (!e) return ['', d < t ? 'miss' : '']; if (!e.confirmed) return [d === t ? '·' : '?', d === t ? '' : 'miss']; return e.cheats.over ? ['+' + fmt0(e.cheats.over), 'bad'] : ['✓', 'ok']; },
    deficit: d => { const e = E[d]; if (!e || !e.confirmed) return ['', '']; const B = e.d.base, x = B.totalOut - e.d.intake; return [fmt0(x), x >= B.deficit * 0.9 ? 'ok' : x >= B.deficit * 0.5 ? 'warn' : 'bad']; },
    chuze: d => { const e = E[d]; if (!e || !e.logged) return ['', '']; const m = e.day.walk_min || 0, p = e.d.base.planWalk; if (d === t && m < p) return [m || '·', '']; return [m, m >= p - 5 ? 'ok' : m >= p * 0.5 ? 'warn' : 'bad']; },
    kroky: d => { const e = E[d]; const bk = e ? daySteps(e.day) : null; if (bk == null) return [d < t ? '–' : '', d < t && e ? 'miss' : '']; return [fmt1(bk / 1000) + 'k', bk >= cil * 0.9 ? 'ok' : bk >= cil * 0.6 ? 'warn' : 'bad']; },
    trenink: d => { const e = E[d]; const ap = dayActivityPlan(d); if (!(ap.items || []).length) return ['', '']; if (!e) return [d < t ? '✗' : '·', d < t ? 'bad' : '']; const B = e.d.base; return B.doneKcal >= B.planKcal * 0.5 ? ['✓', 'ok'] : [d < t ? '✗' : '·', d < t ? 'bad' : '']; },
    vaha: d => { const m = mb[d]; return m && m.weight != null ? [fmt1(m.weight), ''] : [d <= t ? '–' : '', d < t ? 'warn' : '']; },
    zapis: d => { if (d >= t) return ['', '']; const e = E[d]; const ok = e && e.confirmed; return [ok ? '✓' : '?', ok ? 'ok' : 'miss']; },
    pocit: d => { const e = E[d]; if (!e) return ['', '']; const c = e.day.checkin || {}; const em = (FEEL_EM[c.feel] || '') + (e.day.hunger === 'vlk' ? '🐺' : '') + (c.sleep === 'spatne' ? '😴' : '') + (c.stress === 'hodne' ? '😣' : '') + (c.move === 'bolest' ? '🤕' : '');
      return [em, c.feel === 'bad' || c.move === 'bolest' ? 'bad' : (c.sleep === 'spatne' || c.stress === 'hodne' || e.day.hunger === 'vlk') ? 'warn' : '']; },
  };
}
/* řádky tabulky: které příčiny k nim patří (dopad a náprava) */
const GOAL_CAUSES = { vaha: ['voda', 'stoji', 'tempo'], jidlo: ['jidlo', 'preslimit', 'podlimit'], deficit: ['spodni', 'zbytek'], chuze: ['pohyb', 'chuze', 'faze'], kroky: ['kroky', 'krokyzap', 'advice:activity'], trenink: ['trenink'], zapis: ['nepotvrz', 'vazeni', 'vazeni-malo'], pocit: ['psych', 'hlad', 'spanek', 'stres', 'chute', 'nalada', 'bolest'] };
function goalRows(R, s) {
  const cil = stepsTarget(s); const st = (x, ok, mid) => x == null ? '' : x >= ok ? 'ok' : x >= mid ? 'warn' : 'bad'; const ratio = (a, b) => b ? a / b : null;
  return [
    { k: 'vaha', em: '⚖️', lab: 'Váha', help: 'gVaha', plan: `−${fmt1(R.wPlan)} kg`, real: R.wDelta != null ? `${signed1(R.wDelta)} kg` : (R.wAvg != null ? `Ø ${fmt1(R.wAvg)}` : '–'), diff: R.wDelta != null ? signed1(R.wDelta + R.wPlan) : '', st: R.wDelta == null ? '' : st(-R.wDelta / (R.wPlan || 1), 0.8, 0.4) },
    { k: 'jidlo', em: '🍽️', lab: 'Jídlo v limitu', help: 'gJidlo', plan: `${R.n} ${DEN(R.n)}`, real: `${R.inLimit} z ${R.conf} potvrz.`, diff: R.over ? `${R.over}× přes` : '', st: R.conf ? st(ratio(R.inLimit, R.conf), 0.85, 0.6) : 'miss' },
    { k: 'deficit', em: '🔥', lab: 'Deficit Ø/den', help: 'gDeficit', plan: R.defPlanAvg != null ? fmt0(R.defPlanAvg) : '–', real: R.defAvg != null ? fmt0(R.defAvg) : '–', diff: R.defAvg != null ? signed0(R.defAvg - R.defPlanAvg) : '', st: R.defAvg != null ? st(ratio(R.defAvg, R.defPlanAvg), 0.9, 0.6) : '' },
    { k: 'chuze', em: '🚶', lab: 'Chůze', help: 'gChuze', plan: R.walkPlan ? `${fmt0(R.walkPlan)} min` : '–', real: R.walkPlan ? `${fmt0(R.walk)} min` : '–', diff: R.walkPlan ? signed0(R.walk - R.walkPlan) : '', st: R.walkPlan ? st(ratio(R.walk, R.walkPlan), 0.9, 0.6) : '' },
    { k: 'kroky', em: '👣', lab: 'Kroky', help: 'gKroky', plan: `${fmt0(cil)}/den`, real: R.stepsAvg != null ? `Ø ${fmt0(R.stepsAvg)}` : 'nezapsané', diff: R.stepsAvg != null ? signed0(R.stepsAvg - cil) : '', st: R.stepsAvg != null ? st(ratio(R.stepsAvg, cil), 0.9, 0.6) : 'bad' },
    { k: 'trenink', em: '🏋️', lab: 'Trénink', help: 'gTrenink', plan: `${R.trPlan}×`, real: `${R.trDone}×`, diff: R.trPlan ? signed0(R.trDone - R.trPlan) : '', st: R.trPlan ? st(ratio(R.trDone, R.trPlan), 0.9, 0.5) : '' },
    { k: 'zapis', em: '📝', lab: 'Zapisování', help: 'gZapis', plan: `${R.n} ${DEN(R.n)}`, real: `${R.conf} potvrz. · váha ${R.weigh}/${R.wDays}`, diff: R.n - R.conf ? `${R.n - R.conf} chybí` : '', st: st(ratio(R.conf, R.n), 0.85, 0.5) },
    { k: 'pocit', em: '🙂', lab: 'Jak se cítí', help: 'gPocit', plan: '', real: '', diff: '', st: '' },
  ];
}
function goalsTable(pd, r) {
  const p = App.per, t = todayISO(), s = S(); const R = periodStats(r.from, r.to);
  const next = p.lvl === 'm' ? addMonths(p.start, 1) : addDays(p.start, 7);
  const head = `<div class="ghd"><h2>Cíle</h2><div class="seg sm"><button class="${p.lvl === 'm' ? 'on' : ''}" onclick="A.perLvl('m')">Měsíc</button><button class="${p.lvl === 'w' ? 'on' : ''}" onclick="A.perLvl('w')">Týden</button></div>
    <div class="row nowrap pnav"><button class="iconbtn sm" onclick="A.perMove(-1)" aria-label="předchozí">‹</button><b>${r.lab}</b><button class="iconbtn sm" onclick="A.perMove(1)" ${next > t ? 'disabled' : ''} aria-label="další">›</button></div>
    <span class="small muted ghint">ťukni na řádek = vysvětlení a dny · na ${p.lvl === 'm' ? 'týden = týden' : 'den = celý den'}</span></div>`;
  if (R.empty) return head + '<p class="muted small">Před startem plánu.</p>';
  // sloupce období: dny týdne, nebo týdny měsíce
  let cols, cellFor;
  if (p.lvl === 'w') { cols = Array.from({ length: 7 }, (_, i) => addDays(r.from, i)); const F = dayCellFns(cols);
    cellFor = (k, d) => { const [v, c] = (F[k] || (() => ['', '']))(d); return `<button class="dm-c ${c}" onclick="event.stopPropagation();A.coachDaySheet('${d}')" ${d > t ? 'disabled' : ''} title="${czDateShort(d)}"><span>${v}</span></button>`; };
    cols = cols.map(d => ({ id: d, lab: `${DAY_SHORT[dayIndex(d)]} <b>${parseISO(d).getDate()}.</b>`, fut: d > t, go: `A.coachDaySheet('${d}')` })); }
  else { const mons = []; for (let m = mondayOf(r.from); m <= r.to; m = addDays(m, 7)) mons.push(m);
    const W = Object.fromEntries(mons.map(m => [m, periodStats(m < r.from ? r.from : m, addDays(m, 6) > r.to ? r.to : addDays(m, 6))]));
    const wr = Object.fromEntries(mons.map(m => [m, W[m].empty ? null : Object.fromEntries(goalRows(W[m], s).map(g => [g.k, g]))]));
    cellFor = (k, m) => { const g = wr[m] && wr[m][k]; if (m > t || !g) return `<div class="dm-c"></div>`; const v = { vaha: g.real, jidlo: g.real.split(' ')[0] + '/' + W[m].conf, deficit: g.real, chuze: g.real.replace(' min', ''), kroky: W[m].stepsAvg != null ? fmt1(W[m].stepsAvg / 1000) + 'k' : '–', trenink: `${W[m].trDone}/${W[m].trPlan}`, zapis: `${W[m].conf}/${W[m].n}`, pocit: '' }[k];
      return `<button class="dm-c ${k === 'pocit' ? '' : g.st}" onclick="event.stopPropagation();A.perWeek('${m}')"><span>${v}</span></button>`; };
    cols = mons.map(m => ({ id: m, lab: `${czDateShort(m)}–${czDateShort(addDays(m, 6))}`, fut: m > t, go: `A.perWeek('${m}')` })); }
  const keyOf = {}; Object.entries(GOAL_CAUSES).forEach(([k, arr]) => arr.forEach(c => { keyOf[c] = k; }));
  const causes = k => pd.list.map((c, i) => ({ c, i })).filter(x => keyOf[x.c.key] === k);
  const rows = goalRows(R, s).map(g => { const cs = causes(g.k); const kg = cs.reduce((a, x) => Math.max(a, x.c.kg || 0), 0); const fix = cs.find(x => x.c.apply) || cs.find(x => x.c.go) || cs[0];
    const real = g.k === 'pocit' ? esc(pocitSouhrn(r.from, r.to)) : g.real;
    return `<tr class="gr" onclick="A.goalSheet('${g.k}')"><td class="gl">${g.em} ${g.lab}${hq(g.help)}</td><td class="g-p">${g.plan}</td><td class="g-r ${g.k === 'pocit' ? 'small' : ''}" ${g.k === 'pocit' ? 'colspan="2"' : ''}>${real}</td>${g.k === 'pocit' ? '' : `<td class="g-d ${g.st === 'bad' ? 'bad' : g.st === 'warn' ? 'warn' : ''}">${g.diff}</td>`}<td class="g-s">${g.st ? `<span class="st ${g.st}"></span>` : ''}</td>
      <td class="gc"><div class="gcells c${cols.length}">${cols.map(c => cellFor(g.k, c.id)).join('')}</div></td>
      <td class="g-k ${kg >= 0.1 ? 'bad' : kg ? 'wk' : 'muted'} gk">${kg ? `≈ ${fmt2(kg)} kg/t` : ''}</td>
      <td class="ga">${fix ? (fix.c.apply ? `<button class="btn sm" onclick="event.stopPropagation();${fix.c.apply}">${esc(fix.c.label)}</button>` : fix.c.go ? `<button class="btn sec sm" onclick="event.stopPropagation();${fix.c.go}">${esc(fix.c.label || 'Otevřít')}</button>` : `<button class="btn ghost sm" onclick="event.stopPropagation();A.probSheet(${fix.i})">Proč ›</button>`) : ''}</td></tr>`; }).join('');
  return head + `<div class="gtbl"><table><tr><th>Cíl</th><th class="g-p">Plán</th><th class="g-r">Skutečnost</th><th class="g-d">Rozdíl</th><th class="g-s"></th><th class="gc"><div class="gcells c${cols.length} hd">${cols.map(c => `<button class="dm-h" onclick="${c.go}" ${c.fut ? 'disabled' : ''}>${c.lab}</button>`).join('')}</div></th><th class="g-k">Dopad</th><th>Co s tím</th></tr>${rows}</table></div>`;
}
function pocitSouhrn(from, to) { const t = todayISO(); let sp = 0, st = 0, vl = 0, bo = 0, bad = 0, n = 0;
  for (let d = from; d <= to && d < t; d = addDays(d, 1)) { const r = Store.rows('days', Store.ownerId()).find(x => x.data.date === d); if (!r) continue; const c = r.data.checkin || {}; if (Object.keys(c).length) n++; if (c.sleep === 'spatne') sp++; if (c.stress === 'hodne') st++; if (r.data.hunger === 'vlk') vl++; if (c.move === 'bolest') bo++; if (c.feel === 'bad') bad++; }
  if (!n && !vl) return 'nevyplnil'; return [bad && `${bad}× špatně`, sp && `${sp}× špatný spánek`, st && `${st}× stres`, vl && `${vl}× vlčí hlad`, bo && `${bo}× bolest`].filter(Boolean).join(' · ') || 'v pořádku'; }
/* řádek cíle v listu: vysvětlení, příčiny a dny */
A.goalSheet = k => { const r = perRange(), R = periodStats(r.from, r.to); const g = goalRows(R, S()).find(x => x.k === k); if (!g) return; const h = HELP[g.help] || {};
  const keyOf = {}; Object.entries(GOAL_CAUSES).forEach(([kk, arr]) => arr.forEach(c => { keyOf[c] = kk; }));
  const cs = (App._diag || []).map((c, i) => ({ c, i })).filter(x => keyOf[x.c.key] === k);
  const dates = []; for (let d = r.from; d <= r.to && d <= todayISO(); d = addDays(d, 1)) dates.push(d); const F = dayCellFns(dates)[k];
  UI.sheet(`${g.em} ${g.lab}`, r.lab, `<p class="small muted">${esc(h.co || '')}</p>
    ${g.k !== 'pocit' ? `<div class="stats3"><div><b>${g.plan || '–'}</b><span>plán</span></div><div><b>${g.real}</b><span>skutečnost</span></div><div><b class="${g.st === 'bad' ? 'bad' : g.st === 'warn' ? 'warn' : ''}">${g.diff || '–'}</b><span>rozdíl</span></div></div>` : ''}
    ${cs.length ? cs.map(x => `<div class="alert a${x.c.lv === 1 ? 1 : 2}"><div><b>${x.c.em || ''} ${esc(x.c.title)}</b>${x.c.kg ? ` · ≈ ${fmt2(x.c.kg)} kg/týden` : ''}<div class="small">${esc(x.c.sub || '')}</div></div>${x.c.apply ? `<button class="btn sm" onclick="UI.closeModal();${x.c.apply}">${esc(x.c.label)}</button>` : x.c.go ? `<button class="btn sec sm" onclick="UI.closeModal();${x.c.go}">${esc(x.c.label || 'Otevřít')}</button>` : ''}</div>`).join('') : '<p class="small ok">Tady nic nevázne.</p>'}
    ${F ? `<h3>Po dnech</h3><div class="list">${dates.slice().reverse().map(d => { const [v, c] = F(d); return `<div class="li" onclick="UI.closeModal();A.coachDaySheet('${d}')"><div class="tx"><b>${DAY_NAMES[dayIndex(d)]} ${czDateShort(d)}</b></div><span class="val ${c === 'bad' ? 'bad' : c === 'ok' ? 'ok' : ''}">${v || '–'}</span><span class="chev">›</span></div>`; }).join('')}</div>` : ''}`); };
/* ostatní upozornění, která nepatří k žádnému řádku (cíl, přestávka, plán jídel, fáze chůze…) */
function moreProblems(pd) {
  const inRow = new Set(Object.values(GOAL_CAUSES).flat()); const rest = pd.list.map((c, i) => ({ c, i })).filter(x => !inRow.has(x.c.key));
  return `<div class="ch"><h2>Další upozornění</h2>${rest.length > 3 ? `<button class="btn ghost sm" onclick="A.probAll()">+ ${rest.length - 3}</button>` : ''}</div>${rest.length ? rest.slice(0, 3).map(x => `<div class="sig prob" onclick="A.probSheet(${x.i})"><span class="sv l${x.c.lv}"></span><div class="sx"><b>${x.c.em || ''} ${esc(x.c.title)}</b></div>${x.c.apply ? `<button class="btn sm" onclick="event.stopPropagation();${x.c.apply}">${esc(x.c.label)}</button>` : x.c.go ? `<button class="btn sec sm" onclick="event.stopPropagation();${x.c.go}">${esc(x.c.label || 'Otevřít')}</button>` : ''}</div>`).join('') : '<p class="small muted">Nic dalšího.</p>'}`;
}
/* problémy: co · dopad · kde · náprava; nejvýš tři, zbytek v listu */
const kdeTxt = (kde, max) => (kde || []).slice().sort().slice(-max).map(d => `${DAY_SHORT[dayIndex(d)]} ${parseISO(d).getDate()}.`).join(' · ') + ((kde || []).length > max ? ' …' : '');
function probRow(p, i) {
  return `<div class="sig prob" onclick="A.probSheet(${i})"><span class="sv l${p.lv}"></span>
    <div class="sx"><b>${p.em || ''} ${esc(p.title)}</b>${p.kg ? ` <span class="pill ${p.lv === 1 ? 'bad' : 'warn'}">≈ ${fmt2(p.kg)} kg/týden</span>` : ''}<div class="small muted">${p.kde && p.kde.length ? 'kde: ' + kdeTxt(p.kde, 5) : esc(p.sub || '').slice(0, 90)}</div></div>
    ${p.apply ? `<button class="btn sm" onclick="event.stopPropagation();${p.apply}">${esc(p.label)}</button>` : p.go ? `<button class="btn sec sm" onclick="event.stopPropagation();${p.go}">${esc(p.label || 'Otevřít')}</button>` : ''}</div>`;
}
A.probAll = () => UI.sheet('Všechny problémy', `${App._diag.length} · seřazené podle důležitosti`, `<div class="card flush">${App._diag.map(probRow).join('')}</div>`);
A.probSheet = i => { const p = App._diag[i]; if (!p) return;
  UI.sheet(`${p.em || ''} ${p.title}`, p.kg ? `≈ ${fmt2(p.kg)} kg za týden` : ({ 1: 'zasáhnout', 2: 'pohlídat', 3: 'na vědomí' }[p.lv]),
    `${p.sub ? `<p>${esc(p.sub)}</p>` : ''}${p.kde && p.kde.length ? `<h3>Kde</h3><div class="chips">${p.kde.slice().sort().map(d => `<button class="chip" onclick="A.coachDaySheet('${d}')">${DAY_SHORT[dayIndex(d)]} ${czDateShort(d)}</button>`).join('')}</div>` : ''}`,
    p.apply ? `<button class="btn" onclick="UI.closeModal();${p.apply}">${esc(p.label)}</button>` : p.go ? `<button class="btn sec" onclick="UI.closeModal();${p.go}">${esc(p.label || 'Otevřít')}</button>` : ''); };
/* graf: váha (týdenní průměry, trend, plán s pásmem) nebo obvody */
function chartCard(s, ov) {
  const seg = (v, lab) => `<button class="${App.cg === v ? 'on' : ''}" onclick="App.cg='${v}';render()">${lab}</button>`;
  const sub = App.cg === 'w' ? [[56, '8 t'], [91, '3 m'], [0, 'vše']].map(([v, l]) => `<button class="chip ${App.cgR === v ? 'on' : ''}" onclick="App.cgR=${v};render()">${l}</button>`).join('')
    : CIRC.map(([k, l]) => `<button class="chip ${App.cgO === k ? 'on' : ''}" onclick="App.cgO='${k}';render()">${l}</button>`).join('');
  const leg = App.cg === 'w' ? `<div class="legend kleg"><span><i style="background:#1478d4"></i>Ø týdne</span><span><i style="background:#d97706"></i>trend</span><span><i style="background:#9aa3b8"></i>plán ±0,5</span><span><i style="background:#a8c6e4"></i>ráno</span></div>` : '';
  return `<div class="row between kch"><div class="seg sm">${seg('w', 'Váha')}${seg('o', 'Obvody')}</div>${leg}<div class="chips">${sub}</div></div>
    ${App.cg === 'w' ? coachWeightChart(s, ov) : circChart(s)}`;
}
const CIRC = [['waist', 'Pas'], ['hips', 'Boky'], ['chest', 'Hrudník'], ['thigh', 'Stehno'], ['arm', 'Paže']];
function coachWeightChart(s, ov, opts) {
  opts = opts || {};
  const rows = ov.rows; if (!rows.length) return '<p class="muted small">Zatím žádné vážení.</p>';
  const last = rows[rows.length - 1].idx; const range = App.cgR || (last + 1);
  const x0 = Math.max(0, last - range + 1), ext = Math.max(7, Math.round(range * 0.2)), x1 = last + ext;
  const narrow = window.innerWidth < 640;   // na telefonu užší plátno, ať text na osách není drobný
  const W = narrow ? 420 : 760, H = narrow ? 230 : (opts.h || 122), L = 40, R = 10, T = 14, B = 22;
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
  if (opts.shade !== false) { const pr = perRange(); const a = Math.max(x0, daysBetween(s.start_date, pr.from)), b = Math.min(x1, daysBetween(s.start_date, pr.to) + 1); if (b > a) g += `<rect x="${X(a)}" y="${T}" width="${X(b) - X(a)}" height="${H - B - T}" fill="rgba(20,120,212,.07)" rx="4"/>`; }
  // ranní váhy
  g += `<path d="M${vis.map(r => `${X(r.idx).toFixed(1)},${Y(r.weight).toFixed(1)}`).join('L')}" fill="none" stroke="#a8c6e4" stroke-width="1.2"/>`;
  vis.forEach(r => { g += `<circle cx="${X(r.idx)}" cy="${Y(r.weight)}" r="2.6" fill="#a8c6e4"/>`; });
  // týdenní průměry: schod přes Po–Ne s číslem
  wa.forEach(w => { const a = daysBetween(s.start_date, w.mon), b = a + 6; if (b < x0) return; const xa = X(Math.max(a, x0)), xb = X(Math.min(b, last));
    g += `<line x1="${xa}" x2="${xb}" y1="${Y(w.avg)}" y2="${Y(w.avg)}" stroke="#1478d4" stroke-width="3" stroke-linecap="round"/><text x="${(xa + xb) / 2}" y="${Y(w.avg) - 7}" font-size="11.5" font-weight="700" fill="#0f5fa8" text-anchor="middle">${fmt1(w.avg)}</text>`; });
  // trend 21 dní a jeho pokračování
  if (tr) { const ty = x => tr.y - tr.slope * 0 + tr.slope * (x - tr.at); const xa = Math.max(tr.from, x0);
    g += `<line x1="${X(xa)}" x2="${X(last)}" y1="${Y(ty(xa))}" y2="${Y(ty(last))}" stroke="#d97706" stroke-width="2.2"/><line x1="${X(last)}" x2="${X(x1)}" y1="${Y(ty(last))}" y2="${Y(ty(x1))}" stroke="#d97706" stroke-width="2" stroke-dasharray="4 4"/>`; }
  g += marksSvg(logMarks(s), x0, x1, X, T, H - B);
  const id = 'ct' + (++lineChart.n); lineChart.reg[id] = weightTips(ov, true).filter(t => t.x >= x0).map(t => ({ sx: X(t.x), sy: Y(t.y), html: t.html }));
  g += `<g class="tipg" style="display:none"><line y1="${T}" y2="${H - B}" stroke="#1478d4" stroke-width="1" stroke-dasharray="2 3"/><circle r="5.5" fill="#fff" stroke="#1478d4" stroke-width="2.5"/></g></svg>`;
  return `<div class="chartw" data-tip="${id}">${g}<div class="ctip" hidden></div></div>`;
}
function circChart(s) {
  const k = App.cgO, lab = (CIRC.find(c => c[0] === k) || [k, k])[1];
  const ms = Meas().filter(m => m[k] != null).sort((a, b) => a.date.localeCompare(b.date));
  if (!ms.length) return `<p class="muted small">${lab}: zatím žádné měření. Robert měří obvody v neděli.</p>`;
  const f = ms[0]; const pts = ms.map(m => [daysBetween(s.start_date, m.date), m[k]]);
  const tips = ms.map(m => ({ x: daysBetween(s.start_date, m.date), y: m[k], html: `<b>${DAY_SHORT[dayIndex(m.date)]} ${czDateShort(m.date)}</b><br><span class="w">${fmt1(m[k])} cm</span> ${lab.toLowerCase()}<br>${m === f ? 'první měření' : `${signed1(m[k] - f[k])} cm od ${czDateShort(f.date)}`}` }));
  return lineChart({ series: [{ name: lab.toLowerCase() + ' (cm)', color: '#1478d4', pts, dots: true }], xLabel: '', yUnit: 'cm', h: 128, tips, xFmt: x => czDateShort(addDays(s.start_date, x)), hLine: k === 'waist' && s.goal_waist && Math.min(...ms.map(m => m[k])) - s.goal_waist <= 6 ? { y: s.goal_waist, label: 'cíl ' + s.goal_waist + ' cm', color: '#15803d' } : null })
    + `<div class="small muted">${ms.length} ${sklon(ms.length, 'měření', 'měření', 'měření')}${k === 'waist' && s.goal_waist ? ` · cíl ${s.goal_waist} cm` : ''} · ${ms.length > 1 ? `${signed1(ms[ms.length - 1][k] - f[k])} cm od ${czDateShort(f.date)}` : 'zatím jedno'}</div>`;
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
  const meals = `<div class="list">${d.courses.map((c, ci) => { const mm = day.meals[c.key] || {}; return `<div class="li static"><span class="g-k ${mm.eaten ? 'on' : ''}">${mm.eaten ? '✓' : ''}</span><span class="em">${COURSE_EMOJI[c.key]}</span><div class="tx"><b>${esc(c.sel || 'nevybráno')}</b><span>${esc(s.courses[ci].name)} · cíl ${fmt0(c.target)} kcal${c.edited ? ' · upraveno' : ''}${c.skipped ? ' · vynechal' : ''}</span></div><span class="val k ${c.kcal > c.target * 1.15 ? 'bad' : ''}">${c.kcal ? fmt0(c.kcal) : ''}</span></div>`; }).join('')}
    ${B.cheatKcal ? `<div class="li static cheat"><span class="g-k na"></span><span class="em">🍻</span><div class="tx"><b>Cheat · ${esc(cheatPopis(day))}</b><span>${B.cheatCoverable ? `pokrýt ${B.cheatWalk} min chůze navíc` : 'větší, než jde uchodit'}</span></div><span class="val">${fmt0(B.cheatKcal)}</span></div>` : ''}</div>`;
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
/* ---------- PLÁN: co má Robert dělat (2. 10. 2026) ----------
   Tři bloky podle toho, co ovlivňují: Cíl a tempo · Pohyb · Jídlo. Každý končí řádkem
   „co z toho vyjde“. Hodnoty zadané jednou (výška, věk, start, faktor, pauza) jsou v Nastavení,
   trénink má vlastní záložku. Přestávka v deficitu (dřív „udržovací týden“) patří k tempu. */
/* kdy dosáhne cíle podle plánu: tempo od startu + přestávky v deficitu */
function planGoalDate(s) {
  if (s.maintain || !(s.rate_pct > 0) || s.goal_weight >= s.start_weight) return null;
  const weeks = Math.log(s.goal_weight / s.start_weight) / Math.log(1 - s.rate_pct / 100);
  return addDays(s.start_date, Math.round(weeks * 7) + 7 * (s.maint_weeks || []).length);
}
const numf = (s, k, unit, wide) => `<div class="numf ${wide ? 'w' : ''}"><input type="text" inputmode="decimal" id="st_${k}" value="${s[k] >= 1000 ? fmt0(s[k]) : String(s[k]).replace('.', ',')}" onchange="A.setSetting('${k}',this.value)"><span>${unit}</span></div>`;
const frow = (lab, help, ctrl, sub) => `<div class="frow"><div class="fl"><b>${lab}${help ? hq(help) : ''}</b>${sub ? `<span>${sub}</span>` : ''}</div>${ctrl}</div>`;
VIEWS.nastaveni = function () {
  const s = S(), b = limitToday(s), cw = b.w, t = todayISO();
  const mw = (s.maint_weeks || []).slice().sort(); const thisMon = mondayOf(t);
  const odKdy = mw.filter(m => m <= t).pop() || s.start_date; const tydnu = Math.floor(daysBetween(odKdy, t) / 7);
  const tydny = Array.from({ length: 6 }, (_, k) => addDays(thisMon, k * 7)); const doporuc = addDays(mondayOf(odKdy), 7 * Math.max(8, tydnu + 1));
  const goalD = planGoalDate(s); const odCile = calcOverview(s, Meas()).cur - s.goal_weight; const ph = phaseSuggestion();
  const real = b.minOut - b.planLimit, want = cw * effSettings(s, t).rate_pct / 100;
  const pct = coursePct(s), L = b.planLimit; const CC = ['#9ec5ec', '#b8d6a8', '#f2d39b', '#e9b8c0', '#cdbfe6'];
  const tempoCtl = `<div class="tempo"><input type="range" id="st_rate_pct" min="0.3" max="1.2" step="0.05" value="${s.rate_pct}" oninput="const v=this.value,w=${cw};document.getElementById('ratep').textContent=String(v).replace('.',',')+' %';document.getElementById('ratev').textContent='−'+(Math.round(w*v)/100).toString().replace('.',',')+' kg/týden'" onchange="A.setSetting('rate_pct',this.value)"><b id="ratep">${String(s.rate_pct).replace('.', ',')} %</b></div>`;
  const cil = `<div class="card pblk"><h3>🎯 Cíl a tempo</h3>
    ${frow('Cílová váha', 'cilVaha', numf(s, 'goal_weight', 'kg'))}
    ${s.maintain ? frow('Udržování', 'udrzovani', `<button class="btn sec sm" onclick="A.setMaintain(false)">Vypnout</button>`, 'cíl dosažen · deficit nula natrvalo')
      : frow('Tempo hubnutí', 'tempo', tempoCtl, `<span id="ratev">−${fmt2(cw * s.rate_pct / 100)} kg/týden</span>`)}
    ${frow('Cílový pas', 'cilPas', numf(s, 'goal_waist', 'cm'), `polovina výšky = ${Math.round(s.height / 2)} cm`)}
    ${!s.maintain && odCile <= 3 ? `<div class="alert ${odCile <= 0 ? 'a3' : 'a4'}"><div>${odCile <= 0 ? 'Robert je u cíle.' : `Robert je ${fmt1(odCile)} kg od cíle.`}</div><button class="btn sm" onclick="A.setMaintain(true)">Zapnout udržování</button></div>` : ''}
    <div class="blk"><h4>Přestávka v deficitu${hq('prestavka')}<span class="r">${tydnu} ${sklon(tydnu, 'týden', 'týdny', 'týdnů')} v deficitu</span></h4>
      <div class="chips">${tydny.map(m => `<button class="chip ${mw.includes(m) ? 'on' : ''} ${m === doporuc && !mw.includes(m) ? 'rec' : ''}" onclick="A.maintWeek('${m}')">${czDateShort(m)}</button>`).join('')}</div>
      <div class="small muted">${mw.filter(m => m >= thisMon).length ? `Naplánováno: ${mw.filter(m => m >= thisMon).map(czDateShort).join(', ')}.` : `Doporučená: týden od ${czDateShort(doporuc)}`}</div></div>
    <div class="res">→ ${s.maintain ? 'deficit nula – drží váhu' : `<b>−${fmt2(want)} kg/týden</b> · deficit ${fmt0(cw * s.rate_pct / 100 * KG_KCAL / 7)} kcal/den${goalD ? ` · cíl podle plánu <b>${czDate(goalD)}</b>` : ''}`}</div>
    ${adviceBox('rate_pct')}</div>`;
  const pohyb = `<div class="card pblk"><h3>🚶 Pohyb</h3>
    ${frow('Chůze denně', 'chuze', numf(s, 'walk_min', 'min'), 'dny bez plánu v Tréninku')}
    ${frow('Tempo chůze', 'tempoChuze', `<select class="sel" onchange="A.setSetting('walk_kmh',this.value)">${SEED.met.map(([k]) => `<option value="${k}" ${k === s.walk_kmh ? 'selected' : ''}>${fmt1(k)} km/h</option>`).join('')}</select>`, `fáze ${esc(calcOverview(s, Meas()).phase.split(' – ')[0])}${ph ? ` · doporučeno ${fmt1(ph.rec)} km/h` : ''}`)}
    ${frow('Běžné kroky', 'kroky', numf(s, 'steps_goal', 'kroků', true), `mimo procházku · faktor výdeje ${String(s.activity).replace('.', ',')}${hq('faktor')}`)}
    ${ph ? `<div class="alert a2"><div>🚶 ${esc(ph.text)}</div><button class="btn sm" onclick="A.applyPhase(${ph.rec})">Přepnout</button></div>` : ''}
    ${adviceBox('activity')}${adviceBox('walk_min')}
    <div class="res">→ chůze ${s.walk_min} min ≈ <b>${fmt0(s.walk_min * b.walkPerMin)} kcal/den</b> · dny s tréninkem mají vlastní chůzi <button class="btn ghost sm" onclick="go('trenink')">Trénink ›</button></div></div>`;
  const jidlo = `<div class="card pblk"><h3>🍽️ Jídlo</h3>
    <div class="res ${b.planBelowBmr ? 'warn' : 'okk'}">Limit dne <b>${fmt0(L)} kcal</b>${hq('limit')}<br><span class="small">výdej ${fmt0(b.minOut)} − deficit ${fmt0(b.deficit)}${b.planBelowBmr ? ` → drží ho spodní hranice ${fmt0(b.bmr)} (klidový výdej). Skutečný deficit ${fmt0(real)} kcal = −${fmt2(real * 7 / KG_KCAL)} kg/týden, ne −${fmt2(want)}. Vyšší tempo nic nezmění – přidej pohyb.` : ` · nikdy pod klidový výdej ${fmt0(b.bmr)}`}</span></div>
    ${frow('Bílkoviny min.', 'bilkoviny', numf(s, 'protein_min', 'g'), `doporučeno ${Math.round(1.6 * s.goal_weight)}–${Math.round(2 * s.goal_weight)} g`)}
    ${adviceBox('protein_min')}
    <div class="fl"><b>Rozdělení limitu mezi jídla${hq('chody')}</b></div>
    <div class="cbar">${s.courses.map((c, i) => `<i style="flex:${pct[i].toFixed(2)};background:${CC[i % 5]}" title="${esc(c.name)} ${fmt0(pct[i])} %"></i>`).join('')}</div>
    <div class="cgrid">${s.courses.map((c, i) => `<label class="cpi"><span><i style="background:${CC[i % 5]}"></i>${esc(c.name)}</span><div class="numf s"><input type="text" inputmode="decimal" id="st_c${i}" value="${fmt0(pct[i])}" onchange="A.setCoursePct(${i},this.value)"><span>%</span></div><em>≈ ${fmt0(L * pct[i] / 100)}</em></label>`).join('')}</div>
    ${adviceBox('courses')}</div>`;
  return `<div class="ph"><div class="pt"><h1>Plán</h1><span class="sub">co má Robert dělat</span></div><div class="act"><button class="btn ghost sm" onclick="A.logSheet()">🕓 Historie změn (${(s.log || []).length})</button></div></div>
  <div class="pgrid p3">${cil}${pohyb}${jidlo}</div>`;
};
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
/* Cíle chodů jsou PODÍL limitu dne, ne kalorie navíc: limit = celkový výdej − deficit a chody si ho dělí.
   Dřív pole „kcal“ sváděla k myšlence, že 2 000 u snídaně přidá jídlo – jen to snídani dalo půl dne.
   Trenér zadá procenta, ostatní chody se poměrně dorovnají do 100 % a uloží se váhy se součtem 2 450. */
const COURSE_BASE = 2450;
function coursePct(s) { const sum = courseTargetSum(s); return s.courses.map(c => sum ? c.kcal / sum * 100 : 0); }
function limitToday(s) { const w = currentWeight(), t = todayISO(), act = planActFor(t, w); return { ...calcBase(effSettings(s, t), w, act.planWalk, 0, s.walk_kmh, 0, 0, act), act, w }; }
A.setCoursePct = (i, v) => { const s = S(); const r = omez(v, 3, 60); if (r.n == null) return; if (r.mimo) UI.toast('Jeden chod může mít 3 až 60 % limitu dne.');
  const pct = coursePct(s); const rest = pct.reduce((a, x, j) => a + (j === i ? 0 : x), 0) || 1;
  const courses = s.courses.map((c, j) => ({ ...c, kcal: Math.round((j === i ? r.n : pct[j] * (100 - r.n) / rest) / 100 * COURSE_BASE) }));
  commitSettings({ ...s, courses }, `${s.courses[i].name}: ${fmt0(r.n)} % limitu`); };
/* Nastavení plánu: hodnoty zadané jednou. Žije v obrazovce Nastavení (⚙︎), ne v Plánu. */
function profileCard() {
  const s = S();
  const f = (k, l, help, note) => `<div class="field"><label class="f">${l}${help ? hq(help) : ''}</label><input type="text" inputmode="decimal" id="st_${k}" value="${String(s[k]).replace('.', ',')}" onchange="A.setSetting('${k}',this.value)">${note ? `<div class="hint">${note}</div>` : ''}</div>`;
  return `<div class="card stack s8"><h2>Výchozí hodnoty plánu</h2><p class="small muted">Zadávají se jednou. Cíle, tempo a pohyb jsou v Plánu.</p>
    <div class="grid g2">${f('height', 'Výška (cm)')}${f('age', 'Věk')}</div>
    <div class="grid g2"><div class="field"><label class="f">Datum startu</label><input type="date" id="st_start_date" value="${s.start_date}" onchange="A.setSetting('start_date',this.value)"></div>${f('start_weight', 'Startovní váha (kg)')}</div>
    <div class="grid g2">${f('activity', 'Faktor běžného výdeje', 'faktor', 'sedavě 1,2 · 5 000 kroků 1,34')}${f('rest_sec', 'Pauza mezi sériemi (s)', 'trPauza')}</div></div>`;
}
A.profileSheet = () => go('ucet');
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
