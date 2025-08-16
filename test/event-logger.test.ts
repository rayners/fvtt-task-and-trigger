/**
 * Tests for EventLogger
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EventLogger, LogEntry, LoggerSettings } from '../src/event-logger';
import { JournalStorage } from '../src/journal-storage';
import { Task, TaskExecutionResult } from '../src/types';
import './setup';

describe('EventLogger', () => {
  let eventLogger: EventLogger;
  let mockStorage: any;

  beforeEach(() => {
    // Clear singleton instance
    (EventLogger as any).instance = undefined;

    // Create fresh instance
    eventLogger = EventLogger.getInstance();
    mockStorage = JournalStorage.getInstance();

    // Mock JournalStorage methods
    vi.spyOn(mockStorage, 'readData').mockResolvedValue({ logs: [] });
    vi.spyOn(mockStorage, 'writeData').mockResolvedValue(undefined);

    // Mock game settings
    vi.spyOn(game.settings!, 'register').mockImplementation(() => {});
    vi.spyOn(game.settings!, 'get').mockResolvedValue({
      enabled: true,
      maxEntries: 100,
      logSuccesses: true,
      logErrors: true,
      detailedLogging: false,
      minDurationThreshold: 0,
    });
    vi.spyOn(game.settings!, 'set').mockResolvedValue(undefined);

    // Mock Hooks
    vi.spyOn(Hooks, 'callAll').mockImplementation(() => {});

    // Mock foundry utils
    (foundry.utils as any).randomID = vi.fn(() => 'test-log-id-' + Date.now());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = EventLogger.getInstance();
      const instance2 = EventLogger.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await eventLogger.initialize();
      expect(eventLogger.isEnabled()).toBe(true);
    });

    it('should not initialize twice', async () => {
      await eventLogger.initialize();
      await eventLogger.initialize();
      expect(game.settings!.register).toHaveBeenCalledTimes(1);
    });

    it('should handle initialization errors gracefully', async () => {
      vi.spyOn(game.settings!, 'get').mockRejectedValue(new Error('Settings error'));

      await eventLogger.initialize();

      // Should still be enabled with default settings
      expect(eventLogger.isEnabled()).toBe(true);
    });
  });

  describe('task execution logging', () => {
    const mockTask: Task = {
      id: 'test-task-1',
      name: 'Test Task',
      description: 'A test task',
      timeSpec: { hours: 1 },
      callback: 'console.log("test")',
      targetTime: Date.now() / 1000,
      recurring: false,
      interval: undefined,
      enabled: true,
      useGameTime: false,
      scope: 'client',
      runCount: 0,
      created: Date.now(),
      logExecution: true,
      uiConfigured: false,
    };

    beforeEach(async () => {
      await eventLogger.initialize();
    });

    it('should log successful task execution', async () => {
      const result: TaskExecutionResult = {
        success: true,
        result: 'Task completed successfully',
        executionTime: 150,
        timestamp: Date.now(),
      };

      await eventLogger.logTaskExecution(mockTask, result, 150);

      expect(mockStorage.writeData).toHaveBeenCalledWith(
        'event-logs',
        'world',
        expect.objectContaining({
          logs: expect.arrayContaining([
            expect.objectContaining({
              taskId: 'test-task-1',
              taskName: 'Test Task',
              executionType: 'success',
              duration: 150,
            }),
          ]),
        })
      );
    });

    it('should log failed task execution', async () => {
      const result: TaskExecutionResult = {
        success: false,
        error: 'Task execution failed',
        executionTime: 75,
        timestamp: Date.now(),
      };

      await eventLogger.logTaskExecution(mockTask, result, 75);

      expect(mockStorage.writeData).toHaveBeenCalledWith(
        'event-logs',
        'world',
        expect.objectContaining({
          logs: expect.arrayContaining([
            expect.objectContaining({
              taskId: 'test-task-1',
              executionType: 'error',
              error: 'Task execution failed',
            }),
          ]),
        })
      );
    });

    it('should log timeout execution', async () => {
      const result: TaskExecutionResult = {
        success: false,
        timeout: true,
        error: 'Task timed out',
        executionTime: 5000,
        timestamp: Date.now(),
      };

      await eventLogger.logTaskExecution(mockTask, result, 5000);

      expect(mockStorage.writeData).toHaveBeenCalledWith(
        'event-logs',
        'world',
        expect.objectContaining({
          logs: expect.arrayContaining([
            expect.objectContaining({
              taskId: 'test-task-1',
              executionType: 'timeout',
            }),
          ]),
        })
      );
    });

    it('should not log when disabled', async () => {
      await eventLogger.updateSettings({ enabled: false });

      const result: TaskExecutionResult = {
        success: true,
        result: 'Task completed',
        executionTime: 100,
        timestamp: Date.now(),
      };

      await eventLogger.logTaskExecution(mockTask, result, 100);

      expect(mockStorage.writeData).not.toHaveBeenCalled();
    });

    it('should respect success logging setting', async () => {
      await eventLogger.updateSettings({ logSuccesses: false });

      const result: TaskExecutionResult = {
        success: true,
        result: 'Task completed',
        executionTime: 100,
        timestamp: Date.now(),
      };

      await eventLogger.logTaskExecution(mockTask, result, 100);

      expect(mockStorage.writeData).not.toHaveBeenCalled();
    });

    it('should respect error logging setting', async () => {
      await eventLogger.updateSettings({ logErrors: false });

      const result: TaskExecutionResult = {
        success: false,
        error: 'Task failed',
        executionTime: 100,
        timestamp: Date.now(),
      };

      await eventLogger.logTaskExecution(mockTask, result, 100);

      expect(mockStorage.writeData).not.toHaveBeenCalled();
    });

    it('should respect duration threshold', async () => {
      await eventLogger.updateSettings({ minDurationThreshold: 200 });

      const result: TaskExecutionResult = {
        success: true,
        result: 'Task completed',
        executionTime: 150,
        timestamp: Date.now(),
      };

      await eventLogger.logTaskExecution(mockTask, result, 150);

      expect(mockStorage.writeData).not.toHaveBeenCalled();
    });

    it('should emit hook after logging', async () => {
      const result: TaskExecutionResult = {
        success: true,
        result: 'Task completed',
        executionTime: 150,
        timestamp: Date.now(),
      };

      await eventLogger.logTaskExecution(mockTask, result, 150);

      expect(Hooks.callAll).toHaveBeenCalledWith(
        'taskTriggerEventLogged',
        expect.objectContaining({
          taskId: 'test-task-1',
          executionType: 'success',
        })
      );
    });
  });

  describe('log retrieval', () => {
    const mockLogs: LogEntry[] = [
      {
        id: 'log-1',
        timestamp: 1640995200, // 2022-01-01 00:00:00
        taskId: 'task-1',
        taskName: 'Task One',
        executionType: 'success',
        duration: 100,
        scope: 'client',
        userTriggered: false,
      },
      {
        id: 'log-2',
        timestamp: 1640995260, // 2022-01-01 00:01:00
        taskId: 'task-2',
        taskName: 'Task Two',
        executionType: 'error',
        duration: 200,
        error: 'Test error',
        scope: 'world',
        userTriggered: true,
      },
      {
        id: 'log-3',
        timestamp: 1640995320, // 2022-01-01 00:02:00
        taskId: 'task-1',
        taskName: 'Task One',
        executionType: 'success',
        duration: 150,
        scope: 'client',
        userTriggered: false,
      },
    ];

    beforeEach(async () => {
      vi.spyOn(mockStorage, 'readData').mockResolvedValue({ logs: mockLogs });
      await eventLogger.initialize();
    });

    it('should get recent logs', async () => {
      const recentLogs = await eventLogger.getRecentLogs(2);

      expect(recentLogs).toHaveLength(2);
      expect(recentLogs[0].timestamp).toBeGreaterThan(recentLogs[1].timestamp);
      expect(recentLogs[0].id).toBe('log-3');
      expect(recentLogs[1].id).toBe('log-2');
    });

    it('should get logs for specific task', async () => {
      const taskLogs = await eventLogger.getTaskLogs('task-1');

      expect(taskLogs).toHaveLength(2);
      expect(taskLogs.every(log => log.taskId === 'task-1')).toBe(true);
      expect(taskLogs[0].timestamp).toBeGreaterThan(taskLogs[1].timestamp);
    });

    it('should handle empty log storage', async () => {
      vi.spyOn(mockStorage, 'readData').mockResolvedValue({ logs: [] });

      const logs = await eventLogger.getRecentLogs();
      expect(logs).toEqual([]);
    });
  });

  describe('execution statistics', () => {
    const mockLogsForStats: LogEntry[] = [
      {
        id: 'log-1',
        timestamp: Math.floor(Date.now() / 1000) - 2 * 24 * 60 * 60, // 2 days ago
        taskId: 'task-1',
        taskName: 'Task One',
        executionType: 'success',
        duration: 100,
        scope: 'client',
        userTriggered: false,
      },
      {
        id: 'log-2',
        timestamp: Math.floor(Date.now() / 1000) - 1 * 24 * 60 * 60, // 1 day ago
        taskId: 'task-2',
        taskName: 'Task Two',
        executionType: 'error',
        duration: 200,
        error: 'Test error',
        scope: 'world',
        userTriggered: false,
      },
      {
        id: 'log-3',
        timestamp: Math.floor(Date.now() / 1000) - 1 * 60 * 60, // 1 hour ago
        taskId: 'task-1',
        taskName: 'Task One',
        executionType: 'timeout',
        duration: 5000,
        scope: 'client',
        userTriggered: false,
      },
    ];

    beforeEach(async () => {
      vi.spyOn(mockStorage, 'readData').mockResolvedValue({ logs: mockLogsForStats });
      await eventLogger.initialize();
    });

    it('should calculate execution statistics', async () => {
      const stats = await eventLogger.getExecutionStats(7);

      expect(stats.totalExecutions).toBe(3);
      expect(stats.successfulExecutions).toBe(1);
      expect(stats.failedExecutions).toBe(1);
      expect(stats.timeoutExecutions).toBe(1);
      expect(stats.averageDuration).toBe((100 + 200 + 5000) / 3);
      expect(stats.executionsPerDay.length).toBeGreaterThan(0);
      expect(stats.topFailingTasks).toHaveLength(2);
      expect(stats.topFailingTasks).toEqual(
        expect.arrayContaining([
          { taskId: 'task-1', taskName: 'Task One', failures: 1 },
          { taskId: 'task-2', taskName: 'Task Two', failures: 1 },
        ])
      );
    });

    it('should handle empty statistics', async () => {
      vi.spyOn(mockStorage, 'readData').mockResolvedValue({ logs: [] });

      const stats = await eventLogger.getExecutionStats(7);

      expect(stats.totalExecutions).toBe(0);
      expect(stats.successfulExecutions).toBe(0);
      expect(stats.failedExecutions).toBe(0);
      expect(stats.averageDuration).toBe(0);
      expect(stats.executionsPerDay).toEqual([]);
      expect(stats.topFailingTasks).toEqual([]);
    });
  });

  describe('log cleanup', () => {
    beforeEach(async () => {
      await eventLogger.initialize();
    });

    it('should cleanup old logs when exceeding max entries', async () => {
      await eventLogger.updateSettings({ maxEntries: 2 });

      const manyLogs = Array.from({ length: 5 }, (_, i) => ({
        id: `log-${i}`,
        timestamp: 1640995200 + i * 60,
        taskId: `task-${i}`,
        taskName: `Task ${i}`,
        executionType: 'success' as const,
        duration: 100,
        scope: 'client' as const,
        userTriggered: false,
      }));

      vi.spyOn(mockStorage, 'readData').mockResolvedValue({ logs: manyLogs });

      await eventLogger.cleanupLogs();

      expect(mockStorage.writeData).toHaveBeenCalledWith(
        'event-logs',
        'world',
        expect.objectContaining({
          logs: expect.arrayContaining([
            expect.objectContaining({ id: 'log-4' }),
            expect.objectContaining({ id: 'log-3' }),
          ]),
        })
      );
    });
  });

  describe('settings management', () => {
    beforeEach(async () => {
      await eventLogger.initialize();
    });

    it('should update settings', async () => {
      const newSettings: Partial<LoggerSettings> = {
        enabled: false,
        maxEntries: 500,
      };

      await eventLogger.updateSettings(newSettings);

      expect(game.settings!.set).toHaveBeenCalledWith(
        'task-and-trigger',
        'eventLogger',
        expect.objectContaining(newSettings)
      );
    });

    it('should get current settings', async () => {
      const settings = eventLogger.getSettings();

      expect(settings).toEqual(
        expect.objectContaining({
          enabled: true,
          maxEntries: 100,
          logSuccesses: true,
          logErrors: true,
        })
      );
    });
  });

  describe('log export', () => {
    const mockExportLogs: LogEntry[] = [
      {
        id: 'log-1',
        timestamp: 1640995200,
        taskId: 'task-1',
        taskName: 'Test Task',
        executionType: 'success',
        duration: 100,
        scope: 'client',
        userTriggered: false,
      },
      {
        id: 'log-2',
        timestamp: 1640995260,
        taskId: 'task-2',
        taskName: 'Error Task',
        executionType: 'error',
        duration: 200,
        error: 'Test error message',
        scope: 'world',
        userTriggered: true,
      },
    ];

    beforeEach(async () => {
      vi.spyOn(mockStorage, 'readData').mockResolvedValue({ logs: mockExportLogs });
      await eventLogger.initialize();
    });

    it('should export logs as JSON', async () => {
      const exported = await eventLogger.exportLogs('json');
      const parsed = JSON.parse(exported);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(2);
      expect(parsed[0]).toEqual(
        expect.objectContaining({
          taskId: 'task-1',
          executionType: 'success',
        })
      );
    });

    it('should export logs as CSV', async () => {
      const exported = await eventLogger.exportLogs('csv');
      const lines = exported.split('\n');

      expect(lines[0]).toContain('timestamp,taskId,taskName');
      expect(lines[1]).toContain('task-1');
      expect(lines[1]).toContain('Test Task');
      expect(lines[2]).toContain('task-2');
      expect(lines[2]).toContain('"Error Task"');
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await eventLogger.initialize();
    });

    it('should handle storage read errors gracefully', async () => {
      vi.spyOn(mockStorage, 'readData').mockRejectedValue(new Error('Storage error'));

      const logs = await eventLogger.getRecentLogs();
      expect(logs).toEqual([]);
    });

    it('should handle storage write errors gracefully', async () => {
      vi.spyOn(mockStorage, 'writeData').mockRejectedValue(new Error('Write error'));

      const mockTask: Task = {
        id: 'test-task',
        name: 'Test Task',
        timeSpec: { hours: 1 },
        callback: 'console.log("test")',
        targetTime: Date.now() / 1000,
        recurring: false,
        interval: undefined,
        enabled: true,
        useGameTime: false,
        scope: 'client',
        runCount: 0,
        created: Date.now(),
        logExecution: true,
        uiConfigured: false,
      };

      const result: TaskExecutionResult = {
        success: true,
        result: 'Success',
        executionTime: 100,
        timestamp: Date.now(),
      };

      // Should not throw
      await expect(eventLogger.logTaskExecution(mockTask, result, 100)).resolves.not.toThrow();
    });
  });

  describe('shutdown', () => {
    it('should shutdown cleanly', async () => {
      await eventLogger.initialize();
      expect(eventLogger.isEnabled()).toBe(true);

      await eventLogger.shutdown();
      expect(eventLogger.isEnabled()).toBe(false);
    });

    it('should not error when shutting down uninitialized logger', async () => {
      await expect(eventLogger.shutdown()).resolves.not.toThrow();
    });
  });
});
