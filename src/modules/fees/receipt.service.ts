import PDFDocument from "pdfkit";
import type { Readable } from "stream";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database.js";
import type { TenantScope } from "../../types/request.js";
import { NotFoundError } from "../../utils/error-handler.js";
import {
  type PaginationParams,
  createPaginatedResponse,
  calculateSkip,
} from "../../utils/pagination.js";

/**
 * Helper to format full name
 */
function formatFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

/**
 * Format currency in INR
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Format payment mode for display
 */
function formatPaymentMode(mode: string): string {
  const modes: Record<string, string> = {
    cash: "Cash",
    upi: "UPI",
    bank: "Bank Transfer",
  };
  return modes[mode] || mode;
}

/**
 * Generate next receipt number for an organization
 * Format: ORG-YYYY-NNNNNN (e.g., SCOOPS-2026-000001)
 */
export async function generateReceiptNumber(orgId: string): Promise<string> {
  const currentYear = new Date().getFullYear();

  // Get or create sequence for org+year
  const sequence = await prisma.receiptSequence.upsert({
    where: {
      orgId_year: {
        orgId,
        year: currentYear,
      },
    },
    create: {
      orgId,
      year: currentYear,
      lastNumber: 1,
    },
    update: {
      lastNumber: { increment: 1 },
    },
  });

  // Format as 6-digit padded number
  const paddedNumber = String(sequence.lastNumber).padStart(6, "0");

  // Get org name for prefix (first 3-4 chars uppercase)
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true },
  });

  const prefix = (org?.name || "REC")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .substring(0, 4);

  return `${prefix}-${currentYear}-${paddedNumber}`;
}

/**
 * Create a receipt for a payment
 */
export async function createReceipt(
  paymentId: string,
  scope: TenantScope,
  receivedById: string
): Promise<{
  id: string;
  receiptNumber: string;
  amount: number;
  paymentMode: string;
  generatedAt: Date;
  studentName: string;
  feePlanName: string;
}> {
  // Get payment with related data
  const payment = await prisma.feePayment.findFirst({
    where: {
      id: paymentId,
      studentFee: {
        student: {
          orgId: scope.orgId,
          branchId: scope.branchId,
        },
      },
    },
    include: {
      studentFee: {
        include: {
          student: true,
          feePlan: true,
        },
      },
    },
  });

  if (!payment) {
    throw new NotFoundError("Payment");
  }

  // Check if receipt already exists for this payment
  const existingReceipt = await prisma.receipt.findUnique({
    where: { paymentId },
  });

  if (existingReceipt) {
    return {
      id: existingReceipt.id,
      receiptNumber: existingReceipt.receiptNumber,
      amount: existingReceipt.amount,
      paymentMode: existingReceipt.paymentMode,
      generatedAt: existingReceipt.generatedAt,
      studentName: formatFullName(
        payment.studentFee.student.firstName,
        payment.studentFee.student.lastName
      ),
      feePlanName: payment.studentFee.feePlan.name,
    };
  }

  // Generate receipt number
  const receiptNumber = await generateReceiptNumber(scope.orgId);

  // Create receipt
  const receipt = await prisma.receipt.create({
    data: {
      orgId: scope.orgId,
      branchId: scope.branchId,
      receiptNumber,
      paymentId,
      studentId: payment.studentFee.student.id,
      studentFeeId: payment.studentFee.id,
      amount: payment.amount,
      paymentMode: payment.paymentMode,
      receivedById,
    },
  });

  return {
    id: receipt.id,
    receiptNumber: receipt.receiptNumber,
    amount: receipt.amount,
    paymentMode: receipt.paymentMode,
    generatedAt: receipt.generatedAt,
    studentName: formatFullName(
      payment.studentFee.student.firstName,
      payment.studentFee.student.lastName
    ),
    feePlanName: payment.studentFee.feePlan.name,
  };
}

/**
 * Get receipts with pagination and filters
 */
