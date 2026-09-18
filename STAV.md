# YesYouCan (dřív „Robert – plán“) · stavový dokument (15. 9. 2026, po nasazení v5.3)

## Kde to běží
- **Appka:** https://rudasrr.github.io/yesyoucan/ (GitHub Pages, nasazuje Action při pushi na `main`)
- **Repozitář:** https://github.com/Rudasrr/yesyoucan (veřejný; `out/` se negituje, vyrábí ho Action)
- **Databáze a účty:** Supabase projekt `GPT-Codex-app-lab`, ref `reizexthhcyemkpplvmt`, eu-central-1
- **Tajemství:** `~/.yesyoucan.env` na Rudově Macu (hesla účtů, service-role klíč, UID). V repu nic z toho není, adresa a anon klíč jdou do buildu z GitHub Secrets `SUPABASE_URL` / `SUPABASE_KEY`.
- Postup nasazení, účty a provoz jsou v `NAVOD.md` části A.

## Jak navázat
- **V Claude Code:** otevři repozitář (`yesyoucan`), pravidla jsou v `CLAUDE.md`, úkoly v `ZADANI.md`. Edituj jen `src/*`; `python3 build.py` složí `out/index.html`; testy v `tools/`.
- **V chatu:** nahraj `STAV.md` a `out/index.html` (případně `src/` jako zip) a napiš: „Navazuji na projekt YesYouCan, stav je v STAV.md.“
- Struktura repa: `src/` (moduly, pořadí skládání v CLAUDE.md, navíc `sw.js`, `logo.png`, `icon-180/192/512.png`, `manifest.webmanifest`) · `build.py` (čte env `SUPABASE_URL`, `SUPABASE_KEY`; v cloudové verzi vyprázdní `LOCAL_USERS`, doplní hash cache do `sw.js`, kopíruje ikony a manifest do `out/`) · `tools/` (check.js, ftest.py, qa.py, shots.py, cloudtest.py) · `supabase-setup.sql` · `.github/workflows/deploy.yml`.

## Cíl
Webová appka pro jednoho klienta (Robert, start 134,4 kg → 102 kg, 0,7 % váhy/týden) a jednoho trenéra (Ruda). Nahrazuje Excel `robert-plan_4_0.xlsx`; výpočty 1:1 podle sešitu. Robert musí být plánem veden, ne vymýšlet; trenér do 10 minut denně.

