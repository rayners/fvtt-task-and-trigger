# Task & Trigger: GM-Centric Architecture Implementation Plan

## Project Context and Current State

### Current Module Status

- **Version**: Feature branch `feature/macro-based-execution`
- **Test Status**: 326/326 tests passing (100% pass rate)
- **Architecture**: Recently converted from direct JavaScript execution to macro-based execution for security
- **Target**: FoundryVTT v13+
- **Language**: TypeScript with strict mode

### Current Architecture Overview

```
src/
├── api.ts                    # Main API interface (game.taskTrigger.api)
├── task-manager.ts          # Core task management and persistence
├── task-scheduler.ts        # Real-time and game-time scheduling
├── accumulated-time-manager.ts # Manual time logging for long-term tasks
├── macro-manager.ts         # Macro creation and execution
├── journal-storage.ts       # FoundryVTT journal-based data persistence
├── types.ts                 # TypeScript interfaces and types
└── applications/
    └── task-manager-application.ts # Current GM interface
```

### Current Capabilities

- **Real-time scheduling**: `setTimeout`/`setInterval` style tasks using system time
- **Game-time scheduling**: Tasks triggered by in-game time progression
- **Accumulated time tasks**: Manual time logging for activities requiring specific durations
- **Macro-based execution**: All task callbacks execute via FoundryVTT macros for security
- **Dual storage**: World-scoped and client-scoped task persistence
- **Calendar integration**: Optional integration with Seasons & Stars module

### Problem Being Solved

The current architecture allows any user to create tasks and macros, leading to:

1. **Permission complications**: Players hitting macro creation limits
2. **Security concerns**: Players can create arbitrary JavaScript execution
3. **Clutter**: Player-created macros scattered throughout the macro directory
4. **Limited control**: GMs cannot easily oversee all scheduled activities

## Target Architecture Vision

### New GM-Centric Model

- **All task creation restricted to GMs**: Only GMs can create scheduled tasks
- **Socket-based player requests**: Players request accumulated time logging via sockets
- **Task visibility controls**: GM can control what players see (`gm-only`, `player-visible`, `player-notify`)
- **Enhanced GM oversight**: GMs approve or auto-process player time logging requests
- **Organized macro structure**: All task macros organized in GM-controlled folder hierarchy

### Key Benefits

1. **Simplified permissions**: No more player macro creation issues
2. **Enhanced security**: GMs control all executable code
3. **Better organization**: Centralized task and macro management
4. **Improved gameplay**: Players see curated upcoming events and can track progress
5. **Audit trail**: All player actions logged and visible to GM

## Implementation Overview

This document outlines the TDD implementation plan for converting Task & Trigger to a GM-centric architecture with socket-based accumulated time logging.

## Phase 1: Task Visibility Controls

### 1.1 Core Data Model Changes

**File: `src/types.ts`**

```typescript
// Extend existing Task interface
export interface Task {
  // ... existing properties
  visibility: 'gm-only' | 'player-visible' | 'player-notify';
  targetPlayers?: string[]; // For player-specific tasks
  isPersonalReminder?: boolean; // GM personal vs world management
  gmNotes?: string; // Private notes only GM can see
}

// New visibility-related types
export interface TaskVisibilityOptions {
  visibility: 'gm-only' | 'player-visible' | 'player-notify';
  targetPlayers?: string[];
  gmNotes?: string;
}

export interface PlayerTaskView {
  id: string;
  name: string;
  description?: string;
  nextExecution?: number;
  isRecurring: boolean;
  useGameTime: boolean;
  // Excludes: callback, gmNotes, internal details
}
```

### 1.2 Task Manager Updates

**File: `src/task-manager.ts`**

