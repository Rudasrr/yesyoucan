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

/* ===== Otevřený list, který se překreslí po každé změně =====
   Akce v listu volají render() jako všude jinde; render() pak překreslí i list,
   takže číslo v listu i na stránce pod ním sedí. */
function openSheet(build, opts) {
  const m = UI.modal(build(), opts);
  const redraw = () => { if (!document.body.contains(m)) { if (window._sheetRedraw === redraw) window._sheetRedraw = null; return; } UI.resheet(m, build()); };
  window._sheetRedraw = redraw;
  m._onclose = () => { if (window._sheetRedraw === redraw) window._sheetRedraw = null; };
  return m;
}
const ROW_CK = (on, act, cls) => `<button class="ck ${on ? 'on' : ''} ${cls || ''} write" onclick="event.stopPropagation();${act}" aria-label="${on ? 'hotovo' : 'odškrtnout'}">${on ? '✓' : ''}</button>`;
const ROW_NOCK = '<span class="ck na"></span>';

VIEWS.dnes = function () {
  const s = S(), foods = Foods(), recipes = Recipes(), w = currentWeight();
  const isToday = App.date === todayISO();
  if (App.date > todayISO()) App.date = todayISO();
  let day = effectiveDay(App.date);
  /* Automatický návrh dne, když není plán (jen dnes, jednou). Dřív to hlásil toast
     při každém otevření; teď to řekne štítek „návrh“ u jídla. */
  if (isToday && !App.ro && !day.autoSuggested && !s.courses.some(c => (day.meals[c.key] || {}).sel)) {
    suggestDay(App.date); day = effectiveDay(App.date); day.autoSuggested = true; saveDay(day);
  }
  const d = calcDay(s, foods, recipes, day, w);
  const dn = DAY_NAMES[dayIndex(App.date)];
  const tasks = dayTasks(App.date);
  const st = streakOk();
  return `
  <div class="ph"><button class="iconbtn" onclick="A.dayShift(-1)" aria-label="předchozí den">‹</button>
    <div class="pt"><h1>${isToday ? 'Dnes' : dn}</h1><span class="sub">${isToday ? dn.toLowerCase() + ' ' : ''}${czDateShort(App.date)}</span></div>${isToday ? `<span class="chip2 acc">${ico('flame')} ${Math.max(st, weighStreak()) >= 1 ? `${Math.max(st, weighStreak())} ${sklon(Math.max(st, weighStreak()), 'den', 'dny', 'dní')} v řadě` : 'nová série'}</span>` : ''}
    <div class="act">${isToday ? '' : `<button class="btn sec sm" onclick="App.date=todayISO();render()">Dnes</button>`}<button class="iconbtn" onclick="A.dayShift(1)" ${isToday ? 'disabled' : ''} aria-label="další den">›</button><button class="iconbtn" onclick="A.dayMenu()" aria-label="další akce">⋯</button></div></div>
  ${s.maintain ? `<div class="notice">🏁 Udržování – cíl dosažen, deficit je nula. Jíš na celkový výdej.</div>` : isMaintWeek(s, App.date) ? `<div class="notice">Přestávka v deficitu – tento týden deficit nula, limit na celkovém výdeji. Jídlo, chůze i trénink jedou dál.</div>` : ''}
  ${resumeCard()}
  ${renderRings(d, day, s)}
  ${nextCard(day, tasks, s)}
  ${dayNotes(day, tasks)}
  <div class="card flush"><div class="list" id="timeline">${dayRows(d, day, tasks, s).join('')}</div></div>`;
};
A.dayShift = n => { const t = addDays(App.date, n); App.date = t > todayISO() ? todayISO() : t; render(); };

/* ---- Dnes (6. 10. 2026): jídlo a pohyb jsou stejně důležité – dva kroužky nahoře ----
   Kroužek Jídlo = kolik ještě sníst z limitu, kroužek Pohyb = kolik minut chůze a tréninku
   zbývá. Pod nimi, co přesně ujít a odcvičit. Robert nevidí červenou ani srovnání s plánem. */
function ringSvg(pct, size, col, track, big, small) { const r = size / 2 - 10, c = 2 * Math.PI * r;
  return `<svg class="bring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${track}" stroke-width="14"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${col}" stroke-width="14" stroke-linecap="round" stroke-dasharray="${(c * Math.max(0.015, Math.min(1, pct))).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/><text x="${size / 2}" y="${size / 2 + 3}" text-anchor="middle" font-size="${size / 5}" font-weight="850" fill="#0f172a">${big}</text><text x="${size / 2}" y="${size / 2 + size / 7}" text-anchor="middle" font-size="${size / 12}" fill="#64748b">${small}</text></svg>`; }
function renderRings(d, day, s) {
  const prog = dayProgress(d, day); const lim = d.base.maxIntake; const left = lim - prog.eaten;
  const items = (day.act || {}).items || []; const done = (day.training || {}).done || {};
  const trMin = Math.round(items.reduce((a, it) => a + itemMinutes(it), 0)), trDone = Math.round(items.reduce((a, it, i) => a + (done[i] ? itemMinutes(it) : 0), 0));
  const wt = d.base.planWalk, wm = day.walk_min || 0; const mPlan = wt + trMin, mDone = Math.min(wm, wt) + trDone, mLeft = Math.max(0, mPlan - mDone);
  const isToday = App.date === todayISO();
  return `<div class="card rings2" id="hero">
    <div class="two"><button class="rg" onclick="A.dayCheck()">${ringSvg(prog.eaten / (lim || 1), 128, left < 0 ? '#d97706' : '#2563eb', '#e0eaff', left < 0 ? '+' + fmt0(-left) : fmt0(left), left < 0 ? 'kcal nad limit' : 'kcal zbývá')}<b>${ico('fork')} Jídlo</b></button>
      <button class="rg" onclick="A.walkSheet()">${ringSvg(mDone / (mPlan || 1), 128, '#16a34a', '#dcfce7', mLeft ? fmt0(mLeft) : ico('check').replace('class="ic"', 'class="ic" x="46" y="41" width="36" height="36"'), mLeft ? 'min zbývá' : 'pohyb splněný')}<b>${ico('walk')} Pohyb</b></button></div>
    <div class="moves"><button onclick="A.walkSheet()"><b>${wm} / ${wt} min</b><span>chůze · ${paceTxt(d.base.kmh)} /km</span></button>
      ${trMin ? `<button onclick="A.trainSheet()"><b>${trDone} / ${trMin} min</b><span>trénink · ${items.length} ${sklon(items.length, 'cvik', 'cviky', 'cviků')}</span></button>` : `<button onclick="A.dayCheck()"><b>${fmt0(prog.eatenP)} / ${d.protTarget || s.protein_min} g</b><span>bílkoviny</span></button>`}</div>
    ${left < 0 && isToday ? `<div class="rnote">Dnes víc – nevadí. Chůze navíc to srovná: ${Math.ceil(-left / d.base.walkPerMin)} min.</div>` : ''}</div>`;
}
/* Další krok: jedna karta s jedním tlačítkem (to samé jde i ťuknutím na řádek v seznamu) */
/* další krok: v jakoukoli hodinu jedna jasná věc, jak na ni, a tlačítko (7. 10. 2026) */
function pickNext(tasks) { const ok = t => !t.done && !t.late; return tasks.find(t => ok(t) && t.due) || tasks.find(ok); }
function nextCard(day, tasks, s) {
  if (App.date !== todayISO() || App.ro) return '';
  // víc jídel, jejichž čas už minul a nejsou odškrtnutá → jedno ťuknutí pro všechna
  const pastMeals = tasks.filter(t => t.meal && !t.done && t.due && t.chosen && t.at && timeToMin(t.at) + 60 <= nowMin());
  if (pastMeals.length >= 2 && !tasks.some(t => t.id === 'close_y'))
    return `<div class="nextc"><div class="t">Další krok</div><b>Odškrtni, co už jsi snědl</b><div class="how">${pastMeals.map(t => esc(s.courses.find(c => c.key === t.meal).name.toLowerCase())).join(', ')} – jedl jsi podle plánu? Co bylo jinak, oprav ťuknutím na jídlo v seznamu.</div>
      <div class="row"><button class="btn write" onclick="A.eatenMany('${pastMeals.map(t => t.meal).join(',')}')">${ico('check')} Snědl jsem všechno do teď</button></div></div>`;
  const next = pickNext(tasks);
  if (!next) { const tm = addDays(todayISO(), 1); const ap = dayActivityPlan(tm); const nItems = (ap.items || []).length;
    return `<div class="nextc done"><div class="t">Dnešek</div><b>Všechno hotové. Pěkná práce.</b><div class="how">Zítra: ráno váha${nItems ? `, trénink (${nItems} ${sklon(nItems, 'cvik', 'cviky', 'cviků')})` : ''} a ${ap.walk_min ?? s.walk_min} minut chůze.</div></div>`; }
  const c = next.meal ? s.courses.find(x => x.key === next.meal) : null; const sel = c ? (day.meals[next.meal] || {}).sel : null;
  const title = next.id === 'weigh' ? 'Ráno na váhu' : c ? `${c.name} v ${c.time}${sel && sel !== SITUACE && sel !== VYNECHAT ? ' – ' + esc(sel) : ''}` : next.id === 'walk' ? `Chůze ${(day.act || {}).planWalk || s.walk_min} min` : next.id === 'training' ? 'Trénink' : next.id === 'steps' ? 'Zapiš kroky z telefonu' : next.id === 'close' ? 'Potvrď den' : esc(next.tx || '');
  return `<div class="nextc"><div class="t">Další krok</div><b>${next.id === 'close_y' ? 'Potvrď včerejšek' : title}</b>${nextHow(next, day, s) ? `<div class="how">${nextHow(next, day, s)}</div>` : ''}<div class="row">${nextAction(next, s)}</div></div>`;
}
/* jedna věta „jak na to“ ke každému kroku */
function nextHow(next, day, s) {
  if (next.id === 'close_y') return 'Ťukni a potvrď, že jsi jedl podle plánu. Co bylo jinak, oprav u jídla – trenér pak vidí, jak ti to jde.';
  if (next.id === 'weigh') return 'Po WC, nalačno, bez oblečení. Napiš číslo z váhy – appka počítá s průměrem 7 dní, jedno číslo nic neznamená.';
  if (next.meal) { const i = s.courses.findIndex(c => c.key === next.meal); const c = calcDay(s, Foods(), Recipes(), day, currentWeight()).courses[i];
    return next.chosen ? (c && c.active ? `Na talíř ${fmt0(c.gc)} g · ${fmt0(c.kcal)} kcal. Detail a suroviny po ťuknutí na jídlo v seznamu.` : 'Až sníš, ťukni Snědl jsem. Když to bylo jinak, ťukni Změnit.') : 'Ještě nemáš vybráno – appka navrhne jídlo, které se vejde do zbytku dne.'; }
  if (next.id === 'walk') return `Svižně, tempem ${paceTxt((day.walk_kmh || s.walk_kmh))} /km. Po procházce přičti ušlé minuty – klidně po částech.`;
  if (next.id === 'training') { const st = trStats({ walk_min: 0, items: (day.act || {}).items || [] }, currentWeight()); return `${st.exN} ${sklon(st.exN, 'cvik', 'cviky', 'cviků')}, asi ${st.trMin + st.carMin} minut. Ťukni Začít – appka tě provede sérií po sérii i pauzami.`; }
  if (next.id === 'steps') return 'V telefonu Zdraví → Kroky → číslo za dnešek. Zapiš celé číslo, procházku si appka odečte sama.';
  if (next.id === 'close') return 'Ťukni „Jedl jsem podle plánu“. Co bylo jinak, oprav u jídla. Pak pár ťuknutí, jak šel den.';
  if (next.id === 'plan_now' || next.id === 'plan') return 'Appka navrhne jídla na celý týden podle tvého limitu. Pak jen vyměníš, co nechceš.';
  if (next.id === 'shop') return 'Seznam je seřazený podle regálů. Co koupíš, odškrtni.';
  if (next.id === 'measure') return 'Krejčovský metr, ráno, vždy na stejném místě: pas v pupku, boky v nejširším místě.';
  return '';
}
/* ---- velké číslo: kolik ještě můžu sníst ---- */
/* kontrola dne a vzorec – dřív uprostřed stránky pod dvěma rozbalovátky */
A.dayCheck = () => openSheet(() => {
  const s = S(), w = currentWeight(), day = effectiveDay(App.date), d = calcDay(s, Foods(), Recipes(), day, w);
  return UI.sheetHtml('Kontrola dne', czDate(App.date), renderDayCheck(d, s, day, w, d.tot.kcal > 0));
});

