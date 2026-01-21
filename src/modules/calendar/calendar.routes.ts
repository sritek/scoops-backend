/**
 * Calendar Routes
 *
 * API routes for managing academic calendar events (staff only)
 */

import type { FastifyInstance } from "fastify";
import * as calendarController from "./calendar.controller.js";
import {
  branchContextMiddleware,
  setScopeMiddleware,
} from "../../middleware/branch.middleware.js";

export async function calendarRoutes(app: FastifyInstance) {
  /**
   * GET /calendar/events - List events for a month
   */
  app.get(
    "/events",
    {
      schema: {
        tags: ["Calendar"],
        summary: "List calendar events",
        description: "Get academic calendar events for a specific month",
        querystring: {
          type: "object",
          required: ["month", "year"],
          properties: {
            month: { type: "number", minimum: 1, maximum: 12 },
            year: { type: "number", minimum: 2020, maximum: 2100 },
            batchId: { type: "string", format: "uuid" },
            type: {
              type: "string",
              enum: ["holiday", "exam", "ptm", "event", "deadline"],
            },
          },
        },
      },
      preHandler: [branchContextMiddleware, setScopeMiddleware],
    },
    calendarController.getEvents
  );

  /**
   * GET /calendar/upcoming - Get upcoming events
   */
  app.get(
    "/upcoming",
    {
      schema: {
        tags: ["Calendar"],
        summary: "Get upcoming events",
        description: "Get upcoming events for the next N days",
        querystring: {
          type: "object",
          properties: {
            days: { type: "number", minimum: 1, maximum: 30, default: 7 },
            batchId: { type: "string", format: "uuid" },
          },
        },
      },
      preHandler: [branchContextMiddleware, setScopeMiddleware],
    },
    calendarController.getUpcomingEvents
  );

  /**
   * GET /calendar/events/:id - Get single event
   */
  app.get(
    "/events/:id",
    {
      schema: {
        tags: ["Calendar"],
        summary: "Get event details",
        description: "Get details of a specific calendar event",
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
      },
      preHandler: [branchContextMiddleware, setScopeMiddleware],
    },
    calendarController.getEvent
  );

  /**
   * POST /calendar/events - Create event
   */
  app.post(
    "/events",
    {
      schema: {
        tags: ["Calendar"],
        summary: "Create calendar event",
        description: "Create a new academic calendar event",
        body: {
          type: "object",
          required: ["type", "title", "startDate"],
          properties: {
            batchId: { type: "string", format: "uuid", nullable: true },
            type: {
              type: "string",
              enum: ["holiday", "exam", "ptm", "event", "deadline"],
            },
            title: { type: "string", minLength: 1, maxLength: 200 },
            description: { type: "string", maxLength: 1000, nullable: true },
            startDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
            endDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", nullable: true },
            isAllDay: { type: "boolean", default: true },
          },
        },
      },
      preHandler: [branchContextMiddleware, setScopeMiddleware],
    },
    calendarController.createEvent
  );

  /**
   * PUT /calendar/events/:id - Update event
   */
  app.put(
    "/events/:id",
    {
      schema: {
        tags: ["Calendar"],
        summary: "Update calendar event",
        description: "Update an existing academic calendar event",
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          properties: {
            batchId: { type: "string", format: "uuid", nullable: true },
            type: {
              type: "string",
              enum: ["holiday", "exam", "ptm", "event", "deadline"],
            },
            title: { type: "string", minLength: 1, maxLength: 200 },
            description: { type: "string", maxLength: 1000, nullable: true },
            startDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
            endDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", nullable: true },
            isAllDay: { type: "boolean" },
          },
        },
      },
      preHandler: [branchContextMiddleware, setScopeMiddleware],
    },
    calendarController.updateEvent
  );

  /**
   * DELETE /calendar/events/:id - Delete event
   */
  app.delete(
    "/events/:id",
    {
      schema: {
        tags: ["Calendar"],
        summary: "Delete calendar event",
        description: "Delete an academic calendar event",
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
      },
      preHandler: [branchContextMiddleware, setScopeMiddleware],
    },
    calendarController.deleteEvent
  );
}
