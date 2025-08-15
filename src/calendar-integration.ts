/**
 * CalendarIntegration - Integrates with Seasons & Stars calendar for visual task indicators and click-to-schedule
 */

import { TaskScheduler, TaskInfo } from './task-scheduler';
import { TaskManagerApplication } from './task-manager-application';
import { TimeConverter } from './time-converter';
import { CalendarDate } from './types';

export interface CalendarTaskIndicator {
  date: CalendarDate;
  worldTasks: number;
  clientTasks: number;
  totalTasks: number;
  hasUpcomingTasks: boolean;
  taskDetails: TaskInfo[];
}

export class CalendarIntegration {
  private static instance: CalendarIntegration;
  private scheduler: TaskScheduler;
  private isInitialized = false;
  private debounceRefreshDecorations: () => void;

  private constructor() {
    this.scheduler = TaskScheduler.getInstance();
    this.debounceRefreshDecorations = (foundry.utils as any).debounce(
      this.refreshCalendarDecorations.bind(this),
      500
    );
  }

  static getInstance(): CalendarIntegration {
    if (!this.instance) {
      this.instance = new CalendarIntegration();
    }
    return this.instance;
  }

  /**
   * Initialize calendar integration
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log('Task & Trigger | Initializing calendar integration');

    if (!TimeConverter.isSeasonsAndStarsAvailable()) {
      console.log('Task & Trigger | Seasons & Stars not available, skipping calendar integration');
      return;
    }

    try {
      // Register for Seasons & Stars calendar events
      this.registerCalendarHooks();

      // Set up DOM observer for calendar updates
      this.setupCalendarObserver();

      // Initial calendar decoration
      this.decorateCalendar();

      this.isInitialized = true;
      console.log('Task & Trigger | Calendar integration initialized');
    } catch (error) {
      console.error('Task & Trigger | Failed to initialize calendar integration:', error);
    }
  }

  /**
   * Shutdown calendar integration
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    console.log('Task & Trigger | Shutting down calendar integration');

    // Remove hook listeners (no longer using DOM observer)
    Hooks.off('seasons-stars:calendarWidgetRendered');
    Hooks.off('seasons-stars:calendarGridRendered');

    // Remove calendar decorations
    this.clearCalendarDecorations();

    this.isInitialized = false;
  }

  /**
   * Check if calendar integration is available and initialized
   */
  isAvailable(): boolean {
    return this.isInitialized && TimeConverter.isSeasonsAndStarsAvailable();
  }

  /**
   * Get task indicators for a specific calendar date
   */
  async getTaskIndicatorsForDate(calendarDate: CalendarDate): Promise<CalendarTaskIndicator> {
    const worldTime = TimeConverter.calendarDateToWorldTime(calendarDate);
    const dayStart = worldTime;
    const dayEnd = worldTime + 24 * 60 * 60; // Add 24 hours

    // Get all tasks for this day
    const allTasks = await this.scheduler.listTasks();
    const dayTasks = allTasks.filter(task => {
      if (!task.nextExecution) return false;
      return task.nextExecution >= dayStart && task.nextExecution < dayEnd;
    });

    const worldTasks = dayTasks.filter(task => task.scope === 'world').length;
    const clientTasks = dayTasks.filter(task => task.scope === 'client').length;

    return {
      date: calendarDate,
      worldTasks,
      clientTasks,
      totalTasks: dayTasks.length,
      hasUpcomingTasks: dayTasks.some(
        task =>
          task.enabled &&
          task.nextExecution &&
          task.nextExecution >= TimeConverter.getCurrentGameTime()
      ),
      taskDetails: dayTasks,
    };
  }

  /**
   * Register hooks with Seasons & Stars calendar system
   */
  private registerCalendarHooks(): void {
    console.log('Task & Trigger | Registering S&S calendar hooks');

    // Hook into S&S calendar grid render events
    Hooks.on('seasons-stars:calendarGridRendered', async (data: any) => {
      console.log('Task & Trigger | S&S calendar grid rendered', data);
      await this.onSeasonsStarsCalendarRender(data);
    });

    // Hook into S&S calendar widget render events
    Hooks.on('seasons-stars:calendarWidgetRendered', async (data: any) => {
      console.log('Task & Trigger | S&S calendar widget rendered', data);
      await this.onSeasonsStarsCalendarRender(data);
    });

    // Hook into S&S date change events (correct hook name and data structure)
    Hooks.on('seasons-stars:dateChanged', async (eventData: any) => {
      console.log('Task & Trigger | S&S date changed:', eventData);
      await this.onDateChanged(eventData.newDate);
    });

    // Hook into S&S ready event for initialization
    Hooks.on('seasons-stars:ready', async (data: any) => {
      console.log('Task & Trigger | S&S ready, manager available:', !!data.manager);
      // Initial calendar decoration after S&S is fully ready
      await this.decorateCalendar();
    });

    // Hook into our own task updates to refresh calendar
    Hooks.on('taskTriggerTaskUpdated', async () => {
      this.debounceRefreshDecorations();
    });

    Hooks.on('taskTriggerTaskCreated', async () => {
      this.debounceRefreshDecorations();
    });

    Hooks.on('taskTriggerTaskDeleted', async () => {
      this.debounceRefreshDecorations();
    });
  }

