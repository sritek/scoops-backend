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
import { ROLES } from "./config/permissions";
import { env } from "./config/env.js";
import { testDbConnection } from "./config/database.js";

// Import module routes
import { authRoutes } from "./modules/auth/index.js";
import { studentsRoutes } from "./modules/students/index.js";
import { batchesRoutes } from "./modules/batches/index.js";
import { attendanceRoutes } from "./modules/attendance/index.js";
import { feesRoutes } from "./modules/fees/index.js";
import { dashboardRoutes } from "./modules/dashboard/index.js";
import { usersRoutes } from "./modules/users/index.js";
import { branchRoutes } from "./modules/branch/index.js";
import { settingsRoutes } from "./modules/settings/index.js";
import { sessionsRoutes } from "./modules/sessions/index.js";
import { subjectsRoutes } from "./modules/subjects/index.js";
import { periodTemplatesRoutes } from "./modules/period-templates/index.js";
import { notificationsRoutes } from "./modules/notifications/index.js";
import { jobsRoutes } from "./modules/jobs/index.js";
import { staffRoutes } from "./modules/staff/index.js";
import { parentAuthRoutes } from "./modules/auth/parent-auth.routes";
import { webhookRoutes } from "./modules/notifications/webhook.routes";
import {
  paymentLinkRoutes,
  publicPaymentRoutes,
  razorpayWebhookRoutes,
} from "./modules/payments/index.js";
import { reportsRoutes } from "./modules/reports/index.js";
import { examsRoutes } from "./modules/exams/index.js";
import { messagingRoutes } from "./modules/messaging/index.js";
import { complaintsRoutes } from "./modules/complaints/index.js";
import { analyticsRoutes } from "./modules/analytics/index.js";
import { scholarshipsRoutes } from "./modules/scholarships/index.js";
import {
  installmentsRoutes,
  feeInstallmentsRoutes,
} from "./modules/installments/index.js";
import { healthRoutes } from "./modules/health/index.js";
import { parentRoutes } from "./modules/parents/index.js";
import { leaveRoutes } from "./modules/leave/index.js";
import { calendarRoutes } from "./modules/calendar/index.js";
import { homeworkRoutes } from "./modules/homework/index.js";
import { schedulerPlugin } from "./scheduler/index.js";

const log = createModuleLogger("app");

/**
 * Public routes whitelist - all other routes require authentication.
 * Add routes here that should be accessible without a valid token.
 */
