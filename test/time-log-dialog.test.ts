/**
 * Test file for TimeLogDialog UI Component
 * Following TDD Red-Green-Refactor pattern for Phase 3
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TDDTestHelper } from './setup-tdd';
import { TimeLogDialog } from '../src/applications/time-log-dialog';

describe('TimeLogDialog', () => {
  let dialog: any;
  let mockCallback: any;

  beforeEach(async () => {
    // Clear all mocks and singletons
    vi.clearAllMocks();
    TDDTestHelper.clearSingletonInstances();

    // Setup game API mock
    TDDTestHelper.setupGameUserMock(TDDTestHelper.createMockPlayer('player1'));
    
    (global as any).game = {
      ...(global as any).game,
      taskTrigger: {
        api: {
          getTaskInfo: vi.fn(),
        },
      },
    };

    (global as any).ui = {
      notifications: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    };

    mockCallback = vi.fn();
  });

  describe('Dialog Configuration', () => {
    it('should have correct default options', async () => {
      // Act
      dialog = new TimeLogDialog('test-task-1', { submitCallback: mockCallback });
      
      // Assert
      expect(TimeLogDialog.defaultOptions).toBeDefined();
      expect(TimeLogDialog.defaultOptions.id).toBe('time-log-dialog');
      expect(TimeLogDialog.defaultOptions.title).toBe('Log Time');
      expect(TimeLogDialog.defaultOptions.template).toContain('time-log-dialog.hbs');
      expect(TimeLogDialog.defaultOptions.width).toBe(400);
      expect(TimeLogDialog.defaultOptions.height).toBe(300);
      expect(TimeLogDialog.defaultOptions.modal).toBe(true);
    });

    it('should be constructible with task ID and callback', async () => {
      // Act & Assert
      expect(() => {
        dialog = new TimeLogDialog('test-task-1', { submitCallback: mockCallback });
      }).not.toThrow();
      
      expect(dialog).toBeDefined();
      expect(dialog.taskId).toBe('test-task-1');
      expect(dialog.submitCallback).toBe(mockCallback);
    });
  });

  describe('Data Preparation', () => {
    beforeEach(async () => {
      dialog = new TimeLogDialog('test-task-1', { submitCallback: mockCallback });
    });

    it('should fetch task information for display', async () => {
      // Arrange
      const mockTaskInfo = {
        id: 'test-task-1',
        name: 'Test Task',
        description: 'A test task for time logging',
      };

      vi.mocked(game.taskTrigger.api.getTaskInfo).mockResolvedValue(mockTaskInfo);

      // Act
      const data = await dialog.getData();

      // Assert
      expect(game.taskTrigger.api.getTaskInfo).toHaveBeenCalledWith('test-task-1');
      expect(data.task).toEqual(mockTaskInfo);
      expect(data.defaultDuration).toBe(60); // Default 1 hour in minutes
      expect(data.currentUser).toBe('Player player1');
    });

    it('should handle missing task gracefully', async () => {
      // Arrange
      vi.mocked(game.taskTrigger.api.getTaskInfo).mockResolvedValue(null);

      // Act
      const data = await dialog.getData();

      // Assert
      expect(data.task).toBeNull();
      expect(data.defaultDuration).toBe(60);
      expect(data.currentUser).toBe('Player player1');
    });

    it('should provide preset duration options', async () => {
      // Arrange
      vi.mocked(game.taskTrigger.api.getTaskInfo).mockResolvedValue({
        id: 'test-task-1',
        name: 'Test Task',
      });

      // Act
      const data = await dialog.getData();

      // Assert
      expect(data.presetDurations).toBeDefined();
      expect(data.presetDurations.length).toBeGreaterThan(0);
      
      // Check that specific durations exist
      const durationValues = data.presetDurations.map(d => d.value);
      expect(durationValues).toContain(30);
      expect(durationValues).toContain(60);
      expect(durationValues).toContain(120);
      expect(durationValues).toContain(240);
    });
  });

  describe('Form Validation', () => {
    beforeEach(async () => {
      dialog = new TimeLogDialog('test-task-1', { submitCallback: mockCallback });
    });

    it('should validate required duration field', async () => {
      // Arrange
      const formData = {
        duration: '',
        description: 'Test work',
      };

      // Act
      const isValid = dialog.validateForm(formData);

      // Assert
      expect(isValid).toBe(false);
    });

    it('should validate positive duration values', async () => {
      // Arrange
      const formData = {
        duration: '-30',
        description: 'Test work',
      };

      // Act
      const isValid = dialog.validateForm(formData);

      // Assert
      expect(isValid).toBe(false);
    });

    it('should accept valid form data', async () => {
      // Arrange
      const formData = {
        duration: '60',
        description: 'Worked on character development',
      };

      // Act
      const isValid = dialog.validateForm(formData);

      // Assert
      expect(isValid).toBe(true);
    });

    it('should allow empty description', async () => {
      // Arrange
      const formData = {
        duration: '30',
        description: '',
      };

      // Act
      const isValid = dialog.validateForm(formData);

      // Assert
      expect(isValid).toBe(true);
    });
  });

  describe('Form Submission', () => {
    beforeEach(async () => {
      dialog = new TimeLogDialog('test-task-1', { submitCallback: mockCallback });
    });

    it('should call callback with time entry data on valid submission', async () => {
      // Arrange
      const formData = {
        duration: '90',
        description: 'Research session',
      };

      // Act
      await dialog.onSubmit(formData);

      // Assert
      expect(mockCallback).toHaveBeenCalledWith('test-task-1', {
        duration: { minutes: 90 },
        description: 'Research session',
      });
    });

    it('should convert duration to TimeSpec format', async () => {
      // Arrange
      const formData = {
        duration: '150', // 2.5 hours
        description: 'Long work session',
      };

      // Act
      await dialog.onSubmit(formData);

      // Assert
      expect(mockCallback).toHaveBeenCalledWith('test-task-1', {
        duration: { minutes: 150 },
        description: 'Long work session',
      });
    });

    it('should close dialog after successful submission', async () => {
      // Arrange
      const closeSpy = vi.spyOn(dialog, 'close');
      const formData = {
        duration: '60',
        description: 'Test work',
      };

      // Act
      await dialog.onSubmit(formData);

      // Assert
      expect(closeSpy).toHaveBeenCalled();
    });

    it('should handle submission errors gracefully', async () => {
      // Arrange
      mockCallback.mockRejectedValue(new Error('Network error'));
      const formData = {
        duration: '60',
        description: 'Test work',
      };

      // Act
      await dialog.onSubmit(formData);

      // Assert
      expect(ui.notifications.error).toHaveBeenCalledWith('Failed to submit time log: Network error');
    });
  });

  describe('Static Creation Method', () => {
    it('should provide static show method for easy access', async () => {
      // Act & Assert
      expect(TimeLogDialog.show).toBeDefined();
      expect(typeof TimeLogDialog.show).toBe('function');
    });

    it('should create and render dialog when show is called', async () => {
      // Arrange
      const renderSpy = vi.fn();
      vi.spyOn(TimeLogDialog.prototype, 'render').mockImplementation(renderSpy);

      // Act
      TimeLogDialog.show('test-task-1', mockCallback);

      // Assert
      expect(renderSpy).toHaveBeenCalledWith(true);
    });
  });

  describe('User Experience Features', () => {
    beforeEach(async () => {
      dialog = new TimeLogDialog('test-task-1', { submitCallback: mockCallback });
    });

    it('should allow quick selection of preset durations', async () => {
      // Arrange
      const mockHtml = {
        find: vi.fn(() => ({
          change: vi.fn(),
          click: vi.fn(),
          on: vi.fn(),
          val: vi.fn(),
        })),
      };

      // Act
      dialog.activateListeners(mockHtml);

      // Assert
      expect(mockHtml.find).toHaveBeenCalledWith('.preset-duration');
      expect(mockHtml.find).toHaveBeenCalledWith('.submit-time-log');
      expect(mockHtml.find).toHaveBeenCalledWith('.cancel-time-log');
    });

    it('should update custom duration field when preset is selected', async () => {
      // Arrange
      const mockEvent = {
        target: {
          value: '120',
        },
      };

      const durationInput = {
        val: vi.fn(),
      };

      // Mock jQuery $ function
      (global as any).$ = vi.fn((element) => ({
        closest: vi.fn(() => ({
          find: vi.fn(() => durationInput),
        })),
      }));

      const mockHtml = {
        find: vi.fn(() => ({
          change: vi.fn(),
          click: vi.fn(),
          on: vi.fn(),
        })),
      };

      // Act
      dialog.activateListeners(mockHtml);
      await dialog._onPresetDurationChange(mockEvent);

      // Assert
      expect(durationInput.val).toHaveBeenCalledWith('120');
    });
  });
});