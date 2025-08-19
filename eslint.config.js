import foundryConfig from '@rayners/foundry-dev-tools/eslint';

export default [
  ...foundryConfig,

  // Override TypeScript project config for our source files
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: null, // Disable TypeScript project checking for source files
      },
    },
    rules: {
      // Allow console statements for development and debugging
      'no-console': 'off',
      // Allow any types for FoundryVTT integration where types are complex
      '@typescript-eslint/no-explicit-any': 'off',
      // Allow missing return types for event handlers and simple functions
      '@typescript-eslint/explicit-function-return-type': 'off',
      // Allow non-null assertions for FoundryVTT APIs that are known to exist
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },

  // Test files can use TypeScript project
  {
    files: ['test/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
