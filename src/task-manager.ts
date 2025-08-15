/**
 * TaskManager - Core scheduling and execution engine for tasks
 * Uses updateWorldTime hook instead of setInterval for game time monitoring
 */

import { Task, TimeSpec, CalendarDate, TaskExecutionResult } from './types';
import { TimeConverter } from './time-converter';
import { TaskExecutor } from './task-executor';
import { JournalStorage } from './journal-storage';
import { EventLogger } from './event-logger';

export class TaskManager {
  private static instance: TaskManager;
  private worldTasks: Map<string, Task> = new Map();
  private clientTasks: Map<string, Task> = new Map();
  private realTimeSchedules: Map<string, NodeJS.Timeout> = new Map();
  private gameTimeChecks: Map<string, Task> = new Map();
  private initialized = false;
  private storage: JournalStorage;
  private executor: TaskExecutor;
  private logger: EventLogger;

  private constructor() {
    this.storage = JournalStorage.getInstance();
    this.executor = TaskExecutor.getInstance();
    this.logger = EventLogger.getInstance();
  }

  static getInstance(): TaskManager {
    if (!this.instance) {
      this.instance = new TaskManager();
    }
    return this.instance;
  }

  /**
   * Initialize task manager and register hooks
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize event logger
      await this.logger.initialize();

      // Load existing tasks from storage
      await this.loadAllTasks();

      // Register updateWorldTime hook for game time monitoring
      Hooks.on('updateWorldTime', (worldTime: number, dt: number) => {
        this.handleWorldTimeUpdate(worldTime, dt);
      });

      // Schedule real-time tasks
      this.scheduleRealTimeTasks();

      this.initialized = true;
      console.log('Task & Trigger | TaskManager initialized');
    } catch (error) {
      console.error('Task & Trigger | Failed to initialize TaskManager:', error);
      throw error;
    }
  }

  /**
   * Check if TaskManager is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Schedule a one-time task
   * @param timeSpec When to execute the task
   * @param callback JavaScript code to execute
   * @param useGameTime Whether to use game time or real time
   * @param scope Storage scope (world or client)
   * @returns Task ID
   */
  async scheduleTask(
    timeSpec: TimeSpec,
    callback: string,
    useGameTime: boolean = false,
    scope: 'world' | 'client' = 'client'
  ): Promise<string> {
    // Validate inputs
    if (!callback || callback.trim() === '') {
      throw new Error('Callback cannot be empty');
    }

    try {
      TimeConverter.toTimestamp(timeSpec, useGameTime);
    } catch (error) {
      throw new Error(`Invalid time specification: ${error}`);
    }

    const task: Task = {
      id: foundry.utils.randomID(),
      name: this.generateTaskName(timeSpec, useGameTime),
      description: `Scheduled task: ${callback.substring(0, 50)}${callback.length > 50 ? '...' : ''}`,
      timeSpec,
      targetTime: TimeConverter.toTimestamp(timeSpec, useGameTime),
      callback,
      useGameTime,
      recurring: false,
      scope,
      enabled: true,
      created: Math.floor(Date.now() / 1000),
      runCount: 0,
      logExecution: false,
    };

    // Store task
    await this.addTask(task);

    // Schedule execution
    this.scheduleTaskExecution(task);

    return task.id;
  }

  /**
   * Schedule a recurring task (interval)
   * @param interval How often to repeat the task
   * @param callback JavaScript code to execute
   * @param useGameTime Whether to use game time or real time
   * @param scope Storage scope (world or client)
   * @returns Task ID
   */
  async scheduleInterval(
    interval: TimeSpec,
    callback: string,
    useGameTime: boolean = false,
    scope: 'world' | 'client' = 'client'
  ): Promise<string> {
    // Validate inputs
    if (!callback || callback.trim() === '') {
      throw new Error('Callback cannot be empty');
    }

    try {
      TimeConverter.toTimestamp(interval, useGameTime);
    } catch (error) {
      throw new Error(`Invalid interval specification: ${error}`);
    }

    const task: Task = {
      id: foundry.utils.randomID(),
      name: this.generateIntervalName(interval, useGameTime),
      description: `Recurring task: ${callback.substring(0, 50)}${callback.length > 50 ? '...' : ''}`,
      timeSpec: interval,
      targetTime: Math.floor(Date.now() / 1000) + TimeConverter.toTimestamp(interval, useGameTime),
      callback,
      useGameTime,
      recurring: true,
      interval,
      scope,
      enabled: true,
      created: Math.floor(Date.now() / 1000),
      runCount: 0,
      logExecution: false,
    };

    // Store task
    await this.addTask(task);

    // Schedule execution
    this.scheduleTaskExecution(task);

    return task.id;
  }

