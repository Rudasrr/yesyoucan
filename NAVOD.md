# YesYouCan · návod

Dvě části: **A** je pro tebe (trenér, vlastník) – jak je to nasazené a co dělat, když je potřeba něco změnit. **B** je pro Roberta – to mu můžeš poslat celé. Na konci je řešení problémů.

Adresa appky: **https://rudasrr.github.io/yesyoucan/**
Repozitář: **https://github.com/Rudasrr/yesyoucan** · Supabase projekt: **GPT-Codex-app-lab** (ref `reizexthhcyemkpplvmt`, eu-central-1)

> Proč cizí název projektu: free plán Supabase pouští dva aktivní projekty na člověka a oba jsi měl obsazené. Appka proto sedí ve stávajícím projektu `GPT-Codex-app-lab`. Tabulky má vlastní, takže se s ničím nepotkají, ale **účty (`auth.users`) a API klíče jsou společné** s tou druhou appkou. Až budeš mít místo (pozastavíš jiný projekt nebo přejdeš na Pro), dá se to přestěhovat: založit projekt, pustit `supabase-setup.sql`, znovu založit dva účty a přepsat Secrets.

---

# A · Nasazení a správa

## A1. Jak to celé drží pohromadě

```
src/*            zdrojové části appky (CSS + JS moduly)
   ↓ python3 build.py   (doplní klíče k Supabase z proměnných prostředí)
out/index.html   jeden soubor s celou appkou  + sw.js, manifest, ikony
   ↓ push na main → GitHub Action
GitHub Pages     https://rudasrr.github.io/yesyoucan/
   ↕ přihlášení a data
Supabase         Postgres (tabulky settings, foods, recipes, … ) + účty
```

`out/` se do repozitáře nedává – vyrábí ho Action při každém pushi na `main`. Adresa Supabase a veřejný klíč jsou v **GitHub Secrets** (`SUPABASE_URL`, `SUPABASE_KEY`), ne v kódu. Heslo k databázi a service-role klíč jsou jen v `~/.yesyoucan.env` na tvém Macu.

## A2. Jednorázová přihlášení

Potřeba jen při prvním nasazení nebo po vypršení tokenu (otevře prohlížeč):

```bash
gh auth login                    # GitHub (pokud ještě nejsi přihlášený)
gh auth refresh -s workflow      # bez toho GitHub odmítne změny v .github/workflows/
npx --yes supabase@latest login  # Supabase
```

Ověření: `gh auth status` (musí být vidět scope `workflow`) a `npx --yes supabase@latest projects list`.

`supabase` CLI není nainstalované napevno, jede přes `npx` – na tomhle Macu není Homebrew. Přístupový token si CLI drží v klíčence, ne v souboru.

## A3. Co se stalo při zakládání (pro případ, že to budeš dělat znovu)

```bash
# GitHub
git init -b main && git add -A && git commit -m "v5.3"
gh repo create yesyoucan --public --source=. --remote=origin --push
gh api -X POST repos/Rudasrr/yesyoucan/pages -f build_type=workflow

# Supabase – SQL jede přes Management API, heslo k databázi není potřeba
REF=reizexthhcyemkpplvmt
npx --yes supabase@latest db query --linked --project-ref $REF -f supabase-setup.sql
npx --yes supabase@latest db query --linked --project-ref $REF \
    "select count(*) from public.foods"        # musí být 196, recipes 200
npx --yes supabase@latest projects api-keys --project-ref $REF   # URL a anon klíč

# propojení
gh secret set SUPABASE_URL --body "https://$REF.supabase.co"
gh secret set SUPABASE_KEY --body "$ANON_KEY"
gh workflow run deploy.yml && gh run watch
```

`supabase-setup.sql` je idempotentní – suroviny a recepty se vkládají `on conflict do nothing`, takže opakované spuštění nepřepíše tvoje úpravy. Schéma i politiky se dají pustit znovu kdykoli.

