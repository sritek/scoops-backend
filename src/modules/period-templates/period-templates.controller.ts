import type { FastifyReply } from "fastify";
import type { ProtectedRequest } from "../../types/request.js";
import { getTenantScopeFromRequest } from "../../middleware/branch.middleware.js";
import { parsePaginationParams } from "../../utils/pagination.js";
import {
  createPeriodTemplateSchema,
  updatePeriodTemplateSchema,
  templateIdParamSchema,
  listTemplatesQuerySchema,
} from "./period-templates.schema.js";
import * as templatesService from "./period-templates.service.js";

/**
 * GET /period-templates
 * List period templates with pagination
 */
export async function listTemplates(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const query = listTemplatesQuerySchema.safeParse(request.query);
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
    isDefault: query.data.isDefault,
  };

  const result = await templatesService.getTemplates(scope, pagination, filters);

  return reply.code(200).send(result);
}

/**
 * GET /period-templates/all
 * Get all templates (for dropdowns)
 */
export async function getAllTemplates(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const scope = getTenantScopeFromRequest(request);
  const templates = await templatesService.getAllTemplates(scope);

  return reply.code(200).send({
    data: templates,
  });
}

/**
 * GET /period-templates/default
 * Get the default template (or create it if it doesn't exist)
 */
export async function getDefaultTemplate(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const scope = getTenantScopeFromRequest(request);
  
  // Ensure default template exists
  const template = await templatesService.ensureDefaultTemplate(scope.orgId);

  return reply.code(200).send({
    data: template,
  });
}

/**
 * GET /period-templates/:id
 * Get a single template by ID
 */
export async function getTemplate(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const params = templateIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid template ID",
      details: params.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const template = await templatesService.getTemplateById(params.data.id, scope);

  if (!template) {
    return reply.code(404).send({
      error: "Not Found",
      message: "Template not found",
    });
  }

  return reply.code(200).send({
    data: template,
  });
}

/**
 * POST /period-templates
 * Create a new period template
 */
export async function createTemplate(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const body = createPeriodTemplateSchema.safeParse(request.body);
  if (!body.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid request body",
      details: body.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const template = await templatesService.createTemplate(body.data, scope);

  return reply.code(201).send({
    data: template,
    message: "Period template created successfully",
  });
}

/**
 * PUT /period-templates/:id
 * Update an existing period template
 */
export async function updateTemplate(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const params = templateIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid template ID",
      details: params.error.flatten(),
    });
  }

  const body = updatePeriodTemplateSchema.safeParse(request.body);
  if (!body.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid request body",
      details: body.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const template = await templatesService.updateTemplate(
    params.data.id,
    body.data,
    scope
  );

  if (!template) {
    return reply.code(404).send({
      error: "Not Found",
      message: "Template not found",
    });
  }

  return reply.code(200).send({
    data: template,
    message: "Period template updated successfully",
  });
}

/**
 * DELETE /period-templates/:id
 * Delete a period template
 */
export async function deleteTemplate(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const params = templateIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid template ID",
      details: params.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);

  try {
    const template = await templatesService.deleteTemplate(params.data.id, scope);

    if (!template) {
      return reply.code(404).send({
        error: "Not Found",
        message: "Template not found",
      });
    }

    return reply.code(200).send({
      data: template,
      message: "Period template deleted successfully",
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Cannot delete")) {
      return reply.code(400).send({
        error: "Bad Request",
        message: error.message,
      });
    }
    throw error;
  }
}
