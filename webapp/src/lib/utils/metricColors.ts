/**
 * Metric visualization color constants
 * Centralized color management for metric visualizations
 */

// Metric visualization color constants
export const METRIC_COLORS = {
  positive: 'bg-green-500',    // Good outcome (yes for sport, no for alcohol)
  negative: 'bg-red-500',      // Bad outcome
  neutral: 'bg-gray-600',      // Missing/no data
  primary: 'bg-blue-600',      // For selected states, buttons
} as const

/**
 * Get the appropriate color class for a metric value based on direction
 * @param value - The metric value (true/false/null)
 * @param direction - Whether the metric is positive (higher=better) or negative (higher=worse)
 * @returns Tailwind CSS color class
 */
export function getMetricColor(
  value: boolean | null,
  direction: 'positive' | 'negative'
): string {
  if (value === null) return METRIC_COLORS.neutral

  const isPositiveOutcome = direction === 'positive' ? value : !value
  return isPositiveOutcome ? METRIC_COLORS.positive : METRIC_COLORS.negative
}
