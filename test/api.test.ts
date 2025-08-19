/**
 * Tests for TaskTrigger API
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createAPI, TaskTriggerAPIImpl } from '../src/api';
import { TaskScheduler } from '../src/task-scheduler';
import { TaskPersistence } from '../src/task-persistence';
import { TaskManagerApplication } from '../src/task-manager-application';
import { TimeSpec, CalendarDate } from '../src/types';
import './setup';

describe('TaskTriggerAPI', () => {
  let api: TaskTriggerAPIImpl;
  let mockScheduler: any;
  let mockPersistence: any;

  beforeEach(() => {
    // Clear singleton instances
    (TaskScheduler as any).instance = undefined;
    (TaskPersistence as any).instance = undefined;

    api = new TaskTriggerAPIImpl();
    mockScheduler = TaskScheduler.getInstance();
    mockPersistence = TaskPersistence.getInstance();

    // Mock scheduler methods
    vi.spyOn(mockScheduler, 'setTimeout').mockResolvedValue('test-timeout-id');
    vi.spyOn(mockScheduler, 'setInterval').mockResolvedValue('test-interval-id');
    vi.spyOn(mockScheduler, 'setGameTimeout').mockResolvedValue('test-game-timeout-id');
    vi.spyOn(mockScheduler, 'setGameInterval').mockResolvedValue('test-game-interval-id');
    vi.spyOn(mockScheduler, 'scheduleAt').mockResolvedValue('test-schedule-at-id');
    vi.spyOn(mockScheduler, 'scheduleForDate').mockResolvedValue('test-schedule-date-id');
    vi.spyOn(mockScheduler, 'scheduleReminder').mockResolvedValue('test-reminder-id');
    vi.spyOn(mockScheduler, 'scheduleRecurringReminder').mockResolvedValue(
      'test-recurring-reminder-id'
    );
    vi.spyOn(mockScheduler, 'scheduleGameReminder').mockResolvedValue('test-game-reminder-id');
    vi.spyOn(mockScheduler, 'clearTimeout').mockResolvedValue(true);
    vi.spyOn(mockScheduler, 'clearInterval').mockResolvedValue(true);
    vi.spyOn(mockScheduler, 'cancel').mockResolvedValue(true);
    vi.spyOn(mockScheduler, 'enable').mockResolvedValue(undefined);
    vi.spyOn(mockScheduler, 'disable').mockResolvedValue(undefined);
    vi.spyOn(mockScheduler, 'getTaskInfo').mockResolvedValue(null);
    vi.spyOn(mockScheduler, 'listTasks').mockResolvedValue([]);
    vi.spyOn(mockScheduler, 'listTasksForDate').mockResolvedValue([]);
    vi.spyOn(mockScheduler, 'getStatistics').mockResolvedValue({});
    vi.spyOn(mockScheduler, 'formatTimeSpec').mockReturnValue('formatted time');
    vi.spyOn(mockScheduler, 'getNextExecutionTime').mockResolvedValue('next time');
    vi.spyOn(mockScheduler, 'isReady').mockReturnValue(true);

    // Mock persistence methods
    vi.spyOn(mockPersistence, 'markAsUIConfigured').mockResolvedValue(undefined);
    vi.spyOn(mockPersistence, 'markAsEphemeral').mockResolvedValue(undefined);
    vi.spyOn(mockPersistence, 'cleanupOldTasks').mockResolvedValue(5);
  });

  describe('createAPI', () => {
    it('should create API instance', () => {
      const api = createAPI();
      expect(api).toBeInstanceOf(TaskTriggerAPIImpl);
    });
  });

  describe('basic scheduling', () => {
    it('should schedule timeout with string callback', async () => {
      const delay: TimeSpec = { minutes: 5 };
      const callback = 'console.log("timeout");';
      const options = { scope: 'client' as const };

      const taskId = await api.setTimeout(delay, callback, options);

      expect(taskId).toBe('test-timeout-id');
      expect(mockScheduler.setTimeout).toHaveBeenCalledWith(delay, callback, options);
    });

    it('should schedule timeout with macro ID', async () => {
      const delay: TimeSpec = { seconds: 30 };
      const macroId = 'test-macro-id';

      const taskId = await api.setTimeout(delay, macroId);

      expect(taskId).toBe('test-timeout-id');
      expect(mockScheduler.setTimeout).toHaveBeenCalledWith(delay, macroId, {});
    });

    it('should schedule timeout with macro ID and options', async () => {
      const delay: TimeSpec = { seconds: 10 };
      const macroId = 'notification-macro-id';
      const options = { name: 'Test Notification' };

      const taskId = await api.setTimeout(delay, macroId, options);

      expect(taskId).toBe('test-timeout-id');
      expect(mockScheduler.setTimeout).toHaveBeenCalledWith(delay, macroId, options);
    });

    it('should schedule interval', async () => {
      const interval: TimeSpec = { minutes: 10 };
      const callback = 'ui.notifications.info("interval");';

      const taskId = await api.setInterval(interval, callback);

      expect(taskId).toBe('test-interval-id');
      expect(mockScheduler.setInterval).toHaveBeenCalledWith(interval, callback, {});
    });

    it('should clear timeout', async () => {
      const result = await api.clearTimeout('test-id');

      expect(result).toBe(true);
      expect(mockScheduler.clearTimeout).toHaveBeenCalledWith('test-id');
    });

    it('should clear interval', async () => {
      const result = await api.clearInterval('test-id');

      expect(result).toBe(true);
      expect(mockScheduler.clearInterval).toHaveBeenCalledWith('test-id');
    });
  });

  describe('game time scheduling', () => {
    it('should schedule game timeout', async () => {
      const delay: TimeSpec = { hours: 2 };
      const callback = 'game.combat?.nextRound();';

      const taskId = await api.setGameTimeout(delay, callback);

      expect(taskId).toBe('test-game-timeout-id');
      expect(mockScheduler.setGameTimeout).toHaveBeenCalledWith(delay, callback, {});
    });

    it('should schedule game interval', async () => {
      const interval: TimeSpec = { hours: 8 };
      const callback = 'ui.notifications.warn("Rest time!");';

      const taskId = await api.setGameInterval(interval, callback);

      expect(taskId).toBe('test-game-interval-id');
      expect(mockScheduler.setGameInterval).toHaveBeenCalledWith(interval, callback, {});
    });
  });

  describe('advanced scheduling', () => {
    it('should schedule at specific date', async () => {
      const targetDate = new Date('2025-12-25T10:00:00Z');
      const callback = 'ui.notifications.info("Merry Christmas!");';

      const taskId = await api.scheduleAt(targetDate, callback);

      expect(taskId).toBe('test-schedule-at-id');
      expect(mockScheduler.scheduleAt).toHaveBeenCalledWith(targetDate, callback, {});
    });

    it('should schedule for calendar date', async () => {
      const calendarDate: CalendarDate = { year: 2025, month: 6, day: 15 };
      const callback = 'console.log("Calendar event");';

      const taskId = await api.scheduleForDate(calendarDate, callback);

      expect(taskId).toBe('test-schedule-date-id');
      expect(mockScheduler.scheduleForDate).toHaveBeenCalledWith(calendarDate, callback, {});
    });
  });

  describe('reminders', () => {
    it('should schedule reminder', async () => {
      const delay: TimeSpec = { minutes: 15 };
      const message = 'Take a break!';

      const taskId = await api.scheduleReminder(delay, message);

      expect(taskId).toBe('test-reminder-id');
      expect(mockScheduler.scheduleReminder).toHaveBeenCalledWith(delay, message, {});
    });

    it('should schedule recurring reminder', async () => {
      const interval: TimeSpec = { hours: 1 };
      const message = 'Hourly check';

      const taskId = await api.scheduleRecurringReminder(interval, message);

      expect(taskId).toBe('test-recurring-reminder-id');
      expect(mockScheduler.scheduleRecurringReminder).toHaveBeenCalledWith(interval, message, {});
    });

    it('should schedule game reminder', async () => {
      const delay: TimeSpec = { hours: 8 };
      const message = 'Long rest complete';

      const taskId = await api.scheduleGameReminder(delay, message);

      expect(taskId).toBe('test-game-reminder-id');
      expect(mockScheduler.scheduleGameReminder).toHaveBeenCalledWith(delay, message, {});
    });
  });

  describe('task management', () => {
    it('should cancel task', async () => {
      const result = await api.cancel('test-id');

      expect(result).toBe(true);
      expect(mockScheduler.cancel).toHaveBeenCalledWith('test-id');
    });

    it('should enable task', async () => {
      await api.enable('test-id');

      expect(mockScheduler.enable).toHaveBeenCalledWith('test-id');
    });

    it('should disable task', async () => {
      await api.disable('test-id');

      expect(mockScheduler.disable).toHaveBeenCalledWith('test-id');
    });
  });

  describe('information queries', () => {
    it('should get task info', async () => {
      const taskInfo = await api.getTaskInfo('test-id');

      expect(taskInfo).toBeNull();
      expect(mockScheduler.getTaskInfo).toHaveBeenCalledWith('test-id');
    });

    it('should list tasks', async () => {
      const tasks = await api.listTasks('client');

      expect(tasks).toEqual([]);
      expect(mockScheduler.listTasks).toHaveBeenCalledWith('client');
    });

    it('should list tasks for date', async () => {
      const calendarDate: CalendarDate = { year: 2025, month: 6, day: 15 };

      const tasks = await api.listTasksForDate(calendarDate);

      expect(tasks).toEqual([]);
      expect(mockScheduler.listTasksForDate).toHaveBeenCalledWith(calendarDate);
    });

    it('should get statistics', async () => {
      const stats = await api.getStatistics();

      expect(stats).toEqual({});
      expect(mockScheduler.getStatistics).toHaveBeenCalled();
    });
  });

  describe('utilities', () => {
    it('should format time spec', () => {
      const timeSpec: TimeSpec = { hours: 2, minutes: 30 };

      const formatted = api.formatTimeSpec(timeSpec, true);

      expect(formatted).toBe('formatted time');
      expect(mockScheduler.formatTimeSpec).toHaveBeenCalledWith(timeSpec, true);
    });

    it('should get next execution time', async () => {
      const nextTime = await api.getNextExecutionTime('test-id');

      expect(nextTime).toBe('next time');
      expect(mockScheduler.getNextExecutionTime).toHaveBeenCalledWith('test-id');
    });

    it('should check if ready', () => {
      const ready = api.isReady();

      expect(ready).toBe(true);
      expect(mockScheduler.isReady).toHaveBeenCalled();
    });

    it('should show task manager application', () => {
      const taskManagerSpy = vi.spyOn(TaskManagerApplication, 'show');

      api.showTaskManager();

      expect(taskManagerSpy).toHaveBeenCalled();
    });
  });

  describe('persistence management', () => {
    it('should mark task as UI task', async () => {
      await api.markAsUITask('test-id');

      expect(mockPersistence.markAsUIConfigured).toHaveBeenCalledWith('test-id');
    });

    it('should mark task as ephemeral', async () => {
      await api.markAsEphemeral('test-id');

      expect(mockPersistence.markAsEphemeral).toHaveBeenCalledWith('test-id');
    });

    it('should cleanup old tasks', async () => {
      const cleanedCount = await api.cleanupOldTasks(10);

      expect(cleanedCount).toBe(5);
      expect(mockPersistence.cleanupOldTasks).toHaveBeenCalledWith(10);
    });

    it('should cleanup old tasks with default days', async () => {
      const cleanedCount = await api.cleanupOldTasks();

      expect(cleanedCount).toBe(5);
      expect(mockPersistence.cleanupOldTasks).toHaveBeenCalledWith(7);
    });
  });

  describe('macro ID validation', () => {
    it('should handle complex macro scheduling', async () => {
      const complexMacroId = 'complex-macro-id';

      const taskId = await api.setTimeout({ seconds: 1 }, complexMacroId);

      expect(taskId).toBe('test-timeout-id');
      expect(mockScheduler.setTimeout).toHaveBeenCalledWith({ seconds: 1 }, complexMacroId, {});
    });

    it('should handle async macro scheduling', async () => {
      const asyncMacroId = 'async-macro-id';

      const taskId = await api.setTimeout({ seconds: 1 }, asyncMacroId);

      expect(taskId).toBe('test-timeout-id');
      expect(mockScheduler.setTimeout).toHaveBeenCalledWith({ seconds: 1 }, asyncMacroId, {});
    });

    it('should handle string callback as-is', async () => {
      const callback = 'ui.notifications.info("direct string");';

      const taskId = await api.setTimeout({ seconds: 1 }, callback);

      expect(taskId).toBe('test-timeout-id');
      expect(mockScheduler.setTimeout).toHaveBeenCalledWith({ seconds: 1 }, callback, {});
    });
  });
});