**Adresa pro obnovu hesla** musí být v seznamu povolených přesměrování. Protože projekt sdílí nastavení s druhou appkou, nepřepisuj ho celé – jen do něj přidej:

```bash
D=$(mktemp -d) && npx --yes supabase@latest init --workdir $D --yes
npx --yes supabase@latest config pull --workdir $D --project-ref $REF
# v $D/supabase/config.toml přidat adresu do additional_redirect_urls
# a zakomentovat [auth.sms.twilio] (patří druhé appce, push by ho vypnul)
npx --yes supabase@latest config diff --workdir $D --project-ref $REF   # musí hlásit jedinou změnu
npx --yes supabase@latest config push --workdir $D --project-ref $REF
```

Všechna hesla a klíče jsou v `~/.yesyoucan.env` (práva 600). Ten soubor **není** v repozitáři a nikdy tam nepatří. Service-role klíč se nikam nenahrává – slouží jen k zakládání účtů z tvého Macu. Kdyby se soubor ztratil, klíče přečteš znovu přes `npx supabase projects api-keys`.

## A4. Účty

Účty jsou dva, oba v Supabase (Authentication → Users):

| kdo | e-mail | role v `profiles` |
|---|---|---|
| ty (trenér) | rehor.rudolf@gmail.com | `coach` |
| Robert | r.pesek24@gmail.com | `client`, `coach_id` = tvoje ID |

Hesla jsou v `~/.yesyoucan.env` (`COACH_PW`, `ROBERT_PW`). Minimální délka hesla v projektu je **6 znaků** – míň Supabase nedovolí ani nastavit. Heslo si kdokoli změní přes „Zapomenuté heslo“ na přihlašovací obrazovce (odkaz vede zpátky do appky).

Přihlašovací obrazovka je **jedna pro oba**: e-mail a heslo. Jestli se otevře trenérský pohled nebo Robertův, rozhoduje řádek v `profiles`, ne to, kam klikneš. Až budeš mít pod sebou víc cvičenců (další řádek v `profiles` s `coach_id` = tvoje ID), objeví se ti nahoře přepínač klienta sám.

Kdyby bylo potřeba doplnit řádek v `profiles` ručně (například po znovuzaložení účtu), UID najdeš v Supabase v Authentication → Users:

```sql
insert into public.profiles (id, role, coach_id, name, email) values
  ('<UID trenéra>', 'coach',  null,            'Ruda',   'rehor.rudolf@gmail.com'),
  ('<UID Roberta>', 'client', '<UID trenéra>', 'Robert', 'r.pesek24@gmail.com')
on conflict (id) do update
  set role = excluded.role, coach_id = excluded.coach_id,
      name = excluded.name, email = excluded.email;
```

Kontrola: `select id, role, coach_id from public.profiles;` → dva řádky, Robert má v `coach_id` tvoje ID. Bez toho řádku appka po přihlášení řekne „Účet zatím nemá roli“.

## A5. Jak udělat změnu v appce

```bash
# 1. uprav jen soubory v src/ (nikdy out/index.html)
python3 build.py && node tools/check.js     # složení + kontrola výpočtů
python3 tools/ftest.py && python3 tools/qa.py   # funkční a layoutové testy
git add -A && git commit -m "co se změnilo" && git push
```

Push na `main` spustí Action, ta appku složí se Secrets a nahraje na Pages. Průběh: `gh run watch`. Za minutu je nová verze venku; komu appka běží, uvidí hlášku **„Nová verze – obnovit“**.

Referenční čísla, na kterých `check.js` stojí, jsou v `CLAUDE.md`. Když se některé změní a nechtěl jsi to, něco se rozbilo.

## A6. Data a zálohy

