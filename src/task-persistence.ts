/**
 * TaskPersistence - Simple persistence for UI-configured tasks only
 * Console/API tasks are ephemeral and will be lost on restart (by design)
 */

import { Task } from './types';
import { TaskManager } from './task-manager';
import { JournalStorage } from './journal-storage';

export class TaskPersistence {
  private static instance: TaskPersistence;
  private taskManager: TaskManager;
  private storage: JournalStorage;

  private constructor() {
    this.taskManager = TaskManager.getInstance();
    this.storage = JournalStorage.getInstance();
  }

  static getInstance(): TaskPersistence {
    if (!this.instance) {
      this.instance = new TaskPersistence();
    }
    return this.instance;
  }

  /**
   * Initialize persistence system and recover UI-configured tasks
   */
  async initialize(): Promise<void> {
    console.log('Task & Trigger | Initializing task persistence system');

    try {
      // Get all persisted tasks from storage
      const allTasks = await this.storage.getAllTasks();
      const allTasksList = [...allTasks.world, ...allTasks.client];

      // Filter for UI-configured tasks that should be recovered
      const uiTasks = allTasksList.filter(
        task =>
          task.enabled &&
          task.uiConfigured && // Only recover tasks created through UI
          !task.useGameTime // Only real-time tasks need recovery (game time tasks work via hooks)
        // Note: We include both future and past tasks - past tasks will be disabled in recoverUITask
      );

      console.log(`Task & Trigger | Found ${uiTasks.length} UI-configured tasks to recover`);

      // Reschedule these tasks
      for (const task of uiTasks) {
        try {
          await this.recoverUITask(task);
        } catch (error) {
          console.error(`Task & Trigger | Failed to recover UI task ${task.id}:`, error);
        }
      }

      console.log('Task & Trigger | UI task recovery complete');
    } catch (error) {
      console.error('Task & Trigger | Failed to initialize task persistence:', error);
    }
  }

  /**
   * Recover a UI-configured task by rescheduling it
   * @param task Task to recover
   */
  private async recoverUITask(task: Task): Promise<void> {
    const currentTime = Math.floor(Date.now() / 1000);

    if (task.recurring) {
      // For recurring tasks, just update the task which will trigger rescheduling
      console.log(`Task & Trigger | Recovering recurring UI task: ${task.name}`);
      await this.taskManager.updateTask(task);
    } else {
      if (task.targetTime > currentTime) {
        // One-time task still in future - reschedule it
        console.log(`Task & Trigger | Recovering future UI task: ${task.name}`);
        await this.taskManager.updateTask(task);
      } else {
        // One-time task is in the past - disable it
        console.log(`Task & Trigger | Disabling past UI task: ${task.name}`);
        task.enabled = false;
        task.lastError = 'Task expired during downtime';
        await this.taskManager.updateTask(task);
      }
    }
  }

  /**
   * Mark a task as UI-configured so it will be recovered on restart
   * @param taskId Task ID to mark
   */
  async markAsUIConfigured(taskId: string): Promise<void> {
    const task = await this.taskManager.getTask(taskId);
    if (task) {
      task.uiConfigured = true;
      await this.taskManager.updateTask(task);
    }
  }

  /**
   * Remove UI-configured flag from a task (makes it ephemeral)
   * @param taskId Task ID to mark as ephemeral
   */
  async markAsEphemeral(taskId: string): Promise<void> {
    const task = await this.taskManager.getTask(taskId);
    if (task) {
      task.uiConfigured = false;
      await this.taskManager.updateTask(task);
    }
  }

  /**
   * Get count of UI-configured vs ephemeral tasks
   */
  async getTaskCounts(): Promise<{
    total: number;
    uiConfigured: number;
    ephemeral: number;
    enabled: number;
    disabled: number;
  }> {
    const allTasks = await this.taskManager.getAllTasks();
    const allTasksList = [...allTasks.world, ...allTasks.client];

    return {
      total: allTasksList.length,
      uiConfigured: allTasksList.filter(t => t.uiConfigured).length,
      ephemeral: allTasksList.filter(t => !t.uiConfigured).length,
      enabled: allTasksList.filter(t => t.enabled).length,
      disabled: allTasksList.filter(t => !t.enabled).length,
    };
  }

  /**
   * Clean up old disabled tasks (housekeeping)
   * @param olderThanDays Remove disabled tasks older than this many days
   */
  async cleanupOldTasks(olderThanDays: number = 7): Promise<number> {
    const cutoffTime = Math.floor(Date.now() / 1000) - olderThanDays * 86400;
    const allTasks = await this.taskManager.getAllTasks();
    const allTasksList = [...allTasks.world, ...allTasks.client];

    const tasksToRemove = allTasksList.filter(
      task =>
        !task.enabled &&
        !task.uiConfigured && // Only clean up ephemeral tasks
        task.created < cutoffTime
    );

    for (const task of tasksToRemove) {
      await this.taskManager.cancelTask(task.id);
    }

    console.log(`Task & Trigger | Cleaned up ${tasksToRemove.length} old disabled tasks`);
    return tasksToRemove.length;
  }

  /**
   * Prepare for shutdown - placeholder for future persistence state tracking
   */
  async prepareShutdown(): Promise<void> {
    console.log('Task & Trigger | TaskPersistence preparing for shutdown');
    // Future: Could save current state, task counts, etc. for recovery analysis
    // For now, this is just a placeholder to match the main.ts expectations
  }

  /**
   * Register module settings
   */
  static registerSettings(): void {
    console.log('Task & Trigger | Registering module settings');

    // Task Manager UI settings
    game.settings?.register('task-and-trigger', 'defaultScope', {
      name: 'Default Task Scope',
      hint: 'Default scope for new tasks created through the UI',
      scope: 'client',
      config: false, // Managed through Task Manager UI
      type: String,
      choices: {
        client: 'Client (Personal)',
        world: 'World (Shared)',
      },
      default: 'client',
    });

    game.settings?.register('task-and-trigger', 'autoCleanup', {
      name: 'Auto-cleanup Old Tasks',
      hint: 'Automatically remove old, disabled ephemeral tasks after 7 days',
      scope: 'world',
      config: false, // Managed through Task Manager UI
      type: Boolean,
      default: false,
    });

    game.settings?.register('task-and-trigger', 'executionLogging', {
      name: 'Enable Execution Logging by Default',
      hint: 'New tasks will log their execution to journal notes by default',
      scope: 'client',
      config: false, // Managed through Task Manager UI
      type: Boolean,
      default: false,
    });
  }
}
