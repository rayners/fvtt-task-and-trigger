/**
 * Public API for Task & Trigger module
 * Exposed as game.taskTrigger.api for other modules and macros
 */

import { TimeSpec, CalendarDate, Task, TaskCallback } from './types';
import { TaskScheduler, ScheduleOptions, TaskInfo } from './task-scheduler';
import { TaskPersistence } from './task-persistence';
import { AccumulatedTimeTaskOptions, TimeLogEntry } from './accumulated-time-manager';
import { TaskManagerApplication } from './task-manager-application';

export interface TaskTriggerAPI {
  // Basic scheduling methods (setTimeout/setInterval style)
  setTimeout(delay: TimeSpec, callback: TaskCallback, options?: ScheduleOptions): Promise<string>;
  setInterval(
    interval: TimeSpec,
    callback: TaskCallback,
    options?: ScheduleOptions
  ): Promise<string>;
  clearTimeout(taskId: string): Promise<boolean>;
  clearInterval(taskId: string): Promise<boolean>;

  // Game time scheduling
  setGameTimeout(
    delay: TimeSpec,
    callback: TaskCallback,
    options?: ScheduleOptions
  ): Promise<string>;
  setGameInterval(
    interval: TimeSpec,
    callback: TaskCallback,
    options?: ScheduleOptions
  ): Promise<string>;

  // Advanced scheduling
  scheduleAt(dateTime: Date, callback: TaskCallback, options?: ScheduleOptions): Promise<string>;
  scheduleForDate(
    calendarDate: CalendarDate,
    callback: TaskCallback,
    options?: ScheduleOptions
  ): Promise<string>;

  // Reminder utilities
  scheduleReminder(delay: TimeSpec, message: string, options?: ScheduleOptions): Promise<string>;
  scheduleRecurringReminder(
    interval: TimeSpec,
    message: string,
    options?: ScheduleOptions
  ): Promise<string>;
  scheduleGameReminder(
    delay: TimeSpec,
    message: string,
    options?: ScheduleOptions
  ): Promise<string>;

  // Task management
  cancel(taskId: string): Promise<boolean>;
  enable(taskId: string): Promise<void>;
  disable(taskId: string): Promise<void>;

  // Information queries
  getTaskInfo(taskId: string): Promise<TaskInfo | null>;
  listTasks(scope?: 'world' | 'client'): Promise<TaskInfo[]>;
  listTasksForDate(calendarDate: CalendarDate): Promise<TaskInfo[]>;
  getStatistics(): Promise<any>;

  // Utilities
  formatTimeSpec(timeSpec: TimeSpec, useGameTime?: boolean): string;
  getNextExecutionTime(taskId: string): Promise<string | null>;
  isReady(): boolean;

  // Accumulated time task methods
  createAccumulatedTimeTask(options: AccumulatedTimeTaskOptions): Promise<string>;
  addTimeToTask(taskId: string, entry: TimeLogEntry): Promise<boolean>;
  getAccumulatedTimeProgress(taskId: string): Promise<any>;
  listAccumulatedTimeTasks(scope?: 'world' | 'client'): Promise<Task[]>;
  removeTimeEntry(taskId: string, entryId: string): Promise<boolean>;
  editTimeEntry(
    taskId: string,
    entryId: string,
    newDuration: TimeSpec,
    newDescription?: string
  ): Promise<boolean>;
  getAccumulatedTimeStatistics(taskId: string): Promise<any>;
  exportTaskTimeLog(taskId: string, format?: 'json' | 'csv'): Promise<string>;

  // Advanced/internal methods
  showTaskManager(): void;
  markAsUITask(taskId: string): Promise<void>;
  markAsEphemeral(taskId: string): Promise<void>;
  cleanupOldTasks(olderThanDays?: number): Promise<number>;
}

export class TaskTriggerAPIImpl implements TaskTriggerAPI {
  private scheduler: TaskScheduler;
  private persistence: TaskPersistence;

