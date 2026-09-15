/* ===== DNES ===== */
const SUMMARY_TIME = '20:30';
/* Rozdělení dne: naplánováno vs. snědeno */
function dayProgress(d, day) {
  let eaten = 0, planned = 0, missing = [];
  d.courses.forEach((c, i) => { const m = day.meals[c.key] || {}; if (c.active || c.situace) { if (m.eaten) eaten += c.kcal; else planned += c.kcal; } else if (!c.skipped) missing.push(S().courses[i]); });
  return { eaten, planned, missing, eatenP: d.courses.reduce((a, c) => a + ((day.meals[c.key] || {}).eaten ? c.p : 0), 0) };
}
/* Návrh jídla, které se vejde do zbytku dne (pro jeden chod) */
function suggestMeal(date, courseKey, exclude) {
  const s = S(), foods = Foods(), recipes = Recipes(), day = effectiveDay(date), prefs = Prefs();
  const d = calcDay(s, foods, recipes, day, weightAt(s, date)); const cc = d.courses.find(c => c.key === courseKey);
  const rem = d.remaining + cc.kcal, pg = d.protTarget - d.tot.p + cc.p;
  const used = new Set(s.courses.map(c => (day.meals[c.key] || {}).sel).filter(Boolean));
  const course = s.courses.find(c => c.key === courseKey);
  const cand = recipesFor(course.name).filter(r => r.name !== exclude && !used.has(r.name)).map(r => { const inf = calcCourse(s, foods, recipes, course, r.name, null, d.base.foodBudget);
    let sc = inf.kcal > rem + 30 ? 1000 + (inf.kcal - rem) : Math.abs(inf.kcal - Math.min(rem, inf.target)) * 0.5; if (pg > 0) sc -= Math.min(inf.p, pg) * 3; if (prefs.favs.includes(r.name)) sc -= 40; sc += Math.random() * 25; return { name: r.name, sc, kcal: inf.kcal }; }).sort((a, b) => a.sc - b.sc);
  return cand[0] || null;
}
function suggestDay(date) {
  const s = S(); const day = effectiveDay(date); const filled = [];
  s.courses.forEach(c => { const m = day.meals[c.key] || {}; if (!m.sel) { const sg = suggestMeal(date, c.key); if (sg) { day.meals[c.key] = { ...m, sel: sg.name, auto: true }; saveDay(day); filled.push(`${c.name.toLowerCase()} ${sg.name}`); } } });
  return filled;
}

