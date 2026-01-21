/**
 * Parent Service
 *
 * Business logic for parent-specific operations:
 * - Dashboard data
 * - Children information
 * - Fees and installments
 */

import { prisma } from "../../config/database.js";
import type { ParentContext } from "../../middleware/parent-auth.middleware.js";
import { NotFoundError, ForbiddenError, BadRequestError } from "../../utils/error-handler.js";
import type { Prisma, ExamType, InstallmentStatus } from "@prisma/client";

/**
 * Format full name from first and last name
 */
function formatFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

/**
 * Get parent profile with linked children count
 */
export async function getParentProfile(parentId: string) {
  const parent = await prisma.parent.findUnique({
    where: { id: parentId },
    include: {
      _count: {
        select: { students: true },
      },
    },
  });

  if (!parent) {
    throw new NotFoundError("Parent not found");
  }

  return {
    id: parent.id,
    firstName: parent.firstName,
    lastName: parent.lastName,
    phone: parent.phone,
    email: parent.email,
    photoUrl: parent.photoUrl,
    childrenCount: parent._count.students,
  };
}

/**
 * Get dashboard statistics for parent
 */
export async function getParentDashboard(parentContext: ParentContext) {
  const { parentId } = parentContext;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Get children with their basic info and photo
  const children = await prisma.studentParent.findMany({
    where: { parentId },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          photoUrl: true,
          status: true,
          batch: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  // Get today's attendance for all children
  const studentIds = children.map((c) => c.student.id);
  const todayAttendance = await prisma.attendanceRecord.findMany({
    where: {
      studentId: { in: studentIds },
      session: {
        attendanceDate: {
          gte: today,
          lt: tomorrow,
        },
      },
    },
    select: {
      studentId: true,
      status: true,
    },
  });

  const attendanceMap = new Map(
    todayAttendance.map((a) => [a.studentId, a.status])
  );

  // Get pending installments per child
  const pendingInstallmentsByStudent = await prisma.feeInstallment.groupBy({
    by: ["studentFeeStructureId"],
    where: {
      studentFeeStructure: {
        studentId: { in: studentIds },
      },
      status: { in: ["due", "partial", "overdue"] as InstallmentStatus[] },
    },
    _count: true,
  });

  // Get student IDs from fee structures to map back
  const feeStructures = await prisma.studentFeeStructure.findMany({
    where: {
      id: { in: pendingInstallmentsByStudent.map((p) => p.studentFeeStructureId) },
    },
    select: {
      id: true,
      studentId: true,
    },
  });

  const feeStructureToStudent = new Map(
    feeStructures.map((fs) => [fs.id, fs.studentId])
  );

  const pendingInstallmentsMap = new Map<string, number>();
  for (const p of pendingInstallmentsByStudent) {
    const studentId = feeStructureToStudent.get(p.studentFeeStructureId);
    if (studentId) {
      pendingInstallmentsMap.set(
        studentId,
        (pendingInstallmentsMap.get(studentId) ?? 0) + p._count
      );
    }
  }

  // Get total pending fee amount per child
  const pendingFeeAmounts = await prisma.feeInstallment.groupBy({
    by: ["studentFeeStructureId"],
    where: {
      studentFeeStructure: {
        studentId: { in: studentIds },
      },
      status: { in: ["due", "partial", "overdue"] as InstallmentStatus[] },
    },
    _sum: {
      amount: true,
      paidAmount: true,
    },
  });

  const pendingAmountMap = new Map<string, number>();
  for (const p of pendingFeeAmounts) {
    const studentId = feeStructureToStudent.get(p.studentFeeStructureId);
    if (studentId) {
      const pending = (p._sum.amount ?? 0) - (p._sum.paidAmount ?? 0);
      pendingAmountMap.set(
        studentId,
        (pendingAmountMap.get(studentId) ?? 0) + pending
      );
    }
  }

  // Get pending fee installments count (total)
  const pendingInstallments = await prisma.feeInstallment.count({
    where: {
      studentFeeStructure: {
        student: {
          studentParents: {
            some: { parentId },
          },
        },
      },
      status: { in: ["due", "partial", "overdue"] as InstallmentStatus[] },
    },
  });

  // Get unread messages count
  const unreadMessages = await prisma.message.count({
    where: {
      conversation: {
        participants: {
          some: { parentId },
        },
      },
      senderUserId: { not: null },
      createdAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    },
  });

  // Get recent complaints count
  const activeComplaints = await prisma.complaint.count({
    where: {
      submittedByParentId: parentId,
      status: { in: ["open", "in_progress"] },
    },
  });

  // Calculate total pending amount
  let totalPendingAmount = 0;
  for (const [, amount] of pendingAmountMap) {
    totalPendingAmount += amount;
  }

  return {
    childrenCount: children.length,
    children: children.map((c) => {
      const attendance = attendanceMap.get(c.student.id);
      return {
        id: c.student.id,
        firstName: c.student.firstName,
        lastName: c.student.lastName,
        photoUrl: c.student.photoUrl,
        status: c.student.status,
        batchName: c.student.batch?.name ?? null,
        relation: c.relation,
        isPrimaryContact: c.isPrimaryContact,
        // Per-child stats
        todayAttendance: attendance ?? "not_marked",
        pendingInstallments: pendingInstallmentsMap.get(c.student.id) ?? 0,
        pendingFeeAmount: pendingAmountMap.get(c.student.id) ?? 0,
      };
    }),
    pendingInstallments,
    totalPendingAmount,
    unreadMessages,
    activeComplaints,
  };
}

/**
 * Get all children linked to a parent
 */
export async function getParentChildren(parentContext: ParentContext) {
  const { parentId } = parentContext;

  const studentParents = await prisma.studentParent.findMany({
    where: { parentId },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          status: true,
          photoUrl: true,
          dob: true,
          batch: {
            select: {
              id: true,
              name: true,
            },
          },
          // Get attendance summary (last 30 days)
          attendanceRecords: {
            where: {
              session: {
                attendanceDate: {
                  gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                },
              },
            },
            select: {
              status: true,
            },
          },
        },
      },
    },
  });

  return studentParents.map((sp) => {
    const { student } = sp;
    const totalDays = student.attendanceRecords.length;
    const presentDays = student.attendanceRecords.filter(
      (a: { status: string }) => a.status === "PRESENT" || a.status === "LATE"
    ).length;

    return {
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      status: student.status,
      photoUrl: student.photoUrl,
      dateOfBirth: student.dob,
      batchId: student.batch?.id ?? null,
      batchName: student.batch?.name ?? null,
      relation: sp.relation,
      isPrimaryContact: sp.isPrimaryContact,
      attendanceSummary: {
        totalDays,
        presentDays,
        attendancePercentage:
          totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : null,
      },
    };
  });
}

