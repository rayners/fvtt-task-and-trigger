/**
 * PlayerTaskView - Player-facing interface for viewing upcoming events and managing accumulated time
 * Provides read-only view of visible tasks and time logging request interface
 */

/// <reference types="@rayners/foundry-dev-tools/types/foundry-v13-essentials" />

import { PlayerTaskView as PlayerTaskViewType } from '../types';

// Declare types to work around namespace resolution issues
declare const Hooks: any;

export interface PlayerTaskViewData {
  upcomingTasks: PlayerTaskViewType[];
  canLogTime: boolean;
}

export class PlayerTaskView extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static get defaultOptions() {
    return {
      id: 'player-task-view',
      title: 'Upcoming Events',
      template: 'modules/task-and-trigger/templates/player-task-view.hbs',
      width: 400,
      height: 600,
      resizable: true,
      classes: ['task-and-trigger', 'player-task-view'],
    };
  }

  constructor(options: any = {}) {
    super(options);
    
    // Listen for socket updates to refresh the view
    Hooks.on('taskTriggerTimeLogged', this._onTimeLogged.bind(this));
  }

  async getData(): Promise<PlayerTaskViewData> {
    // Get upcoming events visible to current player (default 1 week ahead)
    const upcomingEvents = await game.taskTrigger.api.getUpcomingEvents(168);
    
    return {
      upcomingTasks: upcomingEvents.slice(0, 10), // Limit to next 10 events
      canLogTime: !game.user?.isGM, // Players use request system, GMs have direct access
    };
  }

  activateListeners(html: JQuery): void {
    // Call parent if available (may not exist in test environment)
    if (super.activateListeners) {
      super.activateListeners(html);
    }

    // Bind event handlers
    html.find('.log-time-btn').click(this._onLogTime.bind(this));
    html.find('.view-progress-btn').click(this._onViewProgress.bind(this));
    html.find('.refresh-btn').click(this._onRefresh.bind(this));
  }

  /**
   * Handle time logging button clicks
   */
  async _onLogTime(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();
    const taskId = event.currentTarget.dataset.taskId;
    
    if (!taskId) {
      ui.notifications?.error('Invalid task ID');
      return;
    }

    try {
      // For now, create a simple time entry
      // In future, this could open a TimeLogDialog
      const entry = {
        duration: 3600, // 1 hour default
        description: 'Time worked on task',
      };

      const success = await game.taskTrigger.accumulatedTime.requestTimeLog(taskId, entry);
      
      if (success) {
        ui.notifications?.info('Time log request sent to GM');
        this.render();
      } else {
        ui.notifications?.error('Failed to send time log request');
      }
    } catch (error) {
      console.error('Time logging failed:', error);
      ui.notifications?.error('Failed to log time: ' + error.message);
    }
  }

  /**
   * Handle view progress button clicks
   */
  async _onViewProgress(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();
    const taskId = event.currentTarget.dataset.taskId;
    
    if (!taskId) {
      ui.notifications?.error('Invalid task ID');
      return;
    }

    try {
      const progress = await game.taskTrigger.api.getAccumulatedTimeProgress(taskId);
      
      if (progress) {
        const message = `Progress: ${Math.round(progress.progress * 100)}% complete`;
        ui.notifications?.info(message);
      } else {
        ui.notifications?.warn('No progress information available');
      }
    } catch (error) {
      console.error('Failed to get progress:', error);
      ui.notifications?.error('Failed to get progress information');
    }
  }

  /**
   * Handle refresh button clicks
   */
  async _onRefresh(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();
    this.render();
  }

  /**
   * Handle socket notifications for time logging updates
   */
  _onTimeLogged(data: {
    taskId: string;
    taskName: string;
    loggedBy: string;
    duration: number;
    isComplete: boolean;
  }): void {
    // Refresh the view to show updated information
    this.render();

    // Show completion notification if task is complete
    if (data.isComplete) {
      ui.notifications?.info(`Task "${data.taskName}" completed!`);
    }
  }

  /**
   * Static method to show the player task view
   */
  static show(): void {
    const app = new PlayerTaskView();
    app.render(true);
  }

  /**
   * Clean up hooks when closing
   */
  close(options?: any): Promise<void> {
    Hooks.off('taskTriggerTimeLogged', this._onTimeLogged.bind(this));
    return super.close(options);
  }
}