// Freistellen von Produktfotos mit BiRefNet (General-dynamic, MIT-Lizenz).
// Übergangsweise über die öffentliche Demo des Entwicklers (Hugging Face Space mit ZeroGPU);
// später nur SPACE ändern (eigener Space). Der Hugging-Face-Token bleibt hier als Secret.
import { createClient } from 'npm:@supabase/supabase-js@2';

const SPACE = Deno.env.get('FREISTELLEN_SPACE') ?? 'https://zhengpeng7-birefnet-demo.hf.space';
const WEIGHTS = Deno.env.get('FREISTELLEN_WEIGHTS') ?? 'General-dynamic';
const MAX_BYTES = 10 * 1024 * 1024;
const FN_INDEX = Number(Deno.env.get('FREISTELLEN_FN_INDEX') ?? 2); // Endpunkt „/image“ der Demo

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Expose-Headers': 'x-dauer-ms',
};
const fail = (status: number, message: string) =>
  new Response(JSON.stringify({ error: message }), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return fail(405, 'Nur POST');
  const t0 = Date.now();

  // Nur angemeldete Mitglieder eines Kleiderschranks
  const auth = req.headers.get('Authorization') ?? '';
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data: who } = await sb.auth.getUser();
  if (!who?.user) return fail(401, 'Nicht angemeldet');
  const { data: ws, error: we } = await sb.from('wardrobes').select('id').limit(1);
  if (we || !ws?.length) return fail(403, 'Kein Kleiderschrank');

  const type = req.headers.get('Content-Type') ?? '';
  if (!/^image\/(jpeg|png|webp)$/.test(type)) return fail(415, 'Bitte JPEG, PNG oder WebP schicken');
  const img = new Uint8Array(await req.arrayBuffer());
  if (!img.length || img.length > MAX_BYTES) return fail(413, 'Bild leer oder größer als 10 MB');

  const token = Deno.env.get('HF_TOKEN');
  if (!token) return fail(500, 'HF_TOKEN fehlt in den Secrets');
  // Hugging Face rechnet ZeroGPU-Zeit über diesen Header deinem Konto zu (nicht über „Authorization“)
  const hf = { "x-hf-authorization": `Bearer ${token}` };

  try {
    // 1) Hochladen
    const form = new FormData();
    form.append('files', new Blob([img], { type }), 'foto.' + type.split('/')[1]);
    const up = await fetch(`${SPACE}/gradio_api/upload`, { method: 'POST', headers: hf, body: form });
    if (!up.ok) return fail(502, `Upload zum Modell fehlgeschlagen (${up.status})`);
    const [path] = (await up.json()) as string[];

    // 2) Aufruf über die Warteschlange: leere Auflösung = Originalgröße (dynamic).
    //    Dieser Weg liefert auch die Fehlermeldung von Hugging Face (z. B. Kontingent aufgebraucht).
    const session = crypto.randomUUID().replace(/-/g, '').slice(0, 11);
    const join = await fetch(`${SPACE}/gradio_api/queue/join`, {
      method: 'POST',
      headers: { ...hf, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [{ path, meta: { _type: 'gradio.FileData' } }, '', WEIGHTS], fn_index: FN_INDEX, session_hash: session, event_data: null, trigger_id: null }),
    });
    if (!join.ok) return fail(502, `Modellaufruf fehlgeschlagen (${join.status})`);

    // 3) Ergebnis abholen (Server-Sent Events)
    const res = await fetch(`${SPACE}/gradio_api/queue/data?session_hash=${session}`, { headers: hf });
    const text = await res.text();
    const msgs = text.split('\n').filter((l) => l.startsWith('data: ')).map((l) => { try { return JSON.parse(l.slice(6)); } catch { return null; } });
    const done = msgs.find((m) => m?.msg === 'process_completed');
    if (!done?.success) {
      const err = String(done?.output?.error ?? done?.title ?? '');
      if (/quota|limit|exceeded/i.test(err)) return fail(429, 'Tageskontingent der Grafikkarte aufgebraucht. ' + err.slice(0, 200));
      return fail(502, 'Modell lieferte kein Ergebnis: ' + (err || text.replace(/\s+/g, ' ').slice(0, 300)));
    }
    const out = done.output.data[0] as [unknown, { url?: string; path?: string }];
    const file = out?.[1];
    const url = file?.url ?? (file?.path ? `${SPACE}/gradio_api/file=${file.path}` : null);
    if (!url) return fail(502, 'Ergebnis ohne Datei');

    // 4) Freigestelltes PNG weitergeben
    const png = await fetch(url, { headers: hf });
    if (!png.ok) return fail(502, `Ergebnis konnte nicht geladen werden (${png.status})`);
    return new Response(png.body, {
      headers: { ...cors, 'Content-Type': png.headers.get('Content-Type') ?? 'image/png', 'x-dauer-ms': String(Date.now() - t0) },
    });
  } catch (e) {
    return fail(502, 'Fehler beim Freistellen: ' + (e instanceof Error ? e.message : String(e)));
  }
});
