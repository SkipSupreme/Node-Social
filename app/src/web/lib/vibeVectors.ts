// Phase 0.1 - Vibe Vector definitions and helper functions
// Core feature: Platform-wide Vibe Vectors

export type VibeIntensities = {
  [vectorSlug: string]: number; // 0.0-1.0
};

/**
 * Calculate total intensity from intensity object
 */
export function calculateTotalIntensity(intensities: VibeIntensities): number {
  return Object.values(intensities).reduce((sum, intensity) => sum + intensity, 0);
}

/**
 * Normalize intensities so they sum to 1.0 (optional, for display)
 */
export function normalizeIntensities(intensities: VibeIntensities): VibeIntensities {
  const total = calculateTotalIntensity(intensities);
  if (total === 0) return intensities;
  
  const normalized: VibeIntensities = {};
  for (const [slug, intensity] of Object.entries(intensities)) {
    normalized[slug] = intensity / total;
  }
  return normalized;
}

/**
 * Format intensity as percentage (0-100)
 */
export function formatIntensity(intensity: number): string {
  return `${Math.round(intensity * 100)}%`;
}

