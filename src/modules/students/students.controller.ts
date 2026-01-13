import type { FastifyReply } from "fastify";
import type { ProtectedRequest } from "../../types/request.js";
import { getTenantScopeFromRequest } from "../../middleware/branch.middleware.js";
import {
  createStudentSchema,
  updateStudentSchema,
  studentIdParamSchema,
} from "./students.schema.js";
import * as studentsService from "./students.service.js";

/**
 * GET /students
 * List all students in the branch
 */
export async function listStudents(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const scope = getTenantScopeFromRequest(request);
  const students = await studentsService.getStudents(scope);

  return reply.code(200).send({
    data: students,
    count: students.length,
  });
}

/**
 * GET /students/:id
 * Get a single student by ID
 */
export async function getStudent(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const params = studentIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid student ID",
      details: params.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const student = await studentsService.getStudentById(params.data.id, scope);

  if (!student) {
    return reply.code(404).send({
      error: "Not Found",
      message: "Student not found",
    });
  }

  return reply.code(200).send({
    data: student,
  });
}

/**
 * POST /students
 * Create a new student
 */
export async function createStudent(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const body = createStudentSchema.safeParse(request.body);
  if (!body.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid request body",
      details: body.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const student = await studentsService.createStudent(body.data, scope);

  // Handle unexpected null response from service
  if (!student) {
    return reply.code(500).send({
      error: "Internal Server Error",
      message: "Failed to create student",
    });
  }

  return reply.code(201).send({
    data: student,
    message: "Student created successfully",
  });
}

/**
 * PUT /students/:id
 * Update an existing student
 */
export async function updateStudent(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const params = studentIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid student ID",
      details: params.error.flatten(),
    });
  }

  const body = updateStudentSchema.safeParse(request.body);
  if (!body.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid request body",
      details: body.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const student = await studentsService.updateStudent(
    params.data.id,
    body.data,
    scope
  );

  if (!student) {
    return reply.code(404).send({
      error: "Not Found",
      message: "Student not found",
    });
  }

  return reply.code(200).send({
    data: student,
    message: "Student updated successfully",
  });
}

/**
 * DELETE /students/:id
 * Soft delete (deactivate) a student
 */
export async function deleteStudent(
  request: ProtectedRequest,
  reply: FastifyReply
) {
  const params = studentIdParamSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid student ID",
      details: params.error.flatten(),
    });
  }

  const scope = getTenantScopeFromRequest(request);
  const student = await studentsService.deactivateStudent(params.data.id, scope);

  if (!student) {
    return reply.code(404).send({
      error: "Not Found",
      message: "Student not found",
    });
  }

  return reply.code(200).send({
    data: student,
    message: "Student deactivated successfully",
  });
}
