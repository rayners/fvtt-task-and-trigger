# Task & Trigger API Reference

API documentation for the Task & Trigger FoundryVTT module. The API is exposed as `game.taskTrigger.api` and provides task scheduling and management capabilities.

## Table of Contents

- [Getting Started](#getting-started)
- [Basic Scheduling](#basic-scheduling)
- [Game Time Scheduling](#game-time-scheduling)
- [Advanced Scheduling](#advanced-scheduling)
- [Reminder Utilities](#reminder-utilities)
- [Task Management](#task-management)
- [Information Queries](#information-queries)
- [Accumulated Time Tasks](#accumulated-time-tasks)
- [Utility Functions](#utility-functions)
- [Types and Interfaces](#types-and-interfaces)

## Getting Started

### Macro-Based Execution

**Important:** Task & Trigger uses FoundryVTT macros for task execution instead of direct JavaScript strings. This provides enhanced security and better integration with Foundry's permission system.

Key changes:
- All task scheduling methods now require a `macroId` parameter instead of callback strings
- Macros are automatically organized in the "Task & Trigger Macros" folder structure
- Tasks can use existing macros or create new ones
- Module integration supports macro registration and cleanup

Folder organization:
```
Task & Trigger Macros/
├── Real-Time Tasks/
│   ├── One-Time/
│   └── Recurring/
├── Game-Time Tasks/
│   ├── One-Time/
│   └── Recurring/
├── Calendar Tasks/
├── Accumulated Time Tasks/
└── Module Tasks/
    └── [Module Name]/
```

### API Availability

```javascript
// Check if the API is available and ready
if (game.taskTrigger?.api?.isReady()) {
  // API is ready to use
} else {
  console.warn('Task & Trigger API not available');
}
```

### Basic API Structure

```javascript
// All methods are async and return Promises
const api = game.taskTrigger.api;

// Example usage pattern
try {
  // Create a macro first, then schedule it
  const macro = await Macro.create({
    name: 'Hello Task',
    type: 'script',
    command: 'console.log("Hello!");'
  });
  
  const taskId = await api.setTimeout({ minutes: 5 }, macro.id);
  console.log('Task scheduled:', taskId);
} catch (error) {
  console.error('Scheduling failed:', error);
}
```

## Basic Scheduling

### setTimeout(delay, macroId, options?)

Schedule a one-time task to execute after a delay using real time.

**Parameters:**

- `delay: TimeSpec` - Time to wait before execution
- `macroId: string` - ID of the FoundryVTT macro to execute
- `options?: ScheduleOptions` - Additional configuration options

**Returns:** `Promise<string>` - Task ID

**Example:**

```javascript
// Create a reminder macro
const reminderMacro = await Macro.create({
  name: 'Meeting Reminder Macro',
  type: 'script',
  command: 'ui.notifications.info("Meeting in 30 minutes!");'
});

// Schedule the macro to execute in 30 minutes
const taskId = await api.setTimeout(
  { minutes: 30 },
  reminderMacro.id,
  {
    name: 'Meeting Reminder',
    scope: 'client',
    logExecution: true,
  }
);

// Using existing macro by ID
const quickTask = await api.setTimeout(
  30000, // 30 seconds
  'existing-macro-id'
);
```

### setInterval(interval, macroId, options?)

Schedule a recurring task to execute at regular intervals using real time.

**Parameters:**

- `interval: TimeSpec` - Time between executions
- `macroId: string` - ID of the FoundryVTT macro to execute
- `options?: ScheduleOptions` - Additional configuration options

**Returns:** `Promise<string>` - Task ID

**Example:**

```javascript
// Create auto-save macro
const autoSaveMacro = await Macro.create({
  name: 'Auto Save Macro',
  type: 'script',
  command: `
    if (game.user.isGM) {
        ui.notifications.info("Auto-saving...");
        // Perform save operations
    }
    `
});

// Schedule auto-save every 10 minutes
const autoSave = await api.setInterval(
  { minutes: 10 },
  autoSaveMacro.id,
  {
    name: 'Auto Save',
    scope: 'world',
    description: 'Automatic world save every 10 minutes',
  }
);
```

### clearTimeout(taskId) / clearInterval(taskId)

Cancel a scheduled task (both methods are aliases).

**Parameters:**

- `taskId: string` - ID of the task to cancel

**Returns:** `Promise<boolean>` - True if task was successfully cancelled

**Example:**

```javascript
// Assuming you have a macro ID
const taskId = await api.setTimeout({ minutes: 5 }, 'macro-id-here');

// Cancel the task
const cancelled = await api.clearTimeout(taskId);
if (cancelled) {
  console.log('Task cancelled successfully');
}
```

## Game Time Scheduling

### setGameTimeout(delay, macroId, options?)

Schedule a one-time task to execute after a delay in game time.

**Parameters:**

- `delay: TimeSpec` - Game time to wait before execution
- `macroId: string` - ID of the FoundryVTT macro to execute
- `options?: ScheduleOptions` - Additional configuration options

**Returns:** `Promise<string>` - Task ID

**Example:**

```javascript
// Create a macro for the caravan arrival event
const caravanMacro = await Macro.create({
  name: 'Caravan Arrival Event',
  type: 'script',
  command: `
    ChatMessage.create({
        content: "The merchant caravan arrives at the city gates.",
        type: CONST.CHAT_MESSAGE_TYPES.IC
    });
    `
});

// Trigger an event after 8 hours of game time
const eventId = await api.setGameTimeout(
  { hours: 8 },
  caravanMacro.id,
  {
    name: 'Caravan Arrival',
    scope: 'world',
  }
);
```

### setGameInterval(interval, macroId, options?)

Schedule a recurring task to execute at game time intervals.

**Parameters:**

- `interval: TimeSpec` - Game time between executions
- `macroId: string` - ID of the FoundryVTT macro to execute
- `options?: ScheduleOptions` - Additional configuration options

**Returns:** `Promise<string>` - Task ID

**Example:**

```javascript
// Create a macro for the encounter check
const encounterMacro = await Macro.create({
  name: 'Daily Encounter Check',
  type: 'script',
  command: `
    const roll = new Roll("1d20").roll();
    if (roll.total >= 18) {
        ui.notifications.warn("Random encounter incoming!");
    }
    `
});

// Daily random encounter check
const encounterCheck = await api.setGameInterval(
  { days: 1 },
  encounterMacro.id,
  {
    name: 'Daily Encounter Check',
    scope: 'world',
    description: 'Roll for random encounters each game day',
  }
);
```

## Advanced Scheduling

### scheduleAt(dateTime, macroId, options?)

Schedule a task for a specific real-world date and time.

**Parameters:**

- `dateTime: Date` - Target date and time
- `macroId: string` - ID of the FoundryVTT macro to execute
- `options?: ScheduleOptions` - Additional configuration options

**Returns:** `Promise<string>` - Task ID

**Example:**

```javascript
// Create a macro for the New Year celebration
const newYearMacro = await Macro.create({
  name: 'New Year Celebration',
  type: 'script',
  command: `
    ui.notifications.info("🎉 Happy New Year! 🎉");
    ChatMessage.create({
        content: "The clock strikes midnight! A new year begins!",
        type: CONST.CHAT_MESSAGE_TYPES.EMOTE
    });
    `
});

// Schedule for New Year's Eve
const newYear = await api.scheduleAt(
  new Date('2024-12-31 23:59:00'),
  newYearMacro.id,
  {
    name: 'New Year Celebration',
    scope: 'world',
  }
);
```

### scheduleForDate(calendarDate, macroId, options?)

Schedule a task for a specific calendar date (requires calendar integration).

**Parameters:**

- `calendarDate: CalendarDate` - Calendar date specification
- `macroId: string` - ID of the FoundryVTT macro to execute
- `options?: ScheduleOptions` - Additional configuration options

**Returns:** `Promise<string>` - Task ID

**Example:**

```javascript
// Create a macro for the summer solstice event
const solsticeMacro = await Macro.create({
  name: 'Summer Solstice Festival',
  type: 'script',
  command: `
    ui.notifications.info("🌞 Summer Solstice Festival begins! 🌞");
    // Trigger festival events
    `
});

// Schedule for a specific in-game date
const festival = await api.scheduleForDate(
  { year: 1358, month: 6, day: 21 }, // Summer solstice
  solsticeMacro.id,
  {
    name: 'Summer Solstice',
    scope: 'world',
    description: 'Annual summer festival celebration',
  }
);
```

## Reminder Utilities

### scheduleReminder(delay, message, options?)

Schedule a simple notification reminder.

**Parameters:**

- `delay: TimeSpec` - Time until reminder
- `message: string` - Reminder message to display
- `options?: ScheduleOptions` - Additional configuration options

**Returns:** `Promise<string>` - Task ID

**Example:**

```javascript
// Remind to take a break
const breakReminder = await api.scheduleReminder(
  { hours: 2 },
  "Time for a break! You've been playing for 2 hours.",
  { name: 'Break Reminder', scope: 'client' }
);
```

### scheduleRecurringReminder(interval, message, options?)

Schedule a recurring notification reminder.

**Parameters:**

- `interval: TimeSpec` - Time between reminders
- `message: string` - Reminder message to display
- `options?: ScheduleOptions` - Additional configuration options

**Returns:** `Promise<string>` - Task ID

**Example:**

```javascript
// Hourly save reminder
const saveReminder = await api.scheduleRecurringReminder(
  { hours: 1 },
  'Remember to save your progress!',
  { name: 'Save Reminder', scope: 'client' }
);
```

### scheduleGameReminder(delay, message, options?)

Schedule a game-time notification reminder.

**Parameters:**

- `delay: TimeSpec` - Game time until reminder
- `message: string` - Reminder message to display
- `options?: ScheduleOptions` - Additional configuration options

**Returns:** `Promise<string>` - Task ID

**Example:**

```javascript
// Reminder when spell duration ends
const spellReminder = await api.scheduleGameReminder(
  { hours: 1 }, // 1 game hour
  'The protection spell is about to expire!',
  { name: 'Spell Duration', scope: 'world' }
);
```

## Task Management

### cancel(taskId)

Cancel and remove a scheduled task.

**Parameters:**

- `taskId: string` - Task ID to cancel

**Returns:** `Promise<boolean>` - True if task was cancelled

**Example:**

```javascript
const taskId = await api.setTimeout({ minutes: 5 }, 'console.log("test");');
const success = await api.cancel(taskId);
```

### enable(taskId)

Enable a previously disabled task.

**Parameters:**

- `taskId: string` - Task ID to enable

**Returns:** `Promise<void>`

**Example:**

```javascript
await api.enable(taskId);
console.log('Task enabled');
```

### disable(taskId)

Temporarily disable a task without removing it.

**Parameters:**

- `taskId: string` - Task ID to disable

**Returns:** `Promise<void>`

**Example:**

```javascript
await api.disable(taskId);
console.log('Task disabled');
```

### showTaskManager()

Open the visual task management interface.

**Parameters:** None

**Returns:** `void`

**Example:**

```javascript
api.showTaskManager(); // Opens the task manager UI
```

### markAsUITask(taskId) / markAsEphemeral(taskId)

Control task persistence behavior.

**Parameters:**

- `taskId: string` - Task ID to modify

**Returns:** `Promise<void>`

**Example:**

```javascript
// Mark task to persist across restarts
await api.markAsUITask(taskId);

// Mark task as temporary (won't persist)
await api.markAsEphemeral(taskId);
```

## Information Queries

### getTaskInfo(taskId)

Get detailed information about a specific task.

**Parameters:**

- `taskId: string` - Task ID to query

**Returns:** `Promise<TaskInfo | null>` - Task information or null if not found

**Example:**

```javascript
const taskInfo = await api.getTaskInfo(taskId);
if (taskInfo) {
  console.log(`Task: ${taskInfo.name}`);
  console.log(`Next execution: ${new Date(taskInfo.nextExecution * 1000)}`);
  console.log(`Run count: ${taskInfo.runCount}`);
  console.log(`Enabled: ${taskInfo.enabled}`);
}
```

### listTasks(scope?)

List all scheduled tasks, optionally filtered by scope.

**Parameters:**

- `scope?: 'world' | 'client'` - Optional scope filter

**Returns:** `Promise<TaskInfo[]>` - Array of task information

**Example:**

```javascript
// List all tasks
const allTasks = await api.listTasks();
console.log(`Total tasks: ${allTasks.length}`);

// List only client tasks
const clientTasks = await api.listTasks('client');
console.log(`Client tasks: ${clientTasks.length}`);

// Display task summary
allTasks.forEach(task => {
  console.log(`${task.name}: ${task.enabled ? 'enabled' : 'disabled'}`);
});
```

### listTasksForDate(calendarDate)

List tasks scheduled for a specific calendar date.

**Parameters:**

- `calendarDate: CalendarDate` - Calendar date to check

**Returns:** `Promise<TaskInfo[]>` - Array of tasks for that date

**Example:**

```javascript
const tasks = await api.listTasksForDate({ year: 1358, month: 6, day: 21 });
console.log(`Tasks for summer solstice: ${tasks.length}`);
```

### getStatistics()

Get statistics about the task system.

**Parameters:** None

**Returns:** `Promise<any>` - Task system statistics

**Example:**

```javascript
const stats = await api.getStatistics();
console.log('Task Statistics:', stats);
```

### getNextExecutionTime(taskId)

Get the next execution time for a task as a formatted string.

**Parameters:**

- `taskId: string` - Task ID to check

**Returns:** `Promise<string | null>` - Formatted execution time or null

**Example:**

```javascript
const nextTime = await api.getNextExecutionTime(taskId);
if (nextTime) {
  console.log(`Next execution: ${nextTime}`);
}
```

## Accumulated Time Tasks

### createAccumulatedTimeTask(options)

Create a task that requires manual time logging to complete.

**Parameters:**

- `options: AccumulatedTimeTaskOptions` - Task configuration

**Returns:** `Promise<string>` - Task ID

**Example:**

```javascript
// Create macro for spell completion
const spellMacro = await Macro.create({
  name: 'Spell Research Complete',
  type: 'script',
  command: `
        ui.notifications.info("Spell research complete!");
        // Add spell to character
    `
});

const researchId = await api.createAccumulatedTimeTask({
  name: 'Spell Research',
  description: 'Researching new teleportation spell',
  requiredTime: { hours: 50 },
  macroId: spellMacro.id,
  scope: 'world',
  logExecution: true,
});
```

### addTimeToTask(taskId, entry)

Add logged time to an accumulated time task.

**Parameters:**

- `taskId: string` - Task ID
- `entry: TimeLogEntry` - Time entry to add

**Returns:** `Promise<boolean>` - True if task is now complete

**Example:**

```javascript
// Log research session
const isComplete = await api.addTimeToTask(researchId, {
  duration: { hours: 4, minutes: 30 },
  description: 'Studied portal magic theory and practiced incantations',
});

if (isComplete) {
  console.log('Task completed!');
}
```

### getAccumulatedTimeProgress(taskId)

Get progress information for an accumulated time task.

**Parameters:**

- `taskId: string` - Task ID

**Returns:** `Promise<any>` - Progress information or null

**Example:**

```javascript
const progress = await api.getAccumulatedTimeProgress(taskId);
if (progress) {
  console.log(`Progress: ${(progress.progress * 100).toFixed(1)}%`);
  console.log(`Time remaining: ${progress.remaining} seconds`);
  console.log(`Entries: ${progress.timeEntries.length}`);
}
```

### listAccumulatedTimeTasks(scope?)

List all accumulated time tasks.

**Parameters:**

- `scope?: 'world' | 'client'` - Optional scope filter

**Returns:** `Promise<Task[]>` - Array of accumulated time tasks

**Example:**

```javascript
const timeTasks = await api.listAccumulatedTimeTasks();
timeTasks.forEach(task => {
  const progress = ((task.accumulatedTime / task.requiredTime) * 100).toFixed(
    1
  );
  console.log(`${task.name}: ${progress}% complete`);
});
```

### removeTimeEntry(taskId, entryId)

Remove a time entry from a task.

**Parameters:**

- `taskId: string` - Task ID
- `entryId: string` - Time entry ID to remove

**Returns:** `Promise<boolean>` - True if entry was removed

### editTimeEntry(taskId, entryId, newDuration, newDescription?)

Edit an existing time entry.

**Parameters:**

- `taskId: string` - Task ID
- `entryId: string` - Time entry ID to edit
- `newDuration: TimeSpec` - New duration
- `newDescription?: string` - New description (optional)

**Returns:** `Promise<boolean>` - True if entry was edited

### getAccumulatedTimeStatistics(taskId)

Get detailed statistics for an accumulated time task.

**Parameters:**

- `taskId: string` - Task ID

**Returns:** `Promise<any>` - Task statistics or null

**Example:**

```javascript
const stats = await api.getAccumulatedTimeStatistics(taskId);
if (stats) {
  console.log(`Total entries: ${stats.totalEntries}`);
  console.log(`Average session: ${stats.averageSessionDuration} seconds`);
  console.log(`Sessions this week: ${stats.sessionsThisWeek}`);
  if (stats.estimatedCompletion) {
    console.log(`Estimated completion: ${stats.estimatedCompletion}`);
  }
}
```

### exportTaskTimeLog(taskId, format?)

Export time log data for a task.

**Parameters:**

- `taskId: string` - Task ID
- `format?: 'json' | 'csv'` - Export format (default: 'csv')

**Returns:** `Promise<string>` - Exported data

**Example:**

```javascript
// Export as CSV
const csvData = await api.exportTaskTimeLog(taskId, 'csv');
console.log(csvData);

// Export as JSON
const jsonData = await api.exportTaskTimeLog(taskId, 'json');
const data = JSON.parse(jsonData);
console.log(data);
```

## Utility Functions

### formatTimeSpec(timeSpec, useGameTime?)

Format a time specification as a human-readable string.

**Parameters:**

- `timeSpec: TimeSpec` - Time specification to format
- `useGameTime?: boolean` - Whether this represents game time

**Returns:** `string` - Human-readable time string

**Example:**

```javascript
console.log(api.formatTimeSpec({ hours: 2, minutes: 30 })); // "2h 30m"
console.log(api.formatTimeSpec(3600, true)); // "1h" (game time)
```

### isReady()

Check if the task system is initialized and ready to use.

**Parameters:** None

**Returns:** `boolean` - True if ready

**Example:**

```javascript
if (!api.isReady()) {
  ui.notifications.error('Task & Trigger is not ready yet');
  return;
}
```

### cleanupOldTasks(olderThanDays?)

Clean up old disabled tasks to free storage space.

**Parameters:**

- `olderThanDays?: number` - Remove tasks older than this many days (default: 7)

**Returns:** `Promise<number>` - Number of tasks cleaned up

**Example:**

```javascript
// Clean up tasks older than 30 days
const cleaned = await api.cleanupOldTasks(30);
console.log(`Cleaned up ${cleaned} old tasks`);
```

## Types and Interfaces

### TimeSpec

Flexible time specification that accepts multiple formats:

```typescript
type TimeSpec = Date | number | RelativeTimeSpec | AbsoluteTimeSpec;

interface RelativeTimeSpec {
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
}

interface AbsoluteTimeSpec {
  year?: number;
  month?: number; // 1-12
  day?: number; // 1-31
  hour?: number; // 0-23
  minute?: number; // 0-59
  second?: number; // 0-59
}
```

### ScheduleOptions

Options for task scheduling:

```typescript
interface ScheduleOptions {
  scope?: 'world' | 'client'; // Storage scope
  name?: string; // Human-readable name
  description?: string; // Detailed description
  logExecution?: boolean; // Log to journal
  enabled?: boolean; // Initially enabled
}
```

### AccumulatedTimeTaskOptions

Options for accumulated time tasks:

```typescript
interface AccumulatedTimeTaskOptions {
  name: string; // Task name
  description?: string; // Task description
  requiredTime: TimeSpec; // Total time required
  macroId: string; // ID of macro to execute on completion
  scope?: 'world' | 'client'; // Storage scope
  logExecution?: boolean; // Log execution
}
```

### TimeLogEntry

Entry for adding time to accumulated tasks:

```typescript
interface TimeLogEntry {
  duration: TimeSpec; // Time duration to add
  description?: string; // What was accomplished
}
```

### CalendarDate

Calendar date specification:

```typescript
interface CalendarDate {
  year: number; // Calendar year
  month: number; // Month (1-12)
  day: number; // Day (1-31)
}
```

### TaskInfo

Information about a scheduled task:

```typescript
interface TaskInfo {
  id: string; // Unique task ID
  name: string; // Task name
  description?: string; // Task description
  nextExecution: number; // Next execution timestamp
  isRecurring: boolean; // Whether task repeats
  enabled: boolean; // Whether task is active
  runCount: number; // Number of executions
  lastExecution?: number; // Last execution timestamp
  lastError?: string; // Last error message
  useGameTime: boolean; // Game time vs real time
  scope: 'world' | 'client'; // Storage scope
}
```

## Error Handling

All API methods return promises and should be used with proper error handling:

```javascript
try {
  // Create macro first
  const testMacro = await Macro.create({
    name: 'Test Task',
    type: 'script', 
    command: 'console.log("test");'
  });
  
  const taskId = await api.setTimeout({ minutes: 5 }, testMacro.id);
  console.log('Task scheduled successfully:', taskId);
} catch (error) {
  console.error('Failed to schedule task:', error.message);
  ui.notifications.error(`Task scheduling failed: ${error.message}`);
}
```

Common error scenarios:

- Module not initialized (`isReady()` returns false)
- Invalid time specifications
- Macro not found or invalid macro ID
- Macro permission issues (world tasks require GM permissions)
- Macro creation failures (invalid JavaScript syntax)
- Storage failures
- Task not found for management operations

## Best Practices

### Performance

- Use appropriate task scopes (client vs world)
- Clean up completed one-time tasks regularly
- Avoid overly frequent recurring tasks
- Monitor task execution performance

### Security

- Create macros with proper validation before scheduling
- Use FoundryVTT's built-in macro permission system
- Be cautious with world-scoped tasks
- Implement proper error handling
- Leverage macro folder organization for better management

### Maintenance

- Document complex task logic
- Use descriptive names and descriptions
- Regular cleanup of old tasks
- Monitor task execution logs

### Integration

- Check for module availability before use
- Handle graceful degradation when modules unavailable
- Use appropriate hooks for task lifecycle events
- Consider calendar integration for date-based tasks
