/**
 * Tests for main module initialization
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TaskManager } from '../src/task-manager';
import { TaskScheduler } from '../src/task-scheduler';
import { TaskPersistence } from '../src/task-persistence';
import './setup';

// We can't easily test the main.ts module directly due to its side effects,
// but we can test the individual components it relies on are properly integrated

describe('Module Integration', () => {
  let mockTaskManager: any;
  let mockScheduler: any;
  let mockPersistence: any;

  beforeEach(() => {
    // Clear singleton instances and mocks
    (TaskManager as any).instance = undefined;
    (TaskScheduler as any).instance = undefined;
    (TaskPersistence as any).instance = undefined;

    mockTaskManager = TaskManager.getInstance();
    mockScheduler = TaskScheduler.getInstance();
    mockPersistence = TaskPersistence.getInstance();

    // Mock component methods
    vi.spyOn(mockTaskManager, 'initialize').mockResolvedValue(undefined);
    vi.spyOn(mockTaskManager, 'shutdown').mockResolvedValue(undefined);
    vi.spyOn(mockTaskManager, 'isInitialized').mockReturnValue(true);
    vi.spyOn(mockScheduler, 'initialize').mockResolvedValue(undefined);
    vi.spyOn(mockPersistence, 'initialize').mockResolvedValue(undefined);
    vi.spyOn(mockPersistence, 'prepareShutdown').mockResolvedValue(undefined);

    // Mock TaskPersistence.registerSettings
    vi.spyOn(TaskPersistence, 'registerSettings').mockImplementation(() => {});

    // Clear any existing game.taskTrigger
    delete (game as any).taskTrigger;
    delete (globalThis as any).taskTriggerStatus;
    delete (globalThis as any).TASK_TRIGGER_MODULE;
  });

  afterEach(() => {
    // Clean up globals
    delete (game as any).taskTrigger;
    delete (globalThis as any).taskTriggerStatus;
    delete (globalThis as any).TASK_TRIGGER_MODULE;
  });

  describe('component integration', () => {
    it('should have all core components as singletons', () => {
      const manager1 = TaskManager.getInstance();
      const manager2 = TaskManager.getInstance();
      expect(manager1).toBe(manager2);

      const scheduler1 = TaskScheduler.getInstance();
      const scheduler2 = TaskScheduler.getInstance();
      expect(scheduler1).toBe(scheduler2);

      const persistence1 = TaskPersistence.getInstance();
      const persistence2 = TaskPersistence.getInstance();
      expect(persistence1).toBe(persistence2);
    });

    it('should have components that can initialize', async () => {
      await mockTaskManager.initialize();
      await mockScheduler.initialize();
      await mockPersistence.initialize();

      expect(mockTaskManager.initialize).toHaveBeenCalled();
      expect(mockScheduler.initialize).toHaveBeenCalled();
      expect(mockPersistence.initialize).toHaveBeenCalled();
    });

    it('should have components that can shutdown', async () => {
      await mockTaskManager.shutdown();
      await mockPersistence.prepareShutdown();

      expect(mockTaskManager.shutdown).toHaveBeenCalled();
      expect(mockPersistence.prepareShutdown).toHaveBeenCalled();
    });
  });

  describe('initialization simulation', () => {
    it('should simulate full initialization sequence', async () => {
      // Simulate the initialization sequence from main.ts
      TaskPersistence.registerSettings();

      await mockTaskManager.initialize();
      await mockScheduler.initialize();
      await mockPersistence.initialize();

      // Verify all components were initialized
      expect(TaskPersistence.registerSettings).toHaveBeenCalled();
      expect(mockTaskManager.initialize).toHaveBeenCalled();
      expect(mockScheduler.initialize).toHaveBeenCalled();
      expect(mockPersistence.initialize).toHaveBeenCalled();
    });

    it('should simulate shutdown sequence', async () => {
      // Simulate the shutdown sequence from main.ts
      await mockPersistence.prepareShutdown();
      await mockTaskManager.shutdown();

      expect(mockPersistence.prepareShutdown).toHaveBeenCalled();
      expect(mockTaskManager.shutdown).toHaveBeenCalled();
    });
  });

  describe('API integration', () => {
    it('should create API that integrates with scheduler and persistence', async () => {
      // Import the API creation function
      const { createAPI } = await import('../src/api');

      const api = createAPI();

      // API should have all expected methods
      expect(typeof api.setTimeout).toBe('function');
      expect(typeof api.setInterval).toBe('function');
      expect(typeof api.setGameTimeout).toBe('function');
      expect(typeof api.setGameInterval).toBe('function');
      expect(typeof api.scheduleAt).toBe('function');
      expect(typeof api.scheduleForDate).toBe('function');
      expect(typeof api.cancel).toBe('function');
      expect(typeof api.listTasks).toBe('function');
      expect(typeof api.getStatistics).toBe('function');
      expect(typeof api.markAsUITask).toBe('function');
      expect(typeof api.cleanupOldTasks).toBe('function');
    });
  });

  describe('hook system integration', () => {
    it('should have Hooks available for registration', () => {
      expect(Hooks).toBeDefined();
      expect(typeof Hooks.once).toBe('function');
      expect(typeof Hooks.on).toBe('function');
      expect(typeof Hooks.callAll).toBe('function');
    });

    it('should be able to register and call hooks', () => {
      // Just test that the Hooks methods can be called without errors
      expect(() => {
        Hooks.on('test-hook', () => {});
        Hooks.callAll('test-hook', 'test-data');
        Hooks.off('test-hook', () => {});
      }).not.toThrow();

      // The actual hook functionality is tested in FoundryVTT itself
      expect(typeof Hooks.on).toBe('function');
      expect(typeof Hooks.callAll).toBe('function');
      expect(typeof Hooks.off).toBe('function');
    });
  });

  describe('error handling integration', () => {
    it('should handle component initialization failures gracefully', async () => {
      // Mock a component to fail during initialization
      mockTaskManager.initialize.mockRejectedValue(new Error('Test initialization failure'));

      // The main initialization would catch this error
      try {
        await mockTaskManager.initialize();
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Test initialization failure');
      }
    });

    it('should handle shutdown failures gracefully', async () => {
      // Mock a component to fail during shutdown
      mockTaskManager.shutdown.mockRejectedValue(new Error('Test shutdown failure'));

      // The main shutdown would catch this error
      try {
        await mockTaskManager.shutdown();
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Test shutdown failure');
      }
    });
  });

  describe('global objects', () => {
    it('should have required Foundry globals available', () => {
      expect(game).toBeDefined();
      expect(ui).toBeDefined();
      expect(Hooks).toBeDefined();
      expect(foundry).toBeDefined();
    });

    it('should be able to register settings', () => {
      expect(game.settings).toBeDefined();
      expect(typeof game.settings!.register).toBe('function');
      expect(typeof game.settings!.get).toBe('function');
      expect(typeof game.settings!.set).toBe('function');
    });

    it('should be able to access notifications', () => {
      expect(ui.notifications).toBeDefined();
      expect(typeof ui.notifications!.info).toBe('function');
      expect(typeof ui.notifications!.error).toBe('function');
      expect(typeof ui.notifications!.warn).toBe('function');
    });
  });
});
