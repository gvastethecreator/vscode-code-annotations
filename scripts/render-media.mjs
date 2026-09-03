import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const media = path.join(root, "media");

await sharp(path.join(media, "source", "code-annotations-imagegen.png"))
  .ensureAlpha()
  .resize(256, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(path.join(media, "icon.png"));

console.log("Rendered media/icon.png directly from the accepted Imagegen PNG.");
