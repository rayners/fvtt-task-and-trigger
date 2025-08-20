# Task & Trigger

A GM-centric task scheduling and automation system for FoundryVTT that provides controlled, role-based task management with real-time and game-time scheduling capabilities, accumulated time tracking with approval workflows, and secure JavaScript execution.

## Overview

Task & Trigger enables Game Masters to create and manage automated tasks while providing players with structured interfaces for time logging and task interaction. The module features a complete GM-centric architecture where task creation requires GM permissions, but players can view approved tasks and request accumulated time logging through socket-based communication.

**Key Features:**

- **GM-Centric Architecture**: All task creation requires GM permissions with role-based UI components
- **Real-Time Scheduling**: setTimeout/setInterval style scheduling using system time
- **Game-Time Scheduling**: Tasks that respond to in-game time changes
- **Accumulated Time Tasks**: Player-initiated time logging with GM approval workflows
- **Socket-Based Communication**: Real-time player-to-GM communication for time log requests
- **Task Visibility Controls**: GM-only, player-visible, and player-notify options
- **Calendar Integration**: Integration with Seasons & Stars module for visual scheduling
- **Secure Execution**: Safe JavaScript execution environment using FoundryVTT's macro system
- **Persistence**: Tasks survive Foundry sessions with automatic restoration
- **Role-Based UI Suite**: Separate interfaces for GMs (management) and players (interaction)

**Architecture Note**: Version 0.1.0 implements a complete GM-centric architecture conversion with comprehensive testing (95% test pass rate with 445+ tests) and role-based UI components. Task execution uses FoundryVTT's secure macro system for better security and integration.

## Installation

### Manual Installation

1. Download the latest release from the [releases page](https://github.com/rayners/fvtt-task-and-trigger/releases) when available
2. Extract to your `Data/modules` directory
3. Enable "Task & Trigger" in the Module Management screen

### Module JSON

Module JSON URL will be available with the first release.

### System Requirements

- **FoundryVTT**: Version 13 or higher (currently tested with v13 only)
- **GM-Only Task Creation**: All task creation and management requires GM permissions
- **Socket Communication**: Requires SocketLib for player-to-GM communication (auto-installed)
- **JavaScript Knowledge**: Required for GMs creating task macro code
- **Player Access**: Players can view approved tasks and submit time log requests
- **Recommended Modules**:
  - **Seasons & Stars**: Enhanced calendar integration and visual scheduling
  - **Errors & Echoes**: Advanced error reporting and debugging

## Basic Usage

### GM Task Management

The module provides a comprehensive GM interface for task creation and management:

```javascript
// Open the Task Manager (GM only)
game.taskTrigger.ui.showTaskManager();

// Open the Approval Queue for player time log requests (GM only)
game.taskTrigger.ui.showApprovalQueue();

// API access for programmatic task creation (GM only)
if (game.taskTrigger.api.isReady() && game.user.isGM) {
  // Create tasks here
}
```

### Player Interface

Players have access to view approved tasks and submit time logging requests:

```javascript
// Show player task view (upcoming events)
game.taskTrigger.ui.showPlayerView();

// Show time logging dialog for a specific task
game.taskTrigger.ui.showTimeLogDialog('task-id');

// Get upcoming events visible to current player
const events = await game.taskTrigger.api.getUpcomingEvents(168); // next 7 days
```

### Permission System

The module enforces strict GM-only permissions for task creation:

```javascript
// All task creation methods require GM permissions
if (!game.user.isGM) {
  ui.notifications.warn('Only GMs can create tasks');
  return;
}

// Players can view approved tasks through the API
const visibleTasks = await game.taskTrigger.api.getUpcomingEvents();
```

### Real-Time Task Scheduling (GM Only)

Schedule tasks that execute based on system time:

```javascript
// GM creates a macro for player notifications
const reminderMacro = await Macro.create({
  name: 'Break Reminder Macro',
  type: 'script',
  command: 'ui.notifications.info("Time for a break!");',
});

// Schedule a player-visible reminder (players can see in their task view)
const taskId = await game.taskTrigger.api.setTimeout(
  { minutes: 30 },
  reminderMacro.id,
  { 
    name: 'Break Reminder', 
    scope: 'world',
    visibility: 'player-visible',
    description: 'Session break coming up'
  }
);

// GM creates a private backup task (invisible to players)
const backupMacro = await Macro.create({
  name: 'Hourly Backup Macro',
  type: 'script',
  command: `console.log("Backup performed at: " + new Date().toLocaleString());`,
});

// Schedule a GM-only recurring backup
const backupId = await game.taskTrigger.api.setInterval(
  { hours: 1 },
  backupMacro.id,
  { 
    name: 'Hourly Backup', 
    scope: 'world',
    visibility: 'gm-only'
  }
);
```

### Game-Time Task Scheduling

Schedule tasks that respond to in-game time progression:

```javascript
// Create a macro for the merchant event
const merchantMacro = await Macro.create({
  name: 'Merchant Departure Event',
  type: 'script',
  command: `
    ui.notifications.warn("The merchant has left town!");
    // Additional game logic here
    `,
});

// Advance time by 8 hours in-game and trigger an event
const eventId = await game.taskTrigger.api.setGameTimeout(
  { hours: 8 },
  merchantMacro.id,
  { name: 'Merchant Departure', scope: 'world' }
);

// Create a macro for daily events
const dailyEventMacro = await Macro.create({
  name: 'Daily Event Roll',
  type: 'script',
  command: `
    // Roll for random encounters
    const roll = new Roll("1d20").roll();
    ui.notifications.info(\`Daily event roll: \${roll.total}\`);
    `,
});

