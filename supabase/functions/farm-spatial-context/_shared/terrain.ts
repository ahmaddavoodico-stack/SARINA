export type TerrainSummary = {
  valid_pixel_count: number;
  elevation_min_m: number;
  elevation_mean_m: number;
  elevation_max_m: number;
  mean_slope_degrees: number | null;
  max_slope_degrees: number | null;
};

export function summarizeTerrain(
  values: ArrayLike<number>,
  width: number,
  height: number,
  pixelWidthMeters: number,
  pixelHeightMeters: number,
): TerrainSummary | null {
  if (width < 3 || height < 3 || values.length !== width * height ||
      !Number.isFinite(pixelWidthMeters) || !Number.isFinite(pixelHeightMeters) ||
      pixelWidthMeters <= 0 || pixelHeightMeters <= 0) return null;

  const elevations: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const value = Number(values[i]);
    if (Number.isFinite(value) && Math.abs(value) < 12000) elevations.push(value);
  }
  if (elevations.length < Math.max(9, Math.floor(values.length * 0.5))) return null;

  let slopeSum = 0;
  let slopeCount = 0;
  let maxSlope = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const at = (row: number, col: number) => Number(values[row * width + col]);
      const z1 = at(y - 1, x - 1), z2 = at(y - 1, x), z3 = at(y - 1, x + 1);
      const z4 = at(y, x - 1), z6 = at(y, x + 1);
      const z7 = at(y + 1, x - 1), z8 = at(y + 1, x), z9 = at(y + 1, x + 1);
      if (![z1,z2,z3,z4,z6,z7,z8,z9].every(v => Number.isFinite(v) && Math.abs(v) < 12000)) continue;
      const dzdx = ((z3 + 2*z6 + z9) - (z1 + 2*z4 + z7)) / (8 * pixelWidthMeters);
      const dzdy = ((z7 + 2*z8 + z9) - (z1 + 2*z2 + z3)) / (8 * pixelHeightMeters);
      const slope = Math.atan(Math.hypot(dzdx, dzdy)) * 180 / Math.PI;
      if (!Number.isFinite(slope)) continue;
      slopeSum += slope;
      slopeCount++;
      maxSlope = Math.max(maxSlope, slope);
    }
  }

  return {
    valid_pixel_count: elevations.length,
    elevation_min_m: Math.min(...elevations),
    elevation_mean_m: elevations.reduce((sum, value) => sum + value, 0) / elevations.length,
    elevation_max_m: Math.max(...elevations),
    mean_slope_degrees: slopeCount ? slopeSum / slopeCount : null,
    max_slope_degrees: slopeCount ? maxSlope : null,
  };
}
