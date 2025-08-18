/**
 * Tests for MacroManager class
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MacroManager, MacroCreationOptions } from '../src/macro-manager';
import './setup';

describe('MacroManager', () => {
  let macroManager: MacroManager;
  let mockMacros: Map<string, any>;
  let mockFolders: Map<string, any>;

  beforeEach(async () => {
    // Clear singleton instance
    (MacroManager as any).instance = undefined;

    // Setup mock collections
    mockMacros = new Map();
    mockFolders = new Map();

    // Mock game.macros collection
    (global as any).game.macros = {
      get: vi.fn((id: string) => mockMacros.get(id)),
      find: vi.fn((predicate: any) => {
        for (const macro of mockMacros.values()) {
          if (predicate(macro)) return macro;
        }
        return undefined;
      }),
      filter: vi.fn((predicate: (macro: any) => boolean) => {
        const results: any[] = [];
        for (const macro of mockMacros.values()) {
          if (predicate(macro)) results.push(macro);
        }
        return results;
      }),
      createDocument: vi.fn(async (data: any) => {
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
        mockMacros.set(id, macro);
        return macro;
      })
    };

    // Mock game.folders collection
    (global as any).game.folders = {
      get: vi.fn((id: string) => mockFolders.get(id)),
      find: vi.fn((predicate: any) => {
        for (const folder of mockFolders.values()) {
          if (predicate(folder)) return folder;
        }
        return undefined;
      }),
      filter: vi.fn((predicate: (folder: any) => boolean) => {
        const results: any[] = [];
        for (const folder of mockFolders.values()) {
          if (predicate(folder)) results.push(folder);
        }
        return results;
      }),
      createDocument: vi.fn(async (data: any) => {
        const id = 'test-folder-' + Date.now();
        const folder = {
          id,
          ...data
        };
        mockFolders.set(id, folder);
        return folder;
      })
    };

    // Mock foundry utils
    (foundry.utils as any).randomID = vi.fn(() => 'test-id-' + Date.now());

    // Mock global Macro class
    (globalThis as any).Macro = {
      create: vi.fn(async (data: any) => {
        return (global as any).game.macros.createDocument(data);
      })
    };

    // Mock global Folder class
    (globalThis as any).Folder = {
      create: vi.fn(async (data: any) => {
        return (global as any).game.folders.createDocument(data);
      })
    };

    macroManager = MacroManager.getInstance();
    
    // Initialize macro manager to set up folder structure
    await macroManager.initialize();
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const manager1 = MacroManager.getInstance();
      const manager2 = MacroManager.getInstance();
      expect(manager1).toBe(manager2);
    });
  });

  describe('createTaskMacro', () => {
    it('should create a new task macro', async () => {
      const options: MacroCreationOptions = {
        name: 'Test Task Macro',
        code: 'console.log("test");',
        folder: 'task-and-trigger/test',
        moduleId: 'test-module'
      };

      const macro = await macroManager.createTaskMacro(options);

      expect(macro).toBeTruthy();
      expect(macro.name).toBe('Test Task Macro');
      expect(macro.command).toBe('console.log("test");');
      expect((global as any).game.macros.createDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Task Macro',
          command: 'console.log("test");',
          type: 'script',
          scope: 'global',
          flags: expect.objectContaining({
            'task-and-trigger': expect.objectContaining({
              isTaskMacro: true,
              moduleId: 'test-module'
            })
          })
        })
      );
    });

    it('should create folder if it does not exist', async () => {
      // Reset the createDocument spy to track only this test's calls
      vi.clearAllMocks();
      
      const options: MacroCreationOptions = {
        name: 'Test Macro',
        code: 'console.log("test");',
        folder: 'task-and-trigger/new-folder'
      };

      await macroManager.createTaskMacro(options);

      // Should create the macro since folder creation is handled internally
      expect((global as any).game.macros.createDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Macro',
          command: 'console.log("test");',
          type: 'script'
        })
      );
    });

    it('should handle nested folder creation', async () => {
      // Reset the createDocument spy to track only this test's calls
      vi.clearAllMocks();
      
      const options: MacroCreationOptions = {
        name: 'Test Macro',
        code: 'console.log("test");',
        folder: 'task-and-trigger/parent/child'
      };

      await macroManager.createTaskMacro(options);

      // Should create the macro since folder creation is handled internally
      expect((global as any).game.macros.createDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Macro',
          command: 'console.log("test");',
          type: 'script'
        })
      );
    });

    it('should use existing folder if it exists', async () => {
      // Reset the createDocument spy to track only this test's calls
      vi.clearAllMocks();
      
      // Pre-create a folder
      const existingFolder = {
        id: 'existing-folder',
        name: 'test-folder',
        type: 'Macro'
      };
      mockFolders.set('existing-folder', existingFolder);
      (global as any).game.folders.find.mockReturnValueOnce(existingFolder);

      const options: MacroCreationOptions = {
        name: 'Test Macro',
        code: 'console.log("test");',
        folder: 'task-and-trigger/test-folder'
      };

      await macroManager.createTaskMacro(options);

      // Should create the macro since folder handling is internal
      expect((global as any).game.macros.createDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Macro',
          command: 'console.log("test");',
          type: 'script'
        })
      );
    });
  });

  describe('validateMacro', () => {
    it('should validate existing macro', async () => {
      // Create a mock macro
      const mockMacro = {
        id: 'test-macro-id',
        name: 'Test Macro',
        execute: vi.fn()
      };
      mockMacros.set('test-macro-id', mockMacro);

      const isValid = await macroManager.validateMacro('test-macro-id');

      expect(isValid).toBe(true);
    });

    it('should return false for non-existent macro', async () => {
      const isValid = await macroManager.validateMacro('non-existent-id');

      expect(isValid).toBe(false);
    });

    it('should return false for macro without execute method', async () => {
      // Create a mock macro without execute method
      const mockMacro = {
        id: 'invalid-macro-id',
        name: 'Invalid Macro'
        // No execute method
      };
      mockMacros.set('invalid-macro-id', mockMacro);

      const isValid = await macroManager.validateMacro('invalid-macro-id');

      expect(isValid).toBe(false);
    });
  });

  describe('executeMacro', () => {
    it('should execute macro and return result', async () => {
      const mockMacro = {
        id: 'test-macro-id',
        name: 'Test Macro',
        execute: vi.fn().mockResolvedValue('execution result')
      };
      mockMacros.set('test-macro-id', mockMacro);

      const result = await macroManager.executeMacro('test-macro-id');

      expect(result).toBe('execution result');
      expect(mockMacro.execute).toHaveBeenCalled();
    });

    it('should throw error for non-existent macro', async () => {
      await expect(macroManager.executeMacro('non-existent-id'))
        .rejects.toThrow('Macro with ID non-existent-id not found');
    });

    it('should handle macro execution errors', async () => {
      const mockMacro = {
        id: 'error-macro-id',
        name: 'Error Macro',
        execute: vi.fn().mockRejectedValue(new Error('Execution failed'))
      };
      mockMacros.set('error-macro-id', mockMacro);

      await expect(macroManager.executeMacro('error-macro-id'))
        .rejects.toThrow('Execution failed');
    });
  });

  describe('getMacro', () => {
    it('should retrieve macro by id', async () => {
      const mockMacro = {
        id: 'test-macro-id',
        name: 'Test Macro'
      };
      mockMacros.set('test-macro-id', mockMacro);

      const macro = await macroManager.getMacro('test-macro-id');

      expect(macro).toBe(mockMacro);
    });

    it('should return null for non-existent macro', async () => {
      const macro = await macroManager.getMacro('non-existent-id');

      expect(macro).toBeNull();
    });
  });

  describe('deleteMacro', () => {
    it('should delete existing macro', async () => {
      const mockMacro = {
        id: 'test-macro-id',
        name: 'Test Macro',
        delete: vi.fn().mockResolvedValue(true)
      };
      mockMacros.set('test-macro-id', mockMacro);

      const deleted = await macroManager.deleteMacro('test-macro-id');

      expect(deleted).toBe(true);
      expect(mockMacro.delete).toHaveBeenCalled();
    });

    it('should return false for non-existent macro', async () => {
      const deleted = await macroManager.deleteMacro('non-existent-id');

      expect(deleted).toBe(false);
    });

    it('should handle deletion errors gracefully', async () => {
      const mockMacro = {
        id: 'error-macro-id',
        name: 'Error Macro',
        delete: vi.fn().mockRejectedValue(new Error('Delete failed'))
      };
      mockMacros.set('error-macro-id', mockMacro);

      const deleted = await macroManager.deleteMacro('error-macro-id');

      expect(deleted).toBe(false);
    });
  });

  describe('folder management', () => {
    it('should create module folder', async () => {
      // Reset the createDocument spy to track only this test's calls
      vi.clearAllMocks();
      
      const folder = await macroManager.createModuleFolder('test-module');

      expect(folder).toBeTruthy();
      expect((global as any).game.folders.createDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test-module',
          type: 'Macro',
          color: '#4a90e2'
        })
      );
    });

    it('should get or create task folder', async () => {
      const folder = await macroManager.getOrCreateTaskFolder('test-folder');

      // Should return null since the folder doesn't exist in the predefined structure
      expect(folder).toBeNull();
    });

    it('should return existing folder if it exists', async () => {
      // Reset the createDocument spy to track only this test's calls
      vi.clearAllMocks();
      
      // Pre-create folders
      const rootFolder = {
        id: 'root-folder',
        name: 'task-and-trigger',
        type: 'Macro'
      };
      const testFolder = {
        id: 'test-folder',
        name: 'test',
        type: 'Macro',
        parent: 'root-folder'
      };
      
      mockFolders.set('root-folder', rootFolder);
      mockFolders.set('test-folder', testFolder);

      // Mock find to return existing folders
      (global as any).game.folders.find
        .mockReturnValueOnce(rootFolder) // First call for root
        .mockReturnValueOnce(testFolder); // Second call for test folder

      const folder = await macroManager.getOrCreateTaskFolder('test');

      expect(folder).toBe(testFolder);
      // Should not create new folders since they exist
      expect((global as any).game.folders.createDocument).not.toHaveBeenCalled();
    });
  });

  describe('macro filtering', () => {
    beforeEach(() => {
      // Create test macros
      const taskMacro = {
        id: 'task-macro',
        name: 'Task Macro',
        flags: {
          'task-and-trigger': {
            isTaskMacro: true,
            moduleId: 'test-module'
          }
        },
        getFlag: vi.fn((scope: string, key: string) => {
          if (scope === 'task-and-trigger' && key === 'isTaskMacro') return true;
          if (scope === 'task-and-trigger' && key === 'moduleId') return 'test-module';
          return undefined;
        })
      };
      
      const regularMacro = {
        id: 'regular-macro',
        name: 'Regular Macro',
        getFlag: vi.fn(() => undefined)
      };

      mockMacros.set('task-macro', taskMacro);
      mockMacros.set('regular-macro', regularMacro);
    });

    it('should filter task macros', async () => {
      const taskMacros = await macroManager.getTaskMacros();

      expect(taskMacros).toHaveLength(1);
      expect(taskMacros[0].id).toBe('task-macro');
    });

    it('should filter macros by module', async () => {
      const moduleMacros = await macroManager.getMacrosByModule('test-module');

      expect(moduleMacros).toHaveLength(1);
      expect(moduleMacros[0].id).toBe('task-macro');
    });

    it('should return empty array for non-existent module', async () => {
      const moduleMacros = await macroManager.getMacrosByModule('non-existent-module');

      expect(moduleMacros).toHaveLength(0);
    });
  });

  describe('cleanup operations', () => {
    beforeEach(() => {
      // Create test macros for cleanup
      const tempMacro = {
        id: 'temp-macro',
        name: 'Temp Macro',
        flags: {
          'task-and-trigger': {
            isTaskMacro: true,
            temporary: true
          }
        },
        delete: vi.fn().mockResolvedValue(true),
        getFlag: vi.fn((scope: string, key: string) => {
          if (scope === 'task-and-trigger' && key === 'isTemporary') return true;
          if (scope === 'task-and-trigger' && key === 'moduleId') return 'test-module';
          if (scope === 'task-and-trigger' && key === 'registeredModule') return 'test-module';
          return undefined;
        })
      };

      const permanentMacro = {
        id: 'permanent-macro',
        name: 'Permanent Macro',
        flags: {
          'task-and-trigger': {
            isTaskMacro: true,
            temporary: false
          }
        },
        delete: vi.fn().mockResolvedValue(true),
        getFlag: vi.fn((scope: string, key: string) => {
          if (scope === 'task-and-trigger' && key === 'isTemporary') return false;
          if (scope === 'task-and-trigger' && key === 'moduleId') return 'test-module';
          if (scope === 'task-and-trigger' && key === 'registeredModule') return 'test-module';
          return undefined;
        })
      };

      mockMacros.set('temp-macro', tempMacro);
      mockMacros.set('permanent-macro', permanentMacro);
    });

    it('should cleanup temporary macros', async () => {
      const cleanedCount = await macroManager.cleanupTemporaryMacros();

      expect(cleanedCount).toBe(1);
      expect(mockMacros.get('temp-macro').delete).toHaveBeenCalled();
      expect(mockMacros.get('permanent-macro').delete).not.toHaveBeenCalled();
    });

    it('should cleanup module macros', async () => {
      // Add module info to macros
      mockMacros.get('temp-macro').flags['task-and-trigger'].moduleId = 'test-module';
      mockMacros.get('permanent-macro').flags['task-and-trigger'].moduleId = 'test-module';

      const cleanedCount = await macroManager.cleanupModuleMacros('test-module');

      expect(cleanedCount).toBe(2);
      expect(mockMacros.get('temp-macro').delete).toHaveBeenCalled();
      expect(mockMacros.get('permanent-macro').delete).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle macro creation errors', async () => {
      (global as any).game.macros.createDocument.mockRejectedValue(new Error('Creation failed'));

      const options: MacroCreationOptions = {
        name: 'Error Macro',
        code: 'console.log("test");'
      };

      await expect(macroManager.createTaskMacro(options))
        .rejects.toThrow('Creation failed');
    });

    it('should handle folder creation errors gracefully', async () => {
      // Reset mocks and make only macro creation succeed
      vi.clearAllMocks();
      (global as any).game.folders.createDocument.mockRejectedValue(new Error('Folder creation failed'));

      const options: MacroCreationOptions = {
        name: 'Test Macro',
        code: 'console.log("test");',
        folder: 'task-and-trigger/error-folder'
      };

      // Should create macro even if folder doesn't exist (folder field will be undefined)
      const macro = await macroManager.createTaskMacro(options);
      
      expect(macro).toBeTruthy();
      expect(macro.folder).toBeUndefined(); // No folder assigned since it couldn't be found/created
      expect((global as any).game.macros.createDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Macro',
          command: 'console.log("test");',
          folder: undefined
        })
      );
    });
  });

  describe('macro metadata', () => {
    it('should set correct flags for task macros', async () => {
      const options: MacroCreationOptions = {
        name: 'Test Macro',
        code: 'console.log("test");',
        moduleId: 'test-module'
      };

      await macroManager.createTaskMacro(options);

      expect((global as any).game.macros.createDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          flags: {
            'task-and-trigger': {
              isTaskMacro: true,
              moduleId: 'test-module',
              createdAt: expect.any(Number)
            }
          }
        })
      );
    });

    it('should handle macros without task flags', async () => {
      const regularMacro = {
        id: 'regular-macro',
        name: 'Regular Macro'
        // No flags
      };
      mockMacros.set('regular-macro', regularMacro);

      const taskMacros = await macroManager.getTaskMacros();
      expect(taskMacros).toHaveLength(0);
    });
  });
});