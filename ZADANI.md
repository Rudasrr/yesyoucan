# Zadání pro Claude Code · nasazení v5.3 (15. 9. 2026)

Kontext čti z `CLAUDE.md` a `STAV.md`. Úkoly dělej v pořadí; po každém spusť testy a commitni. Nic z toho nemění výpočty ani obrazovky – jen infrastrukturu a dvě drobné funkce.

**Zásada:** vlastník nekliká nic v GitHubu ani v Supabase. Všechno dělej přes `gh`, `supabase` CLI, Management API a SQL. Jediné dva ruční kroky jsou jednorázová přihlášení `gh auth login` a `supabase login` (prohlížeč) – o ta si řekni jednou větou až ve chvíli, kdy je potřebuješ. Tajemství (DB heslo, service-role klíč, hesla účtů) drž v `~/.robert-plan.env`, nikdy v repu.

## 0. Ověření startu (10 min)
- `pip install playwright && python3 -m playwright install chromium`
- `python3 build.py && node tools/check.js && python3 tools/ftest.py && python3 tools/qa.py` – vše musí projít (referenční čísla v CLAUDE.md).
- **K ověření:** středa vzorového týdne dává 2 473,00 kcal (s zaokrouhlením příloh na 10 g), 2 503,34 bez něj; STAV.md uvádí 2 511,75. Najdi příčinu rozdílu ~8 kcal (podezření: plánovací limit v5.1 zahrnuje plánovaný trénink / pojistka bazálu / změna cíle chodu). Neopravuj – jen krátce zapiš do závěrečné zprávy, ať vlastník rozhodne.

