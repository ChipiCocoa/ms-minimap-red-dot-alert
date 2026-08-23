// Minimal PNG decoder used only by tests, so fixtures can be loaded without
// a browser or an image library. Supports 8-bit RGB / RGBA / grayscale(+alpha).
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const CHANNELS = { 0: 1, 2: 3, 4: 2, 6: 4 };

function unfilter(raw, width, height, channels) {
  const bpp = channels;
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);
  let pos = 0;

  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    const line = raw.subarray(pos, pos + stride);
    pos += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;

    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0;
      const b = prev ? prev[i] : 0;
      const c = prev && i >= bpp ? prev[i - bpp] : 0;
      const x = line[i];
      let value;
      switch (filter) {
        case 0: value = x; break;
        case 1: value = x + a; break;
        case 2: value = x + b; break;
        case 3: value = x + ((a + b) >> 1); break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          value = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default: throw new Error(`unsupported PNG filter ${filter}`);
      }
      cur[i] = value & 0xff;
    }
  }
  return out;
}

/** Reads a PNG file and returns an ImageData-shaped object. */
export function readPng(path) {
  const buf = readFileSync(path);
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];

  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      if (data[12] !== 0) throw new Error('interlaced PNG is not supported');
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }

  if (bitDepth !== 8) throw new Error(`unsupported PNG bit depth ${bitDepth}`);
  const channels = CHANNELS[colorType];
  if (!channels) throw new Error(`unsupported PNG color type ${colorType}`);

  const pixels = unfilter(inflateSync(Buffer.concat(idat)), width, height, channels);
  const rgba = new Uint8ClampedArray(width * height * 4);

  for (let i = 0, p = 0; i < width * height; i++, p += 4) {
    const s = i * channels;
    if (channels >= 3) {
      rgba[p] = pixels[s];
      rgba[p + 1] = pixels[s + 1];
      rgba[p + 2] = pixels[s + 2];
      rgba[p + 3] = channels === 4 ? pixels[s + 3] : 255;
    } else {
      rgba[p] = rgba[p + 1] = rgba[p + 2] = pixels[s];
      rgba[p + 3] = channels === 2 ? pixels[s + 1] : 255;
    }
  }

  return { width, height, data: rgba };
}
