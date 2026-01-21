import { prisma } from "../../config/database.js";
import type { TenantScope } from "../../types/request.js";
import type { Role } from "../../types/auth.js";
import { ROLES } from "../../config/permissions";

/**
 * Get today's attendance summary
 */
export async function getAttendanceSummary(scope: TenantScope) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Get all sessions for today
  const sessions = await prisma.attendanceSession.findMany({
    where: {
      orgId: scope.orgId,
      branchId: scope.branchId,
      attendanceDate: {
        gte: today,
        lt: tomorrow,
      },
    },
    include: {
      records: true,
      batch: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  // Calculate totals
  let totalPresent = 0;
  let totalAbsent = 0;
  const batchSummaries: Array<{
    batchId: string;
    batchName: string;
    present: number;
    absent: number;
    total: number;
  }> = [];

  for (const session of sessions) {
    const present = session.records.filter((r) => r.status === "present").length;
    const absent = session.records.filter((r) => r.status === "absent").length;

    totalPresent += present;
    totalAbsent += absent;

    batchSummaries.push({
      batchId: session.batch.id,
      batchName: session.batch.name,
      present,
      absent,
      total: present + absent,
    });
  }

  // Get total active students for comparison
  const totalActiveStudents = await prisma.student.count({
    where: {
      orgId: scope.orgId,
      branchId: scope.branchId,
      status: "active",
    },
  });

  // Get batches without attendance today
  const batchesWithAttendance = sessions.map((s) => s.batchId);
  const batchesWithoutAttendance = await prisma.batch.findMany({
    where: {
      orgId: scope.orgId,
      branchId: scope.branchId,
      isActive: true,
      id: {
        notIn: batchesWithAttendance,
      },
    },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          students: true,
        },
      },
    },
  });

  return {
    date: today.toISOString().split("T")[0],
    totalPresent,
    totalAbsent,
    totalMarked: totalPresent + totalAbsent,
    totalActiveStudents,
    batchesMarked: sessions.length,
    batchesPending: batchesWithoutAttendance.length,
    batchSummaries,
    pendingBatches: batchesWithoutAttendance.map((b) => ({
      batchId: b.id,
      batchName: b.name,
      studentCount: b._count.students,
    })),
  };
}

/**
 * Get pending fees summary
 */