VIEWS.dnes = function () {
  const s = S(), foods = Foods(), recipes = Recipes(), w = currentWeight();
  const isToday = App.date === todayISO();
  let day = effectiveDay(App.date);
  // automatický návrh dne, když není plán (jen dnes, jednou)
  if (isToday && !App.ro && !day.autoSuggested && !s.courses.some(c => (day.meals[c.key] || {}).sel)) {
    const filled = suggestDay(App.date); day = effectiveDay(App.date); day.autoSuggested = true; saveDay(day);
    if (filled.length) setTimeout(() => UI.toast('Na dnešek nebyl plán – navrhl jsem ti jídla. Změň, co nechceš.'), 300);
  }
  const d = calcDay(s, foods, recipes, day, w);
  const dn = DAY_NAMES[dayIndex(App.date)];
  const prog = dayProgress(d, day);
  const cl = coachLine(App.date); const note = coachNote(); const noteAt = (settingsRec() || { data: {} }).data.coach_note_at ? isoDate(new Date((settingsRec()).data.coach_note_at)) : null;
  const tasks = dayTasks(App.date); const doneN = tasks.filter(t => t.done).length;
  const st = streakOk(), ws = weighStreak();
  // pás dní
  const mon = mondayOf(todayISO()); const strip = [];
  for (let k = 0; k < 7; k++) { const dt = addDays(mon, k); const future = dt > todayISO(); const ev = future ? null : (dt < todayISO() ? evaluateDay(dt) : null);
    strip.push(`<button class="${dt === App.date ? 'on' : ''} ${ev && ev.ok ? 'has' : ''}" ${future ? 'disabled style="opacity:.45"' : ''} onclick="App.date='${dt}';render()">${DAY_SHORT[dayIndex(dt)]}<b>${parseISO(dt).getDate()}.</b></button>`); }
  // hlavní číslo: rezerva plánu proti limitu
  const reserve = d.remaining; const planned = d.tot.kcal > 0;
  let big, lbl, tone;
  if (!planned) { big = fmt0(d.base.maxIntake); lbl = 'kcal je dnešní limit – zatím nic naplánováno'; tone = 'grad3'; }
  else if (reserve < -30) { const pend = (d.base.planKcal || 0) - (d.base.doneKcal || 0); const walkPend = Math.max(0, d.base.planWalk - (day.walk_min || 0)) * d.base.walkPerMin; big = fmt0(-reserve); lbl = pend + walkPend >= -reserve ? `kcal nad limit teď – po plánované aktivitě (${fmt0(pend + walkPend)} kcal) bude sedět` : 'kcal nad limit – plán dne nesedí'; tone = pend + walkPend >= -reserve ? 'grad3' : 'grad2'; }
  else { big = fmt0(Math.max(0, reserve)); lbl = prog.missing.length ? `kcal ti ještě zbývá do limitu · chybí naplánovat ${prog.missing.map(c => c.name.toLowerCase()).join(', ')}` : 'kcal ti ještě zbývá do limitu – plán dne sedí'; tone = 'grad'; }
  const pctE = clamp(prog.eaten / d.base.maxIntake * 100, 0, 100), pctP = clamp(prog.planned / d.base.maxIntake * 100, 0, 100 - pctE);
  // karta Teď
  const now = renderNow(cl, d, day, tasks, s);
  return `
  <div class="row between" style="margin-bottom:8px"><h1>${isToday ? 'Dnes' : dn} <span class="muted" style="font-weight:600;font-size:15px">${czDate(App.date)}</span></h1>
    <div class="row">${st >= 2 ? `<span class="streak">🔥 ${st} dnů v řadě</span>` : ''}${ws >= 3 ? `<span class="streak" style="background:var(--p-bg);color:var(--p-ink)">⚖️ ${ws}× vážení</span>` : ''}</div></div>
  <div class="calstrip noprint" style="margin-bottom:12px">${strip.join('')}</div>
  ${isToday ? mismatchAlert(App.date) : ''}
  ${now}
  ${note ? `<div class="note"><span class="em">💬</span><div><div class="tiny muted" style="font-weight:700">Vzkaz od trenéra${noteAt ? ' · ' + czDateShort(noteAt) : ''}</div><div>${esc(note)}</div></div></div>` : ''}
  ${noteCard(App.date, day)}
  <div class="dgrid"><div class="colL">
   <div class="card ga-hero" style="padding:0;overflow:hidden">
    <div class="herob ${tone}"><div class="tiny" style="opacity:.9;font-weight:700;letter-spacing:.04em;text-transform:uppercase">${planned ? (reserve < -30 ? 'O kolik jsi nad limitem' : 'Kolik ti zbývá do limitu') : 'Limit dne'} <button class="ibtn" style="border-color:rgba(255,255,255,.6);background:transparent;color:#fff" onclick="event.stopPropagation();UI.pop(this,'Hlavní číslo = rezerva naplánovaných jídel proti limitu dne. Limit dne = celkový výdej (klidový výdej × 1,34 + cílený pohyb) − plánovaný deficit. Ukazatel: plná část snědeno, světlá naplánováno. Snědené značíš u jídla nebo v úkolech.')">i</button></div><div class="big">${big}</div><div class="lbl">${lbl}</div>
      <div class="bar2" style="margin-top:14px"><i class="e" style="width:${pctE}%"></i><i class="p" style="width:${pctP}%"></i></div>
      <div class="row between small" style="margin-top:6px"><span>■ snědeno ${fmt0(prog.eaten)} · ▢ naplánováno ${fmt0(prog.planned)}${d.base.drinkKcal ? ` · pití ${fmt0(d.base.drinkKcal)}` : ''}</span><span>limit ${fmt0(d.base.maxIntake)}</span></div></div>
    <div class="stats3">
      <div><b>${fmt0(d.intake)} <small>/ ${fmt0(d.base.maxIntake)}</small></b><span><span class="mdot kcal"></span>naplánováno kcal</span></div>
      <div><b class="${d.tot.p > 0 ? (d.tot.p >= d.protTarget ? 'ok' : 'bad') : ''}">${fmt0(d.tot.p)} <small>/ ${d.protTarget || s.protein_min}</small></b><span><span class="mdot prot"></span>bílkoviny (g)</span></div>
      <div><b class="${planned ? (d.dayDeficit >= d.base.deficit * 0.9 ? 'ok' : 'warn') : ''}">${planned ? fmt0(d.dayDeficit) : '–'}</b><span>${planned ? `dnešní deficit · ${fmt2(d.dayDeficit * 7 / KG_KCAL)} kg/týden, plán ${fmt2(w * s.rate_pct / 100)}` : 'dnešní deficit'}</span></div>
    </div>
   </div>
   ${renderActivityCard(App.date, day, d)}
  </div><div class="colR">
   <div class="card ga-tasks"><div class="row between"><h2>Úkoly dne</h2><span class="small muted">${doneN}/${tasks.length}</span></div>
    <div class="bar" style="margin:8px 0 10px;height:6px"><i style="width:${doneN / tasks.length * 100}%"></i></div>
    <div class="tasks">${tasks.map(t => `<div class="task ${t.done ? 'done' : ''} ${t.now ? 'now' : ''}" onclick="${t.meal ? `A.eaten('${t.meal}',${!t.done})` : t.id === 'walk' || t.id === 'training' ? `document.getElementById('aktivita').scrollIntoView({behavior:'smooth',block:'start'})` : `${t.week ? `App.week='${t.week}';` : ''}${t.view === 'dnes' ? "document.querySelector('#meals').scrollIntoView({behavior:'smooth'})" : `go('${t.view}')`}`}">
      <span class="ck">${t.done ? '✓' : ''}</span><span style="font-size:18px">${t.em}</span><div><div class="tx">${esc(t.tx)}</div>${t.sub ? `<div class="sub">${esc(t.sub)}</div>` : ''}</div><span class="go">${t.done ? '' : (t.meal ? (t.chosen ? 'snědl jsem' : 'vybrat') : 'otevřít')}${t.at && !t.done ? ` · ${t.at}` : ''}</span></div>`).join('')}</div></div>
  </div></div>

  <div class="grid g2" style="margin-top:12px">
   <div class="card"><h2>Kontrola dne</h2>
    <div class="checks" style="margin-top:6px">${d.checks.map(ch => `<div><span class="nm ${ch.name === 'Kalorie' ? 'm-kcal' : (ch.name === 'Bílkoviny' ? 'm-prot' : '')}">${ch.name}</span><span class="s${ch.state}">${esc(ch.text)}</span></div>`).join('')}</div>
    <div class="status st${d.ok ? 2 : (planned ? 1 : 0)}" style="margin-top:10px">${esc(d.summary)}</div>
    <details style="margin-top:10px"><summary class="small muted" style="cursor:pointer">Jak se limit počítá</summary>
    <table class="small" style="margin-top:6px"><tr><td>Aktuální váha (průměr 7 vážení)</td><td class="n">${fmt1(w)} kg</td></tr>
      <tr><td>Klidový výdej (Mifflin–St Jeor)</td><td class="n">${fmt0(d.base.bmr)} kcal</td></tr>
      <tr><td>Běžný výdej (klidový × ${String(s.activity).replace('.', ',')})</td><td class="n">${fmt0(d.base.baseOut)} kcal</td></tr>
      <tr><td>Cílený pohyb – chůze ${day.walk_min || 0} min${day.exercise_min ? ` + cvičení ${day.exercise_min} min` : ''}</td><td class="n">${fmt0(d.base.totalOut - d.base.baseOut)} kcal</td></tr>
      <tr><td>Celkový výdej</td><td class="n">${fmt0(d.base.totalOut)} kcal</td></tr>
      <tr><td>Plánovaný deficit (${String(s.rate_pct).replace('.', ',')} % váhy/týden)</td><td class="n">− ${fmt0(d.base.deficit)} kcal</td></tr>
      <tr><td class="b">Limit dne</td><td class="n b">${fmt0(d.base.maxIntake)} kcal</td></tr>
      <tr><td>Limit podle plánu (s cílem chůze a tréninkem)</td><td class="n">${fmt0(d.base.planLimit)} kcal</td></tr>
      <tr><td><span class="mdot carb"></span>Sacharidy / <span class="mdot fat"></span>tuky</td><td class="n"><b class="m-carb">${fmt0(d.tot.c)} g</b> / <b class="m-fat">${fmt0(d.tot.f)} g</b></td></tr></table></details>
   </div>
  </div>
  <div id="meals" class="row between" style="margin:8px 0 8px"><h2>🍽️ Jídla dne <span class="muted small" style="font-weight:600">${s.courses.some(c => day.meals[c.key].planned) ? `plán na ${dn.toLowerCase()}` : 'bez plánu z Týdne'}</span></h2>
    <div class="row noprint">${prog.missing.length ? `<button class="btn sm write" onclick="A.suggestDay()">💡 Navrhnout ${prog.missing.length === 5 ? 'den' : 'chybějící'}</button>` : ''}<button class="btn sec sm write" onclick="A.resetDay()">Vrátit plán z Týdne</button></div></div>
  <p class="small muted" style="margin-bottom:10px">Tady se den upravuje: změnit jídlo, vyměnit, odebrat nebo přidat surovinu, upravit gramy, nechat si navrhnout jinou variantu. Co jsi snědl, označ nahoře v úkolech nebo tlačítkem u jídla.</p>
  ${d.courses.map((c, i) => renderCourse(s, foods, recipes, day, c, i, d)).join('')}`;

};

