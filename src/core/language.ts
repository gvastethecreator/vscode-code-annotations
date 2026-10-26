const EXTENSIONS = new Map<string, string>([
  [".c", "c"], [".cc", "cpp"], [".cpp", "cpp"], [".cxx", "cpp"], [".h", "c"], [".hpp", "cpp"],
  [".cs", "csharp"], [".dart", "dart"], [".go", "go"], [".java", "java"], [".js", "javascript"],
  [".jsx", "javascriptreact"], [".jsonc", "jsonc"], [".kt", "kotlin"], [".kts", "kotlin"], [".m", "objective-c"],
  [".mm", "objective-cpp"], [".php", "php"], [".rs", "rust"], [".swift", "swift"], [".ts", "typescript"],
  [".tsx", "typescriptreact"], [".css", "css"], [".less", "less"], [".scss", "scss"], [".html", "html"],
  [".htm", "html"], [".xml", "xml"], [".xsl", "xsl"], [".vue", "vue"], [".svelte", "svelte"], [".astro", "astro"],
  [".md", "markdown"], [".mdx", "mdx"], [".py", "python"], [".pyw", "python"], [".sh", "shellscript"],
  [".bash", "shellscript"], [".zsh", "shellscript"], [".fish", "shellscript"], [".yaml", "yaml"], [".yml", "yaml"],
  [".toml", "toml"], [".rb", "ruby"], [".pl", "perl"], [".ps1", "powershell"], [".r", "r"],
]);

export function inferLanguageId(path: string): string {
  const normalized = path.replaceAll("\\", "/");
  const basename = normalized.slice(normalized.lastIndexOf("/") + 1).toLowerCase();
  if (basename === "dockerfile" || basename.startsWith("dockerfile.")) return "dockerfile";
  if (basename === "makefile" || basename.startsWith("makefile.")) return "makefile";
  const dot = basename.lastIndexOf(".");
  return dot === -1 ? "plaintext" : (EXTENSIONS.get(basename.slice(dot)) ?? "plaintext");
}
