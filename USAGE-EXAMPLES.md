# Task & Trigger Usage Examples

This document provides practical examples for using the Task & Trigger module, including the new accumulated time functionality.

## Basic Task Scheduling

### Real-time Tasks (setTimeout/setInterval style)

```javascript
// Schedule a task to run in 5 minutes
const taskId = await game.taskTrigger.api.setTimeout(
  { minutes: 5 },
  'ui.notifications.info("5 minutes have passed!");'
);

// Schedule a recurring reminder every hour
const reminderId = await game.taskTrigger.api.setInterval(
  { hours: 1 },
  'ui.notifications.info("Hourly reminder!");'
);

// Cancel a task
await game.taskTrigger.api.cancel(taskId);
```

### Game-time Tasks

```javascript
// Schedule a task to run in 8 hours of game time
const gameTaskId = await game.taskTrigger.api.setGameTimeout(
  { hours: 8 },
  'ui.notifications.info("You are well rested!");'
);

// Schedule a recurring game-time reminder
const gameReminderId = await game.taskTrigger.api.setGameInterval(
  { hours: 4 },
  'ui.notifications.warn("You need to eat!");'
);
```

## Accumulated Time Tasks (NEW!)

Accumulated time tasks are perfect for activities that require a specific amount of time investment that can be logged incrementally across multiple sessions.

### Spell Research Example

```javascript
// Create a spell research task requiring 15 hours total
const researchTaskId = await game.taskTrigger.api.createAccumulatedTimeTask({
  name: 'Fireball Spell Research',
  description: 'Research the ancient secrets of the Fireball spell',
  requiredTime: { hours: 15 }, // Total time needed
  callback: `
    ui.notifications.info("Spell research complete! You've learned Fireball!");
    // Add the spell to the character
    const character = game.user.character;
    if (character) {
      // Implementation depends on your game system
      console.log("Add Fireball spell to character sheet");
    }
  `,
  scope: 'world', // Make it available to all players
});

// Log 3 hours of research work
await game.taskTrigger.api.addTimeToTask(researchTaskId, {
  duration: { hours: 3 },
  description: 'Studied ancient texts in the library',
});

// Log another 6 hours later
await game.taskTrigger.api.addTimeToTask(researchTaskId, {
  duration: { hours: 6 },
  description: 'Experimented with fire magic components',
});

// Check progress
const progress =
  await game.taskTrigger.api.getAccumulatedTimeProgress(researchTaskId);
console.log(`Progress: ${Math.round(progress.progress * 100)}% complete`);
console.log(`Remaining: ${progress.remaining / 3600} hours`);
```

### Crafting Example

```javascript
// Create a crafting task for a magic sword (requires 2 days, 4 hours)
const craftingTaskId = await game.taskTrigger.api.createAccumulatedTimeTask({
  name: 'Forge Flame Tongue Sword',
  description: 'Craft a magical sword imbued with fire',
  requiredTime: { days: 2, hours: 4 }, // 52 hours total
  callback: `
    ui.notifications.info("Your Flame Tongue sword is complete!");
    // Create the item
    const itemData = {
      name: "Flame Tongue",
      type: "weapon",
      // ... other item properties
    };
    // Add to character inventory (system-specific)
  `,
  scope: 'client',
});

// Log daily progress
await game.taskTrigger.api.addTimeToTask(craftingTaskId, {
  duration: { hours: 8 },
  description: 'Forged the basic blade shape',
});

await game.taskTrigger.api.addTimeToTask(craftingTaskId, {
  duration: { hours: 6 },
  description: 'Heat treated and tempered the steel',
});

// Export progress for record keeping
const exportData = await game.taskTrigger.api.exportTaskTimeLog(
  craftingTaskId,
  'csv'
);
console.log(exportData); // CSV data for external tracking
```

### Training Example

