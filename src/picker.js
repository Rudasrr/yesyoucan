/* ===== Výběrový panel jídel ===== */
const Picker = { q: '', kcal: '', prot: false, fav: false, own: false, sort: 'fit' };
/* recipeInfo: kcal/bílkoviny receptu při daném rozpočtu (jako v Dnes) */
function recipeInfo(s, foods, recipes, courseKey, name, budget) {
  const course = s.courses.find(c => c.key === courseKey);
  return calcCourse(s, foods, recipes, course, name, null, budget);
}
/* Otevře panel. ctx: {courseKey, current, budget, remaining, protGap, onPick(name)} */
function openPicker(ctx) {
  const s = S(), foods = Foods(), recipes = Recipes(); const course = s.courses.find(c => c.key === ctx.courseKey);
  const prefs = Prefs(); const fmap = Object.fromEntries(foods.map(f => [f.name, f]));
  const budget = ctx.budget || calcBase(s, currentWeight(), s.walk_min, 0, s.walk_kmh, 0, 0).planLimit;
  Picker.q = ''; Picker.kcal = ''; Picker.prot = false; Picker.fav = false; Picker.own = false; Picker.sort = ctx.remaining != null ? 'fit' : 'name';
  const m = UI.modal('');
  const draw = () => {
    const list = recipesFor(course.name).map(r => { const inf = recipeInfo(s, foods, recipes, ctx.courseKey, r.name, budget); return { r, kcal: inf.kcal, p: inf.p, target: inf.target, items: r.items }; });
    const q = Picker.q.toLowerCase().trim();
    let L = list.filter(x => !q || x.r.name.toLowerCase().includes(q) || x.items.some(it => it.food.toLowerCase().includes(q)));
    if (Picker.kcal) { const [lo, hi] = Picker.kcal.split('-').map(Number); L = L.filter(x => x.kcal >= lo && x.kcal <= hi); }
    if (Picker.prot) L = L.filter(x => x.p >= (SEED.settings.courses.find(c => c.key === ctx.courseKey) || {}).prot_min);
    if (Picker.fav) L = L.filter(x => prefs.favs.includes(x.r.name));
    if (Picker.own) L = L.filter(x => x.r.own);
    const fitScore = x => { let sc = 0; if (ctx.remaining != null) { const over = x.kcal - ctx.remaining; sc += over > 30 ? 1000 + over : Math.abs(x.kcal - Math.min(ctx.remaining, x.target)) * 0.5; } if (ctx.protGap > 0) sc -= Math.min(x.p, ctx.protGap) * 3; if (prefs.favs.includes(x.r.name)) sc -= 40; return sc; };
    if (Picker.sort === 'fit') L.sort((a, b) => fitScore(a) - fitScore(b));
    else if (Picker.sort === 'kcal') L.sort((a, b) => a.kcal - b.kcal);
    else if (Picker.sort === 'prot') L.sort((a, b) => b.p - a.p);
    else if (Picker.sort === 'recent') L.sort((a, b) => { const ia = prefs.recent.indexOf(a.r.name), ib = prefs.recent.indexOf(b.r.name); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
    else L.sort((a, b) => a.r.name.localeCompare(b.r.name, 'cs'));
    const kcalMin = Math.min(...list.map(x => x.kcal)), kcalMax = Math.max(...list.map(x => x.kcal));
    const step = kcalMax - kcalMin > 60 ? 50 : 20; const ranges = []; for (let v = Math.floor(kcalMin / step) * step; v <= kcalMax; v += step) ranges.push([v, v + step - 1]);
    const chip = (on, label, act) => `<span class="chip ${on ? 'on' : ''}" onclick="${act}">${label}</span>`;
    m.querySelector('.box').innerHTML = `<div class="row between"><h2>${COURSE_EMOJI[course.key]} ${course.name} <span class="muted small" style="font-weight:600">cíl ${fmt0(list[0] ? list[0].target : course.kcal)} kcal${ctx.remaining != null ? ` · zbývá ti ${fmt0(ctx.remaining)} kcal` : ''}${ctx.protGap > 0 ? ` · chybí ${fmt0(ctx.protGap)} g bílkovin` : ''}</span></h2><button class="xbtn" onclick="UI.closeModal()">×</button></div>
      <input type="text" id="pkq" placeholder="hledat jídlo nebo surovinu…" value="${esc(Picker.q)}" style="margin:10px 0 8px">
      <div class="frow"><span class="flab">Řadit</span><div class="seg">${[['fit', '💡 co se vejde'], ['recent', '🕓 naposledy'], ['kcal', 'kcal ↑'], ['prot', 'bílkoviny ↓'], ['name', 'A–Z']].map(([k, l]) => `<button class="${Picker.sort === k ? 'on' : ''}" onclick="Picker.sort='${k}';window._pk()">${l}</button>`).join('')}</div></div>
      <div class="frow"><span class="flab">Filtr</span><div class="chips">${chip(Picker.fav, (Picker.fav ? '✓ ' : '') + '⭐ oblíbené', "Picker.fav=!Picker.fav;window._pk()")}${chip(Picker.own, (Picker.own ? '✓ ' : '') + '📖 moje', "Picker.own=!Picker.own;window._pk()")}${chip(Picker.prot, (Picker.prot ? '✓ ' : '') + 'hodně bílkovin', "Picker.prot=!Picker.prot;window._pk()")}<select style="width:auto;min-height:32px;padding:4px 8px;font-size:13px;${Picker.kcal ? 'background:var(--p-bg);color:var(--p-ink);font-weight:700' : ''}" onchange="Picker.kcal=this.value;window._pk()"><option value="">kcal: vše</option>${ranges.map(([a, b]) => `<option value="${a}-${b}" ${Picker.kcal === `${a}-${b}` ? 'selected' : ''}>${a}–${b} kcal</option>`).join('')}</select>${Picker.fav || Picker.own || Picker.prot || Picker.kcal ? `<span class="chip" style="color:var(--bad)" onclick="Picker.fav=false;Picker.own=false;Picker.prot=false;Picker.kcal='';window._pk()">× zrušit filtry</span>` : ''}</div></div>
      <div class="row" style="margin-bottom:8px"><button class="btn sec sm" onclick="window._pick('${SITUACE}')">🎲 vyřeším podle situace</button><button class="btn sec sm" onclick="window._pick('${VYNECHAT}')">— vynechat</button>${ctx.current && ctx.current !== SITUACE && ctx.current !== VYNECHAT ? `<span class="pill">teď: ${esc(ctx.current)}</span>` : ''}</div>
      <div class="plist">${L.slice(0, 60).map(x => { const fits = ctx.remaining == null || x.kcal <= ctx.remaining + 30; return `<div class="pitem ${x.r.name === ctx.current ? 'cur' : ''}" onclick="window._pick(${JSON.stringify(x.r.name).replace(/"/g, '&quot;')})">
          <div style="flex:1;min-width:0"><div class="pn">${esc(x.r.name)}${x.r.own ? ' <span class="pill">moje</span>' : ''}</div><div class="pi">${x.items.map(it => esc(it.food)).join(' · ')}</div></div>
          <div class="pk ${fits ? '' : 'bad'}"><span class="${fits ? 'm-kcal' : ''}">${fmt0(x.kcal)}</span> <span>kcal</span><br><span class="m-prot">${fmt0(x.p)} g B</span></div>
          <button class="star ${prefs.favs.includes(x.r.name) ? 'on' : ''}" onclick="event.stopPropagation();A.favInPlace(this,${JSON.stringify(x.r.name).replace(/"/g, '&quot;')});Object.assign(prefs,Prefs())" title="oblíbené">${prefs.favs.includes(x.r.name) ? '★' : '☆'}</button></div>`; }).join('') || '<p class="muted small" style="padding:12px">Nic neodpovídá – zkus jiný filtr.</p>'}</div>`;
    const inp = m.querySelector('#pkq'); inp.oninput = e => { Picker.q = e.target.value; draw(); const i = m.querySelector('#pkq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); };
    if (Picker.q) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
  };
  window._pk = draw; window._pick = name => { m.remove(); noteRecent(name); ctx.onPick(name); };
  draw();
}

