/**
 * Test file for socket-based accumulated time logging
 * Following TDD Red-Green-Refactor pattern for Phase 2
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TDDTestHelper } from './setup-tdd';
import { SocketTestPatterns, MockSocketLibResult } from './socket-test-patterns';

// These will be implemented in Phase 2
// @ts-expect-error - Class doesn't exist yet, this is intentional for TDD
import { SocketManager } from '../src/socket-manager';
import { AccumulatedTimeManager } from '../src/accumulated-time-manager';

describe('Socket-Based Time Logging', () => {
  let socketManager: any; // Will be properly typed once implemented
  let accumulatedTimeManager: AccumulatedTimeManager;
  let mockSocketLib: MockSocketLibResult;

  beforeEach(async () => {
    // Clear all mocks and singletons
    vi.clearAllMocks();
    TDDTestHelper.clearSingletonInstances();
    SocketTestPatterns.resetSocketMocks();

    // Setup mock SocketLib
    mockSocketLib = SocketTestPatterns.createMockSocketLib();
    SocketTestPatterns.mockSocketLibAvailability(true);

    // Setup global mocks needed for SocketManager
    (global as any).CONST = {
      CHAT_MESSAGE_TYPES: {
        OTHER: 0,
      },
    };

    (global as any).ChatMessage = {
      create: vi.fn(),
    };

    // Setup test instances
    accumulatedTimeManager = AccumulatedTimeManager.getInstance();
  });

  describe('SocketManager initialization', () => {
    it('should initialize with SocketLib when available', async () => {
      // Arrange
      SocketTestPatterns.mockSocketLibAvailability(true);

      // Act & Assert - This will fail initially (RED phase)
      // @ts-expect-error - Class doesn't exist yet, this is intentional for TDD
      socketManager = new SocketManager(accumulatedTimeManager);
      await socketManager.initialize();

      // Verify SocketLib was registered
      expect(mockSocketLib.socketHandler.register).toHaveBeenCalledWith(
        'requestTimeLog',
        expect.any(Function)
      );
      expect(mockSocketLib.socketHandler.register).toHaveBeenCalledWith(
        'notifyTimeLogUpdate',
        expect.any(Function)
      );
    });

    it('should fallback to native socket when SocketLib unavailable', async () => {
      // Arrange
      SocketTestPatterns.mockSocketLibAvailability(false);
      SocketTestPatterns.createMockNativeSocket();

      // Act & Assert
      // @ts-expect-error - Class doesn't exist yet, this is intentional for TDD
      socketManager = new SocketManager(accumulatedTimeManager);
      await socketManager.initialize();

      // Verify native socket was configured
      expect(game.socket.on).toHaveBeenCalledWith(
        'module.task-and-trigger',
        expect.any(Function)
      );
    });

    it('should register all required socket handlers', async () => {
      // Arrange & Act
      // @ts-expect-error - Class doesn't exist yet, this is intentional for TDD
      socketManager = new SocketManager(accumulatedTimeManager);
      await socketManager.initialize();

      // Assert
      const expectedHandlers = [
        'requestTimeLog',
        'notifyTimeLogUpdate', 
        'requestTaskProgress',
      ];

      expectedHandlers.forEach(handler => {
        expect(mockSocketLib.socketHandler.register).toHaveBeenCalledWith(
          handler,
          expect.any(Function)
        );
      });
    });
  });

  describe('Player time log requests', () => {
    beforeEach(async () => {
      // @ts-expect-error - Class doesn't exist yet, this is intentional for TDD
      socketManager = new SocketManager(accumulatedTimeManager);
      await socketManager.initialize();
    });

    it('should allow GM to log time directly without socket request', async () => {
      // Arrange
      TDDTestHelper.setupGameUserMock(TDDTestHelper.createMockGM());
      const taskId = 'test-task-1';
      const timeEntry = SocketTestPatterns.createTimeLogEntryFixtures().validEntry;

      // Mock successful time logging
      vi.spyOn(accumulatedTimeManager, 'addTime').mockResolvedValue(false);

      // Act & Assert
      const result = await socketManager.requestTimeLog(taskId, timeEntry);
      
      expect(result.success).toBe(true);
      expect(mockSocketLib.socketHandler.executeAsGM).not.toHaveBeenCalled();
    });

    it('should send socket request when player tries to log time', async () => {
      // Arrange
      TDDTestHelper.setupGameUserMock(TDDTestHelper.createMockPlayer('player1'));
      const taskId = 'test-task-1';
      const timeEntry = SocketTestPatterns.createTimeLogEntryFixtures().validEntry;

      // Act & Assert
      const result = await socketManager.requestTimeLog(taskId, timeEntry);
      
      expect(result.success).toBe(true);
      expect(mockSocketLib.socketHandler.executeAsGM).toHaveBeenCalledWith(
        'requestTimeLog',
        expect.objectContaining({
          taskId,
          entry: expect.objectContaining({
            ...timeEntry,
            requestedBy: 'player1',
            requestedByName: 'Player player1',
          }),
          timestamp: expect.any(Number),
        })
      );
    });

    it('should handle GM offline scenario gracefully', async () => {
      // Arrange
      TDDTestHelper.setupGameUserMock(TDDTestHelper.createMockPlayer('player1'));
      const taskId = 'test-task-1';
      const timeEntry = SocketTestPatterns.createTimeLogEntryFixtures().validEntry;

      // Mock executeAsGM to simulate GM offline
      socketManager.socketHandler = {
        executeAsGM: vi.fn().mockRejectedValue(new Error('GM is offline or unreachable')),
      };

      // Act & Assert
      const result = await socketManager.requestTimeLog(taskId, timeEntry);
      
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/GM.*offline|Failed to reach GM/i);
    });

    it('should handle high latency scenarios', async () => {
      // Arrange
      TDDTestHelper.setupGameUserMock(TDDTestHelper.createMockPlayer('player1'));
      const taskId = 'test-task-1';
      const timeEntry = SocketTestPatterns.createTimeLogEntryFixtures().validEntry;

      // Mock executeAsGM with delay
      socketManager.socketHandler = {
        executeAsGM: vi.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 1600));
          return { success: true };
        }),
      };

      // Act & Assert
      const startTime = Date.now();
      const result = await socketManager.requestTimeLog(taskId, timeEntry);
      const duration = Date.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(duration).toBeGreaterThan(1500); // Should take time due to latency
    });

    it('should include player identification in socket requests', async () => {
      // Arrange
      const mockPlayer = TDDTestHelper.createMockPlayer('player1');
      TDDTestHelper.setupGameUserMock(mockPlayer);
      const taskId = 'test-task-1';
      const timeEntry = SocketTestPatterns.createTimeLogEntryFixtures().validEntry;

      // Act
      await socketManager.requestTimeLog(taskId, timeEntry);

      // Assert
      expect(mockSocketLib.socketHandler.executeAsGM).toHaveBeenCalledWith(
        'requestTimeLog',
        expect.objectContaining({
          entry: expect.objectContaining({
            requestedBy: 'player1',
            requestedByName: 'Player player1',
          }),
        })
      );
    });
  });

  describe('GM-side time log processing', () => {
    beforeEach(async () => {
      // @ts-expect-error - Class doesn't exist yet, this is intentional for TDD
      socketManager = new SocketManager(accumulatedTimeManager);
      await socketManager.initialize();
    });

    it('should process valid time log requests from players', async () => {
      // Arrange
      TDDTestHelper.setupGameUserMock(TDDTestHelper.createMockGM());
      const requestData = {
        taskId: 'test-task-1',
        entry: SocketTestPatterns.createTimeLogEntryFixtures().validEntry,
        timestamp: Date.now(),
      };

      // Mock task progress and addTime
      vi.spyOn(accumulatedTimeManager, 'getTaskProgress').mockResolvedValue({
        task: {
          id: 'test-task-1',
          name: 'Test Task',
        } as any,
        progress: 0.5,
        remaining: 1800,
        isComplete: false,
        timeEntries: [],
      });
      vi.spyOn(accumulatedTimeManager, 'addTime').mockResolvedValue(false);

      // Mock socketHandler for notifications
      socketManager.socketHandler = {
        executeForEveryone: vi.fn(),
      };

      // Act & Assert
      const result = await socketManager.handleTimeLogRequest(requestData);
      
      expect(result.success).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it('should reject time log requests when not GM', async () => {
      // Arrange
      TDDTestHelper.setupGameUserMock(TDDTestHelper.createMockPlayer('player1'));
      const requestData = {
        taskId: 'test-task-1', 
        entry: SocketTestPatterns.createTimeLogEntryFixtures().validEntry,
        timestamp: Date.now(),
      };

      // Act & Assert
      const result = await socketManager.handleTimeLogRequest(requestData);
      
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/Only GM/i);
    });

    it('should validate task exists before processing time log', async () => {
      // Arrange
      TDDTestHelper.setupGameUserMock(TDDTestHelper.createMockGM());
      const requestData = {
        taskId: 'non-existent-task',
        entry: SocketTestPatterns.createTimeLogEntryFixtures().validEntry,
        timestamp: Date.now(),
      };

      // Mock that task is not found
      vi.spyOn(accumulatedTimeManager, 'getTaskProgress').mockResolvedValue(null);

      // Act & Assert
      const result = await socketManager.handleTimeLogRequest(requestData);
      
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/Task not found/i);
    });

    it('should notify all players when time is logged successfully', async () => {
      // Arrange
      TDDTestHelper.setupGameUserMock(TDDTestHelper.createMockGM());
      const requestData = {
        taskId: 'test-task-1',
        entry: SocketTestPatterns.createTimeLogEntryFixtures().validEntry,
        timestamp: Date.now(),
      };

      // Mock task existence
      vi.spyOn(accumulatedTimeManager, 'getTaskProgress').mockResolvedValue({
        task: {
          id: 'test-task-1',
          name: 'Test Task',
        } as any,
        progress: 0.5,
        remaining: 1800,
        isComplete: false,
        timeEntries: [],
      });
      vi.spyOn(accumulatedTimeManager, 'addTime').mockResolvedValue(false);

      // Act
      await socketManager.handleTimeLogRequest(requestData);

      // Assert
      expect(mockSocketLib.socketHandler.executeForEveryone).toHaveBeenCalledWith(
        'notifyTimeLogUpdate',
        expect.objectContaining({
          taskId: 'test-task-1',
          taskName: 'Test Task',
          loggedBy: requestData.entry.requestedByName,
          duration: requestData.entry.duration,
          isComplete: false,
        })
      );
    });

    it('should create chat message for transparency', async () => {
      // Arrange
      TDDTestHelper.setupGameUserMock(TDDTestHelper.createMockGM());
      const requestData = {
        taskId: 'test-task-1',
        entry: SocketTestPatterns.createTimeLogEntryFixtures().validEntry,
        timestamp: Date.now(),
      };

      // Mock ChatMessage.create
      (global as any).ChatMessage = {
        create: vi.fn(),
      };

      // Mock task existence
      vi.spyOn(accumulatedTimeManager, 'getTaskProgress').mockResolvedValue({
        task: {
          id: 'test-task-1',
          name: 'Test Task',
        } as any,
        progress: 0.5,
        remaining: 1800,
        isComplete: false,
        timeEntries: [],
      });
      vi.spyOn(accumulatedTimeManager, 'addTime').mockResolvedValue(false);

      // Act
      await socketManager.handleTimeLogRequest(requestData);

      // Assert
      expect(ChatMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringMatching(/Time logged.*Test Task/),
          type: expect.any(Number),
          speaker: expect.objectContaining({
            alias: 'Task & Trigger',
          }),
        })
      );
    });
  });

  describe('Player notifications', () => {
    beforeEach(async () => {
      // @ts-expect-error - Class doesn't exist yet, this is intentional for TDD
      socketManager = new SocketManager(accumulatedTimeManager);
      await socketManager.initialize();
    });

    it('should handle time log update notifications', async () => {
      // Arrange
      const notificationData = SocketTestPatterns.createSocketMessageFixtures().notificationMessage.data;

      // Mock ui.notifications
      (global as any).ui = {
        ...(global as any).ui,
        notifications: {
          ...((global as any).ui?.notifications || {}),
          info: vi.fn(),
        },
      };

      // Act
      await socketManager.handleTimeLogUpdate(notificationData);

      // Assert
      expect(ui.notifications.info).toHaveBeenCalledWith(
        expect.stringMatching(/Time logged.*Research Task.*Player One/)
      );
    });

    it('should call hooks for UI updates', async () => {
      // Arrange
      const notificationData = SocketTestPatterns.createSocketMessageFixtures().notificationMessage.data;

      // Act
      await socketManager.handleTimeLogUpdate(notificationData);

      // Assert
      expect(Hooks.callAll).toHaveBeenCalledWith(
        'taskTriggerTimeLogged',
        notificationData
      );
    });

    it('should show completion message when task is complete', async () => {
      // Arrange
      const notificationData = {
        ...SocketTestPatterns.createSocketMessageFixtures().notificationMessage.data,
        isComplete: true,
      };

      // Act
      await socketManager.handleTimeLogUpdate(notificationData);

      // Assert
      expect(ui.notifications.info).toHaveBeenCalledWith(
        expect.stringMatching(/Task.*completed/)
      );
    });
  });

  describe('Error handling and edge cases', () => {
    beforeEach(async () => {
      // @ts-expect-error - Class doesn't exist yet, this is intentional for TDD
      socketManager = new SocketManager(accumulatedTimeManager);
      await socketManager.initialize();
    });

    it('should handle malformed socket requests gracefully', async () => {
      // Arrange
      TDDTestHelper.setupGameUserMock(TDDTestHelper.createMockGM());
      const invalidRequestData = {
        // Missing required fields
        entry: {},
      };

      // Mock that task is not found
      vi.spyOn(accumulatedTimeManager, 'getTaskProgress').mockResolvedValue(null);

      // Act & Assert
      const result = await socketManager.handleTimeLogRequest(invalidRequestData as any);
      
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/Task not found/i);
    });

    it('should handle AccumulatedTimeManager errors', async () => {
      // Arrange
      TDDTestHelper.setupGameUserMock(TDDTestHelper.createMockGM());
      const requestData = {
        taskId: 'test-task-1',
        entry: SocketTestPatterns.createTimeLogEntryFixtures().validEntry,
        timestamp: Date.now(),
      };

      // Mock task exists but addTime fails
      vi.spyOn(accumulatedTimeManager, 'getTaskProgress').mockResolvedValue({
        task: {
          id: 'test-task-1',
          name: 'Test Task',
        } as any,
        progress: 0.5,
        remaining: 1800,
        isComplete: false,
        timeEntries: [],
      });
      vi.spyOn(accumulatedTimeManager, 'addTime').mockRejectedValue(
        new Error('Database error')
      );

      // Act & Assert
      const result = await socketManager.handleTimeLogRequest(requestData);
      
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/Database error/);
    });

    it('should handle socket timeout scenarios', async () => {
      // Arrange
      TDDTestHelper.setupGameUserMock(TDDTestHelper.createMockPlayer('player1'));
      mockSocketLib.socketHandler.executeAsGM.mockImplementation(
        () => new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Socket timeout')), 100)
        )
      );

      const taskId = 'test-task-1';
      const timeEntry = SocketTestPatterns.createTimeLogEntryFixtures().validEntry;

      // Act & Assert
      const result = await socketManager.requestTimeLog(taskId, timeEntry);
      
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/Socket timeout|Failed to reach GM/);
    });
  });
});