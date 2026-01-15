/**
 * User roles (fixed in Phase 1)
 */
export type Role = 'admin' | 'teacher' | 'accounts' | 'staff';

/**
 * Permission codes (fixed in Phase 1)
 */
export type Permission =
  | 'STUDENT_VIEW'
  | 'STUDENT_EDIT'
  | 'ATTENDANCE_MARK'
  | 'FEE_VIEW'
  | 'FEE_UPDATE'
  | 'USER_MANAGE'
  | 'SETTINGS_MANAGE'
  | 'DASHBOARD_VIEW';

/**
 * Full user context loaded from DB and attached to request
 */
export interface UserContext {
  userId: string;
  orgId: string;
  branchId: string;
  role: Role;
  permissions: Permission[];
  firstName: string;
  lastName: string;
}