/* ===== Generátor týdne ===== */
function generateWeek(monday, mode, dayIdx) {
  const s = S(), foods = Foods(), recipes = Recipes(), w = currentWeight(); const prefs = Prefs();
  const wk = getWeek(monday); const prev = getWeek(addDays(monday, -7));
  const usedPrev = new Set(prev.plan.flat().filter(Boolean));
  const pools = s.courses.map(c => recipesFor(c.name).filter(r => !r.deleted).map(r => r.name));
  const rnd = () => Math.random();
  const pick = (ci, used) => { const pool = pools[ci]; if (!pool.length) return null;
    const cand = pool.map(n => ({ n, w: (prefs.favs.includes(n) ? 3 : 1) * (used.has(n) ? 0.05 : 1) * (usedPrev.has(n) ? 0.4 : 1) }));
    let tot = cand.reduce((a, c) => a + c.w, 0), r = rnd() * tot; for (const c of cand) { r -= c.w; if (r <= 0) return c.n; } return cand[cand.length - 1].n; };
  const days = mode === 'day' ? [dayIdx] : [0, 1, 2, 3, 4, 5, 6];
  // rutina: stejná snídaně a svačina celý týden
  const routine = routineOn() && mode !== 'day'; const fixed = {};
  if (routine) { [0, 2].forEach(ci => { const n = pick(ci, new Set()); if (n) fixed[ci] = n; }); }
  const used = new Set(wk.plan.flatMap((d, i) => days.includes(i) && mode !== 'empty' ? [] : d.filter(Boolean)));
  days.forEach(di => {
    let best = null, bestScore = Infinity;
    for (let t = 0; t < 40; t++) {
      const sels = wk.plan[di].map((v, ci) => (mode === 'empty' && v) ? v : (fixed[ci] || pick(ci, used)));
      const r = calcPlanDay(s, foods, recipes, sels, w, planActFor(addDays(monday, di), w));
      const over = Math.max(0, r.kcal - r.planLimit), under = Math.max(0, r.planLimit - 120 - r.kcal), pLack = Math.max(0, r.protTarget - r.p);
      const score = over * 3 + under * 0.5 + pLack * 6 + sels.reduce((a, n, ci) => a + (used.has(n) && !fixed[ci] ? 200 : 0), 0);
      if (score < bestScore) { bestScore = score; best = sels; }
      if (r.state === 2 && score < 60) break;
    }
    wk.plan[di] = best; best.forEach(n => used.add(n));
  });
  saveWeek(wk); return wk;
}
A.genWeek = mode => { const wk = getWeek(App.week); const has = wk.plan.flat().some(Boolean);
  const run = () => Undo.run('Návrh týdne', () => { generateWeek(App.week, mode); const w2 = getWeek(App.week); w2.reviewed = true; saveWeek(w2); render(); }, () => { const days = getWeek(App.week).plan.map(d => calcPlanDay(S(), Foods(), Recipes(), d, currentWeight())); const ok = days.filter(d => d.state === 2).length; return `${mode === 'empty' ? 'Prázdná místa doplněna' : 'Týden navržen'}: ${ok} ze 7 dnů v limitu. Změň, co nechceš, pak nákup.`; });
  if (mode === 'all' && has) UI.confirm('Přegenerovat celý týden? Současný výběr se přepíše (půjde vrátit).', run, 'Přegenerovat'); else run(); };
