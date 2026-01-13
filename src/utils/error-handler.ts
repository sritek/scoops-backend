import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

/**
 * Application error class for business logic errors
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Not found error
 */
export class NotFoundError extends AppError {
  constructor(resource: string = "Resource") {
    super(`${resource} not found`, 404);
  }
}

/**
 * Unauthorized error
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized") {
    super(message, 401);
  }
}

/**
 * Forbidden error
 */
export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden") {
    super(message, 403);
  }
}

/**
 * Bad request error (validation, business logic)
 */
export class BadRequestError extends AppError {
  constructor(message: string = "Bad Request") {
    super(message, 400);
  }
}

/**
 * Conflict error (duplicate records, etc.)
 */
export class ConflictError extends AppError {
  constructor(message: string = "Conflict") {
    super(message, 409);
  }
}

/**
 * Global error handler for Fastify
 */
export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Log the error
  request.log.error({
    err: error,
    url: request.url,
    method: request.method,
  });

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return reply.code(400).send({
      error: "Validation Error",
      message: "Invalid request data",
      details: error.flatten(),
    });
  }

  // Handle AppError (business logic errors)
  if (error instanceof AppError) {
    return reply.code(error.statusCode).send({
      error: error.name,
      message: error.message,
    });
  }

  // Handle Prisma errors
  if (error.name === "PrismaClientKnownRequestError") {
    const prismaError = error as FastifyError & { code?: string };

    if (prismaError.code === "P2002") {
      return reply.code(409).send({
        error: "Conflict",
        message: "A record with this data already exists",
      });
    }

    if (prismaError.code === "P2025") {
      return reply.code(404).send({
        error: "Not Found",
        message: "Record not found",
      });
    }
  }

  // Handle Fastify validation errors
  if (error.validation) {
    return reply.code(400).send({
      error: "Validation Error",
      message: error.message,
      details: error.validation,
    });
  }

  // Default to 500 for unknown errors
  const statusCode = error.statusCode || 500;
  const message =
    statusCode === 500 ? "Internal Server Error" : error.message;

  return reply.code(statusCode).send({
    error: statusCode === 500 ? "Internal Server Error" : "Error",
    message,
  });
}

/**
 * Not found handler for undefined routes
 */
export function notFoundHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  return reply.code(404).send({
    error: "Not Found",
    message: `Route ${request.method} ${request.url} not found`,
  });
}
