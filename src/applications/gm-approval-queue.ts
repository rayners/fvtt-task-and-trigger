/**
 * GMApprovalQueue - Interface for managing pending time log requests
 * Provides approval/denial workflow for accumulated time tasks
 */

/// <reference types="@rayners/foundry-dev-tools/types/foundry-v13-essentials" />

import { TimeLogEntry } from './time-log-dialog';

export interface PendingApproval {
  id: string;
  taskId: string;
  taskName: string;
  requestedBy: string;
  requestedByName: string;
  entry: TimeLogEntry;
  timestamp: number;
  status: 'pending' | 'approved' | 'denied';
}

export interface GMApprovalQueueData {
  pendingApprovals: PendingApproval[];
  hasApprovals: boolean;
  totalPending: number;
}

export class GMApprovalQueue extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static get defaultOptions() {
    return {
      id: 'gm-approval-queue',
      title: 'GM Approval Queue',
      template: 'modules/task-and-trigger/templates/gm-approval-queue.hbs',
      width: 600,
      height: 400,
      resizable: true,
      classes: ['task-and-trigger', 'gm-approval-queue'],
    };
  }

  constructor(options: any = {}) {
    super(options);
  }

  async getData(): Promise<GMApprovalQueueData> {
    // Get pending approvals from the socket manager
    const socketManager = game.taskTrigger._internal.taskManager.getSocketManager();
    const pendingApprovals = await socketManager.getPendingApprovals();
    
    return {
      pendingApprovals,
      hasApprovals: pendingApprovals.length > 0,
      totalPending: pendingApprovals.length,
    };
  }

  activateListeners(html: JQuery): void {
    // Call parent if available
    if (super.activateListeners) {
      super.activateListeners(html);
    }

    // Bind event handlers
    html.find('.approve-btn').click(this._onApprove.bind(this));
    html.find('.deny-btn').click(this._onDeny.bind(this));
    html.find('.approve-all-btn').click(this._onApproveAll.bind(this));
    html.find('.clear-all-btn').click(this._onClearAll.bind(this));
    html.find('.refresh-btn').click(this._onRefresh.bind(this));
  }

  /**
   * Handle approval of individual time log request
   */
  async _onApprove(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();
    const approvalId = event.currentTarget.dataset.approvalId;
    
    if (!approvalId) {
      ui.notifications?.error('Invalid approval ID');
      return;
    }

    try {
      const socketManager = game.taskTrigger._internal.taskManager.getSocketManager();
      const success = await socketManager.approveTimeLogRequest(approvalId);
      
      if (success) {
        ui.notifications?.info('Time log request approved');
        this.render();
      } else {
        ui.notifications?.error('Failed to approve request');
      }
    } catch (error) {
      console.error('Approval failed:', error);
      ui.notifications?.error('Failed to approve request: ' + (error as Error).message);
    }
  }

  /**
   * Handle denial of individual time log request
   */
  async _onDeny(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();
    const approvalId = event.currentTarget.dataset.approvalId;
    
    if (!approvalId) {
      ui.notifications?.error('Invalid approval ID');
      return;
    }

    try {
      // Get denial reason from user
      const reason = await foundry.applications.api.DialogV2.prompt({
        window: { title: 'Denial Reason' },
        content: '<p>Reason for denial (optional):</p><input type="text" name="reason" placeholder="Enter reason..." />',
        modal: true,
        ok: { label: 'Deny Request' },
        cancel: { label: 'Cancel' },
      });

      const socketManager = game.taskTrigger._internal.taskManager.getSocketManager();
      const success = await socketManager.denyTimeLogRequest(approvalId, reason || 'Denied by GM');
      
      if (success) {
        ui.notifications?.info('Time log request denied');
        this.render();
      } else {
        ui.notifications?.error('Failed to deny request');
      }
    } catch (error) {
      if (error !== null) { // User didn't cancel
        console.error('Denial failed:', error);
        ui.notifications?.error('Failed to deny request: ' + (error as Error).message);
      }
    }
  }

  /**
   * Handle approval of all pending requests
   */
  async _onApproveAll(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();
    
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: 'Approve All Requests' },
      content: '<p>Are you sure you want to approve all pending time log requests?</p>',
      modal: true,
    });

    if (!confirmed) return;

    try {
      const socketManager = game.taskTrigger._internal.taskManager.getSocketManager();
      const pendingApprovals = await socketManager.getPendingApprovals();
      
      let approvedCount = 0;
      for (const approval of pendingApprovals) {
        const success = await socketManager.approveTimeLogRequest(approval.id);
        if (success) {
          approvedCount++;
        }
      }
      
      ui.notifications?.info(`Approved ${approvedCount} of ${pendingApprovals.length} requests`);
      this.render();
    } catch (error) {
      console.error('Batch approval failed:', error);
      ui.notifications?.error('Failed to approve all requests: ' + (error as Error).message);
    }
  }

  /**
   * Handle clearing all processed requests
   */
  async _onClearAll(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();
    
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: 'Clear All Requests' },
      content: '<p>Are you sure you want to clear all processed (approved/denied) requests?</p>',
      modal: true,
    });

    if (!confirmed) return;

    try {
      const socketManager = game.taskTrigger._internal.taskManager.getSocketManager();
      const success = await socketManager.clearProcessedApprovals();
      
      if (success) {
        ui.notifications?.info('Cleared all processed requests');
        this.render();
      } else {
        ui.notifications?.error('Failed to clear requests');
      }
    } catch (error) {
      console.error('Clear failed:', error);
      ui.notifications?.error('Failed to clear requests: ' + (error as Error).message);
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
   * Static method to show the GM approval queue
   */
  static show(): void {
    if (!game.user?.isGM) {
      ui.notifications?.warn('Only GMs can access the approval queue');
      return;
    }
    
    const app = new GMApprovalQueue();
    app.render(true);
  }

  /**
   * Get count of pending approvals (for badges/notifications)
   */
  static async getPendingCount(): Promise<number> {
    if (!game.user?.isGM) {
      return 0;
    }
    
    try {
      const socketManager = game.taskTrigger._internal.taskManager.getSocketManager();
      const pendingApprovals = await socketManager.getPendingApprovals();
      return pendingApprovals.filter(a => a.status === 'pending').length;
    } catch (error) {
      console.error('Failed to get pending count:', error);
      return 0;
    }
  }
}