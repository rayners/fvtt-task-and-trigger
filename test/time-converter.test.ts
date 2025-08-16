/**
 * Tests for TimeConverter class
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TimeConverter } from '../src/time-converter';
import { RelativeTimeSpec, AbsoluteTimeSpec } from '../src/types';
import './setup';

describe('TimeConverter', () => {
  const mockCurrentTime = 1609459200; // 2021-01-01 00:00:00 UTC

  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(mockCurrentTime * 1000);
    (global as any).game.time.worldTime = mockCurrentTime;
  });

  describe('toTimestamp', () => {
    it('should handle numeric timestamps', () => {
      const timestamp = 1234567890;
      expect(TimeConverter.toTimestamp(timestamp)).toBe(timestamp);
    });

    it('should handle Date objects', () => {
      const date = new Date('2021-01-01T12:00:00Z');
      const expected = Math.floor(date.getTime() / 1000);
      expect(TimeConverter.toTimestamp(date)).toBe(expected);
    });

    it('should handle relative time specifications', () => {
      const relativeSpec: RelativeTimeSpec = {
        days: 1,
        hours: 2,
        minutes: 30,
      };

      const expected = mockCurrentTime + 1 * 24 * 60 * 60 + 2 * 60 * 60 + 30 * 60;
      expect(TimeConverter.toTimestamp(relativeSpec)).toBe(expected);
    });

    it('should handle absolute time specifications', () => {
      const absoluteSpec: AbsoluteTimeSpec = {
        year: 2021,
        month: 6,
        day: 15,
        hour: 14,
        minute: 30,
      };

      const expected = Math.floor(new Date(2021, 5, 15, 14, 30, 0).getTime() / 1000); // Month is 0-based
      expect(TimeConverter.toTimestamp(absoluteSpec)).toBe(expected);
    });

    it('should use game time when specified', () => {
      const relativeSpec: RelativeTimeSpec = { hours: 1 };
      const gameTimeResult = TimeConverter.toTimestamp(relativeSpec, true);
      const realTimeResult = TimeConverter.toTimestamp(relativeSpec, false);

      // Both should be the same since our mock sets them equal
      expect(gameTimeResult).toBe(realTimeResult);
    });

    it('should throw error for invalid time specification', () => {
      expect(() => TimeConverter.toTimestamp({} as any)).toThrow('Invalid time specification');
    });
  });

  describe('isValidTimeSpec', () => {
    it('should validate numeric timestamps', () => {
      expect(TimeConverter.isValidTimeSpec(1234567890)).toBe(true);
      expect(TimeConverter.isValidTimeSpec(NaN)).toBe(false);
      expect(TimeConverter.isValidTimeSpec(Infinity)).toBe(false);
    });

    it('should validate Date objects', () => {
      expect(TimeConverter.isValidTimeSpec(new Date())).toBe(true);
      expect(TimeConverter.isValidTimeSpec(new Date('invalid'))).toBe(false);
    });

    it('should validate relative time specifications', () => {
      expect(TimeConverter.isValidTimeSpec({ days: 1 })).toBe(true);
      expect(TimeConverter.isValidTimeSpec({ hours: 2, minutes: 30 })).toBe(true);
      expect(TimeConverter.isValidTimeSpec({ days: -1 })).toBe(false);
      expect(TimeConverter.isValidTimeSpec({})).toBe(false);
    });

    it('should validate absolute time specifications', () => {
      expect(TimeConverter.isValidTimeSpec({ year: 2021 })).toBe(true);
      expect(TimeConverter.isValidTimeSpec({ month: 6, day: 15 })).toBe(true);
      expect(TimeConverter.isValidTimeSpec({ month: 13 })).toBe(false);
      expect(TimeConverter.isValidTimeSpec({ hour: 25 })).toBe(false);
    });
  });

  describe('type detection', () => {
    it('should correctly identify relative time specs', () => {
      expect(TimeConverter.isRelativeTimeSpec({ days: 1 })).toBe(true);
      expect(TimeConverter.isRelativeTimeSpec({ hours: 2, minutes: 30 })).toBe(true);
      expect(TimeConverter.isRelativeTimeSpec({ year: 2021 })).toBe(false);
      expect(TimeConverter.isRelativeTimeSpec({ days: 1, year: 2021 })).toBe(false);
    });

    it('should correctly identify absolute time specs', () => {
      expect(TimeConverter.isAbsoluteTimeSpec({ year: 2021 })).toBe(true);
      expect(TimeConverter.isAbsoluteTimeSpec({ month: 6, day: 15 })).toBe(true);
      expect(TimeConverter.isAbsoluteTimeSpec({ days: 1 })).toBe(false);
      expect(TimeConverter.isAbsoluteTimeSpec({ year: 2021, days: 1 })).toBe(false);
    });
  });

  describe('Seasons & Stars integration', () => {
    it('should detect when Seasons & Stars is available', () => {
      expect(TimeConverter.isSeasonsAndStarsAvailable()).toBe(false);

      // Mock S&S as active
      (global as any).game.modules.set('seasons-and-stars', { active: true });
      expect(TimeConverter.isSeasonsAndStarsAvailable()).toBe(true);
    });

    it('should use S&S API when available for calendar conversion', () => {
      const mockCalendarDate = { year: 2021, month: 6, day: 15 };
      const mockWorldTime = 1623715200; // June 15, 2021

      // Mock S&S being available with API
      (global as any).game.modules.set('seasons-and-stars', { active: true });
      (global as any).game.seasonsAndStars = {
        api: {
          dateToWorldTime: vi.fn().mockReturnValue(mockWorldTime),
          worldTimeToDate: vi.fn().mockReturnValue(mockCalendarDate),
        },
      };

      const result = TimeConverter.calendarDateToWorldTime(mockCalendarDate);
      expect(result).toBe(mockWorldTime);
      expect((global as any).game.seasonsAndStars.api.dateToWorldTime).toHaveBeenCalledWith(
        mockCalendarDate
      );
    });

    it('should fallback to basic date conversion when S&S is not available', () => {
      const calendarDate = { year: 2021, month: 6, day: 15 };
      const expected = Math.floor(new Date(2021, 5, 15).getTime() / 1000); // Month is 0-based

      const result = TimeConverter.calendarDateToWorldTime(calendarDate);
      expect(result).toBe(expected);
    });
  });

  describe('formatting', () => {
    it('should format timestamps as readable strings', () => {
      const timestamp = 1609459200; // 2021-01-01 00:00:00 UTC
      const result = TimeConverter.formatTimestamp(timestamp);
      expect(typeof result).toBe('string');
      // Check that it's formatted as a date string (either 2020 or 2021 depending on timezone)
      expect(result).toMatch(/202[01]/);
    });

    it('should use game time formatting when available', () => {
      const timestamp = 1609459200;

      // Mock S&S with formatting
      (global as any).game.modules.set('seasons-and-stars', { active: true });
      (global as any).game.seasonsAndStars = {
        api: {
          formatDate: vi.fn().mockReturnValue('1st of Midwinter, 2021'),
        },
      };

      const result = TimeConverter.formatTimestamp(timestamp, true);
      expect(result).toBe('1st of Midwinter, 2021');
    });
  });

  describe('time utilities', () => {
    it('should get current real time', () => {
      const result = TimeConverter.getCurrentRealTime();
      expect(result).toBe(mockCurrentTime);
    });

    it('should get current game time', () => {
      const result = TimeConverter.getCurrentGameTime();
      expect(result).toBe(mockCurrentTime);
    });
  });
});
