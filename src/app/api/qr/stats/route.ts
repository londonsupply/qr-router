export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request): Promise<Response> {
  const base = process.env.N8N_STATS_URL;
  if (!base) return Response.json({ ok:false, error:'N8N_STATS_URL missing' }, { status:500 });

  const token = process.env.N8N_STATS_TOKEN ?? '';
  const search = new URL(req.url).search; // ?days=&slug=
  const r = await fetch(`${base}${search}`, {
    headers: { 'x-qr-token': token },
    cache: 'no-store'
  });

  const body = await r.text(); // conserva el status de n8n
  return new Response(body, {
    status: r.status,
    headers: { 'content-type': r.headers.get('content-type') ?? 'application/json', 'cache-control': 'no-store' }
  });
}
