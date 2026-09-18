/* ===== Výpočty – 1:1 podle sešitu robert-plan_4_0.xlsx ===== */
const SITUACE = '«vyřeším podle situace»';
const VYNECHAT = '— (vynechat)';
const BEER_KCAL = 205;      // kcal za 0,5 l 12°  (Dnešní den!E24*205)
const FRIED_KCAL_G = 2.9;   // kcal/g smaženého  (Dnešní den!E25*2.9)
const KG_KCAL = 7700;
const COURSE_KEYS = ['snidane', 'obed', 'svacina', 'vecere1', 'vecere2'];

const fmt0 = n => Math.round(n).toLocaleString('cs-CZ');
/* Zaokrouhlení porce na 10 g. U surovin, které se kupují suché a vaří (rýže, těstoviny, luštěniny),
   se zaokrouhluje hmotnost NA TALÍŘI, ne hmotnost suché suroviny – jinak by krok 10 g suché rýže
   znamenal skoro 30 g na talíři. Výtěžnost (yld) říká, kolikrát surovina vařením ztěžkne. */
function yieldOf(f) { return (f && f.yld) || 1; }
const SEED_YLD = Object.fromEntries(SEED.foods.filter(f => f.yld).map(f => [f.name, f.yld]));
/* hmotnost hotového jídla ze suroviny v syrovém/suchém stavu */
function cookedG(food, g) { return g * (SEED_YLD[food] || 1); }
/* gramy na displeji: uvnitř počítáme přesně (rýže 74,074 g), člověku ukazujeme celé gramy */
const gShow = g => { const n = Number(g) || 0; return n >= 10 ? Math.round(n) : Math.round(n * 10) / 10; };
function roundPortion(g, scale, f) { if (!scale) return g; const y = yieldOf(f); return Math.round(g * y / 10) * 10 / y; }
const fmt1 = n => (Math.round(n * 10) / 10).toLocaleString('cs-CZ', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmt2 = n => (Math.round(n * 100) / 100).toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const signed0 = n => (n >= 0 ? '+' : '−') + fmt0(Math.abs(n));
const mround5 = x => Math.round(x / 5) * 5;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const isoDate = d => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); };
const todayISO = () => isoDate(new Date());
const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (iso, n) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return isoDate(d); };
const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
const czDate = iso => { const d = parseISO(iso); return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`; };
const czDateShort = iso => { const d = parseISO(iso); return `${d.getDate()}. ${d.getMonth() + 1}.`; };
const DAY_NAMES = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota', 'Neděle'];
const DAY_SHORT = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];
const dayIndex = iso => (parseISO(iso).getDay() + 6) % 7;  // 0 = pondělí
const mondayOf = iso => addDays(iso, -dayIndex(iso));

/* MET podle tempa – VLOOKUP s TRUE (nejbližší nižší) */
function metFor(kmh, met) {
  let m = met[0][1];
  for (const [k, v] of met) if (kmh >= k) m = v;
  return m;
}

/* Základ dne: BMR, výdej, limity (Dnešní den!E6–E26) */
function calcBase(s, weight, walkMin, exerMin, walkKmh, beers, friedG, act, extraKcal) {
  act = act || {};                       // { planWalk, planKcal, doneKcal }  – z tréninkového plánu
  const bmr = 10 * weight + 6.25 * s.height - 5 * s.age + 5;
  const baseOut = bmr * s.activity;
  const kmh = walkKmh || s.walk_kmh;
  const walkPerMin = (metFor(kmh, s.met) - 1) * 3.5 * weight / 200;
  const exerPerMin = 2.5 * 3.5 * weight / 200;
  const planWalkBase = act.planWalk != null ? act.planWalk : s.walk_min;
  // Cheat (pivo, smažené, cokoli navíc) se přednostně pokrývá pohybem, ne menšími porcemi.
  // Jde-li uchodit do 90 minut navíc, appka o tolik zvedne cíl chůze a porce zůstanou.
  // Když je cheat větší, nemá smysl chtít hodiny chůze navíc: přidá se rozumných 30 minut
  // a zbytek se řekne narovinu – tenhle den prostě něco stojí.
  const cheatKcal = (beers || 0) * BEER_KCAL + (friedG || 0) * FRIED_KCAL_G + (extraKcal || 0);
  const cheatWalkFull = cheatKcal > 0 ? Math.ceil(cheatKcal / walkPerMin) : 0;
  const cheatCoverable = cheatWalkFull > 0 && cheatWalkFull <= 90;
  const cheatWalk = cheatKcal <= 0 ? 0 : (cheatCoverable ? cheatWalkFull : 30);
  const planWalk = planWalkBase + cheatWalk;
  const cheatCovered = cheatWalk * walkPerMin;
  const cheatRest = Math.max(0, cheatKcal - cheatCovered);
  const totalOutRaw = baseOut + (walkMin || 0) * walkPerMin + (exerMin || 0) * exerPerMin + (act.doneKcal || 0);
  const minOut = baseOut + planWalk * walkPerMin + (act.planKcal || 0);
  const deficit = weight * s.rate_pct / 100 * KG_KCAL / 7;
  const maxIntakeRaw = totalOutRaw - deficit, planLimitRaw = minOut - deficit;
  // spodní hranice jídla: limit nikdy pod klidový výdej (rozhodnuto Rudou; odchylka od sešitu)
  const maxIntake = Math.max(bmr, maxIntakeRaw), planLimit = Math.max(bmr, planLimitRaw);
  const belowBmr = maxIntakeRaw < bmr, planBelowBmr = planLimitRaw < bmr;
  const walkToBmr = belowBmr ? Math.ceil((bmr - maxIntakeRaw) / walkPerMin) : 0;
  const drinkKcal = cheatKcal;
  const foodBudget = Math.max(600, planLimit - drinkKcal);
  return { bmr, baseOut, walkPerMin, exerPerMin, totalOut: totalOutRaw, minOut, deficit, maxIntake, maxIntakeRaw, planLimit, drinkKcal, foodBudget, kmh, planWalk, planWalkBase, cheatKcal, cheatWalk, cheatWalkFull, cheatCovered, cheatRest, cheatCoverable, belowBmr, planBelowBmr, walkToBmr, effDeficit: totalOutRaw - maxIntake, planKcal: act.planKcal || 0, doneKcal: act.doneKcal || 0 };
}
const courseTargetSum = s => s.courses.reduce((a, c) => a + c.kcal, 0);

/* Jeden chod: recept + ruční úpravy → položky, faktor, součty.
   sel = název receptu | SITUACE | VYNECHAT | null
   edits = { swaps:{idx:foodName}, grams:{idx:number} } */
function calcCourse(s, foods, recipes, course, sel, edits, budget) {
  const cTarget = s.courses.find(c => c.key === course.key).kcal;
  const total = courseTargetSum(s);
  const target = Math.round(cTarget * budget / total);
  const out = { key: course.key, sel, target, items: [], kcal: 0, p: 0, c: 0, f: 0, factor: 1, recipeKcal: 0, active: false, edited: 0 };
  if (!sel) { out.hint = `cíl ${fmt0(cTarget)} kcal`; return out; }
  if (sel === VYNECHAT) { out.hint = 'vynecháno – 0 kcal'; out.skipped = true; return out; }
  if (sel === SITUACE) { out.kcal = cTarget; out.situace = true; out.hint = `cíl ${fmt0(cTarget)} kcal · vyřešíš podle situace`; return out; }
  const r = recipes.find(x => x.name === sel && !x.deleted) || recipes.find(x => x.name === sel);
  if (!r) { out.hint = 'recept nenalezen'; return out; }
  out.active = true;
  const fk = n => foods.find(x => x.name === n && !x.deleted);
  // faktor z původního receptu (sloupce K/L/M/N)
  let fixed = 0, scal = 0;
  r.items.forEach(it => { const f = fk(it.food); const k = f ? f.kcal * it.g / 100 : 0; if (it.scale) scal += k; else fixed += k; out.recipeKcal += k; });
  out.factor = scal === 0 ? 1 : clamp((cTarget * budget / total - fixed) / scal, 0.3, 1.6);
  const removed = (edits && edits.removed) || {};
  r.items.forEach((it, i) => {
    if (removed[i]) { out.edited++; out.removedItems = (out.removedItems || []).concat([{ idx: i, food: it.food, g: it.g }]); return; }
    const swaps = (edits && edits.swaps) || {}, grams = (edits && edits.grams) || {};
    const foodName = swaps[i] || it.food;
    const f = fk(foodName);
    let g = it.scale ? roundPortion(it.g * out.factor, true, f) : it.g;
    let manual = false;
    if (grams[i] !== undefined && grams[i] !== null && grams[i] !== '') { g = Number(grams[i]); manual = true; }
    if (swaps[i]) out.edited++;
    if (manual) out.edited++;
    const row = { idx: i, food: foodName, origFood: it.food, g, origG: it.g, scale: it.scale, manual, swapped: !!swaps[i],
      kcal: f ? f.kcal * g / 100 : 0, p: f ? f.p * g / 100 : 0, c: f ? f.c * g / 100 : 0, fat: f ? f.f * g / 100 : 0 };
    out.items.push(row); out.kcal += row.kcal; out.p += row.p; out.c += row.c; out.f += row.fat;
  });
  ((edits && edits.extra) || []).forEach((ex, j) => { const f = fk(ex.food); if (!f || !(ex.g > 0)) return; out.edited++;
    const row = { idx: 'x' + j, extra: true, food: ex.food, g: Number(ex.g), manual: true, kcal: f.kcal * ex.g / 100, p: f.p * ex.g / 100, c: f.c * ex.g / 100, fat: f.f * ex.g / 100 };
    out.items.push(row); out.kcal += row.kcal; out.p += row.p; out.c += row.c; out.f += row.fat; });
  const diff = out.kcal - target;
  out.hint = `cíl ${fmt0(target)} kcal · recept ${fmt0(out.recipeKcal)} kcal · teď ${fmt0(out.kcal)} kcal` +
    (Math.round(diff) !== 0 ? ` (${signed0(diff)} kcal proti cíli)` : '');
  return out;
}

/* kalorie z volně zapsaného cheatu („2 piva a řízek“) */
function cheatItemsKcal(day, foods) {
  return ((day && day.cheat_items) || []).reduce((a, it) => {
    if (it.kcal != null) return a + (Number(it.kcal) || 0);
    const f = foods.find(x => x.name === it.food && !x.deleted) || foods.find(x => x.name === it.food);
    return a + (f ? f.kcal * (Number(it.g) || 0) / 100 : 0);
  }, 0);
}

/* Celý den (Dnešní den) */
function calcDay(s, foods, recipes, day, weight) {
  const base = calcBase(s, weight, day.walk_min, day.exercise_min, day.walk_kmh, day.beers, day.fried_g, day.act, cheatItemsKcal(day, foods));
  const courses = s.courses.map(c => calcCourse(s, foods, recipes, c, (day.meals[c.key] || {}).sel, day.meals[c.key], base.foodBudget));
  const tot = courses.reduce((a, c) => ({ kcal: a.kcal + c.kcal, p: a.p + c.p, c: a.c + c.c, f: a.f + c.f }), { kcal: 0, p: 0, c: 0, f: 0 });
  const activeTargets = courses.reduce((a, c) => a + (c.active ? s.courses.find(x => x.key === c.key).kcal : 0), 0);
  const protTarget = tot.kcal === 0 ? 0 : Math.round(s.protein_min * activeTargets / courseTargetSum(s));
  const intake = tot.kcal + base.drinkKcal;
  const wmNow = day.walk_min || 0;
  // co už je opravdu snědené a co je zatím jen plán – appka je nesmí házet do jednoho pytle
  const eatenKcal = courses.reduce((a, c) => a + (((day.meals[c.key] || {}).eaten) ? c.kcal : 0), 0) + base.drinkKcal;
  const allEaten = courses.every(c => !(c.active || c.situace) || (day.meals[c.key] || {}).eaten);
  const jenPlan = !allEaten;
  // limit, jak vyjde po splnění plánované chůze a tréninku
  const limitPoPlanu = Math.max(base.bmr, base.minOut - base.deficit);
  // kolik minut chůze den skutečně srovná (spodní hranice drží limit, dokud celkový výdej nevyroste dost)
  const walkFix = base.walkPerMin > 0 ? Math.max(0, Math.ceil((intake - base.maxIntakeRaw) / base.walkPerMin)) : 0;
  const checks = [];
  // Kalorie
  if (tot.kcal === 0) checks.push({ name: 'Kalorie', state: 0, label: 'Nevybráno', text: 'Zatím nic nevybráno' });
  else if (intake > base.maxIntake + 30) {
    const drink = base.drinkKcal > 0 ? ` (v tom pití ${fmt0(base.drinkKcal)} kcal)` : '';
    // plán se vejde do limitu, jen zatím chybí pohyb, se kterým počítá
    if (jenPlan && intake <= limitPoPlanu + 30) checks.push({ name: 'Kalorie', state: 3, label: 'Zatím plán',
      text: `Naplánováno ${fmt0(intake)} kcal${drink} – to sedí do limitu ${fmt0(limitPoPlanu)} kcal, který ti vyjde, až uděláš svůj pohyb (chůze ${base.planWalk} min${base.planKcal ? ' + trénink' : ''}). Teď máš ${wmNow} minut, takže limit je zatím jen ${fmt0(base.maxIntake)}. Nic neřeš, jen to dojdi.` });
    else checks.push({ name: 'Kalorie', state: 1, label: jenPlan ? 'Plán je nad limitem' : 'Přes limit',
      text: `${jenPlan ? 'Naplánováno' : 'Snědeno'} ${fmt0(intake)} kcal${drink}, limit je ${fmt0(base.maxIntake)} – o ${fmt0(intake - base.maxIntake)} kcal víc. Deficit dne bude o tolik menší, takže se hubnutí posune. Spraví to jedno z toho: ubrat ${fmt0(intake - base.maxIntake)} kcal (nejdřív příloha), nebo dojít dnes celkem ${wmNow + walkFix} minut (teď máš ${wmNow}).` });
  }
  else if (intake > base.maxIntake) checks.push({ name: 'Kalorie', state: 2, label: 'Sedí', text: 'Sedí na limitu, rozdíl je jen v zaokrouhlení porcí – neřeš to.' + (base.drinkKcal > 0 ? ` (v tom pití ${fmt0(base.drinkKcal)} kcal)` : '') });
  else checks.push({ name: 'Kalorie', state: 2, label: jenPlan ? 'Plán sedí' : 'V limitu', text: `${jenPlan ? 'Naplánováno' : 'Snědeno'} ${fmt0(intake)} z ${fmt0(base.maxIntake)} kcal, zbývá ${fmt0(base.maxIntake - intake)} kcal` + (base.drinkKcal > 0 ? ` (v tom pití ${fmt0(base.drinkKcal)} kcal)` : '') + '. Můžeš je sníst, nebo nechat být – deficit tím jen povyroste.' });
  // Bílkoviny
  if (tot.p === 0) checks.push({ name: 'Bílkoviny', state: 0, label: 'Nevybráno', text: 'Zatím nic nevybráno' });
  else if (tot.p < protTarget) checks.push({ name: 'Bílkoviny', state: 1, label: 'Málo', text: `Chybí ${fmt0(protTarget - tot.p)} g bílkovin (cíl dne ${fmt0(protTarget)} g). Když hubneš a bílkoviny chybí, ubývá s tukem i sval. Přidej tvaroh, skyr, maso, rybu nebo vejce – ${Math.max(1, Math.round((protTarget - tot.p) / 20))}× porce po 20 g to dorovná.` });
  else checks.push({ name: 'Bílkoviny', state: 2, label: 'OK', text: `${fmt0(tot.p)} z ${fmt0(protTarget)} g – sedí.` });
  // Chůze
  const wm = wmNow, wt = base.planWalk;
  if (wm < wt) {
    const over = intake > base.maxIntake + 30;
    const tail = !over ? 'Na limit jídla to dnes zatím stačí, ale bez chůze nebude deficit takový, jaký má být.'
      : (wt >= wmNow + walkFix ? 'Dojdi je a den se srovná sám.' : `I tak bys byl nad limitem – dnes potřebuješ celkem ${wmNow + walkFix} minut.`);
    checks.push({ name: 'Chůze', state: 1, label: 'Chybí chůze', text: `Ušel jsi ${wm} z ${wt} minut, chybí ${wt - wm}. Je to ${fmt0((wt - wm) * base.walkPerMin)} kcal, o které máš dnes nižší limit jídla. ${tail}` });
  }
  else checks.push({ name: 'Chůze', state: 2, label: 'OK', text: `OK – ušel jsi ${wm} minut (cíl ${wt}) při ${fmt1(base.kmh)} km/h = ${fmt0(wm * base.walkPerMin)} kcal` });
  if (day.act && day.act.planItems) checks.push({ name: 'Trénink', state: day.act.doneAll ? 2 : (day.act.doneKcal ? 3 : 1), label: day.act.doneAll ? 'Hotovo' : (day.act.doneKcal ? 'Rozdělané' : 'Čeká'), text: day.act.doneAll ? `OK – splněno, ${fmt0(day.act.doneKcal)} kcal` : (day.act.doneKcal ? `částečně (${fmt0(day.act.doneKcal)} z ${fmt0(day.act.planKcal)} kcal)` : `čeká – ${day.act.planItems} ${day.act.planItems === 1 ? 'položka' : 'položky'}, ~${fmt0(day.act.planKcal)} kcal`) });
  if (base.belowBmr) checks.push({ name: 'Spodní hranice', state: 1, label: 'Drží hranice', text: `Zatím máš málo cíleného pohybu, takže by ti limit vyšel pod klidový výdej (${fmt0(base.bmr)} kcal) – tolik tělo spotřebuje, i kdybys celý den ležel, a jíst míň nemá smysl. Proto limit držím na téhle spodní hranici. Chůze klidový výdej nezvedá, zvedá celkový výdej – a s ním limit: prvních ${base.walkToBmr} minut se limit ještě nehne, od té doby ti každá minuta přidá ${fmt0(base.walkPerMin)} kcal. Dokud limit drží hranice, je tvůj dnešní deficit menší než plánovaný, takže hubnutí jede pomaleji.` });
  // Ruční úpravy
  const edited = courses.reduce((a, c) => a + c.edited, 0);
  checks.push({ name: 'Ruční úpravy', state: 3, label: edited === 0 ? 'Žádné' : `${edited}×`, text: edited === 0 ? 'žádné – platí recepty, jak jsou' : `${edited} polí (vyměněná potravina či gramáž). Při změně dne nebo varianty je zkontroluj či smaž.` });
  const dayDeficit = base.totalOut - intake;
  let summary, ok = false;
  const targetKg = weight * s.rate_pct / 100;
  if (tot.kcal === 0) summary = 'Vyber jídla a doplň minuty chůze – pak ti řeknu, jestli den sedí.';
  else if (intake <= base.maxIntake + 30 && tot.p >= protTarget && wm >= wt && !(day.act && day.act.planItems && !day.act.doneAll)) { ok = true; summary = `Dnešní den je v pořádku. Deficit ${fmt0(dayDeficit)} kcal, to je ${fmt2(dayDeficit * 7 / KG_KCAL)} kg za týden (plán ${fmt2(targetKg)} kg). Nic neřeš, takhle to funguje.`; }
  else {
    const fix = [];
    if (intake > base.maxIntake + 30) fix.push(`ubrat ${fmt0(intake - base.maxIntake)} kcal z jídla nebo dojít celkem ${wmNow + walkFix} minut`);
    else if (wm < wt) fix.push(`dojít zbylých ${wt - wm} minut`);
    if (tot.p < protTarget) fix.push(`přidat ${fmt0(protTarget - tot.p)} g bílkovin`);
    if (day.act && day.act.planItems && !day.act.doneAll) fix.push('odškrtat trénink');
    const kg = dayDeficit * 7 / KG_KCAL;
    summary = `${jenPlan ? 'Plán dne zatím nesedí' : 'Den zatím nesedí'}: ${fix.length ? fix.join(', ') : 'podívej se na označený řádek výš'}. ${dayDeficit >= 0 ? `Takhle jsi na deficitu ${fmt0(dayDeficit)} kcal, což je ${fmt2(kg)} kg za týden místo plánovaných ${fmt2(targetKg)} kg.` : `Takhle jsi dokonce ${fmt0(-dayDeficit)} kcal v plusu – při takovém dni se nehubne, ale přibírá.`} Jeden takový den nic nezkazí, ale tři v týdnu ano.`;
  }
  let friday;
  if (base.drinkKcal === 0) friday = 'Když si dáš piva nebo něco smaženého, zapiš to nahoře. Porce jídel se ti samy zmenší, aby ses vešel do dne – nemusíš nic počítat.';
  else friday = `Dnes máš z pití a smaženého ${fmt0(base.drinkKcal)} kcal. Porce jídel jsem ti o to zmenšil, jak to šlo (bílkovina se neškrtá) – na jídlo zbývá ${fmt0(Math.max(600, base.maxIntake - base.drinkKcal))} kcal. ` +
    ((day.beers || 0) >= 6 ? `To je ${fmt0(day.beers * BEER_KCAL)} kcal jen z piv – zvaž o pivo míň nebo dojdi 30 minut navíc, ať to nebrzdí týden.` : 'Vešel ses, drž se.');
  return { base, courses, tot, protTarget, intake, checks, summary, ok, friday, dayDeficit, remaining: base.maxIntake - intake };
}

/* Týden: stav jednoho dne (Týden!C14) – používá plánovací limit bez piv */
function calcPlanDay(s, foods, recipes, sels, weight, act) {
  const base = calcBase(s, weight, (act && act.planWalk != null) ? act.planWalk : s.walk_min, 0, s.walk_kmh, 0, 0, act);
  const courses = s.courses.map((c, i) => calcCourse(s, foods, recipes, c, sels[i], null, base.planLimit));
  const kcal = courses.reduce((a, c) => a + c.kcal, 0);
  const p = courses.reduce((a, c) => a + c.p, 0);
  const filled = sels.filter(Boolean).length;
  const share = courses.reduce((a, c, i) => a + (sels[i] && sels[i] !== SITUACE && sels[i] !== VYNECHAT ? s.courses[i].kcal : 0), 0) / courseTargetSum(s);
  const protTarget = Math.round(s.protein_min * share);
  const nSit = sels.filter(x => x === SITUACE).length;
  let status, state;
  if (filled === 0) { status = '–'; state = 0; }
  else if (filled < 5) { status = `chybí ${5 - filled} jídlo`; state = 1; }
  else if (kcal > base.planLimit + 30) { status = `přes o ${fmt0(kcal - base.planLimit)} kcal`; state = 1; }
  else if (kcal < base.planLimit - 150) { status = `málo jídla – chybí ${fmt0(base.planLimit - kcal)} kcal do limitu`; state = 3; }
  else if (p < protTarget) { status = `málo bílkovin (${fmt0(p)} z ${fmt0(protTarget)} g)`; state = 1; }
  else if (nSit > 0) { status = `v limitu (${nSit} vyřešíš na místě)`; state = 2; }
  else { status = 'v limitu'; state = 2; }
  return { courses, kcal, p, protTarget, status, state, planLimit: base.planLimit, filled, base };
}

/* Měření → řady s průměrem 7 dní, plánem, odchylkou (list Měření) */
function calcMeasurements(s, meas) {
  const rows = meas.filter(m => !m.deleted && m.weight != null).sort((a, b) => a.date < b.date ? -1 : 1);
  const byDate = Object.fromEntries(rows.map(m => [m.date, m]));
  const start = s.start_date;
  const out = [];
  for (const m of rows) {
    const idx = daysBetween(start, m.date);
    // Excel: AVERAGE přes posledních 7 řádků (dní), prázdné ignoruje
    const ws = [];
    for (let k = 0; k < 7; k++) { const d = addDays(m.date, -k); if (byDate[d] && byDate[d].weight != null) ws.push(byDate[d].weight); }
    const avg = ws.reduce((a, b) => a + b, 0) / ws.length;
    const plan = Math.max(s.goal_weight, s.start_weight * Math.pow(1 - s.rate_pct / 100, idx / 7));
    out.push({ ...m, idx, avg, lost: s.start_weight - avg, plan, dev: plan - avg, bmi: avg / Math.pow(s.height / 100, 2) });
  }
  return out;
}

function planWeightAt(s, idx) { return Math.max(s.goal_weight, s.start_weight * Math.pow(1 - s.rate_pct / 100, idx / 7)); }

/* Přehled – statistika */
function calcOverview(s, meas) {
  const rows = calcMeasurements(s, meas);
  const last = rows[rows.length - 1];
  const cur = last ? last.avg : s.start_weight;
  const q4 = last ? last.idx + 1 : 0;           // Přehled!Q4 = číslo řádku posledního vážení
  const lost = Math.max(0, s.start_weight - cur);
  const remaining = Math.max(0, cur - s.goal_weight);
  const progress = clamp((s.start_weight - cur) / (s.start_weight - s.goal_weight), 0, 1);
  const lastWaistRow = [...rows].reverse().find(r => r.waist != null) || meas.filter(m => m.waist != null && !m.deleted).sort((a, b) => a.date < b.date ? 1 : -1)[0];
  const waistRatio = lastWaistRow ? lastWaistRow.waist / s.height : null;
  let avgWeekLoss = null, forecast = null, weekBack = null;
  if (q4 >= 8) avgWeekLoss = (s.start_weight - cur) / ((q4 - 1) / 7);
  if (last) {
    if (cur <= s.goal_weight) forecast = 'cíl dosažen';
    else if (q4 < 8) forecast = 'zatím málo dat';
    else if (s.start_weight - cur <= 0) forecast = 'tímto tempem to nepůjde';
    else { const days = (q4 - 1) + (cur - s.goal_weight) * (q4 - 1) / (s.start_weight - cur); forecast = czDate(addDays(s.start_date, Math.floor(days))); }
    // týdenní ohlédnutí: průměr před 7 dny (řádek q4-7)
    const prevDate = addDays(last.date, -7);
    const prev = rows.find(r => r.date === prevDate) || [...rows].reverse().find(r => r.date <= prevDate);
    if (q4 > 7 && prev) {
      const lostW = prev.avg - cur, planW = prev.avg * s.rate_pct / 100;
      let msg;
      if (lostW >= planW * 0.9) msg = 'Sedíš na plánu nebo líp – přesně takhle. Drž to.';
      else if (lostW >= 0) msg = 'Trochu pomaleji než plán. Zkontroluj, jestli držíš limit a chodíš každý den – nebo je to jen voda, uvidíš příští týden.';
      else msg = 'Tenhle týden váha nešla dolů. Někdy je to voda nebo sůl, ale když se to opakuje, mrkni na pátky a na to, jestli sedíš do limitu.';
      weekBack = { lostW, planW, text: `Za poslední týden jsi shodil ${fmt2(lostW)} kg (plán byl ${fmt2(planW)} kg). ${msg}`, state: lostW >= planW * 0.9 ? 2 : (lostW >= 0 ? 3 : 1) };
    } else weekBack = { text: 'Ještě nemáš celý týden vážení. Zvaž se každé ráno, za pár dní se tu objeví první ohlédnutí.', state: 0 };
  } else weekBack = { text: 'Zatím žádná data – jakmile budeš mít týden vážení, uvidíš tu, jak ti šel.', state: 0 };
  // fáze chůze (Přehled!B19)
  let phase;
  for (const [th, name] of s.phase_thresholds) { if (cur > th) { phase = name; break; } }
  if (!phase) phase = s.phase_thresholds[s.phase_thresholds.length - 1][1];
  // plán proti realitě
  const weekTarget = Math.round(s.start_weight * s.rate_pct / 100 * 100) / 100;  // Nastavení!D13
  const pvr = [1, 2, 4, 8, 12].map(w => {
    const rowIdx = 7 * w;  // řádek 8+7w → idx 7w
    const r = rows.find(x => x.idx === rowIdx);
    const real = r ? s.start_weight - r.avg : (q4 > rowIdx + 1 ? 'nezapsáno' : 'ještě není');
    return { weeks: w, theory: weekTarget * w, expect: weekTarget * w * 0.75, real };
  });
  const dev = last ? last.dev : null;
  return { rows, last, cur, q4, lost, remaining, progress, waistRatio, avgWeekLoss, forecast, weekBack, phase, weekTarget, pvr, dev, lastWaist: lastWaistRow, daysSinceStart: last ? last.idx : null, count: rows.length };
}

/* Nákup: součet škálovaných gramů za týden (odchylka od Excelu – škáluje se na aktuální váhu, jako Vaření) */
function calcShopping(s, foods, recipes, plan, weight, acts) {
  const sum = {}, cnt = {};
  plan.forEach((sels, i) => {
    const pd = calcPlanDay(s, foods, recipes, sels, weight, acts ? acts[i] : undefined);
    pd.courses.forEach(c => c.items.forEach(it => { sum[it.food] = (sum[it.food] || 0) + it.g; cnt[it.food] = (cnt[it.food] || 0) + 1; }));
  });
  const fmap = Object.fromEntries(foods.map(f => [f.name, f]));
  return Object.entries(sum).map(([food, g]) => ({ food, g, uses: cnt[food], cat: fmap[food] ? fmap[food].cat : '', buy: food === 'Vejce' ? `${Math.ceil(g / 60)} ks` : (g >= 1000 ? `${fmt1(g / 1000)} kg` : `${fmt0(g)} g`) }))
    .sort((a, b) => (a.cat + a.food).localeCompare(b.cat + b.food, 'cs'));
}

/* Kolik co stojí – dopočet z aktuální váhy (Start!B45–B54; texty ze sešitu, čísla živě) */
function calcCosts(s, weight) {
  const b = calcBase(s, weight, s.walk_min, 0, s.walk_kmh, 0, 0);
  const b6 = calcBase(s, weight, s.walk_min, 0, 6, 0, 0);
  const def = b.deficit, wk = def * 7 / KG_KCAL;
  const beers6 = 6 * BEER_KCAL;
  const fri = beers6 + 1160; // řízek 200 g + hranolky 200 g = 1 160 kcal (statická hodnota ze sešitu)
  return { deficit: def, rows: [
    ['6 piv v pátek (6 × 0,5 l, 12°)', `${fmt0(beers6)} kcal`, `${fmt1(beers6 / def)} dne deficitu. Ne celý týden, jak se často říká – ale pořád den a něco práce zahozený.`],
    ['Řízek s hranolky (200 + 200 g)', '1 160 kcal', 'A přesně smažené je tvoje slabost, tady je cca další jeden den v trapu.'],
    ['Pátek s 6 pivy a řízkem', `${fmt0(fri)} kcal`, `${fmt1(fri / def)} dne deficitu. Z týdenního pokroku ${fmt2(wk)} kg zbude ${fmt2(wk - fri / KG_KCAL)} kg.`],
    ['Ten samý pátek každý týden celý rok', `${fmt0(fri * 52)} kcal`, `${fmt0(fri * 52 / KG_KCAL)} kilo, která nezhubneš. Tohle je to skutečné číslo, ne ten jeden pátek.`],
    ['3 piva místo 6, jinak nic neměníš', `úspora ${fmt0(3 * BEER_KCAL)} kcal/týden`, `${fmt1(3 * BEER_KCAL * 52 / KG_KCAL)} kila za rok. Jediná změna: tři piva místo šesti.`],
    ['Hodina chůze denně', `${fmt0(60 * b.walkPerMin)} kcal`, `${fmt1(60 * b.walkPerMin * 30 / KG_KCAL)} kila za měsíc jen z chůze. Nic víc dělat nemusíš, jen se držet a prostě vypadnout ven a jít!`],
    ['Hodina svižnější chůze (6 km/h)', `${fmt0(60 * b6.walkPerMin)} kcal`, 'O třetinu víc za stejný čas. Rychleji je levnější než delší – nehledej čas navíc, drž tempo.'],
    ['Lžíce agávového sirupu denně', '62 kcal', `${fmt1(62 * 365 / KG_KCAL)} kila za rok. Sirup je cukr, i když se tváří zdravě. Nic není zakázané, ale mysli na 2. pravidlo – bílkovina je základ a zbaví tě chuti na sladké.`],
    ['Půl litru slazené limonády', '210 kcal', `${fmt1(210 / (60 * b.walkPerMin) * 60 / 60)} hodiny chůze, aby to bylo pryč. Voda stojí nula.`],
    ['Odchodit 1 kg tuku samotnou chůzí', `${fmt1(KG_KCAL / (60 * b.walkPerMin))} hodiny`, 'Proto se hubne v kuchyni a chůzí se to jen podpoří.'],
  ] };
}
