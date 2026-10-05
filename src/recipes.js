/* ===== Jednotná lišta Hledat · Řadit · Filtr =====
   cfg: { q, onQ, sorts:[[key,label]], sort, onSort, filters:[[key,label,on]], onFilter, extra(html) } */
function filterBar(id, cfg) {
  const inp = `<div class="search"><input type="text" id="${id}-q" placeholder="${esc(cfg.placeholder || 'hledat…')}" value="${esc(cfg.q || '')}" oninput="${cfg.onQ}(this.value);const i=document.getElementById('${id}-q');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length)}"></div>`;
  const sorts = cfg.sorts && cfg.sorts.length ? cfg.sorts.map(([k, l]) => `<button class="chip ${cfg.sort === k ? 'on' : ''}" onclick="${cfg.onSort}('${k}')">${l}</button>`).join('') : '';
  const filters = cfg.filters && cfg.filters.length ? cfg.filters.map(([k, l, on]) => `<button class="chip ${on ? 'on' : ''}" onclick="${cfg.onFilter}('${k}')">${on ? '✓ ' : ''}${l}</button>`).join('') + (cfg.filters.some(f => f[2]) ? `<button class="chip" onclick="${cfg.onFilter}('__clear')">× zrušit</button>` : '') : '';
  return `<div class="stack s8">${inp}${sorts ? `<div class="chips scroll">${sorts}</div>` : ''}${filters ? `<div class="chips scroll">${filters}${cfg.extra || ''}</div>` : ''}</div>`;
}

/* ===== Výběr suroviny (modal s hledáním a kategoriemi) ===== */
const FoodPick = { q: '', cat: '', sort: 'name' };
function openFoodPicker(onPick, current) {
  const m = UI.modal(''); FoodPick.q = ''; FoodPick.cat = ''; FoodPick.sort = 'name';
  const draw = () => {
    const foods = Foods(); const q = FoodPick.q.toLowerCase().trim();
    let L = foods.filter(f => (!q || f.name.toLowerCase().includes(q)) && (!FoodPick.cat || f.cat === FoodPick.cat));
    L.sort((a, b) => FoodPick.sort === 'kcal' ? a.kcal - b.kcal : FoodPick.sort === 'p' ? b.p - a.p : a.name.localeCompare(b.name, 'cs'));
    const cats = [...new Set(foods.map(f => f.cat))].sort((a, b) => a.localeCompare(b, 'cs'));
    m.querySelector('.box').innerHTML = UI.sheetHtml('Vyber surovinu', `${L.length} ${sklon(L.length, 'surovina', 'suroviny', 'surovin')} · hodnoty na 100 g`, '') + `
      ${filterBar('fp', { q: FoodPick.q, onQ: 'window._fpq', placeholder: 'název suroviny…', sorts: [['name', 'A–Z'], ['kcal', 'kcal ↑'], ['p', 'bílkoviny ↓']], sort: FoodPick.sort, onSort: 'window._fps', filters: cats.map(c => [c, c, FoodPick.cat === c]), onFilter: 'window._fpc' })}
      <button class="btn ghost sm" style="align-self:flex-start" onclick="window._fpnew()">+ nová surovina</button>
      <div class="plist">${L.slice(0, 80).map(f => `<div class="pitem ${f.name === current ? 'cur' : ''}" onclick="window._fppick(${JSON.stringify(f.name).replace(/"/g, '&quot;')})"><div class="sp"><div class="pn">${f.own ? '📌 ' : ''}${esc(f.name)}</div><div class="pi">${esc(f.cat)}</div></div><div class="pk">${vShow(f.kcal)} <span>kcal</span><br><span class="muted">${vShow(f.p)} g B</span></div></div>`).join('') || '<p class="muted small" style="padding:10px">Nic nenalezeno.</p>'}</div>`;
    if (FoodPick.q) { const i = m.querySelector('#fp-q'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  };
  window._fpq = v => { FoodPick.q = v; draw(); }; window._fps = v => { FoodPick.sort = v; draw(); }; window._fpc = v => { FoodPick.cat = v === '__clear' ? '' : (FoodPick.cat === v ? '' : v); draw(); };
  window._fppick = name => { m.remove(); onPick(name); };
  window._fpnew = () => { m.remove(); A.editFood(null, isCoach() ? 'global' : 'own', name => { onPick(name); }); };
  draw();
}

