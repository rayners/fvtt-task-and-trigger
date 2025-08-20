/**
 * Test file for GM-only task creation restrictions
 * Following TDD Red-Green-Refactor pattern
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TDDTestHelper } from './setup-tdd';
import { TaskTriggerAPIImpl } from '../src/api';

describe('GM Permission Checks', () => {
  let api: TaskTriggerAPIImpl;

  beforeEach(async () => {
    // Clear all mocks and singletons
    vi.clearAllMocks();
    TDDTestHelper.clearSingletonInstances();
    
    // Setup clean API instance
    api = new TaskTriggerAPIImpl();
  });

  describe('setTimeout() GM restrictions', () => {
    it('should allow GM to create scheduled tasks', async () => {
      // Arrange
      TDDTestHelper.setupGameUserMock(TDDTestHelper.createMockGM());

      // Act & Assert - This should succeed
      const taskId = await api.setTimeout({ minutes: 5 }, 'test-macro');
      
      expect(taskId).toBeDefined();
      expect(typeof taskId).toBe('string');
    });

    it('should throw error when player tries to create scheduled tasks', async () => {
      // Arrange
      TDDTestHelper.setupGameUserMock(TDDTestHelper.createMockPlayer('player1'));

      // Act & Assert - This should fail with permission error
      await expect(api.setTimeout({ minutes: 5 }, 'test-macro')).rejects.toThrow(
        'Only GMs can create scheduled tasks'
      );
    });

    it('should throw error with descriptive message for players', async () => {
      // Arrange
      TDDTestHelper.setupGameUserMock(TDDTestHelper.createMockPlayer('player1'));

      // Act & Assert
      await expect(api.setTimeout({ minutes: 5 }, 'test-macro')).rejects.toThrow(
        /Only GMs can create/
      );
    });
  });

  describe('setInterval() GM restrictions', () => {
    it('should allow GM to create recurring tasks', async () => {
      // Arrange
      TDDTestHelper.setupGameUserMock(TDDTestHelper.createMockGM());

      // Act & Assert
      const taskId = await api.setInterval({ minutes: 10 }, 'test-macro');
      
      expect(taskId).toBeDefined();
      expect(typeof taskId).toBe('string');
    });

    it('should throw error when player tries to create recurring tasks', async () => {
      // Arrange
      TDDTestHelper.setupGameUserMock(TDDTestHelper.createMockPlayer('player1'));

      // Act & Assert
      await expect(api.setInterval({ minutes: 10 }, 'test-macro')).rejects.toThrow(
        'Only GMs can create scheduled tasks'
      );
    });
  });

  describe('setGameTimeout() GM restrictions', () => {
    it('should allow GM to create game time tasks', async () => {
      // Arrange
      TDDTestHelper.setupGameUserMock(TDDTestHelper.createMockGM());

      // Act & Assert
      const taskId = await api.setGameTimeout({ hours: 1 }, 'test-macro');
      
      expect(taskId).toBeDefined();
      expect(typeof taskId).toBe('string');
    });

    it('should throw error when player tries to create game time tasks', async () => {
      // Arrange
      TDDTestHelper.setupGameUserMock(TDDTestHelper.createMockPlayer('player1'));

      // Act & Assert
      await expect(api.setGameTimeout({ hours: 1 }, 'test-macro')).rejects.toThrow(
        'Only GMs can create scheduled tasks'
      );
    });
  });

  describe('setGameInterval() GM restrictions', () => {
    it('should allow GM to create recurring game time tasks', async () => {
      // Arrange
      TDDTestHelper.setupGameUserMock(TDDTestHelper.createMockGM());

      // Act & Assert
      const taskId = await api.setGameInterval({ hours: 2 }, 'test-macro');
      
      expect(taskId).toBeDefined();
      expect(typeof taskId).toBe('string');
    });

    it('should throw error when player tries to create recurring game time tasks', async () => {
      // Arrange
      TDDTestHelper.setupGameUserMock(TDDTestHelper.createMockPlayer('player1'));

      // Act & Assert
      await expect(api.setGameInterval({ hours: 2 }, 'test-macro')).rejects.toThrow(
        'Only GMs can create scheduled tasks'
      );
    });
  });

  describe('scheduleAt() GM restrictions', () => {
    it('should allow GM to schedule tasks at specific dates', async () => {
      // Arrange
      TDDTestHelper.setupGameUserMock(TDDTestHelper.createMockGM());
      const futureDate = new Date(Date.now() + 86400000); // 24 hours from now

      // Act & Assert
      const taskId = await api.scheduleAt(futureDate, 'test-macro');
      
      expect(taskId).toBeDefined();
      expect(typeof taskId).toBe('string');
    });

    it('should throw error when player tries to schedule at specific dates', async () => {
      // Arrange
      TDDTestHelper.setupGameUserMock(TDDTestHelper.createMockPlayer('player1'));
      const futureDate = new Date(Date.now() + 86400000);

      // Act & Assert
      await expect(api.scheduleAt(futureDate, 'test-macro')).rejects.toThrow(
        'Only GMs can create scheduled tasks'
      );
    });
  });

  describe('scheduleForDate() GM restrictions', () => {
    it('should allow GM to schedule tasks for calendar dates', async () => {
      // Arrange
      TDDTestHelper.setupGameUserMock(TDDTestHelper.createMockGM());
      const calendarDate = { year: 2024, month: 12, day: 25 };

      // Act & Assert
      const taskId = await api.scheduleForDate(calendarDate, 'test-macro');
      
      expect(taskId).toBeDefined();
      expect(typeof taskId).toBe('string');
    });

    it('should throw error when player tries to schedule for calendar dates', async () => {
      // Arrange
      TDDTestHelper.setupGameUserMock(TDDTestHelper.createMockPlayer('player1'));
      const calendarDate = { year: 2024, month: 12, day: 25 };

      // Act & Assert
      await expect(api.scheduleForDate(calendarDate, 'test-macro')).rejects.toThrow(
        'Only GMs can create scheduled tasks'
      );
    });
  });

  describe('scheduleReminder() GM restrictions', () => {
    it('should allow GM to create reminders', async () => {
      // Arrange
      TDDTestHelper.setupGameUserMock(TDDTestHelper.createMockGM());

      // Act & Assert
      const taskId = await api.scheduleReminder({ minutes: 30 }, 'Test reminder message');
      
      expect(taskId).toBeDefined();
      expect(typeof taskId).toBe('string');
    });

    it('should throw error when player tries to create reminders', async () => {
      // Arrange
      TDDTestHelper.setupGameUserMock(TDDTestHelper.createMockPlayer('player1'));

      // Act & Assert
      await expect(api.scheduleReminder({ minutes: 30 }, 'Test reminder')).rejects.toThrow(
        'Only GMs can create scheduled tasks'
      );
    });
  });

  describe('scheduleRecurringReminder() GM restrictions', () => {
    it('should allow GM to create recurring reminders', async () => {
      // Arrange
      TDDTestHelper.setupGameUserMock(TDDTestHelper.createMockGM());

      // Act & Assert
      const taskId = await api.scheduleRecurringReminder({ hours: 1 }, 'Hourly reminder');
      
      expect(taskId).toBeDefined();
      expect(typeof taskId).toBe('string');
    });

    it('should throw error when player tries to create recurring reminders', async () => {
      // Arrange
      TDDTestHelper.setupGameUserMock(TDDTestHelper.createMockPlayer('player1'));

      // Act & Assert
      await expect(api.scheduleRecurringReminder({ hours: 1 }, 'Hourly reminder')).rejects.toThrow(
        'Only GMs can create scheduled tasks'
      );
    });
  });

  describe('scheduleGameReminder() GM restrictions', () => {
    it('should allow GM to create game time reminders', async () => {
      // Arrange
      TDDTestHelper.setupGameUserMock(TDDTestHelper.createMockGM());

      // Act & Assert
      const taskId = await api.scheduleGameReminder({ hours: 1 }, 'Game time reminder');
      
      expect(taskId).toBeDefined();
      expect(typeof taskId).toBe('string');
    });

    it('should throw error when player tries to create game time reminders', async () => {
      // Arrange
      TDDTestHelper.setupGameUserMock(TDDTestHelper.createMockPlayer('player1'));

      // Act & Assert
      await expect(api.scheduleGameReminder({ hours: 1 }, 'Game time reminder')).rejects.toThrow(
        'Only GMs can create scheduled tasks'
      );
    });
  });

  describe('createAccumulatedTimeTask() GM restrictions', () => {
    it('should allow GM to create accumulated time tasks', async () => {
      // Arrange
      TDDTestHelper.setupGameUserMock(TDDTestHelper.createMockGM());
      const options = {
        name: 'Test Accumulated Task',
        description: 'A test task',
        requiredTime: { hours: 8 },
        macroId: 'test-macro',
        scope: 'world' as const,
      };

      // Act & Assert
      const taskId = await api.createAccumulatedTimeTask(options);
      
      expect(taskId).toBeDefined();
      expect(typeof taskId).toBe('string');
    });

    it('should throw error when player tries to create accumulated time tasks', async () => {
      // Arrange
      TDDTestHelper.setupGameUserMock(TDDTestHelper.createMockPlayer('player1'));
      const options = {
        name: 'Test Accumulated Task',
        description: 'A test task',
        requiredTime: { hours: 8 },
        macroId: 'test-macro',
        scope: 'world' as const,
      };

      // Act & Assert
      await expect(api.createAccumulatedTimeTask(options)).rejects.toThrow(
        'Only GMs can create scheduled tasks'
      );
    });
  });

  describe('Permission validation helper', () => {
    it('should have consistent error message across all methods', async () => {
      // Arrange
      TDDTestHelper.setupGameUserMock(TDDTestHelper.createMockPlayer('player1'));
      const expectedMessage = 'Only GMs can create scheduled tasks';

      // Act & Assert - Test multiple methods for consistent messaging
      await expect(api.setTimeout({ minutes: 5 }, 'macro')).rejects.toThrow(expectedMessage);
      await expect(api.setInterval({ minutes: 5 }, 'macro')).rejects.toThrow(expectedMessage);
      await expect(api.setGameTimeout({ minutes: 5 }, 'macro')).rejects.toThrow(expectedMessage);
      await expect(api.scheduleReminder({ minutes: 5 }, 'message')).rejects.toThrow(expectedMessage);
    });

    it('should check permission before any other validation', async () => {
      // Arrange
      TDDTestHelper.setupGameUserMock(TDDTestHelper.createMockPlayer('player1'));

      // Act & Assert - Should fail with permission error, not validation error
      // Even with invalid parameters, permission check should happen first
      await expect(api.setTimeout(null as any, '')).rejects.toThrow(
        'Only GMs can create scheduled tasks'
      );
    });
  });
});