  /**
   * Schedule a task for a specific calendar date (requires S&S integration)
   * @param calendarDate Calendar date specification
   * @param callback JavaScript code to execute
   * @param scope Storage scope (world or client)
   * @returns Task ID
   */
  async scheduleCalendarTask(
    calendarDate: CalendarDate,
    callback: string,
    scope: 'world' | 'client' = 'world'
  ): Promise<string> {
    const task: Task = {
      id: foundry.utils.randomID(),
      name: `Calendar Task: ${calendarDate.year}/${calendarDate.month}/${calendarDate.day}`,
      description: `Calendar task: ${callback.substring(0, 50)}${callback.length > 50 ? '...' : ''}`,
      timeSpec: calendarDate,
      targetTime: TimeConverter.calendarDateToWorldTime(calendarDate),
      callback,
      useGameTime: true,
      recurring: false,
      scope,
      enabled: true,
      created: Math.floor(Date.now() / 1000),
      runCount: 0,
      logExecution: true,
      calendarIntegrated: true,
      calendarDate,
    };

    // Store task
    await this.addTask(task);

    // Game time tasks are handled by updateWorldTime hook
    this.gameTimeChecks.set(task.id, task);

    return task.id;
  }

  /**
   * Cancel a scheduled task
   * @param taskId Task ID to cancel
   * @returns True if task was cancelled, false if not found
   */
  async cancelTask(taskId: string): Promise<boolean> {
    const task = await this.getTask(taskId);
    if (!task) return false;

    // Remove from storage
    await this.storage.removeTask(taskId, task.scope);

    // Remove from memory
    this.worldTasks.delete(taskId);
    this.clientTasks.delete(taskId);

    // Clear real-time scheduling
    if (this.realTimeSchedules.has(taskId)) {
      clearTimeout(this.realTimeSchedules.get(taskId)!);
      this.realTimeSchedules.delete(taskId);
    }

    // Remove from game time checks
    this.gameTimeChecks.delete(taskId);

    console.log(`Task & Trigger | Cancelled task: ${taskId}`);
    return true;
  }

  /**
   * Get a specific task
   * @param taskId Task ID
   * @returns Task or null if not found
   */
  async getTask(taskId: string): Promise<Task | null> {
    // Check memory first
    if (this.worldTasks.has(taskId)) {
      return this.worldTasks.get(taskId)!;
    }
    if (this.clientTasks.has(taskId)) {
      return this.clientTasks.get(taskId)!;
    }

    // Check storage
    const worldTask = await this.storage.getTask(taskId, 'world');
    if (worldTask) return worldTask;

    const clientTask = await this.storage.getTask(taskId, 'client');
    return clientTask;
  }

  /**
   * Update an existing task
   * @param task Updated task data
   */
  async updateTask(task: Task): Promise<void> {
    if (!task.id) {
      throw new Error('Task ID is required for updates');
    }

    try {
      // Try to update in storage
      await this.storage.updateTask(task);
    } catch (error) {
      // If task not found in storage, try to add it
      if (error instanceof Error && error.message.includes('Task not found')) {
        await this.storage.addTask(task);
      } else {
        throw error;
      }
    }

    // Update in memory
    if (task.scope === 'world') {
      this.worldTasks.set(task.id, task);
    } else {
      this.clientTasks.set(task.id, task);
    }

    // Reschedule if enabled
    if (task.enabled) {
      this.scheduleTaskExecution(task);
    } else {
      // Cancel scheduling if disabled
      if (this.realTimeSchedules.has(task.id)) {
        clearTimeout(this.realTimeSchedules.get(task.id)!);
        this.realTimeSchedules.delete(task.id);
      }
      this.gameTimeChecks.delete(task.id);
    }
  }

  /**
   * Enable a task
   * @param taskId Task ID to enable
   */
  async enableTask(taskId: string): Promise<void> {
    const task = await this.getTask(taskId);
    if (task) {
      task.enabled = true;
      await this.updateTask(task);
    }
  }

  /**
   * Disable a task
   * @param taskId Task ID to disable
   */
  async disableTask(taskId: string): Promise<void> {
    const task = await this.getTask(taskId);
    if (task) {
      task.enabled = false;
      await this.updateTask(task);
    }
  }

  /**
   * Get all tasks
   * @returns Object with world and client task arrays
   */
  async getAllTasks(): Promise<{ world: Task[]; client: Task[] }> {
    return {
      world: Array.from(this.worldTasks.values()),
      client: Array.from(this.clientTasks.values()),
    };
  }