- **Automatická záloha:** každou neděli ve 3:00 (UTC) uloží GitHub Action celou databázi jako zašifrovaný soubor (Actions → Záloha databáze → artefakt `zaloha-N`, drží 90 dní). Ručně: Actions → Záloha databáze → Run workflow. Rozšifrování (artefakt stáhneš `gh run download <id> -n zaloha-N`): `set -a; . ~/.yesyoucan.env; set +a; openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE -in zaloha.json.enc -out zaloha.json`. Obnova je ruční (soubor obsahuje všechny řádky všech tabulek).
- Robert i ty máte v **Více → Nastavení** export do Excelu a zálohu (JSON) – to je nejrychlejší záchrana.
- **V databázi se maže jen měkce** (`deleted = true`, `updated_at` = teď). Tvrdé `delete` se do prohlížečů nepropíše a smazané řádky by v appce zůstaly.
- Databázi zálohuješ `npx --yes supabase@latest db dump --linked --project-ref reizexthhcyemkpplvmt -f zaloha.sql`.
- Appka funguje offline: data se drží v prohlížeči a odešlou se, jakmile je signál. Stav poznáš podle tečky vpravo nahoře; když svítí červeně, ťukni na ni a appka řekne, co vázne.
- Výchozí suroviny a recepty jsou „globální“ (společné). Když si je Robert upraví, vznikne jeho vlastní verze a tvoje původní zůstane. Ty měníš globální verzi v záložce **Databáze**.

## A7. Co poslat Robertovi

Tři věty a dva údaje:

> Tady je tvoje appka: **https://rudasrr.github.io/yesyoucan/** – otevři to v telefonu a přidej si to na plochu (Safari: Sdílet → Přidat na plochu; Chrome: ⋮ → Přidat na plochu).
> Přihlásíš se e-mailem **r.pesek24@gmail.com** a heslem, které ti posílám zvlášť – hned si ho změň přes „Zapomenuté heslo“.
> Nic nevymýšlej: otevři **Dnes** a drž se karty **Teď** – vždycky ti řekne jeden další krok. Pod ní je celý den v jednom seznamu, stačí odškrtávat. Psát si budeme jako doteď, appka na zprávy není.

## A9. Push připomínky – nasazení (jednorázově)

Kód je v repu, server potřebuje: tabulku `push_subs`, funkci `remind` a plánovač. Jednou se přihlas (`npx --yes supabase@latest login`, otevře prohlížeč) a pak:

```bash
set -a; . ~/.yesyoucan.env; set +a
npx --yes supabase@latest secrets set --project-ref $SUPABASE_REF VAPID_PUBLIC=$VAPID_PUBLIC VAPID_PRIVATE=$VAPID_PRIVATE CRON_SECRET=$CRON_SECRET
npx --yes supabase@latest functions deploy remind --project-ref $SUPABASE_REF --no-verify-jwt
sed "s/__REF__/$SUPABASE_REF/; s/__CRON_SECRET__/$CRON_SECRET/" supabase-push.sql > /tmp/push.sql
npx --yes supabase@latest db query --linked --project-ref $SUPABASE_REF -f /tmp/push.sql && rm /tmp/push.sql
```

Zkouška bez čekání na čas: `curl -s -H "x-cron-secret: $CRON_SECRET" "$SUPABASE_URL/functions/v1/remind?test=1"` – každému přihlášenému zařízení přijde „Připomínky fungují ✓“. Robert si připomínky zapne v **Více → Nastavení → Připomínky** (na iPhonu musí mít appku přidanou na plochu a otevřít ji odtamtud).

## A8. Jak appku používáš ty (trenér)

Tři záložky dole (na počítači nahoře), zbytek pod kolečkem **T** vpravo nahoře.