const eatenN = (day, s) => s.courses.filter(c => (day.meals[c.key] || {}).eaten).length;
const activeN = d => d.courses.filter(c => c.active || c.situace).length;
/* ---- další krok: tlačítka přímo pod zvýrazněným řádkem seznamu (dřív zvláštní karta Teď,
   která opakovala první řádek) ---- */
function nextAction(next, s) {
  if (!next) return '';
  if (next.id === 'weigh') return `<div class="row nowrap"><input type="text" inputmode="decimal" id="nw" placeholder="kg" style="width:110px;font-size:18px;font-weight:800;text-align:center"><button class="btn write" onclick="A.quickWeigh()">Zapsat váhu</button></div>`;
  if (next.meal) { const c = s.courses.find(x => x.key === next.meal);
    return next.chosen ? `<button class="btn write" onclick="A.eaten('${next.meal}',true)">${ico('check')} Snědl jsem</button><button class="btn sec write" onclick="A.mealSheet('${next.meal}')">Změnit</button>`
      : `<button class="btn write" onclick="A.suggestOne('${next.meal}')">${ico('star')} Navrhni ${esc(c.name.toLowerCase())}</button><button class="btn sec write" onclick="A.pickMeal('${next.meal}')">Vyberu sám</button>`; }
  if (next.id === 'walk') return [15, 30, 60].map(n => `<button class="btn ${n === 30 ? '' : 'sec'} write" onclick="A.addWalk(${n})">+${n} min</button>`).join('');
  if (next.id === 'training') return `<button class="btn write" onclick="A.trRun(0)">${ico('dumbbell')} Začít cvičit</button><button class="btn sec write" onclick="A.trainSheet()">Zapsat hotovo</button>`;
  if (next.id === 'steps') return `<button class="btn write" onclick="A.stepsSheet()">${ico('feet')} Zapsat kroky</button>`;
  if (next.id === 'close') return `<button class="btn write" onclick="A.closeDay()">${ico('check')} Potvrdit den</button>`;
  if (next.id === 'close_y') return `<button class="btn write" onclick="A.closeYesterday()">${ico('check')} Potvrdit včerejšek</button>`;
  if (next.id === 'plan_now' || next.id === 'plan') return `<button class="btn write" onclick="App.week='${next.week}';go('tyden');setTimeout(()=>A.genWeek(weekPlanned(App.week)?'empty':'all'),50)">${ico('star')} Navrhnout týden</button>`;
  if (next.id === 'review') return `<button class="btn" onclick="App.week='${next.week}';go('tyden')">Projít návrh týdne</button>`;
  if (next.id === 'shop') return `<button class="btn" onclick="App.week='${next.week}';go('nakup')">${ico('cart')} Otevřít nákup</button>`;
  if (next.id === 'measure') return `<button class="btn write" onclick="A.measSheet('${App.date}',true)">${ico('ruler')} Zapsat obvody</button>`;
  return '';
}
/* co patří k dnešku navíc: nesoulad plánu a limitu, včerejší váha, nepotvrzený minulý den */
function dayNotes(day, tasks) {
  const isToday = App.date === todayISO(); const out = [];
  if (!isToday && !day.reviewed && !dayConfirmed(day)) out.push(`<div class="row"><span style="flex:1">🗂️ Den není potvrzený – appka neví, co jsi opravdu snědl.</span><button class="btn write" onclick="A.closeDay()">✓ Potvrdit den</button></div>`);
  if (isToday) { const mm = mismatchAlert(App.date); if (mm) out.push(mm); }
  if (isToday) { const y = addDays(todayISO(), -1); if (y >= S().start_date && !Meas().some(m => m.date === y && m.weight != null))
    out.push(`<div class="row nowrap small"><span class="muted" style="flex:1">Včera chybí váha. Víš ji?</span><input type="text" inputmode="decimal" placeholder="kg" style="width:90px;min-height:38px" onchange="A.fillWeight('${y}',this.value)"></div>`); }
  return out.length ? `<div class="card stack s8 dnotes">${out.join('')}</div>` : '';
}

