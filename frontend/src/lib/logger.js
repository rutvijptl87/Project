/**
 * Tiny env-aware logger.
 *
 * - In development (`process.env.NODE_ENV !== 'production'`): forwards to the
 *   browser console so we keep visibility while debugging.
 * - In production: no-ops to avoid leaking debug data and to keep the console
 *   clean for end users.
 *
 * Callers should prefer this over raw `console.*` so we can later swap in a
 * remote logging service (Sentry, LogRocket, etc.) in one place.
 */
const isDev = typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production';

const noop = () => {};

export const logger = {
  warn: isDev ? console.warn.bind(console) : noop,
  error: isDev ? console.error.bind(console) : noop,
  info: isDev ? console.info.bind(console) : noop,
  debug: isDev ? console.debug.bind(console) : noop,
};

export default logger;