// Daily game events
const dailyId = await game.taskTrigger.api.setGameInterval(
  { days: 1 },
  dailyEventMacro.id,
  { name: 'Daily Events', scope: 'world' }
);
```

### Calendar Integration

Schedule tasks for specific calendar dates (requires compatible calendar module):

```javascript
// Create a macro for the festival event
const festivalMacro = await Macro.create({
  name: 'Spring Festival Event',
  type: 'script',
  command: `
    ui.notifications.info("The Spring Festival begins!");
    ChatMessage.create({
        content: "🌸 Spring Festival Day! 🌸",
        type: CONST.CHAT_MESSAGE_TYPES.EMOTE
    });
    `,
});

// Schedule task for a specific date
const festivalId = await game.taskTrigger.api.scheduleForDate(
  { year: 1358, month: 3, day: 15 },
  festivalMacro.id,
  { name: 'Spring Festival', scope: 'world' }
);
```

### Accumulated Time Tasks with Approval Workflow

GMs create accumulated time tasks, players submit time log requests, and GMs approve/deny them:

```javascript
// GM creates a macro for the research completion
const researchMacro = await Macro.create({
  name: 'Spell Research Complete',
  type: 'script',
  command: `
    ui.notifications.info("Spell research complete! Fireball learned.");
    // Add spell to character sheet
    `,
});

// GM creates accumulated time task with player visibility
const researchId = await game.taskTrigger.api.createAccumulatedTimeTask({
  name: 'Spell Research',
  description: 'Researching the Fireball spell',
  requiredTime: { hours: 40 },
  macroId: researchMacro.id,
  scope: 'world',
  visibility: 'player-visible', // Players can see this task
  targetPlayers: ['player-user-id'], // Optional: specific players
});

// Player submits time log request (through UI or API)
// This goes to the GM approval queue
game.taskTrigger.ui.showTimeLogDialog(researchId);

// GM reviews and approves requests
game.taskTrigger.ui.showApprovalQueue();

// Check progress (available to both GM and players)
const progress = await game.taskTrigger.api.getAccumulatedTimeProgress(researchId);
console.log(`Progress: ${(progress.progress * 100).toFixed(1)}%`);
```

### Time Specifications

Tasks accept flexible time specifications:

```javascript
// Number (milliseconds for real-time, seconds for game-time)
{ time: 60000 } // 1 minute real time

// Date object
{ time: new Date('2024-12-25 09:00:00') }

// Relative time specification
{
    days: 2,
    hours: 3,
    minutes: 30,
    seconds: 15
}

// Absolute time specification (for calendar tasks)
{
    year: 1358,
    month: 6,    // 1-12
    day: 15,     // 1-31
    hour: 14,    // 0-23
    minute: 30   // 0-59
}
```

### Task Management

#### GM Task Management

```javascript
// Show comprehensive task management interface (GM only)
game.taskTrigger.ui.showTaskManager();

// Show approval queue for player time requests (GM only)
game.taskTrigger.ui.showApprovalQueue();

// API access for programmatic management (GM only)
if (game.user.isGM) {
  // List all tasks
  const tasks = await game.taskTrigger.api.listTasks();
  console.log(`Active tasks: ${tasks.length}`);

  // Get task information
  const taskInfo = await game.taskTrigger.api.getTaskInfo(taskId);
  console.log(`Next execution: ${taskInfo.nextExecution}`);

  // Cancel a task
  await game.taskTrigger.api.cancel(taskId);

  // Temporarily disable a task
  await game.taskTrigger.api.disable(taskId);

  // Re-enable a task
  await game.taskTrigger.api.enable(taskId);
}
```

#### Player Task Interaction

```javascript
// Show upcoming events visible to the player
game.taskTrigger.ui.showPlayerView();

