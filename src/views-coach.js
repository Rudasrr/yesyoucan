/* ===== Obrazovky trenéra: Přehled · Plán · Trénink ===== */
/* Komunikace s Robertem se v appce nevede (rozhodnutí 29. 9. 2026). */
/* ---------- PŘEHLED: jak si Robert vede, kde to ujelo, co s tím (2. 10. 2026) ----------
   Středem je tabulka cílů: řádek na cíl – plán · skutečnost · rozdíl · dny (kde) · dopad v kg/týden
   · náprava. Nahoře tři čísla vždy proti plánu. Graf pod tabulkou je důkaz, ne hlavní věc.
   Vše se vejde na notebook 1366×768. Problémy mají jeden zdroj – diagnoza(). */
App.cg = App.cg || 'w'; App.cgR = App.cgR != null ? App.cgR : -1; App.cgO = App.cgO || 'waist';
/* rozdíl dvou dat v letech, měsících a dnech */
function ymd(a, b) { let A_ = parseISO(a), B_ = parseISO(b), sign = 1; if (B_ < A_) { [A_, B_] = [B_, A_]; sign = -1; }
  let y = B_.getFullYear() - A_.getFullYear(), m = B_.getMonth() - A_.getMonth(), d = B_.getDate() - A_.getDate();
  if (d < 0) { m--; d += new Date(B_.getFullYear(), B_.getMonth(), 0).getDate(); } if (m < 0) { y--; m += 12; }
  const parts = [y && `${y} ${sklon(y, 'rok', 'roky', 'let')}`, m && `${m} ${sklon(m, 'měsíc', 'měsíce', 'měsíců')}`, d && `${d} ${DEN(d)}`].filter(Boolean);
  const short = [y && `${y} r`, m && `${m} m`, d && `${d} d`].filter(Boolean).join(' ') || '0 d';
  return { sign, text: parts.join(' ') || '0 dní', short }; }
VIEWS.klient = function () {
  const s = S(), ov = calcOverview(s, Meas()); const uid = Store.ownerId(); const t = todayISO();
  const name = (Store.clients.find(x => x.id === uid) || {}).display_name || 'Robert';
  const now = diagnoza(); App._diag = now.list; const lvl = now.lvl;
  const chip = { 1: `<span class="chip2 bad">${ico('alert')} Potřebuje pozornost</span>`, 2: `<span class="chip2 warn">Pohlídat</span>`, 3: `<span class="chip2 ok">${ico('check')} Jde podle plánu</span>` }[lvl];
  const ch = sinceLast(); const tyden = Math.floor(daysBetween(s.start_date, t) / 7) + 1;
  return `<div class="ph"><div class="pt"><h1>${esc(name)}</h1><span class="sub">${DAY_NAMES[dayIndex(t)].toLowerCase()} ${czDate(t)} · týden ${tyden}</span></div>
      <div class="act">${chip}</div></div>
    ${briefCard(s)}
    ${todayStrip(s)}
    ${weekCheckCard(s, App._shown = [])}
    ${drillCard()}
    ${todoCard(now, App._shown)}
    <div class="g2b"><div class="card">${phasesCard(s)}</div><div class="card kchart">${chartCard(s, ov, { w: 640, h: 260 })}</div></div>`;
};
/* Týdenní kontrola: skóre plnění 0–100 za minulý týden a 1–3 rozhodnutí na klik.
   Skóre: potvrzené dny 30 % · dny v limitu 30 % · chůze proti plánu 20 % · vážení 20 %. */
function weekScore(from, to) {
  const R = periodStats(from, to); if (R.empty || !R.n) return null;
  const conf = R.conf / R.n, lim = R.inLimit / R.n, walk = R.walkPlan ? Math.min(1, R.walk / R.walkPlan) : 0, weigh = R.wDays ? Math.min(1, R.weigh / R.wDays) : 0;
  return { s: Math.round(conf * 30 + lim * 30 + walk * 20 + weigh * 20), R };
}
const scoreCol = v => v >= 70 ? '#16a34a' : v >= 40 ? '#d97706' : '#dc2626';
function bigRing(pct, size, col, track, txt, sub) { const r = size / 2 - 9, c = 2 * Math.PI * r;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="bring"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${track}" stroke-width="13"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${col}" stroke-width="13" stroke-linecap="round" stroke-dasharray="${(c * Math.max(0.02, Math.min(1, pct))).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/><text x="${size / 2}" y="${size / 2 + (sub ? 2 : 9)}" text-anchor="middle" font-size="${size / 4.2}" font-weight="850" fill="#0f172a">${txt}</text>${sub ? `<text x="${size / 2}" y="${size / 2 + size / 6.2}" text-anchor="middle" font-size="${size / 11}" fill="#64748b">${sub}</text>` : ''}</svg>`; }
function weekCheckCard(s, shown) {
  const g = guideWeek(), from = g.from, to = g.to;
  const sc = weekScore(from, to); if (!sc) return '';
  const done = LS.get('dec:' + from, {}); const recs = guideRecs(); if (shown) recs.forEach(x => shown.push(x.key));
  const open = recs.filter(r => !done[r.key]).length; const story = weekStory(from, to); const bad = story.filter(x => x.c === 'bad');
  const W = drWeight(from, to), wp = W.pct;   // výsledek (váha) se počítá taky – skóre samo měří jen kázeň
  const head = sc.s >= 70 && (wp == null || wp >= 80) ? 'Robert jede podle plánu' : sc.s >= 70 ? `Dodržuje, ale váha jde pomaleji (${wp} % cíle)`
    : wp != null && wp >= 80 ? `Váha minulý týden podle plánu (${wp} %), ale Robert nezapisuje` : sc.s >= 40 ? 'Robert plní jen část plánu' : 'Robert plán neplní';
  const col = sc.s >= 70 && (wp == null || wp >= 80) ? scoreCol(sc.s) : sc.s >= 40 || (wp != null && wp >= 80) ? '#d97706' : '#dc2626';
  return `<div class="card wcheck">${bigRing(sc.s / 100, 112, col, '#e0e7ff', sc.s, 'ze 100')}
    <div class="wtx"><span class="pill2">${ico('clip')} Týdenní kontrola · ${czDateShort(from)}–${czDateShort(to)}${hq('pSkore')}</span>
      <h2>${head}</h2>
      <div class="small">${esc((bad[0] || story[0] || {}).txt || '')}</div>
      ${(() => { const F = feedbackPoints(from, to); return F.P.length ? `<div class="small ok">${ico('star')} Pochval: ${esc(F.P[0])}</div>` : ''; })()}
      <div class="row"><button class="btn" onclick="App._gs=1;A.guide(1)">${open ? `Projít týden · ${open} ${sklon(open, 'věc k rozhodnutí', 'věci k rozhodnutí', 'věcí k rozhodnutí')}` : 'Projít týden znovu'}</button>${!open && recs.length ? `<span class="ok small b">${ico('check')} vše rozhodnuto</span>` : ''}</div></div></div>`;
}
A.decide = (week, key, v) => { const d = LS.get('dec:' + week, {}); if (v) d[key] = v; else delete d[key]; LS.set('dec:' + week, d); render(); };
function heroStats(s, ov) {
  const t = todayISO(), tr = trend21(), planW = ov.cur * effSettings(s, t).rate_pct / 100; const pct = tr && planW ? Math.round(tr.perWeek / planW * 100) : null;
  const gp = planGoalDate(s), fc = goalForecast(s, ov), d = gp && fc.date ? ymd(gp, fc.date) : null;
  const ms = Meas().filter(m => m.weight != null).sort((a, b) => a.date.localeCompare(b.date)); const lw = ms[ms.length - 1]; const ago = lw ? daysBetween(lw.date, t) : null;
  return `<div class="card hs"><div class="lab">${ico('trend')} Tempo · trend 3 týdnů${hq('pTempo')}</div><div class="hbig ${pct != null && pct < 80 ? 'bad' : 'ok'}">${tr ? kgTyd(tr.perWeek) : '–'} <small>kg/týden</small></div>
      <div class="hbar"><i style="width:${Math.max(3, Math.min(100, pct || 0))}%;background:${pct != null && pct < 80 ? '#dc2626' : '#16a34a'}"></i></div><div class="muted small">plán −${fmt2(planW)}${pct != null ? ` · plní na <b>${pct} %</b>` : ''}</div></div>
    <div class="card hs"><div class="lab">${ico('target')} Cíl ${fmt1(s.goal_weight)} kg${hq('pCil')}</div><div class="hbig">${fc.date ? czDate(fc.date) : esc(fc.text)}</div>
      <div class="muted small">podle plánu ${gp ? czDate(gp) : '–'}${d ? ` · <b class="${d.sign > 0 ? 'bad' : 'ok'}">${d.sign > 0 ? '+' : '−'}${d.short}</b>` : ''}</div><div class="muted small">zbývá ${fmt1(Math.max(0, ov.cur - s.goal_weight))} kg · shozeno ${fmt1(Math.max(0, s.start_weight - ov.cur))} kg</div></div>
    <div class="card hs"><div class="lab">${ico('scale')} Poslední vážení</div><div class="hbig">${lw ? fmt1(lw.weight) : '–'} <small>kg</small></div><div class="small ${ago > 2 ? 'bad b' : 'muted'}">${lw ? `${czDateShort(lw.date)} · ${ago === 0 ? 'dnes' : ago === 1 ? 'včera' : `před ${ago} ${DEN(ago)}`}` : 'zatím žádné'}</div></div>`;
}
function todoCard(now, shown) {
  const t = todayISO(), dec = LS.get('dec:' + addDays(mondayOf(t), -7), {});
  const list = now.list.filter(x => !dec[x.key] && !(shown || []).includes(x.key)).slice(0, 3); const icn = { nepotvrz: ['alert', 'b'], vazeni: ['scale', 'b'], 'vazeni-malo': ['scale', 'o'], jidlo: ['fork', 'b'], preslimit: ['fork', 'b'], pohyb: ['walk', 'o'], chuze: ['walk', 'o'], kroky: ['feet', 'o'], krokyzap: ['feet', 'o'], trenink: ['dumbbell', 'v'], stoji: ['bolt', 'o'], hlad: ['flame', 'b'], spanek: ['moon', 'p'], psych: ['moon', 'p'], cil: ['target', 'ok'], udrz: ['cal', 'p'], tempo: ['trend', 'o'], planjidel: ['cal', 'p'], voda: ['scale', 'p'], cilcheck: ['target', 'p'], situace: ['fork', 'o'], preplan: ['trend', 'b'], trplan: ['dumbbell', 'v'] };
  return `<div class="card"><div class="chd"><h2>Co řešit</h2><span class="muted small">nejvýš tři, seřazené podle dopadu</span>${now.list.length > 3 ? `<button class="btn ghost sm" style="margin-left:auto" onclick="A.probAll()">Všechny (${now.list.length})</button>` : ''}</div>
    <div class="todo">${list.length ? list.map(x => { const i = App._diag.indexOf(x); const [ic, cl] = icn[x.key] || ['alert', 'o'];
      return `<div class="td" onclick="A.probSheet(${i})"><div class="icb ${cl}">${ico(ic)}</div><b>${esc(x.title)}</b><p>${esc((x.sub || '').slice(0, 160))}</p><div class="ft">${x.kg ? `<span class="pill">≈ ${fmt2(x.kg)} kg/týden</span>` : x.kde && x.kde.length ? `<span class="pill">${x.kde.length} ${DEN(x.kde.length)}</span>` : ''}${x.apply ? `<button class="btn sm" onclick="event.stopPropagation();${x.apply}">${esc(x.label)}</button>` : x.go ? `<button class="btn sm sec" onclick="event.stopPropagation();${x.go}">${esc(x.label || 'Otevřít')}</button>` : `<span class="btn sm ghost">Proč ›</span>`}</div></div>`; }).join('')
      : `<div class="td"><div class="icb ok">${ico('check')}</div><b>Nic nevázne</b><p>Robert drží limit, pohyb i vážení.</p></div>`}</div></div>`;
}
/* Plnění: 8 týdnů × dny, čtyři oblasti; tmavší zelená = líp, červená = ujelo, šedá = nezapsáno */
function heatCard(s) {
  const t = todayISO(); const mons = []; for (let k = 5; k >= 0; k--) mons.push(addDays(mondayOf(t), -7 * k));
  const all = []; mons.forEach(m => { for (let k = 0; k < 7; k++) all.push(addDays(m, k)); }); const F = dayCellFns(all.filter(d => d <= t));
  const lvl = (k, d) => { if (d > t || d < s.start_date) return 'n'; const [, c] = (F[k] || (() => ['', '']))(d); return c === 'ok' ? 'g3' : c === 'warn' ? 'g1' : c === 'bad' ? 'x' : c === 'miss' ? 'm' : (k === 'vaha' && Meas().some(x => x.date === d && x.weight != null) ? 'g2' : ''); };
  const rows = [['jidlo', 'fork', 'Jídlo'], ['chuze', 'walk', 'Chůze'], ['kroky', 'feet', 'Kroky'], ['vaha', 'scale', 'Vážení']];
  return `<div class="chd"><h2>Plnění</h2><span class="muted small">6 týdnů · tmavší = líp · červená = ujelo · ťukni na den</span><button class="btn ghost sm" style="margin-left:auto" onclick="A.goalsSheet()">Podrobně ›</button></div>
    <div class="heat"><div></div>${mons.map(m => `<div class="wh">${czDateShort(m)}</div>`).join('')}
    ${rows.map(([k, i, l]) => `<div class="hl">${ico(i)}${l}</div>${mons.map(m => `<div class="wk">${[0, 1, 2, 3, 4, 5, 6].map(j => { const d = addDays(m, j); const c = lvl(k, d); return `<i class="${c}" ${c === 'n' ? '' : `onclick="A.coachDaySheet('${d}')"`} title="${DAY_SHORT[dayIndex(d)]} ${czDateShort(d)}"></i>`; }).join('')}</div>`).join('')}`).join('')}</div>`;
}
/* tabulka cílů po týdnech / měsících (dřívější hlavní pohled) – teď jako detail */
A.goalsSheet = () => openSheet(() => { const r = perRange(); const pd = diagnoza(r.from, r.to); App._diag = pd.list; return UI.sheetHtml('Cíle po dnech', 'plán · skutečnost · rozdíl · dny', `<div class="gtbl-wrap">${goalsTable(pd, r)}</div>`); });
function milestonesCard(s, ov) {
  const ms = []; for (let m = Math.floor((s.start_weight - 0.01) / 5) * 5; m > s.goal_weight; m -= 5) ms.push(m); ms.push(s.goal_weight);
  const rows = calcMeasurements(s, Meas());
  return `<div class="chd"><h2>Milníky</h2><span class="muted small">plán · skutečnost</span></div><div class="mst">${ms.map((m, i) => { const pi = Math.round(Math.log(m / s.start_weight) / Math.log(1 - s.rate_pct / 100) * 7); const pd = addDays(s.start_date, pi); const hit = rows.find(r => r.avg <= m);
      const isNext = !hit && (i === 0 || rows.find(r => r.avg <= ms[i - 1]));
      return `<div class="m"><b>${fmt0(m)} kg</b><span class="muted"><i class="dt" style="background:${hit ? '#16a34a' : '#cbd5e1'}"></i>plán ${czDateShort(pd)}${String(parseISO(pd).getFullYear()).slice(2)}</span><span class="${hit ? 'ok' : 'muted'} small b">${hit ? `✓ ${czDateShort(hit.date)}${hit.date <= pd ? ' · dřív' : ` · +${daysBetween(pd, hit.date)} ${DEN(daysBetween(pd, hit.date))}`}` : isNext ? `zbývá ${fmt1(ov.cur - m)} kg` : ''}</span></div>`; }).join('')}</div>`;
}
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
const RANGES = [[56, '8 týdnů'], [-1, 'Celá cesta']];
/* řádek pod grafem: cíl, kolik zbývá, kdy podle plánu a kdy podle trendu */
function goalLine(s, ov) { const gp = planGoalDate(s), fc = goalForecast(s, ov); const d = gp && fc.date ? ymd(gp, fc.date) : null;
  return `<div class="gline"><b>🎯 Cíl ${fmt1(s.goal_weight)} kg</b><span>zbývá ${fmt1(Math.max(0, ov.cur - s.goal_weight))} kg</span><span>plán ${gp ? czDate(gp) : '–'}</span><span class="${d && d.sign > 0 ? 'bad' : 'ok'}">trend ${fc.text}${d ? ` (${d.sign > 0 ? '+' : '−'}${d.short})` : ''}</span></div>`; }
function chartCard(s, ov, opts) {
  const seg = (v, lab) => `<button class="${App.cg === v ? 'on' : ''}" onclick="App.cg='${v}';render()">${lab}</button>`;
  const sub = App.cg === 'w' ? RANGES.map(([v, l]) => `<button class="chip ${App.cgR === v ? 'on' : ''}" onclick="App.cgR=${v};render()">${l}</button>`).join('')
    : CIRC.map(([k, l]) => `<button class="chip ${App.cgO === k ? 'on' : ''}" onclick="App.cgO='${k}';render()">${l}</button>`).join('');
  const leg = App.cg === 'w' ? `<div class="legend kleg"><span><i style="background:#1478d4"></i>Ø týdne</span><span><i style="background:#d97706"></i>trend</span><span><i style="background:#9aa3b8"></i>plán ±0,5</span><span><i style="background:#a8c6e4"></i>ráno</span></div>` : '';
  return `<div class="row between kch"><div class="seg sm">${seg('w', 'Váha')}${seg('o', 'Obvody')}</div><div class="chips">${sub}</div><button class="btn ghost sm" onclick="A.bigChart()" title="Zvětšit graf">⤢</button></div>
    ${leg}${App.cg === 'w' ? coachWeightChart(s, ov, opts) : circChart(s, opts)}${goalLine(s, ov)}`;
}
/* graf přes celou obrazovku */
function bigChartHtml() { const s = S(), ov = calcOverview(s, Meas());
  return `<div class="bigchart"><div class="row between"><h2>${App.cg === 'w' ? 'Váha' : 'Obvody'}</h2><button class="iconbtn" onclick="UI.closeModal()" aria-label="zavřít">×</button></div>${chartCard(s, ov, { w: 1100, h: 460, shade: false }).replace(/render\(\)/g, 'A.bigRedraw()').replace('<button class="btn ghost sm" onclick="A.bigChart()" title="Zvětšit graf">⤢</button>', '')}</div>`; }
A.bigChart = () => UI.modal(bigChartHtml(), { center: true });

A.bigRedraw = () => { const el = document.querySelector('.bigchart'); if (el) el.outerHTML = bigChartHtml(); render();
}
const CIRC = [['waist', 'Pas'], ['hips', 'Boky'], ['chest', 'Hrudník'], ['thigh', 'Stehno'], ['arm', 'Paže']];
/* Graf váhy: týdenní průměry, trend s prognózou, plán s pásmem ±0,5 kg a cílová váha.
   Rozsah 8 t / 3 m / vše / do cíle (-1): „do cíle“ ukáže celou cestu až k cílové váze –
   kdy ji Robert dosáhne podle plánu a kdy podle trendu. opts: w, h (velikost plátna), shade, range. */
function coachWeightChart(s, ov, opts) {
  opts = opts || {};
  const rows = ov.rows; if (!rows.length) return '<p class="muted small">Zatím žádné vážení.</p>';
  const last = rows[rows.length - 1].idx; const R = opts.range != null ? opts.range : App.cgR;
  const tr = trend21(); const wa = weekAvgs(); const gw = s.goal_weight;
  const gpD = planGoalDate(s), gpI = gpD ? daysBetween(s.start_date, gpD) : null;
  const fc = goalForecast(s, ov), fcI = fc.date ? daysBetween(s.start_date, fc.date) : null;
  let x0, x1;
  if (R === -1) { x0 = 0; x1 = Math.max(last + 14, gpI || 0, Math.min(fcI || 0, last + 3 * 365)) + 21; }
  else { const range = R || (last + 1); x0 = Math.max(0, last - range + 1); x1 = last + Math.max(7, Math.round(range * 0.2)); }
  const span = x1 - x0;
  const narrow = window.innerWidth < 640;   // na telefonu užší plátno, ať text na osách není drobný
  const W = narrow ? 420 : (opts.w || 760), H = narrow ? 240 : (opts.h || 122), L = 40, R_ = 14, T = 16, B = 22;
  const vis = rows.filter(r => r.idx >= x0);
  const ty = x => tr ? tr.y + tr.slope * (x - tr.at) : null;
  const pw = x => planAt(addDays(s.start_date, x)); const ys = vis.map(r => r.weight).concat([pw(x0) + 0.5, pw(x1) - 0.5]); if (tr) ys.push(ty(x1));
  if (R === -1) ys.push(gw - 1.5);
  let y0 = Math.min(...ys) - 0.4, y1 = Math.max(...ys) + 0.4;
  const X = x => L + (x - x0) / span * (W - L - R_), Y = y => T + (y1 - y) / (y1 - y0) * (H - T - B);
  let g = `<svg class="chart" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img">`;
  const st = niceStep((y1 - y0) / Math.max(3, Math.round(H / 60))); for (let v = Math.ceil(y0 / st) * st; v <= y1; v += st) g += `<line x1="${L}" x2="${W - R_}" y1="${Y(v)}" y2="${Y(v)}" stroke="#e6ebea"/><text x="${L - 6}" y="${Y(v) + 4}" font-size="11" fill="#7a878c" text-anchor="end">${fmtTick(v)}</text>`;
  // osa: pondělky jako data, hustota podle délky a šířky
  const per = span * 55 / (W - L - R_); const step = per > 91 ? 182 : per > 56 ? 91 : per > 28 ? 56 : per > 14 ? 28 : per > 7 ? 14 : 7;
  for (let x = x0; x <= x1; x++) { const dt = addDays(s.start_date, x); if (dayIndex(dt) !== 0 || daysBetween(mondayOf(addDays(s.start_date, x0)), dt) % step) continue;
    g += `<line x1="${X(x)}" x2="${X(x)}" y1="${T}" y2="${H - B}" stroke="#f0f2f5"/><text x="${X(x)}" y="${H - 7}" font-size="11" fill="#7a878c" text-anchor="middle">${step >= 91 ? `${parseISO(dt).getMonth() + 1}/${String(parseISO(dt).getFullYear()).slice(2)}` : czDateShort(dt)}</text>`; }
  // plán s pásmem ±0,5 kg
  const pp = []; const ps = Math.max(1, Math.round(span / 300)); for (let x = x0; x <= x1; x += ps) pp.push([X(x), pw(x)]);
  g += `<path d="M${pp.map(p => `${p[0].toFixed(1)},${Y(p[1] + 0.5).toFixed(1)}`).join('L')}L${pp.slice().reverse().map(p => `${p[0].toFixed(1)},${Y(p[1] - 0.5).toFixed(1)}`).join('L')}Z" fill="rgba(154,163,184,.13)"/>`;
  g += `<path d="M${pp.map(p => `${p[0].toFixed(1)},${Y(p[1]).toFixed(1)}`).join('L')}" fill="none" stroke="#9aa3b8" stroke-width="1.5" stroke-dasharray="6 5"/>`;
  // cílová váha – vždy, když je v grafu
  if (gw >= y0 && gw <= y1) { g += `<line x1="${L}" x2="${W - R_}" y1="${Y(gw)}" y2="${Y(gw)}" stroke="#15803d" stroke-width="1.6" stroke-dasharray="4 4"/><text x="${L + 4}" y="${Y(gw) + 15}" font-size="11.5" font-weight="700" fill="#15803d">cíl ${fmt1(gw)} kg</text>`;
    // blízké značky: druhý popisek nad čáru, ať se nepřekrývají
    const close = gpI != null && fcI != null && Math.abs(X(gpI) - X(fcI)) < 95;
    const pin = (xi, lab, col, up) => xi != null && xi >= x0 && xi <= x1 ? `<circle cx="${X(xi)}" cy="${Y(gw)}" r="5" fill="#fff" stroke="${col}" stroke-width="2.5"/><text x="${Math.min(X(xi), W - R_ - 40)}" y="${up ? Y(gw) - 24 : Y(gw) - 9}" font-size="11" font-weight="700" fill="${col}" text-anchor="middle">${lab}</text>` : '';
    g += pin(gpI, `plán ${czDateShort(gpD)}${String(parseISO(gpD).getFullYear()).slice(2)}`, '#5b6480', false) + pin(fcI, `trend ${fc.date ? czDateShort(fc.date) + String(parseISO(fc.date).getFullYear()).slice(2) : ''}`, '#d97706', close); }
  // vybrané období dole
  if (opts.shade !== false) { const pr = perRange(); const a = Math.max(x0, daysBetween(s.start_date, pr.from)), b = Math.min(x1, daysBetween(s.start_date, pr.to) + 1); if (b > a) g += `<rect x="${X(a)}" y="${T}" width="${X(b) - X(a)}" height="${H - B - T}" fill="rgba(20,120,212,.07)" rx="4"/>`; }
  // ranní váhy
  g += `<path d="M${vis.map(r => `${X(r.idx).toFixed(1)},${Y(r.weight).toFixed(1)}`).join('L')}" fill="none" stroke="#a8c6e4" stroke-width="1.2"/>`;
  vis.forEach(r => { g += `<circle cx="${X(r.idx)}" cy="${Y(r.weight)}" r="2.6" fill="#a8c6e4"/>`; });
  // týdenní průměry: schod přes Po–Ne, číslo jen když je místo
  const wpx = 7 * (W - L - R_) / span;
  wa.forEach((w, i) => { const a = daysBetween(s.start_date, w.mon), b = a + 6; if (b < x0) return; const xa = X(Math.max(a, x0)), xb = X(Math.min(b, last));
    g += `<line x1="${xa}" x2="${xb}" y1="${Y(w.avg)}" y2="${Y(w.avg)}" stroke="#1478d4" stroke-width="3" stroke-linecap="round"/>${wpx >= 34 || i === wa.length - 1 ? `<text x="${(xa + xb) / 2}" y="${Y(w.avg) - 7}" font-size="11.5" font-weight="700" fill="#0f5fa8" text-anchor="middle">${fmt1(w.avg)}</text>` : ''}`; });
  // trend 21 dní a jeho pokračování
  if (tr) { const xa = Math.max(tr.from, x0); const xe = Math.min(x1, fcI != null ? fcI : x1);
    g += `<line x1="${X(xa)}" x2="${X(last)}" y1="${Y(ty(xa))}" y2="${Y(ty(last))}" stroke="#d97706" stroke-width="2.2"/><line x1="${X(last)}" x2="${X(xe)}" y1="${Y(ty(last))}" y2="${Y(ty(xe))}" stroke="#d97706" stroke-width="2" stroke-dasharray="4 4"/>`; }
  g += marksSvg(logMarks(s), x0, x1, X, T, H - B);
  const id = 'ct' + (++lineChart.n); lineChart.reg[id] = weightTips(ov, true).filter(t => t.x >= x0).map(t => ({ sx: X(t.x), sy: Y(t.y), html: t.html }));
  g += `<g class="tipg" style="display:none"><line y1="${T}" y2="${H - B}" stroke="#1478d4" stroke-width="1" stroke-dasharray="2 3"/><circle r="5.5" fill="#fff" stroke="#1478d4" stroke-width="2.5"/></g></svg>`;
  return `<div class="chartw" data-tip="${id}">${g}<div class="ctip" hidden></div></div>`;
}
function circChart(s, opts) {
  const k = App.cgO, lab = (CIRC.find(c => c[0] === k) || [k, k])[1];
  const ms = Meas().filter(m => m[k] != null).sort((a, b) => a.date.localeCompare(b.date));
  if (!ms.length) return `<p class="muted small">${lab}: zatím žádné měření. Robert měří obvody v neděli.</p>`;
  const f = ms[0]; const pts = ms.map(m => [daysBetween(s.start_date, m.date), m[k]]);
  const tips = ms.map(m => ({ x: daysBetween(s.start_date, m.date), y: m[k], html: `<b>${DAY_SHORT[dayIndex(m.date)]} ${czDateShort(m.date)}</b><br><span class="w">${fmt1(m[k])} cm</span> ${lab.toLowerCase()}<br>${m === f ? 'první měření' : `${signed1(m[k] - f[k])} cm od ${czDateShort(f.date)}`}` }));
  return lineChart({ series: [{ name: lab.toLowerCase() + ' (cm)', color: '#1478d4', pts, dots: true }], xLabel: '', yUnit: 'cm', h: (opts && opts.h) || 128, tips, xFmt: x => czDateShort(addDays(s.start_date, x)), hLine: k === 'waist' && s.goal_waist && Math.min(...ms.map(m => m[k])) - s.goal_waist <= 6 ? { y: s.goal_waist, label: 'cíl ' + s.goal_waist + ' cm', color: '#15803d' } : null })
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
  const meals = `<div class="list">${d.courses.map((c, ci) => { const mm = day.meals[c.key] || {}; return `<div class="li static"><span class="g-k ${mm.eaten ? 'on' : ''}">${mm.eaten ? '✓' : ''}</span><span class="em">${ico(c.key === 'vecere2' ? 'cup' : 'fork')}</span><div class="tx"><b>${esc(c.sel || 'nevybráno')}</b><span>${esc(s.courses[ci].name)} · cíl ${fmt0(c.target)} kcal${c.edited ? ' · upraveno' : ''}${c.skipped ? ' · vynechal' : ''}</span></div><span class="val k ${c.kcal > c.target * 1.15 ? 'bad' : ''}">${c.kcal ? fmt0(c.kcal) : ''}</span></div>`; }).join('')}
    ${B.cheatKcal ? `<div class="li static cheat"><span class="g-k na"></span><span class="em">${ico('beer')}</span><div class="tx"><b>Cheat · ${esc(cheatPopis(day))}</b><span>${B.cheatCoverable ? `pokrýt ${B.cheatWalk} min chůze navíc` : 'větší, než jde uchodit'}</span></div><span class="val">${fmt0(B.cheatKcal)}</span></div>` : ''}</div>`;
  const move = `<div class="list"><div class="li static"><span class="em">${ico('walk')}</span><div class="tx"><b>Chůze ${day.walk_min || 0} z ${B.planWalk} min</b><span>${B.cheatWalk ? `z toho ${B.cheatWalk} min za cheat` : 'cíl dne'}</span></div><span class="val ${(day.walk_min || 0) >= B.planWalk - 5 ? 'ok' : 'bad'}">${(day.walk_min || 0) >= B.planWalk - 5 ? '✓' : '−' + (B.planWalk - (day.walk_min || 0))}</span></div>
    <div class="li static"><span class="em">${ico('feet')}</span><div class="tx"><b>Kroky ${bk == null ? 'nezapsané' : fmt0(bk)}</b><span>běžná chůze · cíl ${fmt0(cil)}</span></div><span class="val ${bk != null && bk >= cil * 0.9 ? 'ok' : 'bad'}">${bk == null ? '–' : bk >= cil * 0.9 ? '✓' : Math.round(bk / cil * 100) + ' %'}</span></div>
    ${items.map((it, i) => { const sets = ((log[i] || {}).sets || []).length; return `<div class="li static"><span class="em">${ico('dumbbell')}</span><div class="tx"><b>${esc(itemLabel(it))}</b><span>${sets ? `odcvičeno ${sets} ${sklon(sets, 'série', 'série', 'sérií')}${it.sets ? ` z ${it.sets}` : ''}` : done[i] ? 'odškrtnuto' : 'neodcvičeno'}</span></div><span class="val ${done[i] || sets ? 'ok' : 'bad'}">${done[i] || sets ? '✓' : '✗'}</span></div>`; }).join('')}
    ${tr.rpe ? `<div class="small muted">náročnost ${tr.rpe}/5${tr.feel ? ' · ' + esc(tr.feel) : ''}</div>` : ''}</div>`;
  const rest = `<div class="small muted">Váha ráno ${m && m.weight != null ? fmt1(m.weight) + ' kg' : '–'} · druhý den ${mNext && mNext.weight != null ? fmt1(mNext.weight) + ' kg' : '–'}</div>
    <div class="card stack s8"><b>Jak šel den</b>${checkinSummary(day) ? `<div>${esc(checkinSummary(day))}</div>` : '<div class="small muted">Nevyplnil.</div>'}${(day.checkin || {}).note ? `<div class="bubble" style="background:var(--p-bg)"><div>„${esc(day.checkin.note)}“</div></div>` : ''}</div>`;
  const row7 = calcMeasurements(s, Meas()).filter(x => x.date <= date).pop(), pd = planAt(date), wk = day.walk_min || 0;
  const stats2 = `<div class="stats3"><div><b>${m && m.weight != null ? fmt1(m.weight) : '–'} <small>kg</small></b><span>váha ráno${row7 ? ` · Ø ${fmt1(row7.avg)} · plán ${fmt1(pd)}` : ''}</span></div><div><b class="${wk >= B.planWalk - 5 ? 'ok' : 'bad'}">${wk} <small>/ ${B.planWalk} min</small></b><span>chůze</span></div><div><b class="${bk != null && bk >= cil * 0.9 ? 'ok' : bk == null ? '' : 'bad'}">${bk == null ? '–' : fmt0(bk)}</b><span>běžné kroky · cíl ${fmt0(cil)}</span></div></div>`;
  return UI.sheetHtml(`${DAY_NAMES[dayIndex(date)]} ${czDateShort(date)}`, ev.stav === 'ok' ? 'potvrzený · den seděl' : ev.stav === 'bad' ? 'potvrzený · den neseděl' : ev.stav === 'dnes' ? 'probíhá' : 'nepotvrzený – níž je jen plán',
    `${nav}${verdict}${stats}${stats2}<h3>Jídla – plán a skutečnost</h3>${meals}<h3>Pohyb</h3>${move}${rest}`,
    `<button class="btn sec" onclick="A.trDaySheet('${date}')">${ico('dumbbell')} Upravit trénink dne</button>`);
});
/* novinky od minulé návštěvy */
A.sinceSheet = () => { const ch = sinceLast();
  UI.sheet('Od tvé poslední návštěvy', ch.since ? czDate(isoDate(new Date(ch.since))) : '', ch.items.length ? `<ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:4px">${ch.items.slice(0, 40).map(t => `<li class="small">${t}</li>`).join('')}</ul>` : '<p class="muted">Nic nového.</p>'); };