```typescript
export class TaskManager {
  // Add visibility filtering methods
  async getPlayerVisibleTasks(userId?: string): Promise<PlayerTaskView[]> {
    const allTasks = await this.getAllTasks();
    return allTasks
      .filter(task => this.isVisibleToPlayer(task, userId))
      .map(task => this.createPlayerView(task));
  }

  async getGMTasks(): Promise<Task[]> {
    // GM sees all tasks with full details
    return this.getAllTasks();
  }

  private isVisibleToPlayer(task: Task, userId?: string): boolean {
    if (task.visibility === 'gm-only') return false;
    if (
      task.visibility === 'player-visible' ||
      task.visibility === 'player-notify'
    ) {
      if (task.targetPlayers && task.targetPlayers.length > 0) {
        return task.targetPlayers.includes(userId || game.user.id);
      }
      return true; // Visible to all players if no specific targets
    }
    return false;
  }

  private createPlayerView(task: Task): PlayerTaskView {
    return {
      id: task.id,
      name: task.name,
      description: task.description,
      nextExecution: task.nextExecution,
      isRecurring: task.isRecurring,
      useGameTime: task.useGameTime,
    };
  }
}
```

### 1.3 API Updates

**File: `src/api.ts`**

```typescript
export class TaskTriggerAPI {
  // Update existing methods to include visibility
  async setTimeout(
    delay: TimeSpec,
    macroId: string,
    options?: ScheduleOptions & TaskVisibilityOptions
  ): Promise<string> {
    if (!game.user.isGM) {
      throw new Error('Only GMs can create scheduled tasks');
    }
    // ... existing logic with visibility options
  }

  // Add player-specific read-only methods
  async getUpcomingEvents(userId?: string): Promise<PlayerTaskView[]> {
    return this.taskManager.getPlayerVisibleTasks(userId);
  }

  async getPlayerNotifications(userId?: string): Promise<PlayerTaskView[]> {
    const tasks = await this.taskManager.getPlayerVisibleTasks(userId);
    return tasks.filter(task => {
      const fullTask = await this.taskManager.getTask(task.id);
      return fullTask?.visibility === 'player-notify';
    });
  }
}
```

## Phase 2: Socket-Based Accumulated Time Logging

### 2.1 SocketLib Integration

**File: `src/socket-manager.ts` (New)**

```typescript
export class SocketManager {
  private socketHandler: any;
  private accumulatedTimeManager: AccumulatedTimeManager;

  constructor(accumulatedTimeManager: AccumulatedTimeManager) {
    this.accumulatedTimeManager = accumulatedTimeManager;
  }

  async initialize(): Promise<void> {
    if (game.modules.get('socketlib')?.active) {
      Hooks.once('socketlib.ready', () => {
        this.socketHandler = (socketlib as any).registerModule(
          'task-and-trigger'
        );

        // Register socket handlers
        this.socketHandler.register(
          'requestTimeLog',
          this.handleTimeLogRequest.bind(this)
        );
        this.socketHandler.register(
          'notifyTimeLogUpdate',
          this.handleTimeLogUpdate.bind(this)
        );
        this.socketHandler.register(
          'requestTaskProgress',
          this.handleProgressRequest.bind(this)
        );
      });
    } else {
      // Fallback to native socket handling
      game.socket?.on(
        'module.task-and-trigger',
        this.handleSocketMessage.bind(this)
      );
    }
  }

  // Player requests time logging
  async requestTimeLog(
    taskId: string,
    entry: TimeLogEntry
  ): Promise<{ success: boolean; message?: string }> {
    if (game.user.isGM) {
      // GM can log directly
      const success = await this.accumulatedTimeManager.addTime(taskId, entry);
      return { success };
    }

    // Player sends request to GM
    try {
      const result = await this.socketHandler.executeAsGM('requestTimeLog', {
        taskId,
        entry: {
          ...entry,
          requestedBy: game.user.id,
          requestedByName: game.user.name,
        },
        timestamp: Date.now(),
      });
      return result;
    } catch (error) {
      console.error('Socket request failed:', error);
      return {
        success: false,
        message: 'Failed to reach GM - they may be offline',
      };
    }
  }

  // GM-side: Handle time log requests
  private async handleTimeLogRequest(data: {
    taskId: string;
    entry: TimeLogEntry & { requestedBy: string; requestedByName: string };
    timestamp: number;
  }): Promise<{ success: boolean; message?: string }> {
    if (!game.user.isGM) {
      return { success: false, message: 'Only GM can approve time logs' };
    }

    try {
      // Validate the request
      const task = await this.accumulatedTimeManager.getTask(data.taskId);
      if (!task) {
        return { success: false, message: 'Task not found' };
      }

      // Option 1: Auto-approve
      const isComplete = await this.accumulatedTimeManager.addTime(
        data.taskId,
        data.entry
      );

      // Option 2: Add to approval queue (future enhancement)
      // await this.addToApprovalQueue(data);

      // Notify all players of the update
      this.socketHandler.executeForEveryone('notifyTimeLogUpdate', {
        taskId: data.taskId,
        taskName: task.name,
        loggedBy: data.entry.requestedByName,
        duration: data.entry.duration,
        isComplete,
      });

      // Create chat message for transparency
      ChatMessage.create({
        content: `Time logged for "${task.name}": ${this.formatDuration(data.entry.duration)} by ${data.entry.requestedByName}`,
        type: CONST.CHAT_MESSAGE_TYPES.OTHER,
        speaker: { alias: 'Task & Trigger' },
      });

      return { success: true };
    } catch (error) {
      console.error('Time log processing failed:', error);
      return { success: false, message: error.message };
    }
  }

  // All players: Handle time log updates
  private async handleTimeLogUpdate(data: {
    taskId: string;
    taskName: string;
    loggedBy: string;
    duration: TimeSpec;
    isComplete: boolean;
  }): Promise<void> {
    // Update local UI if needed
    Hooks.callAll('taskTriggerTimeLogged', data);

    // Show notification
    const message = data.isComplete
      ? `Task "${data.taskName}" completed!`
      : `Time logged for "${data.taskName}" by ${data.loggedBy}`;

    ui.notifications.info(message);
  }
}
```

