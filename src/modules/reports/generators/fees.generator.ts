/**
 * Fees Report Generator
 *
 * Generates fee collection and defaulter reports in PDF or Excel format
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

interface FeesReportParams {
  startDate?: string;
  endDate?: string;
}

/**
 * Generate fees report
 */
export async function generateFeesReport(
  type: "fee_collection" | "fee_defaulters",
  format: ReportFormat,
  scope: ReportScope,
  params: FeesReportParams
): Promise<string> {
  const data = type === "fee_collection"
    ? await getFeeCollectionData(scope, params)
    : await getFeeDefaultersData(scope);

  const filename = `fees_${type}_${Date.now()}.${format === "pdf" ? "pdf" : "xlsx"}`;
  const filePath = path.join(reportsDir, filename);

  if (type === "fee_collection") {
    if (format === "pdf") {
      await generateCollectionPDF(data as FeeCollectionData, filePath);
    } else {
      await generateCollectionExcel(data as FeeCollectionData, filePath);
    }
  } else {
    if (format === "pdf") {
      await generateDefaultersPDF(data as FeeDefaultersData, filePath);
    } else {
      await generateDefaultersExcel(data as FeeDefaultersData, filePath);
    }
  }

  return filePath;
}

interface FeeCollectionData {
  startDate: Date;
  endDate: Date;
  totalCollected: number;
  byPaymentMode: { mode: string; amount: number }[];
  payments: {
    date: string;
    studentName: string;
    batchName: string;
    amount: number;
    mode: string;
    receivedBy: string;
  }[];
}

interface FeeDefaultersData {
  students: {
    name: string;
    batchName: string;
    totalPending: number;
    oldestDueDate: Date;
    daysPastDue: number;
    parentPhone: string;
  }[];
  totalPending: number;
}

/**
 * Get fee collection data
 */
