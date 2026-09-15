import os, re, sys, shutil, hashlib
ROOT=os.path.dirname(os.path.abspath(__file__))
src=lambda f: open(os.path.join(ROOT,'src',f),encoding='utf-8').read()
URL=os.environ.get('SUPABASE_URL','').strip(); KEY=os.environ.get('SUPABASE_KEY','').strip()
CLOUD=bool(URL and KEY)
html=f'''<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#f3f6fb">
<title>YesYouCan</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800;900&display=swap" rel="stylesheet">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" href="icon-192.png">
<link rel="apple-touch-icon" href="icon-180.png">
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="default"><meta name="apple-mobile-web-app-title" content="YesYouCan">
<style>
{src('style.css')}
</style>
</head>
<body>
<header class="top"><div class="wrap"><div class="brand"><img class="logo" src="logo.png" alt="" width="28" height="28">YesYouCan <span class="who" id="who"></span></div><nav class="desk" id="nav-desk"></nav><div class="syncb" id="syncb"></div></div></header>
<div id="login" class="login sheet"></div>
<div id="app" class="sheet"><main id="main" class="wrap"></main></div>
<nav class="mob" id="nav-mob"></nav>
<div id="toast" class="toast"></div>
<script>
/* =====================================================================
   NASTAVENÍ CLOUDU – vyplň po založení projektu v Supabase (viz NAVOD.md):
   url  = Project URL          (Settings → API → Project URL, např. https://abcd.supabase.co)
   key  = publishable / anon key (Settings → API Keys → anon public)
   Dokud jsou prázdné, aplikace běží jen v tomto prohlížeči (bez přihlášení).
   ===================================================================== */
const CLOUD_CONFIG = {{ url: '{URL}', key: '{KEY}' }};

{src('seed.js')}
{src('calc.js')}
{src('store.js')}
{src('app-core.js')}
{src('views-client.js')}
{src('views-coach.js')}
{src('tasks.js')}
{src('picker.js')}
{src('dnes.js')}
{src('training.js')}
{src('recipes.js')}
{src('extras.js')}
</script>
</body>
</html>
'''
if CLOUD:
    # produkční build: lokální účty nejsou potřeba, e-maily a hesla do veřejného souboru nepatří
    html=re.sub(r"const LOCAL_USERS = \{.*?\};", "const LOCAL_USERS = {};", html, count=1)
    assert "const LOCAL_USERS = {};" in html
OUT=os.path.join(ROOT,'out')
os.makedirs(OUT,exist_ok=True)
open(os.path.join(OUT,'index.html'),'w',encoding='utf-8').write(html)
# service worker: verze cache = hash obsahu index.html, aby nová verze přepsala starou
sw=src('sw.js').replace('__BUILD_HASH__', hashlib.sha256(html.encode('utf-8')).hexdigest()[:12])
open(os.path.join(OUT,'sw.js'),'w',encoding='utf-8').write(sw)
for f in ('manifest.webmanifest','logo.png','icon-180.png','icon-192.png','icon-512.png'):
    shutil.copyfile(os.path.join(ROOT,'src',f), os.path.join(OUT,f))
print(len(html)//1024,'kB', 'cloud' if CLOUD else 'lokální režim', '+ sw.js, manifest, ikony')
