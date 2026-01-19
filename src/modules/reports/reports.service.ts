/**
 * Reports Service
 *
 * Handles report generation, tracking, and retrieval
 */

import { prisma } from "../../config/database.js";
import type { TenantScope } from "../../types/request.js";
import { NotFoundError, BadRequestError } from "../../utils/error-handler.js";
import {
  type PaginationParams,
  createPaginatedResponse,
  calculateSkip,
} from "../../utils/pagination.js";
import type { ReportType, ReportFormat } from "@prisma/client";
import { generateAttendanceReport } from "./generators/attendance.generator.js";
import { generateFeesReport } from "./generators/fees.generator.js";
import { generatePerformanceReport } from "./generators/performance.generator.js";

/**
 * Report request input
 */
export interface RequestReportInput {
  type: ReportType;
  format: ReportFormat;
  parameters: {
    startDate?: string;
    endDate?: string;
    batchId?: string;
    month?: number;
    year?: number;
  };
}

/**
 * Report filters
 */
export interface ReportFilters {
  type?: ReportType;
  status?: string;
}

/**
 * Request a new report generation
 */
export async function requestReport(
  input: RequestReportInput,
  userId: string,
  scope: TenantScope
) {
  // Create report generation record
  const report = await prisma.reportGeneration.create({
    data: {
      orgId: scope.orgId,
      branchId: scope.branchId || null,
      type: input.type,
      format: input.format,
      parameters: input.parameters,
      status: "pending",
      requestedById: userId,
    },
  });

  // Start async generation (fire and forget)
  generateReportAsync(report.id, scope);

  return report;
}

/**
 * Get all reports for a branch
 */
export async function getReports(
  scope: TenantScope,
  pagination: PaginationParams,
  filters?: ReportFilters
) {
  const where: any = {
    orgId: scope.orgId,
  };

  // Only filter by branch if provided
  if (scope.branchId) {
    where.OR = [{ branchId: scope.branchId }, { branchId: null }];
  }

  if (filters?.type) {
    where.type = filters.type;
  }

  if (filters?.status) {
    where.status = filters.status;
  }

  const [reports, total] = await Promise.all([
    prisma.reportGeneration.findMany({
      where,
      include: {
        requestedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: calculateSkip(pagination),
      take: pagination.limit,
    }),
    prisma.reportGeneration.count({ where }),
  ]);

  return createPaginatedResponse(
    reports.map((r) => ({
      id: r.id,
      type: r.type,
      format: r.format,
      parameters: r.parameters,
      status: r.status,
      filePath: r.filePath,
      createdAt: r.createdAt,
      completedAt: r.completedAt,
      requestedBy: `${r.requestedBy.firstName} ${r.requestedBy.lastName}`,
    })),
    total,
    pagination
  );
}

/**
 * Get report by ID
 */
export async function getReportById(id: string, scope: TenantScope) {
  const report = await prisma.reportGeneration.findFirst({
    where: {
      id,
      orgId: scope.orgId,
    },
    include: {
      requestedBy: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!report) {
    throw new NotFoundError("Report");
  }

  return {
    ...report,
    requestedBy: `${report.requestedBy.firstName} ${report.requestedBy.lastName}`,
  };
}

/**
 * Delete a report
 */
export async function deleteReport(id: string, scope: TenantScope) {
  const report = await prisma.reportGeneration.findFirst({
    where: {
      id,
      orgId: scope.orgId,
    },
  });

  if (!report) {
    throw new NotFoundError("Report");
  }

  // TODO: Delete file from storage if exists
  // if (report.filePath) {
  //   await deleteFile(report.filePath);
  // }

  await prisma.reportGeneration.delete({
    where: { id },
  });
}

/**
 * Async report generation
 */
async function generateReportAsync(reportId: string, scope: TenantScope) {
  try {
    // Update status to generating
    await prisma.reportGeneration.update({
      where: { id: reportId },
      data: { status: "generating" },
    });

    // Get report details
    const report = await prisma.reportGeneration.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new Error("Report not found");
    }

    const params = report.parameters as Record<string, unknown>;
    let filePath: string;

    // Generate based on type
    switch (report.type) {
      case "attendance_monthly":
      case "attendance_batch":
        filePath = await generateAttendanceReport(
          report.type,
          report.format,
          {
            orgId: report.orgId,
            branchId: report.branchId || undefined,
          },
          params
        );
        break;

      case "fee_collection":
      case "fee_defaulters":
        filePath = await generateFeesReport(
          report.type,
          report.format,
          {
            orgId: report.orgId,
            branchId: report.branchId || undefined,
          },
          params
        );
        break;

      case "student_performance":
      case "branch_summary":
        filePath = await generatePerformanceReport(
          report.type,
          report.format,
          {
            orgId: report.orgId,
            branchId: report.branchId || undefined,
          },
          params
        );
        break;

      default:
        throw new BadRequestError(`Unknown report type: ${report.type}`);
    }

    // Update report with file path
    await prisma.reportGeneration.update({
      where: { id: reportId },
      data: {
        status: "completed",
        filePath,
        completedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("Report generation failed:", error);
    
    // Update status to failed
    await prisma.reportGeneration.update({
      where: { id: reportId },
      data: {
        status: "failed",
        completedAt: new Date(),
      },
    });
  }
}

/**
 * Get report types metadata
 */
export function getReportTypes() {
  return [
    {
      type: "attendance_monthly",
      name: "Monthly Attendance Report",
      description: "Student attendance summary for a specific month",
      parameters: ["month", "year"],
    },
    {
      type: "attendance_batch",
      name: "Batch Attendance Report",
      description: "Detailed attendance for a specific batch",
      parameters: ["batchId", "startDate", "endDate"],
    },
    {
      type: "fee_collection",
      name: "Fee Collection Report",
      description: "Summary of fees collected in a period",
      parameters: ["startDate", "endDate"],
    },
    {
      type: "fee_defaulters",
      name: "Fee Defaulters Report",
      description: "List of students with overdue fees",
      parameters: [],
    },
    {
      type: "student_performance",
      name: "Student Performance Report",
      description: "Academic performance summary",
      parameters: ["batchId"],
    },
    {
      type: "branch_summary",
      name: "Branch Summary Report",
      description: "Overall branch metrics and statistics",
      parameters: [],
    },
  ];
}