### 2.2 Enhanced Accumulated Time Manager

**File: `src/accumulated-time-manager.ts`**

```typescript
export class AccumulatedTimeManager {
  private socketManager: SocketManager;

  constructor(taskManager: TaskManager) {
    // ... existing constructor
    this.socketManager = new SocketManager(this);
  }

  async initialize(): Promise<void> {
    // ... existing initialization
    await this.socketManager.initialize();
  }

  // Enhanced time logging with socket support
  async requestTimeLog(taskId: string, entry: TimeLogEntry): Promise<boolean> {
    const result = await this.socketManager.requestTimeLog(taskId, entry);
    if (!result.success && result.message) {
      ui.notifications.error(result.message);
    }
    return result.success;
  }

  // GM approval queue (future enhancement)
  async getPendingApprovals(): Promise<PendingTimeLogEntry[]> {
    // Return list of pending time log requests for GM review
    return [];
  }

  async approveTimeLog(entryId: string): Promise<boolean> {
    // Approve a pending time log entry
    return false;
  }

  async rejectTimeLog(entryId: string, reason?: string): Promise<boolean> {
    // Reject a pending time log entry
    return false;
  }
}

export interface PendingTimeLogEntry {
  id: string;
  taskId: string;
  taskName: string;
  entry: TimeLogEntry;
  requestedBy: string;
  requestedByName: string;
  timestamp: number;
  status: 'pending' | 'approved' | 'rejected';
}
```

## Phase 3: UI Components

### 3.1 Player Interface Components

**File: `src/applications/player-task-view.ts` (New)**

```typescript
export class PlayerTaskView extends Application {
  static get defaultOptions() {
    return {
      ...super.defaultOptions,
      id: 'player-task-view',
      title: 'Upcoming Events',
      template: 'modules/task-and-trigger/templates/player-task-view.hbs',
      width: 400,
      height: 600,
      resizable: true,
    };
  }

  async getData() {
    const upcomingTasks = await game.taskTrigger.api.getUpcomingEvents();
    const myProgressTasks =
      await game.taskTrigger.api.getPlayerAccumulatedTimeTasks();

    return {
      upcomingTasks: upcomingTasks.slice(0, 10), // Next 10 events
      myProgressTasks,
      canLogTime: !game.user.isGM, // Players use request system
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find('.log-time-btn').click(this._onLogTime.bind(this));
    html.find('.view-progress-btn').click(this._onViewProgress.bind(this));
  }

  async _onLogTime(event) {
    const taskId = event.currentTarget.dataset.taskId;
    const dialog = new TimeLogDialog(taskId, {
      submitCallback: async (taskId, entry) => {
        const success = await game.taskTrigger.accumulatedTime.requestTimeLog(
          taskId,
          entry
        );
        if (success) {
          ui.notifications.info('Time log request sent to GM');
          this.render();
        }
      },
    });
    dialog.render(true);
  }
}
```

