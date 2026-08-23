// Builds ImageData-shaped fixtures in memory so colour thresholds can be
// exercised without hand-crafting PNG files.

/** Creates an opaque image filled with a single colour. */
export function createImage(width, height, [r, g, b] = [20, 20, 20]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let p = 0; p < data.length; p += 4) {
    data[p] = r;
    data[p + 1] = g;
    data[p + 2] = b;
    data[p + 3] = 255;
  }
  return { width, height, data };
}

/** Paints a filled rectangle, clipped to the image bounds. */
export function fillRect(image, x, y, width, height, [r, g, b]) {
  for (let dy = 0; dy < height; dy++) {
    const py = y + dy;
    if (py < 0 || py >= image.height) continue;
    for (let dx = 0; dx < width; dx++) {
      const px = x + dx;
      if (px < 0 || px >= image.width) continue;
      const p = (py * image.width + px) * 4;
      image.data[p] = r;
      image.data[p + 1] = g;
      image.data[p + 2] = b;
      image.data[p + 3] = 255;
    }
  }
  return image;
}