  /**
   * Handle S&S calendar render event
   */
  private async onSeasonsStarsCalendarRender(data: any): Promise<void> {
    console.log('Task & Trigger | S&S calendar rendered, adding task indicators');

    try {
      const htmlElement = data.element;
      if (!htmlElement) {
        console.warn('Task & Trigger | No element provided in S&S calendar render data');
        return;
      }

      // Add right-click handlers to calendar days (proper contextmenu events)
      const calendarDays = htmlElement.querySelectorAll('.calendar-day');
      calendarDays.forEach((day: Element) => {
        // Remove existing listeners to prevent duplicates
        day.removeEventListener('contextmenu', this.handleRightClick as unknown as EventListener);
        day.removeEventListener('click', this.handleCalendarClick as unknown as EventListener);

        // Add right-click handler for task creation/viewing
        day.addEventListener('contextmenu', event => {
          event.preventDefault();
          this.handleRightClick(event as MouseEvent);
        });

        // Add click handler for modifier keys (Ctrl+click, Shift+click)
        day.addEventListener('click', event => {
          this.handleCalendarClick(event as MouseEvent);
        });
      });

      // Add task indicators to calendar days
      await this.decorateCalendarDays($(htmlElement));
    } catch (error) {
      console.error('Task & Trigger | Error handling S&S calendar render:', error);
    }
  }

  /**
   * Handle date change event
   */
  private async onDateChanged(newDate: CalendarDate): Promise<void> {
    console.log('Task & Trigger | Calendar date changed:', newDate);
    // Refresh decorations when date changes
    this.debounceRefreshDecorations();
  }

  /**
   * Handle right-click on calendar day
   */
  private handleRightClick = async (event: MouseEvent): Promise<void> => {
    const dayElement = event.currentTarget as HTMLElement;
    const dateStr = dayElement.dataset.date;

    if (!dateStr) {
      console.warn('Task & Trigger | No date data on calendar day element');
      return;
    }

    try {
      const calendarDate = this.parseSeasonsStarsDate(dateStr);
      await this.showTasksForDate(calendarDate);
    } catch (error) {
      console.error('Task & Trigger | Error handling calendar right-click:', error);
      ui.notifications?.error('Failed to show tasks for date');
    }
  };

  /**
   * Handle click with modifier keys on calendar day
   */
  private handleCalendarClick = async (event: MouseEvent): Promise<void> => {
    // Only handle clicks with modifier keys
    if (!event.ctrlKey && !event.shiftKey && !event.metaKey) {
      return; // Let normal S&S calendar handling proceed
    }

    event.preventDefault();
    event.stopPropagation();

    const dayElement = event.currentTarget as HTMLElement;
    const dateStr = dayElement.dataset.date;

    if (!dateStr) {
      console.warn('Task & Trigger | No date data on calendar day element');
      return;
    }

    try {
      const calendarDate = this.parseSeasonsStarsDate(dateStr);

      if (event.ctrlKey || event.metaKey) {
        // Ctrl/Cmd+click: Quick schedule task for this day
        await this.quickScheduleForDate(calendarDate);
      } else if (event.shiftKey) {
        // Shift+click: Open task manager with date pre-filled
        await this.openTaskManagerForDate(calendarDate);
      }
    } catch (error) {
      console.error('Task & Trigger | Error handling calendar modifier click:', error);
      ui.notifications?.error('Failed to handle calendar interaction');
    }
  };

  /**
   * Set up calendar integration (now using proper hook registration)
   */
  private setupCalendarObserver(): void {
    console.log('Task & Trigger | Calendar integration ready - using S&S hooks');
    // Calendar integration is now handled through registerCalendarHooks()
    // This method is kept for compatibility but functionality moved to hook registration
  }

