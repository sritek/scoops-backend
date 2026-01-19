/**
 * Webhook Routes
 *
 * Handles incoming webhooks from:
 * - Gupshup (WhatsApp delivery receipts and incoming messages)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { handleWebhook } from "./gupshup.webhook.js";

/**
 * Webhook routes (public - no auth required)
 */
export async function webhookRoutes(app: FastifyInstance) {
  // Add raw body parsing for webhook signature verification
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (req, body, done) => {
      try {
        const json = JSON.parse(body as string);
        // Store raw body for signature verification
        (req as FastifyRequest & { rawBody: string }).rawBody = body as string;
        done(null, json);
      } catch (err) {
        done(err as Error, undefined);
      }
    }
  );

  /**
   * POST /webhooks/gupshup
   * Gupshup webhook endpoint for delivery receipts and incoming messages
   */
  app.post(
    "/gupshup",
    {
      schema: {
        tags: ["Webhooks"],
        summary: "Gupshup webhook",
        description: "Receives delivery receipts and incoming messages from Gupshup",
        body: {
          type: "object",
          properties: {
            type: { type: "string" },
            payload: { type: "object" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const req = request as FastifyRequest & { rawBody: string };
      
      const result = await handleWebhook({
        headers: {
          "x-gupshup-signature": request.headers["x-gupshup-signature"] as string,
        },
        body: request.body as Parameters<typeof handleWebhook>[0]["body"],
        rawBody: req.rawBody || JSON.stringify(request.body),
      });

      if (!result.success) {
        return reply.code(400).send(result);
      }

      return reply.code(200).send(result);
    }
  );

  /**
   * GET /webhooks/gupshup
   * Gupshup webhook verification (for initial setup)
   */
  app.get(
    "/gupshup",
    {
      schema: {
        tags: ["Webhooks"],
        summary: "Gupshup webhook verification",
        description: "Used by Gupshup to verify webhook URL during setup",
        querystring: {
          type: "object",
          properties: {
            "hub.mode": { type: "string" },
            "hub.verify_token": { type: "string" },
            "hub.challenge": { type: "string" },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Gupshup webhook verification
      // Returns the challenge token to confirm ownership
      const query = request.query as {
        "hub.mode"?: string;
        "hub.verify_token"?: string;
        "hub.challenge"?: string;
      };

      if (query["hub.mode"] === "subscribe" && query["hub.challenge"]) {
        // Return challenge as plain text
        return reply
          .type("text/plain")
          .code(200)
          .send(query["hub.challenge"]);
      }

      return reply.code(200).send({ status: "ok" });
    }
  );
}
