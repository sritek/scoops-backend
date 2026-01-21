/**
 * Homework Service
 *
 * Business logic for managing homework assignments
 */

import { prisma } from "../../config/database.js";
import { NotFoundError, BadRequestError } from "../../utils/error-handler.js";
import type { TenantScope } from "../../types/request.js";
import type {
  CreateHomeworkInput,
  UpdateHomeworkInput,
  GradeSubmissionInput,
  HomeworkQueryInput,
} from "./homework.schema.js";
import type { HomeworkStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";

/**
 * Format user name helper
 */
function formatName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

/**
 * List homework with filters
 */
export async function listHomework(
  scope: TenantScope,
  query: HomeworkQueryInput
) {
  const { batchId, subjectId, status, page, limit } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.HomeworkWhereInput = {
    orgId: scope.orgId,
    branchId: scope.branchId,
  };

  if (batchId) where.batchId = batchId;
  if (subjectId) where.subjectId = subjectId;
  if (status) where.status = status as HomeworkStatus;

  const [homework, total] = await Promise.all([
    prisma.homework.findMany({
      where,
      include: {
        batch: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { submissions: true } },
      },
      orderBy: { dueDate: "desc" },
      skip,
      take: limit,
    }),
    prisma.homework.count({ where }),
  ]);

  return {
    data: homework.map((h) => ({
      id: h.id,
      title: h.title,
      description:
        h.description.substring(0, 200) +
        (h.description.length > 200 ? "..." : ""),
      dueDate: h.dueDate.toISOString().split("T")[0],
      totalMarks: h.totalMarks,
      status: h.status,
      batchId: h.batchId,
      batchName: h.batch.name,
      subjectId: h.subjectId,
      subjectName: h.subject?.name ?? null,
      createdBy: formatName(h.createdBy.firstName, h.createdBy.lastName),
      submissionCount: h._count.submissions,
      isOverdue: h.status === "published" && new Date(h.dueDate) < new Date(),
      createdAt: h.createdAt.toISOString(),
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get homework by ID with submissions
 */
export async function getHomework(id: string, scope: TenantScope) {
  const homework = await prisma.homework.findFirst({
    where: {
      id,
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
    include: {
      batch: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  if (!homework) {
    throw new NotFoundError("Homework not found");
  }

  return {
    id: homework.id,
    title: homework.title,
    description: homework.description,
    attachments: homework.attachments as Array<{
      name: string;
      url: string;
    }> | null,
    dueDate: homework.dueDate.toISOString().split("T")[0],
    totalMarks: homework.totalMarks,
    status: homework.status,
    batchId: homework.batchId,
    batchName: homework.batch.name,
    subjectId: homework.subjectId,
    subjectName: homework.subject?.name ?? null,
    createdBy: {
      id: homework.createdBy.id,
      name: formatName(
        homework.createdBy.firstName,
        homework.createdBy.lastName
      ),
    },
    isOverdue:
      homework.status === "published" &&
      new Date(homework.dueDate) < new Date(),
    createdAt: homework.createdAt.toISOString(),
    updatedAt: homework.updatedAt.toISOString(),
  };
}

/**
 * Create homework
 */
export async function createHomework(
  input: CreateHomeworkInput,
  scope: TenantScope,
  userId: string
) {
  // Validate batch exists
  const batch = await prisma.batch.findFirst({
    where: { id: input.batchId, branchId: scope.branchId },
  });

  if (!batch) {
    throw new NotFoundError("Batch not found");
  }

  // Validate subject if provided
  if (input.subjectId) {
    const subject = await prisma.subject.findFirst({
      where: { id: input.subjectId, orgId: scope.orgId },
    });

    if (!subject) {
      throw new NotFoundError("Subject not found");
    }
  }

  const homework = await prisma.homework.create({
    data: {
      orgId: scope.orgId,
      branchId: scope.branchId,
      batchId: input.batchId,
      subjectId: input.subjectId ?? null,
      title: input.title,
      description: input.description,
      attachments: input.attachments
        ? (input.attachments as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      dueDate: new Date(input.dueDate),
      totalMarks: input.totalMarks ?? null,
      status: "draft",
      createdById: userId,
    },
    include: {
      batch: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true } },
    },
  });

  return {
    id: homework.id,
    title: homework.title,
    batchName: homework.batch.name,
    subjectName: homework.subject?.name ?? null,
    status: homework.status,
  };
}

/**
 * Update homework
 */
export async function updateHomework(
  id: string,
  input: UpdateHomeworkInput,
  scope: TenantScope
) {
  // Verify homework exists
  const existing = await prisma.homework.findFirst({
    where: { id, orgId: scope.orgId, branchId: scope.branchId },
  });

  if (!existing) {
    throw new NotFoundError("Homework not found");
  }

  // Can only update draft homework
  if (existing.status !== "draft") {
    throw new BadRequestError("Can only update draft homework");
  }

  // Validate batch if being updated
  if (input.batchId) {
    const batch = await prisma.batch.findFirst({
      where: { id: input.batchId, branchId: scope.branchId },
    });

    if (!batch) {
      throw new NotFoundError("Batch not found");
    }
  }

  const homework = await prisma.homework.update({
    where: { id },
    data: {
      batchId: input.batchId,
      subjectId: input.subjectId !== undefined ? input.subjectId : undefined,
      title: input.title,
      description: input.description,
      attachments: input.attachments,
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      totalMarks: input.totalMarks !== undefined ? input.totalMarks : undefined,
    },
    include: {
      batch: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true } },
    },
  });

  return {
    id: homework.id,
    title: homework.title,
    batchName: homework.batch.name,
    subjectName: homework.subject?.name ?? null,
    status: homework.status,
  };
}

/**
 * Delete homework
 */
export async function deleteHomework(id: string, scope: TenantScope) {
  const homework = await prisma.homework.findFirst({
    where: { id, orgId: scope.orgId, branchId: scope.branchId },
  });

  if (!homework) {
    throw new NotFoundError("Homework not found");
  }

  await prisma.homework.delete({ where: { id } });

  return { success: true, id };
}

/**
 * Publish homework - makes it visible to students/parents
 */
export async function publishHomework(id: string, scope: TenantScope) {
  const homework = await prisma.homework.findFirst({
    where: { id, orgId: scope.orgId, branchId: scope.branchId },
  });

  if (!homework) {
    throw new NotFoundError("Homework not found");
  }

  if (homework.status !== "draft") {
    throw new BadRequestError("Can only publish draft homework");
  }

  // Create pending submissions for all students in the batch
  const students = await prisma.student.findMany({
    where: { batchId: homework.batchId, status: "active" },
    select: { id: true },
  });

  await prisma.$transaction([
    prisma.homework.update({
      where: { id },
      data: { status: "published" },
    }),
    prisma.homeworkSubmission.createMany({
      data: students.map((s) => ({
        homeworkId: id,
        studentId: s.id,
        status: "pending",
      })),
      skipDuplicates: true,
    }),
  ]);

  return {
    success: true,
    id,
    status: "published",
    studentCount: students.length,
  };
}

/**
 * Close homework - no more submissions accepted
 */
export async function closeHomework(id: string, scope: TenantScope) {
  const homework = await prisma.homework.findFirst({
    where: { id, orgId: scope.orgId, branchId: scope.branchId },
  });

  if (!homework) {
    throw new NotFoundError("Homework not found");
  }

  if (homework.status !== "published") {
    throw new BadRequestError("Can only close published homework");
  }

  await prisma.homework.update({
    where: { id },
    data: { status: "closed" },
  });

  return { success: true, id, status: "closed" };
}

/**
 * Get submissions for a homework
 */
export async function getSubmissions(id: string, scope: TenantScope) {
  const homework = await prisma.homework.findFirst({
    where: { id, orgId: scope.orgId, branchId: scope.branchId },
    select: { id: true, title: true, totalMarks: true, status: true },
  });

  if (!homework) {
    throw new NotFoundError("Homework not found");
  }

  const submissions = await prisma.homeworkSubmission.findMany({
    where: { homeworkId: id },
    include: {
      student: {
        select: { id: true, firstName: true, lastName: true, photoUrl: true },
      },
      gradedBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ status: "asc" }, { submittedAt: "desc" }],
  });

  return {
    homework: {
      id: homework.id,
      title: homework.title,
      totalMarks: homework.totalMarks,
      status: homework.status,
    },
    submissions: submissions.map((s) => ({
      id: s.id,
      studentId: s.studentId,
      studentName: formatName(s.student.firstName, s.student.lastName),
      studentPhoto: s.student.photoUrl,
      status: s.status,
      submittedAt: s.submittedAt?.toISOString() ?? null,
      attachments: s.attachments as Array<{ name: string; url: string }> | null,
      marks: s.marks,
      feedback: s.feedback,
      gradedBy: s.gradedBy
        ? formatName(s.gradedBy.firstName, s.gradedBy.lastName)
        : null,
      gradedAt: s.gradedAt?.toISOString() ?? null,
    })),
    summary: {
      total: submissions.length,
      pending: submissions.filter((s) => s.status === "pending").length,
      submitted: submissions.filter(
        (s) => s.status === "submitted" || s.status === "late"
      ).length,
      graded: submissions.filter((s) => s.status === "graded").length,
    },
  };
}

/**
 * Grade a submission
 */
export async function gradeSubmission(
  submissionId: string,
  input: GradeSubmissionInput,
  scope: TenantScope,
  userId: string
) {
  const submission = await prisma.homeworkSubmission.findFirst({
    where: { id: submissionId },
    include: {
      homework: {
        select: { orgId: true, branchId: true, totalMarks: true },
      },
    },
  });

  if (!submission) {
    throw new NotFoundError("Submission not found");
  }

  if (
    submission.homework.orgId !== scope.orgId ||
    submission.homework.branchId !== scope.branchId
  ) {
    throw new NotFoundError("Submission not found");
  }

  // Validate marks against total
  if (
    submission.homework.totalMarks !== null &&
    input.marks > submission.homework.totalMarks
  ) {
    throw new BadRequestError(
      `Marks cannot exceed total marks (${submission.homework.totalMarks})`
    );
  }

  const updated = await prisma.homeworkSubmission.update({
    where: { id: submissionId },
    data: {
      marks: input.marks,
      feedback: input.feedback ?? null,
      status: "graded",
      gradedById: userId,
      gradedAt: new Date(),
    },
    include: {
      student: { select: { firstName: true, lastName: true } },
    },
  });

  return {
    id: updated.id,
    studentName: formatName(
      updated.student.firstName,
      updated.student.lastName
    ),
    marks: updated.marks,
    feedback: updated.feedback,
    status: updated.status,
  };
}

/**
 * Get homework stats for dashboard
 */
export async function getHomeworkStats(scope: TenantScope) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [totalActive, dueSoon, pendingGrading] = await Promise.all([
    prisma.homework.count({
      where: {
        orgId: scope.orgId,
        branchId: scope.branchId,
        status: "published",
      },
    }),
    prisma.homework.count({
      where: {
        orgId: scope.orgId,
        branchId: scope.branchId,
        status: "published",
        dueDate: {
          gte: today,
          lte: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000), // Next 7 days
        },
      },
    }),
    prisma.homeworkSubmission.count({
      where: {
        homework: {
          orgId: scope.orgId,
          branchId: scope.branchId,
        },
        status: { in: ["submitted", "late"] },
      },
    }),
  ]);

  return {
    totalActive,
    dueSoon,
    pendingGrading,
  };
}
