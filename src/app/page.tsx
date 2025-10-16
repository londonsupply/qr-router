import Link from 'next/link';

export default function HomePage() {
  return (
    <main style={{ fontFamily: 'sans-serif', padding: 24 }}>
      <h1>QR Router</h1>
      <p>Probar: <Link href="/qr/landing">/qr/landing</Link></p>
    </main>
  );
}
