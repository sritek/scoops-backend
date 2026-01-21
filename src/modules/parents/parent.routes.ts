/**
 * Parent Routes
 *
 * Protected routes for parent-specific features:
 * - Profile and dashboard
 * - Children information
 * - Fees and installments
 * - Messages
 *
 * All routes require parent authentication via x-parent-token header.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { parentAuthMiddleware, getParentContext } from "../../middleware/parent-auth.middleware.js";
import * as parentController from "./parent.controller.js";
import * as messagingService from "../messaging/messaging.service.js";
import * as complaintsService from "../complaints/complaints.service.js";

/**
 * Parent routes plugin
 */
export async function parentRoutes(app: FastifyInstance) {
  // Apply parent auth middleware to all routes in this plugin
  app.addHook("preHandler", parentAuthMiddleware);

  /**
   * GET /parent/me - Get parent profile
   */
  app.get(
    "/me",
    {
      schema: {
        tags: ["Parent"],
        summary: "Get parent profile",
        description: "Returns the authenticated parent's profile information",
        headers: {
          type: "object",
          properties: {
            "x-parent-token": { type: "string" },
          },
          required: ["x-parent-token"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              firstName: { type: "string" },
              lastName: { type: "string" },
              phone: { type: "string" },
              email: { type: "string", nullable: true },
              photoUrl: { type: "string", nullable: true },
              childrenCount: { type: "number" },
            },
          },
        },
      },
    },
    parentController.getProfile
  );

  /**
   * GET /parent/dashboard - Get dashboard statistics
   */
  app.get(
    "/dashboard",
    {
      schema: {
        tags: ["Parent"],
        summary: "Get parent dashboard",
        description: "Returns dashboard statistics for the parent",
        headers: {
          type: "object",
          properties: {
            "x-parent-token": { type: "string" },
          },
          required: ["x-parent-token"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              childrenCount: { type: "number" },
              children: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    firstName: { type: "string" },
                    lastName: { type: "string" },
                    status: { type: "string" },
                    batchName: { type: "string", nullable: true },
                    relation: { type: "string" },
                    isPrimaryContact: { type: "boolean" },
                  },
                },
              },
              pendingInstallments: { type: "number" },
              unreadMessages: { type: "number" },
              activeComplaints: { type: "number" },
            },
          },
        },
      },
    },
    parentController.getDashboard
  );

  /**
   * GET /parent/children - Get all linked children
   */
  app.get(
    "/children",
    {
      schema: {
        tags: ["Parent"],
        summary: "Get all children",
        description: "Returns all children linked to the parent",
        headers: {
          type: "object",
          properties: {
            "x-parent-token": { type: "string" },
          },
          required: ["x-parent-token"],
        },
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                firstName: { type: "string" },
                lastName: { type: "string" },
                status: { type: "string" },
                photoUrl: { type: "string", nullable: true },
                dateOfBirth: { type: "string", format: "date", nullable: true },
                batchId: { type: "string", nullable: true },
                batchName: { type: "string", nullable: true },
                relation: { type: "string" },
                isPrimaryContact: { type: "boolean" },
                attendanceSummary: {
                  type: "object",
                  properties: {
                    totalDays: { type: "number" },
                    presentDays: { type: "number" },
                    attendancePercentage: { type: "number", nullable: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    parentController.getChildren
  );

  /**
   * GET /parent/children/:id - Get child details
   */
  app.get(
    "/children/:id",
    {
      schema: {
        tags: ["Parent"],
        summary: "Get child details",
        description: "Returns detailed information about a specific child",
        headers: {
          type: "object",
          properties: {
            "x-parent-token": { type: "string" },
          },
          required: ["x-parent-token"],
        },
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
      },
    },
    parentController.getChildDetails
  );

  /**
   * GET /parent/children/:id/attendance - Get child attendance
   */
  app.get(
    "/children/:id/attendance",
    {
      schema: {
        tags: ["Parent"],
        summary: "Get child attendance",
        description: "Returns attendance records for a specific child",
        headers: {
          type: "object",
          properties: {
            "x-parent-token": { type: "string" },
          },
          required: ["x-parent-token"],
        },
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
        querystring: {
          type: "object",
          properties: {
            startDate: { type: "string", format: "date" },
            endDate: { type: "string", format: "date" },
            limit: { type: "string" },
          },
        },
      },
    },
    parentController.getChildAttendance
  );

  /**
   * GET /parent/children/:id/fees - Get child fees
   */
  app.get(
    "/children/:id/fees",
    {
      schema: {
        tags: ["Parent"],
        summary: "Get child fees",
        description: "Returns fee structure and installments for a specific child",
        headers: {
          type: "object",
          properties: {
            "x-parent-token": { type: "string" },
          },
          required: ["x-parent-token"],
        },
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
      },
    },
    parentController.getChildFees
  );

  /**
   * GET /parent/fees - Get all children fees summary
   */
  app.get(
    "/fees",
    {
      schema: {
        tags: ["Parent"],
        summary: "Get all fees",
        description: "Returns fee summary for all children",
        headers: {
          type: "object",
          properties: {
            "x-parent-token": { type: "string" },
          },
          required: ["x-parent-token"],
        },
      },
    },
    parentController.getAllFees
  );

  /**
   * GET /parent/children/:id/teachers - Get child's teachers
   */
  app.get(
    "/children/:id/teachers",
    {
      schema: {
        tags: ["Parent"],
        summary: "Get child teachers",
        description: "Returns class teacher and subject teachers for the child's batch",
        headers: {
          type: "object",
          properties: {
            "x-parent-token": { type: "string" },
          },
          required: ["x-parent-token"],
        },
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
      },
    },
    parentController.getChildTeachers
  );

  /**
   * GET /parent/children/:id/id-card - Get child's ID card data
   */
  app.get(
    "/children/:id/id-card",
    {
      schema: {
        tags: ["Parent"],
        summary: "Get child ID card",
        description: "Returns data for generating a digital ID card",
        headers: {
          type: "object",
          properties: {
            "x-parent-token": { type: "string" },
          },
          required: ["x-parent-token"],
        },
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
      },
    },
    parentController.getChildIdCard
  );

  /**
   * GET /parent/children/:id/payment-links - Get child's active payment links
   */
  app.get(
    "/children/:id/payment-links",
    {
      schema: {
        tags: ["Parent"],
        summary: "Get child payment links",
        description: "Returns active payment links for the child's fee installments",
        headers: {
          type: "object",
          properties: {
            "x-parent-token": { type: "string" },
          },
          required: ["x-parent-token"],
        },
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
      },
    },
    parentController.getChildPaymentLinks
  );

  // =========================================================================
  // Leave Application routes
  // =========================================================================

  /**
   * POST /parent/children/:id/leave - Submit leave application
   */
  app.post(
    "/children/:id/leave",
    {
      schema: {
        tags: ["Parent"],
        summary: "Submit leave application",
        description: "Submit a new leave application for a child",
        headers: {
          type: "object",
          properties: {
            "x-parent-token": { type: "string" },
          },
          required: ["x-parent-token"],
        },
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["sick", "family", "vacation", "medical", "other"] },
            reason: { type: "string", minLength: 10, maxLength: 500 },
            startDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
            endDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
          },
          required: ["type", "reason", "startDate", "endDate"],
        },
      },
    },
    parentController.submitLeaveApplication
  );

  /**
   * GET /parent/children/:id/leave - Get child's leave applications
   */
  app.get(
    "/children/:id/leave",
    {
      schema: {
        tags: ["Parent"],
        summary: "Get child leave applications",
        description: "Returns leave applications for a specific child",
        headers: {
          type: "object",
          properties: {
            "x-parent-token": { type: "string" },
          },
          required: ["x-parent-token"],
        },
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
        querystring: {
          type: "object",
          properties: {
            page: { type: "string" },
            limit: { type: "string" },
          },
        },
      },
    },
    parentController.getChildLeaveApplications
  );

  /**
   * DELETE /parent/leave/:id - Cancel pending leave application
   */
  app.delete(
    "/leave/:id",
    {
      schema: {
        tags: ["Parent"],
        summary: "Cancel leave application",
        description: "Cancel a pending leave application",
        headers: {
          type: "object",
          properties: {
            "x-parent-token": { type: "string" },
          },
          required: ["x-parent-token"],
        },
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
      },
    },
    parentController.cancelLeaveApplication
  );

  // =========================================================================
  // Exam & Report Card routes
  // =========================================================================

  /**
   * GET /parent/children/:id/exams - Get child's exam results
   */
  app.get(
    "/children/:id/exams",
    {
      schema: {
        tags: ["Parent"],
        summary: "Get child exam results",
        description: "Returns published exam results with scores for a child",
        headers: {
          type: "object",
          properties: {
            "x-parent-token": { type: "string" },
          },
          required: ["x-parent-token"],
        },
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
        querystring: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["unit_test", "mid_term", "final", "practical", "assignment"] },
          },
        },
      },
    },
    parentController.getChildExams
  );

  /**
   * GET /parent/children/:id/report-card - Get child's report card
   */
  app.get(
    "/children/:id/report-card",
    {
      schema: {
        tags: ["Parent"],
        summary: "Get child report card",
        description: "Returns child's report card with all exam results and summary",
        headers: {
          type: "object",
          properties: {
            "x-parent-token": { type: "string" },
          },
          required: ["x-parent-token"],
        },
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
      },
    },
    parentController.getChildReportCard
  );

  /**
   * GET /parent/children/:id/report-card/pdf - Download child's report card PDF
   */
  app.get(
    "/children/:id/report-card/pdf",
    {
      schema: {
        tags: ["Parent"],
        summary: "Download report card PDF",
        description: "Downloads child's report card as PDF",
        headers: {
          type: "object",
          properties: {
            "x-parent-token": { type: "string" },
          },
          required: ["x-parent-token"],
        },
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
      },
    },
    parentController.downloadChildReportCardPDF
  );

  // =========================================================================
  // Calendar routes
  // =========================================================================

  /**
   * GET /parent/calendar - Get calendar events for parent's children
   */
  app.get(
    "/calendar",
    {
      schema: {
        tags: ["Parent"],
        summary: "Get calendar events",
        description: "Returns academic calendar events for parent's children's batches",
        headers: {
          type: "object",
          properties: {
            "x-parent-token": { type: "string" },
          },
          required: ["x-parent-token"],
        },
        querystring: {
          type: "object",
          required: ["month", "year"],
          properties: {
            month: { type: "number", minimum: 1, maximum: 12 },
            year: { type: "number", minimum: 2020, maximum: 2100 },
            childId: { type: "string" },
          },
        },
      },
    },
    parentController.getParentCalendar
  );

  // =========================================================================
  // Emergency Contacts routes
  // =========================================================================

  /**
   * GET /parent/children/:id/emergency-contacts - Get child's emergency contacts
   */
  app.get(
    "/children/:id/emergency-contacts",
    {
      schema: {
        tags: ["Parent"],
        summary: "Get emergency contacts",
        description: "Returns emergency contacts for a child",
        headers: {
          type: "object",
          properties: {
            "x-parent-token": { type: "string" },
          },
          required: ["x-parent-token"],
        },
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
      },
    },
    parentController.getChildEmergencyContacts
  );

  /**
   * PUT /parent/children/:id/emergency-contacts - Update child's emergency contacts
   */
  app.put(
    "/children/:id/emergency-contacts",
    {
      schema: {
        tags: ["Parent"],
        summary: "Update emergency contacts",
        description: "Updates all emergency contacts for a child (max 5)",
        headers: {
          type: "object",
          properties: {
            "x-parent-token": { type: "string" },
          },
          required: ["x-parent-token"],
        },
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
        body: {
          type: "object",
          required: ["contacts"],
          properties: {
            contacts: {
              type: "array",
              maxItems: 5,
              items: {
                type: "object",
                required: ["id", "name", "relation", "phone", "isPrimary"],
                properties: {
                  id: { type: "string" },
                  name: { type: "string", minLength: 1 },
                  relation: { type: "string", minLength: 1 },
                  phone: { type: "string", minLength: 10 },
                  isPrimary: { type: "boolean" },
                  notes: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    parentController.updateChildEmergencyContacts
  );

  // =========================================================================
  // Homework routes
  // =========================================================================

  /**
   * GET /parent/children/:id/homework - Get child's homework list
   */
  app.get(
    "/children/:id/homework",
    {
      schema: {
        tags: ["Parent"],
        summary: "Get child homework list",
        description: "Returns homework assignments for a child with submission status",
        headers: {
          type: "object",
          properties: {
            "x-parent-token": { type: "string" },
          },
          required: ["x-parent-token"],
        },
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
        querystring: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["pending", "submitted", "graded"] },
          },
        },
      },
    },
    parentController.getChildHomework
  );

  /**
   * GET /parent/children/:id/homework/:homeworkId - Get child's homework detail
   */
  app.get(
    "/children/:id/homework/:homeworkId",
    {
      schema: {
        tags: ["Parent"],
        summary: "Get homework detail",
        description: "Returns detailed homework information with child's submission",
        headers: {
          type: "object",
          properties: {
            "x-parent-token": { type: "string" },
          },
          required: ["x-parent-token"],
        },
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
            homeworkId: { type: "string" },
          },
          required: ["id", "homeworkId"],
        },
      },
    },
    parentController.getChildHomeworkDetail
  );

  // =========================================================================
  // Announcements routes
  // =========================================================================

  /**
   * GET /parent/announcements - Get announcements
   */
  app.get(
    "/announcements",
    {
      schema: {
        tags: ["Parent"],
        summary: "Get announcements",
        description: "Returns broadcast and announcement messages for parent's children's batches",
        headers: {
          type: "object",
          properties: {
            "x-parent-token": { type: "string" },
          },
          required: ["x-parent-token"],
        },
        querystring: {
          type: "object",
          properties: {
            page: { type: "number" },
            limit: { type: "number" },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Querystring: { page?: number; limit?: number } }>,
      reply: FastifyReply
    ) => {
      const parentContext = getParentContext(request);
      const { page = 1, limit = 20 } = request.query;
      const result = await messagingService.getParentAnnouncements(
        parentContext.parentId,
        { page, limit }
      );
      return reply.code(200).send(result);
    }
  );

  // =========================================================================
  // Messaging routes
  // =========================================================================

  /**
   * GET /parent/messages - Get conversations
   */
  app.get(
    "/messages",
    {
      schema: {
        tags: ["Parent"],
        summary: "Get conversations",
        description: "Returns all conversations for the parent",
        headers: {
          type: "object",
          properties: {
            "x-parent-token": { type: "string" },
          },
          required: ["x-parent-token"],
        },
        querystring: {
          type: "object",
          properties: {
            page: { type: "number" },
            limit: { type: "number" },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Querystring: { page?: number; limit?: number } }>,
      reply: FastifyReply
    ) => {
      const parentContext = getParentContext(request);
      const { page = 1, limit = 20 } = request.query;
      const result = await messagingService.getParentConversations(
        parentContext.parentId,
        { page, limit }
      );
      return reply.code(200).send(result);
    }
  );

  /**
   * GET /parent/messages/unread - Get unread count
   */
  app.get(
    "/messages/unread",
    {
      schema: {
        tags: ["Parent"],
        summary: "Get unread count",
        description: "Returns number of unread conversations",
        headers: {
          type: "object",
          properties: {
            "x-parent-token": { type: "string" },
          },
          required: ["x-parent-token"],
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parentContext = getParentContext(request);
      const result = await messagingService.getParentUnreadCount(parentContext.parentId);
      return reply.code(200).send(result);
    }
  );

  /**
   * GET /parent/messages/:id - Get conversation details
   */
  app.get(
    "/messages/:id",
    {
      schema: {
        tags: ["Parent"],
        summary: "Get conversation",
        description: "Returns conversation with messages",
        headers: {
          type: "object",
          properties: {
            "x-parent-token": { type: "string" },
          },
          required: ["x-parent-token"],
        },
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const parentContext = getParentContext(request);
      const { id } = request.params;
      const result = await messagingService.getParentConversation(
        id,
        parentContext.parentId
      );
      return reply.code(200).send(result);
    }
  );

  /**
   * POST /parent/messages/:id - Send message
   */
  app.post(
    "/messages/:id",
    {
      schema: {
        tags: ["Parent"],
        summary: "Send message",
        description: "Sends a message in the conversation",
        headers: {
          type: "object",
          properties: {
            "x-parent-token": { type: "string" },
          },
          required: ["x-parent-token"],
        },
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
        body: {
          type: "object",
          required: ["content"],
          properties: {
            content: { type: "string" },
            attachmentUrl: { type: "string" },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: { content: string; attachmentUrl?: string };
      }>,
      reply: FastifyReply
    ) => {
      const parentContext = getParentContext(request);
      const { id } = request.params;
      const result = await messagingService.sendParentMessage(
        id,
        request.body,
        parentContext.parentId
      );
      return reply.code(201).send(result);
    }
  );

  /**
   * POST /parent/messages/with-staff/:staffId - Find or create conversation with staff
   */
  app.post(
    "/messages/with-staff/:staffId",
    {
      schema: {
        tags: ["Parent"],
        summary: "Find or create conversation with staff",
        description:
          "Finds an existing direct conversation with the staff member or creates a new one",
        headers: {
          type: "object",
          properties: {
            "x-parent-token": { type: "string" },
          },
          required: ["x-parent-token"],
        },
        params: {
          type: "object",
          properties: {
            staffId: { type: "string" },
          },
          required: ["staffId"],
        },
        body: {
          type: "object",
          properties: {
            message: { type: "string" },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { staffId: string };
        Body: { message?: string };
      }>,
      reply: FastifyReply
    ) => {
      const parentContext = getParentContext(request);
      const { staffId } = request.params;
      const { message } = request.body || {};

      const result = await messagingService.findOrCreateParentStaffConversation(
        parentContext.parentId,
        staffId,
        message
      );

      return reply.code(result.created ? 201 : 200).send(result.conversation);
    }
  );

  // =========================================================================
  // Complaint routes
  // =========================================================================

  /**
   * GET /parent/complaints/categories - Get categories
   */
  app.get(
    "/complaints/categories",
    {
      schema: {
        tags: ["Parent"],
        summary: "Get complaint categories",
        description: "Returns available complaint categories",
        headers: {
          type: "object",
          properties: {
            "x-parent-token": { type: "string" },
          },
          required: ["x-parent-token"],
        },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const categories = complaintsService.getComplaintCategories();
      return reply.code(200).send(categories);
    }
  );

  /**
   * GET /parent/complaints - Get complaints
   */
  app.get(
    "/complaints",
    {
      schema: {
        tags: ["Parent"],
        summary: "Get complaints",
        description: "Returns all complaints submitted by the parent",
        headers: {
          type: "object",
          properties: {
            "x-parent-token": { type: "string" },
          },
          required: ["x-parent-token"],
        },
        querystring: {
          type: "object",
          properties: {
            page: { type: "number" },
            limit: { type: "number" },
            status: { type: "string" },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Querystring: { page?: number; limit?: number; status?: string };
      }>,
      reply: FastifyReply
    ) => {
      const parentContext = getParentContext(request);
      const { page = 1, limit = 20, status } = request.query;
      const result = await complaintsService.getParentComplaints(
        parentContext.parentId,
        { page, limit },
        status ? { status: status as any } : undefined
      );
      return reply.code(200).send(result);
    }
  );

  /**
   * POST /parent/complaints - Create complaint
   */
  app.post(
    "/complaints",
    {
      schema: {
        tags: ["Parent"],
        summary: "Create complaint",
        description: "Creates a new complaint",
        headers: {
          type: "object",
          properties: {
            "x-parent-token": { type: "string" },
          },
          required: ["x-parent-token"],
        },
        body: {
          type: "object",
          required: ["subject", "description", "category", "studentId"],
          properties: {
            subject: { type: "string" },
            description: { type: "string" },
            category: { type: "string" },
            studentId: { type: "string" },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Body: {
          subject: string;
          description: string;
          category: string;
          studentId: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const parentContext = getParentContext(request);
      const result = await complaintsService.createParentComplaint(
        request.body,
        parentContext.parentId,
        { orgId: parentContext.orgId, branchId: parentContext.branchId }
      );
      return reply.code(201).send(result);
    }
  );

  /**
   * GET /parent/complaints/:id - Get complaint details
   */
  app.get(
    "/complaints/:id",
    {
      schema: {
        tags: ["Parent"],
        summary: "Get complaint",
        description: "Returns complaint details with comments",
        headers: {
          type: "object",
          properties: {
            "x-parent-token": { type: "string" },
          },
          required: ["x-parent-token"],
        },
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const parentContext = getParentContext(request);
      const { id } = request.params;
      const result = await complaintsService.getParentComplaintById(
        id,
        parentContext.parentId
      );
      return reply.code(200).send(result);
    }
  );

  /**
   * POST /parent/complaints/:id/comments - Add comment
   */
  app.post(
    "/complaints/:id/comments",
    {
      schema: {
        tags: ["Parent"],
        summary: "Add comment",
        description: "Adds a comment to the complaint",
        headers: {
          type: "object",
          properties: {
            "x-parent-token": { type: "string" },
          },
          required: ["x-parent-token"],
        },
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
        body: {
          type: "object",
          required: ["content"],
          properties: {
            content: { type: "string" },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: { content: string };
      }>,
      reply: FastifyReply
    ) => {
      const parentContext = getParentContext(request);
      const { id } = request.params;
      const result = await complaintsService.addParentComment(
        id,
        request.body.content,
        parentContext.parentId
      );
      return reply.code(201).send(result);
    }
  );
}
