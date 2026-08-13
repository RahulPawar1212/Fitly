/**
 * Auth values shared between server and client.
 *
 * Kept separate from `auth.ts` because that module imports `node:crypto`, which
 * cannot be bundled into a client component. The login form needs the password
 * rule to validate locally, and it must be the same number the server enforces.
 */

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 200;
