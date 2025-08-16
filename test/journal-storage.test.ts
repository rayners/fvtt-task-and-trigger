/**
 * Tests for JournalStorage class
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JournalStorage } from '../src/journal-storage';
import { Task } from '../src/types';
import './setup';

describe('JournalStorage', () => {
  let storage: JournalStorage;
  let mockTask: Task;
  let mockJournalEntry: any;
  let mockJournalPage: any;

  beforeEach(() => {
    // Clear singleton instance to ensure clean state
    (JournalStorage as any).instance = undefined;
    storage = JournalStorage.getInstance();

    mockTask = {
      id: 'test-task-1',
      name: 'Test Task',
      description: 'A test task',
      timeSpec: { minutes: 5 },
      targetTime: Date.now() / 1000 + 300,
      callback: 'console.log("Hello from task!");',
      useGameTime: false,
      recurring: false,
      scope: 'client',
      enabled: true,
      created: Date.now() / 1000,
      runCount: 0,
      logExecution: false,
    };

    // Mock journal page
    mockJournalPage = {
      id: 'page-id',
      name: 'World Tasks',
      system: {
        tasks: [mockTask],
        scope: 'world',
        version: '0.1.0',
        lastUpdated: Date.now() / 1000,
      },
      update: vi.fn().mockResolvedValue(true),
    };

    // Mock journal entry
    mockJournalEntry = {
      id: 'journal-id',
      name: 'Task & Trigger Configuration',
      pages: {
        getName: vi.fn().mockReturnValue(mockJournalPage),
        find: vi.fn().mockReturnValue(mockJournalPage),
        contents: [mockJournalPage],
      },
      createEmbeddedDocuments: vi.fn().mockResolvedValue([mockJournalPage]),
      ownership: { default: 0 },
    };

    // Mock game.journal
    (global as any).game.journal = {
      getName: vi.fn().mockReturnValue(mockJournalEntry),
      find: vi.fn().mockReturnValue(mockJournalEntry),
    };

    // Mock JournalEntry
    (global as any).JournalEntry = {
      create: vi.fn().mockResolvedValue(mockJournalEntry),
    };

    // Mock foundry.CONST
    (global as any).foundry.CONST = {
      DOCUMENT_OWNERSHIP_LEVELS: {
        OBSERVER: 1,
        OWNER: 3,
      },
    };
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const storage1 = JournalStorage.getInstance();
      const storage2 = JournalStorage.getInstance();
      expect(storage1).toBe(storage2);
    });
  });

  describe('loadTasks', () => {
    it('should load world tasks from journal', async () => {
      const tasks = await storage.loadTasks('world');

      expect(tasks).toHaveLength(1);
      expect(tasks[0]).toEqual(mockTask);
      expect(game.journal!.getName).toHaveBeenCalledWith('Task & Trigger Configuration');
    });

    it('should return empty array if journal does not exist', async () => {
      // Create fresh storage instance to avoid cached state
      (JournalStorage as any).instance = undefined;
      const freshStorage = JournalStorage.getInstance();

      (global as any).game.journal.getName = vi.fn().mockReturnValue(null);

      const tasks = await freshStorage.loadTasks('world');

      expect(tasks).toEqual([]);
    });

    it('should return empty array if page does not exist', async () => {
      mockJournalEntry.pages.getName = vi.fn().mockReturnValue(null);

      const tasks = await storage.loadTasks('world');

      expect(tasks).toEqual([]);
    });

    it('should handle client scope tasks', async () => {
      const clientPage = {
        ...mockJournalPage,
        name: 'Client Tasks - TestUser',
        system: {
          ...mockJournalPage.system,
          scope: 'client',
        },
      };
      mockJournalEntry.pages.getName = vi.fn().mockReturnValue(clientPage);

      const tasks = await storage.loadTasks('client');

      expect(tasks).toHaveLength(1);
      expect(mockJournalEntry.pages.getName).toHaveBeenCalledWith('Client Tasks - TestUser');
    });

    it('should handle malformed journal data', async () => {
      const malformedPage = {
        ...mockJournalPage,
        system: null,
      };
      mockJournalEntry.pages.getName = vi.fn().mockReturnValue(malformedPage);

      const tasks = await storage.loadTasks('world');

      expect(tasks).toEqual([]);
    });
  });

  describe('saveTasks', () => {
    it('should save tasks to existing journal page', async () => {
      const tasks = [mockTask];

      await storage.saveTasks(tasks, 'world');

      expect(mockJournalPage.update).toHaveBeenCalledWith({
        'system.tasks': tasks,
        'system.lastUpdated': expect.any(Number),
      });
    });

    it('should create journal if it does not exist', async () => {
      (global as any).game.journal.getName = vi.fn().mockReturnValue(null);

      const tasks = [mockTask];
      await storage.saveTasks(tasks, 'world');

      expect(JournalEntry.create).toHaveBeenCalledWith({
        name: 'Task & Trigger Configuration',
        ownership: { default: 1 },
      });
    });

    it('should create page if it does not exist', async () => {
      mockJournalEntry.pages.getName = vi.fn().mockReturnValue(null);

      const tasks = [mockTask];
      await storage.saveTasks(tasks, 'world');

      expect(mockJournalEntry.createEmbeddedDocuments).toHaveBeenCalledWith('JournalEntryPage', [
        {
          name: 'World Tasks',
          type: 'text', // Use text type since custom types require registration
          system: {
            tasks,
            scope: 'world',
            version: expect.any(String),
            lastUpdated: expect.any(Number),
          },
        },
      ]);
    });

    it('should handle client scope saves', async () => {
      const tasks = [mockTask];

      await storage.saveTasks(tasks, 'client');

      // Should look for client-specific page name
      expect(mockJournalEntry.pages.getName).toHaveBeenCalledWith('Client Tasks - TestUser');
    });

    it('should handle save errors gracefully', async () => {
      mockJournalPage.update = vi.fn().mockRejectedValue(new Error('Save failed'));

      const tasks = [mockTask];

      await expect(storage.saveTasks(tasks, 'world')).rejects.toThrow('Save failed');
    });
  });

  describe('getOrCreateConfigJournal', () => {
    it('should return existing journal', async () => {
      const journal = await storage.getOrCreateConfigJournal();

      expect(journal).toBe(mockJournalEntry);
      expect(game.journal!.getName).toHaveBeenCalledWith('Task & Trigger Configuration');
    });

    it('should create journal if it does not exist', async () => {
      (global as any).game.journal.getName = vi.fn().mockReturnValue(null);

      const journal = await storage.getOrCreateConfigJournal();

      expect(JournalEntry.create).toHaveBeenCalledWith({
        name: 'Task & Trigger Configuration',
        ownership: { default: 1 },
      });
      expect(journal).toBe(mockJournalEntry);
    });
  });

  describe('task operations', () => {
    it('should add a task', async () => {
      const newTask = { ...mockTask, id: 'new-task', name: 'New Task' };

      await storage.addTask(newTask);

      expect(mockJournalPage.update).toHaveBeenCalledWith({
        'system.tasks': [mockTask, newTask],
        'system.lastUpdated': expect.any(Number),
      });
    });

    it('should update a task', async () => {
      const updatedTask = { ...mockTask, name: 'Updated Task' };

      await storage.updateTask(updatedTask);

      expect(mockJournalPage.update).toHaveBeenCalledWith({
        'system.tasks': [updatedTask],
        'system.lastUpdated': expect.any(Number),
      });
    });

    it('should remove a task', async () => {
      await storage.removeTask(mockTask.id, mockTask.scope);

      expect(mockJournalPage.update).toHaveBeenCalledWith({
        'system.tasks': [],
        'system.lastUpdated': expect.any(Number),
      });
    });

    it('should get a specific task', async () => {
      const task = await storage.getTask(mockTask.id, mockTask.scope);

      expect(task).toEqual(mockTask);
    });

    it('should return null for non-existent task', async () => {
      const task = await storage.getTask('non-existent', 'world');

      expect(task).toBeNull();
    });
  });

  describe('data validation', () => {
    it('should validate task data structure', () => {
      const validTask = mockTask;
      const invalidTask = { id: 'test', name: 'test' }; // Missing required fields

      expect(storage.validateTask(validTask)).toBe(true);
      expect(storage.validateTask(invalidTask as any)).toBe(false);
    });

    it('should handle storage migration', async () => {
      const oldFormatPage = {
        ...mockJournalPage,
        system: {
          tasks: [mockTask],
          version: '0.0.1', // Old version
        },
      };

      mockJournalEntry.pages.getName = vi.fn().mockReturnValue(oldFormatPage);

      const tasks = await storage.loadTasks('world');

      // Should still load tasks despite version difference
      expect(tasks).toHaveLength(1);
    });
  });
});
