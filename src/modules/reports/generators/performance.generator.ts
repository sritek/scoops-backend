/**
 * Performance Report Generator
 *
 * Generates student performance and branch summary reports
 */

import { prisma } from "../../../config/database.js";
import type { ReportFormat } from "@prisma/client";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";

// Create reports directory if it doesn't exist
const reportsDir = path.join(process.cwd(), "reports");
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

interface ReportScope {
  orgId: string;
  branchId?: string;
}

interface PerformanceReportParams {
  batchId?: string;
}

/**
 * Generate performance report
 */
export async function generatePerformanceReport(
  type: "student_performance" | "branch_summary",
  format: ReportFormat,
  scope: ReportScope,
  params: PerformanceReportParams,
): Promise<string> {
  const data =
    type === "student_performance"
      ? await getStudentPerformanceData(scope, params)
      : await getBranchSummaryData(scope);

  const filename = `${type}_${Date.now()}.${format === "pdf" ? "pdf" : "xlsx"}`;
  const filePath = path.join(reportsDir, filename);

  if (type === "student_performance") {
    if (format === "pdf") {
      await generateStudentPerformancePDF(
        data as StudentPerformanceData,
        filePath,
      );
    } else {
      await generateStudentPerformanceExcel(
        data as StudentPerformanceData,
        filePath,
      );
    }
  } else {
    if (format === "pdf") {
      await generateBranchSummaryPDF(data as BranchSummaryData, filePath);
    } else {
      await generateBranchSummaryExcel(data as BranchSummaryData, filePath);
    }
  }

  return filePath;
}

interface StudentPerformanceData {
  batchName: string | null;
  students: {
    name: string;
    attendancePercentage: number;
    examAverage: number | null;
    feeStatus: string;
    pendingFees: number;
  }[];
}

interface BranchSummaryData {
  branchName: string | null;
  totalStudents: number;
  activeStudents: number;
  totalBatches: number;
  totalStaff: number;
  attendanceRate: number;
  feeCollectionRate: number;
  totalFeesCollected: number;
  totalFeesPending: number;
  batchWiseSummary: {
    batchName: string;
    studentCount: number;
    attendanceRate: number;
    feeCollectionRate: number;
  }[];
}

/**
 * Get student performance data
 */
