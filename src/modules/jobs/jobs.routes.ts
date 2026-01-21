import type { FastifyInstance } from "fastify";
import { requirePermission } from "../../middleware/rbac.middleware.js";
import { PERMISSIONS } from "../../config/permissions";
import * as controller from "./jobs.controller.js";

/**
 * Jobs module routes
 * All routes require SETTINGS_MANAGE permission and jobsDashboardEnabled flag
 */
export async function jobsRoutes(app: FastifyInstance) {
  /**
   * GET /jobs
   * List all job definitions with last run info
   */
  app.get(
    "/",
    {
      schema: {
        tags: ["Jobs"],
        summary: "List all scheduled jobs",
        description: "Returns all scheduled job definitions with their last run status",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              data: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    description: { type: "string" },
                    schedule: { type: "string" },
                    cronExpression: { type: "string", nullable: true },
                    intervalMinutes: { type: "number", nullable: true },
                    lastRunAt: { type: "string", format: "date-time", nullable: true },
                    lastStatus: {
                      type: "string",
                      enum: ["running", "completed", "failed", "skipped"],
                      nullable: true,
                    },
                    lastDurationMs: { type: "number", nullable: true },
                    isRunning: { type: "boolean" },
                  },
                },
              },
            },
          },
          403: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
      preHandler: [requirePermission(PERMISSIONS.SETTINGS_MANAGE)],
    },
    controller.listJobs
  );

  /**
   * GET /jobs/runs
   * List job runs with pagination and filters
   */
  app.get(
    "/runs",
    {
      schema: {
        tags: ["Jobs"],
        summary: "List job runs",
        description: "Returns paginated list of job run history with optional filters",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            page: { type: "string", default: "1" },
            limit: { type: "string", default: "20" },
            jobName: { type: "string" },
            status: { type: "string", enum: ["running", "completed", "failed", "skipped"] },
            startDate: { type: "string", format: "date-time" },
            endDate: { type: "string", format: "date-time" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              data: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    jobName: { type: "string" },
                    status: { type: "string" },
                    startedAt: { type: "string", format: "date-time" },
                    completedAt: { type: "string", format: "date-time", nullable: true },
                    durationMs: { type: "number", nullable: true },
                    eventsEmitted: { type: "number" },
                    recordsProcessed: { type: "number" },
                    errorMessage: { type: "string", nullable: true },
                  },
                },
              },
              pagination: {
                type: "object",
                properties: {
                  page: { type: "number" },
                  limit: { type: "number" },
                  total: { type: "number" },
                  totalPages: { type: "number" },
                },
              },
            },
          },
        },
      },
      preHandler: [requirePermission(PERMISSIONS.SETTINGS_MANAGE)],
    },
    controller.listJobRuns
  );

  /**
   * GET /jobs/runs/:id
   * Get a single job run details
   */
  app.get(
    "/runs/:id",
    {
      schema: {
        tags: ["Jobs"],
        summary: "Get job run details",
        description: "Returns detailed information about a specific job run",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              data: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  jobName: { type: "string" },
                  status: { type: "string" },
                  startedAt: { type: "string", format: "date-time" },
                  completedAt: { type: "string", format: "date-time", nullable: true },
                  durationMs: { type: "number", nullable: true },
                  eventsEmitted: { type: "number" },
                  recordsProcessed: { type: "number" },
                  errorMessage: { type: "string", nullable: true },
                  metadata: { type: "object", nullable: true },
                },
              },
            },
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
      preHandler: [requirePermission(PERMISSIONS.SETTINGS_MANAGE)],
    },
    controller.getJobRun
  );

  /**
   * GET /jobs/stats
   * Get job statistics
   */
  app.get(
    "/stats",
    {
      schema: {
        tags: ["Jobs"],
        summary: "Get job statistics",
        description: "Returns statistics about job runs (success rate, avg duration, etc.)",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            jobName: { type: "string" },
            days: { type: "string", default: "7" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              data: {
                type: "object",
                properties: {
                  overall: {
                    type: "object",
                    properties: {
                      total: { type: "number" },
                      completed: { type: "number" },
                      failed: { type: "number" },
                      skipped: { type: "number" },
                      running: { type: "number" },
                      successRate: { type: "number" },
                      avgDurationMs: { type: "number" },
                    },
                  },
                  byJob: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        jobName: { type: "string" },
                        jobDisplayName: { type: "string" },
                        total: { type: "number" },
                        completed: { type: "number" },
                        failed: { type: "number" },
                        skipped: { type: "number" },
                        successRate: { type: "number" },
                        avgDurationMs: { type: "number" },
                      },
                    },
                  },
                  periodDays: { type: "number" },
                },
              },
            },
          },
        },
      },
      preHandler: [requirePermission(PERMISSIONS.SETTINGS_MANAGE)],
    },
    controller.getStats
  );

  /**
   * POST /jobs/:name/trigger
   * Manually trigger a job
   */
  app.post(
    "/:name/trigger",
    {
      schema: {
        tags: ["Jobs"],
        summary: "Trigger a job manually",
        description: "Manually triggers a scheduled job to run immediately",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            name: { type: "string" },
          },
          required: ["name"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
      preHandler: [requirePermission(PERMISSIONS.SETTINGS_MANAGE)],
    },
    controller.triggerJobHandler
  );

  /**
   * POST /jobs/runs/:id/retry
   * Retry a failed job
   */
  app.post(
    "/runs/:id/retry",
    {
      schema: {
        tags: ["Jobs"],
        summary: "Retry a failed job",
        description: "Retries a failed job run by creating a new run",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
      preHandler: [requirePermission(PERMISSIONS.SETTINGS_MANAGE)],
    },
    controller.retryJobHandler
  );
}
