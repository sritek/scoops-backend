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
REST API for the School/Coaching Operations System.

## Authentication
All endpoints (except /health and public payment pages) require a Bearer token in the Authorization header.

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

## Fee System
The fee system uses a hierarchical structure:
1. **Fee Components**: Organization-level fee types (tuition, transport, etc.)
2. **Batch Fee Structures**: Fee templates for batches/classes per academic session
3. **Student Fee Structures**: Individual student fees with scholarships applied
4. **Fee Installments**: Scheduled payment amounts with due dates
5. **Installment Payments**: Payment records against installments

Payment operations use the installments module (\`/api/v1/installments\`).
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
        name: "Fee Components",
        description: "Fee component type management (tuition, transport, etc.)",
      },
      {
        name: "Batch Fee Structure",
        description: "Fee structure templates for batches/classes",
      },
      {
        name: "Student Fee Structure",
        description: "Individual student fee structures with scholarships",
      },
      {
        name: "Installments",
        description: "Fee installment generation and payment recording",
      },
      {
        name: "EMI Templates",
        description: "EMI plan templates for installment generation",
      },
      {
        name: "Scholarships",
        description: "Scholarship management and student assignments",
      },
      {
        name: "Receipts",
        description: "Payment receipt generation and management",
      },
      {
        name: "Payment Links",
        description: "Online payment link generation for installments",
      },
      {
        name: "Public Payment",
        description: "Public payment page endpoints (no auth required)",
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
            category: {
              type: "string",
              enum: ["gen", "sc", "st", "obc", "minority"],
            },
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
        FeeInstallment: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            studentFeeStructureId: { type: "string", format: "uuid" },
            installmentNumber: { type: "integer" },
            amount: { type: "integer" },
            paidAmount: { type: "integer" },
            dueDate: { type: "string", format: "date" },
            status: {
              type: "string",
              enum: ["upcoming", "due", "partial", "paid", "overdue"],
            },
          },
        },
        StudentFeeStructure: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            studentId: { type: "string", format: "uuid" },
            sessionId: { type: "string", format: "uuid" },
            grossAmount: { type: "integer" },
            scholarshipAmount: { type: "integer" },
            netAmount: { type: "integer" },
            source: { type: "string", enum: ["batch", "custom", "migrated"] },
          },
        },
        FeeComponent: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            type: {
              type: "string",
              enum: [
                "tuition",
                "admission",
                "transport",
                "lab",
                "library",
                "sports",
                "exam",
                "uniform",
                "misc",
              ],
            },
            description: { type: "string", nullable: true },
            isActive: { type: "boolean" },
          },
        },
        BatchFeeStructure: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            batchId: { type: "string", format: "uuid" },
            sessionId: { type: "string", format: "uuid" },
            name: { type: "string" },
            totalAmount: { type: "integer" },
            isActive: { type: "boolean" },
            lineItems: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  feeComponentId: { type: "string", format: "uuid" },
                  amount: { type: "integer" },
                },
              },
            },
          },
        },
        InstallmentPayment: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            installmentId: { type: "string", format: "uuid" },
            amount: { type: "integer" },
            paymentMode: { type: "string", enum: ["cash", "upi", "bank"] },
            transactionRef: { type: "string", nullable: true },
            paidAt: { type: "string", format: "date-time" },
          },
        },
        EMIPlanTemplate: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            installmentCount: { type: "integer" },
            splitConfig: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  percent: { type: "number" },
                  dueDaysFromStart: { type: "integer" },
                },
              },
            },
            isDefault: { type: "boolean" },
            isActive: { type: "boolean" },
          },
        },
        Scholarship: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            type: {
              type: "string",
              enum: ["percentage", "fixed_amount", "component_waiver"],
            },
            basis: {
              type: "string",
              enum: [
                "merit",
                "need_based",
                "sports",
                "sibling",
                "staff_ward",
                "government",
                "custom",
              ],
            },
            value: { type: "number" },
            maxAmount: { type: "number", nullable: true },
            isActive: { type: "boolean" },
          },
        },
        Receipt: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            receiptNumber: { type: "string" },
            installmentPaymentId: { type: "string", format: "uuid" },
            generatedAt: { type: "string", format: "date-time" },
          },
        },
        PaymentLink: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            shortCode: { type: "string" },
            installmentId: { type: "string", format: "uuid" },
            amount: { type: "integer" },
            status: {
              type: "string",
              enum: ["active", "expired", "paid", "cancelled"],
            },
            expiresAt: { type: "string", format: "date-time" },
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
