import { z } from "zod";

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

/**
 * Pagination metadata in response
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

/**
 * Default pagination values
 */
export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 20,
  MAX_LIMIT: 100,
  MIN_LIMIT: 1,
} as const;

/**
 * Zod schema for pagination query parameters
 * Accepts both string and number types since Fastify may coerce query params
 * based on OpenAPI schema (type: integer)
 */
export const paginationQuerySchema = z.object({
  page: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => {
      if (val === undefined || val === null) return PAGINATION_DEFAULTS.PAGE;
      const num = typeof val === "number" ? val : parseInt(val, 10);
      return isNaN(num) ? PAGINATION_DEFAULTS.PAGE : Math.max(1, num);
    }),
  limit: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => {
      if (val === undefined || val === null) return PAGINATION_DEFAULTS.LIMIT;
      const num = typeof val === "number" ? val : parseInt(val, 10);
      if (isNaN(num)) return PAGINATION_DEFAULTS.LIMIT;
      return Math.min(
        PAGINATION_DEFAULTS.MAX_LIMIT,
        Math.max(PAGINATION_DEFAULTS.MIN_LIMIT, num)
      );
    }),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/**
 * Parse pagination params from query string
 * Handles invalid values gracefully with defaults
 */
export function parsePaginationParams(query: {
  page?: string;
  limit?: string;
}): PaginationParams {
  const page = Math.max(
    1,
    parseInt(query.page || String(PAGINATION_DEFAULTS.PAGE), 10) || PAGINATION_DEFAULTS.PAGE
  );
  const limit = Math.min(
    PAGINATION_DEFAULTS.MAX_LIMIT,
    Math.max(
      PAGINATION_DEFAULTS.MIN_LIMIT,
      parseInt(query.limit || String(PAGINATION_DEFAULTS.LIMIT), 10) || PAGINATION_DEFAULTS.LIMIT
    )
  );
  return { page, limit };
}

/**
 * Calculate skip value for Prisma queries
 */
export function calculateSkip(params: PaginationParams): number {
  return (params.page - 1) * params.limit;
}

/**
 * Create a paginated response with metadata
 */
export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / params.limit);
  return {
    data,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages,
      hasNext: params.page < totalPages,
      hasPrev: params.page > 1,
    },
  };
}

/**
 * OpenAPI schema for pagination query parameters
 * Use this in route schemas
 */
export const paginationQueryOpenApi = {
  type: "object" as const,
  properties: {
    page: {
      type: "integer" as const,
      minimum: 1,
      default: PAGINATION_DEFAULTS.PAGE,
      description: "Page number (1-indexed)",
    },
    limit: {
      type: "integer" as const,
      minimum: PAGINATION_DEFAULTS.MIN_LIMIT,
      maximum: PAGINATION_DEFAULTS.MAX_LIMIT,
      default: PAGINATION_DEFAULTS.LIMIT,
      description: "Number of items per page",
    },
  },
};

/**
 * OpenAPI schema for pagination response metadata
 * Use this in response schemas
 */
export const paginationResponseOpenApi = {
  type: "object" as const,
  properties: {
    page: { type: "integer" as const },
    limit: { type: "integer" as const },
    total: { type: "integer" as const },
    totalPages: { type: "integer" as const },
    hasNext: { type: "boolean" as const },
    hasPrev: { type: "boolean" as const },
  },
};
