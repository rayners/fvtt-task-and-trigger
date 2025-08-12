import { createFoundryConfigWithDir } from '@rayners/foundry-dev-tools/rollup';

export default createFoundryConfigWithDir({
  cssFileName: 'styles/task-and-trigger.css',
  additionalCopyTargets: [
    { src: 'templates/**/*.hbs', dest: 'dist/templates/' },
    { src: 'assets/**/*', dest: 'dist/' }
  ],
  scssOptions: {
    includePaths: ['styles']
  },
  devServerPort: 29998
});