/**
 * Get detailed information about a child (if parent is linked)
 */
export async function getChildDetails(
  parentContext: ParentContext,
  studentId: string
) {
  const { parentId } = parentContext;

  // Verify parent is linked to this student
  const link = await prisma.studentParent.findUnique({
    where: {
      studentId_parentId: { studentId, parentId },
    },
  });

  if (!link) {
    throw new ForbiddenError("You do not have access to this student");
  }

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      batch: {
        select: {
          id: true,
          name: true,
        },
      },
      health: true,
      healthCheckups: {
        orderBy: { checkupDate: "desc" },
        take: 5,
      },
    },
  });

  if (!student) {
    throw new NotFoundError("Student not found");
  }

  return {
    id: student.id,
    firstName: student.firstName,
    lastName: student.lastName,
    dateOfBirth: student.dob,
    gender: student.gender,
    status: student.status,
    photoUrl: student.photoUrl,
    batch: student.batch,
    health: student.health,
    recentCheckups: student.healthCheckups,
    relation: link.relation,
    isPrimaryContact: link.isPrimaryContact,
  };
}

/**
 * Get child attendance history
 */
export async function getChildAttendance(
  parentContext: ParentContext,
  studentId: string,
  options: { startDate?: Date; endDate?: Date; limit?: number } = {}
) {
  const { parentId } = parentContext;

  // Verify parent is linked to this student
  const link = await prisma.studentParent.findUnique({
    where: {
      studentId_parentId: { studentId, parentId },
    },
  });

  if (!link) {
    throw new ForbiddenError("You do not have access to this student");
  }

  const { startDate, endDate, limit = 30 } = options;

  const attendance = await prisma.attendanceRecord.findMany({
    where: {
      studentId,
      session: {
        ...(startDate && { attendanceDate: { gte: startDate } }),
        ...(endDate && { attendanceDate: { lte: endDate } }),
      },
    },
    orderBy: { session: { attendanceDate: "desc" } },
    take: limit,
    include: {
      session: {
        select: {
          attendanceDate: true,
        },
      },
    },
  });

  // Calculate summary
  const totalDays = attendance.length;
  const presentDays = attendance.filter(
    (a: { status: string }) => a.status === "PRESENT" || a.status === "LATE"
  ).length;
  const absentDays = attendance.filter((a: { status: string }) => a.status === "ABSENT").length;
  const lateDays = attendance.filter((a: { status: string }) => a.status === "LATE").length;

  return {
    records: attendance,
    summary: {
      totalDays,
      presentDays,
      absentDays,
      lateDays,
      attendancePercentage:
        totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : null,
    },
  };
}

/**
 * Get child fee structure and installments
 */
