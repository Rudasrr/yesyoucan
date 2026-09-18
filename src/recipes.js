/* ===== Jednotná lišta Hledat · Řadit · Filtr =====
   cfg: { q, onQ, sorts:[[key,label]], sort, onSort, filters:[[key,label,on]], onFilter, extra(html) } */
function filterBar(id, cfg) {
  const inp = `<div class="frow"><span class="flab">Hledat</span><input type="text" id="${id}-q" placeholder="${esc(cfg.placeholder || 'hledat…')}" value="${esc(cfg.q || '')}" style="flex:1;min-width:160px" oninput="${cfg.onQ}(this.value);const i=document.getElementById('${id}-q');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length)}"></div>`;
  const sorts = cfg.sorts && cfg.sorts.length ? `<div class="frow"><span class="flab">Řadit</span><div class="seg">${cfg.sorts.map(([k, l]) => `<button class="${cfg.sort === k ? 'on' : ''}" onclick="${cfg.onSort}('${k}')">${l}</button>`).join('')}</div></div>` : '';
  const filters = cfg.filters && cfg.filters.length ? `<div class="frow"><span class="flab">Filtr</span><div class="chips">${cfg.filters.map(([k, l, on]) => `<span class="chip ${on ? 'on' : ''}" onclick="${cfg.onFilter}('${k}')">${on ? '✓ ' : ''}${l}</span>`).join('')}${cfg.filters.some(f => f[2]) ? `<span class="chip" style="color:var(--ink2)" onclick="${cfg.onFilter}('__clear')">× zrušit</span>` : ''}${cfg.extra || ''}</div></div>` : '';
  return `<div class="fbar">${inp}${sorts}${filters}</div>`;
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
    m.querySelector('.box').innerHTML = `<div class="row between"><h2>Vyber surovinu</h2><button class="xbtn" onclick="UI.closeModal()">×</button></div>
      ${filterBar('fp', { q: FoodPick.q, onQ: 'window._fpq', placeholder: 'název suroviny…', sorts: [['name', 'A–Z'], ['kcal', 'kcal ↑'], ['p', 'bílkoviny ↓']], sort: FoodPick.sort, onSort: 'window._fps', filters: cats.map(c => [c, c, FoodPick.cat === c]), onFilter: 'window._fpc' })}
      <div class="row" style="margin:8px 0 4px"><span class="small muted">${L.length} surovin</span><span class="sp"></span><button class="btn sec sm" onclick="window._fpnew()">+ nová surovina</button></div>
      <div class="plist">${L.slice(0, 80).map(f => `<div class="pitem ${f.name === current ? 'cur' : ''}" onclick="window._fppick(${JSON.stringify(f.name).replace(/"/g, '&quot;')})"><div style="flex:1;min-width:0"><div class="pn">${f.own ? '📌 ' : ''}${esc(f.name)}</div><div class="pi">${esc(f.cat)}</div></div><div class="pk">${vShow(f.kcal)} <span>kcal</span><br><span class="muted">${vShow(f.p)} g B</span></div></div>`).join('') || '<p class="muted small" style="padding:10px">Nic nenalezeno.</p>'}</div>`;
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
function openRecipeEditor(id, mode) {
  const s = S(); const src = id ? Recipes().find(r => r.id === id) : null;
  if (!mode) mode = isCoach() ? 'global' : (src && !src.own ? 'override' : 'own');
  const draft = src ? JSON.parse(JSON.stringify({ name: src.name, course: src.course, items: src.items, num: src.num })) : { name: '', course: 'Snídaně', items: [] };
  const saveId = mode === 'override' ? (src.ovId || oid('rov', src.id)) : (mode === 'own' ? (src ? src.id : oid('own', Date.now())) : (src ? src.id : 'r:' + Date.now()));
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
    m.querySelector('.box').innerHTML = `<div class="row between"><h2>${mode === 'override' ? 'Moje verze receptu' : (id ? 'Upravit recept' : 'Nový recept')}${help('1) Pojmenuj a vyber chod – hned vidíš cíl kalorií a bílkovin. 2) Přidávej suroviny a gramy v tom stavu, v jakém je kupuješ – rýže a luštěniny suché, maso syrové, pečivo upečené. U rýže, těstovin a luštěnin ti appka pod polem ukáže, kolik z toho bude na talíři. 3) U přílohy (rýže, brambory, pečivo, ovoce) zapni „přizpůsobit váze“ – ta se pak s klesající váhou automaticky zmenšuje, bílkovina a zelenina drží. 4) Když je stav zelený, ulož.')}</h2><button class="xbtn" onclick="UI.closeModal()">×</button></div>
      ${mode === 'override' ? `<div class="notice" style="margin:6px 0 10px">Úprava vytvoří tvoji verzi „${esc(src.name)}“ – platí jen pro tebe, trenérova databáze zůstává. Název se nemění.</div>` : ''}
      <div class="grid" style="grid-template-columns:2fr 1fr;gap:8px;margin-top:8px"><div class="in"><label class="f">Název</label><input type="text" id="re-n" value="${esc(draft.name)}" ${mode === 'override' ? 'disabled' : ''} placeholder="např. Kuře s rýží a zeleninou"></div><div class="in"><label class="f">Chod</label><select id="re-c">${s.courses.map(c => `<option ${c.name === draft.course ? 'selected' : ''}>${c.name}</option>`).join('')}</select></div></div>
      <div class="stats3" style="padding:12px 0 4px"><div><b class="${st === 2 ? 'ok' : st === 1 ? 'bad' : ''}">${fmt0(t.kcal)} <small>/ ${course.kcal}</small></b><span>kcal · cíl pro ${draft.course.toLowerCase()}</span></div><div><b class="${t.p >= pmin && t.kcal ? 'ok' : (t.kcal ? 'bad' : '')}">${fmt0(t.p)} <small>/ ${pmin} g</small></b><span>bílkoviny · minimum</span></div><div><b>${fmt0(t.c)} <small>S</small> · ${fmt0(t.f)} <small>T</small></b><span>sacharidy · tuky (g)</span></div><div><b>${fmt0(t.gc)} <small>g</small></b><span>hmotnost porce na talíři${Math.abs(t.gc - t.g) > 5 ? ` · ${fmt0(t.g)} g nakoupit` : ''}</span></div></div>
      <div class="status st${st}" style="margin-bottom:10px">${esc(verdict)}</div>
      <table class="items"><tr><th>Surovina</th><th class="n">g</th><th class="n m-kcal">kcal</th><th class="n m-prot">B</th><th title="příloha se přepočítává podle Robertovy váhy">přizpůsobit váze${help('Zapni u přílohy (rýže, brambory, těstoviny, pečivo, ovoce, vločky). Když Robert zhubne, klesne jeho limit – a tyhle suroviny se zmenší automaticky (faktor 0,3–1,6). Maso, vejce, tvaroh a zelenina nechej vypnuté: bílkovina se nikdy nekrátí.')}</th><th></th></tr>
      ${draft.items.map((it, i) => { const f = fmap[it.food]; return `<tr><td><button class="pickbtn sm ${it.food ? '' : 'empty'}" style="margin:0" onclick="window._reFood(${i})"><span>${it.food ? esc(it.food) : '+ vybrat surovinu'}</span>${f ? `<em>${vShow(f.kcal)} kcal/100 g</em>` : ''}</button></td><td class="n">${it.food ? gInput('re' + i, it.food, it.g, `window._reG(${i},this.value)`) : `<input type="number" class="g" min="0" step="5" value="${it.g ? gShow(it.g) : ''}" placeholder="g" onchange="window._reG(${i},this.value)">`}${it.food && it.g && !App.unitOn['re' + i] ? `<div class="tiny muted">${measureText(it.food, it.g)}</div>` : ''}</td><td class="n">${f && it.g ? fmt0(f.kcal * it.g / 100) : ''}</td><td class="n">${f && it.g ? fmt1(f.p * it.g / 100) : ''}</td><td style="text-align:center"><input type="checkbox" ${it.scale ? 'checked' : ''} style="width:20px;height:20px;min-height:0" onchange="window._reS(${i},this.checked)"></td><td class="n"><button class="xbtn" onclick="window._reDel(${i})">×</button></td></tr>`; }).join('')}
      <tr><td class="b">celkem</td><td></td><td class="n b">${fmt0(t.kcal)}</td><td class="n b">${fmt1(t.p)}</td><td colspan="2"></td></tr></table>
      <div class="row" style="margin-top:8px"><button class="btn sec sm" onclick="window._reAdd()">+ přidat surovinu</button>${!hasScale && draft.items.length ? '<span class="tiny muted">Tip: u přílohy zapni „přizpůsobit váze“.</span>' : ''}</div>
      <div class="row" style="margin-top:14px"><button class="btn" id="re-save" ${st === 1 ? 'title="Uložit jde i tak – ale recept nesedí do cíle"' : ''}>Uložit recept</button><button class="btn sec" onclick="UI.closeModal()">Zavřít</button><span class="sp"></span>${id && (mode === 'own' || mode === 'global') ? '<button class="btn danger sm" id="re-del">Smazat</button>' : ''}${mode === 'override' && src.overridden ? '<button class="btn sec sm" id="re-reset">Vrátit původní</button>' : ''}</div>`;
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
A.editRecipe = id => openRecipeEditor(id, isCoach() ? 'global' : (id && !(Recipes().find(r => r.id === id) || {}).own ? 'override' : 'own'));

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
  const rows = L.map(r => { const t = tot[r.id]; const open = App.rOpen[r.id]; const key = (s.courses.find(c => c.name === r.course) || {}).key; const cnt = opts && opts.counts ? opts.counts[r.name] : null;
    return `<div class="rrow ${open ? 'open' : ''}"><div class="rhead" onclick="App.rOpen['${r.id}']=!App.rOpen['${r.id}'];render()"><span class="rtag">${COURSE_EMOJI[key] || ''} ${esc(r.course)}</span><span class="rname">${esc(r.name)}${r.own ? ' <span class="pill">moje</span>' : ''}${r.overridden ? ' <span class="pill">moje verze</span>' : ''}${cnt ? ` <span class="pill">${cnt}× v týdnu</span>` : ''}</span><span class="rk"><b>${fmt0(t.kcal)}</b> kcal · ${fmt0(t.p)} g B · ${fmt0(t.gc)} g porce</span><button class="star ${prefs.favs.includes(r.name) ? 'on' : ''}" onclick="event.stopPropagation();A.favInPlace(this,${JSON.stringify(r.name).replace(/"/g, '&quot;')})">${prefs.favs.includes(r.name) ? '★' : '☆'}</button><span class="muted">${open ? '▾' : '▸'}</span></div>
      ${open ? `<div class="rbody"><table class="small"><tr><th>Surovina</th><th class="n">g</th><th class="n m-kcal">kcal</th><th class="n m-prot">B</th><th class="n m-carb">S</th><th class="n m-fat">T</th></tr>${r.items.map(it => { const f = fmap[it.food] || { kcal: 0, p: 0, c: 0, f: 0 }; return `<tr><td>${esc(it.food)}${it.scale ? ' <span class="tiny muted">· příloha</span>' : ''}</td><td class="n">${it.g}</td><td class="n">${fmt0(f.kcal * it.g / 100)}</td><td class="n">${fmt1(f.p * it.g / 100)}</td><td class="n">${fmt1(f.c * it.g / 100)}</td><td class="n">${fmt1(f.f * it.g / 100)}</td></tr>`; }).join('')}<tr><td class="b">celkem</td><td></td><td class="n b">${fmt0(t.kcal)}</td><td class="n b">${fmt1(t.p)}</td><td class="n">${fmt1(t.c)}</td><td class="n">${fmt1(t.f)}</td></tr></table>
        <div class="row" style="margin-top:8px"><button class="btn sec sm write" onclick="A.editRecipe('${r.id}')">${r.own || isCoach() ? 'Upravit' : (r.overridden ? 'Upravit moji verzi' : 'Upravit (moje verze)')}</button>${opts && opts.extra ? opts.extra(r) : ''}</div></div>` : ''}</div>`; }).join('');
  return { html: rows || '<p class="muted small" style="padding:10px">Nic neodpovídá.</p>', count: L.length };
}
function recipeFilterBar(recipes) { const s = S(); const prefs = Prefs();
  return filterBar('rl', { q: App.rq, onQ: 'window._rq', placeholder: 'název jídla nebo surovina…', sorts: [['course', 'chod'], ['name', 'A–Z'], ['kcal', 'kcal ↑'], ['p', 'bílkoviny ↓']], sort: App.rsort, onSort: 'window._rs', filters: [['fav', '⭐ oblíbené', !!App.rfil.fav], ['own', '📖 moje', !!App.rfil.own]].concat(s.courses.map(c => ['c:' + c.key, c.name, !!App.rfil['c:' + c.key]])), onFilter: 'window._rf' }); }
