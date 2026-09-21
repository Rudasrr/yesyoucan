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
- **Verze vestavěných dat** (`SEED.version`): když se změní jména surovin nebo přibude pole, musí se zvednout. Přirůstkový pull stahuje jen řádky novější než poslední sync, takže oprava globálních dat se ke klientovi jinak nedostane. Při změně verze `Store.refreshSeed()` zahodí stažené globální řádky a vynutí plný pull. Při zápisu globálních dat do Supabase použij `updated_at` = teď, ne datum vydaní.
- **Tolerance dne** (`dayTol`): 2 % limitu, nejméně 40 a nejvýše 70 kcal. Porce se zaokrouhlují na 10 g, takže i dokonalý den se přes pět chodů rozejde o desítky kcal – hlásit to červeně je šum. Používá se stejně v kontrole dne i ve stavu dne v Týdnu.
- Offline-first: localStorage + fronta `outbox` + last-write-wins podle `updated_at`, soft-delete `deleted`. Id záznamů obsahují uid.
- Robert edituje výchozí suroviny/recepty jako vlastní verzi; trenér globálně. Tempo hubnutí mění jen trenér.
- **Stav surovin (18. 9. 2026):** surovina se eviduje v tom stavu, v jakém se kupuje – rýže, těstoviny a luštěniny suché, maso syrové, pečivo upečené, konzerva po odkapání. Míchat vařené a syrové v jednom receptu je chyba (nákup i vaření pak hlásí skoro trojnásobek). Suroviny, které vařením mění hmotnost, mají `yld` (výtěžnost, kolikrát ztěžknou). Z ní se počítá hmotnost na talíři, domácí míry a odhad hotové dávky. Kalorie a makra jsou vždy na 100 g nákupního stavu.
- Zaokrouhlení škálované přílohy na 10 g se dělá **v hmotnosti na talíři**, ne v suché surovině (`roundPortion(g, scale, food)`) – jinak by jeden krok znamenal skoro 30 g rýže.
- Domácí míry jsou **vstupní a zobrazovací vrstva, nikdy úložiště**. Zadat se dá v hrncích i gramech, uloží se gramy. Kdyby recept ukládal „2 hrnky“, přeměření hrnku by tiše změnilo kalorie a trenérův recept by u každého znamenal jiné jídlo.
- **Spíž** eviduje jen trvanlivé suroviny a jen ve třech stavech (mám / dochází / nemám), žádné gramy. Účelem není inventura, ale vědět, co nedávat na nákupní lístek. Čerstvé suroviny se neevidují. Stav se odvozuje z odškrtnutí v Nákupu a z týdenní spotřeby.
- **Vaření je záznam, ne zaškrtávátko**: kdy, co, kolik porcí a které sloty (den + chod) pokrývá. Z toho plynou zbytky v lednici. Vaří se na libovolné dny, ne na kalendářní týden. Trvanlivost: maso a ryby 3 dny, zelenina a mléčné 4, suché 5 – nad to appka posílá do mrazáku.
- **Udržovací týden** (`settings.maint_weeks`, pole pondělků): deficit nula, limit na celkovém výdeji. Zařazuje ho trenér po šesti až deseti týdnech deficitu. Nepřetržitý deficit na celé hubnutí není plán, který jde dojít.
- Nová data přidávají ke každé surovině `aisle` (regál v obchodě) a u trvanlivých `pack` + `pantry`.
- **Plán vs. plnění:** trenér plánuje (cíl chůze, kroky, tréninkový plán, tempo, nastavení), Robert **jen hlásí, co se opravdu stalo** – ušlé minuty, kroky, snědená jídla, odcvičené série, váha. Robert plánuje jen dvě věci: jídla na další dny (Týden) a cheat na večer. Ovládací prvek musí odpovídat roli: cíl se nastavuje jednou, plnění se přičítá tlačítky nebo zapisuje číslem – **posuvník na plnění nepatří**, vypadá jako nastavení cíle. Nikdy neukazuj cílovou hodnotu jako by ji Robert splnil (kroky se do 18. 9. 2026 předvyplňovaly cílem a trenér podle vymyšlených čísel ladil faktor aktivity).
- **Vzhled: světlo a sklo, nic tmavého.** Karty, dlaždice, toast i aktivní položka menu jsou prosklené v barevném nádechu (`--gl-*`), ne plné barvy. Tmavé plochy (`--grad3` jako pozadí) se nepoužívají. Text se nehromadí – co se dá říct grafikou nebo ovládacím prvkem, se tak řekne, a dlouhé vysvětlení patří pod ⓘ, ne do odstavce pod nadpis.
- **Každé zadané číslo má meze** (`omez()` v calc.js) a když je mimo, appka to řekne a uloží nejbližší povolenou hodnotu: chůze 0–600 min, gramy 0–5 000, piva 0–40, smažené 0–3 000 g, váha 30–400 kg; u trenéra výška 120–230, věk 15–100, bílkoviny 60–400, tempo 0,3–1,2 %. Bez toho stačilo napsat 5 000 minut chůze a limit dne vyskočil na 34 000 kcal.
- **Desetinná pole jsou `type="text"` s `inputmode="decimal"`** a čárka se čte jako tečka (`cislo()`). `type="number"` čárku z české klávesnice tiše zahodí a Robertovi se nic neuloží.
- Skloňování po číslovce dělá `sklon()` / `DEN()` – nikdy natvrdo „2 dnů“.
- **Běžná chůze (kroky) je cíl trenéra, ne informace navíc.** `settings.steps_goal` (výchozí 5 000) nastavuje trenér v Plánu a cílech vedle cíle chůze v minutách. Faktor běžného výdeje je totéž číslo z druhé strany – když trenér změní cíl kroků a faktor nechá, appka faktor dopočítá (`factorForSteps`), aby limit jídla i deficit opravdu vycházely z jeho cíle. Robert kroky **zapisuje večer** (úkol ve 20:00), nikdy se nepředvyplňují cílem. Nad cíl dostane pochvalu, pod cíl konkrétní cenu: kolik kcal uteklo a kolik kg za týden to ubere (`stepsMiss`). Trenér vidí zapsané kroky proti cíli v tabulce dnů a v upozorněních.
- Cheat v hláškách se jmenuje **cheat** a vypíše, co v něm je (`cheatPopis`) – dřív se všechno paušálně jmenovalo „pití“, i když to byl řízek.
- Rytmus: `#main` je svislý flex s mezerou 14 px a vlastní okraje bloků se ruší – jedna mezera všude, žádné `margin-top` v inline stylech. Žádná tmavá tlačítka (`.chip.on` je modrá, ne inkoustová). Posuvníky jsou systémové s `accent-color`, ne vlastní `::-webkit-slider-*` – vlastní se v jiných prohlížečích rozpadaly.
- Menu: klient má nahoře čtyři denní obrazovky (Dnes, Týden, Jídlo, Měření), databáze a návod jsou pod Více. Trenér má pět svých obrazovek, Robertovy pod Více – dvanáct položek se lámalo do dvou řad a překrývalo obsah.
- **Dlaždice dne odpovídá na jedinou otázku: kolik ještě můžu sníst.** Velké číslo je `limit − snědené`, ne rezerva plánu – to je plánovací číslo a patří dolů mezi dlaždice (`rezerva plánu`). Barva karty jde za velkým číslem, ne za plánem: červená vedle „zbývá sníst 1 560“ by si odporovala.
- **Cheat se vybírá ze seznamu s hledáním** (`openCheatPicker`), ne z volného textu. Zdroj: typické porce + kategorie Pozor + Mimo dům. U každé položky je porce, kalorie, **stupeň** a cena v minutách chůze. Stupeň se počítá z podílu na limitu dne, ne z absolutních kalorií: do 10 % **lehký**, do 25 % **střední**, do 40 % **těžký**, víc **extrémní**. Samotný název stupně nic neřekne, proto se vedle něj vždycky ukazuje, kolik minut chůze to stojí.
- Večer má Robert dva úkoly navíc: zapsat běžnou chůzi (20:00) a **projít a uzavřít den** (20:30, `A.closeDay`). Bez uzavření den jen tichě uplyne a Robert se nedozví, jak dopadl.
- **Pruh pod ním je den po jídlech, ne jeden součet** (`.mbar`): každý chod je vlastní díl široký podle svých kalorií, plný když je snědený, šrafovaný když teprve přijde, cheat zvlášť. Díl nese emoji chodu a dá se na něj kliknout. Svislý sloupec se nepoužívá – appka je jeden svislý sloupec karet a teploměr by ho rozbil.
- ☉ není sklad na všechno: co člověk potřebuje při pohledu na obrazovku, musí být vidět (třeba „váha · průměr 7 vážení“ patří do popisku dlaždice, ne do tooltipu). Pod ☉ patří vzorec a proč, ne to, co uživatel potřebuje teď.
- Rozvržení: **jeden sloupec karet na celou šířku**, vycentrovaný (`#main{max-width:1060px}`), karty jdou pod sebou v pořadí podle důležitosti. Žádné dvousloupcové bloky vedle sebe – vždycky z nich dole zbyde nerovný okraj. Uvnitř karty smí být mřížka (dlaždice, kontroly), ta se `auto-fit` roztáhne. Seznamy mnoha krátkých karet (Nákup, Vaření) používají `.masonry` (sloupcová sazba) – obsah se rozlije a díra nevznikne. Dvousloupcová `.grid g2` zůstává jen pro krátká pole formuláře, nikdy pro karty. Pořadí karet dělá struktura, ne `order`. Pořadí na Dnes: Teď → přehled dne (včetně kontroly) → úkoly → **aktivita** → jídla → **cheat** → poznámka. Aktivita a chůze stojí výš než cheat – rozhodují každý den, cheat ne. Cheat je jídlo navíc za druhou večeří, ale nesmí s jídly splynout: má jantarový nádech a levý proužek (`.cheatcard`). `qa.py` hlídá „díry v rozvržení: žádné“.
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