export async function getPendingFeesSummary(scope: TenantScope) {
  // Get all pending/partial fees
  const pendingFees = await prisma.studentFee.findMany({
    where: {
      student: {
        orgId: scope.orgId,
        branchId: scope.branchId,
        status: "active",
      },
      status: {
        in: ["pending", "partial"],
      },
    },
    select: {
      totalAmount: true,
      paidAmount: true,
      status: true,
      dueDate: true,
    },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let totalPendingAmount = 0;
  let overdueCount = 0;
  let overdueAmount = 0;

  for (const fee of pendingFees) {
    const pending = fee.totalAmount - fee.paidAmount;
    totalPendingAmount += pending;

    if (fee.dueDate < today) {
      overdueCount++;
      overdueAmount += pending;
    }
  }

  return {
    totalCount: pendingFees.length,
    totalPendingAmount,
    overdueCount,
    overdueAmount,
    partialCount: pendingFees.filter((f) => f.status === "partial").length,
    pendingCount: pendingFees.filter((f) => f.status === "pending").length,
  };
}

/**
 * Get fees collected today
 */
export async function getFeesCollectedToday(scope: TenantScope) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Get all payments received today
  const payments = await prisma.feePayment.findMany({
    where: {
      studentFee: {
        student: {
          orgId: scope.orgId,
          branchId: scope.branchId,
        },
      },
      receivedAt: {
        gte: today,
        lt: tomorrow,
      },
    },
    select: {
      amount: true,
      paymentMode: true,
    },
  });

  // Calculate totals by payment mode
  const byMode: Record<string, { count: number; amount: number }> = {
    cash: { count: 0, amount: 0 },
    upi: { count: 0, amount: 0 },
    bank: { count: 0, amount: 0 },
  };

  let totalAmount = 0;

  for (const payment of payments) {
    totalAmount += payment.amount;
    if (byMode[payment.paymentMode]) {
      byMode[payment.paymentMode].count++;
      byMode[payment.paymentMode].amount += payment.amount;
    }
  }

  return {
    date: today.toISOString().split("T")[0],
    totalCount: payments.length,
    totalAmount,
    byMode,
  };
}

/**
 * Get attendance summary for a specific batch (for teacher dashboard)
 */
export async function getTeacherAttendanceSummary(
  userId: string,
  scope: TenantScope
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Find the batch where user is class teacher
  const teacherBatch = await prisma.batch.findFirst({
    where: {
      classTeacherId: userId,
      orgId: scope.orgId,
      branchId: scope.branchId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          students: true,
        },
      },
    },
  });

  if (!teacherBatch) {
    return {
      date: today.toISOString().split("T")[0],
      totalPresent: 0,
      totalAbsent: 0,
      totalMarked: 0,
      totalActiveStudents: 0,
      batchesMarked: 0,
      batchesPending: 0,
      batchSummaries: [],
      pendingBatches: [],
      teacherBatch: null,
    };
  }

  // Get attendance session for teacher's batch today
  const session = await prisma.attendanceSession.findFirst({
    where: {
      batchId: teacherBatch.id,
      orgId: scope.orgId,
      branchId: scope.branchId,
      attendanceDate: {
        gte: today,
        lt: tomorrow,
      },
    },
    include: {
      records: true,
    },
  });

  const present = session?.records.filter((r) => r.status === "present").length ?? 0;
  const absent = session?.records.filter((r) => r.status === "absent").length ?? 0;

  const batchSummary = session
    ? [
        {
          batchId: teacherBatch.id,
          batchName: teacherBatch.name,
          present,
          absent,
          total: present + absent,
        },
      ]
    : [];

  const pendingBatches = !session
    ? [
        {
          batchId: teacherBatch.id,
          batchName: teacherBatch.name,
          studentCount: teacherBatch._count.students,
        },
      ]
    : [];

  return {
    date: today.toISOString().split("T")[0],
    totalPresent: present,
    totalAbsent: absent,
    totalMarked: present + absent,
    totalActiveStudents: teacherBatch._count.students,
    batchesMarked: session ? 1 : 0,
    batchesPending: session ? 0 : 1,
    batchSummaries: batchSummary,
    pendingBatches,
    teacherBatch: {
      id: teacherBatch.id,
      name: teacherBatch.name,
    },
  };
}

/**
 * Get pending fees summary for teacher's batch only
 */
