import { describe, it, expect } from 'vitest';
import { withTrailingAverages } from './trailing-average';

/** Build a dated series; null means "no reading that day". */
function series(entries: Array<[string, number | null]>) {
  return entries.map(([date, bp]) => ({ date, bp }));
}

describe('withTrailingAverages', () => {
  it('averages the trailing 7 calendar days', () => {
    const result = withTrailingAverages(
      series([
        ['2026-07-26', 10],
        ['2026-07-27', 20],
        ['2026-07-28', 30],
      ]),
      ['bp']
    );

    expect(result[0].bpAvg7).toBeNull(); // one reading isn't an average
    expect(result[1].bpAvg7).toBe(15);
    expect(result[2].bpAvg7).toBe(20);
  });

  it('caps the window at 7 calendar days, not 7 rows', () => {
    // A gap should shorten the window rather than reach back further in time.
    const result = withTrailingAverages(
      series([
        ['2026-07-01', 100],
        ['2026-07-02', 100],
        ['2026-07-20', 40],
        ['2026-07-21', 60],
      ]),
      ['bp']
    );

    // July 21's window is the 15th onward, so only the 20th and 21st count.
    expect(result[3].bpAvg7).toBe(50);
  });

  it('draws no average on a day with no reading of its own', () => {
    // The bug this prevents: a sparse series like blood pressure grew a trend line
    // running past its last reading, because the window still held earlier ones.
    const result = withTrailingAverages(
      series([
        ['2026-07-27', 120],
        ['2026-07-28', 118],
        ['2026-07-29', null], // food logged, blood pressure not
      ]),
      ['bp']
    );

    expect(result[1].bpAvg7).toBe(119);
    expect(result[2].bpAvg7).toBeNull();
  });

  it('still includes earlier gap days in a later average', () => {
    // Skipping the average on a blank day must not drop that day's neighbours from
    // the window — only the blank day itself has no value to contribute.
    const result = withTrailingAverages(
      series([
        ['2026-07-27', 10],
        ['2026-07-28', null],
        ['2026-07-29', 20],
      ]),
      ['bp']
    );

    expect(result[2].bpAvg7).toBe(15);
  });

  it('needs two readings before reporting an average', () => {
    const result = withTrailingAverages(
      series([
        ['2026-07-01', 50],
        ['2026-07-20', 80], // window holds only this one
      ]),
      ['bp']
    );

    expect(result[0].bpAvg7).toBeNull();
    expect(result[1].bpAvg7).toBeNull();
  });

  it('handles several fields independently', () => {
    const points = [
      { date: '2026-07-27', sys: 120, dia: 80 },
      { date: '2026-07-28', sys: 130, dia: null },
    ];

    const result = withTrailingAverages(points, ['sys', 'dia']);

    expect(result[1].sysAvg7).toBe(125);
    expect(result[1].diaAvg7).toBeNull();
  });

  it('leaves the original points untouched', () => {
    const points = series([['2026-07-27', 10], ['2026-07-28', 20]]);
    const result = withTrailingAverages(points, ['bp']);

    expect(points[1]).not.toHaveProperty('bpAvg7');
    expect(result[1].bp).toBe(20);
  });

  it('handles an empty series', () => {
    expect(withTrailingAverages(series([]), ['bp'])).toEqual([]);
  });
});