A.genDay = di => Undo.run('Návrh dne', () => { generateWeek(App.week, 'day', di); render(); }, () => { const r = calcPlanDay(S(), Foods(), Recipes(), getWeek(App.week).plan[di], currentWeight()); return `${DAY_NAMES[di]} přegenerováno – ${r.status}, ${fmt0(r.kcal)} kcal.`; });

/* ===== Hlas trenéra – jedna věta „co teď“ ===== */
function coachLine(date) { const _r = coachLine0(date); const pm = paceMessageForClient(); if (pm && date === todayISO()) _r.sub = pm; return _r; }
function coachLine0(date) {
  const s = S(), day = effectiveDay(date), d = calcDay(s, Foods(), Recipes(), day, currentWeight());
  const isToday = date === todayISO(); const tasks = dayTasks(date); const meas = Meas().find(m => m.date === date);
  const pr = praise(date);
  if (!isToday) return { em: '🗂️', main: `${DAY_NAMES[dayIndex(date)]} ${czDate(date)} – doplň, co si pamatuješ. Den se uzavře podle toho, co je zapsané.`, sub: pr[0].text, tone: 'neutral' };
  const next = tasks.find(t => !t.done && t.due) || tasks.find(t => !t.done);
  if (dayIndex(date) === 0 && nowMin() < 12 * 60 && next && next.id === 'weigh') { const rc = weekRecap(); if (rc) return { em: '📊', main: rc, sub: 'Nový týden – nejdřív na váhu.', tone: 'neutral' }; }
  const weighTxt = meas && meas.weight != null ? `Zvážil ses: ${fmt1(meas.weight)} kg, průměr ${fmt1(currentWeight())}.` : '';
  if (!next) return { em: '🎉', main: 'Všechno hotovo. ' + pr[0].text, sub: '', tone: 'good' };
  let main, sub = '';
  if (next.id === 'weigh') { main = 'Nejdřív na váhu – ráno, po WC, nalačno. Jedno číslo, deset vteřin.'; sub = pr[0].text; }
  else if (next.meal) { const c = s.courses.find(x => x.key === next.meal); const cc = d.courses.find(x => x.key === next.meal);
    main = next.chosen ? `${weighTxt} Teď ${c.name.toLowerCase()} (${c.time}): ${next.tx.split(' – ').slice(1).join(' – ')}${cc && cc.kcal ? `, ${fmt0(cc.kcal)} kcal` : ''}. Po jídle odklikni.` : `${weighTxt} Teď vyber ${c.name.toLowerCase()} (${c.time}) – zbývá ti ${fmt0(Math.max(0, d.remaining))} kcal${d.protTarget - d.tot.p > 0 ? ` a ${fmt0(d.protTarget - d.tot.p)} g bílkovin` : ''}.`;
    sub = d.remaining < -30 ? `Jsi ${fmt0(-d.remaining)} kcal přes – přidej ${Math.ceil(-d.remaining / d.base.walkPerMin)} minut chůze, nebo uber přílohu.` : pr[0].text; }
  else if (next.id === 'walk') { main = `Zbývá dojít ${s.walk_min - (day.walk_min || 0)} minut chůze – to je ${fmt0((s.walk_min - (day.walk_min || 0)) * d.base.walkPerMin)} kcal navíc.`; sub = pr[0].text; }
  else if (next.id === 'plan_now' || next.id === 'plan') { main = next.id === 'plan' ? 'Neděle: naplánuj příští týden – nebo nech appku, ať navrhne, a jen dolaď.' : 'Tenhle týden nemá plán – bez něj se den skládá naslepo. Nech si ho navrhnout.'; sub = pr[0].text; }
  else if (next.id === 'review') { main = 'Příští týden jsem ti navrhl. Projdi ho a změň, co nechceš – pak nákup.'; sub = pr[0].text; }
  else if (next.id === 'shop') { main = 'Plán je hotový. Teď nákup podle seznamu, ať to není jen papír.'; sub = pr[0].text; }
  else if (next.id === 'measure') { main = 'Neděle: změř obvody (pas, boky, hrudník, stehno, paže).'; sub = pr[0].text; }
  else if (next.id === 'close') { main = d.ok ? `Den sedí ve všem. Uzavři ho – deficit ${fmt0(d.dayDeficit)} kcal.` : `Před uzavřením: ${(d.checks.find(c => c.state === 1) || { text: 'zkontroluj den' }).text.toLowerCase()}.`; sub = pr[0].text; }
  else { main = next.tx; sub = pr[0].text; }
  return { em: next.em || '👉', main, sub, tone: d.remaining < -30 ? 'push' : 'neutral' };
}

