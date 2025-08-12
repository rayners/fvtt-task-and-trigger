# Accumulated Time Tasks Guide

A comprehensive guide to using Task & Trigger's accumulated time functionality - a powerful feature for tracking activities that require specific durations to complete.

## What Are Accumulated Time Tasks?

Accumulated time tasks represent activities that require a specific amount of time to be manually logged before they complete. Unlike regular scheduled tasks that execute at specific times, accumulated time tasks wait for you to log the required duration through multiple sessions.

**Key Characteristics:**
- **Manual Time Entry**: Time must be actively logged, not automatically tracked
- **Progress Tracking**: Visual progress indicators and detailed statistics
- **Flexible Scheduling**: Log time in any increments across multiple sessions
- **Completion Triggers**: Automatic execution when required time is reached
- **Data Export**: Export time logs for record keeping
- **Multi-User Support**: World tasks can have time logged by different users

## Common Use Cases

### Character Development
```javascript
// Spell research requiring 40 hours of study
const spellResearch = await game.taskTrigger.api.createAccumulatedTimeTask({
    name: "Fireball Spell Research",
    description: "Researching the fundamentals of evocation magic",
    requiredTime: { hours: 40 },
    callback: `
        ui.notifications.info("Spell research complete! Fireball learned.");
        // Add spell to character sheet
        const character = game.actors.getName("Gandalf");
        if (character) {
            // Add spell logic here
        }
    `,
    scope: "world"
});
```

### Crafting Activities
```javascript
// Crafting a magic sword requiring 60 hours of work
const swordCrafting = await game.taskTrigger.api.createAccumulatedTimeTask({
    name: "Enchanted Sword Crafting",
    description: "Forging and enchanting a +1 longsword",
    requiredTime: { hours: 60 },
    callback: `
        ChatMessage.create({
            content: "🗡️ The enchanted sword is complete! A masterwork of both steel and magic.",
            type: CONST.CHAT_MESSAGE_TYPES.EMOTE
        });
        // Award the item to the crafter
    `,
    scope: "world",
    logExecution: true
});
```

### Training and Learning
```javascript
// Language learning requiring 100 hours of practice
const languageLearning = await game.taskTrigger.api.createAccumulatedTimeTask({
    name: "Elvish Language Training",
    description: "Learning to speak and read Elvish fluently",
    requiredTime: { hours: 100 },
    callback: `
        ui.notifications.info("You have mastered the Elvish language!");
        // Update character proficiencies
    `,
    scope: "client" // Personal character development
});
```

### Construction Projects
```javascript
// Building a stronghold requiring 500 hours of construction
const stronghold = await game.taskTrigger.api.createAccumulatedTimeTask({
    name: "Stronghold Construction",
    description: "Building the party's mountain fortress",
    requiredTime: { hours: 500 },
    callback: `
        ChatMessage.create({
            content: "🏰 The stronghold construction is complete! Your mountain fortress stands ready.",
            type: CONST.CHAT_MESSAGE_TYPES.IC
        });
        // Update world state, add stronghold to maps, etc.
    `,
    scope: "world"
});
```

## Creating Accumulated Time Tasks

### Basic Creation

```javascript
const taskId = await game.taskTrigger.api.createAccumulatedTimeTask({
    name: "Task Name",                    // Required: Human-readable name
    description: "What this accomplishes", // Optional: Detailed description
    requiredTime: { hours: 20 },          // Required: Total time needed
    callback: "console.log('Done!');",     // Required: Code to run when complete
    scope: "world",                        // Optional: "world" or "client" (default: "client")
    logExecution: true                     // Optional: Log completion (default: false)
});
```

### Time Specification Options

The `requiredTime` parameter accepts flexible time formats:

```javascript
// Hours and minutes
{ hours: 8, minutes: 30 }

// Multiple units
{ days: 2, hours: 4, minutes: 15 }

// Just minutes for shorter tasks
{ minutes: 90 }

// Seconds for precise requirements
{ hours: 1, minutes: 30, seconds: 45 }

// Raw seconds (less readable)
7200 // 2 hours
```

### Advanced Configuration

