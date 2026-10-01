-- ===========================================================================
-- YesYouCan · push připomínky (30. 9. 2026). Idempotentní – jde pustit znovu.
-- Odběry push notifikací (jeden řádek = jedno zařízení). Píše a čte jen vlastník,
-- odesílá serverová funkce `remind` service-role klíčem.
-- ===========================================================================
create table if not exists public.push_subs (
  id         text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at text not null,
  deleted    boolean not null default false);
alter table public.push_subs enable row level security;
grant select, insert, update on public.push_subs to authenticated;
drop policy if exists push_subs_select on public.push_subs;
drop policy if exists push_subs_insert on public.push_subs;
drop policy if exists push_subs_update on public.push_subs;
create policy push_subs_select on public.push_subs for select to authenticated using (user_id = auth.uid());
create policy push_subs_insert on public.push_subs for insert to authenticated with check (user_id = auth.uid());
create policy push_subs_update on public.push_subs for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Plánovač: každých 15 minut zavolá funkci remind. Tajemství CRON_SECRET se dosazuje
-- při spuštění (viz NAVOD.md A9), v repozitáři není.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule(jobid) from cron.job where jobname = 'yesyoucan-remind';
select cron.schedule('yesyoucan-remind', '*/15 * * * *', $cron$
  select net.http_post(
    url := 'https://__REF__.supabase.co/functions/v1/remind',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '__CRON_SECRET__'),
    body := '{}'::jsonb)
$cron$);