## Technika (rozhodnuto, neměnit)
- Jeden `index.html` (HTML+CSS+JS, vanilla), GitHub Pages. Knihovny z CDN jen při potřebě (Supabase JS, SheetJS). Grafy vlastní SVG.
- Supabase: `CLOUD_CONFIG = { url, key }` plní build ze Secrets. Prázdné → režim „bez cloudu“ (localStorage) s lokálním přihlášením `LOCAL_USERS`; ten je jen pro vývoj, v nasazené verzi je `LOCAL_USERS = {}` a žádné heslo v souboru není.
- Přihlášení: **jedna obrazovka pro všechny** (e-mail + heslo), roli určuje `profiles`. Odkaz „Přihlásit se jako trenér“ a PIN trenéra byly odstraněny 15. 9. – odkaz jen předvyplňoval trenérův e-mail, a tím ho ukazoval Robertovi na veřejné adrese. Přepínač klientů v hlavičce se objeví, jakmile má trenér víc než jednoho klienta; jméno bere z `profiles.name`.
- Minimální délka hesla v Supabase projektu je 6 znaků (snížena z 12 na přání vlastníka; Supabase pod 6 nejde). Pozor: platí pro celý projekt, tedy i pro druhou appku.
- Offline-first: localStorage + fronta + last-write-wins podle `updated_at`, soft-delete `deleted`. Tabulky (vše `id text, user_id uuid, data jsonb, updated_at text, deleted bool`): `profiles`, `settings`, `foods`, `recipes`, `measurements`, `days`, `week_plans`, `shopping`, `prefs`, `training`. Id záznamů obsahují uid (`d:<uid>:<date>`, `m:…`, `w:…`, `p:<uid>:main`, `tp:<uid>:<id>`, `to:<uid>:<date>`, `note:<uid>:<date>`).
- **Service worker** (`src/sw.js`): cache-first na `./` a `./index.html`, network-first se zálohou v cache na ostatní vlastní soubory, cizí origin (CDN, Supabase API) se necachuje. Verze cache = hash `index.html`, staré cache mizí v `activate`. Nová verze ohlásí „Nová verze – obnovit“. Registruje se jen mimo `file:` (testy běží z file://).
- **Vzhled (15. 9. 2026):** barvy podle loga – modrá `#1478d4` hlavní, červená `#c81f2b` důraz a chyby, tmavý obrys `#101828` text. Barevné přechody z prvků pryč (tlačítka, karty, hrdinská čísla, chipy, pruhy i grafy jsou plné barvy). Plochy jsou skleněné: průsvit + `backdrop-filter: blur(28px) saturate(1.7)` + světlá hrana nahoře (`--hl`). Záměrně zůstaly dvě věci: tlumený barevný podklad na `body` (bez něj nemá sklo co rozostřovat) a šrafování v pruhu „naplánováno“ (rozlišuje snědeno od naplánovaného, není to barevný přechod).
- PWA: `manifest.webmanifest` se `start_url`/`scope` = `./`, ikony `icon-192.png` / `icon-512.png`, pro iOS `icon-180.png`. Logo (`logo.png`, průhledné) je v hlavičce a na přihlašovací obrazovce. Zdroj loga je rastr, proto ikony vznikly jednorázově a leží v `src/` – build je jen kopíruje.

## Schéma a RLS (supabase-setup.sql)
- Idempotentní: tabulky `create if not exists`, politiky `drop + create`, seed `on conflict do nothing` (196 surovin, 200 receptů s **týmiž id jako lokální seed** – proto nevznikají duplicity).
- `updated_at` je **text** s ISO řetězcem z prohlížeče. Kdyby to byl `timestamptz`, PostgREST ho vrací jako `+00:00`, klient si ho lokálně drží jako `Z` a porovnává řetězcem – last-write-wins by se v rámci jedné sekundy pletl.
- RLS: klient čte a píše svoje (`user_id = auth.uid()`); globální řádky (`user_id is null`) čtou všichni a píše je jen trenér; trenér čte řádky svých klientů a píše jim `settings` a `training`. Politiky nad `profiles` jdou přes `security definer` funkce `my_role()` / `is_my_client()` – jinak Postgres hlásí nekonečnou rekurzi. Appka nemaže natvrdo, takže stačí politiky select/insert/update (upsert potřebuje obě zápisové).

## Klíčové výpočty (calc.js)
- BMR Mifflin–St Jeor; výdej = BMR × faktor aktivity (1,34) + chůze (MET podle km/h) + trénink (MET); deficit = váha × tempo % × 7700/7 (pevný); limit dne = výdej − deficit; **plánovací limit** dne = výdej s plánovanou chůzí a tréninkem − deficit.
- **Slovník (platí v kódu i v textech pro Roberta, sjednoceno 15. 9. 2026):** klidový výdej (BMR, Mifflin–St Jeor) · běžný výdej (klidový × 1,34) · cílený pohyb (chůze + trénink) · celkový výdej (běžný + cílený pohyb) · příjem · **plánovaný deficit** (váha × tempo % × 7700/7, pevný) · **dnešní deficit** (celkový výdej − příjem) · **limit dne** (celkový výdej − plánovaný deficit) · **limit podle plánu** (totéž s naplánovanou chůzí a tréninkem; podle něj se škálují porce) · rezerva (limit dne − příjem) · **spodní hranice jídla** (limit nikdy pod klidový výdej) · cíl jídla · cíl chůze · tempo hubnutí. Slova „bazál“, „pojistka bazálu“, „cílový deficit“, „maximální příjem“, „plánovací limit“ a „cíl chodu“ se už nepoužívají – pletly se.
- **Pojistka bazálu** (odchylka od sešitu, rozhodnuto): limit nikdy pod BMR; appka řekne, kolik minut chůze chybí.
- Cíl chodu = cíl z Nastavení × limit/2450; škáluje se jen příloha (flag), faktor 0,3–1,6, příloha zaokrouhlena na 10 g (sešit 5 g – odchylka). Pivo 205 kcal/0,5 l, smažené 2,9 kcal/g, min. 600 kcal na jídlo.
- Průměr 7 vážení; plánovaná křivka; prognóza; plán proti realitě 75 %.
- **Trénink (přepracováno 15.–16. 9. 2026):** knihovna cviků je datová – výchozích 38 v `EX_LIB`, trenérovy úpravy a nové cviky jako globální řádky `exg:<slug>`, klientovy vlastní `ex:<uid>:<slug>`; hledání, filtr silové/kardio, ★ oblíbené v `prefs.exFavs`. Uložené tréninky (šablony) `twg:<id>` / `tw:<uid>:<id>` se vkládají do dne šablony i do jednorázové změny na datum. Robert cvičí přes „▶︎ Začít cvičit“: série po sérii, po každé běží pauza (`rest` u cviku, jinak `settings.rest_sec`, výchozí 90 s) s +30 s a ukončením dřív; u každé série zapíše opakování a zátěž. Po dokončení nebo předčasném ukončení uvidí souhrn (cviky, série, objem v kg, kcal), pochvalu podle podílu splněných sérií, a zapíše poznámku, náročnost 1–5 a pocit. Vše jde do `days.training = { done, log:{i:{sets:[{reps,kg,at}]}}, started, finished, rpe, feel, note }` – trenér to vidí u každého cviku i v souhrnu. **Rozdělaný cvik se do kalorií dne nepočítá** (počítá se až celý) a appka to Robertovi říká.
- Trénink: položky s MET (kardio dle cviku; silové lehce/středně/těžce 3/4,5/6; 1,6 min na sérii). Splněné položky zvedají skutečný limit; plánované zvedají plánovací limit → recepty, Týden, Nákup, Vaření se přepočítají samy.
- Běžná chůze (kroky, výchozí 5 000) se do limitu ani cíle chůze nepočítá; slouží trenérovi + doporučení faktoru aktivity (<3 000 → 1,2 … >8 500 → 1,48).

## Obrazovky
**Robert:** Dnes (karta „Teď“ – jeden krok; Plán dne proti limitu = rezerva; ukazatel snědeno/naplánováno; Aktivita s +15/+30/+60, trénink k odškrtnutí, kroky; Úkoly dne; Jídla dne dole – výběrový panel s Hledat/Řadit/Filtr a „co se vejde“, 💡 jiné, suroviny vyměnit/odebrat/přidat, „co jsem snědl“ u jídla podle situace, domácí míry ⚖️🥄✋; poznámka trenérovi; kontrola dne) · Týden (jen tento/příští, 7 dní vedle sebe, 💡 Naplánuj mi týden s rutinou, výzvy „přidat/ubrat kcal“ + Dorovnat) · Přehled · Měření (kontrola věrohodnosti ±2 kg) · Nákup (po porcích) · Vaření (podle receptů s 🍱 uvařeno / podle dnů) · Recepty (řádkový seznam, editor s cíli, moje verze výchozích) · Suroviny (kategorie, moje verze, vlastní) · Návod (dlaždice, „Jak jíst bez váhy“, Moje nádoby) · Účet (připomínky .ics, nádoby, kroky, export, záloha).
**Trenér:** Dashboard (tichý: 🟢🟡🔴, věta, návrh vzkazu, co se stalo od minula, tempo cíl/plán/realita, doporučení; Detail) · Zpráva (týdenní, kopírovat/poslat) · Trénink (plány Po–Ne, knihovna 38 cviků, kalorie, limit jídla dne vs. Robertův plán, varování, progres, výjimka dne) · Nastavení (s doporučeními a tlačítky) · Databáze/Recepty/Suroviny (globální editace) · 👁️ Pohled Roberta (náhled).
Den se ukládá průběžně, o půlnoci se uzavře sám; každá změna má hlášku + Zpět.

## Cheat na dnešek (nové 18. 9. 2026, změna výpočtu)
Robert zapíše ráno, co ho večer čeká (piva, smažené, volný text). Appka to počítá do dne jako **plán, ne zápis** – nic se večer nepotvrzuje jako snědené. Klíčová změna: **cheat se přednostně pokrývá pohybem, ne menšími porcemi.** Když se cheat dá uchodit do 90 minut navíc, `calcBase` o tolik zvedne plánovanou chůzi a porce zůstanou. Když ne, appka nepředstírá, že to jde: přidá rozumných 30 minut, zmenší porce a řekne narovinu, že tenhle den něco stojí a kolik (kg za týden proti plánu). U dvou piv (410 kcal) to znamená +64 minut chůze a porce zůstanou; u 6 piv a 200 g smaženého se pokryje 586 kcal a zbytek padne na porce. Volný text nejdřív hledá v `CHEAT_LIB` (18 typických hříchů s kcal za porci), pak v surovinách, a co appka nezná, si Robert odhadne v okně. Kontrolní číslo pátku (1 890,0 kcal) se nezměnilo – porce tam drží spodní mez.

## Odchylky od sešitu (záměrné)
Nákup škálovaný na aktuální váhu · datované týdny · pojistka bazálu · příloha na 10 g · „kolik co stojí“ počítáno živě (statické hodnoty v sešitu si nesedí) · start 134,4 (texty říkaly 129) · tolerance „sedí“ ±60 kcal v UI.

## Rozhodnutí Rudy (platí)
Robert edituje výchozí suroviny/recepty jako vlastní verzi · hlavní číslo dne = rezerva plánu · hvězdičky + záložka Oblíbené · pojistka bazálu ano · vláknina ne · trénink jako týdenní šablona + výjimky · Robert potvrzuje položky tréninku · tempo mění jen trenér · odměrky ano (nádoby: lžička 5, lžíce 15, hrnek 250, sklenice 300, naběračka 120 ml, odměrka 30 g) · rutina v generátoru výchozí zapnutá · žádný tmavý režim, žádné foto jídla, žádný přepis do frameworku · repozitář veřejný, klíče přes Secrets · push notifikace do Později.

## Kontrola kvality (jak testovat)
`tools/check.js` (výpočty, referenční čísla v CLAUDE.md) · `tools/ftest.py` (funkční scénáře) · `tools/qa.py` (3 šířky × všechny obrazovky: přetečení, prvky mimo viewport, **rolování do strany na 390 px**, **díry v rozvržení** (mřížka s prázdnými sloupci, karta natažená do prázdna) – legitimní jsou jen tři datové tabulky (Přehled, Měření, Suroviny), kontrast, písmo <11 px, klikací průchod) · **`tools/cloudtest.py`** (dva prohlížeče proti nasazené adrese a ostré databázi; přihlášení čte z `~/.yesyoucan.env`, testovací data po sobě maže). Princip zbytku: Playwright headless, `localLogin('client'|'coach')`, testovací data ze `SEED.sample_week` a `SEED.measurements`.

**Poslední stav (15. 9. 2026):** check.js referenční čísla sedí · ftest bez chyby · qa 292 interakcí, 0 přetečení · cloudtest `errors: none` (7 scénářů, žádná chyba RLS) · service worker ověřen i na ostré adrese (offline otevření funguje) · nasazený soubor neobsahuje `mamnato` a `LOCAL_USERS` je prázdné.

**Robertovo první otevření ověřeno** (telefonní šířka, čistý prohlížeč, prázdná databáze): přistane na Dnes, karta „Teď“ ho pošle na váhu, jídla dne jsou předvybraná z globálních receptů, všech 10 obrazovek se vykreslí, žádná chyba ani hláška ze syncu. Databáze je po všech testech čistá: 196 surovin, 200 receptů, 2 profily, nic jiného.

## Vyřešeno 15. 9. 2026
- **Rozdíl 2 511,75 vs. 2 473,00 kcal (středa vzorového týdne)** je jen zaokrouhlení přílohy, nic jiného. Základ dne je v obou případech stejný (bazál 2 346,61 · výdej s plánovanou chůzí 3 534,84 · deficit 1 022,45 · plánovací limit 2 512,39; pojistka bazálu se nezapíná, trénink žádný). Při zaokrouhlení na 5 g (sešit) vyjde přesně 2 511,75, bez zaokrouhlení 2 503,34, na 10 g 2 473,00. Napříč vzorovým týdnem není 10 g systematicky níž (Po +7,75 · Út +12,00 · **St −38,75** · Čt −0,25 · Pá −10,75 · So +56,50 · Ne +56,50, týden celkem +83 kcal) – středa je nejhorší den ze sedmi. **Otevřené rozhodnutí pro Rudu:** nechat 10 g, vrátit 5 g, nebo zaokrouhlovat dolů.

## Otevřené věci / NEXT
- **NEXT: týden reálných dat od Roberta, pak kontrola měr a parseru** (plátek 20 g, hustoty, „co jsem snědl“, generátor týdne).
- **Čeká na Rudu:** poslat Robertovi adresu a dočasné heslo + tři věty z `NAVOD.md` A7; změnit si vlastní heslo přes „Zapomenuté heslo“.
- **Sdílený Supabase projekt:** free plán pouští 2 aktivní projekty na člověka, oba byly obsazené, takže appka sedí ve stávajícím projektu `GPT-Codex-app-lab`. Tabulky jsou vlastní, ale účty a API klíče se sdílí s druhou appkou (a v projektu zůstává její tabulka `notes`). Až bude místo, jde to přestěhovat podle NAVOD A3.
- Zvážit rozhodnutí o zaokrouhlení přílohy (viz výše).
- Později: web push (Edge Function; iOS jen pro PWA, ~1 den) · onboarding při prvním otevření · zkrácená URL `#ted` · widget · fáze chůze auto-přepínání (hotové jako návrh) · více klientů (netestováno).
- Emoji v sandboxových screenshotech jsou černobílé (chybí font) – na telefonu barevné.
