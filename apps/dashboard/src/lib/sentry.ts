// Sentry stub — install @sentry/react and set VITE_SENTRY_DSN to enable
export function initSentry() {
  // no-op until @sentry/react is installed
}

export const Sentry = {
  captureException: (err: unknown) => { console.error('[sentry-stub]', err) },
  captureMessage: (msg: string) => { console.warn('[sentry-stub]', msg) },
}