window._rq = v => { App.rq = v; render(); }; window._rs = v => { App.rsort = v; render(); };
window._rf = k => { if (k === '__clear') App.rfil = {}; else if (k.startsWith('c:')) { const on = !App.rfil[k]; Object.keys(App.rfil).forEach(x => { if (x.startsWith('c:')) delete App.rfil[x]; }); if (on) App.rfil[k] = true; } else App.rfil[k] = !App.rfil[k]; render(); };

VIEWS._recepty = function () {
  const all = Recipes(); const own = all.filter(r => (r.own || r.overridden) && !r.deleted); const favs = Prefs().favs.length;
  const list = recipeList(all);
  return `${flow('recepty', ['Najdi recept', 'Uprav si ho', 'Ulož jako svoji verzi'], 'Trenérovy recepty zůstanou nedotčené – tvoje úprava platí jen pro tebe.')}
  <div class="row between" style="margin-bottom:8px"><h1>Recepty${help('Všech 200 receptů ze sešitu plus tvoje vlastní. Řádek ukazuje chod, kalorie a bílkoviny; rozbalením uvidíš suroviny s gramy. Hvězdička = oblíbené (panel výběru je řadí nahoru, generátor týdne je zařazuje častěji). Upravit můžeš i výchozí recept – vznikne tvoje verze, trenérova databáze zůstává.')}</h1><button class="btn sm write" onclick="A.editOwn()">+ nový recept</button></div>
  <div class="row small muted" style="margin-bottom:8px"><span class="pill">${all.filter(r => !r.deleted).length} ${sklon(all.filter(r => !r.deleted).length, 'recept', 'recepty', 'receptů')}</span><span class="pill">📖 ${own.length} mých</span><span class="pill">⭐ ${favs} oblíbených</span><span class="sp"></span><span>${list.count} zobrazeno</span></div>
  ${recipeFilterBar(all)}<div class="card tight" style="margin-top:10px">${list.html}</div>`;
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
  const sel = varDays();
  const napoveda = 'Vybereš dny, na které vaříš – klidně od středy nebo jen na tři dny. Appka sečte, kolik porcí čeho uvařit, a řekne, kolik toho nasypat do hrnce v suchém stavu. „Uvařeno“ je záznam: kolik porcí a které dny pokrývají. Proto ví i o zbytku v lednici.';
  const head = `${flow('vareni', ['Vyber dny, na které vaříš', 'Uvař a zvaž hotovou dávku', 'Ulož jako uvařeno'], 'Uvařené maso a rýže vydrží v lednici zhruba tři dny. Na celý týden se vaří jen to, co jde zamrazit.')}
  <div class="row between" style="margin-bottom:6px"><h1>Vaření${help(napoveda)}</h1>
    <div class="seg noprint"><button class="${App.vMode === 'recipes' ? 'on' : ''}" onclick="App.vMode='recipes';render()">co uvařit</button><button class="${App.vMode === 'days' ? 'on' : ''}" onclick="App.vMode='days';render()">den po dni</button></div></div>`;
  // výběr dnů: dnešek a 13 dní dopředu
  const t = todayISO();
  const chips = `<div class="row noprint" style="gap:6px;flex-wrap:wrap;margin-bottom:10px"><span class="small muted" style="font-weight:700">Vařím na:</span>
    ${Array.from({ length: 10 }, (_, k) => addDays(t, k)).map(d => `<span class="chip ${sel.includes(d) ? 'on' : ''}" onclick="A.vDay('${d}')" title="${czDate(d)}">${d === t ? 'dnes' : DAY_SHORT[dayIndex(d)] + ' ' + parseISO(d).getDate() + '.'}</span>`).join('')}
    <button class="btn sec sm" onclick="A.vSpan(3)">3 dny</button><button class="btn sec sm" onclick="A.vSpan(7)">celý týden</button></div>`;

  // zbytky v lednici
  const zbytky = cooks().map(c => ({ c, left: cookLeft(c) })).filter(x => x.left > 0);
  const zbytkyHtml = zbytky.length ? `<div class="card"><h2>🍱 Máš uvařeno${help('Záznamy o vaření, ze kterých ještě zbývají porce. Porce ubývá, když jídlo na pokrytý den označíš jako snědené.')}</h2>
    <table class="small" style="margin-top:6px">${zbytky.map(({ c, left }) => `<tr><td class="b">${esc(c.recipe)}</td>
      <td class="muted">uvařeno ${czDateShort(c.at)} · ${c.n} ${c.n === 1 ? 'porce' : (c.n < 5 ? 'porce' : 'porcí')}${c.gc ? ` · dávka ${fmt0(c.gc)} g, porce ${fmt0(c.gc / c.n)} g` : ''}</td>
      <td class="n"><b class="ok">zbývá ${left}</b></td><td class="n noprint"><button class="xbtn write" title="smazat záznam" onclick="A.cookDel('${c.id}')">×</button></td></tr>`).join('')}</table></div>` : '';

  // co se na vybrané dny má uvařit
  const agg = {};
  sel.forEach(d => {
    const day = effectiveDay(d); const dd = calcDay(s, foods, recipes, day, weightAt(s, d));
    dd.courses.forEach((c, ci) => {
      if (!c.active) return;
      if (cookFor(d, c.key)) return;   // už je uvařeno, znovu vařit netřeba
      const a = agg[c.sel] = agg[c.sel] || { name: c.sel, course: s.courses[ci].name, key: s.courses[ci].key, covers: [], kcal: 0, p: 0, g: 0, gc: 0, items: {} };
      a.covers.push({ d, k: c.key }); a.kcal += c.kcal; a.p += c.p; a.g += c.g; a.gc += c.gc;
      c.items.forEach(it => { a.items[it.food] = (a.items[it.food] || 0) + it.g; });
    });
  });
  const list = Object.values(agg).sort((a, b) => (s.courses.findIndex(c => c.name === a.course) - s.courses.findIndex(c => c.name === b.course)) || b.covers.length - a.covers.length);

  if (App.vMode === 'days') {
    return head + chips + zbytkyHtml + `<p class="small muted" style="margin:0 0 8px">Přepočítáno na ${fmt1(w)} kg.</p>
    <div class="masonry">${sel.map(d => { const day = effectiveDay(d); const dd = calcDay(s, foods, recipes, day, weightAt(s, d)); if (!dd.tot.kcal) return '';
      return `<div class="card tight"><div class="row between"><h3>${DAY_NAMES[dayIndex(d)]} <span class="muted small" style="font-weight:600">${czDateShort(d)}</span></h3><span class="small muted">${fmt0(dd.tot.kcal)} kcal</span></div>
      <table class="small" style="margin-top:4px">${dd.courses.map((c, ci) => `<tr><td class="muted" style="width:52px">${s.courses[ci].time}</td><td><b>${c.sel ? esc(c.sel) : '<span class="muted">–</span>'}</b>${cookFor(d, c.key) ? ' <span class="pill ok">🍱 uvařeno</span>' : ''}${c.active ? `<div class="muted">${c.items.map(it => `${esc(it.food)} ${fmt0(it.g)} g`).join(' · ')}</div>` : ''}</td></tr>`).join('')}</table></div>`; }).join('')}</div>`;
  }
  if (!list.length) return head + chips + zbytkyHtml + `<div class="card">${zbytky.length ? 'Na vybrané dny máš všechno uvařené. Přidej další den, nebo si dej pauzu.' : 'Na vybrané dny nemáš naplánovaná jídla. Vyber je v Týdnu.'}</div>`;

  const dalsi = addDays(sel[sel.length - 1], 1);   // co by stál den navíc
  return head + chips + zbytkyHtml + `<p class="small muted" style="margin:0 0 8px">${list.length} ${sklon(list.length, 'jídlo', 'jídla', 'jídel')} na ${sel.length} ${DEN(sel.length)}${help('Gramy jsou v nákupním stavu – rýže a luštěniny suché, maso syrové. Ikona u suroviny říká, jak ji odměřit: ⚖️ zvaž, 🥄 odměř, ✋ od oka.')}</p>
  <div class="card tight">${list.map(a => {
    const open = App.rOpen['v:' + a.name]; const n = a.covers.length;
    const sd = shelfDays(a.items, foods);
    const rozsah = daysBetween(a.covers[0].d, a.covers[n - 1].d) + 1;
    const dny = a.covers.map(x => DAY_SHORT[dayIndex(x.d)]).join(' ');
    return `<div class="rrow ${open ? 'open' : ''}"><div class="rhead" onclick="App.rOpen['v:${esc(a.name)}']=!App.rOpen['v:${esc(a.name)}'];render()">
      <span class="rtag">${COURSE_EMOJI[a.key]} ${esc(a.course)}</span>
      <span class="rname">${esc(a.name)} <span class="pill">${n}× · ${dny}</span>${rozsah > sd ? ` <span class="pill warn">${rozsah} ${DEN(rozsah)} – zamrazit</span>` : ''}</span>
      <button class="btn sec sm write" onclick="event.stopPropagation();A.cookDone(${JSON.stringify(a.name).replace(/"/g, '&quot;')},${n},${JSON.stringify(a.covers).replace(/"/g, '&quot;')},${Math.round(a.gc)})">🍱 uvařeno ${n}×</button>
      <span class="rk"><b>${fmt0(a.kcal / n)}</b> kcal/porce · ${fmt0(a.gc / n)} g</span><span class="muted">${open ? '▾' : '▸'}</span></div>
      ${open ? `<div class="rbody">
        <table class="small"><tr><th>Surovina</th><th class="n">na porci</th><th class="n">do hrnce ${n}×</th></tr>
        ${Object.entries(a.items).map(([f, g]) => `<tr><td>${modeBadge(f)} ${esc(f)} <span class="tiny muted">${measureText(f, g / n)}</span></td><td class="n">${fmt0(g / n)} g</td><td class="n b">${g >= 1000 ? fmt1(g / 1000) + ' kg' : fmt0(g) + ' g'}</td></tr>`).join('')}
        <tr class="sum"><td class="b">hotová dávka (odhad)</td><td class="n">${fmt0(a.gc / n)} g/porce</td><td class="n b">${fmt0(a.gc)} g</td></tr></table>
        <p class="hint">Zvaž hotovou dávku a rozděl na ${n} stejných porcí${help('Vážení hotové dávky je přesnější než dělení od oka. Odhad počítá s tím, že rýže a luštěniny nasáknou vodu a maso ji ztratí – skutečná hmotnost se může lišit o desetinu.')}</p>
        ${rozsah > sd ? `<div class="alert a2" style="margin-top:8px"><div style="flex:1">Vaříš na ${rozsah} ${DEN(rozsah)}, ale ${sd === 3 ? 'maso a rýže vydrží' : 'tohle vydrží'} v lednici zhruba ${sd} ${DEN(sd)}. Uvař to klidně naráz, ale co je nad ${sd} ${DEN(sd)}, dej hned do mrazáku.</div></div>` : ''}
        <p class="tiny muted" style="margin-top:6px">Kdybys přidal ještě ${czDateShort(dalsi)}, vaříš stejně dlouho – jen přidáš suroviny na jednu porci.</p>
      </div>` : ''}</div>`; }).join('')}</div>`;
};

