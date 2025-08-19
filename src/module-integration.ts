/**
 * Module Integration API for Task & Trigger
 * Provides a clean interface for external modules to integrate with the task system
 */

import { TimeSpec, CalendarDate } from './types';
import { TaskScheduler, ScheduleOptions } from './task-scheduler';
import { MacroManager } from './macro-manager';
import { AccumulatedTimeTaskOptions } from './accumulated-time-manager';

export interface ModuleTaskOptions extends ScheduleOptions {
  /** The module ID creating this task */
  moduleId: string;
  /** Code to execute when task triggers */
  taskCode: string;
  /** Whether this task should be temporary (cleaned up on disable) */
  temporary?: boolean;
}

export interface ModuleIntegrationAPI {
  // Basic task creation
  createOneTimeTask(delay: TimeSpec, options: ModuleTaskOptions): Promise<string>;
  createRecurringTask(interval: TimeSpec, options: ModuleTaskOptions): Promise<string>;
  createScheduledTask(dateTime: Date, options: ModuleTaskOptions): Promise<string>;
  createCalendarTask(calendarDate: CalendarDate, options: ModuleTaskOptions): Promise<string>;

  // Game time tasks
  createGameTimeTask(delay: TimeSpec, options: ModuleTaskOptions): Promise<string>;
  createGameTimeRecurring(interval: TimeSpec, options: ModuleTaskOptions): Promise<string>;

  // Accumulated time tasks
  createAccumulatedTimeTask(
    options: AccumulatedTimeTaskOptions & { moduleId: string }
  ): Promise<string>;

  // Task management
  cancelTask(taskId: string): Promise<boolean>;
  enableTask(taskId: string): Promise<void>;
  disableTask(taskId: string): Promise<void>;

  // Module lifecycle
  registerModule(moduleId: string, displayName: string): Promise<void>;
  unregisterModule(moduleId: string): Promise<void>;
  cleanupModuleTasks(moduleId: string): Promise<number>;

  // Helper methods
  createNotificationTask(
    delay: TimeSpec,
    message: string,
    options: Omit<ModuleTaskOptions, 'taskCode'>
  ): Promise<string>;
  createChatTask(
    delay: TimeSpec,
    message: string,
    options: Omit<ModuleTaskOptions, 'taskCode'>
  ): Promise<string>;
}

export class ModuleIntegrationImpl implements ModuleIntegrationAPI {
  private scheduler: TaskScheduler;
  private macroManager: MacroManager;
  private registeredModules: Map<string, { displayName: string; taskIds: Set<string> }>;

  constructor() {
    this.scheduler = TaskScheduler.getInstance();
    this.macroManager = MacroManager.getInstance();
    this.registeredModules = new Map();
  }

  /**
   * Register a module with the task system
   */
  async registerModule(moduleId: string, displayName: string): Promise<void> {
    if (!this.registeredModules.has(moduleId)) {
      this.registeredModules.set(moduleId, {
        displayName,
        taskIds: new Set(),
      });

      // Create module folder for organization
      await this.macroManager.createModuleFolder(moduleId);

      console.log(`Task & Trigger: Registered module ${moduleId} (${displayName})`);
    }
  }

  /**
   * Unregister a module and clean up its tasks
   */
  async unregisterModule(moduleId: string): Promise<void> {
    const moduleData = this.registeredModules.get(moduleId);
    if (moduleData) {
      // Cancel all tasks created by this module
      const cleanedCount = await this.cleanupModuleTasks(moduleId);

      this.registeredModules.delete(moduleId);

      console.log(
        `Task & Trigger: Unregistered module ${moduleId}, cleaned up ${cleanedCount} tasks`
      );
    }
  }

  /**
   * Clean up all tasks created by a specific module
   */
  async cleanupModuleTasks(moduleId: string): Promise<number> {
    const moduleData = this.registeredModules.get(moduleId);
    if (!moduleData) return 0;

    let cleanedCount = 0;
    for (const taskId of moduleData.taskIds) {
      try {
        await this.scheduler.cancel(taskId);
        cleanedCount++;
      } catch (error) {
        console.warn(`Failed to cancel task ${taskId} for module ${moduleId}:`, error);
      }
    }

    moduleData.taskIds.clear();
    return cleanedCount;
  }

  /**
   * Create a one-time task
   */
  async createOneTimeTask(delay: TimeSpec, options: ModuleTaskOptions): Promise<string> {
    const macroId = await this.createTaskMacro(options);
    const taskId = await this.scheduler.setTimeout(delay, macroId, options);
    this.trackTask(options.moduleId, taskId);
    return taskId;
  }

  /**
   * Create a recurring task
   */
  async createRecurringTask(interval: TimeSpec, options: ModuleTaskOptions): Promise<string> {
    const macroId = await this.createTaskMacro(options);
    const taskId = await this.scheduler.setInterval(interval, macroId, options);
    this.trackTask(options.moduleId, taskId);
    return taskId;
  }

  /**
   * Create a task scheduled for a specific date/time
   */
  async createScheduledTask(dateTime: Date, options: ModuleTaskOptions): Promise<string> {
    const macroId = await this.createTaskMacro(options);
    const taskId = await this.scheduler.scheduleAt(dateTime, macroId, options);
    this.trackTask(options.moduleId, taskId);
    return taskId;
  }