Test používá vzorový týden ze sešitu při průměrné váze 132,786 kg (příloha zaokrouhlena na 10 g hmotnosti na talíři – záměrná odchylka). Převod na suché gramy (18. 9. 2026) tato čísla **nezměnil ani o setinu** – to je zároveň test správnosti převodu:

- Středa: chody 622,50 · 632,00 · 462,50 · 642,00 · 114,00 → **2 473,00 kcal**, 256,6 g bílkovin (cíl 180), „zbývá 72 kcal“, chůze 65 min = 423 kcal, deficit 1 094 kcal = 0,99 kg/týden
- Pátek (6 piv + 200 g smaženého): 1 890,0 kcal, přes limit o 1 155 kcal, pití 1 810 kcal
- Přehled: průměr 7 dní 132,786 · prognóza **14. 5. 2027** · ohlédnutí 0,71 vs. 0,93 kg · odchylka od plánu −0,13 kg · fáze 1
- Úterý 2 472,60 kcal / 117,7 g / cíl 88 g · Sobota 1 413,70 kcal („málo jídla“) · Pondělí 2 501,60 kcal

Pokud se některé číslo změní a změna nebyla cílem úkolu, zastav se a ohlas to. Poznámka: STAV.md uvádí pro středu 2 511,75 kcal (hodnota před zaokrouhlením příloh na 10 g; bez zaokrouhlení dnes vychází 2 503,34 – rozdíl ~8 kcal **k ověření**, viz ZADANI úkol 0).

## Co nedělat

- Nepřidávat závislosti, build kroky ani konfigurační soubory nad rámec ZADANI.md.
- Nepsat do `STAV.md` / `NAVOD.md` bez pokynu; při aktualizaci připrav celý dokument.
- Neměnit texty pro Roberta na formální tón; appka mu tyká, mluví krátce a konkrétně.