/* ---- seznam dne: úkoly, jídla, pohyb, cheat a uzavření v jednom sloupci podle času ---- */
function dayRows(d, day, tasks, s) {
  const w = currentWeight(), meas = Meas().find(m => m.date === App.date);
  const byId = Object.fromEntries(tasks.map(t => [t.id, t]));
  const next = pickNext(tasks);
  const isToday = App.date === todayISO();
  const cur = t => isToday && !App.ro && t && next && next.id === t.id;
  const row = (t, o) => `<div class="li ${t && t.done ? 'done' : ''} ${cur(t) ? 'cur' : ''} ${o.cls || ''}" onclick="${o.act}" ${o.id ? `id="${o.id}"` : ''}>${o.ck}<span class="tm">${o.tm || ''}</span><span class="em">${o.em}</span><div class="tx"><b>${o.b}</b>${o.s ? `<span>${o.s}</span>` : ''}</div>${o.val || ''}</div>`;
  const out = [];
  const timed = [];
  tasks.forEach(t => {
    if (t.id === 'weigh') out.push(row(t, { ck: t.done ? ROW_CK(true, `A.weighSheet()`) : ROW_CK(false, `A.weighSheet()`, 'ghost'), tm: t.at, em: ico('scale'), act: 'A.weighSheet()',
      b: t.done ? `Váha ${fmt1(meas.weight)} kg` : 'Zvaž se', s: t.done ? `průměr 7 vážení ${fmt1(w)} kg` : 'ráno po WC, nalačno' }));
    else if (t.id === 'measure') out.push(row(t, { ck: ROW_CK(t.done, `A.measSheet('${App.date}',true)`, t.done ? '' : 'ghost'), tm: t.at, em: ico('ruler'), act: `A.measSheet('${App.date}',true)`, b: t.done ? 'Obvody zapsané' : 'Změř obvody', s: 'neděle · pas, boky, hrudník, stehno, paže' }));
    else if (['plan_now', 'plan', 'review', 'shop'].includes(t.id)) timed.push({ at: t.id === 'plan_now' ? '06:59' : (t.at || PLAN_TIME), html: row(t, { ck: t.done ? ROW_CK(true, '') : ROW_NOCK, tm: t.at || '', em: t.em, act: `App.week='${t.week}';go('${t.id === 'shop' ? 'nakup' : 'tyden'}')`, b: esc(t.tx), s: esc(t.sub || ''), val: '<span class="chev">›</span>', cls: 'add' }) });
    else if (t.meal) {
      const ci = s.courses.findIndex(c => c.key === t.meal); const c = d.courses[ci]; const cs = s.courses[ci]; const m = day.meals[t.meal] || {};
      const cur = m.sel; const cooked = cookFor(App.date, t.meal);
      const name = !cur ? '+ vyber jídlo' : cur === VYNECHAT ? 'vynecháno' : cur === SITUACE ? (c.zapsano ? 'Mimo plán · zapsáno' : 'Vyřeším podle situace') : cur;
      const sub = [cs.name.toLowerCase(), c.active && c.gc ? fmt0(c.gc) + ' g' : '', m.auto && !m.eaten ? 'návrh appky' : '', cooked ? 'z krabičky' : '', cur === SITUACE && !c.zapsano ? `cíl ${fmt0(cs.kcal)} kcal` : ''].filter(Boolean).join(' · ');
      const ck = !cur ? ROW_CK(false, `A.pickMeal('${t.meal}')`, 'ghost') : cur === VYNECHAT ? ROW_CK(true, `A.mealSheet('${t.meal}')`) : ROW_CK(!!m.eaten, `A.eaten('${t.meal}',${!m.eaten})`);
      timed.push({ at: cs.time, html: row(t, { ck, tm: cs.time, em: ico(t.meal === 'vecere2' ? 'cup' : 'fork'), act: cur ? `A.mealSheet('${t.meal}')` : `A.pickMeal('${t.meal}')`, b: esc(name), s: sub, id: 'c-' + t.meal, cls: !cur ? 'add' : '',
        val: (c.active || c.situace) && c.kcal ? `<span class="val k">${fmt0(c.kcal)}</span>` : '' }) });
    }
    else if (t.id === 'walk') { const wt = d.base.planWalk, wm = day.walk_min || 0;
      timed.push({ at: t.at, html: row(t, { ck: ROW_CK(t.done, `A.walkSheet()`, t.done ? '' : 'ghost'), tm: t.at, em: ico('walk'), act: 'A.walkSheet()', b: `Chůze ${wm ? `${wm} z ${wt}` : wt} min`, s: wm ? `${fmt0(wm * d.base.walkPerMin)} kcal${d.base.cheatWalk ? ` · ${d.base.cheatWalk} min za cheat` : ''}` : (d.base.cheatWalk ? `v tom ${d.base.cheatWalk} min za cheat` : 'zapiš, co ujdeš'),
        val: `<button class="btn sec sm write" onclick="event.stopPropagation();A.addWalk(15)">+15</button>` }) }); }
    else if (t.id === 'training') timed.push({ at: t.at, html: row(t, { ck: ROW_CK(t.done, `A.trainSheet()`, t.done ? '' : 'ghost'), tm: t.at, em: ico('dumbbell'), act: 'A.trainSheet()', b: esc(t.tx), s: esc(t.sub || ''), val: '<span class="chev">›</span>' }) });
  });
  timed.sort((a, b) => timeToMin(a.at) - timeToMin(b.at)).forEach(x => out.push(x.html));
  // cheat: jídlo navíc za druhou večeří, jantarový řádek
  const b = d.base; const items = day.cheat_items || [];
  const popis = cheatPopis(day);
  out.push(`<div class="li cheat ${b.cheatKcal > 0 ? '' : 'add'}" onclick="A.cheatSheet()" id="cheat"><span class="ck na"></span><span class="tm"></span><span class="em">${ico('beer')}</span><div class="tx"><b>${b.cheatKcal > 0 ? 'Cheat · ' + esc(popis) : '+ Cheat na večer'}${hq('rCheat')}</b><span>${b.cheatKcal > 0 ? `${cheatStupen(b.cheatKcal, b.maxIntake).k} · ${b.cheatCoverable ? `uchodíš za ${b.cheatWalk} min navíc` : 'uchodit se nedá'}` : 'pivo, řízek, dort – zapiš dopředu'}</span></div>${b.cheatKcal > 0 ? `<span class="val" style="color:var(--cheat-ink)">${fmt0(b.cheatKcal)}</span>` : '<span class="chev">›</span>'}</div>`);
  const stT = byId.steps; if (stT) { const cil = stepsTarget(s), real = daySteps(day), tot = dayStepsTotal(day);
    out.push(row(stT, { ck: ROW_CK(stT.done, 'A.stepsSheet()', stT.done ? '' : 'ghost'), tm: 'večer', em: ico('feet'), act: 'A.stepsSheet()', b: tot == null ? 'Zapsat kroky' : `${fmt0(tot)} kroků`, s: real == null ? 'celkem z telefonu · chůzi odečtu' : (real >= cil ? `běžná chůze ${fmt0(real)} · cíl splněný` : `běžná chůze ${fmt0(real)} · chybí ${fmt0(cil - real)}`) })); }
  const clT = byId.close; if (clT) out.push(row(clT, { ck: ROW_CK(clT.done, 'A.closeDay()', clT.done ? '' : 'ghost'), tm: 'večer', em: ico('moon'), act: 'A.closeDay()', b: clT.done ? (evaluateDay(App.date).ok ? 'Den potvrzený · sedí' : 'Den potvrzený · nesedí') : 'Potvrdit den' + hq('rPotvrdit'), s: clT.done ? 'ťukni pro detail' : 'jedl jsem podle plánu? výjimky oprav' }));
  return out;
}

/* ---- akce nad dnem (⋯) ---- */
A.dayMenu = () => {
  const s = S(), day = effectiveDay(App.date); const d = calcDay(s, Foods(), Recipes(), day, currentWeight()); const prog = dayProgress(d, day);
  UI.menu('Den · ' + czDateShort(App.date), [
    prog.missing.length ? [`💡 Navrhnout ${prog.missing.length === 5 ? 'celý den' : 'chybějící jídla'}`, 'A.suggestDay()', 'podle toho, co zbývá do limitu'] : null,
    !prog.missing.length && prog.planned > 0 ? ['✓ Snědl jsem všechno podle plánu', 'A.eatenAll()', 'výjimky pak oprav u jídla'] : null,
    ['↺ Vrátit plán z Týdne', 'A.resetDay()', 'jídla podle Plánu, chůze a cheat zůstanou'],
    ['🔎 Kontrola dne a vzorec', 'A.dayCheck()', 'co sedí, co ne a jak se limit počítá'],
  ]);
};

