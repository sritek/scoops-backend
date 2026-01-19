/**
 * Analytics Service
 *
 * Provides cross-branch analytics and comparison data
 */

import { prisma } from "../../config/database.js";
import type { TenantScope } from "../../types/request.js";

/**
 * Get branch comparison metrics
 */
export async function getBranchComparison(orgId: string) {
  const branches = await prisma.branch.findMany({
    where: { orgId },
    include: {
      students: { where: { status: "active" } },
      users: { where: { isActive: true } },
      batches: { where: { isActive: true } },
    },
  });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const branchMetrics = await Promise.all(
    branches.map(async (branch) => {
      // Attendance rate
      const attendanceRecords = await prisma.attendanceRecord.findMany({
        where: {
          session: {
            branchId: branch.id,
            attendanceDate: { gte: thirtyDaysAgo },
          },
        },
      });
      const presentCount = attendanceRecords.filter((r) => r.status === "present").length;
      const attendanceRate = attendanceRecords.length > 0
        ? Math.round((presentCount / attendanceRecords.length) * 100)
        : 0;

      // Fee collection rate
      const fees = await prisma.studentFee.findMany({
        where: { student: { branchId: branch.id } },
        select: { totalAmount: true, paidAmount: true },
      });
      const totalFees = fees.reduce((sum, f) => sum + f.totalAmount, 0);
      const collectedFees = fees.reduce((sum, f) => sum + f.paidAmount, 0);
      const feeCollectionRate = totalFees > 0
        ? Math.round((collectedFees / totalFees) * 100)
        : 0;

      return {
        id: branch.id,
        name: branch.name,
        studentCount: branch.students.length,
        staffCount: branch.users.length,
        batchCount: branch.batches.length,
        attendanceRate,
        feeCollectionRate,
        totalFeesCollected: collectedFees,
        totalFeesPending: totalFees - collectedFees,
      };
    })
  );

  return {
    branches: branchMetrics,
    totals: {
      totalStudents: branchMetrics.reduce((sum, b) => sum + b.studentCount, 0),
      totalStaff: branchMetrics.reduce((sum, b) => sum + b.staffCount, 0),
      totalBatches: branchMetrics.reduce((sum, b) => sum + b.batchCount, 0),
      avgAttendanceRate: Math.round(
        branchMetrics.reduce((sum, b) => sum + b.attendanceRate, 0) / branchMetrics.length
      ),
      avgFeeCollectionRate: Math.round(
        branchMetrics.reduce((sum, b) => sum + b.feeCollectionRate, 0) / branchMetrics.length
      ),
      totalFeesCollected: branchMetrics.reduce((sum, b) => sum + b.totalFeesCollected, 0),
      totalFeesPending: branchMetrics.reduce((sum, b) => sum + b.totalFeesPending, 0),
    },
  };
}

/**
 * Get detailed branch performance
 */
export async function getBranchPerformance(branchId: string, scope: TenantScope) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get all data in parallel
  const [
    branch,
    students,
    batches,
    attendanceRecords,
    fees,
    complaints,
  ] = await Promise.all([
    prisma.branch.findUnique({
      where: { id: branchId },
      select: { name: true },
    }),
    prisma.student.count({
      where: { branchId, status: "active" },
    }),
    prisma.batch.findMany({
      where: { branchId, isActive: true },
      include: {
        _count: { select: { students: true } },
      },
    }),
    prisma.attendanceRecord.findMany({
      where: {
        session: {
          branchId,
          attendanceDate: { gte: thirtyDaysAgo },
        },
      },
    }),
    prisma.studentFee.findMany({
      where: { student: { branchId } },
      include: {
        payments: {
          where: { receivedAt: { gte: thirtyDaysAgo } },
        },
      },
    }),
    prisma.complaint.count({
      where: { branchId, status: "open" },
    }),
  ]);

  // Calculate attendance trend by day
  const attendanceByDate = new Map<string, { present: number; total: number }>();
  for (const record of attendanceRecords) {
    const date = record.markedAt.toISOString().split("T")[0];
    if (!attendanceByDate.has(date)) {
      attendanceByDate.set(date, { present: 0, total: 0 });
    }
    const entry = attendanceByDate.get(date)!;
    entry.total++;
    if (record.status === "present") entry.present++;
  }

  const attendanceTrend = Array.from(attendanceByDate.entries())
    .map(([date, { present, total }]) => ({
      date,
      rate: total > 0 ? Math.round((present / total) * 100) : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14); // Last 14 days

  // Fee collection by day
  const feesByDate = new Map<string, number>();
  for (const fee of fees) {
    for (const payment of fee.payments) {
      const date = payment.receivedAt.toISOString().split("T")[0];
      feesByDate.set(date, (feesByDate.get(date) || 0) + payment.amount);
    }
  }

  const feeTrend = Array.from(feesByDate.entries())
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14);

  const totalFees = fees.reduce((sum, f) => sum + f.totalAmount, 0);
  const collectedFees = fees.reduce((sum, f) => sum + f.paidAmount, 0);

  return {
    branchName: branch?.name || "Unknown",
    metrics: {
      totalStudents: students,
      totalBatches: batches.length,
      avgBatchSize: Math.round(students / (batches.length || 1)),
      attendanceRate: attendanceRecords.length > 0
        ? Math.round(
            (attendanceRecords.filter((r) => r.status === "present").length /
              attendanceRecords.length) *
              100
          )
        : 0,
      feeCollectionRate: totalFees > 0
        ? Math.round((collectedFees / totalFees) * 100)
        : 0,
      openComplaints: complaints,
    },
    batches: batches.map((b) => ({
      id: b.id,
      name: b.name,
      studentCount: b._count.students,
    })),
    trends: {
      attendance: attendanceTrend,
      feeCollection: feeTrend,
    },
  };
}

/**
 * Get organization-wide statistics
 */
export async function getOrgStats(orgId: string) {
  const [studentCount, branchCount, staffCount, activeFeesCount] = await Promise.all([
    prisma.student.count({ where: { orgId, status: "active" } }),
    prisma.branch.count({ where: { orgId } }),
    prisma.user.count({ where: { orgId, isActive: true } }),
    prisma.studentFee.count({ where: { student: { orgId }, status: { in: ["pending", "partial"] } } }),
  ]);

  // This month's collection
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const monthlyPayments = await prisma.feePayment.aggregate({
    where: {
      receivedAt: { gte: startOfMonth },
      studentFee: { student: { orgId } },
    },
    _sum: { amount: true },
  });

  return {
    totalStudents: studentCount,
    totalBranches: branchCount,
    totalStaff: staffCount,
    pendingFees: activeFeesCount,
    monthlyCollection: monthlyPayments._sum.amount || 0,
  };
}
