/**
 * Application configuration.
 * All values come from Vite environment variables (import.meta.env).
 * In production these are baked in at build time — no runtime env injection needed.
 */

export const APP_CONFIG = {
  appName: 'Enterprise Analytics Platform',
  appVersion: '1.0.0',

  /** Base URL for all API calls. Proxied to FastAPI in dev via vite.config.ts */
  apiBaseUrl: '/api/v1',

  /** Token storage keys */
  tokenKey: 'ap_access_token',
  refreshTokenKey: 'ap_refresh_token',

  /** How many seconds before token expiry to proactively refresh (default: 2 min) */
  tokenRefreshBuffer: 120,

  /** Default pagination */
  defaultPageSize: 25,
  pageSizeOptions: [10, 25, 50, 100],
} as const;
