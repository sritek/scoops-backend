/**
 * Reports Controller
 */

import type { FastifyReply } from "fastify";
import type { ProtectedRequest } from "../../types/request.js";
import { getTenantScopeFromRequest } from "../../middleware/branch.middleware.js";
import { parsePaginationParams } from "../../utils/pagination.js";
import {
  requestReportSchema,
  reportIdParamSchema,
  listReportsQuerySchema,
} from "./reports.schema.js";
import * as reportsService from "./reports.service.js";
import fs from "fs";
import path from "path";

/**
 * POST /reports
 * Request a new report generation
 */
export async function requestReport(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const scope = getTenantScopeFromRequest(request);
  const body = requestReportSchema.parse(request.body);

  const report = await reportsService.requestReport(
    {
      type: body.type,
      format: body.format,
      parameters: body.parameters,
    },
    request.userContext.userId,
    scope
  );

  return reply.code(201).send({
    data: report,
    message: "Report generation started",
  });
}

/**
 * GET /reports
 * List all reports
 */
export async function listReports(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const scope = getTenantScopeFromRequest(request);
  const query = listReportsQuerySchema.parse(request.query);
  const pagination = parsePaginationParams({
    page: query.page?.toString(),
    limit: query.limit?.toString(),
  });

  const result = await reportsService.getReports(scope, pagination, {
    type: query.type,
    status: query.status,
  });

  return reply.code(200).send(result);
}

/**
 * GET /reports/:id
 * Get report by ID
 */
export async function getReport(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const scope = getTenantScopeFromRequest(request);
  const { id } = reportIdParamSchema.parse(request.params);

  const report = await reportsService.getReportById(id, scope);

  return reply.code(200).send({
    data: report,
  });
}

/**
 * GET /reports/:id/download
 * Download report file
 */
export async function downloadReport(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const scope = getTenantScopeFromRequest(request);
  const { id } = reportIdParamSchema.parse(request.params);

  const report = await reportsService.getReportById(id, scope);

  if (!report.filePath || report.status !== "completed") {
    return reply.code(400).send({
      error: "Report not ready for download",
    });
  }

  // Check if file exists
  if (!fs.existsSync(report.filePath)) {
    return reply.code(404).send({
      error: "Report file not found",
    });
  }

  const filename = path.basename(report.filePath);
  const contentType = report.format === "pdf"
    ? "application/pdf"
    : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  return reply
    .header("Content-Type", contentType)
    .header("Content-Disposition", `attachment; filename="${filename}"`)
    .send(fs.createReadStream(report.filePath));
}

/**
 * DELETE /reports/:id
 * Delete a report
 */
export async function deleteReport(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const scope = getTenantScopeFromRequest(request);
  const { id } = reportIdParamSchema.parse(request.params);

  await reportsService.deleteReport(id, scope);

  return reply.code(200).send({
    message: "Report deleted",
  });
}

/**
 * GET /reports/types
 * Get available report types
 */
export async function getReportTypes(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const types = reportsService.getReportTypes();

  return reply.code(200).send({
    data: types,
  });
}
