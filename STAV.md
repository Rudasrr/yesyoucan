# YesYouCan · stavový dokument (29. 9. 2026, po přestavbě rozhraní)

## Kde to běží
- **Appka:** https://rudasrr.github.io/yesyoucan/ (GitHub Pages, nasazuje Action při pushi na `main`)
- **Repozitář:** https://github.com/Rudasrr/yesyoucan (veřejný; `out/` se negituje, vyrábí ho Action)
- **Databáze a účty:** Supabase projekt `GPT-Codex-app-lab`, ref `reizexthhcyemkpplvmt`, eu-central-1
- **Tajemství:** `~/.yesyoucan.env` na Rudově Macu (hesla účtů, service-role klíč, UID). V repu nic z toho není, adresa a anon klíč jdou do buildu z GitHub Secrets `SUPABASE_URL` / `SUPABASE_KEY`.
- Postup nasazení, účty a provoz jsou v `NAVOD.md` části A.

## Jak navázat
- **V Claude Code:** otevři repozitář, pravidla jsou v `CLAUDE.md` (načte se samo), tenhle dokument je stav. Edituj jen `src/*`; `python3 build.py` složí `out/index.html`; testy v `tools/`.
- **Pracovní smyčka:** `python3 build.py && node tools/check.js` po každé změně · `python3 tools/ftest.py` a `python3 tools/qa.py` před commitem · `python3 tools/cloudtest.py` proti ostré databázi. Cíl: kontrolní čísla z `CLAUDE.md` beze změny, `errors: none`, „díry v rozvržení: žádné“.
- **Pozor – repozitář leží na Google Drivu** (`/CloudStorage/GoogleDrive-…/Můj disk/AI_lab_MacMini/robert-plan-repo`). 25. 9. 2026 se kvůli tomu rozbil git (chybějící objekty, neplatný reflog); opraveno čistým klonem z GitHubu, pracovní soubory byly v pořádku. **Doporučení: přesunout projekt mimo Drive** (třeba `~/Projekty/yesyoucan`). Zálohy z opravy jsou v `~/yesyoucan-zalohy/`.
- Struktura repa: `src/` (moduly, pořadí skládání v CLAUDE.md, navíc `sw.js`, `logo.png`, ikony, `manifest.webmanifest`) · `build.py` · `tools/` (check.js, ftest.py, qa.py, shots.py, cloudtest.py) · `supabase-setup.sql` · `.github/workflows/deploy.yml`.

## Cíl
Webová appka pro jednoho klienta (Robert, start 134,4 kg → 102 kg, 0,7 % váhy/týden) a jednoho trenéra (Ruda). Nahrazuje Excel `robert-plan_4_0.xlsx`; výpočty 1:1 podle sešitu. Robert musí být plánem veden, ne vymýšlet; trenér do 10 minut denně.

## Technika (rozhodnuto, neměnit)
- Jeden `index.html` (HTML+CSS+JS, vanilla), GitHub Pages. Knihovny z CDN jen při potřebě (Supabase JS, SheetJS). Grafy vlastní SVG.
- Supabase: `CLOUD_CONFIG = { url, key }` plní build ze Secrets. Prázdné → režim „bez cloudu“ (localStorage) s `LOCAL_USERS`; ten je jen pro vývoj, v nasazené verzi prázdný.
- Přihlášení: jedna obrazovka pro všechny, roli určuje `profiles`. Minimální délka hesla v projektu je 6 znaků (platí i pro druhou appku ve stejném projektu).
- Offline-first: localStorage + fronta `outbox` + last-write-wins podle `updated_at`, soft-delete `deleted`. Tabulky (vše `id text, user_id uuid, data jsonb, updated_at text, deleted bool`): `profiles`, `settings`, `foods`, `recipes`, `measurements`, `days`, `week_plans`, `shopping`, `prefs`, `training`.
- **Service worker** (`src/sw.js`): network-first s 2,5s timeoutem a zálohou v cache, cizí origin se necachuje. Verze cache = hash `index.html`.
- PWA: `manifest.webmanifest`, ikony 180/192/512, logo v hlavičce i na přihlášení.

