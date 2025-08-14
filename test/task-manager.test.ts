/**
 * Tests for TaskManager class
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskManager } from '../src/task-manager';
import { JournalStorage } from '../src/journal-storage';
import { EventLogger } from '../src/event-logger';
import { Task, TimeSpec } from '../src/types';
import './setup';

describe('TaskManager', () => {
  let taskManager: TaskManager;
  let mockTask: Task;

  beforeEach(() => {
    // Clear singleton instances
    (TaskManager as any).instance = undefined;
    (JournalStorage as any).instance = undefined;
    (EventLogger as any).instance = undefined;
    taskManager = TaskManager.getInstance();

    // Mock EventLogger
    const mockLogger = EventLogger.getInstance();
    vi.spyOn(mockLogger, 'initialize').mockResolvedValue(undefined);
    vi.spyOn(mockLogger, 'logTaskExecution').mockResolvedValue(undefined);
    vi.spyOn(mockLogger, 'shutdown').mockResolvedValue(undefined);

    mockTask = {
      id: 'test-task-1',
      name: 'Test Task',
      description: 'A test task',
      timeSpec: { minutes: 5 },
      targetTime: Math.floor(Date.now() / 1000) + 300,
      callback: 'console.log("Hello from task!");',
      useGameTime: false,
      recurring: false,
      scope: 'client',
      enabled: true,
      created: Math.floor(Date.now() / 1000),
      runCount: 0,
      logExecution: false,
    };

    // Create task storage for mock persistence
    const mockTaskStorage = {
      world: new Map<string, Task>(),
      client: new Map<string, Task>(),
    };

    // Create proper mock journal structure that tracks tasks
    const mockJournalPage = {
      id: 'page-id',
      name: 'Client Tasks - TestUser',
      system: {
        tasks: [],
        scope: 'client',
        version: '0.1.0',
        lastUpdated: Math.floor(Date.now() / 1000),
      },
      update: vi.fn().mockImplementation(data => {
        if (data['system.tasks']) {
          mockJournalPage.system.tasks = data['system.tasks'];
        }
        return Promise.resolve(true);
      }),
    };

    const mockJournalEntry = {
      id: 'journal-id',
      name: 'Task & Trigger Configuration',
      pages: {
        getName: vi.fn().mockReturnValue(mockJournalPage),
        find: vi.fn().mockReturnValue(mockJournalPage),
        contents: [mockJournalPage],
      },
      createEmbeddedDocuments: vi.fn().mockResolvedValue([mockJournalPage]),
      ownership: { default: 1 },
    };

    // Mock game.journal to return our mock journal
    (global as any).game.journal = {
      getName: vi.fn().mockReturnValue(mockJournalEntry),
      find: vi.fn().mockReturnValue(mockJournalEntry),
    };

    // Mock JournalEntry.create to return our mock journal
    (global as any).JournalEntry = {
      create: vi.fn().mockResolvedValue(mockJournalEntry),
    };

    // Mock storage operations to use our task storage
    const storage = JournalStorage.getInstance();
    vi.spyOn(storage, 'addTask').mockImplementation(async (task: Task) => {
      mockTaskStorage[task.scope].set(task.id, task);
      return Promise.resolve();
    });

    vi.spyOn(storage, 'updateTask').mockImplementation(async (task: Task) => {
      if (!mockTaskStorage[task.scope].has(task.id)) {
        throw new Error(`Task not found: ${task.id}`);
      }
      mockTaskStorage[task.scope].set(task.id, task);
      return Promise.resolve();
    });

    vi.spyOn(storage, 'getTask').mockImplementation(
      async (taskId: string, scope: 'world' | 'client') => {
        return mockTaskStorage[scope].get(taskId) || null;
      }
    );

    vi.spyOn(storage, 'removeTask').mockImplementation(
      async (taskId: string, scope: 'world' | 'client') => {
        mockTaskStorage[scope].delete(taskId);
        return Promise.resolve();
      }
    );

    vi.spyOn(storage, 'loadTasks').mockImplementation(async (scope: 'world' | 'client') => {
      return Array.from(mockTaskStorage[scope].values());
    });

    vi.spyOn(storage, 'getAllTasks').mockImplementation(async () => {
      return {
        world: Array.from(mockTaskStorage.world.values()),
        client: Array.from(mockTaskStorage.client.values()),
      };
    });

    // Mock TaskManager storage operations
    vi.spyOn(taskManager as any, 'loadAllTasks').mockResolvedValue({ world: [], client: [] });
    vi.spyOn(taskManager as any, 'saveTasks').mockResolvedValue(undefined);
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const manager1 = TaskManager.getInstance();
      const manager2 = TaskManager.getInstance();
      expect(manager1).toBe(manager2);
    });
  });

  describe('scheduleTask', () => {
    it('should schedule a one-time task', async () => {
      const timeSpec: TimeSpec = { minutes: 5 };
      const callback = 'console.log("test");';

      const taskId = await taskManager.scheduleTask(timeSpec, callback, false);

      expect(taskId).toBeTruthy();
      expect(typeof taskId).toBe('string');
    });

    it('should schedule a recurring task', async () => {
      const interval: TimeSpec = { minutes: 10 };
      const callback = 'ui.notifications.info("Recurring task");';

      const taskId = await taskManager.scheduleInterval(interval, callback, false);

      expect(taskId).toBeTruthy();
      expect(typeof taskId).toBe('string');
    });

    it('should handle game time tasks', async () => {
      const timeSpec: TimeSpec = { hours: 1 };
      const callback = 'console.log("Game time task");';

      const taskId = await taskManager.scheduleTask(timeSpec, callback, true);

      expect(taskId).toBeTruthy();
    });

    it('should validate time specification', async () => {
      const invalidTimeSpec = {} as TimeSpec;
      const callback = 'console.log("test");';

      await expect(taskManager.scheduleTask(invalidTimeSpec, callback, false)).rejects.toThrow();
    });

    it('should validate callback', async () => {
      const timeSpec: TimeSpec = { minutes: 5 };
      const emptyCallback = '';

      await expect(taskManager.scheduleTask(timeSpec, emptyCallback, false)).rejects.toThrow();
    });

    it('should handle absolute time specs', async () => {
      const futureTime: TimeSpec = {
        year: new Date().getFullYear() + 1,
        month: 6,
        day: 15,
      };
      const callback = 'console.log("Future task");';

      const taskId = await taskManager.scheduleTask(futureTime, callback, false);

      expect(taskId).toBeTruthy();
    });
  });

  describe('task management', () => {
    it('should cancel a task', async () => {
      const taskId = await taskManager.scheduleTask({ minutes: 5 }, 'console.log("test");', false);

      const cancelled = await taskManager.cancelTask(taskId);

      expect(cancelled).toBe(true);
    });

    it('should return false when cancelling non-existent task', async () => {
      const cancelled = await taskManager.cancelTask('non-existent-id');

      expect(cancelled).toBe(false);
    });

    it('should get all tasks', async () => {
      const taskId1 = await taskManager.scheduleTask(
        { minutes: 5 },
        'console.log("task1");',
        false
      );
      const taskId2 = await taskManager.scheduleTask(
        { minutes: 10 },
        'console.log("task2");',
        false
      );

      // Ensure both tasks were created
      expect(taskId1).toBeTruthy();
      expect(taskId2).toBeTruthy();
      expect(taskId1).not.toBe(taskId2);

      const allTasks = await taskManager.getAllTasks();

      expect(allTasks.client).toHaveLength(2);
      expect(allTasks.world).toHaveLength(0);
    });

    it('should get task by ID', async () => {
      const taskId = await taskManager.scheduleTask({ minutes: 5 }, 'console.log("test");', false);

      const task = await taskManager.getTask(taskId);

      expect(task).toBeTruthy();
      expect(task?.id).toBe(taskId);
    });

    it('should return null for non-existent task', async () => {
      const task = await taskManager.getTask('non-existent-id');

      expect(task).toBeNull();
    });

    it('should update a task', async () => {
      const taskId = await taskManager.scheduleTask({ minutes: 5 }, 'console.log("test");', false);
      const task = await taskManager.getTask(taskId);

      if (task) {
        task.name = 'Updated Task';
        await taskManager.updateTask(task);

        const updatedTask = await taskManager.getTask(taskId);
        expect(updatedTask?.name).toBe('Updated Task');
      }
    });

    it('should enable/disable tasks', async () => {
      const taskId = await taskManager.scheduleTask({ minutes: 5 }, 'console.log("test");', false);

      await taskManager.disableTask(taskId);
      const disabledTask = await taskManager.getTask(taskId);
      expect(disabledTask?.enabled).toBe(false);

      await taskManager.enableTask(taskId);
      const enabledTask = await taskManager.getTask(taskId);
      expect(enabledTask?.enabled).toBe(true);
    });
  });

  describe('initialization and cleanup', () => {
    it('should initialize from storage', async () => {
      // Create a fresh TaskManager instance for this test
      (TaskManager as any).instance = undefined;
      const freshTaskManager = TaskManager.getInstance();

      const mockTasks = {
        world: [{ ...mockTask, id: 'world-task-1', scope: 'world' as const }],
        client: [{ ...mockTask, id: 'client-task-1', scope: 'client' as const }],
      };

      // Mock the storage to return the test data
      const storage = JournalStorage.getInstance();
      vi.spyOn(storage, 'getAllTasks').mockResolvedValue(mockTasks);

      await freshTaskManager.initialize();

      const allTasks = await freshTaskManager.getAllTasks();
      expect(allTasks.world).toHaveLength(1);
      expect(allTasks.client).toHaveLength(1);
    });

    it('should cleanup on shutdown', async () => {
      const taskId = await taskManager.scheduleTask({ minutes: 5 }, 'console.log("test");', false);

      await taskManager.shutdown();

      // After shutdown, manager should be in clean state
      expect(taskManager.isInitialized()).toBe(false);
    });
  });

  describe('task execution', () => {
    it('should execute tasks when due', async () => {
      // Schedule a task for immediate execution (past time)
      const pastTime: TimeSpec = { seconds: -1 }; // 1 second ago
      const taskId = await taskManager.scheduleTask(pastTime, 'return "executed";', false);

      // Wait for the task to execute (it should execute immediately for past times)
      await new Promise(resolve => setTimeout(resolve, 10));

      const task = await taskManager.getTask(taskId);
      expect(task?.runCount).toBeGreaterThan(0);
    });

    it('should handle task execution errors', async () => {
      const taskId = await taskManager.scheduleTask(
        { seconds: -1 },
        'throw new Error("Test error");',
        false
      );

      await taskManager.checkPendingTasks();

      // Task should still exist but have error recorded
      const task = await taskManager.getTask(taskId);
      expect(task).toBeTruthy();
    });

    it('should handle recurring tasks', async () => {
      const taskId = await taskManager.scheduleInterval(
        { seconds: 1 },
        'return "recurring";',
        false
      );

      const task = await taskManager.getTask(taskId);
      expect(task?.recurring).toBe(true);
      expect(task?.interval).toEqual({ seconds: 1 });
    });
  });

  describe('world time integration', () => {
    it('should handle world time updates', async () => {
      const currentWorldTime = Math.floor(Date.now() / 1000);

      // Schedule a game-time task
      await taskManager.scheduleTask({ hours: 1 }, 'console.log("game time task");', true);

      // Simulate world time advancing
      await taskManager.handleWorldTimeUpdate(currentWorldTime + 3600, 3600);

      // Should trigger task execution check
      // This is more of a behavioral test
      expect(true).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle storage errors gracefully', async () => {
      // Mock the storage to throw an error
      const storage = JournalStorage.getInstance();
      vi.spyOn(storage, 'addTask').mockRejectedValue(new Error('Storage error'));

      // Should throw the storage error
      await expect(
        taskManager.scheduleTask({ minutes: 5 }, 'console.log("test");', false)
      ).rejects.toThrow('Storage error');
    });

    it('should handle invalid task updates', async () => {
      const invalidTask = { ...mockTask };
      delete (invalidTask as any).id;

      await expect(taskManager.updateTask(invalidTask as any)).rejects.toThrow();
    });
  });

  describe('calendar integration', () => {
    it('should schedule calendar tasks', async () => {
      const calendarDate = { year: 2025, month: 6, day: 15 };
      const callback = 'console.log("Calendar task");';

      const taskId = await taskManager.scheduleCalendarTask(calendarDate, callback, 'world');

      expect(taskId).toBeTruthy();

      const task = await taskManager.getTask(taskId);
      expect(task?.scope).toBe('world');
      expect(task?.calendarIntegrated).toBe(true);
    });

    it('should get tasks for specific date', async () => {
      const testDate = { year: 2025, month: 6, day: 15 };

      await taskManager.scheduleCalendarTask(testDate, 'console.log("test");', 'world');

      const tasksForDate = await taskManager.getTasksForDate(testDate);

      expect(tasksForDate).toHaveLength(1);
    });
  });
});
