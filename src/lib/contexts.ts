// Browserbase context id per site, saved after the one-time login.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { repoRoot } from "./env.js";

const dir = resolve(repoRoot, ".sloth");
const file = resolve(dir, "contexts.json");

export function loadContexts(): Record<string, string> {
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
}

export function saveContext(site: string, id: string) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, JSON.stringify({ ...loadContexts(), [site]: id }, null, 2));
}
