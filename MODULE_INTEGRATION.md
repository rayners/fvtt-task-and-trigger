# Module Integration API

This document describes how external modules can integrate with the Task & Trigger system to create and manage scheduled tasks.

## Quick Start

### 1. Listen for Task & Trigger Ready Hook

```javascript
Hooks.once('taskTriggerReady', ({ api, modules }) => {
  // Task & Trigger is now ready for use
  console.log('Task & Trigger is ready!');

  // Register your module
  modules.registerModule('my-module-id', 'My Awesome Module');
});
```

### 2. Create Tasks

```javascript
// Get the module integration API
const taskTrigger = game.taskTrigger.modules;

// Create a simple notification task
const taskId = await taskTrigger.createNotificationTask(
  { minutes: 5 }, // 5 minutes from now
  'Time for a break!',
  {
    moduleId: 'my-module-id',
    name: 'Break Reminder',
    scope: 'client',
  }
);

// Create a recurring reminder
const recurringId = await taskTrigger.createRecurringTask(
  { hours: 1 }, // Every hour
  {
    moduleId: 'my-module-id',
    taskCode: 'ui.notifications.info("Hourly check-in!");',
    name: 'Hourly Reminder',
    scope: 'client',
  }
);
```

## Module Registration

Before creating tasks, modules should register themselves:

```javascript
await game.taskTrigger.modules.registerModule(
  'my-module-id',
  'My Module Display Name'
);
```

This creates a dedicated folder in the macro directory for your module's tasks and enables cleanup when your module is disabled.

## API Reference

### Basic Task Creation

#### `createOneTimeTask(delay, options)`

Creates a task that executes once after a delay.

```javascript
const taskId = await taskTrigger.createOneTimeTask(
  { minutes: 30 },
  {
    moduleId: 'my-module',
    taskCode: 'console.log("Task executed!");',
    name: 'My Task',
    description: 'A simple one-time task',
    scope: 'client',
  }
);
```

#### `createRecurringTask(interval, options)`

Creates a task that executes repeatedly at intervals.

```javascript
const taskId = await taskTrigger.createRecurringTask(
  { hours: 24 },
  {
    moduleId: 'my-module',
    taskCode: 'ui.notifications.info("Daily reminder!");',
    name: 'Daily Task',
  }
);
```

#### `createScheduledTask(dateTime, options)`

Creates a task for a specific date and time.

```javascript
const futureDate = new Date('2025-12-25T09:00:00');
const taskId = await taskTrigger.createScheduledTask(futureDate, {
  moduleId: 'my-module',
  taskCode: 'ui.notifications.info("Merry Christmas!");',
  name: 'Holiday Greeting',
});
```

### Game Time Tasks

#### `createGameTimeTask(delay, options)`

Creates a task that triggers based on in-game time.

```javascript
const taskId = await taskTrigger.createGameTimeTask(
  { hours: 8 }, // 8 game hours
  {
    moduleId: 'my-module',
    taskCode: 'ui.notifications.info("Long rest complete!");',
    name: 'Rest Complete',
  }
);
```

### Convenience Methods

#### `createNotificationTask(delay, message, options)`

Shorthand for creating notification tasks.

```javascript
const taskId = await taskTrigger.createNotificationTask(
  { minutes: 15 },
  'Remember to save your progress!',
  {
    moduleId: 'my-module',
    name: 'Save Reminder',
  }
);
```

#### `createChatTask(delay, message, options)`

Shorthand for creating chat message tasks.

```javascript
const taskId = await taskTrigger.createChatTask(
  { seconds: 30 },
  'Combat round timer started!',
  {
    moduleId: 'my-module',
    name: 'Combat Timer',
  }
);
```

### Task Management

#### Cancel, Enable, Disable Tasks

```javascript
// Cancel a task (removes it completely)
await taskTrigger.cancelTask(taskId);

// Temporarily disable a task
await taskTrigger.disableTask(taskId);

// Re-enable a disabled task
await taskTrigger.enableTask(taskId);
```

#### Module Cleanup

```javascript
// Clean up all tasks created by your module
const cleanedCount = await taskTrigger.cleanupModuleTasks('my-module-id');
console.log(`Cleaned up ${cleanedCount} tasks`);

// Unregister your module (automatically cleans up tasks)
await taskTrigger.unregisterModule('my-module-id');
```

## Task Options

### ModuleTaskOptions

```typescript
interface ModuleTaskOptions {
  moduleId: string; // Your module ID (required)
  taskCode: string; // JavaScript code to execute (required)
  name?: string; // Human-readable task name
  description?: string; // Task description
  scope?: 'world' | 'client'; // Where to store the task (default: 'client')
  logExecution?: boolean; // Whether to log execution results
  enabled?: boolean; // Whether task starts enabled (default: true)
  temporary?: boolean; // Whether task is temporary (default: false)
}
```

### Time Specifications

Time can be specified in multiple ways:

```javascript
// Relative time (most common)
{ seconds: 30, minutes: 5, hours: 2, days: 1 }

// Absolute timestamp
Math.floor(Date.now() / 1000) + 3600 // 1 hour from now

// Calendar date (requires Seasons & Stars module)
{ year: 2025, month: 6, day: 15 }
```

## Advanced Usage

### Accumulated Time Tasks

For tasks that require accumulated time investment:

```javascript
const taskId = await taskTrigger.createAccumulatedTimeTask({
  moduleId: 'my-module',
  name: 'Spell Research',
  description: 'Research a new spell',
  requiredTime: { hours: 15 },
  macroId: 'research-complete-macro',
  scope: 'world',
});

// Add time to the task
await game.taskTrigger.api.addTimeToTask(taskId, {
  duration: { hours: 3 },
  description: 'Morning research session',
});
```

### Module Statistics

```javascript
const stats = await taskTrigger.getModuleTaskStats('my-module-id');
console.log(
  `Module has ${stats.totalTasks} tasks, ${stats.activeTasks} active`
);

// List all registered modules
const modules = taskTrigger.getRegisteredModules();
modules.forEach(module => {
  console.log(`${module.displayName}: ${module.taskCount} tasks`);
});
```

## Best Practices

1. **Always register your module** before creating tasks
2. **Use meaningful names and descriptions** for tasks
3. **Clean up on module disable** using the unregisterModule method
4. **Use appropriate scopes**: 'client' for user-specific tasks, 'world' for global tasks
5. **Handle errors gracefully** when creating or managing tasks
6. **Use the convenience methods** when possible (createNotificationTask, createChatTask)

## Error Handling

```javascript
try {
  const taskId = await taskTrigger.createOneTimeTask(
    { minutes: 5 },
    {
      moduleId: 'my-module',
      taskCode: 'console.log("Hello world!");',
      name: 'Test Task',
    }
  );
  console.log(`Created task: ${taskId}`);
} catch (error) {
  console.error('Failed to create task:', error);
  ui.notifications.error('Failed to create task');
}
```

## Migration from Direct API

If you were previously using the direct API (`game.taskTrigger.api`), you can migrate to the module integration API:

```javascript
// Old way
const taskId = await game.taskTrigger.api.setTimeout(
  { minutes: 5 },
  'ui.notifications.info("Hello!");'
);

// New way
const taskId = await game.taskTrigger.modules.createNotificationTask(
  { minutes: 5 },
  'Hello!',
  { moduleId: 'my-module' }
);
```

The module integration API provides better organization, cleanup, and debugging capabilities.
