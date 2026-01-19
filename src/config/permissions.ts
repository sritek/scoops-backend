import type { Role, Permission } from "../types/auth.js";

/**
 * Permission constants (Phase 1 - Fixed)
 * Do NOT add new permissions without explicit approval.
 */
export const PERMISSIONS = {
  // Student module
  STUDENT_VIEW: "STUDENT_VIEW",
  STUDENT_EDIT: "STUDENT_EDIT",

  // Attendance module
  ATTENDANCE_VIEW: "ATTENDANCE_VIEW",
  ATTENDANCE_MARK: "ATTENDANCE_MARK",

  // Fee module
  FEE_VIEW: "FEE_VIEW",
  FEE_UPDATE: "FEE_UPDATE",

  // User management
  USER_MANAGE: "USER_MANAGE",

  // Settings
  SETTINGS_MANAGE: "SETTINGS_MANAGE",

  // Dashboard
  DASHBOARD_VIEW: "DASHBOARD_VIEW",
} as const;

/**
 * Permission descriptions for documentation
 */
export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  STUDENT_VIEW: "View student list and profiles",
  STUDENT_EDIT: "Create, update, deactivate students",
  ATTENDANCE_VIEW: "View attendance records (read-only)",
  ATTENDANCE_MARK: "Mark attendance for batches",
  FEE_VIEW: "View fee plans and payment status",
  FEE_UPDATE: "Record payments, update fee status",
  USER_MANAGE: "Create users, assign roles and branches",
  SETTINGS_MANAGE: "Manage organization and branch settings",
  DASHBOARD_VIEW: "View dashboard summaries",
};

/**
 * Role constants (Phase 1 - Fixed)
 */
export const ROLES = {
  ADMIN: "admin",
  TEACHER: "teacher",
  ACCOUNTS: "accounts",
  STAFF: "staff",
} as const;

/**
 * Static role → permissions mapping (code-managed in Phase 1)
 * This is the source of truth for RBAC.
 * Do NOT modify without explicit approval.
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    PERMISSIONS.STUDENT_VIEW,
    PERMISSIONS.STUDENT_EDIT,
    PERMISSIONS.ATTENDANCE_VIEW,
    PERMISSIONS.ATTENDANCE_MARK,
    PERMISSIONS.FEE_VIEW,
    PERMISSIONS.FEE_UPDATE,
    PERMISSIONS.USER_MANAGE,
    PERMISSIONS.SETTINGS_MANAGE,
    PERMISSIONS.DASHBOARD_VIEW,
  ],
  teacher: [
    PERMISSIONS.STUDENT_VIEW,
    PERMISSIONS.ATTENDANCE_VIEW,  // Can view all batches attendance
    PERMISSIONS.ATTENDANCE_MARK,  // Can mark only own batch (enforced in controller)
    PERMISSIONS.FEE_VIEW,         // Can view fees for own batch only (enforced in service)
    PERMISSIONS.DASHBOARD_VIEW,
  ],
  accounts: [
    PERMISSIONS.STUDENT_VIEW,
    PERMISSIONS.FEE_VIEW,
    PERMISSIONS.FEE_UPDATE,
    PERMISSIONS.DASHBOARD_VIEW,
    // NO attendance permissions - accounts cannot access attendance module
  ],
  staff: [
    PERMISSIONS.STUDENT_VIEW,
    PERMISSIONS.DASHBOARD_VIEW,
  ],
};

/**
 * Get permissions for a given role
 */
export function getPermissionsForRole(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Check if a role has a specific permission
 */
export function roleHasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * All available permissions (for seeding/validation)
 */
export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

/**
 * All available roles (for seeding/validation)
 */
export const ALL_ROLES: Role[] = Object.values(ROLES);
