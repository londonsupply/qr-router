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

type ParamCtx = { params: Promise<{ slug: string }> };
type Resolved = { slug: string; raw: string; dest: string };
type LogPayload = Record<string, unknown>; // 👈 en vez de "any"

async function resolveParams(ctx: ParamCtx): Promise<Resolved> {
  const { slug } = await ctx.params; // Next 15 entrega Promise
  const key = slug || 'landing';
  const raw = MAP[key] ?? MAP['landing'] ?? 'https://mi-sitio.com';
  const dest = withUTM(raw, key);
  return { slug: key, raw, dest };
}

async function sendLog(req: NextRequest, payload: LogPayload): Promise<void> {
  const webhook = process.env.N8N_WEBHOOK_URL;
  if (!webhook) return;

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
  const ua = req.headers.get('user-agent') ?? '';
  const ref = req.headers.get('referer') ?? '';
  const country = req.headers.get('x-vercel-ip-country') ?? '';
  const region = req.headers.get('x-vercel-ip-country-region') ?? '';
  const city = req.headers.get('x-vercel-ip-city') ?? '';

  fetch(webhook, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ts: new Date().toISOString(),
      ip_truncated: ip.includes(':') ? ip : ip.replace(/\.\d+$/, '.0'),
      ua, ref, country, region, city,
      ...payload,
    }),
    keepalive: true,
  }).catch(() => {});
}

export async function GET(req: NextRequest, ctx: ParamCtx) {
  const { slug, raw, dest } = await resolveParams(ctx);
  // log no bloqueante
  sendLog(req, { slug, dest: raw });
  return new Response(null, {
    status: 302,
    headers: {
      Location: dest,
      'Cache-Control': 'no-store, no-cache, max-age=0',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

export async function HEAD(_req: NextRequest, ctx: ParamCtx) {
  const { dest } = await resolveParams(ctx);
  return new Response(null, { status: 302, headers: { Location: dest } });
}