### 3.2 Enhanced GM Interface

**File: `src/applications/task-manager-application.ts`**

```typescript
export class TaskManagerApplication extends Application {
  // Add visibility controls to task creation form
  async getData() {
    const data = await super.getData();

    return {
      ...data,
      visibilityOptions: [
        { value: 'gm-only', label: 'GM Only (Private)' },
        { value: 'player-visible', label: 'Players Can See' },
        { value: 'player-notify', label: 'Notify Players When Executed' },
      ],
      playerList: game.users
        .filter(u => !u.isGM)
        .map(u => ({
          id: u.id,
          name: u.name,
        })),
      pendingApprovals:
        await game.taskTrigger.accumulatedTime.getPendingApprovals(),
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Existing listeners...

    // New visibility controls
    html
      .find('.visibility-control')
      .change(this._onVisibilityChange.bind(this));
    html.find('.approve-time-btn').click(this._onApproveTime.bind(this));
    html.find('.reject-time-btn').click(this._onRejectTime.bind(this));
    html.find('.player-view-btn').click(this._onShowPlayerView.bind(this));
  }

  async _onApproveTime(event) {
    const entryId = event.currentTarget.dataset.entryId;
    await game.taskTrigger.accumulatedTime.approveTimeLog(entryId);
    this.render();
  }

  async _onShowPlayerView(event) {
    // Show GM what players see
    const playerView = new PlayerTaskView();
    playerView.render(true);
  }
}
```

## Phase 4: Templates and Styling

### 4.1 Player Task View Template

**File: `templates/player-task-view.hbs` (New)**

```handlebars
<div class='player-task-view'>
  <div class='tab-bar'>
    <a class='tab active' data-tab='upcoming'>Upcoming Events</a>
    <a class='tab' data-tab='progress'>My Progress</a>
  </div>

  <div class='tab-content' data-tab='upcoming'>
    <h3>Next Events</h3>
    {{#if upcomingTasks}}
      <ul class='task-list'>
        {{#each upcomingTasks}}
          <li class='task-item'>
            <div class='task-name'>{{name}}</div>
            <div class='task-time'>{{formatTime nextExecution}}</div>
            {{#if description}}<div
                class='task-desc'
              >{{description}}</div>{{/if}}
          </li>
        {{/each}}
      </ul>
    {{else}}
      <p class='no-tasks'>No upcoming events scheduled</p>
    {{/if}}
  </div>

  <div class='tab-content' data-tab='progress' style='display: none;'>
    <h3>My Active Projects</h3>
    {{#if myProgressTasks}}
      <ul class='progress-list'>
        {{#each myProgressTasks}}
          <li class='progress-item'>
            <div class='progress-header'>
              <span class='task-name'>{{name}}</span>
              <span class='progress-percent'>{{progressPercent}}%</span>
            </div>
            <div class='progress-bar'>
              <div
                class='progress-fill'
                style='width: {{progressPercent}}%'
              ></div>
            </div>
            <div class='progress-actions'>
              <button class='log-time-btn' data-task-id='{{id}}'>Log Time</button>
              <button class='view-progress-btn' data-task-id='{{id}}'>View
                Details</button>
            </div>
          </li>
        {{/each}}
      </ul>
    {{else}}
      <p class='no-tasks'>No active projects</p>
    {{/if}}
  </div>
</div>
```

## Phase 5: Module Integration Updates

### 5.1 Module Manifest Updates

**File: `module.json`**

