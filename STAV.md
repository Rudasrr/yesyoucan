# Robert – plán hubnutí · stavový dokument (15. 9. 2026)

## Jak navázat
- **V Claude Code:** otevři repozitář (`robert-plan`), pravidla jsou v `CLAUDE.md`, úkoly v `ZADANI.md`. Edituj jen `src/*`; `python3 build.py` složí `out/index.html`; testy v `tools/`.
- **V chatu:** nahraj `STAV.md` a `out/index.html` (případně `src/` jako zip) a napiš: „Navazuji na projekt Robert – plán, stav je v STAV.md.“
- Struktura repa: `src/` (moduly, pořadí skládání v CLAUDE.md) · `build.py` (čte env `SUPABASE_URL`, `SUPABASE_KEY`; v cloudové verzi vyprázdní `LOCAL_USERS`) · `tools/` (check.js, ftest.py, qa.py, shots.py) · `supabase-setup.sql` · `.github/workflows/deploy.yml` (build + GitHub Pages).

## Cíl
Webová appka pro jednoho klienta (Robert, start 134,4 kg → 102 kg, 0,7 % váhy/týden) a jednoho trenéra (Ruda). Nahrazuje Excel `robert-plan_4_0.xlsx`; výpočty 1:1 podle sešitu (ověřeno: středa vzorového týdne 2 511,75 kcal, prognóza 14. 5. 2027 atd.). Robert musí být plánem veden, ne vymýšlet; trenér do 10 minut denně.

## Technika (rozhodnuto, neměnit)
- Jeden `index.html` (HTML+CSS+JS, bez buildu), GitHub Pages. Knihovny z CDN jen při potřebě (Supabase JS, SheetJS). Grafy vlastní SVG.
- Supabase: `CLOUD_CONFIG = { url, key }` na začátku skriptu. Dokud prázdné → režim „bez cloudu“ (data v localStorage) s lokálním přihlášením `LOCAL_USERS`: Robert `r.pesek24@gmail.com / mamnato`, trenér `rehor.rudolf@gmail.com / 06392` (odkaz „Přihlásit se jako trenér“). Není to zabezpečení – v Supabase založit účty se stejnými e-maily.
- Offline-first: localStorage + fronta + last-write-wins podle `updated_at`, soft-delete `deleted`. Tabulky (vše `id text, user_id uuid, data jsonb, updated_at, deleted`): `profiles`, `settings`, `foods`, `recipes`, `measurements`, `days`, `week_plans`, `shopping`, `prefs`, `training`. RLS: klient čte/píše své; trenér čte klienty (`coach_id`), píše `settings`, `training`, globální `foods`/`recipes` (user_id null). Id záznamů obsahují uid (`d:<uid>:<date>`, `m:…`, `w:…`, `p:<uid>:main`, `tp:<uid>:<id>`, `to:<uid>:<date>`, `note:<uid>:<date>`).
- `supabase-setup.sql` je idempotentní; seed 196 surovin a 200 receptů; blok pro `profiles` s UUID; volitelný import 14 vážení.

## Klíčové výpočty (calc.js)
- BMR Mifflin–St Jeor; výdej = BMR × faktor aktivity (1,34) + chůze (MET podle km/h) + trénink (MET) ; deficit = váha × tempo % × 7700/7 (pevný); limit dne = výdej − deficit; **plánovací limit** dne = výdej s plánovanou chůzí a tréninkem − deficit.
- **Pojistka bazálu** (odchylka od sešitu, rozhodnuto): limit nikdy pod BMR; appka řekne, kolik minut chůze chybí.
- Cíl chodu = cíl z Nastavení × limit/2450; škáluje se jen příloha (flag), faktor 0,3–1,6, příloha zaokrouhlena na 10 g (sešit 5 g – odchylka). Pivo 205 kcal/0,5 l, smažené 2,9 kcal/g, min. 600 kcal na jídlo.
- Průměr 7 vážení; plánovaná křivka; prognóza; plán proti realitě 75 %.
- Trénink: položky s MET (kardio dle cviku; silové lehce/středně/těžce 3/4,5/6; 1,6 min na sérii). Splněné položky zvedají skutečný limit; plánované zvedají plánovací limit → recepty, Týden, Nákup, Vaření se přepočítají samy.
- Běžná chůze (kroky, výchozí 5 000) se do limitu ani cíle chůze nepočítá; slouží trenérovi + doporučení faktoru aktivity (<3 000 → 1,2 … >8 500 → 1,48).

