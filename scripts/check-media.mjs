import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const media = path.join(root, "media");
const iconSource = path.join(media, "source", "code-annotations-imagegen.png");
const expectedIcon = await sharp(iconSource)
  .ensureAlpha()
  .resize(256, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();
const actualIcon = await readFile(path.join(media, "icon.png"));
assert.deepEqual(actualIcon, expectedIcon, "media/icon.png is not a direct downsample of the accepted Imagegen source.");

await verifyAlphaPng(iconSource, undefined, undefined, "Imagegen source");
await verifyAlphaBounds(iconSource, "Imagegen icon source");
await verifyAlphaPng(path.join(media, "icon.png"), 256, 256, "Marketplace icon");
await verifyAlphaPng(path.join(media, "preview.png"), undefined, undefined, "Marketplace preview", { minWidth: 640, minHeight: 200, maxWidth: 1200, maxHeight: 800 });

const { data, info } = await sharp(path.join(media, "icon.png")).resize(32, 32, { fit: "contain" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
let visiblePixels = 0;
for (let offset = info.channels - 1; offset < data.length; offset += info.channels) {
  if (data[offset] >= 32) visiblePixels += 1;
}
assert.ok(visiblePixels >= 250, `32px icon silhouette is too sparse: ${visiblePixels} visible pixels.`);
assert.ok(visiblePixels <= 980, `32px icon exceeds the transparent safety margin: ${visiblePixels} visible pixels.`);
console.log(`Media checks passed: direct Imagegen icon, ${visiblePixels}/1024 visible pixels at 32px, native-alpha preview.`);

async function verifyAlphaPng(filename, expectedWidth, expectedHeight, label, bounds) {
  const image = sharp(filename);
  const metadata = await image.metadata();
  assert.equal(metadata.format, "png", `${label} must be PNG.`);
  if (expectedWidth !== undefined) assert.equal(metadata.width, expectedWidth, `${label} width changed.`);
  if (expectedHeight !== undefined) assert.equal(metadata.height, expectedHeight, `${label} height changed.`);
  if (bounds) verifyBounds(metadata, bounds, label);
  assert.equal(metadata.hasAlpha, true, `${label} must carry native alpha.`);
  assert.equal(metadata.channels, 4, `${label} must carry four channels.`);
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alpha = info.channels - 1;
  const corners = [
    alpha,
    (info.width - 1) * info.channels + alpha,
    (info.height - 1) * info.width * info.channels + alpha,
    (info.height * info.width - 1) * info.channels + alpha,
  ];
  assert.ok(corners.every((offset) => data[offset] === 0), `${label} corners must be transparent.`);
}

async function verifyAlphaBounds(filename, label) {
  const { data, info } = await sharp(filename).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alpha = info.channels - 1;
  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * info.channels + alpha] < 16) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  assert.ok(right >= left && bottom >= top, `${label} must contain visible pixels.`);
  const widthRatio = (right - left + 1) / info.width;
  const heightRatio = (bottom - top + 1) / info.height;
  const primaryRatio = Math.max(widthRatio, heightRatio);
  const secondaryRatio = Math.min(widthRatio, heightRatio);
  assert.ok(primaryRatio >= 0.95 && primaryRatio <= 0.99, `${label} primary axis must occupy 95-99% of the canvas; got ${(primaryRatio * 100).toFixed(1)}%.`);
  assert.ok(secondaryRatio >= 0.58, `${label} secondary axis contains excess padding; got ${(secondaryRatio * 100).toFixed(1)}%.`);
}

function verifyBounds(metadata, bounds, label) {
  assert.ok(metadata.width >= bounds.minWidth && metadata.width <= bounds.maxWidth, `${label} width must be ${bounds.minWidth}-${bounds.maxWidth}px.`);
  assert.ok(metadata.height >= bounds.minHeight && metadata.height <= bounds.maxHeight, `${label} height must be ${bounds.minHeight}-${bounds.maxHeight}px.`);
}