```json
{
  "dependencies": [
    {
      "name": "socketlib",
      "type": "module",
      "manifest": "https://github.com/manuelVo/foundryvtt-socketlib/releases/latest/download/module.json",
      "compatibility": {
        "verified": "1.0.0"
      }
    }
  ],
  "socket": true
}
```

### 5.2 Main Module Updates

**File: `src/module.ts`**

```typescript
// Initialize socket manager
Hooks.once('ready', async () => {
  // ... existing initialization

  // Initialize socket communications
  await game.taskTrigger.accumulatedTime.initialize();

  // Add player task view button to UI
  if (!game.user.isGM) {
    const button = $(`
      <li class="scene-control" data-tool="player-tasks">
        <i class="fas fa-clock"></i>
        <span>My Tasks</span>
      </li>
    `);

    button.click(() => {
      new PlayerTaskView().render(true);
    });

    $('#controls .main-controls').append(button);
  }
});
```

## Implementation Timeline (Test-Driven Development)

### Week 1: Foundation with TDD

**Day 1-2: Test Setup and Task Visibility Model**

- [ ] Write tests for task visibility filtering logic
- [ ] Write tests for PlayerTaskView data structure
- [ ] Implement TaskVisibilityOptions interface (red → green)
- [ ] Write tests for isVisibleToPlayer() method
- [ ] Implement visibility filtering in TaskManager (red → green)

**Day 3-4: API Layer Tests**

- [ ] Write tests for GM-only task creation restrictions
- [ ] Write tests for player read-only API methods
- [ ] Implement GM permission checks (red → green)
- [ ] Write tests for getUpcomingEvents() filtering
- [ ] Implement player API methods (red → green)

**Day 5: Refactor and Integration**

- [ ] Refactor visibility logic for better testability
- [ ] Write integration tests for complete visibility workflow
- [ ] Ensure all tests pass before moving to Week 2

### Week 2: Socket Infrastructure with TDD

**Day 1-2: Socket Manager Tests**

- [ ] Write tests for SocketManager initialization
- [ ] Write tests for socket message handling (mocked)
- [ ] Implement basic SocketManager structure (red → green)
- [ ] Write tests for requestTimeLog() success/failure scenarios
- [ ] Implement socket request logic (red → green)

**Day 3-4: Time Logging Tests**

- [ ] Write tests for GM-side time log processing
- [ ] Write tests for player notification broadcasts
- [ ] Implement handleTimeLogRequest() method (red → green)
- [ ] Write tests for offline queue functionality
- [ ] Implement offline handling (red → green)

**Day 5: Socket Integration Tests**

- [ ] Write end-to-end socket communication tests
- [ ] Write tests for SocketLib vs native socket fallback
- [ ] Refactor socket handling for better testability
- [ ] Mock SocketLib for testing environment

### Week 3: UI Components with TDD

**Day 1-2: Player Interface Tests**

- [ ] Write tests for PlayerTaskView component rendering
- [ ] Write tests for task list filtering and display
- [ ] Implement PlayerTaskView component (red → green)
- [ ] Write tests for time logging form validation
- [ ] Implement TimeLogDialog component (red → green)

**Day 3-4: GM Interface Tests**

- [ ] Write tests for enhanced TaskManager visibility controls
- [ ] Write tests for pending approval queue display
- [ ] Implement GM interface enhancements (red → green)
- [ ] Write tests for player view simulation
- [ ] Implement "what players see" functionality (red → green)

**Day 5: UI Integration Tests**

- [ ] Write tests for complete user workflows
- [ ] Write tests for error handling in UI components
- [ ] Refactor UI components for better testability
- [ ] Mock socket communications for UI tests

### Week 4: System Integration and E2E Testing

**Day 1-2: End-to-End Test Suite**

- [ ] Write E2E tests for complete GM→Player task workflows
- [ ] Write E2E tests for accumulated time request→approval cycles
- [ ] Write E2E tests for offline/online GM scenarios
- [ ] Implement test fixtures and mock data helpers

**Day 3-4: Error Scenarios and Edge Cases**