/* čísla pro hloubku: 6 týdnů, 28 dní, příjem proti limitu a chůze */
A.numbersSheet = () => {
  const s = S(), ov = calcOverview(s, Meas()); const today = todayISO(); const uid = Store.ownerId(); const N = 28;
  const byDate = Object.fromEntries(Store.rows('days', uid).map(r => [r.data.date, r.data])); const measBy = Object.fromEntries(Meas().map(m => [m.date, m]));
  const range = []; for (let k = N - 1; k >= 0; k--) range.push(addDays(today, -k));
  const rows = range.map(dt => { if (!byDate[dt]) return { dt, none: true }; const ev = evaluateDay(dt); return { dt, ...ev, walk: ev.day.walk_min || 0, hasFood: ev.confirmed && ev.d.tot.kcal > 0, closedOk: dt < today ? (ev.confirmed ? ev.ok : 'nezapsany') : null }; });
  const thisMon = mondayOf(today); const weeks = [];
  for (let k = 5; k >= 0; k--) { const mon = addDays(thisMon, -7 * k); const R = weekReport(mon); weeks.push({ mon, R, planned: weekPlanned(mon) }); }
  const walkPts = rows.map(r => r.none ? 0 : r.walk); const intakePts = rows.filter(r => r.hasFood).map(r => [range.indexOf(r.dt), r.d.intake]); const limitPts = rows.filter(r => r.hasFood).map(r => [range.indexOf(r.dt), r.d.base.maxIntake]);
  UI.sheet('Čísla', 'posledních 6 týdnů a 28 dní',
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
/* Kdy cíle dosáhne podle plánu: plánová křivka den po dni s tempem, jaké kdy platilo,
   a s přestávkami (6. 10. 2026). Dřív dnešní tempo od startu – po zvýšení tempa z 0,7
   na 0,9 % appka tvrdila, že Robert měl od začátku hubnout o 0,9 % a cíl stihne dřív. */
function planGoalDate(s) {
  if (s.maintain || !(s.rate_pct > 0) || s.goal_weight >= s.start_weight) return null;
  const p = planPath(); return p[p.length - 1] <= s.goal_weight + 0.001 ? planEnd() : null;
}
const numf = (s, k, unit, wide) => `<div class="numf ${wide ? 'w' : ''}"><input type="text" inputmode="decimal" id="st_${k}" value="${s[k] >= 1000 ? fmt0(s[k]) : String(s[k]).replace('.', ',')}" onchange="A.setSetting('${k}',this.value)"><span>${unit}</span></div>`;
const frow = (lab, help, ctrl, sub) => `<div class="frow"><div class="fl"><b>${lab}${help ? hq(help) : ''}</b>${sub ? `<span>${sub}</span>` : ''}</div>${ctrl}</div>`;
VIEWS.nastaveni = function () {
  const s = S(), b = limitToday(s), cw = b.w, t = todayISO();
  const mw = (s.maint_weeks || []).slice().sort(); const thisMon = mondayOf(t);
  const odKdy = mw.filter(m => m <= t).pop() || s.start_date; const tydnu = Math.floor(daysBetween(odKdy, t) / 7);
  const doporuc = addDays(mondayOf(odKdy), 7 * Math.max(8, tydnu + 1));
  const goalD = planGoalDate(s); const odCile = calcOverview(s, Meas()).cur - s.goal_weight; const ph = phaseSuggestion();
  const real = b.minOut - b.planLimit, want = cw * effSettings(s, t).rate_pct / 100;
  const pct = coursePct(s), L = b.planLimit; const CC = ['#93c5fd', '#86efac', '#fde68a', '#fda4af', '#c4b5fd'];
  const tempoCtl = `<div class="tempo"><input type="range" id="st_rate_pct" min="0.3" max="1.2" step="0.05" value="${s.rate_pct}" oninput="const v=this.value,w=${cw};document.getElementById('ratep').textContent=String(v).replace('.',',')+' %';document.getElementById('ratev').textContent='−'+(Math.round(w*v)/100).toString().replace('.',',')+' kg/týden'" onchange="A.setSetting('rate_pct',this.value)"><b id="ratep">${String(s.rate_pct).replace('.', ',')} %</b></div>`;
  // cesta k cíli: týdny od dneška do cíle podle plánu, přestávky žlutě – ťuknutím se přidá / odebere
  const weeks = goalD ? Math.max(1, Math.ceil(daysBetween(thisMon, goalD) / 7)) : 0;
  const path = pathCard(s);
  const head = (ic, cl, tit) => `<div class="chd"><div class="icb ${cl}">${ico(ic)}</div><h2>${tit}</h2></div>`;
  const cil = `<div class="card pblk">${head('target', 'p', 'Cíl a tempo')}
    <div class="res"><div class="rk">Z toho vyjde</div><div class="rv">${s.maintain ? 'udržování' : `−${fmt2(want)} kg/týden`}</div><div class="rs">${s.maintain ? 'deficit nula – drží váhu' : `deficit ${fmt0(cw * s.rate_pct / 100 * KG_KCAL / 7)} kcal/den${goalD ? ` · cíl ${czDate(goalD)}` : ''}`}</div></div>
    ${frow('Cílová váha', 'cilVaha', numf(s, 'goal_weight', 'kg'))}
    <div class="small muted">BMI ${fmt1(s.goal_weight / Math.pow(s.height / 100, 2))} · zdravá váha podle appky ${fmt0(bmiW(s, 25))} kg (BMI 25)${s.goal_weight > bmiW(s, 25) + 2 ? ' – tvůj cíl je rozumná první etapa' : ''}</div>
    ${s.maintain ? '' : (() => { const g = goalCheck(); const late = g && g.dTrend ? daysBetween(g.target, g.dTrend) : 0;
      const pb = (s.plan_bases || []).slice(-1)[0], pos = terminPosuny();
      return (pb || pos ? `<div class="small muted">${pb ? `Přeplánováno od ${czDateShort(pb.date)} (${fmt1(pb.weight)} kg).` : ''}${pos ? ` <b class="warn">Termín posunut ${pos}×.</b>` : ''}</div>` : '') + frow('Termín cíle', 'terminCile', `<input type="date" class="dinp" value="${s.goal_date || ''}" min="${addDays(todayISO(), 1)}" onchange="A.setGoalDate(this.value)">`, s.goal_date ? `plán bez termínu: ${goalD ? czDate(goalD) : '–'}` : 'nevyplněno = podle plánu')
        + (g ? `<div class="alert ${!g.hasDate ? 'a2' : g.req == null ? 'a1' : g.adh >= 0.8 && late <= 28 ? 'a3' : 'a2'}"><div>${!g.hasDate ? `Robert plní plán na ${Math.round(g.adh * 100)} % → cíl ${g.dTrend ? czDate(g.dTrend) : 'v nedohlednu'}. Zadej termín a appka řekne, jaké tempo stačí.` : g.req == null ? `Termín ${czDate(g.target)} je nereálný ani při 1 %.` : `Termín ${czDate(g.target)} stačí tempo ${String(g.req).replace('.', ',')} % s přestávkami. Robert teď plní ${Math.round(g.adh * 100)} % → ${g.dTrend ? 'cíl ' + czDate(g.dTrend) : 'cíl v nedohlednu'}.`}</div><button class="btn sm" onclick="A.goalCheckSheet()">Rozbor cíle</button></div>` : ''); })()}
    ${s.maintain ? frow('Udržování', 'udrzovani', `<button class="btn sec sm" onclick="A.setMaintain(false)">Vypnout</button>`, 'cíl dosažen · deficit nula natrvalo')
      : frow('Tempo hubnutí', 'tempo', tempoCtl, `<span id="ratev">−${fmt2(cw * s.rate_pct / 100)} kg/týden</span>`)}
    ${frow('Cílový pas', 'cilPas', numf(s, 'goal_waist', 'cm'), `polovina výšky = ${Math.round(s.height / 2)} cm`)}
    ${!s.maintain && odCile <= 3 ? `<div class="alert ${odCile <= 0 ? 'a3' : 'a4'}"><div>${odCile <= 0 ? 'Robert je u cíle.' : `Robert je ${fmt1(odCile)} kg od cíle.`}</div><button class="btn sm" onclick="A.setMaintain(true)">Zapnout udržování</button></div>` : ''}
    ${adviceBox('rate_pct')}</div>`;
  const pohyb = `<div class="card pblk">${head('walk', 'ok', 'Pohyb')}
    <div class="res g"><div class="rk">Z toho vyjde</div><div class="rv">+${fmt0(s.walk_min * b.walkPerMin)} kcal/den</div><div class="rs">${s.walk_min} min chůze · ${b.autoSteps ? `pohyb mimo trénink ${moveLevel(b.stepsBase)[0]}/5 (Ø ${fmt0(b.stepsBase)} kroků)` : `pohyb mimo trénink ${moveLevelFactor(s.activity)[0]}/5 (odhad)`}</div></div>
    ${frow('Chůze denně', 'chuze', numf(s, 'walk_min', 'min'), 'dny bez plánu v Tréninku')}
    ${frow('Kroky z Apple Health', 'krokyAH', `<button class="btn sec sm" onclick="A.stepsHistSheet()">${(s.steps_hist || []).length ? 'Upravit' : 'Zadat průměr'}</button>`, (() => { const h = stepsHistFor(todayISO()); return h ? `Ø ${fmt0(h.avg)} (${czDateShort(h.from)}–${czDateShort(h.to)}) → běžné ${fmt0(h.bezne)}` : 'Robert kroky denně nezapisuje'; })())}
    ${frow('Tempo chůze', 'tempoChuze', `<select class="sel" onchange="A.setSetting('walk_kmh',this.value)">${SEED.met.map(([k]) => `<option value="${k}" ${k === s.walk_kmh ? 'selected' : ''}>${fmt1(k)} km/h</option>`).join('')}</select>`, `fáze ${esc(calcOverview(s, Meas()).phase.split(' – ')[0])}${ph ? ` · doporučeno ${fmt1(ph.rec)} km/h` : ''}`)}
    ${moveRowHtml(s)}
    ${frow('Cvičení týdně', 'ramec', numf({ ...s, tr_per_week: s.tr_per_week ?? 3 }, 'tr_per_week', '×'), (() => { const P = trPeriod(Array.from({ length: 7 }, (_, i) => addDays(mondayOf(todayISO()), i))); return `rámec týdne · tento týden naplánováno ${P.strDays}×`; })())}
    ${ph ? `<div class="alert a2"><div>${esc(ph.text)}</div><button class="btn sm" onclick="A.applyPhase(${ph.rec})">Přepnout</button></div>` : ''}
    ${adviceBox('walk_min')}
    <button class="btn ghost sm" style="align-self:flex-start" onclick="go('trenink')">${ico('dumbbell')} Dny s tréninkem mají vlastní plán ›</button></div>`;
  const jidlo = `<div class="card pblk">${head('fork', 'o', 'Jídlo')}
    <div class="res o"><div class="rk">Limit dne${hq('limit')}</div><div class="rv">${fmt0(L)} kcal</div><div class="rs">výdej ${fmt0(b.minOut)} − deficit ${fmt0(b.deficit)} · nikdy pod ${fmt0(b.floor)}${b.planBelowBmr ? ` · <b>drží ho spodní hranice – skutečný deficit −${fmt2(real * 7 / KG_KCAL)} kg/týden</b>` : ''}</div><button class="btn ghost sm" onclick="A.limitSheet()">Jak se počítá ›</button></div>
    ${frow('Bílkoviny min.', 'bilkoviny', numf(s, 'protein_min', 'g'), `doporučeno ${Math.round(1.6 * s.goal_weight)}–${Math.round(2 * s.goal_weight)} g`)}
    ${adviceBox('protein_min')}
    <div class="fl"><b>Rozdělení mezi jídla${hq('chody')}</b></div>
    <div class="cbar">${s.courses.map((c, i) => `<i style="flex:${pct[i].toFixed(2)};background:${CC[i % 5]}" title="${esc(c.name)} ${fmt0(pct[i])} %"></i>`).join('')}</div>
    <div class="cgrid">${s.courses.map((c, i) => `<label class="cpi"><span><i style="background:${CC[i % 5]}"></i>${esc(c.name)}</span><div class="numf s"><input type="text" inputmode="decimal" id="st_c${i}" value="${fmt0(pct[i])}" onchange="A.setCoursePct(${i},this.value)"><span>%</span></div><em>≈ ${fmt0(L * pct[i] / 100)}</em></label>`).join('')}</div>
    ${adviceBox('courses')}</div>`;
  return `<div class="ph"><div class="pt"><h1>Plán</h1><span class="sub">co má Robert dělat · ukládá se hned</span></div><div class="act"><button class="btn ghost sm" onclick="go('historie')">${ico('clip')} Historie změn</button></div></div>
  ${path}
  <div class="pgrid p3">${cil}${pohyb}${jidlo}</div>
  ${profileRow(s)}`;
};
/* Profil Roberta jedním řádkem; úprava v listu. Start a startovní váha = první vážení. */
function profileRow(s) { const sb = stepsBaseFor(todayISO());
  return `<div class="card prow"><div class="icb p">${ico('user')}</div><div class="sp"><b>Profil Roberta</b><div class="muted small">${s.height} cm · ${s.age} let · start ${czDate(s.start_date)} ze ${fmt1(s.start_weight)} kg (z prvního vážení) · běžný výdej ${s.factor_lock ? `pevný faktor ${String(s.activity).replace('.', ',')}` : sb != null ? `z jeho kroků (Ø ${fmt0(sb)})` : `faktor ${String(s.activity).replace('.', ',')}, dokud nezapisuje kroky`}</div></div><button class="btn sm sec" onclick="A.profileEdit()">Upravit</button></div>`; }
A.profileEdit = () => openSheet(() => { const s = S(); const sb = stepsBaseFor(todayISO());
  const f = (k, l, help) => `<div class="field"><label class="f">${l}${help ? hq(help) : ''}</label><input type="text" inputmode="decimal" id="st_${k}" value="${String(s[k]).replace('.', ',')}" onchange="A.setSetting('${k}',this.value)"></div>`;
  return UI.sheetHtml('Profil Roberta', 'mění se jednou za čas · ukládá se hned', `<div class="grid g2">${f('height', 'Výška (cm)')}${f('age', 'Věk')}</div>
    <div class="field"><label class="f">Pohyb mimo trénink${hq('pohybStupen')}</label><div class="seg"><button class="${s.factor_lock ? '' : 'on'}" onclick="A.setFactorLock(false)">Z jeho kroků</button><button class="${s.factor_lock ? 'on' : ''}" onclick="A.setMoveManual(${moveLevelFactor(s.activity)[0]})">Ručně stupněm</button></div>
      <div class="hint">${s.factor_lock ? 'Limit počítá s pevným faktorem níž.' : sb != null ? `Teď z průměru ${fmt0(sb)} běžných kroků za 14 dní.` : 'Dokud Robert nezapíše kroky aspoň 5 dní ze 14, platí faktor níž.'}</div></div>
    ${s.factor_lock ? `<div class="seg mlv">${MOVE_LVL.map(l => `<button class="${moveLevelFactor(s.activity)[0] === l[0] ? 'on' : ''}" onclick="A.setMoveManual(${l[0]})">${l[0]} ${l[1]}</button>`).join('')}</div>` : ''}
    <div class="grid g2">${f('rest_sec', 'Pauza mezi sériemi (s)', 'trPauza')}</div>
    <p class="small muted">Start (${czDate(s.start_date)}, ${fmt1(s.start_weight)} kg) se bere z prvního vážení. Délka kroku ${String(Math.round(strideM() * 100) / 100).replace('.', ',')} m${strideM() !== 0.75 ? ' z jeho km' : ''}.</p>`); });
/* meze, aby překlep nerozbil výpočet */
const SET_MEZ = { tr_per_week: [0, 6], height: [120, 230], age: [15, 100], activity: [1.1, 2], start_weight: [40, 400], goal_weight: [40, 400],
  goal_waist: [50, 200], rate_pct: [0.3, 1.2], walk_kmh: [2, 9], walk_min: [0, 240], rest_sec: [15, 600], protein_min: [60, 400], steps_goal: [0, 30000] };
const SET_POP = { tr_per_week: 'cvičení týdně', out_adj: 'korekce výdeje (kcal)', goal_date: 'termín cíle', factor_lock: 'pohyb nastavený ručně', maintain: 'udržování (cíl dosažen)', rate_pct: 'tempo hubnutí (%)', walk_min: 'cíl chůze (min)', protein_min: 'bílkoviny (g)', goal_weight: 'cílová váha (kg)', activity: 'pohyb mimo trénink (ručně)', walk_kmh: 'tempo chůze (min/km)', goal_waist: 'cíl pasu (cm)', steps_goal: 'cíl kroků/den', height: 'výška (cm)', age: 'věk', start_weight: 'startovní váha (kg)' };
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
  if (k === 'steps_goal') { const rec = factorForSteps(r.n); if (rec !== s.activity) { d.activity = rec; msg = `Cíl ${fmt0(r.n)} běžných kroků (stupeň ${moveLevel(r.n)[0]}/5).`; } }
  if (k === 'walk_min' && r.n > WALK_PLAN_WARN && r.n > (s.walk_min || 0)) { UI.confirm(`Cíl ${r.n} minut chůze denně je u ${fmt0(currentWeight())} kg velká zátěž na klouby a těžko se dá dodržet. Doporučuju do ${WALK_PLAN_WARN} minut. Nastavit ${r.n} minut?`, () => commitSettings(d, (SET_POP[k] || k) + ' změněno', msg), `Nastavit ${r.n} min`, true); render(); return; }
  commitSettings(d, (SET_POP[k] || k) + ' změněno', msg);
};
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
/* Jak se limit počítá – krok po kroku s Robertovými čísly a proč tělo nestrádá.
   Číslo pod číslem, ať trenér vidí, kde se limit bere a co s ním který knoflík udělá. */
A.limitSheet = () => openSheet(() => {
  const s = S(), b = limitToday(s), w = b.w, t = todayISO(), rate = effSettings(s, t).rate_pct;
  const walkK = b.planWalk * b.walkPerMin, real = b.minOut - b.planLimit, pMin = Math.round(1.6 * s.goal_weight), pMax = Math.round(2 * s.goal_weight);
  const step = (n, lab, val, note) => `<div class="lstep"><span class="n">${n}</span><div class="tx"><b>${lab}</b><span>${note}</span></div><b class="v">${val}</b></div>`;
  return UI.sheetHtml('Jak se počítá limit dne', `Robert dnes · ${fmt1(w)} kg · ${b.planWalk} min chůze`,
    `<div class="list lsteps">
      ${step(1, 'Klidový výdej', fmt0(b.bmr), `kolik tělo spálí, i kdyby celý den leželo (Mifflin–St Jeor: váha ${fmt1(w)} kg, výška ${s.height}, věk ${s.age})`)}
      ${step(2, 'Běžný výdej', '+ ' + fmt0(b.baseOut - b.bmr), b.autoSteps ? `sedavý den (× 1,2) + Robertův průměr ${fmt0(b.stepsBase)} běžných kroků × ${fmt2(b.kps)} kcal; večer se dopočítá podle skutečných kroků` : `běžný den bez procházky: × faktor ${String(s.activity).replace('.', ',')}${s.factor_lock ? ' (zamčený)' : ' – málo zapsaných kroků'}`)}
      ${step(3, 'Cílený pohyb', '+ ' + fmt0(walkK + b.planKcal), `chůze ${b.planWalk} min × ${fmt1(b.walkPerMin)} kcal${b.planKcal ? ` + trénink ${fmt0(b.planKcal)}` : ''}`)}
      ${step('=', 'Celkový výdej', fmt0(b.minOut), 'kolik Robert dnes spálí, když splní plán pohybu')}
      ${step(4, 'Plánovaný deficit', '− ' + fmt0(b.deficit), `tempo ${String(rate).replace('.', ',')} % z ${fmt1(w)} kg = ${fmt2(w * rate / 100)} kg/týden × 7 700 kcal ÷ 7 dní`)}
      ${step('=', 'Limit dne', fmt0(b.planLimit), b.planBelowBmr ? `výpočet dá ${fmt0(b.minOut - b.deficit)}, ale spodní hranice ho drží na ${fmt0(b.floor)} (85 % klidového výdeje)` : 'kolik má sníst a vypít')}
    </div>
    <div class="res ${b.planBelowBmr ? 'warn' : 'okk'}">Skutečný deficit <b>${fmt0(real)} kcal/den</b> = −${fmt2(real * 7 / KG_KCAL)} kg/týden${b.planBelowBmr ? ` místo −${fmt2(w * rate / 100)}. Spodní hranice ubrala ${fmt0(b.deficit - real)} kcal deficitu – víc se dá jen pohybem.` : '.'}</div>
    <h3>Proč Robert nestrádá</h3>
    <div class="list lsteps">
      ${step('🎯', 'Tempo 0,5–1 % váhy týdně', `${String(rate).replace('.', ',')} %`, 'Pomalejší úbytek bere hlavně tuk. Rychlejší víc svalu, roste hlad a únava – to je skutečná cena „hladovění“.')}
      ${step('🥩', 'Bílkoviny', `${s.protein_min} g`, `Minimum za den, doporučeno ${pMin}–${pMax} g (1,6–2 g na kg cílové váhy). Hlavní ochrana svalu v deficitu.`)}
      ${step('🏋️', 'Silový trénink', 'v Tréninku', 'Dává tělu důvod sval držet. Bez něj jde část úbytku ze svalu i při dobrém tempu.')}
      ${step('⏸️', 'Přestávka v deficitu', 'po 6–10 t', 'Týden na úrovni výdeje sníží hlad, únavu a zpomalení metabolismu.')}
      ${step('🧱', 'Spodní hranice', fmt0(b.floor), `Limit nikdy neklesne pod 85 % klidového výdeje (${fmt0(b.bmr)}). U velké váhy je to bezpečně nad 1 500 kcal; víc než hranice chrání bílkoviny, trénink a tempo.`)}
    </div>
    <p class="small muted">Odhad výdeje má i u přesných vzorců chybu ±10 %. Proto rozhoduje skutečnost: trend vážení za 2–3 týdny ukáže, jestli deficit opravdu je. Když trend dlouhodobě zaostává a dny jsou potvrzené, je výdej nadhodnocený – appka navrhne nižší faktor.</p>`);
});
/* Nastavení plánu: hodnoty zadané jednou. Žije v obrazovce Nastavení (⚙︎), ne v Plánu. */
function profileCard() {
  const s = S(); const sb = stepsBaseFor(todayISO());
  const f = (k, l, help) => `<div class="field"><label class="f">${l}${help ? hq(help) : ''}</label><input type="text" inputmode="decimal" id="st_${k}" value="${String(s[k]).replace('.', ',')}" onchange="A.setSetting('${k}',this.value)"></div>`;
  return `<div class="card prof"><h3>👤 Robert</h3>
    <div class="pfgrid">${f('height', 'Výška cm')}${f('age', 'Věk')}<div class="field"><label class="f">Start</label><input type="date" id="st_start_date" value="${s.start_date}" onchange="A.setSetting('start_date',this.value)"></div>${f('start_weight', 'Start kg')}
      <div class="field"><label class="f">Běžný výdej${hq('faktor')}</label><div class="seg"><button class="${s.factor_lock ? '' : 'on'}" onclick="A.setFactorLock(false)" title="${sb != null ? `Ø ${fmt0(sb)} běžných kroků za 14 dní` : 'zatím málo kroků – platí faktor'}">z kroků</button><button class="${s.factor_lock ? 'on' : ''}" onclick="A.setFactorLock(true)">pevný</button></div></div>
      ${f('activity', s.factor_lock ? 'Faktor' : 'Faktor bez kroků', null)}${f('rest_sec', 'Pauza s', 'trPauza')}</div>
    <div class="small muted">${s.factor_lock ? `Limit počítá s pevným faktorem ${String(s.activity).replace('.', ',')}.` : sb != null ? `Běžný výdej z Robertova průměru ${fmt0(sb)} běžných kroků (14 dní) = faktor ≈ ${String(Math.round(limitToday(s).effFactor * 100) / 100).replace('.', ',')}.` : 'Dokud Robert nezapíše kroky aspoň 5 dní ze 14, platí faktor.'} Délka kroku ${String(Math.round(strideM() * 100) / 100).replace('.', ',')} m${strideM() !== 0.75 ? ' (z jeho km)' : ''}.</div></div>`;
}
A.profileSheet = () => go('ucet');
A.setFactorLock = on => commitSettings({ ...S(), factor_lock: !!on }, on ? 'Pohyb nastavený ručně' : 'Pohyb z Robertových kroků');
A.logSheet = () => { const s = S(); const log = (s.log || []).slice().reverse();
  UI.sheet('Historie změn', 'každá změna nastavení', log.length ? `<div class="list">${log.map(l => `<div class="li static"><span class="tm">${czDateShort(l.at)}</span><div class="tx"><b>${esc(l.pop)}</b><span>${l.k === 'walk_kmh' ? `${paceTxt(l.from)} → ${paceTxt(l.to)}` : `${esc(String(l.from).replace('.', ','))} → ${esc(String(l.to).replace('.', ','))}`}</span></div></div>`).join('')}</div>` : '<p class="muted">Zatím žádná změna.</p>'); };
A.maintWeek = m => { const s = S(); const mw = (s.maint_weeks || []).slice();
  const i = mw.indexOf(m); if (i >= 0) mw.splice(i, 1); else mw.push(m);
  Undo.run('Přestávka v deficitu', () => saveSettings({ ...s, maint_weeks: mw.sort() }), i >= 0 ? `Týden od ${czDateShort(m)} zase v deficitu.` : `Týden od ${czDateShort(m)} je přestávka – deficit nula, limit na celkovém výdeji.`); render(); };
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

/* ---------- HISTORIE ZMĚN (6. 10. 2026) ----------
   Každá akce trenéra s tím, co změnila, a tlačítkem Vrátit. Zdroj: histAdd v Undo.run. */
const HIST_KEYS = { ...SET_POP, plan_bases: 'nový výchozí bod plánu', steps_hist: 'kroky z Apple Health', courses: 'rozdělení jídla mezi chody', maint_weeks: 'přestávky v deficitu', start_date: 'start', start_weight: 'startovní váha' };
function histVal(k, v) { if (v == null || v === '') return '–'; if (/_date$/.test(k) && /^\d{4}-\d\d-\d\d$/.test(String(v))) return czDate(v); if (k === 'walk_kmh') return paceTxt(v) + ' /km'; if (k === 'maint_weeks') return v.length ? v.map(czDateShort).join(', ') : 'žádné'; if (k === 'plan_bases') return v.length ? v.map(b => `${czDateShort(b.date)} od ${fmt1(b.weight)} kg`).join(', ') : 'žádný'; if (k === 'steps_hist') return v.length ? v.map(h => `${czDateShort(h.from)}–${czDateShort(h.to)} Ø ${fmt0(h.avg)}`).join(', ') : 'žádné';
  if (typeof v === 'boolean') return v ? 'zapnuto' : 'vypnuto'; if (typeof v === 'object') return '…'; return String(v).replace('.', ','); }
function histDesc(c) {
  const a = (c.prev && !c.prev.deleted && c.prev.data) || null, b = (c.next && !c.next.deleted && c.next.data) || null;
  if (c.t === 'settings') { const out = [];
    const nz = v => v == null || (Array.isArray(v) && !v.length) ? null : v;
    Object.keys(HIST_KEYS).forEach(k => { const x = nz(a ? a[k] : undefined), y = nz(b ? b[k] : undefined); if (JSON.stringify(x) !== JSON.stringify(y)) out.push(`${HIST_KEYS[k]}: ${histVal(k, x)} → ${histVal(k, y)}`); });
    return out.length ? out : ['nastavení']; }
  if (c.t === 'training') { const parts = c.id.split(':'); const kind = parts[0], key = parts.slice(2).join(':');
    if (kind === 'to') return [`${b ? (a ? 'upraven' : 'naplánován') : 'zrušen'} den ${czDateShort(key)}${b ? ' · ' + trDaySummary(b).replace(/[🚶🏋️]\uFE0F?/gu, '').trim() : ''}`];
    if (kind === 'tp') { const d = b || a || {}; const dny = (d.days || []).map((x, i) => { const p = a && a.days ? a.days[i] : null; return JSON.stringify(p) !== JSON.stringify(x) ? DAY_SHORT[i] : null; }).filter(Boolean);
      return [`šablona týdne od ${d.active_from ? czDateShort(d.active_from) : '–'}${dny.length && a ? ' · změněno ' + dny.join(', ') : ''}`]; }
    const d = b || a || {}; return [`${b ? (a ? 'upraveno' : 'přidáno') : 'smazáno'}: ${esc(d.name || d.ex || 'trénink')}`]; }
  const d = b || a || {}; return [`${{ days: 'den', measurements: 'zápis váhy', week_plans: 'plán jídel' }[c.t] || c.t}${d.date ? ' ' + czDateShort(d.date) : ''}`];
}
VIEWS.historie = function () {
  const rows = histRows().slice(0, 150);
  const den = iso => { const d = iso.slice(0, 10); return d === todayISO() ? 'Dnes' : d === addDays(todayISO(), -1) ? 'Včera' : `${DAY_NAMES[dayIndex(d)]} ${czDateShort(d)}`; };
  let last = '';
  return `<div class="ph"><div class="pt"><h1>Historie změn</h1><span class="sub">co jsi změnil · každá změna jde vrátit</span></div></div>
  ${rows.length ? `<div class="card flush">${rows.map(r => { const h = r.data, dd = den(h.at); const head = dd !== last ? `<div class="lh">${dd}</div>` : ''; last = dd;
    const st = h.reverted ? '<span class="pill">vráceno</span>' : h.undone ? '<span class="pill">vráceno hned</span>' : `<button class="btn sec sm" onclick="A.histRevert('${r.id}')">Vrátit</button>`;
    return `${head}<div class="li static ${h.reverted || h.undone ? 'past' : ''}"><span class="tm">${h.at.slice(11, 16)}</span><div class="tx"><b>${esc(paceFix(h.label))}</b><span>${h.ch.flatMap(histDesc).slice(0, 4).map(x => esc(paceFix(x))).join(' · ')}</span></div>${st}</div>`; }).join('')}</div>`
    : `<div class="card"><p class="muted">Zatím žádná změna. Každá úprava plánu, tréninku nebo nastavení se tu objeví a půjde vrátit.</p></div>`}`;
};
A.histRevert = id => { const r = Store.db.prefs.find(x => x.id === id); if (!r) return; const h = r.data;
  const cur = c => { const x = Store.db[c.t].find(y => y.id === c.id); return x ? JSON.stringify({ d: x.deleted ? null : x.data }) : JSON.stringify({ d: null }); };
  const changed = h.ch.some(c => cur(c) !== JSON.stringify({ d: c.next && !c.next.deleted ? c.next.data : null }));
  UI.confirm(`Vrátit „${paceFix(h.label)}“ (${czDateShort(h.at.slice(0, 10))} ${h.at.slice(11, 16)})?${changed ? ' Od té doby se to změnilo znovu – vrácení přepíše i pozdější úpravu těchto dat.' : ''}`, () => {
    Undo.run('Vráceno: ' + h.label, () => h.ch.forEach(c => { if (c.prev && !c.prev.deleted) Store.put(c.t, c.id, c.prev.data, c.prev.user_id); else Store.remove(c.t, c.id); }), 'Vráceno: ' + paceFix(h.label));
    histMark(id, { reverted: new Date().toISOString() }); render(); }, 'Vrátit', !changed); };

/* ---------- PRŮBĚH: Cesta → Měsíc → Týden → Den (6. 10. 2026) ----------
   Shora celá cesta po měsících, pod ní měsíc po týdnech, týden po dnech a den v listu.
   Graf, souhrny i tabulka patří k vybranému období a cíle se přepočítají na ně –
   měsíc se porovnává s měsíčním cílem, ne s celou cestou. */
const MES3 = ['led', 'úno', 'bře', 'dub', 'kvě', 'čvn', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro'];
function drState() { if (!App.dr) App.dr = LS.get('dr', null) || { lvl: 'c' }; return App.dr; }
function drRange(dr) { const s = S(), t = todayISO();
  if (dr.lvl === 'm') { const d = monthDays(dr.start); return { from: dr.start, to: d[d.length - 1], lab: monthName(dr.start) }; }
  if (dr.lvl === 'w') return { from: dr.start, to: addDays(dr.start, 6), lab: `${czDateShort(dr.start)}–${czDateShort(addDays(dr.start, 6))}` };
  return { from: s.start_date, to: t, lab: 'Celá cesta' }; }
A.drGo = (lvl, start) => { App.dr = lvl === 'c' ? { lvl } : { lvl, start }; LS.set('dr', App.dr); render(); };
A.drMove = dir => { const d = drState(); if (d.lvl === 'm') A.drGo('m', addMonths(d.start, dir)); else if (d.lvl === 'w') A.drGo('w', addDays(d.start, 7 * dir)); };
/* Plánovaná váha den po dni od startu: tempo platné v ten den (přestávka = 0), nejníž cíl */
function planPath() { const s = S(); const k = [s.start_date, s.start_weight, s.goal_weight, s.rate_pct, (s.maint_weeks || []).join(), (s.log || []).length, s.maintain, JSON.stringify(s.plan_bases || [])].join('|');
  if (App._pp && App._pp.k === k) return App._pp.p;
  App._pp = { k, p: planPathFrom(s, s.plan_bases || []) }; return App._pp.p; }
/* Přeplánování (7. 10. 2026): settings.plan_bases = nové výchozí body {date, weight} – od toho dne
   plán začíná znovu z tehdejšího průměru. Plán se nedohání: bez toho by každý týden ztráty zůstal
   v „pozadu“ napořád a dohnat ho by šlo jen vyšším tempem. První plán (bez bodů) zůstává k porovnání. */
function planPathFrom(s, bases) { const B = Object.fromEntries((bases || []).map(b => [b.date, b.weight]));
  const p = [s.start_weight]; let w = s.start_weight;
  for (let i = 1; i <= 365 * 4; i++) { const d = addDays(s.start_date, i);
    if (d in B) w = B[d]; else { if (w <= s.goal_weight) { if (!Object.keys(B).some(x => x > d)) break; } w = Math.max(s.goal_weight, w * Math.pow(1 - effSettings(s, addDays(d, -1)).rate_pct / 100, 1 / 7)); }
    p.push(w); }
  return p; }
function planPathFirst() { const s = S(); if (!(s.plan_bases || []).length) return null; const k = [s.start_date, s.start_weight, s.goal_weight, (s.log || []).length, (s.maint_weeks || []).join()].join('|');
  if (App._pp0 && App._pp0.k === k) return App._pp0.p; App._pp0 = { k, p: planPathFrom(s, []) }; return App._pp0.p; }
function planAt(date) { const p = planPath(), i = daysBetween(S().start_date, date); return i < 0 ? S().start_weight : p[Math.min(i, p.length - 1)]; }
function planEnd() { return addDays(S().start_date, planPath().length - 1); }
/* váha za období: průměr 7 vážení na začátku a na konci proti plánu za stejné dny */
function drWeight(from, to) {
  const s = S(), t = todayISO(), end = to < t ? to : t; const rows = calcMeasurements(s, Meas());
  const before = rows.filter(r => r.date < from), inP = rows.filter(r => r.date >= from && r.date <= end);
  const a = before.length ? before[before.length - 1] : inP[0] || null, b = inP.length ? inP[inP.length - 1] : null;
  const w0 = a ? a.avg : currentWeight();
  const planBetween = (x, y) => { let k = 0; for (let d = x; d <= y; d = addDays(d, 1)) k += w0 * effSettings(s, d).rate_pct / 100 / 7; return k; };
  const real = a && b && b.date > a.date ? a.avg - b.avg : null;
  const plan = a && b && b.date > a.date ? planBetween(addDays(a.date, 1), b.date) : null;
  return { a, b, real, plan, planFull: planBetween(from < s.start_date ? s.start_date : from, to), diff: real != null ? real - plan : null, pct: real != null && plan > 0.05 ? Math.round(real / plan * 100) : null,
    lostEnd: b ? s.start_weight - b.avg : null, planLostEnd: b ? s.start_weight - planAt(b.date) : null };
}
const kgS = v => v == null ? '–' : (v > 0.005 ? '−' : v < -0.005 ? '+' : '') + fmt1(Math.abs(v)).replace('-', '');   // úbytek kladný = „−“
const dkg = v => v == null ? '' : `${v >= 0 ? '+' : '−'}${fmt1(Math.abs(v))} kg`;
/* rozdíl proti cíli slovy: kladný = náskok (shodil víc), záporný = chybí */
const dGap = (v, u) => v == null ? '' : Math.abs(v) < 0.05 ? 'přesně podle cíle' : v < 0 ? `chybí ${fmt1(-v)}${u || ' kg'}` : `náskok ${fmt1(v)}${u || ' kg'}`;
const dGap2 = (v, u) => v == null ? '' : Math.abs(v) < 0.005 ? 'přesně' : v < 0 ? `chybí ${fmt2(-v)}${u || ' kg'}` : `náskok ${fmt2(v)}${u || ' kg'}`;
function drillCard() {
  const s = S(), t = todayISO(), dr = drState(), r = drRange(dr);
  const crumb = [`<button class="${dr.lvl === 'c' ? 'on' : ''}" onclick="A.drGo('c')">Celá cesta</button>`];
  if (dr.lvl !== 'c') crumb.push(`<button class="${dr.lvl === 'm' ? 'on' : ''}" onclick="A.drGo('m','${monthStart(dr.start)}')">${monthName(monthStart(dr.start))}</button>`);
  if (dr.lvl === 'w') crumb.push(`<button class="on">${r.lab}</button>`);
  const nav = dr.lvl === 'c' ? '' : `<div class="row nowrap"><button class="btn ghost sm" onclick="A.drMove(-1)" aria-label="předchozí">‹</button><button class="btn ghost sm" onclick="A.drMove(1)" ${r.from > t ? 'disabled' : ''} aria-label="další">›</button></div>`;
  const lvlSeg = `<div class="seg sm">${[['c', 'Cesta'], ['m', 'Měsíc'], ['w', 'Týden']].map(([l, n]) => `<button class="${dr.lvl === l ? 'on' : ''}" onclick="A.drGo('${l}','${l === 'm' ? monthStart(dr.start || t) : mondayOf(dr.lvl === 'm' && dr.start.slice(0, 7) !== t.slice(0, 7) ? dr.start : t)}')">${n}</button>`).join('')}</div>`;
  return `<div class="card drill"><div class="drh"><div class="crumb">${crumb.join('<span>›</span>')}</div>${nav}<div class="sp"></div>${lvlSeg}</div>
    ${drChart(dr, r)}${drTiles(dr, r)}${drTable(dr, r)}</div>`;
}
/* podobdobí vybraného období: měsíce · týdny (oříznuté na měsíc) · dny */
function drKids(dr, r) { const s = S(), t = todayISO(), out = [];
  if (dr.lvl === 'c') { const endM = monthStart([planEnd(), goalForecast(s, calcOverview(s, Meas())).date || t, t].sort().pop()); let m = monthStart(s.start_date);
    for (let k = 0; k < 36 && m <= endM; k++, m = addMonths(m, 1)) { const d = monthDays(m); out.push({ from: m < s.start_date ? s.start_date : m, to: d[d.length - 1], lab: MES3[+m.slice(5, 7) - 1] + ' ' + m.slice(2, 4), full: monthName(m), go: `A.drGo('m','${m}')`, fut: m > t }); } }
  else if (dr.lvl === 'm') { const days = monthDays(r.from); for (let w = mondayOf(r.from); w <= r.to; w = addDays(w, 7)) { const a = w < r.from ? r.from : w, b = addDays(w, 6) > r.to ? r.to : addDays(w, 6);
      out.push({ from: a, to: b, lab: `${parseISO(a).getDate()}.–${czDateShort(b)}`, full: `týden ${czDateShort(a)}–${czDateShort(b)}`, go: `A.drGo('w','${w}')`, fut: a > t }); } }
  else for (let k = 0; k < 7; k++) { const d = addDays(r.from, k); out.push({ from: d, to: d, lab: `${DAY_SHORT[k]} ${parseISO(d).getDate()}.`, full: `${DAY_NAMES[k]} ${czDateShort(d)}`, go: `A.coachDaySheet('${d}')`, fut: d > t, day: true }); }
  return out; }
function drChart(dr, r) {
  const s = S(), t = todayISO(), kids = drKids(dr, r), rows = calcMeasurements(s, Meas());
  const pts = kids.map(k => { const end = k.to < t ? k.to : t; const inK = rows.filter(x => x.date >= k.from && x.date <= end);
    const last = inK[inK.length - 1]; const m = k.day ? Meas().find(x => x.date === k.from && x.weight != null) : null;
    return { ...k, real: last ? last.avg : null, raw: m ? m.weight : null, plan: planAt(k.to < s.start_date ? s.start_date : k.to) }; });
  const W = 900, H = 260, L = 44, R_ = 16, T = 18, B = 26; const n = pts.length, cw = (W - L - R_) / n;
  const ys = pts.flatMap(p => [p.real, p.raw, p.plan]).filter(v => v != null); if (dr.lvl === 'c') ys.push(s.goal_weight);
  if (!ys.length) return '<p class="muted small">Zatím žádné vážení.</p>';
  const y0 = Math.min(...ys) - 0.6, y1 = Math.max(...ys) + 0.6; const X = i => L + cw * (i + 0.5), Y = v => T + (y1 - v) / (y1 - y0) * (H - T - B);
  const lstep = Math.max(1, Math.ceil(n / 15));   // dlouhá cesta: popisek jen u každého n-tého měsíce
  let g = `<svg class="chart" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;
  const st = niceStep((y1 - y0) / 4); for (let v = Math.ceil(y0 / st) * st; v <= y1; v += st) g += `<line x1="${L}" x2="${W - R_}" y1="${Y(v)}" y2="${Y(v)}" stroke="#eef1f5"/><text x="${L - 6}" y="${Y(v) + 4}" font-size="11" fill="#7a878c" text-anchor="end">${fmtTick(v)}</text>`;
  pts.forEach((p, i) => { const cur = p.from <= t && t <= p.to;
    g += `<rect x="${L + cw * i + 2}" y="${T}" width="${cw - 4}" height="${H - T - B}" rx="8" fill="${cur ? 'rgba(37,99,235,.06)' : 'transparent'}" class="drcol" ${p.fut && !p.day ? '' : `onclick="${p.go}" style="cursor:pointer"`}/>
      ${cur || i % lstep === 0 ? `<text x="${X(i)}" y="${H - 8}" font-size="11.5" fill="${cur ? '#2563eb' : '#7a878c'}" font-weight="${cur ? 700 : 500}" text-anchor="middle">${p.lab}</text>` : ''}`; });
  if (dr.lvl === 'c' && s.goal_weight >= y0) g += `<line x1="${L}" x2="${W - R_}" y1="${Y(s.goal_weight)}" y2="${Y(s.goal_weight)}" stroke="#15803d" stroke-width="1.5" stroke-dasharray="4 4"/><text x="${L + 4}" y="${Y(s.goal_weight) - 6}" font-size="11.5" font-weight="700" fill="#15803d">cíl ${fmt1(s.goal_weight)} kg</text>`;
  const p0 = planPathFirst(); if (p0) { const at = d => { const i = daysBetween(s.start_date, d); return p0[Math.max(0, Math.min(i, p0.length - 1))]; };
    g += `<path d="M${pts.map((p, i) => `${X(i).toFixed(1)},${Y(at(p.to < s.start_date ? s.start_date : p.to)).toFixed(1)}`).join('L')}" fill="none" stroke="#c4b5fd" stroke-width="1.5" stroke-dasharray="2 4"/>`; }
  g += `<path d="M${pts.map((p, i) => `${X(i).toFixed(1)},${Y(p.plan).toFixed(1)}`).join('L')}" fill="none" stroke="#9aa3b8" stroke-width="1.8" stroke-dasharray="6 5"/>`;
  const rp = pts.map((p, i) => [i, p.real]).filter(x => x[1] != null);
  /* barva = plnění (7. 10. 2026): bod podle odchylky od plánové křivky (zelená do +0,5 kg nebo
     líp, oranžová do +1,5 kg, červená víc), úsek podle plnění cíle v tom období (≥ 90 % · ≥ 60 % · méně);
     plocha mezi skutečností a plánem je obarvená stejně jako úsek */
  const DC = { ok: '#16a34a', warn: '#d97706', bad: '#dc2626' };
  const devC = (v, pl) => v - pl <= 0.5 ? 'ok' : v - pl <= 1.5 ? 'warn' : 'bad';
  const segC = i => { const p = pts[i]; if (dr.lvl === 'w') return devC(p.real, p.plan); const W = drWeight(p.from, p.to); return W.pct == null ? devC(p.real, p.plan) : W.pct >= 90 ? 'ok' : W.pct >= 60 ? 'warn' : 'bad'; };
  for (let k = 1; k < rp.length; k++) { const [i0, v0] = rp[k - 1], [i1, v1] = rp[k]; const c = segC(i1);
    g += `<path d="M${X(i0)},${Y(v0)}L${X(i1)},${Y(v1)}L${X(i1)},${Y(pts[i1].plan)}L${X(i0)},${Y(pts[i0].plan)}Z" fill="${DC[c]}" fill-opacity=".09"/><line x1="${X(i0)}" y1="${Y(v0)}" x2="${X(i1)}" y2="${Y(v1)}" stroke="${DC[c]}" stroke-width="3.5" stroke-linecap="round"/>`; }
  g += rp.map(([i, v]) => { const c = DC[devC(v, pts[i].plan)]; return `<circle cx="${X(i)}" cy="${Y(v)}" r="5" fill="${c}" stroke="#fff" stroke-width="2"/>${cw > 60 ? `<text x="${X(i)}" y="${Y(v) - 10}" font-size="11.5" font-weight="700" fill="${c}" text-anchor="middle">${fmt1(v)}</text>` : ''}`; }).join('');
  if (dr.lvl === 'w') pts.forEach((p, i) => { if (p.raw != null) g += `<circle cx="${X(i)}" cy="${Y(p.raw)}" r="3" fill="#93c5fd"/>`; });
  // Cesta: pokračování trendu k cíli
  if (dr.lvl === 'c') { const fc = goalForecast(s, calcOverview(s, Meas())); const li = rp.length ? rp[rp.length - 1] : null;
    if (li && fc.date) { const fi = pts.findIndex(p => p.from <= fc.date && fc.date <= p.to); if (fi > li[0]) g += `<line x1="${X(li[0])}" y1="${Y(li[1])}" x2="${X(fi)}" y2="${Y(s.goal_weight)}" stroke="#d97706" stroke-width="2" stroke-dasharray="4 4"/><circle cx="${X(fi)}" cy="${Y(s.goal_weight)}" r="5" fill="#fff" stroke="#d97706" stroke-width="2.5"/><text x="${Math.min(X(fi), W - R_ - 50)}" y="${Y(s.goal_weight) - 12}" font-size="11" font-weight="700" fill="#d97706" text-anchor="middle">trend ${czDateShort(fc.date)}${String(parseISO(fc.date).getFullYear()).slice(2)}</text>`; } }
  const id = 'ct' + (++lineChart.n);
  lineChart.reg[id] = pts.map((p, i) => ({ sx: X(i), sy: Y(p.real != null ? p.real : p.plan), html: `<b>${esc(p.full)}</b><br>${p.real != null ? `<span class="w">${fmt1(p.real)} kg</span> průměr 7 vážení<br>` : ''}${p.real != null && !p.day ? (() => { const W = drWeight(p.from, p.to); return W.pct != null ? `za období ${kgS(W.real)} kg z cíle ${kgS(W.plan)} · <b>plní na ${W.pct} %</b><br>` : ''; })() : ''}${p.raw != null ? `ráno ${fmt1(p.raw)} kg<br>` : ''}plán ${fmt1(p.plan)} kg${p.real != null ? ` · <b>${dkg(p.real - p.plan)}</b>` : ''}${p.fut && !p.day ? '' : '<br><span class="muted">ťukni pro detail</span>'}` }));
  g += `<g class="tipg" style="display:none"><line y1="${T}" y2="${H - B}" stroke="#2563eb" stroke-width="1" stroke-dasharray="2 3"/><circle r="5.5" fill="#fff" stroke="#2563eb" stroke-width="2.5"/></g></svg>`;
  /* jedna věta nad grafem a legenda, která pojmenuje čáry; význam barev zvlášť (8. 10. 2026 – dřív legenda míchala čáry a barvy) */
  const lastR = pts.filter(p => p.real != null).pop();
  const verdikt = lastR ? (() => { const gap = lastR.plan - lastR.real; const c = devC(lastR.real, lastR.plan);
    return `<div class="dverd ${c}"><b>${dr.lvl === 'w' ? `${DAY_NAMES[dayIndex(lastR.from)]} ${czDateShort(lastR.from)}` : esc(lastR.full)}: skutečnost ${fmt1(lastR.real)} kg, plán ${fmt1(lastR.plan)} kg</b> – ${Math.abs(gap) < 0.25 ? 'přesně podle plánu' : gap < 0 ? `chybí ${fmt1(-gap)} kg` : `náskok ${fmt1(gap)} kg`}.</div>`; })() : '';
  return `${verdikt}<div class="legend kleg"><span><i class="lsk"></i>skutečnost – průměr 7 vážení${hq('dSkut')}</span>${dr.lvl === 'w' ? '<span><i class="ldot"></i>váha na váze ráno</span>' : ''}<span><i class="lpl"></i>plán</span>${planPathFirst() ? '<span><i style="background:#c4b5fd"></i>první plán</span>' : ''}${dr.lvl === 'c' ? '<span><i class="ltr"></i>kam to vede (trend)</span>' : ''}</div><div class="chartw" data-tip="${id}">${g}<div class="ctip" hidden></div></div>
    <div class="lbar">Barva skutečnosti: <span class="ok">zelená = podle plánu nebo líp</span> · <span class="warn">oranžová = do 1,5 kg pozadu</span> · <span class="bad">červená = víc pozadu</span></div>`;
}
/* souhrn období ve skupinách, vždy proti cíli přepočtenému na období */
function drTiles(dr, r) {
  const s = S(), t = todayISO(), R = periodStats(r.from, r.to); if (R.empty) return `<p class="muted small">Období je před startem nebo v budoucnu – je v něm jen plán: ${kgS(drWeight(r.from, r.to).planFull)} kg.</p>`;
  const Wt = drWeight(r.from, r.to); const tr = trend21(); const ov = calcOverview(s, Meas());
  const cl = (ok, warn) => ok ? 'ok' : warn ? 'warn' : 'bad';
  const m = (lab, big, sub, c, help) => `<div class="dm"><span>${lab}${help ? hq(help) : ''}</span><b class="${c || ''}">${big}</b>${sub ? `<em>${sub}</em>` : ''}</div>`;
  const per = dr.lvl === 'c' ? 'od startu' : dr.lvl === 'm' ? 'za měsíc' : 'za týden';
  const vys = [
    m(`Váha ${per}`, Wt.real != null ? `${kgS(Wt.real)} kg` : '–', `cíl ${kgS(Wt.plan != null ? Wt.plan : Wt.planFull)} kg${Wt.diff != null ? ` · <b>${dGap(Wt.diff)}</b>` : ''}${Wt.pct != null ? ` · plní na ${Wt.pct} %` : ''}`, Wt.pct == null ? '' : cl(Wt.pct >= 90, Wt.pct >= 60), 'dVaha'),
    Wt.b ? m(`K ${czDateShort(Wt.b.date)} od startu`, `${kgS(Wt.lostEnd)} kg`, `měl ${kgS(Wt.planLostEnd)} kg · <b>${dGap(Wt.lostEnd - Wt.planLostEnd)}</b>`, cl(Wt.lostEnd >= Wt.planLostEnd - 0.3, Wt.lostEnd >= Wt.planLostEnd - 1.5), 'dKDnesku') : '',
    dr.lvl === 'c' ? m('Tempo · trend 3 týdnů', tr ? `${kgTyd(tr.perWeek)} kg/t` : '–', tr ? `plán −${fmt2(ov.cur * effSettings(s, t).rate_pct / 100)} · <b>${dGap2(tr.perWeek - ov.cur * effSettings(s, t).rate_pct / 100, ' kg/týden')}</b>` : 'málo vážení', tr ? cl(tr.perWeek >= ov.cur * effSettings(s, t).rate_pct / 100 * 0.9, tr.perWeek > 0) : '', 'pTempo') : '',
    dr.lvl === 'c' ? (() => { const gp = planGoalDate(s), fc = goalForecast(s, ov), d = gp && fc.date ? ymd(gp, fc.date) : null; return m(`Cíl ${fmt1(s.goal_weight)} kg`, fc.date ? czDate(fc.date) : esc(fc.text), `plán ${gp ? czDate(gp) : '–'}${d ? ` · <b>${d.sign > 0 ? '+' : '−'}${d.short}</b>` : ''}`, d ? cl(d.sign <= 0 || daysBetween(gp, fc.date) <= 7, daysBetween(gp, fc.date) <= 30) : '', 'pCil'); })() : '',
    R.waist != null ? m('Pas', `${fmt1(R.waist)} cm`, R.waistDelta != null ? `${signed1(R.waistDelta)} cm ${per}` : `cíl ${s.goal_waist} cm`, R.waistDelta != null ? cl(R.waistDelta < 0, R.waistDelta <= 0.5) : '') : ''];
  const jid = [
    m('Dny v limitu', `${R.inLimit}<small>/${R.conf}</small>`, `potvrzených ${R.conf} z ${R.n}`, R.conf ? cl(R.inLimit >= R.conf * 0.85, R.inLimit >= R.conf * 0.6) : 'bad'),
    m('Deficit', R.conf ? `${fmt0(R.def)} kcal` : '–', R.conf ? `plán ${fmt0(R.defPlan)} · ≈ ${fmt2(R.def / KG_KCAL)} z ${fmt2(R.defPlan / KG_KCAL)} kg` : 'jen z potvrzených dnů', R.conf ? cl(R.def >= R.defPlan * 0.9, R.def >= R.defPlan * 0.6) : '', 'dDeficit'),
    m('Příjem Ø', R.conf ? `${fmt0(R.intake / R.conf)} kcal` : '–', R.conf ? `limit Ø ${fmt0(R.lim / R.conf)} · ${signed0((R.intake - R.lim) / R.conf)}/den` : '', R.conf ? cl(R.intake <= R.lim + 50 * R.conf, R.intake <= R.lim + 200 * R.conf) : ''),
    m('Bílkoviny', `${R.protOk}<small>/${R.conf}</small>`, 'dnů s cílem bílkovin', R.conf ? cl(R.protOk >= R.conf * 0.8, R.protOk >= R.conf * 0.5) : ''),
    R.cheat ? m('Cheaty', `${fmt0(R.cheat)} kcal`, `≈ ${fmt2(R.cheat / KG_KCAL)} kg`, '') : ''];
  const poh = [
    m('Chůze', R.walkPlan ? `${Math.round(R.walk / R.walkPlan * 100)} %` : '–', `${fmt0(R.walk)} z ${fmt0(R.walkPlan)} min`, R.walkPlan ? cl(R.walk >= R.walkPlan * 0.9, R.walk >= R.walkPlan * 0.6) : ''),
    m('Kroky Ø', R.stepsAvg != null ? fmt0(R.stepsAvg) : '–', `běžné · cíl ${fmt0(stepsTarget(s))}`, R.stepsAvg != null ? cl(R.stepsAvg >= stepsTarget(s) * 0.9, R.stepsAvg >= stepsTarget(s) * 0.6) : ''),
    m('Trénink', R.trPlan ? `${R.trDone}<small>/${R.trPlan}</small>` : '–', R.trPlan ? 'odcvičeno z plánovaných' : 'žádný v plánu', R.trPlan ? cl(R.trDone >= R.trPlan * 0.8, R.trDone >= R.trPlan * 0.5) : '')];
  const zap = [
    m('Potvrzené dny', `${R.conf}<small>/${R.n}</small>`, '', cl(R.conf >= R.n * 0.85, R.conf >= R.n * 0.5)),
    m('Vážení', `${R.weigh}<small>/${R.wDays}</small>`, '', cl(R.weigh >= R.wDays * 0.85, R.weigh >= R.wDays * 0.5)),
    m('Kroky zapsané', `${R.stepsN}<small>/${R.n}</small>`, '', cl(R.stepsN >= R.n * 0.85, R.stepsN >= R.n * 0.5))];
  const pc = pocitSouhrn(r.from, r.to);
  const grp = (ic, n, list) => `<div class="dg"><h4>${ico(ic)} ${n}</h4>${list.filter(Boolean).join('')}</div>`;
  return `<div class="dgrid">${grp('target', 'Výsledek', vys)}${grp('fork', 'Jídlo', jid)}${grp('walk', 'Pohyb', poh)}${grp('clip', 'Zapisování', zap)}${grp('moon', 'Jak se cítí', [m('Hlášení', esc(pc), '', 'txt ' + (pc === 'v pořádku' ? 'ok' : pc === 'nevyplnil' ? '' : 'warn'))])}</div>`;
}
/* tabulka podobdobí – řádek = měsíc / týden / den, klik jde hlouběji */
function drTable(dr, r) {
  const s = S(), t = todayISO(); const kids = drKids(dr, r).filter(k => k.from <= t);
  if (!kids.length) return '';
  const c = (v, ok, warn) => v == null ? '' : ok ? 'ok' : warn ? 'warn' : 'bad';
  const head = dr.lvl === 'w' ? ['Den', 'Váha ráno', 'Skutečnost Ø 7', 'Plán', 'Příjem / limit', 'Deficit', 'Chůze', 'Kroky', 'Trénink', 'Den']
    : [dr.lvl === 'c' ? 'Měsíc' : 'Týden', 'Skutečnost Ø 7', 'Změna', 'Cíl', 'Rozdíl', 'V limitu', 'Deficit ≈ kg', 'Chůze', 'Kroky Ø', 'Trénink', 'Zápisy'];
  const body = kids.slice().reverse().map(k => {
    if (k.day) { const ev = evaluateDay(k.from), B = ev.d.base, day = ev.day, mm = Meas().find(x => x.date === k.from && x.weight != null), row = calcMeasurements(s, Meas()).filter(x => x.date <= k.from).pop();
      const bk = daySteps(day), wk = day.walk_min || 0, pd = planAt(k.from);
      return `<tr onclick="${k.go}"><td class="b">${k.lab}</td><td class="n">${mm ? fmt1(mm.weight) : '–'}</td><td class="n">${row ? fmt1(row.avg) : '–'}</td><td class="n muted">${fmt1(pd)}</td>
        <td class="n ${ev.confirmed ? c(1, !ev.cheats.over) : ''}">${ev.confirmed ? `${fmt0(ev.d.intake)} / ${fmt0(B.maxIntake)}` : `<span class="muted">${k.from === t ? 'dnes' : 'nepotvrzený'}</span>`}</td>
        <td class="n">${ev.confirmed ? fmt0(B.totalOut - ev.d.intake) : '–'}</td><td class="n ${c(B.planWalk ? 1 : null, wk >= B.planWalk - 5, wk >= B.planWalk * 0.5)}">${wk} / ${B.planWalk}</td>
        <td class="n ${c(bk, bk >= stepsTarget(s) * 0.9, bk >= stepsTarget(s) * 0.6)}">${bk == null ? '–' : fmt0(bk)}</td><td class="n">${B.planKcal > 0 ? (B.doneKcal >= B.planKcal * 0.5 ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>') : '–'}</td>
        <td>${ev.confirmed ? (ev.ok ? '<span class="pill ok">sedí</span>' : '<span class="pill warn">ujelo</span>') : '<span class="pill">–</span>'}</td></tr>`; }
    const R = periodStats(k.from, k.to), W = drWeight(k.from, k.to);
    return `<tr onclick="${k.go}"><td class="b">${esc(k.full)}</td><td class="n">${W.b ? fmt1(W.b.avg) : '–'}</td><td class="n">${W.real != null ? kgS(W.real) : '–'}</td><td class="n muted">${kgS(W.plan != null ? W.plan : W.planFull)}</td>
      <td class="n ${c(W.diff, W.diff >= -0.2, W.diff >= -0.8)}">${W.diff != null ? dGap(W.diff) : '–'}</td>
      <td class="n ${R.empty ? '' : c(R.conf ? 1 : null, R.inLimit >= R.conf * 0.85, R.inLimit >= R.conf * 0.6)}">${R.empty ? '–' : `${R.inLimit}/${R.conf}`}</td>
      <td class="n ${R.empty || !R.conf ? '' : c(1, R.def >= R.defPlan * 0.9, R.def >= R.defPlan * 0.6)}">${R.empty || !R.conf ? '–' : `${fmt2(R.def / KG_KCAL)} / ${fmt2(R.defPlan / KG_KCAL)}`}</td>
      <td class="n ${R.empty || !R.walkPlan ? '' : c(1, R.walk >= R.walkPlan * 0.9, R.walk >= R.walkPlan * 0.6)}">${R.empty || !R.walkPlan ? '–' : Math.round(R.walk / R.walkPlan * 100) + ' %'}</td>
      <td class="n">${R.empty || R.stepsAvg == null ? '–' : fmt0(R.stepsAvg)}</td><td class="n">${R.empty || !R.trPlan ? '–' : `${R.trDone}/${R.trPlan}`}</td>
      <td class="n ${R.empty ? '' : c(1, R.conf >= R.n * 0.85, R.conf >= R.n * 0.5)}">${R.empty ? '–' : `${R.conf}/${R.n}`}</td></tr>`; }).join('');
  return `<div class="tbl drt"><table class="small"><tr>${head.map((h, i) => `<th class="${i ? 'n' : ''}">${h}</th>`).join('')}</tr>${body}</table></div>`;
}

/* ---------- Rozbor cíle: dosažitelnost a co změnit (6. 10. 2026) ---------- */
A.goalCheckSheet = () => openSheet(() => {
  const s = S(), g = goalCheck(); if (!g) return UI.sheetHtml('Rozbor cíle', '', '<p class="muted">Na rozbor je potřeba aspoň 5 vážení za poslední 3 týdny.</p>');
  const T = g.target, dd = d => d ? `${czDate(d)}` : 'nedosáhne', vsT = d => { if (!d) return '<span class="bad">nedosáhne</span>'; const x = ymd(T, d); return daysBetween(T, d) <= 7 ? '<span class="ok">stihne</span>' : `<span class="${daysBetween(T, d) > 60 ? 'bad' : 'warn'}">+${x.short}</span>`; };
  const rp = v => String(v).replace('.', ',') + ' %';
  const sc = [
    [`Teď nastaveno: ${rp(s.rate_pct)}, bez přestávek, plní 100 %`, g.dCur],
    [`Teď nastaveno, plní jako poslední 3 týdny (${Math.round(g.adh * 100)} %)`, g.dCurAdh],
    [`<b>${g.hasDate && g.req != null ? 'Doporučeno' : 'Bezpečné maximum'}: ${rp(g.recRate)} + přestávka po 8 týdnech, plní 100 %</b>`, g.dRec],
    [`${g.hasDate && g.req != null ? 'Doporučeno' : 'Maximum'}, plní 80 %`, g.dRec80],
    [`Trend posledních 3 týdnů beze změny`, g.dTrend]];
  const blind = g.R.conf < g.R.n * 0.5;
  const nej = simGoal(1, 1, true, g.w, todayISO());
  const verdict = !g.hasDate ? `<div class="alert col a2"><div><b>Termín cíle není zadaný</b> – níž se porovnává s datem z plánu (${czDate(T)}). Zadej termín, do kdy má Robert cíle dosáhnout: appka spočítá nejnižší tempo, které na něj stačí. Nejdřív to jde ${dd(nej)} (1 % s přestávkami, plnění 100 %).</div><input type="date" class="dinp" min="${addDays(todayISO(), 1)}" onchange="A.setGoalDate(this.value);UI.closeModal();A.goalCheckSheet()"></div>`
    : g.req == null ? `<div class="alert col a1"><div><b>Termín ${czDate(T)} je nereálný.</b> Ani tempo 1 % (bezpečné maximum) s přestávkami ho nestihne. Nejdřív to jde ${dd(nej)} – posuň termín.</div><input type="date" class="dinp" value="${T}" min="${addDays(todayISO(), 1)}" onchange="A.setGoalDate(this.value);UI.closeModal();A.goalCheckSheet()"></div>`
    : `<div class="alert ${g.adh >= 0.8 ? 'a3' : 'a2'}"><div><b>Cíl ${fmt1(s.goal_weight)} kg do ${czDate(T)} je dosažitelný</b> – stačí tempo ${rp(g.req)} s přestávkami (deficit ~${fmt0(g.w * g.req / 100 * KG_KCAL / 7)} kcal/den, limit nad spodní hranicí). ${g.adh < 0.8 ? `Problém není plán, ale plnění: posledních 3 týdnů Robert splnil ${Math.round(g.adh * 100)} % plánovaného úbytku.` : 'Robert plán plní.'}</div></div>`;
  const steps = [];
  if (blind || g.R.stepsN < g.R.n * 0.5) steps.push(`<li><b>Nejdřív zápisy – 14 dní bez výjimky.</b> Za 3 týdny ${g.R.conf} z ${g.R.n} dnů potvrzených a ${g.R.stepsN}× kroky. Bez toho appka nepozná, jestli chybějících ~${fmt0(g.gapKcal)} kcal denně je jídlo navíc, nebo málo pohybu – a každá změna plánu je naslepo. Domluv to s Robertem: večer potvrdit den a zapsat kroky.</li>`);
  if (g.hasDate && g.req != null && Math.abs(g.recRate - s.rate_pct) >= 0.05) steps.push(`<li><b>Tempo ${rp(g.recRate)} místo ${rp(s.rate_pct)}.</b> ${g.recRate < s.rate_pct ? `Na termín stačí. Vyšší tempo = menší limit a víc hladu – když teď plní ${Math.round(g.adh * 100)} %, přitažení šroubů plnění spíš sníží.` : 'Současné tempo termín nestihne.'} <button class="btn sm" onclick="UI.closeModal();A.applyAdvice(JSON.stringify({rate_pct:${g.recRate}}))">Nastavit ${rp(g.recRate)}</button></li>`);
  const mwFut = (s.maint_weeks || []).filter(m => m >= todayISO()).length;
  if (!mwFut) steps.push(`<li><b>Přestávka v deficitu po každých 8 týdnech.</b> Týden na nule sníží hlad a únavu a plán se dá vydržet do cíle. V simulaci už je započítaná. <button class="btn sm sec" onclick="UI.closeModal();A.planBreaks()">Naplánovat přestávky</button></li>`);
  if (g.factorRisk > 0) steps.push(`<li><b>Výdej je odhad, kroky ho neověřily.</b> Faktor ${String(s.activity).replace('.', ',')} počítá s ~5 000 běžnými kroky denně. Kdyby Robert většinu dne seděl, limit je o ~${fmt0(g.factorRisk)} kcal vyšší, než má být – to samo vysvětlí ${Math.min(100, Math.round(g.factorRisk / Math.max(1, g.gapKcal) * 100))} % rozdílu. Až zapíše kroky, appka výdej spočítá z nich sama.</li>`);
  steps.push(`<li><b>Za 2 týdny zkontroluj znovu.</b> S potvrzenými dny ukáže Průběh přesně, kde rozdíl vzniká (jídlo, chůze, kroky), a Co řešit nabídne konkrétní úpravu.</li>`);
  return UI.sheetHtml('Rozbor cíle', `cíl ${fmt1(s.goal_weight)} kg · termín ${czDate(T)}${s.goal_date ? '' : ' (podle plánu)'}`,
    `<div class="stats3"><div><b class="${g.adh >= 0.8 ? 'ok' : 'bad'}">−${fmt2(g.tr.perWeek)}</b><span>kg/týden · trend 3 týdnů</span></div><div><b>−${fmt2(g.planWk)}</b><span>kg/týden · plán za ty dny</span></div><div><b class="${g.adh >= 0.8 ? 'ok' : 'bad'}">${Math.round(g.adh * 100)} %</b><span>plnění · chybí ~${fmt0(g.gapKcal)} kcal/den</span></div></div>
    ${verdict}
    ${g.energy ? (() => { const E = g.energy, okP = E.steps >= E.stepsPlan * 0.95, okJ = E.over <= 150;
      return `<h3>Kde je potíž</h3><div class="list">
        <div class="li static"><span class="em">${ico('walk')}</span><div class="tx"><b>Pohyb: ${fmt0(E.steps)} kroků denně</b><span>plán ${fmt0(E.stepsPlan)} (chůze + běžné kroky) · zdroj ${esc(E.src)} · výdej ~${fmt0(E.out)} kcal</span></div><span class="val ${okP ? 'ok' : 'bad'}">${okP ? '✓' : Math.round(E.steps / E.stepsPlan * 100) + ' %'}</span></div>
        <div class="li static"><span class="em">${ico('fork')}</span><div class="tx"><b>Jídlo: ~${fmt0(E.intake)} kcal denně</b><span>limit ${fmt0(E.limit)} · odhad = výdej ${fmt0(E.out)} − skutečný deficit ${fmt0(E.realDef)} (úbytek ${fmt2(g.tr.perWeek)} kg/týden)</span></div><span class="val ${okJ ? 'ok' : 'bad'}">${okJ ? '✓' : '+' + fmt0(E.over)}</span></div>
        ${E.sit && E.sit.n ? `<div class="li static"><span class="em">${ico('cal')}</span><div class="tx"><b>Jídla „podle situace“: ${E.sit.sit} z ${E.sit.n}</b><span>${E.sit.unk ? `${E.sit.unk} bez odhadu – appka za ně počítá cíl chodu; při jídle venku (+50 %) ~${fmt0(E.sit.targetKcal * 0.5 / Math.max(1, daysBetween(g.R.from, g.R.to)))} kcal/den, které nejsou vidět` : 'všechna odhadnutá nebo zapsaná'}</span></div><span class="val ${E.sit.unk / Math.max(1, E.sit.n) >= 0.15 ? 'bad' : 'ok'}">${Math.round(E.sit.sit / Math.max(1, E.sit.n) * 100)} %</span></div>` : ''}
        </div>
        <div class="alert ${okJ ? 'a3' : 'a1'}"><div>${okJ ? 'Bilance sedí – příjem odpovídá limitu. Rozdíl v úbytku je voda nebo výkyv, počkej týden.' : `<b>Potíž je jídlo, ne pohyb.</b> Robert se hýbe ${okP ? 'dokonce víc, než má' : 'méně, než má, ale to vysvětlí jen část'} – a přesto mu chybí ~${fmt0(g.gapKcal)} kcal deficitu. Odhadem jí o ~${fmt0(E.over)} kcal denně víc, než má limit (to je zhruba ${E.over > 700 ? 'jedno hlavní jídlo' : E.over > 350 ? 'svačina nebo dvě piva' : 'jedna sladkost'} navíc každý den). Nižší tempo ani víc chůze to nevyřeší – je potřeba vidět, co jí: potvrzené dny ukážou, který chod nebo cheat to je.`}</div></div>`; })() : ''}
    <h3>Kdy dosáhne cíle</h3><div class="tbl"><table class="small"><tr><th>Varianta</th><th class="n">Cíl</th><th class="n">Proti termínu</th></tr>${sc.map(([l, d]) => `<tr><td>${l}</td><td class="n">${dd(d)}</td><td class="n">${vsT(d)}</td></tr>`).join('')}</table></div>
    <h3>Co změnit a proč</h3><ol class="gcl">${steps.join('')}</ol>
    <p class="hint">Simulace týden po týdnu od dnešního průměru ${fmt1(g.w)} kg: deficit = tempo × váha, nejvýš do spodní hranice jídla (85 % klidového výdeje); přestávka = týden na nule. Plnění = skutečný úbytek ÷ plánovaný za stejné dny.</p>`);
});
/* přestávky po každých 8 týdnech deficitu od poslední (nebo od startu) až k termínu */
A.planBreaks = () => { const s = S(), t = todayISO(), g = goalCheck(); const end = g && g.dRec ? g.dRec : addDays(t, 365);
  const mw = (s.maint_weeks || []).slice().sort(); const lastBr = mw.filter(m => m <= t).pop(); const last = lastBr ? addDays(lastBr, 7) : mondayOf(s.start_date); const add = [];
  const first = mondayOf(addDays(t, 7));   // nejdřív příští týden
  for (let blok = last; ;) { let br = addDays(blok, 7 * 8); if (br < first) br = first; if (br > end) break; if (!mw.includes(br)) add.push(br); blok = addDays(br, 7); }
  if (!add.length) { UI.toast('Přestávky už jsou naplánované.'); return; }
  UI.closeModal(); previewChange({ ...s, maint_weeks: mw.concat(add).sort() }, `Přestávky v deficitu: ${add.map(czDateShort).join(', ')}`, `${add.length} ${sklon(add.length, 'přestávka naplánována', 'přestávky naplánovány', 'přestávek naplánováno')}.`); };
A.setGoalDate = v => { if (v && v <= todayISO()) { UI.toast('Termín cíle musí být v budoucnu.'); render(); return; } commitSettings({ ...S(), goal_date: v || null }, v ? 'Termín cíle' : 'Termín cíle zrušen', v ? `Termín cíle ${czDate(v)}.` : 'Termín se bere z plánu.'); };

/* průměry kroků z Apple Health za období */
A.stepsHistSheet = () => openSheet(() => { const s = S(), L = (s.steps_hist || []).slice().sort((a, b) => b.from.localeCompare(a.from)); const t = todayISO();
  return UI.sheetHtml('Kroky z Apple Health', 'denní průměr za období · Health → Kroky → M / 6 M',
    `${L.length ? `<div class="list">${L.map(h => { const x = stepsHistFor(addDays(h.to, 1)) || {}; return `<div class="li static"><div class="tx"><b>${czDateShort(h.from)}–${czDate(h.to)} · Ø ${fmt0(h.avg)} kroků</b><span>${h.walk === 'plan' ? `včetně plánované chůze (−${fmt0(x.walkSteps || histWalkSteps(h))}) → běžné ${fmt0(h.avg - (x.walkSteps || histWalkSteps(h)))}` : 'bez plánované chůze'}</span></div><button class="xbtn sm" onclick="A.stepsHistDel('${h.from}','${h.to}')" aria-label="smazat">×</button></div>`; }).join('')}</div>` : '<p class="muted small">Zatím nic. Zadej průměr kroků z Health za týden, měsíc nebo delší období.</p>'}
     <div class="grid g2"><div class="field"><label class="f">Od</label><input type="date" id="sh_from" class="dinp" max="${t}"></div><div class="field"><label class="f">Do</label><input type="date" id="sh_to" class="dinp" max="${t}"></div></div>
     <div class="field"><label class="f">Denní průměr kroků</label><input type="text" inputmode="numeric" id="sh_avg" placeholder="např. 14170"></div>
     <div class="field"><label class="f">Obsahuje plánovanou chůzi?</label><select id="sh_walk"><option value="plan">Ano – odečti plán chůze (od startu plánu)</option><option value="none">Ne – před startem nebo bez chůze</option></select></div>`,
    `<button class="btn" onclick="A.stepsHistAdd()">Přidat</button>`); });
A.stepsHistAdd = () => { const f = $('#sh_from').value, to = $('#sh_to').value, r = omez($('#sh_avg').value, 0, 60000), wk = $('#sh_walk').value;
  if (!f || !to || f > to) { UI.toast('Vyplň období od–do.'); return; } if (r.n == null || r.n < 100) { UI.toast('Vyplň denní průměr kroků.'); return; }
  const s = S(); const L = (s.steps_hist || []).filter(h => h.to < f || h.from > to);   // překrývající se období nahradit
  commitSettings({ ...s, steps_hist: L.concat([{ from: f, to, avg: Math.round(r.n), walk: wk, src: 'Apple Health' }]).sort((a, b) => a.from.localeCompare(b.from)) }, 'Kroky z Apple Health', `Ø ${fmt0(r.n)} kroků za ${czDateShort(f)}–${czDateShort(to)} – výdej se přepočítal.`);
  App._sbc = null; UI.closeModal(); A.stepsHistSheet(); };
A.stepsHistDel = (f, to) => UI.confirm(`Smazat průměr kroků ${czDateShort(f)}–${czDateShort(to)}?`, () => { const s = S(); commitSettings({ ...s, steps_hist: (s.steps_hist || []).filter(h => !(h.from === f && h.to === to)) }, 'Kroky z Health smazány'); App._sbc = null; UI.closeModal(); A.stepsHistSheet(); }, 'Smazat');

/* ---------- Přeplánovat (7. 10. 2026): termín drží, posun jen jako poslední možnost ---------- */
A.replanSheet = () => openSheet(() => {
  const s = S(), r = replanCheck(), t = todayISO(), rp = v => String(v).replace('.', ',') + ' %';
  if (!r) return UI.sheetHtml('Přeplánovat', '', '<p class="muted">Robert plní plán (posledních 4 týdnů aspoň na 70 %) – není co přeplánovat.</p>');
  const why = diagnoza().list.filter(x => !['preplan', 'cilcheck'].includes(x.key)).slice(0, 3);
  const pricina = r.sit === 1
    ? `<li><b>Zápisy – 14 dní bez výjimky.</b> Za 4 týdny ${r.conf} z ${r.len} dnů potvrzených. Bez nich nejde poznat, jestli brzdí jídlo, nebo výdej, a každá změna plánu je naslepo.</li>`
    : r.sit === 2 ? `<li><b>Výdej podle skutečnosti.</b> Robert zapisuje a drží limit (Ø příjem ${fmt0(r.intake)} kcal, limit ${fmt0(r.limit)}), a přesto hubne ${fmt2(r.tr.perWeek)} kg/týden. Z příjmu a úbytku vychází skutečný výdej ~${fmt0(r.realOut)} kcal, vzorec počítá ${fmt0(r.model)}. Tělo pálí o ~${fmt0(-r.corr)} kcal méně – o tolik snížím limit, termín zůstane. <button class="btn sm" onclick="UI.closeModal();A.applyOutAdj(${r.corr})">Opravit výdej o ${r.corr > 0 ? '+' : ''}${fmt0(r.corr)} kcal</button></li>`
    : `<li><b>Limit nedrží: ~${fmt0(r.intake - r.limit)} kcal denně navíc.</b> To je příčina, plán za ni nemůže. ${why.length ? 'Co to dělá:' : ''}<ul>${why.map(x => `<li>${esc(x.title)}${x.apply ? ` <button class="btn sm sec" onclick="UI.closeModal();${x.apply}">${esc(x.label)}</button>` : x.go ? ` <button class="btn sm ghost" onclick="UI.closeModal();${x.go}">${esc(x.label || 'Otevřít')}</button>` : ''}</li>`).join('')}</ul></li>`;
  const plan = r.req != null
    ? `<li><b>Plán od dneška, termín ${czDate(r.termin)} drží.</b> Plánová křivka začne od dnešního průměru ${fmt1(r.w)} kg (staré „pozadu“ se nepřenáší) a tempo ${rp(r.req)} ${r.brk ? 's přestávkou po 8 týdnech' : '<b>bez přestávek</b> (náročnější – s přestávkami by termín nestihl)'} ztrátu dožene. Limit ${fmt0(r.limitNow)} → <b>${fmt0(r.limitReq)} kcal</b>${r.req > s.rate_pct ? ' – deficit se zvětší, proto napřed oprav příčinu, jinak to Robert nevydrží' : ''}. <button class="btn sm" onclick="A.replanApply(${r.req})">Přeplánovat od dneška</button></li>`
    : `<li><b>Termín ${czDate(r.termin)} už bezpečně stihnout nejde</b> – potřeboval by víc než 1 % váhy týdně. Nejdřív to jde ${r.nej ? czDate(r.nej) : '–'} (1 % s přestávkami, plnění 100 %). Posun termínu je až poslední možnost${r.posuny ? ` – termín už byl posunutý ${r.posuny}×` : ''}. <button class="btn sm danger" onclick="A.replanMove('${r.nej || ''}')">Posunout termín na ${r.nej ? czDateShort(r.nej) + String(parseISO(r.nej).getFullYear()).slice(2) : '–'}</button></li>`;
  return UI.sheetHtml('Přeplánovat', `4 týdny pod 70 % plánu · termín ${czDate(r.termin)}${s.goal_date ? '' : ' (z prvního plánu)'}`,
    `<div class="stats3"><div><b class="bad">−${fmt2(r.tr.perWeek)}</b><span>kg/týden · 4 týdny</span></div><div><b>−${fmt2(r.planWk)}</b><span>kg/týden · plán</span></div><div><b class="bad">${Math.round(r.adh * 100)} %</b><span>plnění</span></div></div>
     <div class="alert a2"><div>Cíl je, aby Robert cíle dosáhl. Proto se termín neposouvá – nejdřív se odstraní příčina a plán se srovná od dneška tak, aby termín stihl.</div></div>
     <h3>1 · Příčina</h3><ol class="gcl">${pricina}</ol>
     <h3>2 · Plán od dneška</h3><ol class="gcl">${plan}</ol>
     <p class="hint">Plnění = úbytek za 4 týdny ÷ plánovaný úbytek za stejné dny. Každá změna je v Historii změn a jde vrátit; v grafu zůstane první plán k porovnání.</p>`);
});

/* ---------- Fáze 4 (7. 10. 2026): zdravá váha a fáze cesty, škála pohybu, rámec týdne, cesta ---------- */
/* Pohyb mimo trénink ve stupních místo faktoru: trenér vidí, kam Robert patří podle kroků,
   a nastavuje cílový stupeň. Stupeň = běžné kroky za den mimo plánovanou chůzi. */
const MOVE_LVL = [[1, 'sedavý', 0, 3000, 2000, 1.2], [2, 'lehce aktivní', 3000, 6000, 4500, 1.28], [3, 'aktivní', 6000, 9000, 7500, 1.34], [4, 'velmi aktivní', 9000, 12000, 10500, 1.4], [5, 'fyzická práce', 12000, 1e9, 13000, 1.48]];
const moveLevel = st => MOVE_LVL.find(l => st >= l[2] && st < l[3]) || MOVE_LVL[0];
const moveLevelFactor = f => MOVE_LVL.slice().sort((a, b) => Math.abs(factorForSteps(a[4]) - f) - Math.abs(factorForSteps(b[4]) - f))[0];
A.setMoveGoal = n => { const l = MOVE_LVL[n - 1]; A.setSetting('steps_goal', String(l[4])); };
A.setMoveManual = n => { const l = MOVE_LVL[n - 1]; commitSettings({ ...S(), factor_lock: true, activity: factorForSteps(l[4]) }, `Pohyb ručně: ${l[0]}/5`, `Výdej počítá se stupněm ${l[0]} (${l[1]}).`); };
function moveRowHtml(s) {
  const sb = stepsBaseFor(todayISO()), cur = sb != null ? moveLevel(sb) : null, goal = moveLevel(stepsTarget(s));
  const manual = s.factor_lock ? moveLevelFactor(s.activity) : null;
  const seg = (on, fn) => `<div class="seg sm mlv">${MOVE_LVL.map(l => `<button class="${on === l[0] ? 'on' : ''}" title="${l[1]} · ${l[2] ? fmt0(l[2]) + '–' : 'do '}${l[3] < 1e8 ? fmt0(l[3]) : '+'} kroků" onclick="${fn}(${l[0]})">${l[0]}</button>`).join('')}</div>`;
  return frow('Pohyb mimo trénink', 'pohybStupen', seg(goal[0], 'A.setMoveGoal'), `cíl ${goal[0]}/5 ${goal[1]} (~${fmt0(goal[4])} běžných kroků)`)
    + `<div class="mlvnow ${cur ? (cur[0] >= goal[0] ? 'ok' : 'warn') : ''}">${s.factor_lock ? `Ručně nastaveno: <b>${manual[0]}/5 ${manual[1]}</b> – kroky se ignorují. <button class="btn ghost sm" onclick="A.setFactorLock(false)">Počítat z kroků</button>`
      : cur ? `Robert teď: <b>${cur[0]}/5 ${cur[1]}</b> · Ø ${fmt0(sb)} běžných kroků${(stepsHistFor(todayISO()) && stepsBaseFor(todayISO()) === stepsHistFor(todayISO()).bezne) ? ' (Apple Health)' : ''} – výdej se počítá z toho.`
      : `Robert kroky nezapisuje – výdej odhaduje stupeň ${moveLevelFactor(s.activity)[0]}/5. Zadej průměr z Apple Health, nebo nastav stupeň ručně: ${seg(0, 'A.setMoveManual')}`}</div>`;
}
/* Zdravá váha a fáze cesty: appka z výšky navrhne fáze se zdravotním smyslem a u každé
   ukáže, kdy jí Robert dosáhne podle plánu a podle trendu (a kdy ji dosáhl). */
const bmiW = (s, b) => b * Math.pow(s.height / 100, 2);
function healthPhases(s) {
  const st = s.start_weight, P = [[st * 0.95, '−5 %', 'první zdravotní efekt: tlak, cukr, klouby'], [st * 0.9, '−10 %', 'výrazně nižší riziko srdce a cukrovky']];
  [[35, 'BMI pod 35', 'z obezity 2. stupně do 1.'], [30, 'BMI pod 30', 'konec obezity']].forEach(([b, l, w]) => { if (bmiW(s, b) < st) P.push([bmiW(s, b), l, w]); });
  P.push([s.goal_weight, 'cíl trenéra', `BMI ${fmt1(s.goal_weight / Math.pow(s.height / 100, 2))}`]);
  const zdr = bmiW(s, 25); P.push([zdr, 'zdravá váha', 'BMI 25 – dlouhodobý směr']);
  const rows = calcMeasurements(s, Meas()), pp = planPath(), tr = trend21(), cur = currentWeight();
  return P.filter(p => p[0] < st).sort((a, b) => b[0] - a[0]).filter((p, i, a) => !i || Math.abs(a[i - 1][0] - p[0]) > 1.5 || p[1] === 'cíl trenéra')
    .map(([w, l, why]) => { const hit = rows.find(r => r.avg <= w); const pi = pp.findIndex(x => x <= w + 0.001);
      return { w, l, why, hit: hit ? hit.date : null, plan: pi >= 0 ? addDays(s.start_date, pi) : null, trend: !hit && tr && tr.perWeek > 0.05 ? addDays(todayISO(), Math.round((cur - w) / tr.perWeek * 7)) : null, goal: l === 'cíl trenéra', health: l === 'zdravá váha' }; });
}
function phasesCard(s) {
  const L = healthPhases(s); const nxt = L.find(p => !p.hit);
  return `<div class="chd"><h2>Fáze cesty</h2><span class="muted small">plán · trend · dosaženo${hq('faze')}</span></div><div class="mst">${L.map(p => `<div class="m ${p === nxt ? 'next' : ''}"><b>${fmt0(p.w)} kg</b><span><i class="dt" style="background:${p.hit ? '#16a34a' : p === nxt ? '#2563eb' : '#cbd5e1'}"></i>${esc(p.l)} <em class="muted">· ${esc(p.why)}</em></span>
    <span class="small b ${p.hit ? 'ok' : ''}">${p.hit ? `✓ ${czDateShort(p.hit)}` : `${p.plan ? 'plán ' + czDateShort(p.plan) + String(parseISO(p.plan).getFullYear()).slice(2) : '–'}${p.trend ? ` · <span class="${!p.plan ? 'muted' : p.trend > addDays(p.plan, 14) ? 'bad' : 'ok'}">trend ${czDateShort(p.trend)}${String(parseISO(p.trend).getFullYear()).slice(2)}</span>` : ''}`}</span></div>`).join('')}</div>`;
}
/* Cesta k cíli po měsících: bloky deficitu, přestávky, fáze a termín; přestávky radí appka */
function pathCard(s) {
  const t = todayISO(), thisMon = mondayOf(t), mw = (s.maint_weeks || []).slice().sort(); const T = goalTermin(); const end = [T, planEnd()].filter(Boolean).sort().pop();
  if (!end || s.maintain) return '';
  const n = Math.min(110, Math.max(4, Math.ceil(daysBetween(thisMon, end) / 7) + 1)); const weeks = Array.from({ length: n }, (_, k) => addDays(thisMon, 7 * k));
  const lastBr = mw.filter(m => m <= t).pop(); const blockStart = lastBr ? addDays(lastBr, 7) : mondayOf(s.start_date); const inDef = Math.floor(daysBetween(blockStart, thisMon) / 7);
  // doporučené přestávky: po každých 8 týdnech deficitu (od poslední přestávky)
  const rec = new Set(); { let b = blockStart; for (let k = 0; k < 20; k++) { let br = addDays(b, 56); if (br < addDays(thisMon, 7)) br = addDays(thisMon, 7); if (br > end) break; const real = mw.find(m => m >= br && m < addDays(br, 21)); if (real) { b = addDays(real, 7); continue; } rec.add(br); b = addDays(br, 7); } }
  const ph = healthPhases(s).filter(p => !p.hit && p.plan); const pin = m => ph.filter(p => mondayOf(p.plan) === m);
  const cells = weeks.map((m, k) => { const br = mw.includes(m), r = rec.has(m), isT = mondayOf(T) === m; const pp = pin(m);
    return `<div class="pw"><div class="mo">${k === 0 || m.slice(8) <= '07' ? MES3[+m.slice(5, 7) - 1] + (m.slice(5, 7) === '01' || k === 0 ? ' ' + m.slice(2, 4) : '') : ''}</div>
      <i class="${k === 0 ? 'now' : br ? 'br' : r ? 'rec' : ''} ${isT ? 'term' : ''}" title="týden od ${czDateShort(m)}${br ? ' · přestávka' : r ? ' · doporučená přestávka' : ''}${isT ? ' · termín cíle' : ''} – ťukni = přestávka ano/ne" onclick="A.maintWeek('${m}')"></i>
      <div class="pp">${pp.map(p => `<span class="${p.goal ? 'g' : ''}" title="${esc(p.l)} ${fmt0(p.w)} kg">${fmt0(p.w)}</span>`).join('')}${isT ? '<span class="t">cíl</span>' : ''}</div></div>`; }).join('');
  const futBr = mw.filter(m => m >= thisMon).length;
  return `<div class="card stack s8"><div class="chd"><h2>Cesta k cíli</h2><span class="muted small">po týdnech od dneška · ťukni na týden = přestávka ano/ne${hq('prestavka')}</span>
      ${rec.size ? `<button class="btn sm" style="margin-left:auto" onclick="A.planBreaks()">Zařadit doporučené přestávky (${rec.size})</button>` : ''}</div>
    <div class="ptl2">${cells}</div>
    <div class="legend kleg" style="justify-content:flex-start"><span><i style="background:#2563eb"></i>dnes</span><span><i style="background:#dbeafe"></i>deficit</span><span><i style="background:#fde68a"></i>přestávka</span><span><i style="background:repeating-linear-gradient(135deg,#dbeafe 0 3px,#fde68a 3px 6px)"></i>doporučená přestávka</span><span>číslo = fáze (kg)</span><span><i style="background:#fff;box-shadow:inset 0 0 0 2px #15803d"></i>termín ${czDate(T)}</span></div>
    <div class="pexp"><b>Kdy přestávku a proč:</b> Robert je teď ${inDef}. týden v deficitu${futBr ? ` · naplánováno ${futBr} ${sklon(futBr, 'přestávka', 'přestávky', 'přestávek')}` : ''}. Po 6–10 týdnech deficitu se tělo brání – roste hlad, únava a klesá chuť se hýbat; týden na úrovni výdeje (jí víc, nehubne) to srovná a plán jde dojít až k cíli. Dřív ji zařaď, když váha 2 týdny stojí při dodržování nebo hlásí hlad a špatný spánek. Každá přestávka posune cíl o týden – appka ji započítá do tempa, takže termín drží.</div></div>`;
}

/* ---------- Průvodce týdnem (7. 10. 2026) ----------
   Trenér nemá hledat, co je špatně, ani rozumět tabulkám. Appka ho provede: 1 co Robert dělal
   (věty, ne čísla bez souvislostí) · 2 proč to tak je · 3 co doporučuje udělat (Udělat / Přeskočit)
   · 4 shrnutí. Rozhodnutí se pamatují pro týden (LS dec:<pondělí>), stejně jako v Týdenní kontrole. */
function guideWeek() { const t = todayISO(); return { from: addDays(mondayOf(t), -7), to: addDays(mondayOf(t), -1) }; }
function weekStory(from, to) {
  const s = S(), R = periodStats(from, to), W = drWeight(from, to), L = [];
  if (R.empty) return L;
  const line = (c, ic, txt) => L.push({ c, ic, txt });
  line(R.weigh >= R.wDays - 1 ? 'ok' : R.weigh >= R.wDays / 2 ? 'warn' : 'bad', 'scale', `Vážil se ${R.weigh}× ze ${R.wDays} dní.${R.weigh < R.wDays / 2 ? ' Bez vážení nejde poznat, jestli plán funguje.' : ''}`);
  if (W.real != null) line(W.pct >= 90 ? 'ok' : W.pct >= 60 ? 'warn' : 'bad', 'trend', `Váha ${W.real >= 0 ? 'klesla' : 'stoupla'} o ${fmt1(Math.abs(W.real))} kg (cíl na týden −${fmt1(W.plan)} kg)${W.pct != null ? ` – splnil ${W.pct} % cíle` : ''}.`);
  line(R.conf >= R.n - 1 ? 'ok' : R.conf >= R.n / 2 ? 'warn' : 'bad', 'check', R.conf ? `Potvrdil ${R.conf} ze ${R.n} dní – z nich ${R.inLimit}× držel limit jídla.` : `Nepotvrdil ani jeden den – appka neví, co opravdu jedl.`);
  if (R.walkPlan) line(R.walk >= R.walkPlan * 0.9 ? 'ok' : R.walk >= R.walkPlan * 0.6 ? 'warn' : 'bad', 'walk', `Chůze: ${fmt0(R.walk)} z ${fmt0(R.walkPlan)} minut (${Math.round(R.walk / R.walkPlan * 100)} %).`);
  else line('warn', 'walk', 'Chůzi nezapsal ani jednou.');
  if (R.stepsAvg != null) line(R.stepsAvg >= stepsTarget(s) * 0.9 ? 'ok' : 'warn', 'feet', `Běžné kroky Ø ${fmt0(R.stepsAvg)} denně (cíl ${fmt0(stepsTarget(s))}).`);
  else { const h = stepsHistFor(to); line(h ? 'ok' : 'warn', 'feet', h ? `Kroky denně nezapisuje – počítá se průměr z Apple Health (${fmt0(h.avg)} denně).` : 'Kroky nezapsal – výdej je jen odhad.'); }
  if (R.trPlan) line(R.trDone >= R.trPlan * 0.8 ? 'ok' : R.trDone ? 'warn' : 'bad', 'dumbbell', `Trénink: odcvičil ${R.trDone} z ${R.trPlan}.`);
  const pc = pocitSouhrn(from, to); if (pc !== 'nevyplnil') line(pc === 'v pořádku' ? 'ok' : 'warn', 'moon', `Jak se cítil: ${pc}.`);
  return L;
}
/* doporučení k rozhodnutí: aktuální problémy s akcí; co nemá tlačítko, má větu, co udělat mimo appku */
function guideRecs() {
  const now = diagnoza(); const out = [];
  now.list.forEach(x => { if (x.lv > 2) return;
    const kde = (x.kde || []).slice().sort(); const den = kde.length ? kde[kde.length - 1] : null;
    const doIt = x.apply ? { kind: 'apply', js: x.apply, label: x.label || 'Udělat' } : x.go ? { kind: 'go', js: x.go, label: x.label || 'Otevřít' } : den && !GUIDE_OFFLINE[x.key] ? { kind: 'go', js: `A.coachDaySheet('${den}')`, label: `Ukázat ${czDateShort(den)}` } : null;
    out.push({ key: x.key, title: x.title, why: x.sub || '', doIt, offline: GUIDE_OFFLINE[x.key] || (!doIt ? 'Probrat s Robertem při vašem příštím kontaktu.' : '') }); });
  return out.slice(0, 6);
}
/* co udělat mimo appku, když problém nemá tlačítko (appka na komunikaci není – tohle je rada trenérovi) */
const GUIDE_OFFLINE = {
  nepotvrz: 'Domluv s Robertem: každý večer ťuknout „Jedl jsem podle plánu“ (výjimky opravit u jídla). Bez toho jsou rozbory naslepo.',
  vazeni: 'Domluv s Robertem: vážit se každé ráno po WC, nalačno – appka mu to připomene.',
  'vazeni-malo': 'Domluv s Robertem: vážit se každé ráno – průměr 7 vážení je teprve spolehlivý.',
  krokyzap: 'Ať večer zapíše kroky z telefonu (Apple Health → Kroky, číslo za den). Nebo zadej v Plánu → Pohyb průměr z Health za měsíc.',
  planjidel: 'Ať si v appce naplánuje jídla na další dny (Plán → Jídla → Naplánuj mi týden), ne v Excelu.',
  situace: 'Ať jídla „podle situace“ večer jedním ťuknutím odhadne (lehké · jako plán · vydatné · hodně), nebo si je předem naplánuje.',
  preslimit: 'Otevři den a podívej se, který chod nebo cheat ho přetáhl. S Robertem domluv jednu konkrétní změnu (menší porce přílohy, cheat do rezervy dne nebo pokrýt chůzí).',
  jidlo: 'Otevři dny přes limit a najdi, co se opakuje (stejný chod, víkend, cheat). Domluv s Robertem jednu konkrétní změnu na příští týden.',
  pohyb: 'Zjisti, proč chůzi nestíhá. Když je cíl moc vysoko, nastav takový, který reálně ujde – lepší 45 minut každý den než 60 občas.',
  chuze: 'Zjisti, proč chůzi nestíhá, a nastav cíl, který reálně ujde.', trenink: 'Zjisti, co mu brání cvičit (čas, bolest, chuť), a uprav plán v Tréninku na lehčí.',
  stoji: 'Váha stojí – když Robert potvrzuje dny a drží limit, zvaž přestávku v deficitu nebo korekci výdeje (Přeplánovat).',
    hlad: 'Zeptej se, kdy má hlad – zvaž víc bílkovin a zeleniny, nebo přestávku v deficitu.', spanek: 'Zeptej se na spánek – špatný spánek zvyšuje hlad a brzdí hubnutí.' };
A.guide = step => openSheet(() => {
  const g = guideWeek(), st = step || App._gs || 1; App._gs = st; const done = LS.get('dec:' + g.from, {});
  const recs = guideRecs(); const nav = `<div class="gsteps">${['Co dělal', 'Proč', 'Co udělat', 'Co mu říct', 'Hotovo'].map((l, i) => `<span class="${i + 1 === st ? 'on' : i + 1 < st ? 'ok' : ''}">${i + 1 < st ? ico('check') : i + 1} ${l}</span>`).join('')}</div>`;
  let body = '', foot = '';
  if (st === 1) { const L = weekStory(g.from, g.to); const sc = weekScore(g.from, g.to);
    body = `${sc ? `<div class="gscore" style="--c:${scoreCol(sc.s)}"><b>${sc.s}</b><span>ze 100 · skóre plnění${hq('pSkore')}</span></div>` : ''}<div class="list">${L.map(x => `<div class="li static"><span class="em ${x.c}">${ico(x.ic)}</span><div class="tx"><b>${esc(x.txt)}</b></div></div>`).join('') || '<p class="muted">Za minulý týden zatím nejsou data.</p>'}</div>`;
    foot = `<button class="btn" onclick="App._gs=2;window._sheetRedraw()">Dál: proč ›</button>`; }
  if (st === 2) { const D = diagnoza(g.from, g.to).list.slice(0, 4);
    body = D.length ? `<div class="list">${D.map(x => `<div class="li static"><span class="em ${x.lv === 1 ? 'bad' : 'warn'}">${ico('alert')}</span><div class="tx"><b>${esc(x.title)}</b><span>${esc(x.sub || '')}</span></div></div>`).join('')}</div>` : `<div class="alert a3"><div>Týden šel podle plánu – žádný problém.</div></div>`;
    foot = `<button class="btn ghost" onclick="App._gs=1;window._sheetRedraw()">‹ Zpět</button><button class="btn" onclick="App._gs=3;window._sheetRedraw()">Dál: co udělat ›</button>`; }
  if (st === 3) {
    body = recs.length ? recs.map((r, i) => { const d = done[r.key];
      return `<div class="grec ${d ? 'done' : ''}"><b>${i + 1}. ${esc(r.title)}</b>${r.why ? `<span>${esc(r.why)}</span>` : ''}${r.offline ? `<em>Co udělat: ${esc(r.offline)}</em>` : ''}
        ${d ? `<div class="row nowrap"><span class="ok small b">${ico('check')} ${d === 'ok' ? 'hotovo' : 'přeskočeno'}</span><button class="btn ghost sm" onclick="A.decide('${g.from}','${r.key}',null);window._sheetRedraw()">Vrátit</button></div>`
          : `<div class="row">${r.doIt ? `<button class="btn sm" onclick="A.guideDo(${i})">${esc(r.doIt.label)}</button>` : `<button class="btn sm" onclick="A.decide('${g.from}','${r.key}','ok');window._sheetRedraw()">Domluvím to</button>`}<button class="btn sm ghost" onclick="A.decide('${g.from}','${r.key}','keep');window._sheetRedraw()">Přeskočit</button></div>`}</div>`; }).join('')
      : `<div class="alert a3"><div>Nic nečeká na rozhodnutí. Plán nech, jak je.</div></div>`;
    App._grecs = recs;
    foot = `<button class="btn ghost" onclick="App._gs=2;window._sheetRedraw()">‹ Zpět</button><button class="btn" onclick="App._gs=4;window._sheetRedraw()">Dál: co mu říct ›</button>`; }
  if (st === 4) { body = `<p class="small muted">Podklady pro tvou zpětnou vazbu. Hotovou zprávu z nich i z toho, co jsi vyřešil, zkopíruješ jedním tlačítkem.</p><button class="btn" onclick="A.msgSheet()">${ico('clip')} Zpráva pro Roberta</button>${feedbackHtml(feedbackPoints(g.from, g.to))}`;
    foot = `<button class="btn ghost" onclick="App._gs=3;window._sheetRedraw()">‹ Zpět</button><button class="btn" onclick="App._gs=5;window._sheetRedraw()">Dál: shrnutí ›</button>`; }
  if (st === 5) { const ok = recs.filter(r => done[r.key] === 'ok'), skip = recs.filter(r => done[r.key] === 'keep'), open = recs.filter(r => !done[r.key]);
    body = `<div class="list">${ok.map(r => `<div class="li static"><span class="em ok">${ico('check')}</span><div class="tx"><b>${esc(r.title)}</b><span>hotovo${r.offline ? ' · ' + esc(r.offline) : ''}</span></div></div>`).join('')}
      ${skip.map(r => `<div class="li static"><span class="em">${ico('clip')}</span><div class="tx"><b>${esc(r.title)}</b><span>přeskočeno</span></div></div>`).join('')}
      ${open.map(r => `<div class="li static"><span class="em warn">${ico('alert')}</span><div class="tx"><b>${esc(r.title)}</b><span>nerozhodnuto – vrať se do kroku 3</span></div></div>`).join('')}</div>
      <p class="small muted">Změny najdeš v Historii změn a každou jde vrátit. Další kontrola v pondělí ${czDateShort(addDays(mondayOf(todayISO()), 7))}.</p>`;
    foot = `<button class="btn ghost" onclick="App._gs=4;window._sheetRedraw()">‹ Zpět</button><button class="btn" onclick="App._gs=1;UI.closeModal();render()">Hotovo</button>`; }
  return UI.sheetHtml('Průvodce týdnem', `${czDateShort(g.from)}–${czDateShort(g.to)} · krok ${st} z 5`, nav + body, foot);
});
A.guideDo = i => { const r = (App._grecs || [])[i]; if (!r || !r.doIt) { UI.toast('Doporučení se mezitím změnilo – obnovuji.'); render(); return; } const g = guideWeek();
  const defer = r.doIt.kind === 'apply' || /replanSheet|goalCheckSheet/.test(r.doIt.js);   // vyřešeno až po potvrzení v náhledu
  if (defer) App._pvDecide = { week: g.from, key: r.key }; else A.decide(g.from, r.key, 'ok');
  if (r.doIt.kind === 'apply') { try { (new Function(r.doIt.js))(); } catch (e) { console.error(e); } if (window._sheetRedraw) window._sheetRedraw(); }
  else { UI.closeModal(); (new Function(r.doIt.js))(); if (!defer) UI.toast('Až to vyřešíš, průvodce najdeš na Přehledu v Týdenní kontrole.'); } };

/* ---------- Co Robertovi říct (7. 10. 2026) ----------
   Zpětnou vazbu dává trenér osobně; appka mu připraví podklady z dat týdne: konkrétní
   pochvalu (s čísly), co zlepšit (jedna dvě věci a jak) a na co se zeptat. */
function feedbackPoints(from, to) {
  const s = S(), R = periodStats(from, to), W = drWeight(from, to), P = [], Z = [], Q = [];
  if (R.empty) return { P, Z, Q };
  if (W.real != null && W.real > 0.1) P.push(`Shodil ${fmt1(W.real)} kg za týden${W.pct >= 90 ? ' – přesně podle plánu' : ''}.`);
  const ov = calcOverview(s, Meas()); if (ov.lost > 0.5) P.push(`Od startu má dole ${fmt1(ov.lost)} kg.`);
  healthPhases(s).filter(p => p.hit && p.hit >= from && p.hit <= addDays(to, 1)).forEach(p => P.push(`Dosáhl fáze ${p.l} (${fmt0(p.w)} kg) – ${p.why}.`));
  if (R.weigh >= R.wDays - 1) P.push(`Vážil se ${R.weigh}× ze ${R.wDays} – pravidelnost, na které stojí celý plán.`);
  if (R.conf >= R.n - 1) P.push(`Potvrdil ${R.conf} ze ${R.n} dní.`); if (R.conf && R.inLimit >= R.conf * 0.85) P.push(`Držel limit jídla ${R.inLimit}× z ${R.conf} potvrzených dní.`);
  if (R.walkPlan && R.walk >= R.walkPlan * 0.9) P.push(`Chůze: ${fmt0(R.walk)} minut za týden, ${Math.round(R.walk / R.walkPlan * 100)} % plánu.`);
  if (R.stepsAvg != null && R.stepsAvg >= stepsTarget(s)) P.push(`Běžné kroky Ø ${fmt0(R.stepsAvg)} – nad cílem.`);
  if (R.trPlan && R.trDone >= R.trPlan) P.push(`Odcvičil všechny tréninky (${R.trDone}).`);
  if (R.waistDelta != null && R.waistDelta < -0.4) P.push(`Pas ${signed1(R.waistDelta)} cm – ubývá tuk.`);
  const ws = weighStreak(); if (ws >= 7) P.push(`${ws} dní vážení v řadě.`);
  // co zlepšit – nejvýš dvě, s tím jak
  if (R.conf < R.n * 0.5) Z.push('Potvrzovat den: každý večer jedno ťuknutí „Jedl jsem podle plánu“ – bez toho nevíme, co funguje.');
  const sit = sitStats(from, to); if (sit.unk >= 3) Z.push(`Jídla „podle situace“ (${sit.unk}× za týden) večer odhadnout jedním ťuknutím – lehké / jako plán / vydatné / hodně.`);
  if (R.conf && R.inLimit < R.conf * 0.7) { const over = []; for (let d = from; d <= to; d = addDays(d, 1)) { const ev = evaluateDay(d); if (ev.confirmed && ev.cheats.over) over.push(DAY_SHORT[dayIndex(d)]); }
    Z.push(`Limit přetáhl ${over.length}× (${over.join(', ')}). ${over.filter(x => /So|Ne|Pá/.test(x)).length >= Math.ceil(over.length / 2) ? 'Hlavně o víkendu – naplánovat víkendová jídla dopředu a cheat zapsat ráno, appka ho pokryje chůzí.' : 'Vybrat jeden chod, který přetahuje, a zmenšit přílohu.'}`); }
  if (R.walkPlan && R.walk < R.walkPlan * 0.7) Z.push(`Chůze ${Math.round(R.walk / R.walkPlan * 100)} % plánu – rozdělit na 2× ${Math.round(s.walk_min / 2)} minut (ráno a večer) je snazší než jednou dlouho.`);
  if (!R.walkPlan && R.n >= 5) Z.push('Zapisovat chůzi – po procházce přičíst minuty, klidně po částech.');
  if (R.trPlan && R.trDone < R.trPlan * 0.6) Z.push(`Trénink ${R.trDone} z ${R.trPlan} – domluvit pevné dny a čas, appka ho provede sérií po sérii.`);
  if (R.weigh < R.wDays * 0.6) Z.push('Vážit se každé ráno – appka připomene.');
  // na co se zeptat (z hodnocení dnů)
  let sp = 0, st = 0, hl = 0, bol = 0; for (let d = from; d <= to; d = addDays(d, 1)) { const r = Store.rows('days', Store.ownerId()).find(x => x.data.date === d); if (!r) continue; const c = r.data.checkin || {}; if (c.sleep === 'spatne') sp++; if (c.stress === 'hodne') st++; if (r.data.hunger === 'vlk') hl++; if (c.move === 'bolest') bol++; }
  if (sp >= 2) Q.push(`Jak spí? ${sp}× hlásil špatný spánek – zvyšuje hlad a brzdí hubnutí.`);
  if (hl >= 2) Q.push(`Kdy má hlad? ${hl}× vlčí hlad – víc bílkovin a zeleniny, nebo přestávka v deficitu.`);
  if (st >= 2) Q.push(`Co ho stresuje? ${st}× hodně stresu.`); if (bol >= 1) Q.push(`Co bolí? ${bol}× hlásil bolest při pohybu – upravit trénink.`);
  if (!P.length) P.push(R.weigh ? `Vážil se ${R.weigh}× – drží se toho.` : 'Je v plánu a nevzdal to – i to je potřeba ocenit.');
  return { P: P.slice(0, 4), Z: Z.slice(0, 2), Q: Q.slice(0, 2) };
}
function feedbackHtml(F) {
  const blk = (ic, cl, t, L) => L.length ? `<div class="fbk ${cl}"><h4>${ico(ic)} ${t}</h4><ul>${L.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';
  return blk('star', 'ok', 'Pochval', F.P) + blk('target', 'b', 'Co zlepšit (a jak)', F.Z) + blk('user', 'p', 'Na co se zeptat', F.Q);
}

/* Robert dnes: co už má hotové a co ho čeká – trenér vidí stav dne bez listování */
function todayStrip(s) {
  const t = todayISO(), day = effectiveDay(t), d = calcDay(s, Foods(), Recipes(), day, currentWeight()); const m = Meas().find(x => x.date === t && x.weight != null);
  const meals = s.courses.filter(c => { const mm = (day.meals || {})[c.key] || {}; return mm.sel && mm.sel !== VYNECHAT; }), eaten = meals.filter(c => ((day.meals || {})[c.key] || {}).eaten).length;
  const wk = day.walk_min || 0, wt = d.base.planWalk, items = (day.act || {}).items || [], trDone = (day.act || {}).doneAll, st = dayStepsTotal(day);
  const y = addDays(t, -1), yev = evaluateDay(y);
  const it = (ok, ic, txt) => `<span class="ts ${ok === true ? 'ok' : ok === false ? 'no' : ''}">${ico(ic)}${txt}</span>`;
  return `<div class="card tstrip" onclick="A.coachDaySheet('${t}')"><b>Robert dnes</b>
    ${it(!!m, 'scale', m ? `${fmt1(m.weight)} kg` : 'bez váhy')}${it(meals.length ? eaten === meals.length : null, 'fork', meals.length ? `jídla ${eaten}/${meals.length}` : 'jídla nenaplánovaná')}
    ${it(wk >= wt - 5 ? true : wk ? null : false, 'walk', `chůze ${wk}/${wt} min`)}${items.length ? it(!!trDone, 'dumbbell', trDone ? 'trénink hotový' : 'trénink čeká') : ''}
    ${it(st != null ? true : null, 'feet', st != null ? `${fmt0(st)} kroků` : 'kroky večer')}${it(!!day.reviewed, 'check', day.reviewed ? 'den potvrzený' : 'potvrzení večer')}
    ${y >= s.start_date && !yev.confirmed ? it(false, 'alert', 'včerejšek nepotvrzený') : ''}<span class="chev">›</span></div>`;
}

/* ---------- Denní brief trenéra (8. 10. 2026) ----------
   Appka je trenér, vlastník jen tlumočí. Každý den za dvě minuty: jedna věta, co appka
   zkontrolovala (klouzavých 7 dní), co udělat (s tlačítkem) a co Robertovi dnes říct. */
function coachChecks() {
  const s = S(), t = todayISO(), from = addDays(t, -7), to = addDays(t, -1), R = periodStats(from, to), out = [];
  const add = (c, ic, area, txt) => out.push({ c, ic, area, txt });
  if (R.empty) return out;
  add(R.weigh >= 6 ? 'ok' : R.weigh >= 4 ? 'warn' : 'bad', 'scale', 'Vážení', `${R.weigh}× za 7 dní`);
  add(R.conf >= 6 ? 'ok' : R.conf >= 3 ? 'warn' : 'bad', 'check', 'Zápisy', `${R.conf} ze 7 dní potvrzených`);
  add(!R.conf ? 'bad' : R.inLimit >= R.conf * 0.85 ? 'ok' : R.inLimit >= R.conf * 0.6 ? 'warn' : 'bad', 'fork', 'Jídlo', R.conf ? `limit ${R.inLimit}× z ${R.conf}` : 'nejde ověřit');
  add(!R.walkPlan ? 'bad' : R.walk >= R.walkPlan * 0.9 ? 'ok' : R.walk >= R.walkPlan * 0.6 ? 'warn' : 'bad', 'walk', 'Chůze', R.walkPlan ? `${Math.round(R.walk / R.walkPlan * 100)} % plánu` : 'nezapsaná');
  { const h = stepsHistFor(t); add(R.stepsAvg != null ? (R.stepsAvg >= stepsTarget(s) * 0.9 ? 'ok' : 'warn') : h ? 'ok' : 'warn', 'feet', 'Kroky', R.stepsAvg != null ? `Ø ${fmt0(R.stepsAvg)} běžných` : h ? `Health Ø ${fmt0(h.avg)}` : 'nezapsané'); }
  add(!R.trPlan ? 'warn' : R.trDone >= R.trPlan * 0.8 ? 'ok' : R.trDone ? 'warn' : 'bad', 'dumbbell', 'Trénink', R.trPlan ? `${R.trDone} z ${R.trPlan}` : 'žádný v plánu');
  { let n = 0; for (let k = 0; k < 3; k++) { const d = addDays(t, k); n += (getWeek(mondayOf(d)).plan[dayIndex(d)] || []).filter(Boolean).length; } add(n >= 12 ? 'ok' : n >= 6 ? 'warn' : 'bad', 'cal', 'Plán jídel', `${n} z 15 na 3 dny`); }
  { const g = goalCheck(); if (g) { add(g.adh >= 0.8 ? 'ok' : g.adh >= 0.6 ? 'warn' : 'bad', 'trend', 'Tempo', `${Math.round(g.adh * 100)} % plánu (−${fmt2(g.tr.perWeek)} kg/t)`);
    const late = g.dTrend ? daysBetween(g.target, g.dTrend) : 999; add(late <= 14 ? 'ok' : late <= 60 ? 'warn' : 'bad', 'target', 'Termín', g.dTrend ? (late <= 14 ? `stihne ${czDateShort(g.target)}` : `trend ${czDateShort(g.dTrend)}${String(parseISO(g.dTrend).getFullYear()).slice(2)}`) : 'nejde odhadnout'); } }
  { const pc = pocitSouhrn(from, to); add(pc === 'v pořádku' ? 'ok' : pc === 'nevyplnil' ? 'warn' : 'warn', 'moon', 'Pocit', pc); }
  { const n = trAdvice(Array.from({ length: 14 }, (_, i) => addDays(t, i))).length; add(n ? 'warn' : 'ok', 'clip', 'Plán tréninku', n ? `${n} ${sklon(n, 'návrh', 'návrhy', 'návrhů')}` : 'vyvážený'); }
  { const sit = sitStats(from, to); if (sit.n) add(sit.unk / sit.n < 0.15 ? 'ok' : 'warn', 'fork', 'Jídla podle situace', `${sit.unk} bez odhadu`); }
  return out;
}
function briefCard(s) {
  const t = todayISO(), C = coachChecks(); if (!C.length) return '';
  const g = guideWeek(), done = LS.get('dec:' + g.from, {}), recs = guideRecs().filter(r => !done[r.key]).slice(0, 3); App._grecs = guideRecs();
  const F = feedbackPoints(addDays(t, -7), addDays(t, -1)); const bad = C.filter(c => c.c === 'bad').length, warn = C.filter(c => c.c === 'warn').length;
  const verdict = bad >= 3 ? 'Robert teď plán neplní – hlavně zápisy a jídlo.' : bad ? `Většina sedí, ${bad} ${sklon(bad, 'věc vázne', 'věci váznou', 'věcí vázne')}.` : warn ? 'Robert jede, pár věcí pohlídat.' : 'Robert jede podle plánu.';
  return `<div class="card brief"><div class="bhd"><div><span class="pill2">${ico('sun')} Brief na ${DAY_NAMES[dayIndex(t)].toLowerCase()} ${czDateShort(t)} · ~2 min${hq('brief')}</span><h2>${esc(verdict)}</h2></div></div>
    <div class="bgrid">
      <div><h4>Zkontrolovala jsem za tebe · 7 dní</h4><div class="chks">${C.map(c => `<div class="chk2 ${c.c}">${ico(c.ic)}<b>${esc(c.area)}</b><span>${esc(c.txt)}</span></div>`).join('')}</div></div>
      <div><h4>Udělej</h4>${recs.length ? recs.map(r => { const i = App._grecs.findIndex(x => x.key === r.key); return `<div class="bdo"><b>${esc(r.title)}</b>${r.offline ? `<span>${esc(r.offline)}</span>` : ''}<div class="row">${r.doIt ? `<button class="btn sm" onclick="A.guideDo(${i})">${esc(r.doIt.label)}</button>` : `<button class="btn sm" onclick="A.decide('${g.from}','${r.key}','ok')">Domluvím to</button>`}<button class="btn sm ghost" onclick="A.decide('${g.from}','${r.key}','keep')">Přeskočit</button></div></div>`; }).join('') : `<div class="small muted">${ico('check')} Dnes nic – plán nech běžet.</div>`}</div>
      <div><h4>Řekni Robertovi</h4><button class="btn sm" style="margin-bottom:8px" onclick="A.msgSheet()">${ico('clip')} Zpráva pro Roberta</button>${F.P[0] ? `<div class="fbk ok"><ul><li>${esc(F.P[0])}</li></ul></div>` : ''}${F.Z[0] ? `<div class="fbk b"><ul><li>${esc(F.Z[0])}</li></ul></div>` : ''}${F.Q[0] ? `<div class="fbk p"><ul><li>${esc(F.Q[0])}</li></ul></div>` : ''}</div>
    </div></div>`;
}

/* ---------- Náhled změny před potvrzením (9. 10. 2026) ----------
   Každá změna plánu z doporučení se nejdřív ukáže: co se v nastavení změní (před → po) a co
   z toho vyjde (limit jídla, tempo, kdy cíl podle plánu, termín). Teprve pak „Potvrdit změnu“. */
function settingsEffects(d) { const t = todayISO(), w = currentWeight(), act = planActFor(t, w);
  const b = calcBase(effSettings(d, t), w, act.planWalk, 0, d.walk_kmh, 0, 0, act); const p = planPathFrom(d, d.plan_bases || []);
  return { limit: b.planLimit, kg: w * effSettings(d, t).rate_pct / 100, plan: p[p.length - 1] <= d.goal_weight + 0.001 ? addDays(d.start_date, p.length - 1) : null, termin: d.goal_date || null, walk: d.walk_min }; }
function previewChange(d, label, msg) {
  const s = S(), a = settingsEffects(s), b = settingsEffects(d); const nz = v => v == null || (Array.isArray(v) && !v.length) ? null : v;
  const rows = Object.keys(HIST_KEYS).filter(k => JSON.stringify(nz(s[k])) !== JSON.stringify(nz(d[k]))).map(k => `<tr><td>${esc(HIST_KEYS[k])}</td><td class="n muted">${esc(paceFix(histVal(k, s[k])))}</td><td class="n b">${esc(paceFix(histVal(k, d[k])))}</td></tr>`);
  const eff = [['Limit jídla dnes', fmt0(a.limit) + ' kcal', fmt0(b.limit) + ' kcal'], ['Tempo', `−${fmt2(a.kg)} kg/týden`, `−${fmt2(b.kg)} kg/týden`], ['Cíl podle plánu', a.plan ? czDate(a.plan) : '–', b.plan ? czDate(b.plan) : '–'], ['Termín cíle', a.termin ? czDate(a.termin) : 'nezadaný', b.termin ? czDate(b.termin) : 'nezadaný']]
    .filter(([, x, y]) => x !== y).map(([l, x, y]) => `<tr><td>${l}</td><td class="n muted">${x}</td><td class="n b">${y}</td></tr>`);
  App._pv = { d, label, msg };
  openSheet(() => UI.sheetHtml('Zkontroluj změnu', esc(label),
    `<p class="small muted">Nic se ještě nezměnilo. Takhle bude plán vypadat po potvrzení:</p>
     <div class="tbl"><table class="small"><tr><th>Co se mění</th><th class="n">Teď</th><th class="n">Po změně</th></tr>${rows.join('') || '<tr><td colspan="3" class="muted">nastavení beze změny</td></tr>'}</table></div>
     ${eff.length ? `<h3>Co z toho vyjde</h3><div class="tbl"><table class="small"><tr><th></th><th class="n">Teď</th><th class="n">Po změně</th></tr>${eff.join('')}</table></div>` : ''}
     <p class="hint">Robert uvidí nový limit hned. Změna se zapíše do Historie změn a jde vrátit.</p>`,
    `<button class="btn" onclick="A.pvOk()">Potvrdit změnu</button><button class="btn ghost" onclick="UI.closeModal()">Zrušit</button>`));
}
A.pvOk = () => { const p = App._pv; if (!p) return; App._pv = null; UI.closeModal(); commitSettings(p.d, p.label, p.msg);
  if (App._pvDecide) { const q = App._pvDecide; App._pvDecide = null; A.decide(q.week, q.key, 'ok'); } };
A.applyAdvice = json => previewChange({ ...S(), ...JSON.parse(json) }, 'Nastavení podle doporučení');
A.replanApply = req => { const s = S(), r = replanCheck(), t = todayISO(), w = currentWeight(); const T = r ? r.termin : goalTermin(); UI.closeModal();
  previewChange({ ...s, rate_pct: req, goal_date: s.goal_date || T, plan_bases: (s.plan_bases || []).filter(b => b.date !== t).concat([{ date: t, weight: Math.round(w * 10) / 10 }]) }, 'Přeplánováno od dneška', `Plán od ${fmt1(w)} kg, tempo ${String(req).replace('.', ',')} %, termín ${czDate(T)}.`); };
A.replanMove = d => { if (!d) return; const s = S(), n = terminPosuny() + 1, w = currentWeight(), t = todayISO(); UI.closeModal();
  previewChange({ ...s, rate_pct: 1, goal_date: d, plan_bases: (s.plan_bases || []).filter(b => b.date !== t).concat([{ date: t, weight: Math.round(w * 10) / 10 }]) }, `Termín cíle posunut (${n}. posun)`, `Termín ${czDate(d)} (${n}. posun), tempo 1 %.`); };
A.applyOutAdj = c => { const s = S(), n = (Number(s.out_adj) || 0) + c; UI.closeModal(); previewChange({ ...s, out_adj: n }, 'Korekce výdeje', `Výdej ${n > 0 ? '+' : ''}${n} kcal podle skutečnosti.`); };
A.setMaintain = on => previewChange({ ...S(), maintain: !!on }, on ? 'Udržování zapnuto' : 'Udržování vypnuto', on ? 'Deficit je nula – Robertův limit sedí na celkovém výdeji.' : `Zpátky na tempo ${String(S().rate_pct).replace('.', ',')} %.`);

/* ---------- Zpráva pro Roberta (9. 10. 2026, rozhodnutí vlastníka) ----------
   Appka nic neposílá. Složí text, který trenér zkopíruje a pošle sám (Messenger, SMS…):
   pochvala, co trenér v plánu změnil (z Historie změn za 7 dní) a na co se zaměřit
   (to, co trenér v „Udělej“ vyřešil jako „Domluvím to“ / „Hotovo“), plus na co se zeptat. */
const ROBERT_TODO = {
  nepotvrz: 'Každý večer v appce ťukni „Potvrdit den“ – jedl jsem podle plánu, co bylo jinak, oprav u jídla. Zabere to 10 vteřin a já pak vidím, co funguje.',
  vazeni: 'Vážit se každé ráno po WC, nalačno – appka ti to připomene.', 'vazeni-malo': 'Vážit se každé ráno – teprve průměr 7 vážení ukáže, jak ti to jde.',
  krokyzap: 'Večer zapiš kroky z telefonu (Zdraví → Kroky → číslo za den).', planjidel: 'Jídla plánuj v appce: Plán → Naplánuj mi týden, pak jen vyměň, co nechceš.',
  situace: 'Jídla „podle situace“ večer odhadni jedním ťuknutím (lehké / jako plán / vydatné / hodně) – jinak je appka počítá jako podle plánu.',
  preslimit: 'Hlídej porce – hlavně přílohu. Cheat si zapiš ráno dopředu, appka ti ho pokryje chůzí.', jidlo: 'Hlídej porce – hlavně přílohu a víkendy. Cheat zapiš ráno dopředu.',
  pohyb: 'Chůzi klidně rozděl na dvakrát (ráno a večer) – a po každé přičti minuty v appce.', chuze: 'Chůzi klidně rozděl na dvakrát a po každé přičti minuty v appce.',
  trenink: 'Trénink: ťukni v appce „Začít cvičit“ – provede tě sérií po sérii. Dej mi vědět, kdyby tě něco bolelo.',
  kroky: 'Přidej běžné kroky – schody místo výtahu, kratší procházka po jídle.', hlad: 'Když máš hlad, přidej bílkoviny a zeleninu – a napiš mi, kdy to bývá.',
  spanek: 'Zkus chodit spát o půl hodiny dřív – spánek hodně ovlivňuje hlad.',
trplan: 'Trénink jsem upravil – najdeš ho v appce u každého dne.' };
function msgPraise(from, to) { const s = S(), R = periodStats(from, to), W = drWeight(from, to), ov = calcOverview(s, Meas()), P = [];
  if (R.empty) return P;
  if (W.real != null && W.real > 0.1) P.push(`za poslední týden máš dole ${fmt1(W.real)} kg${W.pct >= 90 ? ' – přesně podle plánu' : ''}`);
  if (ov.lost > 0.5) P.push(`od startu celkem ${fmt1(ov.lost)} kg`);
  healthPhases(s).filter(p => p.hit && p.hit >= from && p.hit <= addDays(to, 1)).forEach(p => P.push(`pokořil jsi hranici ${fmt0(p.w)} kg (${p.l})`));
  if (R.weigh >= R.wDays - 1) P.push(`vážil ses ${R.weigh}× ze ${R.wDays} – super pravidelnost`);
  if (R.conf >= R.n - 1) P.push(`potvrdil jsi ${R.conf} ze ${R.n} dní`);
  if (R.walkPlan && R.walk >= R.walkPlan * 0.9) P.push(`chůze ${Math.round(R.walk / R.walkPlan * 100)} % plánu`);
  if (R.trPlan && R.trDone >= R.trPlan) P.push(`odcvičil jsi všechny tréninky`);
  if (R.waistDelta != null && R.waistDelta < -0.4) P.push(`pas ${signed1(R.waistDelta)} cm`);
  return P.slice(0, 3); }
function msgChanges(since) { const s = S(), out = []; const L = histRows().filter(r => r.data.at.slice(0, 10) >= since && !r.data.undone && !r.data.reverted);
  const keys = new Set(); let tr = false; L.forEach(r => (r.data.ch || []).forEach(c => { if (c.t === 'training') tr = true; if (c.t === 'settings') { const a = (c.prev || {}).data || {}, b = (c.next || {}).data || {}; Object.keys(HIST_KEYS).forEach(k => { if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) keys.add(k); }); } }));
  if (['rate_pct', 'plan_bases', 'out_adj', 'goal_date', 'maintain', 'activity', 'factor_lock', 'steps_goal', 'protein_min', 'courses'].some(k => keys.has(k))) out.push(`Upravil jsem ti plán – limit jídla je teď ${fmt0(limitToday(s).planLimit)} kcal denně (ve dny s pohybem víc, appka ti to ukáže v kroužku Jídlo).`);
  if (keys.has('plan_bases') || keys.has('goal_date')) out.push(`Cíl ${fmt0(s.goal_weight)} kg${goalTermin() ? ` do ${czDate(goalTermin())}` : ''} drží – plán jsem srovnal od dneška.`);
  if (keys.has('walk_min')) out.push(`Chůze nově ${s.walk_min} minut denně.`);
  if (keys.has('steps_goal')) out.push(`Cíl běžných kroků je ~${fmt0(stepsTarget(s))} denně (mimo procházku).`);
  if (keys.has('protein_min')) out.push(`Bílkoviny aspoň ${s.protein_min} g denně.`);
  if (keys.has('maint_weeks')) { const fut = (s.maint_weeks || []).filter(m => m >= todayISO()); if (fut.length) out.push(`Týden od ${czDateShort(fut[0])} máš přestávku – jíš víc, nehubneš, tělo si odpočine.`); }
  if (tr) out.push('Upravil jsem ti trénink – najdeš ho v appce u každého dne.');
  return out; }
function robertMessage() { const t = todayISO(), g = guideWeek(), dec = LS.get('dec:' + g.from, {});
  const P = msgPraise(addDays(t, -7), addDays(t, -1)), C = msgChanges(addDays(t, -7));
  const todo = [...new Set(Object.keys(dec).filter(k => dec[k] === 'ok' && ROBERT_TODO[k]).map(k => ROBERT_TODO[k]))].filter(x => !C.includes(x));
  const F = feedbackPoints(addDays(t, -7), addDays(t, -1)); const ask = F.Q.map(q => q.split('?')[0] + '?');
  const L = ['Ahoj Roberte,'];
  if (P.length) L.push(`${P[0].charAt(0).toUpperCase() + P[0].slice(1)}${P.length > 1 ? ', ' + P.slice(1).join(', ') : ''}. Paráda! 💪`);
  if (C.length) L.push('', 'Co jsem upravil:', ...C.map(x => '– ' + x));
  if (todo.length) L.push('', 'Na co se tento týden zaměř:', ...todo.slice(0, 3).map(x => '– ' + x));
  if (ask.length) L.push('', ask.map(q => q.replace(/^Jak spí\?/, 'Jak spíš?').replace(/^Kdy má hlad\?/, 'Kdy míváš hlad?').replace(/^Co ho stresuje\?/, 'Co tě stresuje?').replace(/^Co bolí\?/, 'Bolí tě něco při pohybu?')).join(' '));
  L.push('', 'Držím palce!');
  return L.join('\n'); }
A.msgSheet = () => openSheet(() => UI.sheetHtml('Zpráva pro Roberta', 'zkopíruj a pošli mu ji, jak chceš – appka nic neodesílá',
  `<p class="small muted">Složená z toho, co jsi vyřešil v „Udělej“, co jsi změnil v plánu a co se mu povedlo. Klidně ji uprav.</p>
   <textarea id="rmsg" class="msgta" rows="14">${esc(robertMessage())}</textarea>`,
  `<button class="btn" onclick="A.msgCopy()">${ico('clip')} Zkopírovat</button><button class="btn ghost" onclick="UI.closeModal()">Zavřít</button>`));
A.msgCopy = () => { const ta = $('#rmsg'); if (!ta) return; const txt = ta.value;
  const ok = () => UI.toast('Zkopírováno – vlož ji do zprávy Robertovi.');
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, () => { ta.select(); document.execCommand('copy'); ok(); });
  else { ta.select(); document.execCommand('copy'); ok(); } };
