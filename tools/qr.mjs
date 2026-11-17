#!/usr/bin/env node
// Labs · tools/qr.mjs
// Writes the QR code of a URL as SVG, with the kit's own encoder (kit/qr.js: no dependencies), e.g. for a
// worksheet: node tools/qr.mjs "https://labs.matephis.com/collision-lab/#p=urti/s4" s4.svg
// Usage: node tools/qr.mjs <url> [out.svg]     without out.svg the SVG goes to standard output
import { writeFileSync } from "node:fs";
import { qrSVG, qrMatrix } from "../kit/qr.js";

const [url, out] = process.argv.slice(2);
if (!url) {
  console.error('Usage: node tools/qr.mjs <url> [out.svg]');
  process.exit(1);
}
try {
  const svg = qrSVG(url, { title: url });
  if (!out) process.stdout.write(svg + "\n");
  else {
    writeFileSync(out, svg + "\n");
    const q = qrMatrix(url);
    console.log(`${out}: version ${q.version}, level ${q.ecl}, ${q.size} × ${q.size} modules, ${url.length} characters`);
  }
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
