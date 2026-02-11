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
  // Display amounts as "Rs. 1,000" instead of the generic currency symbol.
  const formatted = new Intl.NumberFormat("en-IN", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

  return `Rs. ${formatted}`;
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
 * Create a receipt for an installment payment
 */
export async function createReceipt(
  installmentPaymentId: string,
  scope: TenantScope,
  receivedById: string,
): Promise<{
  id: string;
  receiptNumber: string;
  amount: number;
  paymentMode: string;
  generatedAt: Date;
  studentName: string;
  installmentNumber: number;
}> {
  // Get installment payment with related data
  const payment = await prisma.installmentPayment.findFirst({
    where: {
      id: installmentPaymentId,
    },
    include: {
      installment: {
        include: {
          studentFeeStructure: {
            include: {
              student: true,
              session: true,
            },
          },
        },
      },
    },
  });

  if (!payment) {
    throw new NotFoundError("Payment");
  }

  // Verify tenant scope
  const student = payment.installment.studentFeeStructure.student;
  if (student.orgId !== scope.orgId || student.branchId !== scope.branchId) {
    throw new NotFoundError("Payment");
  }

  // Check if receipt already exists for this payment
  const existingReceipt = await prisma.receipt.findUnique({
    where: { installmentPaymentId },
  });

  if (existingReceipt) {
    return {
      id: existingReceipt.id,
      receiptNumber: existingReceipt.receiptNumber,
      amount: existingReceipt.amount,
      paymentMode: existingReceipt.paymentMode,
      generatedAt: existingReceipt.generatedAt,
      studentName: formatFullName(student.firstName, student.lastName),
      installmentNumber: payment.installment.installmentNumber,
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
      installmentPaymentId,
      studentId: student.id,
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
    studentName: formatFullName(student.firstName, student.lastName),
    installmentNumber: payment.installment.installmentNumber,
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
  filters?: ReceiptFilters,
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
      {
        student: {
          firstName: { contains: filters.search, mode: "insensitive" },
        },
      },
      {
        student: {
          lastName: { contains: filters.search, mode: "insensitive" },
        },
      },
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
        installmentPayment: {
          include: {
            installment: {
              include: {
                studentFeeStructure: {
                  include: {
                    session: {
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
      fullName: formatFullName(
        receipt.student.firstName,
        receipt.student.lastName,
      ),
    },
    installment: {
      id: receipt.installmentPayment.installment.id,
      installmentNumber:
        receipt.installmentPayment.installment.installmentNumber,
      dueDate: receipt.installmentPayment.installment.dueDate,
      amount: receipt.installmentPayment.installment.amount,
    },
    session: receipt.installmentPayment.installment.studentFeeStructure.session,
    receivedBy: {
      id: receipt.receivedBy.id,
      firstName: receipt.receivedBy.firstName,
      lastName: receipt.receivedBy.lastName,
      fullName: formatFullName(
        receipt.receivedBy.firstName,
        receipt.receivedBy.lastName,
      ),
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
      installmentPayment: {
        include: {
          installment: {
            include: {
              studentFeeStructure: {
                include: {
                  session: true,
                  lineItems: {
                    include: {
                      feeComponent: true,
                    },
                  },
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
  });

  if (!receipt) {
    return null;
  }

  const installment = receipt.installmentPayment.installment;
  const feeStructure = installment.studentFeeStructure;

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
      fullName: formatFullName(
        receipt.student.firstName,
        receipt.student.lastName,
      ),
      batch: receipt.student.batch,
    },
    session: feeStructure.session,
    feeStructure: {
      id: feeStructure.id,
      grossAmount: feeStructure.grossAmount,
      scholarshipAmount: feeStructure.scholarshipAmount,
      netAmount: feeStructure.netAmount,
      lineItems: feeStructure.lineItems.map((item) => ({
        id: item.id,
        feeComponent: {
          id: item.feeComponent.id,
          name: item.feeComponent.name,
          type: item.feeComponent.type,
        },
        originalAmount: item.originalAmount,
        adjustedAmount: item.adjustedAmount,
        waived: item.waived,
      })),
    },
    installment: {
      id: installment.id,
      installmentNumber: installment.installmentNumber,
      amount: installment.amount,
      dueDate: installment.dueDate,
      paidAmount: installment.paidAmount,
      status: installment.status,
    },
    receivedBy: {
      id: receipt.receivedBy.id,
      firstName: receipt.receivedBy.firstName,
      lastName: receipt.receivedBy.lastName,
      fullName: formatFullName(
        receipt.receivedBy.firstName,
        receipt.receivedBy.lastName,
      ),
    },
  };
}

/**
 * Backfill receipts for existing installment payments.
 * Can be scoped to a specific tenant (org/branch) or run for all tenants.
 * Safe to run multiple times thanks to createReceipt idempotency.
 */
export async function backfillReceiptsForInstallmentPayments(
  scope?: TenantScope,
): Promise<void> {
  const where: Prisma.InstallmentPaymentWhereInput = {};

  if (scope) {
    where.installment = {
      studentFeeStructure: {
        student: {
          orgId: scope.orgId,
          branchId: scope.branchId,
        },
      },
    };
  }

  const payments = await prisma.installmentPayment.findMany({
    where,
    select: {
      id: true,
      receivedById: true,
    },
  });

  for (const payment of payments) {
    if (!payment.receivedById) {
      // Skip payments without a recorded receiver; they cannot have a valid receipt.
      // eslint-disable-next-line no-console
      console.warn(
        `Skipping receipt backfill for payment ${payment.id} - missing receivedById`,
      );
      continue;
    }

    try {
      const effectiveScope = scope ?? (await (async () => {
        const fullPayment = await prisma.installmentPayment.findFirst({
          where: { id: payment.id },
          include: {
            installment: {
              include: {
                studentFeeStructure: {
                  include: {
                    student: true,
                  },
                },
              },
            },
          },
        });

        if (
          !fullPayment ||
          !fullPayment.installment.studentFeeStructure.student
        ) {
          throw new NotFoundError("Installment payment");
        }

        const student = fullPayment.installment.studentFeeStructure.student;

        return {
          orgId: student.orgId,
          branchId: student.branchId,
        } as TenantScope;
      })());

      await createReceipt(payment.id, effectiveScope, payment.receivedById);
    } catch (error) {
      // Log and continue; do not fail the entire backfill.
      // eslint-disable-next-line no-console
      console.error(
        `Failed to backfill receipt for payment ${payment.id}:`,
        error,
      );
    }
  }
}

/**
 * Generate PDF for a receipt
 * Returns a readable stream that can be piped to response
 */
export async function generateReceiptPDF(
  id: string,
  scope: TenantScope,
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
  if (receipt.organization.address)
    contactParts.push(receipt.organization.address);
  if (receipt.organization.phone)
    contactParts.push(`Phone: ${receipt.organization.phone}`);
  if (receipt.organization.email)
    contactParts.push(`Email: ${receipt.organization.email}`);

  if (contactParts.length > 0) {
    doc.fontSize(9).font("Helvetica").text(contactParts.join(" | "), 50, 75, {
      align: "center",
      width: pageWidth,
    });
  }

  // Receipt Title
  doc.moveDown(1.5);
  doc.fontSize(16).font("Helvetica-Bold").text("PAYMENT RECEIPT", 50, doc.y, {
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

  // Session info
  doc.moveDown(0.5);
  doc.font("Helvetica-Bold").text("Session:", 50, doc.y);
  doc.font("Helvetica").text(receipt.session.name, 130, doc.y - 12);

  // Student details box
  doc.moveDown(1.5);
  const boxTop = doc.y;
  doc.rect(50, boxTop, 495, 70).stroke("#cccccc");

  doc
    .fontSize(10)
    .font("Helvetica-Bold")
    .text("Student Details", 60, boxTop + 10);

  doc
    .fontSize(10)
    .font("Helvetica-Bold")
    .text("Name:", 60, boxTop + 30);
  doc.font("Helvetica").text(receipt.student.fullName, 130, boxTop + 30);

  if (receipt.student.batch) {
    doc.font("Helvetica-Bold").text("Class/Batch:", 300, boxTop + 30);
    doc.font("Helvetica").text(receipt.student.batch.name, 380, boxTop + 30);
  }

  doc.font("Helvetica-Bold").text("Student ID:", 60, boxTop + 50);
  doc
    .font("Helvetica")
    .text(receipt.student.id.substring(0, 8).toUpperCase(), 130, boxTop + 50);

  // Payment details box
  doc.y = boxTop + 90;
  const paymentBoxTop = doc.y;
  doc.rect(50, paymentBoxTop, 495, 120).stroke("#cccccc");

  doc
    .fontSize(10)
    .font("Helvetica-Bold")
    .text("Payment Details", 60, paymentBoxTop + 10);

  // Table header
  const tableTop = paymentBoxTop + 35;
  doc.rect(60, tableTop, 475, 25).fill("#f5f5f5").stroke("#cccccc");

  doc.fontSize(9).font("Helvetica-Bold").fillColor("#333333");
  doc.text("Installment", 70, tableTop + 8);
  doc.text("Due Date", 220, tableTop + 8);
  doc.text("Amount", 340, tableTop + 8);
  doc.text("Status", 450, tableTop + 8);

  // Table row
  const rowTop = tableTop + 25;
  doc.rect(60, rowTop, 475, 25).stroke("#cccccc");

  doc.fontSize(9).font("Helvetica").fillColor("#000000");
  doc.text(
    `Installment ${receipt.installment.installmentNumber}`,
    70,
    rowTop + 8,
  );
  doc.text(formatDate(receipt.installment.dueDate), 220, rowTop + 8);
  doc.text(formatCurrency(receipt.amount), 340, rowTop + 8);
  doc
    .font("Helvetica-Bold")
    .fillColor(receipt.installment.status === "paid" ? "#22c55e" : "#f59e0b")
    .text(receipt.installment.status.toUpperCase(), 450, rowTop + 8);

  // Payment summary
  doc.y = paymentBoxTop + 140;
  const summaryTop = doc.y;

  doc.rect(320, summaryTop, 225, 70).fill("#f5f5f5").stroke("#cccccc");

  doc.fontSize(10).font("Helvetica").fillColor("#000000");
  doc.text("Payment Mode:", 330, summaryTop + 10);
  doc
    .font("Helvetica-Bold")
    .text(formatPaymentMode(receipt.paymentMode), 440, summaryTop + 10);

  doc.font("Helvetica").text("Amount Paid:", 330, summaryTop + 30);
  doc
    .font("Helvetica-Bold")
    .fontSize(14)
    .text(formatCurrency(receipt.amount), 440, summaryTop + 28);

  doc
    .fontSize(10)
    .font("Helvetica")
    .text("Received By:", 330, summaryTop + 52);
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
    .text(
      "This is a computer-generated receipt and does not require a signature.",
      50,
      doc.y,
      {
        align: "center",
        width: pageWidth,
      },
    );

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

/**
 * Generate payment summary PDF for an installment payment
 * Returns a readable stream; scope-checked by tenant/branch via student
 */
export async function generatePaymentSummaryPDF(
  paymentId: string,
  scope: TenantScope,
): Promise<{ stream: Readable; fileName: string } | null> {
  const payment = await prisma.installmentPayment.findFirst({
    where: { id: paymentId },
    include: {
      installment: {
        include: {
          studentFeeStructure: {
            include: { student: true },
          },
        },
      },
      receivedBy: {
        select: { firstName: true, lastName: true },
      },
    },
  });

  if (
    !payment ||
    payment.installment.studentFeeStructure.student.orgId !== scope.orgId ||
    payment.installment.studentFeeStructure.student.branchId !== scope.branchId
  ) {
    return null;
  }

  const student = payment.installment.studentFeeStructure.student;
  const inst = payment.installment;
  const receivedByName =
    payment.receivedBy &&
    formatFullName(payment.receivedBy.firstName, payment.receivedBy.lastName);

  const doc = new PDFDocument({
    size: "A4",
    margin: 50,
    info: {
      Title: "Payment Summary",
      Author: "Scoops",
    },
  });

  const pageWidth = doc.page.width - 100;

  doc.fontSize(18).font("Helvetica-Bold").text("Payment Summary", 50, 50, {
    align: "center",
    width: pageWidth,
  });

  doc.moveDown(1.5);
  doc.strokeColor("#cccccc").lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(1);

  let y = doc.y;
  const leftLabel = 50;
  const leftValue = 200;

  doc.fontSize(10).font("Helvetica-Bold").text("Date:", leftLabel, y);
  doc.font("Helvetica").text(formatDate(payment.receivedAt), leftValue, y);
  y += 22;

  doc.font("Helvetica-Bold").text("Installment:", leftLabel, y);
  doc.font("Helvetica").text(`#${inst.installmentNumber}`, leftValue, y);
  y += 22;

  doc.font("Helvetica-Bold").text("Payment mode:", leftLabel, y);
  doc.font("Helvetica").text(formatPaymentMode(payment.paymentMode), leftValue, y);
  y += 22;

  doc.font("Helvetica-Bold").text("Reference:", leftLabel, y);
  doc.font("Helvetica").text(payment.transactionRef || "—", leftValue, y);
  y += 22;

  doc.font("Helvetica-Bold").text("Amount:", leftLabel, y);
  doc.font("Helvetica").text(formatCurrency(payment.amount), leftValue, y);
  y += 22;

  doc.font("Helvetica-Bold").text("Remarks:", leftLabel, y);
  doc.font("Helvetica").text(payment.remarks || "—", leftValue, y);
  y += 22;

  if (receivedByName) {
    doc.font("Helvetica-Bold").text("Received by:", leftLabel, y);
    doc.font("Helvetica").text(receivedByName, leftValue, y);
  }

  doc.moveDown(2);
  doc.fontSize(9).font("Helvetica").text(`Student: ${formatFullName(student.firstName, student.lastName)}`, 50, doc.y, { width: pageWidth });
  doc.text(`Generated on: ${formatDate(new Date())}`, 50, doc.y, { align: "center", width: pageWidth });

  doc.end();

  const fileName = `Payment_Summary_${paymentId}.pdf`;
  return { stream: doc as unknown as Readable, fileName };
}