## 1. Service worker – offline otevření (30 min)
Problém: bez SW se appka nainstalovaná na plochu bez signálu neotevře (prázdná stránka), byť data v localStorage jsou.
- `src/sw.js` (nový, samostatný soubor, build ho zkopíruje do `out/sw.js`): cache-first pro `./` a `./index.html`, network-first fallback na cache; verze cache = hash obsahu `index.html` (build.py ji do `sw.js` doplní), staré cache smazat v `activate`, `skipWaiting` + `clients.claim`.
- V `app-core.js` registrace `navigator.serviceWorker.register('./sw.js')` jen mimo `file:` protokol (testy běží z file://). Při `updatefound`/nové verzi zobraz hlášku „Nová verze – obnovit“ (použij `UI.toast`, styl jako ostatní hlášky).
- Externí skripty z CDN (Supabase, SheetJS) do cache nedávej.
- Přidej do `build.py` kopírování `sw.js` a `icon.svg` (úkol 2) do `out/`; workflow už nahrává celé `out/`.
- Test: `qa.py` a `ftest.py` musí projít beze změny; ručně ověř v Chromu (Application → Service Workers) na `python3 -m http.server -d out`.

## 2. Ikona appky (10 min)
- `src/icon.svg` (512×512): jednoduchá, čitelná v 60 px – např. kruh v barvě `#0ea5a4` s bílou šipkou dolů/postavou; žádné cizí značky.
- Manifest v `build.py` doplnit o `icons` (`icon.svg`, `any`), přidat `<link rel="apple-touch-icon">` – iOS neumí SVG, proto vygeneruj i `icon-180.png` (Pillow nebo `rsvg-convert`; pokud v prostředí není, PNG vytvoř jednorázově a commitni do `src/`).
- Manifest z data-URI přesuň do souboru `out/manifest.webmanifest` (kopírovaný ze `src/manifest.webmanifest`), `start_url` a `scope` = `./`.

## 3. GitHub: repo, Secrets, Pages – celé přes `gh` (15 min)
Vlastník nic nekliká; jediný ruční krok je jednorázové `gh auth login` (otevře prohlížeč, vlastník potvrdí). Ověř `gh auth status`; pokud není přihlášen, řekni mu jednou větou, že má spustit `gh auth login` a pokračuj až potom.
- `git init -b main && git add -A && git commit -m "v5.3: zdroje, build, testy, workflow"`
- `gh repo create robert-plan --public --source=. --remote=origin --push`
- Pages přes Actions: `gh api -X POST repos/{owner}/robert-plan/pages -f build_type=workflow` (pokud vrátí 409, už existuje → `-X PUT`).
- Secrets doplníš až po úkolu 3b: `gh secret set SUPABASE_URL --body "$URL"` a `gh secret set SUPABASE_KEY --body "$KEY"`, pak `gh workflow run deploy.yml` a `gh run watch`.
- Adresa appky: `https://<owner>.github.io/robert-plan/` – ověř `curl -sI` → 200 a že `CLOUD_CONFIG` v nasazeném souboru není prázdný a `mamnato` v něm není.

## 3b. Supabase: projekt, schéma, účty, propojení – celé přes CLI + Management API (30 min)
Jediný ruční krok: jednorázové `supabase login` (prohlížeč). Pak `supabase orgs list` → ORG_ID.
- Projekt: `supabase projects create robert-plan --org-id $ORG --region eu-central-1 --db-password "$(openssl rand -base64 24)"`; heslo DB ulož do `~/.robert-plan.env` (negituje se), REF z výstupu. Počkej, než je projekt `ACTIVE_HEALTHY` (`supabase projects list`).
- Schéma a seed: `supabase link --project-ref $REF` a `psql "$(supabase db url ... )"` nebo `supabase db query -f supabase-setup.sql` (podle verze CLI; SQL je idempotentní, při chybě uprostřed spusť znovu). Ověř: `select count(*) from foods` = 196, `recipes` = 200.
- Klíče: `supabase projects api-keys --project-ref $REF` → URL `https://$REF.supabase.co`, anon/publishable key. Service-role klíč použij jen lokálně pro založení účtů, nikdy do repa ani Secrets.
- Auth konfigurace (Site URL, redirect, e-mail provider zapnutý, ostatní vypnuté): `PATCH https://api.supabase.com/v1/projects/$REF/config/auth` s tokenem z `supabase login` (`~/.supabase/access-token`): `{"site_url":"<adresa Pages>","uri_allow_list":"<adresa Pages>","external_email_enabled":true,"mailer_autoconfirm":false}`.
- Účty: node skript se `@supabase/supabase-js` a service-role klíčem: `auth.admin.createUser({email, password, email_confirm:true})` pro trenéra `rehor.rudolf@gmail.com` a Roberta `r.pesek24@gmail.com`. Hesla vygeneruj (`openssl rand -base64 12`), vypiš je **jen do terminálu** a do `~/.robert-plan.env`; vlastník si trenérské změní přes „Zapomenuté heslo“ (chodí na jeho e-mail), Robertovo dočasné mu pošle vlastník.
- `profiles`: SQL z NAVOD A5 s UID z výstupu createUser (`insert … on conflict do update`). Ověř: `select id, role, coach_id from profiles` = 2 řádky, Robert má `coach_id` trenéra.
- Pak úkol 3 – Secrets a nasazení.

## 4. Produkční build bez hesel (hotovo v build.py, jen ověř)
- Při nastaveném env je `LOCAL_USERS = {}`; ověř `grep -c mamnato out/index.html` → 0 v cloudovém buildu.
- `NAVOD.md` část A přepiš podle skutečného postupu (CLI, Action, Secrets) – klikací návod už neplatí; část B (Robert) a Řešení problémů nech. Připrav celý dokument.

## 5. První reálný sync (hned po 3b a 3)
Toto je hlavní riziko projektu: sync nikdy neběžel proti skutečné databázi.
- Automaticky (Playwright proti nasazené adrese, přihlášení heslem z `~/.robert-plan.env`, dva kontexty prohlížeče = trenér a Robert): uložení vážení → objeví se v Dashboardu · trenér uloží Nastavení a Trénink → Robert je vidí po synchronizaci (≤ 60 s nebo „Synchronizovat teď“) · Robert změní jídlo dne offline (`context.set_offline(True)`) → online → pushne se · trenér upraví globální recept → Robert vidí. Skript ulož jako `tools/cloudtest.py` (čte přihlášení z env, nikdy z repa).
- Na co si dát pozor: RLS u zápisu trenéra do `settings`/`training` s `user_id` Roberta; `pull()` bere `updated_at > lastSync` – ověř, že první pull stáhne vše; konflikty `id` mezi lokálním seedem a řádky z SQL seedu (globální `foods`/`recipes` mají `user_id null`).
- Každou chybu zapiš (tabulka, operace, text chyby) a oprav v `store.js` nebo v SQL; SQL je idempotentní.
- Nakonec testovací data (vážení, den, recept) smaž SQL `delete`, aby Robert začínal s čistou databází; seed surovin/receptů nech.

## 6. Závěrečná zpráva
Krátce: adresa appky, přihlašovací údaje pro Roberta (jen v terminálu), co bylo opraveno, výsledek testů včetně cloudtest, zjištění z úkolu 0 a 5. **Čeká na vlastníka** má být jen: poslat Robertovi adresu + dočasné heslo + tři věty z NAVOD A7. Aktualizuj `STAV.md` (celý dokument): NEXT = „týden reálných dat od Roberta, pak kontrola měr a parseru“.

## Později (nezačínat)
Web push notifikace (Supabase Edge Function; iOS jen pro nainstalovanou PWA, ~1 den) · onboarding při prvním otevření · zkrácená URL `#ted` · widget · více klientů (netestováno).
