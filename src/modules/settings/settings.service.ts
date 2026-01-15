import { prisma } from "../../config/database.js";
import { createModuleLogger } from "../../config/logger.js";
import type {
  UpdateOrganizationInput,
  UpdateTemplateInput,
  CreateTemplateInput,
} from "./settings.schema.js";

const log = createModuleLogger("settings-service");

/**
 * Get organization settings
 */
export async function getOrganization(orgId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      type: true,
      language: true,
      timezone: true,
      udiseCode: true,
      logoUrl: true,
      phone: true,
      email: true,
      address: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return org;
}

/**
 * Update organization settings
 */
export async function updateOrganization(
  orgId: string,
  input: UpdateOrganizationInput
) {
  log.info({ orgId }, "Updating organization settings");

  const org = await prisma.organization.update({
    where: { id: orgId },
    data: {
      name: input.name,
      type: input.type,
      language: input.language,
      timezone: input.timezone,
      udiseCode: input.udiseCode,
      logoUrl: input.logoUrl,
      phone: input.phone,
      email: input.email,
      address: input.address,
    },
    select: {
      id: true,
      name: true,
      type: true,
      language: true,
      timezone: true,
      udiseCode: true,
      logoUrl: true,
      phone: true,
      email: true,
      address: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  log.info({ orgId }, "Organization settings updated");
  return org;
}

/**
 * Get all message templates for an organization
 */
export async function getMessageTemplates(orgId: string) {
  const templates = await prisma.messageTemplate.findMany({
    where: { orgId },
    select: {
      id: true,
      type: true,
      name: true,
      content: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return templates;
}

/**
 * Get a single message template
 */
export async function getMessageTemplate(id: string, orgId: string) {
  const template = await prisma.messageTemplate.findFirst({
    where: { id, orgId },
    select: {
      id: true,
      type: true,
      name: true,
      content: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return template;
}

/**
 * Create a message template
 */
export async function createMessageTemplate(
  orgId: string,
  input: CreateTemplateInput
) {
  log.info({ orgId, type: input.type }, "Creating message template");

  const template = await prisma.messageTemplate.create({
    data: {
      orgId,
      type: input.type,
      name: input.name,
      content: input.content,
      isActive: input.isActive,
    },
    select: {
      id: true,
      type: true,
      name: true,
      content: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  log.info({ orgId, templateId: template.id }, "Message template created");
  return template;
}

/**
 * Update a message template
 */
export async function updateMessageTemplate(
  id: string,
  orgId: string,
  input: UpdateTemplateInput
) {
  log.info({ orgId, templateId: id }, "Updating message template");

  // First verify template belongs to org
  const existing = await prisma.messageTemplate.findFirst({
    where: { id, orgId },
  });

  if (!existing) {
    return null;
  }

  const template = await prisma.messageTemplate.update({
    where: { id },
    data: {
      name: input.name,
      content: input.content,
      isActive: input.isActive,
    },
    select: {
      id: true,
      type: true,
      name: true,
      content: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  log.info({ orgId, templateId: id }, "Message template updated");
  return template;
}

/**
 * Delete a message template
 */
export async function deleteMessageTemplate(id: string, orgId: string) {
  log.info({ orgId, templateId: id }, "Deleting message template");

  // First verify template belongs to org
  const existing = await prisma.messageTemplate.findFirst({
    where: { id, orgId },
  });

  if (!existing) {
    return false;
  }

  await prisma.messageTemplate.delete({
    where: { id },
  });

  log.info({ orgId, templateId: id }, "Message template deleted");
  return true;
}