  constructor() {
    this.scheduler = TaskScheduler.getInstance();
    this.persistence = TaskPersistence.getInstance();
  }

  /**
   * Schedule a one-time task after a delay (real time)
   * @param delay Time to wait before execution
   * @param callback Function or string to execute
   * @param options Additional options
   * @returns Task ID
   */
  async setTimeout(
    delay: TimeSpec,
    callback: TaskCallback,
    options: ScheduleOptions = {}
  ): Promise<string> {
    const callbackCode = this.normalizeCallback(callback);
    return this.scheduler.setTimeout(delay, callbackCode, options);
  }

  /**
   * Schedule a recurring task at intervals (real time)
   * @param interval Time between executions
   * @param callback Function or string to execute
   * @param options Additional options
   * @returns Task ID
   */
  async setInterval(
    interval: TimeSpec,
    callback: TaskCallback,
    options: ScheduleOptions = {}
  ): Promise<string> {
    const callbackCode = this.normalizeCallback(callback);
    return this.scheduler.setInterval(interval, callbackCode, options);
  }

  /**
   * Cancel a scheduled task
   * @param taskId Task ID to cancel
   * @returns True if task was cancelled
   */
  async clearTimeout(taskId: string): Promise<boolean> {
    return this.scheduler.clearTimeout(taskId);
  }

  /**
   * Cancel a scheduled task (alias for clearTimeout)
   * @param taskId Task ID to cancel
   * @returns True if task was cancelled
   */
  async clearInterval(taskId: string): Promise<boolean> {
    return this.scheduler.clearInterval(taskId);
  }

  /**
   * Schedule a one-time task after a delay (game time)
   * @param delay Game time to wait before execution
   * @param callback Function or string to execute
   * @param options Additional options
   * @returns Task ID
   */
  async setGameTimeout(
    delay: TimeSpec,
    callback: TaskCallback,
    options: ScheduleOptions = {}
  ): Promise<string> {
    const callbackCode = this.normalizeCallback(callback);
    return this.scheduler.setGameTimeout(delay, callbackCode, options);
  }

  /**
   * Schedule a recurring task at intervals (game time)
   * @param interval Game time between executions
   * @param callback Function or string to execute
   * @param options Additional options
   * @returns Task ID
   */
  async setGameInterval(
    interval: TimeSpec,
    callback: TaskCallback,
    options: ScheduleOptions = {}
  ): Promise<string> {
    const callbackCode = this.normalizeCallback(callback);
    return this.scheduler.setGameInterval(interval, callbackCode, options);
  }

  /**
   * Schedule a task for a specific date/time
   * @param dateTime Target date/time
   * @param callback Function or string to execute
   * @param options Additional options
   * @returns Task ID
   */
  async scheduleAt(
    dateTime: Date,
    callback: TaskCallback,
    options: ScheduleOptions = {}
  ): Promise<string> {
    const callbackCode = this.normalizeCallback(callback);
    return this.scheduler.scheduleAt(dateTime, callbackCode, options);
  }

  /**
   * Schedule a task for a specific calendar date
   * @param calendarDate Calendar date specification
   * @param callback Function or string to execute
   * @param options Additional options
   * @returns Task ID
   */
  async scheduleForDate(
    calendarDate: CalendarDate,
    callback: TaskCallback,
    options: ScheduleOptions = {}
  ): Promise<string> {
    const callbackCode = this.normalizeCallback(callback);
    return this.scheduler.scheduleForDate(calendarDate, callbackCode, options);
  }

  /**
   * Schedule a reminder notification
   * @param delay When to show the reminder
   * @param message Message to display
   * @param options Additional options
   * @returns Task ID
   */
  async scheduleReminder(
    delay: TimeSpec,
    message: string,
    options: ScheduleOptions = {}
  ): Promise<string> {
    return this.scheduler.scheduleReminder(delay, message, options);
  }

