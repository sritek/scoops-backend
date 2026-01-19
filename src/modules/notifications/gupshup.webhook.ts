/**
 * Gupshup Webhook Handler
 *
 * Handles:
 * - Delivery receipts (message status updates)
 * - Incoming messages (user replies)
 */

import { prisma } from "../../config/database.js";
import { env } from "../../config/env.js";

/**
 * Gupshup webhook payload for delivery receipts
 */
interface GupshupDeliveryReceipt {
  type: "message-event";
  payload: {
    id: string;
    type: "enqueued" | "delivered" | "read" | "failed";
    destination: string;
    timestamp?: string;
    error?: {
      code: string;
      message: string;
    };
  };
}

/**
 * Gupshup webhook payload for incoming messages
 */
interface GupshupIncomingMessage {
  type: "message";
  payload: {
    id: string;
    source: string;
    type: "text" | "image" | "document" | "location" | "contact";
    text?: string;
    context?: {
      id: string;
    };
  };
}

type GupshupWebhookPayload = GupshupDeliveryReceipt | GupshupIncomingMessage;

/**
 * Verify Gupshup webhook signature (if secret is configured)
 */
export function verifyWebhookSignature(
  signature: string | undefined,
  body: string
): boolean {
  const secret = env.GUPSHUP_WEBHOOK_SECRET;

  // If no secret configured, skip verification (development)
  if (!secret) {
    console.warn("Gupshup webhook secret not configured - skipping verification");
    return true;
  }

  // Gupshup uses HMAC-SHA256 for signature
  // Note: Actual implementation depends on Gupshup's specific signature method
  // This is a placeholder - check Gupshup docs for exact implementation
  if (!signature) {
    return false;
  }

  // For now, just check if signature is provided
  // TODO: Implement proper HMAC verification when Gupshup docs confirm format
  return true;
}

/**
 * Process Gupshup webhook payload
 */
export async function processWebhook(
  payload: GupshupWebhookPayload
): Promise<void> {
  if (payload.type === "message-event") {
    await processDeliveryReceipt(payload);
  } else if (payload.type === "message") {
    await processIncomingMessage(payload);
  }
}

/**
 * Process delivery receipt
 * Updates notification log with delivery status
 */
async function processDeliveryReceipt(
  receipt: GupshupDeliveryReceipt
): Promise<void> {
  const { id, type, destination, error } = receipt.payload;

  console.log("Gupshup delivery receipt:", { id, type, destination });

  try {
    // Find notification by provider message ID
    const notification = await prisma.notificationLog.findFirst({
      where: {
        providerMessageId: id,
      },
    });

    if (!notification) {
      console.warn(`No notification found for message ID: ${id}`);
      return;
    }

    // Map Gupshup status to our status
    let status = notification.status;
    let errorMessage = notification.errorMessage;

    switch (type) {
      case "delivered":
      case "read":
        status = "sent";
        break;
      case "failed":
        status = "failed";
        errorMessage = error?.message || "Delivery failed";
        break;
      case "enqueued":
        // Keep existing status
        break;
    }

    // Update notification log
    await prisma.notificationLog.update({
      where: { id: notification.id },
      data: {
        status,
        errorMessage,
        // Store delivery timestamp if available
        metadata: {
          ...(notification.metadata as object || {}),
          deliveryStatus: type,
          deliveryTimestamp: receipt.payload.timestamp,
        },
      },
    });
  } catch (err) {
    console.error("Error processing delivery receipt:", err);
  }
}

/**
 * Process incoming message
 * Could be used for:
 * - Parent replies to notifications
 * - OTP verification responses
 * - Complaint submissions
 */
async function processIncomingMessage(
  message: GupshupIncomingMessage
): Promise<void> {
  const { source, text, context } = message.payload;

  console.log("Gupshup incoming message:", {
    from: source,
    text,
    replyTo: context?.id,
  });

  // Normalize phone number for lookup
  const normalizedPhone = `+${source.replace(/^\+/, "")}`;

  try {
    // Find parent by phone number
    const parent = await prisma.parent.findFirst({
      where: {
        phone: {
          contains: source.slice(-10), // Match last 10 digits
        },
      },
    });

    if (!parent) {
      console.log(`No parent found for phone: ${source}`);
      return;
    }

    // Log incoming message for reference
    // This could be expanded to handle specific keywords or flows
    console.log("Incoming message from parent:", {
      parentId: parent.id,
      phone: normalizedPhone,
      text,
    });

    // Future enhancements:
    // - Parse keywords like "CONFIRM", "STOP", etc.
    // - Create complaint tickets
    // - Handle OTP verification
    // - Auto-reply with information
  } catch (err) {
    console.error("Error processing incoming message:", err);
  }
}

/**
 * Handle webhook request (for routes)
 */
export interface WebhookRequest {
  headers: {
    "x-gupshup-signature"?: string;
  };
  body: GupshupWebhookPayload;
  rawBody: string;
}

export async function handleWebhook(request: WebhookRequest): Promise<{
  success: boolean;
  message: string;
}> {
  // Verify signature
  const signature = request.headers["x-gupshup-signature"];
  if (!verifyWebhookSignature(signature, request.rawBody)) {
    return {
      success: false,
      message: "Invalid signature",
    };
  }

  // Process webhook
  try {
    await processWebhook(request.body);
    return {
      success: true,
      message: "Webhook processed",
    };
  } catch (err) {
    console.error("Webhook processing error:", err);
    return {
      success: false,
      message: "Processing error",
    };
  }
}
