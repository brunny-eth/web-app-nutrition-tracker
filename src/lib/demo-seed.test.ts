import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { backfillDemoUser, seedDemoDay } from './demo-seed';
import { demoDayPlan } from './demo-data';

type Call = { table: string; op: string; rows?: Record<string, unknown>[] };

/**
 * A Supabase stand-in that records every round trip. The seeding runs while a
 * visitor waits on the sign-in page, so the number of trips is part of what is
 * being tested, not just the rows.
 */
function fakeSupabase(options: { seededDates?: string[]; failDate?: string } = {}) {
  const calls: Call[] = [];
  let inFlight = 0;
  let peakInFlight = 0;

  const settle = async () => {
    inFlight++;
    peakInFlight = Math.max(peakInFlight, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 1));
    inFlight--;
  };

  // entry id -> the date it belongs to, so a failure can be aimed at one day even
  // though the days are all in flight at once.
  const dateOfEntry = new Map<string, string>();

  const query = (table: string, op: string, rows?: Record<string, unknown>[]) => {
    calls.push({ table, op, rows });

    if (table === 'entries' && op === 'insert') {
      for (const row of rows ?? []) {
        dateOfEntry.set(row.id as string, row.resolved_date as string);
      }
    }

    const failing =
      options.failDate !== undefined &&
      table === 'entry_items' &&
      (rows ?? []).some((row) => dateOfEntry.get(row.entry_id as string) === options.failDate);

    const result: Record<string, unknown> = failing
      ? { data: null, error: new Error('insert blew up') }
      : { data: op === 'select' ? seededRows(table) : null, error: null };

    const thenable = {
      eq: () => thenable,
      gte: () => thenable,
      lte: () => thenable,
      in: () => thenable,
      limit: () => thenable,
      maybeSingle: () => thenable,
      select: () => thenable,
      then: (resolve: (value: unknown) => unknown) => settle().then(() => resolve(result)),
    };
    return thenable;
  };

  const seededRows = (table: string) =>
    table === 'daily_checklist'
      ? (options.seededDates ?? []).map((resolved_date) => ({ resolved_date }))
      : [];

  const client = {
    from: (table: string) => ({
      select: () => query(table, 'select'),
      insert: (rows: Record<string, unknown> | Record<string, unknown>[]) =>
        query(table, 'insert', Array.isArray(rows) ? rows : [rows]),
      upsert: (rows: Record<string, unknown>) => query(table, 'upsert', [rows]),
      update: (rows: Record<string, unknown>) => query(table, 'update', [rows]),
      delete: () => query(table, 'delete'),
    }),
  } as unknown as SupabaseClient;

  return { client, calls, peak: () => peakInFlight };
}

const rowsFor = (calls: Call[], table: string, op: string) =>
  calls.filter((c) => c.table === table && c.op === op).flatMap((c) => c.rows ?? []);

describe('seedDemoDay', () => {
  it('writes a day in a fixed handful of round trips, however many meals it has', async () => {
    const { client, calls } = fakeSupabase();
    await seedDemoDay(client, 'user-1', '2026-08-14', 'America/New_York');

    // One delete + one entries insert + one items insert + activity (delete,
    // insert) + the checklist marker. Constant in the number of entries: it used
    // to be two trips per entry, which is what made the demo slow to open.
    expect(calls).toHaveLength(6);
    expect(calls.filter((c) => c.table === 'entries' && c.op === 'insert')).toHaveLength(1);
    expect(calls.filter((c) => c.table === 'entry_items')).toHaveLength(1);
  });

  it('hangs every item off its own entry', async () => {
    const { client, calls } = fakeSupabase();
    await seedDemoDay(client, 'user-1', '2026-08-14', 'America/New_York');

    const plan = demoDayPlan('2026-08-14');
    const entryRows = rowsFor(calls, 'entries', 'insert');
    const itemRows = rowsFor(calls, 'entry_items', 'insert');

    expect(entryRows).toHaveLength(plan.entries.length);
    expect(itemRows).toHaveLength(plan.entries.flatMap((e) => e.items).length);

    // Ids are generated client-side now, so the mapping is only right if each
    // entry's items carry that entry's id and the ids are distinct.
    const ids = entryRows.map((row) => row.id as string);
    expect(new Set(ids).size).toBe(ids.length);

    let cursor = 0;
    plan.entries.forEach((entry, i) => {
      for (const item of entry.items) {
        expect(itemRows[cursor].entry_id).toBe(ids[i]);
        expect(itemRows[cursor].food_name).toBe(item.food_name);
        cursor++;
      }
    });
  });

  it('writes the checklist marker last, so a half-written day is retried', async () => {
    const { client, calls } = fakeSupabase();
    await seedDemoDay(client, 'user-1', '2026-08-14', 'America/New_York');
    expect(calls[calls.length - 1].table).toBe('daily_checklist');
  });
});

describe('backfillDemoUser', () => {
  it('fills missing days concurrently rather than one after another', async () => {
    const { client, peak } = fakeSupabase({ seededDates: [] });
    const written = await backfillDemoUser(client, 'user-1', 'America/New_York', 4);

    expect(written).toHaveLength(4);
    // Four days seeded in series would never have more than one request open.
    expect(peak()).toBeGreaterThan(1);
  });

  it('skips days that already have a checklist row', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { client, calls } = fakeSupabase({ seededDates: [today] });
    const written = await backfillDemoUser(client, 'user-1', 'UTC', 3);

    expect(written).not.toContain(today);
    expect(rowsFor(calls, 'entries', 'insert').some((row) => row.resolved_date === today)).toBe(false);
  });

  it('keeps the days that worked when one day fails', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { client } = fakeSupabase({ failDate: today });
    const written = await backfillDemoUser(client, 'user-1', 'UTC', 3);

    // The failed day has no checklist row, so the next request picks it up again.
    expect(written).toHaveLength(2);
    expect(written).not.toContain(today);
  });
});