```javascript
const complexTask = await game.taskTrigger.api.createAccumulatedTimeTask({
    name: "Alchemical Research",
    description: "Developing a new healing potion formula",
    requiredTime: { hours: 25, minutes: 30 },
    callback: `
        // Complex completion logic
        const researcher = game.actors.getName("${game.user.name}");
        if (researcher) {
            ui.notifications.info("Research complete! New formula discovered.");
            
            // Create journal entry with results
            JournalEntry.create({
                name: "Healing Potion Formula - Enhanced",
                content: "<p>A more potent healing potion formula...</p>"
            });
            
            // Award experience
            if (researcher.system.details?.xp) {
                const currentXP = researcher.system.details.xp.value;
                researcher.update({"system.details.xp.value": currentXP + 500});
            }
        }
    `,
    scope: "world",
    logExecution: true
});
```

## Logging Time

### Basic Time Logging

```javascript
// Log a research session
const isComplete = await game.taskTrigger.api.addTimeToTask(taskId, {
    duration: { hours: 3 },
    description: "Studied fire elemental theory"
});

if (isComplete) {
    console.log("Task completed and executed!");
}
```

### Detailed Time Entries

```javascript
// Log work with detailed description
await game.taskTrigger.api.addTimeToTask(craftingTaskId, {
    duration: { hours: 4, minutes: 30 },
    description: "Forged the blade and began initial tempering. Weather was good for metalwork."
});

// Log partial sessions
await game.taskTrigger.api.addTimeToTask(studyTaskId, {
    duration: { minutes: 45 },
    description: "Quick review of yesterday's notes before dinner"
});
```

### Time Logging Patterns

**Daily Sessions:**
```javascript
// Create a macro for daily logging
async function logDailyPractice(taskId, hours = 2) {
    try {
        const description = await Dialog.prompt({
            title: "Daily Practice",
            content: `<p>What did you accomplish in ${hours} hours?</p><textarea name="desc" rows="3"></textarea>`,
            callback: (html) => html.find('textarea[name="desc"]').val()
        });
        
        const isComplete = await game.taskTrigger.api.addTimeToTask(taskId, {
            duration: { hours: hours },
            description: description || "Daily practice session"
        });
        
        if (isComplete) {
            ui.notifications.info("Training complete!");
        } else {
            const progress = await game.taskTrigger.api.getAccumulatedTimeProgress(taskId);
            const remaining = Math.ceil(progress.remaining / 3600);
            ui.notifications.info(`Progress logged! Approximately ${remaining} hours remaining.`);
        }
    } catch (error) {
        ui.notifications.error(`Failed to log time: ${error.message}`);
    }
}
```

**Batch Time Entry:**
```javascript
// Log multiple sessions at once (for catch-up)
async function logMultipleSessions(taskId, sessions) {
    for (const session of sessions) {
        await game.taskTrigger.api.addTimeToTask(taskId, session);
    }
}

// Usage
await logMultipleSessions(taskId, [
    { duration: { hours: 2 }, description: "Monday morning session" },
    { duration: { hours: 1, minutes: 30 }, description: "Wednesday evening" },
    { duration: { hours: 3 }, description: "Saturday deep work" }
]);
```

## Tracking Progress

### Basic Progress Check

```javascript
const progress = await game.taskTrigger.api.getAccumulatedTimeProgress(taskId);
if (progress) {
    console.log(`Progress: ${(progress.progress * 100).toFixed(1)}%`);
    console.log(`Time remaining: ${Math.ceil(progress.remaining / 3600)} hours`);
    console.log(`Sessions logged: ${progress.timeEntries.length}`);
    console.log(`Completed: ${progress.isComplete ? 'Yes' : 'No'}`);
}
```

### Progress Monitoring Macro

```javascript
// Create a macro to check all your accumulated time tasks
async function checkMyProgress() {
    const tasks = await game.taskTrigger.api.listAccumulatedTimeTasks('client');
    
    if (tasks.length === 0) {
        ui.notifications.info("No accumulated time tasks found.");
        return;
    }
    
    let report = "<h3>My Progress Report</h3><ul>";
    
    for (const task of tasks) {
        const progress = await game.taskTrigger.api.getAccumulatedTimeProgress(task.id);
        if (progress) {
            const percentage = (progress.progress * 100).toFixed(1);
            const remainingHours = Math.ceil(progress.remaining / 3600);
            
            report += `<li><strong>${task.name}</strong>: ${percentage}% `;
            report += `(${remainingHours}h remaining, ${progress.timeEntries.length} sessions)</li>`;
        }
    }
    
    report += "</ul>";
    
    ChatMessage.create({
        content: report,
        whisper: [game.user.id]
    });
}
```

