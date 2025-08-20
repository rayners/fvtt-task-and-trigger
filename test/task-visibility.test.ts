/**
 * Test file for task visibility filtering logic
 * Following TDD Red-Green-Refactor pattern
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TDDTestHelper, TaskVisibilityFixtures } from './setup-tdd';
import type { Task } from '../src/types';

// Import the modules we'll be testing (these will fail initially - RED phase)
import { TaskManager } from '../src/task-manager';

describe('Task Visibility Filtering', () => {
  let taskManager: TaskManager;

  beforeEach(async () => {
    // Clear singleton instance
    (TaskManager as any).instance = undefined;
    
    // Clear all mocks
    vi.clearAllMocks();
    
    // Setup clean state
    TDDTestHelper.clearSingletonInstances();
    
    // Setup mock game user as GM initially
    TDDTestHelper.setupGameUserMock(TDDTestHelper.createMockGM());
    
    taskManager = TaskManager.getInstance();
  });

  describe('isVisibleToPlayer()', () => {
    it('should return false for gm-only tasks when called by player', async () => {
      // Arrange
      const gmOnlyTask = TDDTestHelper.createGMOnlyTask();
      const playerId = 'player1';

      // Act & Assert - This will fail initially (RED phase)
      // @ts-expect-error - Method doesn't exist yet, this is intentional for TDD
      const result = taskManager.isVisibleToPlayer(gmOnlyTask, playerId);
      
      expect(result).toBe(false);
    });

    it('should return true for gm-only tasks when called by GM', async () => {
      // Arrange
      const gmOnlyTask = TDDTestHelper.createGMOnlyTask();
      const gmId = 'gm1';

      // Act & Assert
      // @ts-expect-error - Method doesn't exist yet, this is intentional for TDD
      const result = taskManager.isVisibleToPlayer(gmOnlyTask, gmId);
      
      expect(result).toBe(true);
    });

    it('should return true for player-visible tasks for any user', async () => {
      // Arrange
      const playerVisibleTask = TDDTestHelper.createPlayerVisibleTask();
      const playerId = 'player1';

      // Act & Assert
      // @ts-expect-error - Method doesn't exist yet, this is intentional for TDD
      const result = taskManager.isVisibleToPlayer(playerVisibleTask, playerId);
      
      expect(result).toBe(true);
    });

    it('should return true for player-notify tasks for any user', async () => {
      // Arrange
      const playerNotifyTask = TDDTestHelper.createPlayerNotifyTask();
      const playerId = 'player1';

      // Act & Assert
      // @ts-expect-error - Method doesn't exist yet, this is intentional for TDD
      const result = taskManager.isVisibleToPlayer(playerNotifyTask, playerId);
      
      expect(result).toBe(true);
    });

    it('should respect targetPlayers array for targeted tasks', async () => {
      // Arrange
      const targetedTask = TDDTestHelper.createTargetedTask(['player1']);
      const targetedPlayerId = 'player1';
      const nonTargetedPlayerId = 'player2';

      // Act & Assert
      // @ts-expect-error - Method doesn't exist yet, this is intentional for TDD
      const targetedResult = taskManager.isVisibleToPlayer(targetedTask, targetedPlayerId);
      // @ts-expect-error - Method doesn't exist yet, this is intentional for TDD
      const nonTargetedResult = taskManager.isVisibleToPlayer(targetedTask, nonTargetedPlayerId);
      
      expect(targetedResult).toBe(true);
      expect(nonTargetedResult).toBe(false);
    });

    it('should default to current user if no userId provided', async () => {
      // Arrange
      const playerVisibleTask = TDDTestHelper.createPlayerVisibleTask();
      TDDTestHelper.setupGameUserMock(TDDTestHelper.createMockPlayer('player1'));

      // Act & Assert
      // @ts-expect-error - Method doesn't exist yet, this is intentional for TDD
      const result = taskManager.isVisibleToPlayer(playerVisibleTask);
      
      expect(result).toBe(true);
    });
  });

  describe('getPlayerVisibleTasks()', () => {
    it('should filter out gm-only tasks for players', async () => {
      // Arrange
      const allTasks = TaskVisibilityFixtures.mixedTasks();
      vi.spyOn(taskManager, 'getAllTasks').mockResolvedValue({ world: allTasks, client: [] });
      
      // Act & Assert
      // @ts-expect-error - Method doesn't exist yet, this is intentional for TDD
      const visibleTasks = await taskManager.getPlayerVisibleTasks('player1');
      
      // Should not contain any gm-only tasks
      const hasGMOnlyTasks = visibleTasks.some((task: any) => 
        allTasks.find(t => t.id === task.id)?.visibility === 'gm-only'
      );
      expect(hasGMOnlyTasks).toBe(false);
    });

    it('should include player-visible and player-notify tasks', async () => {
      // Arrange
      const allTasks = TaskVisibilityFixtures.mixedTasks();
      vi.spyOn(taskManager, 'getAllTasks').mockResolvedValue({ world: allTasks, client: [] });
      
      // Act & Assert
      // @ts-expect-error - Method doesn't exist yet, this is intentional for TDD
      const visibleTasks = await taskManager.getPlayerVisibleTasks('player1');
      
      // Should contain at least some player-visible tasks
      expect(visibleTasks.length).toBeGreaterThan(0);
      
      // Each task should be either player-visible or player-notify
      visibleTasks.forEach((task: any) => {
        const originalTask = allTasks.find(t => t.id === task.id);
        expect(['player-visible', 'player-notify']).toContain(originalTask?.visibility);
      });
    });

    it('should respect targetPlayers filtering', async () => {
      // Arrange
      const targetedTasks = TaskVisibilityFixtures.targetedTasks();
      vi.spyOn(taskManager, 'getAllTasks').mockResolvedValue({ world: targetedTasks, client: [] });
      
      // Act & Assert
      // @ts-expect-error - Method doesn't exist yet, this is intentional for TDD
      const player1Tasks = await taskManager.getPlayerVisibleTasks('player1');
      // @ts-expect-error - Method doesn't exist yet, this is intentional for TDD
      const player2Tasks = await taskManager.getPlayerVisibleTasks('player2');
      
      // Player 1 should see tasks targeted to them
      const player1TaskIds = player1Tasks.map((t: any) => t.id);
      expect(player1TaskIds).toContain('targeted-task-1'); // For Player 1
      expect(player1TaskIds).toContain('targeted-task-3'); // For Both Players
      expect(player1TaskIds).not.toContain('targeted-task-2'); // For Player 2 only
      
      // Player 2 should see different tasks
      const player2TaskIds = player2Tasks.map((t: any) => t.id);
      expect(player2TaskIds).toContain('targeted-task-2'); // For Player 2
      expect(player2TaskIds).toContain('targeted-task-3'); // For Both Players
      expect(player2TaskIds).not.toContain('targeted-task-1'); // For Player 1 only
    });

    it('should return PlayerTaskView objects, not full Task objects', async () => {
      // Arrange
      const playerVisibleTasks = TaskVisibilityFixtures.playerVisibleTasks();
      vi.spyOn(taskManager, 'getAllTasks').mockResolvedValue({ world: playerVisibleTasks, client: [] });
      
      // Act & Assert
      // @ts-expect-error - Method doesn't exist yet, this is intentional for TDD
      const visibleTasks = await taskManager.getPlayerVisibleTasks('player1');
      
      // Should not contain sensitive fields
      visibleTasks.forEach((task: any) => {
        expect(task).toHaveProperty('id');
        expect(task).toHaveProperty('name');
        expect(task).toHaveProperty('description');
        expect(task).toHaveProperty('nextExecution');
        expect(task).toHaveProperty('isRecurring');
        expect(task).toHaveProperty('useGameTime');
        
        // Should NOT contain sensitive fields
        expect(task).not.toHaveProperty('macroId');
        expect(task).not.toHaveProperty('callback');
        expect(task).not.toHaveProperty('gmNotes');
        expect(task).not.toHaveProperty('visibility');
      });
    });
  });

  describe('getGMTasks()', () => {
    it('should return all tasks with full details for GM', async () => {
      // Arrange
      const allTasks = TaskVisibilityFixtures.mixedTasks();
      vi.spyOn(taskManager, 'getAllTasks').mockResolvedValue({ world: allTasks, client: [] });
      
      // Act & Assert
      // @ts-expect-error - Method doesn't exist yet, this is intentional for TDD
      const gmTasks = await taskManager.getGMTasks();
      
      // GM should see all tasks
      expect(gmTasks.length).toBe(allTasks.length);
      
      // GM should see full task details (including sensitive fields)
      gmTasks.forEach((task: Task) => {
        expect(task).toHaveProperty('macroId');
        expect(task).toHaveProperty('visibility');
        // Verify this is a complete Task object, not a filtered PlayerTaskView
        expect(task).toHaveProperty('macroSource');
        expect(task).toHaveProperty('scope');
        expect(task).toHaveProperty('enabled');
      });
    });
  });

  describe('createPlayerView()', () => {
    it('should create safe PlayerTaskView from Task', async () => {
      // Arrange
      const fullTask = TDDTestHelper.createPlayerVisibleTask({
        gmNotes: 'Secret GM notes',
        macroId: 'sensitive-macro-id',
        targetTime: Date.now() + 300000,
      });
      
      // Act & Assert
      // @ts-expect-error - Method doesn't exist yet, this is intentional for TDD
      const playerView = taskManager.createPlayerView(fullTask);
      
      // Should contain safe fields
      expect(playerView.id).toBe(fullTask.id);
      expect(playerView.name).toBe(fullTask.name);
      expect(playerView.description).toBe(fullTask.description);
      expect(playerView.nextExecution).toBe(fullTask.targetTime);
      expect(playerView.isRecurring).toBe(fullTask.recurring);
      expect(playerView.useGameTime).toBe(fullTask.useGameTime);
      
      // Should NOT contain sensitive fields
      expect(playerView).not.toHaveProperty('macroId');
      expect(playerView).not.toHaveProperty('gmNotes');
      expect(playerView).not.toHaveProperty('visibility');
      expect(playerView).not.toHaveProperty('callback');
    });
  });
});