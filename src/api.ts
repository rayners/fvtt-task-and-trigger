/**
 * Public API for Task & Trigger module
 * Exposed as game.taskTrigger.api for other modules and macros
 */

import { TimeSpec, CalendarDate, Task, PlayerTaskView } from './types';
import { TaskScheduler, ScheduleOptions, TaskInfo } from './task-scheduler';
import { TaskPersistence } from './task-persistence';
import { AccumulatedTimeTaskOptions, TimeLogEntry } from './accumulated-time-manager';
import { TaskManagerApplication } from './task-manager-application';
import { TaskManager } from './task-manager';

export interface TaskTriggerAPI {
  // Basic scheduling methods (setTimeout/setInterval style)
  setTimeout(delay: TimeSpec, macroId: string, options?: ScheduleOptions): Promise<string>;
  setInterval(interval: TimeSpec, macroId: string, options?: ScheduleOptions): Promise<string>;
  clearTimeout(taskId: string): Promise<boolean>;
  clearInterval(taskId: string): Promise<boolean>;

  // Game time scheduling
  setGameTimeout(delay: TimeSpec, macroId: string, options?: ScheduleOptions): Promise<string>;
  setGameInterval(interval: TimeSpec, macroId: string, options?: ScheduleOptions): Promise<string>;

  // Advanced scheduling
  scheduleAt(dateTime: Date, macroId: string, options?: ScheduleOptions): Promise<string>;
  scheduleForDate(
    calendarDate: CalendarDate,
    macroId: string,
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
  
  // Player-facing read-only methods
  getUpcomingEvents(limitHours?: number): Promise<PlayerTaskView[]>;

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
  private taskManager: TaskManager;

  constructor() {
    this.scheduler = TaskScheduler.getInstance();
    this.persistence = TaskPersistence.getInstance();
    this.taskManager = TaskManager.getInstance();
  }

  /**
   * Validate that the current user has GM permissions for task creation
   * @throws Error if user is not a GM
   */
  private validateGMPermission(): void {
    if (!game.user?.isGM) {
      throw new Error('Only GMs can create scheduled tasks');
    }
  }

  /**
   * Schedule a one-time task after a delay (real time)
   * @param delay Time to wait before execution
   * @param macroId ID of the macro to execute
   * @param options Additional options
   * @returns Task ID
   */
  async setTimeout(
    delay: TimeSpec,
    macroId: string,
    options: ScheduleOptions = {}
  ): Promise<string> {
    this.validateGMPermission();
    return this.scheduler.setTimeout(delay, macroId, options);
  }

  /**
   * Schedule a recurring task at intervals (real time)
   * @param interval Time between executions
   * @param macroId ID of the macro to execute
   * @param options Additional options
   * @returns Task ID
   */
  async setInterval(
    interval: TimeSpec,
    macroId: string,
    options: ScheduleOptions = {}
  ): Promise<string> {
    this.validateGMPermission();
    return this.scheduler.setInterval(interval, macroId, options);
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
   * @param macroId ID of the macro to execute
   * @param options Additional options
   * @returns Task ID
   */
  async setGameTimeout(
    delay: TimeSpec,
    macroId: string,
    options: ScheduleOptions = {}
  ): Promise<string> {
    this.validateGMPermission();
    return this.scheduler.setGameTimeout(delay, macroId, options);
  }

  /**
   * Schedule a recurring task at intervals (game time)
   * @param interval Game time between executions
   * @param macroId ID of the macro to execute
   * @param options Additional options
   * @returns Task ID
   */
  async setGameInterval(
    interval: TimeSpec,
    macroId: string,
    options: ScheduleOptions = {}
  ): Promise<string> {
    this.validateGMPermission();
    return this.scheduler.setGameInterval(interval, macroId, options);
  }

  /**
   * Schedule a task for a specific date/time
   * @param dateTime Target date/time
   * @param macroId ID of the macro to execute
   * @param options Additional options
   * @returns Task ID
   */
  async scheduleAt(
    dateTime: Date,
    macroId: string,
    options: ScheduleOptions = {}
  ): Promise<string> {
    this.validateGMPermission();
    return this.scheduler.scheduleAt(dateTime, macroId, options);
  }

  /**
   * Schedule a task for a specific calendar date
   * @param calendarDate Calendar date specification
   * @param macroId ID of the macro to execute
   * @param options Additional options
   * @returns Task ID
   */
  async scheduleForDate(
    calendarDate: CalendarDate,
    macroId: string,
    options: ScheduleOptions = {}
  ): Promise<string> {
    this.validateGMPermission();
    return this.scheduler.scheduleForDate(calendarDate, macroId, options);
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
    this.validateGMPermission();
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
    this.validateGMPermission();
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
    this.validateGMPermission();
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
    this.validateGMPermission();
    return this.scheduler.createAccumulatedTimeTask(options);
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
   * Get upcoming events visible to current player (read-only view)
   * @param limitHours Optional limit to events within this many hours (default: 168 hours / 1 week)
   * @returns Array of player-safe task views
   */
  async getUpcomingEvents(limitHours: number = 168): Promise<PlayerTaskView[]> {
    // Get current time threshold
    const currentTime = Date.now() / 1000;
    const timeLimit = currentTime + (limitHours * 3600);

    // Get all tasks from both scopes
    const allTasks = await this.taskManager.getAllTasks();
    const tasks = [...allTasks.world, ...allTasks.client];

    // Filter for upcoming, enabled tasks within time limit
    const upcomingTasks = tasks.filter(task => {
      if (!task.enabled) return false;
      if (!task.targetTime || task.targetTime <= currentTime) return false;
      if (task.targetTime > timeLimit) return false;
      return true;
    });

    // Apply visibility filtering for current user
    const visibleTasks = await this.taskManager.getPlayerVisibleTasks(game.user?.id);

    // Convert to player-safe views and sort by execution time
    return visibleTasks
      .filter(task => upcomingTasks.some(upcoming => upcoming.id === task.id))
      .sort((a, b) => (a.nextExecution || 0) - (b.nextExecution || 0));
  }
}

/**
 * Create and return the public API instance
 */
export function createAPI(): TaskTriggerAPI {
  return new TaskTriggerAPIImpl();
}
