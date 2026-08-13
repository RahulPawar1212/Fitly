/**
 * Pure calculation layer — no Prisma, no Next, no DOM.
 *
 * Everything here runs identically on the server (persisting values) and in the
 * browser (live previews in the pickers), and is unit-tested in tests/.
 */

export * from './dates';
export * from './energy';
export * from './burn';
export * from './nutrition';
export * from './trend';
