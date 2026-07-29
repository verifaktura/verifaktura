import { defineConfig } from "vitest/config";

/**
 * Unit testovi ne smiju trebati validacione artefakte.
 *
 * `sef/*.json` nastaje tek uz `npm run prepare:sef` (mreža, ~2 min), pa bi
 * testovi koji ga trebaju u običnom `npm test` pucali s ENOENT-om na svakoj
 * čistoj kopiji repoa i u CI matrici. Zato žive u `test/integration` i vrte se
 * zasebnom naredbom, nakon pripreme artefakata.
 */
export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.ts"],
    exclude: ["**/test/integration/**"],
    environment: "node",
  },
});
