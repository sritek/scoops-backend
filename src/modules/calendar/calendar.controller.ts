/**
 * Calendar Controller
 *
 * HTTP handlers for academic calendar endpoints
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import * as calendarService from "./calendar.service.js";
import {
  createEventSchema,
  updateEventSchema,
  eventQuerySchema,
} from "./calendar.schema.js";

/**
 * GET /calendar/events - List events for a month
 */
export async function getEvents(request: FastifyRequest, reply: FastifyReply) {
  const query = eventQuerySchema.parse(request.query);
  const events = await calendarService.getEvents(request.scope, query);
  return reply.code(200).send({ events, month: query.month, year: query.year });
}

/**
 * GET /calendar/events/:id - Get single event
 */
export async function getEvent(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const event = await calendarService.getEvent(id, request.scope);
  return reply.code(200).send(event);
}

/**
 * POST /calendar/events - Create new event
 */
export async function createEvent(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const input = createEventSchema.parse(request.body);
  const event = await calendarService.createEvent(
    input,
    request.scope,
    request.user.id
  );
  return reply.code(201).send(event);
}

/**
 * PUT /calendar/events/:id - Update event
 */
export async function updateEvent(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { id } = request.params as { id: string };
  const input = updateEventSchema.parse(request.body);
  const event = await calendarService.updateEvent(id, input, request.scope);
  return reply.code(200).send(event);
}

/**
 * DELETE /calendar/events/:id - Delete event
 */
export async function deleteEvent(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { id } = request.params as { id: string };
  const result = await calendarService.deleteEvent(id, request.scope);
  return reply.code(200).send(result);
}

/**
 * GET /calendar/upcoming - Get upcoming events
 */
export async function getUpcomingEvents(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { days, batchId } = request.query as {
    days?: number;
    batchId?: string;
  };
  const events = await calendarService.getUpcomingEvents(
    request.scope,
    days ?? 7,
    batchId
  );
  return reply.code(200).send({ events });
}