  /**
   * Decorate the entire calendar with task indicators
   */
  private async decorateCalendar(): Promise<void> {
    // Try multiple possible S&S calendar selectors
    const selectors = [
      '#seasons-and-stars-calendar-grid', // From S&S calendar grid widget
      '#seasons-stars-calendar-grid', // Alternative naming
      '.seasons-stars.calendar-grid-widget', // Class-based selector
      '.calendar-grid', // Fallback
    ];

    for (const selector of selectors) {
      const calendarElement = document.querySelector(selector);
      if (calendarElement) {
        console.log(`Task & Trigger | Found S&S calendar with selector: ${selector}`);
        await this.decorateCalendarDays($(calendarElement) as JQuery);
        return;
      }
    }

    console.log('Task & Trigger | No S&S calendar element found for decoration');
  }

  /**
   * Decorate calendar days with task indicators
   */
  private async decorateCalendarDays(html: JQuery): Promise<void> {
    const calendarDays = html.find('.calendar-day');

    for (let i = 0; i < calendarDays.length; i++) {
      const dayElement = $(calendarDays[i]);
      const dateStr = dayElement.data('date');

      if (!dateStr) continue;

      try {
        const calendarDate = this.parseSeasonsStarsDate(dateStr);
        const indicators = await this.getTaskIndicatorsForDate(calendarDate);

        // Remove existing task indicators
        dayElement.removeClass('has-tasks has-world-tasks has-client-tasks has-both-tasks');
        dayElement.find('.task-indicator').remove();

        if (indicators.totalTasks > 0) {
          // Add appropriate CSS classes
          dayElement.addClass('has-tasks');

          if (indicators.worldTasks > 0 && indicators.clientTasks > 0) {
            dayElement.addClass('has-both-tasks');
          } else if (indicators.worldTasks > 0) {
            dayElement.addClass('has-world-tasks');
          } else if (indicators.clientTasks > 0) {
            dayElement.addClass('has-client-tasks');
          }

          // Add task count indicator
          const indicator = $(`
            <div class="task-indicator" title="${this.buildTaskTooltip(indicators)}">
              <span class="task-count">${indicators.totalTasks}</span>
            </div>
          `);

          dayElement.append(indicator);
        }
      } catch (error) {
        console.warn('Task & Trigger | Error decorating calendar day:', dateStr, error);
      }
    }
  }

  /**
   * Clear all calendar decorations
   */
  private clearCalendarDecorations(): void {
    // Try multiple possible S&S calendar selectors
    const selectors = [
      '#seasons-and-stars-calendar-grid',
      '#seasons-stars-calendar-grid',
      '.seasons-stars.calendar-grid-widget',
      '.calendar-grid',
    ];

    for (const selector of selectors) {
      const calendarElement = document.querySelector(selector);
      if (calendarElement) {
        const calendarDays = $(calendarElement).find('.calendar-day');
        calendarDays.removeClass('has-tasks has-world-tasks has-client-tasks has-both-tasks');
        calendarDays.find('.task-indicator').remove();
        return;
      }
    }
  }