- **Robert** – barva a jedna věta řeknou, jestli zasáhnout. Pod tím jen signály, které vyžadují akci – u většiny je tlačítko (nastavit, přiřadit, otevřít). Týden jako sedm políček a čtyři čísla. Ťuknutím na den vidíš, co snědl, chůzi, kroky a **jak šel den** (nálada, hlad, chutě, pohyb, spánek, stres a jeho poznámka). V kartě týdne je u dne emoji nálady. Appka na komunikaci není – vzkazy, poznámky ani zprávy k posílání v ní nejsou.
- **Plán → Cíle** – tempo hubnutí, cíl chůze, cíl kroků (běžná chůze mimo procházku – Robert zapisuje kroky celkem, appka procházku odečte), tempo chůze a udržovací týden. U cíle zapni **Udržování** (appka to připomene). **Ukládá se hned** a každá změna jde vrátit tlačítkem Zpět v hlášce. Věci na roky (výška, věk, start, cílové hodnoty, bílkoviny, cíle chodů) jsou v **Profil a výchozí hodnoty**. **Historie změn** ukazuje všechny zásahy; v grafu váhy jsou jako svislé čáry.
- **Plán → Trénink** – kalendář měsíce, šipkami listuješ dopředu. Ťukni na den, nastav chůzi a cviky a při uložení vyber **Každé úterý** (šablona od dneška, minulé dny zůstanou) nebo **Jen 29. 9.** Hotový den zkopíruješ na další dny („zkopírovat na další dny“, rychle každé úterý na 4 nebo 8 týdnů), pod kalendářem kopíruješ celý **týden** nebo **měsíc**. Tečka u dne = plán na konkrétní datum. Kalorie řešit nemusíš – appka se ozve jen, když se Robertovi nevejdou jídla nebo je v týdnu málo pohybu.
- **Databáze** – globální recepty a suroviny. Bez hledání se ukážou chody, ťuknutím se otevře jeden. **Co Robert mění** ukáže recepty, které vyměňuje nebo upravuje – kandidáti na opravu.
- **Dny bez potvrzení** jsou šedé s otazníkem: appka neví, co Robert jedl, proto je nehodnotí. Když jich přibývá, appka to hlásí.
- **Více → Pohled Roberta** – appka přesně tak, jak ji vidí on. Jen náhled, nic se neuloží; když za něj opravdu potřebuješ něco naplánovat, zapni tam „Plánovat za Roberta“.

Denní kontrola: otevři **Robert**. Když je zeleno, nic nedělej.

---

# B · Pro Roberta

## B1. Instalace na plochu

Otevři **https://rudasrr.github.io/yesyoucan/** v telefonu a přidej si appku na plochu – pak se otevírá jako normální aplikace a funguje i bez signálu.

- **iPhone (Safari):** Sdílet (čtvereček se šipkou) → Přidat na plochu.
- **Android (Chrome):** ⋮ vpravo nahoře → Přidat na plochu / Nainstalovat aplikaci.

Přihlásíš se e-mailem a heslem. Přihlášení drží, podruhé už ho appka nechce.

## B2. Tři obrazovky

- **Dnes** – co teď a kolik ještě můžeš sníst.
- **Plán** – co budeš jíst, co koupit a co uvařit dopředu. Tři kroky vedle sebe: Jídla → Nákup → Vaření.
- **Pokrok** – jak ti to jde: průměr váhy, graf proti plánu, obvody a historie.

Recepty, suroviny, nastavení a tenhle návod jsou pod kolečkem **R** vpravo nahoře.

## B3. Den, jak ho appka čeká

Nahoře velké číslo: **kolik ještě můžeš sníst**. Pod ním karta **Teď** s jedním krokem a jedním tlačítkem. Pod ní celý den v jednom seznamu podle času.

1. **Ráno se zvaž** – číslo zapíšeš rovnou v kartě Teď. Nalačno, po WC, pokaždé stejně.
2. **Po jídle ťukni na kolečko** u jídla. Když ťukneš na řádek, otevře se jídlo celé: suroviny, gramy, domácí míry, výměna, 💡 jiný návrh, 🍽️ mimo dům.
3. **Chůze** – u řádku je tlačítko +15 minut. Ťuknutím na řádek zapíšeš přesně.
4. **Trénink** (když ho máš v plánu) – ťukni na řádek a dej „Začít cvičit“, nebo jen odškrtni, co jsi udělal.
5. **Večer zapiš kroky** – celé číslo z telefonu nebo hodinek. Procházku si appka odečte sama.
6. **Potvrď den** – „Jedl jsi podle plánu?“ Co bylo jinak, oprav ťuknutím na jídlo, zbytek potvrdíš jedním tlačítkem. Pod tím pár otázek, jak šel den (nálada, hlad, chutě, pohyb, spánek, stres) – stačí ťuknout, a když chceš, dopiš pár slov. Trenér tak ví, jak ti to šlo. Bez potvrzení appka neví, co jsi opravdu snědl, a den nehodnotí.
7. **Neděle a pondělí** – nahoře na Dnes uvidíš **Tvůj týden**: jak sis vedl, pochvalu a tip. Odtud rovnou zapíšeš váhu a obvody. Shrnutí najdeš kdykoli v Pokroku.

