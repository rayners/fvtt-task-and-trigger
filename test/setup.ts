/**
 * Test setup for Task & Trigger module
 */

import { beforeEach, vi } from 'vitest';

// Set up additional global mocks needed for task-manager-application.ts at module level
(globalThis as any).HandlebarsApplicationMixin = (base: any) => {
  return class extends base {
    static PARTS = {
      content: {
        template: 'test-template.hbs',
      },
    };
  };
};

(globalThis as any).DialogV2 = {
  confirm: vi.fn().mockResolvedValue(true),
};

(globalThis as any).Tabs = class MockTabs {
  constructor(options: any) {
    // Mock constructor
  }
  bind(element: any) {
    // Mock bind method
  }
};

(globalThis as any).renderTemplate = vi.fn().mockResolvedValue('<div>Mock Template</div>');

// Set up ApplicationV2 class globally at module level
(globalThis as any).ApplicationV2 = class MockApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: 'mock-app',
    window: { title: 'Mock Application' },
    position: { width: 400, height: 300 },
  };

  get element() {
    return {
      querySelector: vi.fn().mockReturnValue({
        value: 'test',
        checked: false,
      }),
      querySelectorAll: vi.fn().mockReturnValue([]),
    };
  }

  render() {
    return Promise.resolve(this);
  }
  close() {
    return Promise.resolve();
  }

  constructor(options = {}) {
    // Mock constructor
  }

  async _prepareContext() {
    return {};
  }

  _onRender(context: any, options: any) {
    // Mock implementation
  }
};

// Set up foundry globals at module level so they're available during imports
(global as any).foundry = {
  utils: {
    randomID: vi.fn(() => 'test-id-' + Date.now() + '-' + Math.floor(Math.random() * 10000)),
    mergeObject: vi.fn((target, source) => ({ ...target, ...source })),
    debounce: vi.fn().mockImplementation((fn: Function, delay?: number) => {
      // Return the function immediately for tests
      return fn;
    }),
  },
  CONST: {
    DOCUMENT_OWNERSHIP_LEVELS: {
      OBSERVER: 1,
      OWNER: 3,
    },
  },
  applications: {
    api: {
      ApplicationV2: class MockApplicationV2 {
        static DEFAULT_OPTIONS = {
          id: 'mock-app',
          window: { title: 'Mock Application' },
          position: { width: 400, height: 300 },
        };

        get element() {
          return {
            querySelector: vi.fn().mockReturnValue({
              value: 'test',
              checked: false,
            }),
            querySelectorAll: vi.fn().mockReturnValue([]),
          };
        }

        render() {
          return Promise.resolve(this);
        }
        close() {
          return Promise.resolve();
        }

        constructor(options = {}) {
          // Mock constructor
        }

        async _prepareContext() {
          return {};
        }

        _onRender(context: any, options: any) {
          // Mock implementation
        }
      },
      HandlebarsApplicationMixin: (base: any) => {
        return class extends base {
          static PARTS = {
            content: {
              template: 'test-template.hbs',
            },
          };
        };
      },
      DialogV2: {
        confirm: vi.fn().mockResolvedValue(true),
      },
    },
    handlebars: {
      renderTemplate: vi.fn().mockResolvedValue('<div>Mock Template</div>'),
    },
  },
};

// Set up ApplicationV2 class globally before any imports
(globalThis as any).ApplicationV2 = class MockApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: 'mock-app',
    window: { title: 'Mock Application' },
    position: { width: 400, height: 300 },
  };

  get element() {
    return {
      find: vi.fn().mockReturnValue({
        trigger: vi.fn(),
        first: vi.fn().mockReturnValue([1]),
        on: vi.fn(),
        prop: vi.fn(),
        each: vi.fn(),
        hide: vi.fn(),
      }),
    };
  }

  get template() {
    return '';
  }
  render() {
    return this;
  }
  close() {
    return Promise.resolve();
  }
  bringToTop() {}
  get rendered() {
    return true;
  }

  constructor(options = {}) {
    // Mock constructor
  }

  async _prepareContext() {
    return {};
  }

  _onRender(context: any, options: any) {
    // Mock implementation
  }
};