/* ---- list jídla: všechno k jednomu chodu na jednom místě ---- */
A.pickMeal = key => {
  const s = S(), day = effectiveDay(App.date), d = calcDay(s, Foods(), Recipes(), day, currentWeight());
  const ci = s.courses.findIndex(c => c.key === key); const c = d.courses[ci]; const cur = (day.meals[key] || {}).sel;
  openPicker({ courseKey: key, current: cur || '', remaining: Math.round(d.remaining + c.kcal), protGap: Math.round(d.protTarget - d.tot.p + c.p), onPick: n => A.selMeal(key, n) });
};
A.mealSheet = key => openSheet(() => mealSheetHtml(key));
function mealSheetHtml(key) {
  const s = S(), foods = Foods(), day = effectiveDay(App.date), d = calcDay(s, foods, Recipes(), day, currentWeight());
  const ci = s.courses.findIndex(x => x.key === key); const cs = s.courses[ci]; const c = d.courses[ci]; const m = day.meals[key] || {};
  const cur = m.sel; const eaten = !!m.eaten;
  const title = `${esc(cs.name)} · ${cs.time}`;
  const sub = !cur ? 'nevybráno' : cur === VYNECHAT ? 'vynecháno' : cur === SITUACE ? 'vyřeším podle situace' : esc(cur);
  const side = eaten ? '<span class="pill ok">snědeno</span>' : (m.auto ? '<span class="pill info">návrh</span>' : '');
  const pick = `<button class="pickbtn ${cur ? '' : 'empty'} write" onclick="A.pickMeal('${key}')"><span>${cur ? (cur === SITUACE ? 'vyřeším podle situace' : cur === VYNECHAT ? '— vynechat' : esc(cur)) : '+ vyber jídlo'}</span><em>${cur ? 'vyměnit ›' : ''}</em></button>`;
  const tools = `<div class="row">${cur && cur !== SITUACE && cur !== VYNECHAT ? `<button class="btn sec sm write" onclick="A.suggestOne('${key}')">${ico('star')} Jiný návrh</button>` : ''}<button class="btn sec sm write" onclick="A.outMeal('${key}')">${ico('fork')} Jedl jsem něco jiného</button>${cur && cur !== SITUACE && cur !== VYNECHAT ? `<button class="btn ghost sm" onclick="A.favSheet(${JSON.stringify(cur).replace(/"/g, '&quot;')})">${isFav(cur) ? '★ v oblíbených' : '☆ do oblíbených'}</button>` : ''}</div>`;
  let body = '';
  const grams = (onch, g) => `<span class="gstep"><button class="gb write" onclick="A.gnudge(this,-10)">−</button><input class="g" type="number" min="0" step="5" value="${gShow(g)}" onchange="${onch}"><button class="gb write" onclick="A.gnudge(this,10)">+</button><span class="gu">g</span></span>`;
  if (c.active) {
    const t = toleranceText(c.kcal, c.target);
    body = `<div class="stats3"><div><b class="m-kcal">${fmt0(c.kcal)}</b><span>kcal · cíl ${fmt0(c.target)}</span></div><div><b class="m-prot">${fmt0(c.p)} g</b><span>bílkoviny</span></div><div><b>${fmt0(c.gc)} g</b><span>na talíři${Math.abs(c.gc - c.g) > 5 ? ` · ${fmt0(c.g)} g nákup` : ''}</span></div></div>
      <div class="alert ${t.ok ? 'a3' : 'a2'}"><div><b>${t.ok ? 'Sedí' : esc(t.text)}</b>${t.ok ? ' – do ±60 kcal od cíle jídla.' : ` proti cíli ${fmt0(c.target)} kcal.`}${m.sel && m.planned && m.sel !== m.planned ? ` Místo plánu (${esc(m.planned)}).` : ''}</div></div>
      ${m.fromCook ? `<div class="notice">Z uvařené dávky – gramy jsou porce z krabičky, ne podle dnešního limitu.</div>` : ''}
      <div class="blk"><h4>Změnit jídlo</h4>${pick}${tools}</div>
      <details class="blk gdet" ${c.edited || m.fromCook ? 'open' : ''}><summary><b>Gramy a suroviny</b><span class="muted small"> · ${c.items.length} ${sklon(c.items.length, 'surovina', 'suroviny', 'surovin')}${c.edited ? ' · upraveno' : ''}</span></summary>
      <div class="items-l">${c.items.map(it => it.extra
        ? `<div class="irow"><div class="inm"><span class="mbadge">➕</span><button class="pickbtn sm edit write" onclick="openFoodPicker(n=>A.extraFood('${key}',${String(it.idx).slice(1)},n),${JSON.stringify(it.food).replace(/"/g, '&quot;')})"><span>${esc(it.food)}</span></button><button class="xbtn sm write" title="odebrat" onclick="A.extraDel('${key}',${String(it.idx).slice(1)})">×</button></div>
          <div class="imeta">${grams(`A.extraG('${key}',${String(it.idx).slice(1)},this.value)`, it.g)}<span class="m-kcal">${fmt0(it.kcal)} kcal</span><span class="m-prot">${fmt1(it.p)} g B</span></div></div>`
        : `<div class="irow"><div class="inm">${modeBadge(it.food)}<button class="pickbtn sm ${it.swapped ? 'edit' : ''} write" onclick="openFoodPicker(n=>A.swap('${key}',${it.idx},n),${JSON.stringify(it.food).replace(/"/g, '&quot;')})"><span>${esc(it.food)}</span></button><button class="xbtn sm write" title="odebrat" onclick="A.removeItem('${key}',${it.idx})">×</button></div>
          <div class="imeta">${measureText(it.food, it.g) ? `<span class="meas">${measureText(it.food, it.g)}</span>` : ''}${grams(`A.gram('${key}',${it.idx},this.value)`, it.g)}<span class="m-kcal">${fmt0(it.kcal)} kcal</span><span class="m-prot">${fmt1(it.p)} g B</span></div>
          ${it.swapped ? `<div class="tiny muted" style="grid-column:1/-1">recept: ${esc(it.origFood)}</div>` : ''}${it.scale && !it.manual && it.g !== it.origG ? `<div class="tiny muted" style="grid-column:1/-1">recept ${gShow(it.origG)} g · přizpůsobeno tvému limitu</div>` : ''}</div>`).join('')}
        ${(c.removedItems || []).map(r => `<div class="irow off"><div class="inm">${esc(r.food)} ${r.g} g</div><button class="btn ghost sm write" onclick="A.unremoveItem('${key}',${r.idx})">↺ vrátit</button></div>`).join('')}</div>
      <div class="row"><button class="btn ghost sm write" onclick="A.extraAdd('${key}')">+ přidat surovinu</button>${c.edited ? `<button class="btn ghost sm write" onclick="A.resetCourse('${key}')">↺ recept beze změn</button>` : ''}</div></details>`;
  } else if (c.situace) {
    const ex = m.extra || [];
    body = `${sitEstHtml(key, m, cs.kcal)}${pick}${tools}<p class="small muted">${c.zapsano ? `${c.odhad ? `Odhad ${fmt0(c.kcal)} kcal` : `Zapsáno ${fmt0(c.kcal)} kcal`} · cíl byl ${fmt0(cs.kcal)} kcal. Do součtu dne jde tvůj zápis, ne cíl.` : `Cíl jídla ${fmt0(cs.kcal)} kcal, aspoň ${SEED.settings.courses[ci].prot_min} g bílkovin. Dokud nic nezapíšeš, počítá se cíl. Vyber, co to bylo (Jedl jsem něco jiného), nebo přidej suroviny.`}</p>
      ${ex.length ? `<div class="items-l">${ex.map((e2, j) => { const f = foods.find(x => x.name === e2.food); return `<div class="irow"><div class="inm">${modeBadge(e2.food)}<button class="pickbtn sm edit write" onclick="openFoodPicker(n=>A.extraFood('${key}',${j},n),${JSON.stringify(e2.food).replace(/"/g, '&quot;')})"><span>${esc(e2.food)}</span></button><button class="xbtn sm write" onclick="A.extraDel('${key}',${j})">×</button></div>
        <div class="imeta">${measureText(e2.food, e2.g) ? `<span class="meas">${measureText(e2.food, e2.g)}</span>` : ''}${grams(`A.extraG('${key}',${j},this.value)`, e2.g)}<span class="m-kcal">${f ? fmt0(f.kcal * e2.g / 100) : ''} kcal</span></div></div>`; }).join('')}</div>` : ''}
      <button class="btn ghost sm write" style="align-self:flex-start" onclick="A.extraAdd('${key}')">+ přidat surovinu</button>`;
  } else body = `${pick}${tools}<p class="muted small">${cur === VYNECHAT ? 'Vynecháno – do dne se nepočítá.' : 'Vyber jídlo – appka nabídne to, co se vejde do zbytku dne.'}</p>`;
  const foot = cur && cur !== VYNECHAT ? `<button class="btn ${eaten ? 'sec' : ''} write" onclick="A.eaten('${key}',${!eaten});${eaten ? '' : 'UI.closeModal()'}">${eaten ? 'Ještě jsem nejedl' : ico('check') + ' Snědl jsem'}</button>` : '';
  return UI.sheetHtml(title, sub, body, foot, side);
}
A.favSheet = name => { toggleFav(name); UI.toast(isFav(name) ? `${name} je v oblíbených.` : `${name} odebráno z oblíbených.`); render(); };

/* ---- váha a obvody ---- */
A.weighSheet = () => {
  const ex = Meas().find(m => m.date === App.date);
  UI.sheet('Váha', czDate(App.date) + ' · ráno po WC, nalačno',
    `<div class="bigin"><input type="text" inputmode="decimal" id="nw" placeholder="0,0" value="${ex && ex.weight != null ? String(ex.weight).replace('.', ',') : ''}"><small>kg</small></div>
     <div class="tipg">${ico('flame')}<span>Jeden den nahoru nebo dolů nic neznamená – appka počítá s průměrem sedmi vážení.</span></div>`,
    `<button class="btn write" onclick="A.quickWeigh();UI.closeModal()">Zapsat váhu</button><button class="btn sec" onclick="A.measSheet('${App.date}',true)">+ obvody</button>`);
  setTimeout(() => { const i = document.querySelector('.modal #nw'); if (i) i.focus(); }, 80);
};

/* ---- chůze: přidat minuty, přesně, tempo ---- */
A.walkSheet = () => openSheet(() => {
  const s = S(), day = effectiveDay(App.date), d = calcDay(s, Foods(), Recipes(), day, currentWeight());
  const wt = d.base.planWalk, wm = day.walk_min || 0;
  return UI.sheetHtml('Chůze', `cíl ${wt} min${d.base.cheatWalk ? ` · v tom ${d.base.cheatWalk} min za cheat` : ''}`,
    `<div class="row between"><b style="font-size:28px;letter-spacing:-.02em" class="${wm >= wt ? 'ok' : ''}">${wm} <small class="muted" style="font-size:15px">z ${wt} min</small></b><span class="muted">${fmt0(wm * d.base.walkPerMin)} kcal</span></div>
     <div class="bar ${wm >= wt ? 'ok' : ''}"><i style="width:${clamp(wm / Math.max(1, wt) * 100, 0, 100)}%"></i></div>
     <div class="quick">${[15, 30, 60].map(n => `<button class="btn sec write" onclick="A.addWalk(${n})">+${n} min</button>`).join('')}</div>
     <div class="field"><label class="f">nebo přesně (minut)</label>${stepper('walk-in', wm, 5, 0, 600, 'A.setWalk(this.value)')}</div>
     <div class="field"><label class="f">Tempo${help(tempoNapoveda())}</label><select onchange="A.dayField('walk_kmh',this.value,'Tempo změněno')">${SEED.met.map(([k]) => `<option value="${k}" ${k === (day.walk_kmh || s.walk_kmh) ? 'selected' : ''}>${fmt1(k)} km/h</option>`).join('')}</select></div>
     ${d.base.belowBmr ? `<div class="alert a2"><div>Zatím málo cíleného pohybu – limit by vyšel pod spodní hranici jídla, drží ho na ní. Od ${d.base.walkToBmr}. minuty chůze ti začne růst i limit.</div></div>` : ''}`);
});

