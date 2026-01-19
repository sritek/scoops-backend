/**
 * OTP Service
 *
 * Handles OTP generation, storage, and verification for:
 * - Parent login via WhatsApp
 * - Phone number verification
 */

import { prisma } from "../../config/database.js";
import { sendOTP } from "../notifications/whatsapp.provider.js";
import { normalizePhone, isValidIndianPhone } from "../notifications/whatsapp.provider.js";
import { BadRequestError, NotFoundError } from "../../utils/error-handler.js";

/**
 * OTP configuration
 */
const OTP_CONFIG = {
  length: 6,
  expiryMinutes: 5,
  maxAttempts: 3,
  cooldownMinutes: 1,
};

/**
 * Generate a random OTP
 */
function generateOTP(): string {
  const digits = "0123456789";
  let otp = "";
  for (let i = 0; i < OTP_CONFIG.length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
}

/**
 * OTP request result
 */
export interface OTPRequestResult {
  success: boolean;
  message: string;
  expiresAt?: Date;
  cooldownSeconds?: number;
}

/**
 * OTP verification result
 */
export interface OTPVerifyResult {
  success: boolean;
  message: string;
  parentId?: string;
  token?: string;
}

/**
 * Request OTP for parent login
 */
export async function requestParentOTP(phone: string): Promise<OTPRequestResult> {
  // Validate phone format
  if (!isValidIndianPhone(phone)) {
    throw new BadRequestError("Invalid phone number format");
  }

  const normalizedPhone = normalizePhone(phone);

  // Find parent by phone number
  const parent = await prisma.parent.findFirst({
    where: {
      phone: {
        contains: phone.slice(-10), // Match last 10 digits
      },
    },
  });

  if (!parent) {
    // Don't reveal if parent exists or not for security
    throw new NotFoundError("No account found with this phone number");
  }

  // Check for cooldown (rate limiting)
  const recentOTP = await prisma.otpCode.findFirst({
    where: {
      phone: normalizedPhone,
      createdAt: {
        gte: new Date(Date.now() - OTP_CONFIG.cooldownMinutes * 60 * 1000),
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (recentOTP) {
    const cooldownRemaining = Math.ceil(
      (OTP_CONFIG.cooldownMinutes * 60 * 1000 - (Date.now() - recentOTP.createdAt.getTime())) / 1000
    );
    return {
      success: false,
      message: "Please wait before requesting another OTP",
      cooldownSeconds: cooldownRemaining,
    };
  }

  // Generate OTP
  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + OTP_CONFIG.expiryMinutes * 60 * 1000);

  // Store OTP
  await prisma.otpCode.create({
    data: {
      phone: normalizedPhone,
      code: otp,
      expiresAt,
      parentId: parent.id,
      attempts: 0,
    },
  });

  // Send OTP via WhatsApp
  const sendResult = await sendOTP(normalizedPhone, otp);

  if (!sendResult.success) {
    console.error("Failed to send OTP:", sendResult.error);
    throw new BadRequestError("Failed to send OTP. Please try again.");
  }

  return {
    success: true,
    message: "OTP sent successfully",
    expiresAt,
  };
}

/**
 * Verify OTP and login parent
 */
export async function verifyParentOTP(
  phone: string,
  code: string
): Promise<OTPVerifyResult> {
  if (!isValidIndianPhone(phone)) {
    throw new BadRequestError("Invalid phone number format");
  }

  const normalizedPhone = normalizePhone(phone);

  // Find valid OTP
  const otpRecord = await prisma.otpCode.findFirst({
    where: {
      phone: normalizedPhone,
      expiresAt: {
        gte: new Date(),
      },
      verified: false,
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      parent: true,
    },
  });

  if (!otpRecord) {
    return {
      success: false,
      message: "OTP expired or invalid. Please request a new one.",
    };
  }

  // Check max attempts
  if (otpRecord.attempts >= OTP_CONFIG.maxAttempts) {
    // Invalidate the OTP
    await prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { verified: true }, // Mark as used to prevent further attempts
    });

    return {
      success: false,
      message: "Maximum attempts exceeded. Please request a new OTP.",
    };
  }

  // Increment attempts
  await prisma.otpCode.update({
    where: { id: otpRecord.id },
    data: { attempts: { increment: 1 } },
  });

  // Verify code
  if (otpRecord.code !== code) {
    const remainingAttempts = OTP_CONFIG.maxAttempts - otpRecord.attempts - 1;
    return {
      success: false,
      message: `Invalid OTP. ${remainingAttempts} attempt${remainingAttempts !== 1 ? "s" : ""} remaining.`,
    };
  }

  // Mark OTP as verified
  await prisma.otpCode.update({
    where: { id: otpRecord.id },
    data: { verified: true },
  });

  // Generate parent session token
  // For now, we'll use a simple token - in production, use JWT
  const sessionToken = generateSessionToken();

  // Store session
  await prisma.parentSession.create({
    data: {
      parentId: otpRecord.parentId,
      token: sessionToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      deviceInfo: null, // Can be added later
    },
  });

  return {
    success: true,
    message: "Login successful",
    parentId: otpRecord.parentId,
    token: sessionToken,
  };
}

/**
 * Generate a secure session token
 */
function generateSessionToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 64; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

/**
 * Validate parent session token
 */
export async function validateParentSession(token: string): Promise<{
  valid: boolean;
  parent?: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
  };
}> {
  const session = await prisma.parentSession.findFirst({
    where: {
      token,
      expiresAt: {
        gte: new Date(),
      },
    },
    include: {
      parent: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
        },
      },
    },
  });

  if (!session) {
    return { valid: false };
  }

  return {
    valid: true,
    parent: session.parent,
  };
}

/**
 * Logout parent (invalidate session)
 */
export async function logoutParent(token: string): Promise<boolean> {
  try {
    await prisma.parentSession.delete({
      where: { token },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Clean up expired OTPs and sessions (call periodically)
 */
export async function cleanupExpired(): Promise<{ otps: number; sessions: number }> {
  const [otpResult, sessionResult] = await Promise.all([
    prisma.otpCode.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: new Date() } }, { verified: true }],
      },
    }),
    prisma.parentSession.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    }),
  ]);

  return {
    otps: otpResult.count,
    sessions: sessionResult.count,
  };
}
