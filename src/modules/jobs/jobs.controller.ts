import type { FastifyReply } from "fastify";
import type { ProtectedRequest } from "../../types/request.js";
import type { JobStatus } from "@prisma/client";
import { createModuleLogger } from "../../config/logger.js";
import {
  isJobsDashboardEnabled,
  getJobs,
  getJobRuns,
  getJobRunById,
  getJobStatistics,
  triggerJob,
  retryJobRun,
} from "./jobs.service.js";

const log = createModuleLogger("jobs-controller");

/**
 * Check if jobs dashboard is enabled, return 403 if not
 */
async function checkJobsDashboardAccess(
  request: ProtectedRequest,
  reply: FastifyReply
): Promise<boolean> {
  const { orgId } = request.userContext;
  const enabled = await isJobsDashboardEnabled(orgId);

  if (!enabled) {
    reply.code(403).send({
      error: "Jobs Dashboard is not enabled for this organization",
    });
    return false;
  }
  return true;
}

/**
 * GET /jobs - List all job definitions with last run info
 */
export async function listJobs(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  if (!(await checkJobsDashboardAccess(request, reply))) return;

  const { orgId } = request.userContext;
  const jobs = await getJobs(orgId);

  return { data: jobs };
}

/**
 * GET /jobs/runs - List job runs with pagination and filters
 */
export async function listJobRuns(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  if (!(await checkJobsDashboardAccess(request, reply))) return;

  const { orgId } = request.userContext;
  const {
    page = "1",
    limit = "20",
    jobName,
    status,
    startDate,
    endDate,
  } = request.query as {
    page?: string;
    limit?: string;
    jobName?: string;
    status?: JobStatus;
    startDate?: string;
    endDate?: string;
  };

  const pagination = {
    page: Math.max(1, parseInt(page, 10) || 1),
    limit: Math.min(100, Math.max(1, parseInt(limit, 10) || 20)),
  };

  const filters = {
    jobName,
    status,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
  };

  const result = await getJobRuns(orgId, filters, pagination);

  return result;
}

/**
 * GET /jobs/runs/:id - Get a single job run
 */
export async function getJobRun(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  if (!(await checkJobsDashboardAccess(request, reply))) return;

  const { id } = request.params as { id: string };
  const run = await getJobRunById(id);

  if (!run) {
    return reply.code(404).send({ error: "Job run not found" });
  }

  return { data: run };
}

/**
 * GET /jobs/stats - Get job statistics
 */
export async function getStats(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  if (!(await checkJobsDashboardAccess(request, reply))) return;

  const { orgId } = request.userContext;
  const { jobName, days = "7" } = request.query as {
    jobName?: string;
    days?: string;
  };

  const stats = await getJobStatistics(
    orgId,
    jobName,
    Math.min(90, Math.max(1, parseInt(days, 10) || 7))
  );

  return { data: stats };
}

/**
 * POST /jobs/:name/trigger - Manually trigger a job
 */
export async function triggerJobHandler(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  if (!(await checkJobsDashboardAccess(request, reply))) return;

  const { name } = request.params as { name: string };
  const { userId } = request.userContext;

  log.info({ jobName: name, userId }, "Manual job trigger requested");

  try {
    const result = await triggerJob(name);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return reply.code(400).send({ error: message });
  }
}

/**
 * POST /jobs/runs/:id/retry - Retry a failed job
 */
export async function retryJobHandler(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  if (!(await checkJobsDashboardAccess(request, reply))) return;

  const { id } = request.params as { id: string };
  const { userId } = request.userContext;

  log.info({ runId: id, userId }, "Job retry requested");

  try {
    const result = await retryJobRun(id);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return reply.code(400).send({ error: message });
  }
}
