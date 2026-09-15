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
      <div class="plist">${L.slice(0, 80).map(f => `<div class="pitem ${f.name === current ? 'cur' : ''}" onclick="window._fppick(${JSON.stringify(f.name).replace(/"/g, '&quot;')})"><div style="flex:1;min-width:0"><div class="pn">${f.own ? '📌 ' : ''}${esc(f.name)}</div><div class="pi">${esc(f.cat)}</div></div><div class="pk">${f.kcal} <span>kcal</span><br><span class="muted">${f.p} g B</span></div></div>`).join('') || '<p class="muted small" style="padding:10px">Nic nenalezeno.</p>'}</div>`;
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
function recipeTotals(r, fmap) { const t = { kcal: 0, p: 0, c: 0, f: 0 }; (r.items || []).forEach(it => { const f = fmap[it.food]; if (!f || !(it.g > 0)) return; t.kcal += f.kcal * it.g / 100; t.p += f.p * it.g / 100; t.c += f.c * it.g / 100; t.f += f.f * it.g / 100; }); return t; }

/* ===== Editor receptu =====
   mode: 'own' (Robertův vlastní) | 'override' (Robertova verze globálního) | 'global' (trenér) */
function openRecipeEditor(id, mode) {
  const s = S(); const src = id ? Recipes().find(r => r.id === id) : null;
  if (!mode) mode = isCoach() ? 'global' : (src && !src.own ? 'override' : 'own');
  const draft = src ? JSON.parse(JSON.stringify({ name: src.name, course: src.course, items: src.items, num: src.num })) : { name: '', course: 'Snídaně', items: [] };
  const saveId = mode === 'override' ? (src.ovId || oid('rov', src.id)) : (mode === 'own' ? (src ? src.id : oid('own', Date.now())) : (src ? src.id : 'r:' + Date.now()));
  const owner = mode === 'global' ? null : Store.ownerId();
  const targets = Object.fromEntries(SEED.settings.courses.map(c => [c.name, c]));
  const m = UI.modal('');
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
    m.querySelector('.box').innerHTML = `<div class="row between"><h2>${mode === 'override' ? 'Moje verze receptu' : (id ? 'Upravit recept' : 'Nový recept')}${help('1) Pojmenuj a vyber chod – hned vidíš cíl kalorií a bílkovin. 2) Přidávej suroviny (hledání, kategorie) a gramy v syrovém stavu. 3) U přílohy (rýže, brambory, pečivo, ovoce) zapni „přizpůsobit váze“ – ta se pak s klesající váhou automaticky zmenšuje, bílkovina a zelenina drží. 4) Když je stav zelený, ulož.')}</h2><button class="xbtn" onclick="UI.closeModal()">×</button></div>
      ${mode === 'override' ? `<div class="notice" style="margin:6px 0 10px">Úprava vytvoří tvoji verzi „${esc(src.name)}“ – platí jen pro tebe, trenérova databáze zůstává. Název se nemění.</div>` : ''}
      <div class="grid" style="grid-template-columns:2fr 1fr;gap:8px;margin-top:8px"><div class="in"><label class="f">Název</label><input type="text" id="re-n" value="${esc(draft.name)}" ${mode === 'override' ? 'disabled' : ''} placeholder="např. Kuře s rýží a zeleninou"></div><div class="in"><label class="f">Chod</label><select id="re-c">${s.courses.map(c => `<option ${c.name === draft.course ? 'selected' : ''}>${c.name}</option>`).join('')}</select></div></div>
      <div class="stats3" style="padding:12px 0 4px"><div><b class="${st === 2 ? 'ok' : st === 1 ? 'bad' : ''}">${fmt0(t.kcal)} <small>/ ${course.kcal}</small></b><span>kcal · cíl pro ${draft.course.toLowerCase()}</span></div><div><b class="${t.p >= pmin && t.kcal ? 'ok' : (t.kcal ? 'bad' : '')}">${fmt0(t.p)} <small>/ ${pmin} g</small></b><span>bílkoviny · minimum</span></div><div><b>${fmt0(t.c)} <small>S</small> · ${fmt0(t.f)} <small>T</small></b><span>sacharidy · tuky (g)</span></div></div>
      <div class="status st${st}" style="margin-bottom:10px">${esc(verdict)}</div>
      <table class="items"><tr><th>Surovina</th><th class="n">g</th><th class="n">kcal</th><th class="n">B</th><th title="příloha se přepočítává podle Robertovy váhy">přizpůsobit váze${help('Zapni u přílohy (rýže, brambory, těstoviny, pečivo, ovoce, vločky). Když Robert zhubne, klesne jeho limit – a tyhle suroviny se zmenší automaticky (faktor 0,3–1,6). Maso, vejce, tvaroh a zelenina nechej vypnuté: bílkovina se nikdy nekrátí.')}</th><th></th></tr>
      ${draft.items.map((it, i) => { const f = fmap[it.food]; return `<tr><td><button class="pickbtn sm ${it.food ? '' : 'empty'}" style="margin:0" onclick="window._reFood(${i})"><span>${it.food ? esc(it.food) : '+ vybrat surovinu'}</span>${f ? `<em>${f.kcal} kcal/100 g</em>` : ''}</button></td><td class="n"><input type="number" class="g" min="0" step="5" value="${it.g || ''}" placeholder="g" onchange="window._reG(${i},this.value)">${it.food && it.g ? `<div class="tiny muted">${measureText(it.food, it.g)}</div>` : ''}</td><td class="n">${f && it.g ? fmt0(f.kcal * it.g / 100) : ''}</td><td class="n">${f && it.g ? fmt1(f.p * it.g / 100) : ''}</td><td style="text-align:center"><input type="checkbox" ${it.scale ? 'checked' : ''} style="width:20px;height:20px;min-height:0" onchange="window._reS(${i},this.checked)"></td><td class="n"><button class="xbtn" onclick="window._reDel(${i})">×</button></td></tr>`; }).join('')}
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
    const del = m.querySelector('#re-del'); if (del) del.onclick = () => UI.confirm('Smazat recept? Zůstane v historii dnů, zmizí z nabídek.', () => { m.remove(); Undo.run(`Recept smazán: ${src.name}`, () => { if (mode === 'global' && src.seed) Store.put('recipes', src.id, { name: src.name, course: src.course, num: src.num, items: src.items }, null); Store.remove('recipes', saveId); }); render(); });
    const rs = m.querySelector('#re-reset'); if (rs) rs.onclick = () => { m.remove(); Undo.run('Vráceno na původní recept', () => Store.remove('recipes', src.ovId)); render(); };
  };
  window._reFood = i => openFoodPicker(name => { draft.items[i].food = name; const lib = Foods().find(f => f.name === name); if (lib && !draft.items[i].g) draft.items[i].g = ['Obiloviny a přílohy', 'Pečivo', 'Ovoce'].includes(lib.cat) ? 100 : 100; if (lib && ['Obiloviny a přílohy', 'Pečivo', 'Ovoce'].includes(lib.cat)) draft.items[i].scale = 1; draw(); }, draft.items[i].food);
  window._reG = (i, v) => { draft.items[i].g = Number(v); draw(); }; window._reS = (i, v) => { draft.items[i].scale = v ? 1 : 0; draw(); }; window._reDel = i => { draft.items.splice(i, 1); draw(); };
  window._reAdd = () => { draft.items.push({ food: '', g: '', scale: 0 }); draw(); setTimeout(() => window._reFood(draft.items.length - 1), 50); };
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
    return `<div class="rrow ${open ? 'open' : ''}"><div class="rhead" onclick="App.rOpen['${r.id}']=!App.rOpen['${r.id}'];render()"><span class="rtag">${COURSE_EMOJI[key] || ''} ${esc(r.course)}</span><span class="rname">${esc(r.name)}${r.own ? ' <span class="pill">moje</span>' : ''}${r.overridden ? ' <span class="pill">moje verze</span>' : ''}${cnt ? ` <span class="pill">${cnt}× v týdnu</span>` : ''}</span><span class="rk"><b>${fmt0(t.kcal)}</b> kcal · ${fmt0(t.p)} g B</span><button class="star ${prefs.favs.includes(r.name) ? 'on' : ''}" onclick="event.stopPropagation();A.favInPlace(this,${JSON.stringify(r.name).replace(/"/g, '&quot;')})">${prefs.favs.includes(r.name) ? '★' : '☆'}</button><span class="muted">${open ? '▾' : '▸'}</span></div>
      ${open ? `<div class="rbody"><table class="small"><tr><th>Surovina</th><th class="n">g</th><th class="n">kcal</th><th class="n">B</th><th class="n">S</th><th class="n">T</th></tr>${r.items.map(it => { const f = fmap[it.food] || { kcal: 0, p: 0, c: 0, f: 0 }; return `<tr><td>${esc(it.food)}${it.scale ? ' <span class="tiny muted">· příloha</span>' : ''}</td><td class="n">${it.g}</td><td class="n">${fmt0(f.kcal * it.g / 100)}</td><td class="n">${fmt1(f.p * it.g / 100)}</td><td class="n">${fmt1(f.c * it.g / 100)}</td><td class="n">${fmt1(f.f * it.g / 100)}</td></tr>`; }).join('')}<tr><td class="b">celkem</td><td></td><td class="n b">${fmt0(t.kcal)}</td><td class="n b">${fmt1(t.p)}</td><td class="n">${fmt1(t.c)}</td><td class="n">${fmt1(t.f)}</td></tr></table>
        <div class="row" style="margin-top:8px"><button class="btn sec sm write" onclick="A.editRecipe('${r.id}')">${r.own || isCoach() ? 'Upravit' : (r.overridden ? 'Upravit moji verzi' : 'Upravit (moje verze)')}</button>${opts && opts.extra ? opts.extra(r) : ''}</div></div>` : ''}</div>`; }).join('');
  return { html: rows || '<p class="muted small" style="padding:10px">Nic neodpovídá.</p>', count: L.length };
}
function recipeFilterBar(recipes) { const s = S(); const prefs = Prefs();
  return filterBar('rl', { q: App.rq, onQ: 'window._rq', placeholder: 'název jídla nebo surovina…', sorts: [['course', 'chod'], ['name', 'A–Z'], ['kcal', 'kcal ↑'], ['p', 'bílkoviny ↓']], sort: App.rsort, onSort: 'window._rs', filters: [['fav', '⭐ oblíbené', !!App.rfil.fav], ['own', '📖 moje', !!App.rfil.own]].concat(s.courses.map(c => ['c:' + c.key, c.name, !!App.rfil['c:' + c.key]])), onFilter: 'window._rf' }); }
