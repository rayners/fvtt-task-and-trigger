/**
 * TaskExecutor - Handles macro-based task execution with safety measures
 */

import { Task, TaskExecutionResult } from './types';
import { MacroManager } from './macro-manager';

export class TaskExecutor {
  private static instance: TaskExecutor;
  private executingTasks = new Set<string>();
  private executionHistory = new Map<string, TaskExecutionResult[]>();
  private macroManager: MacroManager;

  private constructor() {
    this.macroManager = MacroManager.getInstance();
  }

  static getInstance(): TaskExecutor {
    if (!this.instance) {
      this.instance = new TaskExecutor();
    }
    return this.instance;
  }

  /**
   * Execute a task's macro with safety measures
   * @param task The task to execute
   * @returns Promise resolving to execution result
   */
  async executeTask(task: Task): Promise<TaskExecutionResult> {
    const startTime = Date.now();
    const timestamp = Math.floor(startTime / 1000);

    // Prevent concurrent execution of the same task
    if (this.executingTasks.has(task.id)) {
      return {
        success: false,
        error: 'Task is already executing',
        executionTime: 0,
        timestamp,
      };
    }

    this.executingTasks.add(task.id);

    try {
      // Validate macro exists before execution
      if (!(await this.macroManager.validateMacro(task.macroId))) {
        throw new Error(`Macro ${task.macroId} not found or inaccessible`);
      }

      // Execute the macro
      const result = await this.macroManager.executeMacro(task.macroId);
      const executionTime = Date.now() - startTime;

      const executionResult: TaskExecutionResult = {
        success: true,
        result,
        executionTime,
        timestamp,
      };

      // Store execution history
      this.addToExecutionHistory(task.id, executionResult);

      console.log(`Task & Trigger | Task executed successfully: ${task.name}`);
      return executionResult;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      const executionResult: TaskExecutionResult = {
        success: false,
        error: errorMessage,
        executionTime,
        timestamp,
      };

      // Store execution history
      this.addToExecutionHistory(task.id, executionResult);

      console.error(`Task & Trigger | Task execution failed: ${task.name}`, error);

      // Show user-friendly error notification
      this.showExecutionError(task, errorMessage);

      return executionResult;
    } finally {
      this.executingTasks.delete(task.id);
    }
  }

  /**
   * Show execution error notification to user
   */
  private showExecutionError(task: Task, error: string): void {
    ui.notifications?.error(
      game.i18n.format('TASK_TRIGGER.Messages.TaskFailed', {
        name: task.name,
        error: error,
      })
    );
  }

  /**
   * Add execution result to history
   */
  private addToExecutionHistory(taskId: string, result: TaskExecutionResult): void {
    if (!this.executionHistory.has(taskId)) {
      this.executionHistory.set(taskId, []);
    }

    const history = this.executionHistory.get(taskId)!;
    history.push(result);

    // Keep only the last 50 executions per task to prevent memory bloat
    if (history.length > 50) {
      history.splice(0, history.length - 50);
    }
  }

  /**
   * Get execution history for a task
   */
  getExecutionHistory(taskId: string): TaskExecutionResult[] {
    return this.executionHistory.get(taskId) ?? [];
  }

  /**
   * Clear execution history for a task
   */
  clearExecutionHistory(taskId: string): void {
    this.executionHistory.delete(taskId);
  }

  /**
   * Get all tasks currently executing
   */
  getExecutingTasks(): string[] {
    return Array.from(this.executingTasks);
  }

  /**
   * Check if a task is currently executing
   */
  isTaskExecuting(taskId: string): boolean {
    return this.executingTasks.has(taskId);
  }
}

// Dialog class is provided by foundry-dev-tools types
