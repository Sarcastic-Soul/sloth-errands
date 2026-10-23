// Secrets live one folder up (week3/.env) so they can never be committed with the repo.
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
config({ path: resolve(repoRoot, "../.env"), quiet: true });
config({ path: resolve(repoRoot, ".env.local"), quiet: true });

export function need(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is missing from week3/.env`);
  return value;
}

export const env = {
  model: process.env.SLOTH_MODEL ?? "groq/openai/gpt-oss-120b",
  // Stagehand's small page lookups run on the 20b model, which has its own Groq rate limit
  browserModel: process.env.SLOTH_BROWSER_MODEL ?? "groq/openai/gpt-oss-20b",
  // "local" drives Chrome on this laptop (free, for testing); "browserbase" uses cloud browsers
  browser: (process.env.SLOTH_BROWSER ?? "local") as "local" | "browserbase",
  // Where the demo sites are reachable from the browser. Browserbase needs the tunnel URL.
  demoBaseUrl: process.env.DEMO_BASE_URL ?? demoSitesUrl(),
  temporalAddress: process.env.TEMPORAL_ADDRESS ?? "localhost:7233",
  temporalNamespace: process.env.TEMPORAL_NAMESPACE ?? "default",
};

function demoSitesUrl() {
  const tunnel = resolve(repoRoot, ".sloth/tunnel-url");
  if (process.env.SLOTH_BROWSER === "browserbase" && existsSync(tunnel)) return readFileSync(tunnel, "utf8").trim();
  return "http://localhost:4100";
}
