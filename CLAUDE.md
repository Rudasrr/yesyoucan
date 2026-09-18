# YesYouCan · plán hubnutí · pravidla projektu (CLAUDE.md)

Webová aplikace pro jednoho klienta (Robert) a jednoho trenéra (vlastník projektu). Nahrazuje Excel `robert-plan_4_0.xlsx`.
Piš česky, stručně, tykej. Aktuální zadání je v `ZADANI.md`, stav a historie rozhodnutí ve `STAV.md`, návod k nasazení a používání v `NAVOD.md`.

## Struktura

```
src/            zdrojové části aplikace (skládají se do jednoho souboru)
build.py        složí src/* → out/index.html; čte env SUPABASE_URL a SUPABASE_KEY
out/index.html  výsledek buildu (negituje se, vyrábí ho GitHub Action)
tools/          testy: check.js (výpočty), ftest.py (funkční scénáře), qa.py (layout), shots.py (screenshoty + testovací data)
supabase-setup.sql  idempotentní schéma + RLS + seed (196 surovin, 200 receptů)
.github/workflows/deploy.yml  build + nasazení na GitHub Pages
```

Pořadí skládání (neměnit): style.css → seed.js → calc.js → store.js → app-core.js → views-client.js → views-coach.js → tasks.js → picker.js → dnes.js → training.js → recipes.js → extras.js.

## Pevná rozhodnutí (neměnit bez výslovného souhlasu vlastníka)

- Jeden `index.html` (HTML+CSS+JS, vanilla), žádný framework, žádný bundler. Knihovny z CDN jen při potřebě (Supabase JS, SheetJS). Grafy vlastní SVG.
- Terminologie je sjednocená (15. 9. 2026): klidový výdej · běžný výdej · cílený pohyb · celkový výdej · plánovaný deficit · dnešní deficit · limit dne · limit podle plánu · rezerva · spodní hranice jídla · cíl jídla · cíl chůze · tempo hubnutí. Slovník je ve `STAV.md` a v appce v Návodu. Nepiš „bazál“, „pojistka bazálu“, „cílový deficit“, „maximální příjem“, „plánovací limit“ ani „cíl chodu“ – pletly se.
- Výpočty v `calc.js` jsou 1:1 podle sešitu, kromě zdokumentovaných odchylek (STAV.md → „Odchylky od sešitu“). Změna výpočtu = změna zadání, nikdy vedlejší efekt.
- Offline-first: localStorage + fronta `outbox` + last-write-wins podle `updated_at`, soft-delete `deleted`. Id záznamů obsahují uid.
- Robert edituje výchozí suroviny/recepty jako vlastní verzi; trenér globálně. Tempo hubnutí mění jen trenér.
- Rytmus: `#main` je svislý flex s mezerou 14 px a vlastní okraje bloků se ruší – jedna mezera všude, žádné `margin-top` v inline stylech. Žádná tmavá tlačítka (`.chip.on` je modrá, ne inkoustová). Posuvníky jsou systémové s `accent-color`, ne vlastní `::-webkit-slider-*` – vlastní se v jiných prohlížečích rozpadaly.
- Rozvržení: obrazovka je **jeden dvousloupcový blok** (`.dgrid`, vlevo hlavní obsah, vpravo kratší karty), ne řada mřížek pod sebou – jinak vznikají díry. Nikdy nedávej do dvousloupcové mřížky jednu kartu. Karty se nenatahují do výšky sourozence (`.grid{align-items:start}`), dlaždice používají `auto-fit`, ne `auto-fill`. Pořadí karet dělá struktura, ne `order`. `qa.py` to hlídá: „díry v rozvržení: žádné“.
- Žádný tmavý režim, žádné foto jídla, žádný přepis do frameworku.
- Hesla, klíče ani e-maily nepatří do kódu. `CLOUD_CONFIG` plní build z env; `LOCAL_USERS` build v cloudové verzi vyprázdní. Lokální režim (prázdný `CLOUD_CONFIG`) slouží jen k vývoji a testům.

## Pracovní postup

1. Edituj jen `src/*`. Nikdy neupravuj `out/index.html` ručně.
2. Po každé změně: `python3 build.py && node tools/check.js`.
3. Před commitem: `python3 tools/ftest.py` a `python3 tools/qa.py` (Playwright, viz Setup). Cíl: „errors: none“, 0 přetečení, 0 prvků mimo viewport.
4. Commit malý a popsaný česky. Push na `main` = automatické nasazení (Action).
5. Když zjistíš chybu s dopadem, napiš: co bylo špatně → co platí → co to mění.

## Setup prostředí

```
pip install playwright && python3 -m playwright install chromium
python3 build.py
```

## Kontrolní čísla (referenční hodnoty pro `tools/check.js`, build ze 14. 9. 2026)

Test používá vzorový týden ze sešitu při průměrné váze 132,786 kg (příloha zaokrouhlena na 10 g – záměrná odchylka):

- Středa: chody 622,50 · 632,00 · 462,50 · 642,00 · 114,00 → **2 473,00 kcal**, 256,6 g bílkovin (cíl 180), „zbývá 72 kcal“, chůze 65 min = 423 kcal, deficit 1 094 kcal = 0,99 kg/týden
- Pátek (6 piv + 200 g smaženého): 1 890,0 kcal, přes limit o 1 155 kcal, pití 1 810 kcal
- Přehled: průměr 7 dní 132,786 · prognóza **14. 5. 2027** · ohlédnutí 0,71 vs. 0,93 kg · odchylka od plánu −0,13 kg · fáze 1
- Úterý 2 472,60 kcal / 117,7 g / cíl 88 g · Sobota 1 413,70 kcal („málo jídla“) · Pondělí 2 501,60 kcal

Pokud se některé číslo změní a změna nebyla cílem úkolu, zastav se a ohlas to. Poznámka: STAV.md uvádí pro středu 2 511,75 kcal (hodnota před zaokrouhlením příloh na 10 g; bez zaokrouhlení dnes vychází 2 503,34 – rozdíl ~8 kcal **k ověření**, viz ZADANI úkol 0).

## Co nedělat

- Nepřidávat závislosti, build kroky ani konfigurační soubory nad rámec ZADANI.md.
- Nepsat do `STAV.md` / `NAVOD.md` bez pokynu; při aktualizaci připrav celý dokument.
- Neměnit texty pro Roberta na formální tón; appka mu tyká, mluví krátce a konkrétně.
