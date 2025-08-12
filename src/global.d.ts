/**
 * Global type declarations for Task & Trigger module
 * Extends FoundryVTT types with missing declarations
 */

declare global {
  const renderTemplate: (template: string, data?: any) => Promise<string>;
  
  namespace foundry {
    namespace applications {
      namespace handlebars {
        function renderTemplate(template: string, data?: any): Promise<string>;
      }
      namespace ux {
        class Tabs {
          constructor(options: {
            navSelector: string;
            contentSelector: string;
            initial: string;
          });
          bind(element: HTMLElement): void;
        }
      }
    }
  }
  
  interface HandlebarsStatic {
    registerHelper(name: string, fn: (...args: any[]) => any): void;
  }
}

export {};