# YesYouCan · plán hubnutí

Webová aplikace pro klienta a trenéra; nahrazuje Excel `robert-plan_4_0.xlsx`.
Jeden `index.html` složený z `src/*` skriptem `build.py`, nasazený na GitHub Pages, data v Supabase (offline-first).

- Vývoj a pravidla: `CLAUDE.md`
- Aktuální úkoly: `ZADANI.md`
- Stav projektu a rozhodnutí: `STAV.md`
- Nasazení a používání: `NAVOD.md`

```
python3 build.py            # → out/index.html (env SUPABASE_URL, SUPABASE_KEY = cloudová verze)
node tools/check.js         # kontrola výpočtů proti sešitu
python3 tools/ftest.py      # funkční scénáře (Playwright)
python3 tools/qa.py         # layout ve 3 šířkách
```