## Schéma a RLS (supabase-setup.sql)
- Idempotentní: tabulky `create if not exists`, politiky `drop + create`. Seed je **214 surovin a 200 receptů** a nově se řádek **přepíše, jen když je v databázi starší než seed** (`on conflict do update … where updated_at < excluded.updated_at`) – dřív `do nothing`, takže se oprava globálních dat do už založené databáze nedostala.
- `updated_at` je **text** s ISO řetězcem z prohlížeče (kvůli porovnání řetězcem v last-write-wins).
- RLS: klient čte a píše svoje; globální řádky (`user_id is null`) čtou všichni a píše je **jen trenér**; trenér čte řádky svých klientů a píše jim `settings`, `days`, `week_plans`, `training`. Politiky nad `profiles` jdou přes `security definer` funkce `my_role()` / `is_my_client()`.
- **Klient nikdy nesmí zapisovat globální řádky.** Dvakrát se to stalo omylem (trenér do `prefs` klienta, klient do globálních `recipes` při migraci) a RLS to odmítla – viz „Synchronizace“ níž.

## Klíčové výpočty (calc.js)
- BMR Mifflin–St Jeor; celkový výdej = klidový × faktor běžného výdeje (1,34) + cílený pohyb (chůze MET + trénink MET); plánovaný deficit = váha × tempo % × 7700/7; limit dne = celkový výdej − deficit; limit podle plánu = totéž s naplánovanou chůzí a tréninkem.
- **Slovník** (platí v kódu i v textech): klidový výdej · běžný výdej · cílený pohyb · celkový výdej · plánovaný deficit · dnešní deficit · limit dne · limit podle plánu · rezerva · spodní hranice jídla · cíl jídla · cíl chůze · tempo hubnutí. Zakázaná slova jsou v CLAUDE.md.
- **Spodní hranice jídla** (odchylka od sešitu): limit nikdy pod klidový výdej.
- **Nákupní stav surovin (18. 9. 2026, velká změna):** surovina se eviduje tak, jak se kupuje – rýže a luštěniny suché, maso syrové, pečivo upečené. 17 příloh a luštěnin převedeno (Rýže 351 kcal místo „Rýže vařená“ 130), každá nese `yld` (výtěžnost). Gramy ve všech 200 receptech byly vyděleny stejným číslem, takže **kalorie jídel se nezměnily ani o setinu** – to je zároveň test správnosti převodu.
- **Zaokrouhlení škálované přílohy na 10 g se dělá v hmotnosti na talíři**, ne v suché surovině (`roundPortion(g, scale, food)`).
- **Tolerance dne** (`dayTol`): 2 % limitu, min 40, max 70 kcal (u Roberta 50). Porce se zaokrouhlují na 10 g, takže i dokonalý den se přes pět chodů rozejde o desítky kcal. Platí stejně v kontrole dne i ve stavu dne v Týdnu.
- **Běžná chůze (kroky)** je cíl trenéra (`settings.steps_goal`, výchozí 5 000), ne informace navíc. Faktor běžného výdeje je totéž číslo z druhé strany – při změně cíle se dopočítá (`factorForSteps`). Robert kroky zapisuje večer; nad cíl pochvala, pod cíl konkrétní cena (`stepsMiss`: kolik kcal a kolik kg za týden).
- **Udržovací týden** (`settings.maint_weeks`): deficit nula, limit na celkovém výdeji. Zařazuje trenér po 6–10 týdnech.
- **Cheat** se přednostně pokrývá pohybem, ne menšími porcemi; když se uchodit nedá, appka to řekne narovinu. Vybírá se ze seznamu s hledáním (`openCheatPicker`, 59 položek: typické porce + kategorie Pozor + Mimo dům), u každé je porce, kalorie, **stupeň** a cena v minutách chůze. Stupeň z podílu na limitu dne: do 10 % lehký, 25 % střední, 40 % těžký, výš extrémní.
- **Jídlo mimo dům:** 18 položek v kategorii „Mimo dům“. Chod „vyřeším podle situace“ se zapsaným jídlem počítá **skutečnost, ne cíl chodu**.
- Trénink: knihovna cviků datová, uložené tréninky jako šablony, běh cvičení po sériích s pauzami, souhrn s RPE a pocitem. Rozdělaný cvik se do kalorií nepočítá.

