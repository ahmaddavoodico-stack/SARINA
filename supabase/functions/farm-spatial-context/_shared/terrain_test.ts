import { assertEquals, assertAlmostEquals } from "jsr:@std/assert@1.0.14";
import { summarizeTerrain } from "./terrain.ts";

Deno.test("flat DEM has zero slope", () => {
  const result = summarizeTerrain(new Array(25).fill(12), 5, 5, 90, 90);
  if (!result) throw new Error("expected a terrain summary");
  assertEquals(result.elevation_min_m, 12);
  assertEquals(result.elevation_mean_m, 12);
  assertEquals(result.elevation_max_m, 12);
  assertAlmostEquals(result.mean_slope_degrees ?? -1, 0, 1e-8);
});

Deno.test("east-rising plane produces expected slope", () => {
  const values = Array.from({ length: 5 }, (_, y) =>
    Array.from({ length: 5 }, (_, x) => y * 0 + x * 9).flat()
  ).flat();
  const result = summarizeTerrain(values, 5, 5, 90, 90);
  if (!result) throw new Error("expected a terrain summary");
  assertAlmostEquals(result.mean_slope_degrees ?? -1, Math.atan(0.1) * 180 / Math.PI, 1e-5);
});

Deno.test("rejects undersized or mostly nodata rasters", () => {
  assertEquals(summarizeTerrain([1, 2, 3, 4], 2, 2, 90, 90), null);
  assertEquals(summarizeTerrain(new Array(25).fill(-32768), 5, 5, 90, 90), null);
});