/* ===== Recepty: čtení s přepisy =====
   Robertův přepis globálního receptu: record user_id = uid, data.overrides = <globalId> */
function recipeOverrides() { const uid = Store.ownerId(); return Object.fromEntries(Store.rows('recipes').filter(r => r.user_id === uid && r.user_id != null && r.data.overrides).map(r => [r.data.overrides, r])); }
function Recipes() {
  const uid = Store.ownerId(); const ov = recipeOverrides();
  const glob = mergedGlobal('recipes', SEED.recipes).map(r => ov[r.id] ? { ...r, ...ov[r.id].data, id: r.id, overrides: undefined, overridden: true, ovId: ov[r.id].id } : r);
  const own = Store.rows('recipes').filter(r => r.user_id === uid && r.user_id != null && !r.data.overrides).map(r => ({ id: r.id, ...r.data, own: true }));
  return glob.concat(own);
}
function recipeTotals(r, fmap) { const t = { kcal: 0, p: 0, c: 0, f: 0, g: 0, gc: 0 }; (r.items || []).forEach(it => { const f = fmap[it.food]; if (!f || !(it.g > 0)) return; t.kcal += f.kcal * it.g / 100; t.p += f.p * it.g / 100; t.c += f.c * it.g / 100; t.f += f.f * it.g / 100; t.g += it.g; t.gc += cookedG(it.food, it.g); }); return t; }

/* ===== Editor receptu =====
   mode: 'own' (Robertův vlastní) | 'override' (Robertova verze globálního) | 'global' (trenér) */
