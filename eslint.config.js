import js from '@eslint/js';
import pluginImport from 'eslint-plugin-import';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
    globalIgnores(['dist', 'node_modules', 'vitest.config.ts']),
    {
        files: ['**/*.ts'],
        extends: [
            js.configs.recommended,
            ...tseslint.configs.recommended,
            pluginImport.flatConfigs.recommended,
            prettierRecommended
        ],
        languageOptions: {
            ecmaVersion: 2022,
            globals: { ...globals.node },
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname
            }
        },
        settings: {
            'import/resolver': {
                typescript: {
                    project: './tsconfig.json',
                    alwaysTryTypes: true
                },
                node: {
                    extensions: ['.js', '.ts']
                }
            },
            'import/extensions': ['.js', '.ts']
        },
        rules: {
            'import/order': [
                'error',
                {
                    // Keep `sibling` and `parent` as separate groups. If they share one group,
                    // `alphabetize` orders paths so `../` sorts before `./`, which conflicts with
                    // the usual "same-folder imports first" style and fights editor/format flows.
                    groups: ['builtin', 'external', 'internal', 'sibling', 'parent', 'index'],
                    pathGroupsExcludedImportTypes: ['builtin'],
                    alphabetize: { order: 'asc', caseInsensitive: true },
                    'newlines-between': 'always'
                }
            ],
            'prettier/prettier': [
                'error',
                {
                    trailingComma: 'none'
                }
            ]
        }
    }
]);
