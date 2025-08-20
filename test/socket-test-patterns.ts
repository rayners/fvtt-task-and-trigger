/**
 * Socket testing patterns and mocks for TDD workflow
 * Handles SocketLib mocking and GM offline scenarios
 */

import { vi } from 'vitest';

export interface MockSocketHandler {
  register: ReturnType<typeof vi.fn>;
  executeAsGM: ReturnType<typeof vi.fn>;
  executeForEveryone: ReturnType<typeof vi.fn>;
  executeForUsers: ReturnType<typeof vi.fn>;
  executeAsUser: ReturnType<typeof vi.fn>;
}

export interface MockSocketLibResult {
  socketHandler: MockSocketHandler;
  isGMOnline: boolean;
  latency: number;
  failureRate: number;
}

export class SocketTestPatterns {
  /**
   * Create a mock SocketLib with configurable behavior
   */
  static createMockSocketLib(options: {
    isGMOnline?: boolean;
    latency?: number;
    failureRate?: number;
    autoResolve?: boolean;
  } = {}): MockSocketLibResult {
    const {
      isGMOnline = true,
      latency = 0,
      failureRate = 0,
      autoResolve = true
    } = options;

    const socketHandler: MockSocketHandler = {
      register: vi.fn(),
      executeAsGM: vi.fn(),
      executeForEveryone: vi.fn(),
      executeForUsers: vi.fn(),
      executeAsUser: vi.fn(),
    };

    // Configure executeAsGM behavior based on GM online status
    if (isGMOnline && autoResolve) {
      socketHandler.executeAsGM.mockImplementation(async (method: string, data: any) => {
        // Simulate network latency
        if (latency > 0) {
          await new Promise(resolve => setTimeout(resolve, latency));
        }

        // Simulate random failures
        if (Math.random() < failureRate) {
          throw new Error('Socket communication failed');
        }

        // Mock GM processing for common methods
        switch (method) {
          case 'requestTimeLog':
            return {
              success: true,
              message: 'Time logged successfully',
            };
          
          case 'requestTaskProgress':
            return {
              taskId: data.taskId,
              progress: 0.5,
              isComplete: false,
            };

          default:
            return { success: true };
        }
      });
    } else if (!isGMOnline) {
      socketHandler.executeAsGM.mockRejectedValue(
        new Error('GM is offline or unreachable')
      );
    }

    // Configure executeForEveryone for notifications
    socketHandler.executeForEveryone.mockImplementation(async (method: string, data: any) => {
      if (latency > 0) {
        await new Promise(resolve => setTimeout(resolve, latency));
      }
      
      // Just log the notification for testing
      return { notified: true, method, data };
    });

    // Mock the global socketlib
    (global as any).socketlib = {
      registerModule: vi.fn(() => socketHandler),
    };

    return {
      socketHandler,
      isGMOnline,
      latency,
      failureRate,
    };
  }

  /**
   * Create mock for GM offline scenarios
   */
  static createOfflineGMScenario(): MockSocketLibResult {
    return this.createMockSocketLib({
      isGMOnline: false,
      latency: 100,
      failureRate: 0,
    });
  }

  /**
   * Create mock for high-latency scenarios
   */
  static createHighLatencyScenario(): MockSocketLibResult {
    return this.createMockSocketLib({
      isGMOnline: true,
      latency: 2000,
      failureRate: 0,
    });
  }

  /**
   * Create mock for unreliable network scenarios
   */
  static createUnreliableNetworkScenario(): MockSocketLibResult {
    return this.createMockSocketLib({
      isGMOnline: true,
      latency: 500,
      failureRate: 0.3, // 30% failure rate
    });
  }

  /**
   * Create mock native socket (fallback when SocketLib not available)
   */
  static createMockNativeSocket(): void {
    const mockSocket = {
      on: vi.fn(),
      emit: vi.fn(),
      off: vi.fn(),
    };

    (global as any).game = {
      ...(global as any).game,
      socket: mockSocket,
    };
  }

