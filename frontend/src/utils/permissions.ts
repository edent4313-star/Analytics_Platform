/**
 * Permission code constants.
 * Use these instead of raw strings to catch typos at compile time.
 */
export const PERMISSIONS = {
  // Dashboard
  DASHBOARD_VIEW: 'dashboard.view',
  DASHBOARD_CREATE: 'dashboard.create',
  DASHBOARD_EDIT: 'dashboard.edit',
  DASHBOARD_DELETE: 'dashboard.delete',
  DASHBOARD_PUBLISH: 'dashboard.publish',
  DASHBOARD_EXPORT: 'dashboard.export',

  // Users
  USER_VIEW: 'user.view',
  USER_CREATE: 'user.create',
  USER_UPDATE: 'user.update',
  USER_DISABLE: 'user.disable',

  // Roles
  ROLE_VIEW: 'role.view',
  ROLE_MANAGE: 'role.manage',

  // Permissions
  PERMISSION_VIEW: 'permission.view',
  PERMISSION_MANAGE: 'permission.manage',

  // Data sources
  DATASOURCE_VIEW: 'datasource.view',
  DATASOURCE_CREATE: 'datasource.create',
  DATASOURCE_EDIT: 'datasource.edit',
  DATASOURCE_DELETE: 'datasource.delete',

  // Datasets
  DATASET_VIEW: 'dataset.view',
  DATASET_MANAGE: 'dataset.manage',

  // Audit
  AUDIT_VIEW: 'audit.view',
} as const;

export type PermissionCode = typeof PERMISSIONS[keyof typeof PERMISSIONS];
