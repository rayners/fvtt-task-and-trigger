/**
 * AccumulatedTimeManager - Manages tasks that require accumulated time logging
 * Handles manual time entry, progress tracking, and completion
 */

import { Task, TimeEntry, TimeSpec } from './types';
import { TaskManager } from './task-manager';
import { JournalStorage } from './journal-storage';
import { TimeConverter } from './time-converter';

export interface AccumulatedTimeTaskOptions {
  name: string;
  description?: string;
  requiredTime: TimeSpec; // Total time required for completion
  callback: string; // JavaScript to execute when completed
  scope?: 'world' | 'client';
  logExecution?: boolean;
}

export interface TimeLogEntry {
  duration: TimeSpec; // Time to add (e.g., { hours: 3 })
  description?: string; // What was accomplished
}

export class AccumulatedTimeManager {
  private static instance: AccumulatedTimeManager;
  private taskManager: TaskManager;
  private storage: JournalStorage;

  private constructor() {
    this.taskManager = TaskManager.getInstance();
    this.storage = JournalStorage.getInstance();
  }

  static getInstance(): AccumulatedTimeManager {
    if (!this.instance) {
      this.instance = new AccumulatedTimeManager();
    }
    return this.instance;
  }

  /**
   * Create a new accumulated time task
   */
  async createAccumulatedTimeTask(options: AccumulatedTimeTaskOptions): Promise<string> {
    // Convert required time to seconds (time-agnostic - just a number)
    const requiredSeconds = TimeConverter.toDuration(options.requiredTime);

    const task: Task = {
      id: (foundry.utils as any).randomID(),
      name: options.name,
      description: options.description,
      callback: options.callback,
      timeSpec: options.requiredTime,
      targetTime: 0, // Will be set when accumulated time is reached
      useGameTime: false, // Accumulated time tasks are time-agnostic
      recurring: false,
      interval: undefined,
      scope: options.scope || 'client',
      enabled: true,
      created: Math.floor(Date.now() / 1000), // Real time creation for record keeping
      runCount: 0,
      lastExecution: undefined,
      lastError: undefined,
      logExecution: options.logExecution || false,
      calendarIntegrated: false,
      uiConfigured: true, // Persist across restarts

      // Accumulated time specific properties
      isAccumulatedTime: true,
      requiredTime: requiredSeconds,
      accumulatedTime: 0,
      timeEntries: [],
    };

    // Add task to storage
    await this.taskManager.addTask(task);

    console.log(
      `Task & Trigger | Created accumulated time task: ${task.name} (${this.formatDuration(requiredSeconds)} required)`
    );
    ui.notifications?.info(`Created accumulated time task: ${task.name}`);

    return task.id;
  }

  /**
   * Add time to an accumulated time task
   */
  async addTime(taskId: string, entry: TimeLogEntry): Promise<boolean> {
    const task = await this.taskManager.getTask(taskId);

    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    if (!task.isAccumulatedTime) {
      throw new Error(`Task ${taskId} is not an accumulated time task`);
    }

    // Convert duration to seconds (time-agnostic - just a number)
    const durationSeconds = TimeConverter.toDuration(entry.duration);

    if (durationSeconds <= 0) {
      throw new Error('Duration must be positive');
    }

    // Create time entry with real timestamp for record keeping
    const timeEntry: TimeEntry = {
      id: (foundry.utils as any).randomID(),
      timestamp: Math.floor(Date.now() / 1000),
      duration: durationSeconds,
      description: entry.description,
      loggedBy: game.user?.name || 'Unknown',
    };

    // Update task
    task.accumulatedTime = (task.accumulatedTime || 0) + durationSeconds;
    task.timeEntries = task.timeEntries || [];
    task.timeEntries.push(timeEntry);

    // Check if task is now complete
    const isComplete = task.accumulatedTime >= (task.requiredTime || 0);

    if (isComplete && task.targetTime === 0) {
      // Set task to execute immediately (real time)
      task.targetTime = Math.floor(Date.now() / 1000);
      console.log(`Task & Trigger | Accumulated time task completed: ${task.name}`);
      ui.notifications?.info(
        `Task completed! ${task.name} - ${this.formatDuration(task.accumulatedTime)} accumulated`
      );
    }

    // Update task in storage
    await this.taskManager.updateTask(task);

    // Emit hook for UI updates
    Hooks.callAll('taskTriggerAccumulatedTimeUpdated', {
      taskId: task.id,
      taskName: task.name,
      accumulatedTime: task.accumulatedTime,
      requiredTime: task.requiredTime,
      isComplete,
      newEntry: timeEntry,
    });

    const remaining = (task.requiredTime || 0) - task.accumulatedTime;
    console.log(
      `Task & Trigger | Added ${this.formatDuration(durationSeconds)} to ${task.name}. ` +
        `Total: ${this.formatDuration(task.accumulatedTime)}/${this.formatDuration(task.requiredTime || 0)} ` +
        `(${remaining > 0 ? this.formatDuration(remaining) + ' remaining' : 'COMPLETE'})`
    );

    return isComplete;
  }

