/**
 * EventLogger - Automatically logs task executions to journal notes
 * Provides audit trail and debugging information for task execution
 */

import { Task, TaskExecutionResult } from './types';
import { JournalStorage } from './journal-storage';

export interface LogEntry {
  id: string;
  timestamp: number;
  taskId: string;
  taskName: string;
  executionType: 'success' | 'error' | 'timeout';
  duration: number;
  result?: any;
  error?: string;
  scope: 'world' | 'client';
  worldTime?: number;
  userTriggered: boolean;
}

export interface LoggerSettings {
  /** Whether logging is enabled */
  enabled: boolean;
  /** Maximum number of log entries to keep */
  maxEntries: number;
  /** Whether to log successful executions */
  logSuccesses: boolean;
  /** Whether to log failed executions */
  logErrors: boolean;
  /** Whether to create detailed logs with execution context */
  detailedLogging: boolean;
  /** Minimum execution duration (ms) to log */
  minDurationThreshold: number;
}

export class EventLogger {
  private static instance: EventLogger;
  private storage: JournalStorage;
  private settings: LoggerSettings;
  private isInitialized = false;

  private constructor() {
    this.storage = JournalStorage.getInstance();
    this.settings = this.getDefaultSettings();
  }

  static getInstance(): EventLogger {
    if (!this.instance) {
      this.instance = new EventLogger();
    }
    return this.instance;
  }

  /**
   * Initialize the event logger
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log('Task & Trigger | Initializing event logger');

    try {
      // Load settings from Foundry game settings
      await this.loadSettings();

      // Register settings if they don't exist
      this.registerSettings();

      this.isInitialized = true;
      console.log('Task & Trigger | Event logger initialized', { settings: this.settings });
    } catch (error) {
      console.error('Task & Trigger | Failed to initialize event logger:', error);
    }
  }

  /**
   * Log a task execution event
   */
  async logTaskExecution(
    task: Task,
    result: TaskExecutionResult,
    duration: number,
    userTriggered: boolean = false
  ): Promise<void> {
    if (!this.isInitialized || !this.settings.enabled) {
      return;
    }

    const executionType = result.success ? 'success' : result.timeout ? 'timeout' : 'error';

    // Check if we should log this type of execution
    if (executionType === 'success' && !this.settings.logSuccesses) {
      return;
    }
    if ((executionType === 'error' || executionType === 'timeout') && !this.settings.logErrors) {
      return;
    }

    // Check duration threshold
    if (duration < this.settings.minDurationThreshold) {
      return;
    }

    const logEntry: LogEntry = {
      id: foundry.utils.randomID(),
      timestamp: Math.floor(Date.now() / 1000),
      taskId: task.id,
      taskName: task.name,
      executionType,
      duration,
      result: result.success ? result.result : undefined,
      error: result.error || undefined,
      scope: task.scope,
      worldTime: task.useGameTime ? game.time?.worldTime : undefined,
      userTriggered,
    };

    try {
      await this.writeLogEntry(logEntry);

      // Emit hook for other modules to listen to
      Hooks.callAll('taskTriggerEventLogged', logEntry);
    } catch (error) {
      console.error('Task & Trigger | Failed to log task execution:', error);
    }
  }

  /**
   * Get recent log entries
   */
  async getRecentLogs(limit: number = 50): Promise<LogEntry[]> {
    try {
      const logs = await this.readLogEntries();
      return logs.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
    } catch (error) {
      console.error('Task & Trigger | Failed to get recent logs:', error);
      return [];
    }
  }