  /**
   * Create a task for a specific calendar date
   */
  async createCalendarTask(
    calendarDate: CalendarDate,
    options: ModuleTaskOptions
  ): Promise<string> {
    const macroId = await this.createTaskMacro(options);
    const taskId = await this.scheduler.scheduleForDate(calendarDate, macroId, options);
    this.trackTask(options.moduleId, taskId);
    return taskId;
  }

  /**
   * Create a game time task
   */
  async createGameTimeTask(delay: TimeSpec, options: ModuleTaskOptions): Promise<string> {
    const macroId = await this.createTaskMacro(options);
    const taskId = await this.scheduler.setGameTimeout(delay, macroId, options);
    this.trackTask(options.moduleId, taskId);
    return taskId;
  }

  /**
   * Create a recurring game time task
   */
  async createGameTimeRecurring(interval: TimeSpec, options: ModuleTaskOptions): Promise<string> {
    const macroId = await this.createTaskMacro(options);
    const taskId = await this.scheduler.setGameInterval(interval, macroId, options);
    this.trackTask(options.moduleId, taskId);
    return taskId;
  }

  /**
   * Create an accumulated time task
   */
  async createAccumulatedTimeTask(
    options: AccumulatedTimeTaskOptions & { moduleId: string }
  ): Promise<string> {
    const taskId = await this.scheduler.createAccumulatedTimeTask(options);
    this.trackTask(options.moduleId, taskId);
    return taskId;
  }

  /**
   * Cancel a task
   */
  async cancelTask(taskId: string): Promise<boolean> {
    const success = await this.scheduler.cancel(taskId);
    if (success) {
      // Remove from all module tracking
      for (const moduleData of this.registeredModules.values()) {
        moduleData.taskIds.delete(taskId);
      }
    }
    return success;
  }

  /**
   * Enable a task
   */
  async enableTask(taskId: string): Promise<void> {
    await this.scheduler.enable(taskId);
  }

  /**
   * Disable a task
   */
  async disableTask(taskId: string): Promise<void> {
    await this.scheduler.disable(taskId);
  }

  /**
   * Create a simple notification task
   */
  async createNotificationTask(
    delay: TimeSpec,
    message: string,
    options: Omit<ModuleTaskOptions, 'taskCode'>
  ): Promise<string> {
    const taskCode = `ui.notifications?.info("${message.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}");`;
    return this.createOneTimeTask(delay, {
      ...options,
      taskCode,
      name: options.name || `Notification: ${message.substring(0, 50)}`,
      description: options.description || `Show notification: ${message}`,
    });
  }

  /**
   * Create a chat message task
   */
  async createChatTask(
    delay: TimeSpec,
    message: string,
    options: Omit<ModuleTaskOptions, 'taskCode'>
  ): Promise<string> {
    const taskCode = `ChatMessage.create({ content: "${message.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}", whisper: [] });`;
    return this.createOneTimeTask(delay, {
      ...options,
      taskCode,
      name: options.name || `Chat: ${message.substring(0, 50)}`,
      description: options.description || `Send chat message: ${message}`,
    });
  }

  /**
   * Create a macro for a task and return its ID
   */
  private async createTaskMacro(options: ModuleTaskOptions): Promise<string> {
    const moduleData = this.registeredModules.get(options.moduleId);
    const folderName = moduleData
      ? `task-and-trigger/${options.moduleId}`
      : 'task-and-trigger/external';

    const macro = await this.macroManager.createTaskMacro({
      name: options.name || 'Module Task',
      code: options.taskCode,
      folder: folderName,
      moduleId: options.moduleId,
    });

    return macro.id;
  }

  /**
   * Track a task ID for a module
   */
  private trackTask(moduleId: string, taskId: string): void {
    const moduleData = this.registeredModules.get(moduleId);
    if (moduleData) {
      moduleData.taskIds.add(taskId);
    }
  }

  /**
   * Get statistics for a module's tasks
   */
  async getModuleTaskStats(moduleId: string): Promise<{
    totalTasks: number;
    activeTasks: number;
    completedTasks: number;
  } | null> {
    const moduleData = this.registeredModules.get(moduleId);
    if (!moduleData) return null;

    let activeTasks = 0;
    let completedTasks = 0;

    for (const taskId of moduleData.taskIds) {
      try {
        const taskInfo = await this.scheduler.getTaskInfo(taskId);
        if (taskInfo) {
          if (taskInfo.enabled) {
            activeTasks++;
          } else {
            completedTasks++;
          }
        }
      } catch {
        // Task might have been deleted
        completedTasks++;
      }
    }

    return {
      totalTasks: moduleData.taskIds.size,
      activeTasks,
      completedTasks,
    };
  }

  /**
   * List all registered modules
   */
  getRegisteredModules(): Array<{ moduleId: string; displayName: string; taskCount: number }> {
    return Array.from(this.registeredModules.entries()).map(([moduleId, data]) => ({
      moduleId,
      displayName: data.displayName,
      taskCount: data.taskIds.size,
    }));
  }
}

/**
 * Create and return the module integration API instance
 */
export function createModuleIntegrationAPI(): ModuleIntegrationAPI {
  return new ModuleIntegrationImpl();
}