// View tasks the player can see
const visibleTasks = await game.taskTrigger.api.getUpcomingEvents(168); // next 7 days
console.log(`Visible events: ${visibleTasks.length}`);

// Submit time log request for accumulated time tasks
game.taskTrigger.ui.showTimeLogDialog('task-id');

// Check progress on tasks the player can see
const progress = await game.taskTrigger.api.getAccumulatedTimeProgress('task-id');
console.log(`Task progress: ${(progress.progress * 100).toFixed(1)}%`);
```

## Advanced Features

### Reminder Utilities

Convenient methods for creating notifications:

```javascript
// Simple reminder
await game.taskTrigger.api.scheduleReminder(
  { minutes: 15 },
  'Session break in 5 minutes'
);

// Recurring reminder
await game.taskTrigger.api.scheduleRecurringReminder(
  { hours: 2 },
  'Remember to save your work!'
);

// Game-time reminder
await game.taskTrigger.api.scheduleGameReminder(
  { hours: 4 },
  'The sun is setting'
);
```

### Accumulated Time Features

Advanced time tracking capabilities:

```javascript
// Get detailed statistics
const stats = await game.taskTrigger.api.getAccumulatedTimeStatistics(taskId);
console.log(`Average session: ${stats.averageSessionDuration} seconds`);
console.log(`Sessions this week: ${stats.sessionsThisWeek}`);

// Export time log
const csvData = await game.taskTrigger.api.exportTaskTimeLog(taskId, 'csv');
console.log(csvData);

// Edit time entries
await game.taskTrigger.api.editTimeEntry(
  taskId,
  entryId,
  { hours: 2.5 },
  'Updated research notes'
);

// Remove time entries
await game.taskTrigger.api.removeTimeEntry(taskId, entryId);
```

### Error Handling

The module provides error handling for common scenarios:

```javascript
try {
  // This will fail if the macro creation fails
  const testMacro = await Macro.create({
    name: 'Test Task Macro',
    type: 'script',
    command: 'invalid javascript code here;', // This contains syntax errors
  });

  const taskId = await game.taskTrigger.api.setTimeout(
    { minutes: 30 },
    testMacro.id,
    { name: 'Test Task' }
  );
} catch (error) {
  console.error('Failed to create macro or schedule task:', error);
}
```

#### Macro Creation Error Handling

Common macro creation issues and how to handle them:

```javascript
// Handle macro creation failures
async function createTaskMacroSafely(macroData) {
  try {
    const macro = await Macro.create(macroData);
    return macro;
  } catch (error) {
    if (error.message.includes('permission')) {
      ui.notifications.error(
        'You need macro creation permissions to schedule tasks'
      );
      console.error('Macro creation permission denied:', error);
    } else if (error.message.includes('syntax')) {
      ui.notifications.error('Task code contains syntax errors');
      console.error('Macro code syntax error:', error);
    } else {
      ui.notifications.error('Failed to create task macro');
      console.error('Macro creation failed:', error);
    }
    throw error; // Re-throw for caller to handle
  }
}

// Example usage with safe macro creation
try {
  const macro = await createTaskMacroSafely({
    name: 'Safe Task Macro',
    type: 'script',
    command: 'ui.notifications.info("Task executed safely");',
  });

  const taskId = await game.taskTrigger.api.setTimeout(
    { minutes: 5 },
    macro.id,
    { name: 'Safe Task', scope: 'client' }
  );

  ui.notifications.info('Task scheduled successfully');
} catch (error) {
  // Error already handled in createTaskMacroSafely
  console.error('Task scheduling failed:', error);
}
```

#### Permission Error Handling

Handle GM-only task creation and player access patterns:

```javascript
// Check permissions before creating any tasks
async function scheduleTaskSafely(timeSpec, macroCode, options) {
  if (!game.user.isGM) {
    ui.notifications.warn('Only GMs can create tasks');
    return null;
  }

  try {
    const macro = await Macro.create({
      name: options.name + ' Macro',
      type: 'script',
      command: macroCode,
    });

    return await game.taskTrigger.api.setTimeout(timeSpec, macro.id, {
      ...options,
      scope: 'world',
      visibility: options.visibility || 'gm-only', // Default to GM-only
    });
  } catch (error) {
    ui.notifications.error('Failed to create task');
    console.error('Task creation failed:', error);
    throw error;
  }
}

