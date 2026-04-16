const globals = require('globals');

module.exports = [
  {
    ignores: ['dist/**', 'node_modules/**', 'predictive_downloads/**', 'enhanced_images/**']
  },
  {
    files: ['electron-main.js', 'preload.js', 'src/diff-utils.test.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-const-assign': 'error',
      'no-dupe-keys': 'error',
      'no-unreachable': 'error',
      'no-var': 'error',
      'prefer-const': 'warn',
      eqeqeq: ['error', 'smart']
    }
  },
  {
    files: ['src/app.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.browser }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-var': 'error',
      'prefer-const': 'warn',
      eqeqeq: ['error', 'smart']
    }
  },
  {
    files: ['src/diff-utils.js', 'src/diff-worker.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.browser, ...globals.worker, module: 'readonly' }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-var': 'error',
      'prefer-const': 'warn',
      eqeqeq: ['error', 'smart']
    }
  }
];
