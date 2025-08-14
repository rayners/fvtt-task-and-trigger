/**
 * Tests for TaskExecutor class
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskExecutor } from '../src/task-executor';
import { Task } from '../src/types';
import './setup';

describe('TaskExecutor', () => {
  let executor: TaskExecutor;
  let mockTask: Task;

  beforeEach(() => {
    // Clear singleton instance to ensure clean state
    (TaskExecutor as any).instance = undefined;
    executor = TaskExecutor.getInstance();

    // Mock Dialog class
    (global as any).Dialog = class {
      constructor(private options: any) {}
      render() {
        // Simulate user clicking "proceed" for testing
        setTimeout(() => this.options.buttons.proceed.callback(), 0);
      }
    };

    // Ensure game.settings mock returns false for security warnings by default
    (global as any).game.settings.get = vi.fn().mockReturnValue(false);

    mockTask = {
      id: 'test-task-1',
      name: 'Test Task',
      description: 'A test task',
      timeSpec: { minutes: 5 },
      targetTime: Date.now() / 1000 + 300,
      callback: 'console.log("Hello from task!");',
      useGameTime: false,
      recurring: false,
      scope: 'client',
      enabled: true,
      created: Date.now() / 1000,
      runCount: 0,
      logExecution: false,
    };
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const executor1 = TaskExecutor.getInstance();
      const executor2 = TaskExecutor.getInstance();
      expect(executor1).toBe(executor2);
    });
  });

  describe('executeTask', () => {
    it('should execute valid JavaScript code', async () => {
      const task = { ...mockTask, callback: 'return "test result";' };
      const result = await executor.executeTask(task);

      expect(result.success).toBe(true);
      expect(result.result).toBe('test result');
    });

    it('should handle code that returns undefined', async () => {
      const task = { ...mockTask, callback: 'console.log("no return");' };
      const result = await executor.executeTask(task);

      expect(result.success).toBe(true);
      expect(result.result).toBeUndefined();
    });

    it('should handle JavaScript errors gracefully', async () => {
      const task = { ...mockTask, callback: 'throw new Error("Test error");' };
      const result = await executor.executeTask(task);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Test error');
    });

    it('should handle empty code', async () => {
      const task = { ...mockTask, callback: '' };
      const result = await executor.executeTask(task);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No code provided for execution');
    });

    it('should prevent concurrent execution of the same task', async () => {
      const task = {
        ...mockTask,
        callback: 'return new Promise(resolve => setTimeout(resolve, 100));',
      };

      const promise1 = executor.executeTask(task);
      const promise2 = executor.executeTask(task);

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1.success || result2.success).toBe(true);
      expect(result1.success && result2.success).toBe(false);

      // One should succeed, one should fail with "already executing"
      const failedResult = result1.success ? result2 : result1;
      expect(failedResult.error).toContain('already executing');
    });

    it('should have access to Foundry globals', async () => {
      const task = {
        ...mockTask,
        callback: 'return typeof game !== "undefined" && typeof ui !== "undefined";',
      };

      const result = await executor.executeTask(task);
      expect(result.success).toBe(true);
      expect(result.result).toBe(true);
    });

    it('should store execution history', async () => {
      const task = { ...mockTask, callback: 'return "history test";' };

      await executor.executeTask(task);
      const history = executor.getExecutionHistory(task.id);

      expect(history).toHaveLength(1);
      expect(history[0].success).toBe(true);
      expect(history[0].result).toBe('history test');
    });

    it('should track executing tasks', async () => {
      const task = {
        ...mockTask,
        callback: 'return new Promise(resolve => setTimeout(() => resolve("done"), 50));',
      };

      const promise = executor.executeTask(task);

      // Should be executing
      expect(executor.isTaskExecuting(task.id)).toBe(true);
      expect(executor.getExecutingTasks()).toContain(task.id);

      await promise;

      // Should no longer be executing
      expect(executor.isTaskExecuting(task.id)).toBe(false);
      expect(executor.getExecutingTasks()).not.toContain(task.id);
    });
  });

  describe('execution history', () => {
    it('should maintain execution history per task', async () => {
      const task1 = { ...mockTask, id: 'task-1', callback: 'return 1;' };
      const task2 = { ...mockTask, id: 'task-2', callback: 'return 2;' };

      await executor.executeTask(task1);
      await executor.executeTask(task2);
      await executor.executeTask(task1); // Execute task1 again

      const history1 = executor.getExecutionHistory('task-1');
      const history2 = executor.getExecutionHistory('task-2');

      expect(history1).toHaveLength(2);
      expect(history2).toHaveLength(1);
      expect(history1[0].result).toBe(1);
      expect(history1[1].result).toBe(1);
      expect(history2[0].result).toBe(2);
    });

    it('should clear execution history', async () => {
      const task = { ...mockTask, callback: 'return "test";' };

      await executor.executeTask(task);
      expect(executor.getExecutionHistory(task.id)).toHaveLength(1);

      executor.clearExecutionHistory(task.id);
      expect(executor.getExecutionHistory(task.id)).toHaveLength(0);
    });

    it('should limit execution history size', async () => {
      const task = { ...mockTask, callback: 'return Math.random();' };

      // Execute more than the history limit (50)
      for (let i = 0; i < 55; i++) {
        await executor.executeTask(task);
      }

      const history = executor.getExecutionHistory(task.id);
      expect(history.length).toBe(50); // Should be capped at 50
    });
  });

  describe('code validation', () => {
    it('should validate empty code', () => {
      const result = TaskExecutor.validateCode('');
      expect(result.valid).toBe(false);
      expect(result.warnings).toContain('Code cannot be empty');
    });

    it('should validate basic code', () => {
      const result = TaskExecutor.validateCode('return "hello";');
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should warn about potentially dangerous patterns', () => {
      const testCases = [
        { code: 'document.body.innerHTML = "test";', warning: 'DOM' },
        { code: 'window.location = "http://evil.com";', warning: 'window' },
        { code: 'localStorage.setItem("key", "value");', warning: 'storage' },
        { code: 'fetch("http://api.com");', warning: 'HTTP' },
        { code: 'eval("alert(1)");', warning: 'eval' },
      ];

      for (const testCase of testCases) {
        const result = TaskExecutor.validateCode(testCase.code);
        expect(result.valid).toBe(true);
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(
          result.warnings.some(w => w.toLowerCase().includes(testCase.warning.toLowerCase()))
        ).toBe(true);
      }
    });

    it('should handle complex code without false positives', () => {
      const complexCode = `
        const actors = game.actors.filter(a => a.type === 'character');
        for (const actor of actors) {
          if (actor.system.health.value < 10) {
            ui.notifications.warn(\`\${actor.name} is low on health!\`);
          }
        }
        return actors.length;
      `;

      const result = TaskExecutor.validateCode(complexCode);
      expect(result.valid).toBe(true);
      // Should have minimal warnings for legitimate Foundry code
    });
  });

  describe('error handling', () => {
    it('should handle syntax errors', async () => {
      const task = { ...mockTask, callback: 'invalid javascript syntax {{{' };
      const result = await executor.executeTask(task);

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should handle runtime errors', async () => {
      const task = { ...mockTask, callback: 'undefined.property.access;' };
      const result = await executor.executeTask(task);

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should handle async errors', async () => {
      const task = {
        ...mockTask,
        callback: 'return Promise.reject(new Error("Async error"));',
      };

      const result = await executor.executeTask(task);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Async error');
    });
  });

  describe('security measures', () => {
    it('should respect security warning settings', async () => {
      // Mock settings to disable warnings
      (global as any).game.settings.get = vi.fn().mockReturnValue(false);

      const task = { ...mockTask, callback: 'return "no warning test";' };
      const result = await executor.executeTask(task);

      expect(result.success).toBe(true);
    });
  });
});
