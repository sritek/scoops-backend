/**
 * Attendance Report Generator
 *
 * Generates attendance reports in PDF or Excel format
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

interface AttendanceReportParams {
  month?: number;
  year?: number;
  batchId?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Generate attendance report
 */
export async function generateAttendanceReport(
  type: "attendance_monthly" | "attendance_batch",
  format: ReportFormat,
  scope: ReportScope,
  params: AttendanceReportParams
): Promise<string> {
  // Get report data
  const data = await getAttendanceData(type, scope, params);

  // Generate file
  const filename = `attendance_${type}_${Date.now()}.${format === "pdf" ? "pdf" : "xlsx"}`;
  const filePath = path.join(reportsDir, filename);

  if (format === "pdf") {
    await generatePDF(data, filePath, type, params);
  } else {
    await generateExcel(data, filePath, type, params);
  }

  return filePath;
}

/**
 * Get attendance data for report
 */
async function getAttendanceData(
  type: string,
  scope: ReportScope,
  params: AttendanceReportParams
) {
  const where: any = {
    orgId: scope.orgId,
  };

  if (scope.branchId) {
    where.branchId = scope.branchId;
  }

  // Get date range
  let startDate: Date;
  let endDate: Date;

  if (type === "attendance_monthly" && params.month && params.year) {
    startDate = new Date(params.year, params.month - 1, 1);
    endDate = new Date(params.year, params.month, 0); // Last day of month
  } else if (params.startDate && params.endDate) {
    startDate = new Date(params.startDate);
    endDate = new Date(params.endDate);
  } else {
    // Default to current month
    const now = new Date();
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }

  where.attendanceDate = {
    gte: startDate,
    lte: endDate,
  };

  if (params.batchId) {
    where.batchId = params.batchId;
  }

  // Get attendance sessions with records
  const sessions = await prisma.attendanceSession.findMany({
    where,
    include: {
      batch: {
        select: {
          name: true,
        },
      },
      records: {
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
    orderBy: { attendanceDate: "asc" },
  });

  // Process data for report
  const studentAttendance: Map<
    string,
    {
      name: string;
      batchName: string;
      present: number;
      absent: number;
      total: number;
      percentage: number;
    }
  > = new Map();

  for (const session of sessions) {
    for (const record of session.records) {
      const studentId = record.student.id;
      const studentName = `${record.student.firstName} ${record.student.lastName}`;

      if (!studentAttendance.has(studentId)) {
        studentAttendance.set(studentId, {
          name: studentName,
          batchName: session.batch.name,
          present: 0,
          absent: 0,
          total: 0,
          percentage: 0,
        });
      }

      const stats = studentAttendance.get(studentId)!;
      stats.total += 1;
      if (record.status === "present") {
        stats.present += 1;
      } else {
        stats.absent += 1;
      }
      stats.percentage = Math.round((stats.present / stats.total) * 100);
    }
  }

  return {
    startDate,
    endDate,
    students: Array.from(studentAttendance.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    ),
    totalSessions: sessions.length,
  };
}

/**
 * Generate PDF report
 */
async function generatePDF(
  data: Awaited<ReturnType<typeof getAttendanceData>>,
  filePath: string,
  type: string,
  params: AttendanceReportParams
): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    // Title
    doc.fontSize(20).text("Attendance Report", { align: "center" });
    doc.moveDown();

    // Report info
    doc.fontSize(12);
    doc.text(
      `Period: ${formatDate(data.startDate)} - ${formatDate(data.endDate)}`
    );
    doc.text(`Total Sessions: ${data.totalSessions}`);
    doc.moveDown();

    // Table header
    const tableTop = doc.y;
    const col1 = 50;
    const col2 = 200;
    const col3 = 280;
    const col4 = 330;
    const col5 = 380;
    const col6 = 450;

    doc.font("Helvetica-Bold");
    doc.text("Student", col1, tableTop);
    doc.text("Batch", col2, tableTop);
    doc.text("Present", col3, tableTop);
    doc.text("Absent", col4, tableTop);
    doc.text("Total", col5, tableTop);
    doc.text("%", col6, tableTop);

    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

    // Table rows
    doc.font("Helvetica");
    let y = tableTop + 25;

    for (const student of data.students) {
      // Check if we need a new page
      if (y > 700) {
        doc.addPage();
        y = 50;
      }

      doc.text(student.name.substring(0, 20), col1, y);
      doc.text(student.batchName.substring(0, 12), col2, y);
      doc.text(student.present.toString(), col3, y);
      doc.text(student.absent.toString(), col4, y);
      doc.text(student.total.toString(), col5, y);
      doc.text(`${student.percentage}%`, col6, y);

      y += 20;
    }

    // Footer
    doc.moveDown(2);
    doc.fontSize(10).text(
      `Generated on ${new Date().toLocaleString("en-IN")}`,
      { align: "center" }
    );

    doc.end();

    stream.on("finish", () => resolve());
    stream.on("error", reject);
  });
}

/**
 * Generate Excel report
 */
async function generateExcel(
  data: Awaited<ReturnType<typeof getAttendanceData>>,
  filePath: string,
  type: string,
  params: AttendanceReportParams
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Scoops";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Attendance Report");

  // Title
  worksheet.mergeCells("A1:F1");
  worksheet.getCell("A1").value = "Attendance Report";
  worksheet.getCell("A1").font = { size: 18, bold: true };
  worksheet.getCell("A1").alignment = { horizontal: "center" };

  // Report info
  worksheet.getCell("A3").value = `Period: ${formatDate(data.startDate)} - ${formatDate(data.endDate)}`;
  worksheet.getCell("A4").value = `Total Sessions: ${data.totalSessions}`;

  // Headers
  worksheet.getRow(6).values = [
    "Student Name",
    "Batch",
    "Present",
    "Absent",
    "Total",
    "Percentage",
  ];
  worksheet.getRow(6).font = { bold: true };
  worksheet.getRow(6).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };

  // Data
  let row = 7;
  for (const student of data.students) {
    worksheet.getRow(row).values = [
      student.name,
      student.batchName,
      student.present,
      student.absent,
      student.total,
      `${student.percentage}%`,
    ];
    row++;
  }

  // Column widths
  worksheet.columns = [
    { width: 25 },
    { width: 15 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 12 },
  ];

  // Save file
  await workbook.xlsx.writeFile(filePath);
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
