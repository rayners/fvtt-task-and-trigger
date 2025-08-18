/**
 * Tests for TaskScheduler class
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskScheduler, ScheduleOptions, TaskInfo } from '../src/task-scheduler';
import { TaskManager } from '../src/task-manager';
import { Task, TimeSpec, CalendarDate } from '../src/types';
import './setup';

describe('TaskScheduler', () => {
  let scheduler: TaskScheduler;
  let mockTaskManager: any;

  beforeEach(() => {
    // Clear singleton instances
    (TaskScheduler as any).instance = undefined;
    (TaskManager as any).instance = undefined;

    scheduler = TaskScheduler.getInstance();
    mockTaskManager = TaskManager.getInstance();

    // Mock TaskManager methods
    vi.spyOn(mockTaskManager, 'scheduleTask').mockResolvedValue('test-task-id');
    vi.spyOn(mockTaskManager, 'scheduleInterval').mockResolvedValue('test-interval-id');
    vi.spyOn(mockTaskManager, 'scheduleCalendarTask').mockResolvedValue('test-calendar-id');
    vi.spyOn(mockTaskManager, 'cancelTask').mockResolvedValue(true);
    vi.spyOn(mockTaskManager, 'enableTask').mockResolvedValue(undefined);
    vi.spyOn(mockTaskManager, 'disableTask').mockResolvedValue(undefined);
    vi.spyOn(mockTaskManager, 'isInitialized').mockReturnValue(true);
    vi.spyOn(mockTaskManager, 'initialize').mockResolvedValue(undefined);
    vi.spyOn(mockTaskManager, 'shutdown').mockResolvedValue(undefined);
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const scheduler1 = TaskScheduler.getInstance();
      const scheduler2 = TaskScheduler.getInstance();
      expect(scheduler1).toBe(scheduler2);
    });
  });

  describe('setTimeout', () => {
    it('should schedule a real-time timeout', async () => {
      const delay: TimeSpec = { minutes: 5 };
      const callback = 'console.log("timeout");';
      const options: ScheduleOptions = { scope: 'world' };

      const taskId = await scheduler.setTimeout(delay, callback, options);

      expect(taskId).toBe('test-task-id');
      expect(mockTaskManager.scheduleTask).toHaveBeenCalledWith(
        delay,
        callback,
        false, // Real time
        'world'
      );
    });

    it('should use client scope by default', async () => {
      await scheduler.setTimeout({ minutes: 5 }, 'console.log("test");');

      expect(mockTaskManager.scheduleTask).toHaveBeenCalledWith(
        { minutes: 5 },
        'console.log("test");',
        false,
        'client'
      );
    });
  });

  describe('setInterval', () => {
    it('should schedule a real-time interval', async () => {
      const interval: TimeSpec = { minutes: 10 };
      const callback = 'ui.notifications.info("interval");';
      const options: ScheduleOptions = { scope: 'client' };

      const taskId = await scheduler.setInterval(interval, callback, options);

      expect(taskId).toBe('test-interval-id');
      expect(mockTaskManager.scheduleInterval).toHaveBeenCalledWith(
        interval,
        callback,
        false, // Real time
        'client'
      );
    });
  });

  describe('setGameTimeout', () => {
    it('should schedule a game-time timeout', async () => {
      const delay: TimeSpec = { hours: 2 };
      const callback = 'game.combat?.nextRound();';

      const taskId = await scheduler.setGameTimeout(delay, callback);

      expect(taskId).toBe('test-task-id');
      expect(mockTaskManager.scheduleTask).toHaveBeenCalledWith(
        delay,
        callback,
        true, // Game time
        'client'
      );
    });
  });

  describe('setGameInterval', () => {
    it('should schedule a game-time interval', async () => {
      const interval: TimeSpec = { hours: 8 };
      const callback = 'ui.notifications.warn("Time for rest!");';

      const taskId = await scheduler.setGameInterval(interval, callback);

      expect(taskId).toBe('test-interval-id');
      expect(mockTaskManager.scheduleInterval).toHaveBeenCalledWith(
        interval,
        callback,
        true, // Game time
        'client'
      );
    });
  });

  describe('scheduleAt', () => {
    it('should schedule a task for specific date/time', async () => {
      const targetDate = new Date('2025-12-25T10:00:00Z');
      const callback = 'ui.notifications.info("Merry Christmas!");';

      const taskId = await scheduler.scheduleAt(targetDate, callback);

      expect(taskId).toBe('test-task-id');
      expect(mockTaskManager.scheduleTask).toHaveBeenCalledWith(
        Math.floor(targetDate.getTime() / 1000),
        callback,
        false, // Real time
        'client'
      );
    });
  });

  describe('scheduleForDate', () => {
    it('should schedule a task for calendar date', async () => {
      const calendarDate: CalendarDate = { year: 2025, month: 6, day: 15 };
      const callback = 'console.log("Calendar event");';

      const taskId = await scheduler.scheduleForDate(calendarDate, callback);

      expect(taskId).toBe('test-calendar-id');
      expect(mockTaskManager.scheduleCalendarTask).toHaveBeenCalledWith(
        calendarDate,
        callback,
        'world' // Calendar tasks default to world scope
      );
    });

    it('should respect custom scope for calendar tasks', async () => {
      const calendarDate: CalendarDate = { year: 2025, month: 6, day: 15 };
      const callback = 'console.log("Calendar event");';
      const options: ScheduleOptions = { scope: 'client' };

      await scheduler.scheduleForDate(calendarDate, callback, options);

      expect(mockTaskManager.scheduleCalendarTask).toHaveBeenCalledWith(
        calendarDate,
        callback,
        'client'
      );
    });
  });

  describe('task cancellation', () => {
    it('should cancel tasks via clearTimeout', async () => {
      const result = await scheduler.clearTimeout('test-task-id');

      expect(result).toBe(true);
      expect(mockTaskManager.cancelTask).toHaveBeenCalledWith('test-task-id');
    });

    it('should cancel tasks via clearInterval', async () => {
      const result = await scheduler.clearInterval('test-interval-id');

      expect(result).toBe(true);
      expect(mockTaskManager.cancelTask).toHaveBeenCalledWith('test-interval-id');
    });

    it('should cancel tasks via general cancel method', async () => {
      const result = await scheduler.cancel('test-task-id');

      expect(result).toBe(true);
      expect(mockTaskManager.cancelTask).toHaveBeenCalledWith('test-task-id');
    });
  });

  describe('task control', () => {
    it('should enable tasks', async () => {
      await scheduler.enable('test-task-id');

      expect(mockTaskManager.enableTask).toHaveBeenCalledWith('test-task-id');
    });

    it('should disable tasks', async () => {
      await scheduler.disable('test-task-id');

      expect(mockTaskManager.disableTask).toHaveBeenCalledWith('test-task-id');
    });
  });

  describe('task information', () => {
    it('should get task info', async () => {
      const mockTask: Task = {
        id: 'test-task-id',
        name: 'Test Task',
        description: 'A test task',
        timeSpec: { minutes: 5 },
        targetTime: Math.floor(Date.now() / 1000) + 300,
        macroId: 'test-macro-id',
        macroSource: 'existing' as const,
        useGameTime: false,
        recurring: false,
        scope: 'client',
        enabled: true,
        created: Math.floor(Date.now() / 1000),
        runCount: 5,
        lastExecution: Math.floor(Date.now() / 1000) - 60,
        logExecution: false,
      };

      vi.spyOn(mockTaskManager, 'getTask').mockResolvedValue(mockTask);

      const taskInfo = await scheduler.getTaskInfo('test-task-id');

      expect(taskInfo).toEqual({
        id: 'test-task-id',
        name: 'Test Task',
        description: 'A test task',
        nextExecution: mockTask.targetTime,
        isRecurring: false,
        enabled: true,
        runCount: 5,
        lastExecution: mockTask.lastExecution,
        lastError: undefined,
        useGameTime: false,
        scope: 'client',
      });
    });

    it('should return null for non-existent task', async () => {
      vi.spyOn(mockTaskManager, 'getTask').mockResolvedValue(null);

      const taskInfo = await scheduler.getTaskInfo('non-existent-id');

      expect(taskInfo).toBeNull();
    });
  });

  describe('task listing', () => {
    it('should list all tasks', async () => {
      const mockTasks = {
        world: [
          {
            id: 'world-task',
            name: 'World Task',
            timeSpec: { hours: 1 },
            targetTime: Math.floor(Date.now() / 1000) + 3600,
            macroId: 'test-macro-id',
        macroSource: 'existing' as const,
            useGameTime: true,
            recurring: false,
            scope: 'world' as const,
            enabled: true,
            created: Math.floor(Date.now() / 1000),
            runCount: 0,
            logExecution: false,
          },
        ],
        client: [
          {
            id: 'client-task',
            name: 'Client Task',
            timeSpec: { minutes: 30 },
            targetTime: Math.floor(Date.now() / 1000) + 1800,
            macroId: 'test-macro-id',
        macroSource: 'existing' as const,
            useGameTime: false,
            recurring: true,
            interval: { minutes: 30 },
            scope: 'client' as const,
            enabled: true,
            created: Math.floor(Date.now() / 1000),
            runCount: 3,
            logExecution: false,
          },
        ],
      };

      vi.spyOn(mockTaskManager, 'getAllTasks').mockResolvedValue(mockTasks);

      const tasks = await scheduler.listTasks();

      expect(tasks).toHaveLength(2);
      expect(tasks[0].id).toBe('world-task');
      expect(tasks[0].scope).toBe('world');
      expect(tasks[1].id).toBe('client-task');
      expect(tasks[1].scope).toBe('client');
    });

    it('should list tasks for specific scope', async () => {
      const mockTasks = {
        world: [
          {
            id: 'world-task',
            name: 'World Task',
            timeSpec: { hours: 1 },
            targetTime: Math.floor(Date.now() / 1000) + 3600,
            macroId: 'test-macro-id',
        macroSource: 'existing' as const,
            useGameTime: true,
            recurring: false,
            scope: 'world' as const,
            enabled: true,
            created: Math.floor(Date.now() / 1000),
            runCount: 0,
            logExecution: false,
          },
        ],
        client: [],
      };

      vi.spyOn(mockTaskManager, 'getAllTasks').mockResolvedValue(mockTasks);

      const worldTasks = await scheduler.listTasks('world');
      const clientTasks = await scheduler.listTasks('client');

      expect(worldTasks).toHaveLength(1);
      expect(worldTasks[0].id).toBe('world-task');
      expect(clientTasks).toHaveLength(0);
    });
  });

  describe('calendar date tasks', () => {
    it('should list tasks for specific date', async () => {
      const testDate: CalendarDate = { year: 2025, month: 6, day: 15 };
      const mockDateTasks: Task[] = [
        {
          id: 'date-task',
          name: 'Date Task',
          timeSpec: testDate,
          targetTime: Math.floor(Date.now() / 1000) + 86400,
          macroId: 'test-macro-id',
        macroSource: 'existing' as const,
          useGameTime: true,
          recurring: false,
          scope: 'world',
          enabled: true,
          created: Math.floor(Date.now() / 1000),
          runCount: 0,
          logExecution: true,
          calendarIntegrated: true,
          calendarDate: testDate,
        },
      ];

      vi.spyOn(mockTaskManager, 'getTasksForDate').mockResolvedValue(mockDateTasks);

      const tasks = await scheduler.listTasksForDate(testDate);

      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe('date-task');
      expect(mockTaskManager.getTasksForDate).toHaveBeenCalledWith(testDate);
    });
  });

  describe('statistics', () => {
    it('should get task statistics', async () => {
      const mockTasks = {
        world: [
          {
            id: 'world-1',
            name: 'World 1',
            enabled: true,
            useGameTime: true,
            recurring: false,
            timeSpec: {},
            targetTime: 0,
            macroId: 'test-macro-id',
        macroSource: 'existing' as const,
            scope: 'world' as const,
            created: 0,
            runCount: 0,
            logExecution: false,
          },
          {
            id: 'world-2',
            name: 'World 2',
            enabled: false,
            useGameTime: true,
            recurring: true,
            timeSpec: {},
            targetTime: 0,
            macroId: 'test-macro-id',
        macroSource: 'existing' as const,
            scope: 'world' as const,
            created: 0,
            runCount: 0,
            logExecution: false,
            interval: {},
          },
        ],
        client: [
          {
            id: 'client-1',
            name: 'Client 1',
            enabled: true,
            useGameTime: false,
            recurring: true,
            timeSpec: {},
            targetTime: 0,
            macroId: 'test-macro-id',
        macroSource: 'existing' as const,
            scope: 'client' as const,
            created: 0,
            runCount: 0,
            logExecution: false,
            interval: {},
          },
        ],
      };

      vi.spyOn(mockTaskManager, 'getAllTasks').mockResolvedValue(mockTasks);

      const stats = await scheduler.getStatistics();

      expect(stats).toEqual({
        total: 3,
        enabled: 2,
        disabled: 1,
        realTime: 1,
        gameTime: 2,
        recurring: 2,
        oneTime: 1,
        worldTasks: 2,
        clientTasks: 1,
      });
    });
  });

  describe('reminder methods', () => {
    it('should schedule a reminder', async () => {
      const delay: TimeSpec = { minutes: 15 };
      const message = 'Take a break!';

      const taskId = await scheduler.scheduleReminder(delay, message);

      expect(taskId).toBe('test-task-id');
      expect(mockTaskManager.scheduleTask).toHaveBeenCalledWith(
        delay,
        'ui.notifications?.info("Reminder: Take a break!");',
        false,
        'client'
      );
    });

    it('should schedule a recurring reminder', async () => {
      const interval: TimeSpec = { hours: 1 };
      const message = 'Hourly check';

      const taskId = await scheduler.scheduleRecurringReminder(interval, message);

      expect(taskId).toBe('test-interval-id');
      expect(mockTaskManager.scheduleInterval).toHaveBeenCalledWith(
        interval,
        'ui.notifications?.info("Reminder: Hourly check");',
        false,
        'client'
      );
    });

    it('should schedule a game time reminder', async () => {
      const delay: TimeSpec = { hours: 8 };
      const message = 'Long rest complete';

      const taskId = await scheduler.scheduleGameReminder(delay, message);

      expect(taskId).toBe('test-task-id');
      expect(mockTaskManager.scheduleTask).toHaveBeenCalledWith(
        delay,
        'ui.notifications?.info("Game Time Reminder: Long rest complete");',
        true,
        'client'
      );
    });

    it('should escape quotes in reminder messages', async () => {
      const message = 'Don\'t forget "important" task';

      await scheduler.scheduleReminder({ minutes: 5 }, message);

      expect(mockTaskManager.scheduleTask).toHaveBeenCalledWith(
        { minutes: 5 },
        'ui.notifications?.info("Reminder: Don\'t forget \\"important\\" task");',
        false,
        'client'
      );
    });
  });

  describe('utility methods', () => {
    it('should format relative time specs', () => {
      expect(scheduler.formatTimeSpec({ days: 2, hours: 3, minutes: 30 })).toBe(
        '2 days, 3 hours, 30 minutes'
      );

      expect(scheduler.formatTimeSpec({ seconds: 1 })).toBe('1 second');

      expect(scheduler.formatTimeSpec({ hours: 2 })).toBe('2 hours');

      expect(scheduler.formatTimeSpec({})).toBe('immediately');
    });

    it('should format absolute time specs', () => {
      expect(scheduler.formatTimeSpec({ year: 2025, month: 6, day: 15 })).toBe('2025/6/15');
    });

    it('should format timestamp specs', () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const formatted = scheduler.formatTimeSpec(timestamp);

      expect(formatted).toContain('2025'); // Should be a readable date
    });

    it('should format game time timestamps', () => {
      const timestamp = 12345;
      const formatted = scheduler.formatTimeSpec(timestamp, true);

      expect(formatted).toBe('World Time 12345');
    });
  });

  describe('next execution time', () => {
    it('should get next execution time for real-time task', async () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const mockTask: Task = {
        id: 'test-task',
        name: 'Test Task',
        timeSpec: { hours: 1 },
        targetTime: futureTime,
        macroId: 'test-macro-id',
        macroSource: 'existing' as const,
        useGameTime: false,
        recurring: false,
        scope: 'client',
        enabled: true,
        created: Math.floor(Date.now() / 1000),
        runCount: 0,
        logExecution: false,
      };

      vi.spyOn(mockTaskManager, 'getTask').mockResolvedValue(mockTask);

      const nextExecution = await scheduler.getNextExecutionTime('test-task');

      expect(nextExecution).toContain('2025'); // Should be a readable date
    });

    it('should handle ready-to-execute tasks', async () => {
      const pastTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const mockTask: Task = {
        id: 'test-task',
        name: 'Test Task',
        timeSpec: { hours: -1 },
        targetTime: pastTime,
        macroId: 'test-macro-id',
        macroSource: 'existing' as const,
        useGameTime: false,
        recurring: false,
        scope: 'client',
        enabled: true,
        created: Math.floor(Date.now() / 1000),
        runCount: 0,
        logExecution: false,
      };

      vi.spyOn(mockTaskManager, 'getTask').mockResolvedValue(mockTask);

      const nextExecution = await scheduler.getNextExecutionTime('test-task');

      expect(nextExecution).toBe('Ready to execute');
    });

    it('should return null for non-existent task', async () => {
      vi.spyOn(mockTaskManager, 'getTask').mockResolvedValue(null);

      const nextExecution = await scheduler.getNextExecutionTime('non-existent');

      expect(nextExecution).toBeNull();
    });
  });

  describe('initialization and status', () => {
    it('should check if scheduler is ready', () => {
      expect(scheduler.isReady()).toBe(true);
      expect(mockTaskManager.isInitialized).toHaveBeenCalled();
    });

    it('should initialize scheduler', async () => {
      await scheduler.initialize();

      expect(mockTaskManager.initialize).toHaveBeenCalled();
    });

    it('should shutdown scheduler', async () => {
      await scheduler.shutdown();

      expect(mockTaskManager.shutdown).toHaveBeenCalled();
    });
  });
});
