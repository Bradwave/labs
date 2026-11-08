/* Shared setups: JSON → deflate → base32 (letters and digits only, so the code survives any link).
   The prefix carries the format version: links posted today must keep working after updates. */
export const PREFIX = 'm1';
import { inflateRaw } from './inflate.js';
const B32 = 'abcdefghijklmnopqrstuvwxyz234567';

function toB32(bytes) {
  let out = '', bits = 0, val = 0;
  for (const b of bytes) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}
function fromB32(str) {
  const out = []; let bits = 0, val = 0;
  for (const ch of str) { const i = B32.indexOf(ch); if (i < 0) throw new Error('bad code'); val = (val << 5) | i; bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } }
  return new Uint8Array(out);
}
async function pipe(bytes, stream) {
  const s = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(s).arrayBuffer());
}
const canZip = typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

export async function encodeState(obj) {
  const raw = new TextEncoder().encode(JSON.stringify(obj));
  if (canZip) return PREFIX + 'z' + toB32(await pipe(raw, new CompressionStream('deflate-raw')));
  return PREFIX + 'j' + toB32(raw);
}
export async function decodeState(code) {
  code = String(code).trim();
  const m = /(?:#|^)(m1[zj][a-z2-7]+)/.exec(code.toLowerCase());
  if (!m) throw new Error('no code');
  const body = m[1].slice(3), kind = m[1][2];
  let bytes = fromB32(body);
  if (kind === 'z') bytes = canZip ? await pipe(bytes, new DecompressionStream('deflate-raw')) : inflateRaw(bytes); // older Safari: our own decoder
  return JSON.parse(new TextDecoder().decode(bytes));
}
