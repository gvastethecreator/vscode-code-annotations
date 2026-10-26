const esbuild = require("esbuild");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

/** @type {import('esbuild').Plugin} */
const problemMatcher = {
  name: "esbuild-problem-matcher",
  setup(build) {
    build.onStart(() => console.log("[watch] build started"));
    build.onEnd((result) => {
      for (const { text, location } of result.errors) {
        console.error(`✘ [ERROR] ${text}`);
        if (location) console.error(`  ${location.file}:${location.line}:${location.column}:`);
      }
      console.log("[watch] build finished");
    });
  },
};

async function main() {
  const contexts = await Promise.all(
    ["dist/node/extension.cjs", "dist/web/extension.cjs"].map((outfile) =>
      esbuild.context({
        entryPoints: ["src/extension.ts"],
        bundle: true,
        format: "cjs",
        minify: production,
        sourcemap: !production,
        sourcesContent: false,
        platform: "browser",
        outfile,
        external: ["vscode"],
        logLevel: "silent",
        plugins: [problemMatcher],
      }),
    ),
  );
  if (watch) {
    await Promise.all(contexts.map((context) => context.watch()));
    return;
  }
  await Promise.all(contexts.map((context) => context.rebuild()));
  await Promise.all(contexts.map((context) => context.dispose()));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
