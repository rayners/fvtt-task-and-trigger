/**
 * Tests for AccumulatedTimeManager class
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AccumulatedTimeManager, AccumulatedTimeTaskOptions, TimeLogEntry } from '../src/accumulated-time-manager';
import { TaskManager } from '../src/task-manager';
import { JournalStorage } from '../src/journal-storage';
import { Task, TimeEntry } from '../src/types';
import './setup';

describe('AccumulatedTimeManager', () => {
  let accumulatedTimeManager: AccumulatedTimeManager;
  let mockTaskStorage: { world: Map<string, Task>, client: Map<string, Task> };

  beforeEach(() => {
    // Clear singleton instances
    (AccumulatedTimeManager as any).instance = undefined;
    (TaskManager as any).instance = undefined;
    (JournalStorage as any).instance = undefined;

    accumulatedTimeManager = AccumulatedTimeManager.getInstance();

    // Create task storage for mock persistence
    mockTaskStorage = {
      world: new Map<string, Task>(),
      client: new Map<string, Task>()
    };

    // Mock storage operations
    const storage = JournalStorage.getInstance();
    vi.spyOn(storage, 'addTask').mockImplementation(async (task: Task) => {
      mockTaskStorage[task.scope].set(task.id, task);
      return Promise.resolve();
    });
    
    vi.spyOn(storage, 'updateTask').mockImplementation(async (task: Task) => {
      if (!mockTaskStorage[task.scope].has(task.id)) {
        throw new Error(`Task not found: ${task.id}`);
      }
      mockTaskStorage[task.scope].set(task.id, task);
      return Promise.resolve();
    });
    
    vi.spyOn(storage, 'getTask').mockImplementation(async (taskId: string, scope: 'world' | 'client') => {
      return mockTaskStorage[scope].get(taskId) || null;
    });

    vi.spyOn(storage, 'loadTasks').mockImplementation(async (scope: 'world' | 'client') => {
      return Array.from(mockTaskStorage[scope].values());
    });

    vi.spyOn(storage, 'getAllTasks').mockImplementation(async () => {
      return {
        world: Array.from(mockTaskStorage.world.values()),
        client: Array.from(mockTaskStorage.client.values())
      };
    });

    // Mock TaskManager methods
    const taskManager = TaskManager.getInstance();
    vi.spyOn(taskManager, 'addTask').mockImplementation(async (task: Task) => {
      mockTaskStorage[task.scope].set(task.id, task);
      return Promise.resolve();
    });
    
    vi.spyOn(taskManager, 'updateTask').mockImplementation(async (task: Task) => {
      if (!mockTaskStorage[task.scope].has(task.id)) {
        throw new Error(`Task not found: ${task.id}`);
      }
      mockTaskStorage[task.scope].set(task.id, task);
      return Promise.resolve();
    });
    
    vi.spyOn(taskManager, 'getTask').mockImplementation(async (taskId: string) => {
      // Try both scopes
      return mockTaskStorage.client.get(taskId) || mockTaskStorage.world.get(taskId) || null;
    });

    vi.spyOn(taskManager, 'getAllTasks').mockImplementation(async () => {
      return {
        world: Array.from(mockTaskStorage.world.values()),
        client: Array.from(mockTaskStorage.client.values())
      };
    });
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const manager1 = AccumulatedTimeManager.getInstance();
      const manager2 = AccumulatedTimeManager.getInstance();
      expect(manager1).toBe(manager2);
    });
  });

  describe('createAccumulatedTimeTask', () => {
    it('should create an accumulated time task', async () => {
      const options: AccumulatedTimeTaskOptions = {
        name: 'Spell Research',
        description: 'Research a new spell',
        requiredTime: { hours: 15 },
        callback: 'console.log("Spell research complete!");',
        scope: 'client'
      };

      const taskId = await accumulatedTimeManager.createAccumulatedTimeTask(options);
      
      expect(taskId).toBeTruthy();
      expect(typeof taskId).toBe('string');

      // Verify task was stored
      const task = mockTaskStorage.client.get(taskId);
      expect(task).toBeTruthy();
      expect(task?.isAccumulatedTime).toBe(true);
      expect(task?.requiredTime).toBe(15 * 3600); // 15 hours in seconds
      expect(task?.accumulatedTime).toBe(0);
      expect(task?.timeEntries).toEqual([]);
    });

    it('should handle different time specifications', async () => {
      const options: AccumulatedTimeTaskOptions = {
        name: 'Crafting Project',
        requiredTime: { days: 2, hours: 4, minutes: 30 },
        callback: 'console.log("Crafting complete!");'
      };

      const taskId = await accumulatedTimeManager.createAccumulatedTimeTask(options);
      const task = mockTaskStorage.client.get(taskId);
      
      const expectedSeconds = (2 * 24 * 3600) + (4 * 3600) + (30 * 60);
      expect(task?.requiredTime).toBe(expectedSeconds);
    });
  });

  describe('addTime', () => {
    let taskId: string;

    beforeEach(async () => {
      const options: AccumulatedTimeTaskOptions = {
        name: 'Test Task',
        requiredTime: { hours: 10 },
        callback: 'console.log("Complete!");'
      };
      taskId = await accumulatedTimeManager.createAccumulatedTimeTask(options);
    });

    it('should add time to a task', async () => {
      const entry: TimeLogEntry = {
        duration: { hours: 3 },
        description: 'First work session'
      };

      const isComplete = await accumulatedTimeManager.addTime(taskId, entry);
      
      expect(isComplete).toBe(false);
      
      const task = mockTaskStorage.client.get(taskId);
      expect(task?.accumulatedTime).toBe(3 * 3600);
      expect(task?.timeEntries).toHaveLength(1);
      expect(task?.timeEntries?.[0].duration).toBe(3 * 3600);
      expect(task?.timeEntries?.[0].description).toBe('First work session');
    });

    it('should detect task completion', async () => {
      // Add enough time to complete the task
      const entry: TimeLogEntry = {
        duration: { hours: 10 },
        description: 'Marathon session'
      };

      const isComplete = await accumulatedTimeManager.addTime(taskId, entry);
      
      expect(isComplete).toBe(true);
      
      const task = mockTaskStorage.client.get(taskId);
      expect(task?.accumulatedTime).toBe(10 * 3600);
      expect(task?.targetTime).toBeGreaterThan(0); // Should be set for execution
    });

    it('should accumulate time across multiple entries', async () => {
      await accumulatedTimeManager.addTime(taskId, { duration: { hours: 3 } });
      await accumulatedTimeManager.addTime(taskId, { duration: { hours: 4 } });
      const isComplete = await accumulatedTimeManager.addTime(taskId, { duration: { hours: 3 } });

      expect(isComplete).toBe(true);
      
      const task = mockTaskStorage.client.get(taskId);
      expect(task?.accumulatedTime).toBe(10 * 3600);
      expect(task?.timeEntries).toHaveLength(3);
    });

    it('should reject negative durations', async () => {
      const entry: TimeLogEntry = {
        duration: { hours: -1 }
      };

      await expect(accumulatedTimeManager.addTime(taskId, entry)).rejects.toThrow('Duration must be positive');
    });

    it('should reject invalid task IDs', async () => {
      const entry: TimeLogEntry = {
        duration: { hours: 1 }
      };

      await expect(accumulatedTimeManager.addTime('invalid-id', entry)).rejects.toThrow('Task not found');
    });
  });

  describe('getTaskProgress', () => {
    let taskId: string;

    beforeEach(async () => {
      const options: AccumulatedTimeTaskOptions = {
        name: 'Progress Test',
        requiredTime: { hours: 20 },
        callback: 'console.log("Done!");'
      };
      taskId = await accumulatedTimeManager.createAccumulatedTimeTask(options);
    });

    it('should return progress information', async () => {
      await accumulatedTimeManager.addTime(taskId, { duration: { hours: 8 } });
      
      const progress = await accumulatedTimeManager.getTaskProgress(taskId);
      
      expect(progress).toBeTruthy();
      expect(progress?.progress).toBe(0.4); // 8/20 = 0.4
      expect(progress?.remaining).toBe(12 * 3600); // 12 hours remaining
      expect(progress?.isComplete).toBe(false);
      expect(progress?.timeEntries).toHaveLength(1);
    });

    it('should handle completed tasks', async () => {
      await accumulatedTimeManager.addTime(taskId, { duration: { hours: 25 } });
      
      const progress = await accumulatedTimeManager.getTaskProgress(taskId);
      
      expect(progress?.progress).toBe(1.0);
      expect(progress?.remaining).toBe(0);
      expect(progress?.isComplete).toBe(true);
    });

    it('should return null for invalid task', async () => {
      const progress = await accumulatedTimeManager.getTaskProgress('invalid-id');
      expect(progress).toBeNull();
    });
  });

  describe('listAccumulatedTimeTasks', () => {
    it('should list accumulated time tasks', async () => {
      // Create regular task
      const regularTask: Task = {
        id: 'regular-1',
        name: 'Regular Task',
        description: '',
        timeSpec: { minutes: 5 },
        targetTime: Date.now() + 300000,
        callback: 'console.log("regular");',
        useGameTime: false,
        recurring: false,
        scope: 'client',
        enabled: true,
        created: Date.now(),
        runCount: 0,
        logExecution: false
      };
      mockTaskStorage.client.set('regular-1', regularTask);

      // Create accumulated time task
      await accumulatedTimeManager.createAccumulatedTimeTask({
        name: 'Accumulated Task',
        requiredTime: { hours: 5 },
        callback: 'console.log("accumulated");'
      });

      const accumulatedTasks = await accumulatedTimeManager.listAccumulatedTimeTasks();
      
      expect(accumulatedTasks).toHaveLength(1);
      expect(accumulatedTasks[0].isAccumulatedTime).toBe(true);
    });

    it('should filter by scope', async () => {
      await accumulatedTimeManager.createAccumulatedTimeTask({
        name: 'Client Task',
        requiredTime: { hours: 5 },
        callback: 'console.log("client");',
        scope: 'client'
      });

      await accumulatedTimeManager.createAccumulatedTimeTask({
        name: 'World Task',
        requiredTime: { hours: 3 },
        callback: 'console.log("world");',
        scope: 'world'
      });

      const clientTasks = await accumulatedTimeManager.listAccumulatedTimeTasks('client');
      const worldTasks = await accumulatedTimeManager.listAccumulatedTimeTasks('world');

      expect(clientTasks).toHaveLength(1);
      expect(worldTasks).toHaveLength(1);
      expect(clientTasks[0].name).toBe('Client Task');
      expect(worldTasks[0].name).toBe('World Task');
    });
  });

  describe('time entry management', () => {
    let taskId: string;

    beforeEach(async () => {
      taskId = await accumulatedTimeManager.createAccumulatedTimeTask({
        name: 'Entry Management Test',
        requiredTime: { hours: 10 },
        callback: 'console.log("test");'
      });

      // Add some time entries
      await accumulatedTimeManager.addTime(taskId, { 
        duration: { hours: 2 }, 
        description: 'First session' 
      });
      await accumulatedTimeManager.addTime(taskId, { 
        duration: { hours: 3 }, 
        description: 'Second session' 
      });
    });

    it('should remove time entries', async () => {
      const task = mockTaskStorage.client.get(taskId);
      const entryId = task?.timeEntries?.[0]?.id;
      
      expect(entryId).toBeTruthy();
      
      const removed = await accumulatedTimeManager.removeTimeEntry(taskId, entryId!);
      
      expect(removed).toBe(true);
      
      const updatedTask = mockTaskStorage.client.get(taskId);
      expect(updatedTask?.timeEntries).toHaveLength(1);
      expect(updatedTask?.accumulatedTime).toBe(3 * 3600); // Only second session remains
    });

    it('should edit time entries', async () => {
      const task = mockTaskStorage.client.get(taskId);
      const entryId = task?.timeEntries?.[0]?.id;
      
      const edited = await accumulatedTimeManager.editTimeEntry(
        taskId, 
        entryId!, 
        { hours: 4 }, 
        'Updated first session'
      );
      
      expect(edited).toBe(true);
      
      const updatedTask = mockTaskStorage.client.get(taskId);
      const updatedEntry = updatedTask?.timeEntries?.find(e => e.id === entryId);
      
      expect(updatedEntry?.duration).toBe(4 * 3600);
      expect(updatedEntry?.description).toBe('Updated first session');
      expect(updatedTask?.accumulatedTime).toBe(7 * 3600); // 4 + 3 hours
    });
  });

  describe('exportTaskTimeLog', () => {
    let taskId: string;

    beforeEach(async () => {
      taskId = await accumulatedTimeManager.createAccumulatedTimeTask({
        name: 'Export Test',
        requiredTime: { hours: 10 },
        callback: 'console.log("export test");'
      });

      await accumulatedTimeManager.addTime(taskId, { 
        duration: { hours: 3 }, 
        description: 'Session 1' 
      });
      await accumulatedTimeManager.addTime(taskId, { 
        duration: { hours: 2, minutes: 30 }, 
        description: 'Session 2' 
      });
    });

    it('should export as CSV', async () => {
      const csvData = await accumulatedTimeManager.exportTaskTimeLog(taskId, 'csv');
      
      expect(csvData).toContain('Date,Duration (Hours),Description,Logged By');
      expect(csvData).toContain('3.00,"Session 1"');
      expect(csvData).toContain('2.50,"Session 2"');
    });

    it('should export as JSON', async () => {
      const jsonData = await accumulatedTimeManager.exportTaskTimeLog(taskId, 'json');
      const parsed = JSON.parse(jsonData);
      
      expect(parsed.taskName).toBe('Export Test');
      expect(parsed.entries).toHaveLength(2);
      expect(parsed.entries[0].description).toBe('Session 1');
      expect(parsed.entries[1].description).toBe('Session 2');
    });
  });

  describe('getTaskStatistics', () => {
    let taskId: string;

    beforeEach(async () => {
      taskId = await accumulatedTimeManager.createAccumulatedTimeTask({
        name: 'Stats Test',
        requiredTime: { hours: 20 },
        callback: 'console.log("stats");'
      });

      // Mock time entries with different durations
      const task = mockTaskStorage.client.get(taskId)!;
      const now = Math.floor(Date.now() / 1000);
      task.timeEntries = [
        { id: '1', timestamp: now - 86400, duration: 7200, description: 'Session 1' }, // 2 hours, 1 day ago
        { id: '2', timestamp: now - 3600, duration: 10800, description: 'Session 2' }, // 3 hours, 1 hour ago
        { id: '3', timestamp: now - 1800, duration: 3600, description: 'Session 3' } // 1 hour, 30 min ago
      ];
      task.accumulatedTime = 21600; // 6 total hours
    });

    it('should calculate statistics', async () => {
      const stats = await accumulatedTimeManager.getTaskStatistics(taskId);
      
      expect(stats?.totalEntries).toBe(3);
      expect(stats?.averageSessionDuration).toBe(7200); // (2 + 3 + 1) * 3600 / 3
      expect(stats?.longestSession).toBe(10800); // 3 hours
      expect(stats?.shortestSession).toBe(3600); // 1 hour
      expect(stats?.sessionsThisWeek).toBe(3);
    });
  });
});