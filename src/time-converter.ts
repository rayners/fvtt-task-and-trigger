/**
 * TimeConverter - Handles conversion between different time specifications and Foundry worldTime
 */

import { TimeSpec, RelativeTimeSpec, AbsoluteTimeSpec, CalendarDate } from './types';

export class TimeConverter {
  private static readonly SECONDS_PER_MINUTE = 60;
  private static readonly SECONDS_PER_HOUR = 60 * 60;
  private static readonly SECONDS_PER_DAY = 24 * 60 * 60;

  /**
   * Convert a TimeSpec to a Unix timestamp
   * @param timeSpec The time specification to convert
   * @param useGameTime Whether to use Foundry's game time or real-world time
   * @param baseTime Optional base time for relative calculations (defaults to current time)
   * @returns Unix timestamp in seconds
   */
  static toTimestamp(timeSpec: TimeSpec, useGameTime: boolean = false, baseTime?: number): number {
    const base = baseTime ?? (useGameTime ? this.getCurrentGameTime() : this.getCurrentRealTime());

    if (typeof timeSpec === 'number') {
      // Already a timestamp
      return timeSpec;
    }

    if (timeSpec instanceof Date) {
      // JavaScript Date object
      return Math.floor(timeSpec.getTime() / 1000);
    }

    if (this.isRelativeTimeSpec(timeSpec)) {
      return this.convertRelativeTime(timeSpec, base);
    }

    if (this.isAbsoluteTimeSpec(timeSpec)) {
      return this.convertAbsoluteTime(timeSpec, useGameTime);
    }

    throw new Error(`Invalid time specification: ${JSON.stringify(timeSpec)}`);
  }

  /**
   * Convert a timestamp to a human-readable string
   * @param timestamp Unix timestamp in seconds
   * @param useGameTime Whether to format as game time or real time
   * @returns Formatted time string
   */
  static formatTimestamp(timestamp: number, useGameTime: boolean = false): string {
    if (useGameTime && this.isSeasonsAndStarsAvailable()) {
      return this.formatGameTime(timestamp);
    }
    
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  }

  /**
   * Get the current real-world time as Unix timestamp
   */
  static getCurrentRealTime(): number {
    return Math.floor(Date.now() / 1000);
  }

  /**
   * Get the current Foundry game time as Unix timestamp
   */
  static getCurrentGameTime(): number {
    return game.time?.worldTime ?? this.getCurrentRealTime();
  }

  /**
   * Convert a calendar date from Seasons & Stars to worldTime
   * @param calendarDate Calendar date object
   * @returns Unix timestamp in seconds
   */
  static calendarDateToWorldTime(calendarDate: CalendarDate): number {
    if (this.isSeasonsAndStarsAvailable()) {
      // Use Seasons & Stars API if available
      try {
        const seasonsStars = (game as any).seasonsAndStars;
        if (seasonsStars?.api?.dateToWorldTime) {
          return seasonsStars.api.dateToWorldTime(calendarDate);
        }
      } catch (error) {
        console.warn('Task & Trigger | Error using Seasons & Stars date conversion:', error);
      }
    }

    // Fallback: basic date conversion (assumes standard Gregorian calendar)
    const date = new Date(
      calendarDate.year,
      (calendarDate.month || 1) - 1, // JavaScript months are 0-based
      calendarDate.day || 1
    );
    
    return Math.floor(date.getTime() / 1000);
  }

