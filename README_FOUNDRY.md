# Task & Trigger for FoundryVTT

**Automate your game with powerful task scheduling and reminders**

Task & Trigger brings sophisticated automation to your FoundryVTT sessions. Schedule events, create recurring reminders, track long-term activities, and never miss important game moments again.

## 🎯 What Can You Do?

### ⏰ **Real-Time Automation**

- **Session Timers**: "Remind me to take a break in 2 hours"
- **Event Scheduling**: "Trigger the ambush in 30 minutes"
- **Recurring Reminders**: "Save the game every hour"

### 🗓️ **Game-Time Events**

- **Story Triggers**: "The merchant leaves town after 3 days"
- **Environmental Changes**: "Advance weather every 6 hours of game time"
- **Character Actions**: "The spell effect wears off in 1 hour of game time"

### 📚 **Long-Term Projects** _(New!)_

- **Spell Research**: Track 40 hours of magical study
- **Crafting Projects**: Log daily smithing work on that legendary sword
- **Training Activities**: Monitor language learning progress
- **Construction**: Track fortress building over multiple sessions

### 📅 **Calendar Integration**

- **Festival Events**: "Start the harvest festival on Autumn Equinox"
- **Historical Dates**: "The eclipse happens on the 15th day of the 3rd month"
- **Campaign Milestones**: Schedule major story events for specific dates

## 🚀 Quick Start

### Creating Your First Task

1. **Open the Console** (F12 in most browsers)
2. **Create a Simple Reminder**:

```javascript
// Remind yourself to take a break in 15 minutes
await game.taskTrigger.api.scheduleReminder(
  { minutes: 15 },
  "Time for a break! You've been playing for 15 minutes."
);
```

3. **Watch the Magic** - A notification will appear exactly when scheduled!

### Using the Task Manager

- **Access**: Click the Task & Trigger button in the module controls
- **View Tasks**: See all your scheduled events and their status
- **Manage Tasks**: Enable, disable, or cancel tasks as needed
- **Monitor Progress**: Track accumulated time activities

## 📖 Common Examples

### For Game Masters

**Session Management**:

```javascript
// Remind players about saving progress
await game.taskTrigger.api.scheduleRecurringReminder(
  { hours: 1 },
  'Remember to save your character sheets!'
);

// Schedule story events
await game.taskTrigger.api.scheduleGameReminder(
  { days: 3 },
  'The caravan arrives at the next town'
);
```

**Campaign Events**:

```javascript
// Festival on a specific date (requires calendar module)
await game.taskTrigger.api.scheduleForDate(
  { year: 1358, month: 6, day: 21 },
  '🌞 Summer Solstice Festival begins!'
);
```

### For Players

**Character Activities**:

```javascript
// Track spell research (40 hours total)
const researchId = await game.taskTrigger.api.createAccumulatedTimeTask({
  name: 'Fireball Spell Research',
  description: 'Learning the ancient art of evocation',
  requiredTime: { hours: 40 },
});

// Log study sessions
await game.taskTrigger.api.addTimeToTask(researchId, {
  duration: { hours: 3 },
  description: 'Studied fire elemental theory in the library',
});
```

**Game Reminders**:

```javascript
// Spell duration tracking
await game.taskTrigger.api.scheduleGameReminder(
  { hours: 8 },
  "Your long rest is complete - you've recovered all spell slots!"
);
```

## 🛠️ Installation & Setup

### Installation

1. **Install the Module**:
   - Use the module browser in FoundryVTT
   - Search for "Task & Trigger"
   - Click Install

2. **Enable the Module**:
   - Go to Game Settings → Manage Modules
   - Enable "Task & Trigger"
   - Restart your world

### Permissions

- **All Users**: Can create personal (client) tasks and reminders
- **Game Masters**: Can create world-wide tasks that affect all players
- **Macro Creation**: Required for task execution (most users have this by default)

### Recommended Modules

- **Seasons & Stars**: Enhanced calendar integration for date-based scheduling
- **Errors & Echoes**: Better error reporting and debugging

## 🎮 Real Gameplay Examples

### Running a Merchant Shop

```javascript
// The blacksmith works on orders during the day
await game.taskTrigger.api.setGameInterval(
  { hours: 8 }, // Every 8 game hours
  'The blacksmith completes another order. Update shop inventory!'
);
```