/* ---- kroky: celkem z telefonu, appka odečte procházku; nikdy se nepředvyplňují ---- */
A.stepsSheet = () => openSheet(() => {
  const s = S(), day = effectiveDay(App.date), cil = stepsTarget(s), tot = dayStepsTotal(day), real = daySteps(day), w2 = currentWeight();
  const wk = walkSteps(day, s.walk_kmh); const splneno = real != null && real >= cil; const sm = stepsMiss(s, day, w2);
  return UI.sheetHtml('Kroky', `cíl běžné chůze ${fmt0(cil)} · nastavuje trenér`,
    `<div class="field"><label class="f">Kroky dnes celkem – číslo z telefonu nebo hodinek${hq('rKroky')}</label>${stepper('steps-in', tot == null ? '' : tot, 500, 0, 80000, 'A.setSteps(this.value)', 'kroků')}</div>
     <p class="small muted">${day.walk_min ? `Tvoje chůze ${day.walk_min} min je zhruba ${fmt0(wk)} kroků – ty odečtu, cíl je běžná chůze mimo ni (schody, práce, nákup).` : 'Zapiš celé číslo. Až zapíšeš i chůzi v minutách, její kroky odečtu – cíl je běžná chůze mimo ni.'}</p>
     ${real == null ? '' : `<div class="stats3"><div><b>${fmt0(tot)}</b><span>celkem</span></div><div><b>−${fmt0(wk)}</b><span>chůze</span></div><div><b class="${splneno ? 'ok' : 'warn'}">${fmt0(real)}</b><span>běžná · cíl ${fmt0(cil)}</span></div></div>
       ${(() => { const act = effectiveDay(App.date).act || {}; if (act.stepsBase == null) return '';
         const dk = (real - act.stepsBase) * kcalPerStep(w2); return dk >= 0 ? `<div class="tipg">${ico('star')}<span>O ${fmt0(real - act.stepsBase)} kroků víc než tvůj průměr – dnes můžeš sníst o ${fmt0(dk)} kcal víc.</span></div>` : `<div class="small muted">Víc kroků = víc jídla, deficit zůstává. Tvůj průměr je ${fmt0(act.stepsBase)} kroků.</div>`; })()}
       ${splneno ? `<div class="alert a3"><div>${real > cil ? `O ${fmt0(real - cil)} kroků nad cíl trenéra.` : 'Cíl trenéra splněný.'}</div></div>`
         : (effectiveDay(App.date).act || {}).stepsBase != null ? `<div class="small muted">Do cíle trenéra ${fmt0(cil)} chybí ${fmt0(sm.chybi)} kroků.</div>`
         : `<div class="small muted">Do cíle trenéra ${fmt0(cil)} chybí ${fmt0(sm.chybi)} kroků – zítra třeba schody nebo kratší procházka navíc.</div>`}`}
     <div class="field"><label class="f">Km chůze za den – nepovinné, z Apple Health</label><div class="numf"><input type="text" inputmode="decimal" id="km-in" value="${day.km != null ? String(day.km).replace('.', ',') : ''}" placeholder="např. 6,4" onchange="A.setKm(this.value)"><span>km</span></div><div class="hint">Z km a kroků appka spočítá tvou délku kroku – procházku pak odečte přesněji.</div></div>`);
});

/* ---- potvrzení dne: výchozí „jedl jsem podle plánu“, výjimky se opraví ťuknutím ----
   Dřív musel Robert odškrtat pět jídel, jinak appka nevěděla, co snědl, a den se
   o půlnoci hodnotil podle plánu. Teď večer jedno ťuknutí; co bylo jinak, opraví
   u jídla (jiné jídlo, mimo dům, vynechat) nebo u cheatu. */
A.closeDay = () => openSheet(() => {
  const date = App.date, s = S(), day = effectiveDay(date), ev = evaluateDay(date), d = ev.d;
  const done = !!day.reviewed;
  const rows = s.courses.map((c, ci) => { const m = day.meals[c.key] || {}; const cc = d.courses[ci];
    const name = !m.sel ? 'nic nevybráno' : m.sel === VYNECHAT ? 'vynecháno' : m.sel === SITUACE ? (cc.zapsano ? (cc.odhad ? `mimo plán · ${SIT_EST[cc.odhad].l}` : 'mimo plán · zapsáno') : 'podle situace – jak vydatné to bylo?') : m.sel;
    return `<div class="li" onclick="A.mealSheet('${c.key}')"><span class="em">${ico(c.key === 'vecere2' ? 'cup' : 'fork')}</span><div class="tx"><b>${esc(name)}</b><span>${esc(c.name)}${m.eaten || done ? ' · snědeno' : ''}</span></div><span class="val k">${cc.kcal ? fmt0(cc.kcal) : ''}</span><span class="chev">›</span></div>${m.sel === SITUACE && !(cc.zapsano && !cc.odhad) ? sitEstHtml(c.key, m, s.courses[ci].kcal, true) : ''}`; }).join('')
    + (d.base.cheatKcal > 0 ? `<div class="li cheat" onclick="A.cheatSheet()"><span class="em">${ico('beer')}</span><div class="tx"><b>Cheat · ${esc(cheatPopis(day))}</b><span>bylo to tak?</span></div><span class="val">${fmt0(d.base.cheatKcal)}</span><span class="chev">›</span></div>` : '');
  const fails = d.checks.filter(c => c.state === 1);
  return UI.sheetHtml(done ? `Den potvrzený` : `Jak šel den?`, czDate(date),
    `${done ? `<div class="status st${d.ok ? 2 : 3}">${esc(d.summary)}</div>` : `<button class="btn big write" onclick="A.closeDayOk()">${ico('check')} Jedl jsem podle plánu</button><p class="small muted" style="text-align:center">Něco jinak? Ťukni na jídlo a oprav.</p>`}
     <div class="list">${rows}</div>
     ${done ? fails.map(c => `<div class="alert a2"><div><b>${esc(c.name)}:</b> ${esc(c.text)}</div></div>`).join('') : ''}
     ${realCoach() && !App.preview ? '' : `<div class="lh" style="padding-left:0">Jak šel den – pár ťuknutí pro trenéra</div>${checkinHtml(date, day)}`}`,
    done ? `<button class="btn sec" onclick="UI.closeModal()">Hotovo</button><button class="btn ghost write" onclick="A.unconfirmDay()">Ještě opravit</button>`
      : `<button class="btn sec" onclick="UI.closeModal()">Ještě ne</button>`);
});
A.closeDayOk = () => {
  UI.closeModal(); Undo.run('Den potvrzen', () => {
    const day = getDay(App.date); const eff = effectiveDay(App.date);
    // co má vybrané jídlo a není vynechané, se počítá jako snědené podle plánu
    S().courses.forEach(c => { const m = eff.meals[c.key] || {}; if (m.sel && m.sel !== VYNECHAT) { day.meals[c.key] = { ...(day.meals[c.key] || {}), sel: m.sel, eaten: true }; } });
    day.reviewed = true; saveDay(day); if (App._backToday) { App._backToday = false; App.date = todayISO(); } render(); },
  () => { const ev = evaluateDay(App.date); return ev.ok ? 'Den potvrzený a seděl. Zítra stejně.' : 'Den potvrzený. Zítra to dorovnáš.'; }); };
A.unconfirmDay = () => { UI.closeModal(); Undo.run('Potvrzení zrušeno', () => { const day = getDay(App.date); day.reviewed = false; saveDay(day); render(); }, 'Den zase čeká na potvrzení.'); };
A.toCourse = key => A.mealSheet(key);
A.toggleCourse = key => A.mealSheet(key);

/* ---- akce Dnes (vše se Zpět a hláškou) ---- */
const dayMsg = (lead) => () => { const d = calcDay(S(), Foods(), Recipes(), effectiveDay(App.date), currentWeight()); const st = d.tot.kcal === 0 ? '' : (d.remaining < -30 ? ` Den je ${fmt0(-d.remaining)} kcal přes limit.` : ` Den sedí, rezerva ${fmt0(Math.max(0, d.remaining))} kcal.`); return lead + st; };
const MEZE = { beers: [0, 40, 'piv'], fried_g: [0, 3000, 'g smaženého'], exercise_min: [0, 600, 'minut cvičení'], walk_kmh: [2, 9, 'km/h'], extra_kcal: [0, 8000, 'kcal'] };
A.dayField = (f, v, label) => {
  const m = MEZE[f];
  const r = m ? omez(v, m[0], m[1]) : { n: v === '' ? null : cislo(v), mimo: false };
  if (m && r.mimo) UI.toast(`${fmt0(r.n)} ${m[2]} je maximum, které dává smysl – zapsal jsem tolik.`);
  return Undo.run(label || 'Změna dne', () => { const day = effectiveDay(App.date); day[f] = r.n; saveDay(day); render(); }, dayMsg(label || 'Uloženo.'));
};
A.setWalk = (v, ok) => { const r = omez(v, 0, 600); if (r.mimo) UI.toast('Chůze se zapisuje v rozmezí 0 až 600 minut.');
  const prev = effectiveDay(App.date).walk_min || 0; if (!ok && r.n > WALK_LOG_WARN && r.n > prev) { UI.confirm(`Opravdu ${r.n} minut chůze? To je ${Math.floor(r.n / 60)} h ${r.n % 60} min – limit jídla o to vyroste.`, () => A.setWalk(r.n, true), 'Ano, ušel jsem to', true); render(); return; }
  return Undo.run('Chůze', () => { const day = effectiveDay(App.date); day.walk_min = r.n; saveDay(day); render(); }, () => { const day = effectiveDay(App.date); const s = S(); const left = s.walk_min - (day.walk_min || 0); return left > 0 ? `Chůze ${day.walk_min || 0} min. Zbývá ${left} min do cíle.` : `Chůze ${day.walk_min} min – cíl splněn.`; }); };