  /**
   * Convert worldTime to a calendar date using Seasons & Stars
   * @param worldTime Unix timestamp in seconds
   * @returns Calendar date object
   */
  static worldTimeToCalendarDate(worldTime: number): CalendarDate {
    if (this.isSeasonsAndStarsAvailable()) {
      try {
        const seasonsStars = (game as any).seasonsAndStars;
        if (seasonsStars?.api?.worldTimeToDate) {
          return seasonsStars.api.worldTimeToDate(worldTime);
        }
      } catch (error) {
        console.warn('Task & Trigger | Error using Seasons & Stars date conversion:', error);
      }
    }

    // Fallback: basic date conversion
    const date = new Date(worldTime * 1000);
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1, // Convert from 0-based to 1-based
      day: date.getDate()
    };
  }

  /**
   * Check if a given time specification is relative
   */
  static isRelativeTimeSpec(timeSpec: any): timeSpec is RelativeTimeSpec {
    return timeSpec && typeof timeSpec === 'object' && 
           (timeSpec.days !== undefined || timeSpec.hours !== undefined ||
            timeSpec.minutes !== undefined || timeSpec.seconds !== undefined) &&
           timeSpec.year === undefined && timeSpec.month === undefined && timeSpec.day === undefined;
  }

  /**
   * Check if a given time specification is absolute
   */
  static isAbsoluteTimeSpec(timeSpec: any): timeSpec is AbsoluteTimeSpec {
    return timeSpec && typeof timeSpec === 'object' &&
           (timeSpec.year !== undefined || timeSpec.month !== undefined || timeSpec.day !== undefined) &&
           timeSpec.days === undefined && timeSpec.hours === undefined && 
           timeSpec.minutes === undefined && timeSpec.seconds === undefined;
  }

  /**
   * Convert relative time specification to timestamp
   */
  private static convertRelativeTime(timeSpec: RelativeTimeSpec, baseTime: number): number {
    let offset = 0;
    
    if (timeSpec.days) offset += timeSpec.days * this.SECONDS_PER_DAY;
    if (timeSpec.hours) offset += timeSpec.hours * this.SECONDS_PER_HOUR;
    if (timeSpec.minutes) offset += timeSpec.minutes * this.SECONDS_PER_MINUTE;
    if (timeSpec.seconds) offset += timeSpec.seconds;

    return baseTime + offset;
  }

  /**
   * Convert absolute time specification to timestamp
   */
  private static convertAbsoluteTime(timeSpec: AbsoluteTimeSpec, useGameTime: boolean): number {
    if (useGameTime && this.isSeasonsAndStarsAvailable()) {
      // Try to use Seasons & Stars for game time conversion
      const calendarDate: CalendarDate = {
        year: timeSpec.year ?? new Date().getFullYear(),
        month: timeSpec.month ?? 1,
        day: timeSpec.day ?? 1
      };
      
      let timestamp = this.calendarDateToWorldTime(calendarDate);
      
      // Add time of day if specified
      if (timeSpec.hour !== undefined) {
        timestamp += timeSpec.hour * this.SECONDS_PER_HOUR;
      }
      if (timeSpec.minute !== undefined) {
        timestamp += timeSpec.minute * this.SECONDS_PER_MINUTE;
      }
      if (timeSpec.second !== undefined) {
        timestamp += timeSpec.second;
      }
      
      return timestamp;
    }

    // Fallback to standard JavaScript Date
    const now = new Date();
    const date = new Date(
      timeSpec.year ?? now.getFullYear(),
      (timeSpec.month ?? (now.getMonth() + 1)) - 1, // Convert to 0-based
      timeSpec.day ?? now.getDate(),
      timeSpec.hour ?? 0,
      timeSpec.minute ?? 0,
      timeSpec.second ?? 0
    );

    return Math.floor(date.getTime() / 1000);
  }

  /**
   * Format game time using Seasons & Stars if available
   */
  static formatGameTime(timestamp: number): string {
    if (this.isSeasonsAndStarsAvailable()) {
      try {
        const seasonsStars = (game as any).seasonsAndStars;
        if (seasonsStars?.api?.formatDate) {
          return seasonsStars.api.formatDate(timestamp);
        }
      } catch (error) {
        console.warn('Task & Trigger | Error formatting game time:', error);
      }
    }

    // Fallback to standard formatting
    const date = new Date(timestamp * 1000);
    return date.toLocaleString() + ' (Game Time)';
  }

  /**
   * Convert TimeSpec to duration in seconds (time-agnostic)
   * @param timeSpec The time specification to convert to duration
   * @returns Duration in seconds
   */
  static toDuration(timeSpec: TimeSpec): number {
    if (typeof timeSpec === 'number') {
      // If it's already a number, assume it's duration in seconds
      return timeSpec;
    }
    
    if (timeSpec instanceof Date) {
      // Date objects don't make sense as durations
      throw new Error('Date objects cannot be converted to durations');
    }

    if (this.isRelativeTimeSpec(timeSpec)) {
      let duration = 0;
      
      if (timeSpec.days) duration += timeSpec.days * this.SECONDS_PER_DAY;
      if (timeSpec.hours) duration += timeSpec.hours * this.SECONDS_PER_HOUR;
      if (timeSpec.minutes) duration += timeSpec.minutes * this.SECONDS_PER_MINUTE;
      if (timeSpec.seconds) duration += timeSpec.seconds;

      return duration;
    }

    if (this.isAbsoluteTimeSpec(timeSpec)) {
      // Absolute time specs don't make sense as durations
      throw new Error('Absolute time specifications cannot be converted to durations');
    }

    throw new Error('Invalid time specification for duration conversion');
  }

  /**
   * Convert game time duration to real time duration
   * @param gameTimeSeconds Duration in game time seconds
   * @returns Duration in real time seconds
   */
  static gameTimeToRealTime(gameTimeSeconds: number): number {
    if (this.isSeasonsAndStarsAvailable()) {
      try {
        const seasonsStars = (game as any).seasonsAndStars;
        if (seasonsStars?.api?.getTimeRatio) {
          const timeRatio = seasonsStars.api.getTimeRatio();
          return gameTimeSeconds / timeRatio; // Convert to real time
        }
      } catch (error) {
        console.warn('Task & Trigger | Error converting game time to real time:', error);
      }
    }

    // Fallback: assume 1:1 ratio if no Seasons & Stars
    return gameTimeSeconds;
  }

  /**
   * Check if Seasons & Stars module is available
   */
  static isSeasonsAndStarsAvailable(): boolean {
    return game.modules?.get('seasons-and-stars')?.active ?? false;
  }

  /**
   * Validate a time specification
   * @param timeSpec The time specification to validate
   * @returns True if valid, false otherwise
   */
  static isValidTimeSpec(timeSpec: any): timeSpec is TimeSpec {
    if (typeof timeSpec === 'number') {
      return !isNaN(timeSpec) && isFinite(timeSpec);
    }

    if (timeSpec instanceof Date) {
      return !isNaN(timeSpec.getTime());
    }

    if (this.isRelativeTimeSpec(timeSpec)) {
      return this.validateRelativeTime(timeSpec);
    }

    if (this.isAbsoluteTimeSpec(timeSpec)) {
      return this.validateAbsoluteTime(timeSpec);
    }

    return false;
  }

  /**
   * Validate relative time specification
   */
  private static validateRelativeTime(timeSpec: RelativeTimeSpec): boolean {
    const { days, hours, minutes, seconds } = timeSpec;
    
    if (days !== undefined && (!Number.isInteger(days) || days < 0)) return false;
    if (hours !== undefined && (!Number.isInteger(hours) || hours < 0)) return false;
    if (minutes !== undefined && (!Number.isInteger(minutes) || minutes < 0)) return false;
    if (seconds !== undefined && (!Number.isInteger(seconds) || seconds < 0)) return false;

    // At least one value must be specified
    return days !== undefined || hours !== undefined || minutes !== undefined || seconds !== undefined;
  }

  /**
   * Validate absolute time specification
   */
  private static validateAbsoluteTime(timeSpec: AbsoluteTimeSpec): boolean {
    const { year, month, day, hour, minute, second } = timeSpec;
    
    if (year !== undefined && (!Number.isInteger(year) || year < 0)) return false;
    if (month !== undefined && (!Number.isInteger(month) || month < 1 || month > 12)) return false;
    if (day !== undefined && (!Number.isInteger(day) || day < 1 || day > 31)) return false;
    if (hour !== undefined && (!Number.isInteger(hour) || hour < 0 || hour > 23)) return false;
    if (minute !== undefined && (!Number.isInteger(minute) || minute < 0 || minute > 59)) return false;
    if (second !== undefined && (!Number.isInteger(second) || second < 0 || second > 59)) return false;

    return true; // Absolute time specs can be completely unspecified (defaults will be used)
  }
}