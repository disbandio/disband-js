import { existsSync, readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";
import { parseEnv } from "node:util";

// DISBAND_ORIGIN and DISBAND_KEY for test/dev.test.ts, where the shell's win, so a one-off run can point elsewhere
const file = existsSync(".env") ? parseEnv(readFileSync(".env", "utf8")) : {};
const env = Object.fromEntries(Object.entries(file).filter(([name]) => process.env[name] === undefined));

export default defineConfig({ test: { env } });
