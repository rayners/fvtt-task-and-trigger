/**
 * MacroManager - Handles macro lifecycle management for task execution
 */

export interface MacroCreationOptions {
  name: string;
  code: string;
  type?: 'script' | 'chat';
  scope?: 'global' | 'actors' | 'party';
  folder?: string;
  moduleId?: string; // For module-created macros
}

export interface MacroRegistrationOptions {
  moduleId: string;
  macroId?: string; // Existing macro ID
  macroCode?: string; // Or code to create new macro
  name: string;
  description?: string;
}

export class MacroManager {
  private static instance: MacroManager;
  private folderCache = new Map<string, any>();

  private constructor() {}

  static getInstance(): MacroManager {
    if (!this.instance) {
      this.instance = new MacroManager();
    }
    return this.instance;
  }

  /**
   * Initialize the macro manager and create folder structure
   */
  async initialize(): Promise<void> {
    await this.ensureFolderStructure();
  }

  /**
   * Create the folder structure for task macros
   */
  private async ensureFolderStructure(): Promise<void> {
    const rootFolderName = 'Task & Trigger Macros';
    const subfolders = [
      'Real-Time Tasks',
      'Real-Time Tasks/One-Time',
      'Real-Time Tasks/Recurring',
      'Game-Time Tasks',
      'Game-Time Tasks/One-Time',
      'Game-Time Tasks/Recurring',
      'Calendar Tasks',
      'Accumulated Time Tasks',
      'Module Tasks'
    ];

    // Create root folder
    let rootFolder = this.folderCache.get(rootFolderName);
    if (!rootFolder) {
      rootFolder = await this.findOrCreateFolder(rootFolderName);
      this.folderCache.set(rootFolderName, rootFolder);
    }

    // Create subfolders
    for (const path of subfolders) {
      const fullPath = `${rootFolderName}/${path}`;
      if (!this.folderCache.has(fullPath)) {
        const folder = await this.findOrCreateFolder(path, rootFolder);
        this.folderCache.set(fullPath, folder);
      }
    }
  }

  /**
   * Find or create a folder by name, optionally within a parent folder
   */
  private async findOrCreateFolder(name: string, parent?: any): Promise<any> {
    const folders = (game as any).folders?.filter((f: any) => f.type === 'Macro') || [];
    
    // Look for existing folder
    const existing = folders.find(f => 
      f.name === name && 
      (!parent || f.folder?.id === parent.id)
    );
    
    if (existing) {
      return existing;
    }

    // Create new folder
    const folderData: any = {
      name,
      type: 'Macro',
      color: '#4a90e2', // Blue color for task folders
      sort: 0
    };

    if (parent) {
      folderData.folder = parent.id;
    }

    return await (globalThis as any).Folder.create(folderData);
  }

  /**
   * Create a new macro for task execution
   */
  async createTaskMacro(options: MacroCreationOptions): Promise<any> {
    const folder = await this.getOrCreateTaskFolder(options.folder);
    
    const macroData = {
      name: options.name,
      type: options.type || 'script',
      scope: options.scope || 'global',
      command: options.code,
      folder: folder?.id,
      flags: {
        'task-and-trigger': {
          isTaskMacro: true,
          moduleId: options.moduleId || null,
          createdAt: Date.now()
        }
      }
    };

    return await (globalThis as any).Macro.create(macroData);
  }

  /**
   * Get or create appropriate folder for a task type
   */
  private async getOrCreateTaskFolder(folderHint?: string): Promise<any | null> {
    if (!folderHint) {
      // Default to Real-Time Tasks/One-Time
      folderHint = 'Task & Trigger Macros/Real-Time Tasks/One-Time';
    }

    const folder = this.folderCache.get(folderHint);
    if (folder) {
      return folder;
    }

    // If not in cache, try to find it
    const folders = (game as any).folders?.filter((f: any) => f.type === 'Macro') || [];
    const found = folders.find((f: any) => f.name === folderHint.split('/').pop());
    
    if (found) {
      this.folderCache.set(folderHint, found);
      return found;
    }

    return null;
  }