  /**
   * Schedule a recurring reminder
   * @param interval How often to remind
   * @param message Message to display
   * @param options Additional options
   * @returns Task ID
   */
  async scheduleRecurringReminder(
    interval: TimeSpec,
    message: string,
    options: ScheduleOptions = {}
  ): Promise<string> {
    return this.scheduler.scheduleRecurringReminder(interval, message, options);
  }

  /**
   * Schedule a game time reminder
   * @param delay Game time delay
   * @param message Message to display
   * @param options Additional options
   * @returns Task ID
   */
  async scheduleGameReminder(
    delay: TimeSpec,
    message: string,
    options: ScheduleOptions = {}
  ): Promise<string> {
    return this.scheduler.scheduleGameReminder(delay, message, options);
  }

  /**
   * Cancel a scheduled task
   * @param taskId Task ID to cancel
   * @returns True if task was cancelled
   */
  async cancel(taskId: string): Promise<boolean> {
    return this.scheduler.cancel(taskId);
  }

  /**
   * Enable a disabled task
   * @param taskId Task ID to enable
   */
  async enable(taskId: string): Promise<void> {
    await this.scheduler.enable(taskId);
  }

  /**
   * Disable a task without deleting it
   * @param taskId Task ID to disable
   */
  async disable(taskId: string): Promise<void> {
    await this.scheduler.disable(taskId);
  }

  /**
   * Get information about a specific task
   * @param taskId Task ID to get info for
   * @returns Task information or null if not found
   */
  async getTaskInfo(taskId: string): Promise<TaskInfo | null> {
    return this.scheduler.getTaskInfo(taskId);
  }

  /**
   * List all scheduled tasks
   * @param scope Optional scope filter
   * @returns Array of task information
   */
  async listTasks(scope?: 'world' | 'client'): Promise<TaskInfo[]> {
    return this.scheduler.listTasks(scope);
  }

  /**
   * List tasks scheduled for a specific calendar date
   * @param calendarDate Calendar date to check
   * @returns Array of task information
   */
  async listTasksForDate(calendarDate: CalendarDate): Promise<TaskInfo[]> {
    return this.scheduler.listTasksForDate(calendarDate);
  }

  /**
   * Get statistics about scheduled tasks
   * @returns Task statistics
   */
  async getStatistics(): Promise<any> {
    return this.scheduler.getStatistics();
  }

  /**
   * Format a time specification as human-readable string
   * @param timeSpec Time specification to format
   * @param useGameTime Whether this is game time
   * @returns Human-readable string
   */
  formatTimeSpec(timeSpec: TimeSpec, useGameTime: boolean = false): string {
    return this.scheduler.formatTimeSpec(timeSpec, useGameTime);
  }

  /**
   * Get the next execution time for a task
   * @param taskId Task ID
   * @returns Formatted next execution time or null
   */
  async getNextExecutionTime(taskId: string): Promise<string | null> {
    return this.scheduler.getNextExecutionTime(taskId);
  }

  /**
   * Check if the task system is ready
   * @returns True if initialized and ready
   */
  isReady(): boolean {
    return this.scheduler.isReady();
  }

  /**
   * Show the task manager UI
   */
  showTaskManager(): void {
    TaskManagerApplication.show();
  }

  /**
   * Mark a task as UI-configured (will persist across restarts)
   * @param taskId Task ID to mark
   */
  async markAsUITask(taskId: string): Promise<void> {
    await this.persistence.markAsUIConfigured(taskId);
  }

  /**
   * Mark a task as ephemeral (will not persist across restarts)
   * @param taskId Task ID to mark
   */
  async markAsEphemeral(taskId: string): Promise<void> {
    await this.persistence.markAsEphemeral(taskId);
  }