window._rq = v => { App.rq = v; render(); }; window._rs = v => { App.rsort = v; render(); };
window._rf = k => { if (k === '__clear') App.rfil = {}; else if (k.startsWith('c:')) { const on = !App.rfil[k]; Object.keys(App.rfil).forEach(x => { if (x.startsWith('c:')) delete App.rfil[x]; }); if (on) App.rfil[k] = true; } else App.rfil[k] = !App.rfil[k]; render(); };

VIEWS.recepty = function () {
  const all = Recipes(); const own = all.filter(r => (r.own || r.overridden) && !r.deleted); const favs = Prefs().favs.length;
  const list = recipeList(all);
  return `<div class="row between" style="margin-bottom:8px"><h1>Recepty${help('Všech 200 receptů ze sešitu plus tvoje vlastní. Řádek ukazuje chod, kalorie a bílkoviny; rozbalením uvidíš suroviny s gramy. Hvězdička = oblíbené (panel výběru je řadí nahoru, generátor týdne je zařazuje častěji). Upravit můžeš i výchozí recept – vznikne tvoje verze, trenérova databáze zůstává.')}</h1><button class="btn sm write" onclick="A.editOwn()">+ nový recept</button></div>
  <div class="row small muted" style="margin-bottom:8px"><span class="pill">${all.filter(r => !r.deleted).length} receptů</span><span class="pill">📖 ${own.length} mých</span><span class="pill">⭐ ${favs} oblíbených</span><span class="sp"></span><span>${list.count} zobrazeno</span></div>
  ${recipeFilterBar(all)}<div class="card tight" style="margin-top:10px">${list.html}</div>`;
};

