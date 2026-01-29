import { describe, it, expect } from 'vitest';
import {
  resolveDate,
  isValidDateString,
  getTodayInTimezone,
  getYesterdayInTimezone,
  formatDateForDisplay,
  isToday,
  isYesterday,
} from './date-resolution';

describe('Date Resolution', () => {
  describe('resolveDate', () => {
    it('should use explicit date when provided', () => {
      const result = resolveDate(
        '2026-01-15',
        '2026-01-29T10:00:00Z',
        'America/New_York'
      );
      expect(result.resolved_date).toBe('2026-01-15');
      expect(result.explicit_date_in_text).toBe(true);
    });

    it('should use client timestamp when no explicit date', () => {
      const result = resolveDate(
        null,
        '2026-01-29T15:00:00Z', // 10am ET
        'America/New_York'
      );
      expect(result.resolved_date).toBe('2026-01-29');
      expect(result.explicit_date_in_text).toBe(false);
    });

    it('should ignore invalid explicit date and use timestamp', () => {
      const result = resolveDate(
        'not-a-date',
        '2026-01-29T15:00:00Z',
        'America/New_York'
      );
      expect(result.resolved_date).toBe('2026-01-29');
      expect(result.explicit_date_in_text).toBe(false);
    });
  });

  describe('Timezone edge cases', () => {
    it('should resolve 11:58pm ET to today', () => {
      // 11:58pm ET on Jan 29 = 4:58am UTC on Jan 30
      const result = resolveDate(
        null,
        '2026-01-30T04:58:00Z',
        'America/New_York'
      );
      expect(result.resolved_date).toBe('2026-01-29');
    });

    it('should resolve 12:02am ET to the new day', () => {
      // 12:02am ET on Jan 30 = 5:02am UTC on Jan 30
      const result = resolveDate(
        null,
        '2026-01-30T05:02:00Z',
        'America/New_York'
      );
      expect(result.resolved_date).toBe('2026-01-30');
    });

    it('should work correctly with London timezone', () => {
      // 11:58pm London on Jan 29 = 11:58pm UTC on Jan 29
      const result = resolveDate(
        null,
        '2026-01-29T23:58:00Z',
        'Europe/London'
      );
      expect(result.resolved_date).toBe('2026-01-29');
    });

    it('should resolve 12:02am London to the new day', () => {
      // 12:02am London on Jan 30 = 12:02am UTC on Jan 30
      const result = resolveDate(
        null,
        '2026-01-30T00:02:00Z',
        'Europe/London'
      );
      expect(result.resolved_date).toBe('2026-01-30');
    });

    it('should handle Pacific timezone correctly', () => {
      // 11:58pm PT on Jan 29 = 7:58am UTC on Jan 30
      const result = resolveDate(
        null,
        '2026-01-30T07:58:00Z',
        'America/Los_Angeles'
      );
      expect(result.resolved_date).toBe('2026-01-29');
    });

    it('should handle Tokyo timezone correctly', () => {
      // 11:58pm Tokyo on Jan 29 = 2:58pm UTC on Jan 29
      const result = resolveDate(
        null,
        '2026-01-29T14:58:00Z',
        'Asia/Tokyo'
      );
      expect(result.resolved_date).toBe('2026-01-29');
    });
  });

  describe('isValidDateString', () => {
    it('should accept valid YYYY-MM-DD', () => {
      expect(isValidDateString('2026-01-29')).toBe(true);
      expect(isValidDateString('2026-12-31')).toBe(true);
    });

    it('should reject invalid formats', () => {
      expect(isValidDateString('01-29-2026')).toBe(false);
      expect(isValidDateString('2026/01/29')).toBe(false);
      expect(isValidDateString('yesterday')).toBe(false);
      expect(isValidDateString('')).toBe(false);
    });

    it('should reject invalid dates', () => {
      expect(isValidDateString('2026-02-30')).toBe(false); // Feb 30 doesn't exist
      expect(isValidDateString('2026-13-01')).toBe(false); // Month 13
    });
  });

  describe('getTodayInTimezone', () => {
    it('should return YYYY-MM-DD format', () => {
      const today = getTodayInTimezone('America/New_York');
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('getYesterdayInTimezone', () => {
    it('should return day before today', () => {
      const today = getTodayInTimezone('America/New_York');
      const yesterday = getYesterdayInTimezone('America/New_York');
      
      const todayDate = new Date(today);
      const yesterdayDate = new Date(yesterday);
      
      const diffDays = (todayDate.getTime() - yesterdayDate.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBe(1);
    });
  });

  describe('isToday and isYesterday', () => {
    it('should correctly identify today', () => {
      const today = getTodayInTimezone('America/New_York');
      expect(isToday(today, 'America/New_York')).toBe(true);
      expect(isYesterday(today, 'America/New_York')).toBe(false);
    });

    it('should correctly identify yesterday', () => {
      const yesterday = getYesterdayInTimezone('America/New_York');
      expect(isToday(yesterday, 'America/New_York')).toBe(false);
      expect(isYesterday(yesterday, 'America/New_York')).toBe(true);
    });
  });

  describe('formatDateForDisplay', () => {
    it('should format date nicely', () => {
      const formatted = formatDateForDisplay('2026-01-29');
      expect(formatted).toContain('January');
      expect(formatted).toContain('29');
      expect(formatted).toContain('2026');
    });
  });
});
