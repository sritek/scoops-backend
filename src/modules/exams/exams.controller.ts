/**
 * Exams Controller
 */

import type { FastifyReply } from "fastify";
import type { ProtectedRequest } from "../../types/request.js";
import { getTenantScopeFromRequest } from "../../middleware/branch.middleware.js";
import { parsePaginationParams } from "../../utils/pagination.js";
import {
  createExamSchema,
  updateExamSchema,
  examIdParamSchema,
  listExamsQuerySchema,
  saveScoresSchema,
  studentIdParamSchema,
} from "./exams.schema.js";
import * as examsService from "./exams.service.js";
import { generateReportCardPDF } from "./report-card.service.js";

/**
 * POST /exams
 * Create a new exam
 */
export async function createExam(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const scope = getTenantScopeFromRequest(request);
  const body = createExamSchema.parse(request.body);

  const exam = await examsService.createExam(
    body,
    request.userContext.userId,
    scope
  );

  return reply.code(201).send({
    data: exam,
  });
}

/**
 * GET /exams
 * List exams
 */
export async function listExams(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const scope = getTenantScopeFromRequest(request);
  const query = listExamsQuerySchema.parse(request.query);
  const pagination = parsePaginationParams({
    page: query.page?.toString(),
    limit: query.limit?.toString(),
  });

  const result = await examsService.getExams(scope, pagination, {
    batchId: query.batchId,
    subjectId: query.subjectId,
    type: query.type,
    isPublished: query.isPublished,
  });

  return reply.code(200).send(result);
}

/**
 * GET /exams/:id
 * Get exam by ID with scores
 */
export async function getExam(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const scope = getTenantScopeFromRequest(request);
  const { id } = examIdParamSchema.parse(request.params);

  const exam = await examsService.getExamById(id, scope);

  return reply.code(200).send({
    data: exam,
  });
}

/**
 * PUT /exams/:id
 * Update exam
 */
export async function updateExam(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const scope = getTenantScopeFromRequest(request);
  const { id } = examIdParamSchema.parse(request.params);
  const body = updateExamSchema.parse(request.body);

  const exam = await examsService.updateExam(id, body, scope);

  return reply.code(200).send({
    data: exam,
  });
}

/**
 * DELETE /exams/:id
 * Delete exam
 */
export async function deleteExam(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const scope = getTenantScopeFromRequest(request);
  const { id } = examIdParamSchema.parse(request.params);

  await examsService.deleteExam(id, scope);

  return reply.code(200).send({
    message: "Exam deleted",
  });
}

/**
 * GET /exams/:id/students
 * Get students for marks entry
 */
export async function getStudentsForMarks(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const scope = getTenantScopeFromRequest(request);
  const { id } = examIdParamSchema.parse(request.params);

  const students = await examsService.getStudentsForMarksEntry(id, scope);

  return reply.code(200).send({
    data: students,
  });
}

/**
 * POST /exams/:id/scores
 * Save exam scores (bulk)
 */
export async function saveScores(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const scope = getTenantScopeFromRequest(request);
  const { id } = examIdParamSchema.parse(request.params);
  const { scores } = saveScoresSchema.parse(request.body);

  const result = await examsService.saveExamScores(
    id,
    scores,
    request.userContext.userId,
    scope
  );

  return reply.code(200).send({
    data: result,
    message: "Scores saved successfully",
  });
}

/**
 * GET /exams/report-card/:studentId
 * Get student report card
 */
export async function getStudentReportCard(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const scope = getTenantScopeFromRequest(request);
  const { studentId } = studentIdParamSchema.parse(request.params);

  const reportCard = await examsService.getStudentReportCard(studentId, scope);

  return reply.code(200).send({
    data: reportCard,
  });
}

/**
 * GET /exams/report-card/:studentId/pdf
 * Download student report card as PDF
 */
export async function downloadReportCardPDF(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const scope = getTenantScopeFromRequest(request);
  const { studentId } = studentIdParamSchema.parse(request.params);

  const result = await generateReportCardPDF(studentId, scope);

  return reply
    .header("Content-Type", "application/pdf")
    .header("Content-Disposition", `attachment; filename="${result.fileName}"`)
    .send(result.stream);
}