/* Karta „Teď“ – jeden krok, jedno tlačítko */
function renderNow(cl, d, day, tasks, s) {
  const isToday = App.date === todayISO(); const now = nowMin();
  const next = tasks.find(t => !t.done && t.due) || tasks.find(t => !t.done);
  const evening = isToday && now >= timeToMin(SUMMARY_TIME);
  let body = '', action = '';
  if (!isToday) { body = `<div class="ntx">${esc(cl.main)}</div><div class="nsub">${esc(cl.sub || '')}</div>`; }
  else if (evening || !next) {
    const fails = d.checks.filter(c => c.state === 1);
    body = `<div class="ntx">${d.ok ? `Den hotový a v pořádku. Deficit ${fmt0(d.dayDeficit)} kcal, ${fmt2(d.dayDeficit * 7 / KG_KCAL)} kg za týden tímhle tempem.` : (d.tot.kcal ? `Den hotový, nesedí: ${fails.map(f => f.name.toLowerCase()).join(', ')}.` : 'Dnes nic zapsáno – zítra začni váhou a plánem.')}</div>
      <div class="nsub">${d.ok ? 'Zítra ráno: váha. Dobrou.' : esc((fails[0] || { text: '' }).text) + ' Zítra to dorovnáš.'}</div>`;
  } else {
    body = `<div class="ntx">${esc(cl.main)}</div>${cl.sub ? `<div class="nsub">${esc(cl.sub)}</div>` : ''}`;
    if (next.id === 'weigh') action = `<div class="row"><input type="number" step="0.1" id="nw" placeholder="kg" style="width:110px;font-size:18px;font-weight:800" inputmode="decimal"><button class="btn write" onclick="A.quickWeigh()">Zapsat váhu</button></div>`;
    else if (next.meal) { const c = s.courses.find(x => x.key === next.meal); action = next.chosen ? `<div class="row"><button class="btn write" onclick="A.eaten('${next.meal}',true)">✓ Snědl jsem ${c.name.toLowerCase()}</button><button class="btn sec sm write" onclick="document.getElementById('c-${next.meal}').scrollIntoView({behavior:'smooth'})">Změnit jídlo</button></div>` : `<div class="row"><button class="btn write" onclick="A.suggestOne('${next.meal}')">💡 Navrhni ${c.name.toLowerCase()}</button><button class="btn sec sm write" onclick="document.getElementById('c-${next.meal}').scrollIntoView({behavior:'smooth'})">Vyberu sám</button></div>`; }
    else if (next.id === 'walk') action = `<div class="row"><button class="btn write" onclick="A.addWalk(30)">+30 min chůze</button><button class="btn sec sm write" onclick="A.addWalk(60)">+60</button><button class="btn sec sm write" onclick="A.addWalk(15)">+15</button></div>`;
    else if (next.id === 'plan_now' || next.id === 'plan') action = `<div class="row"><button class="btn write" onclick="App.week='${next.week}';go('tyden');setTimeout(()=>A.genWeek(weekPlanned(App.week)?'empty':'all'),50)">✨ Navrhnout týden</button><button class="btn sec sm" onclick="App.week='${next.week}';go('tyden')">Otevřít Týden</button></div>`;
    else if (next.id === 'shop') action = `<div class="row"><button class="btn" onclick="App.week='${next.week}';go('nakup')">🛒 Otevřít nákup</button></div>`;
    else if (next.id === 'measure') action = `<div class="row"><button class="btn" onclick="go('mereni')">📏 Zapsat obvody</button></div>`;
    else if (next.id === 'review') action = `<div class="row"><button class="btn" onclick="App.week='${next.week}';go('tyden')">Projít návrh týdne</button></div>`;
  }
  const upcoming = isToday && next ? tasks.filter(t => !t.done && t !== next).slice(0, 2) : [];
  return `<div class="now"><div class="nhead"><span class="em">${evening && isToday ? '🌙' : cl.em}</span><span class="nlab">${!isToday ? 'Zpětně' : (evening ? 'Shrnutí dne' : 'Teď')}</span>${upcoming.length ? `<span class="nnext">potom: ${upcoming.map(t => `${t.em} ${esc(t.tx.split(' – ')[0])}${t.at ? ' ' + t.at : ''}`).join(' · ')}</span>` : ''}</div>${body}${action ? `<div style="margin-top:10px">${action}</div>` : ''}</div>`;
}

