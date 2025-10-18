export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Row = { dia: string; slug: string; escaneos: number; unicos: number };
type URec = Record<string, unknown>;

const isRec = (v: unknown): v is URec => typeof v === 'object' && v !== null;

const toNum = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  return null;
};

function toRowOne(v: unknown): Row | null {
  // Soporta { json: {...} } o fila directa
  const base: URec | null = isRec(v)
    ? (isRec((v as URec).json) ? ((v as URec).json as URec) : (v as URec))
    : null;
  if (!base) return null;

  const dia = base.dia;
  const slug = base.slug;
  const esc = toNum(base.escaneos);
  const uni = toNum(base.unicos);

  if (typeof dia === 'string' && typeof slug === 'string' && esc !== null && uni !== null) {
    return { dia, slug, escaneos: esc, unicos: uni };
  }
  return null;
}

function fromRowsField(v: unknown): Row[] | null {
  if (!isRec(v)) return null;
  const rows = v['rows'];
  if (Array.isArray(rows)) {
    const out: Row[] = [];
    for (const it of rows as unknown[]) {
      const r = toRowOne(it);
      if (r) out.push(r);
    }
    return out;
  }
  return null;
}

function normalize(raw: unknown): Row[] {
  // A) Array directo (filas o {json:{...}}) o [{ rows:[...] }]
  if (Array.isArray(raw)) {
    const firstRows = fromRowsField(raw[0]);
    if (firstRows) return firstRows;
    const out: Row[] = [];
    for (const it of raw) {
      const r = toRowOne(it);
      if (r) out.push(r);
    }
    return out;
  }
  // B) Objeto con { rows:[...] }
  const rowsObj = fromRowsField(raw);
  if (rowsObj) return rowsObj;
  // C) Fila suelta
  const single = toRowOne(raw);
  return single ? [single] : [];
}

export async function GET(req: Request): Promise<Response> {
  const base = (process.env.N8N_STATS_URL ?? '').trim();
  if (!base) return Response.json({ ok:false, error:'N8N_STATS_URL missing' }, { status:500 });

  const token = (process.env.N8N_STATS_TOKEN ?? '').trim();
  const headers = new Headers();
  if (token) headers.set('x-qr-token', token);

  const url = new URL(req.url);
  const rawMode = url.searchParams.get('raw') === '1'; // <- modo diagnóstico
  const search = url.search;

  const resp = await fetch(`${base}${search}`, { headers, cache: 'no-store' });

  // Devuelve crudo en modo debug para ver QUÉ llega
  if (rawMode) {
    const text = await resp.text();
    return new Response(text, { status: resp.status, headers: { 'content-type': resp.headers.get('content-type') ?? 'application/json' } });
  }

  // Normal
  let raw: unknown = null;
  try {
    const ct = resp.headers.get('content-type') ?? '';
    raw = ct.includes('application/json') ? await resp.json() : JSON.parse(await resp.text());
  } catch { raw = null; }

  if (!resp.ok) return Response.json({ ok:false, error: raw ?? resp.statusText }, { status: resp.status });

  const rows = normalize(raw);
  return Response.json({ ok:true, rows }, { headers: { 'Cache-Control': 'no-store' } });
}