## Synchronizace (opraveno 29. 9. 2026)
- `push()` posílal frontu od začátku a při první chybě skončil – jeden trvale odmítaný záznam držel všechno za sebou a „chyba sync“ svítila napořád.
- Teď: trvalé chyby (`Store.trvalaChyba`: RLS, 401/403, neexistující sloupec) nebo pátý neúspěch záznam **odloží** do `odlozene` a fronta pokračuje. Badge vpravo nahoře jde kliknout, `A.syncInfo` ukáže co čeká, co se odložilo a proč, a nabídne „Zkusit teď“ / „Zapomenout odložené“.
- **`SEED.version`**: když se mění jména surovin nebo přibude pole, musí se zvednout. Přírůstkový pull stahuje jen řádky novější než poslední sync, takže oprava globálních dat by se ke klientovi jinak nedostala. `Store.refreshSeed()` při změně verze zahodí stažené globální řádky a vynutí plný pull. **Při zápisu globálních dat do Supabase používej `updated_at` = teď**, ne datum vydání (tahle chyba stála jedno kolo: data z 18. 9. se ke klientům nedostala až do 21. 9.).

## Obrazovky (přestavba 29. 9. 2026)
Robert i trenér se v appce ztráceli: Dnes měla 4 641 px (5,5 obrazovky), stejnou věc říkali čtyři průvodci (pruh s kroky, Teď, Úkoly, Chybí zápisy), jídlo šlo odškrtnout z pěti míst a trenér měl pět zdrojů upozornění s různými prahy. Přestavba to srovnala na **tři obrazovky pro každou roli**; výpočty ani data se nezměnily.

**Robert: Dnes · Plán · Pokrok** + Více (Recepty, Suroviny, Nastavení, Návod) pod kolečkem R vpravo nahoře.
- **Dnes** (≈ 1 450 px na 390 px): velké číslo „zbývá sníst“ s pruhem dne a třemi malými čísly (bílkoviny, dnešní deficit, rezerva plánu) → karta **Teď** (jeden krok, jedno tlačítko; nesoulad plánu s limitem, včerejší chybějící váha) → **jeden seznam dne**: váha, chody, chůze a trénink podle času, jantarový řádek **cheat**, večer kroky a uzavření dne. Detail všeho je ve spodním listu (chod se surovinami a gramy, chůze, kroky, trénink, cheat, uzavření s verdiktem a hladem, kontrola dne se vzorcem). ⋯ nabízí navrhnout chybějící jídla, snědl jsem vše, vrátit plán z Týdne.
- **Plán**: Jídla → Nákup → Vaření. Jídla = týden jako sedm řádků (emoji chodů, kcal, stav), den se otevře v listu, jedno hlavní tlačítko podle situace (naplánovat / doplnit / dorovnat / opravit / pokračovat na nákup), zbytek pod ⋯. Nákup = dny, regály, u trvanlivých „mám doma“, sekce Doma, list Celá spíž, tisk pod ⋯. Vaření = V lednici, dny, co uvařit, rozpis do hrnce v listu. Pohled „den po dni“ zrušen.
- **Pokrok**: průměr 7 vážení, cesta ke 102 kg, graf proti plánu se značkami zásahů trenéra, tři kroužky, listy Obvody / Historie zápisů / Plán proti skutečnosti. Zápis váhy a obvodů v listu (+ Zápis), váha se zapisuje hlavně na Dnes.

