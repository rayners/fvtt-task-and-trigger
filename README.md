# Task & Trigger

A sophisticated task scheduling and automation system for FoundryVTT that provides real-time and game-time task scheduling capabilities, calendar integration, and JavaScript execution in a secure environment.

## Overview

Task & Trigger enables Game Masters and developers to schedule automated tasks that execute at specific times or intervals. Whether you need to trigger events based on real-world time, in-game calendar dates, or accumulated time tracking, this module provides comprehensive scheduling capabilities.

**Key Features:**

- **Real-Time Scheduling**: setTimeout/setInterval style scheduling using system time
- **Game-Time Scheduling**: Tasks that respond to in-game time changes
- **Accumulated Time Tasks**: Manual time logging for activities requiring specific durations
- **Calendar Integration**: Integration with Seasons & Stars module for visual scheduling
- **Secure Execution**: Safe JavaScript execution environment for task callbacks
- **Persistence**: Tasks survive Foundry sessions with automatic restoration
- **Management UI**: Visual interface for task creation, monitoring, and management

**Developer Note**: This module was built with AI assistance and is in active development. While core functionality is stable, testing is ongoing (87% test pass rate) with continued improvements planned.

**Architecture Note**: Task & Trigger uses FoundryVTT's secure macro system for task execution instead of direct JavaScript string evaluation. This provides better security, organization, and integration with Foundry's permission system.

## Installation

### Manual Installation

1. Download the latest release from the [releases page](https://github.com/rayners/fvtt-task-and-trigger/releases) when available
2. Extract to your `Data/modules` directory
3. Enable "Task & Trigger" in the Module Management screen

### Module JSON

Module JSON URL will be available with the first release.

### System Requirements

- **FoundryVTT**: Version 13 or higher (currently tested with v13 only)
- **Macro Creation**: Tasks require creating FoundryVTT macros (users need macro creation permissions)
- **GM Permissions**: World-scoped tasks require GM permissions for macro management
- **JavaScript Knowledge**: Required for creating task macro code
- **Recommended Modules**:
  - **Seasons & Stars**: Enhanced calendar integration and visual scheduling
  - **Errors & Echoes**: Advanced error reporting and debugging

## Basic Usage

### API Access

The module exposes its API through `game.taskTrigger.api`:

```javascript
// Check if the module is ready
if (game.taskTrigger.api.isReady()) {
  // Schedule tasks here
}
```

### Real-Time Task Scheduling

Schedule tasks that execute based on system time:

```javascript
// Create a macro for the reminder
const reminderMacro = await Macro.create({
  name: 'Break Reminder Macro',
  type: 'script',
  command: 'ui.notifications.info("Time for a break!");',
});

// Schedule a one-time reminder in 30 minutes
const taskId = await game.taskTrigger.api.setTimeout(
  { minutes: 30 },
  reminderMacro.id,
  { name: 'Break Reminder', scope: 'client' }
);

// Create a macro for the backup
const backupMacro = await Macro.create({
  name: 'Hourly Backup Macro',
  type: 'script',
  command: `console.log("Backup performed at: " + new Date().toLocaleString());`,
});

// Schedule a recurring backup every hour
const backupId = await game.taskTrigger.api.setInterval(
  { hours: 1 },
  backupMacro.id,
  { name: 'Hourly Backup', scope: 'world' }
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

### Accumulated Time Tasks

Create tasks that require manual time logging to complete:

```javascript
// Create a macro for the research completion
const researchMacro = await Macro.create({
  name: 'Spell Research Complete',
  type: 'script',
  command: `
    ui.notifications.info("Spell research complete! Fireball learned.");
    // Add spell to character sheet
    `,
});

// Character needs 40 hours of spell research
const researchId = await game.taskTrigger.api.createAccumulatedTimeTask({
  name: 'Spell Research',
  description: 'Researching the Fireball spell',
  requiredTime: { hours: 40 },
  macroId: researchMacro.id,
  scope: 'world',
});

// Log 3 hours of research
await game.taskTrigger.api.addTimeToTask(researchId, {
  duration: { hours: 3 },
  description: 'Studied fire elemental theory',
});

// Check progress
const progress =
  await game.taskTrigger.api.getAccumulatedTimeProgress(researchId);
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

```javascript
// List all active tasks
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

// Show task management UI
game.taskTrigger.api.showTaskManager();
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

Handle world-scoped task permission issues:

```javascript
// Check permissions before creating world tasks
async function scheduleWorldTask(timeSpec, macroCode, options) {
  if (!game.user.isGM) {
    ui.notifications.warn('Only GMs can create world-scoped tasks');
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
    });
  } catch (error) {
    ui.notifications.error('Failed to create world task');
    console.error('World task creation failed:', error);
    throw error;
  }
}
```

## Task Scopes

Tasks can be scoped to different storage levels:

- **`client`**: Stored locally, only visible to the current user
- **`world`**: Stored globally, visible to all users (GM can manage all world tasks)

```javascript
// Create macro for personal reminder
const personalMacro = await Macro.create({
  name: 'Personal Reminder',
  type: 'script',
  command: 'console.log("Personal reminder");',
});

// Client-only task
await game.taskTrigger.api.setTimeout({ minutes: 10 }, personalMacro.id, {
  scope: 'client',
});

// Create macro for world event
const worldEventMacro = await Macro.create({
  name: 'World Event Trigger',
  type: 'script',
  command: 'ui.notifications.info("World event triggered!");',
});

// World-shared task (requires GM permissions for creation)
await game.taskTrigger.api.setTimeout({ hours: 1 }, worldEventMacro.id, {
  scope: 'world',
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
