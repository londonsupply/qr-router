import { Pool } from 'pg';

export const runtime = 'nodejs';          // usar Node (TCP) para PG
export const dynamic = 'force-dynamic';   // no cachear en build
export const revalidate = 0;

type Row = {
  dia: string;       // YYYY-MM-DD (hora AR)
  slug: string;
  escaneos: number;  // total
  unicos: number;    // aprox (ip_truncated + ua)
};

// Pool global (reutiliza conexiones en lambda)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function GET(req: Request): Promise<Response> {
  if (!process.env.DATABASE_URL) {
    return Response.json(
      { ok: false, error: 'DATABASE_URL missing' },
      { status: 500 }
    );
  }

  const url = new URL(req.url);
  const daysParam = parseInt(url.searchParams.get('days') ?? '30', 10);
  const days = Number.isFinite(daysParam) ? Math.min(Math.max(daysParam, 1), 365) : 30;
  const slug = url.searchParams.get('slug');

  // ventana de tiempo
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // query parametrizada
  const params: unknown[] = [from];
  const whereSlug = slug ? 'AND slug = $2' : '';
  if (slug) params.push(slug);

  const sql = `
    SELECT
      (ts AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS dia,
      slug,
      COUNT(*)::int AS escaneos,
      COUNT(DISTINCT (ip_truncated, ua))::int AS unicos
    FROM qr_scans
    WHERE ts >= $1
      ${whereSlug}
    GROUP BY 1,2
    ORDER BY 1 DESC, 2;
  `;

  const client = await pool.connect();
  try {
    const { rows } = await client.query<Row>(sql, params);
    return Response.json(
      { ok: true, days, slug: slug ?? null, rows },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e: unknown) {
    return Response.json(
      { ok: false, error: String(e) },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
