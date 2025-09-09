import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist'],
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
            {
              sourceTag: 'scope:shared',
              onlyDependOnLibsWithTags: ['scope:shared'],
            },
            {
              sourceTag: 'scope:auth',
              onlyDependOnLibsWithTags: ['scope:shared', 'scope:config'],
            },
            {
              sourceTag: 'scope:deploy',
              onlyDependOnLibsWithTags: ['scope:shared', 'scope:config'],
            },
            {
              sourceTag: 'scope:monitor',
              onlyDependOnLibsWithTags: ['scope:shared', 'scope:config'],
            },
            {
              sourceTag: 'scope:gateway',
              onlyDependOnLibsWithTags: ['scope:shared', 'scope:config'],
            },
            {
              sourceTag: 'type:app',
              onlyDependOnLibsWithTags: ['type:lib'],
            },
            {
              sourceTag: 'layer:domain',
              onlyDependOnLibsWithTags: ['layer:domain'],
            },
            {
              sourceTag: 'layer:application',
              onlyDependOnLibsWithTags: ['layer:domain', 'layer:application'],
            },
            {
              sourceTag: 'layer:infrastructure',
              onlyDependOnLibsWithTags: [
                'layer:domain',
                'layer:application',
                'layer:infrastructure',
              ],
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