- [ ] Write tests for socket timeout scenarios
- [ ] Write tests for malformed data handling
- [ ] Write tests for permission edge cases
- [ ] Write tests for concurrent user scenarios
- [ ] Implement robust error handling (red → green)

**Day 5: Documentation and Final Polish**

- [ ] Write tests for migration from existing tasks
- [ ] Implement migration utilities (red → green)
- [ ] Update all documentation
- [ ] Ensure 100% test coverage for new features

## Dependencies and Prerequisites

### Required Modules

- **SocketLib**: Optional but recommended for enhanced socket reliability
  - Repository: https://github.com/manuelVo/foundryvtt-socketlib
  - Version: 1.0.0+
  - Purpose: Simplified socket communication with GM execution patterns

### Development Dependencies

- **@rayners/foundry-dev-tools**: Already configured for FoundryVTT testing
- **Vitest**: Test runner (configured)
- **TypeScript**: 5.0+ with strict mode
- **Node.js**: 18+ for development

### Current Test Infrastructure

```bash
# Existing test commands (maintain these patterns)
npm test              # Watch mode testing
npm run test:run      # Single run (use for CI)
npm run test:coverage # Coverage reports
npm run test:coverage:junit # CI format

# Current test structure
test/
├── setup.ts          # Existing FoundryVTT mocks
├── *.test.ts         # 326 existing tests (all passing)
└── fixtures/         # Test data (to be expanded)
```

### Key Files to Understand Before Starting

#### Core API Entry Point

**File**: `src/api.ts`

- Current public interface: `game.taskTrigger.api`
- Methods: `setTimeout`, `setInterval`, `createAccumulatedTimeTask`, etc.
- **Changes needed**: Add GM permission checks to all creation methods

#### Task Management Core

**File**: `src/task-manager.ts`

- Handles task persistence and lifecycle
- Currently uses world/client scoping
- **Changes needed**: Add visibility filtering methods

#### Accumulated Time System

**File**: `src/accumulated-time-manager.ts`

- Current: Direct player access to `addTime()` method
- **Changes needed**: Convert to socket-based request system

#### Current Macro System

**File**: `src/macro-manager.ts`

- Handles macro creation and organization
- Already has folder structure support
- **Changes needed**: Minimal - already supports GM-only creation

### Environment Setup

```bash
# Clone and setup (if starting fresh)
git clone <repository>
cd fvtt-task-and-trigger
git checkout feature/macro-based-execution
npm install

# Verify current state
npm run test:run  # Should show 326/326 tests passing
npm run build     # Should compile successfully

# Start development
npm test          # Watch mode for TDD
```

## TDD Implementation Guidelines

### Current Test Patterns to Follow

The existing test suite uses these patterns that should be maintained:

```typescript
// Example from existing tests (follow this structure)
describe('TaskManager', () => {
  let taskManager: TaskManager;

  beforeEach(async () => {
    // Clear singleton instance (existing pattern)
    (TaskManager as any).instance = undefined;

    // Setup mocks (existing pattern)
    setupFoundryMocks();

    taskManager = TaskManager.getInstance();
  });

  it('should handle task creation', async () => {
    // Arrange - Act - Assert pattern
  });
});
```

### Test Structure Standards

```typescript
// Example test structure for each feature
describe('TaskVisibilityManager', () => {
  describe('isVisibleToPlayer()', () => {
    it('should return false for gm-only tasks', async () => {
      // Arrange
      const task: Task = { visibility: 'gm-only', ... };
      const playerId = 'player1';

      // Act
      const result = manager.isVisibleToPlayer(task, playerId);

      // Assert
      expect(result).toBe(false);
    });

    it('should return true for player-visible tasks', async () => {
      // Similar structure...
    });

    it('should respect targetPlayers array', async () => {
      // Similar structure...
    });
  });
});
```

### Test Categories by Phase

**Phase 1: Unit Tests**

- Individual method functionality
- Data model validation
- Permission checking logic
- Visibility filtering algorithms

**Phase 2: Integration Tests**

- Socket message flow
- Component interaction
- API layer integration
- Error propagation

**Phase 3: Component Tests**