function openRecipeEditor(id, mode, copy) {
  const s = S(); let src = id ? Recipes().find(r => r.id === id) : null;
  if (!mode) mode = isCoach() ? 'global' : 'own';
  /* kopie výchozího receptu do vlastních – výchozí se nepřepisuje (dřív „moje verze“) */
  const draft = src ? JSON.parse(JSON.stringify({ name: src.name + (copy ? ' (moje)' : ''), course: src.course, items: src.items, num: copy ? null : src.num })) : { name: '', course: 'Snídaně', items: [] };
  if (copy) { src = null; id = null; }
  const saveId = mode === 'own' ? (src ? src.id : oid('own', Date.now())) : (src ? src.id : 'r:' + Date.now());
  const owner = mode === 'global' ? null : Store.ownerId();
  const targets = Object.fromEntries(SEED.settings.courses.map(c => [c.name, c]));
  const m = UI.modal('', { guardEdits: true });
  const draw = () => {
    const fmap = Object.fromEntries(Foods().map(f => [f.name, f])); const t = recipeTotals(draft, fmap);
    const course = s.courses.find(c => c.name === draft.course) || s.courses[0]; const pmin = targets[draft.course] ? targets[draft.course].prot_min : 0;
    const diff = t.kcal - course.kcal; let st = 0, verdict;
    if (!draft.items.filter(it => it.food && it.g > 0).length) verdict = 'Přidej suroviny – součty se počítají průběžně.';
    else if (Math.abs(diff) <= 60 && t.p >= pmin) { st = 2; verdict = 'Sedí: kalorie v toleranci ±60 a bílkovina nad minimem.'; }
    else if (t.p < pmin) { st = 1; verdict = `Málo bílkovin: ${fmt0(t.p)} g z ${pmin} g. Přidej maso, tvaroh, vejce nebo protein.`; }
    else if (diff > 60) { st = 1; verdict = `O ${fmt0(diff)} kcal víc než cíl – zmenši přílohu nebo tuk.`; }
    else { st = 3; verdict = `Ještě ${fmt0(-diff)} kcal volných – přidej přílohu nebo zeleninu.`; }
    const hasScale = draft.items.some(it => it.scale);
    m.querySelector('.box').innerHTML = `<div class="sh"><h2>${id ? 'Upravit recept' : (draft.name.endsWith(' (moje)') ? 'Můj recept podle výchozího' : 'Nový recept')}${help('1) Pojmenuj a vyber chod – hned vidíš cíl kalorií a bílkovin. 2) Přidávej suroviny a gramy v tom stavu, v jakém je kupuješ – rýže a luštěniny suché, maso syrové, pečivo upečené. U rýže, těstovin a luštěnin ti appka pod polem ukáže, kolik z toho bude na talíři. 3) U přílohy (rýže, brambory, pečivo, ovoce) zapni „přizpůsobit váze“ – ta se pak s klesající váhou automaticky zmenšuje, bílkovina a zelenina drží. 4) Když je stav zelený, ulož.')}</h2><button class="xbtn" onclick="UI.closeModal()">×</button></div>

      <div class="grid" style="grid-template-columns:2fr 1fr"><div class="in"><label class="f">Název</label><input type="text" id="re-n" value="${esc(draft.name)}" placeholder="např. Kuře s rýží a zeleninou"></div><div class="in"><label class="f">Chod</label><select id="re-c">${s.courses.map(c => `<option ${c.name === draft.course ? 'selected' : ''}>${c.name}</option>`).join('')}</select></div></div>
      <div class="stats"><div><b class="${st === 2 ? 'ok' : st === 1 ? 'bad' : ''}">${fmt0(t.kcal)} <small>/ ${course.kcal}</small></b><span>kcal · cíl pro ${draft.course.toLowerCase()}</span></div><div><b class="${t.p >= pmin && t.kcal ? 'ok' : (t.kcal ? 'bad' : '')}">${fmt0(t.p)} <small>/ ${pmin} g</small></b><span>bílkoviny · minimum</span></div><div><b>${fmt0(t.c)} <small>S</small> · ${fmt0(t.f)} <small>T</small></b><span>sacharidy · tuky (g)</span></div><div><b>${fmt0(t.gc)} <small>g</small></b><span>porce na talíři${Math.abs(t.gc - t.g) > 5 ? ` · ${fmt0(t.g)} g nákup` : ''}</span></div></div>
      <div class="status st${st}">${esc(verdict)}</div>
      <table class="items"><tr><th>Surovina</th><th class="n">g</th><th class="n m-kcal">kcal</th><th class="n m-prot">B</th><th title="příloha se přepočítává podle Robertovy váhy">přizpůsobit váze${help('Zapni u přílohy (rýže, brambory, těstoviny, pečivo, ovoce, vločky). Když Robert zhubne, klesne jeho limit – a tyhle suroviny se zmenší automaticky (faktor 0,3–1,6). Maso, vejce, tvaroh a zelenina nechej vypnuté: bílkovina se nikdy nekrátí.')}</th><th></th></tr>
      ${draft.items.map((it, i) => { const f = fmap[it.food]; return `<tr><td><button class="pickbtn sm ${it.food ? '' : 'empty'}" style="margin:0" onclick="window._reFood(${i})"><span>${it.food ? esc(it.food) : '+ vybrat surovinu'}</span>${f ? `<em>${vShow(f.kcal)} kcal/100 g</em>` : ''}</button></td><td class="n">${it.food ? gInput('re' + i, it.food, it.g, `window._reG(${i},this.value)`) : `<input type="number" class="g" min="0" step="5" value="${it.g ? gShow(it.g) : ''}" placeholder="g" onchange="window._reG(${i},this.value)">`}${it.food && it.g && !App.unitOn['re' + i] ? `<div class="tiny muted">${measureText(it.food, it.g)}</div>` : ''}</td><td class="n" data-l="kcal">${f && it.g ? fmt0(f.kcal * it.g / 100) : ''}</td><td class="n" data-l="bílk.">${f && it.g ? fmt1(f.p * it.g / 100) : ''}</td><td class="n scl" data-l="přizpůsobit váze"><input type="checkbox" ${it.scale ? 'checked' : ''} style="width:20px;height:20px;min-height:0;vertical-align:middle" onchange="window._reS(${i},this.checked)"></td><td class="n"><button class="xbtn" onclick="window._reDel(${i})">×</button></td></tr>`; }).join('')}
      <tr><td class="b">celkem</td><td></td><td class="n b">${fmt0(t.kcal)}</td><td class="n b">${fmt1(t.p)}</td><td colspan="2"></td></tr></table>
      <div class="row"><button class="btn ghost sm" onclick="window._reAdd()">+ přidat surovinu</button>${!hasScale && draft.items.length ? '<span class="tiny muted">Tip: u přílohy zapni „přizpůsobit váze“.</span>' : ''}</div>
      <div class="shfoot"><button class="btn" id="re-save" ${st === 1 ? 'title="Uložit jde i tak – ale recept nesedí do cíle"' : ''}>Uložit recept</button><button class="btn sec" onclick="UI.closeModal()">Zavřít</button><span class="sp"></span>${id && (mode === 'own' || mode === 'global') ? '<button class="btn danger sm" id="re-del">Smazat</button>' : ''}${mode === 'override' && src.overridden ? '<button class="btn sec sm" id="re-reset">Vrátit původní</button>' : ''}</div>`;
    m.querySelector('#re-n').oninput = e => { draft.name = e.target.value; };
    m.querySelector('#re-c').onchange = e => { draft.course = e.target.value; draw(); };
    m.querySelector('#re-save').onclick = () => {
      draft.name = (draft.name || '').trim(); if (!draft.name) { UI.toast('Chybí název'); return; }
      const items = draft.items.filter(it => it.food && Number(it.g) > 0).map(it => ({ food: it.food, g: Number(it.g), scale: it.scale ? 1 : 0 })); if (!items.length) { UI.toast('Přidej aspoň jednu surovinu s gramy'); return; }
      if (mode !== 'override' && Recipes().some(r => r.name === draft.name && r.id !== (src && src.id) && !r.deleted)) { UI.toast('Recept s tímto názvem už existuje – zvol jiný'); return; }
      const data = mode === 'override' ? { overrides: src.id, name: src.name, course: draft.course, num: src.num, items } : { name: draft.name, course: draft.course, num: draft.num || (mode === 'global' ? Math.max(0, ...Recipes().filter(x => !x.own && x.course === draft.course).map(x => x.num || 0)) + 1 : null), items };
      if (mode === 'global' && src && draft.name !== src.name) { Store.rows('week_plans', Store.ownerId()).forEach(w => { let ch = false; w.data.plan.forEach(d => d.forEach((v, k) => { if (v === src.name) { d[k] = draft.name; ch = true; } })); if (ch) Store.put('week_plans', w.id, w.data); }); }
      m.remove(); Undo.run(mode === 'override' ? `Uložena tvoje verze: ${src.name}` : `Recept uložen: ${draft.name}`, () => Store.put('recipes', saveId, data, owner), `${fmt0(t.kcal)} kcal · ${fmt0(t.p)} g bílkovin. Najdeš ho v panelu výběru${mode !== 'global' ? ' pod 📖 moje' : ''}.`); render();
    };
    const del = m.querySelector('#re-del'); if (del) del.onclick = () => UI.confirm('Smazat recept? Zůstane v historii dnů, zmizí z nabídek.', () => { m.remove(); Undo.run(`Recept smazán: ${src.name}`, () => { if (mode === 'global' && src.seed) Store.put('recipes', src.id, { name: src.name, course: src.course, num: src.num, items: src.items }, null); Store.remove('recipes', saveId); }); render(); }, 'Smazat');
    const rs = m.querySelector('#re-reset'); if (rs) rs.onclick = () => UI.confirm('Zahodit svoji verzi receptu a vrátit se k trenérově?', () => { m.remove(); Undo.run('Vráceno na původní recept', () => Store.remove('recipes', src.ovId)); render(); }, 'Vrátit původní');
  };
  window._reFood = i => openFoodPicker(name => { draft.items[i].food = name; const lib = Foods().find(f => f.name === name); if (lib && !draft.items[i].g) draft.items[i].g = ['Obiloviny a přílohy', 'Pečivo', 'Ovoce'].includes(lib.cat) ? 100 : 100; if (lib && ['Obiloviny a přílohy', 'Pečivo', 'Ovoce'].includes(lib.cat)) draft.items[i].scale = 1; draw(); }, draft.items[i].food);
  window._reG = (i, v) => { draft.items[i].g = Number(v); draw(); }; window._reS = (i, v) => { draft.items[i].scale = v ? 1 : 0; draw(); }; window._reDel = i => { draft.items.splice(i, 1); draw(); };
  window._reAdd = () => { draft.items.push({ food: '', g: '', scale: 0 }); draw(); setTimeout(() => window._reFood(draft.items.length - 1), 50); };
  window._redraw = draw;
  draw();
}
A.editOwn = id => openRecipeEditor(id, isCoach() ? 'global' : 'own');
A.editRecipe = id => { const r = id ? Recipes().find(x => x.id === id) : null; if (isCoach()) return openRecipeEditor(id, 'global'); if (r && !r.own) return openRecipeEditor(id, 'own', true); return openRecipeEditor(id, 'own'); };

