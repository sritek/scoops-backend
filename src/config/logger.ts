import { randomUUID } from "crypto";
import pino, { type Logger } from "pino";
import type { FastifyServerOptions } from "fastify";
import { env } from "./env.js";

/**
 * Sensitive fields to redact from logs
 * These paths will be replaced with "[REDACTED]"
 */
const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "password",
  "token",
  "accessToken",
  "refreshToken",
  "secret",
  "apiKey",
];

/**
 * Generate unique request ID for tracking
 */
export function generateRequestId(): string {
  return randomUUID();
}

/**
 * Standalone Pino logger for use outside Fastify request context
 * Use this for:
 * - Startup logging
 * - Module initialization
 * - Background tasks
 * - Anywhere without access to request.log
 */
export const logger: Logger = pino({
  level: env.LOG_LEVEL,
  redact: REDACT_PATHS,
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  // Pretty print in development for better readability
  transport: env.NODE_ENV === "development" 
    ? {
        target: "pino-pretty",
        options: { 
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      }
    : undefined,
});

/**
 * Create a child logger with module context
 * @param module - The module name for log context
 * @returns A child logger with the module name bound
 */
export function createModuleLogger(module: string): Logger {
  return logger.child({ module });
}

/**
 * Logger configuration for Fastify/Pino
 */
export const loggerConfig: FastifyServerOptions["logger"] = {
  level: env.LOG_LEVEL,
  redact: REDACT_PATHS,
  // Use ISO timestamp format
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
  // Customize serializers for cleaner logs
  serializers: {
    req(request) {
      return {
        method: request.method,
        url: request.url,
        path: request.routeOptions?.url,
        parameters: request.params,
        // Don't log full headers, just relevant ones
        headers: {
          host: request.headers.host,
          "user-agent": request.headers["user-agent"],
          "content-type": request.headers["content-type"],
        },
      };
    },
    res(reply) {
      return {
        statusCode: reply.statusCode,
      };
    },
    err(error) {
      return {
        type: error.name,
        message: error.message,
        // Only include full stack trace in development
        stack: env.NODE_ENV === "development" ? (error.stack ?? "") : "",
      };
    },
  },
};

/**
 * Fastify server options for logging
 */
export const fastifyLoggerOptions: Pick<FastifyServerOptions, "logger" | "genReqId" | "requestIdHeader" | "requestIdLogLabel"> = {
  logger: loggerConfig,
  genReqId: generateRequestId,
  requestIdHeader: "x-request-id",
  requestIdLogLabel: "reqId",
};