A.addWalk = n => { const day = effectiveDay(App.date); A.setWalk((day.walk_min || 0) + n); };
A.selMeal = (key, v) => Undo.run('Změna jídla', () => { const day = effectiveDay(App.date); day.meals[key] = { sel: v || null, planned: day.meals[key].planned, eaten: false }; saveDay(day); noteRecent(v); render(); }, dayMsg(`${S().courses.find(c => c.key === key).name}: ${v === SITUACE ? 'vyřešíš podle situace' : (v === VYNECHAT ? 'vynecháno' : v)}.`));
A.eaten = (key, v) => { if (v) { buzz(30); setTimeout(() => { const dd = calcDay(S(), Foods(), Recipes(), effectiveDay(App.date), currentWeight()); const tk = dayTasks(App.date); if (tk.filter(t => t.meal).every(t => t.done) && dd.ok) celebrate('day'); }, 50); } return A.eaten0(key, v); };
A.eaten0 = (key, v) => Undo.run(v ? 'Snědeno' : 'Zrušit snědeno', () => { const day = effectiveDay(App.date); day.meals[key].eaten = v; saveDay(day); render(); }, () => { const s = S(); const c = s.courses.find(x => x.key === key); if (!v) return `${c.name} označena jako nesnědená.`; const tasks = dayTasks(App.date); const nx = tasks.find(t => !t.done && t.meal) || tasks.find(t => !t.done); return `${c.name} snědena.` + (nx ? ` Další: ${nx.tx.split(' – ')[0]}${nx.at ? ' v ' + nx.at : ''}.` : ' Všechna jídla hotová.'); });
A.swap = (key, idx, v) => Undo.run('Výměna suroviny', () => { const day = effectiveDay(App.date); const m = day.meals[key]; m.swaps = m.swaps || {}; m.swaps[idx] = v; saveDay(day); render(); }, dayMsg(`Surovina vyměněna za ${v}.`));
A.gram = (key, idx, v) => { const r = omez(v, 0, 5000); if (r.mimo) UI.toast('Gramy zapisuju v rozmezí 0 až 5 000 g.'); return Undo.run('Gramy', () => { const day = effectiveDay(App.date); const m = day.meals[key]; m.grams = m.grams || {}; if (r.n == null) delete m.grams[idx]; else m.grams[idx] = r.n; saveDay(day); render(); }, dayMsg(`Gramáž upravena na ${v} g.`)); };
A.resetCourse = key => Undo.run('Vrátit recept', () => { const day = effectiveDay(App.date); const m = day.meals[key]; delete m.swaps; delete m.grams; delete m.removed; delete m.extra; saveDay(day); render(); }, 'Recept vrácen beze změn.');
A.removeItem = (key, idx) => Undo.run('Odebrat surovinu', () => { const day = effectiveDay(App.date); const m = day.meals[key]; m.removed = m.removed || {}; m.removed[idx] = true; saveDay(day); render(); }, dayMsg('Surovina odebrána.'));
A.unremoveItem = (key, idx) => Undo.run('Vrátit surovinu', () => { const day = effectiveDay(App.date); const m = day.meals[key]; if (m.removed) delete m.removed[idx]; saveDay(day); render(); }, dayMsg('Surovina vrácena.'));
/* Celý den podle plánu jedním ťuknutím – běžný den je ten, kdy Robert snědl, co bylo naplánováno.
   Odklikávat pět jídel po jednom je zbytečná práce; výjimky se opraví ručně. */
A.eatenAll = () => Undo.run('Den podle plánu', () => {
  const day = effectiveDay(App.date), s = S();
  let n = 0;
  s.courses.forEach(c => { const m = day.meals[c.key]; if (m && m.sel && m.sel !== VYNECHAT && !m.eaten) { m.eaten = true; n++; } });
  saveDay(day); buzz(30); render();
  setTimeout(() => { const dd = calcDay(S(), Foods(), Recipes(), effectiveDay(App.date), currentWeight()); if (dd.ok) celebrate('day'); }, 60);
}, 'Všechna jídla označena jako snědená. Kdyby něco nesedělo, oprav to u jídla.');

/* Jídlo mimo dům: restaurace, jídelna, návštěva. Odhad je vždycky lepší než prázdný den. */
A.outMeal = key => {
  const lib = Foods().filter(f => f.cat === 'Mimo dům');
  const s = S(), c = s.courses.find(x => x.key === key);
  UI.sheet('Jedl jsem něco jiného', `${esc(c.name)} · cíl ${fmt0(c.kcal)} kcal`,
    `<div class="row"><button class="btn sec sm write" onclick="UI.closeModal();A.pickMeal('${key}')">📖 Jiné jídlo z receptů</button><button class="btn sec sm write" onclick="UI.closeModal();A.ownFoods('${key}')">➕ Poskládám ze surovin</button></div>
    <div class="lh" style="padding-left:0">Mimo dům – vyber nejbližší, gramy pak dolaď</div>
    <div class="plist">${lib.map(f => `<div class="pitem" onclick="A.outPick('${key}',${JSON.stringify(f.name).replace(/"/g, '&quot;')},${f.port || 400})"><div class="sp"><div class="pn">${esc(f.name)}</div><div class="pi">${f.port || 400} g · ${fmt0(f.p * (f.port || 400) / 100)} g bílkovin</div></div><div class="pk">${fmt0(f.kcal * (f.port || 400) / 100)} <span>kcal</span></div></div>`).join('')}</div>`);
};
/* „poskládám ze surovin“: chod se přepne na zápis skutečnosti a otevře se výběr suroviny */
A.ownFoods = key => { Undo.run('Jídlo ze surovin', () => { const day = effectiveDay(App.date); const m = day.meals[key]; m.sel = SITUACE; m.extra = m.extra || []; m.eaten = true; delete m.swaps; delete m.grams; delete m.removed; saveDay(day); render(); }, 'Přidej suroviny a gramy.');
  openFoodPicker(n => { const day = effectiveDay(App.date); const m = day.meals[key]; m.extra = (m.extra || []).concat([{ food: n, g: 100 }]); saveDay(day); render(); A.mealSheet(key); }); };
A.outPick = (key, food, g) => { UI.closeModal(); Undo.run('Jídlo mimo dům', () => {
  const day = effectiveDay(App.date), m = day.meals[key];
  m.sel = SITUACE; m.extra = [{ food, g }]; m.eaten = true; delete m.swaps; delete m.grams; delete m.removed;
  saveDay(day); render();
}, `Zapsáno: ${food}. Gramáž dolaď, pokud to byla jiná porce.`); };

A.extraAdd = key => Undo.run('Přidat surovinu', () => { const day = effectiveDay(App.date); const m = day.meals[key]; m.extra = m.extra || []; m.extra.push({ food: 'Zelenina míchaná', g: 100 }); saveDay(day); render(); }, 'Přidán řádek – vyber surovinu a gramy.');
A.extraFood = (key, j, v) => Undo.run('Surovina', () => { const day = effectiveDay(App.date); day.meals[key].extra[j].food = v; saveDay(day); render(); }, dayMsg(`Přidáno: ${v}.`));
A.extraG = (key, j, v) => { const r = omez(v, 0, 5000); if (r.mimo) UI.toast('Gramy zapisuju v rozmezí 0 až 5 000 g.'); return Undo.run('Gramy', () => { const day = effectiveDay(App.date); day.meals[key].extra[j].g = r.n || 0; saveDay(day); render(); }, dayMsg(`Gramáž ${fmt0(r.n || 0)} g.`)); };
A.extraDel = (key, j) => Undo.run('Odebrat přidanou surovinu', () => { const day = effectiveDay(App.date); day.meals[key].extra.splice(j, 1); saveDay(day); render(); }, dayMsg('Přidaná surovina odebrána.'));
A.resetDay = () => Undo.run('Vrátit plán', () => { const day = getDay(App.date); day.meals = {}; day.autoSuggested = true; saveDay(day); render(); }, 'Jídla vrácena na plán z Týdne. Chůze a piva zůstaly.');
A.suggestOne = key => { const cur = (effectiveDay(App.date).meals[key] || {}).sel; const sg = suggestMeal(App.date, key, cur); if (!sg) { UI.toast('Nenašel jsem jinou variantu.'); return; }
  Undo.run('Návrh jídla', () => { const day = effectiveDay(App.date); day.meals[key] = { sel: sg.name, planned: day.meals[key].planned, auto: true }; saveDay(day); noteRecent(sg.name); render(); }, dayMsg(`Navrženo: ${sg.name} (${fmt0(sg.kcal)} kcal).`)); };
A.suggestDay = () => Undo.run('Návrh dne', () => { suggestDay(App.date); render(); }, dayMsg('Chybějící jídla doplněna podle zbývajícího limitu.'));
A.quickWeigh = () => { buzz(20); const el = document.querySelector('#nw'); const r = omez(el ? el.value : '', 30, 400); const v = r.n; if (!v) { UI.toast('Zapiš číslo v kg'); return; } if (r.mimo) UI.toast('Váha mimo rozumný rozsah – zapsal jsem nejbližší hodnotu.'); App.measDate = App.date;
  const pl = weightPlausible(v, App.date);
  const save = () => Undo.run('Váha', () => { const ex = Meas().find(m => m.date === App.date) || { date: App.date }; saveMeas({ ...ex, weight: v }); render(); }, () => { const ov = calcOverview(S(), Meas()); return `Váha ${fmt1(v)} kg zapsána. Průměr 7 dní ${fmt1(ov.cur)} kg${ov.dev != null ? (ov.dev >= 0 ? `, ${fmt2(ov.dev)} kg před plánem.` : `, ${fmt2(-ov.dev)} kg za plánem.`) : '.'}`; });
  if (!pl.ok) { const mm = UI.modal(`<h2>Sedí to?</h2><p class="muted">Zapisuješ <b>${fmt1(v)} kg</b>, průměr posledních dnů je <b>${fmt1(pl.prev.avg)} kg</b>. Rozdíl ${(pl.diff > 0 ? '+' : '−') + fmt1(Math.abs(pl.diff))} kg je nezvyklý – překlep?</p><div class="row"><button class="btn sec" onclick="UI.closeModal()">Opravím</button><button class="btn" id="mfy">Je to správně</button></div>`); mm.querySelector('#mfy').onclick = () => { mm.remove(); save(); }; return; }
  save(); };
