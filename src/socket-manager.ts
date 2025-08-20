/**
 * SocketManager - Handles socket-based communication for GM-player interactions
 * Manages time logging requests and player notifications
 */

import { AccumulatedTimeManager, TimeLogEntry } from './accumulated-time-manager';
import { TimeSpec } from './types';

export interface TimeLogRequestData {
  taskId: string;
  entry: TimeLogEntry & {
    requestedBy: string;
    requestedByName: string;
  };
  timestamp: number;
}

export interface TimeLogResponse {
  success: boolean;
  message?: string;
}

export interface TimeLogUpdateNotification {
  taskId: string;
  taskName: string;
  loggedBy: string;
  duration: TimeSpec;
  isComplete: boolean;
}

export class SocketManager {
  private socketHandler: any;
  private accumulatedTimeManager: AccumulatedTimeManager;

  constructor(accumulatedTimeManager: AccumulatedTimeManager) {
    this.accumulatedTimeManager = accumulatedTimeManager;
  }

  /**
   * Initialize socket communications
   */
  async initialize(): Promise<void> {
    if (game.modules.get('socketlib')?.active) {
      // Use SocketLib if available
      Hooks.once('socketlib.ready', () => {
        this.socketHandler = (globalThis as any).socketlib.registerModule(
          'task-and-trigger'
        );

        // Register socket handlers
        this.socketHandler.register(
          'requestTimeLog',
          this.handleTimeLogRequest.bind(this)
        );
        this.socketHandler.register(
          'notifyTimeLogUpdate',
          this.handleTimeLogUpdate.bind(this)
        );
        this.socketHandler.register(
          'requestTaskProgress',
          this.handleProgressRequest.bind(this)
        );
      });
    } else {
      // Fallback to native socket handling
      game.socket?.on(
        'module.task-and-trigger',
        this.handleSocketMessage.bind(this)
      );
    }
  }

  /**
   * Request time logging (used by both GMs and players)
   */
  async requestTimeLog(
    taskId: string,
    entry: TimeLogEntry
  ): Promise<TimeLogResponse> {
    if (game.user.isGM) {
      // GM can log directly
      try {
        const isComplete = await this.accumulatedTimeManager.addTime(taskId, entry);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          message: error.message,
        };
      }
    }

