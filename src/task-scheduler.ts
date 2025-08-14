/**
 * TaskScheduler - High-level interface for task scheduling operations
 * Provides convenient methods and abstracts TaskManager complexity
 */

import { TimeSpec, CalendarDate, Task } from './types';
import { TaskManager } from './task-manager';
import { TimeConverter } from './time-converter';
import {
  AccumulatedTimeManager,
  AccumulatedTimeTaskOptions,
  TimeLogEntry,
} from './accumulated-time-manager';

export interface ScheduleOptions {
  /** Storage scope for the task */
  scope?: 'world' | 'client';
  /** Human-readable name for the task */
  name?: string;
  /** Detailed description of the task */
  description?: string;
  /** Whether to log execution results to journal */
  logExecution?: boolean;
  /** Whether the task is initially enabled */
  enabled?: boolean;
}

export interface TaskInfo {
  id: string;
  name: string;
  description?: string;
  nextExecution: number;
  isRecurring: boolean;
  enabled: boolean;
  runCount: number;
  lastExecution?: number;
  lastError?: string;
  useGameTime: boolean;
  scope: 'world' | 'client';
}

export class TaskScheduler {
  private static instance: TaskScheduler;
  private taskManager: TaskManager;
  private accumulatedTimeManager: AccumulatedTimeManager;

  private constructor() {
    this.taskManager = TaskManager.getInstance();
    this.accumulatedTimeManager = AccumulatedTimeManager.getInstance();
  }

  static getInstance(): TaskScheduler {
    if (!this.instance) {
      this.instance = new TaskScheduler();
    }
    return this.instance;
  }

  /**
   * Schedule a one-time task to execute after a delay
   * @param delay Time to wait before execution
   * @param callback JavaScript code to execute
   * @param options Additional options
   * @returns Task ID
   */
  async setTimeout(
    delay: TimeSpec,
    callback: string,
    options: ScheduleOptions = {}
  ): Promise<string> {
    return this.taskManager.scheduleTask(
      delay,
      callback,
      false, // Real time by default
      options.scope || 'client'
    );
  }

  /**
   * Schedule a recurring task to execute at intervals
   * @param interval Time between executions
   * @param callback JavaScript code to execute
   * @param options Additional options
   * @returns Task ID
   */
  async setInterval(
    interval: TimeSpec,
    callback: string,
    options: ScheduleOptions = {}
  ): Promise<string> {
    return this.taskManager.scheduleInterval(
      interval,
      callback,
      false, // Real time by default
      options.scope || 'client'
    );
  }

  /**
   * Schedule a one-time task to execute at game time
   * @param delay Game time delay
   * @param callback JavaScript code to execute
   * @param options Additional options
   * @returns Task ID
   */
  async setGameTimeout(
    delay: TimeSpec,
    callback: string,
    options: ScheduleOptions = {}
  ): Promise<string> {
    return this.taskManager.scheduleTask(
      delay,
      callback,
      true, // Game time
      options.scope || 'client'
    );
  }

  /**
   * Schedule a recurring task at game time intervals
   * @param interval Game time interval
   * @param callback JavaScript code to execute
   * @param options Additional options
   * @returns Task ID
   */
  async setGameInterval(
    interval: TimeSpec,
    callback: string,
    options: ScheduleOptions = {}
  ): Promise<string> {
    return this.taskManager.scheduleInterval(
      interval,
      callback,
      true, // Game time
      options.scope || 'client'
    );
  }

  /**
   * Schedule a task for a specific real-world date/time
   * @param dateTime Target date/time
   * @param callback JavaScript code to execute
   * @param options Additional options
   * @returns Task ID
   */
  async scheduleAt(
    dateTime: Date,
    callback: string,
    options: ScheduleOptions = {}
  ): Promise<string> {
    const timestamp = Math.floor(dateTime.getTime() / 1000);
    return this.taskManager.scheduleTask(
      timestamp,
      callback,
      false, // Real time
      options.scope || 'client'
    );
  }

  /**
   * Schedule a task for a specific calendar date (requires S&S)
   * @param calendarDate Calendar date specification
   * @param callback JavaScript code to execute
   * @param options Additional options
   * @returns Task ID
   */
  async scheduleForDate(
    calendarDate: CalendarDate,
    callback: string,
    options: ScheduleOptions = {}
  ): Promise<string> {
    return this.taskManager.scheduleCalendarTask(
      calendarDate,
      callback,
      options.scope || 'world' // Calendar tasks default to world scope
    );
  }

  /**
   * Cancel a scheduled task
   * @param taskId Task ID to cancel
   * @returns True if task was cancelled
   */
  async clearTimeout(taskId: string): Promise<boolean> {
    return this.taskManager.cancelTask(taskId);
  }

  /**
   * Cancel a scheduled task (alias for clearTimeout)
   * @param taskId Task ID to cancel
   * @returns True if task was cancelled
   */
  async clearInterval(taskId: string): Promise<boolean> {
    return this.taskManager.cancelTask(taskId);
  }

