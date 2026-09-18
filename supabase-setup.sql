-- ===========================================================================
-- YesYouCan · plán hubnutí · schéma, RLS a seed pro Supabase
-- Spustitelné opakovaně (idempotentní). Při chybě uprostřed spusť znovu.
--
--   psql "$DB_URL" -f supabase-setup.sql
--
-- Tvar dat: každý záznam je { id, user_id, data (jsonb), updated_at, deleted }.
-- updated_at je TEXT s ISO řetězcem z prohlížeče (new Date().toISOString(),
-- tvar 2026-09-15T10:00:00.000Z). Záměrně ne timestamptz: appka porovnává
-- updated_at jako řetězec (last-write-wins) a PostgREST by timestamptz vrátil
-- v jiném tvaru (+00:00) než jaký si klient uložil lokálně.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. profiles – role a napojení klienta na trenéra
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id       uuid primary key references auth.users (id) on delete cascade,
  role     text not null default 'client' check (role in ('client', 'coach')),
  coach_id uuid references public.profiles (id) on delete set null,
  name     text,
  email    text
);
create index if not exists profiles_coach_idx on public.profiles (coach_id);
alter table public.profiles enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Datové tabulky – všechny stejného tvaru
-- ---------------------------------------------------------------------------
do $do$
declare t text;
begin
  foreach t in array array['settings','foods','recipes','measurements','days','week_plans','shopping','prefs','training']
  loop
    execute format('create table if not exists public.%I (
        id         text primary key,
        user_id    uuid references auth.users (id) on delete cascade,
        data       jsonb not null default ''{}''::jsonb,
        updated_at text not null,
        deleted    boolean not null default false)', t);
    execute format('create index if not exists %I on public.%I (updated_at)', t || '_updated_idx', t);
    execute format('create index if not exists %I on public.%I (user_id)', t || '_user_idx', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
  end loop;
end
$do$;
grant select on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Pomocné funkce (security definer – jinak by se politika nad profiles
--    odkazovala sama na sebe a Postgres by hlásil nekonečnou rekurzi)
-- ---------------------------------------------------------------------------
create or replace function public.my_role() returns text
  language sql stable security definer set search_path = public as
$$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.is_my_client(u uuid) returns boolean
  language sql stable security definer set search_path = public as
$$ select u is not null
   and exists (select 1 from public.profiles p where p.id = u and p.coach_id = auth.uid()) $$;

grant execute on function public.my_role(), public.is_my_client(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. RLS
--    · klient vidí a píše svoje řádky (user_id = auth.uid())
--    · globální řádky (user_id is null) čtou všichni, píše je jen trenér
--    · trenér čte řádky svých klientů, píše jim settings a training
--    Appka nemaže natvrdo – smazání je update deleted = true, proto stačí
--    politiky select / insert / update (upsert potřebuje obě zápisové).
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or coach_id = auth.uid());

do $do$
declare
  t text;
  write_expr text;
  read_expr constant text := '(user_id = auth.uid() or user_id is null or public.is_my_client(user_id))';
begin
  foreach t in array array['settings','foods','recipes','measurements','days','week_plans','shopping','prefs','training']
  loop
    write_expr := case
      -- training drží tři věci najednou: plán a poznámky klienta (píše i trenér),
      -- knihovnu cviků a uložené tréninky (globální řádky, user_id null = trenérovy)
      when t = 'training'
        then '(user_id = auth.uid() or public.is_my_client(user_id) or (user_id is null and public.my_role() = ''coach''))'
      -- trenér mění klientovi nastavení a smí mu naplánovat jídelníček (den a týden)
      -- – primárně si ho ale skládá sám
      when t in ('settings', 'days', 'week_plans')
        then '(user_id = auth.uid() or public.is_my_client(user_id))'
      -- výchozí suroviny a recepty jsou globální, mění je jen trenér; klient si dělá vlastní verze
      when t in ('foods', 'recipes')
        then '(user_id = auth.uid() or (user_id is null and public.my_role() = ''coach''))'
      -- vážení, nákup a předvolby píše jen klient sám
      else '(user_id = auth.uid())'
    end;
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('create policy %I on public.%I for select to authenticated using %s', t || '_select', t, read_expr);
    execute format('create policy %I on public.%I for insert to authenticated with check %s', t || '_insert', t, write_expr);
    execute format('create policy %I on public.%I for update to authenticated using %s with check %s', t || '_update', t, write_expr, write_expr);
  end loop;
end
$do$;

-- ---------------------------------------------------------------------------
-- 5. Seed: 214 surovin a 200 receptů (globální řádky, user_id = null)
--    Přepis jen tehdy, je-li řádek v databázi starší než seed – úpravy trenéra zůstanou.
--    Suroviny jsou v nákupním stavu: rýže a luštěniny suché, maso syrové (18. 9. 2026).
-- ---------------------------------------------------------------------------
insert into public.foods (id, user_id, data, updated_at, deleted) values
  ('f1', null, $j${"cat":"Maso","name":"Hovězí přední","kcal":160,"p":19,"c":0,"f":9,"yld":0.75,"aisle":"Maso a ryby"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f2', null, $j${"cat":"Maso","name":"Hovězí zadní","kcal":130,"p":21,"c":0,"f":4.5,"yld":0.75,"aisle":"Maso a ryby"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f3', null, $j${"cat":"Maso","name":"Králík","kcal":130,"p":20,"c":0,"f":5.5,"yld":0.75,"aisle":"Maso a ryby"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f4', null, $j${"cat":"Maso","name":"Krůtí prsa","kcal":105,"p":24,"c":0,"f":1,"yld":0.75,"aisle":"Maso a ryby"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f5', null, $j${"cat":"Maso","name":"Krůtí šunka 90 %","kcal":105,"p":20,"c":1,"f":2.5,"yld":0.75,"aisle":"Maso a ryby"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f6', null, $j${"cat":"Maso","name":"Kuřecí játra","kcal":120,"p":18,"c":1,"f":4.5,"yld":0.75,"aisle":"Maso a ryby"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f7', null, $j${"cat":"Maso","name":"Kuřecí prsa","kcal":110,"p":23,"c":0,"f":1.5,"yld":0.75,"aisle":"Maso a ryby"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f8', null, $j${"cat":"Maso","name":"Kuřecí stehna bez kůže","kcal":120,"p":20,"c":0,"f":4.5,"yld":0.75,"aisle":"Maso a ryby"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f9', null, $j${"cat":"Maso","name":"Kuřecí stehna s kůží","kcal":190,"p":17,"c":0,"f":13,"yld":0.75,"aisle":"Maso a ryby"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f10', null, $j${"cat":"Maso","name":"Kuřecí šunka 90 %","kcal":110,"p":19,"c":1,"f":3.5,"yld":0.75,"aisle":"Maso a ryby"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f11', null, $j${"cat":"Maso","name":"Mleté hovězí libové","kcal":155,"p":20,"c":0,"f":8,"yld":0.75,"aisle":"Maso a ryby"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f12', null, $j${"cat":"Maso","name":"Mleté krůtí","kcal":130,"p":21,"c":0,"f":5,"yld":0.75,"aisle":"Maso a ryby"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f13', null, $j${"cat":"Maso","name":"Mleté maso mix","kcal":240,"p":17,"c":0,"f":19,"yld":0.75,"aisle":"Maso a ryby"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f14', null, $j${"cat":"Maso","name":"Uzená kýta libová","kcal":145,"p":22,"c":0,"f":6,"yld":0.75,"aisle":"Maso a ryby"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f15', null, $j${"cat":"Maso","name":"Vepřová kýta","kcal":135,"p":21,"c":0,"f":5,"yld":0.75,"aisle":"Maso a ryby"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f16', null, $j${"cat":"Maso","name":"Vepřová panenka","kcal":130,"p":22,"c":0,"f":4,"yld":0.75,"aisle":"Maso a ryby"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f17', null, $j${"cat":"Maso","name":"Vepřová plec","kcal":190,"p":18,"c":0,"f":13,"yld":0.75,"aisle":"Maso a ryby"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f18', null, $j${"cat":"Maso","name":"Vepřová šunka nejvyšší jakosti","kcal":110,"p":18,"c":1,"f":4,"yld":0.75,"aisle":"Maso a ryby"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f19', null, $j${"cat":"Maso","name":"Vepřové karé","kcal":160,"p":20,"c":0,"f":9,"yld":0.75,"aisle":"Maso a ryby"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f20', null, $j${"cat":"Mléčné a sýry","name":"Balkánský sýr","kcal":250,"p":16,"c":1,"f":20,"aisle":"Chlazené"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f21', null, $j${"cat":"Mléčné a sýry","name":"Bílý jogurt 3 %","kcal":70,"p":5,"c":5,"f":3,"aisle":"Chlazené"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f22', null, $j${"cat":"Mléčné a sýry","name":"Cottage","kcal":100,"p":12.5,"c":3,"f":4,"aisle":"Chlazené"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f23', null, $j${"cat":"Mléčné a sýry","name":"Eidam 30 %","kcal":270,"p":30,"c":1,"f":16,"aisle":"Chlazené"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f24', null, $j${"cat":"Mléčné a sýry","name":"Eidam 45 %","kcal":340,"p":26,"c":1,"f":26,"aisle":"Chlazené"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f25', null, $j${"cat":"Mléčné a sýry","name":"Feta","kcal":260,"p":14,"c":2,"f":21,"aisle":"Chlazené"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f26', null, $j${"cat":"Mléčné a sýry","name":"Gouda","kcal":350,"p":25,"c":1,"f":27,"aisle":"Chlazené"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f27', null, $j${"cat":"Mléčné a sýry","name":"Hermelín","kcal":300,"p":20,"c":1,"f":24,"aisle":"Chlazené"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f28', null, $j${"cat":"Mléčné a sýry","name":"Jogurt řecký 0 %","kcal":57,"p":10,"c":4,"f":0.2,"aisle":"Chlazené"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f29', null, $j${"cat":"Mléčné a sýry","name":"Jogurt řecký 5 %","kcal":95,"p":9,"c":4,"f":5,"aisle":"Chlazené"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f30', null, $j${"cat":"Mléčné a sýry","name":"Kefír nebo acidofilní mléko","kcal":50,"p":3.5,"c":4,"f":1.5,"aisle":"Chlazené"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f31', null, $j${"cat":"Mléčné a sýry","name":"Lučina","kcal":245,"p":7,"c":2.5,"f":23,"aisle":"Chlazené"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f32', null, $j${"cat":"Mléčné a sýry","name":"Mléko plnotučné 3,5 %","kcal":61,"p":3.3,"c":4.8,"f":3.5,"aisle":"Chlazené"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f33', null, $j${"cat":"Mléčné a sýry","name":"Mléko polotučné 1,5 %","kcal":47,"p":3.4,"c":4.7,"f":1.5,"aisle":"Chlazené"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f34', null, $j${"cat":"Mléčné a sýry","name":"Mozzarella","kcal":250,"p":18,"c":1,"f":19,"aisle":"Chlazené"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f35', null, $j${"cat":"Mléčné a sýry","name":"Mozzarella light","kcal":190,"p":24,"c":1,"f":10,"aisle":"Chlazené"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f36', null, $j${"cat":"Mléčné a sýry","name":"Máslo","kcal":745,"p":0.6,"c":0.7,"f":82,"aisle":"Chlazené"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f37', null, $j${"cat":"Mléčné a sýry","name":"Niva","kcal":340,"p":20,"c":1,"f":29,"aisle":"Chlazené"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f38', null, $j${"cat":"Mléčné a sýry","name":"Olomoucké tvarůžky","kcal":130,"p":28,"c":1,"f":1,"aisle":"Chlazené"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f39', null, $j${"cat":"Mléčné a sýry","name":"Parmezán","kcal":400,"p":33,"c":0,"f":29,"aisle":"Chlazené"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f40', null, $j${"cat":"Mléčné a sýry","name":"Podmáslí","kcal":37,"p":3.4,"c":4,"f":0.5,"aisle":"Chlazené"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f41', null, $j${"cat":"Mléčné a sýry","name":"Skyr nebo bílý jogurt 0 %","kcal":60,"p":11,"c":4,"f":0.2,"aisle":"Chlazené"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f42', null, $j${"cat":"Mléčné a sýry","name":"Smetana 12 %","kcal":130,"p":3,"c":4,"f":12,"aisle":"Chlazené"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f43', null, $j${"cat":"Mléčné a sýry","name":"Tvaroh měkký odtučněný","kcal":70,"p":12,"c":4,"f":0.5,"aisle":"Chlazené"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f44', null, $j${"cat":"Mléčné a sýry","name":"Tvaroh polotučný","kcal":95,"p":13.5,"c":3.5,"f":3,"aisle":"Chlazené"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f45', null, $j${"cat":"Mléčné a sýry","name":"Tvaroh tvrdý na strouhání","kcal":120,"p":20,"c":3,"f":3,"aisle":"Chlazené"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f46', null, $j${"cat":"Mléčné a sýry","name":"Zakysaná smetana 15 %","kcal":160,"p":2.8,"c":4,"f":15,"aisle":"Chlazené"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f47', null, $j${"cat":"Mléčné a sýry","name":"Žervé","kcal":250,"p":9,"c":3,"f":22,"aisle":"Chlazené"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f48', null, $j${"cat":"Obiloviny a přílohy","name":"Batáty","kcal":85.5,"p":1.44,"c":18,"f":0.09,"yld":0.9,"aisle":"Suché a trvanlivé","pack":1000,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f49', null, $j${"cat":"Obiloviny a přílohy","name":"Bramborová kaše (s mlékem)","kcal":95,"p":2.2,"c":16,"f":2,"aisle":"Suché a trvanlivé"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f50', null, $j${"cat":"Obiloviny a přílohy","name":"Bramborový knedlík","kcal":190,"p":4,"c":40,"f":0.8,"aisle":"Suché a trvanlivé"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f51', null, $j${"cat":"Obiloviny a přílohy","name":"Brambory","kcal":80.75,"p":1.9,"c":17.1,"f":0.095,"yld":0.95,"aisle":"Suché a trvanlivé","pack":2000,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f52', null, $j${"cat":"Obiloviny a přílohy","name":"Bulgur","kcal":345,"p":10.5,"c":69,"f":1.2,"yld":3.0,"aisle":"Suché a trvanlivé","pack":500,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f53', null, $j${"cat":"Obiloviny a přílohy","name":"Houskový knedlík","kcal":210,"p":6,"c":43,"f":1.5,"aisle":"Suché a trvanlivé"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f54', null, $j${"cat":"Obiloviny a přílohy","name":"Jáhly","kcal":379.5,"p":11.55,"c":75.9,"f":3.3,"yld":3.3,"aisle":"Suché a trvanlivé","pack":500,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f55', null, $j${"cat":"Obiloviny a přílohy","name":"Kuskus","kcal":368,"p":12.16,"c":73.6,"f":0.64,"yld":3.2,"aisle":"Suché a trvanlivé","pack":500,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f56', null, $j${"cat":"Obiloviny a přílohy","name":"Ovesné vločky","kcal":370,"p":13,"c":60,"f":7,"aisle":"Suché a trvanlivé","pack":500,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f57', null, $j${"cat":"Obiloviny a přílohy","name":"Pohanka","kcal":348,"p":11.6,"c":69.6,"f":2.32,"yld":2.9,"aisle":"Suché a trvanlivé","pack":500,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f58', null, $j${"cat":"Obiloviny a přílohy","name":"Quinoa","kcal":360,"p":13.2,"c":63,"f":5.7,"yld":3.0,"aisle":"Suché a trvanlivé","pack":500,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f59', null, $j${"cat":"Obiloviny a přílohy","name":"Rýže basmati","kcal":351,"p":7.83,"c":75.6,"f":0.81,"yld":2.7,"aisle":"Suché a trvanlivé","pack":1000,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f60', null, $j${"cat":"Obiloviny a přílohy","name":"Rýže","kcal":351,"p":7.29,"c":75.6,"f":0.81,"yld":2.7,"aisle":"Suché a trvanlivé","pack":1000,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f61', null, $j${"cat":"Obiloviny a přílohy","name":"Rýžové nudle","kcal":363,"p":6.6,"c":82.5,"f":0.66,"yld":3.3,"aisle":"Suché a trvanlivé","pack":400,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f62', null, $j${"cat":"Obiloviny a přílohy","name":"Těstoviny","kcal":350,"p":12.5,"c":67.5,"f":2.25,"yld":2.5,"aisle":"Suché a trvanlivé","pack":500,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f63', null, $j${"cat":"Obiloviny a přílohy","name":"Špagety celozrnné","kcal":337.5,"p":13.75,"c":62.5,"f":3,"yld":2.5,"aisle":"Suché a trvanlivé","pack":500,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f64', null, $j${"cat":"Oleje a dochucení","name":"Hořčice","kcal":90,"p":6,"c":8,"f":4,"aisle":"Suché a trvanlivé","pack":180,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f65', null, $j${"cat":"Oleje a dochucení","name":"Kakao 100 %","kcal":230,"p":20,"c":15,"f":11,"aisle":"Suché a trvanlivé","pack":100,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f66', null, $j${"cat":"Oleje a dochucení","name":"Kečup","kcal":110,"p":1.5,"c":25,"f":0.3,"aisle":"Suché a trvanlivé","pack":300,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f67', null, $j${"cat":"Oleje a dochucení","name":"Olej olivový","kcal":890,"p":0,"c":0,"f":99,"aisle":"Suché a trvanlivé","pack":500,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f68', null, $j${"cat":"Oleje a dochucení","name":"Olej řepkový","kcal":890,"p":0,"c":0,"f":99,"aisle":"Suché a trvanlivé","pack":1000,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f69', null, $j${"cat":"Oleje a dochucení","name":"Protein prášek","kcal":380,"p":78,"c":8,"f":4,"aisle":"Suché a trvanlivé","pack":1000,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f70', null, $j${"cat":"Oleje a dochucení","name":"Skořice","kcal":250,"p":4,"c":28,"f":1,"aisle":"Suché a trvanlivé","pack":30,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f71', null, $j${"cat":"Oleje a dochucení","name":"Sójová omáčka","kcal":60,"p":6,"c":6,"f":0,"aisle":"Suché a trvanlivé","pack":150,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f72', null, $j${"cat":"Ostatní","name":"Okurky kyselé","kcal":25,"p":0.8,"c":4,"f":0.2,"aisle":"Suché a trvanlivé","pack":350,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f73', null, $j${"cat":"Ostatní","name":"Zeleninová směs mražená","kcal":40,"p":2,"c":6,"f":0.4,"aisle":"Mražené","pack":450,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f74', null, $j${"cat":"Ovoce","name":"Ananas","kcal":50,"p":0.5,"c":12,"f":0.1,"aisle":"Ovoce a zelenina"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f75', null, $j${"cat":"Ovoce","name":"Avokádo","kcal":160,"p":2,"c":2,"f":15,"aisle":"Ovoce a zelenina"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f76', null, $j${"cat":"Ovoce","name":"Banán","kcal":90,"p":1.1,"c":21,"f":0.3,"aisle":"Ovoce a zelenina"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f77', null, $j${"cat":"Ovoce","name":"Borůvky","kcal":45,"p":0.7,"c":10,"f":0.3,"aisle":"Ovoce a zelenina"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f78', null, $j${"cat":"Ovoce","name":"Broskev","kcal":42,"p":0.9,"c":9,"f":0.1,"aisle":"Ovoce a zelenina"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f79', null, $j${"cat":"Ovoce","name":"Citron","kcal":30,"p":0.6,"c":6,"f":0.2,"aisle":"Ovoce a zelenina"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f80', null, $j${"cat":"Ovoce","name":"Grep","kcal":40,"p":0.8,"c":8,"f":0.1,"aisle":"Ovoce a zelenina"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f81', null, $j${"cat":"Ovoce","name":"Hroznové víno","kcal":70,"p":0.6,"c":16,"f":0.2,"aisle":"Ovoce a zelenina"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f82', null, $j${"cat":"Ovoce","name":"Hruška","kcal":57,"p":0.4,"c":13,"f":0.1,"aisle":"Ovoce a zelenina"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f83', null, $j${"cat":"Ovoce","name":"Jablko","kcal":52,"p":0.3,"c":12,"f":0.2,"aisle":"Ovoce a zelenina"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f84', null, $j${"cat":"Ovoce","name":"Jahody","kcal":33,"p":0.7,"c":6,"f":0.3,"aisle":"Ovoce a zelenina"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f85', null, $j${"cat":"Ovoce","name":"Kiwi","kcal":55,"p":1.1,"c":11,"f":0.5,"aisle":"Ovoce a zelenina"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f86', null, $j${"cat":"Ovoce","name":"Maliny","kcal":40,"p":1.2,"c":7,"f":0.4,"aisle":"Ovoce a zelenina"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f87', null, $j${"cat":"Ovoce","name":"Mandarinka","kcal":50,"p":0.8,"c":11,"f":0.1,"aisle":"Ovoce a zelenina"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f88', null, $j${"cat":"Ovoce","name":"Mango","kcal":62,"p":0.8,"c":14,"f":0.3,"aisle":"Ovoce a zelenina"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f89', null, $j${"cat":"Ovoce","name":"Meloun vodní","kcal":30,"p":0.6,"c":7,"f":0.1,"aisle":"Ovoce a zelenina"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f90', null, $j${"cat":"Ovoce","name":"Meruňky","kcal":45,"p":0.9,"c":9,"f":0.1,"aisle":"Ovoce a zelenina"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f91', null, $j${"cat":"Ovoce","name":"Mražené ovoce směs","kcal":45,"p":0.8,"c":9,"f":0.3,"aisle":"Mražené","pack":300,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f92', null, $j${"cat":"Ovoce","name":"Nektarinka","kcal":45,"p":1.1,"c":9,"f":0.2,"aisle":"Ovoce a zelenina"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f93', null, $j${"cat":"Ovoce","name":"Ovoce nebo bobule","kcal":50,"p":0.4,"c":11,"f":0.2,"aisle":"Ovoce a zelenina"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f94', null, $j${"cat":"Ovoce","name":"Pomeranč","kcal":47,"p":0.9,"c":10,"f":0.1,"aisle":"Ovoce a zelenina"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f95', null, $j${"cat":"Ovoce","name":"Švestky","kcal":47,"p":0.7,"c":10,"f":0.2,"aisle":"Ovoce a zelenina"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f96', null, $j${"cat":"Ořechy a semínka","name":"Arašídové máslo 100 %","kcal":600,"p":25,"c":12,"f":50,"aisle":"Suché a trvanlivé","pack":350,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f97', null, $j${"cat":"Ořechy a semínka","name":"Arašídy pražené","kcal":600,"p":26,"c":14,"f":50,"aisle":"Suché a trvanlivé","pack":200,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f98', null, $j${"cat":"Ořechy a semínka","name":"Chia semínka","kcal":490,"p":17,"c":42,"f":31,"aisle":"Suché a trvanlivé","pack":200,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f99', null, $j${"cat":"Ořechy a semínka","name":"Dýňová semínka","kcal":560,"p":30,"c":11,"f":46,"aisle":"Suché a trvanlivé","pack":200,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f100', null, $j${"cat":"Ořechy a semínka","name":"Kešu","kcal":570,"p":18,"c":27,"f":44,"aisle":"Suché a trvanlivé","pack":200,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f101', null, $j${"cat":"Ořechy a semínka","name":"Lněné semínko","kcal":500,"p":18,"c":20,"f":37,"aisle":"Suché a trvanlivé","pack":200,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f102', null, $j${"cat":"Ořechy a semínka","name":"Lískové ořechy","kcal":640,"p":15,"c":11,"f":61,"aisle":"Suché a trvanlivé","pack":200,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f103', null, $j${"cat":"Ořechy a semínka","name":"Mandle","kcal":580,"p":21,"c":10,"f":50,"aisle":"Suché a trvanlivé","pack":200,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f104', null, $j${"cat":"Ořechy a semínka","name":"Oříšky","kcal":620,"p":20,"c":12,"f":54,"aisle":"Suché a trvanlivé","pack":200,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f105', null, $j${"cat":"Ořechy a semínka","name":"Slunečnicová semínka","kcal":580,"p":21,"c":11,"f":50,"aisle":"Suché a trvanlivé","pack":200,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f106', null, $j${"cat":"Ořechy a semínka","name":"Vlašské ořechy","kcal":650,"p":15,"c":7,"f":65,"aisle":"Suché a trvanlivé","pack":200,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f107', null, $j${"cat":"Pečivo","name":"Bageta světlá","kcal":270,"p":9,"c":52,"f":2,"aisle":"Pečivo"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f108', null, $j${"cat":"Pečivo","name":"Chléb celozrnný","kcal":230,"p":8.5,"c":40,"f":2.5,"aisle":"Pečivo"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f109', null, $j${"cat":"Pečivo","name":"Chléb konzumní (Šumava)","kcal":240,"p":7.5,"c":45,"f":1.5,"aisle":"Pečivo"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f110', null, $j${"cat":"Pečivo","name":"Chléb žitný","kcal":220,"p":6.5,"c":42,"f":1.2,"aisle":"Pečivo"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f111', null, $j${"cat":"Pečivo","name":"Kaiserka","kcal":290,"p":9,"c":56,"f":2.5,"aisle":"Pečivo"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f112', null, $j${"cat":"Pečivo","name":"Knäckebrot žitný","kcal":330,"p":10,"c":60,"f":2,"aisle":"Pečivo"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f113', null, $j${"cat":"Pečivo","name":"Rohlík / houska","kcal":280,"p":9,"c":55,"f":2,"aisle":"Pečivo"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f114', null, $j${"cat":"Pečivo","name":"Rohlík grahamový","kcal":260,"p":9,"c":50,"f":2,"aisle":"Pečivo"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f115', null, $j${"cat":"Pečivo","name":"Rýžové chlebíčky","kcal":380,"p":8,"c":80,"f":3,"aisle":"Pečivo"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f116', null, $j${"cat":"Pečivo","name":"Tortilla pšeničná","kcal":300,"p":9,"c":48,"f":7,"aisle":"Pečivo"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f117', null, $j${"cat":"Pečivo","name":"Toustový chléb celozrnný","kcal":250,"p":10,"c":43,"f":3.5,"aisle":"Pečivo"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f118', null, $j${"cat":"Pečivo","name":"Toustový chléb světlý","kcal":265,"p":8,"c":50,"f":3.5,"aisle":"Pečivo"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f119', null, $j${"cat":"Ryby","name":"Kapr","kcal":130,"p":18,"c":0,"f":6,"aisle":"Maso a ryby"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f120', null, $j${"cat":"Ryby","name":"Krevety","kcal":85,"p":18,"c":0,"f":1,"aisle":"Maso a ryby"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f121', null, $j${"cat":"Ryby","name":"Losos","kcal":200,"p":20,"c":0,"f":13,"aisle":"Maso a ryby"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f122', null, $j${"cat":"Ryby","name":"Losos uzený","kcal":180,"p":21,"c":0,"f":10,"aisle":"Maso a ryby"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f123', null, $j${"cat":"Ryby","name":"Makrela uzená","kcal":250,"p":20,"c":0,"f":19,"aisle":"Maso a ryby"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f124', null, $j${"cat":"Ryby","name":"Pstruh","kcal":120,"p":20,"c":0,"f":4.5,"aisle":"Maso a ryby"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f125', null, $j${"cat":"Ryby","name":"Sardinky ve vlastní šťávě","kcal":150,"p":21,"c":0,"f":7,"aisle":"Maso a ryby","pack":125,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f126', null, $j${"cat":"Ryby","name":"Treska nebo bílé filé","kcal":80,"p":17.5,"c":0,"f":0.7,"aisle":"Maso a ryby"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f127', null, $j${"cat":"Ryby","name":"Tuňák ve vlastní šťávě","kcal":105,"p":24,"c":0,"f":1,"aisle":"Maso a ryby","pack":140,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f128', null, $j${"cat":"Uzeniny","name":"Debrecínka","kcal":130,"p":18,"c":1,"f":6,"aisle":"Maso a ryby"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f129', null, $j${"cat":"Uzeniny","name":"Šunka standard","kcal":130,"p":15,"c":2,"f":7,"aisle":"Maso a ryby"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f130', null, $j${"cat":"Uzeniny","name":"Šunkový salám","kcal":180,"p":14,"c":2,"f":13,"aisle":"Maso a ryby"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f131', null, $j${"cat":"Vejce a rostlinné bílkoviny","name":"Cizrna suchá","kcal":350,"p":21.25,"c":55,"f":6.25,"yld":2.5,"aisle":"Chlazené","pack":500,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f132', null, $j${"cat":"Vejce a rostlinné bílkoviny","name":"Fazole v tomatě (konzerva)","kcal":90,"p":5,"c":15,"f":0.5,"aisle":"Chlazené","pack":400,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f133', null, $j${"cat":"Vejce a rostlinné bílkoviny","name":"Fazole suché","kcal":333.5,"p":23.2,"c":49.3,"f":1.45,"yld":2.9,"aisle":"Chlazené","pack":500,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f134', null, $j${"cat":"Vejce a rostlinné bílkoviny","name":"Hrách suchý","kcal":341,"p":24.8,"c":58.9,"f":1.55,"yld":3.1,"aisle":"Chlazené","pack":500,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f135', null, $j${"cat":"Vejce a rostlinné bílkoviny","name":"Hummus","kcal":240,"p":7,"c":15,"f":17,"aisle":"Chlazené"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f136', null, $j${"cat":"Vejce a rostlinné bílkoviny","name":"Tempeh","kcal":190,"p":19,"c":8,"f":9,"aisle":"Chlazené"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f137', null, $j${"cat":"Vejce a rostlinné bílkoviny","name":"Tofu","kcal":120,"p":13,"c":2,"f":7,"aisle":"Chlazené"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f138', null, $j${"cat":"Vejce a rostlinné bílkoviny","name":"Tofu uzené","kcal":150,"p":16,"c":2,"f":8,"aisle":"Chlazené"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f139', null, $j${"cat":"Vejce a rostlinné bílkoviny","name":"Vejce","kcal":143,"p":12.6,"c":0.7,"f":9.5,"aisle":"Chlazené"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f140', null, $j${"cat":"Vejce a rostlinné bílkoviny","name":"Čočka","kcal":345,"p":27,"c":54,"f":1.2,"yld":3.0,"aisle":"Chlazené","pack":500,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f141', null, $j${"cat":"Vejce a rostlinné bílkoviny","name":"Čočka červená","kcal":352,"p":25.6,"c":54.4,"f":1.6,"yld":3.2,"aisle":"Chlazené","pack":500,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f142', null, $j${"cat":"Zelenina","name":"Brokolice","kcal":32,"p":2.8,"c":4,"f":0.4,"aisle":"Ovoce a zelenina"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f143', null, $j${"cat":"Zelenina","name":"Celer","kcal":40,"p":1.5,"c":7,"f":0.3,"aisle":"Ovoce a zelenina"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f144', null, $j${"cat":"Zelenina","name":"Cibule","kcal":38,"p":1.1,"c":8,"f":0.1,"aisle":"Ovoce a zelenina","pack":1000,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f145', null, $j${"cat":"Zelenina","name":"Cuketa","kcal":18,"p":1.2,"c":2.5,"f":0.3,"aisle":"Ovoce a zelenina"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f146', null, $j${"cat":"Zelenina","name":"Dýně hokaido","kcal":35,"p":1.2,"c":7,"f":0.2,"aisle":"Ovoce a zelenina"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f147', null, $j${"cat":"Zelenina","name":"Hlíva ústřičná","kcal":35,"p":3.3,"c":4,"f":0.4,"aisle":"Ovoce a zelenina"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f148', null, $j${"cat":"Zelenina","name":"Hrášek mražený","kcal":75,"p":5.5,"c":11,"f":0.5,"aisle":"Mražené","pack":450,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f149', null, $j${"cat":"Zelenina","name":"Kapusta","kcal":35,"p":2.8,"c":4,"f":0.4,"aisle":"Ovoce a zelenina"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f150', null, $j${"cat":"Zelenina","name":"Kedlubna","kcal":27,"p":1.7,"c":4,"f":0.1,"aisle":"Ovoce a zelenina"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f151', null, $j${"cat":"Zelenina","name":"Kukuřice (konzerva)","kcal":90,"p":2.8,"c":17,"f":1.2,"aisle":"Ovoce a zelenina","pack":300,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f152', null, $j${"cat":"Zelenina","name":"Květák","kcal":28,"p":2,"c":3,"f":0.3,"aisle":"Ovoce a zelenina"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f153', null, $j${"cat":"Zelenina","name":"Kysané zelí","kcal":20,"p":1,"c":3,"f":0.1,"aisle":"Ovoce a zelenina","pack":500,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f154', null, $j${"cat":"Zelenina","name":"Ledový salát","kcal":14,"p":0.9,"c":2,"f":0.1,"aisle":"Ovoce a zelenina"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f155', null, $j${"cat":"Zelenina","name":"Lilek","kcal":24,"p":1,"c":4,"f":0.2,"aisle":"Ovoce a zelenina"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f156', null, $j${"cat":"Zelenina","name":"Mrkev","kcal":35,"p":0.9,"c":7,"f":0.2,"aisle":"Ovoce a zelenina"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f157', null, $j${"cat":"Zelenina","name":"Okurka","kcal":14,"p":0.7,"c":2,"f":0.1,"aisle":"Ovoce a zelenina"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f158', null, $j${"cat":"Zelenina","name":"Paprika","kcal":28,"p":1,"c":5,"f":0.3,"aisle":"Ovoce a zelenina"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f159', null, $j${"cat":"Zelenina","name":"Pekingské zelí","kcal":14,"p":1.1,"c":1.8,"f":0.2,"aisle":"Ovoce a zelenina"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f160', null, $j${"cat":"Zelenina","name":"Pórek","kcal":30,"p":1.5,"c":5,"f":0.2,"aisle":"Ovoce a zelenina"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f161', null, $j${"cat":"Zelenina","name":"Rajčata","kcal":20,"p":0.9,"c":3.5,"f":0.2,"aisle":"Ovoce a zelenina"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f162', null, $j${"cat":"Zelenina","name":"Rajčata cherry","kcal":22,"p":1,"c":3.8,"f":0.2,"aisle":"Ovoce a zelenina"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f163', null, $j${"cat":"Zelenina","name":"Rajčata krájená (konzerva)","kcal":25,"p":1.1,"c":4,"f":0.2,"aisle":"Ovoce a zelenina","pack":400,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f164', null, $j${"cat":"Zelenina","name":"Rajčatová passata","kcal":35,"p":1.5,"c":6,"f":0.2,"aisle":"Ovoce a zelenina","pack":500,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f165', null, $j${"cat":"Zelenina","name":"Rajčatový protlak","kcal":90,"p":4,"c":16,"f":0.5,"aisle":"Ovoce a zelenina","pack":140,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f166', null, $j${"cat":"Zelenina","name":"Rukola","kcal":25,"p":2.6,"c":2,"f":0.7,"aisle":"Ovoce a zelenina"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f167', null, $j${"cat":"Zelenina","name":"Zelenina míchaná","kcal":25,"p":1.2,"c":4,"f":0.2,"aisle":"Ovoce a zelenina"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f168', null, $j${"cat":"Zelenina","name":"Zelené fazolky","kcal":30,"p":1.9,"c":5,"f":0.2,"aisle":"Ovoce a zelenina"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f169', null, $j${"cat":"Zelenina","name":"Zelí bílé","kcal":27,"p":1.3,"c":4,"f":0.2,"aisle":"Ovoce a zelenina"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f170', null, $j${"cat":"Zelenina","name":"Červená řepa","kcal":45,"p":1.6,"c":9,"f":0.1,"aisle":"Ovoce a zelenina"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f171', null, $j${"cat":"Zelenina","name":"Česnek","kcal":140,"p":6.5,"c":30,"f":0.2,"aisle":"Ovoce a zelenina","pack":100,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f172', null, $j${"cat":"Zelenina","name":"Ředkvičky","kcal":16,"p":0.7,"c":2,"f":0.1,"aisle":"Ovoce a zelenina"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f173', null, $j${"cat":"Zelenina","name":"Špenát mražený","kcal":30,"p":3,"c":2,"f":0.5,"aisle":"Mražené","pack":450,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f174', null, $j${"cat":"Zelenina","name":"Špenát čerstvý","kcal":25,"p":2.9,"c":1.5,"f":0.4,"aisle":"Ovoce a zelenina"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f175', null, $j${"cat":"Zelenina","name":"Žampiony","kcal":25,"p":3,"c":1,"f":0.3,"aisle":"Ovoce a zelenina"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f176', null, $j${"cat":"Pozor","name":"Agávový sirup","kcal":310,"p":0,"c":76,"f":0,"aisle":"Ostatní","pack":250,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f177', null, $j${"cat":"Pozor","name":"Chipsy","kcal":540,"p":6,"c":50,"f":34,"aisle":"Ostatní"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f178', null, $j${"cat":"Pozor","name":"Croissant","kcal":420,"p":8,"c":45,"f":23,"aisle":"Ostatní"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f179', null, $j${"cat":"Pozor","name":"Džus pomerančový (na 100 ml)","kcal":45,"p":0.7,"c":10,"f":0.2,"aisle":"Ostatní"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f180', null, $j${"cat":"Pozor","name":"Hranolky","kcal":290,"p":3.5,"c":36,"f":14,"aisle":"Ostatní"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f181', null, $j${"cat":"Pozor","name":"Klobása","kcal":330,"p":14,"c":2,"f":30,"aisle":"Ostatní"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f182', null, $j${"cat":"Pozor","name":"Kobliha","kcal":380,"p":6,"c":48,"f":18,"aisle":"Ostatní"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f183', null, $j${"cat":"Pozor","name":"Majonéza","kcal":700,"p":1,"c":2,"f":76,"aisle":"Ostatní","pack":400,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f184', null, $j${"cat":"Pozor","name":"Med","kcal":320,"p":0,"c":80,"f":0,"aisle":"Ostatní","pack":450,"pantry":1}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f185', null, $j${"cat":"Pozor","name":"Müsli tyčinka","kcal":420,"p":6,"c":62,"f":15,"aisle":"Ostatní"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f186', null, $j${"cat":"Pozor","name":"Paštika","kcal":320,"p":11,"c":3,"f":29,"aisle":"Ostatní"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f187', null, $j${"cat":"Pozor","name":"Pivo 12° (na 100 ml)","kcal":41,"p":0.4,"c":3.5,"f":0,"aisle":"Ostatní"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f188', null, $j${"cat":"Pozor","name":"Pivo nealko (na 100 ml)","kcal":25,"p":0.2,"c":5.5,"f":0,"aisle":"Ostatní"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f189', null, $j${"cat":"Pozor","name":"Párky jemné","kcal":280,"p":11,"c":2,"f":25,"aisle":"Ostatní"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f190', null, $j${"cat":"Pozor","name":"Slanina","kcal":480,"p":13,"c":1,"f":47,"aisle":"Ostatní"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f191', null, $j${"cat":"Pozor","name":"Slazená limonáda (na 100 ml)","kcal":42,"p":0,"c":10.6,"f":0,"aisle":"Ostatní"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f192', null, $j${"cat":"Pozor","name":"Smažený řízek","kcal":290,"p":18,"c":12,"f":19,"aisle":"Ostatní"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f193', null, $j${"cat":"Pozor","name":"Sušenky máslové","kcal":500,"p":6,"c":63,"f":25,"aisle":"Ostatní"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f194', null, $j${"cat":"Pozor","name":"Zmrzlina smetanová","kcal":200,"p":3.5,"c":24,"f":10,"aisle":"Ostatní"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f195', null, $j${"cat":"Pozor","name":"Čokoláda hořká 70 %","kcal":560,"p":9,"c":32,"f":42,"aisle":"Ostatní"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f196', null, $j${"cat":"Pozor","name":"Čokoláda mléčná","kcal":540,"p":7,"c":57,"f":31,"aisle":"Ostatní"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f197', null, $j${"cat":"Mimo dům","name":"Svíčková s knedlíkem","kcal":165,"p":6.5,"c":20,"f":6.5,"port":450,"aisle":"Ostatní"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f198', null, $j${"cat":"Mimo dům","name":"Guláš s knedlíkem","kcal":170,"p":8,"c":19,"f":6,"port":450,"aisle":"Ostatní"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f199', null, $j${"cat":"Mimo dům","name":"Smažený řízek s bramborem","kcal":215,"p":11,"c":18,"f":11,"port":400,"aisle":"Ostatní"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f200', null, $j${"cat":"Mimo dům","name":"Kuřecí řízek s hranolkami","kcal":230,"p":11,"c":22,"f":11,"port":400,"aisle":"Ostatní"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f201', null, $j${"cat":"Mimo dům","name":"Pizza","kcal":265,"p":11,"c":30,"f":10,"port":350,"aisle":"Ostatní"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f202', null, $j${"cat":"Mimo dům","name":"Burger s hranolkami","kcal":250,"p":11,"c":25,"f":12,"port":450,"aisle":"Ostatní"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f203', null, $j${"cat":"Mimo dům","name":"Kebab v pitě","kcal":215,"p":12,"c":20,"f":9,"port":350,"aisle":"Ostatní"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f204', null, $j${"cat":"Mimo dům","name":"Těstoviny se smetanovou omáčkou","kcal":175,"p":6,"c":20,"f":7,"port":400,"aisle":"Ostatní"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f205', null, $j${"cat":"Mimo dům","name":"Čínské nudle s masem","kcal":160,"p":8,"c":18,"f":6,"port":400,"aisle":"Ostatní"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f206', null, $j${"cat":"Mimo dům","name":"Kuřecí na grilu s rýží","kcal":140,"p":11,"c":17,"f":2.5,"port":400,"aisle":"Ostatní"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f207', null, $j${"cat":"Mimo dům","name":"Losos s bramborem","kcal":150,"p":13,"c":12,"f":5.5,"port":350,"aisle":"Ostatní"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f208', null, $j${"cat":"Mimo dům","name":"Salát s kuřecím masem","kcal":110,"p":11,"c":4,"f":5,"port":350,"aisle":"Ostatní"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f209', null, $j${"cat":"Mimo dům","name":"Polévka gulášová","kcal":60,"p":3.5,"c":5,"f":2.5,"port":300,"aisle":"Ostatní"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f210', null, $j${"cat":"Mimo dům","name":"Polévka zeleninová","kcal":35,"p":1.5,"c":5,"f":1,"port":300,"aisle":"Ostatní"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f211', null, $j${"cat":"Mimo dům","name":"Sekaná s bramborem","kcal":200,"p":9,"c":17,"f":10,"port":400,"aisle":"Ostatní"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f212', null, $j${"cat":"Mimo dům","name":"Palačinky s marmeládou","kcal":250,"p":6,"c":38,"f":8,"port":300,"aisle":"Ostatní"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f213', null, $j${"cat":"Mimo dům","name":"Chlebíček","kcal":230,"p":8,"c":22,"f":12,"port":80,"aisle":"Ostatní"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('f214', null, $j${"cat":"Mimo dům","name":"Jídlo z jídelny – běžné","kcal":160,"p":8,"c":18,"f":6,"port":400,"aisle":"Ostatní"}$j$::jsonb, '2026-09-18T00:00:00.000Z', false)
on conflict (id) do update set data = excluded.data, updated_at = excluded.updated_at
  where public.foods.updated_at < excluded.updated_at;

insert into public.recipes (id, user_id, data, updated_at, deleted) values
  ('r1', null, $j${"course":"Snídaně","num":1,"name":"Obložený chléb se šunkou a sýrem","items":[{"food":"Chléb konzumní (Šumava)","g":80,"scale":1},{"food":"Kuřecí šunka 90 %","g":100,"scale":0},{"food":"Eidam 30 %","g":40,"scale":0},{"food":"Vejce","g":120,"scale":0},{"food":"Zelenina míchaná","g":150,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r2', null, $j${"course":"Snídaně","num":2,"name":"Míchaná vejce se šunkou a chlebem","items":[{"food":"Vejce","g":240,"scale":0},{"food":"Chléb konzumní (Šumava)","g":50,"scale":1},{"food":"Kuřecí šunka 90 %","g":60,"scale":0},{"food":"Zelenina míchaná","g":150,"scale":0},{"food":"Olej řepkový","g":5,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r3', null, $j${"course":"Snídaně","num":3,"name":"Tvarohová mísa s ovocem a oříšky","items":[{"food":"Tvaroh polotučný","g":250,"scale":0},{"food":"Skyr nebo bílý jogurt 0 %","g":150,"scale":0},{"food":"Ovesné vločky","g":40,"scale":1},{"food":"Ovoce nebo bobule","g":150,"scale":1},{"food":"Oříšky","g":10,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r4', null, $j${"course":"Snídaně","num":4,"name":"Houska se sýrem a vejci","items":[{"food":"Rohlík / houska","g":60,"scale":1},{"food":"Eidam 30 %","g":60,"scale":0},{"food":"Vejce","g":180,"scale":0},{"food":"Zelenina míchaná","g":150,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r5', null, $j${"course":"Snídaně","num":5,"name":"Ovesná kaše s proteinem a banánem","items":[{"food":"Ovesné vločky","g":80,"scale":1},{"food":"Mléko polotučné 1,5 %","g":250,"scale":0},{"food":"Protein prášek","g":30,"scale":0},{"food":"Banán","g":100,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r6', null, $j${"course":"Snídaně","num":6,"name":"Skyr s vločkami a borůvkami","items":[{"food":"Skyr nebo bílý jogurt 0 %","g":350,"scale":0},{"food":"Ovesné vločky","g":70,"scale":1},{"food":"Borůvky","g":120,"scale":1},{"food":"Mandle","g":15,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r7', null, $j${"course":"Snídaně","num":7,"name":"Omeleta se špenátem a mozzarellou","items":[{"food":"Vejce","g":180,"scale":0},{"food":"Špenát čerstvý","g":150,"scale":0},{"food":"Mozzarella light","g":60,"scale":0},{"food":"Chléb konzumní (Šumava)","g":70,"scale":1},{"food":"Olej olivový","g":5,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r8', null, $j${"course":"Snídaně","num":8,"name":"Cottage na knäckebrotu s vejci","items":[{"food":"Cottage","g":250,"scale":0},{"food":"Knäckebrot žitný","g":50,"scale":1},{"food":"Vejce","g":120,"scale":0},{"food":"Rajčata","g":150,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r9', null, $j${"course":"Snídaně","num":9,"name":"Tvarůžky s chlebem a vejcem","items":[{"food":"Olomoucké tvarůžky","g":100,"scale":0},{"food":"Chléb konzumní (Šumava)","g":120,"scale":1},{"food":"Vejce","g":120,"scale":0},{"food":"Okurka","g":150,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r10', null, $j${"course":"Snídaně","num":10,"name":"Tortilla s krůtí šunkou a sýrem","items":[{"food":"Tortilla pšeničná","g":120,"scale":1},{"food":"Krůtí šunka 90 %","g":100,"scale":0},{"food":"Eidam 30 %","g":40,"scale":0},{"food":"Zelenina míchaná","g":150,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r11', null, $j${"course":"Snídaně","num":11,"name":"Šakšuka s chlebem","items":[{"food":"Vejce","g":300,"scale":0},{"food":"Rajčatová passata","g":150,"scale":0},{"food":"Paprika","g":150,"scale":0},{"food":"Cibule","g":50,"scale":0},{"food":"Chléb konzumní (Šumava)","g":20,"scale":1},{"food":"Olej olivový","g":4,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r12', null, $j${"course":"Snídaně","num":12,"name":"Řecký jogurt s vločkami a ovocem","items":[{"food":"Jogurt řecký 0 %","g":300,"scale":0},{"food":"Ovesné vločky","g":90,"scale":1},{"food":"Protein prášek","g":20,"scale":0},{"food":"Jahody","g":150,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r13', null, $j${"course":"Snídaně","num":13,"name":"Vločkové palačinky s tvarohem","items":[{"food":"Ovesné vločky","g":50,"scale":1},{"food":"Tvaroh polotučný","g":200,"scale":0},{"food":"Vejce","g":120,"scale":0},{"food":"Ovoce nebo bobule","g":150,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r14', null, $j${"course":"Snídaně","num":14,"name":"Toast s avokádem a vejci","items":[{"food":"Chléb celozrnný","g":30,"scale":1},{"food":"Avokádo","g":60,"scale":0},{"food":"Vejce","g":300,"scale":0},{"food":"Rajčata","g":150,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r15', null, $j${"course":"Snídaně","num":15,"name":"Krůtí šunka s cottage a pečivem","items":[{"food":"Krůtí šunka 90 %","g":120,"scale":0},{"food":"Cottage","g":200,"scale":0},{"food":"Rohlík / houska","g":90,"scale":1},{"food":"Paprika","g":150,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r16', null, $j${"course":"Snídaně","num":16,"name":"Uzený losos s tvarohem a knäckebrotem","items":[{"food":"Losos uzený","g":100,"scale":0},{"food":"Tvaroh polotučný","g":200,"scale":0},{"food":"Knäckebrot žitný","g":70,"scale":1},{"food":"Okurka","g":150,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r17', null, $j${"course":"Snídaně","num":17,"name":"Mléčná rýže s proteinem a ovocem","items":[{"food":"Rýže","g":81.481481,"scale":1},{"food":"Mléko polotučné 1,5 %","g":250,"scale":0},{"food":"Protein prášek","g":40,"scale":0},{"food":"Ovoce nebo bobule","g":120,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r18', null, $j${"course":"Snídaně","num":18,"name":"Vaječná smaženice s brambory","items":[{"food":"Vejce","g":300,"scale":0},{"food":"Brambory","g":73.684211,"scale":1},{"food":"Cibule","g":50,"scale":0},{"food":"Zelenina míchaná","g":150,"scale":0},{"food":"Olej řepkový","g":8,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r19', null, $j${"course":"Snídaně","num":19,"name":"Proteinové smoothie s vločkami","items":[{"food":"Skyr nebo bílý jogurt 0 %","g":300,"scale":0},{"food":"Mléko polotučné 1,5 %","g":200,"scale":0},{"food":"Protein prášek","g":25,"scale":0},{"food":"Banán","g":100,"scale":1},{"food":"Ovesné vločky","g":40,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r20', null, $j${"course":"Snídaně","num":20,"name":"Chléb s arašídovým máslem a skyrem","items":[{"food":"Chléb celozrnný","g":100,"scale":1},{"food":"Arašídové máslo 100 %","g":25,"scale":0},{"food":"Skyr nebo bílý jogurt 0 %","g":250,"scale":0},{"food":"Banán","g":100,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r21', null, $j${"course":"Snídaně","num":21,"name":"Rohlíky s vejci a rajčaty","items":[{"food":"Rohlík / houska","g":90,"scale":1},{"food":"Vejce","g":180,"scale":0},{"food":"Rajčata","g":150,"scale":0},{"food":"Eidam 30 %","g":30,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r22', null, $j${"course":"Snídaně","num":22,"name":"Zapečený toust se šunkou a sýrem","items":[{"food":"Toustový chléb celozrnný","g":140,"scale":1},{"food":"Kuřecí šunka 90 %","g":100,"scale":0},{"food":"Eidam 30 %","g":50,"scale":0},{"food":"Okurka","g":100,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r23', null, $j${"course":"Snídaně","num":23,"name":"Řecký jogurt s medem a ořechy","items":[{"food":"Jogurt řecký 0 %","g":400,"scale":0},{"food":"Med","g":15,"scale":1},{"food":"Vlašské ořechy","g":20,"scale":0},{"food":"Ovesné vločky","g":60,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r24', null, $j${"course":"Snídaně","num":24,"name":"Lívance z vloček s tvarohem","items":[{"food":"Ovesné vločky","g":70,"scale":1},{"food":"Vejce","g":60,"scale":0},{"food":"Mléko polotučné 1,5 %","g":100,"scale":0},{"food":"Tvaroh polotučný","g":200,"scale":0},{"food":"Borůvky","g":100,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r25', null, $j${"course":"Snídaně","num":25,"name":"Chléb se žervé a uzeným lososem","items":[{"food":"Chléb konzumní (Šumava)","g":110,"scale":1},{"food":"Žervé","g":40,"scale":0},{"food":"Losos uzený","g":140,"scale":0},{"food":"Okurka","g":100,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r26', null, $j${"course":"Snídaně","num":26,"name":"Bageta s tuňákem","items":[{"food":"Bageta světlá","g":140,"scale":1},{"food":"Tuňák ve vlastní šťávě","g":120,"scale":0},{"food":"Lučina","g":30,"scale":0},{"food":"Ledový salát","g":80,"scale":0},{"food":"Rajčata","g":100,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r27', null, $j${"course":"Snídaně","num":27,"name":"Jáhlová kaše s banánem a kakaem","items":[{"food":"Jáhly","g":87.878788,"scale":1},{"food":"Mléko polotučné 1,5 %","g":100,"scale":0},{"food":"Protein prášek","g":35,"scale":0},{"food":"Banán","g":100,"scale":1},{"food":"Kakao 100 %","g":5,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r28', null, $j${"course":"Snídaně","num":28,"name":"Míchaná vejce se slaninou","items":[{"food":"Vejce","g":300,"scale":0},{"food":"Slanina","g":25,"scale":0},{"food":"Chléb konzumní (Šumava)","g":20,"scale":1},{"food":"Rajčata","g":150,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r29', null, $j${"course":"Snídaně","num":29,"name":"Tvaroh s medem, ořechy a jablkem","items":[{"food":"Tvaroh měkký odtučněný","g":310,"scale":0},{"food":"Med","g":15,"scale":1},{"food":"Vlašské ořechy","g":15,"scale":0},{"food":"Jablko","g":500,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r30', null, $j${"course":"Snídaně","num":30,"name":"Ovesná kaše s jablkem a skořicí","items":[{"food":"Ovesné vločky","g":90,"scale":1},{"food":"Mléko polotučné 1,5 %","g":250,"scale":0},{"food":"Protein prášek","g":25,"scale":0},{"food":"Jablko","g":120,"scale":1},{"food":"Skořice","g":2,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r31', null, $j${"course":"Snídaně","num":31,"name":"Chléb s vaječnou pomazánkou","items":[{"food":"Vejce","g":300,"scale":0},{"food":"Lučina","g":40,"scale":0},{"food":"Chléb konzumní (Šumava)","g":30,"scale":1},{"food":"Ředkvičky","g":100,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r32', null, $j${"course":"Snídaně","num":32,"name":"Smoothie bowl se skyrem","items":[{"food":"Skyr nebo bílý jogurt 0 %","g":300,"scale":0},{"food":"Banán","g":100,"scale":1},{"food":"Mražené ovoce směs","g":150,"scale":0},{"food":"Ovesné vločky","g":60,"scale":1},{"food":"Chia semínka","g":10,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r33', null, $j${"course":"Snídaně","num":33,"name":"Toust s cottage a rajčaty","items":[{"food":"Toustový chléb světlý","g":130,"scale":1},{"food":"Cottage","g":250,"scale":0},{"food":"Rajčata","g":150,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r34', null, $j${"course":"Snídaně","num":34,"name":"Proteinové palačinky s jahodami","items":[{"food":"Ovesné vločky","g":70,"scale":1},{"food":"Vejce","g":120,"scale":0},{"food":"Mléko polotučné 1,5 %","g":150,"scale":0},{"food":"Protein prášek","g":20,"scale":0},{"food":"Jahody","g":150,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r35', null, $j${"course":"Snídaně","num":35,"name":"Šunková vejce s paprikou","items":[{"food":"Vepřová šunka nejvyšší jakosti","g":100,"scale":0},{"food":"Vejce","g":180,"scale":0},{"food":"Paprika","g":150,"scale":0},{"food":"Chléb konzumní (Šumava)","g":90,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r36', null, $j${"course":"Snídaně","num":36,"name":"Kefírové müsli s banánem","items":[{"food":"Kefír nebo acidofilní mléko","g":300,"scale":0},{"food":"Ovesné vločky","g":50,"scale":1},{"food":"Banán","g":100,"scale":1},{"food":"Mandle","g":15,"scale":0},{"food":"Protein prášek","g":30,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r37', null, $j${"course":"Snídaně","num":37,"name":"Chléb s hermelínem a šunkou","items":[{"food":"Chléb konzumní (Šumava)","g":110,"scale":1},{"food":"Hermelín","g":70,"scale":0},{"food":"Paprika","g":150,"scale":0},{"food":"Kuřecí šunka 90 %","g":90,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r38', null, $j${"course":"Snídaně","num":38,"name":"Rýžová kaše s tvarohem","items":[{"food":"Rýže","g":88.888889,"scale":1},{"food":"Mléko polotučné 1,5 %","g":150,"scale":0},{"food":"Tvaroh polotučný","g":210,"scale":0},{"food":"Med","g":10,"scale":1},{"food":"Skořice","g":2,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r39', null, $j${"course":"Snídaně","num":39,"name":"Vaječina se žampiony","items":[{"food":"Vejce","g":240,"scale":0},{"food":"Žampiony","g":200,"scale":0},{"food":"Cibule","g":50,"scale":0},{"food":"Chléb konzumní (Šumava)","g":70,"scale":1},{"food":"Olej řepkový","g":5,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r40', null, $j${"course":"Snídaně","num":40,"name":"Skyr s hruškou a lískovými ořechy","items":[{"food":"Skyr nebo bílý jogurt 0 %","g":350,"scale":0},{"food":"Hruška","g":150,"scale":1},{"food":"Lískové ořechy","g":15,"scale":0},{"food":"Ovesné vločky","g":60,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r41', null, $j${"course":"Oběd","num":1,"name":"Čočka s uzeným a vejcem","items":[{"food":"Čočka","g":103.333333,"scale":1},{"food":"Uzená kýta libová","g":100,"scale":0},{"food":"Vejce","g":60,"scale":0},{"food":"Zelenina míchaná","g":150,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r42', null, $j${"course":"Oběd","num":2,"name":"Kuřecí prsa s bramborem a salátem","items":[{"food":"Kuřecí prsa","g":250,"scale":0},{"food":"Brambory","g":273.684211,"scale":1},{"food":"Zelenina míchaná","g":200,"scale":0},{"food":"Olej olivový","g":8,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r43', null, $j${"course":"Oběd","num":3,"name":"Vepřová kýta s rýží","items":[{"food":"Vepřová kýta","g":200,"scale":0},{"food":"Rýže","g":85.185185,"scale":1},{"food":"Zelenina míchaná","g":200,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r44', null, $j${"course":"Oběd","num":4,"name":"Treska s bramborem a zeleninou","items":[{"food":"Treska nebo bílé filé","g":300,"scale":0},{"food":"Brambory","g":294.736842,"scale":1},{"food":"Zelenina míchaná","g":200,"scale":0},{"food":"Olej olivový","g":10,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r45', null, $j${"course":"Oběd","num":5,"name":"Krůtí prsa s bulgurem","items":[{"food":"Krůtí prsa","g":230,"scale":0},{"food":"Bulgur","g":70,"scale":1},{"food":"Zelenina míchaná","g":250,"scale":0},{"food":"Olej olivový","g":8,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r46', null, $j${"course":"Oběd","num":6,"name":"Kuřecí stehna s rýží a brokolicí","items":[{"food":"Kuřecí stehna bez kůže","g":250,"scale":0},{"food":"Rýže","g":59.259259,"scale":1},{"food":"Brokolice","g":200,"scale":0},{"food":"Olej olivový","g":6,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r47', null, $j${"course":"Oběd","num":7,"name":"Hovězí zadní s bramborem","items":[{"food":"Hovězí zadní","g":220,"scale":0},{"food":"Brambory","g":263.157895,"scale":1},{"food":"Zelenina míchaná","g":200,"scale":0},{"food":"Olej olivový","g":8,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r48', null, $j${"course":"Oběd","num":8,"name":"Tuňákový salát s bramborem","items":[{"food":"Tuňák ve vlastní šťávě","g":200,"scale":0},{"food":"Brambory","g":315.789474,"scale":1},{"food":"Zelenina míchaná","g":250,"scale":0},{"food":"Olej olivový","g":10,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r49', null, $j${"course":"Oběd","num":9,"name":"Cizrnové kari s kuřecím","items":[{"food":"Kuřecí prsa","g":200,"scale":0},{"food":"Cizrna suchá","g":68,"scale":1},{"food":"Rajčatová passata","g":150,"scale":0},{"food":"Zelenina míchaná","g":150,"scale":0},{"food":"Olej olivový","g":8,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r50', null, $j${"course":"Oběd","num":10,"name":"Losos s quinoou a brokolicí","items":[{"food":"Losos","g":190,"scale":0},{"food":"Quinoa","g":43.333333,"scale":1},{"food":"Brokolice","g":250,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r51', null, $j${"course":"Oběd","num":11,"name":"Mleté krůtí s kuskusem","items":[{"food":"Mleté krůtí","g":220,"scale":0},{"food":"Kuskus","g":68.75,"scale":1},{"food":"Rajčatová passata","g":150,"scale":0},{"food":"Cuketa","g":150,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r52', null, $j${"course":"Oběd","num":12,"name":"Vepřová panenka s batáty","items":[{"food":"Vepřová panenka","g":220,"scale":0},{"food":"Batáty","g":244.444444,"scale":1},{"food":"Zelenina míchaná","g":200,"scale":0},{"food":"Olej olivový","g":8,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r53', null, $j${"course":"Oběd","num":13,"name":"Kuřecí wok s rýžovými nudlemi","items":[{"food":"Kuřecí prsa","g":250,"scale":0},{"food":"Rýžové nudle","g":54.545455,"scale":1},{"food":"Paprika","g":150,"scale":0},{"food":"Mrkev","g":100,"scale":0},{"food":"Olej řepkový","g":8,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r54', null, $j${"course":"Oběd","num":14,"name":"Fazolové chilli s mletým hovězím","items":[{"food":"Mleté hovězí libové","g":180,"scale":0},{"food":"Fazole suché","g":68.965517,"scale":1},{"food":"Rajčatová passata","g":200,"scale":0},{"food":"Paprika","g":150,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r55', null, $j${"course":"Oběd","num":15,"name":"Krevety s rýží a zeleninou","items":[{"food":"Krevety","g":250,"scale":0},{"food":"Rýže","g":74.074074,"scale":1},{"food":"Zelenina míchaná","g":250,"scale":0},{"food":"Olej olivový","g":10,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r56', null, $j${"course":"Oběd","num":16,"name":"Makrela s bramborem a zelím","items":[{"food":"Makrela uzená","g":100,"scale":0},{"food":"Brambory","g":231.578947,"scale":1},{"food":"Kysané zelí","g":200,"scale":0},{"food":"Tvaroh měkký odtučněný","g":200,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r57', null, $j${"course":"Oběd","num":17,"name":"Tofu wok s pohankou","items":[{"food":"Tofu","g":250,"scale":0},{"food":"Pohanka","g":31.034483,"scale":1},{"food":"Brokolice","g":200,"scale":0},{"food":"Olej řepkový","g":8,"scale":1},{"food":"Protein prášek","g":20,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r58', null, $j${"course":"Oběd","num":18,"name":"Kuřecí prsa se špagetami a passatou","items":[{"food":"Kuřecí prsa","g":230,"scale":0},{"food":"Špagety celozrnné","g":76,"scale":1},{"food":"Rajčatová passata","g":200,"scale":0},{"food":"Žampiony","g":150,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r59', null, $j${"course":"Oběd","num":19,"name":"Hovězí guláš s bramborem","items":[{"food":"Hovězí zadní","g":220,"scale":0},{"food":"Brambory","g":252.631579,"scale":1},{"food":"Cibule","g":80,"scale":0},{"food":"Rajčatový protlak","g":30,"scale":1},{"food":"Olej řepkový","g":8,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r60', null, $j${"course":"Oběd","num":20,"name":"Sardinky s chlebem a zeleninou","items":[{"food":"Sardinky ve vlastní šťávě","g":180,"scale":0},{"food":"Chléb celozrnný","g":110,"scale":1},{"food":"Zelenina míchaná","g":250,"scale":0},{"food":"Rajčata","g":150,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r61', null, $j${"course":"Oběd","num":21,"name":"Kuře na paprice s těstovinami","items":[{"food":"Kuřecí prsa","g":220,"scale":0},{"food":"Těstoviny","g":76,"scale":1},{"food":"Smetana 12 %","g":60,"scale":0},{"food":"Cibule","g":50,"scale":0},{"food":"Rajčatový protlak","g":20,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r62', null, $j${"course":"Oběd","num":22,"name":"Rajská s hovězím a těstovinami","items":[{"food":"Hovězí zadní","g":200,"scale":0},{"food":"Těstoviny","g":80,"scale":1},{"food":"Rajčatová passata","g":200,"scale":0},{"food":"Cibule","g":40,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r63', null, $j${"course":"Oběd","num":23,"name":"Čočka na kyselo s vejcem","items":[{"food":"Čočka","g":70,"scale":1},{"food":"Vejce","g":240,"scale":0},{"food":"Cibule","g":60,"scale":0},{"food":"Okurky kyselé","g":50,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r64', null, $j${"course":"Oběd","num":24,"name":"Kuřecí rizoto se zeleninou a sýrem","items":[{"food":"Kuřecí prsa","g":200,"scale":0},{"food":"Rýže","g":66.666667,"scale":1},{"food":"Zeleninová směs mražená","g":200,"scale":0},{"food":"Eidam 30 %","g":30,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r65', null, $j${"course":"Oběd","num":25,"name":"Vepřové nudličky se zeleninou a rýží","items":[{"food":"Vepřová panenka","g":200,"scale":0},{"food":"Rýže","g":85.185185,"scale":1},{"food":"Paprika","g":150,"scale":0},{"food":"Pórek","g":50,"scale":0},{"food":"Sójová omáčka","g":15,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r66', null, $j${"course":"Oběd","num":26,"name":"Segedínský guláš lehčí s knedlíkem","items":[{"food":"Vepřová kýta","g":200,"scale":0},{"food":"Kysané zelí","g":250,"scale":0},{"food":"Zakysaná smetana 15 %","g":50,"scale":0},{"food":"Houskový knedlík","g":100,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r67', null, $j${"course":"Oběd","num":27,"name":"Pstruh na másle s bramborem","items":[{"food":"Pstruh","g":250,"scale":0},{"food":"Brambory","g":294.736842,"scale":1},{"food":"Máslo","g":10,"scale":1},{"food":"Citron","g":30,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r68', null, $j${"course":"Oběd","num":28,"name":"Hrachová kaše s uzeným","items":[{"food":"Hrách suchý","g":119.354839,"scale":1},{"food":"Uzená kýta libová","g":120,"scale":0},{"food":"Cibule","g":50,"scale":0},{"food":"Okurky kyselé","g":60,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r69', null, $j${"course":"Oběd","num":29,"name":"Kuřecí steak s bramborovou kaší","items":[{"food":"Kuřecí prsa","g":230,"scale":0},{"food":"Bramborová kaše (s mlékem)","g":340,"scale":1},{"food":"Zelené fazolky","g":150,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r70', null, $j${"course":"Oběd","num":30,"name":"Boloňské špagety libové","items":[{"food":"Mleté hovězí libové","g":190,"scale":0},{"food":"Špagety celozrnné","g":64,"scale":1},{"food":"Rajčatová passata","g":200,"scale":0},{"food":"Mrkev","g":80,"scale":0},{"food":"Cibule","g":40,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r71', null, $j${"course":"Oběd","num":31,"name":"Tortilla s kuřecím a zeleninou","items":[{"food":"Tortilla pšeničná","g":70,"scale":1},{"food":"Kuřecí prsa","g":290,"scale":0},{"food":"Ledový salát","g":80,"scale":0},{"food":"Rajčata","g":100,"scale":0},{"food":"Zakysaná smetana 15 %","g":40,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r72', null, $j${"course":"Oběd","num":32,"name":"Treska po provensálsku","items":[{"food":"Treska nebo bílé filé","g":300,"scale":0},{"food":"Rajčata krájená (konzerva)","g":250,"scale":0},{"food":"Brambory","g":305.263158,"scale":1},{"food":"Olej olivový","g":8,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r73', null, $j${"course":"Oběd","num":33,"name":"Kuskus s cizrnou, fetou a kuřecím","items":[{"food":"Kuskus","g":40.625,"scale":1},{"food":"Cizrna suchá","g":48,"scale":1},{"food":"Feta","g":40,"scale":0},{"food":"Kuřecí prsa","g":130,"scale":0},{"food":"Okurka","g":150,"scale":0},{"food":"Rajčata","g":150,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r74', null, $j${"course":"Oběd","num":34,"name":"Krůtí nudličky s hráškem a rýží","items":[{"food":"Krůtí prsa","g":220,"scale":0},{"food":"Rýže","g":77.777778,"scale":1},{"food":"Hrášek mražený","g":150,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r75', null, $j${"course":"Oběd","num":35,"name":"Fazole v tomatě s vejci a chlebem","items":[{"food":"Fazole v tomatě (konzerva)","g":250,"scale":1},{"food":"Vejce","g":120,"scale":0},{"food":"Chléb konzumní (Šumava)","g":50,"scale":1},{"food":"Kuřecí šunka 90 %","g":100,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r76', null, $j${"course":"Oběd","num":36,"name":"Kuřecí játra na cibulce s rýží","items":[{"food":"Kuřecí játra","g":250,"scale":0},{"food":"Rýže","g":62.962963,"scale":1},{"food":"Cibule","g":80,"scale":0},{"food":"Olej řepkový","g":8,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r77', null, $j${"course":"Oběd","num":37,"name":"Zapečené těstoviny se šunkou","items":[{"food":"Těstoviny","g":64,"scale":1},{"food":"Kuřecí šunka 90 %","g":120,"scale":0},{"food":"Vejce","g":60,"scale":0},{"food":"Eidam 30 %","g":40,"scale":0},{"food":"Hrášek mražený","g":100,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r78', null, $j${"course":"Oběd","num":38,"name":"Vepřová panenka na hořčici s bramborem","items":[{"food":"Vepřová panenka","g":220,"scale":0},{"food":"Brambory","g":336.842105,"scale":1},{"food":"Hořčice","g":15,"scale":0},{"food":"Zakysaná smetana 15 %","g":30,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r79', null, $j${"course":"Oběd","num":39,"name":"Tofu na kari s rýží a hráškem","items":[{"food":"Tofu","g":250,"scale":0},{"food":"Rýže","g":37.037037,"scale":1},{"food":"Rajčatová passata","g":150,"scale":0},{"food":"Hrášek mražený","g":100,"scale":1},{"food":"Protein prášek","g":15,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r80', null, $j${"course":"Oběd","num":40,"name":"Šopský salát s kuřecím a pečivem","items":[{"food":"Kuřecí prsa","g":200,"scale":0},{"food":"Balkánský sýr","g":60,"scale":0},{"food":"Rajčata","g":200,"scale":0},{"food":"Okurka","g":200,"scale":0},{"food":"Paprika","g":100,"scale":0},{"food":"Chléb konzumní (Šumava)","g":60,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r81', null, $j${"course":"Svačina","num":1,"name":"Tvaroh s vločkami a ovocem","items":[{"food":"Tvaroh polotučný","g":250,"scale":0},{"food":"Ovesné vločky","g":40,"scale":1},{"food":"Ovoce nebo bobule","g":150,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r82', null, $j${"course":"Svačina","num":2,"name":"Skyr s banánem a vločkami","items":[{"food":"Skyr nebo bílý jogurt 0 %","g":350,"scale":0},{"food":"Banán","g":120,"scale":1},{"food":"Ovesné vločky","g":20,"scale":1},{"food":"Oříšky","g":10,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r83', null, $j${"course":"Svačina","num":3,"name":"Cottage s chlebem a šunkou","items":[{"food":"Cottage","g":250,"scale":0},{"food":"Chléb konzumní (Šumava)","g":50,"scale":1},{"food":"Kuřecí šunka 90 %","g":50,"scale":0},{"food":"Zelenina míchaná","g":150,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r84', null, $j${"course":"Svačina","num":4,"name":"Protein s banánem a vločkami","items":[{"food":"Protein prášek","g":35,"scale":0},{"food":"Banán","g":130,"scale":1},{"food":"Ovesné vločky","g":40,"scale":1},{"food":"Oříšky","g":10,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r85', null, $j${"course":"Svačina","num":5,"name":"Tvaroh s kakaem a mandlemi","items":[{"food":"Tvaroh polotučný","g":300,"scale":0},{"food":"Kakao 100 %","g":10,"scale":0},{"food":"Mandle","g":20,"scale":0},{"food":"Banán","g":40,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r86', null, $j${"course":"Svačina","num":6,"name":"Jogurt s borůvkami a chia","items":[{"food":"Jogurt řecký 0 %","g":300,"scale":0},{"food":"Borůvky","g":310,"scale":1},{"food":"Chia semínka","g":15,"scale":1},{"food":"Protein prášek","g":20,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r87', null, $j${"course":"Svačina","num":7,"name":"Skyr s jahodami a oříšky","items":[{"food":"Skyr nebo bílý jogurt 0 %","g":350,"scale":0},{"food":"Jahody","g":200,"scale":0},{"food":"Oříšky","g":25,"scale":0},{"food":"Ovesné vločky","g":10,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r88', null, $j${"course":"Svačina","num":8,"name":"Knäckebrot s cottage a rajčaty","items":[{"food":"Cottage","g":250,"scale":0},{"food":"Knäckebrot žitný","g":30,"scale":1},{"food":"Rajčata","g":150,"scale":0},{"food":"Vejce","g":60,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r89', null, $j${"course":"Svačina","num":9,"name":"Tvarůžky s chlebem a paprikou","items":[{"food":"Olomoucké tvarůžky","g":100,"scale":0},{"food":"Chléb konzumní (Šumava)","g":120,"scale":1},{"food":"Paprika","g":150,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r90', null, $j${"course":"Svačina","num":10,"name":"Rýžové chlebíčky s arašídovým máslem","items":[{"food":"Rýžové chlebíčky","g":30,"scale":1},{"food":"Arašídové máslo 100 %","g":20,"scale":0},{"food":"Skyr nebo bílý jogurt 0 %","g":250,"scale":0},{"food":"Banán","g":100,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r91', null, $j${"course":"Svačina","num":11,"name":"Tuňák s knäckebrotem a zeleninou","items":[{"food":"Tuňák ve vlastní šťávě","g":150,"scale":0},{"food":"Knäckebrot žitný","g":60,"scale":1},{"food":"Zelenina míchaná","g":200,"scale":0},{"food":"Olej olivový","g":5,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r92', null, $j${"course":"Svačina","num":12,"name":"Krůtí šunka s cottage a okurkou","items":[{"food":"Krůtí šunka 90 %","g":120,"scale":0},{"food":"Cottage","g":250,"scale":0},{"food":"Okurka","g":200,"scale":0},{"food":"Knäckebrot žitný","g":20,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r93', null, $j${"course":"Svačina","num":13,"name":"Vejce natvrdo s chlebem","items":[{"food":"Vejce","g":180,"scale":0},{"food":"Chléb celozrnný","g":30,"scale":1},{"food":"Zelenina míchaná","g":150,"scale":0},{"food":"Tvaroh polotučný","g":100,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r94', null, $j${"course":"Svačina","num":14,"name":"Tvaroh s hruškou a vlašskými ořechy","items":[{"food":"Tvaroh polotučný","g":300,"scale":0},{"food":"Hruška","g":140,"scale":1},{"food":"Vlašské ořechy","g":15,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r95', null, $j${"course":"Svačina","num":15,"name":"Kefír s vločkami a ovocem","items":[{"food":"Kefír nebo acidofilní mléko","g":300,"scale":0},{"food":"Ovesné vločky","g":40,"scale":1},{"food":"Ovoce nebo bobule","g":150,"scale":1},{"food":"Protein prášek","g":25,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r96', null, $j${"course":"Svačina","num":16,"name":"Tvrdý tvaroh s ananasem a mandlemi","items":[{"food":"Tvaroh tvrdý na strouhání","g":200,"scale":0},{"food":"Ananas","g":150,"scale":1},{"food":"Mandle","g":20,"scale":0},{"food":"Ovesné vločky","g":10,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r97', null, $j${"course":"Svačina","num":17,"name":"Proteinová kaše","items":[{"food":"Ovesné vločky","g":50,"scale":1},{"food":"Protein prášek","g":30,"scale":0},{"food":"Mléko polotučné 1,5 %","g":250,"scale":0},{"food":"Jahody","g":150,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r98', null, $j${"course":"Svačina","num":18,"name":"Skyr s pomerančem a mandlemi","items":[{"food":"Skyr nebo bílý jogurt 0 %","g":350,"scale":0},{"food":"Pomeranč","g":200,"scale":1},{"food":"Mandle","g":15,"scale":0},{"food":"Ovesné vločky","g":20,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r99', null, $j${"course":"Svačina","num":19,"name":"Hummus s mrkví, vejcem a tvarohem","items":[{"food":"Hummus","g":40,"scale":1},{"food":"Mrkev","g":200,"scale":0},{"food":"Vejce","g":60,"scale":0},{"food":"Tvaroh polotučný","g":200,"scale":0},{"food":"Chléb celozrnný","g":10,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r100', null, $j${"course":"Svačina","num":20,"name":"Mléčné smoothie s proteinem a jahodami","items":[{"food":"Mléko polotučné 1,5 %","g":300,"scale":0},{"food":"Protein prášek","g":35,"scale":0},{"food":"Jahody","g":200,"scale":0},{"food":"Ovesné vločky","g":30,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r101', null, $j${"course":"Svačina","num":21,"name":"Žervé s knäckebrotem a ředkvičkami","items":[{"food":"Žervé","g":50,"scale":0},{"food":"Knäckebrot žitný","g":60,"scale":1},{"food":"Ředkvičky","g":150,"scale":0},{"food":"Krůtí šunka 90 %","g":120,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r102', null, $j${"course":"Svačina","num":22,"name":"Tvarohová pomazánka s hořčicí","items":[{"food":"Tvaroh měkký odtučněný","g":250,"scale":0},{"food":"Hořčice","g":10,"scale":0},{"food":"Chléb konzumní (Šumava)","g":100,"scale":1},{"food":"Mrkev","g":100,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r103', null, $j${"course":"Svačina","num":23,"name":"Skyr s mangem a mandlemi","items":[{"food":"Skyr nebo bílý jogurt 0 %","g":350,"scale":0},{"food":"Mango","g":150,"scale":1},{"food":"Mandle","g":15,"scale":0},{"food":"Ovesné vločky","g":20,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r104', null, $j${"course":"Svačina","num":24,"name":"Cottage s kukuřicí a paprikou","items":[{"food":"Cottage","g":250,"scale":0},{"food":"Kukuřice (konzerva)","g":100,"scale":1},{"food":"Paprika","g":150,"scale":0},{"food":"Rýžové chlebíčky","g":20,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r105', null, $j${"course":"Svačina","num":25,"name":"Řecký jogurt s vločkami a malinami","items":[{"food":"Jogurt řecký 0 %","g":300,"scale":0},{"food":"Ovesné vločky","g":50,"scale":1},{"food":"Maliny","g":150,"scale":0},{"food":"Protein prášek","g":15,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r106', null, $j${"course":"Svačina","num":26,"name":"Podmáslí s banánem a vločkami","items":[{"food":"Podmáslí","g":300,"scale":0},{"food":"Banán","g":100,"scale":1},{"food":"Ovesné vločky","g":40,"scale":1},{"food":"Protein prášek","g":25,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r107', null, $j${"course":"Svačina","num":27,"name":"Vejce se žervé a rohlíkem","items":[{"food":"Vejce","g":120,"scale":0},{"food":"Žervé","g":25,"scale":0},{"food":"Rohlík / houska","g":40,"scale":1},{"food":"Rajčata","g":150,"scale":0},{"food":"Tvaroh měkký odtučněný","g":120,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r108', null, $j${"course":"Svačina","num":28,"name":"Tuňáková pomazánka s chlebem","items":[{"food":"Tuňák ve vlastní šťávě","g":120,"scale":0},{"food":"Lučina","g":40,"scale":0},{"food":"Chléb konzumní (Šumava)","g":90,"scale":1},{"food":"Okurka","g":100,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r109', null, $j${"course":"Svačina","num":29,"name":"Kefír s lněným semínkem a jablkem","items":[{"food":"Kefír nebo acidofilní mléko","g":300,"scale":0},{"food":"Lněné semínko","g":15,"scale":1},{"food":"Jablko","g":200,"scale":1},{"food":"Protein prášek","g":35,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r110', null, $j${"course":"Svačina","num":30,"name":"Mozzarella s rajčaty a knäckebrotem","items":[{"food":"Mozzarella light","g":130,"scale":0},{"food":"Rajčata","g":200,"scale":0},{"food":"Knäckebrot žitný","g":40,"scale":1},{"food":"Olej olivový","g":5,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r111', null, $j${"course":"Svačina","num":31,"name":"Šunkové rolky se žervé","items":[{"food":"Vepřová šunka nejvyšší jakosti","g":140,"scale":0},{"food":"Žervé","g":50,"scale":0},{"food":"Paprika","g":150,"scale":0},{"food":"Rohlík / houska","g":50,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r112', null, $j${"course":"Svačina","num":32,"name":"Skyr s malinami a hořkou čokoládou","items":[{"food":"Skyr nebo bílý jogurt 0 %","g":350,"scale":0},{"food":"Maliny","g":480,"scale":0},{"food":"Čokoláda hořká 70 %","g":10,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r113', null, $j${"course":"Svačina","num":33,"name":"Tvaroh s dýňovými semínky a hruškou","items":[{"food":"Tvaroh polotučný","g":280,"scale":0},{"food":"Dýňová semínka","g":15,"scale":0},{"food":"Hruška","g":190,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r114', null, $j${"course":"Svačina","num":34,"name":"Hummus s paprikou a cottage","items":[{"food":"Hummus","g":50,"scale":1},{"food":"Paprika","g":10,"scale":0},{"food":"Knäckebrot žitný","g":40,"scale":1},{"food":"Cottage","g":220,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r115', null, $j${"course":"Svačina","num":35,"name":"Jablko s arašídovým máslem a skyrem","items":[{"food":"Jablko","g":310,"scale":1},{"food":"Arašídové máslo 100 %","g":20,"scale":0},{"food":"Skyr nebo bílý jogurt 0 %","g":300,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r116', null, $j${"course":"Svačina","num":36,"name":"Sardinková pomazánka s chlebem","items":[{"food":"Sardinky ve vlastní šťávě","g":90,"scale":0},{"food":"Tvaroh měkký odtučněný","g":100,"scale":0},{"food":"Chléb konzumní (Šumava)","g":100,"scale":1},{"food":"Cibule","g":30,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r117', null, $j${"course":"Svačina","num":37,"name":"Balkánský sýr s rajčaty a cottage","items":[{"food":"Balkánský sýr","g":40,"scale":0},{"food":"Rajčata","g":200,"scale":0},{"food":"Okurka","g":150,"scale":0},{"food":"Chléb konzumní (Šumava)","g":50,"scale":1},{"food":"Cottage","g":180,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r118', null, $j${"course":"Svačina","num":38,"name":"Kakaový tvaroh s banánem","items":[{"food":"Tvaroh tvrdý na strouhání","g":200,"scale":0},{"food":"Kakao 100 %","g":8,"scale":0},{"food":"Banán","g":220,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r119', null, $j${"course":"Svačina","num":39,"name":"Makrelová pomazánka s chlebem","items":[{"food":"Makrela uzená","g":70,"scale":0},{"food":"Tvaroh měkký odtučněný","g":150,"scale":0},{"food":"Chléb konzumní (Šumava)","g":70,"scale":1},{"food":"Cibule","g":30,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r120', null, $j${"course":"Svačina","num":40,"name":"Zeleninový talíř s vejci a dipem","items":[{"food":"Vejce","g":120,"scale":0},{"food":"Jogurt řecký 0 %","g":100,"scale":0},{"food":"Mrkev","g":150,"scale":0},{"food":"Paprika","g":150,"scale":0},{"food":"Kedlubna","g":510,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r121', null, $j${"course":"1. večeře","num":1,"name":"Hovězí zadní s bramborem a zeleninou","items":[{"food":"Hovězí zadní","g":200,"scale":0},{"food":"Brambory","g":273.684211,"scale":1},{"food":"Zelenina míchaná","g":250,"scale":0},{"food":"Olej olivový","g":10,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r122', null, $j${"course":"1. večeře","num":2,"name":"Kuřecí prsa s rýží a zeleninou","items":[{"food":"Kuřecí prsa","g":220,"scale":0},{"food":"Rýže","g":66.666667,"scale":1},{"food":"Zelenina míchaná","g":250,"scale":0},{"food":"Olej olivový","g":10,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r123', null, $j${"course":"1. večeře","num":3,"name":"Těstoviny s mletým hovězím","items":[{"food":"Mleté hovězí libové","g":200,"scale":0},{"food":"Těstoviny","g":56,"scale":1},{"food":"Rajčatová passata","g":200,"scale":0},{"food":"Zelenina míchaná","g":200,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r124', null, $j${"course":"1. večeře","num":4,"name":"Rybí filé s bramborem","items":[{"food":"Treska nebo bílé filé","g":280,"scale":0},{"food":"Brambory","g":294.736842,"scale":1},{"food":"Zelenina míchaná","g":250,"scale":0},{"food":"Olej olivový","g":12,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r125', null, $j${"course":"1. večeře","num":5,"name":"Vepřová kýta s bramborem","items":[{"food":"Vepřová kýta","g":190,"scale":0},{"food":"Brambory","g":294.736842,"scale":1},{"food":"Zelenina míchaná","g":250,"scale":0},{"food":"Olej olivový","g":8,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r126', null, $j${"course":"1. večeře","num":6,"name":"Kuřecí stehna s bramborovou kaší","items":[{"food":"Kuřecí stehna bez kůže","g":220,"scale":0},{"food":"Bramborová kaše (s mlékem)","g":320,"scale":1},{"food":"Brokolice","g":200,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r127', null, $j${"course":"1. večeře","num":7,"name":"Krůtí prsa s pečenou zeleninou","items":[{"food":"Krůtí prsa","g":240,"scale":0},{"food":"Brambory","g":273.684211,"scale":1},{"food":"Cuketa","g":150,"scale":0},{"food":"Paprika","g":150,"scale":0},{"food":"Olej olivový","g":10,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r128', null, $j${"course":"1. večeře","num":8,"name":"Plněné papriky s mletým krůtím","items":[{"food":"Mleté krůtí","g":220,"scale":0},{"food":"Paprika","g":250,"scale":0},{"food":"Rýže","g":62.962963,"scale":1},{"food":"Rajčatová passata","g":150,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r129', null, $j${"course":"1. večeře","num":9,"name":"Vepřová panenka s bulgurem","items":[{"food":"Vepřová panenka","g":200,"scale":0},{"food":"Bulgur","g":63.333333,"scale":1},{"food":"Zelenina míchaná","g":250,"scale":0},{"food":"Olej olivový","g":10,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r130', null, $j${"course":"1. večeře","num":10,"name":"Losos s brokolicí a bramborem","items":[{"food":"Losos","g":170,"scale":0},{"food":"Brambory","g":263.157895,"scale":1},{"food":"Brokolice","g":250,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r131', null, $j${"course":"1. večeře","num":11,"name":"Kuřecí kari s rýží","items":[{"food":"Kuřecí prsa","g":230,"scale":0},{"food":"Rýže","g":62.962963,"scale":1},{"food":"Rajčatová passata","g":150,"scale":0},{"food":"Mrkev","g":100,"scale":0},{"food":"Olej řepkový","g":8,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r132', null, $j${"course":"1. večeře","num":12,"name":"Hovězí se žampiony a těstovinami","items":[{"food":"Hovězí zadní","g":200,"scale":0},{"food":"Žampiony","g":200,"scale":0},{"food":"Těstoviny","g":64,"scale":1},{"food":"Jogurt řecký 5 %","g":100,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r133', null, $j${"course":"1. večeře","num":13,"name":"Zapečený květák s kuřecím a sýrem","items":[{"food":"Kuřecí prsa","g":230,"scale":0},{"food":"Květák","g":300,"scale":0},{"food":"Eidam 30 %","g":50,"scale":0},{"food":"Brambory","g":200,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r134', null, $j${"course":"1. večeře","num":14,"name":"Tofu se zeleninou a rýží","items":[{"food":"Tofu","g":280,"scale":0},{"food":"Rýže","g":22.222222,"scale":1},{"food":"Brokolice","g":200,"scale":0},{"food":"Olej řepkový","g":8,"scale":1},{"food":"Protein prášek","g":20,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r135', null, $j${"course":"1. večeře","num":15,"name":"Krevetové těstoviny s rajčaty","items":[{"food":"Krevety","g":230,"scale":0},{"food":"Těstoviny","g":72,"scale":1},{"food":"Rajčatová passata","g":200,"scale":0},{"food":"Zelenina míchaná","g":150,"scale":0},{"food":"Olej olivový","g":8,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r136', null, $j${"course":"1. večeře","num":16,"name":"Fazolový guláš s mletým hovězím","items":[{"food":"Mleté hovězí libové","g":180,"scale":0},{"food":"Fazole suché","g":68.965517,"scale":1},{"food":"Cibule","g":80,"scale":0},{"food":"Rajčatová passata","g":150,"scale":0},{"food":"Paprika","g":150,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r137', null, $j${"course":"1. večeře","num":17,"name":"Kuřecí špízy s kuskusem","items":[{"food":"Kuřecí prsa","g":240,"scale":0},{"food":"Kuskus","g":62.5,"scale":1},{"food":"Paprika","g":150,"scale":0},{"food":"Cuketa","g":150,"scale":0},{"food":"Olej olivový","g":8,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r138', null, $j${"course":"1. večeře","num":18,"name":"Treska na zelenině s bramborem","items":[{"food":"Treska nebo bílé filé","g":300,"scale":0},{"food":"Brambory","g":294.736842,"scale":1},{"food":"Špenát mražený","g":200,"scale":0},{"food":"Olej olivový","g":10,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r139', null, $j${"course":"1. večeře","num":19,"name":"Cuketové lasagne s mletým hovězím","items":[{"food":"Mleté hovězí libové","g":200,"scale":0},{"food":"Cuketa","g":300,"scale":0},{"food":"Rajčatová passata","g":200,"scale":0},{"food":"Mozzarella light","g":60,"scale":0},{"food":"Brambory","g":105.263158,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r140', null, $j${"course":"1. večeře","num":20,"name":"Omeleta se šunkou, sýrem a salátem","items":[{"food":"Vejce","g":240,"scale":0},{"food":"Šunka standard","g":80,"scale":0},{"food":"Eidam 30 %","g":40,"scale":0},{"food":"Zelenina míchaná","g":250,"scale":0},{"food":"Chléb celozrnný","g":10,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r141', null, $j${"course":"1. večeře","num":21,"name":"Zapečená brokolice s kuřecím","items":[{"food":"Kuřecí prsa","g":230,"scale":0},{"food":"Brokolice","g":300,"scale":0},{"food":"Eidam 30 %","g":50,"scale":0},{"food":"Brambory","g":178.947368,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r142', null, $j${"course":"1. večeře","num":22,"name":"Kuřecí čína s pórkem a rýží","items":[{"food":"Kuřecí prsa","g":230,"scale":0},{"food":"Pórek","g":100,"scale":0},{"food":"Paprika","g":100,"scale":0},{"food":"Rýže","g":88.888889,"scale":1},{"food":"Sójová omáčka","g":15,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r143', null, $j${"course":"1. večeře","num":23,"name":"Treska zapečená s rajčaty a mozzarellou","items":[{"food":"Treska nebo bílé filé","g":280,"scale":0},{"food":"Rajčata","g":200,"scale":0},{"food":"Mozzarella light","g":60,"scale":0},{"food":"Brambory","g":315.789474,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r144', null, $j${"course":"1. večeře","num":24,"name":"Vepřové medailonky s fazolkami","items":[{"food":"Vepřová panenka","g":210,"scale":0},{"food":"Zelené fazolky","g":250,"scale":0},{"food":"Brambory","g":273.684211,"scale":1},{"food":"Máslo","g":8,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r145', null, $j${"course":"1. večeře","num":25,"name":"Kuřecí rizoto z hlívy","items":[{"food":"Kuřecí prsa","g":210,"scale":0},{"food":"Hlíva ústřičná","g":150,"scale":0},{"food":"Rýže","g":81.481481,"scale":1},{"food":"Parmezán","g":15,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r146', null, $j${"course":"1. večeře","num":26,"name":"Omeleta se žampiony a šunkou","items":[{"food":"Vejce","g":240,"scale":0},{"food":"Žampiony","g":200,"scale":0},{"food":"Kuřecí šunka 90 %","g":80,"scale":0},{"food":"Chléb konzumní (Šumava)","g":60,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r147', null, $j${"course":"1. večeře","num":27,"name":"Rybí filé s hráškovou kaší","items":[{"food":"Treska nebo bílé filé","g":280,"scale":0},{"food":"Hrášek mražený","g":300,"scale":1},{"food":"Brambory","g":178.947368,"scale":1},{"food":"Máslo","g":5,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r148', null, $j${"course":"1. večeře","num":28,"name":"Krůtí sekaná se zeleninou","items":[{"food":"Mleté krůtí","g":220,"scale":0},{"food":"Vejce","g":60,"scale":0},{"food":"Cibule","g":50,"scale":0},{"food":"Mrkev","g":100,"scale":0},{"food":"Brambory","g":252.631579,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r149', null, $j${"course":"1. večeře","num":29,"name":"Plněná cuketa mletým krůtím","items":[{"food":"Mleté krůtí","g":220,"scale":0},{"food":"Cuketa","g":1170,"scale":0},{"food":"Rajčatová passata","g":150,"scale":0},{"food":"Eidam 30 %","g":30,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r150', null, $j${"course":"1. večeře","num":30,"name":"Salát Caesar light","items":[{"food":"Kuřecí prsa","g":220,"scale":0},{"food":"Ledový salát","g":150,"scale":0},{"food":"Parmezán","g":20,"scale":0},{"food":"Toustový chléb světlý","g":90,"scale":1},{"food":"Jogurt řecký 0 %","g":80,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r151', null, $j${"course":"1. večeře","num":31,"name":"Těstovinový salát s tuňákem","items":[{"food":"Těstoviny","g":100,"scale":1},{"food":"Tuňák ve vlastní šťávě","g":150,"scale":0},{"food":"Kukuřice (konzerva)","g":80,"scale":1},{"food":"Okurka","g":150,"scale":0},{"food":"Jogurt řecký 0 %","g":60,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r152', null, $j${"course":"1. večeře","num":32,"name":"Hlíva na česneku s vejci","items":[{"food":"Hlíva ústřičná","g":250,"scale":0},{"food":"Vejce","g":240,"scale":0},{"food":"Chléb konzumní (Šumava)","g":80,"scale":1},{"food":"Česnek","g":10,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r153', null, $j${"course":"1. večeře","num":33,"name":"Pečený losos s dýní","items":[{"food":"Losos","g":190,"scale":0},{"food":"Dýně hokaido","g":550,"scale":0},{"food":"Rukola","g":50,"scale":0},{"food":"Olej olivový","g":5,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r154', null, $j${"course":"1. večeře","num":34,"name":"Zapečené brambory s tvarůžky","items":[{"food":"Brambory","g":484.210526,"scale":1},{"food":"Olomoucké tvarůžky","g":100,"scale":0},{"food":"Vejce","g":60,"scale":0},{"food":"Cibule","g":50,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r155', null, $j${"course":"1. večeře","num":35,"name":"Krevety na česneku s kuskusem","items":[{"food":"Krevety","g":240,"scale":0},{"food":"Kuskus","g":84.375,"scale":1},{"food":"Česnek","g":10,"scale":1},{"food":"Cuketa","g":150,"scale":0},{"food":"Olej olivový","g":8,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r156', null, $j${"course":"1. večeře","num":36,"name":"Vepřová kýta se špenátem","items":[{"food":"Vepřová kýta","g":200,"scale":0},{"food":"Špenát mražený","g":250,"scale":0},{"food":"Brambory","g":336.842105,"scale":1},{"food":"Česnek","g":10,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r157', null, $j${"course":"1. večeře","num":37,"name":"Kuřecí salát s cizrnou","items":[{"food":"Kuřecí prsa","g":180,"scale":0},{"food":"Cizrna suchá","g":96,"scale":1},{"food":"Paprika","g":150,"scale":0},{"food":"Okurka","g":150,"scale":0},{"food":"Jogurt řecký 0 %","g":60,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r158', null, $j${"course":"1. večeře","num":38,"name":"Tempeh na sojovce s rýží","items":[{"food":"Tempeh","g":200,"scale":0},{"food":"Rýže","g":51.851852,"scale":1},{"food":"Brokolice","g":200,"scale":0},{"food":"Sójová omáčka","g":15,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r159', null, $j${"course":"1. večeře","num":39,"name":"Selská omeleta s bramborem","items":[{"food":"Vejce","g":360,"scale":0},{"food":"Brambory","g":10.526316,"scale":1},{"food":"Slanina","g":20,"scale":0},{"food":"Cibule","g":50,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r160', null, $j${"course":"1. večeře","num":40,"name":"Pečená kuřecí stehna s kořenovou zeleninou","items":[{"food":"Kuřecí stehna bez kůže","g":240,"scale":0},{"food":"Mrkev","g":150,"scale":0},{"food":"Celer","g":100,"scale":0},{"food":"Brambory","g":305.263158,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r161', null, $j${"course":"2. večeře","num":1,"name":"Skyr","items":[{"food":"Skyr nebo bílý jogurt 0 %","g":200,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r162', null, $j${"course":"2. večeře","num":2,"name":"Tvaroh se skořicí","items":[{"food":"Tvaroh polotučný","g":120,"scale":0},{"food":"Skořice","g":2,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r163', null, $j${"course":"2. večeře","num":3,"name":"Kefír s proteinem","items":[{"food":"Kefír nebo acidofilní mléko","g":160,"scale":0},{"food":"Protein prášek","g":10,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r164', null, $j${"course":"2. večeře","num":4,"name":"Protein s vodou","items":[{"food":"Protein prášek","g":30,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r165', null, $j${"course":"2. večeře","num":5,"name":"Cottage s paprikou","items":[{"food":"Cottage","g":90,"scale":0},{"food":"Paprika","g":100,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r166', null, $j${"course":"2. večeře","num":6,"name":"Řecký jogurt s kakaem","items":[{"food":"Jogurt řecký 0 %","g":190,"scale":0},{"food":"Kakao 100 %","g":5,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r167', null, $j${"course":"2. večeře","num":7,"name":"Tvarůžky s okurkou","items":[{"food":"Olomoucké tvarůžky","g":80,"scale":0},{"food":"Okurka","g":150,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r168', null, $j${"course":"2. večeře","num":8,"name":"Vejce s cottage","items":[{"food":"Vejce","g":60,"scale":0},{"food":"Cottage","g":40,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r169', null, $j${"course":"2. večeře","num":9,"name":"Tvaroh s jahodami","items":[{"food":"Tvaroh polotučný","g":90,"scale":0},{"food":"Jahody","g":100,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r170', null, $j${"course":"2. večeře","num":10,"name":"Skyr se skořicí a kakaem","items":[{"food":"Skyr nebo bílý jogurt 0 %","g":170,"scale":0},{"food":"Kakao 100 %","g":5,"scale":0},{"food":"Skořice","g":2,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r171', null, $j${"course":"2. večeře","num":11,"name":"Krůtí šunka s okurkou","items":[{"food":"Krůtí šunka 90 %","g":90,"scale":0},{"food":"Okurka","g":150,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r172', null, $j${"course":"2. večeře","num":12,"name":"Tuňák s rajčaty","items":[{"food":"Tuňák ve vlastní šťávě","g":100,"scale":0},{"food":"Rajčata","g":100,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r173', null, $j${"course":"2. večeře","num":13,"name":"Mléko s proteinem","items":[{"food":"Mléko polotučné 1,5 %","g":130,"scale":0},{"food":"Protein prášek","g":15,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r174', null, $j${"course":"2. večeře","num":14,"name":"Tvrdý tvaroh","items":[{"food":"Tvaroh tvrdý na strouhání","g":100,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r175', null, $j${"course":"2. večeře","num":15,"name":"Skyr s borůvkami","items":[{"food":"Skyr nebo bílý jogurt 0 %","g":160,"scale":0},{"food":"Borůvky","g":60,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r176', null, $j${"course":"2. večeře","num":16,"name":"Řecký jogurt s jahodami","items":[{"food":"Jogurt řecký 0 %","g":160,"scale":0},{"food":"Jahody","g":80,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r177', null, $j${"course":"2. večeře","num":17,"name":"Řecký jogurt s vločkami","items":[{"food":"Jogurt řecký 0 %","g":150,"scale":0},{"food":"Ovesné vločky","g":10,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r178', null, $j${"course":"2. večeře","num":18,"name":"Protein s mlékem","items":[{"food":"Protein prášek","g":20,"scale":0},{"food":"Mléko polotučné 1,5 %","g":90,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r179', null, $j${"course":"2. večeře","num":19,"name":"Cottage se skořicí","items":[{"food":"Cottage","g":120,"scale":0},{"food":"Skořice","g":2,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r180', null, $j${"course":"2. večeře","num":20,"name":"Tvaroh s pomerančem","items":[{"food":"Tvaroh polotučný","g":90,"scale":0},{"food":"Pomeranč","g":100,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r181', null, $j${"course":"2. večeře","num":21,"name":"Skyr s malinami","items":[{"food":"Skyr nebo bílý jogurt 0 %","g":150,"scale":0},{"food":"Maliny","g":70,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r182', null, $j${"course":"2. večeře","num":22,"name":"Cottage s cherry rajčaty","items":[{"food":"Cottage","g":100,"scale":0},{"food":"Rajčata cherry","g":100,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r183', null, $j${"course":"2. večeře","num":23,"name":"Tvrdý tvaroh s medem","items":[{"food":"Tvaroh tvrdý na strouhání","g":90,"scale":0},{"food":"Med","g":5,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r184', null, $j${"course":"2. večeře","num":24,"name":"Kefír s kakaem","items":[{"food":"Kefír nebo acidofilní mléko","g":160,"scale":0},{"food":"Kakao 100 %","g":5,"scale":0},{"food":"Protein prášek","g":8,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r185', null, $j${"course":"2. večeře","num":25,"name":"Krůtí šunka s paprikou","items":[{"food":"Krůtí šunka 90 %","g":80,"scale":0},{"food":"Paprika","g":120,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r186', null, $j${"course":"2. večeře","num":26,"name":"Vejce natvrdo s ředkvičkami","items":[{"food":"Vejce","g":60,"scale":0},{"food":"Ředkvičky","g":100,"scale":0},{"food":"Cottage","g":30,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r187', null, $j${"course":"2. večeře","num":27,"name":"Podmáslí s proteinem","items":[{"food":"Podmáslí","g":240,"scale":0},{"food":"Protein prášek","g":8,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r188', null, $j${"course":"2. večeře","num":28,"name":"Řecký jogurt s borůvkami","items":[{"food":"Jogurt řecký 0 %","g":160,"scale":0},{"food":"Borůvky","g":60,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r189', null, $j${"course":"2. večeře","num":29,"name":"Tuňák s okurkou","items":[{"food":"Tuňák ve vlastní šťávě","g":90,"scale":0},{"food":"Okurka","g":150,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r190', null, $j${"course":"2. večeře","num":30,"name":"Šunka s knäckebrotem","items":[{"food":"Krůtí šunka 90 %","g":70,"scale":0},{"food":"Knäckebrot žitný","g":10,"scale":1},{"food":"Okurka","g":80,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r191', null, $j${"course":"2. večeře","num":31,"name":"Mozzarella light s rajčaty","items":[{"food":"Mozzarella light","g":50,"scale":0},{"food":"Rajčata","g":100,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r192', null, $j${"course":"2. večeře","num":32,"name":"Skyr s jablkem a skořicí","items":[{"food":"Skyr nebo bílý jogurt 0 %","g":140,"scale":0},{"food":"Jablko","g":60,"scale":1},{"food":"Skořice","g":2,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r193', null, $j${"course":"2. večeře","num":33,"name":"Proteinový puding","items":[{"food":"Protein prášek","g":20,"scale":0},{"food":"Mléko polotučné 1,5 %","g":90,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r194', null, $j${"course":"2. večeře","num":34,"name":"Tvaroh s citronem","items":[{"food":"Tvaroh měkký odtučněný","g":140,"scale":0},{"food":"Citron","g":20,"scale":0},{"food":"Med","g":5,"scale":1}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r195', null, $j${"course":"2. večeře","num":35,"name":"Kuřecí šunka s hořčicí","items":[{"food":"Kuřecí šunka 90 %","g":90,"scale":0},{"food":"Hořčice","g":10,"scale":0},{"food":"Okurka","g":100,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r196', null, $j${"course":"2. večeře","num":36,"name":"Kefír s chia semínky","items":[{"food":"Kefír nebo acidofilní mléko","g":70,"scale":0},{"food":"Chia semínka","g":5,"scale":1},{"food":"Protein prášek","g":16,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r197', null, $j${"course":"2. večeře","num":37,"name":"Balkánský sýr s okurkou","items":[{"food":"Balkánský sýr","g":20,"scale":0},{"food":"Okurka","g":150,"scale":0},{"food":"Krůtí šunka 90 %","g":40,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r198', null, $j${"course":"2. večeře","num":38,"name":"Sardinky s citronem","items":[{"food":"Sardinky ve vlastní šťávě","g":80,"scale":0},{"food":"Citron","g":20,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r199', null, $j${"course":"2. večeře","num":39,"name":"Cottage s ředkvičkami","items":[{"food":"Cottage","g":100,"scale":0},{"food":"Ředkvičky","g":100,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false),
  ('r200', null, $j${"course":"2. večeře","num":40,"name":"Uzené tofu s rajčaty","items":[{"food":"Tofu uzené","g":70,"scale":0},{"food":"Rajčata","g":100,"scale":0}]}$j$::jsonb, '2026-09-18T00:00:00.000Z', false)
on conflict (id) do update set data = excluded.data, updated_at = excluded.updated_at
  where public.recipes.updated_at < excluded.updated_at;
