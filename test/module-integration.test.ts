/**
 * Tests for Module Integration API
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ModuleIntegrationImpl, ModuleTaskOptions } from '../src/module-integration';
import { TaskScheduler } from '../src/task-scheduler';
import { MacroManager } from '../src/macro-manager';
import { AccumulatedTimeManager } from '../src/accumulated-time-manager';
import './setup';

describe('ModuleIntegrationAPI', () => {
  let moduleAPI: ModuleIntegrationImpl;
  let mockScheduler: any;
  let mockMacroManager: any;
  let mockAccumulatedTimeManager: any;

  beforeEach(() => {
    // Clear singleton instances
    (TaskScheduler as any).instance = undefined;
    (MacroManager as any).instance = undefined;
    (AccumulatedTimeManager as any).instance = undefined;

    // Create API instance
    moduleAPI = new ModuleIntegrationImpl();

    // Mock dependencies
    mockScheduler = TaskScheduler.getInstance();
    mockMacroManager = MacroManager.getInstance();
    mockAccumulatedTimeManager = AccumulatedTimeManager.getInstance();

    // Mock scheduler methods
    vi.spyOn(mockScheduler, 'setTimeout').mockResolvedValue('test-task-id');
    vi.spyOn(mockScheduler, 'setInterval').mockResolvedValue('test-recurring-id');
    vi.spyOn(mockScheduler, 'setGameTimeout').mockResolvedValue('test-game-task-id');
    vi.spyOn(mockScheduler, 'setGameInterval').mockResolvedValue('test-game-recurring-id');
    vi.spyOn(mockScheduler, 'scheduleAt').mockResolvedValue('test-scheduled-id');
    vi.spyOn(mockScheduler, 'scheduleForDate').mockResolvedValue('test-calendar-id');
    vi.spyOn(mockScheduler, 'cancel').mockResolvedValue(true);
    vi.spyOn(mockScheduler, 'enable').mockResolvedValue(undefined);
    vi.spyOn(mockScheduler, 'disable').mockResolvedValue(undefined);
    vi.spyOn(mockScheduler, 'getTaskInfo').mockResolvedValue({
      id: 'test-task-id',
      name: 'Test Task',
      enabled: true,
      runCount: 0,
    });
    vi.spyOn(mockScheduler, 'createAccumulatedTimeTask').mockResolvedValue('test-accumulated-id');

    // Mock macro manager methods
    vi.spyOn(mockMacroManager, 'createTaskMacro').mockResolvedValue({
      id: 'test-macro-id',
      name: 'Test Macro',
    });
    vi.spyOn(mockMacroManager, 'createModuleFolder').mockResolvedValue({
      id: 'test-folder-id',
      name: 'test-module',
    });
  });

  describe('module registration', () => {
    it('should register a new module', async () => {
      await moduleAPI.registerModule('test-module', 'Test Module');

      expect(mockMacroManager.createModuleFolder).toHaveBeenCalledWith('test-module');
    });

    it('should not register the same module twice', async () => {
      await moduleAPI.registerModule('test-module', 'Test Module');
      await moduleAPI.registerModule('test-module', 'Test Module');

      expect(mockMacroManager.createModuleFolder).toHaveBeenCalledTimes(1);
    });

    it('should list registered modules', async () => {
      await moduleAPI.registerModule('module1', 'Module One');
      await moduleAPI.registerModule('module2', 'Module Two');

      const modules = moduleAPI.getRegisteredModules();

      expect(modules).toHaveLength(2);
      expect(modules).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            moduleId: 'module1',
            displayName: 'Module One',
            taskCount: 0,
          }),
          expect.objectContaining({
            moduleId: 'module2',
            displayName: 'Module Two',
            taskCount: 0,
          }),
        ])
      );
    });
  });

  describe('task creation', () => {
    beforeEach(async () => {
      await moduleAPI.registerModule('test-module', 'Test Module');
    });

    it('should create a one-time task', async () => {
      const options: ModuleTaskOptions = {
        moduleId: 'test-module',
        taskCode: 'console.log("test");',
        name: 'Test Task',
        description: 'A test task',
      };

      const taskId = await moduleAPI.createOneTimeTask({ minutes: 5 }, options);

      expect(taskId).toBe('test-task-id');
      expect(mockMacroManager.createTaskMacro).toHaveBeenCalledWith({
        name: 'Test Task',
        code: 'console.log("test");',
        folder: 'task-and-trigger/test-module',
        moduleId: 'test-module',
      });
      expect(mockScheduler.setTimeout).toHaveBeenCalledWith(
        { minutes: 5 },
        'test-macro-id',
        expect.objectContaining({
          name: 'Test Task',
          description: 'A test task',
        })
      );
    });

    it('should create a recurring task', async () => {
      const options: ModuleTaskOptions = {
        moduleId: 'test-module',
        taskCode: 'ui.notifications.info("recurring");',
        name: 'Recurring Task',
      };

      const taskId = await moduleAPI.createRecurringTask({ hours: 1 }, options);

      expect(taskId).toBe('test-recurring-id');
      expect(mockScheduler.setInterval).toHaveBeenCalledWith(
        { hours: 1 },
        'test-macro-id',
        expect.objectContaining({
          name: 'Recurring Task',
        })
      );
    });

    it('should create a scheduled task', async () => {
      const futureDate = new Date('2025-12-25T09:00:00');
      const options: ModuleTaskOptions = {
        moduleId: 'test-module',
        taskCode: 'ui.notifications.info("Happy Holidays!");',
        name: 'Holiday Task',
      };

      const taskId = await moduleAPI.createScheduledTask(futureDate, options);

      expect(taskId).toBe('test-scheduled-id');
      expect(mockScheduler.scheduleAt).toHaveBeenCalledWith(
        futureDate,
        'test-macro-id',
        expect.objectContaining({
          name: 'Holiday Task',
        })
      );
    });

    it('should create a calendar task', async () => {
      const calendarDate = { year: 2025, month: 6, day: 15 };
      const options: ModuleTaskOptions = {
        moduleId: 'test-module',
        taskCode: 'console.log("calendar event");',
        name: 'Calendar Task',
      };

      const taskId = await moduleAPI.createCalendarTask(calendarDate, options);

      expect(taskId).toBe('test-calendar-id');
      expect(mockScheduler.scheduleForDate).toHaveBeenCalledWith(
        calendarDate,
        'test-macro-id',
        expect.objectContaining({
          name: 'Calendar Task',
        })
      );
    });

    it('should create a game time task', async () => {
      const options: ModuleTaskOptions = {
        moduleId: 'test-module',
        taskCode: 'ui.notifications.info("Rest complete!");',
        name: 'Rest Task',
      };

      const taskId = await moduleAPI.createGameTimeTask({ hours: 8 }, options);

      expect(taskId).toBe('test-game-task-id');
      expect(mockScheduler.setGameTimeout).toHaveBeenCalledWith(
        { hours: 8 },
        'test-macro-id',
        expect.objectContaining({
          name: 'Rest Task',
        })
      );
    });

    it('should create a recurring game time task', async () => {
      const options: ModuleTaskOptions = {
        moduleId: 'test-module',
        taskCode: 'console.log("daily check");',
        name: 'Daily Check',
      };

      const taskId = await moduleAPI.createGameTimeRecurring({ days: 1 }, options);

      expect(taskId).toBe('test-game-recurring-id');
      expect(mockScheduler.setGameInterval).toHaveBeenCalledWith(
        { days: 1 },
        'test-macro-id',
        expect.objectContaining({
          name: 'Daily Check',
        })
      );
    });

    it('should track tasks for modules', async () => {
      const options: ModuleTaskOptions = {
        moduleId: 'test-module',
        taskCode: 'console.log("test");',
        name: 'Test Task',
      };

      await moduleAPI.createOneTimeTask({ minutes: 5 }, options);

      const modules = moduleAPI.getRegisteredModules();
      const testModule = modules.find(m => m.moduleId === 'test-module');
      expect(testModule?.taskCount).toBe(1);
    });
  });

  describe('convenience methods', () => {
    beforeEach(async () => {
      await moduleAPI.registerModule('test-module', 'Test Module');
    });

    it('should create notification task', async () => {
      const taskId = await moduleAPI.createNotificationTask({ minutes: 15 }, 'Take a break!', {
        moduleId: 'test-module',
        name: 'Break Reminder',
      });

      expect(taskId).toBe('test-task-id');
      expect(mockMacroManager.createTaskMacro).toHaveBeenCalledWith({
        name: 'Break Reminder',
        code: 'ui.notifications?.info("Take a break!");',
        folder: 'task-and-trigger/test-module',
        moduleId: 'test-module',
      });
    });

    it('should create chat task', async () => {
      const taskId = await moduleAPI.createChatTask({ seconds: 30 }, 'Combat started!', {
        moduleId: 'test-module',
        name: 'Combat Alert',
      });

      expect(taskId).toBe('test-task-id');
      expect(mockMacroManager.createTaskMacro).toHaveBeenCalledWith({
        name: 'Combat Alert',
        code: 'ChatMessage.create({ content: "Combat started!", whisper: [] });',
        folder: 'task-and-trigger/test-module',
        moduleId: 'test-module',
      });
    });

    it('should escape quotes in notification messages', async () => {
      await moduleAPI.createNotificationTask({ minutes: 5 }, 'Don\'t forget "important" task', {
        moduleId: 'test-module',
        name: 'Reminder',
      });

      expect(mockMacroManager.createTaskMacro).toHaveBeenCalledWith({
        name: 'Reminder',
        code: 'ui.notifications?.info("Don\'t forget \\"important\\" task");',
        folder: 'task-and-trigger/test-module',
        moduleId: 'test-module',
      });
    });

    it('should escape quotes in chat messages', async () => {
      await moduleAPI.createChatTask({ seconds: 10 }, 'Player says "Hello world!"', {
        moduleId: 'test-module',
        name: 'Chat Test',
      });

      expect(mockMacroManager.createTaskMacro).toHaveBeenCalledWith({
        name: 'Chat Test',
        code: 'ChatMessage.create({ content: "Player says \\"Hello world!\\"", whisper: [] });',
        folder: 'task-and-trigger/test-module',
        moduleId: 'test-module',
      });
    });
  });

  describe('task management', () => {
    beforeEach(async () => {
      await moduleAPI.registerModule('test-module', 'Test Module');

      // Create a test task
      await moduleAPI.createOneTimeTask(
        { minutes: 5 },
        {
          moduleId: 'test-module',
          taskCode: 'console.log("test");',
          name: 'Test Task',
        }
      );
    });

    it('should cancel tasks', async () => {
      const success = await moduleAPI.cancelTask('test-task-id');

      expect(success).toBe(true);
      expect(mockScheduler.cancel).toHaveBeenCalledWith('test-task-id');
    });

    it('should enable tasks', async () => {
      await moduleAPI.enableTask('test-task-id');

      expect(mockScheduler.enable).toHaveBeenCalledWith('test-task-id');
    });

    it('should disable tasks', async () => {
      await moduleAPI.disableTask('test-task-id');

      expect(mockScheduler.disable).toHaveBeenCalledWith('test-task-id');
    });

    it('should remove cancelled tasks from module tracking', async () => {
      // Verify task is tracked
      let modules = moduleAPI.getRegisteredModules();
      let testModule = modules.find(m => m.moduleId === 'test-module');
      expect(testModule?.taskCount).toBe(1);

      // Cancel the task
      await moduleAPI.cancelTask('test-task-id');

      // Verify task is no longer tracked
      modules = moduleAPI.getRegisteredModules();
      testModule = modules.find(m => m.moduleId === 'test-module');
      expect(testModule?.taskCount).toBe(0);
    });
  });

  describe('accumulated time tasks', () => {
    beforeEach(async () => {
      await moduleAPI.registerModule('test-module', 'Test Module');
    });

    it('should create accumulated time task', async () => {
      const options = {
        moduleId: 'test-module',
        name: 'Research Task',
        description: 'Research a spell',
        requiredTime: { hours: 10 },
        macroId: 'research-macro-id',
      };

      const taskId = await moduleAPI.createAccumulatedTimeTask(options);

      expect(taskId).toBe('test-accumulated-id');
      expect(mockScheduler.createAccumulatedTimeTask).toHaveBeenCalledWith(options);
    });

    it('should track accumulated time tasks', async () => {
      const options = {
        moduleId: 'test-module',
        name: 'Research Task',
        requiredTime: { hours: 10 },
        macroId: 'research-macro-id',
      };

      await moduleAPI.createAccumulatedTimeTask(options);

      const modules = moduleAPI.getRegisteredModules();
      const testModule = modules.find(m => m.moduleId === 'test-module');
      expect(testModule?.taskCount).toBe(1);
    });
  });

  describe('module cleanup', () => {
    beforeEach(async () => {
      await moduleAPI.registerModule('test-module', 'Test Module');

      // Create multiple tasks
      await moduleAPI.createOneTimeTask(
        { minutes: 5 },
        {
          moduleId: 'test-module',
          taskCode: 'console.log("task1");',
          name: 'Task 1',
        }
      );
      await moduleAPI.createRecurringTask(
        { hours: 1 },
        {
          moduleId: 'test-module',
          taskCode: 'console.log("task2");',
          name: 'Task 2',
        }
      );
    });

    it('should cleanup module tasks', async () => {
      const cleanedCount = await moduleAPI.cleanupModuleTasks('test-module');

      expect(cleanedCount).toBe(2);
      expect(mockScheduler.cancel).toHaveBeenCalledTimes(2);
    });

    it('should unregister module and cleanup tasks', async () => {
      await moduleAPI.unregisterModule('test-module');

      expect(mockScheduler.cancel).toHaveBeenCalledTimes(2);

      const modules = moduleAPI.getRegisteredModules();
      const testModule = modules.find(m => m.moduleId === 'test-module');
      expect(testModule).toBeUndefined();
    });

    it('should handle cleanup errors gracefully', async () => {
      mockScheduler.cancel.mockRejectedValueOnce(new Error('Cancel failed'));

      const cleanedCount = await moduleAPI.cleanupModuleTasks('test-module');

      // Should still report tasks that were successfully cancelled
      expect(cleanedCount).toBe(1);
    });

    it('should return 0 for non-existent module cleanup', async () => {
      const cleanedCount = await moduleAPI.cleanupModuleTasks('non-existent-module');

      expect(cleanedCount).toBe(0);
    });
  });

  describe('module statistics', () => {
    beforeEach(async () => {
      await moduleAPI.registerModule('test-module', 'Test Module');
    });

    it('should get module task statistics', async () => {
      // Create some tasks
      await moduleAPI.createOneTimeTask(
        { minutes: 5 },
        {
          moduleId: 'test-module',
          taskCode: 'console.log("active");',
          name: 'Active Task',
        }
      );

      mockScheduler.getTaskInfo.mockResolvedValueOnce({
        id: 'test-task-id',
        name: 'Active Task',
        enabled: true,
      });

      const stats = await moduleAPI.getModuleTaskStats('test-module');

      expect(stats).toEqual({
        totalTasks: 1,
        activeTasks: 1,
        completedTasks: 0,
      });
    });

    it('should return null for non-existent module', async () => {
      const stats = await moduleAPI.getModuleTaskStats('non-existent-module');

      expect(stats).toBeNull();
    });

    it('should handle disabled tasks in statistics', async () => {
      await moduleAPI.createOneTimeTask(
        { minutes: 5 },
        {
          moduleId: 'test-module',
          taskCode: 'console.log("disabled");',
          name: 'Disabled Task',
        }
      );

      mockScheduler.getTaskInfo.mockResolvedValueOnce({
        id: 'test-task-id',
        name: 'Disabled Task',
        enabled: false,
      });

      const stats = await moduleAPI.getModuleTaskStats('test-module');

      expect(stats).toEqual({
        totalTasks: 1,
        activeTasks: 0,
        completedTasks: 1,
      });
    });
  });

  describe('unregistered module handling', () => {
    it('should handle tasks from unregistered modules', async () => {
      const options: ModuleTaskOptions = {
        moduleId: 'unregistered-module',
        taskCode: 'console.log("test");',
        name: 'Test Task',
      };

      const taskId = await moduleAPI.createOneTimeTask({ minutes: 5 }, options);

      expect(taskId).toBe('test-task-id');
      expect(mockMacroManager.createTaskMacro).toHaveBeenCalledWith({
        name: 'Test Task',
        code: 'console.log("test");',
        folder: 'task-and-trigger/external',
        moduleId: 'unregistered-module',
      });
    });

    it('should not track tasks from unregistered modules', async () => {
      const options: ModuleTaskOptions = {
        moduleId: 'unregistered-module',
        taskCode: 'console.log("test");',
        name: 'Test Task',
      };

      await moduleAPI.createOneTimeTask({ minutes: 5 }, options);

      const modules = moduleAPI.getRegisteredModules();
      expect(modules).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await moduleAPI.registerModule('test-module', 'Test Module');
    });

    it('should handle macro creation errors', async () => {
      mockMacroManager.createTaskMacro.mockRejectedValue(new Error('Macro creation failed'));

      const options: ModuleTaskOptions = {
        moduleId: 'test-module',
        taskCode: 'console.log("test");',
        name: 'Error Task',
      };

      await expect(moduleAPI.createOneTimeTask({ minutes: 5 }, options)).rejects.toThrow(
        'Macro creation failed'
      );
    });

    it('should handle scheduler errors', async () => {
      mockScheduler.setTimeout.mockRejectedValue(new Error('Scheduling failed'));

      const options: ModuleTaskOptions = {
        moduleId: 'test-module',
        taskCode: 'console.log("test");',
        name: 'Error Task',
      };

      await expect(moduleAPI.createOneTimeTask({ minutes: 5 }, options)).rejects.toThrow(
        'Scheduling failed'
      );
    });

    it('should handle folder creation errors', async () => {
      mockMacroManager.createModuleFolder.mockRejectedValue(new Error('Folder creation failed'));

      // Should propagate the folder creation error
      await expect(moduleAPI.registerModule('error-module', 'Error Module')).rejects.toThrow(
        'Folder creation failed'
      );
    });
  });
});
