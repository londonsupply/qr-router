'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';

type Row = { dia: string; slug: string; escaneos: number; unicos: number };

export default function QrStatsPage() {
  const [days, setDays] = useState<number>(30);
  const [slug, setSlug] = useState<string>('');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams();
      p.set('days', String(days));
      if (slug.trim()) p.set('slug', slug.trim());
      const res = await fetch(`/api/qr/stats?${p.toString()}`, { cache: 'no-store' });
      const data: { ok: boolean; rows?: Row[]; error?: string } = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || res.statusText);
      setRows(data.rows ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [days, slug]);

  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(
    () => rows.reduce((a, r) => ({ escaneos: a.escaneos + r.escaneos, unicos: a.unicos + r.unicos }),
                      { escaneos: 0, unicos: 0 }),
    [rows]
  );

  function downloadCSV() {
    const header = 'dia,slug,escaneos,unicos';
    const lines = rows.map(r => `${r.dia},${r.slug},${r.escaneos},${r.unicos}`);
    const blob = new Blob([header + '\n' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr_stats_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, marginBottom: 12 }}>Estadísticas QR</h1>

      <section style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <label>
          Días:&nbsp;
          <select value={days} onChange={e => setDays(Number(e.target.value))}>
            {[7, 14, 30, 60, 90, 180, 365].map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>

        <label>
          Slug (opcional):&nbsp;
          <input
            value={slug}
            onChange={e => setSlug(e.target.value)}
            placeholder="landing / catalogo / whatsapp ..."
            style={{ padding: 6 }}
          />
        </label>

        <button onClick={load} disabled={loading} style={{ padding: '6px 12px' }}>
          {loading ? 'Cargando...' : 'Actualizar'}
        </button>

        <button onClick={downloadCSV} disabled={!rows.length} style={{ padding: '6px 12px' }}>
          Descargar CSV
        </button>
      </section>

      {error && <p style={{ color: 'crimson' }}>Error: {error}</p>}

      <div style={{ margin: '8px 0', fontSize: 14 }}>
        <strong>Total</strong> — Escaneos: {totals.escaneos} · Únicos aprox.: {totals.unicos}
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid #ddd', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f6f6f6' }}>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Día</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Slug</th>
              <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid #ddd' }}>Escaneos</th>
              <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid #ddd' }}>Únicos aprox.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.dia}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.slug}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{r.escaneos}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{r.unicos}</td>
              </tr>
            ))}
            {!rows.length && !loading && (
              <tr><td colSpan={4} style={{ padding: 12, textAlign: 'center', color: '#777' }}>Sin datos en el rango elegido.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p style={{ color: '#777', fontSize: 12, marginTop: 10 }}>
        “Únicos aprox.” = combinación de IP truncada + User-Agent (orientativo, sin PII).
      </p>
    </main>
  );
}