  /**
   * Get tasks for a specific calendar date
   * @param calendarDate Calendar date to check
   * @returns Array of tasks for that date
   */
  async getTasksForDate(calendarDate: CalendarDate): Promise<Task[]> {
    const allTasks = await this.getAllTasks();
    const allTaskList = [...allTasks.world, ...allTasks.client];

    return allTaskList.filter(
      task =>
        task.calendarIntegrated &&
        task.calendarDate &&
        task.calendarDate.year === calendarDate.year &&
        task.calendarDate.month === calendarDate.month &&
        task.calendarDate.day === calendarDate.day
    );
  }

  /**
   * Check for pending tasks that should execute
   * Called by updateWorldTime hook and manual triggers
   */
  async checkPendingTasks(): Promise<void> {
    const currentTime = Math.floor(Date.now() / 1000);
    const currentGameTime = TimeConverter.getCurrentGameTime();

    // Check all game time tasks
    for (const [_taskId, task] of this.gameTimeChecks) {
      if (!task.enabled) continue;

      const shouldExecute = task.useGameTime
        ? currentGameTime >= task.targetTime
        : currentTime >= task.targetTime;

      if (shouldExecute) {
        await this.executeTask(task);
      }
    }
  }

  /**
   * Handle world time updates from Foundry hook
   * @param worldTime New world time
   * @param dt Time delta
   */
  async handleWorldTimeUpdate(worldTime: number, _dt: number): Promise<void> {
    // Check game time tasks for execution
    for (const [_taskId, task] of this.gameTimeChecks) {
      if (!task.enabled || !task.useGameTime) continue;

      if (worldTime >= task.targetTime) {
        await this.executeTask(task);
      }
    }
  }

  /**
   * Shutdown task manager and cleanup
   */
  async shutdown(): Promise<void> {
    // Clear all real-time schedules
    for (const [_taskId, timeout] of this.realTimeSchedules) {
      clearTimeout(timeout);
    }
    this.realTimeSchedules.clear();

    // Clear game time checks
    this.gameTimeChecks.clear();

    // Shutdown event logger
    await this.logger.shutdown();

    // Clear memory
    this.worldTasks.clear();
    this.clientTasks.clear();

    this.initialized = false;
    console.log('Task & Trigger | TaskManager shutdown');
  }

  /**
   * Load all tasks from storage into memory
   */
  private async loadAllTasks(): Promise<{ world: Task[]; client: Task[] }> {
    const tasks = await this.storage.getAllTasks();

    // Clear existing tasks
    this.worldTasks.clear();
    this.clientTasks.clear();

    // Load into memory maps
    for (const task of tasks.world) {
      this.worldTasks.set(task.id, task);
    }
    for (const task of tasks.client) {
      this.clientTasks.set(task.id, task);
    }

    console.log(
      `Task & Trigger | Loaded ${tasks.world.length} world tasks, ${tasks.client.length} client tasks`
    );
    return tasks;
  }

  /**
   * Save tasks to storage
   * @param tasks Tasks to save
   * @param scope Storage scope
   */
  private async saveTasks(tasks: Task[], scope: 'world' | 'client'): Promise<void> {
    await this.storage.saveTasks(tasks, scope);
  }

  /**
   * Add a task to both memory and storage
   * @param task Task to add
   */
  async addTask(task: Task): Promise<void> {
    try {
      // Add to storage first
      await this.storage.addTask(task);

      // Add to memory after successful storage
      if (task.scope === 'world') {
        this.worldTasks.set(task.id, task);
      } else {
        this.clientTasks.set(task.id, task);
      }
    } catch (error) {
      console.error(`Task & Trigger | Failed to add task: ${task.id}`, error);
      throw error;
    }
  }

  /**
   * Schedule task execution based on time type
   * @param task Task to schedule
   */
  private scheduleTaskExecution(task: Task): void {
    if (!task.enabled) return;

    if (task.useGameTime) {
      // Game time tasks are handled by updateWorldTime hook
      this.gameTimeChecks.set(task.id, task);
    } else {
      // Real time tasks use setTimeout
      const currentTime = Math.floor(Date.now() / 1000);
      const delay = Math.max(0, task.targetTime - currentTime) * 1000;

      // Clear existing schedule if any
      if (this.realTimeSchedules.has(task.id)) {
        clearTimeout(this.realTimeSchedules.get(task.id)!);
      }

      // Limit delay to prevent 32-bit integer overflow (about 24.8 days)
      const maxDelay = 2147483647; // Max 32-bit signed integer
      const safeDelay = Math.min(delay, maxDelay);

      const timeoutId = setTimeout(async () => {
        await this.executeTask(task);
      }, safeDelay);

      this.realTimeSchedules.set(task.id, timeoutId);
    }
  }