**Trenér: Robert · Plán** + Více (Pohled Roberta, Nastavení, Návod). Od 1. 10. bez Databáze a bez plánování jídel za Roberta – trenér plánuje cíle a trénink, ne jídlo.
- **Robert** (Dashboard + týdenní přehled): verdikt 🔴🟡🟢 z `signaly()`, jedna věta, cíl/plán/realita → signály s akcí → týden (sedm políček, čtyři čísla) → graf váhy se značkami → Čísla za 6 týdnů a 28 dní v listu. Den se otevře v listu (jídla, chůze, kroky, hlad, jednorázová změna tréninku). Novinky od poslední návštěvy pod 🔔.
- **Plán → Cíle**: tempo (posuvník), cíl chůze, cíl kroků, tempo chůze s fází, udržovací týden; Profil a výchozí hodnoty a Historie změn v listech. Ukládá se hned, každá změna přes `commitSettings` do logu. **Plán → Trénink**: Robertův týden – sedm konkrétních dní (tento / příští týden), den v listu, uložení „každé X od dneška“ nebo „jen tento den“; pod tím jen varování (jídla se nevejdou, málo pohybu, tempo) a odkazy na uložené tréninky a knihovnu cviků.

**Úvod** při prvním spuštění (3 karty pro každou roli) nahradil 16 pruhů s návodem; znovu z Návodu.

## Vzhled (přestavba 29. 9. 2026)
Světlo a sklo, **nic tmavého** – beze změny. Nově jeden systém v `style.css` (přepsaný celý): šest barevných rolí (akce, sedí, cheat/pozor, přes limit, text, podklad) + makra, systémové písmo, jedna sada komponent (karta, řádek seznamu, spodní list, přepínač, štítek, krokovač, velké číslo, pruh dne, kroužek, hláška), čtyři druhy tlačítek. Spodní list na mobilu vyjíždí zdola, na počítači je panel vpravo. Robert má na počítači sloupec 720 px, trenér 1060 px. Ruční styly v kódu: 413 → 85 (zbytek jsou dynamické šířky pruhů a pár výjimek v trénincích).

## Vstupy a čeština
- **Každé číslo má meze** (`omez()`): chůze 0–600 min, gramy 0–5 000, piva 0–40, smažené 0–3 000 g, váha 30–400 kg; u trenéra výška 120–230, věk 15–100, bílkoviny 60–400, tempo 0,3–1,2 %, kroky 0–30 000. Mimo meze appka řekne a uloží nejbližší povolenou hodnotu.
- **Desetinná pole jsou `type="text"` s `inputmode="decimal"`** a čárka se čte jako tečka (`cislo()`). `type="number"` čárku z české klávesnice tiše zahodí.
- Skloňování po číslovce dělá `sklon()` / `DEN()`.

## Odchylky od sešitu (záměrné)
Nákup škálovaný na aktuální váhu · datované týdny · spodní hranice jídla · příloha na 10 g (v hmotnosti na talíři) · „kolik co stojí“ počítáno živě · start 134,4 · tolerance dne `dayTol` · suroviny v nákupním stavu místo vařeného.

## Rozhodnutí Rudy (platí)
Robert edituje výchozí suroviny/recepty jako vlastní verzi · hvězdičky + Oblíbené · spodní hranice jídla ano · vláknina ne · trénink jako týdenní šablona + výjimky · tempo mění jen trenér · odměrky ano · rutina v generátoru zapnutá · žádný tmavý režim, žádné foto jídla, žádný přepis do frameworku · repozitář veřejný, klíče přes Secrets · push notifikace do Později · kalorie a recepty se počítají ze suchých surovin · porce se dělí vážením hotové dávky · **29. 9.:** přestavba na tři obrazovky pro každou roli · nastavení trenéra se ukládá hned (se Zpět) · Vaření bez pohledu „den po dni“ · u trenéra listování po týdnech místo 7/14/28 dní · Robert na počítači ve sloupci 720 px · žádná komunikace v appce (vzkazy, poznámky).

