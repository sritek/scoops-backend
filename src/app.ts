import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { errorHandler, notFoundHandler } from "./utils/error-handler.js";
import { swaggerConfig, swaggerUiConfig } from "./config/swagger.js";
import { fastifyLoggerOptions, createModuleLogger } from "./config/logger.js";
import { authMiddleware } from "./middleware/auth.middleware.js";
import { requireRole } from "./middleware/rbac.middleware.js";
import { loggingContextPlugin } from "./middleware/logging.middleware.js";
import { ROLES } from "./config/permissions.js";
import { env } from "./config/env.js";
import { testDbConnection } from "./config/database.js";

// Import module routes
import { studentsRoutes } from "./modules/students/index.js";
import { batchesRoutes } from "./modules/batches/index.js";
import { attendanceRoutes } from "./modules/attendance/index.js";
import { feesRoutes } from "./modules/fees/index.js";
import { dashboardRoutes } from "./modules/dashboard/index.js";

const log = createModuleLogger("app");

/**
 * Public routes whitelist - all other routes require authentication.
 * Add routes here that should be accessible without a valid token.
 */
const PUBLIC_ROUTES = [
  "/health",
  "/docs", // Swagger UI (has own auth hook in production)
  "/docs/json", // OpenAPI JSON spec
  "/docs/yaml", // OpenAPI YAML spec
];

/**
 * Check if a URL matches a public route pattern
 */
function isPublicRoute(url: string): boolean {
  // Remove query string for matching
  const path = url.split("?")[0];
  return PUBLIC_ROUTES.some(
    (route) => path === route || path.startsWith(route + "/")
  );
}

export async function buildApp() {
  log.info("Creating Fastify instance...");
  const app = Fastify({
    ...fastifyLoggerOptions,
  });
  log.info("Fastify instance created");

  // Test database connection
  log.info("Testing database connection...");
  const dbConnected = await testDbConnection();
  if (!dbConnected) {
    log.error("Database connection failed - server will not start");
    throw new Error("Database connection failed");
  }

  // Security
  log.info("Registering Helmet (security headers)...");
  await app.register(helmet, {
    contentSecurityPolicy: false, // Required for Swagger UI
  });
  log.info("Helmet registered");

  // CORS: Use env.CORS_ORIGIN for production security
  log.info({ origin: env.CORS_ORIGIN }, "Registering CORS...");
  await app.register(cors, {
    origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN,
    credentials: true,
  });
  log.info("CORS registered");

  // Swagger/OpenAPI documentation
  log.info("Registering Swagger/OpenAPI...");
  await app.register(swagger, swaggerConfig);

  await app.register(swaggerUi, {
    ...swaggerUiConfig,
    uiHooks:
      process.env.NODE_ENV === "development"
        ? undefined
        : {
            onRequest: (request, reply, done) => {
              // Admin-only access to Swagger docs
              authMiddleware(request, reply)
                .then(() => {
                  if (reply.sent) {
                    done();
                    return;
                  }
                  const roleMiddleware = requireRole(ROLES.ADMIN);
                  return roleMiddleware(request, reply);
                })
                .then(() => {
                  done();
                })
                .catch(() => {
                  reply.code(401).send({
                    error: "Unauthorized",
                    message: "Swagger documentation requires admin access",
                  });
                  done();
                });
            },
          },
  });
  log.info("Swagger registered");

  // Global error handler
  log.info("Setting up error handlers...");
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);
  log.info("Error handlers configured");

  // Logging context (adds user context to logs after auth)
  log.info("Registering logging context plugin...");
  await app.register(loggingContextPlugin);
  log.info("Logging context registered");

  // Global authentication - all routes protected by default
  log.info(
    { publicRoutes: PUBLIC_ROUTES },
    "Setting up global authentication hook..."
  );
  app.addHook("onRequest", async (request, reply) => {
    if (isPublicRoute(request.url)) {
      return; // Skip auth for public routes
    }
    await authMiddleware(request, reply);
  });
  log.info("Authentication hook configured");

  // Register routes
  log.info("Registering routes...");

  // Health check (public)
  app.get(
    "/health",
    {
      schema: {
        tags: ["Health"],
        summary: "Health check endpoint",
        description: "Returns the health status of the API",
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
              timestamp: { type: "string", format: "date-time" },
            },
          },
        },
      },
    },
    async () => {
      return { status: "ok", timestamp: new Date().toISOString() };
    }
  );
  log.debug("Route registered: GET /health (public)");

  // GET /me - Current authenticated user info (protected)
  app.get(
    "/api/v1/me",
    {
      schema: {
        tags: ["Auth"],
        summary: "Get current user",
        description: "Returns authenticated user info from session",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              name: { type: "string" },
              firstName: { type: "string" },
              lastName: { type: "string" },
              role: {
                type: "string",
                enum: ["admin", "teacher", "accounts", "staff"],
              },
              branchId: { type: "string", format: "uuid" },
              permissions: {
                type: "array",
                items: { type: "string" },
              },
            },
          },
        },
      },
    },
    async (request) => {
      const { userId, firstName, lastName, role, branchId, permissions } =
        request.userContext;
      return {
        id: userId,
        name: `${firstName} ${lastName}`.trim(),
        firstName,
        lastName,
        role,
        branchId,
        permissions,
      };
    }
  );
  log.debug("Route registered: GET /me (protected)");

  // API v1 routes (protected)
  await app.register(studentsRoutes, { prefix: "/api/v1/students" });
  log.debug("Route registered: /api/v1/students");

  await app.register(batchesRoutes, { prefix: "/api/v1/batches" });
  log.debug("Route registered: /api/v1/batches");

  await app.register(attendanceRoutes, { prefix: "/api/v1/attendance" });
  log.debug("Route registered: /api/v1/attendance");

  await app.register(feesRoutes, { prefix: "/api/v1/fees" });
  log.debug("Route registered: /api/v1/fees");

  await app.register(dashboardRoutes, { prefix: "/api/v1/dashboard" });
  log.debug("Route registered: /api/v1/dashboard");

  log.info("All routes registered");

  return app;
}