/* ===== Seznam receptů (všechny) – řádkově, rozbalitelně ===== */
App.rq = ''; App.rsort = 'course'; App.rfil = {}; App.rOpen = {};
function recipeList(recipes, opts) {
  const fmap = Object.fromEntries(Foods().map(f => [f.name, f])); const prefs = Prefs(); const s = S();
  const q = App.rq.toLowerCase().trim();
  let L = recipes.filter(r => !r.deleted && (!q || r.name.toLowerCase().includes(q) || r.items.some(it => it.food.toLowerCase().includes(q))));
  if (App.rfil.fav) L = L.filter(r => prefs.favs.includes(r.name)); if (App.rfil.own) L = L.filter(r => r.own || r.overridden);
  s.courses.forEach(c => { if (App.rfil['c:' + c.key]) L = L.filter(r => r.course === c.name); });
  const tot = Object.fromEntries(L.map(r => [r.id, recipeTotals(r, fmap)]));
  L.sort((a, b) => App.rsort === 'kcal' ? tot[a.id].kcal - tot[b.id].kcal : App.rsort === 'p' ? tot[b.id].p - tot[a.id].p : App.rsort === 'name' ? a.name.localeCompare(b.name, 'cs') : (s.courses.findIndex(c => c.name === a.course) - s.courses.findIndex(c => c.name === b.course)) || (a.num || 99) - (b.num || 99));
  const rows = L.map(r => { const t = tot[r.id]; const key = (s.courses.find(c => c.name === r.course) || {}).key; const cnt = opts && opts.counts ? opts.counts[r.name] : null;
    return `<div class="li" onclick="A.recipeSheet('${r.id}')"><span class="em">${COURSE_EMOJI[key] || '🍽️'}</span><div class="tx"><b>${esc(r.name)}</b><span>${r.own ? 'moje · ' : ''}${r.overridden ? 'moje verze · ' : ''}${cnt ? cnt + '× v týdnu · ' : ''}${fmt0(t.p)} g bílkovin · ${fmt0(t.gc)} g porce</span></div><span class="val k">${fmt0(t.kcal)}</span><button class="star ${prefs.favs.includes(r.name) ? 'on' : ''}" onclick="event.stopPropagation();A.favInPlace(this,${JSON.stringify(r.name).replace(/"/g, '&quot;')})" aria-label="oblíbené">${prefs.favs.includes(r.name) ? '★' : '☆'}</button></div>`; }).join('');
  return { html: rows ? `<div class="list">${rows}</div>` : '<div class="empty">Nic neodpovídá – zkus jiné slovo nebo zruš filtr.</div>', count: L.length };
}
A.recipeSheet = id => {
  const r = Recipes().find(x => x.id === id); if (!r) return; const fmap = Object.fromEntries(Foods().map(f => [f.name, f])); const t = recipeTotals(r, fmap);
  UI.sheet(esc(r.name), `${esc(r.course)}${r.own ? ' · moje' : ''}${r.overridden ? ' · moje verze' : ''}`,
    `<div class="stats3"><div><b class="m-kcal">${fmt0(t.kcal)}</b><span>kcal</span></div><div><b class="m-prot">${fmt0(t.p)} g</b><span>bílkoviny</span></div><div><b>${fmt0(t.gc)} g</b><span>porce na talíři</span></div></div>
    <table class="small"><tr><th>Surovina</th><th class="n">g</th><th class="n m-kcal">kcal</th><th class="n m-prot">B</th></tr>${r.items.map(it => { const f = fmap[it.food] || { kcal: 0, p: 0 }; return `<tr><td>${modeBadge(it.food)} ${esc(it.food)}${it.scale ? ' <span class="tiny muted">· příloha</span>' : ''}</td><td class="n">${it.g}</td><td class="n">${fmt0(f.kcal * it.g / 100)}</td><td class="n">${fmt1(f.p * it.g / 100)}</td></tr>`; }).join('')}<tr class="sum"><td>celkem</td><td></td><td class="n">${fmt0(t.kcal)}</td><td class="n">${fmt1(t.p)}</td></tr></table>
    <p class="hint">Gramy jsou v nákupním stavu (rýže suchá, maso syrové). Přílohu appka škáluje podle tvého limitu.</p>`,
    `<button class="btn sec write" onclick="UI.closeModal();A.editRecipe('${r.id}')">${r.own || isCoach() ? 'Upravit' : 'Zkopírovat jako můj recept'}</button>`);
};
function recipeFilterBar(recipes) { const s = S(); const prefs = Prefs();
  return filterBar('rl', { q: App.rq, onQ: 'window._rq', placeholder: 'název jídla nebo surovina…', sorts: [['course', 'chod'], ['name', 'A–Z'], ['kcal', 'kcal ↑'], ['p', 'bílkoviny ↓']], sort: App.rsort, onSort: 'window._rs', filters: [['fav', '⭐ oblíbené', !!App.rfil.fav], ['own', '📖 moje', !!App.rfil.own]].concat(s.courses.map(c => ['c:' + c.key, c.name, !!App.rfil['c:' + c.key]])), onFilter: 'window._rf' }); }
