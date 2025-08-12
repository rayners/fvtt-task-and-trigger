/**
 * Type definitions for Task & Trigger module
 */

// Time specification types
export type TimeSpec = Date | number | RelativeTimeSpec | AbsoluteTimeSpec;

export interface RelativeTimeSpec {
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
}

export interface AbsoluteTimeSpec {
  year?: number;
  month?: number; // 1-12
  day?: number; // 1-31
  hour?: number; // 0-23
  minute?: number; // 0-59
  second?: number; // 0-59
}

// Task types
export interface Task {
  id: string;
  name: string;
  description?: string;
  timeSpec: TimeSpec;
  targetTime: number; // Unix timestamp when task should execute
  callback: string; // JavaScript code to execute
  useGameTime: boolean; // Whether to use game time or real time
  recurring: boolean; // Whether this is a recurring task
  interval?: TimeSpec; // For recurring tasks, the interval
  scope: 'world' | 'client'; // Storage scope
  enabled: boolean; // Whether task is active
  created: number; // When task was created (Unix timestamp)
  runCount: number; // How many times task has executed
  lastExecution?: number; // When task last executed (Unix timestamp)
  lastError?: string; // Last execution error, if any
  logExecution: boolean; // Whether to log execution to journal
  calendarIntegrated?: boolean; // Whether integrated with calendar UI
  calendarDate?: CalendarDate; // Calendar date if calendar integrated
  uiConfigured?: boolean; // Whether task was created through UI (should persist across restarts)
  
  // Accumulated time task properties
  isAccumulatedTime?: boolean; // Whether this is an accumulated time task
  requiredTime?: number; // Total seconds required for completion
  accumulatedTime?: number; // Seconds accumulated so far
  timeEntries?: TimeEntry[]; // Log of time entries
}

export interface TimeEntry {
  id: string;
  timestamp: number; // When this time was logged
  duration: number; // Duration in seconds
  description?: string; // Optional description of what was done
  loggedBy?: string; // User who logged this time (for world tasks)
}

// Task execution result
export interface TaskExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  executionTime: number; // Duration in milliseconds
  timestamp: number; // Unix timestamp when executed
}

// Task error for tracking failures
export interface TaskError {
  taskId: string;
  error: Error;
  timestamp: number;
  retryCount: number;
}

// Calendar integration types
export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

// Journal storage types
export interface TaskStorageData {
  tasks: Task[];
  scope: 'world' | 'client';
  version: string;
  lastUpdated: number;
}

// Settings types
export interface TaskTriggerSettings {
  enableLogging: boolean;
  logJournalName: string;
  securityWarnings: boolean;
  calendarIntegration: boolean;
}

// API types
export interface TaskTriggerAPI {
  scheduleTask(time: TimeSpec, callback: Function | string, useGameTime?: boolean): string;
  scheduleInterval(interval: TimeSpec, callback: Function | string, useGameTime?: boolean): string;
  cancelTask(taskId: string): boolean;
  showTaskCreator(): void;
  scheduleCalendarTask(calendarDate: CalendarDate, callback: Function | string, scope: 'world'|'client'): string;
  getTasksForDate(calendarDate: CalendarDate): Task[];
}