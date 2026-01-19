import type { FastifyReply } from "fastify";
import type { ProtectedRequest } from "../../types/request.js";
import { getTenantScopeFromRequest } from "../../middleware/branch.middleware.js";
import { parsePaginationParams } from "../../utils/pagination.js";
import * as staffService from "./staff.service.js";
import {
  updateStaffProfileSchema,
  listStaffQuerySchema,
  staffIdParamSchema,
  checkInSchema,
  checkOutSchema,
  markStaffAttendanceSchema,
  listStaffAttendanceQuerySchema,
} from "./staff.schema.js";

/**
 * Get list of staff members
 */
export async function getStaffList(request: ProtectedRequest, reply: FastifyReply) {
  const queryResult = listStaffQuerySchema.safeParse(request.query);

  if (!queryResult.success) {
    return reply.status(400).send({
      error: "Validation failed",
      details: queryResult.error.format(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const { role, department, employmentType, isActive, search, page, limit } = queryResult.data;
  const pagination = parsePaginationParams({
    page: String(page),
    limit: String(limit),
  });

  const result = await staffService.getStaffList(scope, pagination, {
    role,
    department,
    employmentType,
    isActive,
    search,
  });

  return reply.send(result);
}

/**
 * Get a single staff member by ID
 */
export async function getStaffById(request: ProtectedRequest, reply: FastifyReply) {
  const paramsResult = staffIdParamSchema.safeParse(request.params);

  if (!paramsResult.success) {
    return reply.status(400).send({
      error: "Invalid staff ID",
      details: paramsResult.error.format(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const staff = await staffService.getStaffById(paramsResult.data.id, scope);

  if (!staff) {
    return reply.status(404).send({ error: "Staff member not found" });
  }

  return reply.send({ data: staff });
}

/**
 * Update staff profile (staff-specific fields)
 */
export async function updateStaffProfile(request: ProtectedRequest, reply: FastifyReply) {
  const paramsResult = staffIdParamSchema.safeParse(request.params);

  if (!paramsResult.success) {
    return reply.status(400).send({
      error: "Invalid staff ID",
      details: paramsResult.error.format(),
    });
  }

  const bodyResult = updateStaffProfileSchema.safeParse(request.body);

  if (!bodyResult.success) {
    return reply.status(400).send({
      error: "Validation failed",
      details: bodyResult.error.format(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const staff = await staffService.updateStaffProfile(
    paramsResult.data.id,
    bodyResult.data,
    scope
  );

  if (!staff) {
    return reply.status(404).send({ error: "Staff member not found" });
  }

  return reply.send({
    data: staff,
    message: "Staff profile updated successfully",
  });
}

/**
 * Get unique departments
 */
export async function getDepartments(request: ProtectedRequest, reply: FastifyReply) {
  const scope = getTenantScopeFromRequest(request);
  const departments = await staffService.getDepartments(scope);
  return reply.send({ data: departments });
}

// =====================
// Staff Attendance
// =====================

/**
 * Self check-in
 */
export async function checkIn(request: ProtectedRequest, reply: FastifyReply) {
  const bodyResult = checkInSchema.safeParse(request.body || {});

  if (!bodyResult.success) {
    return reply.status(400).send({
      error: "Validation failed",
      details: bodyResult.error.format(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const attendance = await staffService.checkIn(
    request.userContext.userId,
    bodyResult.data,
    scope
  );

  return reply.send({
    data: attendance,
    message: "Checked in successfully",
  });
}

/**
 * Self check-out
 */
export async function checkOut(request: ProtectedRequest, reply: FastifyReply) {
  const bodyResult = checkOutSchema.safeParse(request.body || {});

  if (!bodyResult.success) {
    return reply.status(400).send({
      error: "Validation failed",
      details: bodyResult.error.format(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const attendance = await staffService.checkOut(
    request.userContext.userId,
    bodyResult.data,
    scope
  );

  return reply.send({
    data: attendance,
    message: "Checked out successfully",
  });
}

/**
 * Get my today's attendance status
 */
export async function getMyTodayAttendance(request: ProtectedRequest, reply: FastifyReply) {
  const scope = getTenantScopeFromRequest(request);
  const result = await staffService.getMyTodayAttendance(request.userContext.userId, scope);
  return reply.send({ data: result });
}

/**
 * Admin: Mark staff attendance
 */
export async function markStaffAttendance(request: ProtectedRequest, reply: FastifyReply) {
  const bodyResult = markStaffAttendanceSchema.safeParse(request.body);

  if (!bodyResult.success) {
    return reply.status(400).send({
      error: "Validation failed",
      details: bodyResult.error.format(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const attendance = await staffService.markStaffAttendance(bodyResult.data, scope);

  return reply.send({
    data: attendance,
    message: "Staff attendance marked successfully",
  });
}

/**
 * Get staff attendance history
 */
export async function getStaffAttendanceHistory(request: ProtectedRequest, reply: FastifyReply) {
  const queryResult = listStaffAttendanceQuerySchema.safeParse(request.query);

  if (!queryResult.success) {
    return reply.status(400).send({
      error: "Validation failed",
      details: queryResult.error.format(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const { userId, startDate, endDate, status, page, limit } = queryResult.data;
  const pagination = parsePaginationParams({
    page: String(page),
    limit: String(limit),
  });

  const result = await staffService.getStaffAttendanceHistory(scope, pagination, {
    userId,
    startDate,
    endDate,
    status,
  });

  return reply.send(result);
}

/**
 * Get today's attendance summary
 */
export async function getTodayAttendanceSummary(request: ProtectedRequest, reply: FastifyReply) {
  const scope = getTenantScopeFromRequest(request);
  const result = await staffService.getTodayAttendanceSummary(scope);
  return reply.send({ data: result });
}

/**
 * Get staff who haven't marked attendance today
 */
export async function getUnmarkedStaff(request: ProtectedRequest, reply: FastifyReply) {
  const scope = getTenantScopeFromRequest(request);
  const result = await staffService.getUnmarkedStaff(scope);
  return reply.send({ data: result });
}
