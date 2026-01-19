/**
 * Razorpay Webhook Handler
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  verifyWebhookSignature,
  RAZORPAY_EVENTS,
  type RazorpayWebhookPayload,
} from "./razorpay.provider.js";
import { markPaymentLinkPaid } from "./payment-link.service.js";
import { prisma } from "../../config/database.js";

/**
 * Process Razorpay webhook
 */
async function processWebhook(payload: RazorpayWebhookPayload): Promise<void> {
  const { event } = payload;

  console.log("Razorpay webhook received:", event);

  switch (event) {
    case RAZORPAY_EVENTS.PAYMENT_LINK_PAID: {
      const paymentLink = payload.payload.payment_link.entity;
      const referenceId = paymentLink.reference_id;

      console.log("Payment link paid:", {
        referenceId,
        amount: paymentLink.amount_paid,
      });

      try {
        await markPaymentLinkPaid(
          referenceId,
          payload.payload.payment?.entity.id
        );
        console.log("Payment link marked as paid:", referenceId);
      } catch (error) {
        console.error("Failed to mark payment link as paid:", error);
      }
      break;
    }

    case RAZORPAY_EVENTS.PAYMENT_LINK_EXPIRED: {
      const paymentLink = payload.payload.payment_link.entity;
      const referenceId = paymentLink.reference_id;

      console.log("Payment link expired:", referenceId);

      try {
        await prisma.paymentLink.updateMany({
          where: {
            shortCode: referenceId,
            status: "active",
          },
          data: {
            status: "expired",
          },
        });
      } catch (error) {
        console.error("Failed to mark payment link as expired:", error);
      }
      break;
    }

    case RAZORPAY_EVENTS.PAYMENT_LINK_CANCELLED: {
      const paymentLink = payload.payload.payment_link.entity;
      const referenceId = paymentLink.reference_id;

      console.log("Payment link cancelled:", referenceId);

      try {
        await prisma.paymentLink.updateMany({
          where: {
            shortCode: referenceId,
            status: "active",
          },
          data: {
            status: "cancelled",
          },
        });
      } catch (error) {
        console.error("Failed to mark payment link as cancelled:", error);
      }
      break;
    }

    default:
      console.log("Unhandled Razorpay event:", event);
  }
}

/**
 * Razorpay webhook routes
 */
export async function razorpayWebhookRoutes(app: FastifyInstance) {
  // Add raw body parser for signature verification
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (req, body, done) => {
      try {
        const json = JSON.parse(body as string);
        (req as FastifyRequest & { rawBody: string }).rawBody = body as string;
        done(null, json);
      } catch (err) {
        done(err as Error, undefined);
      }
    }
  );

  /**
   * POST /webhooks/razorpay
   * Razorpay webhook endpoint
   */
  app.post(
    "/razorpay",
    {
      schema: {
        tags: ["Webhooks"],
        summary: "Razorpay webhook",
        description: "Handle Razorpay payment events",
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const req = request as FastifyRequest & { rawBody: string };
      const signature = request.headers["x-razorpay-signature"] as string;

      // Verify signature
      if (signature && !verifyWebhookSignature(req.rawBody, signature)) {
        console.warn("Invalid Razorpay webhook signature");
        return reply.code(400).send({ error: "Invalid signature" });
      }

      // Process webhook
      try {
        await processWebhook(request.body as RazorpayWebhookPayload);
        return reply.code(200).send({ success: true });
      } catch (error) {
        console.error("Razorpay webhook error:", error);
        return reply.code(500).send({ error: "Processing error" });
      }
    }
  );
}