async function getStudentPerformanceData(
  scope: ReportScope,
  params: PerformanceReportParams,
): Promise<StudentPerformanceData> {
  const where: any = {
    orgId: scope.orgId,
    status: "active",
  };

  if (scope.branchId) {
    where.branchId = scope.branchId;
  }

  if (params.batchId) {
    where.batchId = params.batchId;
  }

  // Get batch name if specific batch
  let batchName: string | null = null;
  if (params.batchId) {
    const batch = await prisma.batch.findUnique({
      where: { id: params.batchId },
      select: { name: true },
    });
    batchName = batch?.name || null;
  }

  const students = await prisma.student.findMany({
    where,
    include: {
      attendanceRecords: {
        orderBy: { markedAt: "desc" },
        take: 30, // Last 30 attendance records
      },
      feeStructures: {
        include: {
          installments: true,
        },
      },
      // examScores: {
      //   include: {
      //     exam: true,
      //   },
      //   orderBy: { gradedAt: "desc" },
      //   take: 10,
      // },
    },
  });

  const result: StudentPerformanceData["students"] = students.map((student) => {
    // Calculate attendance percentage
    const totalAttendance = student.attendanceRecords.length;
    const presentCount = student.attendanceRecords.filter(
      (r) => r.status === "present",
    ).length;
    const attendancePercentage =
      totalAttendance > 0
        ? Math.round((presentCount / totalAttendance) * 100)
        : 0;

    // Calculate fee status from StudentFeeStructure and FeeInstallment
    let totalFees = 0;
    let paidFees = 0;
    for (const structure of student.feeStructures) {
      totalFees += structure.netAmount;
      for (const installment of structure.installments) {
        paidFees += installment.paidAmount;
      }
    }
    const pendingFees = totalFees - paidFees;
    const feeStatus =
      pendingFees === 0
        ? "Paid"
        : pendingFees === totalFees
          ? "Pending"
          : "Partial";

    // Note: Exam scores would require the Exam model to be populated
    // For now, we'll show N/A
    const examAverage: number | null = null;

    return {
      name: `${student.firstName} ${student.lastName}`,
      attendancePercentage,
      examAverage,
      feeStatus,
      pendingFees,
    };
  });

  return {
    batchName,
    students: result.sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/**
 * Get branch summary data
 */
async function getBranchSummaryData(
  scope: ReportScope,
): Promise<BranchSummaryData> {
  const where: any = { orgId: scope.orgId };
  if (scope.branchId) {
    where.branchId = scope.branchId;
  }

  // Get branch name
  let branchName: string | null = null;
  if (scope.branchId) {
    const branch = await prisma.branch.findUnique({
      where: { id: scope.branchId },
      select: { name: true },
    });
    branchName = branch?.name || null;
  }

  // Get counts
  const [totalStudents, activeStudents, totalBatches, totalStaff] =
    await Promise.all([
      prisma.student.count({ where }),
      prisma.student.count({ where: { ...where, status: "active" } }),
      prisma.batch.count({ where }),
      prisma.user.count({ where }),
    ]);

  // Get attendance for last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const attendanceRecords = await prisma.attendanceRecord.findMany({
    where: {
      session: scope.branchId
        ? {
            branchId: scope.branchId,
            attendanceDate: { gte: thirtyDaysAgo },
          }
        : {
            attendanceDate: { gte: thirtyDaysAgo },
          },
    },
  });

  const presentCount = attendanceRecords.filter(
    (r) => r.status === "present",
  ).length;
  const attendanceRate =
    attendanceRecords.length > 0
      ? Math.round((presentCount / attendanceRecords.length) * 100)
      : 0;

  // Get fee data from StudentFeeStructure and FeeInstallment
  const feeStructures = await prisma.studentFeeStructure.findMany({
    where: {
      student: where,
    },
    include: {
      installments: {
        select: {
          amount: true,
          paidAmount: true,
        },
      },
    },
  });

  let totalFeesExpected = 0;
  let totalFeesCollected = 0;
  for (const structure of feeStructures) {
    totalFeesExpected += structure.netAmount;
    for (const installment of structure.installments) {
      totalFeesCollected += installment.paidAmount;
    }
  }
  const totalFeesPending = totalFeesExpected - totalFeesCollected;
  const feeCollectionRate =
    totalFeesExpected > 0
      ? Math.round((totalFeesCollected / totalFeesExpected) * 100)
      : 0;

  // Batch-wise summary
  const batches = await prisma.batch.findMany({
    where,
    select: {
      id: true,
      name: true,
      _count: {
        select: { students: true },
      },
    },
  });

  const batchWiseSummary = await Promise.all(
    batches.map(async (batch) => {
      // Get attendance for this batch
      const batchAttendance = await prisma.attendanceRecord.findMany({
        where: {
          session: {
            batchId: batch.id,
            attendanceDate: { gte: thirtyDaysAgo },
          },
        },
      });

      const batchPresent = batchAttendance.filter(
        (r) => r.status === "present",
      ).length;
      const batchAttendanceRate =
        batchAttendance.length > 0
          ? Math.round((batchPresent / batchAttendance.length) * 100)
          : 0;

      // Get fees for this batch from StudentFeeStructure and FeeInstallment
      const batchFeeStructures = await prisma.studentFeeStructure.findMany({
        where: {
          student: {
            batchId: batch.id,
          },
        },
        include: {
          installments: {
            select: {
              amount: true,
              paidAmount: true,
            },
          },
        },
      });

      let batchTotalFees = 0;
      let batchCollected = 0;
      for (const structure of batchFeeStructures) {
        batchTotalFees += structure.netAmount;
        for (const installment of structure.installments) {
          batchCollected += installment.paidAmount;
        }
      }
      const batchFeeRate =
        batchTotalFees > 0
          ? Math.round((batchCollected / batchTotalFees) * 100)
          : 0;

      return {
        batchName: batch.name,
        studentCount: batch._count.students,
        attendanceRate: batchAttendanceRate,
        feeCollectionRate: batchFeeRate,
      };
    }),
  );

  return {
    branchName,
    totalStudents,
    activeStudents,
    totalBatches,
    totalStaff,
    attendanceRate,
    feeCollectionRate,
    totalFeesCollected,
    totalFeesPending,
    batchWiseSummary,
  };
}