window._rq = v => { App.rq = v; render(); }; window._rs = v => { App.rsort = v; render(); };
window._rf = k => { if (k === '__clear') App.rfil = {}; else if (k.startsWith('c:')) { const on = !App.rfil[k]; Object.keys(App.rfil).forEach(x => { if (x.startsWith('c:')) delete App.rfil[x]; }); if (on) App.rfil[k] = true; } else App.rfil[k] = !App.rfil[k]; render(); };

VIEWS._recepty = function () {
  const all = Recipes(); const own = all.filter(r => (r.own || r.overridden) && !r.deleted).length;
  return `<div class="ph"><button class="iconbtn" onclick="go('more')" aria-label="zpět">‹</button><div class="pt"><h1>Recepty</h1><span class="sub">${all.filter(r => !r.deleted).length} · ${own} ${sklon(own, 'moje', 'moje', 'mých')} · ${Prefs().favs.length} oblíbených</span></div><div class="act"><button class="btn sm write" onclick="A.editOwn()">+ Nový</button></div></div>
  ${recipeBrowser(all)}`;
};

/* ===== Vaření: vaříš na vybrané dny, ne na kalendářní týden ===== */
App.vMode = 'recipes';
App.vDays = null;   // pole ISO dat; null = od dneška tři dny
function varDays() {
  if (App.vDays && App.vDays.length) return App.vDays;
  const t = todayISO(); return [t, addDays(t, 1), addDays(t, 2)];
}
A.vDay = d => { const cur = varDays().slice(); const i = cur.indexOf(d);
  if (i >= 0) cur.splice(i, 1); else cur.push(d);
  App.vDays = cur.sort(); render(); };
