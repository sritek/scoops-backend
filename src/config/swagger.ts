import type { FastifyDynamicSwaggerOptions } from "@fastify/swagger";
import type { FastifySwaggerUiOptions } from "@fastify/swagger-ui";

/**
 * OpenAPI/Swagger configuration for the API
 */
export const swaggerConfig: FastifyDynamicSwaggerOptions = {
  mode: "dynamic",
  openapi: {
    openapi: "3.0.3",
    info: {
      title: "Scoops - School/Coaching Operations API",
      description: `
## Overview
REST API for the School/Coaching Operations System (Phase 1).

## Authentication
All endpoints (except /health) require a Bearer token in the Authorization header.

\`\`\`
Authorization: Bearer <your-token>
\`\`\`

## Roles & Permissions
- **admin**: Full access to all operations
- **teacher**: Student view, attendance marking for assigned batches
- **accounts**: Fee management, student view
- **staff**: Basic student view

## Multi-tenancy
All operations are scoped to the user's organization and branch.
      `,
      version: "1.0.0",
      contact: {
        name: "API Support",
      },
    },
    servers: [
      {
        url: "/api/v1",
        description: "API v1",
      },
    ],
    tags: [
      {
        name: "Students",
        description: "Student management operations",
      },
      {
        name: "Batches",
        description: "Batch/class management operations",
      },
      {
        name: "Attendance",
        description: "Attendance tracking operations",
      },
      {
        name: "Fees",
        description: "Fee plans and payment operations",
      },
      {
        name: "Dashboard",
        description: "Admin dashboard summaries",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter your JWT token",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
            message: { type: "string" },
          },
        },
        Student: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            firstName: { type: "string" },
            lastName: { type: "string" },
            fullName: { type: "string" },
            gender: { type: "string", enum: ["male", "female", "other"] },
            dob: { type: "string", format: "date" },
            category: { type: "string", enum: ["gen", "sc", "st", "obc", "minority"] },
            isCwsn: { type: "boolean" },
            admissionYear: { type: "integer" },
            status: { type: "string", enum: ["active", "inactive"] },
            batchId: { type: "string", format: "uuid", nullable: true },
            parents: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid" },
                  firstName: { type: "string" },
                  lastName: { type: "string" },
                  fullName: { type: "string" },
                  phone: { type: "string" },
                  relation: { type: "string" },
                },
              },
            },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        Batch: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            academicLevel: { type: "string" },
            stream: { type: "string", nullable: true },
            isActive: { type: "boolean" },
            teacher: {
              type: "object",
              nullable: true,
              properties: {
                id: { type: "string", format: "uuid" },
                firstName: { type: "string" },
                lastName: { type: "string" },
                fullName: { type: "string" },
              },
            },
            studentCount: { type: "integer" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        FeePlan: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            amount: { type: "integer" },
            frequency: { type: "string", enum: ["monthly", "custom"] },
            isActive: { type: "boolean" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        StudentFee: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            student: {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                firstName: { type: "string" },
                lastName: { type: "string" },
                fullName: { type: "string" },
              },
            },
            feePlan: {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                name: { type: "string" },
              },
            },
            totalAmount: { type: "integer" },
            paidAmount: { type: "integer" },
            pendingAmount: { type: "integer" },
            dueDate: { type: "string", format: "date" },
            status: { type: "string", enum: ["pending", "partial", "paid"] },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
};

/**
 * Swagger UI configuration
 */
export const swaggerUiConfig: FastifySwaggerUiOptions = {
  routePrefix: "/docs",
  uiConfig: {
    docExpansion: "list",
    deepLinking: true,
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    syntaxHighlight: {
      activate: true,
      theme: "monokai",
    },
  },
  staticCSP: true,
  transformStaticCSP: (header) => header,
};
