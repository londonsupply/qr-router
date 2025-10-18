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
  // A) n8n devuelve array de filas
  if (Array.isArray(raw) && raw.every(isRow)) return raw as Row[];

  // B) n8n devuelve [{ rows: [...] }]
  if (Array.isArray(raw) && raw.length > 0) {
    const first = raw[0] as unknown;
    if (typeof first === 'object' && first !== null) {
      const rowsCandidate = (first as Record<string, unknown>).rows;
      if (Array.isArray(rowsCandidate) && rowsCandidate.every(isRow)) {
        return rowsCandidate as Row[];
      }
    }
  }

  // C) n8n devuelve { rows: [...] }
  if (typeof raw === 'object' && raw !== null) {
    const rowsCandidate = (raw as Record<string, unknown>).rows;
    if (Array.isArray(rowsCandidate) && rowsCandidate.every(isRow)) {
      return rowsCandidate as Row[];
    }
  }

  return [];
}

export async function GET(req: Request): Promise<Response> {
  const base = process.env.N8N_STATS_URL;
  if (!base) {
    return Response.json({ ok: false, error: 'N8N_STATS_URL missing' }, { status: 500 });
  }

  const token = process.env.N8N_STATS_TOKEN ?? '';
  const search = new URL(req.url).search; // ?days=&slug=

  const r = await fetch(`${base}${search}`, {
    headers: token ? { 'x-qr-token': token } : undefined,
    cache: 'no-store',
  });

  // Intentá parsear JSON de forma segura
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