  /**
   * Get accumulated time task progress
   */
  async getTaskProgress(taskId: string): Promise<{
    task: Task;
    progress: number; // 0.0 to 1.0
    remaining: number; // seconds remaining
    isComplete: boolean;
    timeEntries: TimeEntry[];
  } | null> {
    const task = await this.taskManager.getTask(taskId);

    if (!task || !task.isAccumulatedTime) {
      return null;
    }

    const accumulatedTime = task.accumulatedTime || 0;
    const requiredTime = task.requiredTime || 0;
    const progress = requiredTime > 0 ? Math.min(accumulatedTime / requiredTime, 1.0) : 0;
    const remaining = Math.max(requiredTime - accumulatedTime, 0);
    const isComplete = accumulatedTime >= requiredTime;

    return {
      task,
      progress,
      remaining,
      isComplete,
      timeEntries: task.timeEntries || [],
    };
  }

  /**
   * List all accumulated time tasks
   */
  async listAccumulatedTimeTasks(scope?: 'world' | 'client'): Promise<Task[]> {
    const allTasks = await this.taskManager.getAllTasks();
    const tasks = scope ? allTasks[scope] : [...allTasks.world, ...allTasks.client];

    return tasks.filter(task => task.isAccumulatedTime);
  }

  /**
   * Remove a time entry from a task
   */
  async removeTimeEntry(taskId: string, entryId: string): Promise<boolean> {
    const task = await this.taskManager.getTask(taskId);

    if (!task || !task.isAccumulatedTime) {
      return false;
    }

    const timeEntries = task.timeEntries || [];
    const entryIndex = timeEntries.findIndex(entry => entry.id === entryId);

    if (entryIndex === -1) {
      return false;
    }

    const removedEntry = timeEntries[entryIndex];
    timeEntries.splice(entryIndex, 1);

    // Update accumulated time
    task.accumulatedTime = (task.accumulatedTime || 0) - removedEntry.duration;
    task.accumulatedTime = Math.max(task.accumulatedTime, 0);

    // If task was previously complete but is no longer, reset target time
    if (task.accumulatedTime < (task.requiredTime || 0) && task.targetTime > 0) {
      task.targetTime = 0;
      ui.notifications?.warn(`Task ${task.name} is no longer complete`);
    }

    await this.taskManager.updateTask(task);

    console.log(
      `Task & Trigger | Removed time entry from ${task.name}: ${this.formatDuration(removedEntry.duration)}`
    );

    return true;
  }

  /**
   * Edit a time entry
   */
  async editTimeEntry(
    taskId: string,
    entryId: string,
    newDuration: TimeSpec,
    newDescription?: string
  ): Promise<boolean> {
    const task = await this.taskManager.getTask(taskId);

    if (!task || !task.isAccumulatedTime) {
      return false;
    }

    const timeEntries = task.timeEntries || [];
    const entry = timeEntries.find(e => e.id === entryId);

    if (!entry) {
      return false;
    }

    const newDurationSeconds = TimeConverter.toDuration(newDuration);
    const oldDuration = entry.duration;

    // Update entry
    entry.duration = newDurationSeconds;
    entry.description = newDescription;

    // Update accumulated time
    task.accumulatedTime = (task.accumulatedTime || 0) - oldDuration + newDurationSeconds;
    task.accumulatedTime = Math.max(task.accumulatedTime, 0);

    // Check completion status
    const wasComplete = task.targetTime > 0;
    const isComplete = task.accumulatedTime >= (task.requiredTime || 0);

    if (!wasComplete && isComplete) {
      task.targetTime = Math.floor(Date.now() / 1000);
      ui.notifications?.info(`Task completed! ${task.name}`);
    } else if (wasComplete && !isComplete) {
      task.targetTime = 0;
      ui.notifications?.warn(`Task ${task.name} is no longer complete`);
    }

    await this.taskManager.updateTask(task);

    console.log(`Task & Trigger | Edited time entry for ${task.name}`);

    return true;
  }

