/**
 * 7-day trailing averages for the trends charts.
 */

const DAY_MS = 86_400_000;

/** Midday avoids any timezone shifting a date across a boundary. */
const dateMs = (d: string) => new Date(d + 'T12:00:00').getTime();

/** Suffix for the trailing-average companion of a series, e.g. `protein` → `proteinAvg7`. */
export const AVG_SUFFIX = 'Avg7';

/** Readings needed in the window before an average means anything. */
const MIN_READINGS = 2;

/**
 * Adds a 7-day trailing average for each named field.
 *
 * Three rules, each of which showed up as a visual artifact before it existed:
 *
 * - Windowed by calendar date, not by the previous 7 rows, so a gap in logging
 *   shortens the window instead of averaging in readings from weeks back.
 * - A single reading in the window yields null. Averaging one reading just redraws
 *   it in a heavier stroke and implies smoothing that never happened.
 * - No average on a day with no reading of its own. Otherwise a sparse series like
 *   blood pressure grows a trend line that runs on past its last observation,
 *   because the window still holds earlier readings.
 *
 * Values are left unrounded; each chart's tooltip formatter decides precision.
 */
export function withTrailingAverages<T extends { date: string }>(
  points: T[],
  fields: (keyof T & string)[]
): (T & Record<string, number | null>)[] {
  return points.map((point, i) => {
    const cutoff = dateMs(point.date) - 6 * DAY_MS;
    const window = points.slice(0, i + 1).filter((w) => dateMs(w.date) >= cutoff);

    const averages: Record<string, number | null> = {};

    for (const field of fields) {
      if (point[field] == null) {
        averages[field + AVG_SUFFIX] = null;
        continue;
      }

      const values = window
        .map((w) => w[field] as unknown as number | null)
        .filter((v): v is number => v != null);

      averages[field + AVG_SUFFIX] =
        values.length >= MIN_READINGS
          ? values.reduce((sum, v) => sum + v, 0) / values.length
          : null;
    }

    return { ...point, ...averages };
  });
}
