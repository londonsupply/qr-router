import type { NextRequest } from 'next/server';
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const MAP: Record<string, string> = {
  landing:  'https://www.registroslondonsupply.com',
  catalogo: 'https://www.registroslondonsupply.com/catalogo',
  whatsapp: 'https://wa.me/54911XXXXXXXX',
};

function withUTM(url: string, slug: string) {
  const u = new URL(url);
  u.searchParams.set('utm_source','qr');
  u.searchParams.set('utm_medium','print');
  u.searchParams.set('utm_campaign', slug);
  return u.toString();
}

type ParamCtx = { params: Promise<{ slug: string }> };
type LogPayload = Record<string, unknown>;

async function resolveParams(ctx: ParamCtx) {
  const { slug } = await ctx.params;
  const key = slug || 'landing';
  const raw = MAP[key] ?? MAP.landing;
  return { slug: key, raw, dest: withUTM(raw, key) };
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

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort('timeout'), 400); // máx 400ms de espera

  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ts: new Date().toISOString(),
        ip_truncated: ip.includes(':') ? ip : ip.replace(/\.\d+$/, '.0'),
        ua, ref, country, region, city,
        ...payload,
      }),
      keepalive: true,
      signal: ac.signal,
    });
  } catch {
    // silencioso: no bloquea el redirect
  } finally {
    clearTimeout(t);
  }
}


export async function GET(req: NextRequest, ctx: ParamCtx) {
  const { slug, raw, dest } = await resolveParams(ctx);
  // Espera el log (hasta 400ms) para que no se pierda al redirigir
  await sendLog(req, { slug, dest: raw, method: 'GET' });
  return new Response(null, {
    status: 302,
    headers: {
      Location: dest,
      'Cache-Control': 'no-store, no-cache, max-age=0',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

export async function HEAD(req: NextRequest, ctx: ParamCtx) {
  const { slug, raw, dest } = await resolveParams(ctx);
  await sendLog(req, { slug, dest: raw, method: 'HEAD' });
  return new Response(null, { status: 302, headers: { Location: dest } });
}


