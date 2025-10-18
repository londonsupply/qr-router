// src/app/api/qr/stats/route.ts
export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Row = { dia: string; slug: string; escaneos: number; unicos: number };
type UnknownRecord = Record<string, unknown>;

const isRecord = (v: unknown): v is UnknownRecord =>
  typeof v === 'object' && v !== null;

const toNumber = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

function toRow(v: unknown): Row | null {
  // Soporta item directo o { json: {...} }
  const o: UnknownRecord | null = isRecord(v)
    ? (isRecord((v as UnknownRecord).json) ? ((v as UnknownRecord).json as UnknownRecord) : (v as UnknownRecord))
    : null;
  if (!o) return null;

  const dia = o.dia;
  const slug = o.slug;
  const esc = toNumber(o.escaneos);
  const uni = toNumber(o.unicos);

  if (typeof dia === 'string' && typeof slug === 'string' && esc !== null && uni !== null) {
    return { dia, slug, escaneos: esc, unicos: uni };
  }
  return null;
}

function rowsFromRowsField(v: unknown): Row[] | null {
  if (!isRecord(v)) return null;
  const rows = v['rows'];
  if (Array.isArray(rows)) {
    const out: Row[] = [];
    for (const it of rows as unknown[]) {
      const r = toRow(it);
      if (r) out.push(r);
    }
    return out;
  }
  return null;
}

function normalize(raw: unknown): Row[] {
  // A) Array directo (filas o {json:{...}}) o [{ rows:[...] }]
  if (Array.isArray(raw)) {
    const firstFromRows = rowsFromRowsField(raw[0]);
    if (firstFromRows) return firstFromRows;
    const out: Row[] = [];
    for (const it of raw) {
      const r = toRow(it);
      if (r) out.push(r);
    }
    return out;
  }
  // B) Objeto con { rows:[...] }
  const fromObj = rowsFromRowsField(raw);
  if (fromObj) return fromObj;
  // C) Fila suelta
  const single = toRow(raw);
  return single ? [single] : [];
}

export async function GET(req: Request): Promise<Response> {
  const base = (process.env.N8N_STATS_URL ?? '').trim();
  if (!base) {
    return Response.json({ ok: false, error: 'N8N_STATS_URL missing' }, { status: 500 });
  }

  const token = (process.env.N8N_STATS_TOKEN ?? '').trim();
  const headers = new Headers();
  if (token) headers.set('x-qr-token', token);

  const search = new URL(req.url).search; // ?days=&slug=
  const r = await fetch(`${base}${search}`, { headers, cache: 'no-store' });

  let raw: unknown = null;
  try {
    const ct = r.headers.get('content-type') ?? '';
    raw = ct.includes('application/json') ? await r.json() : JSON.parse(await r.text());
  } catch {
    raw = null;
  }

  if (!r.ok) {
    return Response.json({ ok: false, error: raw ?? r.statusText }, { status: r.status });
  }

  const rows = normalize(raw);
  return Response.json({ ok: true, rows }, { headers: { 'Cache-Control': 'no-store' } });
}
