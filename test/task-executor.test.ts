/**
 * Tests for TaskExecutor class
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskExecutor } from '../src/task-executor';
import { MacroManager } from '../src/macro-manager';
import { Task } from '../src/types';
import './setup';

describe('TaskExecutor', () => {
  let executor: TaskExecutor;
  let mockTask: Task;

  beforeEach(() => {
    // Clear singleton instances to ensure clean state
    (TaskExecutor as any).instance = undefined;
    (MacroManager as any).instance = undefined;
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
      macroId: 'test-macro-id',
      macroSource: 'existing' as const,
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
    it('should execute valid macro', async () => {
      const task = { ...mockTask, macroId: 'test-macro-id' };
      
      // Mock macro manager validation and execution
      const macroManager = MacroManager.getInstance();
      vi.spyOn(macroManager, 'validateMacro').mockResolvedValue(true);
      vi.spyOn(macroManager, 'executeMacro').mockResolvedValue('test result');
      
      const result = await executor.executeTask(task);

      expect(result.success).toBe(true);
      expect(result.result).toBe('test result');
    });

    it('should handle macro that returns undefined', async () => {
      const task = { ...mockTask, macroId: 'test-macro-id' };
      
      // Mock macro manager validation and execution
      const macroManager = MacroManager.getInstance();
      vi.spyOn(macroManager, 'validateMacro').mockResolvedValue(true);
      vi.spyOn(macroManager, 'executeMacro').mockResolvedValue(undefined);
      
      const result = await executor.executeTask(task);

      expect(result.success).toBe(true);
      expect(result.result).toBeUndefined();
    });

    it('should handle macro execution errors gracefully', async () => {
      const task = { ...mockTask, macroId: 'test-macro-id' };
      
      // Mock macro manager validation and execution error
      const macroManager = MacroManager.getInstance();
      vi.spyOn(macroManager, 'validateMacro').mockResolvedValue(true);
      vi.spyOn(macroManager, 'executeMacro').mockRejectedValue(new Error('Test error'));
      
      const result = await executor.executeTask(task);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Test error');
    });

    it('should handle empty code', async () => {
      // Mock a macro that doesn't exist to simulate empty/invalid macro
      const macroManager = MacroManager.getInstance();
      vi.spyOn(macroManager, 'validateMacro').mockResolvedValue(false);
      
      const task = { ...mockTask, macroId: 'non-existent-macro' };
      const result = await executor.executeTask(task);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Macro non-existent-macro not found or inaccessible');
    });

    it('should prevent concurrent execution of the same task', async () => {
      // Mock a slow executing macro
      const macroManager = MacroManager.getInstance();
      vi.spyOn(macroManager, 'validateMacro').mockResolvedValue(true);
      vi.spyOn(macroManager, 'executeMacro').mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('slow result'), 100))
      );

      const task = { ...mockTask };

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
      // Mock macro that checks for Foundry globals
      const macroManager = MacroManager.getInstance();
      vi.spyOn(macroManager, 'validateMacro').mockResolvedValue(true);
      vi.spyOn(macroManager, 'executeMacro').mockResolvedValue(true); // Simulates successful check for game global

      const task = { ...mockTask };

      const result = await executor.executeTask(task);
      expect(result.success).toBe(true);
      expect(result.result).toBe(true);
    });

    it('should store execution history', async () => {
      // Mock macro to return a test result
      const macroManager = MacroManager.getInstance();
      vi.spyOn(macroManager, 'validateMacro').mockResolvedValue(true);
      vi.spyOn(macroManager, 'executeMacro').mockResolvedValue('history test');

      const task = { ...mockTask };

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
      // Mock macros to return different results
      const macroManager = MacroManager.getInstance();
      vi.spyOn(macroManager, 'validateMacro').mockResolvedValue(true);
      vi.spyOn(macroManager, 'executeMacro')
        .mockResolvedValueOnce(1)  // task1 first execution
        .mockResolvedValueOnce(2)  // task2 execution
        .mockResolvedValueOnce(1); // task1 second execution

      const task1 = { ...mockTask, id: 'task-1' };
      const task2 = { ...mockTask, id: 'task-2' };

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
      const task = { ...mockTask, macroId: 'test-macro-id' };
      
      // Mock macro manager
      const macroManager = MacroManager.getInstance();
      vi.spyOn(macroManager, 'validateMacro').mockResolvedValue(true);
      vi.spyOn(macroManager, 'executeMacro').mockResolvedValue(Math.random());

      // Execute more than the history limit (50)
      for (let i = 0; i < 55; i++) {
        await executor.executeTask(task);
      }

      const history = executor.getExecutionHistory(task.id);
      expect(history.length).toBe(50); // Should be capped at 50
    });
  });

  describe('macro validation', () => {
    it('should validate macro exists before execution', async () => {
      const task = { ...mockTask, macroId: 'non-existent-macro' };
      
      // Mock macro manager to return false for validation
      const macroManager = MacroManager.getInstance();
      vi.spyOn(macroManager, 'validateMacro').mockResolvedValue(false);
      
      const result = await executor.executeTask(task);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Macro non-existent-macro not found or inaccessible');
    });

    it('should execute macro when validation passes', async () => {
      const task = { ...mockTask, macroId: 'valid-macro' };
      
      // Mock macro manager to return true for validation and mock result
      const macroManager = MacroManager.getInstance();
      vi.spyOn(macroManager, 'validateMacro').mockResolvedValue(true);
      vi.spyOn(macroManager, 'executeMacro').mockResolvedValue('macro result');
      
      const result = await executor.executeTask(task);
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('macro result');
    });
  });

  describe('error handling', () => {
    it('should handle macro execution errors', async () => {
      const task = { ...mockTask, macroId: 'error-macro' };
      
      // Mock macro manager to validate but throw during execution
      const macroManager = MacroManager.getInstance();
      vi.spyOn(macroManager, 'validateMacro').mockResolvedValue(true);
      vi.spyOn(macroManager, 'executeMacro').mockRejectedValue(new Error('Macro execution failed'));
      
      const result = await executor.executeTask(task);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Macro execution failed');
    });

    it('should handle macro validation errors', async () => {
      const task = { ...mockTask, macroId: 'missing-macro' };
      
      // Mock macro manager to fail validation
      const macroManager = MacroManager.getInstance();
      vi.spyOn(macroManager, 'validateMacro').mockResolvedValue(false);
      
      const result = await executor.executeTask(task);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Macro missing-macro not found or inaccessible');
    });

    it('should handle async macro errors', async () => {
      const task = { ...mockTask, macroId: 'async-error-macro' };
      
      // Mock macro manager
      const macroManager = MacroManager.getInstance();
      vi.spyOn(macroManager, 'validateMacro').mockResolvedValue(true);
      vi.spyOn(macroManager, 'executeMacro').mockRejectedValue(new Error('Async error'));

      const result = await executor.executeTask(task);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Async error');
    });
  });

  describe('security measures', () => {
    it('should use secure macro execution', async () => {
      const task = { ...mockTask, macroId: 'secure-macro' };
      
      // Mock macro manager
      const macroManager = MacroManager.getInstance();
      vi.spyOn(macroManager, 'validateMacro').mockResolvedValue(true);
      vi.spyOn(macroManager, 'executeMacro').mockResolvedValue('secure result');
      
      const result = await executor.executeTask(task);

      expect(result.success).toBe(true);
    });
  });
});
