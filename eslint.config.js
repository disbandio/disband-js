import { defineConfig, includeIgnoreFile } from "eslint/config";
import perfectionist from "eslint-plugin-perfectionist";
import prettier from "eslint-config-prettier";
import ts from "typescript-eslint";
import path from "node:path";
import js from "@eslint/js";

export default defineConfig(
	includeIgnoreFile(path.resolve(import.meta.dirname, ".gitignore")),
	js.configs.recommended,
	ts.configs.recommended,
	prettier,
	{
		plugins: { perfectionist },
		rules: {
			// packages, then relative, each longest first
			"perfectionist/sort-imports": [
				"error",
				{
					type: "line-length",
					order: "desc",
					groups: [
						["builtin", "external"],
						["parent", "sibling", "index"],
					],
					newlinesBetween: 1,
				},
			],
			"no-undef": "off",
			"@typescript-eslint/no-explicit-any": "error",
			"@typescript-eslint/no-non-null-assertion": "error",
		},
	},
);
