/**
 * Parent Controller
 *
 * Handles HTTP requests for parent-specific endpoints
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { getParentContext } from "../../middleware/parent-auth.middleware.js";
import * as parentService from "./parent.service.js";
import * as leaveService from "../leave/leave.service.js";
import type { SubmitLeaveSchema } from "../leave/leave.schema.js";
import { generateReportCardPDF } from "../exams/report-card.service.js";

/**
 * GET /parent/me - Get parent profile
 */
export async function getProfile(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const parentContext = getParentContext(request);
  const profile = await parentService.getParentProfile(parentContext.parentId);
  return reply.code(200).send(profile);
}

/**
 * GET /parent/dashboard - Get dashboard stats
 */
export async function getDashboard(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const parentContext = getParentContext(request);
  const dashboard = await parentService.getParentDashboard(parentContext);
  return reply.code(200).send(dashboard);
}

/**
 * GET /parent/children - Get all linked children
 */
export async function getChildren(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const parentContext = getParentContext(request);
  const children = await parentService.getParentChildren(parentContext);
  return reply.code(200).send(children);
}

/**
 * GET /parent/children/:id - Get child details
 */
export async function getChildDetails(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const parentContext = getParentContext(request);
  const { id: studentId } = request.params;
  const child = await parentService.getChildDetails(parentContext, studentId);
  return reply.code(200).send(child);
}

/**
 * GET /parent/children/:id/attendance - Get child attendance
 */
export async function getChildAttendance(
  request: FastifyRequest<{
    Params: { id: string };
    Querystring: { startDate?: string; endDate?: string; limit?: string };
  }>,
  reply: FastifyReply
) {
  const parentContext = getParentContext(request);
  const { id: studentId } = request.params;
  const { startDate, endDate, limit } = request.query;

  const attendance = await parentService.getChildAttendance(
    parentContext,
    studentId,
    {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    }
  );

  return reply.code(200).send(attendance);
}

/**
 * GET /parent/children/:id/fees - Get child fees
 */
export async function getChildFees(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const parentContext = getParentContext(request);
  const { id: studentId } = request.params;
  const fees = await parentService.getChildFees(parentContext, studentId);
  return reply.code(200).send(fees);
}

/**
 * GET /parent/fees - Get all children fees summary
 */
export async function getAllFees(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const parentContext = getParentContext(request);
  const fees = await parentService.getAllChildrenFees(parentContext);
  return reply.code(200).send(fees);
}

/**
 * GET /parent/children/:id/teachers - Get child's teachers
 */
export async function getChildTeachers(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const parentContext = getParentContext(request);
  const { id: studentId } = request.params;
  const teachers = await parentService.getChildTeachers(parentContext, studentId);
  return reply.code(200).send(teachers);
}

/**
 * GET /parent/children/:id/id-card - Get child's ID card data
 */
export async function getChildIdCard(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const parentContext = getParentContext(request);
  const { id: studentId } = request.params;
  const idCard = await parentService.getChildIdCard(parentContext, studentId);
  return reply.code(200).send(idCard);
}

/**
 * GET /parent/children/:id/payment-links - Get child's active payment links
 */
export async function getChildPaymentLinks(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const parentContext = getParentContext(request);
  const { id: studentId } = request.params;
  const paymentLinks = await parentService.getChildPaymentLinks(parentContext, studentId);
  return reply.code(200).send(paymentLinks);
}

// ============================================================================
// Leave Application Endpoints
// ============================================================================

/**
 * POST /parent/children/:id/leave - Submit leave application
 */
export async function submitLeaveApplication(
  request: FastifyRequest<{
    Params: { id: string };
    Body: SubmitLeaveSchema;
  }>,
  reply: FastifyReply
) {
  const parentContext = getParentContext(request);
  const { id: studentId } = request.params;
  const result = await leaveService.submitLeaveApplication(
    parentContext,
    studentId,
    request.body
  );
  return reply.code(201).send(result);
}

/**
 * GET /parent/children/:id/leave - Get child's leave applications
 */
export async function getChildLeaveApplications(
  request: FastifyRequest<{
    Params: { id: string };
    Querystring: { page?: string; limit?: string };
  }>,
  reply: FastifyReply
) {
  const parentContext = getParentContext(request);
  const { id: studentId } = request.params;
  const { page = "1", limit = "20" } = request.query;
  
  const result = await leaveService.getStudentLeaveApplications(
    parentContext,
    studentId,
    { page: parseInt(page, 10), limit: parseInt(limit, 10) }
  );
  return reply.code(200).send(result);
}