```javascript
// Character training in swordplay
const trainingTaskId = await game.taskTrigger.api.createAccumulatedTimeTask({
  name: 'Advanced Swordplay Training',
  description: 'Train to master advanced sword techniques',
  requiredTime: { days: 7 }, // One week of training
  callback: `
    ui.notifications.info("Training complete! Your sword skills have improved!");
    // Increase character abilities
    const character = game.user.character;
    if (character) {
      // Add proficiency, increase stats, etc.
      console.log("Increase sword proficiency");
    }
  `,
  logExecution: true, // Log completion to journal
});

// Track daily training sessions
for (let day = 1; day <= 7; day++) {
  await game.taskTrigger.api.addTimeToTask(trainingTaskId, {
    duration: { hours: 1 },
    description: `Training session ${day}: practiced forms and techniques`,
  });
}
```

## Advanced Usage

### Time Entry Management

```javascript
// Get detailed statistics
const stats = await game.taskTrigger.api.getAccumulatedTimeStatistics(taskId);
console.log(`Average session: ${stats.averageSessionDuration / 3600} hours`);
console.log(`Longest session: ${stats.longestSession / 3600} hours`);
console.log(`Sessions this week: ${stats.sessionsThisWeek}`);

// Edit a time entry (if you made a mistake)
const progress = await game.taskTrigger.api.getAccumulatedTimeProgress(taskId);
const firstEntryId = progress.timeEntries[0].id;

await game.taskTrigger.api.editTimeEntry(
  taskId,
  firstEntryId,
  { hours: 4 }, // New duration
  'Updated: Actually worked 4 hours, not 3' // New description
);

// Remove a time entry
await game.taskTrigger.api.removeTimeEntry(taskId, firstEntryId);
```

### Listing and Filtering

```javascript
// List all accumulated time tasks
const allAccumulatedTasks =
  await game.taskTrigger.api.listAccumulatedTimeTasks();
console.log(`Found ${allAccumulatedTasks.length} accumulated time tasks`);

// List only world-scoped tasks
const worldTasks = await game.taskTrigger.api.listAccumulatedTimeTasks('world');

// List all tasks (including regular scheduled tasks)
const allTasks = await game.taskTrigger.api.listTasks();
```

## Calendar Integration

If you have the Seasons & Stars module installed, tasks can be scheduled for specific calendar dates:

```javascript
// Schedule a task for a specific in-game date
const festivalTaskId = await game.taskTrigger.api.scheduleForDate(
  { year: 1421, month: 6, day: 21 }, // Midsummer
  'ui.notifications.info("The Midsummer Festival begins!");',
  { scope: 'world' }
);

// List tasks for a specific date
const tasksForDate = await game.taskTrigger.api.listTasksForDate({
  year: 1421,
  month: 6,
  day: 21,
});
```

## Task Management

```javascript
// Get task information
const taskInfo = await game.taskTrigger.api.getTaskInfo(taskId);
console.log(
  `Task: ${taskInfo.name}, Next execution: ${taskInfo.nextExecution}`
);

// Enable/disable tasks
await game.taskTrigger.api.disable(taskId);
await game.taskTrigger.api.enable(taskId);

// Get system statistics
const stats = await game.taskTrigger.api.getStatistics();
console.log(`Total tasks: ${stats.total}, Enabled: ${stats.enabled}`);
```

## Best Practices

1. **Use descriptive names and descriptions** for your tasks
2. **Choose appropriate scopes**: 'world' for shared tasks, 'client' for personal tasks
3. **Break large time requirements** into logical increments (daily/weekly sessions)
4. **Export time logs** regularly for record keeping
5. **Handle errors gracefully** in your callback code
6. **Test callbacks** using the Task Manager UI before creating automated tasks

## Notes

- Accumulated time tasks persist across Foundry restarts
- Time is tracked independently of any specific time system (real-time or game-time)
- Tasks execute immediately when the required time is reached
- All time entries are logged with timestamps and descriptions for audit trails
- Use the Task Manager UI (accessible via the API) for visual management
