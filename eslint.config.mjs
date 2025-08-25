import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: [
      '**/dist',
      '**/build',
      '**/.react-router',
      '**/vite.config.*.timestamp*',
      '**/vitest.config.*.timestamp*',
      '**/test-output',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            // Apps podem importar de qualquer lib
            {
              sourceTag: 'type:app',
              onlyDependOnLibsWithTags: ['type:lib'],
            },
            {
              sourceTag: 'type:web',
              onlyDependOnLibsWithTags: ['type:lib'],
            },
            {
              sourceTag: 'type:api',
              onlyDependOnLibsWithTags: ['type:lib'],
            },
            // Contexts não podem importar entre si
            {
              sourceTag: 'scope:contexts',
              onlyDependOnLibsWithTags: ['scope:shared', 'scope:ui'],
            },
            // Shared pode ser usado por todos
            {
              sourceTag: 'scope:shared',
              onlyDependOnLibsWithTags: ['scope:shared'],
            },
            // UI pode ser usado por apps web
            {
              sourceTag: 'scope:ui',
              onlyDependOnLibsWithTags: ['scope:shared'],
            },
            // Gateway pode importar de contexts
            {
              sourceTag: 'scope:gateway',
              onlyDependOnLibsWithTags: ['type:lib'],
            },
            // Auth e Deploy podem importar de contexts
            {
              sourceTag: 'scope:auth',
              onlyDependOnLibsWithTags: ['type:lib'],
            },
            {
              sourceTag: 'scope:deploy',
              onlyDependOnLibsWithTags: ['type:lib'],
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    // Override or add rules here
    rules: {},
  },
];