- UI component rendering
- User interaction simulation
- Form validation
- State management

**Phase 4: End-to-End Tests**

- Complete user workflows
- Cross-component communication
- Real-world scenario simulation
- Performance and reliability

### Test Tools and Setup

**File: `test/setup-tdd.ts` (New)**

```typescript
// Enhanced test setup for TDD workflow
export class TDDTestHelper {
  static createMockGM(): User {
    return { id: 'gm1', isGM: true, name: 'TestGM' };
  }

  static createMockPlayer(id: string): User {
    return { id, isGM: false, name: `Player${id}` };
  }

  static createMockTask(overrides: Partial<Task> = {}): Task {
    return {
      id: 'test-task',
      visibility: 'player-visible',
      name: 'Test Task',
      ...overrides,
    };
  }

  static mockSocketLib(): void {
    // Mock SocketLib for testing
  }
}
```

### Red-Green-Refactor Cycle

**Red Phase**: Write failing test

```typescript
it('should restrict task creation to GMs only', async () => {
  const mockPlayer = TDDTestHelper.createMockPlayer('player1');
  game.user = mockPlayer;

  await expect(api.setTimeout({ minutes: 5 }, 'macro-id')).rejects.toThrow(
    'Only GMs can create scheduled tasks'
  );
});
```

**Green Phase**: Minimal implementation

```typescript
async setTimeout(delay: TimeSpec, macroId: string): Promise<string> {
  if (!game.user.isGM) {
    throw new Error('Only GMs can create scheduled tasks');
  }
  // ... rest of implementation
}
```

**Refactor Phase**: Improve code quality

```typescript
private validateGMPermission(): void {
  if (!game.user.isGM) {
    throw new Error('Only GMs can create scheduled tasks');
  }
}

async setTimeout(delay: TimeSpec, macroId: string): Promise<string> {
  this.validateGMPermission();
  // ... rest of implementation
}
```

### Coverage Requirements

- **Unit Tests**: 95%+ coverage for all new code
- **Integration Tests**: Cover all public API methods
- **Component Tests**: Cover all UI interactions
- **E2E Tests**: Cover all user workflows

### Test Data Management

**File: `test/fixtures/tdd-fixtures.ts` (New)**

```typescript
export const TaskFixtures = {
  gmOnlyTask: (): Task => ({
    id: 'gm-task-1',
    visibility: 'gm-only',
    name: 'GM Secret Reminder',
    // ... other properties
  }),

  playerVisibleTask: (): Task => ({
    id: 'player-task-1',
    visibility: 'player-visible',
    name: 'Public Event',
    // ... other properties
  }),

  targetedTask: (players: string[]): Task => ({
    id: 'targeted-task-1',
    visibility: 'player-visible',
    targetPlayers: players,
    name: 'Targeted Event',
    // ... other properties
  }),
};
```

## Risk Mitigation

### Technical Risks

1. **SocketLib Dependency**: Provide fallback to native sockets
2. **GM Offline Scenarios**: Implement local queuing with sync
3. **Race Conditions**: Use acknowledgment patterns and retries
4. **Performance**: Batch updates and implement rate limiting

### User Experience Risks

1. **Learning Curve**: Provide clear documentation and examples
2. **GM Workflow Disruption**: Make approval process optional initially
3. **Player Confusion**: Clear feedback on request status

## Success Metrics

1. **Functionality**: All socket communications work reliably
2. **Performance**: No noticeable lag in UI updates
3. **Usability**: Players can easily request time logging
4. **Control**: GMs have full oversight of accumulated time tasks
5. **Compatibility**: Works with and without SocketLib

## Future Enhancements

1. **Approval Queue UI**: Visual queue for GM to review time requests
2. **Bulk Operations**: Approve/reject multiple requests at once
3. **Templates**: Common time logging templates for different activities
4. **Integration**: Hooks for other modules to extend functionality
5. **Analytics**: Statistics and reporting on task completion patterns

## Session Continuity Information

### Getting Started in a New Session

1. **Check Current State**:

   ```bash
   git status                    # Verify you're on feature/macro-based-execution
   npm run test:run             # Should show 326/326 tests passing
   git log --oneline -5         # See recent commits
   ```