  /**
   * Cancel a scheduled task (general method)
   * @param taskId Task ID to cancel
   * @returns True if task was cancelled
   */
  async cancel(taskId: string): Promise<boolean> {
    return this.taskManager.cancelTask(taskId);
  }

  /**
   * Enable a disabled task
   * @param taskId Task ID to enable
   */
  async enable(taskId: string): Promise<void> {
    await this.taskManager.enableTask(taskId);
  }

  /**
   * Disable a task without deleting it
   * @param taskId Task ID to disable
   */
  async disable(taskId: string): Promise<void> {
    await this.taskManager.disableTask(taskId);
  }

  /**
   * Get information about a specific task
   * @param taskId Task ID to get info for
   * @returns Task information or null if not found
   */
  async getTaskInfo(taskId: string): Promise<TaskInfo | null> {
    const task = await this.taskManager.getTask(taskId);
    if (!task) return null;

    return {
      id: task.id,
      name: task.name,
      description: task.description,
      nextExecution: task.targetTime,
      isRecurring: task.recurring,
      enabled: task.enabled,
      runCount: task.runCount,
      lastExecution: task.lastExecution,
      lastError: task.lastError,
      useGameTime: task.useGameTime,
      scope: task.scope,
    };
  }

  /**
   * List all scheduled tasks
   * @param scope Optional scope filter
   * @returns Array of task information
   */
  async listTasks(scope?: 'world' | 'client'): Promise<TaskInfo[]> {
    const allTasks = await this.taskManager.getAllTasks();
    const tasks = scope ? allTasks[scope] : [...allTasks.world, ...allTasks.client];

    return tasks.map(task => ({
      id: task.id,
      name: task.name,
      description: task.description,
      nextExecution: task.targetTime,
      isRecurring: task.recurring,
      enabled: task.enabled,
      runCount: task.runCount,
      lastExecution: task.lastExecution,
      lastError: task.lastError,
      useGameTime: task.useGameTime,
      scope: task.scope,
    }));
  }

  /**
   * List tasks scheduled for a specific calendar date
   * @param calendarDate Calendar date to check
   * @returns Array of task information
   */
  async listTasksForDate(calendarDate: CalendarDate): Promise<TaskInfo[]> {
    const tasks = await this.taskManager.getTasksForDate(calendarDate);

    return tasks.map(task => ({
      id: task.id,
      name: task.name,
      description: task.description,
      nextExecution: task.targetTime,
      isRecurring: task.recurring,
      enabled: task.enabled,
      runCount: task.runCount,
      lastExecution: task.lastExecution,
      lastError: task.lastError,
      useGameTime: task.useGameTime,
      scope: task.scope,
    }));
  }

  /**
   * Get statistics about scheduled tasks
   * @returns Task statistics
   */
  async getStatistics(): Promise<{
    total: number;
    enabled: number;
    disabled: number;
    realTime: number;
    gameTime: number;
    recurring: number;
    oneTime: number;
    worldTasks: number;
    clientTasks: number;
  }> {
    const allTasks = await this.taskManager.getAllTasks();
    const allTasksList = [...allTasks.world, ...allTasks.client];

    return {
      total: allTasksList.length,
      enabled: allTasksList.filter(t => t.enabled).length,
      disabled: allTasksList.filter(t => !t.enabled).length,
      realTime: allTasksList.filter(t => !t.useGameTime).length,
      gameTime: allTasksList.filter(t => t.useGameTime).length,
      recurring: allTasksList.filter(t => t.recurring).length,
      oneTime: allTasksList.filter(t => !t.recurring).length,
      worldTasks: allTasks.world.length,
      clientTasks: allTasks.client.length,
    };
  }