### Visual Progress Indicators

```javascript
// Display progress bar in chat
async function showProgressBar(taskId) {
    const progress = await game.taskTrigger.api.getAccumulatedTimeProgress(taskId);
    if (!progress) return;
    
    const percentage = Math.round(progress.progress * 100);
    const barWidth = 20;
    const filled = Math.round(barWidth * progress.progress);
    const empty = barWidth - filled;
    
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    
    ChatMessage.create({
        content: `<h4>${progress.task.name}</h4>
                  <code>[${bar}] ${percentage}%</code>
                  <p><small>${Math.ceil(progress.remaining / 3600)} hours remaining</small></p>`,
        whisper: [game.user.id]
    });
}
```

## Managing Time Entries

### Viewing Time Entries

```javascript
const progress = await game.taskTrigger.api.getAccumulatedTimeProgress(taskId);
const entries = progress.timeEntries;

entries.forEach(entry => {
    const date = new Date(entry.timestamp * 1000).toLocaleDateString();
    const duration = entry.duration / 3600; // Convert to hours
    console.log(`${date}: ${duration}h - ${entry.description || 'No description'}`);
});
```

### Editing Time Entries

```javascript
// Edit an existing entry (you need the entry ID)
const success = await game.taskTrigger.api.editTimeEntry(
    taskId,
    entryId,
    { hours: 3, minutes: 30 }, // New duration
    "Updated description with more details"
);

if (success) {
    console.log("Time entry updated successfully");
}
```

### Removing Time Entries

```javascript
// Remove a time entry (useful for corrections)
const removed = await game.taskTrigger.api.removeTimeEntry(taskId, entryId);
if (removed) {
    console.log("Time entry removed");
}
```

### Time Entry Management Interface

```javascript
// Create a dialog for managing time entries
async function manageTimeEntries(taskId) {
    const progress = await game.taskTrigger.api.getAccumulatedTimeProgress(taskId);
    if (!progress) return;
    
    let content = `<h3>${progress.task.name}</h3>`;
    content += `<p>Progress: ${(progress.progress * 100).toFixed(1)}%</p>`;
    content += "<table><tr><th>Date</th><th>Duration</th><th>Description</th><th>Actions</th></tr>";
    
    progress.timeEntries.forEach(entry => {
        const date = new Date(entry.timestamp * 1000).toLocaleDateString();
        const hours = (entry.duration / 3600).toFixed(1);
        content += `<tr>
            <td>${date}</td>
            <td>${hours}h</td>
            <td>${entry.description || 'No description'}</td>
            <td><button onclick="removeEntry('${entry.id}')">Remove</button></td>
        </tr>`;
    });
    
    content += "</table>";
    
    new Dialog({
        title: "Manage Time Entries",
        content: content,
        buttons: {
            close: { label: "Close" }
        }
    }).render(true);
}
```

## Statistics and Analytics

### Basic Statistics

```javascript
const stats = await game.taskTrigger.api.getAccumulatedTimeStatistics(taskId);
if (stats) {
    console.log(`Total sessions: ${stats.totalEntries}`);
    console.log(`Average session: ${(stats.averageSessionDuration / 3600).toFixed(1)} hours`);
    console.log(`Longest session: ${(stats.longestSession / 3600).toFixed(1)} hours`);
    console.log(`Sessions this week: ${stats.sessionsThisWeek}`);
    
    if (stats.estimatedCompletion) {
        console.log(`Estimated completion: ${stats.estimatedCompletion.toLocaleDateString()}`);
    }
}
```

### Productivity Analysis

