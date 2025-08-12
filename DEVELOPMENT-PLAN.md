# Task & Trigger Module Development Plan

## Project Overview
Advanced task scheduling and automation system for FoundryVTT with real-time and game-time support, calendar integration, and JavaScript execution capabilities.

## Module Architecture

### Core Components
- **TaskManager**: Central coordinator for all scheduling operations
- **TaskScheduler**: Handles both real-time (setTimeout/setInterval) and game-time tasks
- **JournalStorage**: Persistent storage using custom journal page type (NEW)
- **TaskManagerApplication**: Dedicated UI for task management (NEW)
- **TaskExecutor**: Direct JavaScript evaluation like browser console
- **TimeConverter**: Utilities for Date/object ↔ worldTime conversion 
- **CalendarIntegration**: S&S calendar integration
- **EventLogger**: Automatic logging to journal notes

### API Design
```typescript
// Time specification options
type TimeSpec = Date | number | 
  { days?: number, hours?: number, minutes?: number, seconds?: number } |  // Relative
  { year?: number, month?: number, day?: number, hour?: number, minute?: number }; // Absolute

// Public API accessible via game.taskTrigger.api
interface TaskTriggerAPI {
  // Schedule one-time task (supports all time formats)
  scheduleTask(time: TimeSpec, callback: Function | string, useGameTime?: boolean): string;
  
  // Schedule recurring task with interval object
  scheduleInterval(interval: TimeSpec, callback: Function | string, useGameTime?: boolean): string;
  
  // Cancel any scheduled task
  cancelTask(taskId: string): boolean;
  
  // UI for manual task creation
  showTaskCreator(): void;
  
  // Calendar-specific task creation
  scheduleCalendarTask(calendarDate: any, callback: Function | string, scope: 'world'|'client'): string;
  
  // Get tasks for specific calendar date
  getTasksForDate(calendarDate: any): Task[];
}
```

## UI Architecture: Hybrid Approach

### Primary Interface: Custom Application
- **TaskManagerApplication**: Dedicated Foundry Application for task management
- **Features**: Add/edit/delete tasks, calendar integration, search/filter, import/export
- **Layout**: Tabbed interface (World Tasks / My Tasks), list view with inline editing
- **Calendar Integration**: Embedded calendar picker, visual task scheduling

### Storage System: Journal-Based
- **Storage Method**: Custom journal page type (`task-and-trigger.tasks`)
- **Structure**: Dedicated journal entry with separate pages for world/client tasks
- **Benefits**: Foundry-native storage, permissions, sharing, backup, version history
- **Accessibility**: Users can view/edit raw task data in journal if needed

## Technical Implementation Strategy

### Time Handling (Object-Based + Hook-Driven + Calendar Integration)
- **Real-time tasks**: Standard setTimeout/setInterval for `{ minutes: 15 }`
- **Game-time tasks**: Use Foundry's `updateWorldTime` hook to detect changes
- **Time formats supported**:
  - `new Date('2025-01-15')` - JavaScript Date objects
  - `1642262400` - Unix timestamps  
  - `{ days: 3, hours: 12 }` - Relative time objects
  - `{ year: 2095, month: 2, day: 4 }` - Absolute time objects
- **Hook-based monitoring**: Listen to `updateWorldTime` hook, check if any game-time tasks should fire
- **Persistence**: Store last evaluation timestamp to handle catch-up scenarios

### Seasons & Stars Integration Features

#### 1. Calendar Day Click Integration
- **Hook Integration**: Listen for S&S calendar day click events
- **Context Menu**: Add "Schedule Task" option to calendar day context menu
- **Direct Integration**: If S&S exposes day click hooks, integrate directly
- **Task Creation Flow**:
  1. User clicks calendar day in S&S widget
  2. "Schedule Task" option appears
  3. Task creator opens pre-filled with selected date
  4. User enters JavaScript function and saves to world/client settings

