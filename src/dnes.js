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
  if (!App.stripWeek) App.stripWeek = mondayOf(todayISO());
  const mon = App.stripWeek; const thisMon = mondayOf(todayISO()); const strip = [];
  for (let k = 0; k < 7; k++) { const dt = addDays(mon, k); const future = dt > todayISO(); const ev = future ? null : (dt < todayISO() ? evaluateDay(dt) : null);
    strip.push(`<button class="${dt === App.date ? 'on' : ''} ${ev && ev.ok ? 'has' : ''}" ${future ? 'disabled style="opacity:.45"' : ''} onclick="App.date='${dt}';render()">${DAY_SHORT[dayIndex(dt)]}<b>${parseISO(dt).getDate()}.</b></button>`); }
  /* Hlavní číslo musí být TOTÉŽ, co ukazuje pruh – jinak se čte jako procento naplnění.
     Je to vždycky rozdíl proti limitu dne: kladný = zbývá, záporný = přes. */
  const reserve = d.remaining, planned = d.tot.kcal > 0;
  const limitK = d.base.maxIntake, intakeK = d.intake;
  /* Velke cislo odpovida na otazku, kterou clovek v poledne opravdu ma: kolik jeste
     muzu snist. To je limit minus SNEDENE. Rezerva celeho planu (limit minus snedene
     i naplanovane) je jina otazka – planovaci – a patri dolu mezi dlazdice. */
  const snedeno = prog.eaten + (d.base.drinkKcal && prog.cheatEaten ? d.base.drinkKcal : 0);
  const zbyvaSnist = limitK - snedeno;
  const pend = (d.base.planKcal || 0) - (d.base.doneKcal || 0);
  const walkPend = Math.max(0, d.base.planWalk - (day.walk_min || 0)) * d.base.walkPerMin;
  const coverable = pend + walkPend >= -reserve;

  /* Den po jidlech: kazdy chod je vlastni dil pruhu, siroky podle svych kalorii. */
  const segy = [];
  d.courses.forEach((c, ci) => {
    if (!(c.active || c.situace) || !(c.kcal > 0)) return;
    segy.push({ key: c.key, em: COURSE_EMOJI[c.key], kcal: c.kcal, snedeno: !!(day.meals[c.key] || {}).eaten, nazev: s.courses[ci].name });
  });
  if (d.base.drinkKcal > 0) segy.push({ key: 'cheat', em: '🍺', kcal: d.base.drinkKcal, snedeno: false, nazev: 'cheat', cheat: 1 });
  const totK = Math.max(limitK, intakeK) || 1;
  const pctL = clamp(limitK / totK * 100, 0, 100);
  const overK = Math.max(0, intakeK - limitK);
  const segHtml = segy.map(g => {
    const w = g.kcal / totK * 100;
    const tit = `${g.nazev}: ${fmt0(g.kcal)} kcal${g.cheat ? '' : (g.snedeno ? ' · snědeno' : ' · ještě tě čeká')}`;
    return `<i class="mseg ${g.snedeno ? 'done' : ''} ${g.cheat ? 'cheat' : ''}" style="width:${w}%" title="${esc(tit)}"
      ${g.cheat ? '' : `onclick="A.toCourse('${g.key}')"`}>${w >= 7 ? `<span>${g.em}</span>` : ''}</i>`;
  }).join('');

  let big, lbl, tone, cap;
  if (!planned) { cap = 'Limit dne'; big = fmt0(limitK); lbl = 'kcal na jídlo a pití – zatím nemáš nic naplánováno'; tone = 'grad3'; }
  else if (zbyvaSnist < 0) {
    cap = 'Přes limit'; big = '−' + fmt0(-zbyvaSnist);
    lbl = `kcal nad limit dne ${fmt0(limitK)} – dnes už jsi snědl ${fmt0(snedeno)} kcal`;
    tone = 'grad3 warnline';
  } else {
    /* Barva karty jde za velkym cislem, ne za planem – cervena vedle „zbyva snist 1 560“
       by si odporovala. Ze plan prelejzda limit, rekne dlazdice rezerva planu a kontrola dne. */
    cap = 'Zbývá sníst';
    big = fmt0(zbyvaSnist);
    const zbyvaPlan = Math.max(0, intakeK - snedeno);
    lbl = zbyvaSnist === 0 ? `kcal – limit ${fmt0(limitK)} je vyčerpaný`
      : reserve < 0 ? `kcal do limitu ${fmt0(limitK)} · ale plán dne je o ${fmt0(-reserve)} kcal nad ním`
      : zbyvaPlan > 0 ? `kcal do limitu ${fmt0(limitK)} · z toho ${fmt0(zbyvaPlan)} má plán dne`
      : `kcal do limitu ${fmt0(limitK)} · plán dne máš snědený`;
    tone = reserve < 0 && !coverable ? 'grad3' : 'grad';
  }
  // karta Teď
  const now = renderNow(cl, d, day, tasks, s);
  return `
  <div class="row between" style="margin-bottom:8px"><h1>${isToday ? 'Dnes' : dn}${help('Jeden den odshora dolů: Teď říká jediný další krok, Stav dne sčítá snědené proti limitu a dole hlásí, co nesedí. Pak úkoly, plán cheatu, aktivita, jídla a poznámka pro trenéra. Limit dne není strop příjmu – je to hranice, do které vyjde plánovaný deficit; chůze a trénink ji zvedají.')} <span class="muted" style="font-weight:600;font-size:15px">${czDate(App.date)}</span></h1>
    <div class="row">${st >= 2 ? `<span class="streak">🔥 ${st} ${st < 5 ? 'dny' : 'dnů'} v řadě</span>` : ''}${ws >= 3 ? `<span class="streak" style="background:var(--p-bg);color:var(--p-ink)">⚖️ ${ws}× vážení</span>` : ''}</div></div>
  <div class="row" style="gap:6px;margin-bottom:12px"><button class="daynav" onclick="A.stripShift(-7)" title="předchozí týden">‹</button>
    <div class="calstrip noprint" style="flex:1;margin:0">${strip.join('')}</div>
    <button class="daynav" onclick="A.stripShift(7)" ${mon >= thisMon ? 'disabled style="opacity:.35"' : ''} title="další týden">›</button></div>
  ${mon !== thisMon ? `<p class="tiny muted" style="margin:-6px 0 10px">Koukáš na týden od ${czDateShort(mon)} <button class="btn sec sm" onclick="A.stripShift(0)">zpět na tento týden</button></p>` : ''}
  ${flow('dnes', ['Zvaž se ráno', 'Odškrtávej jídla', 'Zapiš chůzi', 'Večer mrkni na kontrolu dne'], 'Karta Teď nahoře ti vždycky řekne jeden další krok – když nevíš, drž se jí.')}
  ${isMaintWeek(s, App.date) ? `<div class="alert a3" style="margin-bottom:10px"><div style="flex:1"><b>Tenhle týden je udržovací.</b> Deficit je nula, limit sedí na celkovém výdeji – najíš se víc a váha se skoro nehne. Není to pauza: jídlo, chůze i trénink jedou dál. Po něm se vrací normální tempo.</div></div>` : ''}
  ${isToday ? catchUpAlert() : ''}
  ${isToday ? mismatchAlert(App.date) : ''}
  ${now}
  ${note ? `<div class="note"><span class="em">💬</span><div><div class="tiny muted" style="font-weight:700">Vzkaz od trenéra${noteAt ? ' · ' + czDateShort(noteAt) : ''}</div><div>${esc(note)}</div></div></div>` : ''}
  <div class="card ga-hero" style="padding:0;overflow:hidden">
  <div class="herob ${tone}"><div class="hcap">${cap} <button class="ibtn" style="border-color:rgba(255,255,255,.6);background:transparent;color:#fff" onclick="event.stopPropagation();UI.pop(this,'Velké číslo je rozdíl mezi limitem dne a vším, co na dnešek máš – snědeným i naplánovaným. Pruh pod ním ukazuje totéž: plná část je snědeno, šrafovaná ještě naplánováno, červený přesah je nad limitem. Limit dne = celkový výdej (klidový výdej × 1,34 + cílený pohyb) − plánovaný deficit. Není to strop, do kterého se musíš najíst.')">i</button></div><div class="big">${big}</div><div class="lbl">${lbl}</div>
  <div class="mbar" style="margin-top:14px">${segHtml}${overK > 0 ? `<b class="over" style="left:${pctL}%"></b>` : ''}${intakeK < limitK ? '' : ''}<u style="left:${pctL}%" title="limit ${fmt0(limitK)} kcal"></u></div>
  <div class="blg"><span><i class="e"></i>snědeno ${fmt0(snedeno)}</span>${intakeK - snedeno > 0 ? `<span><i class="p"></i>ještě tě čeká ${fmt0(intakeK - snedeno)}</span>` : ''}${overK ? `<span><i class="o"></i>nad limit ${fmt0(overK)}</span>` : ''}<span class="gr">limit ${fmt0(limitK)}</span></div></div>
  <div class="stats3">
  <div><b class="${d.tot.p > 0 ? (d.tot.p >= d.protTarget ? 'ok' : 'bad') : ''}">${fmt0(d.tot.p)} <small>/ ${d.protTarget || s.protein_min}</small></b><span><span class="mdot prot"></span>bílkoviny (g)</span></div>
  <div><b class="${planned ? (d.dayDeficit >= d.base.deficit * 0.9 ? 'ok' : 'warn') : ''}">${planned ? (d.dayDeficit < 0 ? signed0(d.dayDeficit) : fmt0(d.dayDeficit)) : '–'}</b><span>${planned ? (d.dayDeficit >= 0 ? `dnešní deficit · ${fmt2(d.dayDeficit * 7 / KG_KCAL)} kg/týden, plán ${fmt2(w * s.rate_pct / 100)}` : 'dnes jsi v plusu – takhle se přibírá') : 'dnešní deficit'}</span></div>
  <div><b class="${!planned ? '' : (reserve >= 0 ? 'ok' : (coverable ? 'warn' : 'bad'))}">${planned ? signed0(reserve) : '–'}</b><span>rezerva plánu · celý den ${fmt0(intakeK)} z ${fmt0(limitK)}</span></div>
  </div>
  ${renderDayCheck(d, s, day, w, planned)}
  </div>
  <div class="card ga-tasks"><div class="row between"><h2>Úkoly dne${help('Seznam toho, co dnes udělat: zvážit se, sníst pět jídel, ujít svoje minuty, odškrtat trénink. Ťuknutím se úkol odškrtne, u jídla se rovnou zapíše, že jsi ho snědl. Pořadí je podle času, ne podle důležitosti.')}</h2><span class="small muted">${doneN}/${tasks.length}</span></div>
  <div class="bar" style="margin:8px 0 10px;height:6px"><i style="width:${doneN / tasks.length * 100}%"></i></div>
  <div class="tasks">${tasks.map(t => `<div class="task ${t.done ? 'done' : ''} ${t.now ? 'now' : ''}" onclick="${t.meal ? `A.eaten('${t.meal}',${!t.done})` : t.id === 'walk' || t.id === 'training' ? `document.getElementById('aktivita').scrollIntoView({behavior:'smooth',block:'start'})` : `${t.week ? `App.week='${t.week}';` : ''}${t.view === 'dnes' ? "document.querySelector('#meals').scrollIntoView({behavior:'smooth'})" : `go('${t.view}')`}`}">
  <span class="ck">${t.done ? '✓' : ''}</span><span style="font-size:18px">${t.em}</span><div><div class="tx">${esc(t.tx)}</div>${t.sub ? `<div class="sub">${esc(t.sub)}</div>` : ''}</div><span class="go">${t.done ? '' : (t.meal ? (t.chosen ? 'snědl jsem' : 'vybrat') : 'otevřít')}${t.at && !t.done ? ` · ${t.at}` : ''}</span></div>`).join('')}</div></div>
  ${renderCheatCard(App.date, day, d)}
  ${renderActivityCard(App.date, day, d)}
  <div id="meals" class="row between" style="margin:8px 0 8px"><h2>🍽️ Jídla dne${help('Pět jídel dne. Řádek ukazuje, co máš naplánované a za kolik kalorií; klikem se rozbalí a dá se upravit – vyměnit jídlo (💡 jiné), vyměnit nebo odebrat surovinu, přepsat gramy, přidat něco navíc. Přílohu appka škáluje sama podle limitu, bílkovinu nekrátí.')} <span class="muted small" style="font-weight:600">${s.courses.some(c => day.meals[c.key].planned) ? `plán na ${dn.toLowerCase()}` : 'bez plánu z Týdne'}</span></h2>
  <div class="row noprint">${prog.missing.length ? `<button class="btn sm write" onclick="A.suggestDay()">💡 Navrhnout ${prog.missing.length === 5 ? 'den' : 'chybějící'}</button>` : ''}${!prog.missing.length && prog.planned > 0 ? `<button class="btn sm write" onclick="A.eatenAll()">✓ Snědl jsem všechno podle plánu</button>` : ''}<button class="btn sec sm write" onclick="A.resetDay()">Vrátit plán z Týdne</button></div></div>
  ${d.courses.map((c, i) => renderCourse(s, foods, recipes, day, c, i, d)).join('')}
  ${noteCard(App.date, day)}`;

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
    if (next.id === 'weigh') action = `<div class="row"><input type="text" inputmode="decimal" id="nw" placeholder="kg" style="width:110px;font-size:18px;font-weight:800" inputmode="decimal"><button class="btn write" onclick="A.quickWeigh()">Zapsat váhu</button></div>`;
    else if (next.meal) { const c = s.courses.find(x => x.key === next.meal); action = next.chosen ? `<div class="row"><button class="btn write" onclick="A.eaten('${next.meal}',true)">✓ Snědl jsem ${c.name.toLowerCase()}</button><button class="btn sec sm write" onclick="document.getElementById('c-${next.meal}').scrollIntoView({behavior:'smooth'})">Změnit jídlo</button></div>` : `<div class="row"><button class="btn write" onclick="A.suggestOne('${next.meal}')">💡 Navrhni ${c.name.toLowerCase()}</button><button class="btn sec sm write" onclick="document.getElementById('c-${next.meal}').scrollIntoView({behavior:'smooth'})">Vyberu sám</button></div>`; }
    else if (next.id === 'walk') action = `<div class="row"><button class="btn write" onclick="A.addWalk(30)">+30 min chůze</button><button class="btn sec sm write" onclick="A.addWalk(60)">+60</button><button class="btn sec sm write" onclick="A.addWalk(15)">+15</button></div>`;
    else if (next.id === 'plan_now' || next.id === 'plan') action = `<div class="row"><button class="btn write" onclick="App.week='${next.week}';go('tyden');setTimeout(()=>A.genWeek(weekPlanned(App.week)?'empty':'all'),50)">✨ Navrhnout týden</button><button class="btn sec sm" onclick="App.week='${next.week}';go('tyden')">Otevřít Týden</button></div>`;
    else if (next.id === 'shop') action = `<div class="row"><button class="btn" onclick="App.week='${next.week}';A.jidlo('nakup')">🛒 Otevřít nákup</button></div>`;
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
      c.items.map(it => it.extra ? `<tr><td><button class="pickbtn sm edit" onclick="openFoodPicker(n=>A.extraFood('${cs.key}',${String(it.idx).slice(1)},n),${JSON.stringify(it.food).replace(/"/g, '&quot;')})">${esc(it.food)}</button><div class="tiny muted">přidáno</div></td>
        <td class="n"><span class="gstep"><button class="gb" onclick="A.gnudge(this,-10)">−</button><input class="g edit" type="number" min="0" step="5" value="${gShow(it.g)}" onchange="A.extraG('${cs.key}',${String(it.idx).slice(1)},this.value)"><button class="gb" onclick="A.gnudge(this,10)">+</button></span></td><td class="n" data-l="kcal">${fmt0(it.kcal)}</td><td class="n" data-l="bílk.">${fmt1(it.p)}</td><td class="n"><button class="xbtn write" title="odebrat" onclick="A.extraDel('${cs.key}',${String(it.idx).slice(1)})">×</button></td></tr>`
      : `<tr><td>${modeBadge(it.food)}<button class="pickbtn sm ${it.swapped ? 'edit' : ''}" style="width:calc(100% - 26px)" onclick="openFoodPicker(n=>A.swap('${cs.key}',${it.idx},n),${JSON.stringify(it.food).replace(/"/g, '&quot;')})">${esc(it.food)}</button>${it.swapped ? `<div class="tiny muted">recept: ${esc(it.origFood)}</div>` : ''}</td>
        <td class="n">${measureText(it.food, it.g) ? `<div class="meas">${measureText(it.food, it.g)}</div>` : ''}<span class="gstep"><button class="gb" onclick="A.gnudge(this,-10)">−</button><input class="g ${it.manual ? 'edit' : ''}" type="number" min="0" step="5" value="${gShow(it.g)}" onchange="A.gram('${cs.key}',${it.idx},this.value)"><button class="gb" onclick="A.gnudge(this,10)">+</button><span class="gu">g</span></span>${it.scale && !it.manual && it.g !== it.origG ? `<div class="tiny muted">recept ${gShow(it.origG)} g · přizpůsobeno tvému limitu</div>` : ''}</td>
        <td class="n" data-l="kcal">${fmt0(it.kcal)}</td><td class="n" data-l="bílk.">${fmt1(it.p)}</td><td class="n"><button class="xbtn write" title="odebrat" onclick="A.removeItem('${cs.key}',${it.idx})">×</button></td></tr>`).join('') +
      (c.removedItems || []).map(r => `<tr class="muted"><td colspan="4" style="text-decoration:line-through">${esc(r.food)} ${r.g} g</td><td class="n"><button class="xbtn write" title="vrátit" onclick="A.unremoveItem('${cs.key}',${r.idx})">↺</button></td></tr>`).join('') +
      `<tr class="sum"><td class="b">celkem</td><td class="n b">${fmt0(c.gc)} g<div class="tiny muted" style="font-weight:600">na talíři${Math.abs(c.gc - c.g) > 5 ? ` · ${fmt0(c.g)} g nakoupit` : ''}</div></td><td class="n b" data-l="kcal">${fmt0(c.kcal)}</td><td class="n b" data-l="bílk.">${fmt1(c.p)}</td><td></td></tr></table></div>` +
      `<div class="row" style="margin-top:8px"><button class="btn sec sm write" onclick="A.extraAdd('${cs.key}')">+ přidat surovinu</button>${c.edited ? `<button class="btn sec sm write" onclick="A.resetCourse('${cs.key}')">Vrátit recept beze změn</button>` : ''}</div>`;
  } else if (c.situace) body = `<p class="small muted">${c.zapsano ? `Zapsáno ${fmt0(c.kcal)} kcal · cíl byl ${fmt0(cs.kcal)} kcal. Do součtu dne jde tvůj zápis, ne cíl.` : `Vyřešíš na místě – cíl jídla ${fmt0(cs.kcal)} kcal, min. ${SEED.settings.courses[i].prot_min} g bílkovin. Dokud nic nenapíšeš, počítá se cíl. Napiš, co jsi snědl, nebo použij 🍽️ mimo dům.`}</p>
      <div class="row"><input type="text" id="ate-${cs.key}" value="${esc(m.ate_text || '')}" placeholder="např. 2 rohlíky se šunkou a sýrem, jablko" style="flex:1;min-width:200px"><button class="btn sec sm write" onclick="A.ateText('${cs.key}',document.getElementById('ate-${cs.key}').value)">Rozpoznat</button></div>
      ${(m.extra || []).length ? `<div class="tbl"><table class="items" style="margin-top:8px"><tr><th>Surovina</th><th class="n">g</th><th class="n">kcal</th><th></th></tr>${(m.extra || []).map((ex, j) => { const f = foods.find(x => x.name === ex.food); return `<tr><td>${modeBadge(ex.food)}<button class="pickbtn sm edit" style="width:calc(100% - 26px)" onclick="openFoodPicker(n=>A.extraFood('${cs.key}',${j},n),${JSON.stringify(ex.food).replace(/"/g, '&quot;')})">${esc(ex.food)}</button></td><td class="n">${measureText(ex.food, ex.g) ? `<div class="meas">${measureText(ex.food, ex.g)}</div>` : ''}<span class="gstep"><button class="gb" onclick="A.gnudge(this,-10)">−</button><input class="g edit" type="number" min="0" step="5" value="${gShow(ex.g)}" onchange="A.extraG('${cs.key}',${j},this.value)"><button class="gb" onclick="A.gnudge(this,10)">+</button><span class="gu">g</span></span></td><td class="n">${f ? fmt0(f.kcal * ex.g / 100) : ''}</td><td class="n"><button class="xbtn write" onclick="A.extraDel('${cs.key}',${j})">×</button></td></tr>`; }).join('')}<tr><td class="b">celkem</td><td></td><td class="n b">${fmt0((m.extra || []).reduce((a, ex) => { const f = foods.find(x => x.name === ex.food); return a + (f ? f.kcal * ex.g / 100 : 0); }, 0))}</td><td></td></tr></table></div><p class="hint">Tenhle zápis jde rovnou do součtu dne.</p>` : ''}`;
  else if (c.skipped) body = `<p class="small muted">Vynecháno.</p>`;
  const st = c.active ? (Math.abs(c.kcal - c.target) <= 30 ? 'ok' : (c.kcal > c.target ? 'bad' : 'warn')) : '';
  const eaten = !!m.eaten;
  const open = App.openCourse === cs.key;   // jídla jsou sbalená, rozkliknutím se otevře editace
  const sum = !cur ? 'nevybráno' : (cur === VYNECHAT ? 'vynecháno' : cur);
  return `<div class="course ${eaten ? 'eaten' : ''} ${open ? 'open' : ''}" id="c-${cs.key}"><div class="hd" onclick="A.toggleCourse('${cs.key}')" title="${open ? 'sbalit' : 'rozbalit a upravit'}"><span style="font-size:18px">${COURSE_EMOJI[cs.key]}</span><span class="t">${esc(cs.name)}</span><span class="time">${cs.time}</span>
      <span class="csum ${cur ? '' : 'muted'}">${esc(sum)}${cookFor(App.date, cs.key) ? ' <span class="pill ok">🍱 uvařeno</span>' : ''}</span>
      ${cur && cur !== VYNECHAT ? `<button class="eat big ${eaten ? 'on' : ''} write" onclick="event.stopPropagation();A.eaten('${cs.key}',${!eaten})">${eaten ? '✓ snědeno' : 'snědl jsem'}</button>` : ''}${cur && cur !== SITUACE && cur !== VYNECHAT ? `<button class="star ${isFav(cur) ? 'on' : ''}" onclick="event.stopPropagation();A.favInPlace(this,${JSON.stringify(cur).replace(/"/g, '&quot;')})" title="oblíbené">${isFav(cur) ? '★' : '☆'}</button>` : ''}
      <span class="k ${st}">${c.active || c.situace ? fmt0(c.kcal) + ' kcal' : ''}${c.active && c.gc ? `<b class="pw">${fmt0(c.gc)} g</b>` : ''}</span><span class="cotog">${open ? '▴' : '▾'}</span></div>
    ${!open ? '' : `<div class="bd"><div class="row" style="gap:6px"><div style="flex:1;min-width:0">${pickBtn}</div><button class="btn sec sm write" title="navrhnout jinou variantu, která se vejde" onclick="A.suggestOne('${cs.key}')">💡 jiné</button><button class="btn sec sm write" title="jedl jsem mimo dům – restaurace, jídelna, návštěva" onclick="A.outMeal('${cs.key}')">🍽️ mimo dům</button></div>
    <div class="hint">${c.active ? (() => { const t = toleranceText(c.kcal, c.target); return `<b class="${t.ok ? 'ok' : 'warn'}">${t.text}</b> · cíl ${fmt0(c.target)} kcal`; })() : esc(c.hint)}${m.sel && m.planned && m.sel !== m.planned ? ` · místo plánu (${esc(m.planned)})` : ''}${m.auto ? ' · navrženo appkou' : ''}</div>
    <div style="margin-top:8px">${body}</div></div>`}</div>`;
}

A.stripShift = n => { App.stripWeek = n ? addDays(App.stripWeek, n) : mondayOf(todayISO()); render(); };
A.toCourse = key => { App.openCourse = key; render();
  setTimeout(() => { const el = document.getElementById('c-' + key); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 60); };
A.toggleCourse = key => { App.openCourse = App.openCourse === key ? null : key; render(); };

/* ---- akce Dnes (vše se Zpět a hláškou) ---- */
const dayMsg = (lead) => () => { const d = calcDay(S(), Foods(), Recipes(), effectiveDay(App.date), currentWeight()); const st = d.tot.kcal === 0 ? '' : (d.remaining < -30 ? ` Den je ${fmt0(-d.remaining)} kcal přes limit.` : ` Den sedí, rezerva ${fmt0(Math.max(0, d.remaining))} kcal.`); return lead + st; };
const MEZE = { beers: [0, 40, 'piv'], fried_g: [0, 3000, 'g smaženého'], exercise_min: [0, 600, 'minut cvičení'], walk_kmh: [2, 9, 'km/h'], extra_kcal: [0, 8000, 'kcal'] };
A.dayField = (f, v, label) => {
  const m = MEZE[f];
  const r = m ? omez(v, m[0], m[1]) : { n: v === '' ? null : cislo(v), mimo: false };
  if (m && r.mimo) UI.toast(`${fmt0(r.n)} ${m[2]} je maximum, které dává smysl – zapsal jsem tolik.`);
  return Undo.run(label || 'Změna dne', () => { const day = effectiveDay(App.date); day[f] = r.n; saveDay(day); render(); }, dayMsg(label || 'Uloženo.'));
};
A.setWalk = v => { const r = omez(v, 0, 600); if (r.mimo) UI.toast('Chůze se zapisuje v rozmezí 0 až 600 minut.'); return Undo.run('Chůze', () => { const day = effectiveDay(App.date); day.walk_min = r.n; saveDay(day); render(); }, () => { const day = effectiveDay(App.date); const s = S(); const left = s.walk_min - (day.walk_min || 0); return left > 0 ? `Chůze ${day.walk_min || 0} min. Zbývá ${left} min do cíle.` : `Chůze ${day.walk_min} min – cíl splněn.`; }); };
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
  UI.modal(`<div class="row between"><h2>Jedl jsem mimo dům${help('Vyber, co se tomu nejvíc podobá. Gramáž pak dolaď – porce v restauraci bývá 350 až 500 g. Je to odhad (±20 %), ale do součtu dne patří: prázdný den lže víc než odhad.')}</h2><button class="xbtn" onclick="UI.closeModal()">×</button></div>
    <p class="small muted" style="margin-bottom:8px">${esc(c.name)} · cíl byl ${fmt0(c.kcal)} kcal. Vyber nejbližší jídlo, gramáž pak upravíš.</p>
    <div class="card tight"><table class="small"><tr><th>Jídlo</th><th class="n">porce</th><th class="n m-kcal">kcal</th><th class="n m-prot">B</th></tr>
    ${lib.map(f => `<tr style="cursor:pointer" onclick="A.outPick('${key}',${JSON.stringify(f.name).replace(/"/g, '&quot;')},${f.port || 400})"><td class="b">${esc(f.name)}</td><td class="n muted">${f.port || 400} g</td><td class="n b">${fmt0(f.kcal * (f.port || 400) / 100)}</td><td class="n">${fmt0(f.p * (f.port || 400) / 100)}</td></tr>`).join('')}
    </table></div>`, { wide: 1 });
};
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
  if (!pl.ok) { const mm = UI.modal(`<h2>Sedí to?</h2><p class="muted" style="margin-top:8px">Zapisuješ <b>${fmt1(v)} kg</b>, průměr posledních dnů je <b>${fmt1(pl.prev.avg)} kg</b>. Rozdíl ${(pl.diff > 0 ? '+' : '−') + fmt1(Math.abs(pl.diff))} kg je nezvyklý – překlep?</p><div class="row" style="margin-top:12px"><button class="btn sec" onclick="UI.closeModal()">Opravím</button><button class="btn" id="mfy">Je to správně</button></div>`); mm.querySelector('#mfy').onclick = () => { mm.remove(); save(); }; return; }
  save(); };
A.favInPlace = (btn, name) => { toggleFav(name); const on = isFav(name); btn.classList.toggle('on', on); btn.textContent = on ? '★' : '☆'; UI.toast(on ? `${name} přidáno do oblíbených.` : `${name} odebráno z oblíbených.`); };

/* typické hříchy, které v databázi zdravých surovin nejsou – kcal za obvyklou porci */
const CHEAT_LIB = [
  ['řízek', 520, 'smažený řízek (150 g)'], ['hranolky', 380, 'porce hranolek (150 g)'],
  ['pizza', 800, 'pizza (celá, 30 cm)'], ['hamburger', 550, 'hamburger'],
  ['kebab', 700, 'kebab v pitě'], ['smažený sýr', 600, 'smažený sýr s tatarkou'],
  ['guláš', 550, 'guláš s knedlíkem'], ['svíčková', 700, 'svíčková s knedlíkem'],
  ['chipsy', 530, 'sáček chipsů (100 g)'], ['čokoláda', 540, 'tabulka čokolády (100 g)'],
  ['zmrzlina', 250, 'kopečková zmrzlina (2 kopečky)'], ['dort', 400, 'kus dortu'],
  ['koláč', 300, 'kus koláče'], ['víno', 160, 'sklenice vína (2 dcl)'],
  ['panák', 110, 'panák tvrdého (0,5 dcl)'], ['kofola', 180, 'kofola (0,5 l)'],
  ['limonáda', 210, 'slazená limonáda (0,5 l)'], ['klobása', 450, 'klobása (150 g)'],
];
const norm2 = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
function parseCheat(text) {
  const t = ' ' + norm2(text).replace(/[,.;]/g, ' ') + ' ';
  return CHEAT_LIB.filter(([k]) => t.includes(norm2(k))).map(([k, kcal, popis]) => ({ food: popis, kcal, hrich: true }));
}

/* ===== Cheat na dnešek =====
   Robert zapíše ráno, co ho večer čeká. Appka to počítá do dne jako plán
   a hlavně mu zvedne cíl chůze tak, aby to večer stálo co nejmíň.
   Nic se tu nepotvrzuje jako „snědeno“ – je to plán, ne zápis. */
function renderCheatCard(date, day, d) {
  const b = d.base; const items = day.cheat_items || []; const s = S(); const w = currentWeight();
  const foods = Foods();
  const kcalOf = it => { if (it.kcal != null) return Number(it.kcal) || 0; const f = foods.find(x => x.name === it.food); return f ? f.kcal * (Number(it.g) || 0) / 100 : 0; };
  const tempoDnes = d.dayDeficit * 7 / KG_KCAL;
  const verdict = b.cheatKcal <= 0
    ? `<p class="small muted" style="margin:8px 0 0">Zatím nic navíc.</p>`
    : b.cheatCoverable
    ? `<div class="alert a3" style="margin-top:10px"><div><b>${fmt0(b.cheatKcal)} kcal navíc – tohle se dá uchodit.</b> Zvedl jsem ti dnešní cíl chůze o <b>${b.cheatWalk} minut na ${b.planWalk}</b>. Když je dojdeš, večer tě to nebude stát nic a tempo zůstane stejné. Porce jídel nechávám, jak byly.</div></div>`
    : `<div class="alert a2" style="margin-top:10px"><div><b>${fmt0(b.cheatKcal)} kcal navíc – tohle už se uchodit nedá.</b> Musel bys ujít ${b.cheatWalkFull ?? Math.ceil(b.cheatKcal / b.walkPerMin)} minut navíc, což je nesmysl. Tak to neřeším chůzí: přidal jsem ti ${b.cheatWalk} minut (cíl ${b.planWalk}), zmenšil porce jídel, jak to šlo (bílkovinu nekrátím), a zbytek prostě ber.
        Dneska ti to sebere kus tempa – vyjde ${fmt2(tempoDnes)} kg za týden místo ${fmt2(w * s.rate_pct / 100)}. <b>Jeden takový večer za měsíc nic nezkazí</b>, jen ať z toho není zvyk. Kdyby sis chtěl ubrat, nejlevnější je vynechat jedno pivo nebo přílohu.</div></div>`;
  return `<div class="card" id="cheat"><div class="row between"><h2>🍻 Cheat na dnešek${help('Plán, ne zápis. Když víš, že večer bude pivo, řízek nebo dort, zapiš to sem ráno. Appka to počítá do dnešního plánu a hlavně ti zvedne cíl chůze tak, aby tě to nestálo tempo. Nic se tu potom nepotvrzuje – je to plán na večer, ne záznam snědeného.')}</h2>${b.cheatKcal > 0 ? `<span class="pill">${fmt0(b.cheatKcal)} kcal</span>` : ''}</div>
    <div class="row write" style="margin-top:10px;gap:16px;align-items:flex-end">
      <div class="in"><label class="f">🍺 Piva (0,5 l)</label>${stepper('beers', day.beers || 0, 1, 0, 20, "A.dayField(&quot;beers&quot;,this.value,&quot;Piva zapsána&quot;)")}</div>
      <div class="in"><label class="f">🍟 Smažené</label><div class="row" style="gap:6px">${[0, 100, 200, 300].map(g => `<button class="chip ${(day.fried_g || 0) === g ? 'on' : ''}" onclick="A.dayField('fried_g',${g},'Smažené zapsáno')">${g ? g + ' g' : 'nic'}</button>`).join('')}</div></div></div>
    <div class="row write" style="margin-top:10px"><input type="text" id="cheat-q" placeholder="co ještě bude – např. řízek, hranolky, dort" style="flex:1;min-width:180px"><button class="btn sec sm" onclick="A.cheatAdd()">Přidat</button></div>
    ${items.length ? `<div class="tbl" style="margin-top:8px"><table class="items"><tr><th>Co</th><th class="n">kolik</th><th class="n m-kcal">kcal</th><th></th></tr>
      ${items.map((it, i) => `<tr><td>${esc(it.food)}</td>
        <td class="n">${it.kcal != null ? `<span class="gstep"><button class="gb" onclick="A.gnudge(this,-50)">−</button><input class="g" type="number" min="0" step="50" value="${it.kcal}" onchange="A.cheatK(${i},this.value)"><button class="gb" onclick="A.gnudge(this,50)">+</button><span class="gu">kcal</span></span>` : `<span class="gstep"><button class="gb" onclick="A.gnudge(this,-10)">−</button><input class="g" type="number" min="0" step="10" value="${gShow(it.g)}" onchange="A.cheatG(${i},this.value)"><button class="gb" onclick="A.gnudge(this,10)">+</button><span class="gu">g</span></span>`}</td>
        <td class="n" data-l="kcal">${fmt0(kcalOf(it))}</td>
        <td class="n"><button class="xbtn" title="odebrat" onclick="A.cheatDel(${i})">×</button></td></tr>`).join('')}</table></div>` : ''}
    ${verdict}</div>`;
}
A.cheatAdd = () => {
  const el = document.getElementById('cheat-q'); const t = (el ? el.value : '').trim();
  if (!t) { UI.toast('Napiš, co tě večer čeká.'); return; }
  const hrichy = parseCheat(t);
  const zdrave = hrichy.length ? [] : parseAteText(t).map(f => ({ food: f.name, g: 100 }));
  const nove = hrichy.length ? hrichy.map(h => ({ food: h.food, kcal: h.kcal })) : zdrave;
  if (!nove.length) { A.cheatManual(t); return; }
  Undo.run('Přidáno k cheatu', () => {
    const day = effectiveDay(App.date);
    day.cheat_items = (day.cheat_items || []).concat(nove);
    saveDay(day); render();
  }, `${nove.map(f => f.food).join(', ')} – čísla si můžeš doladit.`);
};
/* co appka nezná, si Robert odhadne sám */
A.cheatManual = (text) => {
  const m = UI.modal(`<h2>Kolik to tak bude?</h2><p class="small muted" style="margin:6px 0 10px">„${esc(text)}“ v databázi nemám. Odhadni kalorie – nemusí to sedět na desítky, stačí řádově. Pro představu: pivo 205, řízek 520, kus dortu 400, pizza 800.</p>
    <div class="in"><label class="f">Kalorie</label>${stepper('cheat-k', 300, 50, 0)}</div>
    <div class="row" style="margin-top:12px"><button class="btn" id="ckok">Přidat</button><button class="btn sec" onclick="UI.closeModal()">Zpět</button></div>`);
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


/* Kontrola dne uvnitř karty se stavem: nahoře jen to, co nesedí, zbytek na rozkliknutí */
function renderDayCheck(d, s, day, w, planned) {
  const rad = ch => `<div class="chk k${ch.state}"><span class="nm ${ch.name === 'Kalorie' ? 'm-kcal' : (ch.name === 'Bílkoviny' ? 'm-prot' : '')}">${ch.name}</span><div class="cb">${ch.label ? `<span class="tag">${esc(ch.label)}</span>` : ''}<span class="ct">${esc(ch.text)}</span></div></div>`;
  const spatne = d.checks.filter(c => c.state === 1);
  const hlavni = spatne.length ? spatne.map(rad).join('')
    : `<div class="chk k2"><span class="nm">Kontrola dne</span><div class="cb"><span class="tag">Sedí</span><span class="ct">${d.tot.kcal === 0 ? 'Zatím není co kontrolovat – vyber jídla.' : 'Všechno sedí: kalorie, bílkoviny i pohyb.'}</span></div></div>`;
  return `<div class="hcheck">
    <div class="checks">${hlavni}</div>
    <div class="status day st${d.ok ? 2 : (planned ? 1 : 0)}">${esc(d.summary)}</div>
    <details style="margin-top:10px"><summary class="small muted" style="cursor:pointer">Celá kontrola a jak se limit počítá</summary>
      <div class="checks" style="margin-top:6px">${d.checks.map(rad).join('')}</div>
      <details style="margin-top:10px"><summary class="small muted" style="cursor:pointer">Jak se limit počítá</summary>
