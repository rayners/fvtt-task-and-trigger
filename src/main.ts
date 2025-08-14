/**
 * Main entry point for Task & Trigger module
 * Handles initialization, hook registration, and API exposure
 */

import { TaskManager } from './task-manager';
import { TaskScheduler } from './task-scheduler';
import { TaskPersistence } from './task-persistence';
import { CalendarIntegration } from './calendar-integration';
import { TaskManagerApplication } from './task-manager-application';
import { createAPI } from './api';

// Module state
let isInitialized = false;

/**
 * Register a button in module settings to launch Task Manager
 */
function registerTaskManagerLauncher(): void {
  game.settings?.register('task-and-trigger', 'taskManagerLauncher', {
    name: 'Task Manager',
    hint: 'Open the Task & Trigger Manager to create and manage scheduled tasks',
    scope: 'client',
    config: true,
    type: String,
    default: '',
    onChange: () => {
      // Launch Task Manager when the setting is "changed" (button clicked)
      TaskManagerApplication.show();
    },
  });

  // Add a custom button to the settings menu
  game.settings?.registerMenu('task-and-trigger', 'openTaskManager', {
    name: 'Task Manager',
    label: 'Open Task Manager',
    hint: 'Open the Task & Trigger Manager to create and manage scheduled tasks',
    icon: 'fas fa-clock',
    type: TaskManagerLauncherFormApplication,
    restricted: false,
  });
}

/**
 * Simple form application that immediately opens Task Manager
 */
class TaskManagerLauncherFormApplication extends FormApplication {
  static get defaultOptions(): FormApplicationOptions {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'task-manager-launcher',
      title: 'Task Manager',
      template: undefined,
      width: 1,
      height: 1,
      resizable: false,
    });
  }

  async _updateObject(): Promise<void> {
    // This method is required but we don't need to do anything
  }

  async render(_force?: boolean, _options?: RenderOptions): Promise<this> {
    // Instead of rendering this form, immediately open Task Manager
    TaskManagerApplication.show();
    return this;
  }
}

/**
 * Initialize the Task & Trigger module
 */
async function initialize(): Promise<void> {
  if (isInitialized) {
    console.log('Task & Trigger | Module already initialized');
    return;
  }

  console.log('Task & Trigger | Starting module initialization');

  try {
    // Register Handlebars helpers
    (globalThis as any).Handlebars.registerHelper('taskTriggerJson', function (context: any) {
      return JSON.stringify(context);
    });

    // Register persistence settings
    TaskPersistence.registerSettings();

    // Register Task Manager launcher button
    registerTaskManagerLauncher();

    // Initialize core components in dependency order
    const taskManager = TaskManager.getInstance();
    const scheduler = TaskScheduler.getInstance();
    const persistence = TaskPersistence.getInstance();
    const calendarIntegration = CalendarIntegration.getInstance();

    // Initialize components
    await taskManager.initialize();
    await scheduler.initialize();
    await persistence.initialize();

    // Initialize calendar integration (optional - depends on Seasons & Stars)
    await calendarIntegration.initialize();

    // Create and expose public API
    const api = createAPI();
    (game as any).taskTrigger = {
      api,
      // Internal components for debugging (not part of public API)
      _internal: {
        taskManager,
        scheduler,
        persistence,
        calendarIntegration,
      },
    };

    // Register for cleanup on world unload
    Hooks.once('closeWorld', async () => {
      await shutdown();
    });

    isInitialized = true;
    console.log('Task & Trigger | Module initialization complete');

    // Notify other modules that Task & Trigger is ready
    Hooks.callAll('taskTriggerReady', api);
  } catch (error) {
    console.error('Task & Trigger | Module initialization failed:', error);
    ui.notifications?.error(
      'Task & Trigger module failed to initialize. Check console for details.'
    );
    throw error;
  }
}

/**
 * Shutdown the Task & Trigger module
 */
async function shutdown(): Promise<void> {
  if (!isInitialized) {
    return;
  }

  console.log('Task & Trigger | Starting module shutdown');

  try {
    // Get component instances
    const taskManager = TaskManager.getInstance();
    const persistence = TaskPersistence.getInstance();
    const calendarIntegration = CalendarIntegration.getInstance();

    // Shutdown calendar integration first
    await calendarIntegration.shutdown();

    // Prepare persistence state for shutdown
    await persistence.prepareShutdown();

    // Shutdown components
    await taskManager.shutdown();

    // Clear API from global scope
    delete (game as any).taskTrigger;

    isInitialized = false;
    console.log('Task & Trigger | Module shutdown complete');
  } catch (error) {
    console.error('Task & Trigger | Module shutdown failed:', error);
  }
}

/**
 * Get the current initialization status
 */
function getInitializationStatus(): {
  initialized: boolean;
  components: {
    taskManager: boolean;
    scheduler: boolean;
    persistence: boolean;
  };
} {
  if (!isInitialized) {
    return {
      initialized: false,
      components: {
        taskManager: false,
        scheduler: false,
        persistence: false,
      },
    };
  }

  const taskManager = TaskManager.getInstance();

  return {
    initialized: isInitialized,
    components: {
      taskManager: taskManager.isInitialized(),
      scheduler: true, // Scheduler doesn't have initialization state
      persistence: true, // Persistence doesn't have initialization state
    },
  };
}

// Hook registrations
Hooks.once('ready', async () => {
  console.log('Task & Trigger | Foundry ready, initializing module');
  await initialize();
});

// Expose status check for debugging
(globalThis as any).taskTriggerStatus = getInitializationStatus;

// Module metadata for other modules
const MODULE_INFO = {
  id: 'task-and-trigger',
  title: 'Task & Trigger',
  version: '0.1.0',
  description: 'Advanced task scheduling system for FoundryVTT',
  author: 'David Raynes',
  initialized: () => isInitialized,
};

// Make module info available
(globalThis as any).TASK_TRIGGER_MODULE = MODULE_INFO;

console.log('Task & Trigger | Module script loaded, waiting for Foundry ready hook');
