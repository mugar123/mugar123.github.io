import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

const W = 1200, H = 630, cell = 32;
const grid = Array.from({ length: Math.ceil(W / cell) }, (_, i) => `<line x1="${i * cell}" y1="0" x2="${i * cell}" y2="${H}" stroke="#DADDD8"/>`).join('')
  + Array.from({ length: Math.ceil(H / cell) }, (_, i) => `<line x1="0" y1="${i * cell}" x2="${W}" y2="${i * cell}" stroke="#DADDD8"/>`).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#F2F3F1"/>${grid}
  <ellipse cx="900" cy="315" rx="230" ry="88" fill="none" stroke="#121412" stroke-dasharray="6 8" stroke-width="2"/>
  <ellipse cx="900" cy="315" rx="150" ry="57" fill="none" stroke="#121412" stroke-dasharray="6 8" stroke-width="2"/>
  <circle cx="900" cy="315" r="70" fill="#5E6B7A"/><circle cx="1130" cy="315" r="11" fill="#E2401C"/>
  <text x="80" y="300" font-family="serif" font-size="64" fill="#121412">Nicolás Muñoz</text>
  <text x="80" y="360" font-family="serif" font-size="34" fill="#121412">Physics student at Salamanca.</text>
  <text x="80" y="404" font-family="serif" font-style="italic" font-size="34" fill="#121412">Already in orbit.</text>
  <text x="80" y="560" font-family="monospace" font-size="18" fill="#6A6F69" letter-spacing="2">MUGAR123.GITHUB.IO · §0 ABSTRACT</text>
</svg>`;
await writeFile('public/og.png', await sharp(Buffer.from(svg)).png().toBuffer());
console.log('wrote public/og.png');