  /**
   * Get accumulated time statistics for a task
   */
  async getTaskStatistics(taskId: string): Promise<{
    totalEntries: number;
    averageSessionDuration: number;
    longestSession: number;
    shortestSession: number;
    totalSessions: number;
    sessionsThisWeek: number;
    estimatedCompletion?: Date; // Based on average session frequency and duration
  } | null> {
    const task = await this.taskManager.getTask(taskId);

    if (!task || !task.isAccumulatedTime || !task.timeEntries?.length) {
      return null;
    }

    const entries = task.timeEntries;
    const durations = entries.map(e => e.duration);
    const totalEntries = entries.length;
    const averageSessionDuration = durations.reduce((sum, dur) => sum + dur, 0) / totalEntries;
    const longestSession = Math.max(...durations);
    const shortestSession = Math.min(...durations);

    // Calculate recent activity (real time)
    const weekAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
    const sessionsThisWeek = entries.filter(e => e.timestamp >= weekAgo).length;

    // Estimate completion time based on recent activity
    let estimatedCompletion: Date | undefined;
    const remaining = (task.requiredTime || 0) - (task.accumulatedTime || 0);

    if (remaining > 0 && sessionsThisWeek > 0) {
      const weeklyRate = entries
        .filter(e => e.timestamp >= weekAgo)
        .reduce((sum, e) => sum + e.duration, 0);

      if (weeklyRate > 0) {
        const weeksToCompletion = remaining / weeklyRate;
        const timeToCompletion = weeksToCompletion * 7 * 24 * 60 * 60 * 1000; // in milliseconds
        estimatedCompletion = new Date(Date.now() + timeToCompletion);
      }
    }

    return {
      totalEntries,
      averageSessionDuration,
      longestSession,
      shortestSession,
      totalSessions: totalEntries,
      sessionsThisWeek,
      estimatedCompletion,
    };
  }

  /**
   * Export time entries for a task
   */
  async exportTaskTimeLog(taskId: string, format: 'json' | 'csv' = 'csv'): Promise<string> {
    const task = await this.taskManager.getTask(taskId);

    if (!task || !task.isAccumulatedTime) {
      throw new Error('Task not found or not an accumulated time task');
    }

    const entries = task.timeEntries || [];

    if (format === 'csv') {
      const headers = ['Date', 'Duration (Hours)', 'Description', 'Logged By'];
      const csvRows = [headers.join(',')];

      for (const entry of entries) {
        const date = new Date(entry.timestamp * 1000).toISOString().split('T')[0];
        const hours = (entry.duration / 3600).toFixed(2);
        const description = entry.description ? `"${entry.description.replace(/"/g, '""')}"` : '';
        const loggedBy = entry.loggedBy || 'Unknown';

        csvRows.push([date, hours, description, loggedBy].join(','));
      }

      return csvRows.join('\n');
    } else {
      return JSON.stringify(
        {
          taskId: task.id,
          taskName: task.name,
          requiredTime: task.requiredTime,
          accumulatedTime: task.accumulatedTime,
          entries,
        },
        null,
        2
      );
    }
  }

  /**
   * Format duration in seconds to human readable string
   */
  private formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (remainingSeconds > 0 || parts.length === 0) parts.push(`${remainingSeconds}s`);

    return parts.join(' ');
  }

  /**
   * Initialize accumulated time manager
   */
  async initialize(): Promise<void> {
    console.log('Task & Trigger | AccumulatedTimeManager initialized');
  }

  /**
   * Shutdown accumulated time manager
   */
  async shutdown(): Promise<void> {
    console.log('Task & Trigger | AccumulatedTimeManager shutdown');
  }
}
