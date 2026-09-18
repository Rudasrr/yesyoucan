/* ===== Úkoly, hodnocení, pochvaly, připomínky ===== */
const COURSE_EMOJI = { snidane: '🍳', obed: '🍲', svacina: '🥪', vecere1: '🥗', vecere2: '🥛' };
const timeToMin = t => { const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0); };
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const CLOSE_TIME = '20:30', WEIGH_TIME = '7:00', PLAN_TIME = '18:00';

/* Kolik jídel je naplánováno na týden (od pondělí) */
function weekPlanned(monday) { const w = getWeek(monday); return w.plan.reduce((a, d) => a + d.filter(Boolean).length, 0); }
function shoppingDone(monday) {
  const s = S(), w0 = currentWeight(), list = calcShopping(s, Foods(), Recipes(), getWeek(monday).plan, w0, weekActs(monday, w0)); const sh = getShop(monday);
  return { total: list.length, done: list.filter(x => sh.checked[x.food]).length };
}

/* Úkoly pro dané datum – pořadí je pořadí dne */
function dayTasks(date) {
  const s = S(), day = effectiveDay(date), meas = Meas().find(m => m.date === date);
  const isSun = dayIndex(date) === 6, isToday = date === todayISO(), now = isToday ? nowMin() : 24 * 60;
  const T = [];
  T.push({ id: 'weigh', em: '⚖️', tx: 'Zvaž se', sub: 'ráno po WC, nalačno', done: !!(meas && meas.weight != null), view: 'mereni', at: WEIGH_TIME, key: 'morning' });
  if (isSun) T.push({ id: 'measure', em: '📏', tx: 'Změř obvody', sub: 'pas, boky, hrudník, stehno, paže', done: !!(meas && meas.waist != null), view: 'mereni', at: WEIGH_TIME });
  // aktuální týden nenaplánovaný (Po–So) → úkol
  const thisMon = mondayOf(date);
  if (!isSun) { const n = weekPlanned(thisMon); if (n < 35) T.push({ id: 'plan_now', em: '🗓️', tx: n === 0 ? 'Naplánuj tento týden' : `Doplň plán tohoto týdne (${n}/35)`, sub: 'bez plánu se den skládá naslepo', done: false, view: 'tyden', week: thisMon }); }
  s.courses.forEach(c => { const m = day.meals[c.key] || {}; const chosen = !!m.sel && m.sel !== VYNECHAT;
    T.push({ id: 'meal_' + c.key, em: COURSE_EMOJI[c.key], tx: c.name + (chosen && m.sel !== SITUACE ? ' – ' + m.sel : ''), sub: (chosen ? '' : 'vyber jídlo · ') + c.time, done: !!m.eaten || m.sel === VYNECHAT, view: 'dnes', at: c.time, meal: c.key, chosen }); });
  const wt = (day.act && day.act.planWalk != null) ? day.act.planWalk : s.walk_min;
  T.push({ id: 'walk', em: '🚶', tx: `Chůze ${wt} minut`, sub: (day.walk_min || 0) ? `zapsáno ${day.walk_min} min` : 'zapiš ušlé minuty', done: (day.walk_min || 0) >= wt, view: 'dnes', at: '17:00' });
  if (day.act && day.act.planItems) T.push({ id: 'training', em: '🏋️', tx: `Trénink · ${day.act.planItems} ${day.act.planItems === 1 ? 'položka' : (day.act.planItems < 5 ? 'položky' : 'položek')}`, sub: day.act.doneAll ? `hotovo · ${fmt0(day.act.doneKcal)} kcal` : `~${fmt0(day.act.planKcal)} kcal · odškrtni po dokončení`, done: !!day.act.doneAll, view: 'dnes', at: '17:30' });
  if (isSun) {
    const nextMon = addDays(thisMon, 7); const n = weekPlanned(nextMon);
    const wkN = getWeek(nextMon);
    if (wkN.auto && !wkN.reviewed) T.push({ id: 'review', em: '🗓️', tx: 'Projdi návrh příštího týdne', sub: 'appka ho navrhla – změň, co nechceš', done: false, view: 'tyden', week: nextMon, at: PLAN_TIME });
    else T.push({ id: 'plan', em: '🗓️', tx: 'Naplánuj příští týden', sub: `${n}/35 jídel vybráno`, done: n >= 35, view: 'tyden', week: nextMon, at: PLAN_TIME });
    if (n >= 35) { const sd = shoppingDone(nextMon); T.push({ id: 'shop', em: '🛒', tx: 'Dojdi na nákup', sub: `mám ${sd.done} z ${sd.total}`, done: sd.total > 0 && sd.done >= sd.total, view: 'nakup', week: nextMon }); }
  }
  T.forEach(t => { t.due = t.at ? timeToMin(t.at) <= now : true; t.now = !t.done && t.at && Math.abs(timeToMin(t.at) - now) <= 45 && isToday; });
  return T;
}

