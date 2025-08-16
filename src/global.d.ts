/**
 * Global type declarations for Task & Trigger module
 * Extends FoundryVTT types with module-specific declarations
 */

/// <reference types="@rayners/foundry-dev-tools/types/foundry-v13-essentials" />

declare global {
  namespace foundry {
    namespace applications {
      namespace handlebars {
        function renderTemplate(template: string, data?: any): Promise<string>;
      }
      namespace ux {
        class Tabs {
          constructor(options: { navSelector: string; contentSelector: string; initial: string });
          bind(element: HTMLElement): void;
        }
      }
      namespace api {
        interface ApplicationV2Configuration {
          id?: string;
          classes?: string[];
          tag?: string;
          window?: {
            title?: string;
            icon?: string;
            minimizable?: boolean;
            resizable?: boolean;
            positioned?: boolean;
          };
          position?: {
            width?: number | 'auto';
            height?: number | 'auto';
            top?: number;
            left?: number;
          };
          actions?: Record<string, (...args: any[]) => any>;
        }

        interface ApplicationV2RenderOptions {
          force?: boolean;
          focus?: boolean;
        }

        class ApplicationV2 {
          static DEFAULT_OPTIONS: any;
          static PARTS: any;
          constructor(options?: any);
          render(options?: ApplicationV2RenderOptions): Promise<this>;
          close(options?: any): Promise<void>;
          element: HTMLElement;
          _prepareContext(options: Partial<ApplicationV2RenderOptions>): Promise<any>;
          _onRender(context: any, options: Partial<ApplicationV2RenderOptions>): void;
        }

        namespace ApplicationV2 {
          type Configuration = ApplicationV2Configuration;
          type RenderOptions = ApplicationV2RenderOptions;
        }

        function HandlebarsApplicationMixin<T extends new (...args: any[]) => any>(
          base: T
        ): T & {
          prototype: any;
        };

        class DialogV2 {
          static confirm(options: {
            window?: { title: string };
            content: string;
            yes?: {
              label?: string;
              callback?: (...args: any[]) => any;
            };
            no?: {
              label?: string;
              callback?: (...args: any[]) => any;
            };
            defaultYes?: boolean;
          }): Promise<boolean>;
        }
      }
    }
    namespace utils {
      function mergeObject<T>(target: T, source: any, options?: any): T;
      function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): T;
    }
  }

  interface HandlebarsStatic {
    registerHelper(name: string, fn: (...args: any[]) => any): void;
  }
}

// Module-specific types (TaskExecutionResult is defined in types.ts)

// Additional global types needed by this module
declare global {
  type FormApplicationOptions = any;
  type RenderOptions = any;

  class ChatMessage {
    static create(data: any): Promise<any>;
    static getSpeaker(): any;
  }

  class Dialog {
    constructor(data: {
      title: string;
      content: string;
      buttons: Record<string, any>;
      default?: string;
      render?: (html: JQuery) => void;
    });
    render(force?: boolean, options?: any): Dialog;
  }

  class FormApplication {
    static get defaultOptions(): FormApplicationOptions;
    _updateObject(): Promise<void>;
    render(force?: boolean, options?: RenderOptions): Promise<this>;
  }
}

// Fix type issues for arrays with never type - this prevents TypeScript from inferring never[] types
declare global {
  interface Array<T> {
    push(...items: T[]): number;
  }
}

// Add missing types for calendar integration
declare global {
  interface CalendarDate {
    year: number;
    month?: number;
    day?: number;
  }
}

export {};