/**
 * DELETE /parent/leave/:id - Cancel pending leave application
 */
export async function cancelLeaveApplication(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const parentContext = getParentContext(request);
  const { id: leaveId } = request.params;
  const result = await leaveService.cancelLeaveApplication(parentContext, leaveId);
  return reply.code(200).send(result);
}

// ============================================================================
// Exam & Report Card Endpoints
// ============================================================================

/**
 * GET /parent/children/:id/exams - Get child's exam results
 */
export async function getChildExams(
  request: FastifyRequest<{
    Params: { id: string };
    Querystring: { type?: string };
  }>,
  reply: FastifyReply
) {
  const parentContext = getParentContext(request);
  const { id: studentId } = request.params;
  const { type } = request.query;
  
  const result = await parentService.getChildExams(
    parentContext,
    studentId,
    type ? { type } : undefined
  );
  return reply.code(200).send(result);
}

/**
 * GET /parent/children/:id/report-card - Get child's report card
 */
export async function getChildReportCard(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const parentContext = getParentContext(request);
  const { id: studentId } = request.params;
  const result = await parentService.getChildReportCard(parentContext, studentId);
  return reply.code(200).send(result);
}

/**
 * GET /parent/children/:id/report-card/pdf - Download child's report card as PDF
 */
export async function downloadChildReportCardPDF(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const parentContext = getParentContext(request);
  const { id: studentId } = request.params;
  
  // First verify parent has access
  await parentService.getChildReportCard(parentContext, studentId);
  
  // Generate PDF using existing service
  const { stream, fileName } = await generateReportCardPDF(studentId, {
    orgId: parentContext.orgId,
    branchId: parentContext.branchId,
  });
  
  return reply
    .header("Content-Type", "application/pdf")
    .header("Content-Disposition", `attachment; filename="${fileName}"`)
    .send(stream);
}

// ============================================================================
// Calendar Endpoints
// ============================================================================

/**
 * GET /parent/calendar - Get parent's calendar events
 */
export async function getParentCalendar(
  request: FastifyRequest<{
    Querystring: { month: number; year: number; childId?: string };
  }>,
  reply: FastifyReply
) {
  const parentContext = getParentContext(request);
  const { month, year, childId } = request.query;
  
  const result = await parentService.getParentCalendar(
    parentContext,
    month,
    year,
    childId
  );
  return reply.code(200).send(result);
}

// ============================================================================
// Emergency Contact Endpoints
// ============================================================================

/**
 * GET /parent/children/:id/emergency-contacts - Get child's emergency contacts
 */
export async function getChildEmergencyContacts(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const parentContext = getParentContext(request);
  const { id: studentId } = request.params;
  
  const result = await parentService.getChildEmergencyContacts(parentContext, studentId);
  return reply.code(200).send({ contacts: result });
}

/**
 * PUT /parent/children/:id/emergency-contacts - Update child's emergency contacts
 */
export async function updateChildEmergencyContacts(
  request: FastifyRequest<{
    Params: { id: string };
    Body: {
      contacts: Array<{
        id: string;
        name: string;
        relation: string;
        phone: string;
        isPrimary: boolean;
        notes?: string;
      }>;
    };
  }>,
  reply: FastifyReply
) {
  const parentContext = getParentContext(request);
  const { id: studentId } = request.params;
  const { contacts } = request.body;
  
  const result = await parentService.updateChildEmergencyContacts(
    parentContext,
    studentId,
    contacts
  );
  return reply.code(200).send({ contacts: result });
}

// ============================================================================
// Homework Endpoints
// ============================================================================

/**
 * GET /parent/children/:id/homework - Get child's homework list
 */
export async function getChildHomework(
  request: FastifyRequest<{
    Params: { id: string };
    Querystring: { status?: string };
  }>,
  reply: FastifyReply
) {
  const parentContext = getParentContext(request);
  const { id: studentId } = request.params;
  const { status } = request.query;
  
  const result = await parentService.getChildHomework(
    parentContext,
    studentId,
    status ? { status } : undefined
  );
  return reply.code(200).send(result);
}

/**
 * GET /parent/children/:id/homework/:homeworkId - Get child's homework detail
 */
export async function getChildHomeworkDetail(
  request: FastifyRequest<{
    Params: { id: string; homeworkId: string };
  }>,
  reply: FastifyReply
) {
  const parentContext = getParentContext(request);
  const { id: studentId, homeworkId } = request.params;
  
  const result = await parentService.getChildHomeworkDetail(
    parentContext,
    studentId,
    homeworkId
  );
  return reply.code(200).send(result);
}
