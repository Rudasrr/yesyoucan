# Robert – plán · návod

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

Hesla jsou v `~/.yesyoucan.env` (`COACH_PW`, `ROBERT_PW`). Tvůj účet v tom projektu už existoval, takže dostal nové dočasné heslo – **změň si ho hned** přes „Zapomenuté heslo“ na přihlašovací obrazovce. Robertovi pošli to jeho a ať udělá totéž. Minimální délka hesla v projektu je 12 znaků.

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

- Robert i ty máte v Účtu **Export** (XLSX) a **Zálohu** (JSON) – to je nejrychlejší záchrana.
- Databázi zálohuješ `npx --yes supabase@latest db dump --linked --project-ref reizexthhcyemkpplvmt -f zaloha.sql`.
- Appka funguje offline: data se drží v prohlížeči a odešlou se, jakmile je signál. Poslední stav sync poznáš podle tečky vpravo nahoře.
- Výchozí suroviny a recepty jsou „globální“ (společné). Když si je Robert upraví, vznikne jeho vlastní verze a tvoje původní zůstane. Ty měníš globální verzi v Databáze / Recepty / Suroviny.

## A7. Co poslat Robertovi

Tři věty a dva údaje:

> Tady je tvoje appka: **https://rudasrr.github.io/yesyoucan/** – otevři to v telefonu a přidej si to na plochu (Safari: Sdílet → Přidat na plochu; Chrome: ⋮ → Přidat na plochu).
> Přihlásíš se e-mailem **r.pesek24@gmail.com** a heslem, které ti posílám zvlášť – hned si ho změň přes „Zapomenuté heslo“.
> Nic nevymýšlej: otevři **Dnes**, nahoře ti řekne jeden krok, co máš udělat. Ráno se zvaž, přes den odškrtávej jídla a zapiš chůzi. Zbytek dopočítám já.

---

# B · Pro Roberta

## B1. Instalace na plochu

Otevři **https://rudasrr.github.io/yesyoucan/** v telefonu a přidej si appku na plochu – pak se otevírá jako normální aplikace a funguje i bez signálu.

- **iPhone (Safari):** Sdílet (čtvereček se šipkou) → Přidat na plochu.
- **Android (Chrome):** ⋮ vpravo nahoře → Přidat na plochu / Nainstalovat aplikaci.

Přihlásíš se e-mailem a heslem. Přihlášení drží, podruhé už ho appka nechce.

## B2. Den, jak ho appka čeká

1. **Ráno se zvaž** a číslo zapiš (Dnes → Zvážit se, nebo Měření). Vážíš se nalačno, pokaždé stejně.
2. **Vyber jídla** – appka ti ke každému chodu nabídne recept a spočítá porce tak, aby ti den vyšel. Když něco nechceš, ťukni na 💡 a vyber jiné.
3. **Zapiš chůzi** – tlačítka +15 / +30 / +60 minut. Cíl je hodina denně.
4. **Odškrtávej, co máš snědené.** Když jsi jedl něco jiného, použij „co jsem snědl“ – napiš to vlastními slovy, appka si to přebere.
5. **Večer zkontroluj den.** Zelená = hotovo. Červená ti řekne přesně, co nesedí.

Karta **„Teď“** nahoře je jediné, co musíš sledovat – je na ní vždycky jen jeden další krok.

## B3. Když se den nepovede

- **Pivo nebo smažené** zapiš nahoře v Dnes. Appka ti sama zmenší porce jídel, ať se do dne vejdeš – nemusíš nic počítat. Bílkovina se nekrátí.
- **Nestihl jsi jídlo** → vyber „vynechat“, appka dopočítá zbytek dne.
- **Nemáš váhu na jídlo** → Návod → „Jak jíst bez váhy“ a domácí míry (⚖️ 🥄 ✋). Hrnek, lžíce, dlaň – stačí to.
- **Nesedělo ti něco** → napiš dole poznámku trenérovi. Uvidí ji a odpoví přímo v appce.

## B4. Ostatní obrazovky

- **Týden** – co tě čeká, dá se přeplánovat („Naplánuj mi týden“).
- **Přehled** – kolik ubývá, jestli držíš plán a kdy budeš na cíli.
- **Nákup** – co koupit, po porcích.
- **Vaření** – co uvařit dopředu, ať máš hotovo.
- **Účet** – připomínky do kalendáře, nádoby, export dat.

---

# Řešení problémů

| co se děje | co s tím |
|---|---|
| **Po přihlášení „Účet zatím nemá roli“** | V `profiles` chybí řádek s tvým UID – viz A4. |
| **Appka se neotevře bez signálu** | Musí být přidaná na plochu a aspoň jednou otevřená online (tehdy se uloží do zařízení). |
| **Data se neobjevila u druhého** | Tečka vpravo nahoře ukazuje stav. Zkus „Synchronizovat teď“, jinak počkej do minuty. Bez internetu se změny drží v zařízení a odešlou se samy. |
| **Dvě zařízení, každé jinak** | Platí novější zápis. Když se to rozejde, nahraj zálohu z Účtu. |
| **„Nová verze – obnovit“** | Ťukni na Obnovit. Nic se neztratí. |
| **Zapomenuté heslo** | Odkaz na přihlašovací obrazovce, e-mail přijde do pár minut (mrkni i do spamu). |
| **Nasazení spadlo** | `gh run list --workflow deploy.yml` a `gh run view --log-failed`. Nejčastěji chybí Secrets – viz A3. |
| **V appce jsou stará data receptů** | Trenér: Databáze → Naplnit výchozí data. Je bezpečné to pustit znovu. |