/* Hodnocení dne (pro uzavření i pro trenéra) */
function evaluateDay(date) {
  const s = S(), day = effectiveDay(date), d = calcDay(s, Foods(), Recipes(), day, weightAt(s, date));
  const eaten = s.courses.filter(c => (day.meals[c.key] || {}).eaten).length;
  const cheats = { beers: day.beers || 0, fried: day.fried_g || 0, over: d.tot.kcal > 0 && d.intake > d.base.maxIntake + 30 ? Math.round(d.intake - d.base.maxIntake) : 0, edits: d.courses.reduce((a, c) => a + c.edited, 0), situace: d.courses.filter(c => c.situace).length, skipped: d.courses.filter(c => c.skipped).length };
  return { d, day, eaten, cheats, ok: d.ok, logged: d.tot.kcal > 0 || (day.walk_min || 0) > 0 };
}

/* Série uzavřených dnů v pořádku (končí včera nebo dnes) */
function streakOk() {
  let n = 0; let dt = addDays(todayISO(), -1); const uid = Store.ownerId();
  const recs = Object.fromEntries(Store.rows('days', uid).map(r => [r.data.date, r.data]));
  while (recs[dt] && n < 60) { const ok = recs[dt].closed ? recs[dt].closedOk : evaluateDay(dt).ok; if (!ok) break; n++; dt = addDays(dt, -1); }
  return n;
}
function weighStreak() { let n = 0, dt = todayISO(); const by = Object.fromEntries(Meas().map(m => [m.date, m])); if (!by[dt]) dt = addDays(dt, -1); while (by[dt] && by[dt].weight != null) { n++; dt = addDays(dt, -1); } return n; }

/* Pochvaly a popíchnutí – vrací pole {tone, em, text}, první je hlavní */
function praise(date) {
  const s = S(), ov = calcOverview(s, Meas()), out = [];
  const ev = evaluateDay(date), isToday = date === todayISO();
  const st = streakOk(), ws = weighStreak();
  // váha
  if (ov.weekBack && ov.weekBack.lostW != null) {
    if (ov.weekBack.lostW >= ov.weekBack.planW * 0.9) out.push({ tone: 'good', em: '🔥', text: `Za týden dole o ${fmt2(ov.weekBack.lostW)} kg – to je přesně tempo, na kterém stojí celý plán. Drž to.` });
    else if (ov.weekBack.lostW > 0) out.push({ tone: 'good', em: '👍', text: `Váha jde dolů (−${fmt2(ov.weekBack.lostW)} kg za týden). Pomaleji než plán, ale směr je správný.` });
    else out.push({ tone: 'push', em: '🧭', text: 'Týdenní průměr váhy nešel dolů. Zkontroluj pátky a limit – jeden týden nic neznamená, dva už ano.' });
  }
  if (ov.dev != null && ov.dev >= 0.3) out.push({ tone: 'good', em: '🏆', text: `Jsi ${fmt2(ov.dev)} kg před plánovanou křivkou. Náskok, ne důvod ubrat.` });
  if (ov.lost >= 1) { const milestone = Math.floor(ov.lost); if (milestone >= 1 && ov.lost - milestone < 0.3) out.push({ tone: 'good', em: '🎯', text: `${milestone} kg dole od startu. ${fmt0(milestone * KG_KCAL)} kcal, které už nikdy nezvedáš.` }); }
  // den
  const fixes = { Kalorie: 'zůstat pod limitem (lehčí příloha, nebo víc chůze)', Bílkoviny: 'dostat bílkoviny na cíl – přidej tvaroh, maso nebo protein', Chůze: `dojít celých ${(ev.day.act && ev.day.act.planWalk) || s.walk_min} minut`, Trénink: 'udělat trénink podle plánu', 'Spodní hranice': 'přidat chůzi, ať limit nedrží spodní hranice' };
  const fails = ev.d.checks.filter(c => c.state === 1).map(c => fixes[c.name]).filter(Boolean);
  if (!isToday) out.push(ev.ok ? { tone: 'good', em: '✅', text: `Tenhle den byl v pořádku. Deficit ${fmt0(ev.d.dayDeficit)} kcal.` } : { tone: 'push', em: '📌', text: ev.d.tot.kcal === 0 ? 'Bez zapsaných jídel.' : 'Den nesedl: ' + fails.join('; ') + '.' });
  else if (isToday && ev.ok) out.push({ tone: 'good', em: '💪', text: 'Dnešek sedí ve všem – kalorie, bílkoviny i chůze. Večer to jen uzavři.' });
  if (st >= 3) out.push({ tone: 'good', em: '🔥', text: `${st} ${st < 5 ? 'dny' : 'dnů'} v řadě v pořádku. Tohle je ten návyk, ne dieta.` });
  if (ws >= 7) out.push({ tone: 'good', em: '⚖️', text: `Vážíš se ${ws} dnů v kuse – proto ti průměr říká pravdu.` });
  if (!out.length) out.push({ tone: 'neutral', em: '🚀', text: isToday ? 'Nový den. Zvaž se, vyber jídla, dojdi si svých 60 minut.' : 'Doplň, co si pamatuješ – i neúplný den je lepší než prázdný.' });
  return out;
}

