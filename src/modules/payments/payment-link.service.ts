/**
 * Payment Link Service
 *
 * Handles creation, management, and verification of payment links
 * Updated to work with FeeInstallment instead of legacy StudentFee
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
import {
  createRazorpayPaymentLink,
  isRazorpayConfigured,
} from "./razorpay.provider.js";
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
 * Create payment link input - now uses installmentId
 */
export interface CreatePaymentLinkInput {
  installmentId: string;
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
 * Create a new payment link for a fee installment
 */
export async function createPaymentLink(
  input: CreatePaymentLinkInput,
  userId: string,
  scope: TenantScope,
) {
  // Get the installment with student and parent info
  const installment = await prisma.feeInstallment.findFirst({
    where: {
      id: input.installmentId,
      studentFeeStructure: {
        student: {
          orgId: scope.orgId,
          branchId: scope.branchId,
        },
      },
    },
    include: {
      studentFeeStructure: {
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
              batch: {
                select: {
                  name: true,
                },
              },
            },
          },
          session: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!installment) {
    throw new NotFoundError("Fee installment");
  }

  // Calculate pending amount
  const pendingAmount = installment.amount - installment.paidAmount;

  if (pendingAmount <= 0) {
    throw new BadRequestError("Installment is already fully paid");
  }

  // Check if there's an existing active link for this installment
  const existingLink = await prisma.paymentLink.findFirst({
    where: {
      installmentId: installment.id,
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
  const student = installment.studentFeeStructure.student;
  const parent = student.studentParents[0]?.parent;
  const studentName = formatFullName(student.firstName, student.lastName);
  const parentName = parent
    ? formatFullName(parent.firstName, parent.lastName)
    : studentName;
  const parentPhone = parent?.phone || "";
  const parentEmail = parent?.email || undefined;

  // Description for payment
  const sessionName = installment.studentFeeStructure.session.name;
  const description =
    input.description ||
    `Fee payment for ${studentName} - Installment ${installment.installmentNumber} (${sessionName})`;

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
      installmentId: installment.id,
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
      installment: {
        include: {
          studentFeeStructure: {
            include: {
              student: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
              session: {
                select: {
                  name: true,
                },
              },
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
    sessionName,
    installmentNumber: installment.installmentNumber,
  };
}

/**
 * Get payment link by short code (public - no auth required)
 */
export async function getPaymentLinkByShortCode(shortCode: string) {
  const paymentLink = await prisma.paymentLink.findUnique({
    where: { shortCode },
    include: {
      installment: {
        include: {
          studentFeeStructure: {
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
              session: {
                select: {
                  name: true,
                },
              },
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
    student: paymentLink.installment
      ? {
          name: formatFullName(
            paymentLink.installment.studentFeeStructure.student.firstName,
            paymentLink.installment.studentFeeStructure.student.lastName,
          ),
          batchName:
            paymentLink.installment.studentFeeStructure.student.batch?.name,
        }
      : null,
    session: paymentLink.installment?.studentFeeStructure.session?.name ?? null,
    installmentNumber: paymentLink.installment?.installmentNumber ?? null,
    organization: org,
  };
}

/**
 * Get payment links for a branch
 */
export async function getPaymentLinks(
  scope: TenantScope,
  pagination: PaginationParams,
  filters?: PaymentLinkFilters,
) {
  const where: any = {
    orgId: scope.orgId,
    branchId: scope.branchId,
  };

  if (filters?.status) {
    where.status = filters.status;
  }

  if (filters?.studentId) {
    where.installment = {
      studentFeeStructure: {
        studentId: filters.studentId,
      },
    };
  }

  if (filters?.search) {
    where.OR = [
      { shortCode: { contains: filters.search, mode: "insensitive" } },
      {
        installment: {
          studentFeeStructure: {
            student: {
              OR: [
                {
                  firstName: { contains: filters.search, mode: "insensitive" },
                },
                { lastName: { contains: filters.search, mode: "insensitive" } },
              ],
            },
          },
        },
      },
    ];
  }

  const [links, total] = await Promise.all([
    prisma.paymentLink.findMany({
      where,
      include: {
        installment: {
          include: {
            studentFeeStructure: {
              include: {
                student: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
                session: {
                  select: {
                    name: true,
                  },
                },
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
      paymentUrl:
        link.razorpayUrl || `${env.APP_BASE_URL}/pay/${link.shortCode}`,
      studentName: link.installment
        ? formatFullName(
            link.installment.studentFeeStructure.student.firstName,
            link.installment.studentFeeStructure.student.lastName,
          )
        : "N/A",
      sessionName: link.installment?.studentFeeStructure.session?.name ?? "N/A",
      installmentNumber: link.installment?.installmentNumber ?? null,
      createdBy: formatFullName(
        link.createdBy.firstName,
        link.createdBy.lastName,
      ),
    })),
    total,
    pagination,
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
      installment: {
        include: {
          studentFeeStructure: {
            include: {
              student: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
              session: {
                select: {
                  name: true,
                },
              },
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
    paymentUrl:
      paymentLink.razorpayUrl ||
      `${env.APP_BASE_URL}/pay/${paymentLink.shortCode}`,
    studentName: paymentLink.installment
      ? formatFullName(
          paymentLink.installment.studentFeeStructure.student.firstName,
          paymentLink.installment.studentFeeStructure.student.lastName,
        )
      : "N/A",
    sessionName:
      paymentLink.installment?.studentFeeStructure.session?.name ?? "N/A",
    installmentNumber: paymentLink.installment?.installmentNumber ?? null,
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
 * Creates InstallmentPayment record and updates installment status
 */
export async function markPaymentLinkPaid(
  shortCode: string,
  razorpayPaymentId?: string,
) {
  const paymentLink = await prisma.paymentLink.findUnique({
    where: { shortCode },
    include: {
      installment: true,
    },
  });

  if (!paymentLink) {
    throw new NotFoundError("Payment link");
  }

  if (paymentLink.status !== "active") {
    console.warn(
      `Payment link ${shortCode} is not active (status: ${paymentLink.status})`,
    );
    return paymentLink;
  }

  // Use transaction to update payment link and create InstallmentPayment
  const result = await prisma.$transaction(async (tx) => {
    // Update payment link status
    const updatedLink = await tx.paymentLink.update({
      where: { id: paymentLink.id },
      data: {
        status: "paid",
        paidAt: new Date(),
      },
    });

    // Create InstallmentPayment record if installment exists
    if (paymentLink.installmentId && paymentLink.installment) {
      const installment = paymentLink.installment;

      // Create InstallmentPayment
      await tx.installmentPayment.create({
        data: {
          installmentId: paymentLink.installmentId,
          amount: paymentLink.amount,
          paymentMode: "upi", // Online payments are typically UPI
          transactionRef: razorpayPaymentId || null,
          receivedById: paymentLink.createdById,
          remarks: `Online payment via payment link ${shortCode}`,
        },
      });

      // Update installment paid amount and status
      const newPaidAmount = installment.paidAmount + paymentLink.amount;
      let newStatus: "upcoming" | "due" | "overdue" | "partial" | "paid";

      if (newPaidAmount >= installment.amount) {
        newStatus = "paid";
      } else if (newPaidAmount > 0) {
        newStatus = "partial";
      } else {
        newStatus = installment.status;
      }

      await tx.feeInstallment.update({
        where: { id: paymentLink.installmentId },
        data: {
          paidAmount: newPaidAmount,
          status: newStatus,
        },
      });
    }

    return updatedLink;
  });

  return result;
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
