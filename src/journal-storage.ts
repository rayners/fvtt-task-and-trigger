/**
 * JournalStorage - Handles persistent storage of tasks using Foundry journal system
 */

import { Task, TaskStorageData } from './types';

export class JournalStorage {
  private static instance: JournalStorage;
  private static readonly JOURNAL_NAME = 'Task & Trigger Configuration';
  private static readonly CURRENT_VERSION = '0.1.0';

  private constructor() {}

  static getInstance(): JournalStorage {
    if (!this.instance) {
      this.instance = new JournalStorage();
    }
    return this.instance;
  }

  /**
   * Load tasks from journal storage
   * @param scope Either 'world' or 'client'
   * @returns Array of tasks
   */
  async loadTasks(scope: 'world' | 'client'): Promise<Task[]> {
    try {
      const journal = game.journal?.getName(JournalStorage.JOURNAL_NAME);
      
      if (!journal) {
        return [];
      }

      const pageName = this.getPageName(scope);
      const page = journal.pages?.getName(pageName);

      if (!page || !page.system?.tasks) {
        return [];
      }

      // Validate the loaded data
      const tasks = page.system.tasks.filter((task: any) => this.validateTask(task));
      
      return tasks;
    } catch (error) {
      console.error('Task & Trigger | Failed to load tasks:', error);
      return [];
    }
  }

  /**
   * Save tasks to journal storage
   * @param tasks Array of tasks to save
   * @param scope Either 'world' or 'client'
   */
  async saveTasks(tasks: Task[], scope: 'world' | 'client'): Promise<void> {
    try {
      const journal = await this.getOrCreateConfigJournal();
      const pageName = this.getPageName(scope);
      let page = journal.pages?.getName(pageName);

      const storageData = {
        tasks,
        scope,
        version: JournalStorage.CURRENT_VERSION,
        lastUpdated: Math.floor(Date.now() / 1000)
      };

      if (page) {
        // Update existing page
        await page.update({
          'system.tasks': tasks,
          'system.lastUpdated': storageData.lastUpdated
        });
      } else {
        // Create new page
        await journal.createEmbeddedDocuments('JournalEntryPage', [{
          name: pageName,
          type: 'text', // Use text type since custom types require registration
          system: storageData
        }]);
      }

      console.log(`Task & Trigger | Saved ${tasks.length} ${scope} tasks`);
    } catch (error) {
      console.error('Task & Trigger | Failed to save tasks:', error);
      throw error;
    }
  }

  /**
   * Add a single task
   * @param task Task to add
   */
  async addTask(task: Task): Promise<void> {
    const existingTasks = await this.loadTasks(task.scope);
    const updatedTasks = [...existingTasks, task];
    await this.saveTasks(updatedTasks, task.scope);
  }

  /**
   * Update an existing task
   * @param task Updated task data
   */
  async updateTask(task: Task): Promise<void> {
    const existingTasks = await this.loadTasks(task.scope);
    const taskIndex = existingTasks.findIndex(t => t.id === task.id);
    
    if (taskIndex >= 0) {
      existingTasks[taskIndex] = task;
      await this.saveTasks(existingTasks, task.scope);
    } else {
      throw new Error(`Task not found: ${task.id}`);
    }
  }

  /**
   * Remove a task
   * @param taskId ID of task to remove
   * @param scope Scope where task is stored
   */
  async removeTask(taskId: string, scope: 'world' | 'client'): Promise<void> {
    const existingTasks = await this.loadTasks(scope);
    const filteredTasks = existingTasks.filter(t => t.id !== taskId);
    await this.saveTasks(filteredTasks, scope);
  }

  /**
   * Get a specific task
   * @param taskId ID of task to get
   * @param scope Scope where task is stored
   * @returns Task or null if not found
   */
  async getTask(taskId: string, scope: 'world' | 'client'): Promise<Task | null> {
    const tasks = await this.loadTasks(scope);
    return tasks.find(t => t.id === taskId) ?? null;
  }

  /**
   * Get all tasks across all scopes
   * @returns Object with world and client task arrays
   */
  async getAllTasks(): Promise<{ world: Task[]; client: Task[] }> {
    const [worldTasks, clientTasks] = await Promise.all([
      this.loadTasks('world'),
      this.loadTasks('client')
    ]);

    return { world: worldTasks, client: clientTasks };
  }

  /**
   * Get or create the main configuration journal
   * @returns Journal entry for task storage
   */
  async getOrCreateConfigJournal(): Promise<any> {
    let journal = game.journal?.getName(JournalStorage.JOURNAL_NAME);
    
    if (!journal) {
      // Create new journal entry
      journal = await JournalEntry.create({
        name: JournalStorage.JOURNAL_NAME,
        ownership: { 
          default: (foundry as any)?.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OBSERVER ?? 1 
        }
      });
      
      console.log('Task & Trigger | Created configuration journal');
    }
    
    return journal;
  }

  /**
   * Get the page name for a given scope
   * @param scope Either 'world' or 'client'
   * @returns Page name string
   */
  private getPageName(scope: 'world' | 'client'): string {
    if (scope === 'world') {
      return 'World Tasks';
    } else {
      return `Client Tasks - ${game.user?.name ?? 'Unknown'}`;
    }
  }