A.favInPlace = (btn, name) => { toggleFav(name); const on = isFav(name); btn.classList.toggle('on', on); btn.textContent = on ? '★' : '☆'; UI.toast(on ? `${name} přidáno do oblíbených.` : `${name} odebráno z oblíbených.`); };

/* typické hříchy, které v databázi zdravých surovin nejsou – kcal za obvyklou porci */
/* ===== Cheat: co ho čeka vecer =====
   Knihovna je slozena ze tri zdroju: typicke porce (nize), kategorie Pozor
   (chipsy, cokolada, pivo...) a jidla mimo dum. U kazde polozky je hmotnost porce,
   aby kcal davaly smysl bez pocitani. */
const CHEAT_LIB = [
  ['řízek', 520, 'Smažený řízek', '150 g'], ['hranolky', 380, 'Porce hranolek', '150 g'],
  ['pizza', 800, 'Pizza celá', '30 cm'], ['hamburger', 550, 'Hamburger', '1 ks'],
  ['kebab', 700, 'Kebab v pitě', '1 ks'], ['smažený sýr', 600, 'Smažený sýr s tatarkou', '1 porce'],
  ['guláš', 550, 'Guláš s knedlíkem', '1 porce'], ['svíčková', 700, 'Svíčková s knedlíkem', '1 porce'],
  ['chipsy', 530, 'Sáček chipsů', '100 g'], ['čokoláda', 540, 'Tabulka čokolády', '100 g'],
  ['zmrzlina', 250, 'Zmrzlina', '2 kopečky'], ['dort', 400, 'Kus dortu', '1 kus'],
  ['koláč', 300, 'Kus koláče', '1 kus'], ['víno', 160, 'Sklenice vína', '2 dcl'],
  ['panák', 110, 'Panák tvrdého', '0,5 dcl'], ['kofola', 180, 'Kofola', '0,5 l'],
  ['limonáda', 210, 'Slazená limonáda', '0,5 l'], ['klobása', 450, 'Klobása', '150 g'],
  ['pivo', 205, 'Pivo 12°', '0,5 l'], ['pivo malé', 103, 'Pivo malé', '0,3 l'],
  ['burger menu', 950, 'Burger menu s hranolkami a kolou', '1 menu'],
  ['řízek s bramborovým salátem', 900, 'Řízek s bramborovým salátem', '1 porce'],
  ['grilovaná žebra', 850, 'Grilovaná žebra', '400 g'],
  ['tiramisu', 450, 'Tiramisu', '1 porce'], ['palčinky', 600, 'Palačinky se šlehačkou', '3 ks'],
  ['popcorn', 400, 'Popcorn v kině', 'střední'], ['orešky slané', 300, 'Slané oříšky', '50 g'],
];
/* Typická porce u surovin z databáze, kde není uvedená */
const CHEAT_PORCE = { 'Chipsy': 100, 'Croissant': 70, 'Hranolky': 150, 'Klobása': 150, 'Kobliha': 70,
  'Müsli tyčinka': 40, 'Paštika': 50, 'Párky jemné': 100, 'Slanina': 50, 'Smažený řízek': 180,
  'Sušenky máslové': 60, 'Zmrzlina smetanová': 120, 'Čokoláda hořká 70 %': 50, 'Čokoláda mléčná': 50,
  'Majonéza': 30, 'Med': 20, 'Agávový sirup': 20,
  'Pivo 12° (na 100 ml)': 500, 'Pivo nealko (na 100 ml)': 500, 'Slazená limonáda (na 100 ml)': 500, 'Džus pomerančový (na 100 ml)': 300 };
function cheatLib() {
  const out = CHEAT_LIB.map(([k, kcal, nazev, porce]) => ({ nazev, kcal, porce, zdroj: 'typické' }));
  const videl = new Set(out.map(x => norm2(x.nazev)));
  Foods().filter(f => f.cat === 'Pozor' || f.cat === 'Mimo dům').forEach(f => {
    const g = f.port || CHEAT_PORCE[f.name] || 100;
    const kcal = Math.round(f.kcal * g / 100);
    const nazev = f.name.replace(/ \(na 100 ml\)$/, '');
    if (videl.has(norm2(nazev))) return;
    videl.add(norm2(nazev));
    out.push({ nazev, kcal, porce: g >= 1000 ? fmt1(g / 1000) + ' kg' : g + (f.name.includes('100 ml') ? ' ml' : ' g'), zdroj: f.cat });
  });
  return out.sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs'));
}
/* Stupnice cheatu podle toho, jakou cast dennino limitu spolkne. Nazev sam o sobe
   nic nerekne, proto se vedle nej vzdycky ukazuje, kolik minut chuze to stoji. */
const CHEAT_ST = [
  { max: 0.10, k: 'lehký', t: 'ok' },
  { max: 0.25, k: 'střední', t: 'y' },
  { max: 0.40, k: 'těžký', t: 'warn' },
  { max: 99, k: 'extrémní', t: 'bad' },
];
function cheatStupen(kcal, limit) { const p = kcal / Math.max(1, limit || 2500); return CHEAT_ST.find(x => p <= x.max); }
const norm2 = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/* ===== Cheat na dnešek =====
   Robert zapíše ráno, co ho večer čeká. Appka to počítá do dne jako plán
   a hlavně mu zvedne cíl chůze tak, aby to večer stálo co nejmíň.
   Nic se tu nepotvrzuje jako „snědeno“ – je to plán, ne zápis. */
A.cheatSheet = () => openSheet(() => {
  const day = effectiveDay(App.date), s = S(), w = currentWeight(), foods = Foods();
  const d = calcDay(s, foods, Recipes(), day, w); const b = d.base; const items = day.cheat_items || [];
  const kcalOf = it => { if (it.kcal != null) return Number(it.kcal) || 0; const f = foods.find(x => x.name === it.food); return f ? f.kcal * (Number(it.g) || 0) / 100 : 0; };
  const tempoDnes = d.dayDeficit * 7 / KG_KCAL;
  const verdict = b.cheatKcal <= 0 ? ''
    : b.cheatCoverable
    ? `<div class="alert a3"><div><b>${fmt0(b.cheatKcal)} kcal navíc – tohle se dá uchodit.</b> Cíl chůze jsem zvedl o ${b.cheatWalk} minut na ${b.planWalk}. Když je dojdeš, tempo zůstane stejné a porce jídel nechávám, jak jsou.</div></div>`
    : `<div class="alert a2"><div><b>${fmt0(b.cheatKcal)} kcal navíc – uchodit se to nedá.</b> Musel bys ujít ${b.cheatWalkFull ?? Math.ceil(b.cheatKcal / b.walkPerMin)} minut navíc. Přidal jsem ${b.cheatWalk} minut (cíl ${b.planWalk}) a zmenšil porce, jak to šlo – bílkovinu nekrátím. Dnes to vyjde ${fmt2(tempoDnes)} kg za týden místo ${fmt2(w * s.rate_pct / 100)}. <b>Jeden takový večer za měsíc nic nezkazí</b>, jen ať z toho není zvyk.</div></div>`;
  return UI.sheetHtml('Cheat na večer', b.cheatKcal > 0 ? `${fmt0(b.cheatKcal)} kcal · ${cheatStupen(b.cheatKcal, b.maxIntake).k}` : 'plán, ne zápis – zapiš dopředu',
    `<div class="grid g2"><div class="field"><label class="f">🍺 Piva (0,5 l)</label>${stepper('beers', day.beers || 0, 1, 0, 40, "A.dayField(&quot;beers&quot;,this.value,&quot;Piva zapsána&quot;)")}</div>
      <div class="field"><label class="f">🍟 Smažené</label><div class="chips">${[0, 100, 200, 300].map(g => `<button class="chip ${(day.fried_g || 0) === g ? 'on' : ''} write" onclick="A.dayField('fried_g',${g},'Smažené zapsáno')">${g ? g + ' g' : 'nic'}</button>`).join('')}</div></div></div>
    ${items.length ? `<div class="items-l">${items.map((it, i) => { const kc = kcalOf(it); const st = cheatStupen(kc, b.maxIntake); return `<div class="irow"><div class="inm"><b style="flex:1;min-width:0">${esc(it.food)}</b><span class="cst c-${st.t}">${st.k}</span><button class="xbtn sm write" title="odebrat" onclick="A.cheatDel(${i})">×</button></div>
      <div class="imeta">${it.kcal != null ? `<span class="gstep"><button class="gb write" onclick="A.gnudge(this,-50)">−</button><input class="g" type="number" min="0" step="50" value="${it.kcal}" onchange="A.cheatK(${i},this.value)"><button class="gb write" onclick="A.gnudge(this,50)">+</button><span class="gu">kcal</span></span>` : `<span class="gstep"><button class="gb write" onclick="A.gnudge(this,-10)">−</button><input class="g" type="number" min="0" step="10" value="${gShow(it.g)}" onchange="A.cheatG(${i},this.value)"><button class="gb write" onclick="A.gnudge(this,10)">+</button><span class="gu">g</span></span>`}<span class="m-kcal">${fmt0(kc)} kcal</span><span>≈ ${Math.ceil(kc / Math.max(1, b.walkPerMin))} min chůze</span></div></div>`; }).join('')}</div>` : ''}
    <button class="btn cheatb write" onclick="openCheatPicker()">+ Vybrat, co tě čeká</button>
    ${verdict}`);
});

