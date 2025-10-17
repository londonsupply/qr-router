// scripts/make-qr.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import QRCode from 'qrcode';

// Cómo usar:
//   npm run make-qr -- https://tu-host-o-dominio "landing,catalogo,whatsapp" public/qr
//     ^ dominio base               ^ slugs separados por coma           ^ carpeta salida (opcional)
//
// También podés usar variables de entorno:
//   $env:QR_DOMAIN="https://tu-host"; $env:QR_SLUGS="landing,catalogo"; npm run make-qr

const domainArg = (process.env.QR_DOMAIN || process.argv[2] || '').replace(/\/$/, '');
if (!/^https?:\/\//i.test(domainArg)) {
  console.error('Uso: npm run make-qr -- https://host-o-dominio [slugs] [outDir]');
  process.exit(1);
}

const slugs = (process.env.QR_SLUGS || process.argv[3] || 'landing,catalogo,whatsapp')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const outDir = process.env.QR_OUT_DIR || process.argv[4] || 'qr-codes'; // usa "public/qr" si querés servirlos
await fs.mkdir(outDir, { recursive: true });

for (const s of slugs) {
  const url = `${domainArg}/qr/${s}`;
  const pngPath = path.join(outDir, `qr_${s}.png`);
  const svgPath = path.join(outDir, `qr_${s}.svg`);

  await QRCode.toFile(pngPath, url, { errorCorrectionLevel: 'Q', margin: 4, width: 1024 });
  await QRCode.toFile(svgPath, url, { errorCorrectionLevel: 'Q', margin: 4, type: 'svg' });

  console.log('OK', s, '→', url);
}

console.log(`\nListo: ${slugs.length * 2} archivos en ${outDir}`);