  /**
   * Validate a task object has required properties
   * @param task Task object to validate
   * @returns True if valid, false otherwise
   */
  validateTask(task: any): task is Task {
    if (!task || typeof task !== 'object') {
      return false;
    }

    const requiredFields = [
      'id', 'name', 'timeSpec', 'targetTime', 'callback', 
      'useGameTime', 'recurring', 'scope', 'enabled', 'created', 'runCount'
    ];

    return requiredFields.every(field => task.hasOwnProperty(field));
  }

  /**
   * Clear all tasks for a given scope
   * @param scope Either 'world' or 'client'
   */
  async clearTasks(scope: 'world' | 'client'): Promise<void> {
    await this.saveTasks([], scope);
  }

  /**
   * Get storage statistics
   * @returns Object with task counts and storage info
   */
  async getStorageInfo(): Promise<{
    worldTasks: number;
    clientTasks: number;
    totalTasks: number;
    lastUpdated: number;
    version: string;
  }> {
    const { world, client } = await this.getAllTasks();
    
    return {
      worldTasks: world.length,
      clientTasks: client.length,
      totalTasks: world.length + client.length,
      lastUpdated: Math.floor(Date.now() / 1000),
      version: JournalStorage.CURRENT_VERSION
    };
  }

  /**
   * Export tasks to a JSON string
   * @param scope Optional scope to export, defaults to all
   * @returns JSON string of tasks
   */
  async exportTasks(scope?: 'world' | 'client'): Promise<string> {
    if (scope) {
      const tasks = await this.loadTasks(scope);
      return JSON.stringify({ [scope]: tasks }, null, 2);
    } else {
      const allTasks = await this.getAllTasks();
      return JSON.stringify(allTasks, null, 2);
    }
  }

  /**
   * Write generic data to journal storage
   * @param dataType Type/key for the data
   * @param scope Storage scope
   * @param data Data to store
   */
  async writeData(dataType: string, scope: 'world' | 'client', data: any): Promise<void> {
    try {
      const journal = await this.getOrCreateConfigJournal();
      const pageTitle = `${scope}-${dataType}-data`;
      
      // Find or create the page for this data type
      let page = journal.pages.find((p: any) => p.name === pageTitle);
      
      if (!page) {
        // Create new page
        await journal.createEmbeddedDocuments('JournalEntryPage', [{
          name: pageTitle,
          type: 'text',
          text: {
            content: JSON.stringify(data, null, 2)
          }
        }]);
      } else {
        // Update existing page
        await page.update({
          'text.content': JSON.stringify(data, null, 2)
        });
      }
    } catch (error) {
      console.error(`Task & Trigger | Failed to write ${dataType} data:`, error);
      throw error;
    }
  }

  /**
   * Read generic data from journal storage
   * @param dataType Type/key for the data
   * @param scope Storage scope
   * @returns Data or null if not found
   */
  async readData(dataType: string, scope: 'world' | 'client'): Promise<any> {
    try {
      const journal = await this.getOrCreateConfigJournal();
      const pageTitle = `${scope}-${dataType}-data`;
      
      const page = journal.pages.find((p: any) => p.name === pageTitle);
      if (!page) {
        return null;
      }

      const content = page.text?.content || '';
      if (!content.trim()) {
        return null;
      }

      return JSON.parse(content);
    } catch (error) {
      console.error(`Task & Trigger | Failed to read ${dataType} data:`, error);
      return null;
    }
  }

  /**
   * Import tasks from a JSON string
   * @param jsonData JSON string containing tasks
   * @param scope Scope to import to
   * @param merge Whether to merge with existing tasks or replace
   */
  async importTasks(
    jsonData: string, 
    scope: 'world' | 'client', 
    merge: boolean = false
  ): Promise<void> {
    try {
      const data = JSON.parse(jsonData);
      let tasksToImport: Task[] = [];

      // Handle different import formats
      if (Array.isArray(data)) {
        tasksToImport = data;
      } else if (data[scope] && Array.isArray(data[scope])) {
        tasksToImport = data[scope];
      } else {
        throw new Error('Invalid import format');
      }

      // Validate all tasks
      const validTasks = tasksToImport.filter(task => this.validateTask(task));
      
      if (validTasks.length === 0) {
        throw new Error('No valid tasks found in import data');
      }

      // Import tasks
      if (merge) {
        const existingTasks = await this.loadTasks(scope);
        const mergedTasks = [...existingTasks];
        
        // Add or update tasks (by ID)
        for (const importTask of validTasks) {
          const existingIndex = mergedTasks.findIndex(t => t.id === importTask.id);
          if (existingIndex >= 0) {
            mergedTasks[existingIndex] = importTask;
          } else {
            mergedTasks.push(importTask);
          }
        }
        
        await this.saveTasks(mergedTasks, scope);
      } else {
        await this.saveTasks(validTasks, scope);
      }

      console.log(`Task & Trigger | Imported ${validTasks.length} tasks to ${scope} scope`);
    } catch (error) {
      console.error('Task & Trigger | Failed to import tasks:', error);
      throw error;
    }
  }
}