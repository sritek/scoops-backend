import { beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import path from "path";

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, "../../.env.test") });

const prisma = new PrismaClient();

beforeAll(async () => {
  // Verify we're using the test database
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl?.includes("scoops_test")) {
    throw new Error(
      "Test setup error: DATABASE_URL must point to test database (scoops_test)"
    );
  }

  // Run seed to ensure consistent test data
  console.log("Setting up test database...");
});

afterAll(async () => {
  await prisma.$disconnect();
});

export { prisma };
