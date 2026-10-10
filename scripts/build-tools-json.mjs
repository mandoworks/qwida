// Builds public/tools/tools.json: app stack from package.json + package-lock.json.
// Hand-written fields (people, practice, services, timelapses) live in public/tools/tools.base.json.
import { readFileSync, writeFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const base = JSON.parse(readFileSync("scripts/tools-base.json", "utf8"));

const groups = {
  Framework: ["next", "react", "react-dom", "typescript", "tailwindcss", "@tailwindcss/turbopack"],
  AI: ["ai", "@ai-sdk/openai", "@ai-sdk/gateway"],
  Data: ["@upstash/redis", "zod"],
  Testing: ["vitest", "@playwright/test"],
  Tooling: ["eslint", "eslint-config-next", "@types/node", "@types/react", "@types/react-dom"],
};

const declared = { ...pkg.dependencies, ...pkg.devDependencies };
const placed = new Set(Object.values(groups).flat());
const missing = Object.keys(declared).filter((n) => !placed.has(n));
if (missing.length) groups.Tooling.push(...missing);

const stack = Object.entries(groups).map(([group, names]) => ({
  group,
  packages: names
    .filter((n) => declared[n])
    .map((name) => ({ name, version: lock.packages[`node_modules/${name}`].version })),
}));

writeFileSync("public/tools/tools.json", JSON.stringify({ ...base, stack }, null, 2) + "\n");
console.log("wrote public/tools/tools.json");