async function getFeeCollectionData(
  scope: ReportScope,
  params: FeesReportParams
): Promise<FeeCollectionData> {
  const startDate = params.startDate
    ? new Date(params.startDate)
    : new Date(new Date().setDate(1)); // First day of current month
  const endDate = params.endDate ? new Date(params.endDate) : new Date();

  const where: any = {
    receivedAt: {
      gte: startDate,
      lte: endDate,
    },
    studentFee: {
      student: {
        orgId: scope.orgId,
      },
    },
  };

  if (scope.branchId) {
    where.studentFee.student.branchId = scope.branchId;
  }

  const payments = await prisma.feePayment.findMany({
    where,
    include: {
      studentFee: {
        include: {
          student: {
            select: {
              firstName: true,
              lastName: true,
              batch: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
      receivedBy: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { receivedAt: "desc" },
  });

  // Calculate totals
  const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);

  // Group by payment mode
  const modeMap = new Map<string, number>();
  for (const payment of payments) {
    const current = modeMap.get(payment.paymentMode) || 0;
    modeMap.set(payment.paymentMode, current + payment.amount);
  }

  return {
    startDate,
    endDate,
    totalCollected,
    byPaymentMode: Array.from(modeMap.entries()).map(([mode, amount]) => ({
      mode,
      amount,
    })),
    payments: payments.map((p) => ({
      date: p.receivedAt.toISOString(),
      studentName: `${p.studentFee.student.firstName} ${p.studentFee.student.lastName}`,
      batchName: p.studentFee.student.batch?.name || "N/A",
      amount: p.amount,
      mode: p.paymentMode,
      receivedBy: `${p.receivedBy.firstName} ${p.receivedBy.lastName}`,
    })),
  };
}

/**
 * Get fee defaulters data
 */
async function getFeeDefaultersData(scope: ReportScope): Promise<FeeDefaultersData> {
  const today = new Date();

  const where: any = {
    status: { in: ["pending", "partial"] },
    dueDate: { lt: today },
    student: {
      orgId: scope.orgId,
      status: "active",
    },
  };

  if (scope.branchId) {
    where.student.branchId = scope.branchId;
  }

  const overdueFees = await prisma.studentFee.findMany({
    where,
    include: {
      student: {
        select: {
          firstName: true,
          lastName: true,
          batch: {
            select: { name: true },
          },
          studentParents: {
            include: {
              parent: {
                select: { phone: true },
              },
            },
            take: 1,
          },
        },
      },
    },
    orderBy: { dueDate: "asc" },
  });

  // Group by student
  const studentMap = new Map<
    string,
    {
      name: string;
      batchName: string;
      totalPending: number;
      oldestDueDate: Date;
      parentPhone: string;
    }
  >();

  for (const fee of overdueFees) {
    const studentId = fee.studentId;
    const pending = fee.totalAmount - fee.paidAmount;

    if (!studentMap.has(studentId)) {
      studentMap.set(studentId, {
        name: `${fee.student.firstName} ${fee.student.lastName}`,
        batchName: fee.student.batch?.name || "N/A",
        totalPending: 0,
        oldestDueDate: fee.dueDate,
        parentPhone: fee.student.studentParents[0]?.parent.phone || "N/A",
      });
    }

    const entry = studentMap.get(studentId)!;
    entry.totalPending += pending;
    if (fee.dueDate < entry.oldestDueDate) {
      entry.oldestDueDate = fee.dueDate;
    }
  }

  const students = Array.from(studentMap.values())
    .map((s) => ({
      ...s,
      daysPastDue: Math.floor(
        (today.getTime() - s.oldestDueDate.getTime()) / (1000 * 60 * 60 * 24)
      ),
    }))
    .sort((a, b) => b.totalPending - a.totalPending);

  return {
    students,
    totalPending: students.reduce((sum, s) => sum + s.totalPending, 0),
  };
}

/**
 * Generate fee collection PDF
 */
async function generateCollectionPDF(
  data: FeeCollectionData,
  filePath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    // Title
    doc.fontSize(20).text("Fee Collection Report", { align: "center" });
    doc.moveDown();

    // Report info
    doc.fontSize(12);
    doc.text(
      `Period: ${formatDate(data.startDate)} - ${formatDate(data.endDate)}`
    );
    doc.text(`Total Collected: ${formatCurrency(data.totalCollected)}`);
    doc.moveDown();

    // By payment mode
    doc.font("Helvetica-Bold").text("Collection by Payment Mode:");
    doc.font("Helvetica");
    for (const { mode, amount } of data.byPaymentMode) {
      doc.text(`  ${mode.toUpperCase()}: ${formatCurrency(amount)}`);
    }
    doc.moveDown();

    // Table header
    const tableTop = doc.y;
    const cols = [50, 170, 260, 330, 400, 480];

    doc.font("Helvetica-Bold");
    doc.text("Date", cols[0], tableTop);
    doc.text("Student", cols[1], tableTop);
    doc.text("Batch", cols[2], tableTop);
    doc.text("Amount", cols[3], tableTop);
    doc.text("Mode", cols[4], tableTop);
    doc.text("By", cols[5], tableTop);

    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

    // Table rows
    doc.font("Helvetica").fontSize(10);
    let y = tableTop + 25;

    for (const payment of data.payments.slice(0, 50)) {
      // Limit rows for PDF
      if (y > 700) {
        doc.addPage();
        y = 50;
      }

      doc.text(formatDate(new Date(payment.date)), cols[0], y);
      doc.text(payment.studentName.substring(0, 15), cols[1], y);
      doc.text(payment.batchName.substring(0, 10), cols[2], y);
      doc.text(formatCurrency(payment.amount), cols[3], y);
      doc.text(payment.mode, cols[4], y);
      doc.text(payment.receivedBy.substring(0, 12), cols[5], y);

      y += 15;
    }

    doc.end();
    stream.on("finish", () => resolve());
    stream.on("error", reject);
  });
}

/**
 * Generate fee collection Excel
 */
async function generateCollectionExcel(
  data: FeeCollectionData,
  filePath: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Fee Collection");

  // Title
  worksheet.mergeCells("A1:F1");
  worksheet.getCell("A1").value = "Fee Collection Report";
  worksheet.getCell("A1").font = { size: 18, bold: true };

  worksheet.getCell("A3").value = `Period: ${formatDate(data.startDate)} - ${formatDate(data.endDate)}`;
  worksheet.getCell("A4").value = `Total Collected: ${formatCurrency(data.totalCollected)}`;

  // Headers
  worksheet.getRow(6).values = [
    "Date",
    "Student",
    "Batch",
    "Amount",
    "Mode",
    "Received By",
  ];
  worksheet.getRow(6).font = { bold: true };

  // Data
  let row = 7;
  for (const payment of data.payments) {
    worksheet.getRow(row).values = [
      formatDate(new Date(payment.date)),
      payment.studentName,
      payment.batchName,
      payment.amount,
      payment.mode,
      payment.receivedBy,
    ];
    row++;
  }

  worksheet.columns = [
    { width: 12 },
    { width: 20 },
    { width: 15 },
    { width: 12 },
    { width: 10 },
    { width: 18 },
  ];

  await workbook.xlsx.writeFile(filePath);
}

/**
 * Generate fee defaulters PDF
 */
async function generateDefaultersPDF(
  data: FeeDefaultersData,
  filePath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    // Title
    doc.fontSize(20).text("Fee Defaulters Report", { align: "center" });
    doc.moveDown();

    // Summary
    doc.fontSize(12);
    doc.text(`Total Students: ${data.students.length}`);
    doc.text(`Total Pending: ${formatCurrency(data.totalPending)}`);
    doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`);
    doc.moveDown();

    // Table
    const cols = [50, 170, 260, 330, 400, 480];
    const tableTop = doc.y;

    doc.font("Helvetica-Bold").fontSize(10);
    doc.text("Student", cols[0], tableTop);
    doc.text("Batch", cols[1], tableTop);
    doc.text("Pending", cols[2], tableTop);
    doc.text("Due Since", cols[3], tableTop);
    doc.text("Days", cols[4], tableTop);
    doc.text("Phone", cols[5], tableTop);

    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

    doc.font("Helvetica");
    let y = tableTop + 25;

    for (const student of data.students) {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }

      doc.text(student.name.substring(0, 18), cols[0], y);
      doc.text(student.batchName.substring(0, 12), cols[1], y);
      doc.text(formatCurrency(student.totalPending), cols[2], y);
      doc.text(formatDate(student.oldestDueDate), cols[3], y);
      doc.text(student.daysPastDue.toString(), cols[4], y);
      doc.text(student.parentPhone, cols[5], y);

      y += 15;
    }

    doc.end();
    stream.on("finish", () => resolve());
    stream.on("error", reject);
  });
}

/**
 * Generate fee defaulters Excel
 */
async function generateDefaultersExcel(
  data: FeeDefaultersData,
  filePath: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Fee Defaulters");

  worksheet.mergeCells("A1:F1");
  worksheet.getCell("A1").value = "Fee Defaulters Report";
  worksheet.getCell("A1").font = { size: 18, bold: true };

  worksheet.getCell("A3").value = `Total Students: ${data.students.length}`;
  worksheet.getCell("A4").value = `Total Pending: ${formatCurrency(data.totalPending)}`;

  worksheet.getRow(6).values = [
    "Student",
    "Batch",
    "Pending Amount",
    "Due Since",
    "Days Past Due",
    "Parent Phone",
  ];
  worksheet.getRow(6).font = { bold: true };

  let row = 7;
  for (const student of data.students) {
    worksheet.getRow(row).values = [
      student.name,
      student.batchName,
      student.totalPending,
      formatDate(student.oldestDueDate),
      student.daysPastDue,
      student.parentPhone,
    ];
    row++;
  }

  worksheet.columns = [
    { width: 25 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
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

/**
 * Format date
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
