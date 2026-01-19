/**
 * WhatsApp Provider
 *
 * Supports two modes:
 * - "stub": Development mode - logs messages to console
 * - "gupshup": Production mode - sends via Gupshup API
 *
 * Set WHATSAPP_MODE environment variable to switch modes.
 */

import { env } from "../../config/env.js";

export interface WhatsAppMessage {
  to: string;
  templateName: string;
  templateParams: Record<string, string>;
}

export interface WhatsAppResult {
  success: boolean;
  messageId: string | null;
  error: string | null;
}

/**
 * Gupshup API response type
 */
interface GupshupResponse {
  status: "submitted" | "error";
  messageId?: string;
  message?: string;
}

/**
 * Send WhatsApp message
 * Routes to stub or Gupshup based on WHATSAPP_MODE env variable
 */
export async function sendWhatsAppMessage(
  message: WhatsAppMessage
): Promise<WhatsAppResult> {
  if (env.WHATSAPP_MODE === "gupshup") {
    return sendViaGupshup(message);
  }
  return sendViaStub(message);
}

/**
 * Send WhatsApp message via stub (development)
 */
async function sendViaStub(message: WhatsAppMessage): Promise<WhatsAppResult> {
  console.log("WhatsApp STUB - Would send message:", {
    to: message.to,
    template: message.templateName,
    params: message.templateParams,
  });

  return {
    success: true,
    messageId: `stub_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    error: null,
  };
}

/**
 * Send WhatsApp message via Gupshup API
 *
 * Gupshup Template API:
 * https://docs.gupshup.io/docs/whatsapp-template-messages
 */
async function sendViaGupshup(
  message: WhatsAppMessage
): Promise<WhatsAppResult> {
  const apiKey = env.GUPSHUP_API_KEY;
  const appName = env.GUPSHUP_APP_NAME;
  const sourceNumber = env.GUPSHUP_SOURCE_NUMBER;

  // Validate configuration
  if (!apiKey || !appName || !sourceNumber) {
    console.error("Gupshup configuration incomplete. Required: GUPSHUP_API_KEY, GUPSHUP_APP_NAME, GUPSHUP_SOURCE_NUMBER");
    return {
      success: false,
      messageId: null,
      error: "Gupshup configuration incomplete",
    };
  }

  try {
    // Build template message payload
    const templatePayload = {
      id: message.templateName,
      params: Object.values(message.templateParams),
    };

    // Gupshup API endpoint for template messages
    const url = "https://api.gupshup.io/wa/api/v1/template/msg";

    // Build form data (Gupshup uses application/x-www-form-urlencoded)
    const formData = new URLSearchParams();
    formData.append("channel", "whatsapp");
    formData.append("source", sourceNumber);
    formData.append("destination", message.to.replace(/^\+/, "")); // Remove + prefix
    formData.append("src.name", appName);
    formData.append("template", JSON.stringify(templatePayload));

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        apikey: apiKey,
      },
      body: formData.toString(),
    });

    const data = (await response.json()) as GupshupResponse;

    if (data.status === "submitted") {
      console.log("Gupshup message sent:", {
        to: message.to,
        messageId: data.messageId,
      });
      return {
        success: true,
        messageId: data.messageId || null,
        error: null,
      };
    } else {
      console.error("Gupshup error:", data.message);
      return {
        success: false,
        messageId: null,
        error: data.message || "Unknown Gupshup error",
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Gupshup API call failed:", errorMessage);
    return {
      success: false,
      messageId: null,
      error: errorMessage,
    };
  }
}

/**
 * Send OTP via WhatsApp
 * Uses a dedicated OTP template
 */
export async function sendOTP(phone: string, otp: string): Promise<WhatsAppResult> {
  return sendWhatsAppMessage({
    to: normalizePhone(phone),
    templateName: "otp_verification",
    templateParams: {
      otp,
    },
  });
}

/**
 * Send simple text message (for testing/broadcasts)
 * Note: Gupshup requires pre-approved templates for business messages
 */
export async function sendTextMessage(
  phone: string,
  text: string
): Promise<WhatsAppResult> {
  if (env.WHATSAPP_MODE === "gupshup") {
    return sendTextViaGupshup(phone, text);
  }

  // Stub mode
  console.log("WhatsApp STUB - Would send text:", { to: phone, text });
  return {
    success: true,
    messageId: `stub_${Date.now()}`,
    error: null,
  };
}

/**
 * Send text message via Gupshup
 * Note: Only works within 24-hour session window
 */
async function sendTextViaGupshup(
  phone: string,
  text: string
): Promise<WhatsAppResult> {
  const apiKey = env.GUPSHUP_API_KEY;
  const appName = env.GUPSHUP_APP_NAME;
  const sourceNumber = env.GUPSHUP_SOURCE_NUMBER;

  if (!apiKey || !appName || !sourceNumber) {
    return {
      success: false,
      messageId: null,
      error: "Gupshup configuration incomplete",
    };
  }

  try {
    const url = "https://api.gupshup.io/wa/api/v1/msg";

    const formData = new URLSearchParams();
    formData.append("channel", "whatsapp");
    formData.append("source", sourceNumber);
    formData.append("destination", phone.replace(/^\+/, ""));
    formData.append("src.name", appName);
    formData.append(
      "message",
      JSON.stringify({
        type: "text",
        text,
      })
    );

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        apikey: apiKey,
      },
      body: formData.toString(),
    });

    const data = (await response.json()) as GupshupResponse;

    if (data.status === "submitted") {
      return {
        success: true,
        messageId: data.messageId || null,
        error: null,
      };
    } else {
      return {
        success: false,
        messageId: null,
        error: data.message || "Unknown error",
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      messageId: null,
      error: errorMessage,
    };
  }
}

/**
 * Validate phone number format (India)
 */
export function isValidIndianPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s-]/g, "");

  const patterns = [
    /^[6-9]\d{9}$/, // 10 digits starting with 6-9
    /^91[6-9]\d{9}$/, // With 91 prefix
    /^\+91[6-9]\d{9}$/, // With +91 prefix
  ];

  return patterns.some((pattern) => pattern.test(cleaned));
}

/**
 * Normalize phone number to E.164 format (for India)
 */
export function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[\s-+]/g, "");

  if (cleaned.startsWith("91") && cleaned.length === 12) {
    return `+${cleaned}`;
  }

  if (cleaned.length === 10) {
    return `+91${cleaned}`;
  }

  return `+${cleaned}`;
}
