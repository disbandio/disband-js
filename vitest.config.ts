import { existsSync, readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";
import { parseEnv } from "node:util";

// DISBAND_ORIGIN and DISBAND_KEY for test/dev.test.ts
const env = existsSync(".env") ? parseEnv(readFileSync(".env", "utf8")) : {};

export default defineConfig({ test: { env } });
