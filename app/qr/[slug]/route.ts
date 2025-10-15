import type { NextRequest } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const MAP: Record<string, string> = {
  landing: 'https://destino-actual.com',
  catalogo: 'https://mi-sitio.com/catalogo',
  whatsapp: 'https://wa.me/5491112345678',
};

function withUTM(url: string, slug: string) {
  const u = new URL(url);
  u.searchParams.set('utm_source', 'qr');
  u.searchParams.set('utm_medium', 'print');
  u.searchParams.set('utm_campaign', slug);
  return u.toString();
}

// Compatible Next 14/15: params puede venir como objeto o como Promise
export async function GET(
  req: NextRequest,
  ctx:
    | { params: { slug: string } }
    | { params: Promise<{ slug: string }> }
    | any
) {
  const p: any = ctx?.params;
  const slug: string =
    typeof p?.then === 'function' ? (await p).slug : p?.slug ?? 'landing';

  const raw = MAP[slug] ?? MAP['landing'] ?? 'https://mi-sitio.com';
  const dest = withUTM(raw, slug);

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
  const ua = req.headers.get('user-agent') ?? '';
  const ref = req.headers.get('referer') ?? '';
  const country = req.headers.get('x-vercel-ip-country') ?? '';
  const region = req.headers.get('x-vercel-ip-country-region') ?? '';
  const city = req.headers.get('x-vercel-ip-city') ?? '';

  const webhook = process.env.N8N_WEBHOOK_URL;
  if (webhook) {
    fetch(webhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ts: new Date().toISOString(),
        slug,
        dest: raw,
        ip_truncated: ip.replace(/\.\d+$/, '.0'),
        ua,
        ref,
        country,
        region,
        city,
      }),
      keepalive: true,
    }).catch(() => {});
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: dest,
      'Cache-Control': 'no-store, no-cache, max-age=0',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
