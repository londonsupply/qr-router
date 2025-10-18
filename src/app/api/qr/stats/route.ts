// src/app/api/qr/stats/route.ts
export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Row = { dia: string; slug: string; escaneos: number; unicos: number };

function isRow(v: unknown): v is Row {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.dia === 'string' &&
    typeof o.slug === 'string' &&
    typeof o.escaneos === 'number' &&
    typeof o.unicos === 'number'
  );
}

function normalize(raw: unknown): Row[] {
  // A) Array de filas directas
  if (Array.isArray(raw) && raw.every(isRow)) return raw as Row[];

  // B) Array de { json: Row }
  if (Array.isArray(raw)) {
    const asJson = raw
      .map((it) => (typeof it === 'object' && it !== null ? (it as any).json : null))
      .filter((x) => x !== null);
    if (asJson.length && asJson.every(isRow)) return asJson as Row[];
  }

  // C) { rows: Row[] } o [{ rows: Row[] }]
  if (typeof raw === 'object' && raw !== null) {
    const rows1 = (raw as any).rows;
    if (Array.isArray(rows1) && rows1.every(isRow)) return rows1 as Row[];
  }
  if (Array.isArray(raw) && raw.length > 0) {
    const first: any = raw[0];
    const rows2 = first?.rows;
    if (Array.isArray(rows2) && rows2.every(isRow)) return rows2 as Row[];
  }

  return [];
}

export async function GET(req: Request): Promise<Response> {
  const base = process.env.N8N_STATS_URL;
  if (!base) return Response.json({ ok: false, error: 'N8N_STATS_URL missing' }, { status: 500 });

  const token = process.env.N8N_STATS_TOKEN ?? '';
  const search = new URL(req.url).search;

  const r = await fetch(`${base}${search}`, {
    headers: token ? { 'x-qr-token': token } : undefined,
    cache: 'no-store',
  });

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