    // Player sends request to GM
    try {
      const result = await this.socketHandler.executeAsGM('requestTimeLog', {
        taskId,
        entry: {
          ...entry,
          requestedBy: game.user.id,
          requestedByName: game.user.name,
        },
        timestamp: Date.now(),
      });
      return result;
    } catch (error) {
      console.error('Socket request failed:', error);
      return {
        success: false,
        message: 'Failed to reach GM - they may be offline',
      };
    }
  }

  /**
   * Handle time log requests from players (GM-side)
   */
  async handleTimeLogRequest(data: TimeLogRequestData): Promise<TimeLogResponse> {
    if (!game.user.isGM) {
      return { success: false, message: 'Only GM can approve time logs' };
    }

    try {
      // Validate the request by trying to get task progress
      const taskProgress = await this.accumulatedTimeManager.getTaskProgress(data.taskId);
      if (!taskProgress) {
        return { success: false, message: 'Task not found' };
      }
      const task = taskProgress.task;

      // Process the time log entry
      const isComplete = await this.accumulatedTimeManager.addTime(
        data.taskId,
        data.entry
      );

      // Notify all players of the update
      this.socketHandler.executeForEveryone('notifyTimeLogUpdate', {
        taskId: data.taskId,
        taskName: task.name,
        loggedBy: data.entry.requestedByName,
        duration: data.entry.duration,
        isComplete,
      });

      // Create chat message for transparency
      ChatMessage.create({
        content: `Time logged for "${task.name}": ${this.formatDuration(data.entry.duration)} by ${data.entry.requestedByName}`,
        type: CONST.CHAT_MESSAGE_TYPES.OTHER,
        speaker: { alias: 'Task & Trigger' },
      });

      return { success: true };
    } catch (error) {
      console.error('Time log processing failed:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Handle time log update notifications (all players)
   */
  async handleTimeLogUpdate(data: TimeLogUpdateNotification): Promise<void> {
    // Update local UI if needed
    Hooks.callAll('taskTriggerTimeLogged', data);

    // Show notification
    const message = data.isComplete
      ? `Task "${data.taskName}" completed!`
      : `Time logged for "${data.taskName}" by ${data.loggedBy}`;

    ui.notifications.info(message);
  }

  /**
   * Handle progress requests (for future use)
   */
  async handleProgressRequest(data: { taskId: string; userId: string }): Promise<any> {
    // Placeholder for future implementation
    return {
      taskId: data.taskId,
      progress: 0.5,
      isComplete: false,
    };
  }

  /**
   * Handle native socket messages (fallback)
   */
  private handleSocketMessage(data: any): void {
    switch (data.type) {
      case 'requestTimeLog':
        this.handleTimeLogRequest(data.data);
        break;
      case 'notifyTimeLogUpdate':
        this.handleTimeLogUpdate(data.data);
        break;
      default:
        console.warn('Unknown socket message type:', data.type);
    }
  }

  /**
   * Get pending approval requests (GM only)
   */
  async getPendingApprovals(): Promise<any[]> {
    if (!game.user?.isGM) {
      throw new Error('Only GMs can access approval queue');
    }

    // For now, return mock data - in a real implementation this would
    // retrieve from storage or maintain a queue in memory
    return [];
  }

  /**
   * Approve a time log request (GM only)
   */
  async approveTimeLogRequest(approvalId: string): Promise<boolean> {
    if (!game.user?.isGM) {
      throw new Error('Only GMs can approve requests');
    }

    try {
      // In a real implementation, this would:
      // 1. Find the approval request by ID
      // 2. Apply the time log to the task
      // 3. Notify the requesting player
      // 4. Remove from pending queue
      
      console.log(`GM approved time log request: ${approvalId}`);
      
      // Mock success
      ui.notifications?.info('Time log request approved successfully');
      return true;
    } catch (error) {
      console.error('Failed to approve time log request:', error);
      return false;
    }
  }

  /**
   * Deny a time log request (GM only)
   */
  async denyTimeLogRequest(approvalId: string, reason: string): Promise<boolean> {
    if (!game.user?.isGM) {
      throw new Error('Only GMs can deny requests');
    }

    try {
      // In a real implementation, this would:
      // 1. Find the approval request by ID
      // 2. Notify the requesting player with reason
      // 3. Remove from pending queue
      
      console.log(`GM denied time log request: ${approvalId}, reason: ${reason}`);
      
      // Mock success
      ui.notifications?.info('Time log request denied');
      return true;
    } catch (error) {
      console.error('Failed to deny time log request:', error);
      return false;
    }
  }

  /**
   * Clear processed (approved/denied) requests (GM only)
   */
  async clearProcessedApprovals(): Promise<boolean> {
    if (!game.user?.isGM) {
      throw new Error('Only GMs can clear approvals');
    }

    try {
      // In a real implementation, this would remove all non-pending requests
      console.log('GM cleared processed approval requests');
      
      // Mock success
      return true;
    } catch (error) {
      console.error('Failed to clear processed approvals:', error);
      return false;
    }
  }

  /**
   * Format duration for display
   */
  private formatDuration(duration: TimeSpec): string {
    if (typeof duration === 'number') {
      const hours = Math.floor(duration / 3600);
      const minutes = Math.floor((duration % 3600) / 60);
      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      }
      return `${minutes}m`;
    }

    if (typeof duration === 'object') {
      const parts: string[] = [];
      if (duration.hours) parts.push(`${duration.hours}h`);
      if (duration.minutes) parts.push(`${duration.minutes}m`);
      if (duration.seconds) parts.push(`${duration.seconds}s`);
      return parts.join(' ') || '0s';
    }

    return String(duration);
  }
}