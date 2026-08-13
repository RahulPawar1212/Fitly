// jest-dom matchers are only meaningful in a DOM environment. The calc suite
// runs under `node` (see vitest.config.mts), so this import is conditional —
// component tests declare `// @vitest-environment jsdom` at the top of the file.
export {};

if (typeof document !== 'undefined') {
  await import('@testing-library/jest-dom/vitest');
}
