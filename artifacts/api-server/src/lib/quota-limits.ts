// Centralized D&B daily quota limits, shared by the quota route (display)
// and the worker (atomic reservation at submission time).
export const COUNTRY_LIMITS: Record<string, number> = {
  IT: 5,
  DK: 20,
  NO: 20,
};

export const DEFAULT_DAILY_LIMIT = 25;

export function quotaLimitFor(countryCode: string): number {
  return COUNTRY_LIMITS[countryCode] ?? DEFAULT_DAILY_LIMIT;
}