## B4. Když se den nepovede

- **Pivo, řízek, dort** – zapiš to ráno do řádku **Cheat** (jantarový, za posledním jídlem). Vybereš ze seznamu, u každé položky vidíš, kolik to stojí minut chůze. Appka ti zvedne cíl chůze, ať tě to nestojí tempo.
- **Nestihl jsi jídlo** → otevři ho a vyber „— vynechat“.
- **Jedl jsi něco jiného** → otevři jídlo a dej 🍽️ Jedl jsem něco jiného: jiný recept, jídlo mimo dům, nebo poskládáš ze surovin.
- **Chceš recept nebo surovinu jinak** → v Receptech / Surovinách si udělej kopii „(moje)“ a uprav ji.
- **Připomínky** → Více → Nastavení → Zapnout připomínky (na iPhonu nejdřív přidej appku na plochu).
- **Nemáš váhu na jídlo** → u surovin vidíš domácí míry (⚖️ zvaž · 🥄 odměř · ✋ od oka). Velikost svých nádob nastavíš v Nastavení.
- **Chceš trenérovi něco říct** → napiš mu jako doteď, appka na zprávy není.

## B5. Neděle

V **Plánu**: nech si navrhnout týden (⋯ → Naplánuj mi celý týden), dolaď, co nechceš, pak **Nákup** – seznam podle regálů. Co máš doma z trvanlivých, označ „mám doma“ a na lístku nebude, dokud neťukneš „došlo“. Ve **Vaření** vybereš dny, na které vaříš, appka řekne, kolik čeho dát do hrnce, a po „uvařeno“ počítá porce podle krabičky.

---

# Řešení problémů

| co se děje | co s tím |
|---|---|
| **Po přihlášení „Účet zatím nemá roli“** | V `profiles` chybí řádek s tvým UID – viz A4. |
| **Appka se neotevře bez signálu** | Musí být přidaná na plochu a aspoň jednou otevřená online (tehdy se uloží do zařízení). |
| **Data se neobjevila u druhého** | Tečka vpravo nahoře ukazuje stav – ťukni na ni a dej „Zkusit teď“, jinak počkej do minuty. Bez internetu se změny drží v zařízení a odešlou se samy. |
| **Dvě zařízení, každé jinak** | Platí novější zápis. Když se to rozejde, nahraj zálohu z Nastavení. |
| **„Nová verze – obnovit“** | Ťukni na Obnovit. Nic se neztratí. |
| **Zapomenuté heslo** | Odkaz na přihlašovací obrazovce, e-mail přijde do pár minut (mrkni i do spamu). |
| **Přidal jsem trénink, Robert ho nevidí** | Zkontroluj v Plán → Trénink, že je u toho dne vidět; na starých verzích appky musel mít plán vyplněné „Platí od“. Robertovi pomůže synchronizace (tečka vpravo nahoře). |
| **Úvod při prvním spuštění chci vidět znovu** | Více → Návod → „Ukázat úvod znovu“. |
| **Nasazení spadlo** | `gh run list --workflow deploy.yml` a `gh run view --log-failed`. Nejčastěji chybí Secrets – viz A3. |
| **V appce jsou stará data receptů** | Trenér: Více → Nastavení → Naplnit výchozí data. Je bezpečné to pustit znovu. |