/**
 * Generate student performance PDF
 */
async function generateStudentPerformancePDF(
  data: StudentPerformanceData,
  filePath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    doc.fontSize(20).text("Student Performance Report", { align: "center" });
    if (data.batchName) {
      doc.fontSize(14).text(`Batch: ${data.batchName}`, { align: "center" });
    }
    doc.moveDown();

    const cols = [50, 180, 280, 350, 420, 480];
    const tableTop = doc.y;

    doc.font("Helvetica-Bold").fontSize(10);
    doc.text("Student", cols[0], tableTop);
    doc.text("Attendance", cols[1], tableTop);
    doc.text("Exam Avg", cols[2], tableTop);
    doc.text("Fee Status", cols[3], tableTop);
    doc.text("Pending", cols[4], tableTop);

    doc
      .moveTo(50, tableTop + 15)
      .lineTo(550, tableTop + 15)
      .stroke();

    doc.font("Helvetica");
    let y = tableTop + 25;

    for (const student of data.students) {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }

      doc.text(student.name.substring(0, 20), cols[0], y);
      doc.text(`${student.attendancePercentage}%`, cols[1], y);
      doc.text(
        student.examAverage !== null ? `${student.examAverage}%` : "N/A",
        cols[2],
        y,
      );
      doc.text(student.feeStatus, cols[3], y);
      doc.text(formatCurrency(student.pendingFees), cols[4], y);

      y += 15;
    }

    doc.end();
    stream.on("finish", () => resolve());
    stream.on("error", reject);
  });
}

/**
 * Generate student performance Excel
 */
