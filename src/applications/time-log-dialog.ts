/**
 * TimeLogDialog - Dialog for players to request accumulated time logging
 * Provides form interface for duration and description entry
 */

/// <reference types="@rayners/foundry-dev-tools/types/foundry-v13-essentials" />

import { TimeSpec } from '../types';

// Declare types to work around namespace resolution issues

export interface TimeLogDialogOptions {
  submitCallback: (taskId: string, entry: TimeLogEntry) => Promise<void>;
}

export interface TimeLogEntry {
  duration: TimeSpec;
  description?: string;
}

export interface TimeLogDialogData {
  task: any | null;
  defaultDuration: number;
  currentUser: string;
  presetDurations: Array<{ value: number; label: string }>;
}

export class TimeLogDialog extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.DialogV2) {
  public taskId: string;
  public submitCallback: (taskId: string, entry: TimeLogEntry) => Promise<void>;

  static get defaultOptions() {
    return {
      ...super.defaultOptions,
      id: 'time-log-dialog',
      title: 'Log Time',
      template: 'modules/task-and-trigger/templates/time-log-dialog.hbs',
      width: 400,
      height: 300,
      modal: true,
      resizable: false,
      classes: ['task-and-trigger', 'time-log-dialog'],
    };
  }

  constructor(taskId: string, options: TimeLogDialogOptions) {
    super();
    this.taskId = taskId;
    this.submitCallback = options.submitCallback;
  }

  async getData(): Promise<TimeLogDialogData> {
    // Get task information for display
    const task = await game.taskTrigger.api.getTaskInfo(this.taskId);
    
    return {
      task,
      defaultDuration: 60, // 1 hour default
      currentUser: game.user?.name || 'Unknown',
      presetDurations: [
        { value: 15, label: '15 minutes' },
        { value: 30, label: '30 minutes' },
        { value: 60, label: '1 hour' },
        { value: 90, label: '1.5 hours' },
        { value: 120, label: '2 hours' },
        { value: 180, label: '3 hours' },
        { value: 240, label: '4 hours' },
      ],
    };
  }

  activateListeners(html: JQuery): void {
    // Call parent if available (may not exist in test environment)
    if (super.activateListeners) {
      super.activateListeners(html);
    }

    // Bind event handlers
    html.find('.preset-duration').change(this._onPresetDurationChange.bind(this));
    html.find('.submit-time-log').click(this._onSubmit.bind(this));
    html.find('.cancel-time-log').click(this._onCancel.bind(this));
    
    // Handle form submission via Enter key
    html.find('form').on('submit', this._onFormSubmit.bind(this));
  }

  /**
   * Handle preset duration selection
   */
  async _onPresetDurationChange(event: any): Promise<void> {
    const selectedValue = event.target.value;
    if (selectedValue) {
      const durationInput = $(event.target).closest('form').find('.duration-input');
      durationInput.val(selectedValue);
    }
  }

  /**
   * Handle form submission
   */
  async _onFormSubmit(event: any): Promise<void> {
    event.preventDefault();
    const formData = new FormData(event.target);
    const data = {
      duration: formData.get('duration') as string,
      description: formData.get('description') as string,
    };
    
    await this.onSubmit(data);
  }

  /**
   * Handle submit button click
   */
  async _onSubmit(event: any): Promise<void> {
    event.preventDefault();
    const form = $(event.target).closest('form')[0];
    const formData = new FormData(form);
    const data = {
      duration: formData.get('duration') as string,
      description: formData.get('description') as string,
    };
    
    await this.onSubmit(data);
  }

  /**
   * Handle cancel button click
   */
  async _onCancel(event: any): Promise<void> {
    event.preventDefault();
    this.close();
  }

  /**
   * Validate form data
   */
  validateForm(data: { duration: string; description: string }): boolean {
    // Duration is required and must be positive
    const duration = parseInt(data.duration);
    if (!data.duration || isNaN(duration) || duration <= 0) {
      ui.notifications?.error('Duration must be a positive number');
      return false;
    }

    // Maximum duration check (24 hours)
    if (duration > 1440) {
      ui.notifications?.error('Duration cannot exceed 24 hours');
      return false;
    }

    return true;
  }

  /**
   * Process form submission
   */
  async onSubmit(data: { duration: string; description: string }): Promise<void> {
    // Validate form
    if (!this.validateForm(data)) {
      return;
    }

    try {
      // Convert duration to TimeSpec format
      const durationMinutes = parseInt(data.duration);
      const timeEntry: TimeLogEntry = {
        duration: { minutes: durationMinutes },
        description: data.description || undefined,
      };

      // Call the submission callback
      await this.submitCallback(this.taskId, timeEntry);

      // Close the dialog
      this.close();
    } catch (error) {
      console.error('Time log submission failed:', error);
      ui.notifications?.error(`Failed to submit time log: ${error.message}`);
    }
  }

  /**
   * Static method to show the dialog
   */
  static show(taskId: string, callback: (taskId: string, entry: TimeLogEntry) => Promise<void>): void {
    const dialog = new TimeLogDialog(taskId, { submitCallback: callback });
    dialog.render(true);
  }
}