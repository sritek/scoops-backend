import { prisma } from "../../config/database.js";
import type { TenantScope } from "../../types/request.js";

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
 * Get complete dashboard summary
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