function renderCourse(s, foods, recipes, day, c, i, d) {
  const cs = s.courses[i]; const m = day.meals[cs.key] || {};
  const cur = m.sel; const label = !cur ? '+ vyber jídlo' : cur;
  const remaining = d.remaining + c.kcal; const protGap = d.protTarget - d.tot.p + c.p;
  const foodOpts = fsel => Foods().map(f => `<option value="${esc(f.name)}" ${f.name === fsel ? 'selected' : ''}>${esc(f.name)}</option>`).join('');
  const pickBtn = `<button class="pickbtn ${cur ? '' : 'empty'}" onclick="openPicker({courseKey:'${cs.key}',current:${JSON.stringify(cur || '').replace(/"/g, '&quot;')},remaining:${Math.round(remaining)},protGap:${Math.round(protGap)},onPick:n=>A.selMeal('${cs.key}',n)})"><span>${esc(label)}</span><em>změnit ›</em></button>`;
  let body = '';
  if (c.active) {
    body = `<div class="tbl"><table class="items"><tr><th>Surovina</th><th class="n">g</th><th class="n m-kcal">kcal</th><th class="n m-prot">bílk.</th><th></th></tr>` +
      c.items.map(it => it.extra ? `<tr><td><select class="sw edit" onchange="A.extraFood('${cs.key}',${String(it.idx).slice(1)},this.value)">${foodOpts(it.food)}</select><div class="tiny muted">přidáno</div></td>
        <td class="n"><input class="g edit" type="number" min="0" step="5" value="${it.g}" onchange="A.extraG('${cs.key}',${String(it.idx).slice(1)},this.value)"></td><td class="n">${fmt0(it.kcal)}</td><td class="n">${fmt1(it.p)}</td><td class="n"><button class="xbtn write" title="odebrat" onclick="A.extraDel('${cs.key}',${String(it.idx).slice(1)})">×</button></td></tr>`
      : `<tr><td>${modeBadge(it.food)}<select class="sw ${it.swapped ? 'edit' : ''}" style="width:calc(100% - 26px)" onchange="A.swap('${cs.key}',${it.idx},this.value)">${foodOpts(it.food)}</select>${it.swapped ? `<div class="tiny muted">recept: ${esc(it.origFood)}</div>` : ''}</td>
        <td class="n"><input class="g ${it.manual ? 'edit' : ''}" type="number" min="0" step="5" value="${it.g}" onchange="A.gram('${cs.key}',${it.idx},this.value)">${it.scale && !it.manual && it.g !== it.origG ? `<div class="tiny muted">recept ${it.origG} g · přizpůsobeno tvému limitu</div>` : ''}<div class="tiny muted">${measureText(it.food, it.g)}</div></td>
        <td class="n">${fmt0(it.kcal)}</td><td class="n">${fmt1(it.p)}</td><td class="n"><button class="xbtn write" title="odebrat" onclick="A.removeItem('${cs.key}',${it.idx})">×</button></td></tr>`).join('') +
      (c.removedItems || []).map(r => `<tr class="muted"><td colspan="4" style="text-decoration:line-through">${esc(r.food)} ${r.g} g</td><td class="n"><button class="xbtn write" title="vrátit" onclick="A.unremoveItem('${cs.key}',${r.idx})">↺</button></td></tr>`).join('') +
      `<tr><td class="b">celkem</td><td></td><td class="n b">${fmt0(c.kcal)}</td><td class="n b">${fmt1(c.p)}</td><td></td></tr></table></div>` +
      `<div class="row" style="margin-top:8px"><button class="btn sec sm write" onclick="A.extraAdd('${cs.key}')">+ přidat surovinu</button>${c.edited ? `<button class="btn sec sm write" onclick="A.resetCourse('${cs.key}')">Vrátit recept beze změn</button>` : ''}</div>`;
  } else if (c.situace) body = `<p class="small muted">Vyřešíš na místě – cíl jídla ${fmt0(cs.kcal)} kcal, min. ${SEED.settings.courses[i].prot_min} g bílkovin. Napiš, co jsi snědl – appka rozpozná suroviny, gramy dolaď.</p>
      <div class="row"><input type="text" id="ate-${cs.key}" value="${esc(m.ate_text || '')}" placeholder="např. 2 rohlíky se šunkou a sýrem, jablko" style="flex:1;min-width:200px"><button class="btn sec sm write" onclick="A.ateText('${cs.key}',document.getElementById('ate-${cs.key}').value)">Rozpoznat</button></div>
      ${(m.extra || []).length ? `<div class="tbl"><table class="items" style="margin-top:8px"><tr><th>Surovina</th><th class="n">g</th><th class="n">kcal</th><th></th></tr>${(m.extra || []).map((ex, j) => { const f = foods.find(x => x.name === ex.food); return `<tr><td>${modeBadge(ex.food)}<select class="sw edit" style="width:calc(100% - 26px)" onchange="A.extraFood('${cs.key}',${j},this.value)">${foodOpts(ex.food)}</select><div class="tiny muted">${measureText(ex.food, ex.g)}</div></td><td class="n"><input class="g edit" type="number" min="0" step="5" value="${ex.g}" onchange="A.extraG('${cs.key}',${j},this.value)"></td><td class="n">${f ? fmt0(f.kcal * ex.g / 100) : ''}</td><td class="n"><button class="xbtn write" onclick="A.extraDel('${cs.key}',${j})">×</button></td></tr>`; }).join('')}<tr><td class="b">celkem</td><td></td><td class="n b">${fmt0((m.extra || []).reduce((a, ex) => { const f = foods.find(x => x.name === ex.food); return a + (f ? f.kcal * ex.g / 100 : 0); }, 0))}</td><td></td></tr></table></div><p class="hint">Do součtu dne se počítá cíl jídla; tvůj zápis je pro tebe a trenéra.</p>` : ''}`;
  else if (c.skipped) body = `<p class="small muted">Vynecháno.</p>`;
  const st = c.active ? (Math.abs(c.kcal - c.target) <= 30 ? 'ok' : (c.kcal > c.target ? 'bad' : 'warn')) : '';
  const eaten = !!m.eaten;
  const open = App.openCourse === cs.key;   // jídla jsou sbalená, rozkliknutím se otevře editace
  const sum = !cur ? 'nevybráno' : (cur === VYNECHAT ? 'vynecháno' : cur);
  return `<div class="course ${eaten ? 'eaten' : ''} ${open ? 'open' : ''}" id="c-${cs.key}"><div class="hd" onclick="A.toggleCourse('${cs.key}')" title="${open ? 'sbalit' : 'rozbalit a upravit'}"><span style="font-size:18px">${COURSE_EMOJI[cs.key]}</span><span class="t">${esc(cs.name)}</span><span class="time">${cs.time}</span>
      <span class="csum ${cur ? '' : 'muted'}">${esc(sum)}</span>
      ${cur && cur !== VYNECHAT ? `<button class="eat ${eaten ? 'on' : ''} write" onclick="event.stopPropagation();A.eaten('${cs.key}',${!eaten})">${eaten ? '✓ snědeno' : 'snědl jsem'}</button>` : ''}${cur && cur !== SITUACE && cur !== VYNECHAT ? `<button class="star ${isFav(cur) ? 'on' : ''}" onclick="event.stopPropagation();A.favInPlace(this,${JSON.stringify(cur).replace(/"/g, '&quot;')})" title="oblíbené">${isFav(cur) ? '★' : '☆'}</button>` : ''}
      <span class="k ${st}">${c.active || c.situace ? fmt0(c.kcal) + ' kcal' : ''}</span><span class="cotog">${open ? '▴' : '▾'}</span></div>
    ${!open ? '' : `<div class="bd"><div class="row" style="gap:6px"><div style="flex:1;min-width:0">${pickBtn}</div><button class="btn sec sm write" title="navrhnout jinou variantu, která se vejde" onclick="A.suggestOne('${cs.key}')">💡 jiné</button></div>
    <div class="hint">${c.active ? (() => { const t = toleranceText(c.kcal, c.target); return `<b class="${t.ok ? 'ok' : 'warn'}">${t.text}</b> · cíl ${fmt0(c.target)} kcal`; })() : esc(c.hint)}${m.sel && m.planned && m.sel !== m.planned ? ` · místo plánu (${esc(m.planned)})` : ''}${m.auto ? ' · navrženo appkou' : ''}</div>
    <div style="margin-top:8px">${body}</div></div>`}</div>`;
}

A.toggleCourse = key => { App.openCourse = App.openCourse === key ? null : key; render(); };

/* ---- akce Dnes (vše se Zpět a hláškou) ---- */
const dayMsg = (lead) => () => { const d = calcDay(S(), Foods(), Recipes(), effectiveDay(App.date), currentWeight()); const st = d.tot.kcal === 0 ? '' : (d.remaining < -30 ? ` Den je ${fmt0(-d.remaining)} kcal přes limit.` : ` Den sedí, rezerva ${fmt0(Math.max(0, d.remaining))} kcal.`); return lead + st; };
A.dayField = (f, v, label) => Undo.run(label || 'Změna dne', () => { const day = effectiveDay(App.date); day[f] = v === '' ? null : Number(v); saveDay(day); render(); }, dayMsg(label || 'Uloženo.'));
A.setWalk = v => Undo.run('Chůze', () => { const day = effectiveDay(App.date); day.walk_min = v === '' ? null : Number(v); saveDay(day); render(); }, () => { const day = effectiveDay(App.date); const s = S(); const left = s.walk_min - (day.walk_min || 0); return left > 0 ? `Chůze ${day.walk_min || 0} min. Zbývá ${left} min do cíle.` : `Chůze ${day.walk_min} min – cíl splněn.`; });
A.addWalk = n => { const day = effectiveDay(App.date); A.setWalk((day.walk_min || 0) + n); };
A.selMeal = (key, v) => Undo.run('Změna jídla', () => { const day = effectiveDay(App.date); day.meals[key] = { sel: v || null, planned: day.meals[key].planned, eaten: false }; saveDay(day); noteRecent(v); render(); }, dayMsg(`${S().courses.find(c => c.key === key).name}: ${v === SITUACE ? 'vyřešíš podle situace' : (v === VYNECHAT ? 'vynecháno' : v)}.`));
A.eaten = (key, v) => { if (v) { buzz(30); setTimeout(() => { const dd = calcDay(S(), Foods(), Recipes(), effectiveDay(App.date), currentWeight()); const tk = dayTasks(App.date); if (tk.filter(t => t.meal).every(t => t.done) && dd.ok) celebrate('day'); }, 50); } return A.eaten0(key, v); };
A.eaten0 = (key, v) => Undo.run(v ? 'Snědeno' : 'Zrušit snědeno', () => { const day = effectiveDay(App.date); day.meals[key].eaten = v; saveDay(day); render(); }, () => { const s = S(); const c = s.courses.find(x => x.key === key); if (!v) return `${c.name} označena jako nesnědená.`; const tasks = dayTasks(App.date); const nx = tasks.find(t => !t.done && t.meal) || tasks.find(t => !t.done); return `${c.name} snědena.` + (nx ? ` Další: ${nx.tx.split(' – ')[0]}${nx.at ? ' v ' + nx.at : ''}.` : ' Všechna jídla hotová.'); });
A.swap = (key, idx, v) => Undo.run('Výměna suroviny', () => { const day = effectiveDay(App.date); const m = day.meals[key]; m.swaps = m.swaps || {}; m.swaps[idx] = v; saveDay(day); render(); }, dayMsg(`Surovina vyměněna za ${v}.`));
A.gram = (key, idx, v) => Undo.run('Gramy', () => { const day = effectiveDay(App.date); const m = day.meals[key]; m.grams = m.grams || {}; if (v === '') delete m.grams[idx]; else m.grams[idx] = Number(v); saveDay(day); render(); }, dayMsg(`Gramáž upravena na ${v} g.`));
A.resetCourse = key => Undo.run('Vrátit recept', () => { const day = effectiveDay(App.date); const m = day.meals[key]; delete m.swaps; delete m.grams; delete m.removed; delete m.extra; saveDay(day); render(); }, 'Recept vrácen beze změn.');
A.removeItem = (key, idx) => Undo.run('Odebrat surovinu', () => { const day = effectiveDay(App.date); const m = day.meals[key]; m.removed = m.removed || {}; m.removed[idx] = true; saveDay(day); render(); }, dayMsg('Surovina odebrána.'));
A.unremoveItem = (key, idx) => Undo.run('Vrátit surovinu', () => { const day = effectiveDay(App.date); const m = day.meals[key]; if (m.removed) delete m.removed[idx]; saveDay(day); render(); }, dayMsg('Surovina vrácena.'));
A.extraAdd = key => Undo.run('Přidat surovinu', () => { const day = effectiveDay(App.date); const m = day.meals[key]; m.extra = m.extra || []; m.extra.push({ food: 'Zelenina míchaná', g: 100 }); saveDay(day); render(); }, 'Přidán řádek – vyber surovinu a gramy.');
A.extraFood = (key, j, v) => Undo.run('Surovina', () => { const day = effectiveDay(App.date); day.meals[key].extra[j].food = v; saveDay(day); render(); }, dayMsg(`Přidáno: ${v}.`));
A.extraG = (key, j, v) => Undo.run('Gramy', () => { const day = effectiveDay(App.date); day.meals[key].extra[j].g = Number(v); saveDay(day); render(); }, dayMsg(`Gramáž ${v} g.`));
A.extraDel = (key, j) => Undo.run('Odebrat přidanou surovinu', () => { const day = effectiveDay(App.date); day.meals[key].extra.splice(j, 1); saveDay(day); render(); }, dayMsg('Přidaná surovina odebrána.'));
A.resetDay = () => Undo.run('Vrátit plán', () => { const day = getDay(App.date); day.meals = {}; day.autoSuggested = true; saveDay(day); render(); }, 'Jídla vrácena na plán z Týdne. Chůze a piva zůstaly.');
A.suggestOne = key => { const cur = (effectiveDay(App.date).meals[key] || {}).sel; const sg = suggestMeal(App.date, key, cur); if (!sg) { UI.toast('Nenašel jsem jinou variantu.'); return; }
  Undo.run('Návrh jídla', () => { const day = effectiveDay(App.date); day.meals[key] = { sel: sg.name, planned: day.meals[key].planned, auto: true }; saveDay(day); noteRecent(sg.name); render(); }, dayMsg(`Navrženo: ${sg.name} (${fmt0(sg.kcal)} kcal).`)); };
A.suggestDay = () => Undo.run('Návrh dne', () => { suggestDay(App.date); render(); }, dayMsg('Chybějící jídla doplněna podle zbývajícího limitu.'));
A.quickWeigh = () => { buzz(20); const v = Number(document.querySelector('#nw').value); if (!v) { UI.toast('Zapiš číslo v kg'); return; } App.measDate = App.date;
  const pl = weightPlausible(v, App.date);
  const save = () => Undo.run('Váha', () => { const ex = Meas().find(m => m.date === App.date) || { date: App.date }; saveMeas({ ...ex, weight: v }); render(); }, () => { const ov = calcOverview(S(), Meas()); return `Váha ${fmt1(v)} kg zapsána. Průměr 7 dní ${fmt1(ov.cur)} kg${ov.dev != null ? (ov.dev >= 0 ? `, ${fmt2(ov.dev)} kg před plánem.` : `, ${fmt2(-ov.dev)} kg za plánem.`) : '.'}`; });
  if (!pl.ok) { const mm = UI.modal(`<h2>Sedí to?</h2><p class="muted" style="margin-top:8px">Zapisuješ <b>${fmt1(v)} kg</b>, průměr posledních dnů je <b>${fmt1(pl.prev.avg)} kg</b>. Rozdíl ${(pl.diff > 0 ? '+' : '−') + fmt1(Math.abs(pl.diff))} kg je nezvyklý – překlep?</p><div class="row" style="margin-top:12px"><button class="btn sec" onclick="UI.closeModal()">Opravím</button><button class="btn" id="mfy">Je to správně</button></div>`); mm.querySelector('#mfy').onclick = () => { mm.remove(); save(); }; return; }
  save(); };
A.favInPlace = (btn, name) => { toggleFav(name); const on = isFav(name); btn.classList.toggle('on', on); btn.textContent = on ? '★' : '☆'; UI.toast(on ? `${name} přidáno do oblíbených.` : `${name} odebráno z oblíbených.`); };
