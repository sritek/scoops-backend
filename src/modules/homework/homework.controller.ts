/**
 * Homework Controller
 *
 * HTTP handlers for homework endpoints
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import * as homeworkService from "./homework.service.js";
import {
  createHomeworkSchema,
  updateHomeworkSchema,
  gradeSubmissionSchema,
  homeworkQuerySchema,
} from "./homework.schema.js";

/**
 * GET /homework - List homework
 */
export async function listHomework(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const query = homeworkQuerySchema.parse(request.query);
  const result = await homeworkService.listHomework(request.scope, query);
  return reply.code(200).send(result);
}

/**
 * GET /homework/stats - Get homework stats
 */
export async function getHomeworkStats(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const result = await homeworkService.getHomeworkStats(request.scope);
  return reply.code(200).send(result);
}

/**
 * GET /homework/:id - Get homework details
 */
export async function getHomework(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { id } = request.params as { id: string };
  const result = await homeworkService.getHomework(id, request.scope);
  return reply.code(200).send(result);
}

/**
 * POST /homework - Create homework
 */
export async function createHomework(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const input = createHomeworkSchema.parse(request.body);
  const result = await homeworkService.createHomework(
    input,
    request.scope,
    request.userContext.userId
  );
  return reply.code(201).send(result);
}

/**
 * PUT /homework/:id - Update homework
 */
export async function updateHomework(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { id } = request.params as { id: string };
  const input = updateHomeworkSchema.parse(request.body);
  const result = await homeworkService.updateHomework(id, input, request.scope);
  return reply.code(200).send(result);
}

/**
 * DELETE /homework/:id - Delete homework
 */
export async function deleteHomework(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { id } = request.params as { id: string };
  const result = await homeworkService.deleteHomework(id, request.scope);
  return reply.code(200).send(result);
}

/**
 * PUT /homework/:id/publish - Publish homework
 */
export async function publishHomework(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { id } = request.params as { id: string };
  const result = await homeworkService.publishHomework(id, request.scope);
  return reply.code(200).send(result);
}

/**
 * PUT /homework/:id/close - Close homework
 */
export async function closeHomework(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { id } = request.params as { id: string };
  const result = await homeworkService.closeHomework(id, request.scope);
  return reply.code(200).send(result);
}

/**
 * GET /homework/:id/submissions - Get submissions for grading
 */
export async function getSubmissions(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { id } = request.params as { id: string };
  const result = await homeworkService.getSubmissions(id, request.scope);
  return reply.code(200).send(result);
}

/**
 * PUT /homework/submissions/:submissionId/grade - Grade a submission
 */
export async function gradeSubmission(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { submissionId } = request.params as { submissionId: string };
  const input = gradeSubmissionSchema.parse(request.body);
  const result = await homeworkService.gradeSubmission(
    submissionId,
    input,
    request.scope,
    request.userContext.userId
  );
  return reply.code(200).send(result);
}
