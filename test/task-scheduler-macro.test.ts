/**
 * Tests for TaskScheduler macro-based functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskScheduler } from '../src/task-scheduler';
import { TaskManager } from '../src/task-manager';
import { MacroManager } from '../src/macro-manager';
import { AccumulatedTimeManager } from '../src/accumulated-time-manager';
import './setup';

describe('TaskScheduler - Macro Integration', () => {
  let scheduler: TaskScheduler;
  let mockTaskManager: any;
  let mockMacroManager: any;
  let mockAccumulatedTimeManager: any;

  beforeEach(() => {
    // Clear singleton instances
    (TaskScheduler as any).instance = undefined;
    (TaskManager as any).instance = undefined;
    (MacroManager as any).instance = undefined;
    (AccumulatedTimeManager as any).instance = undefined;

    scheduler = TaskScheduler.getInstance();
    mockTaskManager = TaskManager.getInstance();
    mockMacroManager = MacroManager.getInstance();
    mockAccumulatedTimeManager = AccumulatedTimeManager.getInstance();

    // Mock TaskManager methods
    vi.spyOn(mockTaskManager, 'scheduleTask').mockResolvedValue('test-task-id');
    vi.spyOn(mockTaskManager, 'scheduleInterval').mockResolvedValue('test-interval-id');
    vi.spyOn(mockTaskManager, 'scheduleCalendarTask').mockResolvedValue('test-calendar-id');

    // Mock MacroManager methods
    vi.spyOn(mockMacroManager, 'createTaskMacro').mockResolvedValue({
      id: 'test-macro-id',
      name: 'Test Macro'
    });
  });

  describe('basic scheduling with macros', () => {
    it('should schedule timeout with macro ID', async () => {
      const taskId = await scheduler.setTimeout(
        { minutes: 5 },
        'existing-macro-id',
        { name: 'Test Task', scope: 'client' }
      );

      expect(taskId).toBe('test-task-id');
      expect(mockTaskManager.scheduleTask).toHaveBeenCalledWith(
        { minutes: 5 },
        'existing-macro-id',
        false,
        'client'
      );
    });

    it('should schedule interval with macro ID', async () => {
      const taskId = await scheduler.setInterval(
        { hours: 1 },
        'recurring-macro-id',
        { name: 'Recurring Task', scope: 'world' }
      );

      expect(taskId).toBe('test-interval-id');
      expect(mockTaskManager.scheduleInterval).toHaveBeenCalledWith(
        { hours: 1 },
        'recurring-macro-id',
        false,
        'world'
      );
    });

    it('should schedule game timeout with macro ID', async () => {
      const taskId = await scheduler.setGameTimeout(
        { hours: 8 },
        'rest-macro-id',
        { name: 'Rest Complete', scope: 'client' }
      );

      expect(taskId).toBe('test-task-id');
      expect(mockTaskManager.scheduleTask).toHaveBeenCalledWith(
        { hours: 8 },
        'rest-macro-id',
        true,
        'client'
      );
    });

    it('should schedule game interval with macro ID', async () => {
      const taskId = await scheduler.setGameInterval(
        { days: 1 },
        'daily-macro-id',
        { name: 'Daily Check', scope: 'world' }
      );

      expect(taskId).toBe('test-interval-id');
      expect(mockTaskManager.scheduleInterval).toHaveBeenCalledWith(
        { days: 1 },
        'daily-macro-id',
        true,
        'world'
      );
    });

    it('should schedule at specific date with macro ID', async () => {
      const targetDate = new Date('2025-12-25T09:00:00');
      const taskId = await scheduler.scheduleAt(
        targetDate,
        'holiday-macro-id',
        { name: 'Holiday Task' }
      );

      expect(taskId).toBe('test-task-id');
      expect(mockTaskManager.scheduleTask).toHaveBeenCalledWith(
        Math.floor(targetDate.getTime() / 1000),
        'holiday-macro-id',
        false,
        'client'
      );
    });

    it('should schedule for calendar date with macro ID', async () => {
      const calendarDate = { year: 2025, month: 6, day: 15 };
      const taskId = await scheduler.scheduleForDate(
        calendarDate,
        'calendar-macro-id',
        { name: 'Calendar Task' }
      );

      expect(taskId).toBe('test-calendar-id');
      expect(mockTaskManager.scheduleCalendarTask).toHaveBeenCalledWith(
        calendarDate,
        'calendar-macro-id',
        'world'
      );
    });
  });

  describe('reminder methods with macro creation', () => {
    it('should create reminder with auto-generated macro', async () => {
      const taskId = await scheduler.scheduleReminder(
        { minutes: 15 },
        'Take a break!',
        { name: 'Break Reminder' }
      );

      expect(taskId).toBe('test-task-id');
      expect(mockMacroManager.createTaskMacro).toHaveBeenCalledWith({
        name: 'Break Reminder',
        code: 'ui.notifications?.info("Reminder: Take a break!");',
        folder: 'task-and-trigger/reminders',
        moduleId: 'task-and-trigger'
      });
      expect(mockTaskManager.scheduleTask).toHaveBeenCalledWith(
        { minutes: 15 },
        'test-macro-id',
        false,
        'client'
      );
    });

    it('should create recurring reminder with auto-generated macro', async () => {
      const taskId = await scheduler.scheduleRecurringReminder(
        { hours: 2 },
        'Hourly check-in',
        { name: 'Hourly Reminder' }
      );

      expect(taskId).toBe('test-interval-id');
      expect(mockMacroManager.createTaskMacro).toHaveBeenCalledWith({
        name: 'Hourly Reminder',
        code: 'ui.notifications?.info("Reminder: Hourly check-in");',
        folder: 'task-and-trigger/reminders',
        moduleId: 'task-and-trigger'
      });
      expect(mockTaskManager.scheduleInterval).toHaveBeenCalledWith(
        { hours: 2 },
        'test-macro-id',
        false,
        'client'
      );
    });

    it('should create game time reminder with auto-generated macro', async () => {
      const taskId = await scheduler.scheduleGameReminder(
        { hours: 8 },
        'Long rest complete',
        { name: 'Rest Reminder' }
      );

      expect(taskId).toBe('test-task-id');
      expect(mockMacroManager.createTaskMacro).toHaveBeenCalledWith({
        name: 'Rest Reminder',
        code: 'ui.notifications?.info("Game Time Reminder: Long rest complete");',
        folder: 'task-and-trigger/reminders',
        moduleId: 'task-and-trigger'
      });
      expect(mockTaskManager.scheduleTask).toHaveBeenCalledWith(
        { hours: 8 },
        'test-macro-id',
        true,
        'client'
      );
    });

    it('should handle long reminder messages with truncation', async () => {
      const longMessage = 'This is a very long reminder message that exceeds the typical length limit for macro names and should be truncated appropriately';
      
      await scheduler.scheduleReminder(
        { minutes: 5 },
        longMessage,
        { name: 'Long Reminder' }
      );

      expect(mockMacroManager.createTaskMacro).toHaveBeenCalledWith({
        name: 'Long Reminder',
        code: `ui.notifications?.info("Reminder: ${longMessage}");`,
        folder: 'task-and-trigger/reminders',
        moduleId: 'task-and-trigger'
      });
    });

    it('should escape quotes in reminder messages', async () => {
      const messageWithQuotes = 'Don\'t forget "important" meeting';
      
      await scheduler.scheduleReminder(
        { minutes: 30 },
        messageWithQuotes,
        { name: 'Quote Test' }
      );

      expect(mockMacroManager.createTaskMacro).toHaveBeenCalledWith({
        name: 'Quote Test',
        code: 'ui.notifications?.info("Reminder: Don\'t forget \\"important\\" meeting");',
        folder: 'task-and-trigger/reminders',
        moduleId: 'task-and-trigger'
      });
    });
  });

  describe('default options handling', () => {
    it('should use default scope for timeout', async () => {
      await scheduler.setTimeout({ minutes: 5 }, 'test-macro-id');

      expect(mockTaskManager.scheduleTask).toHaveBeenCalledWith(
        { minutes: 5 },
        'test-macro-id',
        false,
        'client' // Default scope
      );
    });

    it('should use default scope for interval', async () => {
      await scheduler.setInterval({ hours: 1 }, 'test-macro-id');

      expect(mockTaskManager.scheduleInterval).toHaveBeenCalledWith(
        { hours: 1 },
        'test-macro-id',
        false,
        'client' // Default scope
      );
    });

    it('should use default scope for game timeout', async () => {
      await scheduler.setGameTimeout({ hours: 4 }, 'test-macro-id');

      expect(mockTaskManager.scheduleTask).toHaveBeenCalledWith(
        { hours: 4 },
        'test-macro-id',
        true,
        'client' // Default scope
      );
    });

    it('should use default scope for game interval', async () => {
      await scheduler.setGameInterval({ days: 1 }, 'test-macro-id');

      expect(mockTaskManager.scheduleInterval).toHaveBeenCalledWith(
        { days: 1 },
        'test-macro-id',
        true,
        'client' // Default scope
      );
    });

    it('should use world scope for calendar tasks by default', async () => {
      const calendarDate = { year: 2025, month: 3, day: 21 };
      
      await scheduler.scheduleForDate(calendarDate, 'test-macro-id');

      expect(mockTaskManager.scheduleCalendarTask).toHaveBeenCalledWith(
        calendarDate,
        'test-macro-id',
        'world' // Default scope for calendar tasks
      );
    });

    it('should respect custom scope for calendar tasks', async () => {
      const calendarDate = { year: 2025, month: 3, day: 21 };
      
      await scheduler.scheduleForDate(calendarDate, 'test-macro-id', { scope: 'client' });

      expect(mockTaskManager.scheduleCalendarTask).toHaveBeenCalledWith(
        calendarDate,
        'test-macro-id',
        'client' // Custom scope
      );
    });
  });

  describe('options passing', () => {
    it('should pass all options to scheduler methods', async () => {
      const options = {
        name: 'Complex Task',
        description: 'A complex test task',
        scope: 'world' as const,
        logExecution: true,
        enabled: true
      };

      await scheduler.setTimeout({ minutes: 10 }, 'test-macro-id', options);

      expect(mockTaskManager.scheduleTask).toHaveBeenCalledWith(
        { minutes: 10 },
        'test-macro-id',
        false,
        'world'
      );
    });

    it('should override default names in reminder methods', async () => {
      await scheduler.scheduleReminder(
        { minutes: 5 },
        'Test message',
        { 
          name: 'Custom Reminder Name',
          description: 'Custom description'
        }
      );

      expect(mockMacroManager.createTaskMacro).toHaveBeenCalledWith({
        name: 'Custom Reminder Name',
        code: 'ui.notifications?.info("Reminder: Test message");',
        folder: 'task-and-trigger/reminders',
        moduleId: 'task-and-trigger'
      });
    });
  });

  describe('error handling', () => {
    it('should handle macro creation errors in reminders', async () => {
      mockMacroManager.createTaskMacro.mockRejectedValue(new Error('Macro creation failed'));

      await expect(scheduler.scheduleReminder(
        { minutes: 5 },
        'Test reminder',
        { name: 'Error Test' }
      )).rejects.toThrow('Macro creation failed');
    });

    it('should handle task scheduling errors', async () => {
      mockTaskManager.scheduleTask.mockRejectedValue(new Error('Scheduling failed'));

      await expect(scheduler.setTimeout(
        { minutes: 5 },
        'test-macro-id',
        { name: 'Error Task' }
      )).rejects.toThrow('Scheduling failed');
    });

    it('should handle macro creation errors for recurring reminders', async () => {
      mockMacroManager.createTaskMacro.mockRejectedValue(new Error('Macro creation failed'));

      await expect(scheduler.scheduleRecurringReminder(
        { hours: 1 },
        'Test recurring reminder',
        { name: 'Error Test' }
      )).rejects.toThrow('Macro creation failed');
    });

    it('should handle macro creation errors for game reminders', async () => {
      mockMacroManager.createTaskMacro.mockRejectedValue(new Error('Macro creation failed'));

      await expect(scheduler.scheduleGameReminder(
        { hours: 8 },
        'Test game reminder',
        { name: 'Error Test' }
      )).rejects.toThrow('Macro creation failed');
    });
  });

  describe('macro folder organization', () => {
    it('should create reminders in reminders folder', async () => {
      await scheduler.scheduleReminder({ minutes: 5 }, 'Test', { name: 'Test' });

      expect(mockMacroManager.createTaskMacro).toHaveBeenCalledWith(
        expect.objectContaining({
          folder: 'task-and-trigger/reminders',
          moduleId: 'task-and-trigger'
        })
      );
    });

    it('should create recurring reminders in reminders folder', async () => {
      await scheduler.scheduleRecurringReminder({ hours: 1 }, 'Test', { name: 'Test' });

      expect(mockMacroManager.createTaskMacro).toHaveBeenCalledWith(
        expect.objectContaining({
          folder: 'task-and-trigger/reminders',
          moduleId: 'task-and-trigger'
        })
      );
    });

    it('should create game reminders in reminders folder', async () => {
      await scheduler.scheduleGameReminder({ hours: 8 }, 'Test', { name: 'Test' });

      expect(mockMacroManager.createTaskMacro).toHaveBeenCalledWith(
        expect.objectContaining({
          folder: 'task-and-trigger/reminders',
          moduleId: 'task-and-trigger'
        })
      );
    });
  });

  describe('macro naming consistency', () => {
    it('should use consistent naming for reminders', async () => {
      const message = 'Test message';
      
      await scheduler.scheduleReminder({ minutes: 5 }, message);

      expect(mockMacroManager.createTaskMacro).toHaveBeenCalledWith(
        expect.objectContaining({
          name: `Reminder: ${message}`
        })
      );
    });

    it('should use consistent naming for recurring reminders', async () => {
      const message = 'Recurring message';
      
      await scheduler.scheduleRecurringReminder({ hours: 1 }, message);

      expect(mockMacroManager.createTaskMacro).toHaveBeenCalledWith(
        expect.objectContaining({
          name: `Recurring Reminder: ${message}`
        })
      );
    });

    it('should use consistent naming for game reminders', async () => {
      const message = 'Game time message';
      
      await scheduler.scheduleGameReminder({ hours: 8 }, message);

      expect(mockMacroManager.createTaskMacro).toHaveBeenCalledWith(
        expect.objectContaining({
          name: `Game Reminder: ${message}`
        })
      );
    });

    it('should truncate long messages consistently', async () => {
      const longMessage = 'A'.repeat(100);
      
      await scheduler.scheduleReminder({ minutes: 5 }, longMessage);
      await scheduler.scheduleRecurringReminder({ hours: 1 }, longMessage);
      await scheduler.scheduleGameReminder({ hours: 8 }, longMessage);

      // All should be truncated at 50 characters + ellipsis
      const calls = mockMacroManager.createTaskMacro.mock.calls;
      expect(calls[0][0].name).toBe(`Reminder: ${'A'.repeat(50)}...`);
      expect(calls[1][0].name).toBe(`Recurring Reminder: ${'A'.repeat(40)}...`);
      expect(calls[2][0].name).toBe(`Game Reminder: ${'A'.repeat(45)}...`);
    });
  });

  describe('macro code generation', () => {
    it('should generate correct notification code for reminders', async () => {
      const message = 'Test notification';
      
      await scheduler.scheduleReminder({ minutes: 5 }, message);

      expect(mockMacroManager.createTaskMacro).toHaveBeenCalledWith(
        expect.objectContaining({
          code: `ui.notifications?.info("Reminder: ${message}");`
        })
      );
    });

    it('should generate correct notification code for game reminders', async () => {
      const message = 'Game time notification';
      
      await scheduler.scheduleGameReminder({ hours: 8 }, message);

      expect(mockMacroManager.createTaskMacro).toHaveBeenCalledWith(
        expect.objectContaining({
          code: `ui.notifications?.info("Game Time Reminder: ${message}");`
        })
      );
    });

    it('should handle special characters in notification code', async () => {
      const message = 'Special chars: $, {}, [], \\';
      
      await scheduler.scheduleReminder({ minutes: 5 }, message);

      expect(mockMacroManager.createTaskMacro).toHaveBeenCalledWith(
        expect.objectContaining({
          code: `ui.notifications?.info("Reminder: ${message}");`
        })
      );
    });
  });
});