  /**
   * Schedule all real-time tasks on initialization
   */
  private scheduleRealTimeTasks(): void {
    const allTasks = [...this.worldTasks.values(), ...this.clientTasks.values()];

    for (const task of allTasks) {
      if (task.enabled && !task.useGameTime) {
        this.scheduleTaskExecution(task);
      } else if (task.enabled && task.useGameTime) {
        this.gameTimeChecks.set(task.id, task);
      }
    }
  }

  /**
   * Execute a task
   * @param task Task to execute
   */
  private async executeTask(task: Task): Promise<void> {
    const startTime = performance.now();

    try {
      console.log(`Task & Trigger | Executing task: ${task.name} (${task.id})`);

      const result: TaskExecutionResult = await this.executor.executeTask(task);
      const executionDuration = Math.round(performance.now() - startTime);

      // Update run count
      task.runCount++;
      task.lastExecution = Math.floor(Date.now() / 1000);

      if (!result.success) {
        task.lastError = result.error;
        console.error(`Task & Trigger | Task execution failed: ${task.id}`, result.error);
        ui.notifications?.error(`Task execution failed: ${task.name}`);
      } else {
        task.lastError = undefined;
        console.log(`Task & Trigger | Task executed successfully: ${task.id}`);
      }

      // Log the execution event
      await this.logger.logTaskExecution(task, result, executionDuration, false);

      // Handle recurring tasks
      if (task.recurring && task.interval) {
        // Calculate next execution time
        const nextTime = task.useGameTime
          ? TimeConverter.getCurrentGameTime() + TimeConverter.toTimestamp(task.interval, true)
          : Math.floor(Date.now() / 1000) + TimeConverter.toTimestamp(task.interval, false);

        task.targetTime = nextTime;

        // Schedule next execution
        this.scheduleTaskExecution(task);
      } else if (!task.recurring) {
        // Remove one-time tasks after execution
        this.realTimeSchedules.delete(task.id);
        this.gameTimeChecks.delete(task.id);

        // Optionally keep in storage for history but mark as completed
        task.enabled = false;
      }

      // Update in storage
      await this.updateTask(task);
    } catch (error) {
      console.error(`Task & Trigger | Failed to execute task: ${task.id}`, error);
      task.lastError = String(error);
      await this.updateTask(task);
    }
  }

  /**
   * Generate a descriptive name for a task
   * @param timeSpec Time specification
   * @param useGameTime Whether using game time
   * @returns Generated name
   */
  private generateTaskName(timeSpec: TimeSpec, useGameTime: boolean): string {
    const timeType = useGameTime ? 'Game Time' : 'Real Time';

    if (typeof timeSpec === 'number') {
      const date = new Date(timeSpec * 1000);
      return `${timeType} Task - ${date.toLocaleString()}`;
    }

    if (TimeConverter.isAbsoluteTimeSpec(timeSpec)) {
      return `${timeType} Task - ${timeSpec.year}/${timeSpec.month}/${timeSpec.day}`;
    }

    if (TimeConverter.isRelativeTimeSpec(timeSpec)) {
      const parts: string[] = [];
      if (timeSpec.days) parts.push(`${timeSpec.days}d`);
      if (timeSpec.hours) parts.push(`${timeSpec.hours}h`);
      if (timeSpec.minutes) parts.push(`${timeSpec.minutes}m`);
      if (timeSpec.seconds) parts.push(`${timeSpec.seconds}s`);
      return `${timeType} Task - in ${parts.join(' ')}`;
    }

    return `${timeType} Task`;
  }

  /**
   * Generate a descriptive name for an interval task
   * @param interval Interval specification
   * @param useGameTime Whether using game time
   * @returns Generated name
   */
  private generateIntervalName(interval: TimeSpec, useGameTime: boolean): string {
    const timeType = useGameTime ? 'Game Time' : 'Real Time';

    if (TimeConverter.isRelativeTimeSpec(interval)) {
      const parts: string[] = [];
      if (interval.days) parts.push(`${interval.days}d`);
      if (interval.hours) parts.push(`${interval.hours}h`);
      if (interval.minutes) parts.push(`${interval.minutes}m`);
      if (interval.seconds) parts.push(`${interval.seconds}s`);
      return `${timeType} Interval - every ${parts.join(' ')}`;
    }

    return `${timeType} Interval`;
  }
}
