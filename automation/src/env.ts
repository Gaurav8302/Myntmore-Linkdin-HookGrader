import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Load KEY=VALUE pairs from a local env file into process.env when unset.
 * Does not override already-set environment variables.
 */
export function loadEnvFile(filePath: string): void {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

/** Load automation/.env.local then automation/.env if present. */
export function loadLocalEnv(cwd: string = process.cwd()): void {
  loadEnvFile(path.resolve(cwd, ".env.local"));
  loadEnvFile(path.resolve(cwd, ".env"));
}