## Obrazovky
**Robert:** Dnes (karta „Teď“ – jeden krok; Plán dne proti limitu = rezerva; ukazatel snědeno/naplánováno; Aktivita s +15/+30/+60, trénink k odškrtnutí, kroky; Úkoly dne; Jídla dne dole – výběrový panel s Hledat/Řadit/Filtr a „co se vejde“, 💡 jiné, suroviny vyměnit/odebrat/přidat, „co jsem snědl“ u jídla podle situace, domácí míry ⚖️🥄✋; poznámka trenérovi; kontrola dne) · Týden (jen tento/příští, 7 dní vedle sebe, 💡 Naplánuj mi týden s rutinou, výzvy „přidat/ubrat kcal“ + Dorovnat) · Přehled · Měření (kontrola věrohodnosti ±2 kg) · Nákup (po porcích) · Vaření (podle receptů s 🍱 uvařeno / podle dnů) · Recepty (řádkový seznam, editor s cíli, moje verze výchozích) · Suroviny (kategorie, moje verze, vlastní) · Návod (dlaždice, „Jak jíst bez váhy“, Moje nádoby) · Účet (připomínky .ics, nádoby, kroky, export, záloha).
**Trenér:** Dashboard (tichý: 🟢🟡🔴, věta, návrh vzkazu, co se stalo od minula, tempo cíl/plán/realita, doporučení; Detail) · Zpráva (týdenní, kopírovat/poslat) · Trénink (plány Po–Ne, knihovna 38 cviků, kalorie, limit jídla dne vs. Robertův plán, varování, progres, výjimka dne) · Nastavení (s doporučeními a tlačítky) · Databáze/Recepty/Suroviny (globální editace) · 👁️ Pohled Roberta (náhled).
Den se ukládá průběžně, o půlnoci se uzavře sám; každá změna má hlášku + Zpět.

## Odchylky od sešitu (záměrné)
Nákup škálovaný na aktuální váhu · datované týdny · pojistka bazálu · příloha na 10 g · „kolik co stojí“ počítáno živě (statické hodnoty v sešitu si nesedí) · start 134,4 (texty říkaly 129) · tolerance „sedí“ ±60 kcal v UI.

## Rozhodnutí Rudy (platí)
Robert edituje výchozí suroviny/recepty jako vlastní verzi · hlavní číslo dne = rezerva plánu · hvězdičky + záložka Oblíbené · pojistka bazálu ano · vláknina ne · trénink jako týdenní šablona + výjimky · Robert potvrzuje položky tréninku · tempo mění jen trenér · odměrky ano (nádoby: lžička 5, lžíce 15, hrnek 250, sklenice 300, naběračka 120 ml, odměrka 30 g) · rutina v generátoru výchozí zapnutá · žádný tmavý režim, žádné foto jídla, žádný přepis do frameworku.

## Kontrola kvality (jak testovat)
`tools/qa.py` (3 šířky × všechny obrazovky: přetečení, prvky mimo viewport, kontrast, písmo <11 px, klikací průchod), `tools/ftest.py` (funkční scénáře) a `tools/check.js` (výpočty, referenční čísla v CLAUDE.md); princip: Playwright headless, `localLogin('client'|'coach')`, testovací data ze `SEED.sample_week` a `SEED.measurements`. Poslední stav (15. 9. 2026, tento sandbox): ftest bez chyby, qa 292 interakcí bez chyby, 0 přetečení.

## Otevřené věci / NEXT
- **NEXT: nasazení podle ZADANI.md** (úkoly 0–6 v Claude Code): service worker pro offline otevření, ikona, GitHub Action se Secrets, produkční build bez hesel, první reálný sync proti Supabase. GitHub i Supabase zakládá a nastavuje Claude Code přes `gh`/`supabase` CLI a Management API; Ruda jen jednorázově potvrdí `gh auth login` a `supabase login` v prohlížeči a pak pošle Robertovi adresu a dočasné heslo.
- **K ověření:** středa vzorového týdne dává v aktuálním buildu 2 473,00 kcal (příloha na 10 g), bez zaokrouhlení 2 503,34; tento dokument dříve uváděl 2 511,75. Rozdíl ~8 kcal má najít Claude Code (úkol 0). Prognóza 14. 5. 2027 a ohlédnutí 0,71/0,93 kg beze změny.
- Rozhodnuto 15. 9.: repozitář veřejný, klíče přes GitHub Secrets; push notifikace do Později.
- Po týdnu reálných dat od Roberta: zkontrolovat míry (plátek 20 g, hustoty), parser „co jsem snědl“, generátor.
- Později: web push (Edge Function; iOS jen pro PWA, ~1 den) · onboarding při prvním otevření · zkrácená URL `#ted` · widget · fáze chůze auto-přepínání (hotové jako návrh).
- Emoji v sandboxových screenshotech jsou černobílé (chybí font) – na telefonu barevné.
