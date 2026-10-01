// YesYouCan · push připomínky Robertovi (Supabase Edge Function).
// Volá ji pg_cron každých 15 minut (supabase-push.sql). Pošle připomínku, jejíž čas
// padl do posledních 15 minut a která ještě není splněná:
//   váha 7:00 (dnes nezváženo) · jídla v časech chodů (neodškrtnuté) ·
//   kroky 20:00 (nezapsané) · potvrzení dne 20:30 (nepotvrzený) · neděle 18:00 plán.
// Odběr, který prohlížeč zrušil (404/410), se smaže měkce.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const SB = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
webpush.setVapidDetails("mailto:noreply@yesyoucan.app", Deno.env.get("VAPID_PUBLIC")!, Deno.env.get("VAPID_PRIVATE")!);

const COURSES = [["snidane", "Snídaně", "7:00", "🍳"], ["obed", "Oběd", "12:00", "🍲"], ["svacina", "Svačina", "16:00", "🥪"], ["vecere1", "1. večeře", "18:00", "🥗"], ["vecere2", "2. večeře", "21:00", "🥛"]];
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };

function pragueNow() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, min: Number(p.hour) * 60 + Number(p.minute), sunday: p.weekday === "Sun" };
}

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) return new Response("forbidden", { status: 403 });
  const now = pragueNow(); const test = new URL(req.url).searchParams.get("test") === "1";
  const due = (t: string) => test || (toMin(t) > now.min - 15 && toMin(t) <= now.min);
  const { data: subs } = await SB.from("push_subs").select("*").eq("deleted", false);
  const byUser: Record<string, any[]> = {}; (subs || []).forEach((s: any) => (byUser[s.user_id] = byUser[s.user_id] || []).push(s));
  let sent = 0;
  for (const [uid, list] of Object.entries(byUser)) {
    const [{ data: st }, { data: dy }, { data: ms }] = await Promise.all([
      SB.from("settings").select("data").eq("id", `settings:${uid}`).eq("deleted", false).maybeSingle(),
      SB.from("days").select("data").eq("id", `d:${uid}:${now.date}`).eq("deleted", false).maybeSingle(),
      SB.from("measurements").select("data").eq("id", `m:${uid}:${now.date}`).eq("deleted", false).maybeSingle()]);
    const s = st?.data || {}, day = dy?.data || { meals: {} }, meas = ms?.data;
    const times = Object.fromEntries((s.courses || []).map((c: any) => [c.key, c.time]));
    const msgs: { title: string; body: string }[] = [];
    if (test) msgs.push({ title: "YesYouCan", body: "Připomínky fungují ✓" });
    else {
      if (due("7:00") && !(meas && meas.weight != null)) msgs.push({ title: "⚖️ Zvaž se", body: "Ráno po WC, nalačno – číslo zapiš v appce." });
      for (const [k, n, t0, em] of COURSES) { const t = times[k] || t0; const m = (day.meals || {})[k] || {};
        if (due(t) && !m.eaten && m.sel !== "— (vynechat)") msgs.push({ title: `${em} ${n}`, body: m.sel && !String(m.sel).startsWith("«") ? `${m.sel} – po jídle odklikni.` : "Čas na jídlo – po jídle odklikni." }); }
      if (due("20:00") && day.steps == null) msgs.push({ title: "👣 Kroky", body: "Zapiš kroky za celý den z telefonu nebo hodinek." });
      if (due("20:30") && !day.reviewed) msgs.push({ title: "✅ Potvrď den", body: "Jedl jsi podle plánu? Jedno ťuknutí, výjimky oprav." });
      if (now.sunday && due("18:00")) msgs.push({ title: "🗓️ Neděle", body: "Naplánuj příští týden a nákup – v appce záložka Plán." });
    }
    for (const msg of msgs) for (const sub of list) {
      try { await webpush.sendNotification(sub.data, JSON.stringify({ ...msg, url: "./" })); sent++; }
      catch (e: any) { if (e?.statusCode === 404 || e?.statusCode === 410) await SB.from("push_subs").update({ deleted: true, updated_at: new Date().toISOString() }).eq("id", sub.id); }
    }
  }
  return new Response(JSON.stringify({ ok: true, at: now, sent }), { headers: { "Content-Type": "application/json" } });
});
