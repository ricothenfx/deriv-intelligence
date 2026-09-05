import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@deriv-intel/llm": resolve(process.cwd(), "../llm/src/index.ts"),
      "@deriv-intel/connectors": resolve(process.cwd(), "../connectors/src/index.ts"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