## Kontrola kvality
`tools/check.js` (výpočty, referenční čísla v CLAUDE.md) · `tools/ftest.py` (funkční scénáře, přepsané na nové rozhraní) · `tools/qa.py` (3 šířky × všechny obrazovky a záložky: přetečení, prvky mimo viewport, rolování do strany na 390 px, díry, překryvy, kontrast, malé písmo, klikací průchod; nově výška Dnes, počet ⓘ na obrazovce a počet ručních stylů) · `tools/cloudtest.py` (dva prohlížeče proti nasazené adrese a ostré databázi; zápis váhy upraven na list).

**Poslední stav (29. 9. 2026, po přestavbě):** check.js referenční čísla beze změny · ftest `errors: none` · qa 0 přetečení, 0 prvků mimo, rolování do strany nikde, díry žádné, 79 kliknutí bez chyby, Dnes 1 437–1 476 px, ⓘ max 0 · všechny spodní listy prověřené na 390 i 1440 px bez přetečení. cloudtest proti nasazené verzi `errors: none` (21 kontrol). Netestováno na skutečném iOS Safari.

## Vyřešeno
- **Rozdíl 2 511,75 vs. 2 473,00 kcal (středa)** je jen zaokrouhlení přílohy. Při 5 g vyjde 2 511,75, bez zaokrouhlení 2 503,34, na 10 g 2 473,00.
- **Převod na suché gramy** kontrolní čísla nezměnil.
- **Kroky se předvyplňovaly cílem** – opraveno, `daySteps()` vrací `null`, cíl je `stepsGoal()`.
- **„Pití“ v hláškách** – teď cheat s výpisem obsahu (`cheatPopis`).
- **Zaseknutá fronta synchronizace** a **klient přepisující globální recepty** – viz Synchronizace.
- **Opraveno při přestavbě (29. 9.):** na počítači chybělo Více (Recepty, Suroviny, Návod nešly otevřít) · Nastavení bylo ve Více dvakrát · úkol a připomínka „Dojdi na nákup“ vedly na neexistující obrazovku · „Odškrtnout vše zpět“ volalo neexistující `A.shopReset` · Databáze › Suroviny otevírala Nákup · pole kroků v Robertově Nastavení nic neukládalo · „Nastavit“ z doporučení a přepnutí fáze se nelogovaly (chyběly značky v grafu) · graf váhy u trenéra neměl značky zásahů · kalendář (.ics) neměl kroky · dvě různá razítka „poslední návštěva trenéra“, a novinky mizely po prvním překreslení · Nádoby dvakrát · Návod tvrdil „večer nic neukládáš“, zatímco úkol chtěl uzavřít den · trenér mohl z Více otevřít Robertovy obrazovky mimo náhled a psát mu do dat · mrtvý kód (staré menu, `A.cheatAdd`, `parseCheat`, `popEl`, `quietHeader`, `VIEWS.zprava`, `catchUpAlert`, `noteCard`).

