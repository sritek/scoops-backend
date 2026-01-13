/**
 * Test type definitions for API response typing
 */

/**
 * Standard API error response
 */
export interface ApiErrorResponse {
  error: string;
  message: string;
  details?: unknown;
}

/**
 * User response from /me endpoint
 */
export interface MeResponse {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  role: string;
  branchId: string;
  permissions: string[];
}

/**
 * Student response
 */
export interface StudentResponse {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  gender?: string;
  dob?: string;
  category?: string;
  isCwsn?: boolean;
  admissionYear: number;
  status: string;
  batchId?: string;
  parents: ParentResponse[];
}

/**
 * Parent response
 */
export interface ParentResponse {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string;
  relation: string;
}

/**
 * Batch response
 */
export interface BatchResponse {
  id: string;
  name: string;
  academicLevel: string;
  stream?: string;
  teacherId?: string;
  teacher?: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
  };
  studentCount?: number;
  isActive: boolean;
}

/**
 * Attendance response
 */
export interface AttendanceResponse {
  session: {
    id: string;
    createdAt: string;
    createdBy: {
      id: string;
      firstName: string;
      lastName: string;
      fullName: string;
    };
  } | null;
  date: string;
  batchId: string;
  records: AttendanceRecordResponse[];
}

/**
 * Attendance record response
 */
export interface AttendanceRecordResponse {
  studentId: string;
  studentName: string;
  status: string | null;
  markedAt?: string;
}

/**
 * Dashboard response
 */
export interface DashboardResponse {
  attendance: {
    date: string;
    totalPresent: number;
    totalAbsent: number;
    totalMarked: number;
    totalActiveStudents: number;
    batchesMarked: number;
    batchesPending: number;
  };
  pendingFees: {
    totalCount: number;
    totalPendingAmount: number;
    overdueCount: number;
    overdueAmount: number;
  };
  feesCollected: {
    date: string;
    totalCount: number;
    totalAmount: number;
  };
}

/**
 * Health check response
 */
export interface HealthResponse {
  status: string;
  timestamp: string;
}

/**
 * Type helper to cast response body
 */
export function asApiError(body: unknown): ApiErrorResponse {
  return body as ApiErrorResponse;
}

export function asMeResponse(body: unknown): MeResponse {
  return body as MeResponse;
}

export function asStudentResponse(body: unknown): StudentResponse {
  return body as StudentResponse;
}

export function asStudentArray(body: unknown): StudentResponse[] {
  return body as StudentResponse[];
}

export function asBatchResponse(body: unknown): BatchResponse {
  return body as BatchResponse;
}

export function asBatchArray(body: unknown): BatchResponse[] {
  return body as BatchResponse[];
}

export function asAttendanceResponse(body: unknown): AttendanceResponse {
  return body as AttendanceResponse;
}
