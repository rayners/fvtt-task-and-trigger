/**
 * Test file for PlayerTaskView UI Application
 * Following TDD Red-Green-Refactor pattern for Phase 3
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TDDTestHelper } from './setup-tdd';

// Setup global mocks before importing the component
(global as any).ApplicationV2 = class MockApplicationV2 {
  static get defaultOptions() {
    return {};
  }
  constructor(options: any = {}) {}
  render() { return this; }
  getData() { return {}; }
  activateListeners(html: any) {}
  close() { return Promise.resolve(); }
};

(global as any).HandlebarsApplicationMixin = (baseClass: any) => {
  return class extends baseClass {
    activateListeners(html: any) {
      // Mock parent activateListeners
    }
  };
};

(global as any).Hooks = {
  on: vi.fn(),
  off: vi.fn(),
  callAll: vi.fn(),
};

import { PlayerTaskView } from '../src/applications/player-task-view';

describe('PlayerTaskView Application', () => {
  let app: any;

  beforeEach(async () => {
    // Clear all mocks and singletons
    vi.clearAllMocks();
    TDDTestHelper.clearSingletonInstances();

    // Setup additional global mocks for FoundryVTT UI
    (global as any).ApplicationV2 = class MockApplicationV2 {
      static get defaultOptions() {
        return {};
      }
      constructor(options: any = {}) {}
      render() {}
      getData() { return {}; }
      activateListeners() {}
    };

    (global as any).HandlebarsApplicationMixin = (baseClass: any) => baseClass;

    // Setup game API mock
    TDDTestHelper.setupGameUserMock(TDDTestHelper.createMockPlayer('player1'));
    
    (global as any).game = {
      ...(global as any).game,
      taskTrigger: {
        api: {
          getUpcomingEvents: vi.fn(),
        },
        accumulatedTime: {
          requestTimeLog: vi.fn(),
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
  });

  describe('Application Configuration', () => {
    it('should have correct default options', async () => {
      // Act & Assert - This will fail initially (RED phase)
      app = new PlayerTaskView();
      
      expect(PlayerTaskView.defaultOptions).toBeDefined();
      expect(PlayerTaskView.defaultOptions.id).toBe('player-task-view');
      expect(PlayerTaskView.defaultOptions.title).toBe('Upcoming Events');
      expect(PlayerTaskView.defaultOptions.template).toContain('player-task-view.hbs');
      expect(PlayerTaskView.defaultOptions.width).toBe(400);
      expect(PlayerTaskView.defaultOptions.height).toBe(600);
      expect(PlayerTaskView.defaultOptions.resizable).toBe(true);
    });

    it('should be constructible without errors', async () => {
      // Act & Assert
      expect(() => {
        app = new PlayerTaskView();
      }).not.toThrow();
      
      expect(app).toBeDefined();
    });
  });

  describe('Data Retrieval', () => {
    beforeEach(async () => {
      app = new PlayerTaskView();
    });

    it('should fetch upcoming events for current player', async () => {
      // Arrange
      const mockUpcomingEvents = [
        {
          id: 'event-1',
          name: 'Public Quest Start',
          description: 'The adventure begins',
          nextExecution: Date.now() / 1000 + 3600,
          isRecurring: false,
          useGameTime: false,
        },
        {
          id: 'event-2', 
          name: 'Town Meeting',
          description: 'Weekly gathering',
          nextExecution: Date.now() / 1000 + 7200,
          isRecurring: true,
          useGameTime: true,
        },
      ];

      vi.mocked(game.taskTrigger.api.getUpcomingEvents).mockResolvedValue(mockUpcomingEvents);

      // Act
      const data = await app.getData();

      // Assert
      expect(game.taskTrigger.api.getUpcomingEvents).toHaveBeenCalledWith(168); // Default 1 week
      expect(data.upcomingTasks).toHaveLength(2);
      expect(data.upcomingTasks[0].name).toBe('Public Quest Start');
      expect(data.canLogTime).toBe(true); // Player should be able to request time logging
    });

    it('should limit upcoming events to 10 most recent', async () => {
      // Arrange
      const manyEvents = Array.from({ length: 15 }, (_, i) => ({
        id: `event-${i}`,
        name: `Event ${i}`,
        nextExecution: Date.now() / 1000 + (i + 1) * 3600,
        isRecurring: false,
        useGameTime: false,
      }));

      vi.mocked(game.taskTrigger.api.getUpcomingEvents).mockResolvedValue(manyEvents);

      // Act
      const data = await app.getData();

      // Assert
      expect(data.upcomingTasks).toHaveLength(10);
    });

    it('should show GM users cannot use time logging request system', async () => {
      // Arrange
      TDDTestHelper.setupGameUserMock(TDDTestHelper.createMockGM());
      vi.mocked(game.taskTrigger.api.getUpcomingEvents).mockResolvedValue([]);

      // Act
      const data = await app.getData();

      // Assert
      expect(data.canLogTime).toBe(false); // GM uses direct access, not requests
    });

    it('should handle empty upcoming events gracefully', async () => {
      // Arrange
      vi.mocked(game.taskTrigger.api.getUpcomingEvents).mockResolvedValue([]);

      // Act
      const data = await app.getData();

      // Assert
      expect(data.upcomingTasks).toEqual([]);
      expect(data.canLogTime).toBe(true);
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      app = new PlayerTaskView();
      
      // Mock HTML element for event simulation
      (global as any).$ = vi.fn(() => ({
        find: vi.fn(() => ({
          click: vi.fn(),
        })),
      }));
    });

    it('should setup event listeners for time logging', async () => {
      // Arrange
      const mockHtml = {
        find: vi.fn(() => ({
          click: vi.fn(),
        })),
      };

      // Act
      app.activateListeners(mockHtml);

      // Assert
      expect(mockHtml.find).toHaveBeenCalledWith('.log-time-btn');
      expect(mockHtml.find).toHaveBeenCalledWith('.view-progress-btn');
    });

    it('should handle time logging button clicks', async () => {
      // Arrange
      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: {
          dataset: {
            taskId: 'test-task-1',
          },
        },
      };

      vi.mocked(game.taskTrigger.accumulatedTime.requestTimeLog).mockResolvedValue(true);

      // Act & Assert - This will test the time logging flow
      await app._onLogTime(mockEvent);

      // Should open TimeLogDialog (to be implemented)
      expect(ui.notifications.info).toHaveBeenCalledWith('Time log request sent to GM');
    });

    it('should handle time logging request failures', async () => {
      // Arrange
      const mockEvent = {
        preventDefault: vi.fn(),
        currentTarget: {
          dataset: {
            taskId: 'test-task-1',
          },
        },
      };

      vi.mocked(game.taskTrigger.accumulatedTime.requestTimeLog).mockResolvedValue(false);

      // Act
      await app._onLogTime(mockEvent);

      // Assert
      expect(ui.notifications.error).toHaveBeenCalledWith('Failed to send time log request');
    });
  });

  describe('Integration with Socket System', () => {
    beforeEach(async () => {
      app = new PlayerTaskView();
    });

    it('should refresh data when time is logged via sockets', async () => {
      // Arrange
      const renderSpy = vi.spyOn(app, 'render');
      
      // Act - Simulate socket notification by calling the hook handler directly
      const timeLogData = {
        taskId: 'test-task',
        taskName: 'Test Task',
        loggedBy: 'Player One',
        duration: 3600,
        isComplete: false,
      };
      
      app._onTimeLogged(timeLogData);

      // Assert
      expect(renderSpy).toHaveBeenCalled();
    });

    it('should handle task completion notifications', async () => {
      // Arrange
      const renderSpy = vi.spyOn(app, 'render');

      // Act - Simulate task completion by calling the hook handler directly
      const completionData = {
        taskId: 'test-task',
        taskName: 'Test Task',
        loggedBy: 'Player One', 
        duration: 3600,
        isComplete: true,
      };
      
      app._onTimeLogged(completionData);

      // Assert
      expect(renderSpy).toHaveBeenCalled();
      expect(ui.notifications.info).toHaveBeenCalledWith('Task "Test Task" completed!');
    });
  });

  describe('Static Show Method', () => {
    it('should provide static show method for easy access', async () => {
      // Act & Assert
      expect(PlayerTaskView.show).toBeDefined();
      expect(typeof PlayerTaskView.show).toBe('function');
    });

    it('should render application when show is called', async () => {
      // Arrange
      const renderSpy = vi.fn();
      vi.spyOn(PlayerTaskView.prototype, 'render').mockImplementation(renderSpy);

      // Act
      PlayerTaskView.show();

      // Assert
      expect(renderSpy).toHaveBeenCalledWith(true);
    });
  });
});