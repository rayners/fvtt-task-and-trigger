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