// Player access pattern - viewing and interacting with approved tasks
async function playerTaskInteraction() {
  try {
    // Players can view approved tasks
    const visibleTasks = await game.taskTrigger.api.getUpcomingEvents();
    console.log(`Player can see ${visibleTasks.length} upcoming events`);

    // Players can submit time log requests for accumulated time tasks
    // This opens the UI for time logging
    game.taskTrigger.ui.showPlayerView();
  } catch (error) {
    console.error('Player task interaction failed:', error);
    ui.notifications.error('Failed to access task information');
  }
}
```

## Task Scopes and Visibility

Tasks can be scoped to different storage levels and have visibility controls:

### Storage Scopes
- **`client`**: Stored locally, only accessible to the GM who created them
- **`world`**: Stored globally, manageable by any GM

### Visibility Controls
- **`gm-only`**: Only visible to GMs (default for sensitive tasks)
- **`player-visible`**: Players can see the task in their upcoming events
- **`player-notify`**: Players are notified when the task executes

```javascript
// GM creates a private administrative task
const adminMacro = await Macro.create({
  name: 'Admin Backup Task',
  type: 'script',
  command: 'console.log("Admin backup performed");',
});

await game.taskTrigger.api.setTimeout({ hours: 1 }, adminMacro.id, {
  scope: 'world',
  visibility: 'gm-only', // Hidden from players
  name: 'Server Backup'
});

// GM creates a world event that players can see
const eventMacro = await Macro.create({
  name: 'Dragon Attack Event',
  type: 'script',
  command: 'ui.notifications.warn("A dragon has been spotted!");',
});

await game.taskTrigger.api.setTimeout({ hours: 2 }, eventMacro.id, {
  scope: 'world',
  visibility: 'player-visible', // Players see this in their upcoming events
  name: 'Dragon Sighting',
  description: 'Something big is coming...'
});

// GM creates a notification-only task
await game.taskTrigger.api.setTimeout({ minutes: 30 }, eventMacro.id, {
  scope: 'world',
  visibility: 'player-notify', // Players only see notification when it executes
  name: 'Session Break Reminder'
});
```

## Integration Patterns

### With Other Modules

Task & Trigger is designed to work well with other modules:

```javascript
// Integration with Seasons & Stars calendar
if (game.modules.get('seasons-and-stars')?.active) {
  // Create macro for solstice event
  const solsticeMacro = await Macro.create({
    name: 'Summer Solstice Event',
    type: 'script',
    command: 'game.seasonsAndStars.api.triggerEvent("summer-solstice");',
  });

  await game.taskTrigger.api.scheduleForDate(
    { year: 1358, month: 6, day: 21 },
    solsticeMacro.id
  );
}

// Error reporting with Errors & Echoes
if (game.modules.get('errors-and-echoes')?.active) {
  // Enhanced error reporting is automatically available
}
```

### Macro Integration

Create reusable macros for common tasks:

```javascript
// Macro: Schedule Session Break
if (!game.taskTrigger?.api?.isReady()) {
  ui.notifications.error('Task & Trigger module not available');
  return;
}

const minutes = await Dialog.prompt({
  title: 'Schedule Break',
  content:
    "<p>Minutes until break reminder:</p><input name='minutes' type='number' value='15' />",
  callback: html => html.find('input[name="minutes"]').val(),
});

await game.taskTrigger.api.scheduleReminder(
  { minutes: parseInt(minutes) },
  `Session break time! You've been playing for ${minutes} minutes.`,
  { name: `Break Reminder (${minutes}m)` }
);