  /**
   * Schedule a reminder task
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
    const callback = `ui.notifications?.info("Reminder: ${message.replace(/"/g, '\\"')}");`;
    return this.setTimeout(delay, callback, {
      ...options,
      name: options.name || `Reminder: ${message}`,
      description: options.description || `Reminder notification: ${message}`,
    });
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
    const callback = `ui.notifications?.info("Reminder: ${message.replace(/"/g, '\\"')}");`;
    return this.setInterval(interval, callback, {
      ...options,
      name: options.name || `Recurring Reminder: ${message}`,
      description: options.description || `Recurring reminder: ${message}`,
    });
  }

  /**
   * Schedule a game time reminder (e.g., "rest in 8 hours")
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
    const callback = `ui.notifications?.info("Game Time Reminder: ${message.replace(/"/g, '\\"')}");`;
    return this.setGameTimeout(delay, callback, {
      ...options,
      name: options.name || `Game Reminder: ${message}`,
      description: options.description || `Game time reminder: ${message}`,
    });
  }

  /**
   * Utility method to convert time specifications to human-readable strings
   * @param timeSpec Time specification to convert
   * @param useGameTime Whether this is game time
   * @returns Human-readable string
   */
  formatTimeSpec(timeSpec: TimeSpec, useGameTime: boolean = false): string {
    if (typeof timeSpec === 'number') {
      const date = new Date(timeSpec * 1000);
      return useGameTime ? `World Time ${timeSpec}` : date.toLocaleString();
    }

    if (TimeConverter.isAbsoluteTimeSpec(timeSpec)) {
      return `${timeSpec.year}/${timeSpec.month}/${timeSpec.day}`;
    }

    if (TimeConverter.isRelativeTimeSpec(timeSpec)) {
      const parts = [];
      if (timeSpec.days) parts.push(`${timeSpec.days} day${timeSpec.days !== 1 ? 's' : ''}`);
      if (timeSpec.hours) parts.push(`${timeSpec.hours} hour${timeSpec.hours !== 1 ? 's' : ''}`);
      if (timeSpec.minutes)
        parts.push(`${timeSpec.minutes} minute${timeSpec.minutes !== 1 ? 's' : ''}`);
      if (timeSpec.seconds)
        parts.push(`${timeSpec.seconds} second${timeSpec.seconds !== 1 ? 's' : ''}`);

      return parts.length > 0 ? parts.join(', ') : 'immediately';
    }

    // Handle empty objects (which should be treated as immediately)
    if (typeof timeSpec === 'object' && Object.keys(timeSpec).length === 0) {
      return 'immediately';
    }

    return 'unknown time';
  }

  /**
   * Get the next execution time as a human-readable string
   * @param taskId Task ID
   * @returns Formatted next execution time or null
   */
  async getNextExecutionTime(taskId: string): Promise<string | null> {
    const task = await this.taskManager.getTask(taskId);
    if (!task) return null;

    if (task.useGameTime) {
      const currentGameTime = TimeConverter.getCurrentGameTime();
      const timeLeft = task.targetTime - currentGameTime;
      if (timeLeft <= 0) return 'Ready to execute';

      return `In ${timeLeft} game time seconds`;
    } else {
      const currentTime = Math.floor(Date.now() / 1000);
      const timeLeft = task.targetTime - currentTime;
      if (timeLeft <= 0) return 'Ready to execute';

      const date = new Date(task.targetTime * 1000);
      return date.toLocaleString();
    }
  }

  /**
   * Check if TaskManager is properly initialized
   * @returns True if initialized
   */
  isReady(): boolean {
    return this.taskManager.isInitialized();
  }

  /**
   * Create an accumulated time task
   * @param options Task configuration
   * @returns Task ID
   */
  async createAccumulatedTimeTask(options: AccumulatedTimeTaskOptions): Promise<string> {
    return this.accumulatedTimeManager.createAccumulatedTimeTask(options);
  }

  /**
   * Add time to an accumulated time task
   * @param taskId Task ID
   * @param entry Time entry to add
   * @returns True if task is now complete
   */
  async addTimeToTask(taskId: string, entry: TimeLogEntry): Promise<boolean> {
    return this.accumulatedTimeManager.addTime(taskId, entry);
  }

  /**
   * Get progress for an accumulated time task
   * @param taskId Task ID
   * @returns Task progress or null if not found
   */
  async getAccumulatedTimeProgress(taskId: string) {
    return this.accumulatedTimeManager.getTaskProgress(taskId);
  }

  /**
   * List all accumulated time tasks
   * @param scope Optional scope filter
   * @returns Array of accumulated time tasks
   */
  async listAccumulatedTimeTasks(scope?: 'world' | 'client'): Promise<Task[]> {
    return this.accumulatedTimeManager.listAccumulatedTimeTasks(scope);
  }

  /**
   * Remove a time entry from a task
   * @param taskId Task ID
   * @param entryId Time entry ID
   * @returns True if removed
   */
  async removeTimeEntry(taskId: string, entryId: string): Promise<boolean> {
    return this.accumulatedTimeManager.removeTimeEntry(taskId, entryId);
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
    return this.accumulatedTimeManager.editTimeEntry(taskId, entryId, newDuration, newDescription);
  }

  /**
   * Get statistics for an accumulated time task
   * @param taskId Task ID
   * @returns Task statistics or null
   */
  async getAccumulatedTimeStatistics(taskId: string) {
    return this.accumulatedTimeManager.getTaskStatistics(taskId);
  }

  /**
   * Export time log for a task
   * @param taskId Task ID
   * @param format Export format
   * @returns Exported data
   */
  async exportTaskTimeLog(taskId: string, format: 'json' | 'csv' = 'csv'): Promise<string> {
    return this.accumulatedTimeManager.exportTaskTimeLog(taskId, format);
  }

  /**
   * Initialize the scheduler (delegates to TaskManager)
   */
  async initialize(): Promise<void> {
    await this.taskManager.initialize();
    await this.accumulatedTimeManager.initialize();
  }

  /**
   * Shutdown the scheduler (delegates to TaskManager)
   */
  async shutdown(): Promise<void> {
    await this.taskManager.shutdown();
    await this.accumulatedTimeManager.shutdown();
  }
}
