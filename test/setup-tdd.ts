/**
 * Enhanced test setup for TDD workflow - Task Visibility Implementation
 */

import { vi } from 'vitest';
import type { Task, TimeEntry } from '../src/types';

// TDD Helper class for creating test data and mocks
export class TDDTestHelper {
  static createMockGM(): any {
    return { 
      id: 'gm1', 
      isGM: true, 
      name: 'TestGM',
      data: { name: 'TestGM' }
    };
  }

  static createMockPlayer(id: string): any {
    return { 
      id, 
      isGM: false, 
      name: `Player ${id}`,
      data: { name: `Player ${id}` }
    };
  }

  static createMockTask(overrides: Partial<Task> = {}): Task {
    return {
      id: 'test-task',
      name: 'Test Task',
      description: 'A test task',
      timeSpec: { minutes: 5 },
      targetTime: Date.now() + 300000, // 5 minutes from now
      macroId: 'test-macro',
      macroSource: 'generated',
      useGameTime: false,
      recurring: false,
      scope: 'world',
      enabled: true,
      created: Date.now(),
      runCount: 0,
      logExecution: false,
      // New visibility properties - defaults for testing
      visibility: 'player-visible',
      ...overrides,
    } as Task;
  }

  static createGMOnlyTask(overrides: Partial<Task> = {}): Task {
    return this.createMockTask({
      visibility: 'gm-only',
      name: 'GM Secret Reminder',
      description: 'Private GM task',
      gmNotes: 'This is for GM eyes only',
      ...overrides,
    });
  }

  static createPlayerVisibleTask(overrides: Partial<Task> = {}): Task {
    return this.createMockTask({
      visibility: 'player-visible',
      name: 'Public Event',
      description: 'Visible to all players',
      ...overrides,
    });
  }

  static createPlayerNotifyTask(overrides: Partial<Task> = {}): Task {
    return this.createMockTask({
      visibility: 'player-notify',
      name: 'Important Announcement',
      description: 'Players will be notified when this executes',
      ...overrides,
    });
  }

  static createTargetedTask(targetPlayers: string[], overrides: Partial<Task> = {}): Task {
    return this.createMockTask({
      visibility: 'player-visible',
      targetPlayers,
      name: 'Targeted Event',
      description: 'Only for specific players',
      ...overrides,
    });
  }

  static mockSocketLib(): void {
    // Mock SocketLib for testing
    (global as any).socketlib = {
      registerModule: vi.fn(() => ({
        register: vi.fn(),
        executeAsGM: vi.fn(),
        executeForEveryone: vi.fn(),
      })),
    };
  }

  static setupGameUserMock(user: any): void {
    (global as any).game = {
      ...(global as any).game,
      user,
      users: {
        filter: vi.fn((predicate: (u: any) => boolean) => {
          const allUsers = [
            this.createMockGM(),
            this.createMockPlayer('player1'),
            this.createMockPlayer('player2'),
          ];
          return allUsers.filter(predicate);
        }),
        get: vi.fn((id: string) => {
          if (id === 'gm1') return this.createMockGM();
          if (id === 'player1') return this.createMockPlayer('player1');
          if (id === 'player2') return this.createMockPlayer('player2');
          return null;
        }),
      },
    };
  }

  static createTimeLogEntry(overrides: Partial<TimeEntry> = {}): TimeEntry {
    return {
      id: 'time-entry-' + Date.now(),
      timestamp: Date.now(),
      duration: 3600, // 1 hour in seconds
      description: 'Test time entry',
      loggedBy: 'player1',
      ...overrides,
    };
  }

  static clearSingletonInstances(): void {
    // Clear singleton instances for clean test state
    const singletonClasses = [
      'TaskManager',
      'TaskScheduler', 
      'AccumulatedTimeManager',
      'MacroManager',
    ];
    
    singletonClasses.forEach(className => {
      const globalClass = (global as any)[className];
      if (globalClass) {
        (globalClass as any).instance = undefined;
      }
    });
  }

  static async waitForAsync(): Promise<void> {
    // Helper to wait for async operations in tests
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

// Mock data fixtures for consistent testing
export const TaskVisibilityFixtures = {
  gmOnlyTasks: () => [
    TDDTestHelper.createGMOnlyTask({ id: 'gm-task-1', name: 'GM Reminder 1' }),
    TDDTestHelper.createGMOnlyTask({ id: 'gm-task-2', name: 'GM Reminder 2' }),
  ],

  playerVisibleTasks: () => [
    TDDTestHelper.createPlayerVisibleTask({ id: 'public-task-1', name: 'Public Event 1' }),
    TDDTestHelper.createPlayerVisibleTask({ id: 'public-task-2', name: 'Public Event 2' }),
  ],

  playerNotifyTasks: () => [
    TDDTestHelper.createPlayerNotifyTask({ id: 'notify-task-1', name: 'Notification 1' }),
    TDDTestHelper.createPlayerNotifyTask({ id: 'notify-task-2', name: 'Notification 2' }),
  ],

  targetedTasks: () => [
    TDDTestHelper.createTargetedTask(['player1'], { id: 'targeted-task-1', name: 'For Player 1' }),
    TDDTestHelper.createTargetedTask(['player2'], { id: 'targeted-task-2', name: 'For Player 2' }),
    TDDTestHelper.createTargetedTask(['player1', 'player2'], { id: 'targeted-task-3', name: 'For Both Players' }),
  ],

  mixedTasks: () => [
    ...TaskVisibilityFixtures.gmOnlyTasks(),
    ...TaskVisibilityFixtures.playerVisibleTasks(),
    ...TaskVisibilityFixtures.playerNotifyTasks(),
    ...TaskVisibilityFixtures.targetedTasks(),
  ],
};