  /**
   * Create time log entry fixtures for testing
   */
  static createTimeLogEntryFixtures() {
    return {
      validEntry: {
        duration: 3600, // 1 hour in seconds
        description: 'Worked on character backstory',
        timestamp: Date.now(),
        requestedBy: 'player1',
        requestedByName: 'Player One',
      },

      invalidEntry: {
        duration: -100, // Negative duration
        description: '',
        timestamp: Date.now(),
        requestedBy: 'player1',
        requestedByName: 'Player One',
      },

      largeEntry: {
        duration: 86400, // 24 hours in seconds
        description: 'Extensive research project',
        timestamp: Date.now(),
        requestedBy: 'player2',
        requestedByName: 'Player Two',
      },
    };
  }

  /**
   * Create socket message fixtures for different scenarios
   */
  static createSocketMessageFixtures() {
    return {
      timeLogRequest: {
        type: 'requestTimeLog',
        data: {
          taskId: 'test-task-1',
          entry: this.createTimeLogEntryFixtures().validEntry,
          timestamp: Date.now(),
        },
      },

      progressRequest: {
        type: 'requestTaskProgress', 
        data: {
          taskId: 'test-task-1',
          userId: 'player1',
        },
      },

      notificationMessage: {
        type: 'notifyTimeLogUpdate',
        data: {
          taskId: 'test-task-1',
          taskName: 'Research Task',
          loggedBy: 'Player One',
          duration: { hours: 1 },
          isComplete: false,
        },
      },
    };
  }

  /**
   * Simulate socket communication delays and failures
   */
  static async simulateSocketDelay(
    operation: () => Promise<any>,
    scenario: 'fast' | 'slow' | 'timeout' | 'failure'
  ): Promise<any> {
    switch (scenario) {
      case 'fast':
        await new Promise(resolve => setTimeout(resolve, 10));
        return operation();

      case 'slow':
        await new Promise(resolve => setTimeout(resolve, 1000));
        return operation();

      case 'timeout':
        await new Promise(resolve => setTimeout(resolve, 5000));
        throw new Error('Socket operation timed out');

      case 'failure':
        await new Promise(resolve => setTimeout(resolve, 100));
        throw new Error('Socket communication failed');

      default:
        return operation();
    }
  }

  /**
   * Assert socket method was called with expected parameters
   */
  static assertSocketMethodCalled(
    mockHandler: MockSocketHandler,
    method: 'executeAsGM' | 'executeForEveryone' | 'register',
    expectedCall?: {
      methodName?: string;
      data?: any;
      times?: number;
    }
  ): void {
    const { methodName, data, times = 1 } = expectedCall || {};

    expect(mockHandler[method]).toHaveBeenCalledTimes(times);

    if (methodName && method !== 'register') {
      expect(mockHandler[method]).toHaveBeenCalledWith(
        methodName,
        data ? expect.objectContaining(data) : expect.any(Object)
      );
    }
  }

  /**
   * Wait for async socket operations to complete
   */
  static async waitForSocketOperations(): Promise<void> {
    // Allow multiple event loop cycles for socket operations
    await new Promise(resolve => setTimeout(resolve, 0));
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  /**
   * Create test scenarios for different GM availability states
   */
  static createGMAvailabilityScenarios() {
    return {
      gmOnline: () => this.createMockSocketLib({ isGMOnline: true }),
      gmOffline: () => this.createMockSocketLib({ isGMOnline: false }),
      gmSlow: () => this.createMockSocketLib({ isGMOnline: true, latency: 1000 }),
      gmUnreliable: () => this.createMockSocketLib({ 
        isGMOnline: true, 
        failureRate: 0.5 
      }),
    };
  }

  /**
   * Reset all socket mocks between tests
   */
  static resetSocketMocks(): void {
    if ((global as any).socketlib) {
      vi.clearAllMocks();
    }
    
    if ((global as any).game?.socket) {
      vi.clearAllMocks();
    }
  }

  /**
   * Create mock for SocketLib module availability check
   */
  static mockSocketLibAvailability(isAvailable: boolean): void {
    (global as any).game = {
      ...(global as any).game,
      modules: new Map([
        ['socketlib', { active: isAvailable }],
      ]),
    };

    if (isAvailable) {
      // Mock the Hooks.once callback for 'socketlib.ready'
      (global as any).Hooks = {
        ...(global as any).Hooks,
        once: vi.fn((event: string, callback: Function) => {
          if (event === 'socketlib.ready') {
            // Execute callback immediately in tests
            callback();
          }
        }),
      };
    }
  }
}