A.vSpan = n => { const t = todayISO(); const out = []; for (let k = 0; k < n; k++) out.push(addDays(t, k)); App.vDays = out; render(); };

VIEWS._vareni = function () {
  const s = S(), foods = Foods(), recipes = Recipes(), w = currentWeight();
  const sel = varDays(); const t = todayISO();
  const chips = `<div class="card noprint stack s8"><div class="row between"><b>Vařím na${hq('rVareni')}</b><span class="small muted">${sel.length} ${DEN(sel.length)}</span></div>
    <div class="chips scroll">${Array.from({ length: 10 }, (_, k) => addDays(t, k)).map(d => `<button class="chip ${sel.includes(d) ? 'on' : ''}" onclick="A.vDay('${d}')" title="${czDate(d)}">${d === t ? 'dnes' : DAY_SHORT[dayIndex(d)] + ' ' + parseISO(d).getDate() + '.'}</button>`).join('')}</div>
    <div class="row"><button class="btn ghost sm" onclick="A.vSpan(3)">3 dny</button><button class="btn ghost sm" onclick="A.vSpan(7)">celý týden</button></div></div>`;
  const zbytky = cooks().map(c => ({ c, left: cookLeft(c) })).filter(x => x.left > 0);
  const zbytkyHtml = zbytky.length ? `<div class="card flush"><div class="lh">🍱 V lednici</div>${zbytky.map(({ c, left }) => `<div class="navrow" style="cursor:default"><div class="tx"><b>${esc(c.recipe)}</b><span>uvařeno ${czDateShort(c.at)} · ${c.n} ${sklon(c.n, 'porce', 'porce', 'porcí')}${c.gc ? ` · porce ${fmt0(c.gc / c.n)} g` : ''}</span></div><span class="pill ok">zbývá ${left}</span><button class="xbtn sm write" title="smazat záznam" onclick="A.cookDel('${c.id}')">×</button></div>`).join('')}</div>` : '';
  const agg = {};
  sel.forEach(d => { const day = effectiveDay(d); const dd = calcDay(s, foods, recipes, day, weightAt(s, d));
    dd.courses.forEach((c, ci) => { if (!c.active || cookFor(d, c.key)) return;
      const a = agg[c.sel] = agg[c.sel] || { name: c.sel, course: s.courses[ci].name, key: s.courses[ci].key, covers: [], kcal: 0, p: 0, g: 0, gc: 0, items: {} };
      a.covers.push({ d, k: c.key }); a.kcal += c.kcal; a.p += c.p; a.g += c.g; a.gc += c.gc;
      c.items.forEach(it => { a.items[it.food] = (a.items[it.food] || 0) + it.g; }); }); });
  const list = Object.values(agg).sort((a, b) => (s.courses.findIndex(c => c.name === a.course) - s.courses.findIndex(c => c.name === b.course)) || b.covers.length - a.covers.length);
  App._vlist = list;
  if (!list.length) return chips + zbytkyHtml + `<div class="card empty"><span class="em">🍳</span>${zbytky.length ? 'Na vybrané dny máš všechno uvařené.' : 'Na vybrané dny nemáš naplánovaná jídla.'}</div>`;
  return chips + zbytkyHtml + `<div class="row between small muted" style="padding:0 4px"><span>${list.length} ${sklon(list.length, 'jídlo', 'jídla', 'jídel')} k uvaření · přepočítáno na ${fmt1(w)} kg</span></div>
  <div class="card flush"><div class="list">${list.map((a, idx) => { const n = a.covers.length; const sd = shelfDays(a.items, foods); const rozsah = daysBetween(a.covers[0].d, a.covers[n - 1].d) + 1;
    return `<div class="li" onclick="A.cookSheet(${idx})"><span class="em">${COURSE_EMOJI[a.key]}</span><div class="tx"><b>${esc(a.name)}</b><span>${n}× · ${a.covers.map(x => DAY_SHORT[dayIndex(x.d)]).join(' ')} · ${fmt0(a.kcal / n)} kcal/porce${rozsah > sd ? ' · ❄️ část zamrazit' : ''}</span></div><button class="btn sec sm write" onclick="event.stopPropagation();A.cookDoneIdx(${idx})">🍱 uvařeno</button></div>`; }).join('')}</div></div>`;
};
/* rozpis jednoho jídla: kolik čeho do hrnce */
A.cookSheet = idx => { const a = (App._vlist || [])[idx]; if (!a) return; const foods = Foods(); const n = a.covers.length; const sd = shelfDays(a.items, foods); const rozsah = daysBetween(a.covers[0].d, a.covers[n - 1].d) + 1;
  UI.sheet(`${COURSE_EMOJI[a.key]} ${esc(a.name)}`, `${n} ${sklon(n, 'porce', 'porce', 'porcí')} · ${a.covers.map(x => DAY_SHORT[dayIndex(x.d)]).join(' ')}`,
    `<table class="small"><tr><th>Surovina</th><th class="n">na porci</th><th class="n">do hrnce</th></tr>
    ${Object.entries(a.items).map(([f, g]) => `<tr><td>${modeBadge(f)} ${esc(f)}${measureText(f, g / n) ? ` <span class="tiny muted">${measureText(f, g / n)}</span>` : ''}</td><td class="n">${fmt0(g / n)} g</td><td class="n b">${g >= 1000 ? fmt1(g / 1000) + ' kg' : fmt0(g) + ' g'}</td></tr>`).join('')}
    <tr class="sum"><td>hotová dávka (odhad)</td><td class="n">${fmt0(a.gc / n)} g</td><td class="n">${fmt0(a.gc)} g</td></tr></table>
    <p class="hint">Gramy jsou v nákupním stavu – rýže a luštěniny suché, maso syrové. Hotovou dávku zvaž a rozděl na ${n} stejných porcí.</p>
    ${rozsah > sd ? `<div class="alert a2"><div>Vaříš na ${rozsah} ${DEN(rozsah)}, ale v lednici to vydrží zhruba ${sd} ${DEN(sd)}. Co je nad to, dej hned do mrazáku.</div></div>` : ''}`,
    `<button class="btn write" onclick="UI.closeModal();A.cookDoneIdx(${idx})">🍱 Uvařeno ${n}×</button>`); };
/* uvařeno: porce se od teď počítá podle krabičky (gramy na porci), ne podle limitu dne */
A.cookDoneIdx = idx => { const a = (App._vlist || [])[idx]; if (!a) return; const n = a.covers.length;
  A.cookDone(a.name, n, a.covers, Math.round(a.gc), Object.fromEntries(Object.entries(a.items).map(([f, g]) => [f, Math.round(g / n)]))); };
