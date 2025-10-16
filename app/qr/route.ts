import { NextResponse } from 'next/server';
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export function GET() {
  return new NextResponse('QR router alive');
}
export const HEAD = GET;
