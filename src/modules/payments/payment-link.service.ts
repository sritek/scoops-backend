/**
 * Payment Link Service
 *
 * Handles creation, management, and verification of payment links
 */

import { prisma } from "../../config/database.js";
import { env } from "../../config/env.js";
import type { TenantScope } from "../../types/request.js";
import { NotFoundError, BadRequestError } from "../../utils/error-handler.js";
import {
  type PaginationParams,
  createPaginatedResponse,
  calculateSkip,
} from "../../utils/pagination.js";
import { createRazorpayPaymentLink, isRazorpayConfigured } from "./razorpay.provider.js";
import { randomBytes } from "crypto";

/**
 * Generate a short code for payment link URLs
 */
function generateShortCode(): string {
  return randomBytes(6).toString("base64url").substring(0, 8);
}

/**
 * Helper to format full name
 */
function formatFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

/**
 * Create payment link input
 */
export interface CreatePaymentLinkInput {
  studentFeeId: string;
  expiresInDays?: number; // Default: 7 days
  description?: string;
}

/**
 * Payment link filters
 */
export interface PaymentLinkFilters {
  status?: string;
  studentId?: string;
  search?: string;
}

/**
 * Create a new payment link for a student fee
 */
export async function createPaymentLink(
  input: CreatePaymentLinkInput,
  userId: string,
  scope: TenantScope
) {
  // Get the student fee with student and parent info
  const studentFee = await prisma.studentFee.findFirst({
    where: {
      id: input.studentFeeId,
      student: {
        orgId: scope.orgId,
        branchId: scope.branchId,
      },
    },
    include: {
      student: {
        include: {
          studentParents: {
            include: {
              parent: {
                select: {
                  firstName: true,
                  lastName: true,
                  phone: true,
                  email: true,
                },
              },
            },
            take: 1,
          },
        },
      },
      feePlan: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!studentFee) {
    throw new NotFoundError("Student fee");
  }

  // Calculate pending amount
  const pendingAmount = studentFee.totalAmount - studentFee.paidAmount;

  if (pendingAmount <= 0) {
    throw new BadRequestError("Fee is already fully paid");
  }

  // Check if there's an existing active link
  const existingLink = await prisma.paymentLink.findFirst({
    where: {
      studentFeeId: studentFee.id,
      status: "active",
      expiresAt: {
        gt: new Date(),
      },
    },
  });

  if (existingLink) {
    // Return existing link instead of creating new one
    return existingLink;
  }

  // Generate short code
  const shortCode = generateShortCode();

  // Calculate expiry date
  const expiresInDays = input.expiresInDays || 7;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  // Get parent info for Razorpay
  const parent = studentFee.student.studentParents[0]?.parent;
  const studentName = formatFullName(
    studentFee.student.firstName,
    studentFee.student.lastName
  );
  const parentName = parent
    ? formatFullName(parent.firstName, parent.lastName)
    : studentName;
  const parentPhone = parent?.phone || "";
  const parentEmail = parent?.email || undefined;

  // Description for payment
  const description =
    input.description ||
    `Fee payment for ${studentName} - ${studentFee.feePlan.name}`;

  // Create Razorpay payment link (or stub)
  let razorpayLinkId: string | null = null;
  let razorpayUrl: string | null = null;

  if (isRazorpayConfigured()) {
    try {
      const razorpayLink = await createRazorpayPaymentLink({
        amount: pendingAmount * 100, // Convert to paise
        description,
        customerName: parentName,
        customerPhone: parentPhone,
        customerEmail: parentEmail,
        referenceId: shortCode,
        callbackUrl: `${env.APP_BASE_URL}/pay/${shortCode}/success`,
        expireBy: Math.floor(expiresAt.getTime() / 1000),
      });

      if (razorpayLink) {
        razorpayLinkId = razorpayLink.id;
        razorpayUrl = razorpayLink.short_url;
      }
    } catch (error) {
      console.error("Failed to create Razorpay link:", error);
      // Continue with local link if Razorpay fails
    }
  }

  // Create payment link in database
  const paymentLink = await prisma.paymentLink.create({
    data: {
      orgId: scope.orgId,
      branchId: scope.branchId,
      studentFeeId: studentFee.id,
      shortCode,
      amount: pendingAmount,
      description,
      razorpayLinkId,
      razorpayUrl,
      status: "active",
      expiresAt,
      createdById: userId,
    },
    include: {
      studentFee: {
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          feePlan: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  return {
    ...paymentLink,
    paymentUrl: razorpayUrl || `${env.APP_BASE_URL}/pay/${shortCode}`,
    studentName,
    feePlanName: studentFee.feePlan.name,
  };
}

/**
 * Get payment link by short code (public - no auth required)
 */
export async function getPaymentLinkByShortCode(shortCode: string) {
  const paymentLink = await prisma.paymentLink.findUnique({
    where: { shortCode },
    include: {
      studentFee: {
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              batch: {
                select: {
                  name: true,
                },
              },
            },
          },
          feePlan: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!paymentLink) {
    throw new NotFoundError("Payment link");
  }

  // Get organization info for display
  const org = await prisma.organization.findUnique({
    where: { id: paymentLink.orgId },
    select: {
      name: true,
      logoUrl: true,
    },
  });

  return {
    id: paymentLink.id,
    shortCode: paymentLink.shortCode,
    amount: paymentLink.amount,
    description: paymentLink.description,
    status: paymentLink.status,
    expiresAt: paymentLink.expiresAt,
    razorpayUrl: paymentLink.razorpayUrl,
    student: {
      name: formatFullName(
        paymentLink.studentFee.student.firstName,
        paymentLink.studentFee.student.lastName
      ),
      batchName: paymentLink.studentFee.student.batch?.name,
    },
    feePlan: paymentLink.studentFee.feePlan.name,
    organization: org,
  };
}

/**
 * Get payment links for a branch
 */
export async function getPaymentLinks(
  scope: TenantScope,
  pagination: PaginationParams,
  filters?: PaymentLinkFilters
) {
  const where: any = {
    orgId: scope.orgId,
    branchId: scope.branchId,
  };

  if (filters?.status) {
    where.status = filters.status;
  }

  if (filters?.studentId) {
    where.studentFee = {
      studentId: filters.studentId,
    };
  }

  if (filters?.search) {
    where.OR = [
      { shortCode: { contains: filters.search, mode: "insensitive" } },
      {
        studentFee: {
          student: {
            OR: [
              { firstName: { contains: filters.search, mode: "insensitive" } },
              { lastName: { contains: filters.search, mode: "insensitive" } },
            ],
          },
        },
      },
    ];
  }

  const [links, total] = await Promise.all([
    prisma.paymentLink.findMany({
      where,
      include: {
        studentFee: {
          include: {
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            feePlan: {
              select: {
                name: true,
              },
            },
          },
        },
        createdBy: {
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
    prisma.paymentLink.count({ where }),
  ]);

  return createPaginatedResponse(
    links.map((link) => ({
      id: link.id,
      shortCode: link.shortCode,
      amount: link.amount,
      description: link.description,
      status: link.status,
      expiresAt: link.expiresAt,
      paidAt: link.paidAt,
      createdAt: link.createdAt,
      paymentUrl: link.razorpayUrl || `${env.APP_BASE_URL}/pay/${link.shortCode}`,
      studentName: formatFullName(
        link.studentFee.student.firstName,
        link.studentFee.student.lastName
      ),
      feePlanName: link.studentFee.feePlan.name,
      createdBy: formatFullName(link.createdBy.firstName, link.createdBy.lastName),
    })),
    total,
    pagination
  );
}

/**
 * Get payment link by ID
 */
export async function getPaymentLinkById(id: string, scope: TenantScope) {
  const paymentLink = await prisma.paymentLink.findFirst({
    where: {
      id,
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
    include: {
      studentFee: {
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          feePlan: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!paymentLink) {
    throw new NotFoundError("Payment link");
  }

  return {
    ...paymentLink,
    paymentUrl: paymentLink.razorpayUrl || `${env.APP_BASE_URL}/pay/${paymentLink.shortCode}`,
    studentName: formatFullName(
      paymentLink.studentFee.student.firstName,
      paymentLink.studentFee.student.lastName
    ),
    feePlanName: paymentLink.studentFee.feePlan.name,
  };
}

/**
 * Cancel a payment link
 */
export async function cancelPaymentLink(id: string, scope: TenantScope) {
  const paymentLink = await prisma.paymentLink.findFirst({
    where: {
      id,
      orgId: scope.orgId,
      branchId: scope.branchId,
      status: "active",
    },
  });

  if (!paymentLink) {
    throw new NotFoundError("Payment link");
  }

  return prisma.paymentLink.update({
    where: { id },
    data: { status: "cancelled" },
  });
}

/**
 * Mark payment link as paid (called from webhook)
 */
export async function markPaymentLinkPaid(
  shortCode: string,
  razorpayPaymentId?: string
) {
  const paymentLink = await prisma.paymentLink.findUnique({
    where: { shortCode },
    include: {
      studentFee: true,
    },
  });

  if (!paymentLink) {
    throw new NotFoundError("Payment link");
  }

  if (paymentLink.status !== "active") {
    console.warn(`Payment link ${shortCode} is not active (status: ${paymentLink.status})`);
    return paymentLink;
  }

  // Update payment link status
  const updatedLink = await prisma.paymentLink.update({
    where: { id: paymentLink.id },
    data: {
      status: "paid",
      paidAt: new Date(),
    },
  });

  // Create fee payment record
  // Note: We need a system user ID for online payments - for now, use createdById
  await prisma.feePayment.create({
    data: {
      studentFeeId: paymentLink.studentFeeId,
      amount: paymentLink.amount,
      paymentMode: "upi", // Online payments are typically UPI
      receivedById: paymentLink.createdById,
      receivedAt: new Date(),
    },
  });

  // Update student fee
  const newPaidAmount = paymentLink.studentFee.paidAmount + paymentLink.amount;
  const newStatus =
    newPaidAmount >= paymentLink.studentFee.totalAmount ? "paid" : "partial";

  await prisma.studentFee.update({
    where: { id: paymentLink.studentFeeId },
    data: {
      paidAmount: newPaidAmount,
      status: newStatus,
    },
  });

  return updatedLink;
}

/**
 * Expire old payment links (called by scheduled job)
 */
export async function expireOldPaymentLinks(): Promise<number> {
  const result = await prisma.paymentLink.updateMany({
    where: {
      status: "active",
      expiresAt: {
        lt: new Date(),
      },
    },
    data: {
      status: "expired",
    },
  });

  return result.count;
}