const PUBLIC_ROUTES = [
  "/health",
  "/api/v1/auth/login", // Login endpoint
  "/api/v1/auth/parent", // Parent OTP auth (public)
  "/api/v1/parent", // Parent portal (uses x-parent-token auth)
  "/api/v1/webhooks", // Webhook endpoints (public)
  "/api/v1/pay", // Public payment pages
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
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Branch-ID",
      "x-parent-token",
    ],
    exposedHeaders: ["X-Total-Count"],
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

  // Auth routes (login is public, others protected)
  await app.register(authRoutes, { prefix: "/api/v1/auth" });
  log.debug("Route registered: /api/v1/auth");

  // API v1 routes (protected)
  await app.register(studentsRoutes, { prefix: "/api/v1/students" });
  log.debug("Route registered: /api/v1/students");

  await app.register(healthRoutes, { prefix: "/api/v1/students" });
  log.debug("Route registered: /api/v1/students/:id/health");

  await app.register(batchesRoutes, { prefix: "/api/v1/batches" });
  log.debug("Route registered: /api/v1/batches");

  await app.register(attendanceRoutes, { prefix: "/api/v1/attendance" });
  log.debug("Route registered: /api/v1/attendance");

  await app.register(feesRoutes, { prefix: "/api/v1/fees" });
  log.debug("Route registered: /api/v1/fees");

  await app.register(dashboardRoutes, { prefix: "/api/v1/dashboard" });
  log.debug("Route registered: /api/v1/dashboard");

  await app.register(usersRoutes, { prefix: "/api/v1/users" });
  log.debug("Route registered: /api/v1/users");

  await app.register(branchRoutes, { prefix: "/api/v1/branches" });
  log.debug("Route registered: /api/v1/branches");

  await app.register(settingsRoutes, { prefix: "/api/v1/settings" });
  log.debug("Route registered: /api/v1/settings");

  await app.register(sessionsRoutes, { prefix: "/api/v1/sessions" });
  log.debug("Route registered: /api/v1/sessions");

  await app.register(subjectsRoutes, { prefix: "/api/v1/subjects" });
  log.debug("Route registered: /api/v1/subjects");

  await app.register(periodTemplatesRoutes, {
    prefix: "/api/v1/period-templates",
  });
  log.debug("Route registered: /api/v1/period-templates");

  await app.register(notificationsRoutes, { prefix: "/api/v1/notifications" });
  log.debug("Route registered: /api/v1/notifications");

  await app.register(jobsRoutes, { prefix: "/api/v1/jobs" });
  log.debug("Route registered: /api/v1/jobs");

  await app.register(staffRoutes, { prefix: "/api/v1/staff" });
  log.debug("Route registered: /api/v1/staff");

  await app.register(paymentLinkRoutes, { prefix: "/api/v1/payment-links" });
  log.debug("Route registered: /api/v1/payment-links");

  await app.register(reportsRoutes, { prefix: "/api/v1/reports" });
  log.debug("Route registered: /api/v1/reports");

  await app.register(examsRoutes, { prefix: "/api/v1/exams" });
  log.debug("Route registered: /api/v1/exams");

  await app.register(messagingRoutes, { prefix: "/api/v1/messages" });
  log.debug("Route registered: /api/v1/messages");

  await app.register(complaintsRoutes, { prefix: "/api/v1/complaints" });
  log.debug("Route registered: /api/v1/complaints");

  await app.register(leaveRoutes, { prefix: "/api/v1/leave-applications" });
  log.debug("Route registered: /api/v1/leave-applications");

  await app.register(calendarRoutes, { prefix: "/api/v1/calendar" });
  log.debug("Route registered: /api/v1/calendar");

  await app.register(homeworkRoutes, { prefix: "/api/v1/homework" });
  log.debug("Route registered: /api/v1/homework");

  await app.register(analyticsRoutes, { prefix: "/api/v1/analytics" });
  log.debug("Route registered: /api/v1/analytics");

  await app.register(scholarshipsRoutes, { prefix: "/api/v1/scholarships" });
  log.debug("Route registered: /api/v1/scholarships");

  await app.register(installmentsRoutes, { prefix: "/api/v1/emi-templates" });
  log.debug("Route registered: /api/v1/emi-templates");

  await app.register(feeInstallmentsRoutes, {
    prefix: "/api/v1/fees/installments",
  });
  log.debug("Route registered: /api/v1/fees/installments");

  // Public payment pages (no auth required)
  await app.register(publicPaymentRoutes, { prefix: "/api/v1/pay" });
  log.debug("Route registered: /api/v1/pay (public)");

  // Parent auth routes (public - OTP based login)
  await app.register(parentAuthRoutes, { prefix: "/api/v1/auth/parent" });
  log.debug("Route registered: /api/v1/auth/parent (public)");

  // Parent portal routes (uses x-parent-token auth)
  await app.register(parentRoutes, { prefix: "/api/v1/parent" });
  log.debug("Route registered: /api/v1/parent (parent auth)");

  // Webhook routes (public - for external service callbacks)
  await app.register(webhookRoutes, { prefix: "/api/v1/webhooks" });
  log.debug("Route registered: /api/v1/webhooks (public)");

  // Razorpay webhook
  await app.register(razorpayWebhookRoutes, { prefix: "/api/v1/webhooks" });
  log.debug("Route registered: /api/v1/webhooks/razorpay (public)");

  log.info("All routes registered");

  // Register scheduler for background jobs
  log.info("Registering scheduler...");
  await app.register(schedulerPlugin);
  log.info("Scheduler registered");

  return app;
}