## Prověrka a opravy 30. 9. – 1. 10. 2026
Na základě prověrky všech funkcí (schváleno vlastníkem bez výjimek):
- **Potvrzení dne:** den se hodnotí jen potvrzený; večer jedno ťuknutí „jedl jsem podle plánu“, výjimky se opraví. Nepotvrzený minulý den je „nezapsaný“. Dřív se o půlnoci hodnotil podle plánu – odtud „14 dnů přes limit“.
- **Kroky celkem z telefonu**, appka odečte chůzi (dřív procházka nafoukla číslo o 6–7 tisíc a trenér by ladil faktor podle nesmyslu).
- **Porce z vaření** podle krabičky, ne podle limitu dne.
- **Udržování po cíli** (`settings.maintain`) – dřív deficit u cíle běžel dál.
- **Recepty a suroviny jako kopie „(moje)“** místo „moje verze“; textový rozpoznávač snědeného pryč („Jedl jsem něco jiného“: recept, mimo dům, suroviny); Spíž jen mám doma / došlo.
- **Trenér:** signály jen z potvrzených dnů (nový signál „nepotvrzené dny“), přehled „Jak Robert cvičí“ (série, zátěž, náročnost). („Co Robert mění“ a Databáze 1. 10. odebrány – trenér jídlo neplánuje.)
- **Chyba s dopadem – opraveno:** úklid `cloudtest.py` mazal natvrdo i Robertovo nastavení (`settings:<uid>`); po každém testu appka jela na výchozích hodnotách – cíl chůze 60 místo nastavených 70 min (od 30. 9. odpoledne do 1. 10. ráno). Nastavení obnoveno ze zálohy, cloudtest teď nastavení vrací a maže jen měkce.
- **Zálohy:** týdenní šifrovaná záloha GitHub Action (`backup.yml`, heslo `BACKUP_PASSPHRASE` v `~/.yesyoucan.env`).
- **Push připomínky – nasazené 1. 10.:** funkce `remind` běží (bez `x-cron-secret` vrací 403), plánovač `yesyoucan-remind` každých 15 min, tabulka `push_subs`. Neověřeno na skutečném telefonu – headless prohlížeč notifikace neumí. **Ověřit:** Robert na iPhonu (appka na ploše) → Více → Nastavení → Zapnout připomínky, pak `curl -s -H "x-cron-secret: $CRON_SECRET" "$SUPABASE_URL/functions/v1/remind?test=1"` – musí přijít „Připomínky fungují ✓“.

## 1. 10. 2026
- **Trénink na měsíc dopředu:** kalendář měsíce, kopírování dne / týdne / měsíce, „vrátit měsíc na šablonu“.
- **Jak šel den:** při potvrzení dne Robert ťukne na hotové odpovědi (nálada, hlad, chutě, pohyb, spánek, stres) a může dopsat text. Trenér vidí v listu dne, v kartě týdne (emoji nálady) a vzorce jako signály. Jednosměrný záznam – na přání vlastníka výjimka z pravidla „žádná komunikace“.
- **Týdenní shrnutí** pro Roberta: neděle odpoledne a pondělí–úterý na Dnes, kdykoli v Pokroku; pochvala, tip a výzva k vážení a obvodům.
- Týdenní zpráva ke zkopírování odstraněna (byla to komunikace).
- **Graf váhy a rozbor (1. 10.):** popisek u každého vážení (datum, ranní váha, průměr, plán, odchylka, den předtím) u Roberta i trenéra; trenér pod grafem karta „Proč hubne pomaleji/rychleji než plán“ s příčinami v kg/týden a tlačítkem nápravy (`weightWhy`).
- **Trenér na jednu obrazovku (1. 10.):** obrazovka Robert = pruh (verdikt, Ø týden, trend 3 t, prognóza, pas, potvrzené dny) · graf Váha/Obvody (týdenní průměry, trend, plán ±0,5 kg) · Problémy (co · dopad kg/týden · kde · náprava; `diagnoza()` slučuje rozbor váhy a signály) · období Měsíc/Týden s cíli proti plnění a den v panelu (plán proti skutečnosti, co ho rozhodlo, doporučení). Pohled Roberta jen v menu. Plán ve dvou sloupcích. Vše se vejde na 1366×768, `qa.py` to hlídá. Signály „Robert si naplánoval jídla“ stažené na pohlídat / na vědomí (jídlo plánuje Robert).
- **Přestavba podle úkolů (2. 10.–5. 10.):** trenér Přehled · Plán · Trénink · ⚙︎ Nastavení. Přehled = pruh se třemi čísly proti plánu (tempo, kdy cíl podle plánu vs. trendu s rozdílem, zápisy) + tabulka cílů (plán · skutečnost · rozdíl · dny · dopad · co s tím; měsíc → týden → den) + graf a další upozornění. Plán = tři bloky Cíl a tempo · Pohyb · Jídlo s výsledkem; udržovací týden přejmenován na přestávku v deficitu a přesunut k tempu; jednorázové hodnoty v Nastavení. Den v Tréninku: chůze · cviky · platí, ostatní akce v menu ⋯ s vysvětlením. Nápověda „?“ napříč appkou (registr `HELP`). Robert: bez karty Teď (další krok v seznamu), velké číslo + věta o chůzi, detail jídla: změnit jídlo nahoře, gramy v rozbalení; čitelný graf v Pokroku; popisky zásahů v grafu sloučené po dnech. Opraveno: „každé sobota“ → „každou sobotu“, nápověda nezůstává viset.
- **Kontrola výpočtu limitu (2. 10.):** kroky se nepočítají dvakrát (faktor 1,34 = sedavě + 5 000 běžných kroků; zapsané kroky limit nezvedají, slouží jen ke kontrole faktoru; procházka se přičítá z minut a od kroků se odečítá). Tempo limit mění (0,5 % → 2 843, 0,75 % → 2 484 kcal při 130 kg a 70 min chůze), ale od ~0,9 % ho drží spodní hranice – appka to teď v Cílech říká. Cíle chodů byly zadávané v kcal a sváděly (u Roberta snídaně 2 000 = 52 % dne) – teď procenta, Robertovi vráceno 620.
- **Trenér neplánuje jídlo:** odebrána záložka Databáze, přehled „Co Robert mění“ a „Plánovat za Roberta“ v náhledu. Pohled Roberta je jen ke čtení.