export interface ReceiptFilters {
  studentId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export async function getReceipts(
  scope: TenantScope,
  pagination: PaginationParams,
  filters?: ReceiptFilters
) {
  const where: Prisma.ReceiptWhereInput = {
    orgId: scope.orgId,
    branchId: scope.branchId,
  };

  if (filters?.studentId) {
    where.studentId = filters.studentId;
  }

  if (filters?.startDate || filters?.endDate) {
    where.generatedAt = {};
    if (filters.startDate) {
      where.generatedAt.gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      endDate.setDate(endDate.getDate() + 1);
      where.generatedAt.lt = endDate;
    }
  }

  if (filters?.search) {
    where.OR = [
      { receiptNumber: { contains: filters.search, mode: "insensitive" } },
      { student: { firstName: { contains: filters.search, mode: "insensitive" } } },
      { student: { lastName: { contains: filters.search, mode: "insensitive" } } },
    ];
  }

  const [receipts, total] = await Promise.all([
    prisma.receipt.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        payment: {
          include: {
            studentFee: {
              include: {
                feePlan: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        receivedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { generatedAt: "desc" },
      skip: calculateSkip(pagination),
      take: pagination.limit,
    }),
    prisma.receipt.count({ where }),
  ]);

  const formattedReceipts = receipts.map((receipt) => ({
    id: receipt.id,
    receiptNumber: receipt.receiptNumber,
    amount: receipt.amount,
    paymentMode: receipt.paymentMode,
    generatedAt: receipt.generatedAt,
    student: {
      id: receipt.student.id,
      firstName: receipt.student.firstName,
      lastName: receipt.student.lastName,
      fullName: formatFullName(receipt.student.firstName, receipt.student.lastName),
    },
    feePlan: receipt.payment.studentFee.feePlan,
    receivedBy: {
      id: receipt.receivedBy.id,
      firstName: receipt.receivedBy.firstName,
      lastName: receipt.receivedBy.lastName,
      fullName: formatFullName(receipt.receivedBy.firstName, receipt.receivedBy.lastName),
    },
  }));

  return createPaginatedResponse(formattedReceipts, total, pagination);
}

/**
 * Get a single receipt by ID
 */
export async function getReceiptById(id: string, scope: TenantScope) {
  const receipt = await prisma.receipt.findFirst({
    where: {
      id,
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
    include: {
      organization: {
        select: {
          name: true,
          phone: true,
          email: true,
          address: true,
          logoUrl: true,
        },
      },
      student: {
        include: {
          batch: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      payment: {
        include: {
          studentFee: {
            include: {
              feePlan: true,
            },
          },
        },
      },
      receivedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!receipt) {
    return null;
  }

  return {
    id: receipt.id,
    receiptNumber: receipt.receiptNumber,
    amount: receipt.amount,
    paymentMode: receipt.paymentMode,
    generatedAt: receipt.generatedAt,
    organization: receipt.organization,
    student: {
      id: receipt.student.id,
      firstName: receipt.student.firstName,
      lastName: receipt.student.lastName,
      fullName: formatFullName(receipt.student.firstName, receipt.student.lastName),
      batch: receipt.student.batch,
    },
    feePlan: receipt.payment.studentFee.feePlan,
    studentFee: {
      totalAmount: receipt.payment.studentFee.totalAmount,
      paidAmount: receipt.payment.studentFee.paidAmount,
      dueDate: receipt.payment.studentFee.dueDate,
      status: receipt.payment.studentFee.status,
    },
    receivedBy: {
      id: receipt.receivedBy.id,
      firstName: receipt.receivedBy.firstName,
      lastName: receipt.receivedBy.lastName,
      fullName: formatFullName(receipt.receivedBy.firstName, receipt.receivedBy.lastName),
    },
  };
}

/**
 * Generate PDF for a receipt
 * Returns a readable stream that can be piped to response
 */
export async function generateReceiptPDF(
  id: string,
  scope: TenantScope
): Promise<{ stream: Readable; fileName: string } | null> {
  const receipt = await getReceiptById(id, scope);

  if (!receipt) {
    return null;
  }

  // Create PDF document
  const doc = new PDFDocument({
    size: "A4",
    margin: 50,
    info: {
      Title: `Receipt ${receipt.receiptNumber}`,
      Author: receipt.organization.name,
    },
  });

  // Header - Organization details
  const pageWidth = doc.page.width - 100;

  // Organization Name
  doc
    .fontSize(20)
    .font("Helvetica-Bold")
    .text(receipt.organization.name, 50, 50, {
      align: "center",
      width: pageWidth,
    });

  // Organization contact
  const contactParts: string[] = [];
  if (receipt.organization.address) contactParts.push(receipt.organization.address);
  if (receipt.organization.phone) contactParts.push(`Phone: ${receipt.organization.phone}`);
  if (receipt.organization.email) contactParts.push(`Email: ${receipt.organization.email}`);

  if (contactParts.length > 0) {
    doc
      .fontSize(9)
      .font("Helvetica")
      .text(contactParts.join(" | "), 50, 75, {
        align: "center",
        width: pageWidth,
      });
  }

  // Receipt Title
  doc.moveDown(1.5);
  doc
    .fontSize(16)
    .font("Helvetica-Bold")
    .text("PAYMENT RECEIPT", 50, doc.y, {
      align: "center",
      width: pageWidth,
    });

  // Horizontal line
  doc.moveDown(0.5);
  const lineY = doc.y;
  doc
    .strokeColor("#cccccc")
    .lineWidth(1)
    .moveTo(50, lineY)
    .lineTo(545, lineY)
    .stroke();

  // Receipt details row
  doc.moveDown(1);
  const detailsY = doc.y;

  // Left column
  doc.fontSize(10).font("Helvetica-Bold").text("Receipt No:", 50, detailsY);
  doc.font("Helvetica").text(receipt.receiptNumber, 130, detailsY);

  // Right column
  doc.font("Helvetica-Bold").text("Date:", 380, detailsY);
  doc.font("Helvetica").text(formatDate(receipt.generatedAt), 420, detailsY);

  // Student details box
  doc.moveDown(2);
  const boxTop = doc.y;
  doc.rect(50, boxTop, 495, 70).stroke("#cccccc");

  doc.fontSize(10).font("Helvetica-Bold").text("Student Details", 60, boxTop + 10);

  doc.fontSize(10).font("Helvetica-Bold").text("Name:", 60, boxTop + 30);
  doc.font("Helvetica").text(receipt.student.fullName, 130, boxTop + 30);

  if (receipt.student.batch) {
    doc.font("Helvetica-Bold").text("Class/Batch:", 300, boxTop + 30);
    doc.font("Helvetica").text(receipt.student.batch.name, 380, boxTop + 30);
  }

  doc.font("Helvetica-Bold").text("Student ID:", 60, boxTop + 50);
  doc.font("Helvetica").text(receipt.student.id.substring(0, 8).toUpperCase(), 130, boxTop + 50);

  // Payment details box
  doc.y = boxTop + 90;
  const paymentBoxTop = doc.y;
  doc.rect(50, paymentBoxTop, 495, 120).stroke("#cccccc");

  doc.fontSize(10).font("Helvetica-Bold").text("Payment Details", 60, paymentBoxTop + 10);

  // Table header
  const tableTop = paymentBoxTop + 35;
  doc
    .rect(60, tableTop, 475, 25)
    .fill("#f5f5f5")
    .stroke("#cccccc");

  doc.fontSize(9).font("Helvetica-Bold").fillColor("#333333");
  doc.text("Fee Type", 70, tableTop + 8);
  doc.text("Due Date", 220, tableTop + 8);
  doc.text("Amount", 340, tableTop + 8);
  doc.text("Status", 450, tableTop + 8);

  // Table row
  const rowTop = tableTop + 25;
  doc
    .rect(60, rowTop, 475, 25)
    .stroke("#cccccc");

  doc.fontSize(9).font("Helvetica").fillColor("#000000");
  doc.text(receipt.feePlan.name, 70, rowTop + 8);
  doc.text(formatDate(receipt.studentFee.dueDate), 220, rowTop + 8);
  doc.text(formatCurrency(receipt.amount), 340, rowTop + 8);
  doc
    .font("Helvetica-Bold")
    .fillColor(receipt.studentFee.status === "paid" ? "#22c55e" : "#f59e0b")
    .text(receipt.studentFee.status.toUpperCase(), 450, rowTop + 8);

  // Payment summary
  doc.y = paymentBoxTop + 140;
  const summaryTop = doc.y;

  doc.rect(320, summaryTop, 225, 70).fill("#f5f5f5").stroke("#cccccc");

  doc.fontSize(10).font("Helvetica").fillColor("#000000");
  doc.text("Payment Mode:", 330, summaryTop + 10);
  doc.font("Helvetica-Bold").text(formatPaymentMode(receipt.paymentMode), 440, summaryTop + 10);

  doc.font("Helvetica").text("Amount Paid:", 330, summaryTop + 30);
  doc.font("Helvetica-Bold").fontSize(14).text(formatCurrency(receipt.amount), 440, summaryTop + 28);

  doc.fontSize(10).font("Helvetica").text("Received By:", 330, summaryTop + 52);
  doc.font("Helvetica").text(receipt.receivedBy.fullName, 410, summaryTop + 52);

  // Footer
  doc.y = 700;
  doc
    .strokeColor("#cccccc")
    .lineWidth(1)
    .moveTo(50, doc.y)
    .lineTo(545, doc.y)
    .stroke();

  doc.moveDown(0.5);
  doc
    .fontSize(8)
    .font("Helvetica")
    .fillColor("#666666")
    .text("This is a computer-generated receipt and does not require a signature.", 50, doc.y, {
      align: "center",
      width: pageWidth,
    });

  doc.moveDown(0.5);
  doc.text(`Generated on: ${formatDate(new Date())}`, 50, doc.y, {
    align: "center",
    width: pageWidth,
  });

  // Finalize PDF
  doc.end();

  const fileName = `Receipt_${receipt.receiptNumber}.pdf`;

  return { stream: doc as unknown as Readable, fileName };
}