/* automatické uzavření včerejška o půlnoci / při otevření */
function autoClosePast() {
  if (realCoach()) return; const uid = Store.ownerId(); const today = todayISO();
  Store.rows('days', uid).forEach(r => { const d = r.data; if (d.date < today && !d.closed) { const ev = evaluateDay(d.date); d.closed = true; d.closedAuto = true; d.closedOk = ev.ok; d.closedSummary = ev.d.summary; saveDay(d); } });
}

/* Připomínky v appce + systémová notifikace, když je stránka otevřená */
const Remind = {
  shown: LS.get('remindShown', {}),
  tick() {
    if (!Store.profile || realCoach()) return; const today = todayISO();
    autoPlanSunday();
    Object.keys(this.shown).forEach(k => { if (!k.startsWith(today)) delete this.shown[k]; });
    const tasks = dayTasks(today); const now = nowMin();
    for (const t of tasks) { if (t.done || !t.at) continue; const at = timeToMin(t.at); const key = today + ':' + t.id;
      if (now >= at && now <= at + 90 && !this.shown[key]) { this.shown[key] = 1; LS.set('remindShown', this.shown); this.show(t); break; } }
  },
  show(t) {
    document.querySelectorAll('.remind').forEach(e => e.remove());
    const el = document.createElement('div'); el.className = 'remind';
    el.innerHTML = `<span class="em">${t.em}</span><div><div class="tx">${esc(t.tx)}</div><div class="sub">${esc(t.sub || '')}</div></div><button class="btn sm" onclick="this.closest('.remind').remove();${t.week ? `App.week='${t.week}';` : ''}go('${t.view}')">Otevřít</button>`;
    document.body.appendChild(el); setTimeout(() => el.remove(), 60000);
    if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') { try { new Notification('YesYouCan', { body: `${t.em} ${t.tx}` }); } catch (e) { } }
  },
  async enable() {
    if (!('Notification' in window)) { UI.toast('Tento prohlížeč notifikace neumí'); return; }
    const p = await Notification.requestPermission(); UI.toast(p === 'granted' ? 'Upozornění zapnuta (fungují, když je appka otevřená)' : 'Upozornění nepovolena'); render();
  }
};
setInterval(() => Remind.tick(), 60000);

/* Export připomínek do kalendáře (.ics) – spolehlivé i při zavřené appce */
A.exportIcs = () => {
  const s = S(); const url = location.href.split('#')[0];
  const ev = (uid, summary, hhmm, rrule, desc) => { const [h, m] = hhmm.split(':').map(Number); const dt = `20260914T${String(h).padStart(2, '0')}${String(m || 0).padStart(2, '0')}00`;
    return `BEGIN:VEVENT\r\nUID:${uid}@yesyoucan\r\nDTSTAMP:20260914T000000Z\r\nDTSTART;TZID=Europe/Prague:${dt}\r\nDURATION:PT15M\r\nRRULE:${rrule}\r\nSUMMARY:${summary}\r\nDESCRIPTION:${desc} ${url}\r\nURL:${url}\r\nBEGIN:VALARM\r\nTRIGGER:PT0M\r\nACTION:DISPLAY\r\nDESCRIPTION:${summary}\r\nEND:VALARM\r\nEND:VEVENT\r\n`; };
  let ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//YesYouCan//CZ\r\nCALSCALE:GREGORIAN\r\nX-WR-CALNAME:YesYouCan\r\n';
  ics += ev('weigh', '⚖️ Zvaž se a zapiš', WEIGH_TIME, 'FREQ=DAILY', 'Ráno po WC, nalačno. Otevři appku:');
  s.courses.forEach(c => { ics += ev('meal-' + c.key, `${COURSE_EMOJI[c.key]} ${c.name}`, c.time, 'FREQ=DAILY', 'Sněz, co máš v plánu, a odklikni v appce:'); });
  ics += ev('walk', '🚶 Chůze – zapiš minuty', '17:00', 'FREQ=DAILY', `${s.walk_min} minut denně. Zapiš do appky:`);
  ics += ev('close', '🌙 Shrnutí dne', CLOSE_TIME, 'FREQ=DAILY', 'Mrkni, jak den dopadl:');
  ics += ev('plan', '🗓️ Naplánuj příští týden + nákup', PLAN_TIME, 'FREQ=WEEKLY;BYDAY=SU', 'Neděle: změř obvody, naplánuj týden, dojdi na nákup:');
  ics += 'END:VCALENDAR\r\n';
  downloadBlob(new Blob([ics], { type: 'text/calendar' }), 'yesyoucan-pripominky.ics');
};

/* Neděle 18:00: příští týden bez plánu → appka ho navrhne a řekne to */
function autoPlanSunday() {
  const today = todayISO(); if (dayIndex(today) !== 6 || nowMin() < timeToMin(PLAN_TIME)) return;
  const nextMon = addDays(mondayOf(today), 7); const wk = getWeek(nextMon);
  if (wk.auto || wk.plan.flat().some(Boolean)) return;
  generateWeek(nextMon, 'all'); const w2 = getWeek(nextMon); w2.auto = true; saveWeek(w2);
  UI.toast('Navrhl jsem ti příští týden – projdi si ho v Týdnu a změň, co nechceš.'); render();
}