/* Výběr cheatu: fulltext jako u surovin, u každé položky kalorie, stupeň a cena v chůzi. */
const CheatPick = { q: '' };
function openCheatPicker() {
  const m = UI.modal(''); CheatPick.q = '';
  const d = calcDay(S(), Foods(), Recipes(), effectiveDay(App.date), currentWeight());
  const limit = d.base.maxIntake, perMin = d.base.walkPerMin;
  const draw = () => {
    const q = norm2(CheatPick.q.trim());
    const L = cheatLib().filter(x => !q || norm2(x.nazev).includes(q));
    m.querySelector('.box').innerHTML = UI.sheetHtml('Co tě čeká', `${L.length} ${sklon(L.length, 'položka', 'položky', 'položek')} · stupeň podle podílu na dnešním limitu`,
      `<div class="search"><input type="text" id="chq" value="${esc(CheatPick.q)}" placeholder="hledej – řízek, pizza, čokoláda…" oninput="window._chq(this.value)"></div>
      <div class="plist">${L.slice(0, 120).map(x => { const st = cheatStupen(x.kcal, limit); const min = Math.ceil(x.kcal / Math.max(1, perMin));
        return `<div class="pitem" onclick="window._chpick(${JSON.stringify(x.nazev).replace(/"/g, '&quot;')},${x.kcal})">
          <div class="sp"><div class="pn">${esc(x.nazev)}</div><div class="pi">${esc(x.porce)} · ≈ ${min} min chůze</div></div>
          <div class="pk">${fmt0(x.kcal)} <span>kcal</span><br><span class="cst c-${st.t}">${st.k}</span></div></div>`; }).join('')
        || '<p class="muted small">Nic takového nemám. Zapiš to vlastní položkou níže.</p>'}</div>
      <div class="row nowrap"><input type="text" id="chvl" placeholder="vlastní – např. dort od těty"><button class="btn sec sm" onclick="window._chvl()">Přidat</button></div>`);
    const i = m.querySelector('#chq'); if (CheatPick.q) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  };
  window._chq = v => { CheatPick.q = v; draw(); };
  window._chpick = (nazev, kcal) => { m.remove(); A.cheatPick(nazev, kcal); };
  window._chvl = () => { const el = m.querySelector('#chvl'); const t = (el && el.value || '').trim(); if (!t) return; m.remove(); A.cheatManual(t); };
  draw();
}
A.cheatPick = (nazev, kcal) => Undo.run('Cheat přidán', () => {
  const day = effectiveDay(App.date); day.cheat_items = day.cheat_items || [];
  day.cheat_items.push({ food: nazev, kcal, hrich: true }); saveDay(day); render();
}, () => { const d = calcDay(S(), Foods(), Recipes(), effectiveDay(App.date), currentWeight());
  const st = cheatStupen(kcal, d.base.maxIntake);
  return `${nazev}: ${fmt0(kcal)} kcal – ${st.k} cheat. ${d.base.cheatCoverable ? `Zvedl jsem ti cíl chůze na ${d.base.planWalk} minut.` : 'Uchodit se to už nedá – počítej s tím, že to dnes vezme kus tempa.'}`; });

/* co appka nezná, si Robert odhadne sám */
A.cheatManual = (text) => {
  const m = UI.sheet('Kolik to tak bude?', `„${esc(text)}“ v databázi nemám`, `<p class="small muted">Odhadni kalorie – stačí řádově. Pro představu: pivo 205, řízek 520, kus dortu 400, pizza 800.</p>
    <div class="field"><label class="f">Kalorie</label>${stepper('cheat-k', 300, 50, 0)}</div>`, `<button class="btn" id="ckok">Přidat</button><button class="btn sec" onclick="UI.closeModal()">Zpět</button>`);
  m.querySelector('#ckok').onclick = () => {
    const kcal = Number(m.querySelector('#cheat-k').value) || 0;
    m.remove();
    if (!kcal) return;
    Undo.run('Přidáno k cheatu', () => { const day = effectiveDay(App.date); day.cheat_items = (day.cheat_items || []).concat([{ food: text, kcal }]); saveDay(day); render(); });
  };
};
A.cheatG = (i, v) => Undo.run('Gramáž cheatu', () => { const day = effectiveDay(App.date); day.cheat_items[i].g = Number(v) || 0; saveDay(day); render(); });
A.cheatK = (i, v) => Undo.run('Kalorie cheatu', () => { const day = effectiveDay(App.date); day.cheat_items[i].kcal = Number(v) || 0; saveDay(day); render(); });
A.cheatDel = i => Undo.run('Odebráno z cheatu', () => { const day = effectiveDay(App.date); day.cheat_items.splice(i, 1); saveDay(day); render(); });


/* Kontrola dne v listu: verdikt, všechny kontroly a vzorec limitu */
function renderDayCheck(d, s, day, w, planned) {
  const rad = ch => `<div class="chk k${ch.state}"><span class="nm ${ch.name === 'Kalorie' ? 'm-kcal' : (ch.name === 'Bílkoviny' ? 'm-prot' : '')}">${ch.name}</span><div class="cb">${ch.label ? `<span class="tag">${esc(ch.label)}</span>` : ''}<span class="ct">${esc(ch.text)}</span></div></div>`;
  return `<div class="status st${d.ok ? 2 : (planned ? 1 : 0)}">${esc(d.summary)}</div>
    <div class="checks">${d.checks.map(rad).join('')}</div>
    <h3>Jak se limit počítá</h3>
<table class="small"><tr><td>Aktuální váha (průměr 7 vážení)</td><td class="n">${fmt1(w)} kg</td></tr>
<tr><td>Klidový výdej (Mifflin–St Jeor)</td><td class="n">${fmt0(d.base.bmr)} kcal</td></tr>
<tr><td>Běžný výdej (klidový × ${String(s.activity).replace('.', ',')})</td><td class="n">${fmt0(d.base.baseOut)} kcal</td></tr>
<tr><td>Cílený pohyb – chůze ${day.walk_min || 0} min${day.exercise_min ? ` + cvičení ${day.exercise_min} min` : ''}</td><td class="n">${fmt0(d.base.totalOut - d.base.baseOut)} kcal</td></tr>
<tr><td>Celkový výdej</td><td class="n">${fmt0(d.base.totalOut)} kcal</td></tr>
<tr><td>Plánovaný deficit (${String(s.rate_pct).replace('.', ',')} % váhy/týden)</td><td class="n">− ${fmt0(d.base.deficit)} kcal</td></tr>
<tr><td class="b">Limit dne</td><td class="n b">${fmt0(d.base.maxIntake)} kcal</td></tr>
<tr><td>Limit podle plánu (s cílem chůze a tréninkem)</td><td class="n">${fmt0(d.base.planLimit)} kcal</td></tr>
<tr><td>Sacharidy / tuky</td><td class="n"><b class="m-carb">${fmt0(d.tot.c)} g</b> / <b class="m-fat">${fmt0(d.tot.f)} g</b></td></tr></table>`;
}

/* „Podle situace“: jak vydatné to bylo – jedno ťuknutí místo vypisování surovin (7. 10. 2026).
   Lehké 0,7× · jako plán 1× · vydatné 1,5× · hodně 2× cíle chodu. */
function sitEstHtml(key, m, target, inRow) {
  return `<div class="sitest ${inRow ? 'row-in' : ''}"><span>${inRow ? 'Jak vydatné?' : 'Jak vydatné to bylo?'}</span>${Object.entries(SIT_EST).map(([k, v]) => `<button class="${m.est === k ? 'on' : ''} write" onclick="event.stopPropagation();A.sitEst('${key}','${k}')">${v.l}</button>`).join('')}</div>`;
}
A.sitEst = (key, v) => { Undo.run('Odhad jídla', () => { const day = effectiveDay(App.date); const m = day.meals[key] || {}; day.meals[key] = { ...m, est: m.est === v ? null : v }; saveDay(day); },
  () => { const m = (effectiveDay(App.date).meals || {})[key] || {}; return m.est ? `Odhad: ${SIT_EST[m.est].l} – započítáno do dne.` : 'Odhad zrušen – počítá se cíl jídla.'; });
  render(); };

/* potvrzení včerejška z dnešní obrazovky; po potvrzení zpátky na dnešek */
A.closeYesterday = () => { App.date = addDays(todayISO(), -1); App._backToday = true; render(); A.closeDay(); };
A.eatenMany = keys => { const ks = keys.split(','); Undo.run('Snědeno', () => { const day = getDay(App.date); const eff = effectiveDay(App.date);
  ks.forEach(k => { const m = eff.meals[k] || {}; if (m.sel && m.sel !== VYNECHAT) day.meals[k] = { ...(day.meals[k] || {}), sel: m.sel, eaten: true }; }); saveDay(day); }, `Odškrtnuto: ${ks.length} ${sklon(ks.length, 'jídlo', 'jídla', 'jídel')}.`); render(); };
