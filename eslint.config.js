// Flat ESLint config (ESLint 9 + typescript-eslint). Deliberately minimal
// for a solo project: the recommended rule sets catch real bug-shaped
// patterns (no-fallthrough, no-self-assign, useless escapes, etc.) on top
// of what `tsc --strict` already enforces, without the slow type-aware
// linting or stylistic churn. `npm run lint` locally; CI runs it too.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'public', 'coverage', 'api', 'scripts', 'examples'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // tsc already forbids real unused vars (noUnusedLocals); keep ESLint's
      // version but allow the _-prefix convention for intentional discards.
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrors: 'none',
      }],
      // TypeScript's own checker handles undefined identifiers (and knows the
      // real lib/DOM globals); core no-undef only produces false positives on
      // TS — typescript-eslint explicitly recommends turning it off.
      'no-undef': 'off',
      // `any` is used deliberately at a few untyped boundaries (the Leaflet
      // CDN global has no bundled types, plus a couple of DOM escape hatches).
      // tsc-strict still guards everything else, so this rule is noise here.
      '@typescript-eslint/no-explicit-any': 'off',
      // Empty catch blocks are an intentional "best-effort, ignore failure"
      // pattern throughout (localStorage, optional fetches).
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    // Tests + setup may use looser patterns (non-null assertions on fixtures).
    files: ['**/*.test.ts', 'test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
