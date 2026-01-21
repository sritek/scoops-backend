/**
 * Complaints Service
 *
 * Handles complaint submission, tracking, and resolution
 */

import { prisma } from "../../config/database.js";
import type { TenantScope } from "../../types/request.js";
import { NotFoundError, BadRequestError } from "../../utils/error-handler.js";
import {
  type PaginationParams,
  createPaginatedResponse,
  calculateSkip,
} from "../../utils/pagination.js";
import type { ComplaintStatus, ComplaintPriority } from "@prisma/client";

/**
 * Create complaint input
 */
export interface CreateComplaintInput {
  subject: string;
  description: string;
  category: string;
  priority?: ComplaintPriority;
  studentId?: string;
}

/**
 * Update complaint input
 */
export interface UpdateComplaintInput {
  status?: ComplaintStatus;
  priority?: ComplaintPriority;
  assignedToId?: string | null;
  resolution?: string;
}

/**
 * Add comment input
 */
export interface AddCommentInput {
  content: string;
  isInternal?: boolean;
}

/**
 * Complaint filters
 */
export interface ComplaintFilters {
  status?: ComplaintStatus;
  priority?: ComplaintPriority;
  category?: string;
  assignedToId?: string;
}

/**
 * Generate ticket number
 */
async function generateTicketNumber(orgId: string): Promise<string> {
  const sequence = await prisma.complaintSequence.upsert({
    where: { orgId },
    update: { lastNumber: { increment: 1 } },
    create: { orgId, lastNumber: 1 },
  });

  return `TICKET-${sequence.lastNumber.toString().padStart(5, "0")}`;
}

/**
 * Create a new complaint
 */
export async function createComplaint(
  input: CreateComplaintInput,
  userId: string,
  scope: TenantScope
) {
  const ticketNumber = await generateTicketNumber(scope.orgId);

  const complaint = await prisma.complaint.create({
    data: {
      orgId: scope.orgId,
      branchId: scope.branchId,
      ticketNumber,
      subject: input.subject,
      description: input.description,
      category: input.category,
      priority: input.priority || "medium",
      studentId: input.studentId,
      // Note: For staff creating complaints on behalf of parents, this would be null
      // submittedByParentId would be set when parent submits directly
    },
    include: {
      student: { select: { firstName: true, lastName: true } },
    },
  });

  return formatComplaint(complaint);
}

/**
 * Get complaints list
 */