/* ===== Kontrola věrohodnosti váhy ===== */
function weightPlausible(weight, date) {
  const rows = calcMeasurements(S(), Meas().filter(m => m.date !== date)); const prev = [...rows].reverse().find(r => r.date < date) || rows[rows.length - 1];
  if (!prev) return { ok: true }; const diff = weight - prev.avg;
  return Math.abs(diff) > 2 ? { ok: false, prev, diff } : { ok: true };
}

/* Pondělní rekapitulace minulého týdne */
function weekRecap() {
  const s = S(); const mon = addDays(mondayOf(todayISO()), -7); const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  const uid = Store.ownerId(); const recs = Object.fromEntries(Store.rows('days', uid).map(r => [r.data.date, r.data]));
  const evs = days.filter(dt => recs[dt]).map(dt => evaluateDay(dt)); if (!evs.length) return null;
  const ok = evs.filter(e => e.ok).length, walk = evs.reduce((a, e) => a + (e.day.walk_min || 0), 0), beers = evs.reduce((a, e) => a + e.cheats.beers, 0);
  const ov = calcOverview(s, Meas()); const wb = ov.weekBack && ov.weekBack.lostW != null ? `váha ${ov.weekBack.lostW >= 0 ? '−' : '+'}${fmt2(Math.abs(ov.weekBack.lostW))} kg` : 'váha bez porovnání';
  return `Minulý týden: ${ok} z ${evs.length} dnů v pořádku, ${fmt0(walk)} min chůze, ${beers} piv, ${wb}.`;
}
