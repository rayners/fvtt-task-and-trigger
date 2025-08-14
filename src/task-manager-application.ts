/**
 * TaskManagerApplication - UI for managing scheduled tasks
 * Provides tabbed interface with task creation, editing, and monitoring
 */

import { TaskScheduler, TaskInfo } from './task-scheduler';
import { TaskPersistence } from './task-persistence';
import { TimeSpec } from './types';

export interface TaskFormData {
  name: string;
  description: string;
  timeSpec: TimeSpec;
  callback: string;
  useGameTime: boolean;
  recurring: boolean;
  scope: 'world' | 'client';
  logExecution: boolean;
  enabled: boolean;
}

export class TaskManagerApplication extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  private scheduler: TaskScheduler;
  private persistence: TaskPersistence;
  private activeTab: string = 'tasks';
  private tasks: TaskInfo[] = [];
  private statistics: any = {};
  private refreshTimer?: NodeJS.Timeout;
  private hideCompleted: boolean = false;

  // Settings state
  private settings = {
    defaultScope: 'client' as 'client' | 'world',
    autoCleanup: false,
    executionLogging: false,
  };

  constructor(options: Partial<foundry.applications.api.ApplicationV2.Configuration> = {}) {
    super(options);
    this.scheduler = TaskScheduler.getInstance();
    this.persistence = TaskPersistence.getInstance();
    this.loadSettings();
  }

  /** @override */
  static DEFAULT_OPTIONS: Partial<foundry.applications.api.ApplicationV2.Configuration> = {
    id: 'task-manager',
    tag: 'div',
    window: {
      title: 'Task & Trigger Manager',
      resizable: true,
      minimizable: true,
      positioned: true,
    },
    position: {
      width: 800,
      height: 600,
    },
    classes: ['task-manager-app'],
    actions: {
      changeTab: TaskManagerApplication.prototype.onChangeTab,
      createTask: TaskManagerApplication.prototype.onCreateTask,
      editTask: TaskManagerApplication.prototype.onEditTask,
      deleteTask: TaskManagerApplication.prototype.onDeleteTask,
      toggleTask: TaskManagerApplication.prototype.onToggleTask,
      executeTask: TaskManagerApplication.prototype.onExecuteTask,
      filterChange: TaskManagerApplication.prototype.onFilterChange,
      sortChange: TaskManagerApplication.prototype.onSortChange,
      selectAll: TaskManagerApplication.prototype.onSelectAll,
      bulkEnable: TaskManagerApplication.prototype.onBulkEnable,
      bulkDisable: TaskManagerApplication.prototype.onBulkDisable,
      bulkDelete: TaskManagerApplication.prototype.onBulkDelete,
      refresh: TaskManagerApplication.prototype.onRefresh,
      cleanup: TaskManagerApplication.prototype.onCleanup,
      import: TaskManagerApplication.prototype.onImport,
      export: TaskManagerApplication.prototype.onExport,
      saveSettings: TaskManagerApplication.prototype.onSaveSettings,
      resetSettings: TaskManagerApplication.prototype.onResetSettings,
    },
  };

  static PARTS = {
    content: {
      template: 'modules/task-and-trigger/templates/task-manager.hbs',
    },
  };

  /** @override */
  async _prepareContext(
    _options: Partial<foundry.applications.api.ApplicationV2.RenderOptions>
  ): Promise<any> {
    // Refresh task data
    await this.refreshData();

    // Filter tasks based on hideCompleted setting
    const filteredTasks = this.hideCompleted ? this.tasks.filter(task => task.enabled) : this.tasks;

    return {
      activeTab: this.activeTab,
      tasks: filteredTasks,
      statistics: this.statistics,
      isGM: game.user?.isGM || false,
      canCreateWorldTasks: game.user?.isGM || false,
      hideCompleted: this.hideCompleted,
      settings: this.settings,
      timeOptions: this.getTimeOptions(),
      scopeOptions: [
        { value: 'client', label: 'Client (Personal)' },
        { value: 'world', label: 'World (Shared)' },
      ],
    };
  }

  /** @override */
  _onRender(
    context: any,
    options: Partial<foundry.applications.api.ApplicationV2.RenderOptions>
  ): void {
    super._onRender(context, options);

    // Start real-time updates after render
    this.startRefreshTimer();
  }

  /** @override */
  async close(options: any = {}): Promise<void> {
    this.stopRefreshTimer();
    return super.close(options);
  }

  /**
   * Handle tab changes
   */
  async onChangeTab(event: Event, _target: HTMLElement): Promise<void> {
    event.preventDefault();
    const tab = _target.dataset.tab;
    this.activeTab = tab || 'tasks';
    await this.render({ force: false });
  }

  /**
   * Handle create task button
   */
  async onCreateTask(event: Event, _target: HTMLElement): Promise<void> {
    event.preventDefault();
    await this.showTaskForm();
  }

  /**
   * Handle edit task button
   */
  async onEditTask(event: Event, _target: HTMLElement): Promise<void> {
    event.preventDefault();
    const taskItem = _target.closest('.task-item') as HTMLElement;
    const taskId = taskItem?.dataset.taskId;
    const task = this.tasks.find(t => t.id === taskId);
    if (task) {
      await this.showTaskForm(task);
    }
  }

  /**
   * Handle delete task button
   */
  async onDeleteTask(event: Event, _target: HTMLElement): Promise<void> {
    event.preventDefault();
    const taskItem = _target.closest('.task-item') as HTMLElement;
    const taskId = taskItem?.dataset.taskId;
    const task = this.tasks.find(t => t.id === taskId);

    if (!task || !taskId) return;

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: 'Delete Task' },
      content: `<p>Are you sure you want to delete the task "<strong>${task.name}</strong>"?</p>
                <p>This action cannot be undone.</p>`,
    });

    if (confirmed) {
      await this.scheduler.cancel(taskId);
      ui.notifications?.info(`Deleted task: ${task.name}`);
      await this.render({ force: false });
    }
  }

  /**
   * Handle toggle task enabled/disabled
   */
  async onToggleTask(event: Event, _target: HTMLElement): Promise<void> {
    event.preventDefault();
    const taskItem = _target.closest('.task-item') as HTMLElement;
    const taskId = taskItem?.dataset.taskId;
    const task = this.tasks.find(t => t.id === taskId);

    if (!task || !taskId) return;

    if (task.enabled) {
      await this.scheduler.disable(taskId);
      ui.notifications?.info(`Disabled task: ${task.name}`);
    } else {
      await this.scheduler.enable(taskId);
      ui.notifications?.info(`Enabled task: ${task.name}`);
    }

    await this.render({ force: false });
  }

  /**
   * Handle filter changes
   */
  async onFilterChange(event: Event, _target: HTMLElement): Promise<void> {
    // Handle hide completed checkbox specifically
    if (_target.id === 'hide-completed') {
      const checkbox = _target as HTMLInputElement;
      this.hideCompleted = checkbox.checked;
    }

    await this.render({ force: false });
  }

  /**
   * Handle sort changes
   */
  async onSortChange(_event: Event, _target: HTMLElement): Promise<void> {
    await this.render({ force: false });
  }

  /**
   * Handle execute task immediately
   */
  async onExecuteTask(event: Event, _target: HTMLElement): Promise<void> {
    event.preventDefault();
    const taskItem = _target.closest('.task-item') as HTMLElement;
    const taskId = taskItem?.dataset.taskId;
    const task = this.tasks.find(t => t.id === taskId);

    if (!task) return;

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: 'Execute Task Now' },
      content: `<p>Execute the task "<strong>${task.name}</strong>" immediately?</p>
                <p>This will run the task's JavaScript code right now.</p>`,
    });

    if (confirmed) {
      try {
        const _immediateTaskId = await this.scheduler.setTimeout({ seconds: 0 }, task.id, {
          scope: 'client',
        });
        ui.notifications?.info(`Executing task: ${task.name}`);
      } catch (error) {
        ui.notifications?.error(`Failed to execute task: ${error}`);
      }
    }
  }

  /**
   * Handle select all checkbox
   */
  onSelectAll(event: Event, _target: HTMLElement): void {
    const checked = (_target as HTMLInputElement).checked;
    const checkboxes = this.element.querySelectorAll(
      '.task-checkbox'
    ) as NodeListOf<HTMLInputElement>;
    checkboxes.forEach(cb => (cb.checked = checked));
  }

  /**
   * Handle bulk enable
   */
  async onBulkEnable(event: Event, _target: HTMLElement): Promise<void> {
    event.preventDefault();
    const selectedIds = this.getSelectedTaskIds();

    if (selectedIds.length === 0) {
      ui.notifications?.warn('No tasks selected');
      return;
    }

    for (const taskId of selectedIds) {
      await this.scheduler.enable(taskId);
    }

    ui.notifications?.info(`Enabled ${selectedIds.length} tasks`);
    await this.render({ force: false });
  }

  /**
   * Handle bulk disable
   */
  async onBulkDisable(event: Event, _target: HTMLElement): Promise<void> {
    event.preventDefault();
    const selectedIds = this.getSelectedTaskIds();

    if (selectedIds.length === 0) {
      ui.notifications?.warn('No tasks selected');
      return;
    }

    for (const taskId of selectedIds) {
      await this.scheduler.disable(taskId);
    }

    ui.notifications?.info(`Disabled ${selectedIds.length} tasks`);
    await this.render({ force: false });
  }

  /**
   * Handle bulk delete
   */
  async onBulkDelete(event: Event, _target: HTMLElement): Promise<void> {
    event.preventDefault();
    const selectedIds = this.getSelectedTaskIds();

    if (selectedIds.length === 0) {
      ui.notifications?.warn('No tasks selected');
      return;
    }

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: 'Delete Multiple Tasks' },
      content: `<p>Are you sure you want to delete ${selectedIds.length} selected tasks?</p>
                <p>This action cannot be undone.</p>`,
    });

    if (confirmed) {
      for (const taskId of selectedIds) {
        await this.scheduler.cancel(taskId);
      }

      ui.notifications?.info(`Deleted ${selectedIds.length} tasks`);
      await this.render({ force: false });
    }
  }

  /**
   * Handle refresh button
   */
  async onRefresh(event: Event, _target: HTMLElement): Promise<void> {
    event.preventDefault();
    await this.render({ force: false });
    ui.notifications?.info('Tasks refreshed');
  }

  /**
   * Handle cleanup button
   */
  async onCleanup(event: Event, _target: HTMLElement): Promise<void> {
    event.preventDefault();

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: 'Clean Up Old Tasks' },
      content: `<p>This will remove old, disabled, ephemeral tasks (older than 7 days).</p>
                <p>UI-configured tasks will not be affected.</p>`,
    });

    if (confirmed) {
      const cleanedCount = await this.persistence.cleanupOldTasks(7);
      ui.notifications?.info(`Cleaned up ${cleanedCount} old tasks`);
      await this.render({ force: false });
    }
  }

  /**
   * Handle import button
   */
  async onImport(event: Event, _target: HTMLElement): Promise<void> {
    event.preventDefault();

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.addEventListener('change', async e => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const _text = await file.text();
        // This would require extending the storage API for imports
        ui.notifications?.info('Import functionality coming soon!');
      } catch (error) {
        ui.notifications?.error(`Failed to import tasks: ${error}`);
      }
    });

    input.click();
  }

  /**
   * Handle export button
   */
  async onExport(event: Event, _target: HTMLElement): Promise<void> {
    event.preventDefault();

    try {
      // This would require extending the storage API for exports
      const tasks = await this.scheduler.listTasks();
      const dataStr = JSON.stringify(tasks, null, 2);

      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = 'task-trigger-tasks.json';
      a.click();

      URL.revokeObjectURL(url);
      ui.notifications?.info('Tasks exported successfully');
    } catch (error) {
      ui.notifications?.error(`Failed to export tasks: ${error}`);
    }
  }

  /**
   * Handle task form submission
   */
  private async onSubmitTaskForm(event: SubmitEvent): Promise<void> {
    event.preventDefault();

    // Find the dialog element to close it later
    const dialogElement = (event.target as HTMLElement).closest('.dialog');
    let dialogInstance = null;
    if (dialogElement) {
      // Try to find the DialogV2 instance
      dialogInstance = (dialogElement as any).application;
    }

    const formData = new FormData(event.currentTarget as HTMLFormElement);
    const taskData = this.parseTaskFormData(formData);

    try {
      let taskId: string;

      if (taskData.recurring) {
        if (taskData.useGameTime) {
          taskId = await this.scheduler.setGameInterval(taskData.timeSpec, taskData.callback, {
            name: taskData.name,
            description: taskData.description,
            scope: taskData.scope,
            logExecution: taskData.logExecution,
          });
        } else {
          taskId = await this.scheduler.setInterval(taskData.timeSpec, taskData.callback, {
            name: taskData.name,
            description: taskData.description,
            scope: taskData.scope,
            logExecution: taskData.logExecution,
          });
        }
      } else {
        if (taskData.useGameTime) {
          taskId = await this.scheduler.setGameTimeout(taskData.timeSpec, taskData.callback, {
            name: taskData.name,
            description: taskData.description,
            scope: taskData.scope,
            logExecution: taskData.logExecution,
          });
        } else {
          taskId = await this.scheduler.setTimeout(taskData.timeSpec, taskData.callback, {
            name: taskData.name,
            description: taskData.description,
            scope: taskData.scope,
            logExecution: taskData.logExecution,
          });
        }
      }

      // Mark as UI-configured for persistence
      await this.persistence.markAsUIConfigured(taskId);

      ui.notifications?.info(`Created task: ${taskData.name}`);
      await this.render({ force: false });

      // Close the dialog
      if (dialogInstance && dialogInstance.close) {
        dialogInstance.close();
      }
    } catch (error) {
      ui.notifications?.error(`Failed to create task: ${error}`);
    }
  }

  /**
   * Handle game time toggle
   */
  private onGameTimeToggle(event: Event): void {
    const target = event.currentTarget as HTMLInputElement;
    const useGameTime = target.checked;
    const form = target.closest('.task-form');

    // Update time input hints
    const timeHelp = form?.querySelector('.time-input-help');
    if (timeHelp) {
      if (useGameTime) {
        timeHelp.textContent = 'Game time - relative to world time progression';
      } else {
        timeHelp.textContent = 'Real time - relative to actual clock time';
      }
    }
  }

  /**
   * Handle recurring toggle
   */
  private onRecurringToggle(event: Event): void {
    const target = event.currentTarget as HTMLInputElement;
    const recurring = target.checked;
    const form = target.closest('.task-form');

    // Update labels and help text
    const timeLabel = form?.querySelector('.time-input-label');
    if (timeLabel) {
      if (recurring) {
        timeLabel.textContent = 'Interval:';
      } else {
        timeLabel.textContent = 'Delay:';
      }
    }
  }

  /**
   * Show task creation/editing form
   */
  private async showTaskForm(task?: TaskInfo): Promise<void> {
    const template = 'modules/task-and-trigger/templates/task-form.hbs';

    // Check if there's a context date from calendar integration
    const contextDate = (this as any)._contextDate;
    let defaultDateTime = '';
    let useAbsoluteTime = false;
    let contextCalendarDate = null;

    if (contextDate && !task) {
      // Convert calendar date to datetime-local format (YYYY-MM-DDTHH:MM)
      const year = contextDate.year;
      const month = String(contextDate.month || 1).padStart(2, '0');
      const day = String(contextDate.day || 1).padStart(2, '0');
      // Default to 9:00 AM for the selected date
      defaultDateTime = `${year}-${month}-${day}T09:00`;
      useAbsoluteTime = true;
      contextCalendarDate = contextDate;

      // Clear the context date after using it
      (this as any)._contextDate = null;
    }

    const data = {
      task,
      isEdit: !!task,
      timeOptions: this.getTimeOptions(),
      scopeOptions: [
        { value: 'client', label: 'Client (Personal)' },
        { value: 'world', label: 'World (Shared)' },
      ],
      // Add context data for calendar integration
      defaultDateTime,
      useAbsoluteTime,
      contextCalendarDate,
      // Add helper functions for the template
      formatDateTime: (dateTimeString: string) => {
        if (!dateTimeString) return '';

        // If we have the original calendar date, use that with S&S formatting
        if (contextCalendarDate) {
          try {
            const seasonsStars = (game as any).seasonsStars;
            if (seasonsStars?.manager) {
              const engine = seasonsStars.manager.getActiveEngine();
              if (engine && engine.formatDate) {
                // Convert calendar date to world time using S&S's own conversion
                const worldTime = engine.calendarDateToWorldTime
                  ? engine.calendarDateToWorldTime(contextCalendarDate)
                  : engine.getWorldTimeFromDate
                    ? engine.getWorldTimeFromDate(contextCalendarDate)
                    : null;

                if (worldTime !== null) {
                  return engine.formatDate(worldTime);
                }
              }
            }
          } catch (ssError) {
            console.warn('Task & Trigger | Could not use S&S calendar date formatting:', ssError);
          }

          // Fallback for calendar date: show the raw calendar components
          return `${contextCalendarDate.year}/${contextCalendarDate.month || 1}/${contextCalendarDate.day || 1}`;
        }

        // Standard datetime string processing (for non-calendar dates)
        try {
          const date = new Date(dateTimeString + ':00'); // Add seconds if missing

          // Try to use Seasons & Stars date formatting if available
          try {
            const seasonsStars = (game as any).seasonsStars;
            if (seasonsStars?.manager) {
              const engine = seasonsStars.manager.getActiveEngine();
              if (engine && engine.formatDate) {
                // Convert to world time for S&S formatting
                const worldTime = Math.floor(date.getTime() / 1000);
                return engine.formatDate(worldTime);
              }
            }
          } catch (ssError) {
            console.warn('Task & Trigger | Could not use S&S date formatting:', ssError);
          }

          // Fallback to standard date formatting (no time since it's from calendar)
          return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
        } catch (_error) {
          return dateTimeString; // Fallback to raw string
        }
      },
    };

    const html = await foundry.applications.handlebars.renderTemplate(template, data);

    // Use legacy Dialog - works better with our CSS
    new Dialog({
      title: task ? 'Edit Task' : 'Create Task',
      content: html,
      buttons: {
        save: {
          label: task ? 'Update' : 'Create',
          callback: (html: JQuery) => {
            const form = html.find('.task-form')[0] as HTMLFormElement;
            if (form) {
              const submitEvent = new Event('submit', { cancelable: true, bubbles: true });
              form.dispatchEvent(submitEvent);
            }
          },
        },
        cancel: {
          label: 'Cancel',
          callback: () => {},
        },
      },
      default: 'save',
      render: (html: JQuery) => {
        // Activate form listeners for the dialog
        const form = html.find('.task-form')[0] as HTMLFormElement;
        if (form) {
          form.addEventListener('submit', this.onSubmitTaskForm.bind(this));
        }

        const gameTimeToggle = html.find('.use-game-time')[0] as HTMLInputElement;
        if (gameTimeToggle) {
          gameTimeToggle.addEventListener('change', this.onGameTimeToggle.bind(this));
        }

        const recurringToggle = html.find('.recurring')[0] as HTMLInputElement;
        if (recurringToggle) {
          recurringToggle.addEventListener('change', this.onRecurringToggle.bind(this));
        }

        // Initialize Foundry's tabs system
        const tabs = new foundry.applications.ux.Tabs({
          navSelector: '.tabs',
          contentSelector: '.tab-content',
          initial: 'when',
        });
        tabs.bind(html[0]);

        // Add example button handlers
        this.bindExampleButtons(html);

        // Add test code button handler
        const testButton = html.find('.test-code')[0];
        if (testButton) {
          testButton.addEventListener('click', this.onTestCode.bind(this, html));
        }
      },
    }).render(true, { width: 800, height: 'auto', classes: ['task-form-dialog'] });
  }

  /**
   * Bind example button event handlers
   */
  private bindExampleButtons(html: JQuery): void {
    // Get the code examples from the script template
    const examplesScript = html.find('#code-examples')[0];
    if (!examplesScript) return;

    let examples: Record<string, string>;
    try {
      examples = JSON.parse(examplesScript.textContent || '{}');
    } catch (error) {
      console.error('Failed to parse code examples:', error);
      return;
    }

    // Add click handlers to example buttons
    html.find('.example-button').each((index, button) => {
      const exampleType = button.dataset.example;
      if (exampleType && examples[exampleType]) {
        button.addEventListener('click', () => {
          const textarea = html.find('#task-callback')[0] as HTMLTextAreaElement;
          if (textarea) {
            // Insert the example code, replacing any existing content
            textarea.value = examples[exampleType];
            textarea.focus();
          }
        });
      }
    });
  }

  /**
   * Handle test code button
   */
  private onTestCode(html: JQuery, event: Event): void {
    event.preventDefault();

    const textarea = html.find('#task-callback')[0] as HTMLTextAreaElement;
    const code = textarea?.value?.trim();

    if (!code) {
      ui.notifications?.warn('No JavaScript code to test');
      return;
    }

    try {
      // Create a safe test environment
      const testFunction = new Function(
        'game',
        'ui',
        'canvas',
        'foundry',
        'Hooks',
        'ChatMessage',
        code
      );

      // Execute the code in a try-catch
      const result = testFunction(game, ui, canvas, foundry, Hooks, ChatMessage);

      // If it's a promise, handle it
      if (result instanceof Promise) {
        result
          .then(() => {
            ui.notifications?.info('Code test completed successfully');
          })
          .catch(error => {
            ui.notifications?.error(`Code test failed: ${error.message}`);
          });
      } else {
        ui.notifications?.info('Code test completed successfully');
      }
    } catch (error: any) {
      ui.notifications?.error(`Code test failed: ${error.message}`);
      console.error('Task code test error:', error);
    }
  }

  /**
   * Refresh task data
   */
  private async refreshData(): Promise<void> {
    try {
      this.tasks = await this.scheduler.listTasks();
      this.statistics = await this.scheduler.getStatistics();
    } catch (error) {
      console.error('Failed to refresh task data:', error);
    }
  }

  /**
   * Start refresh timer for real-time updates
   */
  private startRefreshTimer(): void {
    this.refreshTimer = setInterval(async () => {
      try {
        await this.refreshData();
        // Only re-render if we're on the tasks tab
        if (this.activeTab === 'tasks') {
          this.render({ force: false });
        }
      } catch (error) {
        console.error('Task Manager refresh failed:', error);
      }
    }, 10000); // Refresh every 10 seconds
  }

  /**
   * Stop refresh timer
   */
  private stopRefreshTimer(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  /**
   * Get selected task IDs
   */
  private getSelectedTaskIds(): string[] {
    const ids: string[] = [];
    const checkboxes = this.element.querySelectorAll(
      '.task-checkbox:checked'
    ) as NodeListOf<HTMLInputElement>;
    checkboxes.forEach(checkbox => {
      const taskItem = checkbox.closest('.task-item') as HTMLElement;
      const taskId = taskItem?.dataset.taskId;
      if (taskId) ids.push(taskId);
    });
    return ids;
  }

  /**
   * Parse task form data
   */
  private parseTaskFormData(formData: FormData): TaskFormData {
    const timeSpec = this.parseTimeSpec(formData);

    return {
      name: (formData.get('name') as string) || 'Unnamed Task',
      description: (formData.get('description') as string) || '',
      timeSpec,
      callback: (formData.get('callback') as string) || '',
      useGameTime: formData.get('useGameTime') === 'on',
      recurring: formData.get('recurring') === 'on',
      scope: (formData.get('scope') as 'world' | 'client') || 'client',
      logExecution: formData.get('logExecution') === 'on',
      enabled: formData.get('enabled') !== 'off',
    };
  }

  /**
   * Parse time specification from form data
   */
  private parseTimeSpec(formData: FormData): TimeSpec {
    const timeType = formData.get('timeType') as string;

    if (timeType === 'relative') {
      const days = parseInt(formData.get('days') as string) || 0;
      const hours = parseInt(formData.get('hours') as string) || 0;
      const minutes = parseInt(formData.get('minutes') as string) || 0;
      const seconds = parseInt(formData.get('seconds') as string) || 0;

      return { days, hours, minutes, seconds };
    } else if (timeType === 'absolute') {
      const dateTime = formData.get('datetime') as string;
      if (dateTime) {
        return new Date(dateTime);
      }
    }

    // Default to 5 minutes
    return { minutes: 5 };
  }

  /**
   * Get time input options for forms
   */
  private getTimeOptions(): any {
    return {
      presets: [
        { value: { seconds: 30 }, label: '30 seconds' },
        { value: { minutes: 1 }, label: '1 minute' },
        { value: { minutes: 5 }, label: '5 minutes' },
        { value: { minutes: 10 }, label: '10 minutes' },
        { value: { minutes: 30 }, label: '30 minutes' },
        { value: { hours: 1 }, label: '1 hour' },
        { value: { hours: 2 }, label: '2 hours' },
        { value: { hours: 8 }, label: '8 hours' },
        { value: { days: 1 }, label: '1 day' },
        { value: { days: 7 }, label: '1 week' },
      ],
    };
  }

  /**
   * Load settings from game settings
   */
  private async loadSettings(): Promise<void> {
    try {
      this.settings.defaultScope =
        game.settings?.get('task-and-trigger', 'defaultScope') || 'client';
      this.settings.autoCleanup = game.settings?.get('task-and-trigger', 'autoCleanup') || false;
      this.settings.executionLogging =
        game.settings?.get('task-and-trigger', 'executionLogging') || false;
    } catch (error) {
      console.warn('Task & Trigger | Failed to load settings, using defaults:', error);
    }
  }

  /**
   * Handle save settings
   */
  async onSaveSettings(event: Event, _target: HTMLElement): Promise<void> {
    event.preventDefault();

    try {
      const form = this.element.querySelector('.settings-form') as HTMLFormElement;
      if (!form) return;

      const defaultScope =
        (form.querySelector('.setting-default-scope') as HTMLSelectElement)?.value || 'client';
      const autoCleanup =
        (form.querySelector('.setting-auto-cleanup') as HTMLInputElement)?.checked || false;
      const executionLogging =
        (form.querySelector('.setting-execution-logging') as HTMLInputElement)?.checked || false;

      // Save to game settings
      await game.settings?.set('task-and-trigger', 'defaultScope', defaultScope);
      await game.settings?.set('task-and-trigger', 'autoCleanup', autoCleanup);
      await game.settings?.set('task-and-trigger', 'executionLogging', executionLogging);

      // Update local settings
      this.settings.defaultScope = defaultScope as 'client' | 'world';
      this.settings.autoCleanup = autoCleanup;
      this.settings.executionLogging = executionLogging;

      ui.notifications?.info('Settings saved successfully');
    } catch (error) {
      ui.notifications?.error(`Failed to save settings: ${error}`);
      console.error('Task & Trigger | Settings save error:', error);
    }
  }

  /**
   * Handle reset settings
   */
  async onResetSettings(event: Event, _target: HTMLElement): Promise<void> {
    event.preventDefault();

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: 'Reset Settings' },
      content: `<p>Reset all Task Manager settings to their default values?</p>`,
    });

    if (confirmed) {
      try {
        // Reset to defaults
        await game.settings?.set('task-and-trigger', 'defaultScope', 'client');
        await game.settings?.set('task-and-trigger', 'autoCleanup', false);
        await game.settings?.set('task-and-trigger', 'executionLogging', false);

        // Update local settings
        this.settings.defaultScope = 'client';
        this.settings.autoCleanup = false;
        this.settings.executionLogging = false;

        // Re-render to update UI
        await this.render({ force: false });

        ui.notifications?.info('Settings reset to defaults');
      } catch (error) {
        ui.notifications?.error(`Failed to reset settings: ${error}`);
        console.error('Task & Trigger | Settings reset error:', error);
      }
    }
  }

  /**
   * Static method to show the Task Manager
   */
  static show(): TaskManagerApplication {
    // For now, we'll create a new instance each time since the ApplicationV2 window management is different
    const app = new TaskManagerApplication();
    app.render({ force: true });
    return app;
  }
}
