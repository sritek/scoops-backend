/**
 * Exams Service
 *
 * Handles exam creation, marks entry, and result management
 */

import { prisma } from "../../config/database.js";
import type { TenantScope } from "../../types/request.js";
import { NotFoundError, BadRequestError } from "../../utils/error-handler.js";
import {
  type PaginationParams,
  createPaginatedResponse,
  calculateSkip,
} from "../../utils/pagination.js";
import type { ExamType } from "@prisma/client";

/**
 * Create exam input
 */
export interface CreateExamInput {
  batchId: string;
  subjectId?: string;
  name: string;
  type: ExamType;
  totalMarks: number;
  passingMarks: number;
  examDate: string;
}

/**
 * Update exam input
 */
export interface UpdateExamInput {
  name?: string;
  totalMarks?: number;
  passingMarks?: number;
  examDate?: string;
  isPublished?: boolean;
}

/**
 * Exam score input
 */
export interface ExamScoreInput {
  studentId: string;
  marksObtained: number | null; // null = absent
  remarks?: string;
}

/**
 * Exam filters
 */
export interface ExamFilters {
  batchId?: string;
  subjectId?: string;
  type?: ExamType;
  isPublished?: boolean;
}

/**
 * Create a new exam
 */
export async function createExam(
  input: CreateExamInput,
  userId: string,
  scope: TenantScope
) {
  // Verify batch exists and belongs to scope
  const batch = await prisma.batch.findFirst({
    where: {
      id: input.batchId,
      branchId: scope.branchId,
    },
  });

  if (!batch) {
    throw new NotFoundError("Batch");
  }

  // Verify subject if provided
  if (input.subjectId) {
    const subject = await prisma.subject.findFirst({
      where: {
        id: input.subjectId,
        orgId: scope.orgId,
      },
    });

    if (!subject) {
      throw new NotFoundError("Subject");
    }
  }

  // Validate marks
  if (input.passingMarks > input.totalMarks) {
    throw new BadRequestError("Passing marks cannot exceed total marks");
  }

  const exam = await prisma.exam.create({
    data: {
      orgId: scope.orgId,
      branchId: scope.branchId,
      batchId: input.batchId,
      subjectId: input.subjectId || null,
      name: input.name,
      type: input.type,
      totalMarks: input.totalMarks,
      passingMarks: input.passingMarks,
      examDate: new Date(input.examDate),
      createdById: userId,
    },
    include: {
      batch: { select: { name: true } },
      subject: { select: { name: true } },
    },
  });

  return {
    ...exam,
    batchName: exam.batch.name,
    subjectName: exam.subject?.name || null,
  };
}

/**
 * Get exams list
 */
export async function getExams(
  scope: TenantScope,
  pagination: PaginationParams,
  filters?: ExamFilters
) {
  const where: any = {
    orgId: scope.orgId,
    branchId: scope.branchId,
  };

  if (filters?.batchId) {
    where.batchId = filters.batchId;
  }

  if (filters?.subjectId) {
    where.subjectId = filters.subjectId;
  }

  if (filters?.type) {
    where.type = filters.type;
  }

  if (typeof filters?.isPublished === "boolean") {
    where.isPublished = filters.isPublished;
  }

  const [exams, total] = await Promise.all([
    prisma.exam.findMany({
      where,
      include: {
        batch: { select: { name: true } },
        subject: { select: { name: true } },
        _count: { select: { scores: true } },
      },
      orderBy: { examDate: "desc" },
      skip: calculateSkip(pagination),
      take: pagination.limit,
    }),
    prisma.exam.count({ where }),
  ]);

  return createPaginatedResponse(
    exams.map((e) => ({
      id: e.id,
      name: e.name,
      type: e.type,
      batchId: e.batchId,
      batchName: e.batch.name,
      subjectId: e.subjectId,
      subjectName: e.subject?.name || null,
      totalMarks: e.totalMarks,
      passingMarks: e.passingMarks,
      examDate: e.examDate,
      isPublished: e.isPublished,
      scoresCount: e._count.scores,
      createdAt: e.createdAt,
    })),
    total,
    pagination
  );
}