ui.notifications.info(`Break reminder scheduled for ${minutes} minutes`);
```

## Best Practices

### Security Considerations

- **Code Validation**: Always validate user-provided callback code
- **Scope Awareness**: Use appropriate task scopes (client vs world)
- **Error Handling**: Wrap callback code in try-catch blocks
- **Resource Limits**: Be mindful of recurring task frequency

### Performance Optimization

- **Batch Operations**: Group related tasks when possible
- **Cleanup**: Regularly clean up completed one-time tasks
- **Monitoring**: Monitor task execution performance
- **Scope Management**: Use client scope for personal tasks

### Development Tips

- **Testing**: Test callbacks in the console before scheduling
- **Logging**: Enable execution logging for debugging
- **Documentation**: Document complex task logic
- **Versioning**: Consider compatibility when updating task code

## Troubleshooting

### Common Issues

**"Task & Trigger not ready"**

- Ensure the module is enabled and initialized
- Check console for initialization errors
- Verify FoundryVTT version compatibility

**"Task not executing"**

- Check if the task is enabled
- Verify the macro code syntax in the macro editor
- Check browser console for JavaScript errors
- Ensure appropriate permissions for world-scoped tasks
- Verify the macro still exists and hasn't been deleted

**"Macro not found" errors**

- Check that the macro ID exists in Foundry's macro collection
- Verify the macro hasn't been deleted by another user
- Check if the macro is in the correct folder structure
- Ensure the macro type is set to 'script' (not 'chat')

**"Permission denied" for world tasks**

- Only GMs can create and manage world-scoped task macros
- Check that the user has macro creation permissions
- Verify the macro folder permissions allow the current user access
- World tasks require GM permissions for both creation and execution

**"Macro creation failed"**

- Check JavaScript syntax in the macro command field
- Ensure the macro name doesn't conflict with existing macros
- Verify sufficient storage permissions for macro creation
- Check that the macro command isn't empty or invalid

**"Calendar integration not working"**

- Verify Seasons & Stars module is installed and enabled
- Check calendar configuration and data
- Ensure calendar time is progressing

### Debug Information

```javascript
// Check module status
console.log('Ready:', game.taskTrigger.api.isReady());

// Get task statistics
const stats = await game.taskTrigger.api.getStatistics();
console.log('Task stats:', stats);

// List all tasks with details
const tasks = await game.taskTrigger.api.listTasks();
tasks.forEach(task => {
  console.log(`${task.name}: ${task.enabled ? 'enabled' : 'disabled'}`);
});

// Debug macro-related issues
// Check if a specific macro exists
const macroId = 'your-macro-id-here';
const macro = game.macros.get(macroId);
console.log('Macro exists:', !!macro);
if (macro) {
  console.log('Macro name:', macro.name);
  console.log('Macro type:', macro.type);
  console.log('Macro folder:', macro.folder?.name || 'Root');
}

// List all Task & Trigger macros
const taskMacros = game.macros.filter(
  m =>
    m.folder?.name?.includes('Task & Trigger') ||
    m.name.includes('Task') ||
    m.name.includes('Macro')
);
console.log('Task-related macros:', taskMacros.length);
taskMacros.forEach(m => console.log(`- ${m.name} (${m.id})`));

// Check folder structure
const taskFolder = game.folders.find(f => f.name === 'Task & Trigger Macros');
console.log('Task folder exists:', !!taskFolder);
if (taskFolder) {
  console.log('Task folder contents:', taskFolder.contents.length, 'items');
}
```

## UI Components

### GM Interfaces

#### Task Manager
```javascript
game.taskTrigger.ui.showTaskManager();
```
Comprehensive interface for creating, editing, and monitoring all tasks. Features include:
- Task creation with visibility controls
- Real-time task monitoring
- Bulk operations
- Statistics and reporting
- Settings management

#### Approval Queue
```javascript
game.taskTrigger.ui.showApprovalQueue();
```
Dedicated interface for managing player time log requests:
- Review pending time log submissions
- Approve or deny with reasons
- Batch operations for multiple requests
- Clear processed requests

### Player Interfaces

#### Player Task View
```javascript
game.taskTrigger.ui.showPlayerView();
```
Player-focused interface showing:
- Upcoming events visible to the player
- Time logging buttons for accumulated time tasks
- Progress indicators
- Task descriptions and details

#### Time Log Dialog
```javascript
game.taskTrigger.ui.showTimeLogDialog('task-id');
```
Structured time logging interface featuring:
- Preset duration options
- Custom time entry
- Description fields
- Form validation

### Access Patterns

```javascript
// Check what UI components are available
console.log(game.taskTrigger.ui);

// GM-only components
if (game.user.isGM) {
  game.taskTrigger.ui.showTaskManager();
  game.taskTrigger.ui.showApprovalQueue();
}

// Player components (available to all users)
game.taskTrigger.ui.showPlayerView();
game.taskTrigger.ui.showTimeLogDialog('task-id');
```

## API Reference

For detailed API documentation, see [docs/API.md](docs/API.md).

For accumulated time task usage, see [docs/ACCUMULATED-TIME-GUIDE.md](docs/ACCUMULATED-TIME-GUIDE.md).

For usage examples, see [docs/USAGE-EXAMPLES.md](docs/USAGE-EXAMPLES.md).

## Support

- **Issues**: [GitHub Issues](https://github.com/rayners/fvtt-task-and-trigger/issues)
- **Discussions**: [GitHub Discussions](https://github.com/rayners/fvtt-task-and-trigger/discussions)
- **Discord**: rayners78

## License

This project is licensed under the terms specified in the LICENSE file.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and updates.