export async function getTeacherPendingFeesSummary(
  userId: string,
  scope: TenantScope
) {
  // Find the batch where user is class teacher
  const teacherBatch = await prisma.batch.findFirst({
    where: {
      classTeacherId: userId,
      orgId: scope.orgId,
      branchId: scope.branchId,
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  if (!teacherBatch) {
    return {
      totalCount: 0,
      totalPendingAmount: 0,
      overdueCount: 0,
      overdueAmount: 0,
      partialCount: 0,
      pendingCount: 0,
    };
  }

  // Get pending fees for students in teacher's batch
  const pendingFees = await prisma.studentFee.findMany({
    where: {
      student: {
        orgId: scope.orgId,
        branchId: scope.branchId,
        batchId: teacherBatch.id,
        status: "active",
      },
      status: {
        in: ["pending", "partial"],
      },
    },
    select: {
      totalAmount: true,
      paidAmount: true,
      status: true,
      dueDate: true,
    },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let totalPendingAmount = 0;
  let overdueCount = 0;
  let overdueAmount = 0;

  for (const fee of pendingFees) {
    const pending = fee.totalAmount - fee.paidAmount;
    totalPendingAmount += pending;

    if (fee.dueDate < today) {
      overdueCount++;
      overdueAmount += pending;
    }
  }

  return {
    totalCount: pendingFees.length,
    totalPendingAmount,
    overdueCount,
    overdueAmount,
    partialCount: pendingFees.filter((f) => f.status === "partial").length,
    pendingCount: pendingFees.filter((f) => f.status === "pending").length,
  };
}

/**
 * Get dashboard for teacher role
 * Shows only their batch attendance and fees
 */
export async function getTeacherDashboard(userId: string, scope: TenantScope) {
  const [attendance, pendingFees] = await Promise.all([
    getTeacherAttendanceSummary(userId, scope),
    getTeacherPendingFeesSummary(userId, scope),
  ]);

  return {
    attendance,
    pendingFees,
    // No feesCollected for teachers (they can't collect fees)
    feesCollected: null,
  };
}

/**
 * Get dashboard for accounts role
 * Shows only fees data (no attendance)
 */
export async function getAccountsDashboard(scope: TenantScope) {
  const [pendingFees, feesCollected] = await Promise.all([
    getPendingFeesSummary(scope),
    getFeesCollectedToday(scope),
  ]);

  return {
    // No attendance for accounts role
    attendance: null,
    pendingFees,
    feesCollected,
  };
}

/**
 * Get complete dashboard summary
 * @deprecated Use getRoleDashboardSummary instead for role-specific data
 */
export async function getDashboardSummary(scope: TenantScope) {
  const [attendance, pendingFees, feesCollected] = await Promise.all([
    getAttendanceSummary(scope),
    getPendingFeesSummary(scope),
    getFeesCollectedToday(scope),
  ]);

  return {
    attendance,
    pendingFees,
    feesCollected,
  };
}

/**
 * Get role-specific dashboard summary
 * - Admin/Staff: Full dashboard (attendance + fees)
 * - Teacher: Own batch attendance + own batch fees (read-only)
 * - Accounts: Fees only (no attendance)
 */
export async function getRoleDashboardSummary(
  role: Role,
  userId: string,
  scope: TenantScope
) {
  switch (role) {
    case ROLES.TEACHER:
      return getTeacherDashboard(userId, scope);
    case ROLES.ACCOUNTS:
      return getAccountsDashboard(scope);
    case ROLES.ADMIN:
    case ROLES.STAFF:
    default:
      return getDashboardSummary(scope);
  }
}

// =====================
// Enhanced Dashboard Functions (Phase 2A)
// =====================

/**
 * Action item for dashboard
 */
interface ActionItem {
  type: "attendance_pending" | "fees_overdue" | "birthday" | "staff_unmarked";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  actionUrl?: string;
  count?: number;
}

/**
 * Get action items for admin dashboard
 */
export async function getAdminActionItems(scope: TenantScope): Promise<ActionItem[]> {
  const actionItems: ActionItem[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check for pending attendance
  const batchesWithoutAttendance = await prisma.batch.count({
    where: {
      orgId: scope.orgId,
      branchId: scope.branchId,
      isActive: true,
      attendanceSessions: {
        none: {
          attendanceDate: {
            gte: today,
            lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
          },
        },
      },
    },
  });

  if (batchesWithoutAttendance > 0) {
    actionItems.push({
      type: "attendance_pending",
      priority: "high",
      title: "Attendance Pending",
      description: `${batchesWithoutAttendance} batch(es) haven't marked attendance today`,
      actionUrl: "/attendance",
      count: batchesWithoutAttendance,
    });
  }

  // Check for overdue fees
  const overdueFeesCount = await prisma.studentFee.count({
    where: {
      student: {
        orgId: scope.orgId,
        branchId: scope.branchId,
        status: "active",
      },
      status: { in: ["pending", "partial"] },
      dueDate: { lt: today },
    },
  });

  if (overdueFeesCount > 0) {
    actionItems.push({
      type: "fees_overdue",
      priority: "high",
      title: "Overdue Fees",
      description: `${overdueFeesCount} student(s) have overdue fees`,
      actionUrl: "/fees?status=overdue",
      count: overdueFeesCount,
    });
  }

  // Check for staff not marked attendance
  const staffUnmarked = await prisma.user.count({
    where: {
      orgId: scope.orgId,
      branchId: scope.branchId,
      isActive: true,
      staffAttendance: {
        none: {
          date: today,
        },
      },
    },
  });

  if (staffUnmarked > 0) {
    actionItems.push({
      type: "staff_unmarked",
      priority: "medium",
      title: "Staff Attendance Pending",
      description: `${staffUnmarked} staff member(s) haven't checked in`,
      actionUrl: "/staff/attendance",
      count: staffUnmarked,
    });
  }

  // Check for today's birthdays
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();
  
  const birthdaysToday = await prisma.student.count({
    where: {
      orgId: scope.orgId,
      branchId: scope.branchId,
      status: "active",
      dob: {
        not: null,
      },
      AND: [
        {
          dob: {
            gte: new Date(`2000-${String(todayMonth).padStart(2, "0")}-${String(todayDay).padStart(2, "0")}`),
            lt: new Date(`2000-${String(todayMonth).padStart(2, "0")}-${String(todayDay + 1).padStart(2, "0")}`),
          },
        },
      ],
    },
  });

  if (birthdaysToday > 0) {
    actionItems.push({
      type: "birthday",
      priority: "low",
      title: "Birthdays Today",
      description: `${birthdaysToday} student(s) have birthdays today!`,
      count: birthdaysToday,
    });
  }

  return actionItems;
}

/**
 * Get attendance trend for last 7 days
 */
export async function getAttendanceTrend(scope: TenantScope, days: number = 7) {
  const trends: Array<{ date: string; present: number; absent: number; percentage: number }> = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const records = await prisma.attendanceRecord.groupBy({
      by: ["status"],
      where: {
        session: {
          orgId: scope.orgId,
          branchId: scope.branchId,
          attendanceDate: {
            gte: date,
            lt: nextDate,
          },
        },
      },
      _count: true,
    });

    const present = records.find((r) => r.status === "present")?._count ?? 0;
    const absent = records.find((r) => r.status === "absent")?._count ?? 0;
    const total = present + absent;
    const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

    trends.push({
      date: date.toISOString().split("T")[0],
      present,
      absent,
      percentage,
    });
  }

  return trends;
}

/**
 * Get fee collection trend for last 7 days
 */
export async function getFeeCollectionTrend(scope: TenantScope, days: number = 7) {
  const trends: Array<{ date: string; amount: number; count: number }> = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const payments = await prisma.feePayment.aggregate({
      where: {
        studentFee: {
          student: {
            orgId: scope.orgId,
            branchId: scope.branchId,
          },
        },
        receivedAt: {
          gte: date,
          lt: nextDate,
        },
      },
      _sum: {
        amount: true,
      },
      _count: true,
    });

    trends.push({
      date: date.toISOString().split("T")[0],
      amount: payments._sum.amount ?? 0,
      count: payments._count,
    });
  }

  return trends;
}

/**
 * Get upcoming birthdays
 */
export async function getUpcomingBirthdays(scope: TenantScope, days: number = 7) {
  const today = new Date();
  const birthdayStudents: Array<{
    id: string;
    name: string;
    date: string;
    batchName: string | null;
    daysUntil: number;
  }> = [];

  // Check each day for birthdays
  for (let i = 0; i < days; i++) {
    const checkDate = new Date();
    checkDate.setDate(checkDate.getDate() + i);
    const month = checkDate.getMonth() + 1;
    const day = checkDate.getDate();

    const students = await prisma.student.findMany({
      where: {
        orgId: scope.orgId,
        branchId: scope.branchId,
        status: "active",
        dob: {
          not: null,
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dob: true,
        batch: {
          select: {
            name: true,
          },
        },
      },
    });

    // Filter students with matching birthday
    for (const student of students) {
      if (student.dob) {
        const dobMonth = student.dob.getMonth() + 1;
        const dobDay = student.dob.getDate();
        
        if (dobMonth === month && dobDay === day) {
          birthdayStudents.push({
            id: student.id,
            name: `${student.firstName} ${student.lastName}`,
            date: `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
            batchName: student.batch?.name ?? null,
            daysUntil: i,
          });
        }
      }
    }
  }

  return birthdayStudents;
}

/**
 * Get staff attendance summary for today
 */
export async function getStaffAttendanceSummary(scope: TenantScope) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalStaff = await prisma.user.count({
    where: {
      orgId: scope.orgId,
      branchId: scope.branchId,
      isActive: true,
    },
  });

  const attendance = await prisma.staffAttendance.groupBy({
    by: ["status"],
    where: {
      orgId: scope.orgId,
      branchId: scope.branchId,
      date: today,
    },
    _count: true,
  });

  let present = 0;
  let absent = 0;
  let halfDay = 0;
  let leave = 0;

  for (const record of attendance) {
    switch (record.status) {
      case "present":
        present = record._count;
        break;
      case "absent":
        absent = record._count;
        break;
      case "half_day":
        halfDay = record._count;
        break;
      case "leave":
        leave = record._count;
        break;
    }
  }

  const marked = present + absent + halfDay + leave;

  return {
    totalStaff,
    present,
    absent,
    halfDay,
    leave,
    notMarked: totalStaff - marked,
  };
}

/**
 * Get enhanced admin dashboard
 */
export async function getEnhancedAdminDashboard(scope: TenantScope) {
  const [
    attendance,
    pendingFees,
    feesCollected,
    actionItems,
    attendanceTrend,
    feeCollectionTrend,
    upcomingBirthdays,
    staffAttendance,
  ] = await Promise.all([
    getAttendanceSummary(scope),
    getPendingFeesSummary(scope),
    getFeesCollectedToday(scope),
    getAdminActionItems(scope),
    getAttendanceTrend(scope, 7),
    getFeeCollectionTrend(scope, 7),
    getUpcomingBirthdays(scope, 7),
    getStaffAttendanceSummary(scope),
  ]);

  return {
    attendance,
    pendingFees,
    feesCollected,
    actionItems,
    trends: {
      attendance: attendanceTrend,
      feeCollection: feeCollectionTrend,
    },
    upcomingBirthdays,
    staffAttendance,
  };
}

/**
 * Get enhanced teacher dashboard
 */
export async function getEnhancedTeacherDashboard(userId: string, scope: TenantScope) {
  const [teacherDashboard, upcomingBirthdays] = await Promise.all([
    getTeacherDashboard(userId, scope),
    getUpcomingBirthdays(scope, 7),
  ]);

  // Get teacher's batch for filtering birthdays
  const teacherBatch = await prisma.batch.findFirst({
    where: {
      classTeacherId: userId,
      orgId: scope.orgId,
      branchId: scope.branchId,
      isActive: true,
    },
    select: { id: true, name: true },
  });

  // Filter birthdays to only show teacher's batch students
  const batchBirthdays = teacherBatch
    ? upcomingBirthdays.filter((b) => b.batchName === teacherBatch.name)
    : [];

  // Action items for teacher
  const actionItems: ActionItem[] = [];

  if (teacherDashboard.attendance.batchesPending > 0) {
    actionItems.push({
      type: "attendance_pending",
      priority: "high",
      title: "Attendance Pending",
      description: "You haven't marked attendance for your batch today",
      actionUrl: "/attendance",
    });
  }

  if (batchBirthdays.length > 0) {
    const todayBirthdays = batchBirthdays.filter((b) => b.daysUntil === 0);
    if (todayBirthdays.length > 0) {
      actionItems.push({
        type: "birthday",
        priority: "low",
        title: "Birthdays Today",
        description: `${todayBirthdays.length} student(s) in your batch have birthdays today!`,
        count: todayBirthdays.length,
      });
    }
  }

  return {
    ...teacherDashboard,
    actionItems,
    upcomingBirthdays: batchBirthdays,
    teacherBatch,
  };
}

/**
 * Get enhanced accounts dashboard
 */
export async function getEnhancedAccountsDashboard(scope: TenantScope) {
  const [accountsDashboard, feeCollectionTrend, actionItems] = await Promise.all([
    getAccountsDashboard(scope),
    getFeeCollectionTrend(scope, 7),
    getAdminActionItems(scope), // Reuse but filter
  ]);

  // Filter action items to only fee-related ones
  const feeActionItems = actionItems.filter(
    (item) => item.type === "fees_overdue"
  );

  return {
    ...accountsDashboard,
    actionItems: feeActionItems,
    trends: {
      feeCollection: feeCollectionTrend,
    },
  };
}

/**
 * Get enhanced role-specific dashboard
 */
export async function getEnhancedDashboard(
  role: Role,
  userId: string,
  scope: TenantScope
) {
  switch (role) {
    case ROLES.TEACHER:
      return getEnhancedTeacherDashboard(userId, scope);
    case ROLES.ACCOUNTS:
      return getEnhancedAccountsDashboard(scope);
    case ROLES.ADMIN:
    case ROLES.STAFF:
    default:
      return getEnhancedAdminDashboard(scope);
  }
}