2. **Understand Current Branch**:
   - **Branch**: `feature/macro-based-execution`
   - **Last Major Change**: Macro-based execution conversion completed
   - **Test Status**: All tests passing (100% coverage achieved)
   - **Next Step**: Begin GM-centric architecture conversion

3. **Implementation Status Tracking**:
   Current todos in progression order:
   - [ ] Create enhanced TDD test setup with socket-specific mocking
   - [ ] Implement TaskFixtures and SocketFixtures for test data
   - [ ] Add socket test patterns for GM offline scenarios
   - [ ] Add task visibility controls (gm-only/player-visible/player-notify)
   - [ ] Split API into GM (full) and Player (read-only) interfaces
   - [ ] Implement SocketLib integration for time logging requests
   - [ ] Create player 'upcoming events' view with visibility filtering

4. **Key Decisions Made**:
   - **Socket Approach Confirmed**: Use SocketLib for GM-player communication
   - **Auto-approve Initially**: Start with auto-approve, add manual queue later
   - **TDD Methodology**: Test-first development for all new features
   - **95% Coverage Goal**: For business logic, 75%+ for UI components

5. **Architecture Decisions**:
   - **GM-Only Task Creation**: All task creation restricted to GMs
   - **Socket-Based Time Logging**: Players request via sockets, GM processes
   - **Visibility Controls**: Three levels: gm-only, player-visible, player-notify
   - **Existing Tests Maintained**: 326 tests must continue passing

### Quick Start Commands for Development

```bash
# Start TDD development session
npm test                      # Watch mode for continuous testing

# Run specific test files during development
npm test -- task-visibility  # Test files matching pattern
npm test -- socket          # Socket-related tests

# Check overall test status
npm run test:run             # Full test suite
npm run test:coverage        # Coverage report

# Build verification
npm run build                # Ensure TypeScript compiles
npm run lint                 # Code quality check
```

### Files to Focus on First (TDD Order)

**Week 1 - Day 1 Focus**:

1. **src/types.ts**: Add visibility interfaces
2. **test/setup-tdd.ts**: Create TDD helper (new file)
3. **test/fixtures/**: Create test data fixtures
4. **src/task-manager.ts**: Add visibility filtering

**Reference Files** (understand but don't modify yet):

- `src/api.ts`: Current public interface
- `src/accumulated-time-manager.ts`: Socket conversion target
- `test/setup.ts`: Existing mock patterns to follow

### Common Gotchas for New Sessions

1. **Test Command**: Always use `npm run test:run` for CI-style runs, `npm test` for development
2. **Singleton Pattern**: Clear instances in beforeEach: `(ClassName as any).instance = undefined`
3. **Mock Cleanup**: Use `vi.clearAllMocks()` between tests
4. **Async Patterns**: Most FoundryVTT operations are async, test accordingly
5. **Branch Status**: Stay on `feature/macro-based-execution` throughout this work

### Expert Review Summary

The foundry-module-expert reviewed this plan and confirmed:

- ✅ **TDD approach is excellent** for this conversion
- ✅ **Socket-based architecture is recommended** (follows FoundryVTT patterns)
- ✅ **Timeline is realistic** with suggested buffer days
- ✅ **Test coverage goals are appropriate** for the complexity
- ⚠️ **Socket testing needs specific patterns** (mocking strategies)
- ⚠️ **UI testing in FoundryVTT requires extra time** (plan accordingly)

### Success Criteria for This Implementation

**Technical**:

- All 326 existing tests continue passing
- New features achieve 95%+ test coverage
- Socket communication works reliably with offline handling
- GM-only permissions properly enforced

**User Experience**:

- Players can request time logging without macro permissions
- GMs have full control over task visibility and execution
- "Upcoming events" view shows relevant information to players
- Accumulated time progress tracking works seamlessly

**Architecture**:

- Clean separation between GM and player APIs
- Robust error handling for socket failures
- Maintainable code following existing patterns
- Comprehensive test coverage for future modifications
