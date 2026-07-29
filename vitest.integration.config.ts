import { defineConfig } from "vitest/config";

/** Testovi koji stvarno izvršavaju Schematron; traže `npm run prepare:sef`. */
export default defineConfig({
  test: {
    include: ["packages/*/test/integration/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
  },
});
