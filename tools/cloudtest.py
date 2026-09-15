"""První reálný sync proti nasazené appce a skutečné Supabase.

Přihlášení a adresu čte z ~/.yesyoucan.env (nikdy z repozitáře):

    APP_URL=https://rudasrr.github.io/yesyoucan/
    COACH_EMAIL=...        COACH_PW=...
    ROBERT_EMAIL=...       ROBERT_PW=...
    SUPABASE_URL=...       SUPABASE_SERVICE_KEY=...   # jen pro úklid testovacích dat

Spuštění:  python3 tools/cloudtest.py [--keep]
           --keep = nechat testovací data v databázi (jinak se na konci smažou)

Každá chyba zápisu nebo čtení se vypíše jako:  CHYBA <tabulka> <operace> <text>
"""
import os, sys, json, pathlib, urllib.request, urllib.parse, datetime
from playwright.sync_api import sync_playwright

ENV = pathlib.Path.home() / '.yesyoucan.env'
cfg = {}
if ENV.exists():
    for line in ENV.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            cfg[k.strip()] = v.strip().strip('"').strip("'")
cfg.update({k: v for k, v in os.environ.items() if k in (
    'APP_URL', 'COACH_EMAIL', 'COACH_PW', 'ROBERT_EMAIL', 'ROBERT_PW', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY')})

missing = [k for k in ('APP_URL', 'COACH_EMAIL', 'COACH_PW', 'ROBERT_EMAIL', 'ROBERT_PW') if not cfg.get(k)]
if missing:
    sys.exit('Chybí v ~/.yesyoucan.env: ' + ', '.join(missing))

URL = cfg['APP_URL']
KEEP = '--keep' in sys.argv
TAG = 'cloudtest'
problems, notes = [], []


def check(name, ok, detail=''):
    print(('  OK    ' if ok else '  CHYBA ') + name + (' – ' + str(detail) if detail else ''))
    if not ok:
        problems.append(name + (' – ' + str(detail) if detail else ''))
    return ok


def watch(page, who):
    """Chyby stránky a hlášky z push()/pull() – tam se projeví RLS."""
    page.on('pageerror', lambda e: problems.append(f'{who}: pád stránky – {e}'))

    def on_console(m):
        t = m.text
        if t.startswith('push ') or t.startswith('pull '):
            op, rest = t.split(' ', 1)
            problems.append(f'{who}: {op} {rest}')
            print(f'  CHYBA sync {who}: {op} {rest}')
    page.on('console', on_console)


def login(ctx, email, pw, who):
    pg = ctx.new_page()
    watch(pg, who)
    pg.goto(URL, wait_until='domcontentloaded')
    pg.wait_for_function('typeof Store !== "undefined" && !!Store.sb', timeout=30000)
    pg.evaluate('([e,p]) => Store.signIn(e,p).then(()=>afterLogin())', [email, pw])
    pg.wait_for_function('Store.profile && !Store.profile.missing', timeout=30000)
    role = pg.evaluate('Store.profile.role')
    check(f'přihlášení {who} (role {role})', role in ('coach', 'client'), role)
    return pg


def sync(pg):
    pg.evaluate('Store.sync().then(()=>render())')
    pg.wait_for_function('!Store.syncing && Store.outbox.length === 0', timeout=30000)
    pg.wait_for_timeout(300)


def cleanup(ids):
    """Smazat testovací řádky natvrdo – service-role klíčem, mimo repozitář."""
    url, key = cfg.get('SUPABASE_URL'), cfg.get('SUPABASE_SERVICE_KEY')
    if not (url and key):
        print('\nÚklid přeskočen (chybí SUPABASE_SERVICE_KEY) – smaž ručně:')
        for t, i in ids:
            print(f"  delete from public.{t} where id = '{i}';")
        return
    for t, i in ids:
        req = urllib.request.Request(
            f'{url}/rest/v1/{t}?id=eq.{urllib.parse.quote(i)}', method='DELETE',
            headers={'apikey': key, 'Authorization': 'Bearer ' + key})
        try:
            urllib.request.urlopen(req).read()
        except Exception as e:
            print(f'  úklid {t}/{i}: {e}')
    print(f'\nÚklid: smazáno {len(ids)} testovacích řádků.')


today = datetime.date.today().isoformat()
created = []

with sync_playwright() as p:
    b = p.chromium.launch()
    mk = lambda: b.new_context(viewport={'width': 1280, 'height': 900}, locale='cs-CZ', timezone_id='Europe/Prague')
    ctxC, ctxR = mk(), mk()

    print('\n1 · přihlášení')
    coach = login(ctxC, cfg['COACH_EMAIL'], cfg['COACH_PW'], 'trenér')
    robert = login(ctxR, cfg['ROBERT_EMAIL'], cfg['ROBERT_PW'], 'Robert')
    ruid = robert.evaluate('Store.uid()')
    check('trenér vidí Roberta jako klienta', coach.evaluate('Store.clientId') == ruid,
          coach.evaluate('JSON.stringify(Store.clients.map(c=>c.email))'))

    print('\n2 · první pull stáhne výchozí data')
    sync(robert)
    nfoods = robert.evaluate("Store.rows('foods').filter(r=>r.user_id===null).length")
    nrec = robert.evaluate("Store.rows('recipes').filter(r=>r.user_id===null).length")
    check('Robert vidí 196 globálních surovin', nfoods == 196, nfoods)
    check('Robert vidí 200 globálních receptů', nrec == 200, nrec)

    print('\n3 · Robert uloží vážení → trenér ho vidí')
    w = 131.4
    robert.evaluate("go('mereni')")
    robert.fill('#m_weight', str(w)); robert.fill('#m_waist', '119')
    robert.click('text=Uložit zápis'); robert.wait_for_timeout(300)
    mid = robert.evaluate("Store.rows('measurements').find(r=>r.data.date===todayISO()).id")
    created.append(('measurements', mid))
    sync(robert); sync(coach)
    seen = coach.evaluate(f"Store.rows('measurements').some(r=>r.id==='{mid}' && r.data.weight==={w})")
    check('vážení dorazilo trenérovi', seen)
    check('trenér má vážení ve svém pohledu na klienta',
          coach.evaluate(f"Meas().some(m=>m.date===todayISO() && m.weight==={w})"))
    # souhrn Dashboardu při jediném vážení hlásí „málo dat na trend“, číslo je až v Detailu
    dash = coach.evaluate("(()=>{ go('klient'); App.dashDetail = true; render(); return document.querySelector('#main').innerText })()")
    check('Dashboard (Detail) ho ukazuje', str(w).replace('.', ',') in dash, dash.replace('\n', ' · ')[:150])
    coach.evaluate('App.dashDetail = false; render()')

    print('\n4 · trenér uloží Nastavení a Trénink → Robert je vidí')
    coach.evaluate("saveSettings({...S(), rate_pct: 0.75})")
    created.append(('settings', coach.evaluate("'settings:'+Store.ownerId()")))
    tid = coach.evaluate("""(()=>{ const id = oid('tp','cloudtest');
        Store.put('training', id, { day: 2, name: 'Cloudtest – kolo', items: [{ ex: 'Rotoped', min: 30, met: 7 }] });
        return id })()""")
    created.append(('training', tid))
    sync(coach); sync(robert)
    check('Robert vidí nové tempo 0,75 %', robert.evaluate('S().rate_pct') == 0.75, robert.evaluate('S().rate_pct'))
    check('Robert vidí tréninkový plán', robert.evaluate(f"Store.rows('training').some(r=>r.id==='{tid}')"))

    print('\n5 · Robert změní jídlo offline → online → pushne se')
    ctxR.set_offline(True)
    robert.evaluate("App.date=todayISO();go('dnes')")
    robert.evaluate("""(()=>{ const r = Recipes().filter(x=>x.course==='Oběd')[0];
        const d = getDay(App.date); d.meals = {...d.meals, obed:{ sel: r.name }}; saveDay(d); return r.name })()""")
    did = robert.evaluate("oid('d', App.date)")
    created.append(('days', did))
    queued = robert.evaluate('Store.outbox.length')
    check('offline změna čeká ve frontě', queued > 0, queued)
    ctxR.set_offline(False)
    robert.evaluate('Store.sync()')
    robert.wait_for_function('Store.outbox.length === 0', timeout=30000)
    sync(coach)
    check('den dorazil trenérovi', coach.evaluate(f"Store.rows('days').some(r=>r.id==='{did}' && r.data.meals.obed)"))

    print('\n6 · trenér upraví globální recept → Robert ho vidí')
    newname = 'Cloudtest – přejmenovaný recept'
    orig = coach.evaluate("(()=>{ const r = Store.rows('recipes').find(x=>x.user_id===null); return [r.id, r.data] })()")
    rid, odata = orig[0], orig[1]
    coach.evaluate(f"Store.put('recipes', {json.dumps(rid)}, {{...{json.dumps(odata)}, name: {json.dumps(newname)} }}, null)")
    sync(coach); sync(robert)
    check('Robert vidí změněný recept', robert.evaluate(
        f"Store.rows('recipes').some(r=>r.id==={json.dumps(rid)} && r.data.name==={json.dumps(newname)})"))
    # globální recept se nemaže, jen vrátí do původního stavu
    coach.evaluate(f"Store.put('recipes', {json.dumps(rid)}, {json.dumps(odata)}, null)")
    sync(coach); sync(robert)
    check(f'recept {rid} vrácen do původního stavu', robert.evaluate(
        f"Store.rows('recipes').some(r=>r.id==={json.dumps(rid)} && r.data.name==={json.dumps(odata['name'])})"))

    print('\n7 · Robert si udělá vlastní verzi výchozí suroviny (nesmí přepsat globální)')
    ownid = robert.evaluate("""(()=>{ const f = Store.rows('foods').find(x=>x.user_id===null);
        const id = 'fo:'+Store.uid()+':'+f.id;
        Store.put('foods', id, {...f.data, kcal: f.data.kcal + 7, overrides: f.id});
        return id })()""")
    created.append(('foods', ownid))
    sync(robert); sync(coach)
    check('vlastní verze se uložila', robert.evaluate(f"Store.rows('foods').some(r=>r.id==='{ownid}')"))
    check('trenér ji vidí jako Robertovu', coach.evaluate(
        f"(Store.rows('foods').find(r=>r.id==='{ownid}')||{{}}).user_id === '{ruid}'"))

    print('\n8 · náhled trenéra nic neuloží, „Plánovat za Roberta“ ano')
    coach.evaluate("App.preview = true; App.coachPlan = false; App.view = 'dnes'; render()")
    before = coach.evaluate("JSON.stringify(Store.db.days.map(r=>r.id))")
    coach.evaluate("(()=>{ const d = getDay(todayISO()); d.meals = {...d.meals, svacina:{ sel: 'CLOUDTEST – náhled' }}; saveDay(d) })()")
    coach.wait_for_timeout(300)
    check('v náhledu se nic neuloží', coach.evaluate("JSON.stringify(Store.db.days.map(r=>r.id))") == before)

    coach.evaluate("App.coachPlan = true; render()")
    rname = coach.evaluate("Recipes().filter(r=>r.course==='Svačina')[0].name")
    coach.evaluate(f"(()=>{{ const d = getDay(todayISO()); d.meals = {{...d.meals, svacina:{{ sel: {json.dumps(rname)} }} }}; saveDay(d) }})()")
    cid = coach.evaluate("oid('d', todayISO())")
    created.append(('days', cid))
    sync(coach); sync(robert)
    check('trenér naplánoval Robertovi svačinu', robert.evaluate(
        f"(Store.rows('days').find(r=>r.id==={json.dumps(cid)})||{{data:{{meals:{{}}}}}}).data.meals.svacina.sel === {json.dumps(rname)}"))
    check('den patří Robertovi, ne trenérovi', coach.evaluate(
        f"(Store.rows('days').find(r=>r.id==={json.dumps(cid)})||{{}}).user_id === '{ruid}'"))
    coach.evaluate("App.coachPlan = false; App.preview = false; render()")

    b.close()

if not KEEP:
    cleanup(created)
print('\nPoznámky:')
for n in notes:
    print('  ·', n)
print('\nerrors:', 'none' if not problems else f'{len(problems)}')
for pr in problems:
    print('  ·', pr)
sys.exit(1 if problems else 0)
