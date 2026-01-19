/**
 * Razorpay Provider
 *
 * Handles Razorpay API integration for payment links
 */

import Razorpay from "razorpay";
import crypto from "crypto";
import { env } from "../../config/env.js";

/**
 * Razorpay instance (singleton)
 */
let razorpayInstance: Razorpay | null = null;

/**
 * Get or create Razorpay instance
 */
export function getRazorpay(): Razorpay | null {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    console.warn("Razorpay credentials not configured");
    return null;
  }

  if (!razorpayInstance) {
    razorpayInstance = new Razorpay({
      key_id: env.RAZORPAY_KEY_ID,
      key_secret: env.RAZORPAY_KEY_SECRET,
    });
  }

  return razorpayInstance;
}

/**
 * Check if Razorpay is configured
 */
export function isRazorpayConfigured(): boolean {
  return !!(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
}

/**
 * Payment link creation options
 */
export interface CreatePaymentLinkOptions {
  amount: number; // Amount in paise (1 INR = 100 paise)
  currency?: string;
  description: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  referenceId: string; // Our internal payment link ID
  callbackUrl?: string;
  expireBy?: number; // Unix timestamp
}

/**
 * Razorpay payment link response
 */
export interface PaymentLinkResponse {
  id: string;
  short_url: string;
  status: string;
}

/**
 * Create a Razorpay payment link
 */
export async function createRazorpayPaymentLink(
  options: CreatePaymentLinkOptions
): Promise<PaymentLinkResponse | null> {
  const razorpay = getRazorpay();

  if (!razorpay) {
    console.warn("Razorpay not configured - using stub mode");
    // Return a stub response for development
    return {
      id: `stub_${Date.now()}`,
      short_url: `${env.APP_BASE_URL}/pay/${options.referenceId}`,
      status: "created",
    };
  }

  try {
    const paymentLink = await razorpay.paymentLink.create({
      amount: options.amount,
      currency: options.currency || "INR",
      description: options.description,
      customer: {
        name: options.customerName,
        contact: options.customerPhone,
        email: options.customerEmail,
      },
      reference_id: options.referenceId,
      callback_url: options.callbackUrl,
      callback_method: "get",
      expire_by: options.expireBy,
      notify: {
        sms: true,
        email: !!options.customerEmail,
      },
    });

    return {
      id: paymentLink.id,
      short_url: paymentLink.short_url,
      status: paymentLink.status,
    };
  } catch (error) {
    console.error("Failed to create Razorpay payment link:", error);
    throw error;
  }
}

/**
 * Verify Razorpay webhook signature
 */
export function verifyWebhookSignature(
  body: string,
  signature: string
): boolean {
  const secret = env.RAZORPAY_WEBHOOK_SECRET;

  if (!secret) {
    console.warn("Razorpay webhook secret not configured");
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Razorpay webhook event types
 */
export const RAZORPAY_EVENTS = {
  PAYMENT_LINK_PAID: "payment_link.paid",
  PAYMENT_LINK_EXPIRED: "payment_link.expired",
  PAYMENT_LINK_CANCELLED: "payment_link.cancelled",
} as const;

/**
 * Razorpay webhook payload
 */
export interface RazorpayWebhookPayload {
  event: string;
  payload: {
    payment_link: {
      entity: {
        id: string;
        reference_id: string;
        status: string;
        amount: number;
        amount_paid: number;
      };
    };
    payment?: {
      entity: {
        id: string;
        amount: number;
        method: string;
        status: string;
      };
    };
  };
}

/**
 * Get payment link status from Razorpay
 */
export async function getPaymentLinkStatus(
  paymentLinkId: string
): Promise<{ status: string; amountPaid: number } | null> {
  const razorpay = getRazorpay();

  if (!razorpay) {
    return null;
  }

  try {
    const paymentLink = await razorpay.paymentLink.fetch(paymentLinkId);
    return {
      status: paymentLink.status,
      amountPaid: paymentLink.amount_paid,
    };
  } catch (error) {
    console.error("Failed to fetch Razorpay payment link:", error);
    return null;
  }
}