export async function getComplaints(
  scope: TenantScope,
  pagination: PaginationParams,
  filters?: ComplaintFilters
) {
  const where: any = {
    orgId: scope.orgId,
    branchId: scope.branchId,
  };

  if (filters?.status) {
    where.status = filters.status;
  }

  if (filters?.priority) {
    where.priority = filters.priority;
  }

  if (filters?.category) {
    where.category = filters.category;
  }

  if (filters?.assignedToId) {
    where.assignedToId = filters.assignedToId;
  }

  const [complaints, total] = await Promise.all([
    prisma.complaint.findMany({
      where,
      include: {
        student: { select: { firstName: true, lastName: true } },
        submittedByParent: { select: { firstName: true, lastName: true } },
        assignedTo: { select: { firstName: true, lastName: true } },
        _count: { select: { comments: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: calculateSkip(pagination),
      take: pagination.limit,
    }),
    prisma.complaint.count({ where }),
  ]);

  return createPaginatedResponse(
    complaints.map(formatComplaint),
    total,
    pagination
  );
}

/**
 * Get complaint by ID
 */
export async function getComplaintById(id: string, scope: TenantScope) {
  const complaint = await prisma.complaint.findFirst({
    where: {
      id,
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
    include: {
      student: { select: { firstName: true, lastName: true } },
      submittedByParent: { select: { firstName: true, lastName: true } },
      assignedTo: { select: { firstName: true, lastName: true } },
      comments: {
        include: {
          authorUser: { select: { firstName: true, lastName: true } },
          authorParent: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!complaint) {
    throw new NotFoundError("Complaint");
  }

  return {
    ...formatComplaint(complaint),
    comments: complaint.comments.map((c) => ({
      id: c.id,
      content: c.content,
      isInternal: c.isInternal,
      createdAt: c.createdAt,
      authorName: c.authorUser
        ? `${c.authorUser.firstName} ${c.authorUser.lastName}`
        : c.authorParent
        ? `${c.authorParent.firstName} ${c.authorParent.lastName}`
        : "Unknown",
      authorType: c.authorUserId ? "staff" : "parent",
    })),
  };
}

/**
 * Update complaint
 */
export async function updateComplaint(
  id: string,
  input: UpdateComplaintInput,
  scope: TenantScope
) {
  const complaint = await prisma.complaint.findFirst({
    where: {
      id,
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
  });

  if (!complaint) {
    throw new NotFoundError("Complaint");
  }

  const updateData: any = {};

  if (input.status) {
    updateData.status = input.status;
    if (input.status === "resolved") {
      updateData.resolvedAt = new Date();
    }
  }

  if (input.priority) {
    updateData.priority = input.priority;
  }

  if (input.assignedToId !== undefined) {
    updateData.assignedToId = input.assignedToId || null;
  }

  if (input.resolution) {
    updateData.resolution = input.resolution;
  }

  return prisma.complaint.update({
    where: { id },
    data: updateData,
    include: {
      student: { select: { firstName: true, lastName: true } },
      assignedTo: { select: { firstName: true, lastName: true } },
    },
  });
}

/**
 * Add comment to complaint
 */
export async function addComment(
  complaintId: string,
  input: AddCommentInput,
  userId: string,
  scope: TenantScope
) {
  const complaint = await prisma.complaint.findFirst({
    where: {
      id: complaintId,
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
  });

  if (!complaint) {
    throw new NotFoundError("Complaint");
  }

  const comment = await prisma.complaintComment.create({
    data: {
      complaintId,
      content: input.content,
      isInternal: input.isInternal || false,
      authorUserId: userId,
    },
    include: {
      authorUser: { select: { firstName: true, lastName: true } },
    },
  });

  return {
    id: comment.id,
    content: comment.content,
    isInternal: comment.isInternal,
    createdAt: comment.createdAt,
    authorName: comment.authorUser
      ? `${comment.authorUser.firstName} ${comment.authorUser.lastName}`
      : "Unknown",
    authorType: "staff",
  };
}

/**
 * Get complaint statistics
 */
export async function getComplaintStats(scope: TenantScope) {
  const where = {
    orgId: scope.orgId,
    branchId: scope.branchId,
  };

  const [total, byStatus, byPriority, byCategory] = await Promise.all([
    prisma.complaint.count({ where }),
    prisma.complaint.groupBy({
      by: ["status"],
      where,
      _count: true,
    }),
    prisma.complaint.groupBy({
      by: ["priority"],
      where,
      _count: true,
    }),
    prisma.complaint.groupBy({
      by: ["category"],
      where,
      _count: true,
    }),
  ]);

  return {
    total,
    byStatus: byStatus.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {}),
    byPriority: byPriority.reduce((acc, p) => ({ ...acc, [p.priority]: p._count }), {}),
    byCategory: byCategory.reduce((acc, c) => ({ ...acc, [c.category]: c._count }), {}),
  };
}

/**
 * Format complaint for response
 */
function formatComplaint(complaint: any) {
  return {
    id: complaint.id,
    ticketNumber: complaint.ticketNumber,
    subject: complaint.subject,
    description: complaint.description,
    category: complaint.category,
    priority: complaint.priority,
    status: complaint.status,
    studentName: complaint.student
      ? `${complaint.student.firstName} ${complaint.student.lastName}`
      : null,
    submittedBy: complaint.submittedByParent
      ? `${complaint.submittedByParent.firstName} ${complaint.submittedByParent.lastName}`
      : "Staff",
    assignedTo: complaint.assignedTo
      ? `${complaint.assignedTo.firstName} ${complaint.assignedTo.lastName}`
      : null,
    resolution: complaint.resolution,
    resolvedAt: complaint.resolvedAt,
    commentCount: complaint._count?.comments || 0,
    createdAt: complaint.createdAt,
    updatedAt: complaint.updatedAt,
  };
}

// ============================================================================
// Parent-specific complaint functions
// ============================================================================

/**
 * Create complaint as parent input
 */
export interface CreateParentComplaintInput {
  subject: string;
  description: string;
  category: string;
  studentId: string;
}

/**
 * Create a complaint as parent
 */
export async function createParentComplaint(
  input: CreateParentComplaintInput,
  parentId: string,
  parentContext: { orgId: string; branchId: string }
) {
  // Verify parent is linked to this student
  const link = await prisma.studentParent.findUnique({
    where: {
      studentId_parentId: { studentId: input.studentId, parentId },
    },
  });

  if (!link) {
    throw new BadRequestError("You can only submit complaints for your own children");
  }

  const ticketNumber = await generateTicketNumber(parentContext.orgId);

  const complaint = await prisma.complaint.create({
    data: {
      orgId: parentContext.orgId,
      branchId: parentContext.branchId,
      ticketNumber,
      subject: input.subject,
      description: input.description,
      category: input.category,
      priority: "medium",
      studentId: input.studentId,
      submittedByParentId: parentId,
    },
    include: {
      student: { select: { firstName: true, lastName: true } },
      submittedByParent: { select: { firstName: true, lastName: true } },
    },
  });

  return formatComplaint(complaint);
}

/**
 * Get complaints for a parent
 */
export async function getParentComplaints(
  parentId: string,
  pagination: PaginationParams,
  filters?: { status?: ComplaintStatus }
) {
  const where: any = {
    submittedByParentId: parentId,
  };

  if (filters?.status) {
    where.status = filters.status;
  }

  const [complaints, total] = await Promise.all([
    prisma.complaint.findMany({
      where,
      include: {
        student: { select: { firstName: true, lastName: true } },
        submittedByParent: { select: { firstName: true, lastName: true } },
        assignedTo: { select: { firstName: true, lastName: true } },
        _count: { select: { comments: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: calculateSkip(pagination),
      take: pagination.limit,
    }),
    prisma.complaint.count({ where }),
  ]);

  return createPaginatedResponse(
    complaints.map(formatComplaint),
    total,
    pagination
  );
}

/**
 * Get complaint by ID for parent
 */
export async function getParentComplaintById(id: string, parentId: string) {
  const complaint = await prisma.complaint.findFirst({
    where: {
      id,
      submittedByParentId: parentId,
    },
    include: {
      student: { select: { firstName: true, lastName: true } },
      submittedByParent: { select: { firstName: true, lastName: true } },
      assignedTo: { select: { firstName: true, lastName: true } },
      comments: {
        where: {
          isInternal: false, // Parents should not see internal comments
        },
        include: {
          authorUser: { select: { firstName: true, lastName: true } },
          authorParent: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!complaint) {
    throw new NotFoundError("Complaint");
  }

  return {
    ...formatComplaint(complaint),
    comments: complaint.comments.map((c) => ({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt,
      authorName: c.authorUser
        ? `${c.authorUser.firstName} ${c.authorUser.lastName}`
        : c.authorParent
        ? `${c.authorParent.firstName} ${c.authorParent.lastName}`
        : "Unknown",
      authorType: c.authorUserId ? "staff" : "parent",
      isOwnComment: c.authorParentId === parentId,
    })),
  };
}

/**
 * Add comment as parent
 */
export async function addParentComment(
  complaintId: string,
  content: string,
  parentId: string
) {
  // Verify parent owns this complaint
  const complaint = await prisma.complaint.findFirst({
    where: {
      id: complaintId,
      submittedByParentId: parentId,
    },
  });

  if (!complaint) {
    throw new NotFoundError("Complaint");
  }

  if (complaint.status === "resolved" || complaint.status === "closed") {
    throw new BadRequestError("Cannot add comments to resolved or closed complaints");
  }

  const comment = await prisma.complaintComment.create({
    data: {
      complaintId,
      content,
      isInternal: false,
      authorParentId: parentId,
    },
    include: {
      authorParent: { select: { firstName: true, lastName: true } },
    },
  });

  return {
    id: comment.id,
    content: comment.content,
    createdAt: comment.createdAt,
    authorName: comment.authorParent
      ? `${comment.authorParent.firstName} ${comment.authorParent.lastName}`
      : "Unknown",
    authorType: "parent",
    isOwnComment: true,
  };
}

/**
 * Get available categories for complaints
 */
export function getComplaintCategories() {
  return [
    { id: "academic", name: "Academic" },
    { id: "discipline", name: "Discipline" },
    { id: "infrastructure", name: "Infrastructure" },
    { id: "transport", name: "Transport" },
    { id: "fees", name: "Fees & Payments" },
    { id: "staff", name: "Staff Related" },
    { id: "other", name: "Other" },
  ];
}
