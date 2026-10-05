// YesYouCan · kroky z Apple Health (Supabase Edge Function).
// Robertova Zkratka (iPhone → Zkratky → Automatizace) sem každý večer a ráno pošle
// denní součet kroků a vzdálenost chůze z Apple Health:
//   POST /functions/v1/health   hlavička x-health-token: <HEALTH_TOKEN>
//   tělo {"date":"2026-10-05","steps":"6 432","km":"4,8"}   (date nepovinné = dnes v Praze)
// Zapíše do days jen kroky a km (ostatní pole dne nechá být). Token i uživatel jsou jen
// v tajemstvích Supabase (HEALTH_TOKEN, HEALTH_USER) a v ~/.yesyoucan.env.
import { createClient } from "npm:@supabase/supabase-js@2";

const SB = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
// Zkratky posílají čísla s mezerami a čárkou („6 432“, „4,8“)
const num = (v: unknown) => { if (v == null || v === "") return null; const n = Number(String(v).replace(/\s| /g, "").replace(",", ".")); return Number.isFinite(n) ? n : null; };
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "jen POST" }, 405);
  const tok = req.headers.get("x-health-token") || "";
  if (!tok || tok !== Deno.env.get("HEALTH_TOKEN")) return json({ error: "forbidden" }, 403);
  const uid = Deno.env.get("HEALTH_USER")!;
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json({ error: "tělo není JSON" }, 400); }
  const date = typeof b.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : today();
  if (date > today()) return json({ error: "budoucí den" }, 400);
  const steps = num(b.steps), km = num(b.km);
  if (steps == null || steps < 0 || steps > 100000) return json({ error: "kroky mimo 0–100 000" }, 400);
  const id = `d:${uid}:${date}`;
  const { data: row, error: e1 } = await SB.from("days").select("data,deleted").eq("id", id).maybeSingle();
  if (e1) return json({ error: e1.message }, 500);
  const cur = row && !row.deleted ? row.data : { date, meals: {}, walk_min: null, walk_kmh: null, exercise_min: 0, beers: 0, fried_g: 0, fromPlan: true };
  const at = new Date().toISOString();
  const data = { ...cur, date, steps: Math.round(steps), km: km != null && km >= 0 && km < 100 ? Math.round(km * 100) / 100 : cur.km ?? null, steps_src: "health", steps_at: at };
  const { error: e2 } = await SB.from("days").upsert({ id, user_id: uid, data, updated_at: at, deleted: false });
  if (e2) return json({ error: e2.message }, 500);
  return json({ ok: true, date, steps: data.steps, km: data.km });
});