  /**
   * Refresh calendar decorations
   */
  private async refreshCalendarDecorations(): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    this.clearCalendarDecorations();
    await this.decorateCalendar();
  }

  /**
   * Parse date string from Seasons & Stars format
   */
  private parseSeasonsStarsDate(dateStr: string): CalendarDate {
    try {
      // Use correct S&S API pattern
      const seasonsStars = (game as any).seasonsStars;
      if (seasonsStars?.manager) {
        // Try to use S&S date parsing if available
        const engine = seasonsStars.manager.getActiveEngine();
        if (engine && engine.parseDate) {
          return engine.parseDate(dateStr);
        }
      }
    } catch (error) {
      console.warn('Task & Trigger | Error parsing date with S&S API:', error);
    }

    // Fallback parsing - assume "YYYY-MM-DD" format
    const parts = dateStr.split('-');
    if (parts.length >= 3) {
      return {
        year: parseInt(parts[0], 10),
        month: parseInt(parts[1], 10),
        day: parseInt(parts[2], 10),
      };
    }

    throw new Error(`Invalid date format: ${dateStr}`);
  }

  /**
   * Build tooltip text for task indicator
   */
  private buildTaskTooltip(indicators: CalendarTaskIndicator): string {
    const parts: string[] = [];

    if (indicators.worldTasks > 0) {
      parts.push(`${indicators.worldTasks} world task${indicators.worldTasks !== 1 ? 's' : ''}`);
    }

    if (indicators.clientTasks > 0) {
      parts.push(`${indicators.clientTasks} client task${indicators.clientTasks !== 1 ? 's' : ''}`);
    }

    const tooltip = parts.join(', ');

    if (indicators.hasUpcomingTasks) {
      return `${tooltip}\nRight-click to view tasks\nCtrl+click to quick schedule\nShift+click to open task manager`;
    } else {
      return `${tooltip} (completed)\nRight-click to view tasks\nCtrl+click to quick schedule\nShift+click to open task manager`;
    }
  }

  /**
   * Show tasks for a specific date
   */
  private async showTasksForDate(calendarDate: CalendarDate): Promise<void> {
    const indicators = await this.getTaskIndicatorsForDate(calendarDate);
    const formattedDate = this.formatCalendarDate(calendarDate);

    if (indicators.totalTasks === 0) {
      // No tasks exist - show dialog offering to create one
      new Dialog({
        title: `Tasks for ${formattedDate}`,
        content: `
          <div class="calendar-tasks-dialog">
            <p>No tasks scheduled for ${formattedDate}.</p>
            <p>Would you like to create a task for this date?</p>
          </div>
        `,
        buttons: {
          create: {
            label: 'Create Task',
            callback: () => this.quickScheduleForDate(calendarDate),
          },
          manage: {
            label: 'Open Task Manager',
            callback: () => this.openTaskManagerForDate(calendarDate),
          },
          close: {
            label: 'Cancel',
            callback: () => {},
          },
        },
        default: 'create',
      }).render(true);
      return;
    }

    // Create a dialog showing tasks for this date
    const taskListHtml = indicators.taskDetails
      .map(
        task => `
      <div class="task-summary ${task.enabled ? '' : 'disabled'}">
        <strong>${task.name}</strong>
        <span class="task-meta">
          ${task.scope === 'world' ? '🌍' : '👤'} 
          ${task.isRecurring ? '🔄' : '⏰'}
          ${task.enabled ? '✅' : '❌'}
        </span>
        <div class="task-description">${task.description || 'No description'}</div>
        <div class="task-schedule">Next run: ${new Date((task.nextExecution || 0) * 1000).toLocaleString()}</div>
      </div>
    `
      )
      .join('');

    new Dialog({
      title: `Tasks for ${formattedDate}`,
      content: `
        <div class="calendar-tasks-dialog">
          <p>Found ${indicators.totalTasks} task(s) scheduled for this date:</p>
          <div class="task-list">
            ${taskListHtml}
          </div>
        </div>
        <style>
          .calendar-tasks-dialog .task-summary {
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 10px;
            margin-bottom: 10px;
            background: white;
          }
          .calendar-tasks-dialog .task-summary.disabled {
            opacity: 0.6;
            background: #f8f9fa;
          }
          .calendar-tasks-dialog .task-meta {
            float: right;
            font-size: 0.9em;
          }
          .calendar-tasks-dialog .task-description {
            font-style: italic;
            color: #666;
            margin: 5px 0;
          }
          .calendar-tasks-dialog .task-schedule {
            font-size: 0.85em;
            color: #999;
          }
        </style>
      `,
      buttons: {
        create: {
          label: 'Create New Task',
          callback: () => this.quickScheduleForDate(calendarDate),
        },
        manage: {
          label: 'Open Task Manager',
          callback: () => this.openTaskManagerForDate(calendarDate),
        },
        close: {
          label: 'Close',
          callback: () => {},
        },
      },
      default: 'create',
    }).render(true);
  }

  /**
   * Quick schedule a task for a specific date
   */
  private async quickScheduleForDate(calendarDate: CalendarDate): Promise<void> {
    // Open the task manager application with date context
    const app = TaskManagerApplication.show();

    // Store the date context for the task manager to use
    (app as any)._contextDate = calendarDate;

    // Note: The task manager application handles task creation through its own UI
    // We don't need to simulate button clicks - the application will handle this properly
    ui.notifications?.info(
      `Task Manager opened for ${this.formatCalendarDate(calendarDate)}. Click "Create Task" to add a new task for this date.`
    );
  }

  /**
   * Open task manager with date context
   */
  private async openTaskManagerForDate(calendarDate: CalendarDate): Promise<void> {
    const app = TaskManagerApplication.show();

    // Store the date context for the task manager to use
    (app as any)._contextDate = calendarDate;

    ui.notifications?.info(
      `Task Manager opened with context for ${this.formatCalendarDate(calendarDate)}`
    );
  }

  /**
   * Format calendar date for display
   */
  private formatCalendarDate(calendarDate: CalendarDate): string {
    if (TimeConverter.isSeasonsAndStarsAvailable()) {
      try {
        const seasonsStars = (game as any).seasonsAndStars;
        if (seasonsStars?.api?.formatDate) {
          const worldTime = TimeConverter.calendarDateToWorldTime(calendarDate);
          return seasonsStars.api.formatDate(worldTime);
        }
      } catch (error) {
        console.warn('Task & Trigger | Error formatting calendar date:', error);
      }
    }

    // Fallback formatting
    return `${calendarDate.year}-${String(calendarDate.month || 1).padStart(2, '0')}-${String(calendarDate.day || 1).padStart(2, '0')}`;
  }
}
