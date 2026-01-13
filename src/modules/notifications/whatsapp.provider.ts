/**
 * WhatsApp Provider (STUB)
 *
 * This is a placeholder for the actual WhatsApp provider integration.
 * Replace with actual SDK (Twilio, Gupshup, Meta Business API) when ready.
 */

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
 * Send WhatsApp message (STUB)
 *
 * TODO: Replace with actual provider SDK integration
 * - Twilio: client.messages.create()
 * - Gupshup: axios.post()
 * - Meta Business API: axios.post()
 */
export async function sendWhatsAppMessage(
  message: WhatsAppMessage
): Promise<WhatsAppResult> {
  // STUB: Log the message that would be sent
  console.log("WhatsApp STUB - Would send message:", {
    to: message.to,
    template: message.templateName,
    params: message.templateParams,
  });

  // Simulate success for development
  // In production, this would call the actual provider API
  return {
    success: true,
    messageId: `stub_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    error: null,
  };
}

/**
 * Validate phone number format (India)
 */
export function isValidIndianPhone(phone: string): boolean {
  // Remove spaces and dashes
  const cleaned = phone.replace(/[\s-]/g, "");

  // Check for valid Indian mobile number
  // With or without country code
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
