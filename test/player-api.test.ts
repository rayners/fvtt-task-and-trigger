/**
 * Test file for player-facing read-only API methods
 * Following TDD Red-Green-Refactor pattern for Phase 2
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TDDTestHelper, TaskVisibilityFixtures } from './setup-tdd';
import { TaskTriggerAPIImpl } from '../src/api';
import { TaskManager } from '../src/task-manager';
import { PlayerTaskView } from '../src/types';

describe('Player Read-Only API Methods', () => {
  let api: TaskTriggerAPIImpl;
  let taskManager: TaskManager;

  beforeEach(async () => {
    // Clear all mocks and singletons
    vi.clearAllMocks();
    TDDTestHelper.clearSingletonInstances();

    // Setup test instances
    api = new TaskTriggerAPIImpl();
    taskManager = TaskManager.getInstance();
  });

  describe('getUpcomingEvents', () => {
    it('should return upcoming player-visible tasks within time limit', async () => {
      // Arrange
      TDDTestHelper.setupGameUserMock(TDDTestHelper.createMockPlayer('player1'));
      
      const currentTime = Date.now() / 1000;
      const tasks = [
        TDDTestHelper.createPlayerVisibleTask({
          id: 'visible-1',
          name: 'Public Event 1',
          targetTime: currentTime + 3600, // 1 hour from now
          enabled: true,
        }),
        TDDTestHelper.createPlayerVisibleTask({
          id: 'visible-2', 
          name: 'Public Event 2',
          targetTime: currentTime + 7200, // 2 hours from now
          enabled: true,
        }),
        TDDTestHelper.createGMOnlyTask({
          id: 'gm-only-1',
          name: 'GM Secret',
          targetTime: currentTime + 1800, // 30 minutes from now
          enabled: true,
        }),
      ];

      // Mock TaskManager methods
      vi.spyOn(taskManager, 'getAllTasks').mockResolvedValue({
        world: tasks,
        client: [],
      });

      const playerViews: PlayerTaskView[] = [
        {
          id: 'visible-1',
          name: 'Public Event 1',
          description: 'Visible to all players',
          nextExecution: currentTime + 3600,
          isRecurring: false,
          useGameTime: false,
        },
        {
          id: 'visible-2',
          name: 'Public Event 2', 
          description: 'Visible to all players',
          nextExecution: currentTime + 7200,
          isRecurring: false,
          useGameTime: false,
        },
      ];

      vi.spyOn(taskManager, 'getPlayerVisibleTasks').mockResolvedValue(playerViews);

      // Act
      const result = await api.getUpcomingEvents(24); // 24 hours

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('visible-1');
      expect(result[1].id).toBe('visible-2');
      expect(result[0].nextExecution).toBeLessThan(result[1].nextExecution || 0);
      
      // Verify GM task is not included
      expect(result.find(task => task.id === 'gm-only-1')).toBeUndefined();
    });

    it('should respect time limit parameter', async () => {
      // Arrange
      TDDTestHelper.setupGameUserMock(TDDTestHelper.createMockPlayer('player1'));
      
      const currentTime = Date.now() / 1000;
      const tasks = [
        TDDTestHelper.createPlayerVisibleTask({
          id: 'near-event',
          targetTime: currentTime + 1800, // 30 minutes from now
          enabled: true,
        }),
        TDDTestHelper.createPlayerVisibleTask({
          id: 'far-event',
          targetTime: currentTime + 7200, // 2 hours from now  
          enabled: true,
        }),
      ];

      vi.spyOn(taskManager, 'getAllTasks').mockResolvedValue({
        world: tasks,
        client: [],
      });

      const playerViews: PlayerTaskView[] = [
        {
          id: 'near-event',
          name: 'Near Event',
          nextExecution: currentTime + 1800,
          isRecurring: false,
          useGameTime: false,
        },
      ];

      vi.spyOn(taskManager, 'getPlayerVisibleTasks').mockResolvedValue(playerViews);

      // Act - limit to 1 hour
      const result = await api.getUpcomingEvents(1);

      // Assert - should only include near event
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('near-event');
    });

    it('should exclude disabled tasks', async () => {
      // Arrange
      TDDTestHelper.setupGameUserMock(TDDTestHelper.createMockPlayer('player1'));
      
      const currentTime = Date.now() / 1000;
      const tasks = [
        TDDTestHelper.createPlayerVisibleTask({
          id: 'enabled-task',
          targetTime: currentTime + 3600,
          enabled: true,
        }),
        TDDTestHelper.createPlayerVisibleTask({
          id: 'disabled-task',
          targetTime: currentTime + 3600,
          enabled: false,
        }),
      ];

      vi.spyOn(taskManager, 'getAllTasks').mockResolvedValue({
        world: tasks,
        client: [],
      });

      const playerViews: PlayerTaskView[] = [
        {
          id: 'enabled-task',
          name: 'Enabled Task',
          nextExecution: currentTime + 3600,
          isRecurring: false,
          useGameTime: false,
        },
      ];

      vi.spyOn(taskManager, 'getPlayerVisibleTasks').mockResolvedValue(playerViews);

      // Act
      const result = await api.getUpcomingEvents();

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('enabled-task');
    });

    it('should exclude past tasks', async () => {
      // Arrange
      TDDTestHelper.setupGameUserMock(TDDTestHelper.createMockPlayer('player1'));
      
      const currentTime = Date.now() / 1000;
      const tasks = [
        TDDTestHelper.createPlayerVisibleTask({
          id: 'future-task',
          targetTime: currentTime + 3600, // Future
          enabled: true,
        }),
        TDDTestHelper.createPlayerVisibleTask({
          id: 'past-task',
          targetTime: currentTime - 3600, // Past
          enabled: true,
        }),
      ];

      vi.spyOn(taskManager, 'getAllTasks').mockResolvedValue({
        world: tasks,
        client: [],
      });

      const playerViews: PlayerTaskView[] = [
        {
          id: 'future-task',
          name: 'Future Task',
          nextExecution: currentTime + 3600,
          isRecurring: false,
          useGameTime: false,
        },
      ];

      vi.spyOn(taskManager, 'getPlayerVisibleTasks').mockResolvedValue(playerViews);

      // Act
      const result = await api.getUpcomingEvents();

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('future-task');
    });

    it('should sort results by execution time', async () => {
      // Arrange
      TDDTestHelper.setupGameUserMock(TDDTestHelper.createMockPlayer('player1'));
      
      const currentTime = Date.now() / 1000;
      const tasks = [
        TDDTestHelper.createPlayerVisibleTask({
          id: 'third-event',
          targetTime: currentTime + 10800, // 3 hours
          enabled: true,
        }),
        TDDTestHelper.createPlayerVisibleTask({
          id: 'first-event',
          targetTime: currentTime + 3600, // 1 hour
          enabled: true,
        }),
        TDDTestHelper.createPlayerVisibleTask({
          id: 'second-event',
          targetTime: currentTime + 7200, // 2 hours
          enabled: true,
        }),
      ];

      vi.spyOn(taskManager, 'getAllTasks').mockResolvedValue({
        world: tasks,
        client: [],
      });

      const playerViews: PlayerTaskView[] = [
        {
          id: 'first-event',
          name: 'First Event',
          nextExecution: currentTime + 3600,
          isRecurring: false,
          useGameTime: false,
        },
        {
          id: 'second-event',
          name: 'Second Event',
          nextExecution: currentTime + 7200,
          isRecurring: false,
          useGameTime: false,
        },
        {
          id: 'third-event',
          name: 'Third Event',
          nextExecution: currentTime + 10800,
          isRecurring: false,
          useGameTime: false,
        },
      ];

      vi.spyOn(taskManager, 'getPlayerVisibleTasks').mockResolvedValue(playerViews);

      // Act
      const result = await api.getUpcomingEvents();

      // Assert
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('first-event');
      expect(result[1].id).toBe('second-event');
      expect(result[2].id).toBe('third-event');
    });

    it('should handle targeted tasks correctly for current player', async () => {
      // Arrange
      TDDTestHelper.setupGameUserMock(TDDTestHelper.createMockPlayer('player1'));
      
      const currentTime = Date.now() / 1000;
      const tasks = [
        TDDTestHelper.createTargetedTask(['player1'], {
          id: 'targeted-for-me',
          targetTime: currentTime + 3600,
          enabled: true,
        }),
        TDDTestHelper.createTargetedTask(['player2'], {
          id: 'targeted-for-other',
          targetTime: currentTime + 3600,
          enabled: true,
        }),
      ];

      vi.spyOn(taskManager, 'getAllTasks').mockResolvedValue({
        world: tasks,
        client: [],
      });

      const playerViews: PlayerTaskView[] = [
        {
          id: 'targeted-for-me',
          name: 'Targeted Event',
          description: 'Only for specific players',
          nextExecution: currentTime + 3600,
          isRecurring: false,
          useGameTime: false,
        },
      ];

      vi.spyOn(taskManager, 'getPlayerVisibleTasks').mockResolvedValue(playerViews);

      // Act
      const result = await api.getUpcomingEvents();

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('targeted-for-me');
      expect(result.find(task => task.id === 'targeted-for-other')).toBeUndefined();
    });

    it('should use default time limit of 1 week when not specified', async () => {
      // Arrange
      TDDTestHelper.setupGameUserMock(TDDTestHelper.createMockPlayer('player1'));
      
      const currentTime = Date.now() / 1000;
      const oneWeekFromNow = currentTime + (7 * 24 * 3600);
      const twoWeeksFromNow = currentTime + (14 * 24 * 3600);
      
      const tasks = [
        TDDTestHelper.createPlayerVisibleTask({
          id: 'within-week',
          targetTime: oneWeekFromNow - 3600, // Just under 1 week
          enabled: true,
        }),
        TDDTestHelper.createPlayerVisibleTask({
          id: 'beyond-week',
          targetTime: twoWeeksFromNow, // 2 weeks out
          enabled: true,
        }),
      ];

      vi.spyOn(taskManager, 'getAllTasks').mockResolvedValue({
        world: tasks,
        client: [],
      });

      const playerViews: PlayerTaskView[] = [
        {
          id: 'within-week',
          name: 'Within Week',
          nextExecution: oneWeekFromNow - 3600,
          isRecurring: false,
          useGameTime: false,
        },
      ];

      vi.spyOn(taskManager, 'getPlayerVisibleTasks').mockResolvedValue(playerViews);

      // Act - no time limit specified, should default to 168 hours (1 week)
      const result = await api.getUpcomingEvents();

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('within-week');
    });

    it('should return empty array when no upcoming visible tasks exist', async () => {
      // Arrange
      TDDTestHelper.setupGameUserMock(TDDTestHelper.createMockPlayer('player1'));

      vi.spyOn(taskManager, 'getAllTasks').mockResolvedValue({
        world: [],
        client: [],
      });

      vi.spyOn(taskManager, 'getPlayerVisibleTasks').mockResolvedValue([]);

      // Act
      const result = await api.getUpcomingEvents();

      // Assert
      expect(result).toEqual([]);
    });
  });
});