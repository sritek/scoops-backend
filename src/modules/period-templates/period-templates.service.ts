import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database.js";
import type { TenantScope } from "../../types/request.js";
import {
  type PaginationParams,
  createPaginatedResponse,
  calculateSkip,
} from "../../utils/pagination.js";
import type {
  CreatePeriodTemplateInput,
  UpdatePeriodTemplateInput,
  TemplateFilters,
  PeriodSlot,
} from "./period-templates.schema.js";
import { DEFAULT_TEMPLATE_SLOTS, DEFAULT_ACTIVE_DAYS } from "./period-templates.schema.js";

/**
 * Get period templates for an organization with pagination
 */
export async function getTemplates(
  scope: TenantScope,
  pagination: PaginationParams,
  filters?: TemplateFilters
) {
  const where: Prisma.PeriodTemplateWhereInput = {
    orgId: scope.orgId,
  };

  if (filters?.isDefault !== undefined) {
    where.isDefault = filters.isDefault;
  }

  const [templates, total] = await Promise.all([
    prisma.periodTemplate.findMany({
      where,
      include: {
        slots: {
          orderBy: { startTime: "asc" },
        },
      },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      skip: calculateSkip(pagination),
      take: pagination.limit,
    }),
    prisma.periodTemplate.count({ where }),
  ]);

  return createPaginatedResponse(templates, total, pagination);
}

/**
 * Get all templates (no pagination, for dropdowns)
 */
export async function getAllTemplates(scope: TenantScope) {
  return prisma.periodTemplate.findMany({
    where: {
      orgId: scope.orgId,
    },
    include: {
      slots: {
        orderBy: { startTime: "asc" },
      },
    },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
}

/**
 * Get a single template by ID
 */
export async function getTemplateById(id: string, scope: TenantScope) {
  return prisma.periodTemplate.findFirst({
    where: {
      id,
      orgId: scope.orgId,
    },
    include: {
      slots: {
        orderBy: { startTime: "asc" },
      },
    },
  });
}

/**
 * Get the default template for an organization
 */
export async function getDefaultTemplate(scope: TenantScope) {
  return prisma.periodTemplate.findFirst({
    where: {
      orgId: scope.orgId,
      isDefault: true,
    },
    include: {
      slots: {
        orderBy: { startTime: "asc" },
      },
    },
  });
}

/**
 * Create a new period template
 */
export async function createTemplate(
  input: CreatePeriodTemplateInput,
  scope: TenantScope
) {
  // If this template is marked as default, unmark all others
  if (input.isDefault) {
    await prisma.periodTemplate.updateMany({
      where: { orgId: scope.orgId, isDefault: true },
      data: { isDefault: false },
    });
  }

  return prisma.periodTemplate.create({
    data: {
      name: input.name,
      isDefault: input.isDefault ?? false,
      activeDays: input.activeDays ?? DEFAULT_ACTIVE_DAYS,
      orgId: scope.orgId,
      slots: {
        create: input.slots.map((slot, index) => ({
          periodNumber: slot.periodNumber,
          startTime: slot.startTime,
          endTime: slot.endTime,
          isBreak: slot.isBreak,
          breakName: slot.breakName,
        })),
      },
    },
    include: {
      slots: {
        orderBy: { startTime: "asc" },
      },
    },
  });
}

/**
 * Update an existing period template
 */
export async function updateTemplate(
  id: string,
  input: UpdatePeriodTemplateInput,
  scope: TenantScope
) {
  const existing = await prisma.periodTemplate.findFirst({
    where: {
      id,
      orgId: scope.orgId,
    },
  });

  if (!existing) {
    return null;
  }

  // If marking as default, unmark all others first
  if (input.isDefault === true) {
    await prisma.periodTemplate.updateMany({
      where: { orgId: scope.orgId, isDefault: true, id: { not: id } },
      data: { isDefault: false },
    });
  }

  // If slots are provided, delete existing and create new ones
  if (input.slots) {
    await prisma.periodTemplateSlot.deleteMany({
      where: { templateId: id },
    });
  }

  return prisma.periodTemplate.update({
    where: { id },
    data: {
      name: input.name,
      isDefault: input.isDefault,
      activeDays: input.activeDays,
      ...(input.slots && {
        slots: {
          create: input.slots.map((slot) => ({
            periodNumber: slot.periodNumber,
            startTime: slot.startTime,
            endTime: slot.endTime,
            isBreak: slot.isBreak,
            breakName: slot.breakName,
          })),
        },
      }),
    },
    include: {
      slots: {
        orderBy: { startTime: "asc" },
      },
    },
  });
}

/**
 * Delete a period template
 */
export async function deleteTemplate(id: string, scope: TenantScope) {
  const existing = await prisma.periodTemplate.findFirst({
    where: {
      id,
      orgId: scope.orgId,
    },
  });

  if (!existing) {
    return null;
  }

  // Don't allow deleting the default template
  if (existing.isDefault) {
    throw new Error("Cannot delete the default template");
  }

  // Slots are deleted via cascade
  return prisma.periodTemplate.delete({
    where: { id },
  });
}

/**
 * Create the default template for an organization if it doesn't exist
 */
export async function ensureDefaultTemplate(orgId: string) {
  const existing = await prisma.periodTemplate.findFirst({
    where: {
      orgId,
      isDefault: true,
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.periodTemplate.create({
    data: {
      name: "Default (8 Periods)",
      isDefault: true,
      orgId,
      slots: {
        create: DEFAULT_TEMPLATE_SLOTS.map((slot) => ({
          periodNumber: slot.periodNumber,
          startTime: slot.startTime,
          endTime: slot.endTime,
          isBreak: slot.isBreak,
          breakName: slot.breakName,
        })),
      },
    },
    include: {
      slots: {
        orderBy: { startTime: "asc" },
      },
    },
  });
}