```javascript
async function analyzeProductivity(taskId) {
    const progress = await game.taskTrigger.api.getAccumulatedTimeProgress(taskId);
    const stats = await game.taskTrigger.api.getAccumulatedTimeStatistics(taskId);
    
    if (!progress || !stats) return;
    
    // Calculate productivity metrics
    const totalTime = progress.task.accumulatedTime;
    const totalDays = Math.ceil((Date.now() / 1000 - progress.task.created) / (24 * 60 * 60));
    const averagePerDay = totalTime / totalDays / 3600; // hours per day
    
    const report = `
        <h3>Productivity Analysis: ${progress.task.name}</h3>
        <ul>
            <li>Total time logged: ${(totalTime / 3600).toFixed(1)} hours</li>
            <li>Sessions: ${stats.totalEntries}</li>
            <li>Average per day: ${averagePerDay.toFixed(2)} hours</li>
            <li>Average session: ${(stats.averageSessionDuration / 3600).toFixed(1)} hours</li>
            <li>Consistency: ${stats.sessionsThisWeek > 3 ? 'Good' : 'Needs improvement'}</li>
            <li>Progress: ${(progress.progress * 100).toFixed(1)}%</li>
        </ul>
    `;
    
    ChatMessage.create({
        content: report,
        whisper: [game.user.id]
    });
}
```

## Data Export and Record Keeping

### CSV Export

```javascript
// Export time log as CSV
const csvData = await game.taskTrigger.api.exportTaskTimeLog(taskId, 'csv');
console.log(csvData);

// Save to file (if running in Electron)
if (typeof require !== 'undefined') {
    const fs = require('fs');
    fs.writeFileSync('task-log.csv', csvData);
    ui.notifications.info("Time log exported to task-log.csv");
}
```

### JSON Export

```javascript
// Export as JSON for programmatic use
const jsonData = await game.taskTrigger.api.exportTaskTimeLog(taskId, 'json');
const data = JSON.parse(jsonData);

console.log("Task:", data.taskName);
console.log("Required:", data.requiredTime, "seconds");
console.log("Accumulated:", data.accumulatedTime, "seconds");
console.log("Entries:", data.entries.length);
```

### Creating Reports

```javascript
async function generateProgressReport() {
    const tasks = await game.taskTrigger.api.listAccumulatedTimeTasks();
    
    let report = `# Progress Report - ${new Date().toLocaleDateString()}\n\n`;
    
    for (const task of tasks) {
        const progress = await game.taskTrigger.api.getAccumulatedTimeProgress(task.id);
        const stats = await game.taskTrigger.api.getAccumulatedTimeStatistics(task.id);
        
        if (progress && stats) {
            report += `## ${task.name}\n`;
            report += `- **Progress**: ${(progress.progress * 100).toFixed(1)}%\n`;
            report += `- **Time Logged**: ${(task.accumulatedTime / 3600).toFixed(1)} hours\n`;
            report += `- **Sessions**: ${stats.totalEntries}\n`;
            report += `- **This Week**: ${stats.sessionsThisWeek} sessions\n`;
            
            if (stats.estimatedCompletion) {
                report += `- **Est. Completion**: ${stats.estimatedCompletion.toLocaleDateString()}\n`;
            }
            
            report += `\n`;
        }
    }
    
    // Create journal entry with report
    JournalEntry.create({
        name: `Progress Report - ${new Date().toLocaleDateString()}`,
        content: `<pre>${report}</pre>`
    });
}
```

## Best Practices

### Time Logging Discipline

1. **Regular Logging**: Log time shortly after sessions while details are fresh
2. **Accurate Duration**: Be honest about actual productive time spent
3. **Meaningful Descriptions**: Include what was accomplished, not just time spent
4. **Consistent Units**: Use the same time units throughout a project

### Task Organization

```javascript
// Use consistent naming conventions
const namingPattern = {
    character: "Character Name - Activity",
    world: "Location/Project - Activity",
    research: "Subject - Research Type"
};

// Examples:
await game.taskTrigger.api.createAccumulatedTimeTask({
    name: "Gandalf - Arcane Research",
    description: "Researching the nature of the One Ring",
    // ...
});

await game.taskTrigger.api.createAccumulatedTimeTask({
    name: "Moria - Restoration Project",
    description: "Clearing and rebuilding the great halls",
    // ...
});
```

### Performance Considerations

```javascript
// Batch operations when possible
const taskIds = [taskId1, taskId2, taskId3];
const progressData = await Promise.all(
    taskIds.map(id => game.taskTrigger.api.getAccumulatedTimeProgress(id))
);

