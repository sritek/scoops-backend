import type { FastifyRequest, FastifyReply } from "fastify";
import * as settingsService from "./settings.service.js";
import {
  updateOrganizationSchema,
  updateTemplateSchema,
  createTemplateSchema,
  templateIdParamSchema,
} from "./settings.schema.js";

/**
 * Get organization settings
 * GET /settings/organization
 */
export async function getOrganization(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const orgId = request.userContext?.orgId;

  if (!orgId) {
    return reply.code(401).send({
      error: "Unauthorized",
      message: "Authentication required",
    });
  }

  const org = await settingsService.getOrganization(orgId);

  if (!org) {
    return reply.code(404).send({
      error: "Not Found",
      message: "Organization not found",
    });
  }

  return reply.send({ data: org });
}

/**
 * Update organization settings
 * PUT /settings/organization
 */
export async function updateOrganization(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const orgId = request.userContext?.orgId;

  if (!orgId) {
    return reply.code(401).send({
      error: "Unauthorized",
      message: "Authentication required",
    });
  }

  // Validate input
  const parseResult = updateOrganizationSchema.safeParse(request.body);
  if (!parseResult.success) {
    return reply.code(400).send({
      error: "Validation Error",
      message: parseResult.error.errors[0].message,
    });
  }

  const org = await settingsService.updateOrganization(orgId, parseResult.data);

  return reply.send({
    data: org,
    message: "Organization settings updated successfully",
  });
}

/**
 * Get all message templates
 * GET /settings/message-templates
 */
export async function getMessageTemplates(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const orgId = request.userContext?.orgId;

  if (!orgId) {
    return reply.code(401).send({
      error: "Unauthorized",
      message: "Authentication required",
    });
  }

  const templates = await settingsService.getMessageTemplates(orgId);

  return reply.send({ data: templates });
}

/**
 * Get a single message template
 * GET /settings/message-templates/:id
 */
export async function getMessageTemplate(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const orgId = request.userContext?.orgId;

  if (!orgId) {
    return reply.code(401).send({
      error: "Unauthorized",
      message: "Authentication required",
    });
  }

  const parseResult = templateIdParamSchema.safeParse(request.params);
  if (!parseResult.success) {
    return reply.code(400).send({
      error: "Validation Error",
      message: "Invalid template ID",
    });
  }

  const template = await settingsService.getMessageTemplate(
    parseResult.data.id,
    orgId
  );

  if (!template) {
    return reply.code(404).send({
      error: "Not Found",
      message: "Template not found",
    });
  }

  return reply.send({ data: template });
}

/**
 * Create a message template
 * POST /settings/message-templates
 */
export async function createMessageTemplate(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const orgId = request.userContext?.orgId;

  if (!orgId) {
    return reply.code(401).send({
      error: "Unauthorized",
      message: "Authentication required",
    });
  }

  // Validate input
  const parseResult = createTemplateSchema.safeParse(request.body);
  if (!parseResult.success) {
    return reply.code(400).send({
      error: "Validation Error",
      message: parseResult.error.errors[0].message,
    });
  }

  const template = await settingsService.createMessageTemplate(
    orgId,
    parseResult.data
  );

  return reply.code(201).send({
    data: template,
    message: "Message template created successfully",
  });
}

/**
 * Update a message template
 * PUT /settings/message-templates/:id
 */
export async function updateMessageTemplate(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const orgId = request.userContext?.orgId;

  if (!orgId) {
    return reply.code(401).send({
      error: "Unauthorized",
      message: "Authentication required",
    });
  }

  // Validate params
  const paramsResult = templateIdParamSchema.safeParse(request.params);
  if (!paramsResult.success) {
    return reply.code(400).send({
      error: "Validation Error",
      message: "Invalid template ID",
    });
  }

  // Validate input
  const bodyResult = updateTemplateSchema.safeParse(request.body);
  if (!bodyResult.success) {
    return reply.code(400).send({
      error: "Validation Error",
      message: bodyResult.error.errors[0].message,
    });
  }

  const template = await settingsService.updateMessageTemplate(
    paramsResult.data.id,
    orgId,
    bodyResult.data
  );

  if (!template) {
    return reply.code(404).send({
      error: "Not Found",
      message: "Template not found",
    });
  }

  return reply.send({
    data: template,
    message: "Message template updated successfully",
  });
}

/**
 * Delete a message template
 * DELETE /settings/message-templates/:id
 */
export async function deleteMessageTemplate(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const orgId = request.userContext?.orgId;

  if (!orgId) {
    return reply.code(401).send({
      error: "Unauthorized",
      message: "Authentication required",
    });
  }

  const parseResult = templateIdParamSchema.safeParse(request.params);
  if (!parseResult.success) {
    return reply.code(400).send({
      error: "Validation Error",
      message: "Invalid template ID",
    });
  }

  const success = await settingsService.deleteMessageTemplate(
    parseResult.data.id,
    orgId
  );

  if (!success) {
    return reply.code(404).send({
      error: "Not Found",
      message: "Template not found",
    });
  }

  return reply.send({
    message: "Message template deleted successfully",
  });
}
