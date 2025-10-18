// src/app/api/qr/stats/route.ts
export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Row = { dia: string; slug: string; escaneos: number; unicos: number };
type UnknownRecord = Record<string, unknown>;

function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === 'object' && v !== null;
}

function isRow(v: unknown): v is Row {
  if (!isRecord(v)) return false;
  return (
    typeof v.dia === 'string' &&
    typeof v.slug === 'string' &&
    typeof v.escaneos === 'number' &&
    typeof v.unicos === 'number'
  );
}

function getRowsFromRowsField(v: unknown): Row[] | null {
  if (!isRecord(v)) return null;
  const rows = v['rows'];
  if (Array.isArray(rows) && rows.every(isRow)) return rows as Row[];
  return null;
}

function normalize(raw: unknown): Row[] {
  // A) Array de filas directas
  if (Array.isArray(raw) && raw.every(isRow)) return raw as Row[];

  // B) Array de { json: Row }
  if (Array.isArray(raw)) {
    const collected: Row[] = [];
    for (const item of raw) {
      if (isRecord(item)) {
        const jsonVal = (item as UnknownRecord)['json'];
        if (isRow(jsonVal)) collected.push(jsonVal);
      }
    }
    if (collected.length) return collected;

    // C) Array cuyo primer elemento tiene { rows: Row[] }
    const fromFirst = getRowsFromRowsField(raw[0]);
    if (fromFirst) return fromFirst;

    return [];
  }

  // D) Objeto con { rows: Row[] }
  const fromObj = getRowsFromRowsField(raw);
  if (fromObj) return fromObj;

  return [];
}

export async function GET(req: Request): Promise<Response> {
  const base = process.env.N8N_STATS_URL;
  if (!base) {
    return Response.json({ ok: false, error: 'N8N_STATS_URL missing' }, { status: 500 });
  }

  const token = process.env.N8N_STATS_TOKEN ?? '';
  const search = new URL(req.url).search;

  const headers: HeadersInit | undefined = token ? { 'x-qr-token': token } : undefined;
  const r = await fetch(`${base}${search}`, { headers, cache: 'no-store' });

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
