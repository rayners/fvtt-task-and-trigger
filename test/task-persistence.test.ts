/**
 * Tests for TaskPersistence class
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskPersistence } from '../src/task-persistence';
import { TaskManager } from '../src/task-manager';
import { JournalStorage } from '../src/journal-storage';
import { Task } from '../src/types';
import './setup';

describe('TaskPersistence', () => {
  let persistence: TaskPersistence;
  let mockTaskManager: any;
  let mockStorage: any;

  beforeEach(() => {
    // Clear singleton instances
    (TaskPersistence as any).instance = undefined;
    (TaskManager as any).instance = undefined;
    (JournalStorage as any).instance = undefined;
    
    persistence = TaskPersistence.getInstance();
    mockTaskManager = TaskManager.getInstance();
    mockStorage = JournalStorage.getInstance();

    // Mock TaskManager and JournalStorage methods
    vi.spyOn(mockTaskManager, 'getTask').mockResolvedValue(null);
    vi.spyOn(mockTaskManager, 'updateTask').mockResolvedValue(undefined);
    vi.spyOn(mockTaskManager, 'cancelTask').mockResolvedValue(true);
    vi.spyOn(mockTaskManager, 'getAllTasks').mockResolvedValue({ world: [], client: [] });
    vi.spyOn(mockStorage, 'getAllTasks').mockResolvedValue({ world: [], client: [] });
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const persistence1 = TaskPersistence.getInstance();
      const persistence2 = TaskPersistence.getInstance();
      expect(persistence1).toBe(persistence2);
    });
  });

  describe('initialization', () => {
    it('should initialize without UI tasks', async () => {
      vi.spyOn(mockStorage, 'getAllTasks').mockResolvedValue({
        world: [],
        client: []
      });

      await persistence.initialize();

      expect(mockStorage.getAllTasks).toHaveBeenCalled();
    });

    it('should recover UI-configured recurring tasks', async () => {
      const uiTask: Task = {
        id: 'ui-task-1',
        name: 'UI Recurring Task',
        timeSpec: { minutes: 15 },
        targetTime: Math.floor(Date.now() / 1000) + 900,
        callback: 'console.log("UI task");',
        useGameTime: false,
        recurring: true,
        interval: { minutes: 15 },
        scope: 'client',
        enabled: true,
        created: Math.floor(Date.now() / 1000),
        runCount: 0,
        logExecution: false,
        uiConfigured: true
      };

      vi.spyOn(mockStorage, 'getAllTasks').mockResolvedValue({
        world: [],
        client: [uiTask]
      });

      await persistence.initialize();

      expect(mockTaskManager.updateTask).toHaveBeenCalledWith(uiTask);
    });

    it('should skip non-UI tasks during recovery', async () => {
      const apiTask: Task = {
        id: 'api-task-1',
        name: 'API Task',
        timeSpec: { minutes: 5 },
        targetTime: Math.floor(Date.now() / 1000) + 300,
        callback: 'console.log("API task");',
        useGameTime: false,
        recurring: false,
        scope: 'client',
        enabled: true,
        created: Math.floor(Date.now() / 1000),
        runCount: 0,
        logExecution: false,
        uiConfigured: false // Not UI configured
      };

      vi.spyOn(mockStorage, 'getAllTasks').mockResolvedValue({
        world: [],
        client: [apiTask]
      });

      await persistence.initialize();

      expect(mockTaskManager.updateTask).not.toHaveBeenCalledWith(apiTask);
    });

    it('should disable expired one-time UI tasks', async () => {
      const expiredTask: Task = {
        id: 'expired-task-1',
        name: 'Expired UI Task',
        timeSpec: { minutes: -5 }, // 5 minutes ago
        targetTime: Math.floor(Date.now() / 1000) - 300,
        callback: 'console.log("Expired");',
        useGameTime: false,
        recurring: false,
        scope: 'client',
        enabled: true,
        created: Math.floor(Date.now() / 1000),
        runCount: 0,
        logExecution: false,
        uiConfigured: true
      };

      vi.spyOn(mockStorage, 'getAllTasks').mockResolvedValue({
        world: [],
        client: [expiredTask]
      });

      await persistence.initialize();

      expect(mockTaskManager.updateTask).toHaveBeenCalledWith({
        ...expiredTask,
        enabled: false,
        lastError: 'Task expired during downtime'
      });
    });

    it('should skip game time tasks (handled by hooks)', async () => {
      const gameTimeTask: Task = {
        id: 'game-time-task-1',
        name: 'Game Time Task',
        timeSpec: { hours: 8 },
        targetTime: Math.floor(Date.now() / 1000) + 28800,
        callback: 'console.log("Game time");',
        useGameTime: true, // Game time tasks don't need recovery
        recurring: false,
        scope: 'world',
        enabled: true,
        created: Math.floor(Date.now() / 1000),
        runCount: 0,
        logExecution: false,
        uiConfigured: true
      };

      vi.spyOn(mockStorage, 'getAllTasks').mockResolvedValue({
        world: [gameTimeTask],
        client: []
      });

      await persistence.initialize();

      expect(mockTaskManager.updateTask).not.toHaveBeenCalledWith(gameTimeTask);
    });
  });

  describe('task configuration management', () => {
    it('should mark task as UI configured', async () => {
      const mockTask: Task = {
        id: 'test-task',
        name: 'Test Task',
        timeSpec: { minutes: 5 },
        targetTime: Math.floor(Date.now() / 1000) + 300,
        callback: 'console.log("test");',
        useGameTime: false,
        recurring: false,
        scope: 'client',
        enabled: true,
        created: Math.floor(Date.now() / 1000),
        runCount: 0,
        logExecution: false,
        uiConfigured: false
      };

      vi.spyOn(mockTaskManager, 'getTask').mockResolvedValue(mockTask);

      await persistence.markAsUIConfigured('test-task');

      expect(mockTaskManager.updateTask).toHaveBeenCalledWith({
        ...mockTask,
        uiConfigured: true
      });
    });

    it('should mark task as ephemeral', async () => {
      const mockTask: Task = {
        id: 'test-task',
        name: 'Test Task',
        timeSpec: { minutes: 5 },
        targetTime: Math.floor(Date.now() / 1000) + 300,
        callback: 'console.log("test");',
        useGameTime: false,
        recurring: false,
        scope: 'client',
        enabled: true,
        created: Math.floor(Date.now() / 1000),
        runCount: 0,
        logExecution: false,
        uiConfigured: true
      };

      vi.spyOn(mockTaskManager, 'getTask').mockResolvedValue(mockTask);

      await persistence.markAsEphemeral('test-task');

      expect(mockTaskManager.updateTask).toHaveBeenCalledWith({
        ...mockTask,
        uiConfigured: false
      });
    });

    it('should handle non-existent task gracefully', async () => {
      vi.spyOn(mockTaskManager, 'getTask').mockResolvedValue(null);

      await persistence.markAsUIConfigured('non-existent');

      expect(mockTaskManager.updateTask).not.toHaveBeenCalled();
    });
  });

  describe('task statistics', () => {
    it('should get task counts', async () => {
      const mockTasks = {
        world: [
          {
            id: 'world-1', enabled: true, uiConfigured: true,
            name: '', timeSpec: {}, targetTime: 0, callback: '', useGameTime: false,
            recurring: false, scope: 'world' as const, created: 0, runCount: 0, logExecution: false
          },
          {
            id: 'world-2', enabled: false, uiConfigured: false,
            name: '', timeSpec: {}, targetTime: 0, callback: '', useGameTime: false,
            recurring: false, scope: 'world' as const, created: 0, runCount: 0, logExecution: false
          }
        ],
        client: [
          {
            id: 'client-1', enabled: true, uiConfigured: false,
            name: '', timeSpec: {}, targetTime: 0, callback: '', useGameTime: false,
            recurring: false, scope: 'client' as const, created: 0, runCount: 0, logExecution: false
          }
        ]
      };

      vi.spyOn(mockTaskManager, 'getAllTasks').mockResolvedValue(mockTasks);

      const counts = await persistence.getTaskCounts();

      expect(counts).toEqual({
        total: 3,
        uiConfigured: 1,
        ephemeral: 2,
        enabled: 2,
        disabled: 1
      });
    });
  });

  describe('cleanup', () => {
    it('should clean up old disabled ephemeral tasks', async () => {
      const oldTime = Math.floor(Date.now() / 1000) - (10 * 86400); // 10 days ago
      
      const oldDisabledTask: Task = {
        id: 'old-task',
        name: 'Old Task',
        timeSpec: { minutes: 5 },
        targetTime: oldTime,
        callback: 'console.log("old");',
        useGameTime: false,
        recurring: false,
        scope: 'client',
        enabled: false, // Disabled
        created: oldTime, // Old
        runCount: 0,
        logExecution: false,
        uiConfigured: false // Ephemeral
      };

      const recentTask: Task = {
        id: 'recent-task',
        name: 'Recent Task',
        timeSpec: { minutes: 5 },
        targetTime: Math.floor(Date.now() / 1000),
        callback: 'console.log("recent");',
        useGameTime: false,
        recurring: false,
        scope: 'client',
        enabled: false,
        created: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
        runCount: 0,
        logExecution: false,
        uiConfigured: false
      };

      vi.spyOn(mockTaskManager, 'getAllTasks').mockResolvedValue({
        world: [],
        client: [oldDisabledTask, recentTask]
      });

      const cleanedCount = await persistence.cleanupOldTasks(7);

      expect(cleanedCount).toBe(1);
      expect(mockTaskManager.cancelTask).toHaveBeenCalledWith('old-task');
      expect(mockTaskManager.cancelTask).not.toHaveBeenCalledWith('recent-task');
    });

    it('should not clean up UI-configured tasks', async () => {
      const oldTime = Math.floor(Date.now() / 1000) - (10 * 86400); // 10 days ago
      
      const oldUITask: Task = {
        id: 'old-ui-task',
        name: 'Old UI Task',
        timeSpec: { minutes: 5 },
        targetTime: oldTime,
        callback: 'console.log("old ui");',
        useGameTime: false,
        recurring: false,
        scope: 'client',
        enabled: false, // Disabled
        created: oldTime, // Old
        runCount: 0,
        logExecution: false,
        uiConfigured: true // UI configured - should not be cleaned up
      };

      vi.spyOn(mockTaskManager, 'getAllTasks').mockResolvedValue({
        world: [],
        client: [oldUITask]
      });

      const cleanedCount = await persistence.cleanupOldTasks(7);

      expect(cleanedCount).toBe(0);
      expect(mockTaskManager.cancelTask).not.toHaveBeenCalled();
    });
  });
});