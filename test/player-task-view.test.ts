/**
 * Test file for PlayerTaskView data structure
 * Ensures safe data exposure to players
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TDDTestHelper } from './setup-tdd';
import type { PlayerTaskView } from '../src/types';

describe('PlayerTaskView Data Structure', () => {
  describe('interface definition', () => {
    it('should have required safe fields', () => {
      // Arrange - Create a mock player task view
      const playerTaskView: PlayerTaskView = {
        id: 'test-task-1',
        name: 'Test Task',
        description: 'A test task description',
        nextExecution: Date.now() + 300000,
        isRecurring: false,
        useGameTime: false,
      };

      // Assert - Check all required fields exist
      expect(playerTaskView).toHaveProperty('id');
      expect(playerTaskView).toHaveProperty('name');
      expect(playerTaskView).toHaveProperty('nextExecution');
      expect(playerTaskView).toHaveProperty('isRecurring');
      expect(playerTaskView).toHaveProperty('useGameTime');
      
      // Optional fields
      expect(playerTaskView).toHaveProperty('description');
    });

    it('should not contain sensitive task fields', () => {
      // This test ensures the interface doesn't accidentally include sensitive fields
      const playerTaskView: PlayerTaskView = {
        id: 'test-task-1',
        name: 'Test Task',
        nextExecution: Date.now() + 300000,
        isRecurring: false,
        useGameTime: false,
      };

      // Ensure these sensitive properties are not part of the interface
      // TypeScript will catch this at compile time if we try to add them
      expect(playerTaskView).not.toHaveProperty('macroId');
      expect(playerTaskView).not.toHaveProperty('gmNotes');
      expect(playerTaskView).not.toHaveProperty('visibility');
      expect(playerTaskView).not.toHaveProperty('targetPlayers');
      expect(playerTaskView).not.toHaveProperty('callback');
      expect(playerTaskView).not.toHaveProperty('macroSource');
    });
  });

  describe('data transformation safety', () => {
    it('should safely transform from full Task to PlayerTaskView', () => {
      // Arrange
      const fullTask = TDDTestHelper.createMockTask({
        id: 'sensitive-task',
        name: 'Public Task',
        description: 'This is visible',
        targetTime: Date.now() + 600000,
        recurring: true,
        useGameTime: true,
        // Sensitive fields that should NOT appear in player view
        macroId: 'secret-macro',
        gmNotes: 'Secret GM notes',
        visibility: 'player-visible',
        targetPlayers: ['player1'],
      });

      // Act - Transform to player view (manual transformation for test)
      const playerView: PlayerTaskView = {
        id: fullTask.id,
        name: fullTask.name,
        description: fullTask.description,
        nextExecution: fullTask.targetTime,
        isRecurring: fullTask.recurring,
        useGameTime: fullTask.useGameTime,
      };

      // Assert - Verify safe fields are present
      expect(playerView.id).toBe('sensitive-task');
      expect(playerView.name).toBe('Public Task');
      expect(playerView.description).toBe('This is visible');
      expect(playerView.nextExecution).toBe(fullTask.targetTime);
      expect(playerView.isRecurring).toBe(true);
      expect(playerView.useGameTime).toBe(true);

      // Assert - Verify sensitive fields are absent
      expect(playerView).not.toHaveProperty('macroId');
      expect(playerView).not.toHaveProperty('gmNotes');
      expect(playerView).not.toHaveProperty('visibility');
      expect(playerView).not.toHaveProperty('targetPlayers');
    });

    it('should handle optional fields correctly', () => {
      // Arrange - Task without description
      const taskWithoutDesc = TDDTestHelper.createMockTask({
        description: undefined,
      });

      // Act
      const playerView: PlayerTaskView = {
        id: taskWithoutDesc.id,
        name: taskWithoutDesc.name,
        description: taskWithoutDesc.description,
        nextExecution: taskWithoutDesc.targetTime,
        isRecurring: taskWithoutDesc.recurring,
        useGameTime: taskWithoutDesc.useGameTime,
      };

      // Assert
      expect(playerView.description).toBeUndefined();
      expect(playerView.id).toBeDefined();
      expect(playerView.name).toBeDefined();
    });

    it('should handle nextExecution properly for different task types', () => {
      // Arrange - Different task timing scenarios
      const futureTask = TDDTestHelper.createMockTask({
        targetTime: Date.now() + 86400000, // 24 hours from now
      });

      const pastTask = TDDTestHelper.createMockTask({
        targetTime: Date.now() - 3600000, // 1 hour ago
      });

      // Act
      const futurePlayerView: PlayerTaskView = {
        id: futureTask.id,
        name: futureTask.name,
        nextExecution: futureTask.targetTime,
        isRecurring: futureTask.recurring,
        useGameTime: futureTask.useGameTime,
      };

      const pastPlayerView: PlayerTaskView = {
        id: pastTask.id,
        name: pastTask.name,
        nextExecution: pastTask.targetTime,
        isRecurring: pastTask.recurring,
        useGameTime: pastTask.useGameTime,
      };

      // Assert
      expect(futurePlayerView.nextExecution).toBeGreaterThan(Date.now());
      expect(pastPlayerView.nextExecution).toBeLessThan(Date.now());
    });
  });

  describe('type safety', () => {
    it('should enforce correct data types', () => {
      // This test mainly serves as documentation and compile-time checking
      const playerTaskView: PlayerTaskView = {
        id: 'test-id', // Must be string
        name: 'Test Name', // Must be string
        description: 'Optional description', // Must be string or undefined
        nextExecution: 1234567890, // Must be number (timestamp)
        isRecurring: true, // Must be boolean
        useGameTime: false, // Must be boolean
      };

      expect(typeof playerTaskView.id).toBe('string');
      expect(typeof playerTaskView.name).toBe('string');
      expect(typeof playerTaskView.nextExecution).toBe('number');
      expect(typeof playerTaskView.isRecurring).toBe('boolean');
      expect(typeof playerTaskView.useGameTime).toBe('boolean');
    });

    it('should allow undefined description', () => {
      // Test that description can be undefined
      const playerTaskViewNoDesc: PlayerTaskView = {
        id: 'test-id',
        name: 'Test Name',
        nextExecution: Date.now(),
        isRecurring: false,
        useGameTime: false,
        // description deliberately omitted
      };

      expect(playerTaskViewNoDesc.description).toBeUndefined();
    });
  });
});