/**
 * Get exam by ID
 */
export async function getExamById(id: string, scope: TenantScope) {
  const exam = await prisma.exam.findFirst({
    where: {
      id,
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
    include: {
      batch: { select: { name: true } },
      subject: { select: { name: true } },
      createdBy: { select: { firstName: true, lastName: true } },
      scores: {
        include: {
          student: { select: { id: true, firstName: true, lastName: true } },
          gradedBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: { student: { firstName: "asc" } },
      },
    },
  });

  if (!exam) {
    throw new NotFoundError("Exam");
  }

  // Calculate statistics
  const scoredStudents = exam.scores.filter((s) => s.marksObtained !== null);
  const totalScored = scoredStudents.length;
  const totalAbsent = exam.scores.length - totalScored;
  const avgMarks =
    totalScored > 0
      ? scoredStudents.reduce((sum, s) => sum + (s.marksObtained || 0), 0) / totalScored
      : 0;
  const passCount = scoredStudents.filter(
    (s) => (s.marksObtained || 0) >= exam.passingMarks
  ).length;
  const failCount = totalScored - passCount;

  return {
    ...exam,
    batchName: exam.batch.name,
    subjectName: exam.subject?.name || null,
    createdByName: `${exam.createdBy.firstName} ${exam.createdBy.lastName}`,
    scores: exam.scores.map((s) => ({
      id: s.id,
      studentId: s.studentId,
      studentName: `${s.student.firstName} ${s.student.lastName}`,
      marksObtained: s.marksObtained,
      remarks: s.remarks,
      gradedAt: s.gradedAt,
      gradedBy: `${s.gradedBy.firstName} ${s.gradedBy.lastName}`,
      isPassed: s.marksObtained !== null && s.marksObtained >= exam.passingMarks,
      grade: calculateGrade(s.marksObtained, exam.totalMarks),
    })),
    statistics: {
      totalStudents: exam.scores.length,
      totalScored,
      totalAbsent,
      averageMarks: Math.round(avgMarks * 10) / 10,
      passCount,
      failCount,
      passPercentage: totalScored > 0 ? Math.round((passCount / totalScored) * 100) : 0,
    },
  };
}

/**
 * Update exam
 */
export async function updateExam(
  id: string,
  input: UpdateExamInput,
  scope: TenantScope
) {
  const exam = await prisma.exam.findFirst({
    where: {
      id,
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
  });

  if (!exam) {
    throw new NotFoundError("Exam");
  }

  // Validate marks if provided
  const totalMarks = input.totalMarks ?? exam.totalMarks;
  const passingMarks = input.passingMarks ?? exam.passingMarks;

  if (passingMarks > totalMarks) {
    throw new BadRequestError("Passing marks cannot exceed total marks");
  }

  return prisma.exam.update({
    where: { id },
    data: {
      name: input.name,
      totalMarks: input.totalMarks,
      passingMarks: input.passingMarks,
      examDate: input.examDate ? new Date(input.examDate) : undefined,
      isPublished: input.isPublished,
    },
    include: {
      batch: { select: { name: true } },
      subject: { select: { name: true } },
    },
  });
}

/**
 * Delete exam
 */
export async function deleteExam(id: string, scope: TenantScope) {
  const exam = await prisma.exam.findFirst({
    where: {
      id,
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
  });

  if (!exam) {
    throw new NotFoundError("Exam");
  }

  await prisma.exam.delete({ where: { id } });
}

/**
 * Get students for marks entry
 */
export async function getStudentsForMarksEntry(
  examId: string,
  scope: TenantScope
) {
  const exam = await prisma.exam.findFirst({
    where: {
      id: examId,
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
    include: {
      batch: {
        include: {
          students: {
            where: { status: "active" },
            orderBy: { firstName: "asc" },
          },
        },
      },
      scores: true,
    },
  });

  if (!exam) {
    throw new NotFoundError("Exam");
  }

  // Map existing scores by student ID
  const existingScores = new Map(
    exam.scores.map((s) => [s.studentId, s])
  );

  return exam.batch.students.map((student) => {
    const score = existingScores.get(student.id);
    return {
      studentId: student.id,
      studentName: `${student.firstName} ${student.lastName}`,
      marksObtained: score?.marksObtained ?? null,
      remarks: score?.remarks || "",
      hasScore: !!score,
    };
  });
}

/**
 * Save exam scores (bulk upsert)
 */
export async function saveExamScores(
  examId: string,
  scores: ExamScoreInput[],
  userId: string,
  scope: TenantScope
) {
  const exam = await prisma.exam.findFirst({
    where: {
      id: examId,
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
  });

  if (!exam) {
    throw new NotFoundError("Exam");
  }

  // Validate scores
  for (const score of scores) {
    if (score.marksObtained !== null && score.marksObtained > exam.totalMarks) {
      throw new BadRequestError(
        `Marks cannot exceed total marks (${exam.totalMarks})`
      );
    }
    if (score.marksObtained !== null && score.marksObtained < 0) {
      throw new BadRequestError("Marks cannot be negative");
    }
  }

  // Upsert scores
  const operations = scores.map((score) =>
    prisma.examScore.upsert({
      where: {
        examId_studentId: {
          examId,
          studentId: score.studentId,
        },
      },
      update: {
        marksObtained: score.marksObtained,
        remarks: score.remarks,
        gradedById: userId,
        gradedAt: new Date(),
      },
      create: {
        examId,
        studentId: score.studentId,
        marksObtained: score.marksObtained,
        remarks: score.remarks,
        gradedById: userId,
      },
    })
  );

  await prisma.$transaction(operations);

  return { saved: scores.length };
}

/**
 * Calculate grade based on percentage
 */
function calculateGrade(
  marksObtained: number | null,
  totalMarks: number
): string {
  if (marksObtained === null) return "AB"; // Absent

  const percentage = (marksObtained / totalMarks) * 100;

  if (percentage >= 90) return "A+";
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B+";
  if (percentage >= 60) return "B";
  if (percentage >= 50) return "C+";
  if (percentage >= 40) return "C";
  if (percentage >= 33) return "D";
  return "F";
}

/**
 * Get student report card (all exams for a student)
 */
export async function getStudentReportCard(
  studentId: string,
  scope: TenantScope
) {
  const student = await prisma.student.findFirst({
    where: {
      id: studentId,
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
    include: {
      batch: { select: { name: true } },
    },
  });

  if (!student) {
    throw new NotFoundError("Student");
  }

  const scores = await prisma.examScore.findMany({
    where: {
      studentId,
      exam: {
        isPublished: true,
        branchId: scope.branchId,
      },
    },
    include: {
      exam: {
        select: {
          id: true,
          name: true,
          type: true,
          totalMarks: true,
          passingMarks: true,
          examDate: true,
          subject: { select: { name: true } },
        },
      },
    },
    orderBy: { exam: { examDate: "desc" } },
  });

  return {
    student: {
      id: student.id,
      name: `${student.firstName} ${student.lastName}`,
      batchName: student.batch?.name || "N/A",
    },
    exams: scores.map((s) => ({
      examId: s.exam.id,
      examName: s.exam.name,
      examType: s.exam.type,
      subjectName: s.exam.subject?.name || "General",
      examDate: s.exam.examDate,
      totalMarks: s.exam.totalMarks,
      passingMarks: s.exam.passingMarks,
      marksObtained: s.marksObtained,
      grade: calculateGrade(s.marksObtained, s.exam.totalMarks),
      isPassed:
        s.marksObtained !== null && s.marksObtained >= s.exam.passingMarks,
      remarks: s.remarks,
    })),
  };
}
