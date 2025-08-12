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

**Developer Note**: This module was built with AI assistance to ensure comprehensive functionality and robust error handling.

## Installation

### Manual Installation

1. Download the latest release from the [releases page](https://github.com/rayners/fvtt-task-and-trigger/releases)
2. Extract to your `Data/modules` directory
3. Enable "Task & Trigger" in the Module Management screen

### Module JSON

```
https://github.com/rayners/fvtt-task-and-trigger/releases/download/v0.1.0/module.json
```

### System Requirements

- **FoundryVTT**: Version 11 or higher (tested up to v13)
- **JavaScript Knowledge**: Required for creating task callbacks
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
// Schedule a one-time reminder in 30 minutes
const taskId = await game.taskTrigger.api.setTimeout(
    { minutes: 30 },
    'ui.notifications.info("Time for a break!");',
    { name: "Break Reminder", scope: "client" }
);

// Schedule a recurring backup every hour
const backupId = await game.taskTrigger.api.setInterval(
    { hours: 1 },
    `console.log("Backup performed at: " + new Date().toLocaleString());`,
    { name: "Hourly Backup", scope: "world" }
);
```

### Game-Time Task Scheduling

Schedule tasks that respond to in-game time progression:

```javascript
// Advance time by 8 hours in-game and trigger an event
const eventId = await game.taskTrigger.api.setGameTimeout(
    { hours: 8 },
    `
    ui.notifications.warn("The merchant has left town!");
    // Additional game logic here
    `,
    { name: "Merchant Departure", scope: "world" }
);

// Daily game events
const dailyId = await game.taskTrigger.api.setGameInterval(
    { days: 1 },
    `
    // Roll for random encounters
    const roll = new Roll("1d20").roll();
    ui.notifications.info(\`Daily event roll: \${roll.total}\`);
    `,
    { name: "Daily Events", scope: "world" }
);
```

### Calendar Integration

Schedule tasks for specific calendar dates (requires compatible calendar module):

```javascript
// Schedule task for a specific date
const festivalId = await game.taskTrigger.api.scheduleForDate(
    { year: 1358, month: 3, day: 15 },
    `
    ui.notifications.info("The Spring Festival begins!");
    ChatMessage.create({
        content: "🌸 Spring Festival Day! 🌸",
        type: CONST.CHAT_MESSAGE_TYPES.EMOTE
    });
    `,
    { name: "Spring Festival", scope: "world" }
);
```

### Accumulated Time Tasks

Create tasks that require manual time logging to complete:

```javascript
// Character needs 40 hours of spell research
const researchId = await game.taskTrigger.api.createAccumulatedTimeTask({
    name: "Spell Research",
    description: "Researching the Fireball spell",
    requiredTime: { hours: 40 },
    callback: `
    ui.notifications.info("Spell research complete! Fireball learned.");
    // Add spell to character sheet
    `,
    scope: "world"
});

// Log 3 hours of research
await game.taskTrigger.api.addTimeToTask(researchId, {
    duration: { hours: 3 },
    description: "Studied fire elemental theory"
});

// Check progress
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
    "Session break in 5 minutes"
);

// Recurring reminder
await game.taskTrigger.api.scheduleRecurringReminder(
    { hours: 2 },
    "Remember to save your work!"
);

// Game-time reminder
await game.taskTrigger.api.scheduleGameReminder(
    { hours: 4 },
    "The sun is setting"
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
await game.taskTrigger.api.editTimeEntry(taskId, entryId, 
    { hours: 2.5 }, "Updated research notes"
);

// Remove time entries
await game.taskTrigger.api.removeTimeEntry(taskId, entryId);
```

### Error Handling

The module provides comprehensive error handling:

```javascript
try {
    const taskId = await game.taskTrigger.api.setTimeout(
        { minutes: 30 },
        'invalid javascript code here;',
        { name: "Test Task" }
    );
} catch (error) {
    console.error('Failed to schedule task:', error);
}
```

## Task Scopes

Tasks can be scoped to different storage levels:

- **`client`**: Stored locally, only visible to the current user
- **`world`**: Stored globally, visible to all users (GM can manage all world tasks)

```javascript
// Client-only task
await game.taskTrigger.api.setTimeout(
    { minutes: 10 },
    'console.log("Personal reminder");',
    { scope: "client" }
);

// World-shared task (requires GM permissions for creation)
await game.taskTrigger.api.setTimeout(
    { hours: 1 },
    'ui.notifications.info("World event triggered!");',
    { scope: "world" }
);
```

## Integration Patterns

### With Other Modules

Task & Trigger is designed to work well with other modules:

```javascript
// Integration with Seasons & Stars calendar
if (game.modules.get('seasons-and-stars')?.active) {
    await game.taskTrigger.api.scheduleForDate(
        { year: 1358, month: 6, day: 21 },
        'game.seasonsAndStars.api.triggerEvent("summer-solstice");'
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
    ui.notifications.error("Task & Trigger module not available");
    return;
}

const minutes = await Dialog.prompt({
    title: "Schedule Break",
    content: "<p>Minutes until break reminder:</p><input name='minutes' type='number' value='15' />",
    callback: (html) => html.find('input[name="minutes"]').val()
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
- Verify the callback code syntax
- Check browser console for JavaScript errors
- Ensure appropriate permissions for world-scoped tasks

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
```

## API Reference

For detailed API documentation, see [API.md](API.md).

For accumulated time task usage, see [ACCUMULATED-TIME-GUIDE.md](ACCUMULATED-TIME-GUIDE.md).

## Support

- **Issues**: [GitHub Issues](https://github.com/rayners/fvtt-task-and-trigger/issues)
- **Discussions**: [GitHub Discussions](https://github.com/rayners/fvtt-task-and-trigger/discussions)
- **Discord**: rayners78

## License

This project is licensed under the terms specified in the LICENSE file.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and updates.