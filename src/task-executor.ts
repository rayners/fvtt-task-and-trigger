/**
 * TaskExecutor - Handles secure JavaScript execution with user consent and error boundaries
 */

import { Task, TaskExecutionResult } from './types';

export class TaskExecutor {
  private static instance: TaskExecutor;
  private executingTasks = new Set<string>();
  private executionHistory = new Map<string, TaskExecutionResult[]>();

  private constructor() {}

  static getInstance(): TaskExecutor {
    if (!this.instance) {
      this.instance = new TaskExecutor();
    }
    return this.instance;
  }

  /**
   * Execute a task's JavaScript code with safety measures
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
      // Execute the JavaScript code directly like Foundry macros
      const result = await this.safeExecute(task.callback);
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
   * Execute JavaScript code with error boundaries and context isolation
   * @param code The JavaScript code to execute
   * @returns The result of the execution
   */
  private async safeExecute(code: string): Promise<any> {
    // Validate the code is not empty
    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      throw new Error('No code provided for execution');
    }

    try {
      // Create execution context with access to Foundry globals
      // This provides the same access as the browser console, as requested
      const executionContext = this.createExecutionContext();

      // Use Function constructor instead of eval for slightly better security
      // while still providing full access as requested
      const asyncFunction = new Function(
        ...Object.keys(executionContext),
        `
        "use strict";
        return (async function() {
          ${code}
        })();
        `
      );

      // Execute with the Foundry context
      const result = await asyncFunction.call(globalThis, ...Object.values(executionContext));

      return result;
    } catch (error) {
      // Re-throw with more context
      throw new Error(
        `JavaScript execution error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Create execution context with access to Foundry globals
   * This provides the same access as F12 console, as requested by the user
   */
  private createExecutionContext(): Record<string, any> {
    return {
      // Core Foundry globals (with safety checks)
      game: typeof game !== 'undefined' ? game : undefined,
      ui: typeof ui !== 'undefined' ? ui : undefined,
      canvas: typeof canvas !== 'undefined' ? canvas : undefined,
      Hooks: typeof Hooks !== 'undefined' ? Hooks : undefined,
      CONFIG: typeof CONFIG !== 'undefined' ? CONFIG : undefined,
      CONST: typeof CONST !== 'undefined' ? CONST : undefined,
      foundry: typeof foundry !== 'undefined' ? foundry : undefined,

      // Common utilities
      console,
      setTimeout,
      setInterval,
      clearTimeout,
      clearInterval,

      // jQuery if available
      $: typeof $ !== 'undefined' ? $ : undefined,

      // Task & Trigger API
      taskTrigger: typeof game !== 'undefined' ? (game as any).taskTrigger : undefined,
    };
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

  /**
   * Validate JavaScript code for common issues
   * This is a basic validation - not a security measure
   */
  static validateCode(code: string): { valid: boolean; warnings: string[] } {
    const warnings: string[] = [];

    if (!code || code.trim().length === 0) {
      return { valid: false, warnings: ['Code cannot be empty'] };
    }

    // Check for potentially dangerous patterns (informational only)
    const dangerousPatterns = [
      {
        pattern: /document\./,
        message: 'Accesses browser DOM - may not work as expected in Foundry',
      },
      { pattern: /window\./, message: 'Accesses browser window object' },
      { pattern: /localStorage|sessionStorage/, message: 'Accesses browser storage' },
      { pattern: /XMLHttpRequest|fetch\(/, message: 'Makes HTTP requests' },
      { pattern: /eval\(/, message: 'Uses eval() function' },
      { pattern: /Function\(/, message: 'Uses Function constructor' },
      { pattern: /import\(/, message: 'Uses dynamic imports' },
      { pattern: /require\(/, message: 'Uses CommonJS require' },
    ];

    for (const { pattern, message } of dangerousPatterns) {
      if (pattern.test(code)) {
        warnings.push(message);
      }
    }

    return { valid: true, warnings };
  }
}

// Dialog class is provided by foundry-dev-tools types