### Managing Spell Effects

```javascript
// Track spell durations
await game.taskTrigger.api.scheduleGameReminder(
  { minutes: 10 }, // 10 minutes of game time
  'Mage Armor spell expires in 1 minute!'
);
```

### Long-Term Character Development

```javascript
// Learning a new language
const languageTaskId = await game.taskTrigger.api.createAccumulatedTimeTask({
  name: 'Learning Elvish',
  description: 'Studying with the court wizard',
  requiredTime: { hours: 100 },
});

// Log daily lessons
await game.taskTrigger.api.addTimeToTask(languageTaskId, {
  duration: { hours: 2 },
  description: 'Daily lesson with Elrond',
});
```

### Session Management

```javascript
// Automatic world saves
await game.taskTrigger.api.setInterval(
  { minutes: 30 },
  'Auto-saving world data... 💾'
);

// End-of-session reminders
await game.taskTrigger.api.setTimeout(
  { hours: 4 },
  'Session has been running for 4 hours - consider wrapping up!'
);
```

## 🔧 Features Deep Dive

### Time Specifications

Task & Trigger accepts flexible time formats:

```javascript
// Simple formats
{ minutes: 30 }
{ hours: 2 }
{ days: 1 }

// Combined formats
{ hours: 2, minutes: 30 }
{ days: 1, hours: 8, minutes: 15 }

// For calendar dates
{ year: 1358, month: 6, day: 21 }
```

### Task Scopes

- **Client Tasks**: Only you see them, perfect for personal reminders
- **World Tasks**: Everyone sees them, great for campaign events (GM only)

### Accumulated Time Features

- **Manual Logging**: Log work sessions as you complete them
- **Progress Tracking**: Visual progress bars and completion percentages
- **Statistics**: Average session length, productivity analysis
- **Data Export**: Export time logs for record keeping
- **Flexible Scheduling**: Work in any increments, any time

## 🎯 Use Cases by Game Style

### Narrative Campaigns

- Schedule story beats and dramatic moments
- Track character development activities
- Manage NPC schedules and world events

### Dungeon Crawls

- Spell and ability duration tracking
- Torch burning time
- Random encounter schedules

### Sandbox Games

- Economic simulation (market changes, trade routes)
- Weather and seasonal effects
- Long-term construction projects

### Mystery Games

- Evidence revelation timing
- NPC movement schedules
- Investigation deadline tracking

## 🔒 Security & Performance

### Safe Execution

- All tasks run in FoundryVTT's secure macro environment
- No direct code execution from strings
- Automatic cleanup of old tasks

### Performance

- Minimal impact on FoundryVTT performance
- Efficient storage and retrieval
- Optional task cleanup tools

## 🆘 Troubleshooting

### Common Issues

**"Task not executing"**

- Check if the task is enabled in the Task Manager
- Verify you have macro creation permissions
- Look for JavaScript errors in the browser console

**"Can't create world tasks"**

- Only GMs can create world-scoped tasks
- Check your user permissions

**"Time not logging for accumulated tasks"**

- Verify the task ID is correct
- Check that the task is an accumulated time task type

### Getting Help

- **Issues**: [GitHub Issues](https://github.com/rayners/fvtt-task-and-trigger/issues)
- **Discussions**: [GitHub Discussions](https://github.com/rayners/fvtt-task-and-trigger/discussions)
- **Discord**: Contact rayners78

### Debug Tools

```javascript
// Check if module is ready
game.taskTrigger.api.isReady();

// List all your tasks
await game.taskTrigger.api.listTasks();

// Get task information
await game.taskTrigger.api.getTaskInfo(taskId);
```

## 📚 More Resources

- **[Complete API Documentation](docs/API.md)**: Full technical reference
- **[Usage Examples](docs/USAGE-EXAMPLES.md)**: More practical examples
- **[Accumulated Time Guide](docs/ACCUMULATED-TIME-GUIDE.md)**: Deep dive into long-term tracking

## 🤝 Community

Task & Trigger is actively developed with community input. Share your automation ideas, report issues, and help make the module even better!

**Happy Gaming!** 🎲

---

_Built with AI assistance for the FoundryVTT community_