  /**
   * Create a folder for a specific module
   */
  async createModuleFolder(moduleId: string): Promise<any> {
    const modulesFolder = this.folderCache.get('Task & Trigger Macros/Module Tasks');
    if (!modulesFolder) {
      throw new Error('Module Tasks folder not found');
    }

    const folderName = game.modules.get(moduleId)?.title || moduleId;
    const folder = await this.findOrCreateFolder(folderName, modulesFolder);
    
    const cachePath = `Task & Trigger Macros/Module Tasks/${folderName}`;
    this.folderCache.set(cachePath, folder);
    
    return folder;
  }

  /**
   * Register a macro from an external module
   */
  async registerModuleMacro(options: MacroRegistrationOptions): Promise<string> {
    let macro: any;

    if (options.macroId) {
      // Use existing macro
      macro = (game as any).macros?.get(options.macroId);
      if (!macro) {
        throw new Error(`Macro with ID ${options.macroId} not found`);
      }
    } else if (options.macroCode) {
      // Create new macro
      const moduleFolder = await this.createModuleFolder(options.moduleId);
      
      macro = await this.createTaskMacro({
        name: `[T&T-${options.moduleId}] ${options.name}`,
        code: options.macroCode,
        folder: `Task & Trigger Macros/Module Tasks/${moduleFolder.name}`,
        moduleId: options.moduleId
      });
    } else {
      throw new Error('Either macroId or macroCode must be provided');
    }

    // Mark macro as registered for this module
    await macro.setFlag('task-and-trigger', 'registeredModule', options.moduleId);
    
    return macro.id!;
  }

  /**
   * Execute a macro by ID
   */
  async executeMacro(macroId: string, scope?: Record<string, any>): Promise<any> {
    const macro = (game as any).macros?.get(macroId);
    if (!macro) {
      throw new Error(`Macro with ID ${macroId} not found`);
    }

    // Execute the macro with optional scope
    return await macro.execute(scope);
  }

  /**
   * Generate a unique name for a task macro
   */
  generateTaskMacroName(taskName: string, moduleId?: string): string {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    const prefix = moduleId ? `[T&T-${moduleId}]` : '[T&T]';
    return `${prefix} ${taskName} - ${timestamp}`;
  }

  /**
   * Clean up macros created by a specific module
   */
  async cleanupModuleMacros(moduleId: string): Promise<number> {
    const macros = (game as any).macros?.filter((m: any) => 
      m.getFlag('task-and-trigger', 'moduleId') === moduleId ||
      m.getFlag('task-and-trigger', 'registeredModule') === moduleId
    ) || [];

    let deletedCount = 0;
    for (const macro of macros) {
      try {
        await macro.delete();
        deletedCount++;
      } catch (error) {
        console.warn(`Failed to delete macro ${macro.name}:`, error);
      }
    }

    return deletedCount;
  }

  /**
   * Validate that a macro exists and is accessible
   */
  async validateMacro(macroId: string): Promise<boolean> {
    const macro = (game as any).macros?.get(macroId);
    return !!macro;
  }

  /**
   * Get macro information for display
   */
  getMacroInfo(macroId: string): { name: string; type: string; folder?: string } | null {
    const macro = (game as any).macros?.get(macroId);
    if (!macro) {
      return null;
    }

    return {
      name: macro.name || 'Unnamed Macro',
      type: macro.type || 'script',
      folder: macro.folder?.name
    };
  }

  /**
   * Get all task-related macros
   */
  getTaskMacros(): any[] {
    return (game as any).macros?.filter((m: any) => 
      m.getFlag('task-and-trigger', 'isTaskMacro') ||
      m.folder?.name?.includes('Task & Trigger')
    ) || [];
  }
}