#### 2. Calendar Visual Indicators
- **Day Highlighting**: Add visual indicators (dots, colors, borders) to calendar days with scheduled tasks
- **Tooltip System**: Show task summaries on hover over calendar days
- **Integration Method**: 
  - Hook into S&S calendar rendering
  - Modify day elements to add indicators
  - CSS classes for different task types (one-time vs recurring)

#### 3. Automatic Event Logging
- **Journal Integration**: Create/append to journal notes for current day
- **Log Format**: Timestamped entries when tasks execute
- **Settings Control**: Optional feature - users can enable/disable logging
- **Example Log Entry**: `[14:30] Task executed: "Random encounter check completed"`

## Development Phases

### Phase 1: Core Infrastructure + Journal Storage (2.5 weeks)
1. **Basic Module Setup** 
   - Standard module structure and configuration ✅
   - Custom journal page type registration
   - Basic JournalStorage class implementation

2. **Task Storage System**
   - Journal-based task persistence
   - World/client scope separation via journal pages
   - Migration from settings-based storage (if needed)

### Phase 2: Task Manager Application (2.5 weeks)
1. **Basic Application UI**
   - TaskManagerApplication class implementation
   - Task list display and basic CRUD operations
   - Tabbed interface for world/client tasks

2. **Task Creation/Editing**
   - Rich task creation form
   - Time specification UI with object input
   - JavaScript code editor integration

### Phase 3: Calendar Integration + Advanced Features (2 weeks)
1. **S&S Calendar Integration**
   - Calendar day click handlers for task creation
   - Visual indicators on calendar days
   - Calendar-aware task scheduling

2. **Advanced UI Features**
   - Search, filter, and sort functionality
   - Task templates and bulk operations
   - Import/export capabilities

### Phase 4: Event Logging + Polish (1 week)
1. **Event Logging System**
   - Automatic logging to journal notes
   - Execution history in task manager
   - Error handling and user feedback

2. **Documentation and Testing**
   - UI workflow documentation
   - Comprehensive testing of journal storage
   - S&S integration testing

## Current Progress

### Completed
- ✅ Project directory structure created
- ✅ package.json with dependencies and scripts
- ✅ module.json with proper metadata and relationships

### In Progress
- 🔄 TypeScript and build system configuration
- 🔄 Core module setup and configuration

### Next Steps
1. Set up build system (Rollup, TypeScript, Vitest)
2. Implement TimeConverter for object-based time specifications
3. Create JournalStorage system for task persistence
4. Build core TaskManager and TaskScheduler classes

## User Workflows

### Workflow 1: Task Management via Application
1. User clicks "Task Manager" in sidebar or uses hotkey
2. TaskManagerApplication opens with current tasks
3. User can add/edit/delete tasks using rich interface
4. Changes automatically save to journal storage
5. Tasks execute according to schedule

### Workflow 2: Calendar-Based Task Creation
1. User opens S&S calendar (if available)
2. Clicks on specific day, selects "Schedule Task"
3. Task Manager opens with date pre-filled
4. User enters task details and saves
5. Calendar shows visual indicator for scheduled task

### Workflow 3: Journal-Based Task Viewing
1. User opens "Task & Trigger Configuration" journal
2. Can view raw task data in journal pages
3. Can manually edit tasks if needed (advanced users)
4. Changes sync with Task Manager Application

## Quality Standards
- **S&S Compatibility**: Test with multiple calendar systems
- **Graceful Degradation**: Works without S&S, enhanced with it
- **Testing**: 90%+ coverage including calendar integration
- **Documentation**: Calendar workflow examples and API docs

## Estimated Timeline: 8 weeks
- Phase 1: 2.5 weeks (core + journal storage)
- Phase 2: 2.5 weeks (task manager application)
- Phase 3: 2 weeks (calendar integration)
- Phase 4: 1 week (logging + polish)

---

*This document will be updated as development progresses to track changes and decisions.*