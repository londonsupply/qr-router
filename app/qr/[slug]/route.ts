import type { NextRequest } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const MAP: Record<string, string> = {
  landing: 'https://www.registroslondonsupply.com',
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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> } // 👈 Next 15 espera Promise aquí
) {
  const { slug } = await context.params;

  const raw = MAP[slug] ?? MAP['landing'] ?? 'https://mi-sitio.com';
  const dest = withUTM(raw, slug);

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
  const ua = request.headers.get('user-agent') ?? '';
  const ref = request.headers.get('referer') ?? '';
  const country = request.headers.get('x-vercel-ip-country') ?? '';
  const region = request.headers.get('x-vercel-ip-country-region') ?? '';
  const city = request.headers.get('x-vercel-ip-city') ?? '';

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
        ua, ref, country, region, city,
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