  /**
   * Create an accumulated time task
   * @param options Task configuration
   * @returns Task ID
   */
  async createAccumulatedTimeTask(options: AccumulatedTimeTaskOptions): Promise<string> {
    const callbackCode = this.normalizeCallback(options.callback);
    return this.scheduler.createAccumulatedTimeTask({
      ...options,
      callback: callbackCode,
    });
  }

  /**
   * Add time to an accumulated time task
   * @param taskId Task ID
   * @param entry Time entry to add
   * @returns True if task is now complete
   */
  async addTimeToTask(taskId: string, entry: TimeLogEntry): Promise<boolean> {
    return this.scheduler.addTimeToTask(taskId, entry);
  }

  /**
   * Get progress for an accumulated time task
   * @param taskId Task ID
   * @returns Task progress or null if not found
   */
  async getAccumulatedTimeProgress(taskId: string): Promise<any> {
    return this.scheduler.getAccumulatedTimeProgress(taskId);
  }

  /**
   * List all accumulated time tasks
   * @param scope Optional scope filter
   * @returns Array of accumulated time tasks
   */
  async listAccumulatedTimeTasks(scope?: 'world' | 'client'): Promise<Task[]> {
    return this.scheduler.listAccumulatedTimeTasks(scope);
  }

  /**
   * Remove a time entry from a task
   * @param taskId Task ID
   * @param entryId Time entry ID
   * @returns True if removed
   */
  async removeTimeEntry(taskId: string, entryId: string): Promise<boolean> {
    return this.scheduler.removeTimeEntry(taskId, entryId);
  }

  /**
   * Edit a time entry
   * @param taskId Task ID
   * @param entryId Time entry ID
   * @param newDuration New duration
   * @param newDescription New description
   * @returns True if edited
   */
  async editTimeEntry(
    taskId: string,
    entryId: string,
    newDuration: TimeSpec,
    newDescription?: string
  ): Promise<boolean> {
    return this.scheduler.editTimeEntry(taskId, entryId, newDuration, newDescription);
  }

  /**
   * Get statistics for an accumulated time task
   * @param taskId Task ID
   * @returns Task statistics or null
   */
  async getAccumulatedTimeStatistics(taskId: string): Promise<any> {
    return this.scheduler.getAccumulatedTimeStatistics(taskId);
  }

  /**
   * Export time log for a task
   * @param taskId Task ID
   * @param format Export format
   * @returns Exported data
   */
  async exportTaskTimeLog(taskId: string, format: 'json' | 'csv' = 'csv'): Promise<string> {
    return this.scheduler.exportTaskTimeLog(taskId, format);
  }

  /**
   * Clean up old disabled tasks
   * @param olderThanDays Remove tasks older than this many days
   * @returns Number of tasks cleaned up
   */
  async cleanupOldTasks(olderThanDays: number = 7): Promise<number> {
    return this.persistence.cleanupOldTasks(olderThanDays);
  }

  /**
   * Convert callback to string format for execution
   * @param callback Function or string callback
   * @returns String callback
   */
  private normalizeCallback(callback: TaskCallback): string {
    if (typeof callback === 'function') {
      // Convert function to string - this will lose closure but work for simple functions
      const funcString = callback.toString();

      // Extract function body if it's a regular function
      const match = funcString.match(
        /^(?:async\s+)?(?:function\s*)?(?:\w+\s*)?\([^)]*\)\s*(?:=>\s*)?\{([\s\S]*)\}$/
      );
      if (match) {
        return match[1].trim();
      }

      // Handle arrow functions without braces
      const arrowMatch = funcString.match(/^(?:async\s+)?\([^)]*\)\s*=>\s*(.+)$/);
      if (arrowMatch) {
        return `return (${arrowMatch[1]});`;
      }

      // Fall back to the full function string
      console.warn('Task & Trigger | Complex function callback may not work as expected');
      return `(${funcString})();`;
    }

    return callback;
  }
}

/**
 * Create and return the public API instance
 */
export function createAPI(): TaskTriggerAPI {
  return new TaskTriggerAPIImpl();
}
