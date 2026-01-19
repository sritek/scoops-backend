import type { FastifyReply } from "fastify";
import type { ProtectedRequest } from "../../types/request.js";
import { getTenantScopeFromRequest } from "../../middleware/branch.middleware.js";
import { parsePaginationParams } from "../../utils/pagination.js";
import {
  createBatchSchema,
  updateBatchSchema,
  batchIdParamSchema,
  listBatchesQuerySchema,
  setBatchScheduleSchema,
  updatePeriodSchema,
} from "./batches.schema.js";
import * as batchesService from "./batches.service.js";
import { z } from "zod";

/**
 * GET /batches
 * List batches with pagination and filters
 */
export async function listBatches(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const query = listBatchesQuerySchema.safeParse(request.query);
  if (!query.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid query parameters",
      details: query.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const pagination = parsePaginationParams({
    page: String(query.data.page),
    limit: String(query.data.limit),
  });
  const filters = {
    isActive: query.data.isActive,
    teacherId: query.data.teacherId,
    academicLevel: query.data.academicLevel,
  };

  const result = await batchesService.getBatches(scope, pagination, filters);

  return reply.code(200).send(result);
}

/**
 * GET /batches/:id
 * Get a single batch by ID
 */
export async function getBatch(request: ProtectedRequest, reply: FastifyReply) {
  const params = batchIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid batch ID",
      details: params.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const batch = await batchesService.getBatchById(params.data.id, scope);

  if (!batch) {
    return reply.code(404).send({
      error: "Not Found",
      message: "Batch not found",
    });
  }

  return reply.code(200).send({
    data: batch,
  });
}

/**
 * POST /batches
 * Create a new batch
 */
export async function createBatch(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const body = createBatchSchema.safeParse(request.body);
  if (!body.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid request body",
      details: body.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const batch = await batchesService.createBatch(body.data, scope);

  return reply.code(201).send({
    data: batch,
    message: "Batch created successfully",
  });
}

/**
 * PUT /batches/:id
 * Update an existing batch
 */
export async function updateBatch(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const params = batchIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid batch ID",
      details: params.error.flatten(),
    });
  }

  const body = updateBatchSchema.safeParse(request.body);
  if (!body.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid request body",
      details: body.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const batch = await batchesService.updateBatch(
    params.data.id,
    body.data,
    scope
  );

  if (!batch) {
    return reply.code(404).send({
      error: "Not Found",
      message: "Batch not found",
    });
  }

  return reply.code(200).send({
    data: batch,
    message: "Batch updated successfully",
  });
}

// ===========================
// SCHEDULE ENDPOINTS
// ===========================

/**
 * GET /batches/:id/schedule
 * Get the schedule for a batch
 */
export async function getBatchSchedule(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const params = batchIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid batch ID",
      details: params.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const schedule = await batchesService.getBatchSchedule(params.data.id, scope);

  if (schedule === null) {
    return reply.code(404).send({
      error: "Not Found",
      message: "Batch not found",
    });
  }

  return reply.code(200).send({
    data: schedule,
  });
}

/**
 * PUT /batches/:id/schedule
 * Set the full schedule for a batch
 */
export async function setBatchSchedule(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const params = batchIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid batch ID",
      details: params.error.flatten(),
    });
  }

  const body = setBatchScheduleSchema.safeParse(request.body);
  if (!body.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid request body",
      details: body.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);

  try {
    const schedule = await batchesService.setBatchSchedule(
      params.data.id,
      body.data.periods,
      scope
    );

    if (schedule === null) {
      return reply.code(404).send({
        error: "Not Found",
        message: "Batch not found",
      });
    }

    return reply.code(200).send({
      data: schedule,
      message: "Schedule updated successfully",
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return reply.code(400).send({
        error: "Bad Request",
        message: error.message,
      });
    }
    throw error;
  }
}

/**
 * PATCH /batches/:id/schedule/:day/:period
 * Update a single period
 */
export async function updatePeriod(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const paramsSchema = z.object({
    id: z.string().uuid(),
    day: z.coerce.number().int().min(1).max(6),
    period: z.coerce.number().int().min(1),
  });

  const params = paramsSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid parameters",
      details: params.error.flatten(),
    });
  }

  const body = updatePeriodSchema.safeParse(request.body);
  if (!body.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid request body",
      details: body.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);

  try {
    const period = await batchesService.updatePeriod(
      params.data.id,
      params.data.day,
      params.data.period,
      body.data,
      scope
    );

    if (period === null) {
      return reply.code(404).send({
        error: "Not Found",
        message: "Batch not found",
      });
    }

    return reply.code(200).send({
      data: period,
      message: "Period updated successfully",
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return reply.code(400).send({
        error: "Bad Request",
        message: error.message,
      });
    }
    throw error;
  }
}

/**
 * POST /batches/:id/schedule/initialize
 * Initialize schedule from a period template
 */
export async function initializeSchedule(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const params = batchIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid batch ID",
      details: params.error.flatten(),
    });
  }

  const bodySchema = z.object({
    templateId: z.string().uuid(),
  });

  const body = bodySchema.safeParse(request.body);
  if (!body.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid request body",
      details: body.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);

  try {
    const schedule = await batchesService.initializeScheduleFromTemplate(
      params.data.id,
      body.data.templateId,
      scope
    );

    if (schedule === null) {
      return reply.code(404).send({
        error: "Not Found",
        message: "Batch not found",
      });
    }

    return reply.code(200).send({
      data: schedule,
      message: "Schedule initialized from template",
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return reply.code(400).send({
        error: "Bad Request",
        message: error.message,
      });
    }
    throw error;
  }
}

/**
 * POST /batches/generate-name
 * Generate a batch name based on parameters
 */
export async function generateBatchName(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const bodySchema = z.object({
    academicLevel: z.enum(["primary", "secondary", "senior_secondary", "coaching"]),
    stream: z.enum(["science", "commerce", "arts"]).optional(),
    sessionName: z.string().optional(),
  });

  const body = bodySchema.safeParse(request.body);
  if (!body.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid request body",
      details: body.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const name = await batchesService.generateBatchName(
    body.data.academicLevel,
    body.data.stream,
    body.data.sessionName,
    scope
  );

  return reply.code(200).send({
    data: { name },
  });
}
