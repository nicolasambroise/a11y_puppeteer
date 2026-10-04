import globals from "globals";
import { defineConfig } from "eslint/config";

const renowifyGlobals = Object.fromEntries(
  [
    "beforeCheck",
    "createResultPanel",
    "activateCheckA11YPanel",
    ...Array.from(
      { length: 15 },
      (_, index) => `check_part_${String(index + 1).padStart(2, "0")}`,
    ),
  ].map((name) => [name, "readonly"]),
);

const correctnessRules = {
  "no-constant-condition": "error",
  "no-dupe-keys": "error",
  "no-undef": "error",
  "no-unreachable": "error",
  "valid-typeof": "error",
};

export default defineConfig([
  {
    ignores: ["node_modules/**", "reports/**"],
  },
  {
    files: ["crawler.js"],
    languageOptions: {
      globals: { ...globals.node, document: "readonly", window: "readonly" },
      sourceType: "commonjs",
    },
    rules: correctnessRules,
  },
  {
    files: ["report.js"],
    languageOptions: {
      globals: globals.node,
      sourceType: "commonjs",
    },
    rules: correctnessRules,
  },
  {
    files: ["audit.js"],
    languageOptions: {
      globals: { ...globals.browser, ...renowifyGlobals },
      sourceType: "script",
    },
    rules: correctnessRules,
  },
]);
