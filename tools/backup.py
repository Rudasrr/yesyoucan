"""Záloha databáze do jednoho JSON souboru (všechny tabulky appky, včetně smazaných řádků).

Spouští ji týdně GitHub Action (.github/workflows/backup.yml), výsledek zašifruje
heslem BACKUP_PASSPHRASE a uloží jako artefakt na 90 dní. Ručně:
    SUPABASE_URL=… SUPABASE_SERVICE_KEY=… python3 tools/backup.py zaloha.json
Obnova je ručně (viz NAVOD.md A6) – záloha se nikdy nenahrává automaticky.
"""
import json, os, sys, urllib.request, datetime

TABLES = ['profiles', 'settings', 'foods', 'recipes', 'measurements', 'days', 'week_plans', 'shopping', 'prefs', 'training']
url, key = os.environ['SUPABASE_URL'].rstrip('/'), os.environ['SUPABASE_SERVICE_KEY']
out = {'exported': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'tables': {}}
for t in TABLES:
    rows, start = [], 0
    while True:   # PostgREST vrací po stránkách
        req = urllib.request.Request(f'{url}/rest/v1/{t}?select=*&order=id', headers={'apikey': key, 'Authorization': 'Bearer ' + key, 'Range': f'{start}-{start + 999}'})
        page = json.load(urllib.request.urlopen(req))
        rows += page
        if len(page) < 1000: break
        start += 1000
    out['tables'][t] = rows
    print(t, len(rows))
path = sys.argv[1] if len(sys.argv) > 1 else 'zaloha.json'
json.dump(out, open(path, 'w'), ensure_ascii=False)
print('uloženo', path, os.path.getsize(path), 'B')