<table class="small" style="margin-top:6px"><tr><td>Aktuální váha (průměr 7 vážení)</td><td class="n">${fmt1(w)} kg</td></tr>
<tr><td>Klidový výdej (Mifflin–St Jeor)</td><td class="n">${fmt0(d.base.bmr)} kcal</td></tr>
<tr><td>Běžný výdej (klidový × ${String(s.activity).replace('.', ',')})</td><td class="n">${fmt0(d.base.baseOut)} kcal</td></tr>
<tr><td>Cílený pohyb – chůze ${day.walk_min || 0} min${day.exercise_min ? ` + cvičení ${day.exercise_min} min` : ''}</td><td class="n">${fmt0(d.base.totalOut - d.base.baseOut)} kcal</td></tr>
<tr><td>Celkový výdej</td><td class="n">${fmt0(d.base.totalOut)} kcal</td></tr>
<tr><td>Plánovaný deficit (${String(s.rate_pct).replace('.', ',')} % váhy/týden)</td><td class="n">− ${fmt0(d.base.deficit)} kcal</td></tr>
<tr><td class="b">Limit dne</td><td class="n b">${fmt0(d.base.maxIntake)} kcal</td></tr>
<tr><td>Limit podle plánu (s cílem chůze a tréninkem)</td><td class="n">${fmt0(d.base.planLimit)} kcal</td></tr>
<tr><td><span class="mdot carb"></span>Sacharidy / <span class="mdot fat"></span>tuky</td><td class="n"><b class="m-carb">${fmt0(d.tot.c)} g</b> / <b class="m-fat">${fmt0(d.tot.f)} g</b></td></tr></table></details></details></div>`;
}
