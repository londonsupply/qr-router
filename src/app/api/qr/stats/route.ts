// src/app/api/qr/stats/route.ts
export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Row = { dia: string; slug: string; escaneos: number; unicos: number };
type UnknownRecord = Record<string, unknown>;

function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === 'object' && v !== null;
}

function toNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toRow(v: unknown): Row | null {
  // Soporta { json: {...} } o fila directa
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

function getRowsFromRowsField(v: unknown): Row[] | null {
  if (!isRecord(v)) return null;
  const rowsField = v.rows;
  if (Array.isArray(rowsField)) {
    const out: Row[] = [];
    for (const it of rowsField as unknown[]) {
      const r = toRow(it);
      if (r) out.push(r);
    }
    return out;
  }
  return null;
}

function normalize(raw: unknown): Row[] {
  // A) Array de filas (directas o {json:{...}}), o bien [{ rows: [...] }]
  if (Array.isArray(raw)) {
    const out: Row[] = [];
    // Caso [{ rows: [...] }]
    const firstRows = getRowsFromRowsField(raw[0]);
    if (firstRows) return firstRows;

    for (const it of raw) {
      const r = toRow(it);
      if (r) out.push(r);
    }
    return out;
  }

  // B) Objeto con { rows: [...] }
  const rowsFromObj = getRowsFromRowsField(raw);
  if (rowsFromObj) return rowsFromObj;

  // C) Fila suelta
  const single = toRow(raw);
  return single ? [single] : [];
}

export async function GET(req: Request): Promise<Response> {
  const base = process.env.N8N_STATS_URL;
  if (!base) {
    return Response.json({ ok: false, error: 'N8N_STATS_URL missing' }, { status: 500 });
  }

  const token = (process.env.N8N_STATS_TOKEN ?? '').trim();
  const headers = new Headers();
  if (token) headers.set('x-qr-token', token);

  const search = new URL(req.url).search; // ?days=&slug=
  const r = await fetch(`${base}${search}`, { headers, cache: 'no-store' });

  // Parseo seguro del body
  let raw: unknown = null;
  try {
    const ct = r.headers.get('content-type') ?? '';
    if (ct.includes('application/json')) {
      raw = await r.json();
    } else {
      const txt = await r.text();
      try { raw = JSON.parse(txt) as unknown; } catch { raw = null; }
    }
  } catch {
    raw = null;
  }

  if (!r.ok) {
    return Response.json({ ok: false, error: raw ?? r.statusText }, { status: r.status });
  }

  const rows = normalize(raw);
  return Response.json({ ok: true, rows }, { headers: { 'Cache-Control': 'no-store' } });
}