async function generateStudentPerformanceExcel(
  data: StudentPerformanceData,
  filePath: string,
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Student Performance");

  worksheet.mergeCells("A1:E1");
  worksheet.getCell("A1").value = "Student Performance Report";
  worksheet.getCell("A1").font = { size: 18, bold: true };

  if (data.batchName) {
    worksheet.getCell("A2").value = `Batch: ${data.batchName}`;
  }

  worksheet.getRow(4).values = [
    "Student",
    "Attendance %",
    "Exam Average",
    "Fee Status",
    "Pending Fees",
  ];
  worksheet.getRow(4).font = { bold: true };

  let row = 5;
  for (const student of data.students) {
    worksheet.getRow(row).values = [
      student.name,
      `${student.attendancePercentage}%`,
      student.examAverage !== null ? `${student.examAverage}%` : "N/A",
      student.feeStatus,
      student.pendingFees,
    ];
    row++;
  }

  worksheet.columns = [
    { width: 25 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
  ];

  await workbook.xlsx.writeFile(filePath);
}

/**
 * Generate branch summary PDF
 */
async function generateBranchSummaryPDF(
  data: BranchSummaryData,
  filePath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    doc.fontSize(20).text("Branch Summary Report", { align: "center" });
    if (data.branchName) {
      doc.fontSize(14).text(`Branch: ${data.branchName}`, { align: "center" });
    }
    doc.moveDown();

    // Summary metrics
    doc.fontSize(12).font("Helvetica-Bold").text("Overview");
    doc.font("Helvetica");
    doc.text(`Total Students: ${data.totalStudents}`);
    doc.text(`Active Students: ${data.activeStudents}`);
    doc.text(`Total Batches: ${data.totalBatches}`);
    doc.text(`Total Staff: ${data.totalStaff}`);
    doc.text(`Attendance Rate (30 days): ${data.attendanceRate}%`);
    doc.text(`Fee Collection Rate: ${data.feeCollectionRate}%`);
    doc.text(`Fees Collected: ${formatCurrency(data.totalFeesCollected)}`);
    doc.text(`Fees Pending: ${formatCurrency(data.totalFeesPending)}`);
    doc.moveDown();

    // Batch-wise summary
    doc.font("Helvetica-Bold").text("Batch-wise Summary");
    doc.moveDown(0.5);

    const cols = [50, 200, 280, 380, 480];
    const tableTop = doc.y;

    doc.fontSize(10);
    doc.text("Batch", cols[0], tableTop);
    doc.text("Students", cols[1], tableTop);
    doc.text("Attendance", cols[2], tableTop);
    doc.text("Fee Collection", cols[3], tableTop);

    doc
      .moveTo(50, tableTop + 15)
      .lineTo(550, tableTop + 15)
      .stroke();

    doc.font("Helvetica");
    let y = tableTop + 25;

    for (const batch of data.batchWiseSummary) {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }

      doc.text(batch.batchName, cols[0], y);
      doc.text(batch.studentCount.toString(), cols[1], y);
      doc.text(`${batch.attendanceRate}%`, cols[2], y);
      doc.text(`${batch.feeCollectionRate}%`, cols[3], y);

      y += 15;
    }

    doc.end();
    stream.on("finish", () => resolve());
    stream.on("error", reject);
  });
}

/**
 * Generate branch summary Excel
 */
async function generateBranchSummaryExcel(
  data: BranchSummaryData,
  filePath: string,
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Branch Summary");

  worksheet.mergeCells("A1:D1");
  worksheet.getCell("A1").value = "Branch Summary Report";
  worksheet.getCell("A1").font = { size: 18, bold: true };

  if (data.branchName) {
    worksheet.getCell("A2").value = `Branch: ${data.branchName}`;
  }

  // Overview section
  worksheet.getCell("A4").value = "Overview";
  worksheet.getCell("A4").font = { bold: true };

  const metrics = [
    ["Total Students", data.totalStudents],
    ["Active Students", data.activeStudents],
    ["Total Batches", data.totalBatches],
    ["Total Staff", data.totalStaff],
    ["Attendance Rate", `${data.attendanceRate}%`],
    ["Fee Collection Rate", `${data.feeCollectionRate}%`],
    ["Fees Collected", data.totalFeesCollected],
    ["Fees Pending", data.totalFeesPending],
  ];

  let row = 5;
  for (const [label, value] of metrics) {
    worksheet.getCell(`A${row}`).value = label;
    worksheet.getCell(`B${row}`).value = value;
    row++;
  }

  // Batch-wise section
  row += 1;
  worksheet.getCell(`A${row}`).value = "Batch-wise Summary";
  worksheet.getCell(`A${row}`).font = { bold: true };
  row++;

  worksheet.getRow(row).values = [
    "Batch",
    "Students",
    "Attendance %",
    "Fee Collection %",
  ];
  worksheet.getRow(row).font = { bold: true };
  row++;

  for (const batch of data.batchWiseSummary) {
    worksheet.getRow(row).values = [
      batch.batchName,
      batch.studentCount,
      `${batch.attendanceRate}%`,
      `${batch.feeCollectionRate}%`,
    ];
    row++;
  }

  worksheet.columns = [
    { width: 25 },
    { width: 15 },
    { width: 15 },
    { width: 18 },
  ];

  await workbook.xlsx.writeFile(filePath);
}

/**
 * Format currency
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}