/* ===== Vaření: podle dnů / podle receptů ===== */
App.vMode = 'recipes';
VIEWS.vareni = function () {
  const s = S(), foods = Foods(), recipes = Recipes(), w = currentWeight();
  const wk = getWeek(App.week);
  const weekNav = `<div class="row noprint" style="margin-bottom:10px">${weekToggle()}<div class="seg"><button class="${App.vMode === 'recipes' ? 'on' : ''}" onclick="App.vMode='recipes';render()">podle receptů</button><button class="${App.vMode === 'days' ? 'on' : ''}" onclick="App.vMode='days';render()">podle dnů</button></div><span class="sp"></span><button class="btn sec sm" onclick="window.print()">Tisk</button></div>`;
  const head = `<div class="row between" style="margin-bottom:6px"><h1>Vaření${help('Rozpis toho, co v týdnu uvařit. „Podle receptů“ sečte, kolikrát se jídlo v týdnu opakuje – hodí se na vaření do krabiček. „Podle dnů“ je rozpis den po dni. Gramy jsou syrové a přepočítané na tvoji aktuální váhu a plánovanou aktivitu dne.')}</h1></div>`;
  if (!wk.plan.some(d => d.some(Boolean))) return head + weekNav + `<div class="card">Zatím nemáš naplánovaný týden. Vyber jídla v Týdnu (nebo nech appku navrhnout) a rozpis se tu vyplní sám.</div>`;
  const days = wk.plan.map((sels, i) => ({ i, r: calcPlanDay(s, foods, recipes, sels, w, planActFor(addDays(App.week, i), w)) }));
  if (App.vMode === 'days') return head + `<p class="small muted" style="margin-bottom:8px">Gramy jsou syrové, přepočítané na ${fmt1(w)} kg a aktivitu dne.</p>` + weekNav +
    `<div class="grid g2">${days.map(({ i, r }) => { if (!r.filled) return ''; return `<div class="card tight"><div class="row between"><h3>${DAY_NAMES[i]} <span class="muted small" style="font-weight:600">${czDateShort(addDays(App.week, i))}</span></h3><span class="small ${r.state === 1 ? 'bad' : 'muted'}">${fmt0(r.kcal)} kcal · ${fmt0(r.p)} g · limit ${fmt0(r.planLimit)}</span></div>
      <table class="small" style="margin-top:4px">${r.courses.map((c, ci) => `<tr><td class="muted" style="width:52px">${s.courses[ci].time}</td><td><b>${c.sel ? esc(c.sel) : '<span class="muted">–</span>'}</b>${c.active ? `<div class="muted">${c.items.map(it => `${esc(it.food)} ${fmt0(it.g)} g`).join(' · ')}</div>` : (c.situace ? `<div class="muted">vyřešíš na místě – cíl ${fmt0(s.courses[ci].kcal)} kcal</div>` : '')}</td><td class="n">${c.active || c.situace ? fmt0(c.kcal) : ''}</td></tr>`).join('')}</table></div>`; }).join('')}</div>`;
  // podle receptů: agregace přes týden (gramy sečtené, počet dnů)
  const agg = {};
  days.forEach(({ i, r }) => r.courses.forEach((c, ci) => { if (!c.active) return; const a = agg[c.sel] = agg[c.sel] || { name: c.sel, course: s.courses[ci].name, key: s.courses[ci].key, days: [], kcal: 0, p: 0, items: {} }; a.days.push(DAY_SHORT[i]); a.kcal += c.kcal; a.p += c.p; c.items.forEach(it => { a.items[it.food] = (a.items[it.food] || 0) + it.g; }); }));
  const list = Object.values(agg).sort((a, b) => (s.courses.findIndex(c => c.name === a.course) - s.courses.findIndex(c => c.name === b.course)) || b.days.length - a.days.length);
  return head + `<p class="small muted" style="margin-bottom:8px">${list.length} různých jídel v týdnu. Uvař naráz na všechny dny, zvaž jednou a rozděl rovným dílem do krabiček – „🍱 uvařeno“ si odškrtni. ⚖️ zvaž · 🥄 odměř · ✋ od oka.</p>` + weekNav +
    `<div class="card tight">${list.map(a => { const open = App.rOpen['v:' + a.name]; const n = a.days.length; return `<div class="rrow ${open ? 'open' : ''}"><div class="rhead" onclick="App.rOpen['v:${esc(a.name)}']=!App.rOpen['v:${esc(a.name)}'];render()"><span class="rtag">${COURSE_EMOJI[a.key]} ${esc(a.course)}</span><span class="rname">${esc(a.name)} <span class="pill">${n}× · ${a.days.join(' ')}</span>${cookedSet(App.week)[a.name] ? ' <span class="pill ok">🍱 uvařeno</span>' : ''}</span><button class="btn sec sm write" onclick="event.stopPropagation();A.toggleCooked('${App.week}',${JSON.stringify(a.name).replace(/"/g, '&quot;')})">${cookedSet(App.week)[a.name] ? 'zrušit' : '🍱 uvařeno ×' + n}</button><span class="rk"><b>${fmt0(a.kcal / n)}</b> kcal/porce · ${fmt0(a.p / n)} g B</span><span class="muted">${open ? '▾' : '▸'}</span></div>
      ${open ? `<div class="rbody"><table class="small"><tr><th>Surovina</th><th class="n">na porci</th><th class="n">celkem ${n}×</th></tr>${Object.entries(a.items).map(([f, g]) => `<tr><td>${modeBadge(f)} ${esc(f)} <span class="tiny muted">${measureText(f, g / n)}</span></td><td class="n">${fmt0(g / n)} g</td><td class="n b">${g >= 1000 ? fmt1(g / 1000) + ' kg' : fmt0(g) + ' g'}</td></tr>`).join('')}</table></div>` : ''}</div>`; }).join('')}</div>`;
};
