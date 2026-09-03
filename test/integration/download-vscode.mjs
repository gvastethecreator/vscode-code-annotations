import { setTimeout as delay } from "node:timers/promises";
import { downloadAndUnzipVSCode } from "@vscode/test-electron";

const MAXIMUM_ATTEMPTS = 3;

export async function downloadVSCode(version) {
  let lastError;
  for (let attempt = 1; attempt <= MAXIMUM_ATTEMPTS; attempt += 1) {
    try {
      return await downloadAndUnzipVSCode(version);
    } catch (error) {
      lastError = error;
      if (attempt === MAXIMUM_ATTEMPTS) break;
      const delayMs = attempt * 2_000;
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`VS Code download attempt ${attempt} failed (${reason}); retrying in ${delayMs} ms.`);
      await delay(delayMs);
    }
  }
  throw lastError;
}