// Cache results for UI updates
let cachedProgress = new Map();

async function getCachedProgress(taskId) {
    if (!cachedProgress.has(taskId)) {
        const progress = await game.taskTrigger.api.getAccumulatedTimeProgress(taskId);
        cachedProgress.set(taskId, progress);
    }
    return cachedProgress.get(taskId);
}
```

### Error Handling

```javascript
async function safeTimeLogging(taskId, duration, description) {
    try {
        const isComplete = await game.taskTrigger.api.addTimeToTask(taskId, {
            duration: duration,
            description: description
        });
        
        if (isComplete) {
            ui.notifications.info("Task completed!");
        } else {
            ui.notifications.info("Time logged successfully");
        }
        
        return true;
    } catch (error) {
        console.error("Time logging failed:", error);
        ui.notifications.error(`Failed to log time: ${error.message}`);
        return false;
    }
}
```

## Integration with Other Systems

### Character Sheet Integration

```javascript
// Link accumulated time tasks to specific characters
const characterTasks = new Map();

function linkTaskToCharacter(taskId, actorId) {
    if (!characterTasks.has(actorId)) {
        characterTasks.set(actorId, []);
    }
    characterTasks.get(actorId).push(taskId);
}

// Display character's tasks on sheet
function getCharacterTasks(actorId) {
    return characterTasks.get(actorId) || [];
}
```

### Calendar Integration

```javascript
// Schedule time logging reminders
async function scheduleLoggingReminders(taskId, reminderInterval = { days: 1 }) {
    const reminderId = await game.taskTrigger.api.scheduleRecurringReminder(
        reminderInterval,
        `Don't forget to log time for your ongoing project!`,
        { name: `Time Logging Reminder`, scope: "client" }
    );
    
    return reminderId;
}
```

### Journal Integration

```javascript
// Auto-create journal entries for major milestones
const originalCallback = task.callback;
task.callback = `
    ${originalCallback}
    
    // Create completion journal entry
    JournalEntry.create({
        name: "Task Completed: ${task.name}",
        content: \`
            <h2>${task.name}</h2>
            <p><strong>Completed:</strong> \${new Date().toLocaleDateString()}</p>
            <p><strong>Total Time:</strong> \${(${task.accumulatedTime} / 3600).toFixed(1)} hours</p>
            <p><strong>Description:</strong> ${task.description}</p>
        \`
    });
`;
```

## Troubleshooting

### Common Issues

**Task Not Completing:**
```javascript
// Check if accumulated time meets requirement
const progress = await game.taskTrigger.api.getAccumulatedTimeProgress(taskId);
console.log('Accumulated:', progress.task.accumulatedTime);
console.log('Required:', progress.task.requiredTime);
console.log('Complete:', progress.isComplete);
```

**Time Not Logging:**
```javascript
// Verify task exists and is accumulation type
const progress = await game.taskTrigger.api.getAccumulatedTimeProgress(taskId);
if (!progress) {
    console.log('Task not found or not an accumulated time task');
}
```

**Statistics Not Available:**
```javascript
// Check if task has entries
const stats = await game.taskTrigger.api.getAccumulatedTimeStatistics(taskId);
if (!stats) {
    console.log('No statistics available - task may have no time entries');
}
```

### Debug Information

```javascript
// Comprehensive task debugging
async function debugAccumulatedTask(taskId) {
    console.log('=== Task Debug Information ===');
    
    const progress = await game.taskTrigger.api.getAccumulatedTimeProgress(taskId);
    const stats = await game.taskTrigger.api.getAccumulatedTimeStatistics(taskId);
    const taskInfo = await game.taskTrigger.api.getTaskInfo(taskId);
    
    console.log('Progress:', progress);
    console.log('Statistics:', stats);
    console.log('Task Info:', taskInfo);
    
    if (progress?.timeEntries) {
        console.log('Time Entries:');
        progress.timeEntries.forEach((entry, index) => {
            console.log(`  ${index + 1}: ${entry.duration}s - ${entry.description}`);
        });
    }
}
```

This comprehensive guide covers all aspects of using accumulated time tasks effectively. Remember that this feature is designed to support long-term activities that require consistent effort over time, making it perfect for character development, crafting projects, research, and other extended activities in your game world.