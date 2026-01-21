/**
 * Validation Middleware
 *
 * Zod-based validation helpers for Fastify routes
 */

import type {
  FastifyRequest,
  FastifyReply,
  HookHandlerDoneFunction,
} from "fastify";
import type { ZodSchema } from "zod";
import { BadRequestError } from "../utils/error-handler.js";

/**
 * Validate request body against a Zod schema
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (
    request: FastifyRequest,
    reply: FastifyReply,
    done: HookHandlerDoneFunction
  ) => {
    const result = schema.safeParse(request.body);
    if (!result.success) {
      const errors = result.error.errors.map((e) => e.message).join(", ");
      throw new BadRequestError(`Validation failed: ${errors}`);
    }
    request.body = result.data;
    done();
  };
}

/**
 * Validate request query against a Zod schema
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return (
    request: FastifyRequest,
    reply: FastifyReply,
    done: HookHandlerDoneFunction
  ) => {
    const result = schema.safeParse(request.query);
    if (!result.success) {
      const errors = result.error.errors.map((e) => e.message).join(", ");
      throw new BadRequestError(`Validation failed: ${errors}`);
    }
    request.query = result.data as typeof request.query;
    done();
  };
}