## Otevřené věci / NEXT
- **29. 9. odpoledne:** z appky odstraněna veškerá komunikace (vzkazy, odpovědi, poznámky ke dni a k tréninku) – rozhodnutí vlastníka. Opraveno: trenér přidal trénink, Robert ho neviděl – „Plán 1“ neměl „Platí od“. Trénink přestavěn na **Robertův týden** (konkrétní dny, uložení „každé X od dneška“ / „jen tento den“, verze na pozadí – úprava už nepřepisuje minulé dny). **Ostrá data Roberta smazána** na přání vlastníka (vážení, dny, plány jídel, nákup, předvolby, trénink, jeho verze receptu, historie změn nastavení; nastavení a cíle zůstaly) – záloha `~/yesyoucan-zalohy/robert-pred-smazanim-2026-09-29.json`. Historická data dodá vlastník v Excelu (import zatím není).
- **Přestavba nasazená 29. 9.** Robertovi říct, že appka vypadá jinak: tři obrazovky dole, drž se karty Teď.
- **Čeká na Rudu:** ťuknout „Zapomenout odložené“ v dialogu synchronizace (20 odmítnutých zápisů globálních receptů, data v pořádku) · poslat Robertovi adresu a heslo z env · změnit si vlastní heslo · smazat testovací plán „Cvik pokus“.
- **Rozhodnutí vlastníka:** zaokrouhlení přílohy 10 g vs. 5 g · poměrné kalorie za nedokončený cvik · přejmenování cviku se nepropisuje do uložených tréninků.
- **Přesunout repozitář mimo Google Drive** (git se tam rozbil).
- **Sdílený Supabase projekt:** appka sedí v `GPT-Codex-app-lab` spolu s druhou appkou; až bude místo, přestěhovat podle NAVOD A3.
- **Import historie z Excelu** – čeká na soubor od vlastníka (doporučení: jen vážení a obvody).
- **NEXT: týden reálných dat od Roberta v novém rozhraní**, pak kontrola měr, parseru a stupnice cheatu – a zeptat se ho, jestli se v appce vyzná.
- Později: widget · fáze chůze auto-přepínání · více klientů (netestováno).