  /**
   * Get logs for a specific task
   */
  async getTaskLogs(taskId: string, limit: number = 20): Promise<LogEntry[]> {
    try {
      const logs = await this.readLogEntries();
      return logs
        .filter(log => log.taskId === taskId)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);
    } catch (error) {
      console.error('Task & Trigger | Failed to get task logs:', error);
      return [];
    }
  }

  /**
   * Get execution statistics
   */
  async getExecutionStats(days: number = 7): Promise<{
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    timeoutExecutions: number;
    averageDuration: number;
    executionsPerDay: { date: string; count: number }[];
    topFailingTasks: { taskId: string; taskName: string; failures: number }[];
  }> {
    try {
      const logs = await this.readLogEntries();
      const cutoffTime = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;
      const recentLogs = logs.filter(log => log.timestamp >= cutoffTime);

      const totalExecutions = recentLogs.length;
      const successfulExecutions = recentLogs.filter(log => log.executionType === 'success').length;
      const failedExecutions = recentLogs.filter(log => log.executionType === 'error').length;
      const timeoutExecutions = recentLogs.filter(log => log.executionType === 'timeout').length;

      const averageDuration =
        totalExecutions > 0
          ? recentLogs.reduce((sum, log) => sum + log.duration, 0) / totalExecutions
          : 0;

      // Group by day
      const executionsPerDay: { date: string; count: number }[] = [];
      const dayGroups = new Map<string, number>();

      for (const log of recentLogs) {
        const date = new Date(log.timestamp * 1000).toISOString().split('T')[0];
        dayGroups.set(date, (dayGroups.get(date) || 0) + 1);
      }

      for (const [date, count] of dayGroups) {
        executionsPerDay.push({ date, count });
      }
      executionsPerDay.sort((a, b) => a.date.localeCompare(b.date));

      // Top failing tasks
      const failureGroups = new Map<string, { taskName: string; failures: number }>();
      const failedLogs = recentLogs.filter(
        log => log.executionType === 'error' || log.executionType === 'timeout'
      );

      for (const log of failedLogs) {
        const existing = failureGroups.get(log.taskId);
        if (existing) {
          existing.failures++;
        } else {
          failureGroups.set(log.taskId, { taskName: log.taskName, failures: 1 });
        }
      }

      const topFailingTasks = Array.from(failureGroups.entries())
        .map(([taskId, data]) => ({ taskId, taskName: data.taskName, failures: data.failures }))
        .sort((a, b) => b.failures - a.failures)
        .slice(0, 10);

      return {
        totalExecutions,
        successfulExecutions,
        failedExecutions,
        timeoutExecutions,
        averageDuration,
        executionsPerDay,
        topFailingTasks,
      };
    } catch (error) {
      console.error('Task & Trigger | Failed to get execution stats:', error);
      return {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        timeoutExecutions: 0,
        averageDuration: 0,
        executionsPerDay: [],
        topFailingTasks: [],
      };
    }
  }

  /**
   * Clear old log entries
   */
  async cleanupLogs(): Promise<void> {
    if (!this.settings.enabled) {
      return;
    }

    try {
      const logs = await this.readLogEntries();
      if (logs.length <= this.settings.maxEntries) {
        return;
      }

      // Keep only the most recent entries
      const sortedLogs = logs.sort((a, b) => b.timestamp - a.timestamp);
      const logsToKeep = sortedLogs.slice(0, this.settings.maxEntries);

      await this.writeAllLogEntries(logsToKeep);

      const removedCount = logs.length - logsToKeep.length;
      console.log(`Task & Trigger | Cleaned up ${removedCount} old log entries`);
    } catch (error) {
      console.error('Task & Trigger | Failed to cleanup logs:', error);
    }
  }

  /**
   * Update logger settings
   */
  async updateSettings(newSettings: Partial<LoggerSettings>): Promise<void> {
    this.settings = { ...this.settings, ...newSettings };

    try {
      await game.settings?.set('task-and-trigger', 'eventLogger', this.settings);
      console.log('Task & Trigger | Updated event logger settings', this.settings);
    } catch (error) {
      console.error('Task & Trigger | Failed to save logger settings:', error);
    }
  }

  /**
   * Get current settings
   */
  getSettings(): LoggerSettings {
    return { ...this.settings };
  }

  /**
   * Check if logger is enabled and initialized
   */
  isEnabled(): boolean {
    return this.isInitialized && this.settings.enabled;
  }

  /**
   * Export logs for external analysis
   */
  async exportLogs(format: 'json' | 'csv' = 'json'): Promise<string> {
    try {
      const logs = await this.readLogEntries();

      if (format === 'csv') {
        const headers = [
          'timestamp',
          'taskId',
          'taskName',
          'executionType',
          'duration',
          'scope',
          'error',
        ];
        const csvRows = [headers.join(',')];

        for (const log of logs) {
          const row = [
            new Date(log.timestamp * 1000).toISOString(),
            log.taskId,
            `"${log.taskName.replace(/"/g, '""')}"`,
            log.executionType,
            log.duration.toString(),
            log.scope,
            log.error ? `"${log.error.replace(/"/g, '""')}"` : '',
          ];
          csvRows.push(row.join(','));
        }

        return csvRows.join('\n');
      } else {
        return JSON.stringify(logs, null, 2);
      }
    } catch (error) {
      console.error('Task & Trigger | Failed to export logs:', error);
      throw error;
    }
  }

  /**
   * Register Foundry game settings
   */
  private registerSettings(): void {
    if (!game.settings) {
      return;
    }

    try {
      game.settings.register('task-and-trigger', 'eventLogger', {
        name: 'Event Logger Settings',
        hint: 'Configuration for task execution logging',
        scope: 'world',
        config: false,
        type: Object,
        default: this.getDefaultSettings(),
      });
    } catch {
      console.warn('Task & Trigger | Settings may already be registered');
    }
  }

  /**
   * Load settings from Foundry
   */
  private async loadSettings(): Promise<void> {
    if (!game.settings) {
      return;
    }

    try {
      const savedSettings = (await game.settings.get(
        'task-and-trigger',
        'eventLogger'
      )) as LoggerSettings;
      this.settings = { ...this.getDefaultSettings(), ...savedSettings };
    } catch {
      console.log('Task & Trigger | Using default logger settings');
      this.settings = this.getDefaultSettings();
    }
  }

  /**
   * Get default logger settings
   */
  private getDefaultSettings(): LoggerSettings {
    return {
      enabled: true,
      maxEntries: 1000,
      logSuccesses: true,
      logErrors: true,
      detailedLogging: false,
      minDurationThreshold: 0,
    };
  }

  /**
   * Write a single log entry to storage
   */
  private async writeLogEntry(entry: LogEntry): Promise<void> {
    const logs = await this.readLogEntries();
    logs.push(entry);

    // Auto-cleanup if we exceed max entries
    if (logs.length > this.settings.maxEntries * 1.1) {
      const sortedLogs = logs.sort((a, b) => b.timestamp - a.timestamp);
      const logsToKeep = sortedLogs.slice(0, this.settings.maxEntries);
      await this.writeAllLogEntries(logsToKeep);
    } else {
      await this.writeAllLogEntries(logs);
    }
  }

  /**
   * Read all log entries from storage
   */
  private async readLogEntries(): Promise<LogEntry[]> {
    try {
      const data = await this.storage.readData('event-logs', 'world');
      return data?.logs || [];
    } catch (error) {
      console.warn('Task & Trigger | Failed to read log entries, returning empty array:', error);
      return [];
    }
  }

  /**
   * Write all log entries to storage
   */
  private async writeAllLogEntries(logs: LogEntry[]): Promise<void> {
    await this.storage.writeData('event-logs', 'world', {
      logs,
      lastUpdated: Math.floor(Date.now() / 1000),
      version: 1,
    });
  }

  /**
   * Shutdown the event logger
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    console.log('Task & Trigger | Shutting down event logger');

    // Final cleanup
    await this.cleanupLogs();

    this.isInitialized = false;
  }
}