// Mock Foundry globals
beforeEach(() => {
  // Mock game object
  (global as any).game = {
    time: {
      worldTime: Math.floor(Date.now() / 1000),
    },
    modules: new Map([['seasons-and-stars', { active: false }]]),
    settings: {
      get: vi.fn(),
      set: vi.fn(),
      register: vi.fn(),
    },
    journal: {
      getName: vi.fn(),
      create: vi.fn(),
    },
    user: {
      name: 'TestUser',
      isGM: true,
    },
    users: {
      filter: vi.fn(() => []),
    },
    i18n: {
      localize: vi.fn((key: string) => key),
      format: vi.fn((key: string, data: any) => `${key}: ${JSON.stringify(data)}`),
    },
  };

  // Mock ui object
  (global as any).ui = {
    notifications: {
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    },
  };

  // Mock canvas
  (global as any).canvas = {
    ready: true,
  };

  // Mock CONFIG
  (global as any).CONFIG = {};

  // Mock CONST
  (global as any).CONST = {
    DOCUMENT_OWNERSHIP_LEVELS: {
      OBSERVER: 1,
      OWNER: 3,
    },
  };

  // foundry is already set up at module level

  // Mock Hooks
  (global as any).Hooks = {
    on: vi.fn(),
    once: vi.fn(),
    off: vi.fn(),
    call: vi.fn(),
    callAll: vi.fn(),
  };

  // Mock JournalEntry and JournalEntryPage
  (global as any).JournalEntry = {
    create: vi.fn(),
  };

  (global as any).JournalEntryPage = class {
    constructor(data: any) {
      Object.assign(this, data);
    }
  };

  // Mock Macro class
  (globalThis as any).Macro = {
    create: vi.fn(async (data: any) => {
      const id = 'test-macro-' + Date.now();
      const macro = {
        id,
        ...data,
        execute: vi.fn().mockResolvedValue('macro result'),
        update: vi.fn(),
        delete: vi.fn(),
        getFlag: vi.fn((scope: string, key: string) => {
          if (scope === 'task-and-trigger' && key === 'isTaskMacro') return true;
          if (scope === 'task-and-trigger' && key === 'moduleId') return data.moduleId;
          if (scope === 'task-and-trigger' && key === 'isTemporary') return data.isTemporary;
          return undefined;
        }),
        setFlag: vi.fn()
      };
      return macro;
    })
  };

  // Mock ApplicationV2 class
  (global as any).ApplicationV2 = class MockApplicationV2 {
    static DEFAULT_OPTIONS = {
      id: 'mock-app',
      window: { title: 'Mock Application' },
      position: { width: 400, height: 300 },
    };

    get element() {
      return {
        find: vi.fn().mockReturnValue({
          trigger: vi.fn(),
          first: vi.fn().mockReturnValue([1]),
          on: vi.fn(),
          prop: vi.fn(),
          each: vi.fn(),
          hide: vi.fn(),
        }),
      };
    }

    get template() {
      return '';
    }
    render() {
      return this;
    }
    close() {
      return Promise.resolve();
    }
    bringToTop() {}
    get rendered() {
      return true;
    }

    constructor(options = {}) {
      // Mock constructor
    }

    async _prepareContext() {
      return {};
    }

    _onRender(context: any, options: any) {
      // Mock implementation
    }
  };

  // Mock Dialog class
  (global as any).Dialog = vi.fn().mockImplementation((config: any) => ({
    render: vi.fn(),
    close: vi.fn(),
  }));

  // Mock FormApplication class
  (global as any).FormApplication = class MockFormApplication {
    static get defaultOptions() {
      return {
        id: 'mock-form-app',
        title: 'Mock Form Application',
        template: 'mock-template.hbs',
        width: 400,
        height: 300,
        resizable: true,
      };
    }

    constructor(options = {}) {
      // Mock constructor
    }

    async render(force?: boolean, options?: any): Promise<any> {
      return this;
    }

    async _updateObject(event?: Event, formData?: any): Promise<void> {
      // Mock implementation
    }
  };

  // Mock console methods to reduce noise in tests
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
