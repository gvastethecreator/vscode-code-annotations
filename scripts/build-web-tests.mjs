import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await build({
  entryPoints: [path.join(root, "test", "web", "suite", "index.ts")],
  bundle: true,
  format: "cjs",
  platform: "browser",
  target: "es2022",
  outfile: path.join(root, "dist", "web", "test", "suite", "index.cjs"),
  external: ["vscode"],
  sourcemap: false,
  logLevel: "info",
});
