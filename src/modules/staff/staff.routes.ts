import type { FastifyInstance } from "fastify";
import { requirePermission } from "../../middleware/rbac.middleware.js";
import { PERMISSIONS } from "../../config/permissions";
import * as controller from "./staff.controller.js";

/**
 * Staff module routes
 * 
 * Staff directory and profile management requires USER_MANAGE permission
 * Staff attendance has separate permissions for self and admin operations
 */
export async function staffRoutes(app: FastifyInstance) {
  // =====================
  // Staff Directory
  // =====================

  /**
   * GET /staff
   * List staff members with filters
   */
  app.get(
    "/",
    {
      schema: {
        tags: ["Staff"],
        summary: "List staff members",
        description: "Get a paginated list of staff members with optional filters",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            page: { type: "number", minimum: 1, default: 1 },
            limit: { type: "number", minimum: 1, maximum: 100, default: 20 },
            role: { type: "string", enum: ["admin", "teacher", "accounts", "staff"] },
            department: { type: "string" },
            employmentType: { type: "string", enum: ["full_time", "part_time", "contract"] },
            isActive: { type: "string", enum: ["true", "false"] },
            search: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              data: { type: "array", items: { type: "object", additionalProperties: true } },
              pagination: { type: "object", additionalProperties: true },
            },
          },
        },
      },
      preHandler: [requirePermission(PERMISSIONS.USER_MANAGE)],
    },
    controller.getStaffList
  );

  /**
   * GET /staff/departments
   * Get unique departments
   */
  app.get(
    "/departments",
    {
      schema: {
        tags: ["Staff"],
        summary: "Get departments",
        description: "Get list of unique departments in the organization",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              data: { type: "array", items: { type: "string", additionalProperties: true } },
            },
          },
        },
      },
      preHandler: [requirePermission(PERMISSIONS.USER_MANAGE)],
    },
    controller.getDepartments
  );

  /**
   * GET /staff/:id
   * Get a single staff member
   */
  app.get(
    "/:id",
    {
      schema: {
        tags: ["Staff"],
        summary: "Get staff member",
        description: "Get a single staff member by ID",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              data: { type: "object", additionalProperties: true },
            },
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
      preHandler: [requirePermission(PERMISSIONS.USER_MANAGE)],
    },
    controller.getStaffById
  );

  /**
   * PUT /staff/:id
   * Update staff profile
   */
  app.put(
    "/:id",
    {
      schema: {
        tags: ["Staff"],
        summary: "Update staff profile",
        description: "Update staff-specific profile fields (employment type, department, etc.)",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: {
            employmentType: { type: "string", enum: ["full_time", "part_time", "contract"] },
            joiningDate: { type: "string", format: "date-time", nullable: true },
            department: { type: "string", maxLength: 100, nullable: true },
            designation: { type: "string", maxLength: 100, nullable: true },
            salary: { type: "number", minimum: 0, nullable: true },
            emergencyContact: { type: "string", minLength: 10, maxLength: 15, nullable: true },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              data: { type: "object", additionalProperties: true },
              message: { type: "string" },
            },
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
      preHandler: [requirePermission(PERMISSIONS.USER_MANAGE)],
    },
    controller.updateStaffProfile
  );

  // =====================
  // Staff Attendance - Self Service
  // =====================

  /**
   * GET /staff/attendance/my-today
   * Get current user's attendance status for today
   */
  app.get(
    "/attendance/my-today",
    {
      schema: {
        tags: ["Staff Attendance"],
        summary: "Get my today's attendance",
        description: "Get current user's attendance status for today",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              data: {
                type: "object",
                properties: {
                  hasCheckedIn: { type: "boolean" },
                  hasCheckedOut: { type: "boolean" },
                  attendance: { type: "object", nullable: true },
                },
              },
            },
          },
        },
      },
      // No special permission - any authenticated user can check their own status
    },
    controller.getMyTodayAttendance
  );

  /**
   * POST /staff/attendance/check-in
   * Self check-in
   */
  app.post(
    "/attendance/check-in",
    {
      schema: {
        tags: ["Staff Attendance"],
        summary: "Check in",
        description: "Mark self as checked in for today",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            notes: { type: "string", maxLength: 500 },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              data: { type: "object", additionalProperties: true },
              message: { type: "string" },
            },
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
      // No special permission - any authenticated user can check in
    },
    controller.checkIn
  );

  /**
   * POST /staff/attendance/check-out
   * Self check-out
   */
  app.post(
    "/attendance/check-out",
    {
      schema: {
        tags: ["Staff Attendance"],
        summary: "Check out",
        description: "Mark self as checked out for today",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            notes: { type: "string", maxLength: 500 },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              data: { type: "object", additionalProperties: true },
              message: { type: "string" },
            },
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
      // No special permission - any authenticated user can check out
    },
    controller.checkOut
  );

  // =====================
  // Staff Attendance - Admin
  // =====================

  /**
   * GET /staff/attendance/today
   * Get today's attendance summary
   */
  app.get(
    "/attendance/today",
    {
      schema: {
        tags: ["Staff Attendance"],
        summary: "Today's attendance summary",
        description: "Get summary of staff attendance for today",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              data: {
                type: "object",
                properties: {
                  date: { type: "string" },
                  totalStaff: { type: "number" },
                  stats: {
                    type: "object",
                    properties: {
                      present: { type: "number" },
                      absent: { type: "number" },
                      halfDay: { type: "number" },
                      leave: { type: "number" },
                      notMarked: { type: "number" },
                    },
                  },
                  attendance: { type: "array", items: { type: "object", additionalProperties: true } },
                },
              },
            },
          },
        },
      },
      preHandler: [requirePermission(PERMISSIONS.USER_MANAGE)],
    },
    controller.getTodayAttendanceSummary
  );

  /**
   * GET /staff/attendance/unmarked
   * Get staff who haven't marked attendance today
   */
  app.get(
    "/attendance/unmarked",
    {
      schema: {
        tags: ["Staff Attendance"],
        summary: "Get unmarked staff",
        description: "Get list of staff who haven't marked attendance today",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              data: { type: "array", items: { type: "object", additionalProperties: true } },
            },
          },
        },
      },
      preHandler: [requirePermission(PERMISSIONS.USER_MANAGE)],
    },
    controller.getUnmarkedStaff
  );

  /**
   * GET /staff/attendance
   * Get staff attendance history
   */
  app.get(
    "/attendance",
    {
      schema: {
        tags: ["Staff Attendance"],
        summary: "Staff attendance history",
        description: "Get paginated staff attendance history with filters",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            page: { type: "number", minimum: 1, default: 1 },
            limit: { type: "number", minimum: 1, maximum: 100, default: 20 },
            userId: { type: "string", format: "uuid" },
            startDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
            endDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
            status: { type: "string", enum: ["present", "absent", "half_day", "leave"] },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              data: { type: "array", items: { type: "object", additionalProperties: true } },
              pagination: { type: "object", additionalProperties: true },
            },
          },
        },
      },
      preHandler: [requirePermission(PERMISSIONS.USER_MANAGE)],
    },
    controller.getStaffAttendanceHistory
  );

  /**
   * POST /staff/attendance
   * Admin mark staff attendance
   */
  app.post(
    "/attendance",
    {
      schema: {
        tags: ["Staff Attendance"],
        summary: "Mark staff attendance",
        description: "Admin can mark attendance for any staff member",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["userId", "date", "status"],
          properties: {
            userId: { type: "string", format: "uuid" },
            date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
            status: { type: "string", enum: ["present", "absent", "half_day", "leave"] },
            leaveType: { type: "string", enum: ["casual", "sick", "earned", "unpaid"] },
            checkIn: { type: "string", format: "date-time" },
            checkOut: { type: "string", format: "date-time" },
            notes: { type: "string", maxLength: 500 },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              data: { type: "object", additionalProperties: true },
              message: { type: "string" },
            },
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
      preHandler: [requirePermission(PERMISSIONS.USER_MANAGE)],
    },
    controller.markStaffAttendance
  );
}