export async function getChildFees(
  parentContext: ParentContext,
  studentId: string
) {
  const { parentId } = parentContext;

  // Verify parent is linked to this student
  const link = await prisma.studentParent.findUnique({
    where: {
      studentId_parentId: { studentId, parentId },
    },
  });

  if (!link) {
    throw new ForbiddenError("You do not have access to this student");
  }

  // Get student fee structure with line items
  const feeStructure = await prisma.studentFeeStructure.findFirst({
    where: { studentId },
    include: {
      session: {
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
        },
      },
      lineItems: {
        include: {
          feeComponent: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
        },
      },
      batchFeeStructure: {
        include: {
          lineItems: {
            include: {
              feeComponent: true,
            },
          },
        },
      },
      installments: {
        orderBy: { dueDate: "asc" },
        include: {
          payments: {
            orderBy: { receivedAt: "desc" },
          },
          paymentLinks: {
            where: {
              status: "active",
              expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  // Get scholarships
  const scholarships = await prisma.studentScholarship.findMany({
    where: { studentId },
    include: {
      scholarship: true,
    },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Calculate totals and find next due installment
  const totalFee = feeStructure?.netAmount ?? 0;
  const grossAmount = feeStructure?.grossAmount ?? 0;
  const totalPaid =
    feeStructure?.installments.reduce((sum, inst) => sum + inst.paidAmount, 0) ?? 0;
  const totalPending = totalFee - totalPaid;

  // Find next unpaid/partial installment
  const upcomingInstallment = feeStructure?.installments.find(
    (inst) => inst.status !== "paid" && inst.paidAmount < inst.amount
  );

  // Count overdue installments
  const overdueCount = feeStructure?.installments.filter(
    (inst) => inst.status === "overdue" || (inst.dueDate < today && inst.paidAmount < inst.amount)
  ).length ?? 0;

  return {
    feeStructure: feeStructure
      ? {
          id: feeStructure.id,
          grossAmount: grossAmount,
          scholarshipAmount: feeStructure.scholarshipAmount,
          netAmount: totalFee,
          sessionName: feeStructure.session.name,
          sessionId: feeStructure.session.id,
          remarks: feeStructure.remarks,
        }
      : null,
    lineItems: feeStructure?.lineItems.map((item) => ({
      id: item.id,
      componentId: item.feeComponent.id,
      componentName: item.feeComponent.name,
      description: item.feeComponent.description,
      originalAmount: item.originalAmount,
      adjustedAmount: item.adjustedAmount,
      waived: item.waived,
      waiverReason: item.waiverReason,
    })) ?? [],
    scholarships: scholarships.map((s) => ({
      id: s.id,
      name: s.scholarship.name,
      discountType: s.scholarship.type,
      discountValue: s.scholarship.value,
      isActive: s.isActive,
      approvedAt: s.approvedAt,
    })),
    installments:
      feeStructure?.installments.map((inst) => {
        const activePaymentLink = inst.paymentLinks[0];
        return {
          id: inst.id,
          installmentNumber: inst.installmentNumber,
          dueDate: inst.dueDate,
          amount: inst.amount,
          paidAmount: inst.paidAmount,
          status: inst.status,
          isOverdue: inst.dueDate < today && inst.paidAmount < inst.amount,
          payments: inst.payments.map((p: { id: string; amount: number; receivedAt: Date; paymentMode: string; transactionRef: string | null }) => ({
            id: p.id,
            amount: p.amount,
            paymentDate: p.receivedAt,
            paymentMode: p.paymentMode,
            transactionId: p.transactionRef,
          })),
          paymentLink: activePaymentLink
            ? {
                shortCode: activePaymentLink.shortCode,
                paymentUrl: activePaymentLink.razorpayUrl || `/pay/${activePaymentLink.shortCode}`,
                expiresAt: activePaymentLink.expiresAt,
                status: activePaymentLink.status,
              }
            : null,
        };
      }) ?? [],
    summary: {
      grossAmount,
      scholarshipAmount: feeStructure?.scholarshipAmount ?? 0,
      totalFee,
      totalPaid,
      totalPending,
      installmentCount: feeStructure?.installments.length ?? 0,
      paidInstallments: feeStructure?.installments.filter((i) => i.status === "paid").length ?? 0,
      overdueCount,
      upcomingDueDate: upcomingInstallment?.dueDate ?? null,
      upcomingAmount: upcomingInstallment ? (upcomingInstallment.amount - upcomingInstallment.paidAmount) : null,
    },
  };
}

/**
 * Get active payment links for a child's fee installments
 */
export async function getChildPaymentLinks(
  parentContext: ParentContext,
  studentId: string
) {
  const { parentId } = parentContext;

  // Verify parent is linked to this student
  const link = await prisma.studentParent.findUnique({
    where: {
      studentId_parentId: { studentId, parentId },
    },
  });

  if (!link) {
    throw new ForbiddenError("You do not have access to this student");
  }

  // Get all fee structures for the student
  const feeStructures = await prisma.studentFeeStructure.findMany({
    where: { studentId },
    select: { id: true },
  });

  const feeStructureIds = feeStructures.map((fs) => fs.id);

  // Get active payment links for the student's installments
  const paymentLinks = await prisma.paymentLink.findMany({
    where: {
      installment: {
        studentFeeStructureId: { in: feeStructureIds },
      },
      status: "active",
      expiresAt: { gt: new Date() },
    },
    include: {
      installment: {
        select: {
          id: true,
          installmentNumber: true,
          amount: true,
          dueDate: true,
          paidAmount: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return paymentLinks.map((pl) => ({
    id: pl.id,
    shortCode: pl.shortCode,
    paymentUrl: pl.razorpayUrl || `/pay/${pl.shortCode}`,
    amount: pl.amount,
    description: pl.description,
    status: pl.status,
    expiresAt: pl.expiresAt,
    createdAt: pl.createdAt,
    installment: pl.installment
      ? {
          id: pl.installment.id,
          installmentNumber: pl.installment.installmentNumber,
          amount: pl.installment.amount,
          dueDate: pl.installment.dueDate,
          paidAmount: pl.installment.paidAmount,
          status: pl.installment.status,
          pendingAmount: pl.installment.amount - pl.installment.paidAmount,
        }
      : null,
  }));
}

/**
 * Get teachers for a child's batch
 * Returns class teacher and subject teachers
 */
export async function getChildTeachers(
  parentContext: ParentContext,
  studentId: string
) {
  const { parentId } = parentContext;

  // Verify parent is linked to this student
  const link = await prisma.studentParent.findUnique({
    where: {
      studentId_parentId: { studentId, parentId },
    },
  });

  if (!link) {
    throw new ForbiddenError("You do not have access to this student");
  }

  // Get student with batch
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      batch: {
        include: {
          classTeacher: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              photoUrl: true,
            },
          },
          periods: {
            include: {
              teacher: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  photoUrl: true,
                },
              },
              subject: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!student) {
    throw new NotFoundError("Student not found");
  }

  if (!student.batch) {
    return {
      classTeacher: null,
      subjectTeachers: [],
    };
  }

  // Build class teacher info
  const classTeacher = student.batch.classTeacher
    ? {
        id: student.batch.classTeacher.id,
        firstName: student.batch.classTeacher.firstName,
        lastName: student.batch.classTeacher.lastName,
        photoUrl: student.batch.classTeacher.photoUrl,
        isClassTeacher: true,
        subjects: [] as string[],
      }
    : null;

  // Build subject teachers map (deduplicate by teacher ID)
  const teacherSubjectsMap = new Map<
    string,
    {
      id: string;
      firstName: string;
      lastName: string;
      photoUrl: string | null;
      subjects: Set<string>;
    }
  >();

  for (const period of student.batch.periods) {
    if (period.teacher && period.subject) {
      const existing = teacherSubjectsMap.get(period.teacher.id);
      if (existing) {
        existing.subjects.add(period.subject.name);
      } else {
        teacherSubjectsMap.set(period.teacher.id, {
          id: period.teacher.id,
          firstName: period.teacher.firstName,
          lastName: period.teacher.lastName,
          photoUrl: period.teacher.photoUrl,
          subjects: new Set([period.subject.name]),
        });
      }
    }
  }

  // Convert to array and exclude class teacher from subject teachers list
  const subjectTeachers = Array.from(teacherSubjectsMap.values())
    .filter((t) => t.id !== classTeacher?.id)
    .map((t) => ({
      id: t.id,
      firstName: t.firstName,
      lastName: t.lastName,
      photoUrl: t.photoUrl,
      isClassTeacher: false,
      subjects: Array.from(t.subjects),
    }));

  // If class teacher also teaches subjects, add them
  if (classTeacher && teacherSubjectsMap.has(classTeacher.id)) {
    const classTeacherSubjects = teacherSubjectsMap.get(classTeacher.id);
    if (classTeacherSubjects) {
      classTeacher.subjects = Array.from(classTeacherSubjects.subjects);
    }
  }

  return {
    classTeacher,
    subjectTeachers,
  };
}

/**
 * Get ID card data for a child
 */
export async function getChildIdCard(
  parentContext: ParentContext,
  studentId: string
) {
  const { parentId, orgId, branchId } = parentContext;

  // Verify parent is linked to this student
  const link = await prisma.studentParent.findUnique({
    where: {
      studentId_parentId: { studentId, parentId },
    },
  });

  if (!link) {
    throw new ForbiddenError("You do not have access to this student");
  }

  // Get student with organization and branch
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      batch: {
        select: {
          name: true,
        },
      },
      organization: {
        select: {
          name: true,
          logoUrl: true,
        },
      },
      branch: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!student) {
    throw new NotFoundError("Student not found");
  }

  return {
    studentId: student.id,
    firstName: student.firstName,
    lastName: student.lastName,
    photoUrl: student.photoUrl,
    batchName: student.batch?.name ?? null,
    admissionYear: student.admissionYear,
    orgName: student.organization.name,
    orgLogoUrl: student.organization.logoUrl,
    branchName: student.branch.name,
    qrData: JSON.stringify({
      studentId: student.id,
      orgId,
      branchId,
    }),
  };
}

/**
 * Get all fees summary across all children
 */
export async function getAllChildrenFees(parentContext: ParentContext) {
  const { parentId } = parentContext;

  // Get all children
  const children = await prisma.studentParent.findMany({
    where: { parentId },
    select: {
      studentId: true,
      student: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  const childrenFees = await Promise.all(
    children.map(async (child) => {
      const fees = await getChildFees(parentContext, child.studentId);
      const pendingWithLinks = fees.installments.filter(
        (i) => i.status !== "paid" && i.paymentLink !== null
      );
      return {
        studentId: child.studentId,
        studentName: `${child.student.firstName} ${child.student.lastName}`,
        ...fees.summary,
        pendingInstallments: fees.installments.filter(
          (i) => i.status !== "paid"
        ).length,
        activePaymentLinks: pendingWithLinks.length,
        nextPaymentLink: pendingWithLinks.length > 0 ? pendingWithLinks[0].paymentLink : null,
      };
    })
  );

  const totalPending = childrenFees.reduce((sum, c) => sum + c.totalPending, 0);
  const totalPaid = childrenFees.reduce((sum, c) => sum + c.totalPaid, 0);

  return {
    children: childrenFees,
    overall: {
      totalPending,
      totalPaid,
      total: totalPending + totalPaid,
    },
  };
}

// ============================================================================
// Exam & Report Card Functions
// ============================================================================

/**
 * Calculate grade based on percentage
 */
function calculateGrade(marksObtained: number | null, totalMarks: number): string {
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
 * Get child's exam results (published exams only)
 */
export async function getChildExams(
  parentContext: ParentContext,
  studentId: string,
  filters?: { type?: string }
) {
  const { parentId } = parentContext;

  // Verify parent is linked to this student
  const link = await prisma.studentParent.findUnique({
    where: {
      studentId_parentId: { studentId, parentId },
    },
  });

  if (!link) {
    throw new ForbiddenError("You do not have access to this student");
  }

  // Get student with batch info
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      batchId: true,
      batch: { select: { id: true, name: true } },
    },
  });

  if (!student) {
    throw new NotFoundError("Student not found");
  }

  // Build exam filter
  const examWhere: Prisma.ExamWhereInput = {
    batchId: student.batchId || "",
    isPublished: true,
  };

  if (filters?.type) {
    examWhere.type = filters.type as ExamType;
  }

  // Get published exams for the batch
  const exams = await prisma.exam.findMany({
    where: examWhere,
    include: {
      subject: { select: { id: true, name: true } },
      scores: {
        select: {
          studentId: true,
          marksObtained: true,
        },
      },
    },
    orderBy: { examDate: "desc" },
  });

  // Map exams with child's score and batch average
  const examResults = exams.map((exam) => {
    // Find child's score
    const childScore = exam.scores.find((s) => s.studentId === studentId);
    
    // Calculate batch average (only for students who attended)
    const attendedScores = exam.scores.filter((s) => s.marksObtained !== null);
    const batchAverage =
      attendedScores.length > 0
        ? Math.round(
            attendedScores.reduce((sum, s) => sum + (s.marksObtained || 0), 0) /
              attendedScores.length
          )
        : null;

    const marksObtained = childScore?.marksObtained ?? null;
    const percentage = marksObtained !== null ? Math.round((marksObtained / exam.totalMarks) * 100) : null;
    const batchAveragePercentage = batchAverage !== null ? Math.round((batchAverage / exam.totalMarks) * 100) : null;

    return {
      id: exam.id,
      name: exam.name,
      type: exam.type,
      subject: exam.subject?.name ?? null,
      subjectId: exam.subject?.id ?? null,
      examDate: exam.examDate.toISOString().split("T")[0],
      totalMarks: exam.totalMarks,
      passingMarks: exam.passingMarks,
      marksObtained,
      percentage,
      grade: calculateGrade(marksObtained, exam.totalMarks),
      isPassed: marksObtained !== null && marksObtained >= exam.passingMarks,
      isAbsent: childScore !== undefined && marksObtained === null,
      hasScore: childScore !== undefined,
      batchAverage,
      batchAveragePercentage,
    };
  });

  return {
    student: {
      id: student.id,
      name: formatFullName(student.firstName, student.lastName),
      batchName: student.batch?.name ?? null,
    },
    exams: examResults,
    summary: {
      totalExams: examResults.length,
      attemptedExams: examResults.filter((e) => e.hasScore && !e.isAbsent).length,
      passedExams: examResults.filter((e) => e.isPassed).length,
      failedExams: examResults.filter((e) => e.hasScore && !e.isAbsent && !e.isPassed).length,
      absentExams: examResults.filter((e) => e.isAbsent).length,
    },
  };
}

/**
 * Get child's report card (all published exam results with summary)
 */
export async function getChildReportCard(
  parentContext: ParentContext,
  studentId: string
) {
  const { parentId } = parentContext;

  // Verify parent is linked to this student
  const link = await prisma.studentParent.findUnique({
    where: {
      studentId_parentId: { studentId, parentId },
    },
  });

  if (!link) {
    throw new ForbiddenError("You do not have access to this student");
  }

  // Get student info
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      batch: { select: { id: true, name: true } },
      organization: { select: { name: true } },
      branch: { select: { name: true } },
    },
  });

  if (!student) {
    throw new NotFoundError("Student not found");
  }

  // Get all published exam scores for this student
  const scores = await prisma.examScore.findMany({
    where: {
      studentId,
      exam: { isPublished: true },
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

  // Map scores to exam results
  const exams = scores.map((s) => {
    const percentage = s.marksObtained !== null
      ? Math.round((s.marksObtained / s.exam.totalMarks) * 100)
      : null;

    return {
      id: s.exam.id,
      name: s.exam.name,
      type: s.exam.type,
      subject: s.exam.subject?.name ?? "General",
      examDate: s.exam.examDate.toISOString().split("T")[0],
      totalMarks: s.exam.totalMarks,
      passingMarks: s.exam.passingMarks,
      marksObtained: s.marksObtained,
      percentage,
      grade: calculateGrade(s.marksObtained, s.exam.totalMarks),
      isPassed: s.marksObtained !== null && s.marksObtained >= s.exam.passingMarks,
    };
  });

  // Calculate summary
  const scoredExams = exams.filter((e) => e.marksObtained !== null);
  const totalMarksObtained = scoredExams.reduce((sum, e) => sum + (e.marksObtained || 0), 0);
  const totalMaxMarks = scoredExams.reduce((sum, e) => sum + e.totalMarks, 0);
  const overallPercentage = totalMaxMarks > 0
    ? Math.round((totalMarksObtained / totalMaxMarks) * 100)
    : 0;

  return {
    student: {
      id: student.id,
      name: formatFullName(student.firstName, student.lastName),
      batchName: student.batch?.name ?? "N/A",
      branchName: student.branch?.name ?? "N/A",
      organizationName: student.organization.name,
    },
    exams,
    summary: {
      totalExams: exams.length,
      passedExams: exams.filter((e) => e.isPassed).length,
      failedExams: scoredExams.filter((e) => !e.isPassed).length,
      absentExams: exams.filter((e) => e.marksObtained === null).length,
      totalMarksObtained,
      totalMaxMarks,
      overallPercentage,
      overallGrade: calculateGrade(overallPercentage, 100),
    },
  };
}

// ============================================================================
// Academic Calendar Functions
// ============================================================================

/**
 * Get parent's calendar events for a month
 * Includes academic events and exam dates for all children's batches
 */
export async function getParentCalendar(
  parentContext: ParentContext,
  month: number,
  year: number,
  childId?: string
) {
  const { parentId, orgId, branchId } = parentContext;

  // Get parent's children and their batch IDs
  const childrenQuery: { parentId: string; student?: { id: string } } = { parentId };
  
  if (childId) {
    childrenQuery.student = { id: childId };
  }

  const children = await prisma.studentParent.findMany({
    where: childrenQuery,
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          batchId: true,
          batch: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (children.length === 0) {
    return {
      events: [],
      month,
      year,
      children: [],
    };
  }

  // Get unique batch IDs
  const batchIds = [...new Set(children.map((c) => c.student.batchId).filter(Boolean))] as string[];

  // Calculate date range for the month
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0); // Last day of month

  // Get academic events (school-wide or matching children's batches)
  const academicEvents = await prisma.academicEvent.findMany({
    where: {
      orgId,
      branchId,
      OR: [
        // Event starts in this month
        {
          startDate: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
        // Event ends in this month
        {
          endDate: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
        // Event spans the entire month
        {
          startDate: { lte: startOfMonth },
          endDate: { gte: endOfMonth },
        },
      ],
      AND: [
        {
          OR: [
            { batchId: null }, // School-wide events
            { batchId: { in: batchIds } }, // Batch-specific events
          ],
        },
      ],
    },
    include: {
      batch: { select: { id: true, name: true } },
    },
    orderBy: { startDate: "asc" },
  });

  // Get published exams for children's batches in this month
  const exams = await prisma.exam.findMany({
    where: {
      batchId: { in: batchIds },
      isPublished: true,
      examDate: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    },
    include: {
      batch: { select: { id: true, name: true } },
      subject: { select: { name: true } },
    },
    orderBy: { examDate: "asc" },
  });

  // Map academic events to response format
  const eventsList = academicEvents.map((e) => ({
    id: e.id,
    type: e.type as string,
    title: e.title,
    description: e.description,
    startDate: e.startDate.toISOString().split("T")[0],
    endDate: e.endDate?.toISOString().split("T")[0] ?? null,
    isAllDay: e.isAllDay,
    batchId: e.batchId,
    batchName: e.batch?.name ?? null,
    isSchoolWide: e.batchId === null,
    isExam: false,
  }));

  // Map exams to event format (type = "exam")
  const examEvents = exams.map((e) => ({
    id: `exam-${e.id}`,
    type: "exam",
    title: e.subject ? `${e.name} - ${e.subject.name}` : e.name,
    description: `${e.type.replace("_", " ")} exam`,
    startDate: e.examDate.toISOString().split("T")[0],
    endDate: null,
    isAllDay: true,
    batchId: e.batchId,
    batchName: e.batch?.name ?? null,
    isSchoolWide: false,
    isExam: true,
  }));

  // Merge and sort by date
  const allEvents = [...eventsList, ...examEvents].sort((a, b) => 
    new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );

  return {
    events: allEvents,
    month,
    year,
    children: children.map((c) => ({
      id: c.student.id,
      name: formatFullName(c.student.firstName, c.student.lastName),
      batchName: c.student.batch?.name ?? null,
    })),
  };
}

// ============================================================================
// Emergency Contact Functions
// ============================================================================

/**
 * Emergency contact interface
 */
interface EmergencyContact {
  id: string;
  name: string;
  relation: string;
  phone: string;
  isPrimary: boolean;
  notes?: string;
}

/**
 * Get child's emergency contacts
 */
export async function getChildEmergencyContacts(
  parentContext: ParentContext,
  studentId: string
): Promise<EmergencyContact[]> {
  const { parentId } = parentContext;

  // Verify parent is linked to this student
  const link = await prisma.studentParent.findUnique({
    where: {
      studentId_parentId: { studentId, parentId },
    },
  });

  if (!link) {
    throw new ForbiddenError("You do not have access to this student");
  }

  // Get student with emergency contacts
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { emergencyContacts: true },
  });

  if (!student) {
    throw new NotFoundError("Student not found");
  }

  // Parse JSON and return as array
  const contacts = student.emergencyContacts as EmergencyContact[] | null;
  return contacts || [];
}

/**
 * Update child's emergency contacts
 */
export async function updateChildEmergencyContacts(
  parentContext: ParentContext,
  studentId: string,
  contacts: EmergencyContact[]
): Promise<EmergencyContact[]> {
  const { parentId } = parentContext;

  // Verify parent is linked to this student
  const link = await prisma.studentParent.findUnique({
    where: {
      studentId_parentId: { studentId, parentId },
    },
  });

  if (!link) {
    throw new ForbiddenError("You do not have access to this student");
  }

  // Validate max 5 contacts
  if (contacts.length > 5) {
    throw new BadRequestError("Maximum 5 emergency contacts allowed");
  }

  // Ensure only one primary contact
  const primaryCount = contacts.filter((c) => c.isPrimary).length;
  if (primaryCount > 1) {
    throw new BadRequestError("Only one primary emergency contact allowed");
  }

  // Validate each contact has required fields
  for (const contact of contacts) {
    if (!contact.id || !contact.name || !contact.relation || !contact.phone) {
      throw new BadRequestError("Each contact must have id, name, relation, and phone");
    }
  }

  // Update student with new contacts
  const student = await prisma.student.update({
    where: { id: studentId },
    data: { emergencyContacts: contacts as unknown as Prisma.InputJsonValue },
    select: { emergencyContacts: true },
  });

  return student.emergencyContacts as unknown as EmergencyContact[];
}

// ============================================================================
// Homework Functions
// ============================================================================

/**
 * Get child's homework list (published only)
 */
export async function getChildHomework(
  parentContext: ParentContext,
  studentId: string,
  filters?: { status?: string }
) {
  const { parentId } = parentContext;

  // Verify parent is linked to this student
  const link = await prisma.studentParent.findUnique({
    where: {
      studentId_parentId: { studentId, parentId },
    },
  });

  if (!link) {
    throw new ForbiddenError("You do not have access to this student");
  }

  // Get student with batch info
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      batchId: true,
      batch: { select: { name: true } },
    },
  });

  if (!student || !student.batchId) {
    throw new NotFoundError("Student not found or not assigned to a batch");
  }

  // Build submission filter based on status
  let submissionStatusFilter: string[] | undefined;
  if (filters?.status) {
    if (filters.status === "pending") {
      submissionStatusFilter = ["pending"];
    } else if (filters.status === "submitted") {
      submissionStatusFilter = ["submitted", "late"];
    } else if (filters.status === "graded") {
      submissionStatusFilter = ["graded"];
    }
  }

  // Get published homework for the batch
  const homework = await prisma.homework.findMany({
    where: {
      batchId: student.batchId,
      status: { in: ["published", "closed"] },
    },
    include: {
      subject: { select: { id: true, name: true } },
      submissions: {
        where: { studentId },
        select: {
          id: true,
          status: true,
          submittedAt: true,
          marks: true,
          feedback: true,
        },
      },
    },
    orderBy: { dueDate: "desc" },
  });

  // Filter by submission status if specified
  let filteredHomework = homework;
  if (submissionStatusFilter) {
    filteredHomework = homework.filter((h) => {
      const submission = h.submissions[0];
      return submission && submissionStatusFilter!.includes(submission.status);
    });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return {
    student: {
      id: student.id,
      name: formatFullName(student.firstName, student.lastName),
      batchName: student.batch?.name ?? null,
    },
    homework: filteredHomework.map((h) => {
      const submission = h.submissions[0];
      const dueDate = new Date(h.dueDate);
      const isOverdue = h.status === "published" && dueDate < today;
      const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      return {
        id: h.id,
        title: h.title,
        description: h.description.substring(0, 200) + (h.description.length > 200 ? "..." : ""),
        subject: h.subject?.name ?? null,
        dueDate: h.dueDate.toISOString().split("T")[0],
        totalMarks: h.totalMarks,
        isOverdue,
        daysUntilDue: isOverdue ? 0 : daysUntilDue,
        isClosed: h.status === "closed",
        submission: submission
          ? {
              status: submission.status as string,
              submittedAt: submission.submittedAt?.toISOString() ?? null,
              marks: submission.marks,
              feedback: submission.feedback,
            }
          : null,
      };
    }),
    summary: {
      total: filteredHomework.length,
      pending: filteredHomework.filter((h) => h.submissions[0]?.status === "pending").length,
      submitted: filteredHomework.filter((h) =>
        ["submitted", "late"].includes(h.submissions[0]?.status || "")
      ).length,
      graded: filteredHomework.filter((h) => h.submissions[0]?.status === "graded").length,
    },
  };
}

/**
 * Get child's homework detail
 */
export async function getChildHomeworkDetail(
  parentContext: ParentContext,
  studentId: string,
  homeworkId: string
) {
  const { parentId } = parentContext;

  // Verify parent is linked to this student
  const link = await prisma.studentParent.findUnique({
    where: {
      studentId_parentId: { studentId, parentId },
    },
  });

  if (!link) {
    throw new ForbiddenError("You do not have access to this student");
  }

  // Get homework with student's submission
  const homework = await prisma.homework.findFirst({
    where: {
      id: homeworkId,
      status: { in: ["published", "closed"] },
    },
    include: {
      batch: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true } },
      createdBy: { select: { firstName: true, lastName: true } },
      submissions: {
        where: { studentId },
        include: {
          gradedBy: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  if (!homework) {
    throw new NotFoundError("Homework not found");
  }

  // Verify student is in the batch
  const student = await prisma.student.findFirst({
    where: { id: studentId, batchId: homework.batchId },
  });

  if (!student) {
    throw new ForbiddenError("Student is not in this batch");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(homework.dueDate);
  const isOverdue = homework.status === "published" && dueDate < today;
  const submission = homework.submissions[0];

  return {
    id: homework.id,
    title: homework.title,
    description: homework.description,
    attachments: homework.attachments as Array<{ name: string; url: string }> | null,
    subject: homework.subject?.name ?? null,
    batchName: homework.batch.name,
    dueDate: homework.dueDate.toISOString().split("T")[0],
    totalMarks: homework.totalMarks,
    isOverdue,
    isClosed: homework.status === "closed",
    createdBy: formatFullName(homework.createdBy.firstName, homework.createdBy.lastName),
    createdAt: homework.createdAt.toISOString(),
    submission: submission
      ? {
          id: submission.id,
          status: submission.status as string,
          submittedAt: submission.submittedAt?.toISOString() ?? null,
          attachments: submission.attachments as Array<{ name: string; url: string }> | null,
          marks: submission.marks,
          feedback: submission.feedback,
          gradedBy: submission.gradedBy
            ? formatFullName(submission.gradedBy.firstName, submission.gradedBy.lastName)
            : null,
          gradedAt: submission.gradedAt?.toISOString() ?? null,
        }
      : null,
  };
}
